import { apiGet, apiPost, apiPut } from './api'
import { API_ENDPOINTS } from '@/lib/config'

export interface TradingSignal {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
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
}

export const signalService = {
  // Get active signals
  getActiveSignals: () =>
    apiGet<TradingSignal[]>(`${API_ENDPOINTS.SIGNALS}/active`),

  // Get signal history
  getSignalHistory: (limit: number = 50) =>
    apiGet<TradingSignal[]>(`${API_ENDPOINTS.SIGNALS}/history?limit=${limit}`),

  // Generate signal for a symbol
  generateSignal: (symbol: string, timeframe: string = '4h') =>
    apiPost<TradingSignal>(`${API_ENDPOINTS.SIGNALS}/generate`, {
      symbol,
      timeframe,
    }),

  // Bulk scan market
  bulkScanMarket: (symbols?: string[], minConfidence: number = 75) =>
    apiPost<TradingSignal[]>(`${API_ENDPOINTS.SIGNALS}/bulk-scan`, {
      symbols,
      minConfidence,
    }),

  // Update signal status
  updateSignalStatus: (signalId: string, status: string, notes?: string) =>
    apiPut<TradingSignal>(`${API_ENDPOINTS.SIGNALS}/${signalId}/status`, {
      status,
      notes,
    }),

  // Scan multiple symbols
  scanMultiple: (symbols: string[], timeframe: string = '4h') =>
    apiPost<TradingSignal[]>(`${API_ENDPOINTS.SIGNALS}/scan`, {
      symbols,
      timeframe,
    }),

  // Get confluence analysis
  getConfluence: (symbol: string, timeframe: string = '4h') =>
    apiPost(`${API_ENDPOINTS.SIGNALS}/confluence`, {
      symbol,
      timeframe,
    }),

  // Get/update signal configuration
  getConfig: () =>
    apiGet(`${API_ENDPOINTS.SIGNALS}/config`),

  updateConfig: (config: any) =>
    apiPost(`${API_ENDPOINTS.SIGNALS}/config`, config),
}