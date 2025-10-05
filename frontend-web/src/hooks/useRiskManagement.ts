import { useQuery, useMutation } from '@tanstack/react-query'
import { riskService } from '@/services/riskService'
import { QUERY_KEYS } from '@/lib/queryClient'

export interface PositionCalculation {
  positionSize: number
  riskAmount: number
  leverage: number
  marginRequired: number
  maxLoss: number
  isValid: boolean
  warnings: string[]
}

export interface StopLossValidation {
  isValid: boolean
  recommendedSL: number
  riskPercentage: number
  warnings: string[]
}

export interface TakeProfitCalculation {
  takeProfit: number
  riskReward: number
  expectedProfit: number
  isOptimal: boolean
  warnings: string[]
}

export const useCalculatePosition = () => {
  return useMutation({
    mutationFn: (params: {
      accountBalance: number
      riskPercentage: number
      entryPrice: number
      stopLoss: number
      leverage?: number
    }) => riskService.calculatePosition(params),
  })
}

export const useValidateStopLoss = () => {
  return useMutation({
    mutationFn: (params: {
      symbol: string
      entryPrice: number
      stopLoss: number
      direction: 'LONG' | 'SHORT'
    }) => riskService.validateStopLoss(params),
  })
}

export const useCalculateTakeProfit = () => {
  return useMutation({
    mutationFn: (params: {
      entryPrice: number
      stopLoss: number
      direction: 'LONG' | 'SHORT'
      targetRR?: number
    }) => riskService.calculateTakeProfit(params),
  })
}

export const useCheckBreakeven = () => {
  return useMutation({
    mutationFn: (params: {
      entryPrice: number
      currentPrice: number
      stopLoss: number
      direction: 'LONG' | 'SHORT'
    }) => riskService.checkBreakeven(params),
  })
}

export const useDetectLosingStreak = () => {
  return useQuery({
    queryKey: QUERY_KEYS.RISK_VALIDATION,
    queryFn: () => riskService.detectLosingStreak(),
    // Check losing streak every hour
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  })
}

// Custom hook for real-time risk calculation
export const useRiskCalculator = () => {
  const calculatePosition = useCalculatePosition()
  const validateStopLoss = useValidateStopLoss()
  const calculateTakeProfit = useCalculateTakeProfit()
  const checkBreakeven = useCheckBreakeven()

  const calculateAll = async (params: {
    symbol: string
    accountBalance: number
    riskPercentage: number
    entryPrice: number
    stopLoss: number
    direction: 'LONG' | 'SHORT'
    leverage?: number
    targetRR?: number
  }) => {
    const {
      symbol,
      accountBalance,
      riskPercentage,
      entryPrice,
      stopLoss,
      direction,
      leverage = 1,
      targetRR = 2
    } = params

    try {
      // Calculate position size
      const positionResult = await calculatePosition.mutateAsync({
        accountBalance,
        riskPercentage,
        entryPrice,
        stopLoss,
        leverage
      })

      // Validate stop loss
      const stopLossResult = await validateStopLoss.mutateAsync({
        symbol,
        entryPrice,
        stopLoss,
        direction
      })

      // Calculate take profit
      const takeProfitResult = await calculateTakeProfit.mutateAsync({
        entryPrice,
        stopLoss,
        direction,
        targetRR
      })

      return {
        position: positionResult,
        stopLossValidation: stopLossResult,
        takeProfit: takeProfitResult,
        isValid: positionResult.isValid && stopLossResult.isValid,
        warnings: [
          ...positionResult.warnings,
          ...stopLossResult.warnings,
          ...takeProfitResult.warnings
        ]
      }
    } catch (error) {
      console.error('Risk calculation error:', error)
      throw error
    }
  }

  return {
    calculateAll,
    calculatePosition,
    validateStopLoss,
    calculateTakeProfit,
    checkBreakeven,
    isLoading: calculatePosition.isPending || validateStopLoss.isPending || calculateTakeProfit.isPending,
    error: calculatePosition.error || validateStopLoss.error || calculateTakeProfit.error
  }
}