import { apiGet } from './api'
import { API_ENDPOINTS } from '@/lib/config'
import { type CryptoPrice, type FundingRate } from '@/types/trading'

export const marketService = {
  // Health check
  getHealth: () => apiGet(API_ENDPOINTS.MARKET_HEALTH),

  // Market prices
  getPrices: (symbols?: string[]) => {
    const query = symbols ? `?symbols=${symbols.join(',')}` : ''
    return apiGet<CryptoPrice[]>(`${API_ENDPOINTS.MARKET_PRICES}${query}`)
  },

  // Top cryptocurrencies
  getTopCryptos: async (limit: number = 50) => {
    const response = await apiGet<{success: boolean, data: CryptoPrice[], count: number}>(`${API_ENDPOINTS.MARKET_TOP_CRYPTOS}?limit=${limit}`)
    return response.data
  },

  // Fear & Greed Index
  getFearGreedIndex: async () => {
    const response = await apiGet<{
      success: boolean,
      data: {
        fearGreedIndex: {
          value: number,
          valueClassification: string,
          timestamp: string,
          lastUpdate: string
        },
        btcDominance: number,
        totalMarketCap: number,
        lastUpdate: string
      }
    }>(API_ENDPOINTS.MARKET_FEAR_GREED)
    
    // Transform the response to match FearGreedIndex type
    if (response?.data?.fearGreedIndex) {
      return {
        value: response.data.fearGreedIndex.value,
        classification: response.data.fearGreedIndex.valueClassification,
        timestamp: response.data.fearGreedIndex.timestamp,
        btcDominance: response.data.btcDominance,
        totalMarketCap: response.data.totalMarketCap
      }
    }
    
    return {
      value: 0,
      classification: 'Unknown',
      timestamp: new Date().toISOString()
    }
  },

  // Funding rates
  getFundingRates: (symbols?: string[]) => {
    const query = symbols ? `?symbols=${symbols.join(',')}` : ''
    return apiGet<FundingRate[]>(`${API_ENDPOINTS.MARKET_FUNDING_RATES}${query}`)
  },

  // Market opportunities
  getOpportunities: () =>
    apiGet(API_ENDPOINTS.MARKET_OPPORTUNITIES),
}