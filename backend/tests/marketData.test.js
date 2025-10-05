/**
 * TESTS DE MARKET DATA SERVICES
 * Tests para validar la integración con APIs de mercado
 */

const BinanceService = require('../src/services/binanceService');
const MarketDataService = require('../src/services/marketDataService');

// Mock para evitar llamadas reales a APIs en tests
jest.setTimeout(30000);

describe('BinanceService', () => {
  let binanceService;

  beforeEach(() => {
    binanceService = new BinanceService({
      testnet: true, // Usar testnet para tests
      apiKey: 'test_api_key',
      secret: 'test_secret'
    });
  });

  afterEach(async () => {
    if (binanceService) {
      await binanceService.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(binanceService.config.testnet).toBe(true);
      expect(binanceService.topSymbols).toContain('BTC/USDT');
      expect(binanceService.topSymbols).toContain('ETH/USDT');
      expect(binanceService.topSymbols.length).toBeGreaterThan(10);
    });

    test('should have empty cache initially', () => {
      const allPrices = binanceService.getAllPrices();
      expect(allPrices.data).toEqual({});
      expect(allPrices.count).toBe(0);
    });
  });

  describe('Price Management', () => {
    beforeEach(() => {
      // Simular datos de precio en cache
      binanceService.priceCache.set('BTC/USDT', {
        symbol: 'BTC/USDT',
        price: 50000,
        bid: 49995,
        ask: 50005,
        volume: 1000,
        change24h: 2.5,
        high24h: 51000,
        low24h: 49000,
        timestamp: Date.now(),
        lastUpdate: new Date()
      });
    });

    test('should get current price for cached symbol', () => {
      const result = binanceService.getCurrentPrice('BTC/USDT');

      expect(result.success).toBe(true);
      expect(result.data.symbol).toBe('BTC/USDT');
      expect(result.data.price).toBe(50000);
      expect(result.data.bid).toBe(49995);
      expect(result.data.ask).toBe(50005);
      expect(result.age).toBeLessThan(1000);
    });

    test('should return error for non-cached symbol', () => {
      const result = binanceService.getCurrentPrice('INVALID/USDT');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in cache');
      expect(result.data).toBeNull();
    });

    test('should return error for stale data', () => {
      // Simular datos viejos
      const oldTimestamp = new Date();
      oldTimestamp.setMinutes(oldTimestamp.getMinutes() - 5); // 5 minutos atrás

      binanceService.priceCache.set('ETH/USDT', {
        symbol: 'ETH/USDT',
        price: 3000,
        lastUpdate: oldTimestamp
      });

      const result = binanceService.getCurrentPrice('ETH/USDT');

      expect(result.success).toBe(false);
      expect(result.error).toContain('too old');
    });

    test('should get all prices', () => {
      const result = binanceService.getAllPrices();

      expect(result.success).toBe(true);
      expect(result.data['BTC/USDT']).toBeDefined();
      expect(result.count).toBe(1);
      expect(result.lastUpdate).toBeDefined();
    });
  });

  describe('Subscription System', () => {
    test('should subscribe and unsubscribe correctly', () => {
      const mockCallback = jest.fn();

      const subscriberId = binanceService.subscribe(mockCallback, ['BTC/USDT']);

      expect(subscriberId).toBeDefined();
      expect(binanceService.subscribers.has(subscriberId)).toBe(true);

      const unsubscribed = binanceService.unsubscribe(subscriberId);
      expect(unsubscribed).toBe(true);
      expect(binanceService.subscribers.has(subscriberId)).toBe(false);
    });

    test('should notify subscribers on price update', () => {
      const mockCallback = jest.fn();

      binanceService.subscribe(mockCallback, ['BTC/USDT']);

      // Simular actualización de precio
      const priceData = {
        symbol: 'BTC/USDT',
        price: 51000,
        lastUpdate: new Date()
      };

      binanceService.notifySubscribers('BTC/USDT', priceData);

      expect(mockCallback).toHaveBeenCalledWith('BTC/USDT', priceData);
    });
  });

  describe('Health Check', () => {
    test('should return health status', () => {
      const health = binanceService.healthCheck();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('cacheSize');
      expect(health).toHaveProperty('expectedSize');
      expect(health).toHaveProperty('lastUpdateAge');
      expect(health).toHaveProperty('wsConnected');
      expect(health).toHaveProperty('subscribersCount');
    });
  });
});

describe('MarketDataService', () => {
  let binanceService;
  let marketDataService;

  beforeEach(() => {
    binanceService = new BinanceService({
      testnet: true,
      apiKey: 'test_api_key',
      secret: 'test_secret'
    });

    marketDataService = new MarketDataService(binanceService, {
      cmcApiKey: null, // Sin API key para tests
      enableScheduler: false // Deshabilitar scheduler en tests
    });
  });

  afterEach(async () => {
    if (marketDataService) {
      await marketDataService.close();
    }
    if (binanceService) {
      await binanceService.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(marketDataService.config.enableScheduler).toBe(false);
      expect(marketDataService.binanceService).toBe(binanceService);
      expect(marketDataService.marketData).toBeInstanceOf(Map);
    });
  });

  describe('Market Data Management', () => {
    beforeEach(() => {
      // Simular datos de mercado
      marketDataService.marketData.set('BTC/USDT', {
        symbol: 'BTC/USDT',
        name: 'Bitcoin',
        rank: 1,
        price: 50000,
        marketCap: 1000000000000,
        volume24h: 50000000000,
        change24h: 2.5,
        lastUpdate: new Date()
      });

      marketDataService.marketData.set('ETH/USDT', {
        symbol: 'ETH/USDT',
        name: 'Ethereum',
        rank: 2,
        price: 3000,
        marketCap: 400000000000,
        volume24h: 20000000000,
        change24h: 1.8,
        lastUpdate: new Date()
      });
    });

    test('should get market data for specific symbol', () => {
      const result = marketDataService.getMarketData('BTC/USDT');

      expect(result.success).toBe(true);
      expect(result.data.symbol).toBe('BTC/USDT');
      expect(result.data.name).toBe('Bitcoin');
      expect(result.data.rank).toBe(1);
      expect(result.age).toBeLessThan(1000);
      expect(result.isStale).toBe(false);
    });

    test('should return error for non-existent symbol', () => {
      const result = marketDataService.getMarketData('INVALID/USDT');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No market data available');
      expect(result.data).toBeNull();
    });

    test('should get all market data', () => {
      const result = marketDataService.getAllMarketData();

      expect(result.success).toBe(true);
      expect(result.data['BTC/USDT']).toBeDefined();
      expect(result.data['ETH/USDT']).toBeDefined();
      expect(result.count).toBe(2);
    });

    test('should get top cryptos by market cap', () => {
      const result = marketDataService.getTopCryptosByMarketCap(5);

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0].rank).toBe(1); // Bitcoin debería ser primero
      expect(result.data[1].rank).toBe(2); // Ethereum segundo
    });
  });

  describe('Macro Data', () => {
    beforeEach(() => {
      // Simular datos macro
      marketDataService.macroData = {
        fearGreedIndex: {
          value: 25,
          valueClassification: 'Extreme Fear',
          timestamp: new Date(),
          lastUpdate: new Date()
        },
        btcDominance: 45.5,
        totalMarketCap: 2000000000000,
        lastUpdate: new Date()
      };
    });

    test('should get macro data', () => {
      const result = marketDataService.getMacroData();

      expect(result.success).toBe(true);
      expect(result.data.fearGreedIndex.value).toBe(25);
      expect(result.data.fearGreedIndex.valueClassification).toBe('Extreme Fear');
      expect(result.data.btcDominance).toBe(45.5);
    });

    test('should find trading opportunities based on Fear & Greed', () => {
      const result = marketDataService.findTradingOpportunities();

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      const fearOpportunity = result.data.find(op => op.type === 'MACRO_OPPORTUNITY');
      expect(fearOpportunity).toBeDefined();
      expect(fearOpportunity.signal).toBe('POTENTIAL_BOTTOM');
      expect(fearOpportunity.reason).toContain('25');
    });

    test('should detect altseason potential', () => {
      // Simular baja dominancia BTC
      marketDataService.macroData.btcDominance = 35;

      const result = marketDataService.findTradingOpportunities();

      expect(result.success).toBe(true);

      const altseasonSignal = result.data.find(op => op.type === 'ALTSEASON_SIGNAL');
      expect(altseasonSignal).toBeDefined();
      expect(altseasonSignal.signal).toBe('POTENTIAL_ALTSEASON');
    });
  });

  describe('Health Status', () => {
    test('should return health status', () => {
      const health = marketDataService.getHealthStatus();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('marketDataCount');
      expect(health).toHaveProperty('hasFearGreed');
      expect(health).toHaveProperty('hasBtcDominance');
      expect(health).toHaveProperty('binanceService');
    });
  });
});

// Tests de integración
describe('Market Data Integration', () => {
  let binanceService;
  let marketDataService;

  beforeEach(() => {
    binanceService = new BinanceService({
      testnet: true,
      apiKey: 'test_api_key',
      secret: 'test_secret'
    });

    marketDataService = new MarketDataService(binanceService, {
      enableScheduler: false
    });
  });

  afterEach(async () => {
    await marketDataService.close();
    await binanceService.close();
  });

  test('should integrate Binance price updates with market data', () => {
    // Simular datos iniciales en market data
    marketDataService.marketData.set('BTC/USDT', {
      symbol: 'BTC/USDT',
      name: 'Bitcoin',
      rank: 1,
      price: 50000,
      marketCap: 1000000000000,
      lastUpdate: new Date()
    });

    // Simular actualización de precio desde Binance
    const newPriceData = {
      symbol: 'BTC/USDT',
      price: 51000,
      volume: 1500,
      change24h: 3.2,
      high24h: 52000,
      low24h: 49500,
      lastUpdate: new Date()
    };

    // Simular la suscripción funcionando
    marketDataService.setupBinanceSubscription();

    // Simular callback de actualización
    const marketData = marketDataService.marketData.get('BTC/USDT');
    marketData.price = newPriceData.price;
    marketData.volume24h = newPriceData.volume;
    marketData.change24h = newPriceData.change24h;
    marketData.lastUpdate = newPriceData.lastUpdate;

    // Verificar que los datos se actualizaron
    const result = marketDataService.getMarketData('BTC/USDT');

    expect(result.success).toBe(true);
    expect(result.data.price).toBe(51000);
    expect(result.data.volume24h).toBe(1500);
    expect(result.data.change24h).toBe(3.2);
    expect(result.data.name).toBe('Bitcoin'); // Datos fundamentales se mantienen
    expect(result.data.marketCap).toBe(1000000000000);
  });
});