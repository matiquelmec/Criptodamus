const TechnicalAnalysisService = require('../src/services/technicalAnalysisService');

// Mock logger para testing
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}), { virtual: true });

describe('TechnicalAnalysisService', () => {
  let analysisService;

  beforeEach(() => {
    analysisService = new TechnicalAnalysisService();
  });

  afterEach(() => {
    analysisService.clearCache();
  });

  describe('RSI Calculation', () => {
    test('should calculate RSI correctly with sample data', () => {
      const prices = [
        44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 47.04, 49.03, 47.42,
        48.18, 46.57, 46.83, 46.42, 48.25, 58.73, 58.75, 58.47, 58.65, 58.47
      ];

      const rsi = analysisService.calculateRSI(prices, 14);

      expect(rsi).toBeDefined();
      expect(rsi.length).toBeGreaterThan(0);
      expect(rsi[rsi.length - 1]).toBeGreaterThanOrEqual(0);
      expect(rsi[rsi.length - 1]).toBeLessThanOrEqual(100);
    });

    test('should throw error with insufficient data', () => {
      const prices = [44.34, 44.09, 44.15]; // Solo 3 precios, necesita 15 para RSI(14)

      expect(() => {
        analysisService.calculateRSI(prices, 14);
      }).toThrow('Insuficientes datos para RSI');
    });

    test('should detect extreme RSI conditions', () => {
      // Datos simulados para RSI extremo
      const increasingPrices = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      const decreasingPrices = Array.from({ length: 30 }, (_, i) => 100 - i * 2);

      const rsiIncreasing = analysisService.calculateRSI(increasingPrices, 14);
      const rsiDecreasing = analysisService.calculateRSI(decreasingPrices, 14);

      // RSI de tendencia alcista sostenida debería ser alto
      expect(rsiIncreasing[rsiIncreasing.length - 1]).toBeGreaterThan(70);

      // RSI de tendencia bajista sostenida debería ser bajo
      expect(rsiDecreasing[rsiDecreasing.length - 1]).toBeLessThan(30);
    });
  });

  describe('RSI Divergences', () => {
    test('should detect basic divergence patterns', () => {
      // Mock de precios que bajan mientras RSI sube (divergencia alcista)
      const prices = [100, 98, 96, 94, 92, 90, 88, 86, 84, 82];
      const rsiValues = [30, 32, 34, 36, 38, 40, 42, 44, 46, 48];

      const divergences = analysisService.detectRSIDivergences(prices, rsiValues);

      expect(divergences).toBeDefined();
      expect(Array.isArray(divergences)).toBe(true);
    });

    test('should calculate divergence strength correctly', () => {
      const prevPrice = { index: 5, value: 100 };
      const currPrice = { index: 10, value: 95 };
      const prevRsi = { index: 5, value: 30 };
      const currRsi = { index: 10, value: 40 };

      const strength = analysisService.calculateDivergenceStrength(
        prevPrice, currPrice, prevRsi, currRsi
      );

      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(100);
    });
  });

  describe('Support and Resistance Detection', () => {
    test('should detect basic support and resistance levels', () => {
      const prices = [100, 102, 101, 103, 102, 104, 103, 105, 104, 106];
      const highs = prices.map(p => p + 1);
      const lows = prices.map(p => p - 1);

      const result = analysisService.detectSupportResistance(prices, highs, lows);

      expect(result).toBeDefined();
      expect(result.dynamicLevels).toBeDefined();
      expect(result.psychologicalLevels).toBeDefined();
      expect(Array.isArray(result.dynamicLevels)).toBe(true);
      expect(Array.isArray(result.psychologicalLevels)).toBe(true);
    });

    test('should calculate psychological levels correctly', () => {
      const currentPrice = 50437.5;
      const psychLevels = analysisService.detectPsychologicalLevels(currentPrice);

      expect(psychLevels).toBeDefined();
      expect(Array.isArray(psychLevels)).toBe(true);

      // Debería encontrar niveles redondos cerca del precio actual
      const nearbyLevels = psychLevels.filter(level =>
        Math.abs(level.price - currentPrice) / currentPrice < 0.1
      );

      expect(nearbyLevels.length).toBeGreaterThan(0);
    });

    test('should group similar levels correctly', () => {
      const points = [
        { value: 100, type: 'support', index: 1 },
        { value: 100.2, type: 'support', index: 5 },
        { value: 99.8, type: 'support', index: 10 },
        { value: 200, type: 'resistance', index: 15 }
      ];

      const groups = analysisService.groupSimilarLevels(points, 0.005); // 0.5% tolerancia

      expect(groups.length).toBe(2); // Debería agrupar los 3 soportes similares
      expect(groups[0].touches).toBe(3);
      expect(groups[1].touches).toBe(1);
    });
  });

  describe('Fibonacci Levels', () => {
    test('should calculate fibonacci retracements', () => {
      const prices = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i / 10) * 20);
      const highs = prices.map(p => p + 2);
      const lows = prices.map(p => p - 2);

      const fibonacci = analysisService.calculateFibonacciLevels(prices, highs, lows);

      expect(fibonacci).toBeDefined();
      expect(fibonacci.retracements).toBeDefined();
      expect(fibonacci.extensions).toBeDefined();
      expect(Array.isArray(fibonacci.retracements)).toBe(true);
      expect(Array.isArray(fibonacci.extensions)).toBe(true);
    });

    test('should identify golden pocket levels', () => {
      const prices = [100, 110, 120, 115, 110, 105]; // Swing de 100 a 120
      const highs = prices.map(p => p + 1);
      const lows = prices.map(p => p - 1);

      const fibonacci = analysisService.calculateFibonacciLevels(prices, highs, lows);

      if (fibonacci.goldenPocket && fibonacci.goldenPocket.length > 0) {
        fibonacci.goldenPocket.forEach(level => {
          expect(level.type).toBe('golden_pocket');
          expect(level.level).toBeCloseTo(0.618, 2);
        });
      }
    });

    test('should detect significant swings', () => {
      const prices = [100, 95, 90, 95, 100, 105, 110, 105, 100];
      const highs = prices.map(p => p + 1);
      const lows = prices.map(p => p - 1);

      const lastSwing = analysisService.detectLastSignificantSwing(prices, highs, lows);

      if (lastSwing) {
        expect(lastSwing.direction).toMatch(/up|down/);
        expect(lastSwing.high).toBeGreaterThan(lastSwing.low);
        expect(lastSwing.startIndex).toBeDefined();
        expect(lastSwing.endIndex).toBeDefined();
      }
    });
  });

  describe('BBWP Calculation', () => {
    test('should calculate BBWP with sufficient data', () => {
      // Generar 300 puntos de datos para BBWP
      const prices = Array.from({ length: 300 }, (_, i) =>
        100 + Math.sin(i / 20) * 10 + Math.random() * 2
      );

      const bbwp = analysisService.calculateBBWP(prices, 20, 2, 252);

      expect(bbwp).toBeDefined();
      expect(Array.isArray(bbwp)).toBe(true);
      expect(bbwp.length).toBeGreaterThan(0);

      // Verificar que los valores están en el rango correcto
      bbwp.forEach(point => {
        expect(point.value).toBeGreaterThanOrEqual(0);
        expect(point.value).toBeLessThanOrEqual(100);
        expect(point.interpretation).toBeDefined();
        expect(point.interpretation.status).toMatch(/squeeze|expansion|normal/);
      });
    });

    test('should throw error with insufficient data for BBWP', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);

      expect(() => {
        analysisService.calculateBBWP(prices, 20, 2, 252);
      }).toThrow('Insuficientes datos para BBWP');
    });

    test('should interpret BBWP correctly', () => {
      const lowPercentile = 15;
      const highPercentile = 85;
      const normalPercentile = 50;

      const lowInterpretation = analysisService.interpretBBWP(lowPercentile);
      const highInterpretation = analysisService.interpretBBWP(highPercentile);
      const normalInterpretation = analysisService.interpretBBWP(normalPercentile);

      expect(lowInterpretation.status).toBe('squeeze');
      expect(lowInterpretation.signal).toBe('prepare_for_breakout');

      expect(highInterpretation.status).toBe('expansion');
      expect(highInterpretation.signal).toBe('high_volatility');

      expect(normalInterpretation.status).toBe('normal');
      expect(normalInterpretation.signal).toBe('neutral');
    });
  });

  describe('Pattern Detection', () => {
    test('should detect basic chart patterns', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 5);
      const highs = prices.map(p => p + 1);
      const lows = prices.map(p => p - 1);

      const patterns = analysisService.detectChartPatterns(prices, highs, lows);

      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);

      patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(100);
        expect(pattern.timeframe).toBeDefined();
      });
    });

    test('should detect triangular patterns', () => {
      // Crear datos que simulen un triángulo simétrico
      const highs = [105, 103, 101, 99, 97];
      const lows = [95, 96, 97, 98, 99];

      const triangles = analysisService.detectTriangles(highs, lows);

      expect(triangles).toBeDefined();
      expect(Array.isArray(triangles)).toBe(true);
    });

    test('should calculate trend lines correctly', () => {
      const points = [
        { index: 0, value: 100 },
        { index: 5, value: 105 },
        { index: 10, value: 110 }
      ];

      const trendLine = analysisService.calculateTrendLine(points);

      if (trendLine) {
        expect(trendLine.slope).toBeGreaterThan(0); // Tendencia alcista
        expect(trendLine.intercept).toBeDefined();
        expect(trendLine.correlation).toBeGreaterThan(0);
      }
    });
  });

  describe('Utility Functions', () => {
    test('should find peaks and valleys correctly', () => {
      const data = [1, 3, 2, 5, 4, 7, 6, 8, 7, 9, 8];

      const peaks = analysisService.findPeaksAndValleys(data, 'peaks');
      const valleys = analysisService.findPeaksAndValleys(data, 'valleys');

      expect(peaks).toBeDefined();
      expect(valleys).toBeDefined();
      expect(Array.isArray(peaks)).toBe(true);
      expect(Array.isArray(valleys)).toBe(true);

      peaks.forEach(peak => {
        expect(peak.type).toBe('peak');
        expect(peak.index).toBeDefined();
        expect(peak.value).toBeDefined();
      });

      valleys.forEach(valley => {
        expect(valley.type).toBe('valley');
        expect(valley.index).toBeDefined();
        expect(valley.value).toBeDefined();
      });
    });

    test('should calculate level strength correctly', () => {
      const group = {
        touches: 5,
        timespan: 72, // 3 días
        avgPrice: 100
      };

      const strength = analysisService.calculateLevelStrength(group);

      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(100);
      expect(strength).toBeGreaterThan(80); // 5 toques debería dar alta fuerza
    });

    test('should calculate psychological strength', () => {
      const roundLevel = 50000; // Número muy redondo
      const currentPrice = 49800;

      const strength = analysisService.calculatePsychologicalStrength(roundLevel, currentPrice);

      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(100);
    });

    test('should check if level is broken correctly', () => {
      const supportPrice = 100;
      const recentPrices = [101, 100.5, 99.5, 98.5]; // Rompe soporte

      const isBroken = analysisService.checkIfLevelBroken(supportPrice, recentPrices, 'support');

      expect(isBroken).toBe(true);
    });
  });

  describe('Full Analysis Integration', () => {
    test('should perform complete symbol analysis', async () => {
      const symbol = 'BTCUSDT';
      const timeframe = '1h';
      const periods = 100;

      const analysis = await analysisService.analyzeSymbol(symbol, timeframe, periods);

      expect(analysis).toBeDefined();
      expect(analysis.symbol).toBe(symbol);
      expect(analysis.timeframe).toBe(timeframe);
      expect(analysis.timestamp).toBeDefined();

      // Verificar que todos los componentes principales están presentes
      expect(analysis.rsi).toBeDefined();
      expect(analysis.supportResistance).toBeDefined();
      expect(analysis.fibonacci).toBeDefined();
      expect(analysis.patterns).toBeDefined();
      expect(analysis.summary).toBeDefined();

      // Verificar summary
      expect(analysis.summary.confluenceScore).toBeGreaterThanOrEqual(0);
      expect(analysis.summary.confluenceScore).toBeLessThanOrEqual(100);
      expect(analysis.summary.recommendation).toMatch(/bullish|bearish|neutral/);
      expect(analysis.summary.riskLevel).toMatch(/low|medium|high/);
    });

    test('should generate meaningful analysis summary', () => {
      const mockAnalysis = {
        rsi: [50, 55, 60],
        rsiDivergences: [
          { type: 'bullish', strength: 80, confirmation: true }
        ],
        supportResistance: {
          dynamicLevels: [
            { price: 100, type: 'support', strength: 85 }
          ]
        },
        bbwp: [
          { value: 15, squeeze: true, interpretation: { status: 'squeeze' } }
        ],
        patterns: []
      };

      const currentPrice = 102;
      const summary = analysisService.generateAnalysisSummary(mockAnalysis, currentPrice);

      expect(summary).toBeDefined();
      expect(summary.confluenceScore).toBeGreaterThan(50); // Debería ser positivo
      expect(summary.signals.length).toBeGreaterThan(0);
      expect(summary.recommendation).toMatch(/bullish|bearish|neutral/);
    });

    test('should handle cache correctly', async () => {
      const symbol = 'ETHUSDT';

      // Primera llamada - debería calcular
      const firstCall = await analysisService.analyzeSymbol(symbol);

      // Segunda llamada inmediata - debería usar cache
      const secondCall = await analysisService.analyzeSymbol(symbol);

      expect(firstCall.timestamp).toEqual(secondCall.timestamp);
    });

    test('should provide health status', () => {
      const health = analysisService.getHealthStatus();

      expect(health).toBeDefined();
      expect(health.service).toBe('TechnicalAnalysisService');
      expect(health.status).toBe('healthy');
      expect(health.cacheSize).toBeDefined();
      expect(health.configLoaded).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle insufficient data gracefully', async () => {
      // Mock del método getMarketData para retornar pocos datos
      const originalGetMarketData = analysisService.getMarketData;
      analysisService.getMarketData = jest.fn().mockResolvedValue([
        { close: 100, high: 101, low: 99, volume: 1000 }
      ]);

      await expect(analysisService.analyzeSymbol('INVALID', '1h', 100))
        .rejects.toThrow('Insuficientes datos para análisis');

      // Restaurar método original
      analysisService.getMarketData = originalGetMarketData;
    });

    test('should handle API errors gracefully', async () => {
      // Mock del método getMarketData para fallar
      analysisService.getMarketData = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(analysisService.analyzeSymbol('ERRORUSDT'))
        .rejects.toThrow('API Error');
    });
  });

  describe('Configuration', () => {
    test('should have valid default configuration', () => {
      expect(analysisService.config).toBeDefined();
      expect(analysisService.config.rsi).toBeDefined();
      expect(analysisService.config.fibonacci).toBeDefined();
      expect(analysisService.config.bbwp).toBeDefined();
      expect(analysisService.config.patterns).toBeDefined();

      // Verificar valores RSI
      expect(analysisService.config.rsi.period).toBe(14);
      expect(analysisService.config.rsi.overbought).toBe(70);
      expect(analysisService.config.rsi.oversold).toBe(30);

      // Verificar niveles Fibonacci
      expect(analysisService.config.fibonacci.levels).toContain(0.618);
      expect(analysisService.config.fibonacci.goldenPocket).toBeDefined();
    });
  });
});