/**
 * VALIDATION MIDDLEWARE - MIDDLEWARE DE VALIDACIÓN PARA RUTAS API
 *
 * Middleware reutilizable para validación de parámetros y datos
 */

/**
 * Validar símbolo de trading
 */
const validateSymbol = (req, res, next) => {
  const { symbol } = req.params;

  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Símbolo es requerido'
    });
  }

  if (typeof symbol !== 'string' || symbol.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Símbolo inválido - debe tener al menos 3 caracteres'
    });
  }

  // Convertir a mayúsculas para estandarizar
  req.params.symbol = symbol.toUpperCase();
  next();
};

/**
 * Validar timeframe
 */
const validateTimeframe = (req, res, next) => {
  const { timeframe } = req.query;
  const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];

  if (timeframe && !validTimeframes.includes(timeframe)) {
    return res.status(400).json({
      success: false,
      error: `Timeframe inválido. Válidos: ${validTimeframes.join(', ')}`
    });
  }

  next();
};

/**
 * Validar límites numéricos
 */
const validateNumericLimits = (field, min = 0, max = Infinity) => {
  return (req, res, next) => {
    const value = req.query[field] || req.body[field];

    if (value !== undefined) {
      const numValue = Number(value);

      if (isNaN(numValue)) {
        return res.status(400).json({
          success: false,
          error: `${field} debe ser un número válido`
        });
      }

      if (numValue < min || numValue > max) {
        return res.status(400).json({
          success: false,
          error: `${field} debe estar entre ${min} y ${max}`
        });
      }

      // Actualizar con el valor numérico parseado
      if (req.query[field] !== undefined) {
        req.query[field] = numValue;
      }
      if (req.body[field] !== undefined) {
        req.body[field] = numValue;
      }
    }

    next();
  };
};

/**
 * Validar estrategia de promediación
 */
const validateAveragingStrategy = (req, res, next) => {
  const { strategy } = req.query;
  const validStrategies = ['DCA', 'PYRAMID', 'SCALE_IN', 'SCALE_OUT'];

  if (strategy && !validStrategies.includes(strategy)) {
    return res.status(400).json({
      success: false,
      error: `Estrategia inválida. Válidas: ${validStrategies.join(', ')}`
    });
  }

  next();
};

/**
 * Validar severidad de alertas
 */
const validateSeverity = (req, res, next) => {
  const { severity } = req.query;
  const validSeverities = ['all', 'info', 'warning', 'critical'];

  if (severity && !validSeverities.includes(severity)) {
    return res.status(400).json({
      success: false,
      error: `Severidad inválida. Válidas: ${validSeverities.join(', ')}`
    });
  }

  next();
};

/**
 * Validar datos requeridos en el body
 */
const validateRequiredFields = (fields) => {
  return (req, res, next) => {
    const missingFields = [];

    fields.forEach(field => {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Campos requeridos faltantes: ${missingFields.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Middleware general de manejo de errores
 */
const handleErrors = (err, req, res, next) => {
  console.error('Error en middleware:', err);

  // Error de validación de Joi o similar
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Error de validación',
      details: err.details || err.message
    });
  }

  // Error de sintaxis JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'JSON inválido en el cuerpo de la solicitud'
    });
  }

  // Error de límite de tamaño
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Solicitud demasiado grande'
    });
  }

  // Error interno del servidor
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error inesperado'
  });
};

/**
 * Validar paginación
 */
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      success: false,
      error: 'Página debe ser un número mayor a 0'
    });
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      success: false,
      error: 'Límite debe ser un número entre 1 y 100'
    });
  }

  req.pagination = {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum
  };

  next();
};

/**
 * Sanitizar entrada de texto
 */
const sanitizeInput = (req, res, next) => {
  // Función recursiva para sanitizar objetos
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remover caracteres peligrosos básicos
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .trim();
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj && typeof obj === 'object') {
      const sanitized = {};
      Object.keys(obj).forEach(key => {
        sanitized[key] = sanitize(obj[key]);
      });
      return sanitized;
    }

    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
};

module.exports = {
  validateSymbol,
  validateTimeframe,
  validateNumericLimits,
  validateAveragingStrategy,
  validateSeverity,
  validateRequiredFields,
  validatePagination,
  sanitizeInput,
  handleErrors
};