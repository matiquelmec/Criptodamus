/**
 * CRYPTOTRADING AI ADVISOR - SERVIDOR PRINCIPAL
 * Sistema de asesoría inteligente para trading de futuros
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { logger, riskLogger } = require('./utils/logger');
const RiskManager = require('./services/riskManager');
const BinanceService = require('./services/binanceService');
const MarketDataService = require('./services/marketDataService');

// Importar rutas
const marketRoutes = require('./routes/market');
const analysisRoutes = require('./routes/analysis');
const signalRoutes = require('./routes/signals');
const notificationRoutes = require('./routes/notifications');

// Inicializar aplicación
const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de seguridad
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Inicializar servicios
const riskManager = new RiskManager({
  maxRiskPerTrade: parseFloat(process.env.DEFAULT_MAX_RISK_PER_TRADE) || 2,
  maxLeverage: parseInt(process.env.DEFAULT_MAX_LEVERAGE) || 20,
  minRiskReward: parseFloat(process.env.DEFAULT_MIN_RR_RATIO) || 2,
  maxConsecutiveLosses: parseInt(process.env.MAX_CONSECUTIVE_LOSSES) || 3,
  emergencyStopPercent: parseFloat(process.env.EMERGENCY_STOP_PERCENT) || 20
});

const binanceService = new BinanceService({
  testnet: process.env.NODE_ENV === 'development',
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY
});

const marketDataService = new MarketDataService(binanceService, {
  cmcApiKey: process.env.CMC_API_KEY,
  updateInterval: parseInt(process.env.ANALYSIS_INTERVAL) / 60000 || 5 // Convertir ms a minutos
});

// Hacer servicios disponibles globalmente en la app
app.locals.riskManager = riskManager;
app.locals.binanceService = binanceService;
app.locals.marketDataService = marketDataService;

// Log configuración inicial
riskLogger.logSystemConfig({
  maxRiskPerTrade: riskManager.config.maxRiskPerTrade,
  maxLeverage: riskManager.config.maxLeverage,
  minRiskReward: riskManager.config.minRiskReward,
  environment: process.env.NODE_ENV
});

// ================================
// CONFIGURAR RUTAS
// ================================

// Rutas de market data
app.use('/api/market', marketRoutes);

// Rutas de análisis técnico
app.use('/api/analysis', analysisRoutes);

// Rutas de generación de señales
app.use('/api/signals', signalRoutes);

// Rutas de notificaciones
app.use('/api/notifications', notificationRoutes);

// ================================
// RUTAS DE RISK MANAGEMENT
// ================================

/**
 * POST /api/risk/calculate-position
 * Calcula el tamaño de posición óptimo
 */
app.post('/api/risk/calculate-position', async (req, res) => {
  try {
    const { accountBalance, entryPrice, stopLossPrice, riskPercent, leverage } = req.body;

    // Validar parámetros requeridos
    if (!accountBalance || !entryPrice || !stopLossPrice) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: accountBalance, entryPrice, stopLossPrice'
      });
    }

    const result = riskManager.calculatePositionSize(
      accountBalance,
      entryPrice,
      stopLossPrice,
      riskPercent,
      leverage
    );

    // Log la decisión
    riskLogger.logPositionCalculation({
      accountBalance,
      entryPrice,
      stopLossPrice,
      leverage: leverage || 10,
      result: result
    });

    res.json(result);

  } catch (error) {
    riskLogger.logCriticalError(error, { endpoint: '/api/risk/calculate-position', body: req.body });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/risk/calculate-take-profit
 * Calcula el precio de Take Profit
 */
app.post('/api/risk/calculate-take-profit', async (req, res) => {
  try {
    const { entryPrice, stopLossPrice, riskRewardRatio } = req.body;

    if (!entryPrice || !stopLossPrice) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: entryPrice, stopLossPrice'
      });
    }

    const result = riskManager.calculateTakeProfit(entryPrice, stopLossPrice, riskRewardRatio);

    res.json(result);

  } catch (error) {
    riskLogger.logCriticalError(error, { endpoint: '/api/risk/calculate-take-profit', body: req.body });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/risk/validate-stop-loss
 * Valida la ubicación del Stop Loss
 */
app.post('/api/risk/validate-stop-loss', async (req, res) => {
  try {
    const { entryPrice, stopLossPrice, supportLevel, resistanceLevel } = req.body;

    if (!entryPrice || !stopLossPrice) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: entryPrice, stopLossPrice'
      });
    }

    const result = riskManager.validateStopLoss(entryPrice, stopLossPrice, supportLevel, resistanceLevel);

    // Log la validación
    riskLogger.logStopLossValidation({
      entryPrice,
      stopLossPrice,
      isValid: result.data?.isValid,
      warnings: result.data?.validations?.filter(v => v.status === 'warning')
    });

    res.json(result);

  } catch (error) {
    riskLogger.logCriticalError(error, { endpoint: '/api/risk/validate-stop-loss', body: req.body });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/risk/check-breakeven
 * Verifica si se debe mover el SL a breakeven
 */
app.post('/api/risk/check-breakeven', async (req, res) => {
  try {
    const { entryPrice, currentPrice, currentStopLoss, profitThreshold } = req.body;

    if (!entryPrice || !currentPrice || !currentStopLoss) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: entryPrice, currentPrice, currentStopLoss'
      });
    }

    const result = riskManager.moveStopToBreakeven(entryPrice, currentPrice, currentStopLoss, profitThreshold);

    // Log si se activa protección
    if (result.action === 'move_to_breakeven') {
      riskLogger.logBreakevenProtection({
        entryPrice,
        currentPrice,
        oldStopLoss: currentStopLoss,
        newStopLoss: result.data.newStopLoss,
        profitPercent: result.data.currentProfitPercent
      });
    }

    res.json(result);

  } catch (error) {
    riskLogger.logCriticalError(error, { endpoint: '/api/risk/check-breakeven', body: req.body });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/risk/check-trading-streak
 * Analiza rachas de trading para detectar problemas
 */
app.post('/api/risk/check-trading-streak', async (req, res) => {
  try {
    const { recentTrades, portfolioBalance, initialBalance } = req.body;

    if (!recentTrades || !portfolioBalance || !initialBalance) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: recentTrades, portfolioBalance, initialBalance'
      });
    }

    const result = riskManager.checkTradingStreak(recentTrades, portfolioBalance, initialBalance);

    // Log resultado del análisis
    riskLogger.logTradingStreak(result.data);

    res.json(result);

  } catch (error) {
    riskLogger.logCriticalError(error, { endpoint: '/api/risk/check-trading-streak', body: req.body });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// ================================
// RUTAS DE SISTEMA
// ================================

/**
 * GET /api/health
 * Health check del sistema
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    riskManagerConfig: {
      maxRiskPerTrade: riskManager.config.maxRiskPerTrade,
      maxLeverage: riskManager.config.maxLeverage,
      minRiskReward: riskManager.config.minRiskReward
    }
  });
});

/**
 * GET /api/config
 * Obtener configuración actual del sistema
 */
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: {
      riskManagement: riskManager.config,
      environment: process.env.NODE_ENV,
      analysisInterval: process.env.ANALYSIS_INTERVAL,
      topCryptosCount: process.env.TOP_CRYPTOS_COUNT
    }
  });
});

// ================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ================================

// 404 - Ruta no encontrada
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    availableEndpoints: [
      'POST /api/risk/calculate-position',
      'POST /api/risk/calculate-take-profit',
      'POST /api/risk/validate-stop-loss',
      'POST /api/risk/check-breakeven',
      'POST /api/risk/check-trading-streak',
      'GET /api/analysis/:symbol',
      'GET /api/analysis/:symbol/rsi',
      'GET /api/analysis/:symbol/levels',
      'GET /api/analysis/:symbol/fibonacci',
      'GET /api/analysis/:symbol/confluence',
      'POST /api/signals/generate/:symbol',
      'GET /api/signals/quick/:symbol',
      'POST /api/signals/scan',
      'GET /api/signals/scan/top-movers',
      'GET /api/health',
      'GET /api/config'
    ]
  });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  riskLogger.logCriticalError(error, {
    url: req.url,
    method: req.method,
    body: req.body
  });

  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// ================================
// INICIALIZAR SERVICIOS Y SERVIDOR
// ================================

// Función para inicializar todos los servicios
async function initializeServices() {
  try {
    logger.info('Initializing services...');

    // Inicializar Binance Service
    const binanceResult = await binanceService.initialize();
    if (!binanceResult.success) {
      throw new Error(`Failed to initialize Binance: ${binanceResult.error}`);
    }

    // Inicializar Market Data Service
    const marketResult = await marketDataService.initialize();
    if (!marketResult.success) {
      throw new Error(`Failed to initialize MarketData: ${marketResult.error}`);
    }

    logger.info('All services initialized successfully');
    return true;

  } catch (error) {
    logger.error('Failed to initialize services', { error: error.message });
    return false;
  }
}

const server = app.listen(PORT, async () => {
  console.log(`
🚀 CryptoTrading AI Advisor - Trading Server
📍 Puerto: ${PORT}
🌍 Entorno: ${process.env.NODE_ENV || 'development'}
🛡️  Risk Config: ${riskManager.config.maxRiskPerTrade}% max risk, ${riskManager.config.maxLeverage}x max leverage
⏰ Iniciado: ${new Date().toISOString()}

🔄 Inicializando servicios...
  `);

  // Inicializar servicios de forma asíncrona
  const servicesInitialized = await initializeServices();

  if (servicesInitialized) {
    console.log(`
✅ Servicios inicializados correctamente

📋 Endpoints disponibles:

   🛡️  RISK MANAGEMENT:
   POST /api/risk/calculate-position
   POST /api/risk/calculate-take-profit
   POST /api/risk/validate-stop-loss
   POST /api/risk/check-breakeven
   POST /api/risk/check-trading-streak

   📊 MARKET DATA:
   GET  /api/market/prices
   GET  /api/market/price/:symbol
   GET  /api/market/data/:symbol
   GET  /api/market/top/:limit
   GET  /api/market/macro
   GET  /api/market/futures/:symbol
   GET  /api/market/opportunities
   POST /api/market/calculate-with-live-data

   📈 TECHNICAL ANALYSIS:
   GET  /api/analysis/:symbol
   GET  /api/analysis/:symbol/rsi
   GET  /api/analysis/:symbol/levels
   GET  /api/analysis/:symbol/fibonacci
   GET  /api/analysis/:symbol/bbwp
   GET  /api/analysis/:symbol/patterns
   GET  /api/analysis/:symbol/confluence

   🎯 SIGNAL GENERATION:
   POST /api/signals/generate/:symbol
   GET  /api/signals/quick/:symbol
   POST /api/signals/scan
   GET  /api/signals/scan/top-movers
   GET  /api/signals/confluence/:symbol
   GET  /api/signals/stats
   GET  /api/signals/config

   🔔 NOTIFICATIONS:
   POST /api/notifications/test
   POST /api/notifications/signal
   POST /api/notifications/market-alert
   POST /api/notifications/risk-alert
   POST /api/notifications/scan-and-notify
   GET  /api/notifications/health
   GET  /api/notifications/stats

   🔧 SYSTEM:
   GET  /api/health
   GET  /api/config
   GET  /api/market/health
    `);
  } else {
    console.log(`
⚠️  ADVERTENCIA: Algunos servicios fallaron en la inicialización
   El servidor está corriendo pero con funcionalidad limitada
   Revisar logs para más detalles
    `);
  }

  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV,
    riskConfig: riskManager.config,
    servicesInitialized
  });
});

// Manejo elegante de cierre
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Cerrar servicios
  await binanceService.close();
  await marketDataService.close();

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  // Cerrar servicios
  await binanceService.close();
  await marketDataService.close();

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;