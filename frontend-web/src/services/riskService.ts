import { apiPost } from './api'
import { API_ENDPOINTS } from '@/lib/config'

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

export interface BreakevenCheck {
  shouldMoveToBreakeven: boolean
  currentGainPercent: number
  recommendation: string
  newStopLoss?: number
}

export interface LosingStreakData {
  isInLosingStreak: boolean
  consecutiveLosses: number
  totalLossPercent: number
  recommendation: string
  shouldReduceRisk: boolean
}

export const riskService = {
  // Calculate position size based on risk parameters
  calculatePosition: (params: {
    accountBalance: number
    riskPercentage: number
    entryPrice: number
    stopLoss: number
    leverage?: number
  }) =>
    apiPost<any>(API_ENDPOINTS.RISK_CALCULATE_POSITION, {
      accountBalance: params.accountBalance,
      entryPrice: params.entryPrice,
      stopLossPrice: params.stopLoss,
      riskPercent: params.riskPercentage,
      leverage: params.leverage,
    }).then((resp): PositionCalculation => {
      if (!resp?.success) {
        throw new Error(resp?.error || 'Failed to calculate position size')
      }
      const d = resp?.data || {}
      return {
        positionSize: d.positionSize ?? 0,
        riskAmount: d.riskAmount ?? (params.accountBalance * (params.riskPercentage / 100)),
        leverage: d.leverage ?? (params.leverage ?? 1),
        marginRequired: d.requiredCapital ?? (d.positionValue ? d.positionValue / (d.leverage || 1) : 0),
        maxLoss: d.riskAmount ?? (params.accountBalance * (params.riskPercentage / 100)),
        isValid: true,
        warnings: resp?.warnings ?? [],
      }
    }),

  // Validate if stop loss is technically sound
  validateStopLoss: (params: {
    symbol: string
    entryPrice: number
    stopLoss: number
    direction: 'LONG' | 'SHORT'
  }) =>
    apiPost<any>(API_ENDPOINTS.RISK_VALIDATE_STOP_LOSS, {
      entryPrice: params.entryPrice,
      stopLossPrice: params.stopLoss,
      // Backend optionally supports supportLevel/resistanceLevel; not provided here
    }).then((resp): StopLossValidation => {
      if (!resp?.success) {
        throw new Error(resp?.error || 'Failed to validate stop loss')
      }
      const d = resp?.data || {}
      const validations = Array.isArray(d.validations) ? d.validations : []
      const warnings = validations
        .filter((v: any) => v.status === 'warning')
        .map((v: any) => v.message)
      const errors = validations
        .filter((v: any) => v.status === 'error')
        .map((v: any) => v.message)
      return {
        isValid: Boolean(d.isValid) && errors.length === 0,
        recommendedSL: params.stopLoss,
        riskPercentage: d.riskPercent ?? Math.abs((params.entryPrice - params.stopLoss) / params.entryPrice) * 100,
        warnings: [...warnings, ...errors.map((e: string) => `ERROR: ${e}`)],
      }
    }),

  // Calculate optimal take profit based on R:R ratio
  calculateTakeProfit: (params: {
    entryPrice: number
    stopLoss: number
    direction: 'LONG' | 'SHORT'
    targetRR?: number
  }) =>
    apiPost<any>(API_ENDPOINTS.RISK_CALCULATE_TAKE_PROFIT, {
      entryPrice: params.entryPrice,
      stopLossPrice: params.stopLoss,
      riskRewardRatio: params.targetRR,
    }).then((resp): TakeProfitCalculation => {
      if (!resp?.success) {
        throw new Error(resp?.error || 'Failed to calculate take profit')
      }
      const d = resp?.data || {}
      return {
        takeProfit: d.takeProfitPrice ?? params.entryPrice,
        riskReward: d.riskRewardRatio ?? (params.targetRR ?? 2),
        expectedProfit: d.rewardDistance ?? Math.abs(params.entryPrice - params.stopLoss) * (params.targetRR ?? 2),
        isOptimal: true,
        warnings: [],
      }
    }),

  // Check if position should move to breakeven
  checkBreakeven: (params: {
    entryPrice: number
    currentPrice: number
    stopLoss: number
    direction: 'LONG' | 'SHORT'
  }) =>
    apiPost<any>(API_ENDPOINTS.RISK_CHECK_BREAKEVEN, {
      entryPrice: params.entryPrice,
      currentPrice: params.currentPrice,
      currentStopLoss: params.stopLoss,
      // profitThreshold can be optionally added by caller
    }).then((resp): BreakevenCheck => {
      if (!resp?.success) {
        throw new Error(resp?.error || 'Failed to check breakeven')
      }
      const d = resp || {}
      const data = d?.data || {}
      const move = d?.action === 'move_to_breakeven'
      return {
        shouldMoveToBreakeven: move,
        currentGainPercent: data.currentProfitPercent ?? 0,
        recommendation: move ? 'MOVE_TO_BREAKEVEN' : 'HOLD',
        newStopLoss: data.newStopLoss,
      }
    }),

  detectLosingStreak: (params?: {
    recentTrades: Array<{ pnl: number }>
    portfolioBalance: number
    initialBalance: number
  }) =>
    apiPost<any>(API_ENDPOINTS.RISK_DETECT_STREAK, params ?? {}).then((resp): LosingStreakData => {
      const d = resp?.data || {}
      const recs = Array.isArray(d.recommendations) ? d.recommendations : []
      return {
        isInLosingStreak: Boolean(d.shouldPause || d.emergencyStop),
        consecutiveLosses: d.consecutiveLosses ?? 0,
        totalLossPercent: d.totalDrawdown ?? 0,
        recommendation: recs[0]?.message || (d.emergencyStop ? 'EMERGENCY_STOP' : d.shouldPause ? 'PAUSE' : 'OK'),
        shouldReduceRisk: Boolean(d.shouldPause || d.emergencyStop),
      }
    }),
}