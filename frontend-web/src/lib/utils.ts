import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: string = 'USDT'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value) + ' ' + currency
}

export function formatPercentage(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)

  return value >= 0 ? `+${formatted}` : formatted
}

export function formatNumber(value: number): string {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(2) + 'B'
  }
  if (value >= 1e6) {
    return (value / 1e6).toFixed(2) + 'M'
  }
  if (value >= 1e3) {
    return (value / 1e3).toFixed(2) + 'K'
  }
  return value.toFixed(2)
}

export function getPriceChangeColor(change: number): string {
  if (change > 0) return 'text-bullish'
  if (change < 0) return 'text-bearish'
  return 'text-muted-foreground'
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 85) return 'text-green-500'
  if (confidence >= 70) return 'text-yellow-500'
  if (confidence >= 50) return 'text-orange-500'
  return 'text-red-500'
}