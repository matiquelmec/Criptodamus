/**
 * RISK MANAGEMENT MODULE - MÁXIMA PRIORIDAD
 *
 * Este módulo implementa todas las reglas críticas del documento:
 * - Máximo 2-3% de riesgo por operación
 * - Stop Loss obligatorio y lógico
 * - Ratio R/R mínimo 2:1
 * - Control de apalancamiento máximo
 * - Protección contra endeudamiento
 *
 * OBJETIVO PRINCIPAL: NO PERDER DINERO
 */

class RiskManager {
  constructor(options = {}) {
    // Configuración por defecto basada en el documento
    this.config = {
      maxRiskPerTrade: options.maxRiskPerTrade || 2, // 2% máximo por trade
      maxLeverage: options.maxLeverage || 20, // 20x máximo recomendado
      minRiskReward: options.minRiskReward || 2, // Mínimo 2:1 R/R
      maxConsecutiveLosses: options.maxConsecutiveLosses || 3, // Pausa después de 3 pérdidas
      emergencyStopPercent: options.emergencyStopPercent || 20, // Pausa si se pierde 20% del capital
    };
  }

  /**
   * CÁLCULO DE TAMAÑO DE POSICIÓN
   * Calcula cuánto capital usar basándose en el riesgo permitido
   *
   * @param {number} accountBalance - Balance total de la cuenta
   * @param {number} entryPrice - Precio de entrada
   * @param {number} stopLossPrice - Precio de Stop Loss
   * @param {number} riskPercent - Porcentaje de riesgo (default: config)
   * @param {number} leverage - Apalancamiento a usar
   * @returns {Object} Datos de la posición calculada
   */
  calculatePositionSize(accountBalance, entryPrice, stopLossPrice, riskPercent = null, leverage = 10) {
    try {
      // Validaciones críticas
      if (accountBalance <= 0) throw new Error('❌ Balance de cuenta inválido');
      if (entryPrice <= 0) throw new Error('❌ Precio de entrada inválido');
      if (stopLossPrice <= 0) throw new Error('❌ Stop Loss inválido');
      if (leverage > this.config.maxLeverage) {
        throw new Error(`❌ Apalancamiento excede el máximo permitido (${this.config.maxLeverage}x)`);
      }

      // Usar riesgo configurado si no se especifica
      const riskPercentToUse = riskPercent || this.config.maxRiskPerTrade;

      // Calcular el riesgo en dólares
      const riskAmount = accountBalance * (riskPercentToUse / 100);

      // Determinar dirección del trade (LONG o SHORT)
      const isLong = stopLossPrice < entryPrice;
      const isShort = stopLossPrice > entryPrice;

      if (!isLong && !isShort) {
        throw new Error('❌ Stop Loss debe estar por encima (SHORT) o por debajo (LONG) del precio de entrada');
      }

      // Calcular diferencia de precio (riesgo por unidad)
      const priceRisk = Math.abs(entryPrice - stopLossPrice);
      const riskPercentPerUnit = (priceRisk / entryPrice) * 100;

      // Calcular tamaño de posición sin apalancamiento
      const basePositionSize = riskAmount / priceRisk;

      // Calcular capital necesario con apalancamiento
      const requiredCapital = (basePositionSize * entryPrice) / leverage;

      // Verificar que no excedemos el balance disponible
      if (requiredCapital > accountBalance) {
        throw new Error('❌ Capital insuficiente para esta posición');
      }

      // Calcular métricas adicionales
      const positionValue = basePositionSize * entryPrice;
      const leverageUsed = positionValue / requiredCapital;

      return {
        success: true,
        data: {
          direction: isLong ? 'LONG' : 'SHORT',
          positionSize: basePositionSize,
          requiredCapital: requiredCapital,
          positionValue: positionValue,
          leverage: leverageUsed,
          riskAmount: riskAmount,
          riskPercent: riskPercentToUse,
          priceRisk: priceRisk,
          riskPercentPerUnit: riskPercentPerUnit,
        },
        warnings: this._generateWarnings(riskPercentToUse, leverageUsed)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * CÁLCULO DE TAKE PROFIT
   * Calcula el precio de Take Profit basándose en el ratio R/R
   *
   * @param {number} entryPrice - Precio de entrada
   * @param {number} stopLossPrice - Precio de Stop Loss
   * @param {number} riskRewardRatio - Ratio R/R deseado (default: 2:1)
   * @returns {Object} Datos del Take Profit
   */
  calculateTakeProfit(entryPrice, stopLossPrice, riskRewardRatio = null) {
    try {
      const rrRatio = riskRewardRatio || this.config.minRiskReward;

      // Validaciones
      if (rrRatio < this.config.minRiskReward) {
        throw new Error(`❌ Ratio R/R debe ser mínimo ${this.config.minRiskReward}:1`);
      }

      const riskDistance = Math.abs(entryPrice - stopLossPrice);
      const rewardDistance = riskDistance * rrRatio;

      // Determinar dirección
      const isLong = stopLossPrice < entryPrice;
      const takeProfitPrice = isLong
        ? entryPrice + rewardDistance
        : entryPrice - rewardDistance;

      return {
        success: true,
        data: {
          takeProfitPrice: takeProfitPrice,
          riskDistance: riskDistance,
          rewardDistance: rewardDistance,
          riskRewardRatio: rrRatio,
          direction: isLong ? 'LONG' : 'SHORT'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * VALIDACIÓN DE STOP LOSS
   * Verifica que el Stop Loss esté ubicado lógicamente
   *
   * @param {number} entryPrice - Precio de entrada
   * @param {number} stopLossPrice - Precio de Stop Loss propuesto
   * @param {number} supportLevel - Nivel de soporte (para LONG)
   * @param {number} resistanceLevel - Nivel de resistencia (para SHORT)
   * @returns {Object} Validación del Stop Loss
   */
  validateStopLoss(entryPrice, stopLossPrice, supportLevel = null, resistanceLevel = null) {
    try {
      const isLong = stopLossPrice < entryPrice;
      const isShort = stopLossPrice > entryPrice;

      if (!isLong && !isShort) {
        throw new Error('❌ Stop Loss inválido: debe estar por encima (SHORT) o por debajo (LONG) del precio de entrada');
      }

      const riskPercent = Math.abs((entryPrice - stopLossPrice) / entryPrice) * 100;

      // Validaciones específicas por dirección
      const validations = [];

      if (isLong) {
        validations.push({
          check: 'Dirección LONG',
          status: 'valid',
          message: '✅ Stop Loss correctamente ubicado por debajo del precio de entrada'
        });

        // Verificar que el SL esté por debajo del soporte con margen
        if (supportLevel && stopLossPrice >= supportLevel) {
          validations.push({
            check: 'Ubicación vs Soporte',
            status: 'warning',
            message: '⚠️ Stop Loss muy cerca del soporte. Recomendado: por debajo con margen'
          });
        }
      }

      if (isShort) {
        validations.push({
          check: 'Dirección SHORT',
          status: 'valid',
          message: '✅ Stop Loss correctamente ubicado por encima del precio de entrada'
        });

        // Verificar que el SL esté por encima de la resistencia con margen
        if (resistanceLevel && stopLossPrice <= resistanceLevel) {
          validations.push({
            check: 'Ubicación vs Resistencia',
            status: 'warning',
            message: '⚠️ Stop Loss muy cerca de la resistencia. Recomendado: por encima con margen'
          });
        }
      }

      // Validar que el riesgo no sea excesivo
      if (riskPercent > 10) {
        validations.push({
          check: 'Riesgo por unidad',
          status: 'error',
          message: `❌ Riesgo muy alto: ${riskPercent.toFixed(2)}%. Máximo recomendado: 10%`
        });
      }

      return {
        success: true,
        data: {
          isValid: !validations.some(v => v.status === 'error'),
          direction: isLong ? 'LONG' : 'SHORT',
          riskPercent: riskPercent,
          validations: validations
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * PROTECTION: MOVER STOP LOSS A BREAKEVEN
   * Implementa la regla de proteger beneficios moviendo SL a entrada
   *
   * @param {number} entryPrice - Precio de entrada original
   * @param {number} currentPrice - Precio actual
   * @param {number} currentStopLoss - Stop Loss actual
   * @param {number} profitThreshold - % de beneficio para activar protección (default: 40%)
   * @returns {Object} Nuevo Stop Loss sugerido
   */
  moveStopToBreakeven(entryPrice, currentPrice, currentStopLoss, profitThreshold = 40) {
    try {
      const isLong = currentStopLoss < entryPrice;
      const currentProfitPercent = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100;

      if (currentProfitPercent < profitThreshold) {
        return {
          success: true,
          action: 'hold',
          message: `📊 Beneficio actual: ${currentProfitPercent.toFixed(2)}%. Esperando ${profitThreshold}% para proteger`,
          data: {
            currentProfitPercent: currentProfitPercent,
            requiredProfit: profitThreshold,
            newStopLoss: currentStopLoss
          }
        };
      }

      return {
        success: true,
        action: 'move_to_breakeven',
        message: `🛡️ ¡PROTEGER BENEFICIOS! Mover Stop Loss a breakeven (${entryPrice})`,
        data: {
          currentProfitPercent: currentProfitPercent,
          oldStopLoss: currentStopLoss,
          newStopLoss: entryPrice,
          protectionActivated: true
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * DETECTOR DE MALAS RACHAS
   * Detecta patrones de pérdidas consecutivas para sugerir pausas
   *
   * @param {Array} recentTrades - Array de trades recientes
   * @param {number} portfolioBalance - Balance actual del portfolio
   * @param {number} initialBalance - Balance inicial
   * @returns {Object} Análisis de racha y recomendaciones
   */
  checkTradingStreak(recentTrades, portfolioBalance, initialBalance) {
    try {
      const consecutiveLosses = this._countConsecutiveLosses(recentTrades);
      const totalDrawdown = ((initialBalance - portfolioBalance) / initialBalance) * 100;

      const recommendations = [];

      // Check pérdidas consecutivas
      if (consecutiveLosses >= this.config.maxConsecutiveLosses) {
        recommendations.push({
          type: 'warning',
          message: `⚠️ ${consecutiveLosses} pérdidas consecutivas. Recomendado: PAUSA y revisar estrategia`,
          action: 'pause_trading'
        });
      }

      // Check drawdown total
      if (totalDrawdown >= this.config.emergencyStopPercent) {
        recommendations.push({
          type: 'critical',
          message: `🚨 DRAWDOWN CRÍTICO: ${totalDrawdown.toFixed(2)}%. STOP TRADING INMEDIATO`,
          action: 'emergency_stop'
        });
      }

      return {
        success: true,
        data: {
          consecutiveLosses: consecutiveLosses,
          totalDrawdown: totalDrawdown,
          shouldPause: recommendations.some(r => r.action === 'pause_trading'),
          emergencyStop: recommendations.some(r => r.action === 'emergency_stop'),
          recommendations: recommendations
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * MÉTODOS PRIVADOS
   */

  _generateWarnings(riskPercent, leverage) {
    const warnings = [];

    if (riskPercent >= 3) {
      warnings.push('⚠️ Riesgo alto: Considerado solo para traders experimentados');
    }

    if (leverage >= 15) {
      warnings.push('⚠️ Apalancamiento alto: Aumenta velocidad de liquidación');
    }

    if (leverage >= 20) {
      warnings.push('🚨 Apalancamiento máximo: Extremadamente peligroso');
    }

    return warnings;
  }

  _countConsecutiveLosses(trades) {
    let consecutiveLosses = 0;

    // Contar desde el trade más reciente hacia atrás
    for (let i = trades.length - 1; i >= 0; i--) {
      if (trades[i].pnl < 0) {
        consecutiveLosses++;
      } else {
        break; // Se rompe la racha de pérdidas
      }
    }

    return consecutiveLosses;
  }
}

module.exports = RiskManager;