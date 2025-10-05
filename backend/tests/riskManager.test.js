/**
 * TESTS DEL RISK MANAGER
 * Tests exhaustivos para validar todas las funcionalidades críticas
 */

const RiskManager = require('../src/services/riskManager');

describe('RiskManager - Gestión de Riesgos', () => {
  let riskManager;

  beforeEach(() => {
    riskManager = new RiskManager();
  });

  describe('calculatePositionSize', () => {
    test('debe calcular correctamente el tamaño de posición para LONG', () => {
      const result = riskManager.calculatePositionSize(
        1000, // $1000 balance
        50000, // BTC a $50,000
        48000, // Stop Loss a $48,000
        2, // 2% de riesgo
        10 // 10x leverage
      );

      expect(result.success).toBe(true);
      expect(result.data.direction).toBe('LONG');
      expect(result.data.riskAmount).toBe(20); // 2% de $1000
      expect(result.data.riskPercent).toBe(2);
      expect(result.data.priceRisk).toBe(2000); // $50k - $48k
    });

    test('debe calcular correctamente el tamaño de posición para SHORT', () => {
      const result = riskManager.calculatePositionSize(
        1000, // $1000 balance
        50000, // BTC a $50,000
        52000, // Stop Loss a $52,000
        2, // 2% de riesgo
        10 // 10x leverage
      );

      expect(result.success).toBe(true);
      expect(result.data.direction).toBe('SHORT');
      expect(result.data.riskAmount).toBe(20); // 2% de $1000
      expect(result.data.priceRisk).toBe(2000); // $52k - $50k
    });

    test('debe rechazar apalancamiento excesivo', () => {
      const result = riskManager.calculatePositionSize(
        1000,
        50000,
        48000,
        2,
        50 // 50x leverage (excede máximo de 20x)
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Apalancamiento excede el máximo');
    });

    test('debe rechazar balance inválido', () => {
      const result = riskManager.calculatePositionSize(
        0, // Balance cero
        50000,
        48000,
        2,
        10
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Balance de cuenta inválido');
    });

    test('debe rechazar Stop Loss inválido', () => {
      const result = riskManager.calculatePositionSize(
        1000,
        50000,
        50000, // SL igual a precio de entrada
        2,
        10
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stop Loss debe estar');
    });
  });

  describe('calculateTakeProfit', () => {
    test('debe calcular Take Profit correcto para LONG con R/R 2:1', () => {
      const result = riskManager.calculateTakeProfit(
        50000, // Entrada
        48000, // Stop Loss
        2 // R/R 2:1
      );

      expect(result.success).toBe(true);
      expect(result.data.direction).toBe('LONG');
      expect(result.data.riskDistance).toBe(2000);
      expect(result.data.rewardDistance).toBe(4000);
      expect(result.data.takeProfitPrice).toBe(54000); // $50k + $4k
    });

    test('debe calcular Take Profit correcto para SHORT con R/R 2:1', () => {
      const result = riskManager.calculateTakeProfit(
        50000, // Entrada
        52000, // Stop Loss
        2 // R/R 2:1
      );

      expect(result.success).toBe(true);
      expect(result.data.direction).toBe('SHORT');
      expect(result.data.riskDistance).toBe(2000);
      expect(result.data.rewardDistance).toBe(4000);
      expect(result.data.takeProfitPrice).toBe(46000); // $50k - $4k
    });

    test('debe rechazar R/R menor al mínimo', () => {
      const result = riskManager.calculateTakeProfit(
        50000,
        48000,
        1.5 // R/R 1.5:1 (menor al mínimo de 2:1)
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ratio R/R debe ser mínimo');
    });
  });

  describe('validateStopLoss', () => {
    test('debe validar Stop Loss correcto para LONG', () => {
      const result = riskManager.validateStopLoss(
        50000, // Entrada
        48000, // Stop Loss
        47500 // Soporte
      );

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(true);
      expect(result.data.direction).toBe('LONG');
    });

    test('debe advertir sobre Stop Loss muy cerca del soporte', () => {
      const result = riskManager.validateStopLoss(
        50000, // Entrada
        47600, // Stop Loss
        47500 // Soporte muy cerca
      );

      expect(result.success).toBe(true);
      const hasWarning = result.data.validations.some(v => v.status === 'warning');
      expect(hasWarning).toBe(true);
    });

    test('debe rechazar riesgo excesivo por unidad', () => {
      const result = riskManager.validateStopLoss(
        50000, // Entrada
        40000 // Stop Loss muy lejano (20% de riesgo)
      );

      expect(result.success).toBe(true);
      expect(result.data.riskPercent).toBeGreaterThan(10);
      const hasError = result.data.validations.some(v => v.status === 'error');
      expect(hasError).toBe(true);
    });
  });

  describe('moveStopToBreakeven', () => {
    test('debe mantener SL si beneficio es insuficiente', () => {
      const result = riskManager.moveStopToBreakeven(
        50000, // Entrada
        51000, // Precio actual (2% beneficio)
        48000, // SL actual
        40 // Requiere 40% beneficio
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('hold');
      expect(result.data.currentProfitPercent).toBe(2);
    });

    test('debe mover SL a breakeven con beneficio suficiente', () => {
      const result = riskManager.moveStopToBreakeven(
        50000, // Entrada
        70000, // Precio actual (40% beneficio)
        48000, // SL actual
        40 // Requiere 40% beneficio
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('move_to_breakeven');
      expect(result.data.newStopLoss).toBe(50000); // Movido a entrada
      expect(result.data.protectionActivated).toBe(true);
    });
  });

  describe('checkTradingStreak', () => {
    test('debe detectar pérdidas consecutivas', () => {
      const recentTrades = [
        { pnl: 100 },  // Ganancia
        { pnl: -50 },  // Pérdida
        { pnl: -30 },  // Pérdida
        { pnl: -40 }   // Pérdida (3 consecutivas)
      ];

      const result = riskManager.checkTradingStreak(recentTrades, 900, 1000);

      expect(result.success).toBe(true);
      expect(result.data.consecutiveLosses).toBe(3);
      expect(result.data.shouldPause).toBe(true);
    });

    test('debe detectar drawdown crítico', () => {
      const result = riskManager.checkTradingStreak(
        [],
        750, // Balance actual
        1000 // Balance inicial (25% drawdown)
      );

      expect(result.success).toBe(true);
      expect(result.data.totalDrawdown).toBe(25);
      expect(result.data.emergencyStop).toBe(true);
    });

    test('debe estar OK con trades mixtos recientes', () => {
      const recentTrades = [
        { pnl: -50 },  // Pérdida
        { pnl: 100 },  // Ganancia (rompe racha)
        { pnl: -30 }   // Pérdida reciente
      ];

      const result = riskManager.checkTradingStreak(recentTrades, 950, 1000);

      expect(result.success).toBe(true);
      expect(result.data.consecutiveLosses).toBe(1);
      expect(result.data.shouldPause).toBe(false);
      expect(result.data.emergencyStop).toBe(false);
    });
  });

  describe('Configuración personalizada', () => {
    test('debe usar configuración personalizada', () => {
      const customRiskManager = new RiskManager({
        maxRiskPerTrade: 1, // 1% en lugar de 2%
        maxLeverage: 10,    // 10x en lugar de 20x
        minRiskReward: 3    // 3:1 en lugar de 2:1
      });

      // Test configuración aplicada
      const result = customRiskManager.calculatePositionSize(1000, 50000, 48000);
      expect(result.data.riskPercent).toBe(1);

      const rrResult = customRiskManager.calculateTakeProfit(50000, 48000, 2);
      expect(rrResult.success).toBe(false); // Debe rechazar R/R 2:1 cuando mínimo es 3:1
    });
  });
});

// Tests de integración
describe('RiskManager - Casos de Uso Reales', () => {
  let riskManager;

  beforeEach(() => {
    riskManager = new RiskManager();
  });

  test('Escenario completo: Setup de trade BTC LONG', () => {
    const accountBalance = 1000;
    const entryPrice = 50000;
    const supportLevel = 48500;
    const stopLossPrice = 48000; // Por debajo del soporte
    const leverage = 10;

    // 1. Calcular posición
    const positionResult = riskManager.calculatePositionSize(
      accountBalance, entryPrice, stopLossPrice, 2, leverage
    );

    expect(positionResult.success).toBe(true);
    expect(positionResult.data.direction).toBe('LONG');

    // 2. Validar Stop Loss
    const validationResult = riskManager.validateStopLoss(
      entryPrice, stopLossPrice, supportLevel
    );

    expect(validationResult.success).toBe(true);
    expect(validationResult.data.isValid).toBe(true);

    // 3. Calcular Take Profit
    const tpResult = riskManager.calculateTakeProfit(entryPrice, stopLossPrice, 2);

    expect(tpResult.success).toBe(true);
    expect(tpResult.data.takeProfitPrice).toBe(54000);

    // Verificar que todo es consistente
    expect(positionResult.data.riskAmount).toBe(20); // 2% de $1000
    expect(tpResult.data.rewardDistance).toBe(4000); // 2x el riesgo
  });

  test('Escenario de protección: Mover SL en trade ganador', () => {
    const entryPrice = 50000;
    const stopLoss = 48000;
    const currentPrice = 70000; // 40% de ganancia

    const protectionResult = riskManager.moveStopToBreakeven(
      entryPrice, currentPrice, stopLoss, 40
    );

    expect(protectionResult.success).toBe(true);
    expect(protectionResult.action).toBe('move_to_breakeven');
    expect(protectionResult.data.newStopLoss).toBe(entryPrice);
  });

  test('Escenario de emergencia: Detectar mala racha', () => {
    const badTrades = [
      { pnl: -50 },
      { pnl: -30 },
      { pnl: -40 }  // 3 pérdidas consecutivas
    ];

    const streakResult = riskManager.checkTradingStreak(badTrades, 850, 1000);

    expect(streakResult.success).toBe(true);
    expect(streakResult.data.shouldPause).toBe(true);
    expect(streakResult.data.consecutiveLosses).toBe(3);
  });
});