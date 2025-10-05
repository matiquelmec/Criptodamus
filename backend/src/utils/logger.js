/**
 * LOGGER SYSTEM
 * Sistema de logging para monitorear decisiones críticas de risk management
 */

const winston = require('winston');
const path = require('path');

// Crear directorio de logs si no existe
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuración del logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cryptotrading-ai-advisor' },
  transports: [
    // Log de errores críticos
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    // Log de decisiones de risk management
    new winston.transports.File({
      filename: path.join(logsDir, 'risk-decisions.log'),
      level: 'info'
    }),
    // Log combinado
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    })
  ]
});

// En desarrollo, también mostrar en consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Métodos específicos para risk management
const riskLogger = {
  /**
   * Log decisiones de cálculo de posición
   */
  logPositionCalculation(data) {
    logger.info('POSITION_CALCULATION', {
      type: 'RISK_MANAGEMENT',
      action: 'CALCULATE_POSITION',
      accountBalance: data.accountBalance,
      entryPrice: data.entryPrice,
      stopLossPrice: data.stopLossPrice,
      leverage: data.leverage,
      result: data.result,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log validaciones de Stop Loss
   */
  logStopLossValidation(data) {
    logger.info('STOP_LOSS_VALIDATION', {
      type: 'RISK_MANAGEMENT',
      action: 'VALIDATE_STOP_LOSS',
      entryPrice: data.entryPrice,
      stopLossPrice: data.stopLossPrice,
      isValid: data.isValid,
      warnings: data.warnings,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log movimientos de Stop Loss a breakeven
   */
  logBreakevenProtection(data) {
    logger.warn('BREAKEVEN_PROTECTION', {
      type: 'RISK_MANAGEMENT',
      action: 'MOVE_STOP_TO_BREAKEVEN',
      entryPrice: data.entryPrice,
      currentPrice: data.currentPrice,
      oldStopLoss: data.oldStopLoss,
      newStopLoss: data.newStopLoss,
      profitPercent: data.profitPercent,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log detección de malas rachas
   */
  logTradingStreak(data) {
    if (data.shouldPause || data.emergencyStop) {
      logger.error('TRADING_STREAK_WARNING', {
        type: 'RISK_MANAGEMENT',
        action: 'STREAK_DETECTION',
        consecutiveLosses: data.consecutiveLosses,
        totalDrawdown: data.totalDrawdown,
        shouldPause: data.shouldPause,
        emergencyStop: data.emergencyStop,
        recommendations: data.recommendations,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.info('TRADING_STREAK_OK', {
        type: 'RISK_MANAGEMENT',
        action: 'STREAK_CHECK',
        consecutiveLosses: data.consecutiveLosses,
        totalDrawdown: data.totalDrawdown,
        timestamp: new Date().toISOString()
      });
    }
  },

  /**
   * Log errores críticos
   */
  logCriticalError(error, context) {
    logger.error('CRITICAL_ERROR', {
      type: 'RISK_MANAGEMENT',
      action: 'CRITICAL_ERROR',
      error: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log configuración del sistema
   */
  logSystemConfig(config) {
    logger.info('SYSTEM_CONFIG', {
      type: 'SYSTEM',
      action: 'CONFIG_LOADED',
      config: config,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { logger, riskLogger };