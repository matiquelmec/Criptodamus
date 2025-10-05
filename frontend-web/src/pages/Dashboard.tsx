import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Activity, Target, Shield, AlertTriangle } from 'lucide-react'
import { useTopCryptos, useFearGreedIndex } from '@/hooks/useMarketData'
import { RealTimePricesPanel } from '@/components/RealTimePricesPanel'
import { TradingSignalsPanel } from '@/components/TradingSignalsPanel'
import { RiskManagementWidget } from '@/components/RiskManagementWidget'
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
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Real-Time Prices */}
        <div className="lg:col-span-1">
          <RealTimePricesPanel />
        </div>

        {/* Center Column - Trading Signals */}
        <div className="lg:col-span-1">
          <TradingSignalsPanel />
        </div>

        {/* Right Column - Risk Management */}
        <div className="lg:col-span-1">
          <RiskManagementWidget />
        </div>
      </div>

      {/* Quick Actions Footer */}
      <Card>
        <CardHeader>
          <CardTitle>System Status & Quick Actions</CardTitle>
          <CardDescription>
            Monitor system health and perform quick operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-16 flex-col">
              <Activity className="h-6 w-6 mb-2" />
              <span className="text-xs">Market Scan</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <Target className="h-6 w-6 mb-2" />
              <span className="text-xs">Generate Signal</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <Shield className="h-6 w-6 mb-2" />
              <span className="text-xs">Risk Analysis</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <TrendingUp className="h-6 w-6 mb-2" />
              <span className="text-xs">Portfolio</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}