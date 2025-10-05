import { apiGet } from './api'
import { API_ENDPOINTS } from '@/lib/config'
import { type CryptoPrice, type FearGreedIndex, type FundingRate } from '@/types/trading'

export const marketService = {
  // Health check
  getHealth: () => apiGet(API_ENDPOINTS.MARKET_HEALTH),

  // Market prices
  getPrices: (symbols?: string[]) => {
    const query = symbols ? `?symbols=${symbols.join(',')}` : ''
    return apiGet<CryptoPrice[]>(`${API_ENDPOINTS.MARKET_PRICES}${query}`)
  },

  // Top cryptocurrencies
  getTopCryptos: (limit: number = 20) =>
    apiGet<CryptoPrice[]>(`${API_ENDPOINTS.MARKET_TOP_CRYPTOS}?limit=${limit}`),

  // Fear & Greed Index
  getFearGreedIndex: () =>
    apiGet<FearGreedIndex>(API_ENDPOINTS.MARKET_FEAR_GREED),

  // Funding rates
  getFundingRates: (symbols?: string[]) => {
    const query = symbols ? `?symbols=${symbols.join(',')}` : ''
    return apiGet<FundingRate[]>(`${API_ENDPOINTS.MARKET_FUNDING_RATES}${query}`)
  },

  // Market opportunities
  getOpportunities: () =>
    apiGet(API_ENDPOINTS.MARKET_OPPORTUNITIES),
}