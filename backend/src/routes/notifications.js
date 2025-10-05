const express = require('express');
const TelegramService = require('../services/telegramService');
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
const telegramService = new TelegramService();
const signalGenerator = new SignalGeneratorService();

// ================== CONFIGURACIÓN Y ESTADO ==================

/**
 * GET /api/notifications/health
 * Estado del servicio de notificaciones
 */
router.get('/health', async (req, res) => {
  try {
    const health = telegramService.getHealthStatus();
    const connectionTest = await telegramService.testConnection();

    res.json({
      success: true,
      data: {
        ...health,
        connectionTest
      }
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
 * POST /api/notifications/test
 * Envía un mensaje de prueba a Telegram
 */
router.post('/test', async (req, res) => {
  try {
    const { message = 'Mensaje de prueba desde CryptoTrading AI Advisor' } = req.body;

    const result = await telegramService.sendMessage(`🧪 *TEST MESSAGE*\n\n${message}\n\n🕐 ${new Date().toLocaleString()}`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error sending test message:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando mensaje de prueba',
      message: error.message
    });
  }
});

/**
 * GET /api/notifications/stats
 * Estadísticas del servicio de notificaciones
 */
router.get('/stats', (req, res) => {
  try {
    const stats = telegramService.getStats();

    res.json({
      success: true,
      data: stats
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
 * POST /api/notifications/config
 * Actualiza la configuración del servicio
 */
router.post('/config', async (req, res) => {
  try {
    const {
      botToken,
      chatId,
      enableNotifications,
      parseMode,
      retryAttempts
    } = req.body;

    const updates = {};

    if (botToken !== undefined) updates.botToken = botToken;
    if (chatId !== undefined) updates.chatId = chatId;
    if (enableNotifications !== undefined) updates.enableNotifications = enableNotifications;
    if (parseMode !== undefined) updates.parseMode = parseMode;
    if (retryAttempts !== undefined) updates.retryAttempts = retryAttempts;

    telegramService.updateConfig(updates);

    // Test connection if enabled
    let connectionTest = null;
    if (updates.enableNotifications !== false) {
      connectionTest = await telegramService.testConnection();
    }

    res.json({
      success: true,
      message: 'Configuración actualizada',
      updates,
      connectionTest,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error updating notification config:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando configuración',
      message: error.message
    });
  }
});

// ================== ENVÍO DE ALERTAS ==================

/**
 * POST /api/notifications/signal
 * Envía una alerta de señal de trading
 */
router.post('/signal', async (req, res) => {
  try {
    const {
      symbol,
      timeframe = '4h',
      accountBalance = 10000,
      sendNotification = true
    } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol requerido'
      });
    }

    // Generar señal
    const signal = await signalGenerator.generateSignal(symbol, {
      timeframe,
      accountBalance
    });

    let notificationResult = null;

    if (sendNotification) {
      // Enviar notificación
      notificationResult = await telegramService.sendSignalAlert(signal);
    }

    res.json({
      success: true,
      data: {
        signal,
        notification: notificationResult
      }
    });

  } catch (error) {
    logger.error('Error sending signal notification:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando notificación de señal',
      message: error.message
    });
  }
});

/**
 * POST /api/notifications/market-alert
 * Envía una alerta de mercado
 */
router.post('/market-alert', async (req, res) => {
  try {
    const { alertType, data } = req.body;

    if (!alertType || !data) {
      return res.status(400).json({
        success: false,
        error: 'alertType y data son requeridos'
      });
    }

    const validAlertTypes = [
      'market_extreme',
      'volatility_spike',
      'fear_greed_extreme',
      'funding_rate_extreme'
    ];

    if (!validAlertTypes.includes(alertType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de alerta inválido',
        validTypes: validAlertTypes
      });
    }

    const result = await telegramService.sendMarketAlert(alertType, data);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error sending market alert:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando alerta de mercado',
      message: error.message
    });
  }
});

/**
 * POST /api/notifications/risk-alert
 * Envía una alerta de riesgo
 */
router.post('/risk-alert', async (req, res) => {
  try {
    const { riskType, data } = req.body;

    if (!riskType || !data) {
      return res.status(400).json({
        success: false,
        error: 'riskType y data son requeridos'
      });
    }

    const validRiskTypes = [
      'excessive_risk',
      'bad_streak',
      'account_warning',
      'position_update'
    ];

    if (!validRiskTypes.includes(riskType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de riesgo inválido',
        validTypes: validRiskTypes
      });
    }

    const result = await telegramService.sendRiskAlert(riskType, data);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error sending risk alert:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando alerta de riesgo',
      message: error.message
    });
  }
});

/**
 * POST /api/notifications/system-alert
 * Envía una alerta del sistema
 */
router.post('/system-alert', async (req, res) => {
  try {
    const { alertType = 'info', message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message requerido'
      });
    }

    const validAlertTypes = ['info', 'warning', 'error', 'success'];

    if (!validAlertTypes.includes(alertType)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de alerta inválido',
        validTypes: validAlertTypes
      });
    }

    const result = await telegramService.sendSystemAlert(alertType, message);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error sending system alert:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando alerta de sistema',
      message: error.message
    });
  }
});

// ================== REPORTES ==================

/**
 * POST /api/notifications/daily-report
 * Envía el reporte diario
 */
router.post('/daily-report', async (req, res) => {
  try {
    const {
      totalPnL = 0,
      successfulTrades = 0,
      totalTrades = 0,
      winRate = 0,
      topSignals = [],
      alertsCount = 0,
      analysisCount = 0
    } = req.body;

    const reportData = {
      totalPnL,
      successfulTrades,
      totalTrades,
      winRate,
      topSignals,
      alertsCount,
      analysisCount
    };

    const result = await telegramService.sendDailyReport(reportData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error sending daily report:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando reporte diario',
      message: error.message
    });
  }
});

/**
 * POST /api/notifications/weekly-report
 * Envía el reporte semanal
 */
router.post('/weekly-report', async (req, res) => {
  try {
    const {
      weeklyPnL = 0,
      totalTrades = 0,
      winRate = 0,
      maxDrawdown = 0,
      bestDay = { date: '', pnl: 0 },
      worstDay = { date: '', pnl: 0 },
      topPerformers = [],
      signalsGenerated = 0,
      avgConfluence = 0,
      avgTradeTime = 0,
      weekStart = '',
      weekEnd = ''
    } = req.body;

    const reportData = {
      weeklyPnL,
      totalTrades,
      winRate,
      maxDrawdown,
      bestDay,
      worstDay,
      topPerformers,
      signalsGenerated,
      avgConfluence,
      avgTradeTime,
      weekStart,
      weekEnd
    };

    const result = await telegramService.sendWeeklyReport(reportData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error sending weekly report:', error);
    res.status(500).json({
      success: false,
      error: 'Error enviando reporte semanal',
      message: error.message
    });
  }
});

// ================== ESCANEO Y ALERTAS AUTOMÁTICAS ==================

/**
 * POST /api/notifications/scan-and-notify
 * Escanea el mercado y envía alertas automáticamente
 */
router.post('/scan-and-notify', async (req, res) => {
  try {
    const {
      symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT'],
      timeframe = '4h',
      accountBalance = 10000,
      minConfluenceScore = 75,
      onlyValidSignals = true
    } = req.body;

    logger.info('Starting scan and notify process', {
      symbolCount: symbols.length,
      timeframe,
      minConfluenceScore
    });

    // Escanear múltiples símbolos
    const scanResult = await signalGenerator.scanMultipleSymbols(symbols, {
      timeframe,
      accountBalance
    });

    // Filtrar señales válidas
    const validSignals = scanResult.signals.filter(signal =>
      signal.confluenceScore >= minConfluenceScore &&
      (!onlyValidSignals || (signal.success && signal.type === 'VALID_SIGNAL'))
    );

    // Enviar notificaciones para cada señal válida
    const notifications = [];

    for (const signal of validSignals) {
      try {
        const notificationResult = await telegramService.sendSignalAlert(signal);
        notifications.push({
          symbol: signal.symbol,
          notification: notificationResult
        });

        // Esperar un poco entre notificaciones para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.warn(`Failed to send notification for ${signal.symbol}:`, error.message);
        notifications.push({
          symbol: signal.symbol,
          notification: {
            success: false,
            error: error.message
          }
        });
      }
    }

    // Enviar resumen si hay múltiples señales
    if (validSignals.length > 1) {
      const summaryMessage = `📊 *RESUMEN DEL ESCANEO*

🎯 *Señales Encontradas:* ${validSignals.length}
📈 *Símbolos Escaneados:* ${symbols.length}
⭐ *Confluencia Promedio:* ${(validSignals.reduce((sum, s) => sum + s.confluenceScore, 0) / validSignals.length).toFixed(1)}%

🔝 *Top Señales:*
${validSignals.slice(0, 3).map(s => `• ${s.symbol}: ${s.confluenceScore}% (${s.direction.toUpperCase()})`).join('\n')}

🕐 ${new Date().toLocaleString()}`;

      await telegramService.sendMessage(summaryMessage);
    }

    res.json({
      success: true,
      data: {
        scanResult,
        validSignals: validSignals.length,
        notifications,
        summary: {
          symbolsScanned: symbols.length,
          signalsFound: validSignals.length,
          notificationsSent: notifications.filter(n => n.notification.success).length,
          averageConfluence: validSignals.length > 0
            ? (validSignals.reduce((sum, s) => sum + s.confluenceScore, 0) / validSignals.length).toFixed(1)
            : 0
        }
      }
    });

  } catch (error) {
    logger.error('Error in scan and notify:', error);
    res.status(500).json({
      success: false,
      error: 'Error en escaneo y notificación',
      message: error.message
    });
  }
});

/**
 * POST /api/notifications/auto-monitor
 * Inicia monitoreo automático (para uso futuro con cron jobs)
 */
router.post('/auto-monitor', async (req, res) => {
  try {
    const {
      interval = 15, // minutos
      symbols = ['BTCUSDT', 'ETHUSDT'],
      enableNotifications = true
    } = req.body;

    // Por ahora, solo retornamos la configuración
    // En el futuro, aquí se implementaría un scheduler
    res.json({
      success: true,
      message: 'Auto-monitor configuration saved',
      config: {
        interval,
        symbols,
        enableNotifications,
        nextRun: new Date(Date.now() + interval * 60 * 1000)
      },
      note: 'Auto-monitoring implementation pending - use external cron job to call /scan-and-notify'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error configurando auto-monitor',
      message: error.message
    });
  }
});

// ================== INFORMACIÓN Y AYUDA ==================

/**
 * GET /api/notifications/chat-info
 * Información del chat de Telegram configurado
 */
router.get('/chat-info', async (req, res) => {
  try {
    const chatInfo = await telegramService.getChatInfo();

    res.json({
      success: true,
      data: chatInfo
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo información del chat',
      message: error.message
    });
  }
});

/**
 * GET /api/notifications/examples
 * Ejemplos de uso de las APIs
 */
router.get('/examples', (req, res) => {
  try {
    const examples = {
      signal_alert: {
        endpoint: 'POST /api/notifications/signal',
        body: {
          symbol: 'BTCUSDT',
          timeframe: '4h',
          accountBalance: 10000,
          sendNotification: true
        }
      },
      market_alert: {
        endpoint: 'POST /api/notifications/market-alert',
        body: {
          alertType: 'volatility_spike',
          data: {
            symbol: 'BTCUSDT',
            bbwp: 95,
            priceChange: 8.5,
            volumeIncrease: 150,
            type: 'spike',
            recommendation: 'Monitor for breakout'
          }
        }
      },
      risk_alert: {
        endpoint: 'POST /api/notifications/risk-alert',
        body: {
          riskType: 'excessive_risk',
          data: {
            type: 'Position Size Too Large',
            currentValue: '5%',
            limit: '2%',
            description: 'La posición excede el riesgo máximo permitido',
            action: 'Reducir tamaño de posición inmediatamente'
          }
        }
      },
      scan_and_notify: {
        endpoint: 'POST /api/notifications/scan-and-notify',
        body: {
          symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
          timeframe: '4h',
          minConfluenceScore: 75,
          onlyValidSignals: true
        }
      }
    };

    res.json({
      success: true,
      data: examples
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo ejemplos'
    });
  }
});

module.exports = router;