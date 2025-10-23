const TelegramService = require('./telegramService');

// Logger mock para testing si no está disponible
let logger;
try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger || loggerModule;
  if (typeof logger.info !== 'function') {
    throw new Error('Logger malformed');
  }
} catch (error) {
  logger = {
    info: (msg, meta) => console.log(`INFO: ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`ERROR: ${msg}`, meta || ''),
    warn: (msg, meta) => console.warn(`WARN: ${msg}`, meta || '')
  };
}

/**
 * Servicio Multi-Telegram que gestiona múltiples bots
 * Permite separar tipos de notificaciones en diferentes bots
 */
class MultiTelegramService {
  constructor() {
    this.bots = new Map();
    this.config = {
      defaultBot: 'primary',
      enableRouting: true,
      routingRules: new Map()
    };

    this.initializeBots();
    this.setupDefaultRouting();
  }

  /**
   * Inicializa los bots según la configuración del .env
   */
  initializeBots() {
    // Bot Principal - Para señales de trading y alertas importantes
    const primaryBot = new TelegramService({
      botToken: process.env.TELEGRAM_BOT_TOKEN_PRIMARY || process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID_PRIMARY || process.env.TELEGRAM_CHAT_ID,
      enableNotifications: true
    });

    // Bot Secundario - Para análisis, reportes y notificaciones menos críticas
    const secondaryBot = new TelegramService({
      botToken: process.env.TELEGRAM_BOT_TOKEN_SECONDARY,
      chatId: process.env.TELEGRAM_CHAT_ID_SECONDARY,
      enableNotifications: true
    });

    // Bot de Desarrollo/Testing (opcional)
    const devBot = new TelegramService({
      botToken: process.env.TELEGRAM_BOT_TOKEN_DEV,
      chatId: process.env.TELEGRAM_CHAT_ID_DEV,
      enableNotifications: process.env.NODE_ENV === 'development'
    });

    this.bots.set('primary', primaryBot);
    this.bots.set('secondary', secondaryBot);
    this.bots.set('dev', devBot);

    logger.info('Multi-Telegram service initialized', {
      primaryConfigured: primaryBot.config.enableNotifications,
      secondaryConfigured: secondaryBot.config.enableNotifications,
      devConfigured: devBot.config.enableNotifications
    });
  }

  /**
   * Configura las reglas de enrutamiento por defecto
   */
  setupDefaultRouting() {
    // Señales de trading -> Bot Principal
    this.config.routingRules.set('signal_alert', 'primary');
    this.config.routingRules.set('risk_alert', 'primary');
    this.config.routingRules.set('position_update', 'primary');
    this.config.routingRules.set('market_extreme', 'primary');

    // Análisis y reportes -> Bot Secundario
    this.config.routingRules.set('market_analysis', 'secondary');
    this.config.routingRules.set('daily_report', 'secondary');
    this.config.routingRules.set('weekly_report', 'secondary');
    this.config.routingRules.set('system_alert', 'secondary');

    // Desarrollo y testing -> Bot Dev
    this.config.routingRules.set('debug', 'dev');
    this.config.routingRules.set('test', 'dev');

    logger.info('Telegram routing rules configured', {
      rules: Array.from(this.config.routingRules.entries())
    });
  }

  /**
   * Determina qué bot usar para un tipo de mensaje
   */
  getBotForMessageType(messageType) {
    if (!this.config.enableRouting) {
      return this.bots.get(this.config.defaultBot);
    }

    const botName = this.config.routingRules.get(messageType) || this.config.defaultBot;
    const bot = this.bots.get(botName);

    // Fallback al bot principal si el bot específico no está configurado
    if (!bot || !bot.config.enableNotifications) {
      return this.bots.get('primary');
    }

    return bot;
  }

  // ================== MÉTODOS PÚBLICOS DE ENVÍO ==================

  /**
   * Envía una señal de trading (Bot Principal)
   */
  async sendSignalAlert(signal) {
    const bot = this.getBotForMessageType('signal_alert');
    const result = await bot.sendSignalAlert(signal);

    logger.info('Signal alert routed', {
      botUsed: this.getBotName(bot),
      success: result.success,
      symbol: signal.symbol
    });

    return result;
  }

  /**
   * Envía alerta de mercado (Bot Principal para extremos, Secundario para análisis)
   */
  async sendMarketAlert(alertType, data) {
    const messageType = alertType.includes('extreme') ? 'market_extreme' : 'market_analysis';
    const bot = this.getBotForMessageType(messageType);

    const result = await bot.sendMarketAlert(alertType, data);

    logger.info('Market alert routed', {
      botUsed: this.getBotName(bot),
      alertType,
      success: result.success
    });

    return result;
  }

  /**
   * Envía alerta de riesgo (Bot Principal)
   */
  async sendRiskAlert(riskType, data) {
    const bot = this.getBotForMessageType('risk_alert');
    const result = await bot.sendRiskAlert(riskType, data);

    logger.info('Risk alert routed', {
      botUsed: this.getBotName(bot),
      riskType,
      success: result.success
    });

    return result;
  }

  /**
   * Envía reporte diario (Bot Secundario)
   */
  async sendDailyReport(reportData) {
    const bot = this.getBotForMessageType('daily_report');
    const result = await bot.sendDailyReport(reportData);

    logger.info('Daily report routed', {
      botUsed: this.getBotName(bot),
      success: result.success
    });

    return result;
  }

  /**
   * Envía reporte semanal (Bot Secundario)
   */
  async sendWeeklyReport(reportData) {
    const bot = this.getBotForMessageType('weekly_report');
    const result = await bot.sendWeeklyReport(reportData);

    logger.info('Weekly report routed', {
      botUsed: this.getBotName(bot),
      success: result.success
    });

    return result;
  }

  /**
   * Envía alerta del sistema (Bot Secundario)
   */
  async sendSystemAlert(alertType, message) {
    const bot = this.getBotForMessageType('system_alert');
    const result = await bot.sendSystemAlert(alertType, message);

    logger.info('System alert routed', {
      botUsed: this.getBotName(bot),
      alertType,
      success: result.success
    });

    return result;
  }

  /**
   * Envía mensaje personalizado a un bot específico
   */
  async sendCustomMessage(botName, message, options = {}) {
    const bot = this.bots.get(botName);

    if (!bot) {
      logger.error(`Bot '${botName}' not found`);
      return { success: false, error: `Bot '${botName}' not found` };
    }

    const result = await bot.sendMessage(message, options);

    logger.info('Custom message sent', {
      botUsed: botName,
      success: result.success
    });

    return result;
  }

  /**
   * Envía mensaje a todos los bots configurados
   */
  async broadcast(message, options = {}) {
    const results = [];

    for (const [botName, bot] of this.bots.entries()) {
      if (bot.config.enableNotifications) {
        try {
          const result = await bot.sendMessage(message, options);
          results.push({
            bot: botName,
            success: result.success,
            result
          });
        } catch (error) {
          results.push({
            bot: botName,
            success: false,
            error: error.message
          });
        }
      }
    }

    logger.info('Broadcast message sent', {
      botsTargeted: results.length,
      successful: results.filter(r => r.success).length
    });

    return {
      success: results.some(r => r.success),
      results
    };
  }

  // ================== GESTIÓN Y CONFIGURACIÓN ==================

  /**
   * Obtiene estadísticas de todos los bots
   */
  getAllStats() {
    const stats = {};

    for (const [botName, bot] of this.bots.entries()) {
      stats[botName] = {
        ...bot.getStats(),
        healthStatus: bot.getHealthStatus()
      };
    }

    return {
      multiBot: {
        totalBots: this.bots.size,
        activeBots: Array.from(this.bots.values()).filter(bot => bot.config.enableNotifications).length,
        routingEnabled: this.config.enableRouting,
        defaultBot: this.config.defaultBot
      },
      bots: stats
    };
  }

  /**
   * Prueba la conexión de todos los bots
   */
  async testAllConnections() {
    const results = {};

    for (const [botName, bot] of this.bots.entries()) {
      try {
        results[botName] = await bot.testConnection();
      } catch (error) {
        results[botName] = {
          success: false,
          error: error.message,
          configured: false
        };
      }
    }

    logger.info('Multi-bot connection test completed', {
      results: Object.entries(results).map(([name, result]) => ({
        bot: name,
        success: result.success
      }))
    });

    return results;
  }

  /**
   * Configura reglas de enrutamiento personalizadas
   */
  setRoutingRule(messageType, botName) {
    if (!this.bots.has(botName)) {
      throw new Error(`Bot '${botName}' does not exist`);
    }

    this.config.routingRules.set(messageType, botName);
    logger.info('Routing rule updated', { messageType, botName });
  }

  /**
   * Habilita/deshabilita el enrutamiento
   */
  setRoutingEnabled(enabled) {
    this.config.enableRouting = enabled;
    logger.info('Routing enabled changed', { enabled });
  }

  /**
   * Establece el bot por defecto
   */
  setDefaultBot(botName) {
    if (!this.bots.has(botName)) {
      throw new Error(`Bot '${botName}' does not exist`);
    }

    this.config.defaultBot = botName;
    logger.info('Default bot changed', { botName });
  }

  /**
   * Obtiene el nombre del bot a partir de la instancia
   */
  getBotName(botInstance) {
    for (const [name, bot] of this.bots.entries()) {
      if (bot === botInstance) {
        return name;
      }
    }
    return 'unknown';
  }

  /**
   * Obtiene información de configuración
   */
  getConfiguration() {
    return {
      bots: Array.from(this.bots.keys()),
      routingRules: Object.fromEntries(this.config.routingRules),
      defaultBot: this.config.defaultBot,
      routingEnabled: this.config.enableRouting,
      activeBots: Array.from(this.bots.entries())
        .filter(([_, bot]) => bot.config.enableNotifications)
        .map(([name, _]) => name)
    };
  }

  // ================== MÉTODOS DE CONVENIENCIA ==================

  /**
   * Envía mensaje de debug (Bot Dev)
   */
  async sendDebugMessage(message) {
    return await this.sendCustomMessage('dev', `🐛 DEBUG: ${message}`);
  }

  /**
   * Envía notificación de trading crítica a bot principal
   */
  async sendCriticalTradingAlert(message) {
    return await this.sendCustomMessage('primary', `🚨 CRÍTICO: ${message}`);
  }

  /**
   * Envía análisis técnico detallado a bot secundario
   */
  async sendTechnicalAnalysis(analysis) {
    const message = `📊 ANÁLISIS TÉCNICO

${analysis.symbol} | ${analysis.timeframe}

📈 Tendencia: ${analysis.trend}
📊 RSI: ${analysis.rsi}
💡 Recomendación: ${analysis.recommendation}

${analysis.details}`;

    return await this.sendCustomMessage('secondary', message);
  }
}

module.exports = MultiTelegramService;