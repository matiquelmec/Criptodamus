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
    apiPost<PositionCalculation>(API_ENDPOINTS.RISK_CALCULATE_POSITION, params),

  // Validate if stop loss is technically sound
  validateStopLoss: (params: {
    symbol: string
    entryPrice: number
    stopLoss: number
    direction: 'LONG' | 'SHORT'
  }) =>
    apiPost<StopLossValidation>(API_ENDPOINTS.RISK_VALIDATE_STOP_LOSS, params),

  // Calculate optimal take profit based on R:R ratio
  calculateTakeProfit: (params: {
    entryPrice: number
    stopLoss: number
    direction: 'LONG' | 'SHORT'
    targetRR?: number
  }) =>
    apiPost<TakeProfitCalculation>(API_ENDPOINTS.RISK_CALCULATE_TAKE_PROFIT, params),

  // Check if position should move to breakeven
  checkBreakeven: (params: {
    entryPrice: number
    currentPrice: number
    stopLoss: number
    direction: 'LONG' | 'SHORT'
  }) =>
    apiPost<BreakevenCheck>(API_ENDPOINTS.RISK_CHECK_BREAKEVEN, params),

  // Detect losing streak and suggest risk adjustments
  detectLosingStreak: () =>
    apiPost<LosingStreakData>(API_ENDPOINTS.RISK_DETECT_STREAK, {}),
}