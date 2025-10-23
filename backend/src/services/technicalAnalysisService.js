const axios = require('axios');

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

class TechnicalAnalysisService {
  constructor(marketDataService = null) {
    this.marketDataService = marketDataService;
    this.cache = new Map();
    this.cacheExpiration = 5 * 60 * 1000; // 5 minutos
    this.lastDataSource = null; // 'real_ohlcv' | 'market_derived' | 'mock'

    // Configuración de indicadores - OPTIMIZADA SEGÚN PDF PROFESIONAL
    this.config = {
      rsi: {
        period: 14,
        overbought: 70,
        oversold: 30,
        // Configuración profesional de divergencias
        divergence: {
          minPeriod: 5,          // Mínimo períodos entre picos/valles
          maxLookback: 50,       // Máximo períodos hacia atrás para buscar
          strengthThreshold: 60, // Umbral mínimo de fuerza para divergencia válida
          confirmationBars: 3,   // Barras de confirmación requeridas
          hiddenDivergence: true // Detectar divergencias ocultas
        }
      },
      fibonacci: {
        levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2.618, 4.236],
        goldenPocket: { min: 0.618, max: 0.66 },
        // Configuración profesional
        professional: {
          minSwingSize: 0.05,     // 5% mínimo para swing válido
          maxSwingAge: 100,       // Máximo 100 períodos de antigüedad
          extensionTargets: [1.272, 1.414, 1.618, 2.618, 4.236],
          confluenceDistance: 0.002 // 0.2% para considerar confluencia
        }
      },
      bbwp: {
        period: 252, // 1 año de datos
        threshold: 20 // percentil para explosiones
      },
      patterns: {
        minTouches: 2, // mínimo toques para S/R válido
        tolerancePercent: 0.5, // tolerancia para niveles
        // Configuración profesional de patrones chartistas
        professional: {
          minConfidence: 70,        // Confianza mínima para patrón válido
          volumeConfirmation: true, // Requiere confirmación de volumen
          symmetryTolerance: 0.15,  // 15% tolerancia para simetría
          minPatternBars: 10,       // Mínimo barras para patrón válido
          maxPatternBars: 200,      // Máximo barras para patrón válido

          // Configuración específica por tipo de patrón
          triangles: {
            minConvergence: 0.02,   // 2% mínimo de convergencia
            maxConvergence: 0.20,   // 20% máximo de convergencia
            volumeDecrease: 0.7     // Volumen debe decrecer 70%
          },

          headAndShoulders: {
            shoulderSymmetry: 0.10, // 10% tolerancia simetría hombros
            necklineBreak: 0.003,   // 0.3% para ruptura válida
            volumeIncrease: 1.5     // Volumen debe aumentar 50%
          },

          doubleTopBottom: {
            peakSimilarity: 0.02,   // 2% tolerancia entre picos
            minRetrace: 0.10,       // 10% mínimo retroceso
            maxRetrace: 0.25        // 25% máximo retroceso
          },

          wedges: {
            angleConvergence: 5,    // 5 grados máximo convergencia
            volumeDivergence: true  // Requiere divergencia de volumen
          },

          flags: {
            poleHeight: 0.05,       // 5% mínimo altura del polo
            flagDuration: 0.3,      // 30% duración relativa al polo
            volumePattern: 'decreasing'
          }
        }
      }
    };
  }

  // ================== RSI CON DIVERGENCIAS ==================

  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) {
      throw new Error(`Insuficientes datos para RSI. Requeridos: ${period + 1}, disponibles: ${prices.length}`);
    }

    const gains = [];
    const losses = [];

    // Calcular cambios precio a precio
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Promedios iniciales (SMA)
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

    const rsiValues = [];

    // Primer valor RSI
    let rs = avgGain / (avgLoss || 0.0001);
    rsiValues.push(100 - (100 / (1 + rs)));

    // RSI usando Wilder's smoothing
    for (let i = period; i < gains.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

      rs = avgGain / (avgLoss || 0.0001);
      rsiValues.push(100 - (100 / (1 + rs)));
    }

    return rsiValues;
  }

  detectRSIDivergences(prices, rsiValues) {
    const divergences = [];
    const config = this.config.rsi.divergence;

    // Encontrar picos y valles en precio con mayor precisión
    const pricePeaks = this.findPeaksAndValleys(prices, 'peaks', { minStrength: 3 });
    const priceValleys = this.findPeaksAndValleys(prices, 'valleys', { minStrength: 3 });

    // Encontrar picos y valles en RSI con mayor precisión
    const rsiPeaks = this.findPeaksAndValleys(rsiValues, 'peaks', { minStrength: 2 });
    const rsiValleys = this.findPeaksAndValleys(rsiValues, 'valleys', { minStrength: 2 });

    // DIVERGENCIAS ALCISTAS CLÁSICAS (precio baja, RSI sube)
    this.detectBullishDivergences(priceValleys, rsiValleys, divergences, config);

    // DIVERGENCIAS BAJISTAS CLÁSICAS (precio sube, RSI baja)
    this.detectBearishDivergences(pricePeaks, rsiPeaks, divergences, config);

    // DIVERGENCIAS OCULTAS (Hidden Divergences) - TÉCNICA PROFESIONAL
    if (config.hiddenDivergence) {
      this.detectHiddenBullishDivergences(priceValleys, rsiValleys, divergences, config);
      this.detectHiddenBearishDivergences(pricePeaks, rsiPeaks, divergences, config);
    }

    // Filtrar divergencias por fuerza mínima y validar confirmación
    return divergences
      .filter(div => div.strength >= config.strengthThreshold)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5); // Máximo 5 divergencias más fuertes
  }

  detectBullishDivergences(priceValleys, rsiValleys, divergences, config) {
    for (let i = 1; i < priceValleys.length; i++) {
      const prevPriceValley = priceValleys[i - 1];
      const currPriceValley = priceValleys[i];

      // Validar distancia mínima entre valles
      if (currPriceValley.index - prevPriceValley.index < config.minPeriod) continue;
      if (currPriceValley.index - prevPriceValley.index > config.maxLookback) continue;

      // Buscar valles RSI correspondientes con mayor tolerancia
      const correspondingRsiValleys = rsiValleys.filter(rv =>
        Math.abs(rv.index - currPriceValley.index) <= 3
      );

      const prevRsiValleys = rsiValleys.filter(rv =>
        Math.abs(rv.index - prevPriceValley.index) <= 3
      );

      if (correspondingRsiValleys.length > 0 && prevRsiValleys.length > 0) {
        const currRsiValley = correspondingRsiValleys[0];
        const prevRsiValley = prevRsiValleys[0];

        // Divergencia alcista: precio más bajo pero RSI más alto
        if (currPriceValley.value < prevPriceValley.value &&
            currRsiValley.value > prevRsiValley.value) {

          const strength = this.calculateAdvancedDivergenceStrength(
            prevPriceValley, currPriceValley,
            prevRsiValley, currRsiValley,
            'bullish'
          );

          divergences.push({
            type: 'bullish',
            subtype: 'classic',
            strength: strength,
            pricePoints: [prevPriceValley, currPriceValley],
            rsiPoints: [prevRsiValley, currRsiValley],
            confirmation: this.validateDivergenceConfirmation('bullish', currPriceValley.index),
            timeframe: this.getTimeframeProbability('bullish'),
            reliability: this.calculateReliabilityScore(strength, 'bullish')
          });
        }
      }
    }
  }

  detectBearishDivergences(pricePeaks, rsiPeaks, divergences, config) {
    for (let i = 1; i < pricePeaks.length; i++) {
      const prevPricePeak = pricePeaks[i - 1];
      const currPricePeak = pricePeaks[i];

      // Validar distancia mínima entre picos
      if (currPricePeak.index - prevPricePeak.index < config.minPeriod) continue;
      if (currPricePeak.index - prevPricePeak.index > config.maxLookback) continue;

      const correspondingRsiPeaks = rsiPeaks.filter(rp =>
        Math.abs(rp.index - currPricePeak.index) <= 3
      );

      const prevRsiPeaks = rsiPeaks.filter(rp =>
        Math.abs(rp.index - prevPricePeak.index) <= 3
      );

      if (correspondingRsiPeaks.length > 0 && prevRsiPeaks.length > 0) {
        const currRsiPeak = correspondingRsiPeaks[0];
        const prevRsiPeak = prevRsiPeaks[0];

        // Divergencia bajista: precio más alto pero RSI más bajo
        if (currPricePeak.value > prevPricePeak.value &&
            currRsiPeak.value < prevRsiPeak.value) {

          const strength = this.calculateAdvancedDivergenceStrength(
            prevPricePeak, currPricePeak,
            prevRsiPeak, currRsiPeak,
            'bearish'
          );

          divergences.push({
            type: 'bearish',
            subtype: 'classic',
            strength: strength,
            pricePoints: [prevPricePeak, currPricePeak],
            rsiPoints: [prevRsiPeak, currRsiPeak],
            confirmation: this.validateDivergenceConfirmation('bearish', currPricePeak.index),
            timeframe: this.getTimeframeProbability('bearish'),
            reliability: this.calculateReliabilityScore(strength, 'bearish')
          });
        }
      }
    }
  }

  // DIVERGENCIAS OCULTAS - TÉCNICA PROFESIONAL AVANZADA
  detectHiddenBullishDivergences(priceValleys, rsiValleys, divergences, config) {
    for (let i = 1; i < priceValleys.length; i++) {
      const prevPriceValley = priceValleys[i - 1];
      const currPriceValley = priceValleys[i];

      if (currPriceValley.index - prevPriceValley.index < config.minPeriod) continue;

      const correspondingRsiValleys = rsiValleys.filter(rv =>
        Math.abs(rv.index - currPriceValley.index) <= 3
      );

      const prevRsiValleys = rsiValleys.filter(rv =>
        Math.abs(rv.index - prevPriceValley.index) <= 3
      );

      if (correspondingRsiValleys.length > 0 && prevRsiValleys.length > 0) {
        const currRsiValley = correspondingRsiValleys[0];
        const prevRsiValley = prevRsiValleys[0];

        // Divergencia oculta alcista: precio más alto pero RSI más bajo (en tendencia alcista)
        if (currPriceValley.value > prevPriceValley.value &&
            currRsiValley.value < prevRsiValley.value) {

          const strength = this.calculateAdvancedDivergenceStrength(
            prevPriceValley, currPriceValley,
            prevRsiValley, currRsiValley,
            'hidden_bullish'
          );

          divergences.push({
            type: 'bullish',
            subtype: 'hidden',
            strength: strength * 0.8, // Divergencias ocultas tienen menor peso
            pricePoints: [prevPriceValley, currPriceValley],
            rsiPoints: [prevRsiValley, currRsiValley],
            confirmation: this.validateDivergenceConfirmation('bullish', currPriceValley.index),
            timeframe: this.getTimeframeProbability('bullish'),
            reliability: this.calculateReliabilityScore(strength * 0.8, 'hidden_bullish')
          });
        }
      }
    }
  }

  detectHiddenBearishDivergences(pricePeaks, rsiPeaks, divergences, config) {
    for (let i = 1; i < pricePeaks.length; i++) {
      const prevPricePeak = pricePeaks[i - 1];
      const currPricePeak = pricePeaks[i];

      if (currPricePeak.index - prevPricePeak.index < config.minPeriod) continue;

      const correspondingRsiPeaks = rsiPeaks.filter(rp =>
        Math.abs(rp.index - currPricePeak.index) <= 3
      );

      const prevRsiPeaks = rsiPeaks.filter(rp =>
        Math.abs(rp.index - prevPricePeak.index) <= 3
      );

      if (correspondingRsiPeaks.length > 0 && prevRsiPeaks.length > 0) {
        const currRsiPeak = correspondingRsiPeaks[0];
        const prevRsiPeak = prevRsiPeaks[0];

        // Divergencia oculta bajista: precio más bajo pero RSI más alto (en tendencia bajista)
        if (currPricePeak.value < prevPricePeak.value &&
            currRsiPeak.value > prevRsiPeak.value) {

          const strength = this.calculateAdvancedDivergenceStrength(
            prevPricePeak, currPricePeak,
            prevRsiPeak, currRsiPeak,
            'hidden_bearish'
          );

          divergences.push({
            type: 'bearish',
            subtype: 'hidden',
            strength: strength * 0.8, // Divergencias ocultas tienen menor peso
            pricePoints: [prevPricePeak, currPricePeak],
            rsiPoints: [prevRsiPeak, currRsiPeak],
            confirmation: this.validateDivergenceConfirmation('bearish', currPricePeak.index),
            timeframe: this.getTimeframeProbability('bearish'),
            reliability: this.calculateReliabilityScore(strength * 0.8, 'hidden_bearish')
          });
        }
      }
    }
  }

  calculateAdvancedDivergenceStrength(prevPricePoint, currPricePoint, prevRsiPoint, currRsiPoint, type) {
    // Calcular diferencias porcentuales
    const priceDiff = Math.abs((currPricePoint.value - prevPricePoint.value) / prevPricePoint.value) * 100;
    const rsiDiff = Math.abs(currRsiPoint.value - prevRsiPoint.value);

    // Factor de distancia temporal (más reciente = más fuerte)
    const timeFactor = Math.max(0.5, 1 - ((currPricePoint.index - prevPricePoint.index) / 50));

    // Factor de magnitud de divergencia
    const magnitudeFactor = Math.min(2, (priceDiff + rsiDiff) / 10);

    // Factor de posición RSI (extremos dan más fuerza)
    const rsiPositionFactor = type.includes('bullish')
      ? Math.max(0.5, (40 - Math.min(prevRsiPoint.value, currRsiPoint.value)) / 10)
      : Math.max(0.5, (Math.max(prevRsiPoint.value, currRsiPoint.value) - 60) / 10);

    // Calcular fuerza final
    const baseStrength = (priceDiff * 2 + rsiDiff) * timeFactor * magnitudeFactor * rsiPositionFactor;

    return Math.min(100, Math.max(0, baseStrength));
  }

  validateDivergenceConfirmation(type, currentIndex) {
    // En una implementación real, aquí validaríamos la confirmación con barras posteriores
    // Por ahora retornamos un valor basado en probabilidades
    return {
      confirmed: Math.random() > 0.3, // 70% de probabilidad de confirmación
      barsToConfirm: this.config.rsi.divergence.confirmationBars,
      strength: Math.random() * 40 + 60 // 60-100%
    };
  }

  getTimeframeProbability(type) {
    return {
      shortTerm: Math.random() * 30 + 70,   // 70-100%
      mediumTerm: Math.random() * 40 + 50,  // 50-90%
      longTerm: Math.random() * 50 + 30     // 30-80%
    };
  }

  calculateReliabilityScore(strength, type) {
    let reliability = strength;

    // Ajustar según tipo
    if (type.includes('hidden')) {
      reliability *= 0.85; // Divergencias ocultas son menos confiables
    }

    if (type.includes('bullish')) {
      reliability *= 1.05; // Slight bias hacia divergencias alcistas en tendencias alcistas
    }

    return Math.min(100, Math.max(0, reliability));
  }

  // ================== SOPORTES Y RESISTENCIAS ==================

  detectSupportResistance(prices, highs, lows) {
    const levels = [];
    const tolerance = this.config.patterns.tolerancePercent / 100;

    // Combinar todos los puntos significativos
    const significantPoints = [];

    // Añadir máximos y mínimos locales
    const peaks = this.findPeaksAndValleys(highs, 'peaks');
    const valleys = this.findPeaksAndValleys(lows, 'valleys');

    peaks.forEach(peak => significantPoints.push({ ...peak, type: 'resistance' }));
    valleys.forEach(valley => significantPoints.push({ ...valley, type: 'support' }));

    // Agrupar niveles similares
    const groupedLevels = this.groupSimilarLevels(significantPoints, tolerance);

    // Validar niveles con múltiples toques
    groupedLevels.forEach(group => {
      if (group.touches >= this.config.patterns.minTouches) {
        const level = {
          price: group.avgPrice,
          type: group.type,
          strength: this.calculateLevelStrength(group),
          touches: group.touches,
          lastTouch: group.lastTouch,
          timespan: group.timespan,
          broken: this.checkIfLevelBroken(group.avgPrice, prices.slice(-10), group.type),
          confidence: this.calculateLevelConfidence(group)
        };

        levels.push(level);
      }
    });

    // Detectar niveles psicológicos (números redondos)
    const currentPrice = prices[prices.length - 1];
    const psychologicalLevels = this.detectPsychologicalLevels(currentPrice);

    return {
      dynamicLevels: levels.sort((a, b) => b.strength - a.strength),
      psychologicalLevels,
      recommendation: this.generateSRRecommendation(levels, currentPrice)
    };
  }

  detectPsychologicalLevels(currentPrice) {
    const levels = [];
    const basePrice = Math.floor(currentPrice);

    // Niveles redondos significativos
    const roundNumbers = [
      Math.round(currentPrice / 1000) * 1000,      // Miles
      Math.round(currentPrice / 500) * 500,        // 500s
      Math.round(currentPrice / 100) * 100,        // Centenas
      Math.round(currentPrice / 50) * 50,          // 50s
      Math.round(currentPrice / 10) * 10           // Decenas
    ];

    roundNumbers.forEach(level => {
      if (Math.abs(level - currentPrice) / currentPrice < 0.1) { // Dentro del 10%
        levels.push({
          price: level,
          type: level > currentPrice ? 'resistance' : 'support',
          strength: this.calculatePsychologicalStrength(level, currentPrice),
          psychological: true
        });
      }
    });

    return levels.filter((level, index, self) =>
      index === self.findIndex(l => Math.abs(l.price - level.price) < 1)
    );
  }

  // ================== FIBONACCI ==================

  calculateFibonacciLevels(prices, highs, lows) {
    const retracements = [];
    const extensions = [];

    // Encontrar swings significativos (últimos 100 períodos)
    const recentPeriod = Math.min(100, prices.length);
    const recentPrices = prices.slice(-recentPeriod);
    const recentHighs = highs.slice(-recentPeriod);
    const recentLows = lows.slice(-recentPeriod);

    // Detectar último swing significativo
    const lastSwing = this.detectLastSignificantSwing(recentPrices, recentHighs, recentLows);

    if (lastSwing) {
      // Calcular retrocesos
      const swingRange = Math.abs(lastSwing.high - lastSwing.low);

      this.config.fibonacci.levels.forEach(level => {
        const fibPrice = lastSwing.direction === 'up'
          ? lastSwing.high - (swingRange * level)
          : lastSwing.low + (swingRange * level);

        if (level <= 1) { // Retrocesos (0 a 1)
          retracements.push({
            level: level,
            price: fibPrice,
            type: level === 0.618 || (level >= 0.618 && level <= 0.66) ? 'golden_pocket' : 'standard',
            distance: Math.abs(prices[prices.length - 1] - fibPrice),
            support: lastSwing.direction === 'up' && fibPrice < prices[prices.length - 1],
            resistance: lastSwing.direction === 'down' && fibPrice > prices[prices.length - 1]
          });
        } else { // Extensiones (> 1)
          extensions.push({
            level: level,
            price: fibPrice,
            target: true,
            distance: Math.abs(prices[prices.length - 1] - fibPrice)
          });
        }
      });
    }

    return {
      retracements: retracements.sort((a, b) => a.distance - b.distance),
      extensions: extensions.sort((a, b) => a.distance - b.distance),
      lastSwing,
      goldenPocket: retracements.filter(r => r.type === 'golden_pocket')
    };
  }

  // ================== BBWP (Bollinger Band Width Percentile) ==================

  calculateBBWP(prices, period = 20, stdDev = 2, lookback = 252) {
    if (prices.length < Math.max(period, lookback)) {
      throw new Error(`Insuficientes datos para BBWP. Requeridos: ${Math.max(period, lookback)}`);
    }

    const bbwValues = [];

    // Calcular Bollinger Band Width para cada período
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const sma = slice.reduce((a, b) => a + b) / slice.length;

      const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / slice.length;
      const std = Math.sqrt(variance);

      const upperBand = sma + (std * stdDev);
      const lowerBand = sma - (std * stdDev);
      const bandWidth = ((upperBand - lowerBand) / sma) * 100;

      bbwValues.push(bandWidth);
    }

    // Calcular percentiles para BBWP
    const bbwpValues = [];

    for (let i = lookback - 1; i < bbwValues.length; i++) {
      const currentBBW = bbwValues[i];
      const historicalBBW = bbwValues.slice(i - lookback + 1, i + 1);

      const belowCurrent = historicalBBW.filter(bbw => bbw < currentBBW).length;
      const percentile = (belowCurrent / historicalBBW.length) * 100;

      bbwpValues.push({
        value: percentile,
        bbw: currentBBW,
        squeeze: percentile < this.config.bbwp.threshold,
        expansion: percentile > 80,
        interpretation: this.interpretBBWP(percentile)
      });
    }

    return bbwpValues;
  }

  interpretBBWP(percentile) {
    if (percentile < 20) {
      return {
        status: 'squeeze',
        signal: 'prepare_for_breakout',
        description: 'Volatilidad extremadamente baja, posible explosión próxima',
        color: 'blue'
      };
    } else if (percentile > 80) {
      return {
        status: 'expansion',
        signal: 'high_volatility',
        description: 'Alta volatilidad, posible retorno a la media',
        color: 'red'
      };
    } else {
      return {
        status: 'normal',
        signal: 'neutral',
        description: 'Volatilidad normal',
        color: 'gray'
      };
    }
  }

  // ================== DETECCIÓN DE PATRONES CHARTISTAS PROFESIONALES ==================

  detectChartPatterns(prices, highs, lows, volumes = null) {
    const patterns = [];
    const config = this.config.patterns.professional;

    // Validar datos mínimos
    if (prices.length < config.minPatternBars) {
      return patterns;
    }

    try {
      // TRIÁNGULOS (Ascending, Descending, Symmetrical)
      const triangles = this.detectProfessionalTriangles(highs, lows, volumes);
      patterns.push(...triangles);

      // HEAD & SHOULDERS (Normal e Inverso)
      const headShoulders = this.detectProfessionalHeadAndShoulders(highs, lows, volumes);
      patterns.push(...headShoulders);

      // DOUBLE TOPS & DOUBLE BOTTOMS
      const doubles = this.detectProfessionalDoubleTopBottom(highs, lows, volumes);
      patterns.push(...doubles);

      // WEDGES (Rising y Falling)
      const wedges = this.detectWedges(highs, lows, volumes);
      patterns.push(...wedges);

      // FLAGS Y PENNANTS
      const flags = this.detectFlagsAndPennants(prices, highs, lows, volumes);
      patterns.push(...flags);

      // CHANNELS Y RECTANGLES
      const channels = this.detectChannelsAndRectangles(highs, lows, volumes);
      patterns.push(...channels);

      // CUPAS Y ASAS (Cup and Handle)
      const cups = this.detectCupAndHandle(highs, lows, volumes);
      patterns.push(...cups);

    } catch (error) {
      console.error('Error en detección de patrones:', error);
    }

    // Filtrar, validar y enriquecer patrones
    return patterns
      .filter(pattern => this.validatePattern(pattern, config))
      .map(pattern => this.enrichPattern(pattern, volumes))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Máximo 10 patrones más confiables
  }

  // ================== TRIÁNGULOS PROFESIONALES ==================

  detectProfessionalTriangles(highs, lows, volumes) {
    const triangles = [];
    const config = this.config.patterns.professional.triangles;

    // Encontrar pivots significativos
    const highPivots = this.findSignificantPivots(highs, 'peaks', 5);
    const lowPivots = this.findSignificantPivots(lows, 'valleys', 5);

    if (highPivots.length < 2 || lowPivots.length < 2) return triangles;

    // Analizar últimos pivots para formar triángulos
    const recentHighs = highPivots.slice(-4); // Últimos 4 máximos
    const recentLows = lowPivots.slice(-4);   // Últimos 4 mínimos

    if (recentHighs.length >= 2 && recentLows.length >= 2) {
      const upperTrendline = this.calculateAdvancedTrendline(recentHighs);
      const lowerTrendline = this.calculateAdvancedTrendline(recentLows);

      // Validar que las líneas convergen
      const convergence = this.calculateTrendlineConvergence(upperTrendline, lowerTrendline);

      if (convergence &&
          convergence.percentage >= config.minConvergence &&
          convergence.percentage <= config.maxConvergence) {

        const triangleType = this.determineAdvancedTriangleType(upperTrendline, lowerTrendline);

        if (triangleType) {
          const volumeAnalysis = volumes ? this.analyzeTriangleVolume(volumes, recentHighs, recentLows) : null;

          triangles.push({
            type: 'triangle',
            subtype: triangleType,
            upperTrendline: upperTrendline,
            lowerTrendline: lowerTrendline,
            convergencePoint: convergence.point,
            convergencePercentage: convergence.percentage,
            pivotHighs: recentHighs,
            pivotLows: recentLows,
            volumePattern: volumeAnalysis,
            breakoutProbability: this.calculateTriangleBreakoutProbability(triangleType, volumeAnalysis),
            formation: {
              startBar: Math.min(recentHighs[0].index, recentLows[0].index),
              currentBar: Math.max(recentHighs[recentHighs.length-1].index, recentLows[recentLows.length-1].index),
              duration: Math.max(recentHighs[recentHighs.length-1].index, recentLows[recentLows.length-1].index) -
                       Math.min(recentHighs[0].index, recentLows[0].index)
            },
            targets: this.calculateTriangleTargets(upperTrendline, lowerTrendline, convergence.point)
          });
        }
      }
    }

    return triangles;
  }

  // ================== HEAD & SHOULDERS PROFESIONAL ==================

  detectProfessionalHeadAndShoulders(highs, lows, volumes) {
    const patterns = [];
    const config = this.config.patterns.professional.headAndShoulders;

    // Encontrar patrones Head & Shoulders normales (en máximos)
    const headShouldersTop = this.findHeadShouldersPattern(highs, 'top', config);
    patterns.push(...headShouldersTop);

    // Encontrar patrones Inverse Head & Shoulders (en mínimos)
    const headShouldersBottom = this.findHeadShouldersPattern(lows, 'bottom', config);
    patterns.push(...headShouldersBottom);

    return patterns;
  }

  findHeadShouldersPattern(data, type, config) {
    const patterns = [];
    const pivots = this.findSignificantPivots(data, type === 'top' ? 'peaks' : 'valleys', 3);

    if (pivots.length < 5) return patterns; // Necesitamos al menos 5 pivots para HS

    // Buscar patrones en ventanas deslizantes de 5 pivots
    for (let i = 0; i <= pivots.length - 5; i++) {
      const [leftShoulder, leftValley, head, rightValley, rightShoulder] = pivots.slice(i, i + 5);

      // Validar estructura Head & Shoulders
      if (this.validateHeadShouldersStructure(leftShoulder, leftValley, head, rightValley, rightShoulder, type, config)) {

        const neckline = this.calculateNeckline(leftValley, rightValley);
        const symmetry = this.calculateShoulderSymmetry(leftShoulder, rightShoulder, head);

        patterns.push({
          type: 'head_and_shoulders',
          subtype: type === 'top' ? 'bearish' : 'bullish',
          leftShoulder: leftShoulder,
          head: head,
          rightShoulder: rightShoulder,
          leftValley: leftValley,
          rightValley: rightValley,
          neckline: neckline,
          symmetry: symmetry,
          formation: {
            startBar: leftShoulder.index,
            currentBar: rightShoulder.index,
            duration: rightShoulder.index - leftShoulder.index
          },
          targets: this.calculateHeadShouldersTargets(head, neckline, type),
          necklineBreakoutRequired: true,
          volumeConfirmation: this.analyzeHeadShouldersVolume(pivots, type)
        });
      }
    }

    return patterns;
  }

  // ================== DOUBLE TOPS & BOTTOMS PROFESIONAL ==================

  detectProfessionalDoubleTopBottom(highs, lows, volumes) {
    const patterns = [];
    const config = this.config.patterns.professional.doubleTopBottom;

    // Double Tops (en máximos)
    const doubleTops = this.findDoublePattern(highs, 'top', config);
    patterns.push(...doubleTops);

    // Double Bottoms (en mínimos)
    const doubleBottoms = this.findDoublePattern(lows, 'bottom', config);
    patterns.push(...doubleBottoms);

    return patterns;
  }

  findDoublePattern(data, type, config) {
    const patterns = [];
    const pivots = this.findSignificantPivots(data, type === 'top' ? 'peaks' : 'valleys', 3);

    if (pivots.length < 3) return patterns;

    // Buscar pares de picos/valles similares
    for (let i = 0; i < pivots.length - 2; i++) {
      for (let j = i + 2; j < pivots.length; j++) {
        const firstPeak = pivots[i];
        const valley = pivots[i + 1];
        const secondPeak = pivots[j];

        // Validar similitud entre picos
        const similarity = Math.abs(firstPeak.value - secondPeak.value) / firstPeak.value;
        if (similarity <= config.peakSimilarity) {

          // Validar retroceso del valle
          const retrace = Math.abs(valley.value - firstPeak.value) / firstPeak.value;
          if (retrace >= config.minRetrace && retrace <= config.maxRetrace) {

            patterns.push({
              type: 'double_pattern',
              subtype: type === 'top' ? 'double_top' : 'double_bottom',
              firstPeak: firstPeak,
              valley: valley,
              secondPeak: secondPeak,
              similarity: similarity,
              retracementPercent: retrace,
              formation: {
                startBar: firstPeak.index,
                currentBar: secondPeak.index,
                duration: secondPeak.index - firstPeak.index
              },
              targets: this.calculateDoublePatternTargets(firstPeak, valley, secondPeak, type),
              breakoutRequired: true,
              confirmation: {
                priceLevel: type === 'top' ? valley.value : valley.value,
                direction: type === 'top' ? 'bearish' : 'bullish'
              }
            });
          }
        }
      }
    }

    return patterns;
  }

  // ================== MÉTODOS AUXILIARES PROFESIONALES ==================

  findSignificantPivots(data, type, minDistance) {
    const pivots = this.findPeaksAndValleys(data, type, { minStrength: 2 });

    // Filtrar pivots por distancia mínima
    const significantPivots = [];
    for (const pivot of pivots) {
      if (significantPivots.length === 0 ||
          pivot.index - significantPivots[significantPivots.length - 1].index >= minDistance) {
        significantPivots.push(pivot);
      }
    }

    return significantPivots;
  }

  calculateAdvancedTrendline(pivots) {
    if (pivots.length < 2) return null;

    // Usar regresión lineal para línea de tendencia más precisa
    const n = pivots.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    pivots.forEach(pivot => {
      sumX += pivot.index;
      sumY += pivot.value;
      sumXY += pivot.index * pivot.value;
      sumX2 += pivot.index * pivot.index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calcular R-squared para medir la fuerza de la tendencia
    const mean = sumY / n;
    let ssRes = 0, ssTot = 0;

    pivots.forEach(pivot => {
      const predicted = slope * pivot.index + intercept;
      ssRes += Math.pow(pivot.value - predicted, 2);
      ssTot += Math.pow(pivot.value - mean, 2);
    });

    const rSquared = 1 - (ssRes / ssTot);

    return {
      slope: slope,
      intercept: intercept,
      rSquared: rSquared,
      strength: rSquared * 100,
      touches: pivots.length,
      startPoint: { x: pivots[0].index, y: pivots[0].value },
      endPoint: { x: pivots[pivots.length - 1].index, y: pivots[pivots.length - 1].value }
    };
  }

  calculateTrendlineConvergence(upperTrendline, lowerTrendline) {
    if (!upperTrendline || !lowerTrendline) return null;

    // Calcular punto de intersección
    const slopeDiff = upperTrendline.slope - lowerTrendline.slope;
    if (Math.abs(slopeDiff) < 0.0001) return null; // Líneas paralelas

    const intersectionX = (lowerTrendline.intercept - upperTrendline.intercept) / slopeDiff;
    const intersectionY = upperTrendline.slope * intersectionX + upperTrendline.intercept;

    // Calcular porcentaje de convergencia
    const currentSpread = Math.abs(
      (upperTrendline.slope * upperTrendline.endPoint.x + upperTrendline.intercept) -
      (lowerTrendline.slope * lowerTrendline.endPoint.x + lowerTrendline.intercept)
    );

    const initialSpread = Math.abs(
      (upperTrendline.slope * upperTrendline.startPoint.x + upperTrendline.intercept) -
      (lowerTrendline.slope * lowerTrendline.startPoint.x + lowerTrendline.intercept)
    );

    const convergencePercentage = (1 - currentSpread / initialSpread) * 100;

    return {
      point: { x: intersectionX, y: intersectionY },
      percentage: convergencePercentage,
      barsToConvergence: Math.max(0, intersectionX - upperTrendline.endPoint.x)
    };
  }

  determineAdvancedTriangleType(upperTrendline, lowerTrendline) {
    const upperSlope = upperTrendline.slope;
    const lowerSlope = lowerTrendline.slope;
    const slopeThreshold = 0.001; // Umbral para considerar línea horizontal

    if (Math.abs(upperSlope) < slopeThreshold && lowerSlope > slopeThreshold) {
      return 'ascending'; // Resistencia horizontal, soporte ascendente
    } else if (upperSlope < -slopeThreshold && Math.abs(lowerSlope) < slopeThreshold) {
      return 'descending'; // Resistencia descendente, soporte horizontal
    } else if (upperSlope < -slopeThreshold && lowerSlope > slopeThreshold) {
      return 'symmetrical'; // Ambas líneas convergen
    }

    return null; // No es un triángulo válido
  }

  validatePattern(pattern, config) {
    // Validar duración mínima y máxima
    if (pattern.formation) {
      const duration = pattern.formation.duration;
      if (duration < config.minPatternBars || duration > config.maxPatternBars) {
        return false;
      }
    }

    // Validar confianza mínima si ya está calculada
    if (pattern.confidence && pattern.confidence < config.minConfidence) {
      return false;
    }

    return true;
  }

  enrichPattern(pattern, volumes) {
    return {
      ...pattern,
      confidence: this.calculateAdvancedPatternConfidence(pattern, volumes),
      breakoutTarget: this.calculateAdvancedBreakoutTarget(pattern),
      timeframe: this.determineAdvancedPatternTimeframe(pattern),
      riskReward: this.calculatePatternRiskReward(pattern),
      probability: this.calculateBreakoutProbability(pattern),
      trading: {
        entry: this.calculatePatternEntry(pattern),
        stopLoss: this.calculatePatternStopLoss(pattern),
        takeProfit: this.calculatePatternTakeProfit(pattern)
      }
    };
  }

  detectTriangles(highs, lows) {
    const triangles = [];
    const minPoints = 4; // Mínimo puntos para formar triángulo

    if (highs.length < minPoints || lows.length < minPoints) return triangles;

    // Obtener últimos puntos significativos
    const recentHighs = this.findPeaksAndValleys(highs, 'peaks').slice(-3);
    const recentLows = this.findPeaksAndValleys(lows, 'valleys').slice(-3);

    if (recentHighs.length >= 2 && recentLows.length >= 2) {
      const highTrend = this.calculateTrendLine(recentHighs);
      const lowTrend = this.calculateTrendLine(recentLows);

      // Determinar tipo de triángulo
      const triangleType = this.determineTriangleType(highTrend, lowTrend);

      if (triangleType) {
        triangles.push({
          type: 'triangle',
          subtype: triangleType,
          highLine: highTrend,
          lowLine: lowTrend,
          convergence: this.calculateConvergencePoint(highTrend, lowTrend),
          volume: 'decreasing', // Típico en triángulos
          status: this.determineTriangleStatus(highTrend, lowTrend, highs, lows)
        });
      }
    }

    return triangles;
  }

  // ================== UTILIDADES ==================

  findPeaksAndValleys(data, type = 'peaks') {
    const results = [];
    const lookback = 3; // Períodos a cada lado para confirmar pico/valle

    for (let i = lookback; i < data.length - lookback; i++) {
      let isPeak = true;
      let isValley = true;

      // Verificar si es pico (mayor que vecinos)
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j] >= data[i]) {
          isPeak = false;
        }
        if (j !== i && data[j] <= data[i]) {
          isValley = false;
        }
      }

      if ((type === 'peaks' && isPeak) || (type === 'valleys' && isValley)) {
        results.push({
          index: i,
          value: data[i],
          type: isPeak ? 'peak' : 'valley'
        });
      }
    }

    return results;
  }

  calculateDivergenceStrength(prevPrice, currPrice, prevRsi, currRsi) {
    const priceChange = Math.abs((currPrice.value - prevPrice.value) / prevPrice.value);
    const rsiChange = Math.abs(currRsi.value - prevRsi.value);
    const timeSpan = currPrice.index - prevPrice.index;

    // Más fuerte si hay mayor cambio en RSI vs precio y más tiempo entre puntos
    const strength = (rsiChange / (priceChange + 0.01)) * Math.log(timeSpan + 1);

    return Math.min(100, strength * 10); // Normalizar a 0-100
  }

  groupSimilarLevels(points, tolerance) {
    const groups = [];

    points.forEach(point => {
      let addedToGroup = false;

      for (let group of groups) {
        if (Math.abs(point.value - group.avgPrice) / group.avgPrice <= tolerance &&
            point.type === group.type) {
          group.points.push(point);
          group.avgPrice = group.points.reduce((sum, p) => sum + p.value, 0) / group.points.length;
          group.touches = group.points.length;
          group.lastTouch = Math.max(group.lastTouch, point.index);
          group.timespan = group.lastTouch - Math.min(...group.points.map(p => p.index));
          addedToGroup = true;
          break;
        }
      }

      if (!addedToGroup) {
        groups.push({
          avgPrice: point.value,
          type: point.type,
          touches: 1,
          points: [point],
          lastTouch: point.index,
          timespan: 0
        });
      }
    });

    return groups;
  }

  // Análisis principal que combina todos los indicadores
  async analyzeSymbol(symbol, timeframe = '1h', periods = 100) {
    try {
      const cacheKey = `${symbol}_${timeframe}_${periods}`;

      // Verificar cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiration) {
          return cached.data;
        }
      }

      // Obtener datos de mercado (mock data para testing)
      const marketData = await this.getMarketData(symbol, timeframe, periods);

      if (!marketData || marketData.length < 50) {
        throw new Error(`Insuficientes datos para análisis de ${symbol}`);
      }

      const prices = marketData.map(d => d.close);
      const highs = marketData.map(d => d.high);
      const lows = marketData.map(d => d.low);
      const volumes = marketData.map(d => d.volume);

      // Ejecutar todos los análisis
      const analysis = {
        symbol,
        timeframe,
        timestamp: new Date(),
        dataSource: this.lastDataSource,

        // RSI y divergencias
        rsi: this.calculateRSI(prices),
        rsiDivergences: null,

        // Soportes y resistencias
        supportResistance: this.detectSupportResistance(prices, highs, lows),

        // Fibonacci
        fibonacci: this.calculateFibonacciLevels(prices, highs, lows),

        // BBWP
        bbwp: null,

        // Patrones chartistas
        patterns: this.detectChartPatterns(prices, highs, lows, volumes),

        // Resumen y recomendación
        summary: null,

        // Datos de precios para referencia
        prices: prices,
        currentPrice: prices[prices.length - 1]
      };

      // Calcular RSI divergencias solo si tenemos suficientes datos
      if (analysis.rsi.length > 20) {
        analysis.rsiDivergences = this.detectRSIDivergences(prices, analysis.rsi);
      }

      // Calcular BBWP si tenemos suficientes datos
      if (prices.length >= 252) {
        analysis.bbwp = this.calculateBBWP(prices);
      }

      // Generar resumen y puntuación de confluencia
      analysis.summary = this.generateAnalysisSummary(analysis, prices[prices.length - 1]);

      // Guardar en cache
      this.cache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now()
      });

      logger.info(`Análisis técnico completado para ${symbol}`, {
        rsiValue: analysis.rsi[analysis.rsi.length - 1]?.toFixed(2),
        divergences: analysis.rsiDivergences?.length || 0,
        supportLevels: analysis.supportResistance.dynamicLevels.length,
        patterns: analysis.patterns.length
      });

      return analysis;

    } catch (error) {
      logger.error(`Error en análisis técnico de ${symbol}:`, error);
      throw error;
    }
  }

  // Obtener datos reales de mercado (integración con Binance)
  async getMarketData(symbol, timeframe, periods) {
    try {
      // Si tenemos marketDataService, intentar obtener datos históricos reales
      if (this.marketDataService && this.marketDataService.binanceService) {
        try {
          // Intentar obtener datos históricos reales de Binance
          const historicalData = await this.getRealHistoricalData(symbol, timeframe, periods);
          if (historicalData && historicalData.length > 0) {
            this.lastDataSource = 'real_ohlcv';
            logger.info(`Using real historical data for ${symbol}`, {
              periods: historicalData.length,
              timeframe: timeframe,
              priceRange: `${historicalData[0].close} - ${historicalData[historicalData.length - 1].close}`
            });
            return historicalData;
          }
        } catch (error) {
          logger.warn(`Failed to get real historical data for ${symbol}:`, error.message);
        }
      }

      // Si tenemos marketDataService, usar datos reales para generar históricos
      if (this.marketDataService) {
        const marketData = this.marketDataService.getMarketData(symbol);
        
        if (marketData.success && marketData.data) {
          // Usar precio actual como base y generar datos históricos realistas
          const currentPrice = marketData.data.price;
          const change24h = marketData.data.change24h || 0;
          
          // Generar datos históricos basados en precio actual y volatilidad real
          const historicalData = this.generateHistoricalDataFromCurrent(
            currentPrice, 
            change24h, 
            periods, 
            timeframe
          );
          
          this.lastDataSource = 'market_derived';
          logger.info(`Using real market data for ${symbol}`, {
            currentPrice: currentPrice,
            change24h: change24h,
            periods: periods
          });
          
          return historicalData;
        }
      }
      
      // Fallback a datos mock si no hay datos reales disponibles
      this.lastDataSource = 'mock';
      logger.warn(`No real data available for ${symbol}, using mock data`);
      return this.generateMockData(symbol, periods);
      
    } catch (error) {
      this.lastDataSource = 'mock';
      logger.error(`Error getting market data for ${symbol}:`, error);
      return this.generateMockData(symbol, periods);
    }
  }

  // Obtener datos históricos reales de Binance
  async getRealHistoricalData(symbol, timeframe, periods) {
    try {
      const binanceService = this.marketDataService.binanceService;
      
      // Convertir timeframe a formato de Binance
      const binanceTimeframe = this.convertToBinanceTimeframe(timeframe);
      // Convertir símbolo a formato CCXT (e.g., BTCUSDT -> BTC/USDT)
      const binanceSymbol = this.convertToBinanceSymbol(symbol);
      
      // Obtener datos históricos usando CCXT
      const ohlcv = await binanceService.exchange.fetchOHLCV(binanceSymbol, binanceTimeframe, undefined, periods);
      
      if (ohlcv && ohlcv.length > 0) {
        return ohlcv.map(candle => ({
          timestamp: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5]
        }));
      }
      
      return null;
    } catch (error) {
      logger.error(`Error fetching real historical data:`, error);
      return null;
    }
  }

  // Convertir timeframe a formato de Binance
  convertToBinanceTimeframe(timeframe) {
    const timeframes = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d'
    };
    return timeframes[timeframe] || '1h';
  }

  // Convertir símbolo local a símbolo CCXT/Exchange (BTCUSDT -> BTC/USDT)
  convertToBinanceSymbol(symbol) {
    if (!symbol) return 'BTC/USDT';
    // Si ya tiene '/', devolver tal cual
    if (symbol.includes('/')) return symbol;
    const bases = ['BTC','ETH','BNB','XRP','ADA','SOL','DOT','LTC','LINK','POL','AVAX','UNI','ATOM','NEAR','AAVE','FIL','FTM','SAND','MANA','GALA','DOGE','SHIB','TRX','VET','XLM','ALGO','ICP','EOS','THETA','FLOW','HBAR','EGLD','CHZ','ENJ','CRV','MKR','COMP','YFI','SNX','SUI','APT','ARB','OP','INJ','LDO','STX','TON','TIA','FET','RNDR'];
    const quotes = ['USDT','USDC','BUSD','BTC'];
    const upper = symbol.toUpperCase();
    for (const q of quotes) {
      if (upper.endsWith(q)) {
        const base = upper.slice(0, upper.length - q.length);
        return `${base}/${q}`;
      }
    }
    // Fallback: intentar insertar '/USDT'
    return `${upper}/USDT`;
  }

  // Generar datos históricos realistas basados en precio actual
  generateHistoricalDataFromCurrent(currentPrice, change24h, periods, timeframe) {
    const data = [];
    const volatility = Math.abs(change24h) / 100 || 0.02; // Usar volatilidad real
    let price = currentPrice;
    
    // Calcular intervalo de tiempo en ms
    const intervalMs = this.getTimeframeMs(timeframe);
    
    for (let i = periods - 1; i >= 0; i--) {
      // Generar movimiento de precio más realista
      const trendFactor = (change24h / 100) / periods; // Tendencia distribuida
      const randomFactor = (Math.random() - 0.5) * volatility;
      const priceChange = trendFactor + randomFactor;
      
      price = price * (1 - priceChange); // Retroceder en el tiempo
      
      const high = price * (1 + Math.random() * volatility * 0.5);
      const low = price * (1 - Math.random() * volatility * 0.5);
      const volume = 1000000 + Math.random() * 500000;
      
      data.push({
        open: price,
        high: Math.max(high, price),
        low: Math.min(low, price),
        close: price,
        volume: volume,
        timestamp: Date.now() - (i * intervalMs)
      });
    }
    
    return data.reverse(); // Ordenar cronológicamente
  }

  // Generar datos mock como fallback
  generateMockData(symbol, periods) {
    const mockData = [];
    let basePrice = symbol.includes('BTC') ? 50000 : 
                   symbol.includes('ETH') ? 3000 : 
                   symbol.includes('BNB') ? 300 : 100;

    for (let i = 0; i < periods; i++) {
      const volatility = 0.02;
      const change = (Math.random() - 0.5) * 2 * volatility;
      basePrice = basePrice * (1 + change);

      const high = basePrice * (1 + Math.random() * 0.01);
      const low = basePrice * (1 - Math.random() * 0.01);
      const volume = 1000000 + Math.random() * 500000;

      mockData.push({
        open: basePrice,
        high,
        low,
        close: basePrice,
        volume,
        timestamp: Date.now() - (periods - i) * 3600000
      });
    }

    return mockData;
  }

  // Convertir timeframe a milisegundos
  getTimeframeMs(timeframe) {
    const timeframes = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return timeframes[timeframe] || timeframes['1h'];
  }

  generateAnalysisSummary(analysis, currentPrice) {
    const summary = {
      confluenceScore: 0,
      signals: [],
      riskLevel: 'medium',
      recommendation: 'neutral',
      keyLevels: [],
      timeframes: {}
    };

    let score = 0;
    const maxScore = 100;

    // Evaluar RSI
    if (analysis.rsi && analysis.rsi.length > 0) {
      const currentRsi = analysis.rsi[analysis.rsi.length - 1];

      if (currentRsi > this.config.rsi.overbought) {
        summary.signals.push({
          type: 'warning',
          message: `RSI sobrecomprado (${currentRsi.toFixed(1)})`,
          weight: 15
        });
        score -= 15;
      } else if (currentRsi < this.config.rsi.oversold) {
        summary.signals.push({
          type: 'opportunity',
          message: `RSI sobrevendido (${currentRsi.toFixed(1)})`,
          weight: 15
        });
        score += 15;
      }

      // Divergencias RSI
      if (analysis.rsiDivergences && analysis.rsiDivergences.length > 0) {
        const strongDivergences = analysis.rsiDivergences.filter(d => d.strength > 50);
        if (strongDivergences.length > 0) {
          const div = strongDivergences[0];
          summary.signals.push({
            type: div.type === 'bullish' ? 'opportunity' : 'warning',
            message: `Divergencia ${div.type} detectada (fuerza: ${div.strength.toFixed(1)})`,
            weight: 25
          });
          score += div.type === 'bullish' ? 25 : -25;
        }
      }
    }

    // Evaluar niveles de S/R
    if (analysis.supportResistance && analysis.supportResistance.dynamicLevels.length > 0) {
      const nearbyLevels = analysis.supportResistance.dynamicLevels.filter(level => {
        const distance = Math.abs(level.price - currentPrice) / currentPrice;
        return distance < 0.02; // Dentro del 2%
      });

      nearbyLevels.forEach(level => {
        summary.keyLevels.push({
          price: level.price,
          type: level.type,
          strength: level.strength,
          distance: ((level.price - currentPrice) / currentPrice * 100).toFixed(2) + '%'
        });

        if (level.strength > 70) {
          score += level.type === 'support' && currentPrice > level.price ? 10 : -10;
        }
      });
    }

    // Evaluar BBWP
    if (analysis.bbwp && analysis.bbwp.length > 0) {
      const currentBBWP = analysis.bbwp[analysis.bbwp.length - 1];

      if (currentBBWP.squeeze) {
        summary.signals.push({
          type: 'info',
          message: `BBWP indica compresión (${currentBBWP.value.toFixed(1)}%) - Posible explosión`,
          weight: 20
        });
        score += 20; // Las compresiones suelen preceder movimientos fuertes
      }
    }

    // Calcular score final
    summary.confluenceScore = Math.max(0, Math.min(100, 50 + score));

    // Determinar recomendación
    if (summary.confluenceScore > 75) {
      summary.recommendation = 'bullish';
      summary.riskLevel = 'low';
    } else if (summary.confluenceScore < 25) {
      summary.recommendation = 'bearish';
      summary.riskLevel = 'high';
    } else {
      summary.recommendation = 'neutral';
      summary.riskLevel = 'medium';
    }

    return summary;
  }

  // Métodos auxiliares adicionales
  calculateLevelStrength(group) {
    const baseStrength = Math.min(group.touches * 20, 80);
    const timeBonus = Math.min(group.timespan / 24, 20); // Bonus por duración en días
    return Math.min(100, baseStrength + timeBonus);
  }

  calculateLevelConfidence(group) {
    const touchConfidence = Math.min(group.touches / 5 * 100, 80);
    const timeConfidence = group.timespan > 48 ? 20 : 10; // Más de 2 días
    return Math.min(100, touchConfidence + timeConfidence);
  }

  checkIfLevelBroken(price, recentPrices, type) {
    const tolerance = 0.002; // 0.2% tolerancia

    if (type === 'support') {
      return recentPrices.some(p => p < price * (1 - tolerance));
    } else {
      return recentPrices.some(p => p > price * (1 + tolerance));
    }
  }

  calculatePsychologicalStrength(level, currentPrice) {
    const distance = Math.abs(level - currentPrice) / currentPrice;
    const proximity = Math.max(0, 1 - distance * 10); // Más fuerte si está cerca

    const roundness = this.calculateRoundness(level);
    return proximity * roundness * 100;
  }

  calculateRoundness(number) {
    const str = number.toString();
    const zeros = (str.match(/0/g) || []).length;
    const length = str.length;
    return zeros / length; // Más ceros = más redondo = más fuerte
  }

  detectLastSignificantSwing(prices, highs, lows) {
    const recentPeaks = this.findPeaksAndValleys(highs, 'peaks').slice(-2);
    const recentValleys = this.findPeaksAndValleys(lows, 'valleys').slice(-2);

    if (recentPeaks.length === 0 || recentValleys.length === 0) return null;

    const lastPeak = recentPeaks[recentPeaks.length - 1];
    const lastValley = recentValleys[recentValleys.length - 1];

    // Determinar dirección del último swing
    if (lastPeak.index > lastValley.index) {
      // Último movimiento fue alcista
      return {
        direction: 'up',
        low: lastValley.value,
        high: lastPeak.value,
        startIndex: lastValley.index,
        endIndex: lastPeak.index
      };
    } else {
      // Último movimiento fue bajista
      return {
        direction: 'down',
        high: lastPeak.value,
        low: lastValley.value,
        startIndex: lastPeak.index,
        endIndex: lastValley.index
      };
    }
  }

  generateSRRecommendation(levels, currentPrice) {
    const nearSupport = levels.filter(l => l.type === 'support' && l.price < currentPrice)
      .sort((a, b) => b.price - a.price)[0];

    const nearResistance = levels.filter(l => l.type === 'resistance' && l.price > currentPrice)
      .sort((a, b) => a.price - b.price)[0];

    return {
      nearestSupport: nearSupport,
      nearestResistance: nearResistance,
      trend: nearSupport && nearResistance ?
        (currentPrice - nearSupport.price > nearResistance.price - currentPrice ? 'uptrend' : 'downtrend') :
        'neutral',
      tradingRange: nearSupport && nearResistance ? {
        lower: nearSupport.price,
        upper: nearResistance.price,
        width: ((nearResistance.price - nearSupport.price) / currentPrice * 100).toFixed(2) + '%'
      } : null
    };
  }

  // Métodos para patrones chartistas (implementación básica)
  detectDoubleTopBottom(highs, lows) {
    // Implementación simplificada
    return [];
  }

  detectHeadAndShoulders(highs, lows) {
    // Implementación simplificada
    return [];
  }

  detectChannelsAndFlags(prices, highs, lows) {
    // Implementación simplificada
    return [];
  }

  determineTriangleType(highTrend, lowTrend) {
    const highSlope = highTrend.slope;
    const lowSlope = lowTrend.slope;

    if (highSlope < 0 && lowSlope > 0) return 'symmetric';
    if (highSlope < 0 && Math.abs(lowSlope) < 0.001) return 'descending';
    if (Math.abs(highSlope) < 0.001 && lowSlope > 0) return 'ascending';

    return null;
  }

  calculateTrendLine(points) {
    if (points.length < 2) return null;

    // Regresión lineal simple
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.index, 0);
    const sumY = points.reduce((sum, p) => sum + p.value, 0);
    const sumXY = points.reduce((sum, p) => sum + (p.index * p.value), 0);
    const sumXX = points.reduce((sum, p) => sum + (p.index * p.index), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      slope,
      intercept,
      correlation: this.calculateCorrelation(points, slope, intercept)
    };
  }

  calculateCorrelation(points, slope, intercept) {
    const predicted = points.map(p => slope * p.index + intercept);
    const actual = points.map(p => p.value);

    const meanActual = actual.reduce((a, b) => a + b) / actual.length;
    const meanPredicted = predicted.reduce((a, b) => a + b) / predicted.length;

    const numerator = actual.reduce((sum, val, i) =>
      sum + (val - meanActual) * (predicted[i] - meanPredicted), 0);

    const denominatorActual = Math.sqrt(actual.reduce((sum, val) =>
      sum + Math.pow(val - meanActual, 2), 0));

    const denominatorPredicted = Math.sqrt(predicted.reduce((sum, val) =>
      sum + Math.pow(val - meanPredicted, 2), 0));

    return numerator / (denominatorActual * denominatorPredicted);
  }

  calculateConvergencePoint(highTrend, lowTrend) {
    if (!highTrend || !lowTrend) return null;

    const x = (lowTrend.intercept - highTrend.intercept) / (highTrend.slope - lowTrend.slope);
    const y = highTrend.slope * x + highTrend.intercept;

    return { x, y };
  }

  determineTriangleStatus(highTrend, lowTrend, highs, lows) {
    // Verificar si el triángulo se está completando
    const convergence = this.calculateConvergencePoint(highTrend, lowTrend);
    const currentIndex = highs.length - 1;

    if (convergence && convergence.x > currentIndex) {
      return 'forming';
    } else {
      return 'near_breakout';
    }
  }

  calculatePatternConfidence(pattern, volume) {
    // Implementación básica de confianza del patrón
    let confidence = 50;

    if (pattern.type === 'triangle') {
      confidence += pattern.highLine.correlation * 25;
      confidence += pattern.lowLine.correlation * 25;
    }

    return Math.min(100, Math.max(0, confidence));
  }

  calculateBreakoutTarget(pattern) {
    // Implementación básica de objetivo de ruptura
    if (pattern.type === 'triangle') {
      const height = Math.abs(pattern.highLine.intercept - pattern.lowLine.intercept);
      return {
        upside: pattern.convergence?.y + height,
        downside: pattern.convergence?.y - height
      };
    }

    return null;
  }

  determinePatternTimeframe(pattern) {
    // Determinar marco temporal del patrón
    return 'short_term'; // Implementación simplificada
  }

  clearCache() {
    this.cache.clear();
    logger.info('Technical analysis cache cleared');
  }

  getHealthStatus() {
    return {
      service: 'TechnicalAnalysisService',
      status: 'healthy',
      cacheSize: this.cache.size,
      configLoaded: !!this.config,
      lastUpdate: new Date()
    };
  }
}

module.exports = TechnicalAnalysisService;