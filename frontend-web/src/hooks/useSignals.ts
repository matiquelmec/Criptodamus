import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { signalService } from '@/services/signalService'
import { QUERY_KEYS } from '@/lib/queryClient'

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

export const useActiveSignals = () => {
  return useQuery({
    queryKey: QUERY_KEYS.SIGNALS_ACTIVE,
    queryFn: () => signalService.getActiveSignals(),
    // Refresh every 30 seconds for active signals
    refetchInterval: 30000,
    staleTime: 15000,
  })
}

export const useSignalHistory = (limit: number = 50) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.SIGNALS_HISTORY, limit],
    queryFn: () => signalService.getSignalHistory(limit),
    // Refresh every 5 minutes for history
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })
}

export const useGenerateSignal = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { symbol: string; timeframe?: string }) =>
      signalService.generateSignal(params.symbol, params.timeframe),
    onSuccess: () => {
      // Invalidate signals queries to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SIGNALS_ACTIVE })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SIGNALS_HISTORY })
    },
  })
}

export const useBulkScanMarket = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { symbols?: string[]; minConfidence?: number }) =>
      signalService.bulkScanMarket(params.symbols, params.minConfidence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SIGNALS_ACTIVE })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SIGNALS_HISTORY })
    },
  })
}

export const useUpdateSignalStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { signalId: string; status: string; notes?: string }) =>
      signalService.updateSignalStatus(params.signalId, params.status, params.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SIGNALS_ACTIVE })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SIGNALS_HISTORY })
    },
  })
}