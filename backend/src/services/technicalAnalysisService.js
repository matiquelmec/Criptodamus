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
  constructor() {
    this.cache = new Map();
    this.cacheExpiration = 5 * 60 * 1000; // 5 minutos

    // Configuración de indicadores
    this.config = {
      rsi: {
        period: 14,
        overbought: 70,
        oversold: 30
      },
      fibonacci: {
        levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618],
        goldenPocket: { min: 0.618, max: 0.66 }
      },
      bbwp: {
        period: 252, // 1 año de datos
        threshold: 20 // percentil para explosiones
      },
      patterns: {
        minTouches: 2, // mínimo toques para S/R válido
        tolerancePercent: 0.5 // tolerancia para niveles
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
    const minPeriod = 5; // mínimo períodos entre picos/valles

    // Encontrar picos y valles en precio
    const pricePeaks = this.findPeaksAndValleys(prices, 'peaks');
    const priceValleys = this.findPeaksAndValleys(prices, 'valleys');

    // Encontrar picos y valles en RSI
    const rsiPeaks = this.findPeaksAndValleys(rsiValues, 'peaks');
    const rsiValleys = this.findPeaksAndValleys(rsiValues, 'valleys');

    // Detectar divergencias alcistas (precio baja, RSI sube)
    for (let i = 1; i < priceValleys.length; i++) {
      const prevPriceValley = priceValleys[i - 1];
      const currPriceValley = priceValleys[i];

      if (currPriceValley.index - prevPriceValley.index < minPeriod) continue;

      // Buscar valles RSI correspondientes
      const correspondingRsiValleys = rsiValleys.filter(rv =>
        Math.abs(rv.index - currPriceValley.index) <= 2
      );

      const prevRsiValleys = rsiValleys.filter(rv =>
        Math.abs(rv.index - prevPriceValley.index) <= 2
      );

      if (correspondingRsiValleys.length > 0 && prevRsiValleys.length > 0) {
        const currRsiValley = correspondingRsiValleys[0];
        const prevRsiValley = prevRsiValleys[0];

        // Divergencia alcista: precio más bajo pero RSI más alto
        if (currPriceValley.value < prevPriceValley.value &&
            currRsiValley.value > prevRsiValley.value) {
          divergences.push({
            type: 'bullish',
            strength: this.calculateDivergenceStrength(
              prevPriceValley, currPriceValley,
              prevRsiValley, currRsiValley
            ),
            pricePoints: [prevPriceValley, currPriceValley],
            rsiPoints: [prevRsiValley, currRsiValley],
            confirmation: rsiValues[rsiValues.length - 1] > this.config.rsi.oversold
          });
        }
      }
    }

    // Detectar divergencias bajistas (precio sube, RSI baja)
    for (let i = 1; i < pricePeaks.length; i++) {
      const prevPricePeak = pricePeaks[i - 1];
      const currPricePeak = pricePeaks[i];

      if (currPricePeak.index - prevPricePeak.index < minPeriod) continue;

      const correspondingRsiPeaks = rsiPeaks.filter(rp =>
        Math.abs(rp.index - currPricePeak.index) <= 2
      );

      const prevRsiPeaks = rsiPeaks.filter(rp =>
        Math.abs(rp.index - prevPricePeak.index) <= 2
      );

      if (correspondingRsiPeaks.length > 0 && prevRsiPeaks.length > 0) {
        const currRsiPeak = correspondingRsiPeaks[0];
        const prevRsiPeak = prevRsiPeaks[0];

        // Divergencia bajista: precio más alto pero RSI más bajo
        if (currPricePeak.value > prevPricePeak.value &&
            currRsiPeak.value < prevRsiPeak.value) {
          divergences.push({
            type: 'bearish',
            strength: this.calculateDivergenceStrength(
              prevPricePeak, currPricePeak,
              prevRsiPeak, currRsiPeak
            ),
            pricePoints: [prevPricePeak, currPricePeak],
            rsiPoints: [prevRsiPeak, currRsiPeak],
            confirmation: rsiValues[rsiValues.length - 1] < this.config.rsi.overbought
          });
        }
      }
    }

    return divergences;
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

  // ================== DETECCIÓN DE PATRONES ==================

  detectChartPatterns(prices, highs, lows, volume = null) {
    const patterns = [];

    // Triángulos
    const triangles = this.detectTriangles(highs, lows);
    patterns.push(...triangles);

    // Doble techo/suelo
    const doubles = this.detectDoubleTopBottom(highs, lows);
    patterns.push(...doubles);

    // Hombro-cabeza-hombro
    const hcs = this.detectHeadAndShoulders(highs, lows);
    patterns.push(...hcs);

    // Canales y banderas
    const channels = this.detectChannelsAndFlags(prices, highs, lows);
    patterns.push(...channels);

    return patterns.map(pattern => ({
      ...pattern,
      confidence: this.calculatePatternConfidence(pattern, volume),
      breakoutTarget: this.calculateBreakoutTarget(pattern),
      timeframe: this.determinePatternTimeframe(pattern)
    }));
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
        summary: null
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

  // Mock data para testing (reemplazar con datos reales de Binance)
  async getMarketData(symbol, timeframe, periods) {
    // Simular datos para testing
    const mockData = [];
    let basePrice = 50000; // Precio base para BTC

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
        timestamp: Date.now() - (periods - i) * 3600000 // 1 hora por período
      });
    }

    return mockData;
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