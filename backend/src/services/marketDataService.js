/**
 * MARKET DATA SERVICE
 * Servicio centralizado para obtener y procesar datos de mercado
 *
 * Integra múltiples fuentes:
 * - Binance (precios, funding rates)
 * - CoinMarketCap (market cap, dominancia)
 * - Fear & Greed Index
 * - Liquidation maps (futuro)
 */

const axios = require('axios');
const cron = require('node-cron');
const { logger } = require('../utils/logger');

class MarketDataService {
  constructor(binanceService, options = {}) {
    this.binanceService = binanceService;
    this.config = {
      cmcApiKey: options.cmcApiKey || process.env.CMC_API_KEY,
      updateInterval: options.updateInterval || 5, // minutos
      enableScheduler: options.enableScheduler !== false,
      ...options
    };

    // Cache de datos
    this.marketData = new Map();
    this.macroData = {
      fearGreedIndex: null,
      btcDominance: null,
      totalMarketCap: null,
      lastUpdate: null
    };

    // URLs de APIs
    this.apiUrls = {
      coinMarketCap: 'https://pro-api.coinmarketcap.com/v1',
      fearGreed: 'https://api.alternative.me/fng/',
      investing: 'https://api.investing.com' // Para DXY, S&P500 (requiere setup)
    };

    logger.info('MarketDataService initialized', {
      updateInterval: this.config.updateInterval,
      enableScheduler: this.config.enableScheduler
    });
  }

  /**
   * INICIALIZAR SERVICIO
   */
  async initialize() {
    try {
      logger.info('Initializing MarketDataService...');

      // 1. Cargar datos iniciales
      await this.loadInitialMarketData();

      // 2. Configurar scheduler para actualizaciones automáticas
      if (this.config.enableScheduler) {
        this.setupScheduler();
      }

      // 3. Suscribirse a actualizaciones de Binance
      this.setupBinanceSubscription();

      logger.info('MarketDataService initialized successfully');
      return { success: true };

    } catch (error) {
      logger.error('Failed to initialize MarketDataService', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * CARGAR DATOS INICIALES
   */
  async loadInitialMarketData() {
    try {
      logger.info('Loading initial market data...');

      // Cargar en paralelo para optimizar tiempo
      const tasks = [
        this.updateFearGreedIndex(),
        this.updateMarketCapData(),
        this.updateTopCryptosData()
      ];

      await Promise.allSettled(tasks);

      logger.info('Initial market data loaded');

    } catch (error) {
      logger.error('Error loading initial market data', { error: error.message });
      throw error;
    }
  }

  /**
   * ACTUALIZAR ÍNDICE DE MIEDO Y CODICIA
   */
  async updateFearGreedIndex() {
    try {
      const response = await axios.get(`${this.apiUrls.fearGreed}?limit=1`, {
        timeout: 10000
      });

      const data = response.data.data[0];

      this.macroData.fearGreedIndex = {
        value: parseInt(data.value),
        valueClassification: data.value_classification,
        timestamp: new Date(data.timestamp * 1000),
        lastUpdate: new Date()
      };

      logger.info('Fear & Greed Index updated', {
        value: this.macroData.fearGreedIndex.value,
        classification: this.macroData.fearGreedIndex.valueClassification
      });

      return this.macroData.fearGreedIndex;

    } catch (error) {
      logger.error('Failed to update Fear & Greed Index', { error: error.message });
      throw error;
    }
  }

  /**
   * ACTUALIZAR DATOS DE MARKET CAP
   */
  async updateMarketCapData() {
    try {
      if (!this.config.cmcApiKey) {
        logger.warn('CoinMarketCap API key not configured, skipping market cap data');
        return null;
      }

      const response = await axios.get(`${this.apiUrls.coinMarketCap}/global-metrics/quotes/latest`, {
        headers: {
          'X-CMC_PRO_API_KEY': this.config.cmcApiKey
        },
        timeout: 10000
      });

      const globalData = response.data.data;

      this.macroData.totalMarketCap = globalData.quote.USD.total_market_cap;
      this.macroData.btcDominance = globalData.btc_dominance;
      this.macroData.lastUpdate = new Date();

      logger.info('Market cap data updated', {
        totalMarketCap: this.macroData.totalMarketCap,
        btcDominance: this.macroData.btcDominance
      });

      return {
        totalMarketCap: this.macroData.totalMarketCap,
        btcDominance: this.macroData.btcDominance
      };

    } catch (error) {
      logger.error('Failed to update market cap data', { error: error.message });
      // No throw - este dato no es crítico
      return null;
    }
  }

  /**
   * ACTUALIZAR DATOS DE TOP CRYPTOS
   */
  async updateTopCryptosData() {
    try {
      if (!this.config.cmcApiKey) {
        logger.warn('CoinMarketCap API key not configured, using Binance data only');
        return this.updateFromBinanceOnly();
      }

      // Obtener top 50 cryptos con datos fundamentales
      const response = await axios.get(`${this.apiUrls.coinMarketCap}/cryptocurrency/listings/latest`, {
        headers: {
          'X-CMC_PRO_API_KEY': this.config.cmcApiKey
        },
        params: {
          start: 1,
          limit: 50,
          convert: 'USD'
        },
        timeout: 15000
      });

      const cryptos = response.data.data;

      for (const crypto of cryptos) {
        const symbol = `${crypto.symbol}/USDT`;

        // Combinar datos de CMC con precios de Binance
        const binancePrice = this.binanceService.getCurrentPrice(symbol);

        const marketData = {
          symbol: symbol,
          name: crypto.name,
          rank: crypto.cmc_rank,
          marketCap: crypto.quote.USD.market_cap,
          volume24h: crypto.quote.USD.volume_24h,
          circulatingSupply: crypto.circulating_supply,
          maxSupply: crypto.max_supply,
          totalSupply: crypto.total_supply,
          price: binancePrice.success ? binancePrice.data.price : crypto.quote.USD.price,
          change24h: crypto.quote.USD.percent_change_24h,
          change7d: crypto.quote.USD.percent_change_7d,
          lastUpdate: new Date(),
          source: 'coinmarketcap'
        };

        this.marketData.set(symbol, marketData);
      }

      logger.info(`Updated ${cryptos.length} cryptos with market cap data`);
      return cryptos.length;

    } catch (error) {
      logger.error('Failed to update top cryptos data', { error: error.message });
      // Fallback a solo datos de Binance
      return this.updateFromBinanceOnly();
    }
  }

  /**
   * ACTUALIZAR SOLO CON DATOS DE BINANCE (FALLBACK)
   */
  async updateFromBinanceOnly() {
    try {
      const binancePrices = this.binanceService.getAllPrices();

      if (!binancePrices.success) {
        throw new Error('Failed to get prices from Binance');
      }

      let updated = 0;

      for (const [symbol, priceData] of Object.entries(binancePrices.data)) {
        const existing = this.marketData.get(symbol) || {};

        const marketData = {
          ...existing,
          symbol: symbol,
          price: priceData.price,
          volume24h: priceData.volume,
          change24h: priceData.change24h,
          high24h: priceData.high24h,
          low24h: priceData.low24h,
          lastUpdate: new Date(),
          source: 'binance'
        };

        this.marketData.set(symbol, marketData);
        updated++;
      }

      logger.info(`Updated ${updated} cryptos with Binance data only`);
      return updated;

    } catch (error) {
      logger.error('Failed to update from Binance only', { error: error.message });
      throw error;
    }
  }

  /**
   * CONFIGURAR SUSCRIPCIÓN A BINANCE
   */
  setupBinanceSubscription() {
    // Suscribirse a actualizaciones de precios en tiempo real
    this.binanceService.subscribe((symbol, priceData) => {
      const existing = this.marketData.get(symbol);

      if (existing) {
        // Actualizar solo datos de precio, mantener datos fundamentales
        existing.price = priceData.price;
        existing.volume24h = priceData.volume;
        existing.change24h = priceData.change24h;
        existing.high24h = priceData.high24h;
        existing.low24h = priceData.low24h;
        existing.lastUpdate = new Date();

        this.marketData.set(symbol, existing);
      }
    });

    logger.info('Subscribed to Binance price updates');
  }

  /**
   * CONFIGURAR SCHEDULER
   */
  setupScheduler() {
    // Actualizar Fear & Greed cada hora
    cron.schedule('0 * * * *', async () => {
      try {
        await this.updateFearGreedIndex();
      } catch (error) {
        logger.error('Scheduled Fear & Greed update failed', { error: error.message });
      }
    });

    // Actualizar market cap data cada 30 minutos
    cron.schedule('*/30 * * * *', async () => {
      try {
        await this.updateMarketCapData();
      } catch (error) {
        logger.error('Scheduled market cap update failed', { error: error.message });
      }
    });

    // Actualizar datos completos cada 5 minutos
    cron.schedule(`*/${this.config.updateInterval} * * * *`, async () => {
      try {
        await this.updateTopCryptosData();
      } catch (error) {
        logger.error('Scheduled top cryptos update failed', { error: error.message });
      }
    });

    logger.info('Market data scheduler configured', {
      updateInterval: this.config.updateInterval
    });
  }

  /**
   * OBTENER DATOS DE MERCADO DE UN SÍMBOLO
   */
  getMarketData(symbol) {
    const data = this.marketData.get(symbol);

    if (!data) {
      return {
        success: false,
        error: `No market data available for ${symbol}`,
        data: null
      };
    }

    // Verificar edad de los datos
    const ageMs = Date.now() - data.lastUpdate.getTime();

    return {
      success: true,
      data: data,
      age: ageMs,
      isStale: ageMs > 5 * 60 * 1000 // 5 minutos
    };
  }

  /**
   * OBTENER TODOS LOS DATOS DE MERCADO
   */
  getAllMarketData() {
    const data = {};

    for (const [symbol, marketData] of this.marketData) {
      data[symbol] = marketData;
    }

    return {
      success: true,
      data: data,
      count: Object.keys(data).length,
      lastUpdate: this.macroData.lastUpdate
    };
  }

  /**
   * OBTENER DATOS MACRO
   */
  getMacroData() {
    return {
      success: true,
      data: this.macroData
    };
  }

  /**
   * OBTENER TOP CRYPTOS POR MARKET CAP
   */
  getTopCryptosByMarketCap(limit = 20) {
    const cryptos = Array.from(this.marketData.values())
      .filter(crypto => crypto.marketCap && crypto.rank)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);

    return {
      success: true,
      data: cryptos,
      count: cryptos.length
    };
  }

  /**
   * BUSCAR OPORTUNIDADES DE TRADING
   * Análisis básico basado en los datos disponibles
   */
  findTradingOpportunities() {
    const opportunities = [];

    // Análisis basado en Fear & Greed Index
    if (this.macroData.fearGreedIndex) {
      const fgi = this.macroData.fearGreedIndex.value;

      if (fgi <= 25) {
        opportunities.push({
          type: 'MACRO_OPPORTUNITY',
          signal: 'POTENTIAL_BOTTOM',
          reason: `Fear & Greed Index muy bajo: ${fgi} (Miedo Extremo)`,
          confidence: 70,
          timeframe: 'medium',
          recommendation: 'Considerar LONGs en BTC/ETH principales'
        });
      } else if (fgi >= 75) {
        opportunities.push({
          type: 'MACRO_WARNING',
          signal: 'POTENTIAL_TOP',
          reason: `Fear & Greed Index muy alto: ${fgi} (Codicia Extrema)`,
          confidence: 70,
          timeframe: 'medium',
          recommendation: 'Precaución con LONGs, considerar SHORTs'
        });
      }
    }

    // Análisis de dominancia BTC
    if (this.macroData.btcDominance) {
      const dominance = this.macroData.btcDominance;

      if (dominance < 40) {
        opportunities.push({
          type: 'ALTSEASON_SIGNAL',
          signal: 'POTENTIAL_ALTSEASON',
          reason: `BTC Dominance baja: ${dominance.toFixed(1)}%`,
          confidence: 60,
          timeframe: 'medium',
          recommendation: 'Favorable para ALTCOINs vs BTC'
        });
      }
    }

    return {
      success: true,
      data: opportunities,
      count: opportunities.length,
      timestamp: new Date()
    };
  }

  /**
   * HEALTH CHECK
   */
  getHealthStatus() {
    const marketDataCount = this.marketData.size;
    const hasFearGreed = !!this.macroData.fearGreedIndex;
    const hasBtcDominance = !!this.macroData.btcDominance;

    const isHealthy = marketDataCount >= 10 && hasFearGreed;

    return {
      healthy: isHealthy,
      marketDataCount,
      hasFearGreed,
      hasBtcDominance,
      lastMacroUpdate: this.macroData.lastUpdate,
      binanceService: this.binanceService ? 'connected' : 'disconnected'
    };
  }

  /**
   * CERRAR SERVICIO
   */
  async close() {
    logger.info('Closing MarketDataService...');

    // Limpiar cache
    this.marketData.clear();
    this.macroData = {
      fearGreedIndex: null,
      btcDominance: null,
      totalMarketCap: null,
      lastUpdate: null
    };

    logger.info('MarketDataService closed');
  }
}

module.exports = MarketDataService;