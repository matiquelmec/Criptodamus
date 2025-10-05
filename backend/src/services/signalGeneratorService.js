const TechnicalAnalysisService = require('./technicalAnalysisService');
const RiskManager = require('./riskManager');

// Logger mock para testing si no está disponible
let logger;
try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger || loggerModule;
} catch (error) {
  logger = {
    info: (msg, meta) => console.log(`INFO: ${msg}`, meta),
    error: (msg, meta) => console.error(`ERROR: ${msg}`, meta),
    warn: (msg, meta) => console.warn(`WARN: ${msg}`, meta)
  };
}

class SignalGeneratorService {
  constructor(options = {}) {
    this.technicalAnalysis = new TechnicalAnalysisService();
    this.riskManager = new RiskManager();

    this.config = {
      // Filtros de confluencia
      minConfluenceScore: options.minConfluenceScore || 75,
      minRiskReward: options.minRiskReward || 2.0,
      maxRiskPerTrade: options.maxRiskPerTrade || 2.5,

      // Filtros técnicos
      rsiOverbought: 75,
      rsiOversold: 25,
      minPatternConfidence: 60,
      minSRStrength: 60,

      // Configuración de timeframes
      timeframes: ['1h', '4h', '1d'],
      primaryTimeframe: '4h',

      // Filtros de volatilidad
      maxBBWPExpansion: 90,
      minBBWPSqueeze: 15,

      // Validación de señales
      enableMultiTimeframe: true,
      enableVolumeConfirmation: true,
      enableMacroFilter: true
    };

    this.signalCache = new Map();
    this.cacheExpiration = 15 * 60 * 1000; // 15 minutos

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

      // Verificar cache
      if (!forceRefresh && this.signalCache.has(cacheKey)) {
        const cached = this.signalCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiration) {
          return cached.data;
        }
      }

      logger.info(`Generando señal para ${symbol}`, { timeframe, accountBalance });

      // Obtener análisis técnico completo
      const analysis = await this.technicalAnalysis.analyzeSymbol(symbol, timeframe, 200);

      // Aplicar filtros de confluencia
      const signalData = await this.processAnalysisForSignal(analysis, symbol, accountBalance);

      // Guardar en cache
      this.signalCache.set(cacheKey, {
        data: signalData,
        timestamp: Date.now()
      });

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

  async processAnalysisForSignal(analysis, symbol, accountBalance) {
    const currentPrice = this.extractCurrentPrice(analysis);

    // Análisis de confluencia básico
    const confluenceAnalysis = this.calculateConfluenceScore(analysis);

    // Determinar dirección de la señal
    const direction = this.determineSignalDirection(analysis, confluenceAnalysis);

    if (direction === 'neutral') {
      return this.createNeutralSignal(symbol, analysis, currentPrice);
    }

    // Calcular niveles de entrada, SL y TP
    const levels = await this.calculateSignalLevels(analysis, direction, currentPrice);

    // Validar con risk management
    const riskValidation = this.validateWithRiskManagement(
      accountBalance,
      levels.entry,
      levels.stopLoss,
      this.config.maxRiskPerTrade
    );

    if (!riskValidation.valid) {
      return this.createRejectedSignal(symbol, analysis, riskValidation.reason, currentPrice);
    }

    // Aplicar filtros adicionales
    const filters = await this.applySignalFilters(analysis, levels, symbol);

    if (!filters.passed) {
      return this.createFilteredSignal(symbol, analysis, filters.failedFilters, currentPrice);
    }

    // Crear señal válida
    return this.createValidSignal(
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

    // Factor RSI (20 puntos máximo)
    if (analysis.rsi && analysis.rsi.length > 0) {
      const currentRSI = analysis.rsi[analysis.rsi.length - 1];

      if (currentRSI <= this.config.rsiOversold) {
        score += 15;
        factors.push({ type: 'rsi_oversold', weight: 15, value: currentRSI });
      } else if (currentRSI >= this.config.rsiOverbought) {
        score -= 15;
        factors.push({ type: 'rsi_overbought', weight: -15, value: currentRSI });
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

    // Normalizar score
    const finalScore = Math.max(0, Math.min(100, 50 + score));

    return {
      score: finalScore,
      factors,
      interpretation: this.interpretConfluenceScore(finalScore),
      recommendation: finalScore > this.config.minConfluenceScore ? 'strong' :
                     finalScore > 60 ? 'moderate' : 'weak'
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

    // Decidir dirección
    if (bullishSignals > bearishSignals && confluenceAnalysis.score > 60) {
      return 'long';
    } else if (bearishSignals > bullishSignals && confluenceAnalysis.score > 60) {
      return 'short';
    } else {
      return 'neutral';
    }
  }

  // ================== CÁLCULO DE NIVELES ==================

  async calculateSignalLevels(analysis, direction, currentPrice) {
    const levels = {};

    // Precio de entrada (puede ajustarse según la estrategia)
    levels.entry = currentPrice;

    // Stop Loss basado en niveles técnicos
    levels.stopLoss = this.calculateStopLoss(analysis, direction, currentPrice);

    // Take Profit basado en niveles de resistencia/soporte
    levels.takeProfit = this.calculateTakeProfit(analysis, direction, currentPrice, levels.stopLoss);

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

  calculateStopLoss(analysis, direction, currentPrice) {
    const candidates = [];

    // Stop Loss basado en soportes/resistencias
    if (analysis.supportResistance && analysis.supportResistance.dynamicLevels) {
      const relevantLevels = analysis.supportResistance.dynamicLevels.filter(level => {
        if (direction === 'long') {
          return level.type === 'support' && level.price < currentPrice;
        } else {
          return level.type === 'resistance' && level.price > currentPrice;
        }
      });

      if (relevantLevels.length > 0) {
        const strongestLevel = relevantLevels.sort((a, b) => b.strength - a.strength)[0];
        candidates.push({
          price: strongestLevel.price,
          reason: 'support_resistance',
          strength: strongestLevel.strength
        });
      }
    }

    // Stop Loss basado en Fibonacci
    if (analysis.fibonacci && analysis.fibonacci.retracements) {
      const fibLevels = analysis.fibonacci.retracements.filter(level => {
        if (direction === 'long') {
          return level.price < currentPrice && level.support;
        } else {
          return level.price > currentPrice && level.resistance;
        }
      });

      if (fibLevels.length > 0) {
        const nearestFib = fibLevels.sort((a, b) => a.distance - b.distance)[0];
        candidates.push({
          price: nearestFib.price,
          reason: 'fibonacci',
          level: nearestFib.level
        });
      }
    }

    // Stop Loss por defecto (2% del precio)
    const defaultStopPercent = 0.02;
    const defaultStop = direction === 'long'
      ? currentPrice * (1 - defaultStopPercent)
      : currentPrice * (1 + defaultStopPercent);

    candidates.push({
      price: defaultStop,
      reason: 'percentage_default',
      percent: defaultStopPercent * 100
    });

    // Elegir el mejor candidato
    // Para LONG: Preferir el nivel más fuerte si está disponible, sino el más conservador
    // Para SHORT: Preferir el nivel más fuerte si está disponible, sino el más conservador
    if (direction === 'long') {
      // Buscar primero niveles técnicos fuertes
      const technicalLevels = candidates.filter(c => c.reason !== 'percentage_default');
      if (technicalLevels.length > 0) {
        // Elegir el más fuerte entre los técnicos
        const bestTechnical = technicalLevels.sort((a, b) => (b.strength || 0) - (a.strength || 0))[0];
        return bestTechnical.price;
      } else {
        // Usar el por defecto
        return defaultStop;
      }
    } else {
      // Misma lógica para SHORT
      const technicalLevels = candidates.filter(c => c.reason !== 'percentage_default');
      if (technicalLevels.length > 0) {
        const bestTechnical = technicalLevels.sort((a, b) => (b.strength || 0) - (a.strength || 0))[0];
        return bestTechnical.price;
      } else {
        return defaultStop;
      }
    }
  }

  calculateTakeProfit(analysis, direction, currentPrice, stopLoss) {
    const risk = Math.abs(currentPrice - stopLoss);
    const minReward = risk * this.config.minRiskReward;

    const candidates = [];

    // Take Profit basado en soportes/resistencias
    if (analysis.supportResistance && analysis.supportResistance.dynamicLevels) {
      const targetLevels = analysis.supportResistance.dynamicLevels.filter(level => {
        if (direction === 'long') {
          return level.type === 'resistance' && level.price > currentPrice;
        } else {
          return level.type === 'support' && level.price < currentPrice;
        }
      });

      targetLevels.forEach(level => {
        const potentialReward = Math.abs(level.price - currentPrice);
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
          return ext.price > currentPrice;
        } else {
          return ext.price < currentPrice;
        }
      });

      fibExtensions.forEach(ext => {
        const potentialReward = Math.abs(ext.price - currentPrice);
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
      ? currentPrice + minReward
      : currentPrice - minReward;

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

      return {
        valid: true,
        positionData: positionCalc.data,
        riskData: validation.data
      };

    } catch (error) {
      return {
        valid: false,
        reason: 'validation_error',
        details: error.message
      };
    }
  }

  async applySignalFilters(analysis, levels, symbol) {
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

    // Filtro de risk/reward mínimo
    const risk = Math.abs(levels.entry - levels.stopLoss);
    const reward = Math.abs(levels.takeProfit - levels.entry);
    const riskReward = reward / risk;

    if (riskReward < this.config.minRiskReward) {
      failedFilters.push({
        name: 'insufficient_risk_reward',
        reason: `R:R insuficiente (${riskReward.toFixed(2)}), mínimo requerido: ${this.config.minRiskReward}`
      });
    }

    return {
      passed: failedFilters.length === 0,
      failedFilters
    };
  }

  // ================== CREACIÓN DE SEÑALES ==================

  createValidSignal(symbol, analysis, direction, levels, confluenceAnalysis, riskValidation, currentPrice) {
    const risk = Math.abs(levels.entry - levels.stopLoss);
    const reward = Math.abs(levels.takeProfit - levels.entry);
    const riskReward = reward / risk;

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
      notionalValue: riskValidation.positionData.notionalValue,

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
    // En un entorno real, esto vendría de los datos de mercado
    return 50000; // Mock price para testing
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
    if (score >= 85) return 'excellent';
    if (score >= 75) return 'strong';
    if (score >= 60) return 'moderate';
    if (score >= 40) return 'weak';
    return 'very_weak';
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

        if (signal.success && signal.confluenceScore >= this.config.minConfluenceScore) {
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
      cacheSize: this.signalCache.size,
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
}

module.exports = SignalGeneratorService;