const express = require('express');
const TechnicalAnalysisService = require('../services/technicalAnalysisService');
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

const router = express.Router();
const analysisService = new TechnicalAnalysisService();

// Middleware para validar símbolo
const validateSymbol = (req, res, next) => {
  const { symbol } = req.params;

  if (!symbol || symbol.length < 3) {
    return res.status(400).json({
      error: 'Símbolo inválido',
      message: 'El símbolo debe tener al menos 3 caracteres'
    });
  }

  // Normalizar símbolo (uppercase, añadir USDT si no tiene par)
  req.params.symbol = symbol.toUpperCase();
  if (!req.params.symbol.includes('USDT') && !req.params.symbol.includes('BTC')) {
    req.params.symbol += 'USDT';
  }

  next();
};

// ================== ANÁLISIS COMPLETO ==================

/**
 * GET /api/analysis/:symbol
 * Obtiene análisis técnico completo para un símbolo
 */
router.get('/:symbol', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', periods = 100 } = req.query;

    // Validar parámetros
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        error: 'Timeframe inválido',
        valid: validTimeframes
      });
    }

    const periodsNum = parseInt(periods);
    if (isNaN(periodsNum) || periodsNum < 50 || periodsNum > 1000) {
      return res.status(400).json({
        error: 'Períodos inválidos',
        message: 'Debe ser un número entre 50 y 1000'
      });
    }

    logger.info(`Iniciando análisis técnico`, { symbol, timeframe, periods: periodsNum });

    const analysis = await analysisService.analyzeSymbol(symbol, timeframe, periodsNum);

    res.json({
      success: true,
      data: analysis,
      meta: {
        endpoint: 'technical_analysis',
        timestamp: new Date(),
        processingTime: Date.now() - req.startTime
      }
    });

  } catch (error) {
    logger.error('Error en análisis técnico:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message,
      endpoint: 'technical_analysis'
    });
  }
});

// ================== RSI ESPECÍFICO ==================

/**
 * GET /api/analysis/:symbol/rsi
 * Obtiene análisis RSI específico con divergencias
 */
router.get('/:symbol/rsi', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', period = 14 } = req.query;

    const analysis = await analysisService.analyzeSymbol(symbol, timeframe, 100);

    if (!analysis.rsi || analysis.rsi.length === 0) {
      return res.status(404).json({
        error: 'No hay datos RSI disponibles',
        symbol
      });
    }

    const currentRSI = analysis.rsi[analysis.rsi.length - 1];
    const rsiConfig = analysisService.config.rsi;

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        current: {
          value: currentRSI,
          status: currentRSI > rsiConfig.overbought ? 'overbought' :
                  currentRSI < rsiConfig.oversold ? 'oversold' : 'neutral',
          signal: currentRSI > rsiConfig.overbought ? 'sell' :
                  currentRSI < rsiConfig.oversold ? 'buy' : 'hold'
        },
        divergences: analysis.rsiDivergences || [],
        historical: analysis.rsi.slice(-20), // Últimos 20 valores
        config: rsiConfig
      }
    });

  } catch (error) {
    logger.error('Error en análisis RSI:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// ================== SOPORTES Y RESISTENCIAS ==================

/**
 * GET /api/analysis/:symbol/levels
 * Obtiene niveles de soporte y resistencia
 */
router.get('/:symbol/levels', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h' } = req.query;

    const analysis = await analysisService.analyzeSymbol(symbol, timeframe, 100);

    if (!analysis.supportResistance) {
      return res.status(404).json({
        error: 'No hay datos de S/R disponibles',
        symbol
      });
    }

    const sr = analysis.supportResistance;

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        dynamicLevels: sr.dynamicLevels.map(level => ({
          price: level.price,
          type: level.type,
          strength: level.strength,
          confidence: level.confidence,
          touches: level.touches,
          status: level.broken ? 'broken' : 'active',
          distance: `${((level.price - analysis.summary?.currentPrice || 0) / (analysis.summary?.currentPrice || 1) * 100).toFixed(2)}%`
        })),
        psychologicalLevels: sr.psychologicalLevels,
        recommendation: sr.recommendation,
        summary: {
          totalLevels: sr.dynamicLevels.length,
          strongLevels: sr.dynamicLevels.filter(l => l.strength > 70).length,
          nearbyLevels: sr.dynamicLevels.filter(l => {
            const distance = Math.abs(l.price - (analysis.summary?.currentPrice || 0)) / (analysis.summary?.currentPrice || 1);
            return distance < 0.02;
          }).length
        }
      }
    });

  } catch (error) {
    logger.error('Error en análisis S/R:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// ================== FIBONACCI ==================

/**
 * GET /api/analysis/:symbol/fibonacci
 * Obtiene niveles de Fibonacci
 */
router.get('/:symbol/fibonacci', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h' } = req.query;

    const analysis = await analysisService.analyzeSymbol(symbol, timeframe, 100);

    if (!analysis.fibonacci) {
      return res.status(404).json({
        error: 'No hay datos de Fibonacci disponibles',
        symbol
      });
    }

    const fib = analysis.fibonacci;

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        lastSwing: fib.lastSwing,
        retracements: fib.retracements.slice(0, 10), // Top 10 más cercanos
        extensions: fib.extensions.slice(0, 5), // Top 5 extensiones
        goldenPocket: fib.goldenPocket,
        summary: {
          direction: fib.lastSwing?.direction,
          swingRange: fib.lastSwing ? Math.abs(fib.lastSwing.high - fib.lastSwing.low) : 0,
          keyLevels: fib.retracements.filter(r => [0.382, 0.5, 0.618].includes(r.level))
        }
      }
    });

  } catch (error) {
    logger.error('Error en análisis Fibonacci:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// ================== BBWP ==================

/**
 * GET /api/analysis/:symbol/bbwp
 * Obtiene análisis BBWP (Bollinger Band Width Percentile)
 */
router.get('/:symbol/bbwp', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h' } = req.query;

    const analysis = await analysisService.analyzeSymbol(symbol, timeframe, 300); // Más datos para BBWP

    if (!analysis.bbwp || analysis.bbwp.length === 0) {
      return res.status(404).json({
        error: 'Insuficientes datos para BBWP',
        message: 'Se requieren al menos 252 períodos de datos históricos',
        symbol
      });
    }

    const currentBBWP = analysis.bbwp[analysis.bbwp.length - 1];
    const recentBBWP = analysis.bbwp.slice(-20);

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        current: {
          value: currentBBWP.value,
          interpretation: currentBBWP.interpretation,
          squeeze: currentBBWP.squeeze,
          expansion: currentBBWP.expansion,
          signal: currentBBWP.interpretation.signal
        },
        recent: recentBBWP,
        statistics: {
          average: recentBBWP.reduce((sum, b) => sum + b.value, 0) / recentBBWP.length,
          min: Math.min(...recentBBWP.map(b => b.value)),
          max: Math.max(...recentBBWP.map(b => b.value)),
          squeezePeriods: recentBBWP.filter(b => b.squeeze).length
        },
        recommendation: {
          action: currentBBWP.squeeze ? 'prepare_for_breakout' : 'monitor_volatility',
          confidence: currentBBWP.squeeze ? 'high' : 'medium',
          timeframe: currentBBWP.squeeze ? 'short_term' : 'medium_term'
        }
      }
    });

  } catch (error) {
    logger.error('Error en análisis BBWP:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// ================== PATRONES CHARTISTAS ==================

/**
 * GET /api/analysis/:symbol/patterns
 * Obtiene patrones chartistas detectados
 */
router.get('/:symbol/patterns', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h' } = req.query;

    const analysis = await analysisService.analyzeSymbol(symbol, timeframe, 150);

    const patterns = analysis.patterns || [];
    const activePatterns = patterns.filter(p => p.confidence > 50);

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        patterns: activePatterns,
        summary: {
          total: patterns.length,
          active: activePatterns.length,
          highConfidence: patterns.filter(p => p.confidence > 80).length,
          types: [...new Set(patterns.map(p => p.type))]
        },
        recommendations: activePatterns.map(pattern => ({
          pattern: pattern.type,
          subtype: pattern.subtype,
          confidence: pattern.confidence,
          action: pattern.breakoutTarget ? 'wait_for_breakout' : 'monitor',
          targets: pattern.breakoutTarget
        }))
      }
    });

  } catch (error) {
    logger.error('Error en análisis de patrones:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// ================== CONFLUENCIA Y SEÑALES ==================

/**
 * GET /api/analysis/:symbol/confluence
 * Obtiene análisis de confluencia y puntuación total
 */
router.get('/:symbol/confluence', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h' } = req.query;

    const analysis = await analysisService.analyzeSymbol(symbol, timeframe, 150);

    const summary = analysis.summary;

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        confluenceScore: summary.confluenceScore,
        recommendation: summary.recommendation,
        riskLevel: summary.riskLevel,
        signals: summary.signals,
        keyLevels: summary.keyLevels,
        breakdown: {
          technical: {
            rsi: analysis.rsi ? analysis.rsi[analysis.rsi.length - 1] : null,
            divergences: analysis.rsiDivergences?.length || 0,
            nearbyLevels: summary.keyLevels.length,
            patterns: analysis.patterns.length
          },
          sentiment: {
            bbwp: analysis.bbwp?.[analysis.bbwp.length - 1]?.interpretation?.status || 'unknown',
            volatility: analysis.bbwp?.[analysis.bbwp.length - 1]?.interpretation?.signal || 'neutral'
          }
        },
        trading: {
          action: summary.confluenceScore > 75 ? 'strong_buy' :
                  summary.confluenceScore > 60 ? 'buy' :
                  summary.confluenceScore < 25 ? 'strong_sell' :
                  summary.confluenceScore < 40 ? 'sell' : 'hold',
          confidence: summary.confluenceScore > 80 ? 'very_high' :
                     summary.confluenceScore > 60 ? 'high' :
                     summary.confluenceScore > 40 ? 'medium' : 'low',
          timeframe: 'short_to_medium_term'
        }
      }
    });

  } catch (error) {
    logger.error('Error en análisis de confluencia:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// ================== UTILIDADES ==================

/**
 * GET /api/analysis/health
 * Estado del servicio de análisis técnico
 */
router.get('/health', (req, res) => {
  try {
    const health = analysisService.getHealthStatus();

    res.json({
      success: true,
      data: health,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error en health check',
      message: error.message
    });
  }
});

/**
 * DELETE /api/analysis/cache
 * Limpiar cache del servicio
 */
router.delete('/cache', (req, res) => {
  try {
    analysisService.clearCache();

    res.json({
      success: true,
      message: 'Cache limpiado exitosamente',
      timestamp: new Date()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error limpiando cache',
      message: error.message
    });
  }
});

/**
 * GET /api/analysis/config
 * Obtener configuración actual del análisis técnico
 */
router.get('/config', (req, res) => {
  try {
    const config = {
      indicators: analysisService.config,
      timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
      maxPeriods: 1000,
      minPeriods: 50,
      cacheExpiration: analysisService.cacheExpiration / 1000 / 60 // en minutos
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo configuración',
      message: error.message
    });
  }
});

// Middleware para tiempo de procesamiento
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

module.exports = router;