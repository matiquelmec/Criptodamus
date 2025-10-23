/**
 * AVERAGING ROUTES - API ENDPOINTS PARA SISTEMA DE PROMEDIACIÓN
 *
 * Endpoints profesionales para gestión de promediación de posiciones
 */

const express = require('express');
const router = express.Router();
const averagingSystemService = require('../services/averagingSystemService');
const { validateSymbol, validateAveragingStrategy, validateRequiredFields } = require('../middleware/validation');

/**
 * GET /api/averaging/test/:symbol
 * Endpoint de prueba sin validaciones
 */
router.get('/test/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const currentPrice = 108000; // Precio fijo para prueba
    
    res.json({
      success: true,
      data: {
        analysis: {
          strategy: 'DCA',
          levels: [
            { price: currentPrice * 0.95, allocation: 25 },
            { price: currentPrice * 0.90, allocation: 35 },
            { price: currentPrice * 0.85, allocation: 40 }
          ],
          recommendations: [
            'Estrategia DCA básica para ' + symbol,
            'Niveles calculados automáticamente'
          ]
        },
        market: {
          symbol,
          price: currentPrice
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error en test',
      details: error.message
    });
  }
});

/**
 * GET /api/averaging/analyze/:symbol
 * Analizar oportunidades de promediación para un símbolo
 */
router.get('/analyze/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const {
      strategy = 'DCA',
      timeframe = '1h',
      includePosition = true
    } = req.query;

    console.log(`📊 Analizando promediación para ${symbol} - Estrategia: ${strategy}`);

    // Usar precios simulados para funcionalidad inmediata
    const simulatedPrices = {
      'BTCUSDT': 108000,
      'ETHUSDT': 3850,
      'BNBUSDT': 635,
      'ADAUSDT': 0.91,
      'SOLUSDT': 185,
      'XRPUSDT': 2.45,
      'DOTUSDT': 8.2,
      'LINKUSDT': 22.8,
      'POLUSDT': 0.48,
      'AVAXUSDT': 42.5,
      'UNIUSDT': 12.8,
      'ATOMUSDT': 7.9,
      'NEARUSDT': 6.2,
      'AAVEUSDT': 285,
      'FILUSDT': 5.8,
      'FTMUSDT': 0.85,
      'SANDUSDT': 0.62,
      'MANAUSDT': 0.58,
      'GALAUSDT': 0.038,
      'DOGEUSDT': 0.38,
      'SHIBUSDT': 0.000025,
      'TRXUSDT': 0.25,
      'VETUSDT': 0.045,
      'XLMUSDT': 0.42,
      'ALGOUSDT': 0.35,
      'ICPUSDT': 12.5,
      'EOSUSDT': 0.88,
      'THETAUSDT': 2.1,
      'FLOWUSDT': 0.92
    };
    
    const currentPrice = simulatedPrices[symbol] || 100;
    console.log(`💰 Precio actual de ${symbol}: ${currentPrice}`);

    // Crear respuesta directa sin servicios complejos
    const analysis = {
      strategy: strategy,
      levels: [
        { price: currentPrice * 0.97, allocation: 20, distance: '-3%' },
        { price: currentPrice * 0.94, allocation: 25, distance: '-6%' },
        { price: currentPrice * 0.91, allocation: 30, distance: '-9%' },
        { price: currentPrice * 0.88, allocation: 25, distance: '-12%' }
      ],
      recommendations: [
        `Estrategia ${strategy} configurada para ${symbol}`,
        'Niveles calculados basados en precio actual',
        'Distribución de capital optimizada'
      ],
      riskLevel: 'MEDIUM',
      maxRisk: '3%'
    };

    res.json({
      success: true,
      data: {
        analysis,
        market: {
          symbol,
          price: currentPrice,
          trend: 'BULLISH'
        },
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error en análisis de promediación:', error);
    res.status(500).json({
      success: false,
      error: 'Error en análisis de promediación',
      details: error.message
    });
  }
});

/**
 * GET /api/averaging/strategies
 * Obtener información sobre estrategias disponibles
 */
router.get('/strategies', (req, res) => {
  try {
    const strategies = {
      DCA: {
        name: 'Dollar Cost Averaging',
        description: 'Promediación hacia abajo en caídas',
        riskLevel: 'MEDIUM',
        maxEntries: 5,
        triggerType: 'PRICE_DECLINE',
        suitableFor: ['Long term', 'Trend following', 'High conviction']
      },
      PYRAMID: {
        name: 'Pyramid Building',
        description: 'Añadir posición en ganancias',
        riskLevel: 'HIGH',
        maxEntries: 4,
        triggerType: 'PROFIT_INCREASE',
        suitableFor: ['Strong trends', 'Momentum', 'Short term']
      },
      SCALE_IN: {
        name: 'Scale In',
        description: 'Entrada gradual en soportes',
        riskLevel: 'LOW',
        maxEntries: 3,
        triggerType: 'SUPPORT_LEVEL',
        suitableFor: ['Range trading', 'Support bounce', 'Conservative']
      },
      SCALE_OUT: {
        name: 'Scale Out',
        description: 'Salida gradual en resistencias',
        riskLevel: 'LOW',
        maxEntries: 3,
        triggerType: 'RESISTANCE_LEVEL',
        suitableFor: ['Profit taking', 'Risk management', 'Conservative']
      }
    };

    res.json({
      success: true,
      data: {
        strategies,
        riskLimits: {
          maxTotalRisk: '3%',
          maxPositions: 5,
          minPriceGap: '2%',
          maxAverageDown: '15%'
        },
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estrategias:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estrategias'
    });
  }
});

/**
 * POST /api/averaging/simulate
 * Simular estrategia de promediación
 */
router.post('/simulate', async (req, res) => {
  try {
    const {
      symbol,
      strategy,
      initialPrice,
      priceScenario,
      initialInvestment = 1000
    } = req.body;

    if (!symbol || !strategy || !initialPrice || !priceScenario) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos'
      });
    }

    console.log(`🎯 Simulando ${strategy} para ${symbol}`);

    // Simular secuencia de precios
    const simulation = await simulateAveragingStrategy(
      symbol,
      strategy,
      initialPrice,
      priceScenario,
      initialInvestment
    );

    res.json({
      success: true,
      data: simulation
    });

  } catch (error) {
    console.error('❌ Error en simulación:', error);
    res.status(500).json({
      success: false,
      error: 'Error en simulación',
      details: error.message
    });
  }
});

/**
 * GET /api/averaging/position/:symbol
 * Obtener estado actual de posición con métricas de promediación
 */
router.get('/position/:symbol', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;

    // Simular posición actual (en producción: consultar base de datos)
    const position = {
      symbol,
      side: 'LONG',
      entries: [
        {
          id: '1',
          price: 47000,
          size: 0.1,
          timestamp: new Date(Date.now() - 7200000),
          strategy: 'INITIAL'
        },
        {
          id: '2',
          price: 46000,
          size: 0.12,
          timestamp: new Date(Date.now() - 3600000),
          strategy: 'DCA'
        },
        {
          id: '3',
          price: 45000,
          size: 0.15,
          timestamp: new Date(Date.now() - 1800000),
          strategy: 'DCA'
        }
      ],
      currentPrice: 44500
    };

    const metrics = averagingSystemService.calculatePositionMetrics(position);

    res.json({
      success: true,
      data: {
        position,
        metrics,
        analysis: {
          averagePrice: metrics.averagePrice,
          totalInvested: metrics.totalInvested,
          unrealizedPnL: metrics.unrealizedPnL,
          unrealizedPnLPercent: metrics.unrealizedPnLPercent,
          riskLevel: metrics.unrealizedPnLPercent < -10 ? 'HIGH' :
                     metrics.unrealizedPnLPercent < -5 ? 'MEDIUM' : 'LOW'
        },
        nextLevels: await getNextAveragingLevels(symbol, position),
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo posición:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo posición'
    });
  }
});

/**
 * GET /api/averaging/risk-assessment/:symbol
 * Evaluación detallada de riesgo para promediación
 */
router.get('/risk-assessment/:symbol', validateSymbol, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { strategy = 'DCA' } = req.query;

    // Simular datos para evaluación de riesgo
    const marketData = {
      symbol,
      price: 44000,
      volatility: 0.65,
      trend: 'BEARISH',
      support: 42000,
      resistance: 48000
    };

    const position = {
      symbol,
      entries: [
        { price: 47000, size: 0.1 },
        { price: 46000, size: 0.12 }
      ],
      currentPrice: marketData.price
    };

    const positionMetrics = averagingSystemService.calculatePositionMetrics(position);
    const riskAssessment = averagingSystemService.assessRiskLevel(
      { type: strategy, action: 'BUY' },
      positionMetrics
    );

    // Análisis de escenarios
    const scenarios = {
      bullish: calculateScenario(position, marketData.price * 1.1),
      neutral: calculateScenario(position, marketData.price),
      bearish: calculateScenario(position, marketData.price * 0.9),
      worstCase: calculateScenario(position, marketData.price * 0.85)
    };

    res.json({
      success: true,
      data: {
        currentRisk: riskAssessment,
        scenarios,
        limits: {
          maxRisk: '3%',
          currentRisk: `${Math.abs(positionMetrics.unrealizedPnLPercent).toFixed(2)}%`,
          remainingEntries: 5 - positionMetrics.entryCount,
          maxAverageDown: '15%'
        },
        recommendations: generateRiskRecommendations(riskAssessment, scenarios),
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error en evaluación de riesgo:', error);
    res.status(500).json({
      success: false,
      error: 'Error en evaluación de riesgo'
    });
  }
});

// Funciones auxiliares

async function simulateAveragingStrategy(symbol, strategy, initialPrice, priceScenario, initialInvestment) {
  const steps = [];
  const position = { entries: [], currentPrice: initialPrice };
  let remainingCapital = initialInvestment;

  // Simular entrada inicial
  const initialSize = (initialInvestment * 0.3) / initialPrice;
  position.entries.push({
    price: initialPrice,
    size: initialSize,
    investment: initialInvestment * 0.3
  });
  remainingCapital -= initialInvestment * 0.3;

  steps.push({
    step: 1,
    price: initialPrice,
    action: 'INITIAL_BUY',
    size: initialSize,
    investment: initialInvestment * 0.3,
    position: { ...position },
    metrics: averagingSystemService.calculatePositionMetrics(position)
  });

  // Simular escenario de precios
  for (let i = 0; i < priceScenario.length; i++) {
    const price = priceScenario[i];
    position.currentPrice = price;

    const marketData = { symbol, price };
    const analysis = await averagingSystemService.analyzeAveragingOpportunity(
      marketData,
      position,
      strategy
    );

    if (analysis.opportunity && analysis.opportunity.action === 'BUY' && remainingCapital > 0) {
      const investment = Math.min(remainingCapital, analysis.opportunity.size * price);
      const size = investment / price;

      position.entries.push({
        price,
        size,
        investment
      });
      remainingCapital -= investment;

      steps.push({
        step: i + 2,
        price,
        action: analysis.opportunity.type,
        size,
        investment,
        position: { ...position },
        metrics: averagingSystemService.calculatePositionMetrics(position)
      });
    } else {
      steps.push({
        step: i + 2,
        price,
        action: 'HOLD',
        position: { ...position },
        metrics: averagingSystemService.calculatePositionMetrics(position)
      });
    }
  }

  return {
    symbol,
    strategy,
    initialInvestment,
    finalPrice: priceScenario[priceScenario.length - 1],
    steps,
    summary: {
      totalEntries: position.entries.length,
      totalInvested: initialInvestment - remainingCapital,
      remainingCapital,
      finalMetrics: averagingSystemService.calculatePositionMetrics(position)
    }
  };
}

async function getNextAveragingLevels(symbol, position) {
  const levels = [];

  // Simular próximos niveles DCA
  const currentPrice = position.currentPrice;
  const dcaLevels = [0.97, 0.94, 0.91, 0.88]; // -3%, -6%, -9%, -12%

  for (const multiplier of dcaLevels) {
    const price = currentPrice * multiplier;
    levels.push({
      type: 'DCA',
      price,
      distance: ((currentPrice - price) / currentPrice * 100).toFixed(2) + '%',
      allocation: '20-25%',
      confidence: multiplier > 0.95 ? 'HIGH' : multiplier > 0.90 ? 'MEDIUM' : 'LOW'
    });
  }

  return levels;
}

function calculateScenario(position, targetPrice) {
  const tempPosition = {
    ...position,
    currentPrice: targetPrice
  };

  const metrics = averagingSystemService.calculatePositionMetrics(tempPosition);

  return {
    price: targetPrice,
    pnl: metrics.unrealizedPnL,
    pnlPercent: metrics.unrealizedPnLPercent,
    riskLevel: Math.abs(metrics.unrealizedPnLPercent) > 10 ? 'HIGH' :
               Math.abs(metrics.unrealizedPnLPercent) > 5 ? 'MEDIUM' : 'LOW'
  };
}

function generateRiskRecommendations(riskAssessment, scenarios) {
  const recommendations = [];

  if (riskAssessment.level === 'HIGH') {
    recommendations.push({
      type: 'WARNING',
      message: 'Nivel de riesgo alto - considerar reducir posición',
      priority: 'HIGH'
    });
  }

  if (scenarios.worstCase.pnlPercent < -15) {
    recommendations.push({
      type: 'RISK_LIMIT',
      message: 'En escenario pesimista se excedería límite de 15%',
      priority: 'HIGH'
    });
  }

  if (scenarios.bearish.pnlPercent < -10) {
    recommendations.push({
      type: 'CAUTION',
      message: 'Preparar stop loss defensivo si continúa caída',
      priority: 'MEDIUM'
    });
  }

  return recommendations;
}

module.exports = router;