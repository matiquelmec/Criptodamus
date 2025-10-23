/**
 * BINANCE API SERVICE
 * Servicio para conectarse a Binance y obtener datos de mercado en tiempo real
 *
 * Funcionalidades:
 * - Precios en tiempo real (REST + WebSocket)
 * - Top 50 criptomonedas por market cap
 * - Datos de futuros (funding rates, liquidaciones)
 * - Manejo robusto de errores y reconexión
 */

const ccxt = require('ccxt');
const WebSocket = require('ws');
const axios = require('axios');
const { logger } = require('../utils/logger');

class BinanceService {
  constructor(options = {}) {
    this.config = {
      testnet: options.testnet || false,
      apiKey: options.apiKey || process.env.BINANCE_API_KEY,
      secret: options.secret || process.env.BINANCE_SECRET_KEY,
      enableRateLimit: true,
      timeout: 30000,
      ...options
    };

    // Inicializar exchange con CCXT
    this.exchange = new ccxt.binance({
      apiKey: this.config.apiKey,
      secret: this.config.secret,
      testnet: this.config.testnet,
      enableRateLimit: this.config.enableRateLimit,
      timeout: this.config.timeout,
      options: {
        defaultType: 'future' // Usar futuros por defecto
      }
    });

    // URLs de WebSocket
    this.wsUrls = {
      spot: 'wss://stream.binance.com:9443/ws',
      futures: 'wss://fstream.binance.com/ws'
    };

    // Estado interno
    this.wsConnections = new Map();
    this.priceCache = new Map();
    this.subscribers = new Map();
    this.lastPriceUpdate = new Date();

    // Top 50 cryptos a monitorear (expandido para análisis completo)
    this.topSymbols = [
      // Top 10
      'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT',
      'SOL/USDT', 'DOT/USDT', 'LTC/USDT', 'LINK/USDT', 'POL/USDT',

      // Top 11-20
      'AVAX/USDT', 'UNI/USDT', 'ATOM/USDT', 'NEAR/USDT', 'AAVE/USDT',
      'FIL/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT', 'GALA/USDT',

      // Top 21-30
      'DOGE/USDT', 'SHIB/USDT', 'TRX/USDT', 'VET/USDT', 'XLM/USDT',
      'ALGO/USDT', 'ICP/USDT', 'EOS/USDT', 'THETA/USDT', 'FLOW/USDT',

      // Top 31-40
      'HBAR/USDT', 'EGLD/USDT', 'CHZ/USDT', 'ENJ/USDT', 'CRV/USDT',
      'MKR/USDT', 'COMP/USDT', 'YFI/USDT', 'SNX/USDT', 'SUI/USDT',

      // Top 41-50
      'APT/USDT', 'ARB/USDT', 'OP/USDT', 'INJ/USDT', 'LDO/USDT',
      'STX/USDT', 'TON/USDT', 'TIA/USDT', 'FET/USDT', 'RNDR/USDT'
    ];

    logger.info('BinanceService initialized', {
      testnet: this.config.testnet,
      enableRateLimit: this.config.enableRateLimit,
      topSymbolsCount: this.topSymbols.length
    });
  }

  /**
   * INICIALIZAR CONEXIONES
   * Configurar conexiones WebSocket y cache inicial
   */
  async initialize() {
    try {
      logger.info('Initializing BinanceService...');

      // 1. Verificar conectividad
      await this.testConnection();

      // 2. Cargar precios iniciales
      await this.loadInitialPrices();

      // 3. Configurar WebSocket para precios en tiempo real
      await this.setupWebSocketStreams();

      // 4. Configurar limpieza periódica
      this.setupPeriodicTasks();

      logger.info('BinanceService initialized successfully');
      return { success: true, message: 'Binance service initialized' };

    } catch (error) {
      logger.error('Failed to initialize BinanceService', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * TEST DE CONEXIÓN
   * Verificar que podemos conectarnos a Binance
   */
  async testConnection() {
    try {
      const serverTime = await this.exchange.fetchTime();
      const timeDiff = Math.abs(Date.now() - serverTime);

      if (timeDiff > 30000) { // 30 segundos
        throw new Error(`Server time difference too large: ${timeDiff}ms`);
      }

      logger.info('Binance connection test successful', {
        serverTime: new Date(serverTime).toISOString(),
        timeDiff: timeDiff
      });

      return true;
    } catch (error) {
      logger.error('Binance connection test failed', { error: error.message });
      throw error;
    }
  }

  /**
   * CARGAR PRECIOS INICIALES
   * Obtener snapshot inicial de precios via REST API
   */
  async loadInitialPrices() {
    try {
      logger.info('Loading initial prices for top symbols...');

      // Obtener todos los tickers de una vez
      const tickers = await this.exchange.fetchTickers();
      let loadedCount = 0;

      for (const symbol of this.topSymbols) {
        if (tickers[symbol]) {
          const ticker = tickers[symbol];

          this.priceCache.set(symbol, {
            symbol: symbol,
            price: ticker.last,
            bid: ticker.bid,
            ask: ticker.ask,
            volume: ticker.baseVolume,
            change24h: ticker.percentage,
            high24h: ticker.high,
            low24h: ticker.low,
            timestamp: ticker.timestamp,
            lastUpdate: new Date()
          });

          loadedCount++;
        }
      }

      this.lastPriceUpdate = new Date();

      logger.info(`Initial prices loaded: ${loadedCount}/${this.topSymbols.length} symbols`);
      return loadedCount;

    } catch (error) {
      logger.error('Failed to load initial prices', { error: error.message });
      throw error;
    }
  }

  /**
   * CONFIGURAR WEBSOCKETS
   * Establecer streams de precios en tiempo real
   */
  async setupWebSocketStreams() {
    try {
      logger.info('Setting up WebSocket streams...');

      // Convertir símbolos a formato de stream de Binance
      const streamSymbols = this.topSymbols.map(symbol => {
        return symbol.replace('/', '').toLowerCase() + '@ticker';
      });

      // Crear stream combinado
      const streamUrl = `${this.wsUrls.futures}/stream?streams=${streamSymbols.join('/')}`;

      const ws = new WebSocket(streamUrl);

      ws.on('open', () => {
        logger.info('Binance WebSocket connected');
        this.wsConnections.set('priceStream', ws);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handlePriceUpdate(message);
        } catch (error) {
          logger.error('Error parsing WebSocket message', { error: error.message });
        }
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error: error.message });
        this.reconnectWebSocket();
      });

      ws.on('close', () => {
        logger.warn('WebSocket connection closed, attempting to reconnect...');
        setTimeout(() => this.reconnectWebSocket(), 5000);
      });

      return true;

    } catch (error) {
      logger.error('Failed to setup WebSocket streams', { error: error.message });
      throw error;
    }
  }

  /**
   * MANEJAR ACTUALIZACIONES DE PRECIO
   * Procesar mensajes del WebSocket y actualizar cache
   */
  handlePriceUpdate(message) {
    try {
      if (message.stream && message.data) {
        const ticker = message.data;

        // Convertir símbolo de vuelta al formato estándar
        const symbol = (ticker.s.replace('USDT', '/USDT')).toUpperCase();

        if (this.topSymbols.includes(symbol)) {
          const priceData = {
            symbol: symbol,
            price: parseFloat(ticker.c),
            bid: parseFloat(ticker.b),
            ask: parseFloat(ticker.a),
            volume: parseFloat(ticker.v),
            change24h: parseFloat(ticker.P),
            high24h: parseFloat(ticker.h),
            low24h: parseFloat(ticker.l),
            timestamp: ticker.E,
            lastUpdate: new Date()
          };

          this.priceCache.set(symbol, priceData);
          this.lastPriceUpdate = new Date();

          // Notificar a subscribers
          this.notifySubscribers(symbol, priceData);
        }
      }
    } catch (error) {
      logger.error('Error handling price update', { error: error.message });
    }
  }

  /**
   * OBTENER PRECIO ACTUAL
   * API pública para obtener precio de un símbolo
   */
  getCurrentPrice(symbol) {
    const cached = this.priceCache.get(symbol);

    if (!cached) {
      return {
        success: false,
        error: `Symbol ${symbol} not found in cache`,
        data: null
      };
    }

    // Verificar que el precio no sea muy viejo (más de 1 minuto)
    const ageMs = Date.now() - cached.lastUpdate.getTime();
    if (ageMs > 60000) {
      return {
        success: false,
        error: `Price data too old: ${Math.round(ageMs/1000)}s`,
        data: cached
      };
    }

    return {
      success: true,
      data: cached,
      age: ageMs
    };
  }

  /**
   * OBTENER TODOS LOS PRECIOS
   * Devolver snapshot de todos los precios cached
   */
  getAllPrices() {
    const prices = {};

    for (const [symbol, data] of this.priceCache) {
      prices[symbol] = data;
    }

    return {
      success: true,
      data: prices,
      count: Object.keys(prices).length,
      lastUpdate: this.lastPriceUpdate
    };
  }

  /**
   * OBTENER DATOS DE FUTUROS
   * Información específica de futuros (funding rate, etc.)
   */
  async getFuturesData(symbol) {
    try {
      // Obtener funding rate
      const fundingRate = await this.exchange.fetchFundingRate(symbol);

      // Obtener open interest (si está disponible)
      let openInterest = null;
      try {
        const oiData = await this.exchange.fetchOpenInterest(symbol);
        openInterest = oiData;
      } catch (error) {
        // Open interest no disponible para todos los símbolos
      }

      return {
        success: true,
        data: {
          symbol: symbol,
          fundingRate: fundingRate.fundingRate,
          fundingTimestamp: fundingRate.timestamp,
          nextFundingTime: fundingRate.fundingDatetime,
          openInterest: openInterest,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      logger.error(`Error fetching futures data for ${symbol}`, { error: error.message });
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * SUSCRIBIRSE A ACTUALIZACIONES
   * Permitir que otros módulos se suscriban a cambios de precio
   */
  subscribe(callback, symbols = null) {
    const subscriberId = Date.now().toString();

    this.subscribers.set(subscriberId, {
      callback: callback,
      symbols: symbols || this.topSymbols,
      createdAt: new Date()
    });

    logger.info(`New subscriber added: ${subscriberId}`, {
      symbols: symbols ? symbols.length : 'all'
    });

    return subscriberId;
  }

  /**
   * DESUSCRIBIRSE
   */
  unsubscribe(subscriberId) {
    const removed = this.subscribers.delete(subscriberId);
    if (removed) {
      logger.info(`Subscriber removed: ${subscriberId}`);
    }
    return removed;
  }

  /**
   * NOTIFICAR SUBSCRIBERS
   */
  notifySubscribers(symbol, priceData) {
    for (const [id, subscriber] of this.subscribers) {
      try {
        if (subscriber.symbols.includes(symbol)) {
          subscriber.callback(symbol, priceData);
        }
      } catch (error) {
        logger.error(`Error notifying subscriber ${id}`, { error: error.message });
      }
    }
  }

  /**
   * RECONECTAR WEBSOCKET
   */
  async reconnectWebSocket() {
    try {
      // Cerrar conexión existente
      const existingWs = this.wsConnections.get('priceStream');
      if (existingWs) {
        existingWs.close();
        this.wsConnections.delete('priceStream');
      }

      // Esperar un momento antes de reconectar
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Reconectar
      await this.setupWebSocketStreams();

    } catch (error) {
      logger.error('Failed to reconnect WebSocket', { error: error.message });
      // Retry en 10 segundos
      setTimeout(() => this.reconnectWebSocket(), 10000);
    }
  }

  /**
   * CONFIGURAR TAREAS PERIÓDICAS
   */
  setupPeriodicTasks() {
    // Limpiar cache viejo cada 5 minutos
    setInterval(() => {
      this.cleanOldData();
    }, 5 * 60 * 1000);

    // Health check cada minuto
    setInterval(() => {
      this.healthCheck();
    }, 60 * 1000);
  }

  /**
   * LIMPIAR DATOS VIEJOS
   */
  cleanOldData() {
    const now = Date.now();
    let cleaned = 0;

    for (const [symbol, data] of this.priceCache) {
      const age = now - data.lastUpdate.getTime();
      if (age > 10 * 60 * 1000) { // 10 minutos
        this.priceCache.delete(symbol);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} old price entries`);
    }
  }

  /**
   * HEALTH CHECK
   */
  healthCheck() {
    const cacheSize = this.priceCache.size;
    const expectedSize = this.topSymbols.length;
    const lastUpdateAge = Date.now() - this.lastPriceUpdate.getTime();
    const wsConnected = this.wsConnections.has('priceStream');

    const isHealthy = cacheSize >= expectedSize * 0.8 && // Al menos 80% de símbolos
                     lastUpdateAge < 60000 && // Actualización en último minuto
                     wsConnected; // WebSocket conectado

    if (!isHealthy) {
      logger.warn('BinanceService health check failed', {
        cacheSize,
        expectedSize,
        lastUpdateAge,
        wsConnected
      });

      // Auto-recovery si es necesario
      if (!wsConnected || lastUpdateAge > 120000) {
        this.reconnectWebSocket();
      }
    }

    return {
      healthy: isHealthy,
      cacheSize,
      expectedSize,
      lastUpdateAge,
      wsConnected,
      subscribersCount: this.subscribers.size
    };
  }

  /**
   * CERRAR CONEXIONES
   */
  async close() {
    logger.info('Closing BinanceService...');

    // Cerrar WebSocket connections
    for (const [name, ws] of this.wsConnections) {
      ws.close();
    }

    // Limpiar cache y subscribers
    this.priceCache.clear();
    this.subscribers.clear();
    this.wsConnections.clear();

    logger.info('BinanceService closed');
  }
}

module.exports = BinanceService;