const axios = require('axios');

// Logger mock para testing si no está disponible
let logger;
try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger || loggerModule;
  // Verificar que las funciones existen
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

class TelegramService {
  constructor(options = {}) {
    this.botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;

    this.config = {
      baseURL: `https://api.telegram.org/bot${this.botToken}`,
      parseMode: 'MarkdownV2',
      disableWebPagePreview: true,
      enableNotifications: options.enableNotifications !== false,
      retryAttempts: 3,
      retryDelay: 1000
    };

    this.stats = {
      messagesSent: 0,
      messagesSuccess: 0,
      messagesFailed: 0,
      lastSentAt: null
    };

    // Validar configuración inicial
    this.validateConfig();
  }

  validateConfig() {
    if (!this.botToken || this.botToken === 'your_telegram_bot_token') {
      logger.warn('Telegram bot token no configurado, las notificaciones estarán deshabilitadas');
      this.config.enableNotifications = false;
      return false;
    }

    if (!this.chatId || this.chatId === 'your_chat_id') {
      logger.warn('Telegram chat ID no configurado, las notificaciones estarán deshabilitadas');
      this.config.enableNotifications = false;
      return false;
    }

    return true;
  }

  // ================== ENVÍO DE MENSAJES ==================

  async sendMessage(text, options = {}) {
    try {
      if (!this.config.enableNotifications) {
        logger.info('Telegram notifications disabled, skipping message');
        return {
          success: false,
          reason: 'notifications_disabled',
          message: text
        };
      }

      this.stats.messagesSent++;

      const params = {
        chat_id: this.chatId,
        text: this.escapeMarkdown(text),
        parse_mode: this.config.parseMode,
        disable_web_page_preview: this.config.disableWebPagePreview,
        ...options
      };

      const response = await this.makeRequest('sendMessage', params);

      this.stats.messagesSuccess++;
      this.stats.lastSentAt = new Date();

      logger.info('Telegram message sent successfully', {
        messageId: response.data.result.message_id,
        chatId: this.chatId
      });

      return {
        success: true,
        messageId: response.data.result.message_id,
        timestamp: new Date()
      };

    } catch (error) {
      this.stats.messagesFailed++;
      logger.error('Failed to send Telegram message:', error.message);

      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  async sendSignalAlert(signal) {
    try {
      if (!signal.success || signal.type !== 'VALID_SIGNAL') {
        return this.sendNonTradingAlert(signal);
      }

      const message = this.formatSignalMessage(signal);

      const result = await this.sendMessage(message, {
        reply_markup: this.createSignalKeyboard(signal)
      });

      if (result.success) {
        logger.info('Signal alert sent to Telegram', {
          symbol: signal.symbol,
          direction: signal.direction,
          confluenceScore: signal.confluenceScore
        });
      }

      return result;

    } catch (error) {
      logger.error('Error sending signal alert:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendMarketAlert(alertType, data) {
    try {
      let message = '';

      switch (alertType) {
        case 'market_extreme':
          message = this.formatMarketExtremeAlert(data);
          break;
        case 'volatility_spike':
          message = this.formatVolatilityAlert(data);
          break;
        case 'fear_greed_extreme':
          message = this.formatFearGreedAlert(data);
          break;
        case 'funding_rate_extreme':
          message = this.formatFundingRateAlert(data);
          break;
        default:
          message = `🔔 *Market Alert*\n\n${JSON.stringify(data, null, 2)}`;
      }

      return await this.sendMessage(message);

    } catch (error) {
      logger.error('Error sending market alert:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendRiskAlert(riskType, data) {
    try {
      let message = '';

      switch (riskType) {
        case 'excessive_risk':
          message = this.formatExcessiveRiskAlert(data);
          break;
        case 'bad_streak':
          message = this.formatBadStreakAlert(data);
          break;
        case 'account_warning':
          message = this.formatAccountWarningAlert(data);
          break;
        case 'position_update':
          message = this.formatPositionUpdateAlert(data);
          break;
        default:
          message = `⚠️ *Risk Alert*\n\n${JSON.stringify(data, null, 2)}`;
      }

      return await this.sendMessage(message);

    } catch (error) {
      logger.error('Error sending risk alert:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ================== FORMATEO DE MENSAJES ==================

  formatSignalMessage(signal) {
    const directionEmoji = signal.direction === 'long' ? '🟢' : '🔴';
    const confidenceEmoji = this.getConfidenceEmoji(signal.confluenceScore);

    return `${directionEmoji} *SEÑAL DE TRADING* ${confidenceEmoji}

📊 *${signal.symbol}* \\| *${signal.direction.toUpperCase()}*
🎯 *Confluencia:* ${signal.confluenceScore}%
⚡ *Confianza:* ${signal.confidence.toUpperCase()}

💰 *NIVELES:*
📍 *Entrada:* $${this.formatPrice(signal.entry)}
🛑 *Stop Loss:* $${this.formatPrice(signal.stopLoss)}
🎯 *Take Profit:* $${this.formatPrice(signal.takeProfit)}

📊 *RISK MANAGEMENT:*
⚖️ *Risk/Reward:* ${signal.riskReward.toFixed(2)}:1
📏 *Position Size:* ${signal.positionSize}
🔢 *Leverage:* ${signal.leverage}x
💵 *Notional:* $${this.formatPrice(signal.notionalValue)}

🔍 *CONTEXTO TÉCNICO:*
📈 *RSI:* ${signal.technicalContext.rsi?.toFixed(1) || 'N/A'}
🎚️ *Timeframe:* ${signal.technicalContext.timeframe}
📍 *Niveles Cercanos:* ${signal.technicalContext.nearbyLevels.length}

${signal.alerts && signal.alerts.length > 0 ?
  `⚠️ *ALERTAS:*\n${signal.alerts.map(alert => `• ${alert.message}`).join('\n')}` : ''}

🕐 *Válida hasta:* ${new Date(signal.validUntil).toLocaleTimeString()}

_Generado por CryptoTrading AI Advisor_`;
  }

  formatNonTradingSignal(signal) {
    const statusEmoji = signal.type === 'NEUTRAL_SIGNAL' ? '⚪' : '⛔';

    return `${statusEmoji} *ANÁLISIS DE MERCADO*

📊 *${signal.symbol}*
📈 *Estado:* ${signal.recommendation}
🎯 *Confluencia:* ${signal.confluenceScore || 0}%

📝 *Razón:* ${signal.reason || signal.message}

${signal.technicalSummary ? `
🔍 *Resumen Técnico:*
📈 *RSI:* ${signal.technicalSummary.rsi?.toFixed(1) || 'N/A'}
📊 *Tendencia:* ${signal.technicalSummary.trend}
📈 *Volatilidad:* ${signal.technicalSummary.volatility}
` : ''}

💡 *Recomendación:* Esperar mejores condiciones

_Análisis actualizado cada 15 minutos_`;
  }

  formatMarketExtremeAlert(data) {
    return `🚨 *EXTREMO DE MERCADO DETECTADO*

📊 *${data.symbol || 'MARKET'}*
📈 *Tipo:* ${data.type}
📊 *Valor:* ${data.value}
⚠️ *Nivel:* ${data.severity}

🔍 *Descripción:*
${data.description}

💡 *Recomendación:*
${data.recommendation}

🕐 ${new Date().toLocaleString()}`;
  }

  formatVolatilityAlert(data) {
    return `📈 *ALERTA DE VOLATILIDAD*

📊 *${data.symbol}*
📊 *BBWP:* ${data.bbwp}%
📈 *Cambio:* ${data.priceChange}%
📊 *Volumen:* ${data.volumeIncrease}%

${data.type === 'spike' ? '⚡ Explosión de volatilidad detectada' : '🔄 Compresión de volatilidad'}

💡 *Acción Sugerida:* ${data.recommendation}

🕐 ${new Date().toLocaleString()}`;
  }

  formatFearGreedAlert(data) {
    const emoji = data.value > 75 ? '🤑' : data.value < 25 ? '😰' : '😐';

    return `${emoji} *ÍNDICE MIEDO Y CODICIA*

📊 *Valor:* ${data.value}
📈 *Estado:* ${data.status}
🔄 *Cambio:* ${data.change > 0 ? '+' : ''}${data.change}

📝 *Interpretación:*
${data.interpretation}

💡 *Oportunidad:*
${data.opportunity}

🕐 ${new Date().toLocaleString()}`;
  }

  formatFundingRateAlert(data) {
    return `💰 *FUNDING RATE EXTREMO*

📊 *${data.symbol}*
💰 *Rate:* ${(data.fundingRate * 100).toFixed(4)}%
⏰ *8h Rate:* ${(data.annualized * 100).toFixed(2)}%

${data.isExtreme ? '🚨 Nivel extremo detectado' : '⚠️ Nivel elevado'}

💡 *Implicación:*
${data.interpretation}

🕐 ${new Date().toLocaleString()}`;
  }

  formatExcessiveRiskAlert(data) {
    return `🚨 *ALERTA DE RIESGO EXCESIVO*

⚠️ *Tipo:* ${data.type}
📊 *Valor Actual:* ${data.currentValue}
📏 *Límite:* ${data.limit}

📝 *Descripción:*
${data.description}

🛑 *Acción Requerida:*
${data.action}

🕐 ${new Date().toLocaleString()}`;
  }

  formatBadStreakAlert(data) {
    return `📉 *RACHA NEGATIVA DETECTADA*

📊 *Trades Perdedores:* ${data.consecutiveLosses}
📉 *Pérdida Total:* ${data.totalLoss}%
📈 *Drawdown:* ${data.drawdown}%

🛑 *Recomendación:*
${data.recommendation}

💡 *Sugerencias:*
${data.suggestions.map(s => `• ${s}`).join('\n')}

🕐 ${new Date().toLocaleString()}`;
  }

  formatAccountWarningAlert(data) {
    return `⚠️ *ADVERTENCIA DE CUENTA*

💰 *Balance:* $${this.formatPrice(data.balance)}
📉 *Cambio:* ${data.change}%
📊 *Estado:* ${data.status}

📝 *Razón:*
${data.reason}

💡 *Acción Sugerida:*
${data.action}

🕐 ${new Date().toLocaleString()}`;
  }

  formatPositionUpdateAlert(data) {
    return `📊 *ACTUALIZACIÓN DE POSICIÓN*

📊 *${data.symbol}* \\| *${data.side.toUpperCase()}*
💰 *PnL:* ${data.pnl > 0 ? '+' : ''}${data.pnl.toFixed(2)}%
📍 *Precio:* $${this.formatPrice(data.currentPrice)}

${data.action === 'breakeven' ? '🛡️ Stop Loss movido a breakeven' :
  data.action === 'partial_tp' ? '🎯 Take Profit parcial ejecutado' :
  data.action === 'stop_hit' ? '🛑 Stop Loss ejecutado' :
  data.action === 'tp_hit' ? '🎯 Take Profit ejecutado' : '📊 Actualización de posición'}

🕐 ${new Date().toLocaleString()}`;
  }

  // ================== UTILIDADES ==================

  async sendNonTradingAlert(signal) {
    const message = this.formatNonTradingSignal(signal);
    return await this.sendMessage(message);
  }

  escapeMarkdown(text) {
    // Escapar caracteres especiales de MarkdownV2
    const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    let escaped = text;

    specialChars.forEach(char => {
      const regex = new RegExp('\\' + char, 'g');
      escaped = escaped.replace(regex, '\\' + char);
    });

    return escaped;
  }

  formatPrice(price) {
    if (price >= 1) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      return price.toFixed(6);
    }
  }

  getConfidenceEmoji(score) {
    if (score >= 90) return '🔥';
    if (score >= 80) return '⭐';
    if (score >= 70) return '✅';
    if (score >= 60) return '🟡';
    return '🟠';
  }

  createSignalKeyboard(signal) {
    return {
      inline_keyboard: [
        [
          {
            text: '📊 Ver Análisis',
            url: `https://tradingview.com/symbols/${signal.symbol}`
          },
          {
            text: '📈 Confirmar Trade',
            callback_data: `confirm_${signal.symbol}_${signal.direction}`
          }
        ],
        [
          {
            text: '🔕 Silenciar 1h',
            callback_data: `mute_1h_${signal.symbol}`
          },
          {
            text: '📊 Ver Stats',
            callback_data: `stats_${signal.symbol}`
          }
        ]
      ]
    };
  }

  async makeRequest(method, params, attempt = 1) {
    try {
      const url = `${this.config.baseURL}/${method}`;

      const response = await axios.post(url, params, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      return response;

    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        logger.warn(`Telegram request failed (attempt ${attempt}), retrying...`, error.message);

        await this.delay(this.config.retryDelay * attempt);
        return this.makeRequest(method, params, attempt + 1);
      }

      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ================== GESTIÓN Y ESTADO ==================

  async testConnection() {
    try {
      if (!this.config.enableNotifications) {
        return {
          success: false,
          reason: 'Notifications disabled',
          configured: false
        };
      }

      const response = await this.makeRequest('getMe');

      return {
        success: true,
        botInfo: response.data.result,
        configured: true,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Telegram connection test failed:', error);
      return {
        success: false,
        error: error.message,
        configured: this.config.enableNotifications,
        timestamp: new Date()
      };
    }
  }

  async getChatInfo() {
    try {
      if (!this.config.enableNotifications) {
        return { success: false, reason: 'Not configured' };
      }

      const response = await this.makeRequest('getChat', {
        chat_id: this.chatId
      });

      return {
        success: true,
        chatInfo: response.data.result
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getStats() {
    return {
      ...this.stats,
      enabled: this.config.enableNotifications,
      successRate: this.stats.messagesSent > 0
        ? ((this.stats.messagesSuccess / this.stats.messagesSent) * 100).toFixed(1)
        : 0
    };
  }

  getHealthStatus() {
    return {
      service: 'TelegramService',
      status: this.config.enableNotifications ? 'enabled' : 'disabled',
      configured: !!this.botToken && !!this.chatId,
      stats: this.getStats(),
      lastActivity: this.stats.lastSentAt,
      config: {
        parseMode: this.config.parseMode,
        retryAttempts: this.config.retryAttempts,
        enableNotifications: this.config.enableNotifications
      }
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.botToken) this.botToken = newConfig.botToken;
    if (newConfig.chatId) this.chatId = newConfig.chatId;

    this.validateConfig();

    logger.info('Telegram service config updated', newConfig);
  }

  // ================== MÉTODOS DE CONVENIENCIA ==================

  async sendDailyReport(reportData) {
    const message = `📊 *REPORTE DIARIO*

📈 *Performance:*
💰 *PnL Total:* ${reportData.totalPnL > 0 ? '+' : ''}${reportData.totalPnL.toFixed(2)}%
🎯 *Trades Exitosos:* ${reportData.successfulTrades}/${reportData.totalTrades}
📊 *Win Rate:* ${reportData.winRate.toFixed(1)}%

🎯 *Mejores Señales:*
${reportData.topSignals.map(s => `• ${s.symbol} (${s.pnl > 0 ? '+' : ''}${s.pnl.toFixed(1)}%)`).join('\n')}

⚠️ *Alertas del Día:* ${reportData.alertsCount}
📊 *Análisis Realizados:* ${reportData.analysisCount}

🕐 ${new Date().toLocaleDateString()}`;

    return await this.sendMessage(message);
  }

  async sendWeeklyReport(reportData) {
    const message = `📊 *REPORTE SEMANAL*

📈 *Performance Semanal:*
💰 *PnL Total:* ${reportData.weeklyPnL > 0 ? '+' : ''}${reportData.weeklyPnL.toFixed(2)}%
🎯 *Trades:* ${reportData.totalTrades}
📊 *Win Rate:* ${reportData.winRate.toFixed(1)}%
📉 *Max Drawdown:* ${reportData.maxDrawdown.toFixed(2)}%

🏆 *Mejor Día:* ${reportData.bestDay.date} (${reportData.bestDay.pnl > 0 ? '+' : ''}${reportData.bestDay.pnl.toFixed(2)}%)
📉 *Peor Día:* ${reportData.worstDay.date} (${reportData.worstDay.pnl.toFixed(2)}%)

🎯 *Top Performers:*
${reportData.topPerformers.map(p => `• ${p.symbol}: ${p.pnl > 0 ? '+' : ''}${p.pnl.toFixed(1)}%`).join('\n')}

📊 *Estadísticas:*
• Señales Generadas: ${reportData.signalsGenerated}
• Confluencia Promedio: ${reportData.avgConfluence.toFixed(1)}%
• Tiempo Promedio en Trade: ${reportData.avgTradeTime}h

🕐 Semana del ${reportData.weekStart} al ${reportData.weekEnd}`;

    return await this.sendMessage(message);
  }

  async sendSystemAlert(alertType, message) {
    const emoji = {
      'info': 'ℹ️',
      'warning': '⚠️',
      'error': '🚨',
      'success': '✅'
    }[alertType] || 'ℹ️';

    const alertMessage = `${emoji} *SISTEMA ALERT*

📝 ${message}

🕐 ${new Date().toLocaleString()}

_CryptoTrading AI Advisor_`;

    return await this.sendMessage(alertMessage);
  }
}

module.exports = TelegramService;