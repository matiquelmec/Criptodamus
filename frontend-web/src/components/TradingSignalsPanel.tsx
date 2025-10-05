import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Search,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  BarChart3,
  Settings,
  RefreshCw
} from 'lucide-react'
import { useActiveSignals, useGenerateSignal, useBulkScanMarket, useUpdateSignalStatus } from '@/hooks/useSignals'
import { formatCurrency, formatPercentage, cn } from '@/lib/utils'
import { type TradingSignal } from '@/services/signalService'

const getSignalStatusIcon = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return <Clock className="w-4 h-4 text-blue-500" />
    case 'EXECUTED':
      return <Play className="w-4 h-4 text-green-500" />
    case 'CLOSED':
      return <CheckCircle className="w-4 h-4 text-green-500" />
    case 'CANCELLED':
      return <XCircle className="w-4 h-4 text-red-500" />
    default:
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />
  }
}

const getSignalStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'EXECUTED':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'CLOSED':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getConfluenceColor = (score: number) => {
  if (score >= 85) return 'text-green-600 bg-green-50'
  if (score >= 75) return 'text-yellow-600 bg-yellow-50'
  if (score >= 65) return 'text-orange-600 bg-orange-50'
  return 'text-red-600 bg-red-50'
}

const getDirectionIcon = (direction: string) => {
  return direction === 'LONG' ? (
    <TrendingUp className="w-4 h-4 text-green-500" />
  ) : (
    <TrendingDown className="w-4 h-4 text-red-500" />
  )
}

export const TradingSignalsPanel: React.FC = () => {
  const [symbolInput, setSymbolInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  const {
    data: activeSignals,
    isLoading: signalsLoading,
    error: signalsError,
    refetch: refetchSignals
  } = useActiveSignals()

  const generateSignal = useGenerateSignal()
  const bulkScanMarket = useBulkScanMarket()
  const updateSignalStatus = useUpdateSignalStatus()

  const handleGenerateSignal = async () => {
    if (!symbolInput.trim()) return

    try {
      await generateSignal.mutateAsync({
        symbol: symbolInput.toUpperCase(),
        timeframe: '4h'
      })
      setSymbolInput('')
    } catch (error) {
      console.error('Error generating signal:', error)
    }
  }

  const handleBulkScan = async () => {
    setIsScanning(true)
    try {
      await bulkScanMarket.mutateAsync({
        minConfidence: 75
      })
    } catch (error) {
      console.error('Error scanning market:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleStatusUpdate = async (signalId: string, status: string) => {
    try {
      await updateSignalStatus.mutateAsync({
        signalId,
        status
      })
    } catch (error) {
      console.error('Error updating signal status:', error)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              🎯 Trading Signals
              <Badge variant="outline" className="ml-2">
                {activeSignals?.length || 0} Active
              </Badge>
            </CardTitle>
            <CardDescription>
              AI-generated trading opportunities with confluence scoring
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSignals()}
              disabled={signalsLoading}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", signalsLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Enter symbol (e.g., BTCUSDT)"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGenerateSignal()}
              className="flex-1"
            />
            <Button
              onClick={handleGenerateSignal}
              disabled={!symbolInput.trim() || generateSignal.isPending}
              size="sm"
            >
              <Target className="w-4 h-4 mr-2" />
              Generate
            </Button>
          </div>
          <Button
            onClick={handleBulkScan}
            disabled={isScanning || bulkScanMarket.isPending}
            variant="outline"
            size="sm"
          >
            <Zap className={cn("w-4 h-4 mr-2", isScanning && "animate-pulse")} />
            {isScanning ? 'Scanning...' : 'Scan Market'}
          </Button>
        </div>

        {/* Error Display */}
        {signalsError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive">
              Failed to load signals: {signalsError.message}
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {signalsLoading ? (
          // Loading State
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-5 bg-muted rounded w-24"></div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activeSignals?.length === 0 ? (
          // Empty State
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Signals</h3>
            <p className="text-muted-foreground mb-4">
              Generate your first signal by entering a symbol above or scan the market for opportunities.
            </p>
            <Button onClick={handleBulkScan} disabled={isScanning}>
              <Zap className="w-4 h-4 mr-2" />
              Scan Market Now
            </Button>
          </div>
        ) : (
          // Signals List
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {activeSignals?.map((signal: TradingSignal) => (
              <div
                key={signal.id}
                className="border border-border rounded-lg p-4 hover:bg-muted/20 transition-colors"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getDirectionIcon(signal.direction)}
                      <span className="font-bold text-lg">{signal.symbol}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", getSignalStatusColor(signal.status))}
                      >
                        {getSignalStatusIcon(signal.status)}
                        {signal.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Confluence Score */}
                    <div className={cn(
                      "px-2 py-1 rounded-md text-xs font-bold",
                      getConfluenceColor(signal.confluenceScore)
                    )}>
                      {signal.confluenceScore}%
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(signal.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Price Levels */}
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Entry Price</p>
                    <p className="font-bold text-blue-600">
                      {formatCurrency(signal.entryPrice)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Stop Loss</p>
                    <p className="font-bold text-red-600">
                      {formatCurrency(signal.stopLoss)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Take Profit</p>
                    <p className="font-bold text-green-600">
                      {formatCurrency(signal.takeProfit)}
                    </p>
                  </div>
                </div>

                {/* Analysis & Metrics */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-4">
                    <span>R/R: {signal.riskReward.toFixed(2)}</span>
                    <span>Confidence: {signal.confidence}%</span>
                    <span>TF: {signal.analysis.timeframe}</span>
                  </div>
                </div>

                {/* Indicators */}
                {signal.analysis.indicators && signal.analysis.indicators.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {signal.analysis.indicators.slice(0, 5).map((indicator, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {indicator}
                      </Badge>
                    ))}
                    {signal.analysis.indicators.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{signal.analysis.indicators.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                {signal.status === 'ACTIVE' && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusUpdate(signal.id, 'EXECUTED')}
                      disabled={updateSignalStatus.isPending}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Execute
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusUpdate(signal.id, 'CANCELLED')}
                      disabled={updateSignalStatus.isPending}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusUpdate(signal.id, 'CLOSED')}
                      disabled={updateSignalStatus.isPending}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Close
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}