import { apiGet } from './api'

export const analysisService = {
  // Overview for a symbol
  getOverview: (symbol: string, timeframe: string = '4h', periods: number = 150) =>
    apiGet<any>(`/api/analysis/${encodeURIComponent(symbol)}?timeframe=${encodeURIComponent(timeframe)}&periods=${encodeURIComponent(String(periods))}`),

  // RSI endpoint
  getRSI: (symbol: string, timeframe: string = '4h', periods: number = 150) =>
    apiGet<any>(`/api/analysis/${encodeURIComponent(symbol)}/rsi?timeframe=${encodeURIComponent(timeframe)}&periods=${encodeURIComponent(String(periods))}`),

  // Fibonacci levels
  getFibonacci: (symbol: string, timeframe: string = '4h', periods: number = 150) =>
    apiGet<any>(`/api/analysis/${encodeURIComponent(symbol)}/fibonacci?timeframe=${encodeURIComponent(timeframe)}&periods=${encodeURIComponent(String(periods))}`),

  // Support & Resistance
  getSupportResistance: (symbol: string, timeframe: string = '4h', periods: number = 150) =>
    apiGet<any>(`/api/analysis/${encodeURIComponent(symbol)}/levels?timeframe=${encodeURIComponent(timeframe)}&periods=${encodeURIComponent(String(periods))}`),

  // BBWP (volatility) - requires more periods
  getBBWP: (symbol: string, timeframe: string = '4h', periods: number = 300) =>
    apiGet<any>(`/api/analysis/${encodeURIComponent(symbol)}/bbwp?timeframe=${encodeURIComponent(timeframe)}&periods=${encodeURIComponent(String(periods))}`),

  // Patterns (optional)
  getPatterns: (symbol: string, timeframe: string = '4h', periods: number = 150) =>
    apiGet<any>(`/api/analysis/${encodeURIComponent(symbol)}/patterns?timeframe=${encodeURIComponent(timeframe)}&periods=${encodeURIComponent(String(periods))}`),

  // Confluence
  getConfluence: (symbol: string, timeframe: string = '4h', periods: number = 150) =>
    apiGet<any>(`/api/analysis/${encodeURIComponent(symbol)}/confluence?timeframe=${encodeURIComponent(timeframe)}&periods=${encodeURIComponent(String(periods))}`),
}
