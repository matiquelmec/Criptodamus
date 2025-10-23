const express = require('express');
const MultiTelegramService = require('../services/multiTelegramService');

const router = express.Router();

// Inicializar el servicio multi-telegram
const multiTelegram = new MultiTelegramService();

// Logger
let logger;
try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger || loggerModule;
} catch (error) {
  logger = {
    info: (msg, meta) => console.log(`INFO: ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`ERROR: ${msg}`, meta || ''),
    warn: (msg, meta) => console.warn(`WARN: ${msg}`, meta || '')
  };
}

// ================== ENDPOINTS DE CONFIGURACIÓN ==================

/**
 * GET /api/multi-telegram/config
 * Obtiene la configuración actual de múltiples bots
 */
router.get('/config', (req, res) => {
  try {
    const config = multiTelegram.getConfiguration();

    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting multi-telegram config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/multi-telegram/stats
 * Obtiene estadísticas de todos los bots
 */
router.get('/stats', (req, res) => {
  try {
    const stats = multiTelegram.getAllStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting multi-telegram stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/test-connections
 * Prueba la conexión de todos los bots
 */
router.post('/test-connections', async (req, res) => {
  try {
    const results = await multiTelegram.testAllConnections();

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error testing multi-telegram connections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================== ENDPOINTS DE ENVÍO ==================

/**
 * POST /api/multi-telegram/send/signal
 * Envía una señal de trading (Bot Principal)
 */
router.post('/send/signal', async (req, res) => {
  try {
    const { signal } = req.body;

    if (!signal) {
      return res.status(400).json({
        success: false,
        error: 'Signal data is required'
      });
    }

    const result = await multiTelegram.sendSignalAlert(signal);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error sending signal via multi-telegram:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/send/market-alert
 * Envía alerta de mercado
 */
router.post('/send/market-alert', async (req, res) => {
  try {
    const { alertType, data } = req.body;

    if (!alertType || !data) {
      return res.status(400).json({
        success: false,
        error: 'Alert type and data are required'
      });
    }

    const result = await multiTelegram.sendMarketAlert(alertType, data);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error sending market alert via multi-telegram:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/send/risk-alert
 * Envía alerta de riesgo (Bot Principal)
 */
router.post('/send/risk-alert', async (req, res) => {
  try {
    const { riskType, data } = req.body;

    if (!riskType || !data) {
      return res.status(400).json({
        success: false,
        error: 'Risk type and data are required'
      });
    }

    const result = await multiTelegram.sendRiskAlert(riskType, data);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error sending risk alert via multi-telegram:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/send/custom
 * Envía mensaje personalizado a un bot específico
 */
router.post('/send/custom', async (req, res) => {
  try {
    const { bot, message, options = {} } = req.body;

    if (!bot || !message) {
      return res.status(400).json({
        success: false,
        error: 'Bot name and message are required'
      });
    }

    const result = await multiTelegram.sendCustomMessage(bot, message, options);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error sending custom message via multi-telegram:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/broadcast
 * Envía mensaje a todos los bots configurados
 */
router.post('/broadcast', async (req, res) => {
  try {
    const { message, options = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const result = await multiTelegram.broadcast(message, options);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error broadcasting message via multi-telegram:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/send/daily-report
 * Envía reporte diario (Bot Secundario)
 */
router.post('/send/daily-report', async (req, res) => {
  try {
    const { reportData } = req.body;

    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'Report data is required'
      });
    }

    const result = await multiTelegram.sendDailyReport(reportData);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error sending daily report via multi-telegram:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/send/weekly-report
 * Envía reporte semanal (Bot Secundario)
 */
router.post('/send/weekly-report', async (req, res) => {
  try {
    const { reportData } = req.body;

    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'Report data is required'
      });
    }

    const result = await multiTelegram.sendWeeklyReport(reportData);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error sending weekly report via multi-telegram:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================== ENDPOINTS DE GESTIÓN ==================

/**
 * POST /api/multi-telegram/routing/set-rule
 * Configura regla de enrutamiento
 */
router.post('/routing/set-rule', (req, res) => {
  try {
    const { messageType, botName } = req.body;

    if (!messageType || !botName) {
      return res.status(400).json({
        success: false,
        error: 'Message type and bot name are required'
      });
    }

    multiTelegram.setRoutingRule(messageType, botName);

    res.json({
      success: true,
      message: `Routing rule set: ${messageType} -> ${botName}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error setting routing rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/routing/toggle
 * Habilita/deshabilita el enrutamiento
 */
router.post('/routing/toggle', (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Enabled must be a boolean'
      });
    }

    multiTelegram.setRoutingEnabled(enabled);

    res.json({
      success: true,
      message: `Routing ${enabled ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error toggling routing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/set-default-bot
 * Establece el bot por defecto
 */
router.post('/set-default-bot', (req, res) => {
  try {
    const { botName } = req.body;

    if (!botName) {
      return res.status(400).json({
        success: false,
        error: 'Bot name is required'
      });
    }

    multiTelegram.setDefaultBot(botName);

    res.json({
      success: true,
      message: `Default bot set to: ${botName}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error setting default bot:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================== ENDPOINTS DE TESTING ==================

/**
 * POST /api/multi-telegram/test/debug
 * Envía mensaje de debug al bot de desarrollo
 */
router.post('/test/debug', async (req, res) => {
  try {
    const { message } = req.body;

    const debugMessage = message || 'Test debug message from multi-telegram service';
    const result = await multiTelegram.sendDebugMessage(debugMessage);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error sending debug message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-telegram/test/all-bots
 * Envía mensaje de prueba a todos los bots
 */
router.post('/test/all-bots', async (req, res) => {
  try {
    const { message } = req.body;

    const testMessage = message || `🧪 Test message from Multi-Telegram Service at ${new Date().toLocaleString()}`;
    const result = await multiTelegram.broadcast(testMessage);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error testing all bots:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = {
  router,
  multiTelegram // Exportar la instancia para uso en otros módulos
};