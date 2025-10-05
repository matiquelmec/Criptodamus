import { useQuery } from '@tanstack/react-query'
import { marketService } from '@/services/marketService'
import { QUERY_KEYS } from '@/lib/queryClient'

export const useMarketPrices = (symbols?: string[]) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.MARKET_PRICES, ...(symbols || [])],
    queryFn: () => marketService.getPrices(symbols),
    // Refresh every 5 seconds for real-time prices
    refetchInterval: 5000,
    staleTime: 2000,
  })
}

export const useTopCryptos = (limit: number = 20) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.MARKET_TOP_CRYPTOS, limit],
    queryFn: () => marketService.getTopCryptos(limit),
    // Refresh every 10 seconds
    refetchInterval: 10000,
    staleTime: 5000,
  })
}

export const useFearGreedIndex = () => {
  return useQuery({
    queryKey: QUERY_KEYS.MARKET_FEAR_GREED,
    queryFn: () => marketService.getFearGreedIndex(),
    // Refresh every 30 minutes (data updates once per day)
    refetchInterval: 30 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  })
}

export const useFundingRates = (symbols?: string[]) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.MARKET_FUNDING_RATES, ...(symbols || [])],
    queryFn: () => marketService.getFundingRates(symbols),
    // Refresh every minute
    refetchInterval: 60000,
    staleTime: 30000,
  })
}

export const useMarketOpportunities = () => {
  return useQuery({
    queryKey: QUERY_KEYS.MARKET_OPPORTUNITIES,
    queryFn: () => marketService.getOpportunities(),
    // Refresh every 15 minutes
    refetchInterval: 15 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  })
}