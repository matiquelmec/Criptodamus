import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 30 seconds for most data
      staleTime: 30 * 1000,
      // Cache time: 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests
      retry: 2,
      // Refetch on window focus for real-time data
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Query keys for consistent caching
export const QUERY_KEYS = {
  // System
  HEALTH: ['health'],

  // Market
  MARKET_PRICES: ['market', 'prices'],
  MARKET_TOP_CRYPTOS: ['market', 'top-cryptos'],
  MARKET_FEAR_GREED: ['market', 'fear-greed'],
  MARKET_FUNDING_RATES: ['market', 'funding-rates'],
  MARKET_OPPORTUNITIES: ['market', 'opportunities'],

  // Signals
  SIGNALS: ['signals'],
  SIGNAL: (symbol: string) => ['signals', symbol],
  SIGNALS_CONFIG: ['signals', 'config'],

  // Analysis
  ANALYSIS_RSI: (symbol: string) => ['analysis', 'rsi', symbol],
  ANALYSIS_FIBONACCI: (symbol: string) => ['analysis', 'fibonacci', symbol],
  ANALYSIS_SR: (symbol: string) => ['analysis', 'support-resistance', symbol],
  ANALYSIS_BBWP: (symbol: string) => ['analysis', 'bbwp', symbol],

  // Risk
  RISK_POSITION: ['risk', 'position'],
  RISK_VALIDATION: ['risk', 'validation'],

  // Portfolio
  PORTFOLIO: ['portfolio'],
  POSITIONS: ['portfolio', 'positions'],
} as const