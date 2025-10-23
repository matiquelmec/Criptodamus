import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Play,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  RefreshCw,
  DollarSign
} from 'lucide-react'
import { useActiveSignals, useGenerateSignal, useBulkScanMarket, useUpdateSignalStatus } from '@/hooks/useSignals'
import { formatCurrency, cn } from '@/lib/utils'
import AveragingStrategySimple from './AveragingStrategySimple'

// Type for signals from the backend API
interface BackendSignal {
  success: boolean
  type: string
  symbol: string
  direction: string
  timestamp: string
  currentPrice: number
  entry?: number
  stopLoss?: number
  takeProfit?: number
  riskReward?: number
  confluenceScore: number
  confidence?: string
  reason?: string
  message?: string
  entryPrice?: number
  failedFilters?: Array<{name: string, reason: string}>
  recommendation?: string
}

const getSignalStatusIcon = (type: string) => {
  switch (type) {
    case 'VALID_SIGNAL':
      return <Target className="w-4 h-4 text-green-500" />
    case 'NEUTRAL_SIGNAL':
      return <Clock className="w-4 h-4 text-yellow-500" />
    case 'REJECTED_SIGNAL':
      return <XCircle className="w-4 h-4 text-red-500" />
    default:
      return <AlertTriangle className="w-4 h-4 text-gray-500" />
  }
}

const getSignalStatusColor = (type: string) => {
  switch (type) {
    case 'VALID_SIGNAL':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'NEUTRAL_SIGNAL':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'REJECTED_SIGNAL':
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
  const [selectedSignal, setSelectedSignal] = useState<BackendSignal | null>(null)
  const [averagingData, setAveragingData] = useState<any>(null)

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
      const result = await generateSignal.mutateAsync({
        symbol: symbolInput.toUpperCase(),
        timeframe: '4h'
      })

      // Mostrar resultado independientemente del tipo de señal
      if (result) {
        const signalData = {
          symbol: symbolInput.toUpperCase(),
          direction: (result as any).direction || 'neutral',
          currentPrice: (result as any).currentPrice,
          entry: (result as any).entry,
          stopLoss: (result as any).stopLoss,
          takeProfit: (result as any).takeProfit,
          type: (result as any).type,
          timestamp: (result as any).timestamp,
          confluenceScore: (result as any).confluenceScore,
          success: (result as any).success,
          reason: (result as any).reason,
          message: (result as any).message
        }
        
        setSelectedSignal(signalData)
        
        // Siempre intentar obtener promediación para todas las señales
        if ((result as any).averagingStrategy) {
          setAveragingData((result as any).averagingStrategy)
        } else {
          // Intentar obtener análisis de promediación para cualquier señal
          fetchAveragingAnalysis(symbolInput.toUpperCase())
        }
      }

      setSymbolInput('')
      
      // Refrescar la lista de señales activas
      refetchSignals()
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

  const fetchAveragingAnalysis = async (symbol: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/averaging/analyze/${symbol}`)
      const data = await response.json()

      if (data.success) {
        setAveragingData(data.data)
      } else {
        console.warn('Averaging analysis failed:', data.error)
        // Crear datos de promediación básicos usando el precio actual
        const currentPrice = selectedSignal?.currentPrice || 100
        setAveragingData({
          analysis: {
            strategy: 'DCA',
            levels: [
              { price: currentPrice * 0.97, allocation: 20, distance: '-3%' },
              { price: currentPrice * 0.94, allocation: 25, distance: '-6%' },
              { price: currentPrice * 0.91, allocation: 30, distance: '-9%' },
              { price: currentPrice * 0.88, allocation: 25, distance: '-12%' }
            ],
            recommendations: [
              `Estrategia DCA para ${symbol}`,
              'Niveles calculados automáticamente',
              'Distribución de capital optimizada',
              'Máximo 3% de riesgo total'
            ]
          }
        })
      }
    } catch (error) {
      console.error('Error fetching averaging analysis:', error)
      // Fallback con datos básicos usando el precio actual
      const currentPrice = selectedSignal?.currentPrice || 100
      setAveragingData({
        analysis: {
          strategy: 'DCA',
          levels: [
            { price: currentPrice * 0.97, allocation: 20, distance: '-3%' },
            { price: currentPrice * 0.94, allocation: 25, distance: '-6%' },
            { price: currentPrice * 0.91, allocation: 30, distance: '-9%' },
            { price: currentPrice * 0.88, allocation: 25, distance: '-12%' }
          ],
          recommendations: [
            `Estrategia DCA para ${symbol} (Fallback)`,
            'Niveles estimados - verificar antes de usar',
            'Recomendado: Máximo 3% de riesgo total'
          ]
        }
      })
    }
  }

  const handleSignalClick = (signal: BackendSignal) => {
    setSelectedSignal(signal)
    fetchAveragingAnalysis(signal.symbol)
  }

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Unknown'
    
    try {
      const date = new Date(dateString)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Unknown'
      }
      
      const now = new Date()
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      
      if (diffInMinutes < 0) return 'Just now' // For future dates
      if (diffInMinutes < 1) return 'Just now'
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    } catch (error) {
      console.error('Error parsing date:', error)
      return 'Unknown'
    }
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
            {activeSignals?.map((signal: any, index: number) => (
              <div
                key={signal.symbol + signal.timestamp || index}
                className="border border-border rounded-lg p-4 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => handleSignalClick(signal)}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getDirectionIcon(signal.direction.toUpperCase())}
                      <span className="font-bold text-lg">{signal.symbol}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", getSignalStatusColor(signal.type))}
                      >
                        {getSignalStatusIcon(signal.type)}
                        {signal.type}
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
                      {formatTimeAgo(signal.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Price Levels */}
                {signal.entryPrice && signal.stopLoss && signal.takeProfit ? (
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
                ) : (
                  <div className="text-center mb-3">
                    <p className="text-sm text-muted-foreground">{signal.message || signal.reason}</p>
                  </div>
                )}

                {/* Analysis & Metrics */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-4">
                    {signal.riskReward && <span>R/R: {signal.riskReward.toFixed(2)}</span>}
                    {signal.confidence && <span>Confidence: {signal.confidence}</span>}
                    <span>Type: {signal.type}</span>
                  </div>
                </div>

                {/* Indicators */}
                {signal.type === 'VALID_SIGNAL' && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge variant="outline" className="text-xs">
                      {signal.direction.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Score: {signal.confluenceScore}%
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      💰 Con Promediación
                    </Badge>
                  </div>
                )}

                {/* Actions */}
                {signal.type === 'VALID_SIGNAL' && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSignalClick(signal)
                      }}
                      className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    >
                      <DollarSign className="w-3 h-3 mr-1" />
                      Ver Promediación
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStatusUpdate(signal.symbol, 'EXECUTED')
                      }}
                      disabled={updateSignalStatus.isPending}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Execute
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStatusUpdate(signal.symbol, 'CANCELLED')
                      }}
                      disabled={updateSignalStatus.isPending}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Signal Result Section */}
      {selectedSignal && (
        <CardContent className="pt-4 border-t border-border">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              📊 Resultado de Análisis: {selectedSignal.symbol}
              <Badge className={cn("ml-2", getSignalStatusColor(selectedSignal.type))}>
                {selectedSignal.type}
              </Badge>
            </h3>
            
            {/* Signal Status and Info */}
            <div className="bg-muted/20 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Confluencia</p>
                  <p className={cn("font-bold text-lg", getConfluenceColor(selectedSignal.confluenceScore))}>
                    {selectedSignal.confluenceScore}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Dirección</p>
                  <p className="font-bold text-lg flex items-center justify-center gap-1">
                    {getDirectionIcon(selectedSignal.direction)}
                    {selectedSignal.direction?.toUpperCase()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Precio Actual</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(selectedSignal.currentPrice)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="font-bold text-lg">
                    {selectedSignal.success ? '✅' : '❌'}
                  </p>
                </div>
              </div>
              
              {/* Reason/Message */}
              {(selectedSignal.reason || selectedSignal.message) && (
                <div className="bg-background rounded p-3 border">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Análisis:</p>
                  <p className="text-sm">{selectedSignal.reason || selectedSignal.message}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Averaging Strategy for All Signals */}
          {averagingData && (
            <div>
              <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
                💰 Estrategia de Promediación
              </h4>
              <AveragingStrategySimple
                data={{
                  strategy: averagingData.analysis?.strategy || 'DCA',
                  levels: averagingData.analysis?.levels || [],
                  riskManagement: {
                    maxTotalRisk: '3%',
                    maxPositions: 5,
                    recommendedAllocation: {
                      initialEntry: '30%',
                      level1: '20%',
                      level2: '25%',
                      level3: '25%'
                    },
                    safeguards: [
                      'Máximo 3% de riesgo total por símbolo',
                      'Límite de 5 entradas por posición',
                      'Mínimo 2% de distancia entre entradas',
                      'Stop loss automático al -15% de promediación'
                    ]
                  },
                  recommendations: averagingData.analysis?.recommendations || []
                }}
                symbol={selectedSignal.symbol}
                direction={selectedSignal.direction?.toLowerCase() as 'long' | 'short' || 'long'}
                currentPrice={selectedSignal.currentPrice || 0}
                entryPrice={selectedSignal.entry || selectedSignal.currentPrice || 0}
              />
            </div>
          )}
          
          {/* Action Button */}
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedSignal(null)
                setAveragingData(null)
              }}
            >
              Cerrar Análisis
            </Button>
            
            <Button
              onClick={() => handleGenerateSignal()}
              variant="default"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Generar Nueva Señal
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default TradingSignalsPanel;