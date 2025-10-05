// Market Data Types
export interface CryptoPrice {
  symbol: string
  price: number
  change24h: number
  changePercent24h: number
  volume24h: number
  marketCap: number
  rank: number
  lastUpdate: string
}

export interface FearGreedIndex {
  value: number
  classification: string
  timestamp: string
}

export interface FundingRate {
  symbol: string
  fundingRate: number
  nextFundingTime: string
  markPrice: number
}

// Technical Analysis Types
export interface RSIData {
  rsi: number
  signal: 'BUY' | 'SELL' | 'NEUTRAL'
  divergence?: {
    type: 'bullish' | 'bearish'
    strength: number
  }
}

export interface SupportResistance {
  supports: number[]
  resistances: number[]
  currentLevel: 'support' | 'resistance' | 'between'
  strength: number
}

export interface FibonacciLevels {
  levels: {
    level: number
    price: number
    type: 'support' | 'resistance'
  }[]
  goldenPocket: {
    min: number
    max: number
    current: boolean
  }
}

export interface BBWPData {
  bbwp: number
  percentile: number
  signal: 'EXPANSION' | 'COMPRESSION' | 'NEUTRAL'
  prediction: string
}

// Signal Types
export interface TradingSignal {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskReward: number
  confidence: number
  confluence: {
    score: number
    factors: string[]
  }
  analysis: {
    timeframe: string
    indicators: any[]
    patterns: string[]
  }
  status: 'ACTIVE' | 'CLOSED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
}

// Risk Management Types
export interface PositionSize {
  riskAmount: number
  positionSize: number
  leverage: number
  margin: number
  liquidationPrice: number
}

export interface RiskValidation {
  isValid: boolean
  reason?: string
  suggestions?: string[]
}

// Portfolio Types
export interface Portfolio {
  totalBalance: number
  availableBalance: number
  unrealizedPnl: number
  marginUsed: number
  positions: Position[]
  riskSettings: RiskSettings
}

export interface Position {
  symbol: string
  side: 'LONG' | 'SHORT'
  size: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  margin: number
  status: 'OPEN' | 'CLOSED'
}

export interface RiskSettings {
  maxRiskPerTrade: number
  maxLeverage: number
  preferredRiskReward: number
  autoStopLoss: boolean
  autoTakeProfit: boolean
}

// Notification Types
export interface NotificationConfig {
  telegram: {
    enabled: boolean
    chatId?: string
    botToken?: string
  }
  signals: boolean
  risks: boolean
  portfolio: boolean
}