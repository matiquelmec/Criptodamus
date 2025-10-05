import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Activity, Target, Shield, AlertTriangle } from 'lucide-react'
import { useTopCryptos, useFearGreedIndex } from '@/hooks/useMarketData'
import { formatCurrency, formatPercentage, getPriceChangeColor } from '@/lib/utils'

export const Dashboard: React.FC = () => {
  const { data: topCryptos, isLoading: cryptosLoading, error: cryptosError } = useTopCryptos(10)
  const { data: fearGreed, isLoading: fearGreedLoading } = useFearGreedIndex()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time market analysis and trading insights
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Activity className="mr-2 h-4 w-4" />
            Start Analysis
          </Button>
          <Button size="sm">
            <Target className="mr-2 h-4 w-4" />
            Generate Signals
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Signals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              +2 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-bullish" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,450.00</div>
            <p className="text-xs text-bullish">
              +2.1% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">Medium</div>
            <p className="text-xs text-muted-foreground">
              2.5% max risk per trade
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Sentiment</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fearGreedLoading ? '...' : fearGreed?.classification || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Fear & Greed: {fearGreedLoading ? '...' : fearGreed?.value || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Cryptocurrencies */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Top Cryptocurrencies</CardTitle>
            <CardDescription>
              Real-time prices and 24h changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cryptosLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-2 animate-pulse">
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-12"></div>
                  </div>
                ))}
              </div>
            ) : cryptosError ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Unable to load market data. Check backend connection.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {topCryptos?.slice(0, 10).map((crypto) => (
                  <div
                    key={crypto.symbol}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {crypto.symbol.replace('USDT', '').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{crypto.symbol}</p>
                        <p className="text-xs text-muted-foreground">#{crypto.rank}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(crypto.price)}</p>
                      <p className={`text-xs ${getPriceChangeColor(crypto.changePercent24h)}`}>
                        {formatPercentage(crypto.changePercent24h)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common trading operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Target className="mr-2 h-4 w-4" />
              Generate New Signal
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Activity className="mr-2 h-4 w-4" />
              Scan All Markets
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Shield className="mr-2 h-4 w-4" />
              Calculate Position Size
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              View Analysis
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Signals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trading Signals</CardTitle>
          <CardDescription>
            Latest AI-generated trading opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No signals generated yet. Start by scanning the markets or generating a signal for a specific symbol.
            </p>
            <Button className="mt-4">
              Generate First Signal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}