/**
 * LIQUIDATION SERVICE - API CLIENT PARA MAPAS DE LIQUIDACIONES
 *
 * Cliente API para análisis de liquidaciones y mapas de calor
 * Implementa todas las funcionalidades profesionales del PDF
 */

import { apiGet, apiPost } from './api';

// Tipos de datos
export interface LiquidationData {
  id: string;
  symbol: string;
  price: number;
  size: number;
  side: 'long' | 'short';
  leverage: number;
  timestamp: Date;
  orderType: 'market' | 'limit';
  clusterId?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

export interface LiquidationCluster {
  id: string;
  minPrice: number;
  maxPrice: number;
  centerPrice: number;
  liquidations: LiquidationData[];
  totalVolume: number;
  density: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface HeatmapLevel {
  level: number;
  priceRange: {
    min: number;
    max: number;
    center: number;
  };
  liquidationCount: number;
  totalVolume: number;
  intensity: number;
  color: string;
  riskLabel: 'Safe' | 'Caution' | 'Warning' | 'Danger' | 'Critical';
}

export interface LiquidationHeatmap {
  symbol: string;
  resolution: number;
  priceRange: {
    min: number;
    max: number;
  };
  levels: HeatmapLevel[];
  maxIntensity: number;
  hotspots: number;
  generated: Date;
}

export interface LiquidationAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  volume?: number;
  count?: number;
  ratio?: number;
  impact: 'low' | 'medium' | 'high';
}

export interface RiskLevels {
  immediate: {
    level: 'low' | 'medium' | 'high';
    count: number;
    volume: number;
  };
  shortTerm: {
    level: 'low' | 'medium' | 'high';
    count: number;
    volume: number;
  };
  mediumTerm: {
    level: 'low' | 'medium' | 'high';
    count: number;
    volume: number;
  };
  criticalLevels: Array<{
    price: number;
    volume: number;
    distance: number;
    riskLevel: string;
  }>;
  recommendations: Array<{
    type: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

export interface LiquidationAnalysis {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  liquidations: LiquidationData[];
  summary: {
    totalLiquidations: number;
    totalVolume: number;
    averageSize: number;
    longLiquidations: {
      count: number;
      volume: number;
      averageLeverage: number;
    };
    shortLiquidations: {
      count: number;
      volume: number;
      averageLeverage: number;
    };
    leverageDistribution: Record<string, number>;
  };
  clusters: LiquidationCluster[];
  heatmap: LiquidationHeatmap;
  alerts: LiquidationAlert[];
  riskLevels: RiskLevels;
  predictions: {
    nextLiquidationZones: Array<{
      priceLevel: number;
      probability: number;
      expectedVolume: number;
      timeframe: string;
      confidence: 'low' | 'medium' | 'high';
    }>;
    safezones: Array<{
      price: number;
      reason: string;
    }>;
    dangerZones: Array<{
      price: number;
      reason: string;
      riskLevel: string;
    }>;
  };
}

// Endpoints de la API
const API_ENDPOINTS = {
  ANALYSIS: (symbol: string) => `/liquidations/analysis/${symbol}`,
  HEATMAP: (symbol: string) => `/liquidations/heatmap/${symbol}`,
  CLUSTERS: (symbol: string) => `/liquidations/clusters/${symbol}`,
  ALERTS: (symbol: string) => `/liquidations/alerts/${symbol}`,
  RISK_LEVELS: (symbol: string) => `/liquidations/risk-levels/${symbol}`,
  MULTI_SYMBOL: '/liquidations/multi-symbol',
  STATS: '/liquidations/stats',
  CACHE: '/liquidations/cache'
};

export const liquidationService = {
  /**
   * Obtener análisis completo de liquidaciones
   */
  getAnalysis: async (
    symbol: string,
    options: {
      timeframe?: string;
      includeHeatmap?: boolean;
      includeClusters?: boolean;
      includeAlerts?: boolean;
    } = {}
  ): Promise<LiquidationAnalysis> => {
    const params = new URLSearchParams();
    if (options.timeframe) params.append('timeframe', options.timeframe);
    if (options.includeHeatmap !== undefined) params.append('includeHeatmap', String(options.includeHeatmap));
    if (options.includeClusters !== undefined) params.append('includeClusters', String(options.includeClusters));
    if (options.includeAlerts !== undefined) params.append('includeAlerts', String(options.includeAlerts));

    const url = `${API_ENDPOINTS.ANALYSIS(symbol)}?${params.toString()}`;
    const response = await apiGet<{ data: LiquidationAnalysis }>(url);
    return response.data;
  },

  /**
   * Obtener mapa de calor específico
   */
  getHeatmap: async (
    symbol: string,
    options: {
      timeframe?: string;
      resolution?: number;
    } = {}
  ): Promise<{
    heatmap: LiquidationHeatmap;
    summary: {
      symbol: string;
      timeframe: string;
      maxIntensity: number;
      hotspots: number;
      resolution: number;
    };
  }> => {
    const params = new URLSearchParams();
    if (options.timeframe) params.append('timeframe', options.timeframe);
    if (options.resolution) params.append('resolution', String(options.resolution));

    const url = `${API_ENDPOINTS.HEATMAP(symbol)}?${params.toString()}`;
    const response = await apiGet<{ data: any }>(url);
    return response.data;
  },

  /**
   * Obtener clusters de liquidaciones
   */
  getClusters: async (
    symbol: string,
    options: {
      timeframe?: string;
      minSize?: number;
    } = {}
  ): Promise<{
    clusters: LiquidationCluster[];
    summary: {
      totalClusters: number;
      totalVolume: number;
      highRiskClusters: number;
    };
  }> => {
    const params = new URLSearchParams();
    if (options.timeframe) params.append('timeframe', options.timeframe);
    if (options.minSize) params.append('minSize', String(options.minSize));

    const url = `${API_ENDPOINTS.CLUSTERS(symbol)}?${params.toString()}`;
    const response = await apiGet<{ data: any }>(url);
    return response.data;
  },

  /**
   * Obtener alertas críticas
   */
  getAlerts: async (
    symbol: string,
    options: {
      timeframe?: string;
      severity?: 'all' | 'info' | 'warning' | 'critical';
    } = {}
  ): Promise<{
    alerts: LiquidationAlert[];
    summary: {
      totalAlerts: number;
      criticalAlerts: number;
      warningAlerts: number;
      lastUpdate: Date;
    };
  }> => {
    const params = new URLSearchParams();
    if (options.timeframe) params.append('timeframe', options.timeframe);
    if (options.severity) params.append('severity', options.severity);

    const url = `${API_ENDPOINTS.ALERTS(symbol)}?${params.toString()}`;
    const response = await apiGet<{ data: any }>(url);
    return response.data;
  },

  /**
   * Obtener niveles de riesgo
   */
  getRiskLevels: async (
    symbol: string,
    options: {
      timeframe?: string;
    } = {}
  ): Promise<{
    riskLevels: RiskLevels;
    predictions: LiquidationAnalysis['predictions'];
  }> => {
    const params = new URLSearchParams();
    if (options.timeframe) params.append('timeframe', options.timeframe);

    const url = `${API_ENDPOINTS.RISK_LEVELS(symbol)}?${params.toString()}`;
    const response = await apiGet<{ data: any }>(url);
    return response.data;
  },

  /**
   * Análisis de múltiples símbolos
   */
  getMultiSymbolAnalysis: async (
    symbols: string[],
    options: {
      timeframe?: string;
      maxSymbols?: number;
    } = {}
  ): Promise<{
    results: Record<string, {
      alerts: number;
      clusters: number;
      riskLevel: string;
      lastUpdate: Date;
      error?: string;
      processed?: boolean;
    }>;
    summary: {
      processedSymbols: number;
      totalAlerts: number;
      highRiskSymbols: number;
      avgProcessingTime: number;
    };
  }> => {
    const response = await apiPost<{ data: any }>(API_ENDPOINTS.MULTI_SYMBOL, {
      symbols,
      timeframe: options.timeframe || '5m',
      maxSymbols: options.maxSymbols || 10
    });
    return response.data;
  },

  /**
   * Obtener estadísticas del servicio
   */
  getStats: async (): Promise<{
    totalLiquidations: number;
    totalVolume: number;
    byTimeframe: Record<string, number>;
    byLeverage: Record<string, number>;
    massLiquidationEvents: number;
    cacheSize: number;
    lastUpdate: Date;
  }> => {
    const response = await apiGet<{ data: any }>(API_ENDPOINTS.STATS);
    return response.data;
  },

  /**
   * Limpiar cache
   */
  clearCache: async (): Promise<{ message: string }> => {
    const response = await apiGet<{ message: string }>(API_ENDPOINTS.CACHE);
    return response;
  }
};

// Funciones de utilidad para el frontend
export const liquidationUtils = {
  /**
   * Formatear volumen de liquidaciones
   */
  formatVolume: (volume: number): string => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
    return `$${volume.toFixed(2)}`;
  },

  /**
   * Obtener color de riesgo
   */
  getRiskColor: (riskLevel: string): string => {
    switch (riskLevel) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'critical': return '#dc2626';
      case 'extreme': return '#7c2d12';
      default: return '#6b7280';
    }
  },

  /**
   * Obtener icono de severidad
   */
  getSeverityIcon: (severity: string): string => {
    switch (severity) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '📊';
    }
  },

  /**
   * Formatear precio con precisión dinámica
   */
  formatPrice: (price: number, symbol: string): string => {
    if (symbol.includes('BTC')) return price.toFixed(2);
    if (symbol.includes('ETH')) return price.toFixed(3);
    if (price < 1) return price.toFixed(6);
    if (price < 100) return price.toFixed(4);
    return price.toFixed(2);
  },

  /**
   * Calcular distancia de precio
   */
  calculatePriceDistance: (price1: number, price2: number): number => {
    return Math.abs((price1 - price2) / price2) * 100;
  },

  /**
   * Determinar urgencia de alerta
   */
  getAlertUrgency: (alert: LiquidationAlert): 'low' | 'medium' | 'high' => {
    if (alert.severity === 'critical') return 'high';
    if (alert.severity === 'warning' && alert.impact === 'high') return 'medium';
    return 'low';
  }
};