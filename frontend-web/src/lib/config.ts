export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3001',
  env: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const

export const API_ENDPOINTS = {
  // Market Data
  MARKET_HEALTH: '/api/health',
  MARKET_PRICES: '/api/market/prices',
  MARKET_TOP_CRYPTOS: '/api/market/data',
  MARKET_FEAR_GREED: '/api/market/macro',
  MARKET_FUNDING_RATES: '/api/market/funding-rates',
  MARKET_OPPORTUNITIES: '/api/market/opportunities',

  // Risk Management
  RISK_CALCULATE_POSITION: '/api/risk/calculate-position',
  RISK_VALIDATE_STOP_LOSS: '/api/risk/validate-stop-loss',
  RISK_CALCULATE_TAKE_PROFIT: '/api/risk/calculate-take-profit',
  RISK_CHECK_BREAKEVEN: '/api/risk/check-breakeven',
  RISK_DETECT_STREAK: '/api/risk/check-trading-streak',

  // Technical Analysis
  ANALYSIS_RSI: '/api/analysis/rsi',
  ANALYSIS_FIBONACCI: '/api/analysis/fibonacci',
  ANALYSIS_SUPPORT_RESISTANCE: '/api/analysis/support-resistance',
  ANALYSIS_BBWP: '/api/analysis/bbwp',
  ANALYSIS_PATTERNS: '/api/analysis/patterns',
  ANALYSIS_CONFLUENCE: '/api/analysis/confluence',
  ANALYSIS_MULTI_TIMEFRAME: '/api/analysis/multi-timeframe',

  // Signal Generation
  SIGNALS: '/api/signals',
  SIGNALS_GENERATE: '/api/signals/generate',
  SIGNALS_SCAN: '/api/signals/scan',
  SIGNALS_TOP_MOVERS: '/api/signals/scan/top-movers',
  SIGNALS_CONFLUENCE: '/api/signals/confluence',
  SIGNALS_CONFIG: '/api/signals/config',

  // Notifications
  NOTIFICATIONS_TELEGRAM: '/api/notifications/telegram',
  NOTIFICATIONS_TEST: '/api/notifications/test',
  NOTIFICATIONS_CONFIG: '/api/notifications/config',
  NOTIFICATIONS_SCAN_ALERT: '/api/notifications/scan-and-alert',

  // System
  HEALTH: '/api/health',
} as const