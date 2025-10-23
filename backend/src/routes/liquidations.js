/**
 * LIQUIDATIONS ROUTES - API ENDPOINTS PARA MAPAS DE LIQUIDACIONES
 *
 * Endpoints profesionales para análisis de liquidaciones según Memoria Agente PDF
 */

const express = require('express');
const router = express.Router();

// Importar servicios necesarios
const LiquidationMapsService = require('../services/liquidationMapsService');

// Middleware de validación
const validateSymbol = (req, res, next) => {
  const { symbol } = req.params;
  if (!symbol || !/^[A-Z]{3,10}USDT?$/.test(symbol)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid symbol format. Use format like BTCUSDT'
    });
  }
  next();
};

// Inicializar servicio de liquidaciones
let liquidationMapsService;

const initializeLiquidationService = () => {
  if (!liquidationMapsService) {
    liquidationMapsService = new LiquidationMapsService();
  }
  return liquidationMapsService;
};

/**
 * GET /api/liquidations/analysis/:symbol
 * Análisis completo de liquidaciones para un símbolo
 */
router.get('/analysis/:symbol', validateSymbol, async (req, res) => {
  try {
    const service = initializeLiquidationService();
    const { symbol } = req.params;
    const {
      timeframe = '5m',
      includeHeatmap = 'true',
      includeClusters = 'true',
      includeAlerts = 'true'
    } = req.query;

    const options = {
      includeHeatmap: includeHeatmap === 'true',
      includeClusters: includeClusters === 'true',
      includeAlerts: includeAlerts === 'true'
    };

    const result = await service.analyzeLiquidations(symbol, timeframe, options);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: result.data,
      metadata: {
        symbol,
        timeframe,
        timestamp: new Date(),
        cacheable: true,
        validFor: '1 minute'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/liquidations/heatmap/:symbol
 * Mapa de calor específico para un símbolo
 */
router.get('/heatmap/:symbol', validateSymbol, async (req, res) => {
  try {
    const service = initializeLiquidationService();
    const { symbol } = req.params;
    const { timeframe = '5m', resolution = '50' } = req.query;

    const result = await service.analyzeLiquidations(symbol, timeframe, {
      includeHeatmap: true,
      includeClusters: false,
      includeAlerts: false
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: {
        heatmap: result.data.heatmap,
        summary: {
          symbol,
          timeframe,
          maxIntensity: result.data.heatmap?.maxIntensity || 0,
          hotspots: result.data.heatmap?.hotspots || 0,
          resolution: parseInt(resolution)
        }
      },
      metadata: {
        generated: new Date(),
        type: 'liquidation_heatmap'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/liquidations/clusters/:symbol
 * Clusters de liquidaciones específicos
 */
router.get('/clusters/:symbol', validateSymbol, async (req, res) => {
  try {
    const service = initializeLiquidationService();
    const { symbol } = req.params;
    const { timeframe = '5m', minSize = '1000000' } = req.query;

    const result = await service.analyzeLiquidations(symbol, timeframe, {
      includeHeatmap: false,
      includeClusters: true,
      includeAlerts: false
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Filtrar clusters por tamaño mínimo
    const filteredClusters = result.data.clusters?.filter(
      cluster => cluster.totalVolume >= parseInt(minSize)
    ) || [];

    res.json({
      success: true,
      data: {
        clusters: filteredClusters,
        summary: {
          totalClusters: filteredClusters.length,
          totalVolume: filteredClusters.reduce((sum, c) => sum + c.totalVolume, 0),
          highRiskClusters: filteredClusters.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/liquidations/alerts/:symbol
 * Alertas críticas de liquidaciones
 */
router.get('/alerts/:symbol', validateSymbol, async (req, res) => {
  try {
    const service = initializeLiquidationService();
    const { symbol } = req.params;
    const { timeframe = '5m', severity = 'all' } = req.query;

    const result = await service.analyzeLiquidations(symbol, timeframe, {
      includeHeatmap: false,
      includeClusters: false,
      includeAlerts: true
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    let alerts = result.data.alerts || [];

    // Filtrar por severidad si se especifica
    if (severity !== 'all') {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    res.json({
      success: true,
      data: {
        alerts,
        summary: {
          totalAlerts: alerts.length,
          criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
          warningAlerts: alerts.filter(a => a.severity === 'warning').length,
          lastUpdate: new Date()
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/liquidations/risk-levels/:symbol
 * Niveles de riesgo específicos
 */
router.get('/risk-levels/:symbol', validateSymbol, async (req, res) => {
  try {
    const service = initializeLiquidationService();
    const { symbol } = req.params;
    const { timeframe = '5m' } = req.query;

    const result = await service.analyzeLiquidations(symbol, timeframe, {
      includeHeatmap: false,
      includeClusters: false,
      includeAlerts: false
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: {
        riskLevels: result.data.riskLevels,
        predictions: result.data.predictions,
        timestamp: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/liquidations/multi-symbol
 * Análisis de liquidaciones para múltiples símbolos
 */
router.post('/multi-symbol', async (req, res) => {
  try {
    const service = initializeLiquidationService();
    const { symbols, timeframe = '5m', maxSymbols = 10 } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        error: 'Symbols array is required'
      });
    }

    if (symbols.length > maxSymbols) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${maxSymbols} symbols allowed`
      });
    }

    const results = {};
    const summary = {
      processedSymbols: 0,
      totalAlerts: 0,
      highRiskSymbols: 0,
      avgProcessingTime: 0
    };

    const startTime = Date.now();

    for (const symbol of symbols) {
      try {
        const result = await service.analyzeLiquidations(symbol, timeframe, {
          includeHeatmap: false,
          includeClusters: true,
          includeAlerts: true
        });

        if (result.success) {
          results[symbol] = {
            alerts: result.data.alerts?.length || 0,
            clusters: result.data.clusters?.length || 0,
            riskLevel: result.data.riskLevels?.immediate?.level || 'unknown',
            lastUpdate: new Date()
          };

          summary.processedSymbols++;
          summary.totalAlerts += result.data.alerts?.length || 0;
          if (result.data.riskLevels?.immediate?.level === 'high') {
            summary.highRiskSymbols++;
          }
        }
      } catch (error) {
        results[symbol] = {
          error: error.message,
          processed: false
        };
      }
    }

    summary.avgProcessingTime = (Date.now() - startTime) / symbols.length;

    res.json({
      success: true,
      data: results,
      summary,
      metadata: {
        requestedSymbols: symbols.length,
        timeframe,
        timestamp: new Date()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/liquidations/stats
 * Estadísticas generales del servicio de liquidaciones
 */
router.get('/stats', async (req, res) => {
  try {
    const service = initializeLiquidationService();
    const stats = service.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/liquidations/cache
 * Limpiar cache de liquidaciones
 */
router.delete('/cache', async (req, res) => {
  try {
    const service = initializeLiquidationService();
    service.clearCache();

    res.json({
      success: true,
      message: 'Liquidation cache cleared successfully',
      timestamp: new Date()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;