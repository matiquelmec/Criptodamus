import { useQuery } from '@tanstack/react-query'
import { analysisService } from '@/services/analysisService'

export const useAnalysisOverview = (symbol: string, timeframe: string) => {
  return useQuery({
    queryKey: ['analysis', 'overview', symbol, timeframe],
    queryFn: () => analysisService.getOverview(symbol, timeframe),
    enabled: Boolean(symbol),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

export const useRSI = (symbol: string, timeframe: string) => {
  return useQuery({
    queryKey: ['analysis', 'rsi', symbol, timeframe],
    queryFn: () => analysisService.getRSI(symbol, timeframe),
    enabled: Boolean(symbol),
    staleTime: 10_000,
    refetchInterval: 60_000,
  })
}

export const useFibonacci = (symbol: string, timeframe: string) => {
  return useQuery({
    queryKey: ['analysis', 'fibonacci', symbol, timeframe],
    queryFn: () => analysisService.getFibonacci(symbol, timeframe),
    enabled: Boolean(symbol),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  })
}

export const useSupportResistance = (symbol: string, timeframe: string) => {
  return useQuery({
    queryKey: ['analysis', 'sr', symbol, timeframe],
    queryFn: () => analysisService.getSupportResistance(symbol, timeframe),
    enabled: Boolean(symbol),
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  })
}

export const useBBWP = (symbol: string, timeframe: string) => {
  return useQuery({
    queryKey: ['analysis', 'bbwp', symbol, timeframe],
    queryFn: () => analysisService.getBBWP(symbol, timeframe),
    enabled: Boolean(symbol),
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  })
}

export const useConfluence = (symbol: string, timeframe: string) => {
  return useQuery({
    queryKey: ['analysis', 'confluence', symbol, timeframe],
    queryFn: () => analysisService.getConfluence(symbol, timeframe),
    enabled: Boolean(symbol),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}
