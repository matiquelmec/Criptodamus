const TechnicalAnalysisService = require('./technicalAnalysisService');
const RiskManager = require('./riskManager');
const IntelligentCache = require('../utils/intelligentCache');
const averagingSystemService = require('./averagingSystemService');

// Sistema de logging robusto
let logger, signalLogger;
try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger;
  signalLogger = loggerModule.signalLogger;
} catch (error) {
  // Fallback si el logger no está disponible
  const fallbackLogger = {
    info: (msg, meta) => console.log(`INFO: ${msg}`, meta ? JSON.stringify(meta) : ''),
    error: (msg, meta) => console.error(`ERROR: ${msg}`, meta ? JSON.stringify(meta) : ''),
    warn: (msg, meta) => console.warn(`WARN: ${msg}`, meta ? JSON.stringify(meta) : '')
  };
  logger = fallbackLogger;
  signalLogger = {
    logSignalGeneration: (data) => fallbackLogger.info('SIGNAL_GENERATION', data),
    logSignalError: (symbol, error, context) => fallbackLogger.error(`SIGNAL_ERROR_${symbol}`, { error: error.message, context }),
    logBulkScan: (data) => fallbackLogger.info('BULK_SCAN', data)
  };
}

class SignalGeneratorService {
  constructor(options = {}) {
    this.technicalAnalysis = new TechnicalAnalysisService(options.marketDataService);
    this.riskManager = new RiskManager();

    this.config = {
      // Filtros de confluencia (ULTRA AGRESIVOS PARA MÁXIMAS SEÑALES)
      minConfluenceScore: options.minConfluenceScore || 25, // ULTRA AGRESIVO
      minRiskReward: options.minRiskReward || 2.0, // MÍNIMO 2:1 R:R SEGÚN PDF
      maxRiskPerTrade: options.maxRiskPerTrade || 2.0, // MÁXIMO 2% - REGLA CRÍTICA PDF
      // Umbrales asimétricos (tendencia vs contra-tendencia)
      minConfluenceTrend: options.minConfluenceTrend || 30, // MUY BAJO para más señales
      minConfluenceCounterTrend: options.minConfluenceCounterTrend || 40, // BAJO para counter-trend
      minRRTrend: options.minRRTrend || 2.0, // R:R mínimo 2:1 SEGÚN PDF
      minRRCounterTrend: options.minRRCounterTrend || 2.5, // R:R counter-trend más estricto
      riskCounterTrendMultiplier: options.riskCounterTrendMultiplier || 0.7,

      // Filtros técnicos ULTRA SENSIBLES
      rsiOverbought: 75, // Más permisivo
      rsiOversold: 25,   // Más permisivo
      minPatternConfidence: 50, // Menos exigente
      minSRStrength: 50, // Menos exigente

      // Configuración de timeframes PROFESIONAL MULTI-TIMEFRAME OBLIGATORIO
      timeframes: {
        primary: '5m',      // Timeframe principal para señales
        secondary: '15m',   // Timeframe secundario para confirmación
        tertiary: '1h',     // Timeframe terciario para tendencia principal
        longTerm: '4h',     // Timeframe largo para contexto macro
        // Análisis multi-timeframe obligatorio según PDF
        mandatory: ['5m', '15m', '1h', '4h'], // OBLIGATORIO analizar todos
        optional: ['1m', '30m', '2h', '6h', '12h', '1d'], // Opcional para contexto
        confluenceRequired: 3, // Mínimo 3 timeframes deben coincidir
        weightFactors: {
          '1m': 0.5,   // Peso reducido para scalping extremo
          '5m': 1.0,   // Peso base
          '15m': 1.2,  // Peso aumentado para confirmación
          '1h': 1.5,   // Peso alto para tendencia
          '4h': 2.0,   // Peso máximo para contexto macro
          '1d': 1.8    // Peso alto pero menos que 4h
        }
      },
      primaryTimeframe: '5m', // CAMBIO CRÍTICO: 5min para scalping

      // Filtros de volatilidad
      maxBBWPExpansion: 90,
      minBBWPSqueeze: 15,

      // Validación de señales
      enableMultiTimeframe: true,
      enableVolumeConfirmation: true,
      enableMacroFilter: true
    };

    // Cache inteligente con límites y limpieza automática
    this.signalCache = new IntelligentCache({
      maxSize: 200, // Máximo 200 señales en cache
      defaultTTL: 15 * 60 * 1000, // 15 minutos TTL
      cleanupInterval: 5 * 60 * 1000 // Limpieza cada 5 minutos
    });

    // Estadísticas de señales
    this.stats = {
      signalsGenerated: 0,
      signalsFiltered: 0,
      confluenceDistribution: {},
      signalTypes: {
        long: 0,
        short: 0
      }
    };
  }

  // ================== GENERACIÓN DE SEÑALES ==================

  async generateSignal(symbol, options = {}) {
    try {
      const {
        timeframe = this.config.primaryTimeframe,
        accountBalance = 10000,
        forceRefresh = false
      } = options;

      const cacheKey = `${symbol}_${timeframe}`;

      // Verificar cache inteligente
      if (!forceRefresh) {
        const cached = this.signalCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      logger.info(`Generando señal para ${symbol}`, { timeframe, accountBalance });

      // Obtener análisis técnico completo
      const analysis = await this.technicalAnalysis.analyzeSymbol(symbol, timeframe, 200);

      // Aplicar filtros de confluencia
      const signalData = await this.processAnalysisForSignal(analysis, symbol, accountBalance);

      // Guardar en cache inteligente
      this.signalCache.set(cacheKey, signalData);

      // Actualizar estadísticas
      this.updateStats(signalData);

      logger.info(`Señal generada para ${symbol}`, {
        direction: signalData.direction,
        confluenceScore: signalData.confluenceScore,
        riskReward: signalData.riskReward
      });

      return signalData;

    } catch (error) {
      logger.error(`Error generando señal para ${symbol}:`, error);
      throw error;
    }
  }

  // ================== ANÁLISIS MULTI-TIMEFRAME OBLIGATORIO ==================

  async generateMultiTimeframeSignal(symbol, options = {}) {
    try {
      const {
        accountBalance = 10000,
        forceRefresh = false,
        includeOptional = false
      } = options;

      logger.info(`Iniciando análisis multi-timeframe OBLIGATORIO para ${symbol}`, {
        mandatory: this.config.timeframes.mandatory,
        confluenceRequired: this.config.timeframes.confluenceRequired
      });

      // FASE 1: Análisis obligatorio en todos los timeframes mandatorios
      const mandatoryAnalysis = await this.analyzeMandatoryTimeframes(symbol, accountBalance, forceRefresh);

      // FASE 2: Validar confluencia mínima requerida
      const confluenceValidation = this.validateTimeframeConfluence(mandatoryAnalysis);

      if (!confluenceValidation.valid) {
        return this.createMultiTimeframeRejectedSignal(
          symbol,
          mandatoryAnalysis,
          confluenceValidation.reason
        );
      }

      // FASE 3: Análisis opcional para contexto adicional (si se solicita)
      let optionalAnalysis = {};
      if (includeOptional) {
        optionalAnalysis = await this.analyzeOptionalTimeframes(symbol, accountBalance, forceRefresh);
      }

      // FASE 4: Combinar análisis y generar señal final
      const finalSignal = await this.synthesizeMultiTimeframeSignal(
        symbol,
        mandatoryAnalysis,
        optionalAnalysis,
        confluenceValidation,
        accountBalance
      );

      // Actualizar estadísticas
      this.updateMultiTimeframeStats(finalSignal);

      logger.info(`Señal multi-timeframe generada para ${symbol}`, {
        timeframesAnalyzed: Object.keys(mandatoryAnalysis).length,
        confluenceScore: finalSignal.multiTimeframeAnalysis?.confluenceScore,
        finalDirection: finalSignal.direction
      });

      return finalSignal;

    } catch (error) {
      logger.error(`Error en análisis multi-timeframe para ${symbol}:`, error);
      throw error;
    }
  }

  async analyzeMandatoryTimeframes(symbol, accountBalance, forceRefresh) {
    const mandatoryTimeframes = this.config.timeframes.mandatory;
    const analysis = {};

    // Analizar cada timeframe obligatorio en paralelo para eficiencia
    const analysisPromises = mandatoryTimeframes.map(async (timeframe) => {
      try {
        const timeframeAnalysis = await this.technicalAnalysis.analyzeSymbol(symbol, timeframe, 200);

        // Procesar análisis para obtener señal direccional
        const signalData = await this.processAnalysisForSignal(timeframeAnalysis, symbol, accountBalance);

        return {
          timeframe,
          analysis: timeframeAnalysis,
          signal: signalData,
          weight: this.config.timeframes.weightFactors[timeframe] || 1.0
        };
      } catch (error) {
        logger.warn(`Error analizando timeframe ${timeframe} para ${symbol}:`, error.message);
        return {
          timeframe,
          analysis: null,
          signal: null,
          weight: 0,
          error: error.message
        };
      }
    });

    const results = await Promise.all(analysisPromises);

    // Organizar resultados por timeframe
    results.forEach(result => {
      analysis[result.timeframe] = result;
    });

    return analysis;
  }

  async analyzeOptionalTimeframes(symbol, accountBalance, forceRefresh) {
    const optionalTimeframes = this.config.timeframes.optional;
    const analysis = {};

    // Analizar solo algunos timeframes opcionales para no sobrecargar
    const selectedOptional = optionalTimeframes.slice(0, 3); // Máximo 3 opcionales

    for (const timeframe of selectedOptional) {
      try {
        const timeframeAnalysis = await this.technicalAnalysis.analyzeSymbol(symbol, timeframe, 100);
        const signalData = await this.processAnalysisForSignal(timeframeAnalysis, symbol, accountBalance);

        analysis[timeframe] = {
          timeframe,
          analysis: timeframeAnalysis,
          signal: signalData,
          weight: this.config.timeframes.weightFactors[timeframe] || 0.5
        };
      } catch (error) {
        logger.warn(`Error analizando timeframe opcional ${timeframe}:`, error.message);
      }
    }

    return analysis;
  }

  validateTimeframeConfluence(mandatoryAnalysis) {
    const validTimeframes = Object.values(mandatoryAnalysis).filter(tf => tf.signal && tf.signal.success);

    if (validTimeframes.length < this.config.timeframes.confluenceRequired) {
      return {
        valid: false,
        reason: `Insuficientes timeframes válidos: ${validTimeframes.length}/${this.config.timeframes.confluenceRequired} requeridos`,
        validTimeframes: validTimeframes.length,
        requiredTimeframes: this.config.timeframes.confluenceRequired
      };
    }

    // Analizar direcciones de señales
    const directions = validTimeframes.map(tf => tf.signal.direction).filter(dir => dir !== 'neutral');
    const longCount = directions.filter(dir => dir === 'long').length;
    const shortCount = directions.filter(dir => dir === 'short').length;

    // Calcular confluencia direccional
    const totalDirectional = longCount + shortCount;
    const majorityThreshold = Math.ceil(totalDirectional * 0.6); // 60% debe coincidir

    let confluenceDirection = 'neutral';
    let confluenceStrength = 0;

    if (longCount >= majorityThreshold) {
      confluenceDirection = 'long';
      confluenceStrength = (longCount / totalDirectional) * 100;
    } else if (shortCount >= majorityThreshold) {
      confluenceDirection = 'short';
      confluenceStrength = (shortCount / totalDirectional) * 100;
    }

    if (confluenceDirection === 'neutral' && totalDirectional > 0) {
      return {
        valid: false,
        reason: `Sin confluencia direccional clara: ${longCount} LONG vs ${shortCount} SHORT`,
        confluenceDirection,
        confluenceStrength,
        longCount,
        shortCount
      };
    }

    return {
      valid: true,
      confluenceDirection,
      confluenceStrength,
      validTimeframes: validTimeframes.length,
      longCount,
      shortCount,
      neutralCount: validTimeframes.length - totalDirectional
    };
  }

  async synthesizeMultiTimeframeSignal(symbol, mandatoryAnalysis, optionalAnalysis, confluenceValidation, accountBalance) {
    const allAnalysis = { ...mandatoryAnalysis, ...optionalAnalysis };

    // Calcular score ponderado por timeframe
    let weightedScore = 0;
    let totalWeight = 0;
    let bestSignal = null;

    for (const [timeframe, data] of Object.entries(allAnalysis)) {
      if (data.signal && data.signal.success && data.signal.direction !== 'neutral') {
        const weight = data.weight;
        const score = data.signal.confluenceScore || 0;

        weightedScore += score * weight;
        totalWeight += weight;

        // Usar la señal del timeframe principal como base
        if (timeframe === this.config.timeframes.primary) {
          bestSignal = data.signal;
        }
      }
    }

    const finalConfluenceScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

    // Si no hay señal del timeframe principal, usar la mejor disponible
    if (!bestSignal) {
      const validSignals = Object.values(allAnalysis)
        .filter(data => data.signal && data.signal.success && data.signal.direction !== 'neutral')
        .sort((a, b) => (b.signal.confluenceScore || 0) - (a.signal.confluenceScore || 0));

      bestSignal = validSignals.length > 0 ? validSignals[0].signal : null;
    }

    if (!bestSignal) {
      return this.createMultiTimeframeNeutralSignal(symbol, allAnalysis, confluenceValidation);
    }

    // Enriquecer señal con análisis multi-timeframe
    return {
      ...bestSignal,
      type: 'MULTI_TIMEFRAME_SIGNAL',

      // Información multi-timeframe
      multiTimeframeAnalysis: {
        confluenceScore: finalConfluenceScore,
        confluenceDirection: confluenceValidation.confluenceDirection,
        confluenceStrength: confluenceValidation.confluenceStrength,
        timeframesAnalyzed: Object.keys(allAnalysis).length,
        mandatoryTimeframes: Object.keys(mandatoryAnalysis).length,
        optionalTimeframes: Object.keys(optionalAnalysis).length,
        weightedScore: finalConfluenceScore,

        // Breakdown por timeframe
        timeframeBreakdown: Object.entries(allAnalysis).map(([tf, data]) => ({
          timeframe: tf,
          direction: data.signal?.direction || 'error',
          confluenceScore: data.signal?.confluenceScore || 0,
          weight: data.weight,
          success: data.signal?.success || false,
          error: data.error || null
        }))
      },

      // Validación reforzada
      validation: {
        ...bestSignal.riskValidation,
        multiTimeframeConfirmed: true,
        confluenceRequirementMet: confluenceValidation.valid,
        minimumTimeframesMet: confluenceValidation.validTimeframes >= this.config.timeframes.confluenceRequired
      },

      // Confianza aumentada por confluencia multi-timeframe
      confidence: Math.min(100, (bestSignal.confluenceScore + finalConfluenceScore) / 2),

      // Metadata actualizada
      generatedBy: 'SignalGeneratorService_MultiTimeframe',
      version: '2.0.0',
      analysisType: 'multi_timeframe_mandatory'
    };
  }

  createMultiTimeframeRejectedSignal(symbol, mandatoryAnalysis, reason) {
    return {
      success: false,
      type: 'MULTI_TIMEFRAME_REJECTED',
      symbol,
      direction: 'neutral',
      timestamp: new Date(),

      reason: reason,
      recommendation: 'AVOID',
      message: 'Señal rechazada por falta de confluencia multi-timeframe',

      multiTimeframeAnalysis: {
        confluenceScore: 0,
        timeframesAnalyzed: Object.keys(mandatoryAnalysis).length,
        validTimeframes: Object.values(mandatoryAnalysis).filter(tf => tf.signal && tf.signal.success).length,
        requiredTimeframes: this.config.timeframes.confluenceRequired,
        rejectionReason: reason
      }
    };
  }

  createMultiTimeframeNeutralSignal(symbol, allAnalysis, confluenceValidation) {
    return {
      success: true,
      type: 'MULTI_TIMEFRAME_NEUTRAL',
      symbol,
      direction: 'neutral',
      timestamp: new Date(),

      reason: 'Sin señales direccionales válidas en análisis multi-timeframe',
      recommendation: 'WAIT',
      message: 'Esperar mejores condiciones en múltiples timeframes',

      multiTimeframeAnalysis: {
        confluenceScore: 0,
        confluenceDirection: 'neutral',
        confluenceStrength: 0,
        timeframesAnalyzed: Object.keys(allAnalysis).length,
        validTimeframes: confluenceValidation.validTimeframes || 0,
        requiredTimeframes: this.config.timeframes.confluenceRequired
      }
    };
  }

  updateMultiTimeframeStats(signalData) {
    if (!this.stats.multiTimeframe) {
      this.stats.multiTimeframe = {
        signalsGenerated: 0,
        confluenceSuccess: 0,
        confluenceFailure: 0,
        averageTimeframes: 0,
        averageConfluence: 0
      };
    }

    this.stats.multiTimeframe.signalsGenerated++;

    if (signalData.multiTimeframeAnalysis) {
      const mta = signalData.multiTimeframeAnalysis;

      if (mta.confluenceScore > 60) {
        this.stats.multiTimeframe.confluenceSuccess++;
      } else {
        this.stats.multiTimeframe.confluenceFailure++;
      }

      // Actualizar promedios
      this.stats.multiTimeframe.averageTimeframes =
        ((this.stats.multiTimeframe.averageTimeframes * (this.stats.multiTimeframe.signalsGenerated - 1)) +
         mta.timeframesAnalyzed) / this.stats.multiTimeframe.signalsGenerated;

      this.stats.multiTimeframe.averageConfluence =
        ((this.stats.multiTimeframe.averageConfluence * (this.stats.multiTimeframe.signalsGenerated - 1)) +
         mta.confluenceScore) / this.stats.multiTimeframe.signalsGenerated;
    }
  }

  async processAnalysisForSignal(analysis, symbol, accountBalance) {
    const currentPrice = this.extractCurrentPrice(analysis);

    // Análisis de confluencia básico
    const confluenceAnalysis = this.calculateConfluenceScore(analysis);

    // Determinar dirección de la señal
    const direction = this.determineSignalDirection(analysis, confluenceAnalysis);

    // Detectar si es contra-tendencia según el resumen de tendencia
    const trendRecommendation = analysis?.summary?.recommendation;
    const isCounterTrend = (
      (direction === 'long' && trendRecommendation === 'bearish') ||
      (direction === 'short' && trendRecommendation === 'bullish')
    );

    if (direction === 'neutral') {
      return this.createNeutralSignal(symbol, analysis, currentPrice);
    }

    // Calcular niveles de entrada, SL y TP
    const levels = await this.calculateSignalLevels(analysis, direction, currentPrice);

    // Validar con risk management (reducir riesgo si es contra-tendencia)
    const effectiveMaxRisk = isCounterTrend
      ? Math.max(0.1, this.config.maxRiskPerTrade * this.config.riskCounterTrendMultiplier)
      : this.config.maxRiskPerTrade;

    const riskValidation = this.validateWithRiskManagement(
      accountBalance,
      levels.entry,
      levels.stopLoss,
      effectiveMaxRisk
    );

    if (!riskValidation.valid) {
      return this.createRejectedSignal(symbol, analysis, riskValidation.reason, currentPrice);
    }

    // Aplicar filtros adicionales (asimétricos para contra-tendencia)
    const filters = await this.applySignalFilters(analysis, levels, symbol, direction, confluenceAnalysis.score, isCounterTrend);

    if (!filters.passed) {
      return this.createFilteredSignal(symbol, analysis, filters.failedFilters, currentPrice);
    }

    // Crear señal válida
    return await this.createValidSignal(
      symbol,
      analysis,
      direction,
      levels,
      confluenceAnalysis,
      riskValidation,
      currentPrice
    );
  }

  // ================== CÁLCULO DE CONFLUENCIA ==================

  calculateConfluenceScore(analysis) {
    let score = 0;
    const factors = [];
    const maxScore = 100;

    // Factor RSI (MEJORADO - 40 puntos máximo)
    if (analysis.rsi && analysis.rsi.length > 0) {
      const currentRSI = analysis.rsi[analysis.rsi.length - 1];

      if (currentRSI <= 30) {
        const intensity = Math.max(0, (30 - currentRSI) / 30) * 40; // 0-40 puntos
        score += intensity;
        factors.push({ type: 'rsi_oversold', weight: intensity, value: currentRSI });
      } else if (currentRSI >= 70) {
        const intensity = Math.max(0, (currentRSI - 70) / 30) * -40; // 0 a -40 puntos
        score += intensity;
        factors.push({ type: 'rsi_overbought', weight: intensity, value: currentRSI });
      } else if (currentRSI <= 40) {
        // RSI bajo pero no extremo - señal alcista moderada
        score += 20;
        factors.push({ type: 'rsi_low', weight: 20, value: currentRSI });
      } else if (currentRSI >= 60) {
        // RSI alto pero no extremo - señal bajista moderada
        score -= 20;
        factors.push({ type: 'rsi_high', weight: -20, value: currentRSI });
      }

      // Divergencias RSI (bonus)
      if (analysis.rsiDivergences && analysis.rsiDivergences.length > 0) {
        const strongDivergences = analysis.rsiDivergences.filter(d => d.strength > 60);
        if (strongDivergences.length > 0) {
          const divergence = strongDivergences[0];
          const weight = divergence.type === 'bullish' ? 20 : -20;
          score += weight;
          factors.push({
            type: `rsi_divergence_${divergence.type}`,
            weight,
            strength: divergence.strength
          });
        }
      }
    }

    // Factor Soportes y Resistencias (25 puntos máximo)
    if (analysis.supportResistance) {
      const sr = analysis.supportResistance;
      const currentPrice = this.extractCurrentPrice(analysis);

      // Niveles cercanos y fuertes
      const nearbyLevels = sr.dynamicLevels.filter(level => {
        const distance = Math.abs(level.price - currentPrice) / currentPrice;
        return distance < 0.02 && level.strength > this.config.minSRStrength;
      });

      nearbyLevels.forEach(level => {
        const weight = level.type === 'support' && currentPrice > level.price ? 12 :
                      level.type === 'resistance' && currentPrice < level.price ? -12 : 0;

        if (weight !== 0) {
          score += weight;
          factors.push({
            type: `strong_${level.type}`,
            weight,
            strength: level.strength,
            distance: ((level.price - currentPrice) / currentPrice * 100).toFixed(2) + '%'
          });
        }
      });
    }

    // Factor BBWP (15 puntos máximo)
    if (analysis.bbwp && analysis.bbwp.length > 0) {
      const currentBBWP = analysis.bbwp[analysis.bbwp.length - 1];

      if (currentBBWP.squeeze) {
        score += 15;
        factors.push({
          type: 'bbwp_squeeze',
          weight: 15,
          value: currentBBWP.value
        });
      } else if (currentBBWP.expansion) {
        score -= 10;
        factors.push({
          type: 'bbwp_expansion',
          weight: -10,
          value: currentBBWP.value
        });
      }
    }

    // Factor Fibonacci (15 puntos máximo)
    if (analysis.fibonacci && analysis.fibonacci.goldenPocket.length > 0) {
      const currentPrice = this.extractCurrentPrice(analysis);
      const nearGoldenPocket = analysis.fibonacci.goldenPocket.filter(level => {
        const distance = Math.abs(level.price - currentPrice) / currentPrice;
        return distance < 0.01; // Dentro del 1%
      });

      if (nearGoldenPocket.length > 0) {
        score += 15;
        factors.push({
          type: 'near_golden_pocket',
          weight: 15,
          levels: nearGoldenPocket.length
        });
      }
    }

    // Factor Patrones Chartistas (15 puntos máximo)
    if (analysis.patterns && analysis.patterns.length > 0) {
      const strongPatterns = analysis.patterns.filter(p =>
        p.confidence > this.config.minPatternConfidence
      );

      strongPatterns.forEach(pattern => {
        const weight = this.getPatternWeight(pattern);
        score += weight;
        factors.push({
          type: `pattern_${pattern.type}`,
          weight,
          confidence: pattern.confidence,
          subtype: pattern.subtype
        });
      });
    }

    // Amplificar score para generar señales más extremas
    let amplifiedScore = score * 1.5; // Amplificar por 1.5x
    
    // Bonus por condiciones de mercado extremo
    if (Math.abs(amplifiedScore) > 30) {
      amplifiedScore *= 1.3; // Amplificar aún más las señales fuertes
    }
    
    // Normalizar pero permitir rangos más amplios
    const finalScore = Math.max(-150, Math.min(150, amplifiedScore));

    return {
      score: finalScore,
      factors,
      interpretation: this.interpretConfluenceScore(finalScore),
      recommendation: Math.abs(finalScore) > this.config.minConfluenceScore ? 'strong' :
                     Math.abs(finalScore) > 60 ? 'moderate' : 'weak'
    };
  }

  // ================== DETERMINACIÓN DE DIRECCIÓN ==================

  determineSignalDirection(analysis, confluenceAnalysis) {
    let bullishSignals = 0;
    let bearishSignals = 0;

    // Analizar cada factor de confluencia
    confluenceAnalysis.factors.forEach(factor => {
      if (factor.weight > 0) bullishSignals++;
      if (factor.weight < 0) bearishSignals++;
    });

    // RSI adicional
    if (analysis.rsi && analysis.rsi.length > 0) {
      const rsi = analysis.rsi[analysis.rsi.length - 1];
      if (rsi < 30) bullishSignals++;
      if (rsi > 70) bearishSignals++;
    }

    // Tendencia general basada en summary
    if (analysis.summary) {
      if (analysis.summary.recommendation === 'bullish') bullishSignals += 2;
      if (analysis.summary.recommendation === 'bearish') bearishSignals += 2;
    }

    // Decidir dirección usando el score simétrico (UMBRALES ULTRA REDUCIDOS)
    const absScore = Math.abs(confluenceAnalysis.score);

    // Lógica mejorada basada en condiciones de mercado
    if (confluenceAnalysis.score > 10) { // Reducido drásticamente de 25 a 10
      return 'long';
    } else if (confluenceAnalysis.score < -10) { // Reducido drásticamente de -25 a -10
      return 'short';
    } else if (bullishSignals > bearishSignals + 1) {
      return 'long'; // Forzar LONG si hay más señales alcistas
    } else if (bearishSignals > bullishSignals + 1) {
      return 'short'; // Forzar SHORT si hay más señales bajistas
    } else {
      return 'neutral';
    }
  }

  // ================== CÁLCULO DE NIVELES ==================

  async calculateSignalLevels(analysis, direction, currentPrice) {
    const levels = {};

    // Calcular precio de entrada basado en niveles técnicos
    levels.entry = this.calculateEntryPrice(analysis, direction, currentPrice);

    // Stop Loss basado en niveles técnicos
    levels.stopLoss = this.calculateStopLoss(analysis, direction, levels.entry);

    // Take Profit basado en niveles de resistencia/soporte
    levels.takeProfit = this.calculateTakeProfit(analysis, direction, levels.entry, levels.stopLoss);

    // Validar que los niveles son lógicos
    if (direction === 'long') {
      if (levels.stopLoss >= levels.entry || levels.takeProfit <= levels.entry) {
        throw new Error('Niveles de LONG inválidos');
      }
    } else if (direction === 'short') {
      if (levels.stopLoss <= levels.entry || levels.takeProfit >= levels.entry) {
        throw new Error('Niveles de SHORT inválidos');
      }
    }

    return levels;
  }

  // Calcular precio de entrada basado en niveles técnicos
  calculateEntryPrice(analysis, direction, currentPrice) {
    const candidates = [];

    // Para LONG: buscar niveles de soporte cercanos por debajo del precio actual
    if (direction === 'long') {
      if (analysis.supportResistance && analysis.supportResistance.dynamicLevels) {
        const supportLevels = analysis.supportResistance.dynamicLevels.filter(level => 
          level.type === 'support' && 
          level.price < currentPrice && 
          level.strength > 60
        );

        supportLevels.forEach(level => {
          const distance = ((currentPrice - level.price) / currentPrice) * 100;
          if (distance <= 3) { // Dentro del 3%
            candidates.push({
              price: level.price,
              reason: 'support_level',
              strength: level.strength,
              distance: distance
            });
          }
        });
      }

      // Si no hay soportes cercanos, usar precio actual con margen
      if (candidates.length === 0) {
        candidates.push({
          price: currentPrice * 0.995, // 0.5% por debajo
          reason: 'current_price_margin',
          strength: 50
        });
      }
    }

    // Para SHORT: buscar niveles de resistencia cercanos por encima del precio actual
    if (direction === 'short') {
      if (analysis.supportResistance && analysis.supportResistance.dynamicLevels) {
        const resistanceLevels = analysis.supportResistance.dynamicLevels.filter(level => 
          level.type === 'resistance' && 
          level.price > currentPrice && 
          level.strength > 60
        );

        resistanceLevels.forEach(level => {
          const distance = ((level.price - currentPrice) / currentPrice) * 100;
          if (distance <= 3) { // Dentro del 3%
            candidates.push({
              price: level.price,
              reason: 'resistance_level',
              strength: level.strength,
              distance: distance
            });
          }
        });
      }

      // Si no hay resistencias cercanas, usar precio actual con margen
      if (candidates.length === 0) {
        candidates.push({
          price: currentPrice * 1.005, // 0.5% por encima
          reason: 'current_price_margin',
          strength: 50
        });
      }
    }

    // Elegir el mejor candidato (más fuerte o más cercano)
    if (candidates.length > 0) {
      const bestCandidate = candidates.sort((a, b) => {
        // Priorizar por fuerza, luego por distancia
        if (a.strength !== b.strength) {
          return b.strength - a.strength;
        }
        return a.distance - b.distance;
      })[0];

      return bestCandidate.price;
    }

    // Fallback: usar precio actual
    return currentPrice;
  }

  // ================== STOP LOSS LÓGICO PROFESIONAL ==================

  calculateStopLoss(analysis, direction, entryPrice) {
    const candidates = [];

    // CONFIGURACIÓN PROFESIONAL DE STOP LOSS LÓGICO
    const slConfig = {
      // Márgenes de seguridad para evitar falsas rupturas
      supportMargin: 0.002,      // 0.2% por debajo del soporte para LONG
      resistanceMargin: 0.002,   // 0.2% por encima de la resistencia para SHORT
      fibonacciMargin: 0.001,    // 0.1% margen para niveles Fibonacci
      patternMargin: 0.003,      // 0.3% margen para patrones chartistas

      // Distancias mínimas y máximas
      minStopDistance: 0.005,    // 0.5% mínimo desde entrada
      maxStopDistance: 0.03,     // 3% máximo según PDF (risk management)

      // Factores de volatilidad
      volatilityMultiplier: 1.5, // Ajustar margen por volatilidad
      atrPeriods: 14            // Períodos para ATR si está disponible
    };

    logger.info(`Calculando Stop Loss LÓGICO para ${direction.toUpperCase()}`, {
      entryPrice,
      config: slConfig
    });

    // 1. STOP LOSS BASADO EN SOPORTES/RESISTENCIAS (TÉCNICA PRINCIPAL)
    this.calculateSupportResistanceStopLoss(analysis, direction, entryPrice, candidates, slConfig);

    // 2. STOP LOSS BASADO EN FIBONACCI CON MÁRGENES
    this.calculateFibonacciStopLoss(analysis, direction, entryPrice, candidates, slConfig);

    // 3. STOP LOSS BASADO EN PATRONES CHARTISTAS
    this.calculatePatternStopLoss(analysis, direction, entryPrice, candidates, slConfig);

    // 4. STOP LOSS BASADO EN ATR (VOLATILIDAD)
    this.calculateATRStopLoss(analysis, direction, entryPrice, candidates, slConfig);

    // 5. STOP LOSS DE EMERGENCIA (MÁXIMO 3% SEGÚN PDF)
    const emergencyStopPercent = Math.min(0.03, slConfig.maxStopDistance); // Nunca más de 3%
    const emergencyStop = direction === 'long'
      ? entryPrice * (1 - emergencyStopPercent)
      : entryPrice * (1 + emergencyStopPercent);

    candidates.push({
      price: emergencyStop,
      reason: 'emergency_maximum',
      percent: emergencyStopPercent * 100,
      priority: 0, // Prioridad más baja
      margin: 0,
      isEmergency: true
    });

    // SELECCIONAR EL MEJOR STOP LOSS LÓGICO
    return this.selectOptimalStopLoss(candidates, direction, entryPrice, slConfig);
  }

  calculateSupportResistanceStopLoss(analysis, direction, entryPrice, candidates, slConfig) {
    if (!analysis.supportResistance?.dynamicLevels) return;

    const relevantLevels = analysis.supportResistance.dynamicLevels.filter(level => {
      if (direction === 'long') {
        return level.type === 'support' && level.price < entryPrice;
      } else {
        return level.type === 'resistance' && level.price > entryPrice;
      }
    });

    relevantLevels.forEach(level => {
      let logicalStopPrice;
      let margin;

      if (direction === 'long') {
        // Para LONG: Stop DEBAJO del soporte con margen de seguridad
        margin = level.price * slConfig.supportMargin;
        logicalStopPrice = level.price - margin;
      } else {
        // Para SHORT: Stop ENCIMA de la resistencia con margen de seguridad
        margin = level.price * slConfig.resistanceMargin;
        logicalStopPrice = level.price + margin;
      }

      // Validar distancia mínima y máxima
      const distance = Math.abs(entryPrice - logicalStopPrice) / entryPrice;
      if (distance >= slConfig.minStopDistance && distance <= slConfig.maxStopDistance) {
        candidates.push({
          price: logicalStopPrice,
          originalLevel: level.price,
          reason: 'support_resistance_logical',
          strength: level.strength,
          margin: margin,
          marginPercent: (margin / level.price) * 100,
          distance: distance,
          priority: 5, // Alta prioridad para S/R
          isLogical: true
        });
      }
    });
  }

  calculateFibonacciStopLoss(analysis, direction, entryPrice, candidates, slConfig) {
    if (!analysis.fibonacci?.retracements) return;

    const fibLevels = analysis.fibonacci.retracements.filter(level => {
      if (direction === 'long') {
        return level.price < entryPrice && level.support;
      } else {
        return level.price > entryPrice && level.resistance;
      }
    });

    fibLevels.forEach(fibLevel => {
      let logicalStopPrice;
      let margin;

      if (direction === 'long') {
        margin = fibLevel.price * slConfig.fibonacciMargin;
        logicalStopPrice = fibLevel.price - margin;
      } else {
        margin = fibLevel.price * slConfig.fibonacciMargin;
        logicalStopPrice = fibLevel.price + margin;
      }

      const distance = Math.abs(entryPrice - logicalStopPrice) / entryPrice;
      if (distance >= slConfig.minStopDistance && distance <= slConfig.maxStopDistance) {
        candidates.push({
          price: logicalStopPrice,
          originalLevel: fibLevel.price,
          reason: 'fibonacci_logical',
          level: fibLevel.level,
          margin: margin,
          marginPercent: (margin / fibLevel.price) * 100,
          distance: distance,
          priority: 4, // Prioridad media-alta para Fibonacci
          isLogical: true
        });
      }
    });
  }

  calculatePatternStopLoss(analysis, direction, entryPrice, candidates, slConfig) {
    if (!analysis.patterns?.length) return;

    analysis.patterns.forEach(pattern => {
      let patternStopLevel = null;

      // Calcular stop loss basado en el tipo de patrón
      switch (pattern.type) {
        case 'triangle':
          patternStopLevel = this.getTriangleStopLevel(pattern, direction);
          break;
        case 'head_and_shoulders':
          patternStopLevel = this.getHeadShouldersStopLevel(pattern, direction);
          break;
        case 'double_pattern':
          patternStopLevel = this.getDoublePatternStopLevel(pattern, direction);
          break;
      }

      if (patternStopLevel) {
        let logicalStopPrice;
        let margin;

        if (direction === 'long') {
          margin = patternStopLevel * slConfig.patternMargin;
          logicalStopPrice = patternStopLevel - margin;
        } else {
          margin = patternStopLevel * slConfig.patternMargin;
          logicalStopPrice = patternStopLevel + margin;
        }

        const distance = Math.abs(entryPrice - logicalStopPrice) / entryPrice;
        if (distance >= slConfig.minStopDistance && distance <= slConfig.maxStopDistance) {
          candidates.push({
            price: logicalStopPrice,
            originalLevel: patternStopLevel,
            reason: `pattern_${pattern.type}_logical`,
            patternType: pattern.type,
            patternConfidence: pattern.confidence,
            margin: margin,
            marginPercent: (margin / patternStopLevel) * 100,
            distance: distance,
            priority: 3, // Prioridad media para patrones
            isLogical: true
          });
        }
      }
    });
  }

  calculateATRStopLoss(analysis, direction, entryPrice, candidates, slConfig) {
    // Simular ATR si no está disponible (en implementación real se calcularía)
    const simulatedATR = entryPrice * 0.01; // 1% como ATR estimado

    const atrMultiplier = 2.0; // 2x ATR es estándar profesional
    const atrStop = direction === 'long'
      ? entryPrice - (simulatedATR * atrMultiplier)
      : entryPrice + (simulatedATR * atrMultiplier);

    const distance = Math.abs(entryPrice - atrStop) / entryPrice;
    if (distance >= slConfig.minStopDistance && distance <= slConfig.maxStopDistance) {
      candidates.push({
        price: atrStop,
        reason: 'atr_volatility_logical',
        atrValue: simulatedATR,
        atrMultiplier: atrMultiplier,
        distance: distance,
        priority: 2, // Prioridad media-baja para ATR
        isLogical: true,
        isVolatilityBased: true
      });
    }
  }

  selectOptimalStopLoss(candidates, direction, entryPrice, slConfig) {
    if (candidates.length === 0) {
      // Fallback de emergencia
      const emergencyPercent = 0.02;
      return direction === 'long'
        ? entryPrice * (1 - emergencyPercent)
        : entryPrice * (1 + emergencyPercent);
    }

    // Filtrar candidatos válidos (no emergencia)
    const logicalCandidates = candidates.filter(c => c.isLogical && !c.isEmergency);

    if (logicalCandidates.length > 0) {
      // Ordenar por prioridad y luego por fuerza/confianza
      logicalCandidates.sort((a, b) => {
        // Prioridad principal
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }

        // Criterio secundario: fuerza o confianza
        const aScore = a.strength || a.patternConfidence || 50;
        const bScore = b.strength || b.patternConfidence || 50;
        return bScore - aScore;
      });

      const selectedCandidate = logicalCandidates[0];

      logger.info(`Stop Loss LÓGICO seleccionado`, {
        price: selectedCandidate.price,
        originalLevel: selectedCandidate.originalLevel,
        reason: selectedCandidate.reason,
        margin: selectedCandidate.marginPercent?.toFixed(3) + '%',
        distance: (selectedCandidate.distance * 100).toFixed(2) + '%',
        priority: selectedCandidate.priority
      });

      return selectedCandidate.price;
    }

    // Si no hay candidatos lógicos, usar el de emergencia
    const emergencyCandidate = candidates.find(c => c.isEmergency);
    if (emergencyCandidate) {
      logger.warn(`Usando Stop Loss de EMERGENCIA`, {
        price: emergencyCandidate.price,
        reason: emergencyCandidate.reason,
        percent: emergencyCandidate.percent + '%'
      });

      return emergencyCandidate.price;
    }

    // Último recurso
    const fallbackPercent = 0.02;
    return direction === 'long'
      ? entryPrice * (1 - fallbackPercent)
      : entryPrice * (1 + fallbackPercent);
  }

  // MÉTODOS AUXILIARES PARA PATRONES

  getTriangleStopLevel(pattern, direction) {
    if (direction === 'long') {
      return pattern.lowerTrendline?.endPoint?.y || pattern.pivotLows?.[pattern.pivotLows.length - 1]?.value;
    } else {
      return pattern.upperTrendline?.endPoint?.y || pattern.pivotHighs?.[pattern.pivotHighs.length - 1]?.value;
    }
  }

  getHeadShouldersStopLevel(pattern, direction) {
    if (pattern.subtype === 'bearish' && direction === 'long') {
      // Para H&S bajista en LONG, stop debajo del hombro derecho
      return pattern.rightShoulder?.value;
    } else if (pattern.subtype === 'bullish' && direction === 'short') {
      // Para H&S alcista en SHORT, stop encima del hombro derecho
      return pattern.rightShoulder?.value;
    }
    return null;
  }

  getDoublePatternStopLevel(pattern, direction) {
    if (pattern.subtype === 'double_top' && direction === 'long') {
      // Para double top en LONG, stop debajo del valle
      return pattern.valley?.value;
    } else if (pattern.subtype === 'double_bottom' && direction === 'short') {
      // Para double bottom en SHORT, stop encima del valle
      return pattern.valley?.value;
    }
    return null;
  }

  calculateTakeProfit(analysis, direction, entryPrice, stopLoss) {
    const risk = Math.abs(entryPrice - stopLoss);
    const minReward = risk * this.config.minRiskReward;

    const candidates = [];

    // Take Profit basado en soportes/resistencias
    if (analysis.supportResistance && analysis.supportResistance.dynamicLevels) {
      const targetLevels = analysis.supportResistance.dynamicLevels.filter(level => {
        if (direction === 'long') {
          return level.type === 'resistance' && level.price > entryPrice;
        } else {
          return level.type === 'support' && level.price < entryPrice;
        }
      });

      targetLevels.forEach(level => {
        const potentialReward = Math.abs(level.price - entryPrice);
        if (potentialReward >= minReward) {
          candidates.push({
            price: level.price,
            reason: 'support_resistance',
            riskReward: potentialReward / risk,
            strength: level.strength
          });
        }
      });
    }

    // Take Profit basado en extensiones Fibonacci
    if (analysis.fibonacci && analysis.fibonacci.extensions) {
      const fibExtensions = analysis.fibonacci.extensions.filter(ext => {
        if (direction === 'long') {
          return ext.price > entryPrice;
        } else {
          return ext.price < entryPrice;
        }
      });

      fibExtensions.forEach(ext => {
        const potentialReward = Math.abs(ext.price - entryPrice);
        if (potentialReward >= minReward) {
          candidates.push({
            price: ext.price,
            reason: 'fibonacci_extension',
            riskReward: potentialReward / risk,
            level: ext.level
          });
        }
      });
    }

    // Take Profit por defecto (mínimo R:R)
    const defaultTP = direction === 'long'
      ? entryPrice + minReward
      : entryPrice - minReward;

    candidates.push({
      price: defaultTP,
      reason: 'minimum_risk_reward',
      riskReward: this.config.minRiskReward
    });

    // Elegir el mejor candidato (mejor R:R que cumpla mínimos)
    if (candidates.length > 0) {
      const bestCandidate = candidates.sort((a, b) => (b.riskReward || 0) - (a.riskReward || 0))[0];
      return bestCandidate.price;
    }

    return defaultTP;
  }

  // ================== VALIDACIONES ==================

  validateWithRiskManagement(accountBalance, entryPrice, stopLoss, maxRiskPercent) {
    try {
      // VALIDACIÓN CRÍTICA: MÁXIMO 3% DE RIESGO SEGÚN PDF
      const absoluteMaxRisk = 3.0; // LÍMITE ABSOLUTO DEL PDF
      if (maxRiskPercent > absoluteMaxRisk) {
        return {
          valid: false,
          reason: 'excessive_risk_violation',
          details: `Riesgo ${maxRiskPercent}% excede límite máximo de ${absoluteMaxRisk}% establecido en Memoria Agente PDF`
        };
      }

      // VALIDACIÓN ADICIONAL: Verificar que el riesgo real no exceda 2-3%
      const actualRiskPercent = Math.abs((entryPrice - stopLoss) / entryPrice) * 100;
      if (actualRiskPercent > absoluteMaxRisk) {
        return {
          valid: false,
          reason: 'stop_loss_too_wide',
          details: `Stop Loss genera riesgo de ${actualRiskPercent.toFixed(2)}% que excede límite máximo de ${absoluteMaxRisk}%`
        };
      }

      const positionCalc = this.riskManager.calculatePositionSize(
        accountBalance,
        entryPrice,
        stopLoss,
        maxRiskPercent
      );

      if (!positionCalc.success) {
        return {
          valid: false,
          reason: 'risk_calculation_failed',
          details: positionCalc.error
        };
      }

      const validation = this.riskManager.validateStopLoss(entryPrice, stopLoss);

      if (!validation.success || !validation.data?.isValid) {
        return {
          valid: false,
          reason: 'invalid_stop_loss',
          details: validation.data?.validations || []
        };
      }

      // VALIDACIÓN FINAL: Verificar que la posición respeta el límite de capital
      const positionRiskPercent = (positionCalc.data.riskAmount / accountBalance) * 100;
      if (positionRiskPercent > absoluteMaxRisk) {
        return {
          valid: false,
          reason: 'position_risk_excessive',
          details: `Posición resultante arriesga ${positionRiskPercent.toFixed(2)}% del capital, máximo permitido: ${absoluteMaxRisk}%`
        };
      }

      return {
        valid: true,
        positionData: positionCalc.data,
        riskData: validation.data,
        riskValidation: {
          actualRiskPercent: actualRiskPercent,
          positionRiskPercent: positionRiskPercent,
          withinLimits: true,
          maxAllowed: absoluteMaxRisk
        }
      };

    } catch (error) {
      return {
        valid: false,
        reason: 'validation_error',
        details: error.message
      };
    }
  }

  async applySignalFilters(analysis, levels, symbol, direction, confluenceScore, isCounterTrend = false) {
    const failedFilters = [];

    // Filtro de volatilidad extrema
    if (analysis.bbwp && analysis.bbwp.length > 0) {
      const bbwp = analysis.bbwp[analysis.bbwp.length - 1];
      if (bbwp.value > this.config.maxBBWPExpansion) {
        failedFilters.push({
          name: 'high_volatility',
          reason: `BBWP muy alto (${bbwp.value.toFixed(1)}%), volatilidad extrema`
        });
      }
    }

    // Filtro de señales conflictivas
    const rsi = analysis.rsi ? analysis.rsi[analysis.rsi.length - 1] : 50;
    if (rsi > 80 || rsi < 20) {
      failedFilters.push({
        name: 'extreme_rsi',
        reason: `RSI extremo (${rsi.toFixed(1)}), posible reversión inminente`
      });
    }

    // Filtro de risk/reward mínimo (asimétrico) - ESTRICTO SEGÚN PDF
    const risk = Math.abs(levels.entry - levels.stopLoss);
    const reward = Math.abs(levels.takeProfit - levels.entry);
    const riskReward = reward / risk;
    const minRR = isCounterTrend ? (this.config.minRRCounterTrend || this.config.minRiskReward) : (this.config.minRRTrend || this.config.minRiskReward);

    // VALIDACIÓN ABSOLUTA: NUNCA MENOS DE 2:1 SEGÚN PDF
    const absoluteMinRR = 2.0;
    if (riskReward < absoluteMinRR) {
      failedFilters.push({
        name: 'critical_risk_reward_violation',
        reason: `R:R CRÍTICO: ${riskReward.toFixed(2)}:1 está por debajo del mínimo absoluto de ${absoluteMinRR}:1 establecido en Memoria Agente PDF`
      });
    } else if (riskReward < minRR) {
      failedFilters.push({
        name: 'insufficient_risk_reward',
        reason: `R:R insuficiente (${riskReward.toFixed(2)}:1), mínimo requerido: ${minRR}:1${isCounterTrend ? ' (contra-tendencia)' : ''}`
      });
    }

    // Filtro de confluencia mínimo (asimétrico por régimen)
    const trendRec = analysis?.summary?.recommendation;
    const counterTrend = isCounterTrend || (
      (direction === 'long' && trendRec === 'bearish') ||
      (direction === 'short' && trendRec === 'bullish')
    );
    const minConf = counterTrend ? (this.config.minConfluenceCounterTrend || this.config.minConfluenceScore) : (this.config.minConfluenceTrend || this.config.minConfluenceScore);
    if (confluenceScore < minConf) {
      failedFilters.push({
        name: 'insufficient_confluence',
        reason: `Confluencia insuficiente (${confluenceScore}), mínimo requerido: ${minConf}${counterTrend ? ' (contra-tendencia)' : ''}`
      });
    }

    // Endurecer volatilidad para contra-tendencia
    if (counterTrend && analysis.bbwp && analysis.bbwp.length > 0) {
      const bbwpCT = analysis.bbwp[analysis.bbwp.length - 1];
      if (bbwpCT.expansion) {
        failedFilters.push({
          name: 'countertrend_in_high_volatility',
          reason: `Contra-tendencia en alta volatilidad (BBWP expansión ${bbwpCT.value?.toFixed?.(1)}%)`
        });
      }
    }

    return {
      passed: failedFilters.length === 0,
      failedFilters
    };
  }

  // ================== CREACIÓN DE SEÑALES ==================

  async createValidSignal(symbol, analysis, direction, levels, confluenceAnalysis, riskValidation, currentPrice) {
    const risk = Math.abs(levels.entry - levels.stopLoss);
    const reward = Math.abs(levels.takeProfit - levels.entry);
    const riskReward = reward / risk;

    // Generar recomendaciones de promediación
    const averagingRecommendations = await this.generateAveragingRecommendations(
      symbol,
      direction,
      levels,
      currentPrice,
      analysis
    );

    return {
      success: true,
      type: 'VALID_SIGNAL',

      // Información básica
      symbol,
      direction,
      timestamp: new Date(),

      // Precios y niveles
      currentPrice,
      entry: levels.entry,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,

      // Métricas de riesgo
      riskReward: riskReward,
      riskPercent: ((risk / levels.entry) * 100),

      // Análisis de confluencia
      confluenceScore: confluenceAnalysis.score,
      confluenceFactors: confluenceAnalysis.factors,

      // Datos del position sizing
      positionSize: riskValidation.positionData.positionSize,
      leverage: riskValidation.positionData.leverage,

      // NUEVO: Recomendaciones de promediación profesional
      averagingStrategy: averagingRecommendations,
      notionalValue: riskValidation.positionData.notionalValue,

      // Validación de riesgo estricta
      riskValidation: riskValidation.riskValidation || {
        actualRiskPercent: ((Math.abs(levels.entry - levels.stopLoss) / levels.entry) * 100),
        withinLimits: true,
        maxAllowed: 3.0
      },

      // Contexto técnico
      technicalContext: {
        rsi: analysis.rsi ? analysis.rsi[analysis.rsi.length - 1] : null,
        nearbyLevels: this.extractNearbyLevels(analysis, currentPrice),
        patterns: analysis.patterns?.filter(p => p.confidence > 60) || [],
        timeframe: analysis.timeframe
      },

      // Alertas y warnings
      alerts: this.generateSignalAlerts(analysis, levels, confluenceAnalysis),

      // Validez de la señal
      confidence: confluenceAnalysis.recommendation,
      validUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutos

      // Metadata
      generatedBy: 'SignalGeneratorService',
      version: '1.0.0'
    };
  }

  createNeutralSignal(symbol, analysis, currentPrice) {
    return {
      success: true,
      type: 'NEUTRAL_SIGNAL',
      symbol,
      direction: 'neutral',
      timestamp: new Date(),
      currentPrice,

      reason: 'Confluencia insuficiente para señal direccional',
      confluenceScore: analysis.summary?.confluenceScore || 0,

      recommendation: 'WAIT',
      message: 'Esperar mejores condiciones de entrada',

      technicalSummary: {
        rsi: analysis.rsi ? analysis.rsi[analysis.rsi.length - 1] : null,
        trend: analysis.summary?.recommendation || 'neutral',
        volatility: analysis.bbwp ? analysis.bbwp[analysis.bbwp.length - 1]?.interpretation?.status : 'unknown'
      }
    };
  }

  createRejectedSignal(symbol, analysis, reason, currentPrice) {
    return {
      success: false,
      type: 'REJECTED_SIGNAL',
      symbol,
      timestamp: new Date(),
      currentPrice,

      reason,
      recommendation: 'AVOID',
      message: 'Señal rechazada por risk management',

      confluenceScore: analysis.summary?.confluenceScore || 0
    };
  }

  createFilteredSignal(symbol, analysis, failedFilters, currentPrice) {
    return {
      success: false,
      type: 'FILTERED_SIGNAL',
      symbol,
      timestamp: new Date(),
      currentPrice,

      reason: 'Señal filtrada por condiciones adversas',
      failedFilters,
      recommendation: 'WAIT',

      confluenceScore: analysis.summary?.confluenceScore || 0
    };
  }

  // ================== UTILIDADES ==================

  extractCurrentPrice(analysis) {
    // Intentar extraer el precio actual del análisis
    if (analysis && analysis.summary && analysis.summary.currentPrice) {
      return analysis.summary.currentPrice;
    }
    
    // Si tenemos marketDataService, obtener precio real
    if (this.technicalAnalysis.marketDataService) {
      const symbol = analysis.symbol;
      const marketData = this.technicalAnalysis.marketDataService.getMarketData(symbol);
      
      if (marketData.success && marketData.data) {
        return marketData.data.price;
      }
    }
    
    // Fallback: usar último precio de los datos históricos
    if (analysis && analysis.prices && analysis.prices.length > 0) {
      return analysis.prices[analysis.prices.length - 1];
    }
    
    // Último fallback: precio mock
    return 50000;
  }

  extractNearbyLevels(analysis, currentPrice) {
    if (!analysis.supportResistance) return [];

    return analysis.supportResistance.dynamicLevels
      .filter(level => {
        const distance = Math.abs(level.price - currentPrice) / currentPrice;
        return distance < 0.03; // Dentro del 3%
      })
      .map(level => ({
        price: level.price,
        type: level.type,
        strength: level.strength,
        distance: ((level.price - currentPrice) / currentPrice * 100).toFixed(2) + '%'
      }));
  }

  generateSignalAlerts(analysis, levels, confluenceAnalysis) {
    const alerts = [];

    // Alert por confluencia baja
    if (confluenceAnalysis.score < 80) {
      alerts.push({
        type: 'warning',
        message: `Confluencia moderada (${confluenceAnalysis.score}%), monitor de cerca`
      });
    }

    // Alert por RSI extremo
    if (analysis.rsi) {
      const rsi = analysis.rsi[analysis.rsi.length - 1];
      if (rsi > 75 || rsi < 25) {
        alerts.push({
          type: 'caution',
          message: `RSI en zona extrema (${rsi.toFixed(1)}), posible reversión`
        });
      }
    }

    // Alert por alta volatilidad
    if (analysis.bbwp && analysis.bbwp.length > 0) {
      const bbwp = analysis.bbwp[analysis.bbwp.length - 1];
      if (bbwp.expansion) {
        alerts.push({
          type: 'info',
          message: `Alta volatilidad detectada (BBWP: ${bbwp.value.toFixed(1)}%)`
        });
      }
    }

    return alerts;
  }

  interpretConfluenceScore(score) {
    const absScore = Math.abs(score);
    const direction = score >= 0 ? 'bullish' : 'bearish';

    let strength;
    if (absScore >= 85) strength = 'excellent';
    else if (absScore >= 75) strength = 'strong';
    else if (absScore >= 60) strength = 'moderate';
    else if (absScore >= 40) strength = 'weak';
    else strength = 'very_weak';

    return `${strength}_${direction}`;
  }

  getPatternWeight(pattern) {
    const baseWeight = Math.min(pattern.confidence / 10, 10);

    // Ajustar peso según tipo de patrón
    const patternMultipliers = {
      triangle: 1.0,
      double_top: 1.2,
      double_bottom: 1.2,
      head_and_shoulders: 1.5,
      inverse_head_and_shoulders: 1.5
    };

    return baseWeight * (patternMultipliers[pattern.type] || 1.0);
  }

  updateStats(signalData) {
    this.stats.signalsGenerated++;

    if (signalData.success) {
      this.stats.signalTypes[signalData.direction]++;

      const scoreRange = Math.floor(signalData.confluenceScore / 10) * 10;
      const rangeKey = `${scoreRange}-${scoreRange + 9}`;
      this.stats.confluenceDistribution[rangeKey] =
        (this.stats.confluenceDistribution[rangeKey] || 0) + 1;
    } else {
      this.stats.signalsFiltered++;
    }
  }

  // ================== BATCH PROCESSING ==================

  async scanMultipleSymbols(symbols, options = {}) {
    const results = [];
    const { accountBalance = 10000, timeframe = '4h' } = options;

    logger.info(`Escaneando ${symbols.length} símbolos para señales`, { timeframe });

    for (const symbol of symbols) {
      try {
        const signal = await this.generateSignal(symbol, {
          timeframe,
          accountBalance
        });

        if (signal.success && Math.abs(signal.confluenceScore) >= this.config.minConfluenceScore) {
          results.push(signal);
        }
      } catch (error) {
        logger.warn(`Error procesando ${symbol}:`, error.message);
      }
    }

    // Ordenar por confluencia descendente
    results.sort((a, b) => b.confluenceScore - a.confluenceScore);

    logger.info(`Escaneo completado`, {
      symbolsProcessed: symbols.length,
      validSignals: results.length,
      topConfluence: results[0]?.confluenceScore || 0
    });

    return {
      success: true,
      signals: results,
      stats: {
        symbolsScanned: symbols.length,
        validSignals: results.length,
        highConfidenceSignals: results.filter(s => s.confluenceScore > 85).length,
        averageConfluence: results.length > 0
          ? results.reduce((sum, s) => sum + s.confluenceScore, 0) / results.length
          : 0
      },
      timestamp: new Date()
    };
  }

  // ================== GESTIÓN Y ESTADO ==================

  clearCache() {
    this.signalCache.clear();
    logger.info('Signal generator cache cleared');
  }

  getStats() {
    return {
      ...this.stats,
      cache: this.signalCache.getStats(),
      uptime: process.uptime()
    };
  }

  getHealthStatus() {
    return {
      service: 'SignalGeneratorService',
      status: 'healthy',
      config: this.config,
      stats: this.getStats(),
      lastUpdate: new Date()
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Signal generator config updated', newConfig);
  }

  // ================== SISTEMA DE PROMEDIACIÓN PROFESIONAL ==================

  async generateAveragingRecommendations(symbol, direction, levels, currentPrice, analysis) {
    try {
      // Preparar datos de mercado para el sistema de promediación
      const marketData = {
        symbol,
        price: currentPrice,
        trend: direction === 'long' ? 'BULLISH' : 'BEARISH',
        momentum: this.calculateMomentumScore(analysis),
        nearSupport: this.isNearSupport(currentPrice, analysis),
        nearResistance: this.isNearResistance(currentPrice, analysis)
      };

      // Simular posición inicial para generar recomendaciones
      const initialPosition = null; // Nueva señal = no hay posición previa

      // Determinar estrategia óptima según análisis técnico
      const optimalStrategy = this.determineOptimalAveragingStrategy(analysis, direction);

      // Generar análisis de promediación
      const averagingAnalysis = await averagingSystemService.analyzeAveragingOpportunity(
        marketData,
        initialPosition,
        optimalStrategy
      );

      // Calcular niveles de entrada adicionales
      const additionalLevels = this.calculateAdditionalEntryLevels(levels, direction, currentPrice);

      return {
        strategy: optimalStrategy,
        analysis: averagingAnalysis,
        levels: additionalLevels,
        riskManagement: {
          maxTotalRisk: '3%',
          maxPositions: 5,
          recommendedAllocation: this.getRecommendedAllocation(optimalStrategy),
          safeguards: this.getPromediacionSafeguards()
        },
        recommendations: [
          {
            type: 'INITIAL_ENTRY',
            message: `Entrada inicial con ${optimalStrategy} - Asignar 30-40% del capital`,
            priority: 'HIGH'
          },
          {
            type: 'DCA_PREPARATION',
            message: 'Preparar niveles DCA en caso de retroceso temporal',
            priority: 'MEDIUM'
          },
          {
            type: 'RISK_WARNING',
            message: 'NUNCA exceder 3% de riesgo total por símbolo',
            priority: 'CRITICAL'
          }
        ]
      };

    } catch (error) {
      logger.error('Error generando recomendaciones de promediación:', error);
      return {
        strategy: 'DCA',
        error: error.message,
        fallback: true,
        recommendations: [
          {
            type: 'ERROR',
            message: 'Error en análisis de promediación - usar configuración conservadora',
            priority: 'HIGH'
          }
        ]
      };
    }
  }

  calculateMomentumScore(analysis) {
    let momentum = 0.5; // Base neutral

    // RSI momentum
    if (analysis.rsi && analysis.rsi.length > 0) {
      const rsi = analysis.rsi[analysis.rsi.length - 1];
      if (rsi > 60) momentum += 0.2;
      if (rsi < 40) momentum -= 0.2;
    }

    // MACD momentum
    if (analysis.macd && analysis.macd.length > 0) {
      const macd = analysis.macd[analysis.macd.length - 1];
      if (macd.macd > macd.signal) momentum += 0.15;
      else momentum -= 0.15;
    }

    return Math.max(0, Math.min(1, momentum));
  }

  isNearSupport(price, analysis) {
    if (!analysis.supportResistance || !analysis.supportResistance.supports) return false;

    return analysis.supportResistance.supports.some(support => {
      const distance = Math.abs((price - support.price) / price) * 100;
      return distance <= 2; // Dentro del 2%
    });
  }

  isNearResistance(price, analysis) {
    if (!analysis.supportResistance || !analysis.supportResistance.resistances) return false;

    return analysis.supportResistance.resistances.some(resistance => {
      const distance = Math.abs((price - resistance.price) / price) * 100;
      return distance <= 2; // Dentro del 2%
    });
  }

  determineOptimalAveragingStrategy(analysis, direction) {
    // Analizar condiciones del mercado para elegir estrategia
    const rsi = analysis.rsi ? analysis.rsi[analysis.rsi.length - 1] : 50;
    const trend = analysis.summary?.recommendation || 'neutral';

    // Para posiciones LONG
    if (direction === 'long') {
      if (rsi < 40 && trend === 'bullish') return 'DCA'; // Ideal para DCA
      if (rsi > 60 && trend === 'bullish') return 'PYRAMID'; // Momentum fuerte
      return 'SCALE_IN'; // Conservador
    }

    // Para posiciones SHORT
    if (direction === 'short') {
      if (rsi > 60 && trend === 'bearish') return 'DCA';
      if (rsi < 40 && trend === 'bearish') return 'PYRAMID';
      return 'SCALE_IN';
    }

    return 'DCA'; // Default conservador
  }

  calculateAdditionalEntryLevels(levels, direction, currentPrice) {
    const entryPrice = levels.entry;
    const stopLoss = levels.stopLoss;

    // Calcular niveles de promediación según la dirección
    const additionalLevels = [];

    if (direction === 'long') {
      // DCA levels por debajo del precio de entrada
      const dcaDistances = [0.03, 0.06, 0.10, 0.15]; // 3%, 6%, 10%, 15%

      dcaDistances.forEach((distance, index) => {
        const dcaPrice = entryPrice * (1 - distance);

        // Solo agregar si está por encima del stop loss
        if (dcaPrice > stopLoss) {
          additionalLevels.push({
            level: index + 2,
            price: dcaPrice,
            distance: distance * 100,
            allocation: this.getDCAAllocation(index + 2),
            type: 'DCA',
            confidence: distance < 0.10 ? 'HIGH' : 'MEDIUM'
          });
        }
      });
    } else {
      // Para SHORT - niveles por encima de entrada
      const dcaDistances = [0.03, 0.06, 0.10, 0.15];

      dcaDistances.forEach((distance, index) => {
        const dcaPrice = entryPrice * (1 + distance);

        // Solo agregar si está por debajo del stop loss
        if (dcaPrice < stopLoss) {
          additionalLevels.push({
            level: index + 2,
            price: dcaPrice,
            distance: distance * 100,
            allocation: this.getDCAAllocation(index + 2),
            type: 'DCA',
            confidence: distance < 0.10 ? 'HIGH' : 'MEDIUM'
          });
        }
      });
    }

    return additionalLevels;
  }

  getDCAAllocation(level) {
    const allocations = {
      2: '25%',
      3: '20%',
      4: '15%',
      5: '10%'
    };
    return allocations[level] || '10%';
  }

  getRecommendedAllocation(strategy) {
    switch (strategy) {
      case 'DCA':
        return {
          initial: '30%',
          level2: '25%',
          level3: '20%',
          level4: '15%',
          level5: '10%'
        };
      case 'PYRAMID':
        return {
          initial: '40%',
          level2: '30%',
          level3: '20%',
          level4: '10%'
        };
      case 'SCALE_IN':
        return {
          initial: '35%',
          level2: '30%',
          level3: '25%',
          level4: '10%'
        };
      default:
        return {
          initial: '30%',
          level2: '25%',
          level3: '25%',
          level4: '20%'
        };
    }
  }

  getPromediacionSafeguards() {
    return [
      'Nunca exceder 3% de riesgo total por símbolo',
      'Máximo 5 entradas por posición',
      'Distancia mínima 2% entre entradas',
      'Stop loss siempre por debajo del nivel más bajo (LONG)',
      'Revisar análisis técnico antes de cada entrada adicional',
      'Suspender DCA si el análisis fundamental cambia'
    ];
  }
}

module.exports = SignalGeneratorService;