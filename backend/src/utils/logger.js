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

// Logger específico para señales de trading
const signalLogger = {
  /**
   * Log generación de señales
   */
  logSignalGeneration(data) {
    logger.info('SIGNAL_GENERATION', {
      type: 'TRADING_SIGNALS',
      action: 'GENERATE_SIGNAL',
      symbol: data.symbol,
      direction: data.direction,
      confluenceScore: data.confluenceScore,
      success: data.success,
      riskReward: data.riskReward,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log errores de señales
   */
  logSignalError(symbol, error, context = {}) {
    logger.error('SIGNAL_ERROR', {
      type: 'TRADING_SIGNALS',
      action: 'SIGNAL_ERROR',
      symbol,
      error: {
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log escaneo múltiple
   */
  logBulkScan(data) {
    logger.info('BULK_SCAN', {
      type: 'TRADING_SIGNALS',
      action: 'BULK_SCAN',
      symbolsScanned: data.symbolsScanned,
      validSignals: data.validSignals,
      avgConfluence: data.avgConfluence,
      duration: data.duration,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log llamadas a API
   */
  logApiCall(endpoint, method, params, response, duration) {
    logger.info('API_CALL', {
      type: 'API',
      action: 'HTTP_REQUEST',
      endpoint,
      method,
      statusCode: response?.status,
      success: response?.success,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
};

// Función para obtener estadísticas de logs
const getLogStats = () => {
  const stats = {
    logsDirectory: logsDir,
    files: []
  };

  try {
    const files = fs.readdirSync(logsDir);
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stat = fs.statSync(filePath);
      stats.files.push({
        name: file,
        size: stat.size,
        modified: stat.mtime,
        sizeFormatted: `${(stat.size / 1024 / 1024).toFixed(2)} MB`
      });
    });
  } catch (error) {
    logger.warn('Could not read logs directory stats', { error: error.message });
  }

  return stats;
};

// Middleware para Express logging
const expressLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info('HTTP_REQUEST', {
      type: 'HTTP',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  });

  next();
};

module.exports = {
  logger,
  riskLogger,
  signalLogger,
  getLogStats,
  expressLogger
};