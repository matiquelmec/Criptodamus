import { apiGet, apiPost } from './api'
import { API_ENDPOINTS } from '@/lib/config'
import { type TradingSignal } from '@/types/trading'

export const signalService = {
  // Generate signal for a symbol
  generateSignal: (symbol: string, timeframe: string = '4h') =>
    apiPost<TradingSignal>(API_ENDPOINTS.SIGNALS_GENERATE, {
      symbol,
      timeframe,
    }),

  // Scan multiple symbols
  scanMultiple: (symbols: string[], timeframe: string = '4h') =>
    apiPost<TradingSignal[]>(API_ENDPOINTS.SIGNALS_SCAN, {
      symbols,
      timeframe,
    }),

  // Get confluence analysis
  getConfluence: (symbol: string, timeframe: string = '4h') =>
    apiPost(API_ENDPOINTS.SIGNALS_CONFLUENCE, {
      symbol,
      timeframe,
    }),

  // Get/update signal configuration
  getConfig: () =>
    apiGet(API_ENDPOINTS.SIGNALS_CONFIG),

  updateConfig: (config: any) =>
    apiPost(API_ENDPOINTS.SIGNALS_CONFIG, config),
}