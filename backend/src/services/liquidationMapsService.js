/**
 * LIQUIDATION MAPS SERVICE - ANÁLISIS PROFESIONAL
 *
 * Implementa mapas de liquidaciones y zonas de calor según Memoria Agente PDF:
 * - Detección de clusters de liquidaciones
 * - Análisis de zonas de alta concentración
 * - Mapas de calor para identificar niveles críticos
 * - Alertas de liquidaciones masivas
 */

class LiquidationMapsService {
  constructor(marketDataService) {
    this.marketDataService = marketDataService;

    this.config = {
      // Configuración de liquidaciones
      timeframes: ['1m', '5m', '15m', '1h', '4h'],
      leverageRanges: [
        { min: 1, max: 5, label: 'Low Leverage' },
        { min: 5, max: 10, label: 'Medium Leverage' },
        { min: 10, max: 20, label: 'High Leverage' },
        { min: 20, max: 100, label: 'Extreme Leverage' }
      ],

      // Umbrales de alerta
      massLiquidationThreshold: 10000000, // $10M USD
      clusterDistancePercent: 0.5, // 0.5% para considerar cluster
      heatmapResolution: 50, // Número de niveles de precio

      // Configuración de colores para mapas de calor
      heatmapColors: [
        { threshold: 0, color: '#00ff00', label: 'Safe' },
        { threshold: 25, color: '#ffff00', label: 'Caution' },
        { threshold: 50, color: '#ff8000', label: 'Warning' },
        { threshold: 75, color: '#ff4000', label: 'Danger' },
        { threshold: 90, color: '#ff0000', label: 'Critical' }
      ]
    };

    // Cache de datos de liquidaciones
    this.liquidationCache = new Map();
    this.heatmapCache = new Map();

    // Estadísticas de liquidaciones
    this.stats = {
      totalLiquidations: 0,
      totalVolume: 0,
      byTimeframe: {},
      byLeverage: {},
      massLiquidationEvents: 0
    };
  }

  /**
   * ANÁLISIS PRINCIPAL DE LIQUIDACIONES
   * Obtiene y analiza datos de liquidaciones para un símbolo
   */
  async analyzeLiquidations(symbol, timeframe = '5m', options = {}) {
    try {
      const {
        includeHeatmap = true,
        includeClusters = true,
        includeAlerts = true,
        priceRange = null
      } = options;

      // Obtener datos de liquidaciones (simulados por ahora)
      const liquidationData = await this.fetchLiquidationData(symbol, timeframe);

      // Generar análisis completo
      const analysis = {
        symbol,
        timeframe,
        timestamp: new Date(),

        // Datos básicos de liquidaciones
        liquidations: liquidationData,

        // Estadísticas generales
        summary: this.generateLiquidationSummary(liquidationData),

        // Análisis de clusters
        clusters: includeClusters ? this.detectLiquidationClusters(liquidationData) : null,

        // Mapa de calor
        heatmap: includeHeatmap ? this.generateHeatmap(liquidationData, symbol) : null,

        // Alertas críticas
        alerts: includeAlerts ? this.generateLiquidationAlerts(liquidationData) : [],

        // Niveles de riesgo
        riskLevels: this.calculateRiskLevels(liquidationData),

        // Predicciones
        predictions: this.predictLiquidationZones(liquidationData)
      };

      // Guardar en cache
      this.cacheAnalysis(symbol, timeframe, analysis);

      return {
        success: true,
        data: analysis,
        metadata: {
          cacheable: true,
          validFor: 60000, // 1 minuto
          generated: new Date()
        }
      };

    } catch (error) {
      console.error(`Error en análisis de liquidaciones para ${symbol}:`, error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * OBTENER DATOS DE LIQUIDACIONES
   * Simula datos de liquidaciones (en producción conectaría con APIs reales)
   */
  async fetchLiquidationData(symbol, timeframe) {
    // Simular datos de liquidaciones realistas
    const currentPrice = await this.getCurrentPrice(symbol);
    const liquidations = [];

    // Generar liquidaciones sintéticas basadas en patrones reales
    for (let i = 0; i < 100; i++) {
      const priceOffset = (Math.random() - 0.5) * 0.1; // ±10%
      const price = currentPrice * (1 + priceOffset);

      // Determinar tipo de liquidación basado en precio
      const isLong = price < currentPrice;
      const leverage = Math.floor(Math.random() * 50) + 5; // 5-55x

      liquidations.push({
        id: `liq_${i}`,
        symbol,
        price: price,
        size: Math.random() * 1000000, // Hasta $1M
        side: isLong ? 'long' : 'short',
        leverage: leverage,
        timestamp: new Date(Date.now() - Math.random() * 3600000), // Última hora

        // Datos adicionales
        orderType: Math.random() > 0.7 ? 'market' : 'limit',
        clusterId: null, // Se asignará en análisis de clusters
        riskLevel: this.calculateLiquidationRisk(leverage, Math.random() * 1000000)
      });
    }

    return liquidations.sort((a, b) => a.price - b.price);
  }

  /**
   * GENERAR RESUMEN DE LIQUIDACIONES
   */
  generateLiquidationSummary(liquidationData) {
    const totalVolume = liquidationData.reduce((sum, liq) => sum + liq.size, 0);
    const longLiqs = liquidationData.filter(l => l.side === 'long');
    const shortLiqs = liquidationData.filter(l => l.side === 'short');

    return {
      totalLiquidations: liquidationData.length,
      totalVolume: totalVolume,
      averageSize: totalVolume / liquidationData.length,

      // Por lado
      longLiquidations: {
        count: longLiqs.length,
        volume: longLiqs.reduce((sum, l) => sum + l.size, 0),
        averageLeverage: longLiqs.reduce((sum, l) => sum + l.leverage, 0) / longLiqs.length
      },

      shortLiquidations: {
        count: shortLiqs.length,
        volume: shortLiqs.reduce((sum, l) => sum + l.size, 0),
        averageLeverage: shortLiqs.reduce((sum, l) => sum + l.leverage, 0) / shortLiqs.length
      },

      // Estadísticas de apalancamiento
      leverageDistribution: this.calculateLeverageDistribution(liquidationData),

      // Métricas de tiempo
      timeSpread: {
        oldest: Math.min(...liquidationData.map(l => l.timestamp.getTime())),
        newest: Math.max(...liquidationData.map(l => l.timestamp.getTime())),
        concentration: this.calculateTimeConcentration(liquidationData)
      }
    };
  }

  /**
   * DETECTAR CLUSTERS DE LIQUIDACIONES
   * Identifica zonas con alta concentración de liquidaciones
   */
  detectLiquidationClusters(liquidationData) {
    const clusters = [];
    const sortedLiqs = [...liquidationData].sort((a, b) => a.price - b.price);

    let currentCluster = null;

    for (let i = 0; i < sortedLiqs.length; i++) {
      const liq = sortedLiqs[i];

      if (!currentCluster) {
        currentCluster = {
          id: `cluster_${clusters.length}`,
          minPrice: liq.price,
          maxPrice: liq.price,
          centerPrice: liq.price,
          liquidations: [liq],
          totalVolume: liq.size,
          density: 1,
          riskLevel: 'low'
        };
        continue;
      }

      // Verificar si pertenece al cluster actual
      const distancePercent = Math.abs(liq.price - currentCluster.centerPrice) / currentCluster.centerPrice;

      if (distancePercent <= this.config.clusterDistancePercent / 100) {
        // Agregar al cluster actual
        currentCluster.liquidations.push(liq);
        currentCluster.totalVolume += liq.size;
        currentCluster.minPrice = Math.min(currentCluster.minPrice, liq.price);
        currentCluster.maxPrice = Math.max(currentCluster.maxPrice, liq.price);
        currentCluster.centerPrice = (currentCluster.minPrice + currentCluster.maxPrice) / 2;
        currentCluster.density = currentCluster.liquidations.length;

        // Asignar cluster ID a la liquidación
        liq.clusterId = currentCluster.id;
      } else {
        // Finalizar cluster actual si tiene suficiente densidad
        if (currentCluster.density >= 3) {
          currentCluster.riskLevel = this.calculateClusterRisk(currentCluster);
          clusters.push(currentCluster);
        }

        // Iniciar nuevo cluster
        currentCluster = {
          id: `cluster_${clusters.length}`,
          minPrice: liq.price,
          maxPrice: liq.price,
          centerPrice: liq.price,
          liquidations: [liq],
          totalVolume: liq.size,
          density: 1,
          riskLevel: 'low'
        };
      }
    }

    // Agregar último cluster si es válido
    if (currentCluster && currentCluster.density >= 3) {
      currentCluster.riskLevel = this.calculateClusterRisk(currentCluster);
      clusters.push(currentCluster);
    }

    return clusters.sort((a, b) => b.totalVolume - a.totalVolume);
  }

  /**
   * GENERAR MAPA DE CALOR
   * Crea un mapa de calor de liquidaciones por niveles de precio
   */
  generateHeatmap(liquidationData, symbol) {
    if (liquidationData.length === 0) return null;

    const prices = liquidationData.map(l => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const stepSize = priceRange / this.config.heatmapResolution;

    const heatmapData = [];

    for (let i = 0; i < this.config.heatmapResolution; i++) {
      const levelMinPrice = minPrice + (i * stepSize);
      const levelMaxPrice = levelMinPrice + stepSize;
      const levelCenterPrice = (levelMinPrice + levelMaxPrice) / 2;

      // Encontrar liquidaciones en este nivel
      const levelLiquidations = liquidationData.filter(liq =>
        liq.price >= levelMinPrice && liq.price < levelMaxPrice
      );

      const levelVolume = levelLiquidations.reduce((sum, liq) => sum + liq.size, 0);
      const levelCount = levelLiquidations.length;

      // Calcular intensidad del calor (0-100)
      const intensity = this.calculateHeatIntensity(levelVolume, levelCount, liquidationData);

      heatmapData.push({
        level: i,
        priceRange: {
          min: levelMinPrice,
          max: levelMaxPrice,
          center: levelCenterPrice
        },
        liquidationCount: levelCount,
        totalVolume: levelVolume,
        intensity: intensity,
        color: this.getHeatmapColor(intensity),
        riskLabel: this.getHeatmapRiskLabel(intensity)
      });
    }

    return {
      symbol,
      resolution: this.config.heatmapResolution,
      priceRange: { min: minPrice, max: maxPrice },
      levels: heatmapData,
      maxIntensity: Math.max(...heatmapData.map(l => l.intensity)),
      hotspots: heatmapData.filter(l => l.intensity > 75).length,
      generated: new Date()
    };
  }

  /**
   * GENERAR ALERTAS DE LIQUIDACIONES
   */
  generateLiquidationAlerts(liquidationData) {
    const alerts = [];

    // Alerta por liquidaciones masivas
    const totalVolume = liquidationData.reduce((sum, liq) => sum + liq.size, 0);
    if (totalVolume > this.config.massLiquidationThreshold) {
      alerts.push({
        type: 'mass_liquidation',
        severity: 'critical',
        message: `Liquidaciones masivas detectadas: $${(totalVolume / 1000000).toFixed(2)}M`,
        volume: totalVolume,
        impact: 'high'
      });
    }

    // Alerta por alta concentración de apalancamiento
    const highLeverageLiqs = liquidationData.filter(l => l.leverage > 20);
    if (highLeverageLiqs.length > liquidationData.length * 0.5) {
      alerts.push({
        type: 'high_leverage_concentration',
        severity: 'warning',
        message: `${highLeverageLiqs.length} liquidaciones con apalancamiento > 20x`,
        count: highLeverageLiqs.length,
        impact: 'medium'
      });
    }

    // Alerta por desequilibrio de liquidaciones
    const longLiqs = liquidationData.filter(l => l.side === 'long').length;
    const shortLiqs = liquidationData.filter(l => l.side === 'short').length;
    const imbalanceRatio = Math.max(longLiqs, shortLiqs) / Math.min(longLiqs, shortLiqs);

    if (imbalanceRatio > 3) {
      alerts.push({
        type: 'liquidation_imbalance',
        severity: 'warning',
        message: `Desequilibrio de liquidaciones: ${longLiqs > shortLiqs ? 'LONG' : 'SHORT'} dominante`,
        ratio: imbalanceRatio,
        impact: 'medium'
      });
    }

    return alerts;
  }

  /**
   * CALCULAR NIVELES DE RIESGO
   */
  calculateRiskLevels(liquidationData) {
    const prices = liquidationData.map(l => l.price);
    const currentPrice = this.getCurrentPrice(); // Simplificado

    return {
      immediate: this.calculateImmediateRisk(liquidationData, currentPrice),
      shortTerm: this.calculateShortTermRisk(liquidationData, currentPrice),
      mediumTerm: this.calculateMediumTermRisk(liquidationData, currentPrice),

      // Niveles críticos
      criticalLevels: this.identifyCriticalLevels(liquidationData, currentPrice),

      // Recomendaciones
      recommendations: this.generateRiskRecommendations(liquidationData, currentPrice)
    };
  }

  /**
   * PREDECIR ZONAS DE LIQUIDACIÓN
   */
  predictLiquidationZones(liquidationData) {
    // Algoritmo simplificado de predicción
    const clusters = this.detectLiquidationClusters(liquidationData);

    return {
      nextLiquidationZones: clusters.slice(0, 3).map(cluster => ({
        priceLevel: cluster.centerPrice,
        probability: this.calculateLiquidationProbability(cluster),
        expectedVolume: cluster.totalVolume * 1.2,
        timeframe: '15-30 minutes',
        confidence: cluster.density > 10 ? 'high' : 'medium'
      })),

      safezones: this.identifySafeZones(liquidationData),
      dangerZones: this.identifyDangerZones(liquidationData)
    };
  }

  /**
   * MÉTODOS AUXILIARES
   */

  async getCurrentPrice(symbol = 'BTCUSDT') {
    // Simplificado - en producción obtendría el precio real
    return 50000;
  }

  calculateLiquidationRisk(leverage, size) {
    if (leverage > 50) return 'extreme';
    if (leverage > 20) return 'high';
    if (leverage > 10) return 'medium';
    return 'low';
  }

  calculateLeverageDistribution(liquidationData) {
    const distribution = {};
    this.config.leverageRanges.forEach(range => {
      const count = liquidationData.filter(l =>
        l.leverage >= range.min && l.leverage < range.max
      ).length;
      distribution[range.label] = count;
    });
    return distribution;
  }

  calculateTimeConcentration(liquidationData) {
    // Calcular concentración temporal
    const timeWindows = {};
    liquidationData.forEach(liq => {
      const windowKey = Math.floor(liq.timestamp.getTime() / 300000); // 5 min windows
      timeWindows[windowKey] = (timeWindows[windowKey] || 0) + 1;
    });

    const maxConcentration = Math.max(...Object.values(timeWindows));
    return maxConcentration / liquidationData.length;
  }

  calculateClusterRisk(cluster) {
    const volumeRisk = cluster.totalVolume > 5000000 ? 'high' : 'medium';
    const densityRisk = cluster.density > 15 ? 'high' : 'medium';

    if (volumeRisk === 'high' && densityRisk === 'high') return 'critical';
    if (volumeRisk === 'high' || densityRisk === 'high') return 'high';
    return 'medium';
  }

  calculateHeatIntensity(volume, count, allLiquidations) {
    const maxVolume = Math.max(...allLiquidations.map(l => l.size));
    const volumeIntensity = (volume / maxVolume) * 50;
    const countIntensity = (count / allLiquidations.length) * 50;

    return Math.min(100, volumeIntensity + countIntensity);
  }

  getHeatmapColor(intensity) {
    for (let i = this.config.heatmapColors.length - 1; i >= 0; i--) {
      if (intensity >= this.config.heatmapColors[i].threshold) {
        return this.config.heatmapColors[i].color;
      }
    }
    return this.config.heatmapColors[0].color;
  }

  getHeatmapRiskLabel(intensity) {
    for (let i = this.config.heatmapColors.length - 1; i >= 0; i--) {
      if (intensity >= this.config.heatmapColors[i].threshold) {
        return this.config.heatmapColors[i].label;
      }
    }
    return this.config.heatmapColors[0].label;
  }

  calculateImmediateRisk(liquidationData, currentPrice) {
    const nearbyLiqs = liquidationData.filter(l =>
      Math.abs(l.price - currentPrice) / currentPrice < 0.01
    );

    return {
      level: nearbyLiqs.length > 10 ? 'high' : 'low',
      count: nearbyLiqs.length,
      volume: nearbyLiqs.reduce((sum, l) => sum + l.size, 0)
    };
  }

  calculateShortTermRisk(liquidationData, currentPrice) {
    const nearbyLiqs = liquidationData.filter(l =>
      Math.abs(l.price - currentPrice) / currentPrice < 0.03
    );

    return {
      level: nearbyLiqs.length > 20 ? 'high' : 'medium',
      count: nearbyLiqs.length,
      volume: nearbyLiqs.reduce((sum, l) => sum + l.size, 0)
    };
  }

  calculateMediumTermRisk(liquidationData, currentPrice) {
    const nearbyLiqs = liquidationData.filter(l =>
      Math.abs(l.price - currentPrice) / currentPrice < 0.05
    );

    return {
      level: nearbyLiqs.length > 30 ? 'high' : 'medium',
      count: nearbyLiqs.length,
      volume: nearbyLiqs.reduce((sum, l) => sum + l.size, 0)
    };
  }

  identifyCriticalLevels(liquidationData, currentPrice) {
    const clusters = this.detectLiquidationClusters(liquidationData);
    return clusters
      .filter(c => c.riskLevel === 'critical' || c.riskLevel === 'high')
      .map(c => ({
        price: c.centerPrice,
        volume: c.totalVolume,
        distance: Math.abs(c.centerPrice - currentPrice) / currentPrice,
        riskLevel: c.riskLevel
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  generateRiskRecommendations(liquidationData, currentPrice) {
    const recommendations = [];

    const immediateRisk = this.calculateImmediateRisk(liquidationData, currentPrice);
    if (immediateRisk.level === 'high') {
      recommendations.push({
        type: 'immediate_action',
        message: 'Evitar nuevas posiciones cerca del precio actual',
        priority: 'high'
      });
    }

    return recommendations;
  }

  calculateLiquidationProbability(cluster) {
    // Probabilidad basada en volumen y densidad
    const volumeScore = Math.min(cluster.totalVolume / 10000000, 1) * 50;
    const densityScore = Math.min(cluster.density / 20, 1) * 50;

    return volumeScore + densityScore;
  }

  identifySafeZones(liquidationData) {
    // Zonas con pocas liquidaciones
    const prices = liquidationData.map(l => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Simplificado - identificar gaps en liquidaciones
    return [
      { price: minPrice * 0.95, reason: 'Below liquidation cluster' },
      { price: maxPrice * 1.05, reason: 'Above liquidation cluster' }
    ];
  }

  identifyDangerZones(liquidationData) {
    const clusters = this.detectLiquidationClusters(liquidationData);
    return clusters
      .filter(c => c.riskLevel === 'critical' || c.riskLevel === 'high')
      .map(c => ({
        price: c.centerPrice,
        reason: `High liquidation cluster: ${c.totalVolume / 1000000}M volume`,
        riskLevel: c.riskLevel
      }));
  }

  cacheAnalysis(symbol, timeframe, analysis) {
    const key = `${symbol}_${timeframe}`;
    this.liquidationCache.set(key, {
      data: analysis,
      timestamp: Date.now(),
      ttl: 60000 // 1 minuto
    });
  }

  /**
   * MÉTODOS PÚBLICOS ADICIONALES
   */

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.liquidationCache.size,
      lastUpdate: new Date()
    };
  }

  clearCache() {
    this.liquidationCache.clear();
    this.heatmapCache.clear();
  }
}

module.exports = LiquidationMapsService;