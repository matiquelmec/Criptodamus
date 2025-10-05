/**
 * MARKET DATA ROUTES
 * Endpoints para acceder a datos de mercado en tiempo real
 */

const express = require('express');
const { logger } = require('../utils/logger');

const router = express.Router();

// Middleware para inyectar servicios
router.use((req, res, next) => {
  req.binanceService = req.app.locals.binanceService;
  req.marketDataService = req.app.locals.marketDataService;
  next();
});

/**
 * GET /api/market/price/:symbol
 * Obtener precio actual de un símbolo específico
 */
router.get('/price/:symbol', (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Validar formato del símbolo
    if (!symbol.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Formato de símbolo inválido. Usar formato: BTC/USDT'
      });
    }

    const result = req.binanceService.getCurrentPrice(symbol);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      data: {
        symbol: symbol,
        price: result.data.price,
        bid: result.data.bid,
        ask: result.data.ask,
        change24h: result.data.change24h,
        volume: result.data.volume,
        timestamp: result.data.timestamp,
        age: result.age
      }
    });

  } catch (error) {
    logger.error('Error getting price', { symbol: req.params.symbol, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/market/prices
 * Obtener precios de todos los símbolos monitoreados
 */
router.get('/prices', (req, res) => {
  try {
    const result = req.binanceService.getAllPrices();

    res.json(result);

  } catch (error) {
    logger.error('Error getting all prices', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/market/data/:symbol
 * Obtener datos completos de mercado para un símbolo
 */
router.get('/data/:symbol', (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const result = req.marketDataService.getMarketData(symbol);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);

  } catch (error) {
    logger.error('Error getting market data', { symbol: req.params.symbol, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/market/data
 * Obtener datos de mercado de todos los símbolos
 */
router.get('/data', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const sortBy = req.query.sortBy || 'rank'; // rank, marketCap, volume, change24h

    let result = req.marketDataService.getAllMarketData();

    if (result.success && result.data) {
      // Convertir a array y ordenar
      let dataArray = Object.values(result.data);

      // Ordenar según parámetro
      switch (sortBy) {
        case 'marketCap':
          dataArray = dataArray
            .filter(item => item.marketCap)
            .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
          break;
        case 'volume':
          dataArray = dataArray
            .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
          break;
        case 'change24h':
          dataArray = dataArray
            .sort((a, b) => (b.change24h || 0) - (a.change24h || 0));
          break;
        default: // rank
          dataArray = dataArray
            .filter(item => item.rank)
            .sort((a, b) => (a.rank || 999) - (b.rank || 999));
      }

      // Aplicar límite
      dataArray = dataArray.slice(0, limit);

      result.data = dataArray;
      result.count = dataArray.length;
    }

    res.json(result);

  } catch (error) {
    logger.error('Error getting all market data', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/market/top/:limit?
 * Obtener top cryptos por market cap
 */
router.get('/top/:limit?', (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 20;

    if (limit > 50) {
      return res.status(400).json({
        success: false,
        error: 'Límite máximo: 50 cryptos'
      });
    }

    const result = req.marketDataService.getTopCryptosByMarketCap(limit);

    res.json(result);

  } catch (error) {
    logger.error('Error getting top cryptos', { limit: req.params.limit, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/market/macro
 * Obtener datos macroeconómicos (Fear & Greed, Dominancia BTC, etc.)
 */
router.get('/macro', (req, res) => {
  try {
    const result = req.marketDataService.getMacroData();

    res.json(result);

  } catch (error) {
    logger.error('Error getting macro data', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/market/futures/:symbol
 * Obtener datos específicos de futuros (funding rate, etc.)
 */
router.get('/futures/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const result = await req.binanceService.getFuturesData(symbol);

    res.json(result);

  } catch (error) {
    logger.error('Error getting futures data', { symbol: req.params.symbol, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/market/opportunities
 * Buscar oportunidades de trading basadas en datos macro
 */
router.get('/opportunities', (req, res) => {
  try {
    const result = req.marketDataService.findTradingOpportunities();

    res.json(result);

  } catch (error) {
    logger.error('Error finding trading opportunities', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/market/health
 * Health check de los servicios de datos de mercado
 */
router.get('/health', (req, res) => {
  try {
    const binanceHealth = req.binanceService.healthCheck();
    const marketDataHealth = req.marketDataService.getHealthStatus();

    const overallHealth = binanceHealth.healthy && marketDataHealth.healthy;

    res.json({
      success: true,
      healthy: overallHealth,
      services: {
        binance: binanceHealth,
        marketData: marketDataHealth
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error checking market services health', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/market/calculate-with-live-data
 * Calcular posición usando datos de mercado en tiempo real
 */
router.post('/calculate-with-live-data', (req, res) => {
  try {
    const { symbol, accountBalance, direction, riskPercent, leverage } = req.body;

    // Validaciones
    if (!symbol || !accountBalance || !direction) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: symbol, accountBalance, direction'
      });
    }

    // Obtener precio actual
    const priceResult = req.binanceService.getCurrentPrice(symbol.toUpperCase());

    if (!priceResult.success) {
      return res.status(404).json({
        success: false,
        error: `No se pudo obtener precio para ${symbol}: ${priceResult.error}`
      });
    }

    const currentPrice = priceResult.data.price;

    // Calcular Stop Loss sugerido (ejemplo: 2% para LONG, -2% para SHORT)
    const stopLossPercent = 2;
    const stopLossPrice = direction.toUpperCase() === 'LONG'
      ? currentPrice * (1 - stopLossPercent / 100)
      : currentPrice * (1 + stopLossPercent / 100);

    // Usar Risk Manager para calcular posición
    const riskManager = req.app.locals.riskManager;
    const positionResult = riskManager.calculatePositionSize(
      accountBalance,
      currentPrice,
      stopLossPrice,
      riskPercent,
      leverage
    );

    if (!positionResult.success) {
      return res.status(400).json(positionResult);
    }

    // Calcular Take Profit
    const takeProfitResult = riskManager.calculateTakeProfit(
      currentPrice,
      stopLossPrice,
      2 // R/R 2:1
    );

    // Respuesta completa
    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        marketData: {
          currentPrice: currentPrice,
          bid: priceResult.data.bid,
          ask: priceResult.data.ask,
          change24h: priceResult.data.change24h,
          volume: priceResult.data.volume,
          dataAge: priceResult.age
        },
        position: positionResult.data,
        takeProfit: takeProfitResult.success ? takeProfitResult.data : null,
        recommendation: {
          entryPrice: currentPrice,
          stopLoss: stopLossPrice,
          takeProfit: takeProfitResult.success ? takeProfitResult.data.takeProfitPrice : null,
          direction: direction.toUpperCase(),
          confidence: priceResult.age < 5000 ? 'HIGH' : 'MEDIUM' // Confidence basada en edad de datos
        }
      }
    });

  } catch (error) {
    logger.error('Error calculating position with live data', {
      body: req.body,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;