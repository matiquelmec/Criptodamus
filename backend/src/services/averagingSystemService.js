/**
 * AVERAGING SYSTEM SERVICE - SISTEMA PROFESIONAL DE PROMEDIACIÓN
 *
 * Implementa técnicas profesionales de promediación según estándares del PDF:
 * - Dollar Cost Averaging (DCA) profesional
 * - Pyramid Building con gestión de riesgo
 * - Position Scaling con límites estrictos
 * - Risk-Adjusted Position Sizing
 * - Anti-Martingale y Martingale controlado
 */

class AveragingSystemService {
  constructor() {
    this.config = {
      // LÍMITES CRÍTICOS SEGÚN PDF
      maxTotalRisk: 0.03,        // 3% máximo total por símbolo
      maxPositions: 5,           // Máximo 5 entradas por posición
      minPriceGap: 0.02,         // 2% mínimo entre entradas
      maxAverageDown: 0.15,      // 15% máximo de promediación hacia abajo

      // CONFIGURACIÓN DCA
      dcaLevels: [
        { level: 1, allocation: 0.30, triggerDistance: 0.00 },  // 30% inicial
        { level: 2, allocation: 0.25, triggerDistance: 0.03 },  // 25% a -3%
        { level: 3, allocation: 0.20, triggerDistance: 0.06 },  // 20% a -6%
        { level: 4, allocation: 0.15, triggerDistance: 0.10 },  // 15% a -10%
        { level: 5, allocation: 0.10, triggerDistance: 0.15 }   // 10% a -15%
      ],

      // CONFIGURACIÓN PYRAMID
      pyramidLevels: [
        { level: 1, allocation: 0.40, triggerProfit: 0.00 },   // 40% inicial
        { level: 2, allocation: 0.30, triggerProfit: 0.05 },   // 30% a +5%
        { level: 3, allocation: 0.20, triggerProfit: 0.10 },   // 20% a +10%
        { level: 4, allocation: 0.10, triggerProfit: 0.15 }    // 10% a +15%
      ]
    };
  }

  /**
   * Analizar oportunidad de promediación
   */
  async analyzeAveragingOpportunity(marketData, currentPosition, strategy = 'DCA') {
    try {
      const analysis = {
        symbol: marketData.symbol,
        currentPrice: marketData.price,
        strategy: strategy,
        timestamp: new Date(),
        opportunity: null,
        riskAssessment: null,
        recommendations: []
      };

      // Validar posición existente
      if (!currentPosition || !currentPosition.entries) {
        return this.generateInitialEntry(marketData, strategy);
      }

      // Calcular métricas de posición actual
      const positionMetrics = this.calculatePositionMetrics(currentPosition);

      // Validar límites de riesgo
      const riskValidation = this.validateRiskLimits(positionMetrics, marketData);
      if (!riskValidation.valid) {
        analysis.riskAssessment = riskValidation;
        return analysis;
      }

      // Analizar según estrategia
      switch (strategy) {
        case 'DCA':
          analysis.opportunity = await this.analyzeDCAOpportunity(marketData, positionMetrics);
          break;
        case 'PYRAMID':
          analysis.opportunity = await this.analyzePyramidOpportunity(marketData, positionMetrics);
          break;
        case 'SCALE_IN':
          analysis.opportunity = await this.analyzeScaleInOpportunity(marketData, positionMetrics);
          break;
        case 'SCALE_OUT':
          analysis.opportunity = await this.analyzeScaleOutOpportunity(marketData, positionMetrics);
          break;
        default:
          throw new Error(`Estrategia no soportada: ${strategy}`);
      }

      // Generar recomendaciones
      analysis.recommendations = this.generateRecommendations(analysis.opportunity, positionMetrics);
      analysis.riskAssessment = this.assessRiskLevel(analysis.opportunity, positionMetrics);

      return analysis;

    } catch (error) {
      console.error('❌ Error en análisis de promediación:', error);
      throw error;
    }
  }

  /**
   * Calcular métricas de posición actual
   */
  calculatePositionMetrics(position) {
    const entries = position.entries || [];
    if (entries.length === 0) {
      return {
        entryCount: 0,
        averagePrice: 0,
        totalSize: 0,
        totalInvested: 0,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0
      };
    }

    // Calcular precio promedio ponderado
    let totalSize = 0;
    let totalInvested = 0;

    entries.forEach(entry => {
      totalSize += entry.size;
      totalInvested += entry.size * entry.price;
    });

    const averagePrice = totalInvested / totalSize;
    const currentPrice = position.currentPrice || entries[entries.length - 1].price;
    const unrealizedPnL = (currentPrice - averagePrice) * totalSize;
    const unrealizedPnLPercent = ((currentPrice - averagePrice) / averagePrice) * 100;

    return {
      entryCount: entries.length,
      averagePrice,
      totalSize,
      totalInvested,
      unrealizedPnL,
      unrealizedPnLPercent,
      currentPrice,
      side: position.side || 'LONG',
      maxDistance: this.calculateMaxDistance(entries, currentPrice)
    };
  }

  /**
   * Calcular distancia máxima entre entradas
   */
  calculateMaxDistance(entries, currentPrice) {
    if (entries.length === 0) return 0;

    const prices = entries.map(e => e.price);
    const minPrice = Math.min(...prices, currentPrice);
    const maxPrice = Math.max(...prices, currentPrice);

    return ((maxPrice - minPrice) / minPrice) * 100;
  }

  /**
   * Validar límites de riesgo
   */
  validateRiskLimits(positionMetrics, marketData) {
    const validation = {
      valid: true,
      reasons: []
    };

    // Validar número máximo de posiciones
    if (positionMetrics.entryCount >= this.config.maxPositions) {
      validation.valid = false;
      validation.reasons.push(`Máximo ${this.config.maxPositions} entradas alcanzado`);
    }

    // Validar riesgo total
    const totalRiskPercent = Math.abs(positionMetrics.unrealizedPnLPercent);
    if (totalRiskPercent > this.config.maxTotalRisk * 100) {
      validation.valid = false;
      validation.reasons.push(`Riesgo total excede ${this.config.maxTotalRisk * 100}%`);
    }

    // Validar distancia máxima de promediación
    if (positionMetrics.maxDistance > this.config.maxAverageDown * 100) {
      validation.valid = false;
      validation.reasons.push(`Distancia de promediación excede ${this.config.maxAverageDown * 100}%`);
    }

    return validation;
  }

  /**
   * Analizar oportunidad DCA (Dollar Cost Averaging)
   */
  async analyzeDCAOpportunity(marketData, positionMetrics) {
    const currentPrice = marketData.price;
    const averagePrice = positionMetrics.averagePrice;
    const entryLevel = positionMetrics.entryCount + 1;

    // Buscar nivel DCA apropiado
    const dcaLevel = this.config.dcaLevels.find(level =>
      level.level === entryLevel &&
      level.level <= this.config.dcaLevels.length
    );

    if (!dcaLevel) {
      return {
        type: 'DCA',
        action: 'NONE',
        reason: 'No hay más niveles DCA disponibles'
      };
    }

    // Calcular distancia del precio
    const priceDistance = ((averagePrice - currentPrice) / averagePrice) * 100;
    const targetDistance = dcaLevel.triggerDistance * 100;

    // Verificar si se cumple la condición de trigger
    if (priceDistance >= targetDistance) {
      // Calcular tamaño de entrada
      const basePosition = positionMetrics.totalInvested / positionMetrics.entryCount;
      const newEntrySize = (basePosition * dcaLevel.allocation) / currentPrice;

      return {
        type: 'DCA',
        action: 'BUY',
        level: entryLevel,
        price: currentPrice,
        size: newEntrySize,
        allocation: dcaLevel.allocation,
        priceDistance: priceDistance,
        targetDistance: targetDistance,
        confidence: this.calculateDCAConfidence(marketData, positionMetrics),
        reasoning: `DCA Nivel ${entryLevel}: Precio bajo ${priceDistance.toFixed(2)}% vs objetivo ${targetDistance}%`
      };
    }

    return {
      type: 'DCA',
      action: 'WAIT',
      reason: `Esperando caída a ${targetDistance}% (actual: ${priceDistance.toFixed(2)}%)`
    };
  }

  /**
   * Analizar oportunidad Pyramid Building
   */
  async analyzePyramidOpportunity(marketData, positionMetrics) {
    const currentPrice = marketData.price;
    const averagePrice = positionMetrics.averagePrice;
    const entryLevel = positionMetrics.entryCount + 1;

    // Solo para posiciones en ganancia
    if (positionMetrics.unrealizedPnLPercent <= 0) {
      return {
        type: 'PYRAMID',
        action: 'NONE',
        reason: 'Pyramid solo disponible en posiciones ganadoras'
      };
    }

    // Buscar nivel pyramid apropiado
    const pyramidLevel = this.config.pyramidLevels.find(level =>
      level.level === entryLevel &&
      level.level <= this.config.pyramidLevels.length
    );

    if (!pyramidLevel) {
      return {
        type: 'PYRAMID',
        action: 'NONE',
        reason: 'No hay más niveles pyramid disponibles'
      };
    }

    // Verificar ganancia mínima
    const currentProfit = positionMetrics.unrealizedPnLPercent;
    const requiredProfit = pyramidLevel.triggerProfit * 100;

    if (currentProfit >= requiredProfit) {
      // Calcular tamaño de entrada (menor que DCA por mayor riesgo)
      const basePosition = positionMetrics.totalInvested / positionMetrics.entryCount;
      const newEntrySize = (basePosition * pyramidLevel.allocation) / currentPrice;

      return {
        type: 'PYRAMID',
        action: 'BUY',
        level: entryLevel,
        price: currentPrice,
        size: newEntrySize,
        allocation: pyramidLevel.allocation,
        currentProfit: currentProfit,
        requiredProfit: requiredProfit,
        confidence: this.calculatePyramidConfidence(marketData, positionMetrics),
        reasoning: `Pyramid Nivel ${entryLevel}: Ganancia ${currentProfit.toFixed(2)}% supera mínimo ${requiredProfit}%`
      };
    }

    return {
      type: 'PYRAMID',
      action: 'WAIT',
      reason: `Esperando ganancia de ${requiredProfit}% (actual: ${currentProfit.toFixed(2)}%)`
    };
  }

  /**
   * Analizar Scale In (entrada gradual)
   */
  async analyzeScaleInOpportunity(marketData, positionMetrics) {
    const technicalAnalysis = await this.getTechnicalAnalysis(marketData.symbol);
    const currentPrice = marketData.price;

    // Identificar niveles de soporte
    const supportLevels = technicalAnalysis.supportLevels || [];
    const nearestSupport = this.findNearestLevel(currentPrice, supportLevels, 'below');

    if (!nearestSupport) {
      return {
        type: 'SCALE_IN',
        action: 'NONE',
        reason: 'No hay niveles de soporte identificados'
      };
    }

    const distanceToSupport = ((currentPrice - nearestSupport.price) / currentPrice) * 100;

    // Scale in cerca de soportes fuertes
    if (distanceToSupport <= 2 && nearestSupport.strength >= 0.7) {
      const entrySize = this.calculateScaleInSize(positionMetrics, nearestSupport.strength);

      return {
        type: 'SCALE_IN',
        action: 'BUY',
        price: currentPrice,
        size: entrySize,
        supportLevel: nearestSupport.price,
        distanceToSupport: distanceToSupport,
        supportStrength: nearestSupport.strength,
        confidence: nearestSupport.strength,
        reasoning: `Scale In cerca de soporte fuerte en ${nearestSupport.price}`
      };
    }

    return {
      type: 'SCALE_IN',
      action: 'WAIT',
      reason: `Esperando acercamiento a soporte en ${nearestSupport.price}`
    };
  }

  /**
   * Analizar Scale Out (salida gradual)
   */
  async analyzeScaleOutOpportunity(marketData, positionMetrics) {
    if (positionMetrics.unrealizedPnLPercent <= 0) {
      return {
        type: 'SCALE_OUT',
        action: 'NONE',
        reason: 'Scale Out solo para posiciones ganadoras'
      };
    }

    const technicalAnalysis = await this.getTechnicalAnalysis(marketData.symbol);
    const currentPrice = marketData.price;
    const resistanceLevels = technicalAnalysis.resistanceLevels || [];
    const nearestResistance = this.findNearestLevel(currentPrice, resistanceLevels, 'above');

    if (!nearestResistance) {
      return {
        type: 'SCALE_OUT',
        action: 'NONE',
        reason: 'No hay niveles de resistencia identificados'
      };
    }

    const distanceToResistance = ((nearestResistance.price - currentPrice) / currentPrice) * 100;

    // Scale out cerca de resistencias fuertes
    if (distanceToResistance <= 2 && nearestResistance.strength >= 0.7) {
      const exitPercentage = this.calculateScaleOutPercentage(positionMetrics, nearestResistance.strength);

      return {
        type: 'SCALE_OUT',
        action: 'SELL',
        price: currentPrice,
        exitPercentage: exitPercentage,
        resistanceLevel: nearestResistance.price,
        distanceToResistance: distanceToResistance,
        resistanceStrength: nearestResistance.strength,
        expectedProfit: positionMetrics.unrealizedPnL * (exitPercentage / 100),
        confidence: nearestResistance.strength,
        reasoning: `Scale Out cerca de resistencia fuerte en ${nearestResistance.price}`
      };
    }

    return {
      type: 'SCALE_OUT',
      action: 'WAIT',
      reason: `Esperando acercamiento a resistencia en ${nearestResistance.price}`
    };
  }

  /**
   * Calcular confianza DCA
   */
  calculateDCAConfidence(marketData, positionMetrics) {
    let confidence = 0.5; // Base

    // Mayor confianza si está cerca de soportes históricos
    if (marketData.nearSupport) confidence += 0.2;

    // Mayor confianza en tendencia alcista general
    if (marketData.trend === 'BULLISH') confidence += 0.2;

    // Menor confianza si ya hay muchas entradas
    confidence -= (positionMetrics.entryCount - 1) * 0.1;

    return Math.max(0.1, Math.min(0.9, confidence));
  }

  /**
   * Calcular confianza Pyramid
   */
  calculatePyramidConfidence(marketData, positionMetrics) {
    let confidence = 0.7; // Base alta para pyramid

    // Mayor confianza con momentum fuerte
    if (marketData.momentum > 0.6) confidence += 0.2;

    // Menor confianza cerca de resistencias
    if (marketData.nearResistance) confidence -= 0.3;

    // Menor confianza con muchos niveles pyramid
    confidence -= (positionMetrics.entryCount - 1) * 0.15;

    return Math.max(0.1, Math.min(0.9, confidence));
  }

  /**
   * Generar entrada inicial
   */
  generateInitialEntry(marketData, strategy) {
    const initialAllocation = strategy === 'PYRAMID' ? 0.4 : 0.3;

    return {
      symbol: marketData.symbol,
      strategy: strategy,
      opportunity: {
        type: 'INITIAL_ENTRY',
        action: 'BUY',
        level: 1,
        price: marketData.price,
        allocation: initialAllocation,
        confidence: 0.8,
        reasoning: `Entrada inicial con estrategia ${strategy}`
      },
      riskAssessment: {
        riskLevel: 'LOW',
        maxRisk: this.config.maxTotalRisk * 100
      }
    };
  }

  /**
   * Generar recomendaciones
   */
  generateRecommendations(opportunity, positionMetrics) {
    const recommendations = [];

    if (!opportunity || opportunity.action === 'NONE') {
      recommendations.push({
        type: 'INFO',
        message: 'No hay oportunidades de promediación en este momento',
        priority: 'LOW'
      });
      return recommendations;
    }

    if (opportunity.action === 'BUY') {
      recommendations.push({
        type: 'ACTION',
        message: `Ejecutar ${opportunity.type} - ${opportunity.reasoning}`,
        priority: opportunity.confidence > 0.7 ? 'HIGH' : 'MEDIUM',
        details: {
          price: opportunity.price,
          size: opportunity.size,
          allocation: opportunity.allocation
        }
      });

      // Recomendación de stop loss ajustado
      recommendations.push({
        type: 'RISK_MANAGEMENT',
        message: 'Ajustar stop loss después de nueva entrada',
        priority: 'HIGH'
      });
    }

    if (opportunity.action === 'SELL') {
      recommendations.push({
        type: 'PROFIT_TAKING',
        message: `Scale Out ${opportunity.exitPercentage}% - ${opportunity.reasoning}`,
        priority: 'HIGH',
        details: {
          price: opportunity.price,
          exitPercentage: opportunity.exitPercentage,
          expectedProfit: opportunity.expectedProfit
        }
      });
    }

    return recommendations;
  }

  /**
   * Evaluar nivel de riesgo
   */
  assessRiskLevel(opportunity, positionMetrics) {
    if (!opportunity || opportunity.action === 'NONE') {
      return {
        level: 'LOW',
        factors: ['No hay acción requerida']
      };
    }

    const factors = [];
    let riskScore = 0;

    // Riesgo por número de entradas
    if (positionMetrics.entryCount >= 3) {
      riskScore += 0.3;
      factors.push('Múltiples entradas en posición');
    }

    // Riesgo por distancia de precio
    if (positionMetrics.maxDistance > 10) {
      riskScore += 0.4;
      factors.push('Gran dispersión de precios de entrada');
    }

    // Riesgo por tamaño de posición
    if (positionMetrics.totalInvested > 50000) { // USD
      riskScore += 0.2;
      factors.push('Posición de gran tamaño');
    }

    // Riesgo por tipo de estrategia
    if (opportunity.type === 'PYRAMID') {
      riskScore += 0.2;
      factors.push('Estrategia pyramid tiene mayor riesgo');
    }

    // Determinar nivel
    let level = 'LOW';
    if (riskScore > 0.7) level = 'HIGH';
    else if (riskScore > 0.4) level = 'MEDIUM';

    return {
      level,
      score: riskScore,
      factors,
      maxRisk: `${this.config.maxTotalRisk * 100}%`
    };
  }

  /**
   * Métodos auxiliares
   */
  async getTechnicalAnalysis(symbol) {
    // Placeholder - integrar con technicalAnalysisService
    return {
      supportLevels: [],
      resistanceLevels: []
    };
  }

  findNearestLevel(price, levels, direction) {
    if (!levels || levels.length === 0) return null;

    const filtered = direction === 'above'
      ? levels.filter(l => l.price > price)
      : levels.filter(l => l.price < price);

    return filtered.sort((a, b) =>
      direction === 'above'
        ? a.price - b.price
        : b.price - a.price
    )[0] || null;
  }

  calculateScaleInSize(positionMetrics, supportStrength) {
    const baseSize = positionMetrics.totalSize / positionMetrics.entryCount;
    const strengthMultiplier = 0.5 + (supportStrength * 0.5); // 0.5 a 1.0
    return baseSize * strengthMultiplier;
  }

  calculateScaleOutPercentage(positionMetrics, resistanceStrength) {
    const basePercentage = 25; // 25% base
    const strengthBonus = resistanceStrength * 25; // hasta 25% adicional
    return Math.min(50, basePercentage + strengthBonus); // máximo 50%
  }
}

module.exports = new AveragingSystemService();