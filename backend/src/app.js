/**
 * CRYPTOTRADING AI ADVISOR - SERVIDOR PRINCIPAL
 * Sistema de asesoría inteligente para trading de futuros
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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
const { router: multiTelegramRoutes } = require('./routes/multiTelegram');
const liquidationRoutes = require('./routes/liquidations');

// Loading averaging routes with error handling
let averagingRoutes;
try {
  averagingRoutes = require('./routes/averaging');
  console.log('✅ Averaging routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading averaging routes:', error.message);
  averagingRoutes = null;
}

// Inicializar aplicación
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",  // Puerto por defecto de Vite
      "http://localhost:3001",  // Puerto del backend
      "http://localhost:3002",  // Puerto alternativo
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
      "http://localhost:5173",  // Puerto alternativo de Vite
      "http://127.0.0.1:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});
const PORT = process.env.PORT || 3001;

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001", 
    "http://localhost:3002",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:5173"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
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

// Rutas de múltiples bots de Telegram
app.use('/api/multi-telegram', multiTelegramRoutes);

// Rutas de análisis de liquidaciones y mapas de calor
app.use('/api/liquidations', liquidationRoutes);

// Rutas de sistema de promediación profesional se registran antes del catch-all

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
// RUTAS DE PROMEDIACIÓN PROFESIONAL
// ================================

// Rutas de sistema de promediación profesional
if (averagingRoutes) {
  app.use('/api/averaging', averagingRoutes);
  console.log('✅ Averaging routes enabled at /api/averaging');
} else {
  console.log('⚠️ Averaging routes disabled due to loading error');
}

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
      'GET /api/averaging/analyze/:symbol',
      'GET /api/averaging/strategies',
      'POST /api/averaging/simulate',
      'GET /api/averaging/position/:symbol',
      'GET /api/averaging/risk-assessment/:symbol',
      'GET /api/liquidations/analysis/:symbol',
      'GET /api/liquidations/heatmap/:symbol',
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

    // Inicializar Binance Service (modo seguro sin APIs)
    try {
      const binanceResult = await binanceService.initialize();
      if (!binanceResult.success) {
        logger.warn(`Binance service failed to initialize: ${binanceResult.error}`);
        logger.warn('Continuing without Binance service...');
      }
    } catch (error) {
      logger.warn('Binance service initialization failed, continuing without it:', error.message);
    }

    // Inicializar Market Data Service (modo seguro)
    try {
      const marketResult = await marketDataService.initialize();
      if (!marketResult.success) {
        logger.warn(`MarketData service failed to initialize: ${marketResult.error}`);
        logger.warn('Continuing without MarketData service...');
      }
    } catch (error) {
      logger.warn('MarketData service initialization failed, continuing without it:', error.message);
    }

    logger.info('Services initialization completed (some may have failed)');
    return true; // Siempre retornar true para que el servidor funcione

  } catch (error) {
    logger.error('Critical error during services initialization', { error: error.message });
    logger.warn('Server will continue with limited functionality');
    return true; // Permitir que el servidor funcione aunque fallen los servicios
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected to WebSocket', {
    socketId: socket.id,
    transport: socket.conn.transport.name,
    remoteAddress: socket.conn.remoteAddress
  });

  // Subscribe to price updates
  socket.on('subscribe-prices', (symbols) => {
    logger.info('Client subscribed to price updates', { socketId: socket.id, symbols });
    socket.join('price-updates');
    // Send confirmation
    socket.emit('subscribed', { type: 'prices', symbols });
  });

  // Subscribe to signals
  socket.on('subscribe-signals', () => {
    logger.info('Client subscribed to signals', { socketId: socket.id });
    socket.join('signal-updates');
    // Send confirmation
    socket.emit('subscribed', { type: 'signals' });
  });

  socket.on('disconnect', (reason) => {
    logger.info('Client disconnected from WebSocket', {
      socketId: socket.id,
      reason
    });
  });

  socket.on('error', (error) => {
    logger.error('Socket.IO error', {
      socketId: socket.id,
      error: error.message
    });
  });

  // Send initial connection confirmation
  socket.emit('connected', {
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
});

// Make io available globally for other services
app.set('io', io);

// Función para intentar iniciar el servidor con manejo de puerto ocupado
const startServer = (port) => {
  server.listen(port, async () => {
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

   💰 AVERAGING SYSTEM:
   GET  /api/averaging/analyze/:symbol
   GET  /api/averaging/strategies
   POST /api/averaging/simulate
   GET  /api/averaging/position/:symbol
   GET  /api/averaging/risk-assessment/:symbol

   🔧 SYSTEM:
   GET  /api/health
   GET  /api/config
   GET  /api/market/health
    `);

    // Emitir datos de precios en tiempo real a través de Socket.IO
    try {
      // Suscribirse a actualizaciones de Binance y emitir por Socket.IO
      binanceService.subscribe((symbol, priceData) => {
        try {
          io.to('price-updates').emit('priceUpdate', {
            symbol: priceData.symbol,
            price: priceData.price,
            changePercent24h: priceData.change24h,
            volume24h: priceData.volume,
            timestamp: priceData.timestamp
          });
        } catch (emitErr) {
          logger.warn('Error emitting priceUpdate', { error: emitErr.message });
        }
      });

      // Emisión periódica de snapshots en bloque (bulk)
      setInterval(() => {
        try {
          const snapshot = binanceService.getAllPrices();
          if (snapshot && snapshot.success && snapshot.data) {
            const payload = Object.values(snapshot.data).map((d) => ({
              symbol: d.symbol,
              price: d.price,
              changePercent24h: d.change24h,
              volume24h: d.volume,
              timestamp: d.timestamp
            }));
            if (payload.length > 0) {
              io.to('price-updates').emit('bulkPriceUpdate', payload);
            }
          }
        } catch (bulkErr) {
          logger.warn('Error emitting bulkPriceUpdate', { error: bulkErr.message });
        }
      }, 5000); // cada 5s
    } catch (wsSetupErr) {
      logger.warn('Failed to set up real-time Socket.IO emissions', { error: wsSetupErr.message });
    }
  } else {
    console.log(`
⚠️  ADVERTENCIA: Algunos servicios fallaron en la inicialización
   El servidor está corriendo pero con funcionalidad limitada
   Revisar logs para más detalles
    `);
  }

  logger.info('Server started', {
    port: port,
    environment: process.env.NODE_ENV,
    riskConfig: riskManager.config,
    servicesInitialized
  });
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Puerto ${port} ocupado, intentando puerto ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Error al iniciar servidor:', err);
      process.exit(1);
    }
  });
};

// Iniciar el servidor
startServer(PORT);

// Manejo elegante de cierre
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Cerrar servicios
  await binanceService.close();
  await marketDataService.close();

  // Cerrar Socket.IO
  io.close();

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

  // Cerrar Socket.IO
  io.close();

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;