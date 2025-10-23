import { apiGet, apiPost, apiPut } from './api'
import { API_ENDPOINTS } from '@/lib/config'

// Interface para la respuesta del backend (tal como viene)
export interface BackendSignal {
  success: boolean
  type: 'VALID_SIGNAL' | 'NEUTRAL_SIGNAL' | 'REJECTED_SIGNAL' | 'FILTERED_SIGNAL'
  symbol: string
  direction: 'long' | 'short' | 'neutral'
  timestamp: string
  currentPrice: number
  entry?: number
  stopLoss?: number
  takeProfit?: number
  riskReward?: number
  confluenceScore: number
  confidence?: 'strong' | 'moderate' | 'weak'
  reason?: string
  message?: string
  positionSize?: number
  leverage?: number
  technicalContext?: {
    rsi: number
    nearbyLevels: any[]
    patterns: any[]
    timeframe: string
  }
  alerts?: any[]
}

// Interface normalizada para el frontend
export interface TradingSignal {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT' | 'NEUTRAL'
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskReward: number
  confidence: number
  confluenceScore: number
  analysis: {
    timeframe: string
    indicators: string[]
    patterns: string[]
    confluence: number
  }
  status: 'ACTIVE' | 'EXECUTED' | 'CLOSED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
  type: string
  currentPrice: number
  message?: string
  alerts?: any[]
}

// Función para normalizar señales del backend al formato del frontend
const normalizeSignal = (backendSignal: BackendSignal): TradingSignal => {
  return {
    id: `${backendSignal.symbol}_${backendSignal.timestamp}`,
    symbol: backendSignal.symbol,
    direction: backendSignal.direction.toUpperCase() as 'LONG' | 'SHORT' | 'NEUTRAL',
    entryPrice: backendSignal.entry || backendSignal.currentPrice,
    stopLoss: backendSignal.stopLoss || 0,
    takeProfit: backendSignal.takeProfit || 0,
    riskReward: backendSignal.riskReward || 0,
    confidence: backendSignal.confluenceScore || 0,
    confluenceScore: backendSignal.confluenceScore || 0,
    analysis: {
      timeframe: backendSignal.technicalContext?.timeframe || '4h',
      indicators: ['RSI', 'Fibonacci', 'Support/Resistance'],
      patterns: backendSignal.technicalContext?.patterns?.map(p => p.type) || [],
      confluence: backendSignal.confluenceScore || 0
    },
    status: backendSignal.success && backendSignal.type === 'VALID_SIGNAL' ? 'ACTIVE' : 'CANCELLED',
    createdAt: backendSignal.timestamp,
    updatedAt: backendSignal.timestamp,
    type: backendSignal.type,
    currentPrice: backendSignal.currentPrice,
    message: backendSignal.message || backendSignal.reason,
    alerts: backendSignal.alerts || []
  }
}

export const signalService = {
  // Get active signals from top movers scan
  getActiveSignals: async (): Promise<TradingSignal[]> => {
    try {
      const response = await apiGet<any>(`${API_ENDPOINTS.SIGNALS_TOP_MOVERS}?forceRefresh=true`)

      if (response?.success && response?.data) {
        // Obtener las señales (priorizar topPicks si existe)
        const backendSignals: BackendSignal[] = response.data.topPicks || response.data.signals || []

        // Normalizar las señales para el frontend
        return backendSignals.map(normalizeSignal)
      }

      // Fallback para estructura alternativa
      const fallbackSignals: BackendSignal[] = response?.data?.signals || response?.signals || []
      return fallbackSignals.map(normalizeSignal)
    } catch (error) {
      console.error('Error fetching active signals:', error)
      return []
    }
  },

  // Get signal history
  getSignalHistory: (limit: number = 50) =>
    apiGet<TradingSignal[]>(`${API_ENDPOINTS.SIGNALS}/history?limit=${limit}`),

  // Generate signal for a symbol (OPTIMIZADO PARA SCALPING)
  generateSignal: (symbol: string, timeframe: string = '5m', accountBalance: number = 10000) =>
    apiPost<TradingSignal>(`${API_ENDPOINTS.SIGNALS_GENERATE}/${encodeURIComponent(symbol)}`, {
      timeframe,
      accountBalance,
    }),

  // Bulk scan market
  bulkScanMarket: (symbols?: string[], minConfidence: number = 75, timeframe: string = '4h', accountBalance: number = 10000) =>
    apiPost<any>(`${API_ENDPOINTS.SIGNALS_SCAN}`, {
      symbols,
      timeframe,
      accountBalance,
      minConfluenceScore: minConfidence,
    }),

  // Update signal status
  updateSignalStatus: async (_signalId: string, _status: string, _notes?: string) => {
    // No backend endpoint available; return a resolved promise to avoid UI errors
    return Promise.resolve({ success: true })
  },

  // Scan multiple symbols
  scanMultiple: (symbols: string[], timeframe: string = '4h') =>
    apiPost<TradingSignal[]>(`${API_ENDPOINTS.SIGNALS}/scan`, {
      symbols,
      timeframe,
    }),

  getConfluence: (symbol: string, timeframe: string = '4h') =>
    apiGet(`${API_ENDPOINTS.SIGNALS_CONFLUENCE}/${encodeURIComponent(symbol)}?timeframe=${encodeURIComponent(timeframe)}`),

  // Get/update signal configuration
  getConfig: () =>
    apiGet(`${API_ENDPOINTS.SIGNALS_CONFIG}`),

  updateConfig: (config: any) =>
    apiPut(`${API_ENDPOINTS.SIGNALS_CONFIG}`, config),
}