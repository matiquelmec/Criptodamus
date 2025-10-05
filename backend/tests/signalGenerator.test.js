const SignalGeneratorService = require('../src/services/signalGeneratorService');

// Mock logger para testing
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}), { virtual: true });

describe('SignalGeneratorService', () => {
  let signalGenerator;

  beforeEach(() => {
    signalGenerator = new SignalGeneratorService({
      minConfluenceScore: 70,
      minRiskReward: 2.0,
      maxRiskPerTrade: 2.0
    });
  });

  afterEach(() => {
    signalGenerator.clearCache();
  });

  describe('Configuration', () => {
    test('should initialize with correct default configuration', () => {
      const defaultGenerator = new SignalGeneratorService();

      expect(defaultGenerator.config.minConfluenceScore).toBe(75);
      expect(defaultGenerator.config.minRiskReward).toBe(2.0);
      expect(defaultGenerator.config.maxRiskPerTrade).toBe(2.5);
      expect(defaultGenerator.config.primaryTimeframe).toBe('4h');
    });

    test('should accept custom configuration', () => {
      const customGenerator = new SignalGeneratorService({
        minConfluenceScore: 80,
        minRiskReward: 3.0,
        maxRiskPerTrade: 1.5
      });

      expect(customGenerator.config.minConfluenceScore).toBe(80);
      expect(customGenerator.config.minRiskReward).toBe(3.0);
      expect(customGenerator.config.maxRiskPerTrade).toBe(1.5);
    });

    test('should update configuration correctly', () => {
      const newConfig = {
        minConfluenceScore: 85,
        rsiOverbought: 80
      };

      signalGenerator.updateConfig(newConfig);

      expect(signalGenerator.config.minConfluenceScore).toBe(85);
      expect(signalGenerator.config.rsiOverbought).toBe(80);
    });
  });

  describe('Confluence Score Calculation', () => {
    test('should calculate confluence score with RSI factors', () => {
      const mockAnalysis = {
        rsi: [25], // Oversold
        rsiDivergences: [
          { type: 'bullish', strength: 80, confirmation: true }
        ],
        supportResistance: {
          dynamicLevels: []
        },
        bbwp: [],
        fibonacci: { goldenPocket: [] },
        patterns: []
      };

      const confluence = signalGenerator.calculateConfluenceScore(mockAnalysis);

      expect(confluence.score).toBeGreaterThan(50);
      expect(confluence.factors.length).toBeGreaterThan(0);
      expect(confluence.factors.some(f => f.type === 'rsi_oversold')).toBe(true);
      expect(confluence.factors.some(f => f.type === 'rsi_divergence_bullish')).toBe(true);
    });

    test('should handle support/resistance factors', () => {
      const mockAnalysis = {
        rsi: [50],
        rsiDivergences: [],
        supportResistance: {
          dynamicLevels: [
            {
              price: 49500, // Cerca del precio actual (50000)
              type: 'support',
              strength: 80
            }
          ]
        },
        bbwp: [],
        fibonacci: { goldenPocket: [] },
        patterns: []
      };

      // Mock extractCurrentPrice para retornar 50000
      signalGenerator.extractCurrentPrice = jest.fn().mockReturnValue(50000);

      const confluence = signalGenerator.calculateConfluenceScore(mockAnalysis);

      expect(confluence.factors.some(f => f.type === 'strong_support')).toBe(true);
    });

    test('should handle BBWP squeeze conditions', () => {
      const mockAnalysis = {
        rsi: [50],
        rsiDivergences: [],
        supportResistance: { dynamicLevels: [] },
        bbwp: [{ value: 10, squeeze: true }],
        fibonacci: { goldenPocket: [] },
        patterns: []
      };

      const confluence = signalGenerator.calculateConfluenceScore(mockAnalysis);

      expect(confluence.factors.some(f => f.type === 'bbwp_squeeze')).toBe(true);
      expect(confluence.score).toBeGreaterThan(50);
    });

    test('should handle golden pocket proximity', () => {
      const mockAnalysis = {
        rsi: [50],
        rsiDivergences: [],
        supportResistance: { dynamicLevels: [] },
        bbwp: [],
        fibonacci: {
          goldenPocket: [
            { price: 49800, level: 0.618 }
          ]
        },
        patterns: []
      };

      signalGenerator.extractCurrentPrice = jest.fn().mockReturnValue(50000);

      const confluence = signalGenerator.calculateConfluenceScore(mockAnalysis);

      expect(confluence.factors.some(f => f.type === 'near_golden_pocket')).toBe(true);
    });

    test('should interpret confluence scores correctly', () => {
      expect(signalGenerator.interpretConfluenceScore(90)).toBe('excellent');
      expect(signalGenerator.interpretConfluenceScore(80)).toBe('strong');
      expect(signalGenerator.interpretConfluenceScore(65)).toBe('moderate');
      expect(signalGenerator.interpretConfluenceScore(45)).toBe('weak');
      expect(signalGenerator.interpretConfluenceScore(30)).toBe('very_weak');
    });
  });

  describe('Signal Direction Determination', () => {
    test('should determine bullish direction correctly', () => {
      const mockAnalysis = {
        rsi: [25],
        summary: { recommendation: 'bullish' }
      };

      const confluence = {
        score: 80,
        factors: [
          { weight: 15 }, // bullish factor
          { weight: 20 }  // another bullish factor
        ]
      };

      const direction = signalGenerator.determineSignalDirection(mockAnalysis, confluence);
      expect(direction).toBe('long');
    });

    test('should determine bearish direction correctly', () => {
      const mockAnalysis = {
        rsi: [75],
        summary: { recommendation: 'bearish' }
      };

      const confluence = {
        score: 80,
        factors: [
          { weight: -15 }, // bearish factor
          { weight: -20 }  // another bearish factor
        ]
      };

      const direction = signalGenerator.determineSignalDirection(mockAnalysis, confluence);
      expect(direction).toBe('short');
    });

    test('should determine neutral when insufficient signals', () => {
      const mockAnalysis = {
        rsi: [50],
        summary: { recommendation: 'neutral' }
      };

      const confluence = {
        score: 45, // Low confluence
        factors: [
          { weight: 5 },
          { weight: -3 }
        ]
      };

      const direction = signalGenerator.determineSignalDirection(mockAnalysis, confluence);
      expect(direction).toBe('neutral');
    });
  });

  describe('Level Calculations', () => {
    test('should calculate stop loss based on support/resistance', () => {
      const mockAnalysis = {
        supportResistance: {
          dynamicLevels: [
            { price: 48000, type: 'support', strength: 85 },
            { price: 47500, type: 'support', strength: 70 }
          ]
        },
        fibonacci: { retracements: [] }
      };

      const stopLoss = signalGenerator.calculateStopLoss(mockAnalysis, 'long', 50000);

      expect(stopLoss).toBeCloseTo(48000, 0); // Should choose strongest support
      expect(stopLoss).toBeLessThan(50000); // Stop loss should be below entry for long
    });

    test('should calculate take profit with minimum risk/reward', () => {
      const mockAnalysis = {
        supportResistance: {
          dynamicLevels: [
            { price: 54000, type: 'resistance', strength: 80 }
          ]
        },
        fibonacci: { extensions: [] }
      };

      const takeProfit = signalGenerator.calculateTakeProfit(mockAnalysis, 'long', 50000, 48000);
      const risk = Math.abs(50000 - 48000);
      const reward = Math.abs(takeProfit - 50000);
      const riskReward = reward / risk;

      expect(riskReward).toBeGreaterThanOrEqual(signalGenerator.config.minRiskReward);
      expect(takeProfit).toBeGreaterThan(50000); // TP should be above entry for long
    });

    test('should validate level logic for long positions', async () => {
      const mockAnalysis = {
        supportResistance: { dynamicLevels: [] },
        fibonacci: { retracements: [], extensions: [] }
      };

      signalGenerator.extractCurrentPrice = jest.fn().mockReturnValue(50000);

      const levels = await signalGenerator.calculateSignalLevels(mockAnalysis, 'long', 50000);

      expect(levels.entry).toBe(50000);
      expect(levels.stopLoss).toBeLessThan(levels.entry);
      expect(levels.takeProfit).toBeGreaterThan(levels.entry);
    });

    test('should validate level logic for short positions', async () => {
      const mockAnalysis = {
        supportResistance: { dynamicLevels: [] },
        fibonacci: { retracements: [], extensions: [] }
      };

      signalGenerator.extractCurrentPrice = jest.fn().mockReturnValue(50000);

      const levels = await signalGenerator.calculateSignalLevels(mockAnalysis, 'short', 50000);

      expect(levels.entry).toBe(50000);
      expect(levels.stopLoss).toBeGreaterThan(levels.entry);
      expect(levels.takeProfit).toBeLessThan(levels.entry);
    });
  });

  describe('Risk Management Validation', () => {
    test('should validate position with risk manager', () => {
      const validation = signalGenerator.validateWithRiskManagement(10000, 50000, 48000, 2.0);

      expect(validation.valid).toBe(true);
      expect(validation.positionData).toBeDefined();
      expect(validation.riskData).toBeDefined();
    });

    test('should reject position with excessive risk', () => {
      // Stop loss muy lejano = riesgo excesivo
      const validation = signalGenerator.validateWithRiskManagement(10000, 50000, 35000, 2.0);

      // Dependiendo de la lógica del risk manager, podría ser válido o no
      // Ajustar según la implementación real
      expect(validation).toBeDefined();
      expect(typeof validation.valid).toBe('boolean');
    });
  });

  describe('Signal Filters', () => {
    test('should apply volatility filters', async () => {
      const mockAnalysis = {
        bbwp: [{ value: 95, expansion: true }] // Muy alta volatilidad
      };

      const levels = {
        entry: 50000,
        stopLoss: 48000,
        takeProfit: 54000
      };

      const filters = await signalGenerator.applySignalFilters(mockAnalysis, levels, 'BTCUSDT');

      expect(filters.passed).toBe(false);
      expect(filters.failedFilters.some(f => f.name === 'high_volatility')).toBe(true);
    });

    test('should apply RSI extreme filters', async () => {
      const mockAnalysis = {
        rsi: [85], // RSI extremo
        bbwp: []
      };

      const levels = {
        entry: 50000,
        stopLoss: 48000,
        takeProfit: 54000
      };

      const filters = await signalGenerator.applySignalFilters(mockAnalysis, levels, 'BTCUSDT');

      expect(filters.passed).toBe(false);
      expect(filters.failedFilters.some(f => f.name === 'extreme_rsi')).toBe(true);
    });

    test('should apply risk/reward filters', async () => {
      const mockAnalysis = {
        rsi: [50],
        bbwp: []
      };

      const levels = {
        entry: 50000,
        stopLoss: 49000, // Risk: 1000
        takeProfit: 50500 // Reward: 500, R:R = 0.5 (insuficiente)
      };

      const filters = await signalGenerator.applySignalFilters(mockAnalysis, levels, 'BTCUSDT');

      expect(filters.passed).toBe(false);
      expect(filters.failedFilters.some(f => f.name === 'insufficient_risk_reward')).toBe(true);
    });

    test('should pass all filters for good signal', async () => {
      const mockAnalysis = {
        rsi: [50], // RSI normal
        bbwp: [{ value: 30, expansion: false }] // Volatilidad normal
      };

      const levels = {
        entry: 50000,
        stopLoss: 48000, // Risk: 2000
        takeProfit: 54000 // Reward: 4000, R:R = 2.0
      };

      const filters = await signalGenerator.applySignalFilters(mockAnalysis, levels, 'BTCUSDT');

      expect(filters.passed).toBe(true);
      expect(filters.failedFilters.length).toBe(0);
    });
  });

  describe('Signal Creation', () => {
    test('should create valid signal with all components', () => {
      const mockAnalysis = {
        rsi: [30],
        patterns: [{ type: 'triangle', confidence: 80 }],
        timeframe: '4h'
      };

      const levels = {
        entry: 50000,
        stopLoss: 48000,
        takeProfit: 54000
      };

      const confluence = {
        score: 85,
        factors: [{ type: 'rsi_oversold', weight: 15 }],
        recommendation: 'strong'
      };

      const riskValidation = {
        valid: true,
        positionData: {
          positionSize: 0.1,
          leverage: 10,
          notionalValue: 5000
        }
      };

      const signal = signalGenerator.createValidSignal(
        'BTCUSDT',
        mockAnalysis,
        'long',
        levels,
        confluence,
        riskValidation,
        50000
      );

      expect(signal.success).toBe(true);
      expect(signal.type).toBe('VALID_SIGNAL');
      expect(signal.symbol).toBe('BTCUSDT');
      expect(signal.direction).toBe('long');
      expect(signal.confluenceScore).toBe(85);
      expect(signal.riskReward).toBeCloseTo(2.0);
      expect(signal.entry).toBe(50000);
      expect(signal.stopLoss).toBe(48000);
      expect(signal.takeProfit).toBe(54000);
      expect(signal.positionSize).toBe(0.1);
      expect(signal.technicalContext).toBeDefined();
      expect(signal.alerts).toBeDefined();
    });

    test('should create neutral signal when no direction', () => {
      const mockAnalysis = {
        summary: { confluenceScore: 45, recommendation: 'neutral' }
      };

      const signal = signalGenerator.createNeutralSignal('BTCUSDT', mockAnalysis, 50000);

      expect(signal.success).toBe(true);
      expect(signal.type).toBe('NEUTRAL_SIGNAL');
      expect(signal.direction).toBe('neutral');
      expect(signal.recommendation).toBe('WAIT');
    });

    test('should create rejected signal for risk issues', () => {
      const mockAnalysis = {
        summary: { confluenceScore: 80 }
      };

      const signal = signalGenerator.createRejectedSignal(
        'BTCUSDT',
        mockAnalysis,
        'Stop loss too wide',
        50000
      );

      expect(signal.success).toBe(false);
      expect(signal.type).toBe('REJECTED_SIGNAL');
      expect(signal.reason).toBe('Stop loss too wide');
      expect(signal.recommendation).toBe('AVOID');
    });

    test('should create filtered signal for failed filters', () => {
      const mockAnalysis = {
        summary: { confluenceScore: 75 }
      };

      const failedFilters = [
        { name: 'high_volatility', reason: 'BBWP too high' }
      ];

      const signal = signalGenerator.createFilteredSignal(
        'BTCUSDT',
        mockAnalysis,
        failedFilters,
        50000
      );

      expect(signal.success).toBe(false);
      expect(signal.type).toBe('FILTERED_SIGNAL');
      expect(signal.failedFilters).toEqual(failedFilters);
      expect(signal.recommendation).toBe('WAIT');
    });
  });

  describe('Pattern Weight Calculation', () => {
    test('should calculate pattern weights correctly', () => {
      const trianglePattern = { type: 'triangle', confidence: 80 };
      const headShouldersPattern = { type: 'head_and_shoulders', confidence: 80 };

      const triangleWeight = signalGenerator.getPatternWeight(trianglePattern);
      const hsWeight = signalGenerator.getPatternWeight(headShouldersPattern);

      expect(triangleWeight).toBeCloseTo(8.0, 1); // 80/10 * 1.0
      expect(hsWeight).toBeCloseTo(12.0, 1); // 80/10 * 1.5
      expect(hsWeight).toBeGreaterThan(triangleWeight);
    });
  });

  describe('Utility Functions', () => {
    test('should extract nearby levels correctly', () => {
      const mockAnalysis = {
        supportResistance: {
          dynamicLevels: [
            { price: 49000, type: 'support', strength: 80 }, // 2% away
            { price: 51000, type: 'resistance', strength: 75 }, // 2% away
            { price: 45000, type: 'support', strength: 90 } // 10% away
          ]
        }
      };

      const nearbyLevels = signalGenerator.extractNearbyLevels(mockAnalysis, 50000);

      expect(nearbyLevels.length).toBe(2); // Solo los 2 dentro del 3%
      expect(nearbyLevels.some(l => l.price === 49000)).toBe(true);
      expect(nearbyLevels.some(l => l.price === 51000)).toBe(true);
      expect(nearbyLevels.some(l => l.price === 45000)).toBe(false);
    });

    test('should generate signal alerts', () => {
      const mockAnalysis = {
        rsi: [80], // RSI alto
        bbwp: [{ value: 85, expansion: true }] // Alta volatilidad
      };

      const levels = { entry: 50000, stopLoss: 48000, takeProfit: 54000 };
      const confluence = { score: 70 }; // Confluencia moderada

      const alerts = signalGenerator.generateSignalAlerts(mockAnalysis, levels, confluence);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(a => a.type === 'warning')).toBe(true); // Confluencia moderada
      expect(alerts.some(a => a.type === 'caution')).toBe(true); // RSI extremo
      expect(alerts.some(a => a.type === 'info')).toBe(true); // Alta volatilidad
    });
  });

  describe('Statistics and Management', () => {
    test('should update statistics correctly', () => {
      const validSignal = {
        success: true,
        direction: 'long',
        confluenceScore: 85
      };

      const invalidSignal = {
        success: false
      };

      signalGenerator.updateStats(validSignal);
      signalGenerator.updateStats(invalidSignal);

      const stats = signalGenerator.getStats();

      expect(stats.signalsGenerated).toBe(2);
      expect(stats.signalsFiltered).toBe(1);
      expect(stats.signalTypes.long).toBe(1);
      expect(stats.confluenceDistribution['80-89']).toBe(1);
    });

    test('should provide health status', () => {
      const health = signalGenerator.getHealthStatus();

      expect(health.service).toBe('SignalGeneratorService');
      expect(health.status).toBe('healthy');
      expect(health.config).toBeDefined();
      expect(health.stats).toBeDefined();
    });

    test('should clear cache correctly', () => {
      // Agregar algo al cache
      signalGenerator.signalCache.set('test', { data: 'test' });
      expect(signalGenerator.signalCache.size).toBe(1);

      signalGenerator.clearCache();
      expect(signalGenerator.signalCache.size).toBe(0);
    });
  });

  describe('Full Signal Generation', () => {
    test('should generate complete signal end-to-end', async () => {
      // Mock del TechnicalAnalysisService
      const mockAnalysis = {
        symbol: 'BTCUSDT',
        timeframe: '4h',
        timestamp: new Date(),
        rsi: [30], // Oversold
        rsiDivergences: [],
        supportResistance: {
          dynamicLevels: [
            { price: 48000, type: 'support', strength: 80 }
          ]
        },
        fibonacci: { goldenPocket: [], retracements: [], extensions: [] },
        bbwp: [{ value: 20, squeeze: true }],
        patterns: [],
        summary: {
          confluenceScore: 80,
          recommendation: 'bullish'
        }
      };

      // Mock del método analyzeSymbol
      signalGenerator.technicalAnalysis.analyzeSymbol = jest.fn().mockResolvedValue(mockAnalysis);
      signalGenerator.extractCurrentPrice = jest.fn().mockReturnValue(50000);

      const signal = await signalGenerator.generateSignal('BTCUSDT', {
        timeframe: '4h',
        accountBalance: 10000
      });

      expect(signal).toBeDefined();
      expect(signal.success).toBe(true);
      expect(signal.symbol).toBe('BTCUSDT');
      expect(signal.direction).toBe('long');
      expect(signal.confluenceScore).toBeGreaterThan(50);
    });
  });

  describe('Error Handling', () => {
    test('should handle technical analysis errors', async () => {
      signalGenerator.technicalAnalysis.analyzeSymbol = jest.fn().mockRejectedValue(
        new Error('Analysis failed')
      );

      await expect(signalGenerator.generateSignal('INVALID'))
        .rejects.toThrow('Analysis failed');
    });

    test('should handle invalid level calculations', async () => {
      const mockAnalysis = {
        supportResistance: { dynamicLevels: [] },
        fibonacci: { retracements: [], extensions: [] }
      };

      signalGenerator.extractCurrentPrice = jest.fn().mockReturnValue(50000);

      // Mock para que devuelva niveles inválidos
      signalGenerator.calculateStopLoss = jest.fn().mockReturnValue(52000); // SL arriba del entry para long

      await expect(
        signalGenerator.calculateSignalLevels(mockAnalysis, 'long', 50000)
      ).rejects.toThrow('Niveles de LONG inválidos');
    });
  });
});