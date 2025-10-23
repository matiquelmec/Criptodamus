const express = require('express');
const SignalGeneratorService = require('../services/signalGeneratorService');

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
const signalGenerator = new SignalGeneratorService({
  marketDataService: null // Se inicializará dinámicamente
});

// Middleware para inyectar marketDataService
const injectMarketDataService = (req, res, next) => {
  if (req.app.locals.marketDataService) {
    signalGenerator.technicalAnalysis.marketDataService = req.app.locals.marketDataService;
  }
  next();
};

// Middleware para validar símbolo
const validateSymbol = (req, res, next) => {
  const { symbol } = req.params;

  if (!symbol || symbol.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Símbolo inválido',
      message: 'El símbolo debe tener al menos 3 caracteres'
    });
  }

  // Normalizar símbolo
  req.params.symbol = symbol.toUpperCase();
  if (!req.params.symbol.includes('USDT') && !req.params.symbol.includes('BTC')) {
    req.params.symbol += 'USDT';
  }

  next();
};

// Middleware para validar balance
const validateBalance = (req, res, next) => {
  if (req.body.accountBalance) {
    const balance = parseFloat(req.body.accountBalance);
    if (isNaN(balance) || balance <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Balance inválido',
        message: 'El balance debe ser un número positivo'
      });
    }
    req.body.accountBalance = balance;
  }
  next();
};

// ================== GENERACIÓN DE SEÑALES ==================

/**
 * POST /api/signals/generate/:symbol
 * Genera una señal de trading para un símbolo específico
 */
router.post('/generate/:symbol', injectMarketDataService, validateSymbol, validateBalance, async (req, res) => {
  try {
    const { symbol } = req.params;
    const {
      timeframe = '4h',
      accountBalance = 10000,
      forceRefresh = false
    } = req.body;

    // Validar timeframe
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: 'Timeframe inválido',
        validTimeframes
      });
    }

    logger.info(`Generando señal`, { symbol, timeframe, accountBalance });

    const signal = await signalGenerator.generateSignal(symbol, {
      timeframe,
      accountBalance,
      forceRefresh
    });

    res.json({
      success: true,
      data: signal,
      meta: {
        endpoint: 'generate_signal',
        timestamp: new Date(),
        processingTime: Date.now() - req.startTime
      }
    });

  } catch (error) {
    logger.error('Error generando señal:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      endpoint: 'generate_signal'
    });
  }
});

/**
 * GET /api/signals/quick/:symbol
 * Genera una señal rápida con configuración por defecto
 */
router.get('/quick/:symbol', injectMarketDataService, validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { balance = 10000 } = req.query;

    const signal = await signalGenerator.generateSignal(symbol, {
      accountBalance: parseFloat(balance),
      timeframe: '4h'
    });

    // Respuesta simplificada
    const response = {
      symbol,
      direction: signal.direction || 'neutral',
      recommendation: signal.recommendation || 'WAIT',
      confluenceScore: signal.confluenceScore || 0,
      confidence: signal.confidence || 'low',
      timestamp: signal.timestamp
    };

    if (signal.success && signal.type === 'VALID_SIGNAL') {
      response.levels = {
        entry: signal.entry,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        riskReward: signal.riskReward
      };
      response.positionSize = signal.positionSize;
    }

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('Error en señal rápida:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// ================== ESCANEO MÚLTIPLE ==================

/**
 * POST /api/signals/scan
 * Escanea múltiples símbolos en busca de señales válidas
 */
router.post('/scan', injectMarketDataService, validateBalance, async (req, res) => {
  try {
    const {
      symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT'],
      timeframe = '4h',
      accountBalance = 10000,
      minConfluenceScore = 30  // CRÍTICO: Reducido de 75 a 30 para detectar movimientos
    } = req.body;

    // Validar símbolos
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lista de símbolos inválida',
        message: 'Debe proporcionar un array de símbolos válidos'
      });
    }

    if (symbols.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Demasiados símbolos',
        message: 'Máximo 50 símbolos por escaneo'
      });
    }

    // Normalizar símbolos
    const normalizedSymbols = symbols.map(s => {
      const symbol = s.toUpperCase();
      return symbol.includes('USDT') || symbol.includes('BTC') ? symbol : symbol + 'USDT';
    });

    logger.info(`Iniciando escaneo múltiple`, {
      symbolCount: normalizedSymbols.length,
      timeframe,
      minConfluenceScore
    });

    // Configurar temporalmente el threshold mínimo
    const originalMinScore = signalGenerator.config.minConfluenceScore;
    signalGenerator.config.minConfluenceScore = minConfluenceScore;

    const scanResult = await signalGenerator.scanMultipleSymbols(normalizedSymbols, {
      timeframe,
      accountBalance
    });

    // Restaurar configuración original
    signalGenerator.config.minConfluenceScore = originalMinScore;

    res.json({
      success: true,
      data: scanResult,
      meta: {
        endpoint: 'scan_multiple',
        timestamp: new Date(),
        processingTime: Date.now() - req.startTime
      }
    });

  } catch (error) {
    logger.error('Error en escaneo múltiple:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      endpoint: 'scan_multiple'
    });
  }
});

/**
 * GET /api/signals/scan/top-movers
 * Escanea las principales criptomonedas en busca de señales
 */
router.get('/scan/top-movers', injectMarketDataService, async (req, res) => {
  try {
    const {
      limit = 20,
      timeframe = '5m', // CAMBIO CRÍTICO: Default 5min para SCALPING
      balance = 10000
    } = req.query;

    // Top 50 cryptos por market cap (en un entorno real, obtener de API)
    const topSymbols = [
      // Top 10
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
      'SOLUSDT', 'DOTUSDT', 'LTCUSDT', 'LINKUSDT', 'POLUSDT',

      // Top 11-20
      'AVAXUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT', 'AAVEUSDT',
      'FILUSDT', 'FTMUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT',

      // Top 21-30
      'DOGEUSDT', 'SHIBUSDT', 'TRXUSDT', 'VETUSDT', 'XLMUSDT',
      'ALGOUSDT', 'ICPUSDT', 'EOSUSDT', 'THETAUSDT', 'FLOWUSDT',

      // Top 31-40
      'HBARUSDT', 'EGLDUSDT', 'CHZUSDT', 'ENJUSDT', 'CRVUSDT',
      'MKRUSDT', 'COMPUSDT', 'YFIUSDT', 'SNXUSDT', 'SUIUSDT',

      // Top 41-50
      'APTUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'LDOUSDT',
      'STXUSDT', 'TONUSDT', 'TIAUSDT', 'FETUSDT', 'RNDRUSDT'
    ].slice(0, parseInt(limit));

    const scanResult = await signalGenerator.scanMultipleSymbols(topSymbols, {
      timeframe,
      accountBalance: parseFloat(balance)
    });

    res.json({
      success: true,
      data: {
        ...scanResult,
        topPicks: scanResult.signals.slice(0, 5), // Top 5 señales
        summary: {
          totalScanned: scanResult.stats.symbolsScanned,
          validSignals: scanResult.stats.validSignals,
          avgConfluence: scanResult.stats.averageConfluence?.toFixed(1),
          strongSignals: scanResult.stats.highConfidenceSignals
        }
      }
    });

  } catch (error) {
    logger.error('Error en escaneo top movers:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// ================== ANÁLISIS Y CONFLUENCIA ==================

/**
 * GET /api/signals/confluence/:symbol
 * Obtiene análisis detallado de confluencia para un símbolo
 */
router.get('/confluence/:symbol', injectMarketDataService, validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '4h' } = req.query;

    // Generar señal para obtener análisis de confluencia
    const signal = await signalGenerator.generateSignal(symbol, { timeframe });

    const confluenceData = {
      symbol,
      timeframe,
      timestamp: new Date(),
      confluenceScore: signal.confluenceScore || 0,
      confluenceFactors: signal.confluenceFactors || [],
      recommendation: signal.confidence || 'unknown',
      technicalContext: signal.technicalContext || {},
      alerts: signal.alerts || []
    };

    res.json({
      success: true,
      data: confluenceData
    });

  } catch (error) {
    logger.error('Error en análisis de confluencia:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/signals/backtest/:symbol
 * Análisis retrospectivo de señales (implementación futura)
 */
router.post('/backtest/:symbol', validateSymbol, async (req, res) => {
  try {
    // Implementación futura de backtesting
    res.json({
      success: false,
      message: 'Backtesting no implementado aún',
      plannedFor: 'v1.1'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ================== CONFIGURACIÓN Y GESTIÓN ==================

/**
 * GET /api/signals/config
 * Obtiene la configuración actual del generador de señales
 */
router.get('/config', (req, res) => {
  try {
    const config = signalGenerator.config;

    res.json({
      success: true,
      data: {
        filters: {
          minConfluenceScore: config.minConfluenceScore,
          minRiskReward: config.minRiskReward,
          maxRiskPerTrade: config.maxRiskPerTrade
        },
        technical: {
          rsiOverbought: config.rsiOverbought,
          rsiOversold: config.rsiOversold,
          minPatternConfidence: config.minPatternConfidence,
          minSRStrength: config.minSRStrength
        },
        timeframes: {
          available: config.timeframes,
          primary: config.primaryTimeframe
        },
        features: {
          multiTimeframe: config.enableMultiTimeframe,
          volumeConfirmation: config.enableVolumeConfirmation,
          macroFilter: config.enableMacroFilter
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo configuración',
      message: error.message
    });
  }
});

/**
 * PUT /api/signals/config
 * Actualiza la configuración del generador de señales
 */
router.put('/config', async (req, res) => {
  try {
    const {
      minConfluenceScore,
      minRiskReward,
      maxRiskPerTrade,
      rsiOverbought,
      rsiOversold,
      primaryTimeframe
    } = req.body;

    const updates = {};

    // Validar y actualizar parámetros
    if (minConfluenceScore !== undefined) {
      if (minConfluenceScore < 0 || minConfluenceScore > 100) {
        return res.status(400).json({
          success: false,
          error: 'minConfluenceScore debe estar entre 0 y 100'
        });
      }
      updates.minConfluenceScore = minConfluenceScore;
    }

    if (minRiskReward !== undefined) {
      if (minRiskReward < 1) {
        return res.status(400).json({
          success: false,
          error: 'minRiskReward debe ser mayor a 1'
        });
      }
      updates.minRiskReward = minRiskReward;
    }

    if (maxRiskPerTrade !== undefined) {
      if (maxRiskPerTrade < 0.5 || maxRiskPerTrade > 10) {
        return res.status(400).json({
          success: false,
          error: 'maxRiskPerTrade debe estar entre 0.5% y 10%'
        });
      }
      updates.maxRiskPerTrade = maxRiskPerTrade;
    }

    if (primaryTimeframe !== undefined) {
      const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
      if (!validTimeframes.includes(primaryTimeframe)) {
        return res.status(400).json({
          success: false,
          error: 'Timeframe inválido',
          validTimeframes
        });
      }
      updates.primaryTimeframe = primaryTimeframe;
    }

    // Aplicar actualizaciones
    signalGenerator.updateConfig(updates);

    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      updates,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error actualizando configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/signals/stats
 * Obtiene estadísticas del generador de señales
 */
router.get('/stats', (req, res) => {
  try {
    const stats = signalGenerator.getStats();

    res.json({
      success: true,
      data: {
        performance: {
          signalsGenerated: stats.signalsGenerated,
          signalsFiltered: stats.signalsFiltered,
          successRate: stats.signalsGenerated > 0
            ? ((stats.signalsGenerated - stats.signalsFiltered) / stats.signalsGenerated * 100).toFixed(1)
            : 0
        },
        distribution: {
          signalTypes: stats.signalTypes,
          confluenceDistribution: stats.confluenceDistribution
        },
        system: {
          cacheSize: stats.cacheSize,
          uptime: stats.uptime
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      message: error.message
    });
  }
});

/**
 * GET /api/signals/health
 * Estado del servicio de generación de señales
 */
router.get('/health', (req, res) => {
  try {
    const health = signalGenerator.getHealthStatus();

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
 * DELETE /api/signals/cache
 * Limpia el cache del generador de señales
 */
router.delete('/cache', (req, res) => {
  try {
    signalGenerator.clearCache();

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

// Middleware para tiempo de procesamiento
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

module.exports = router;