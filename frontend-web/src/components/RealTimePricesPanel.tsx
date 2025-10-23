import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity,
  Search,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react'
import { useRealTimePrices } from '@/hooks/useRealTimePrices'
import { useTopCryptos } from '@/hooks/useMarketData'
import { formatCurrency, formatPercentage, getPriceChangeColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

const TOP_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'AVAXUSDT', 'TRXUSDT', 'LINKUSDT', 'DOTUSDT',
  'MATICUSDT', 'LTCUSDT', 'ATOMUSDT', 'UNIUSDT', 'XLMUSDT',
  'AAVEUSDT', 'ALGOUSDT', 'VETUSDT', 'FILUSDT', 'EOSUSDT',
  'CHZUSDT', 'MANAUSDT', 'SANDUSDT', 'AXSUSDT', 'THETAUSDT',
  'FTMUSDT', 'ICPUSDT', 'HBARUSDT', 'NEOUSDT', 'ZILUSDT',
  'RNDRUSDT', 'STXUSDT', 'FLOWUSDT', 'QNTUSDT', 'XTZUSDT',
  'APTUSDT', 'NEARUSDT', 'OPUSDT', 'ARBUSDT', 'SUIUSDT',
  'DYDXUSDT', 'INJUSDT', 'TIAUSDT', 'WLDUSDT', 'MKRUSDT',
  'LDOUSDT', 'STRKUSDT', 'TONUSDT', 'NOTUSDT', 'DOGEUSDT'
]

export const RealTimePricesPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSymbols] = useState<string[]>(TOP_SYMBOLS)

  const { data: topCryptos, isLoading: topCryptosLoading } = useTopCryptos(50)
  const {
    prices,
    lastUpdate,
    isConnected,
    connectionError,
    subscribeTo
  } = useRealTimePrices(selectedSymbols)

  // Combine API data with WebSocket data
  const combinedData = useMemo(() => {
    if (!topCryptos || !Array.isArray(topCryptos)) return []

    return topCryptos.map(crypto => {
      // Convert symbol format: "BTC/USDT" -> "BTCUSDT" for WebSocket lookup
      const wsSymbol = crypto.symbol?.replace('/', '') || ''
      const realtimePrice = prices[wsSymbol]
      return {
        ...crypto,
        // Use real-time price if available, otherwise fallback to API data
        price: realtimePrice?.price ?? crypto.price,
        changePercent24h: realtimePrice?.changePercent24h ?? crypto.change24h,
        volume24h: realtimePrice?.volume24h ?? crypto.volume24h,
        isRealTime: !!realtimePrice,
        lastUpdate: realtimePrice?.timestamp,
      }
    })
  }, [topCryptos, prices])

  // Filter based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return combinedData
    return combinedData.filter(crypto =>
      crypto.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crypto.symbol.replace('/USDT', '').replace('USDT', '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (crypto as any).name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [combinedData, searchTerm])

  const connectionStatus = isConnected ? 'Connected' : 'Disconnected'

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              📊 Real-Time Prices
              <Badge
                variant={isConnected ? "default" : "destructive"}
                className="ml-2"
              >
                {isConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                {connectionStatus}
              </Badge>
            </CardTitle>
            <CardDescription>
              Top 50 cryptocurrencies with live WebSocket updates
              {lastUpdate && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Last update: {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => subscribeTo(selectedSymbols)}
            disabled={!isConnected}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search cryptocurrencies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Connection Error */}
        {connectionError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive">
              Connection Error: {connectionError}
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {topCryptosLoading ? (
          // Loading State
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div className="space-y-1">
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-3 bg-muted rounded w-12"></div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-3 bg-muted rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Prices List
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredData.map((crypto) => (
              <div
                key={crypto.symbol}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg transition-all duration-200",
                  "hover:bg-muted/50 border border-transparent",
                  crypto.isRealTime && "border-primary/20 bg-primary/5"
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {crypto.symbol.replace('/USDT', '').replace('USDT', '').slice(0, 3)}
                      </span>
                    </div>
                    {crypto.isRealTime && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background">
                        <div className="w-full h-full bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{crypto.symbol.replace('/USDT', '').replace('USDT', '')}</p>
                      {crypto.changePercent24h > 0 ? (
                        <TrendingUp className="w-3 h-3 text-green-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">#{crypto.rank || 'N/A'}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{formatCurrency(crypto.price)}</p>
                    {crypto.isRealTime && (
                      <Activity className="w-3 h-3 text-green-500 animate-pulse" />
                    )}
                  </div>
                  <p className={cn(
                    "text-sm font-medium",
                    getPriceChangeColor(crypto.changePercent24h)
                  )}>
                    {formatPercentage(crypto.changePercent24h)}
                  </p>
                  {crypto.volume24h && (
                    <p className="text-xs text-muted-foreground">
                      Vol: {formatCurrency(crypto.volume24h, { compact: true })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredData.length === 0 && !topCryptosLoading && searchTerm && (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No cryptocurrencies found matching "{searchTerm}"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}