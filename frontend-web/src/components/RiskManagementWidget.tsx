import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Shield,
  Calculator,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Percent,
  Settings,
  RefreshCw,
  Info
} from 'lucide-react'
import { useRiskCalculator } from '@/hooks/useRiskManagement'
import { formatCurrency, formatPercentage, cn } from '@/lib/utils'

interface RiskCalculatorForm {
  symbol: string
  accountBalance: number
  riskPercentage: number
  entryPrice: number
  stopLoss: number
  direction: 'LONG' | 'SHORT'
  leverage: number
  targetRR: number
}

export const RiskManagementWidget: React.FC = () => {
  const [form, setForm] = useState<RiskCalculatorForm>({
    symbol: 'BTCUSDT',
    accountBalance: 10000,
    riskPercentage: 2,
    entryPrice: 0,
    stopLoss: 0,
    direction: 'LONG',
    leverage: 1,
    targetRR: 2
  })

  const [results, setResults] = useState<any>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  const { calculateAll, isLoading, error } = useRiskCalculator()

  const handleCalculate = async () => {
    if (!form.entryPrice || !form.stopLoss) {
      return
    }

    setIsCalculating(true)
    try {
      const result = await calculateAll(form)
      setResults(result)
    } catch (error) {
      console.error('Risk calculation error:', error)
    } finally {
      setIsCalculating(false)
    }
  }

  // Auto-calculate when form changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.entryPrice && form.stopLoss) {
        handleCalculate()
      }
    }, 500) // Debounce 500ms

    return () => clearTimeout(timer)
  }, [form])

  const updateForm = (updates: Partial<RiskCalculatorForm>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }

  const getRiskLevelColor = (percentage: number) => {
    if (percentage <= 1) return 'text-green-600 bg-green-50'
    if (percentage <= 2) return 'text-yellow-600 bg-yellow-50'
    if (percentage <= 3) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  const getRiskLevelText = (percentage: number) => {
    if (percentage <= 1) return 'Conservative'
    if (percentage <= 2) return 'Moderate'
    if (percentage <= 3) return 'Aggressive'
    return 'High Risk'
  }

  const calculateStopLossDistance = () => {
    if (!form.entryPrice || !form.stopLoss) return 0
    const distance = Math.abs(form.entryPrice - form.stopLoss)
    return (distance / form.entryPrice) * 100
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              🛡️ Risk Calculator
              <Badge
                className={cn("ml-2", getRiskLevelColor(form.riskPercentage))}
              >
                {getRiskLevelText(form.riskPercentage)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Calculate position size, validate stop losses, and manage risk
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCalculate}
            disabled={isCalculating || !form.entryPrice || !form.stopLoss}
          >
            <Calculator className={cn("w-4 h-4 mr-2", isCalculating && "animate-pulse")} />
            Calculate
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Basic Parameters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Symbol</label>
            <Input
              value={form.symbol}
              onChange={(e) => updateForm({ symbol: e.target.value.toUpperCase() })}
              placeholder="BTCUSDT"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Direction</label>
            <div className="flex gap-2">
              <Button
                variant={form.direction === 'LONG' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateForm({ direction: 'LONG' })}
                className="flex-1"
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                Long
              </Button>
              <Button
                variant={form.direction === 'SHORT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateForm({ direction: 'SHORT' })}
                className="flex-1"
              >
                <TrendingDown className="w-3 h-3 mr-1" />
                Short
              </Button>
            </div>
          </div>
        </div>

        {/* Account & Risk Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Account Balance</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="number"
                value={form.accountBalance}
                onChange={(e) => updateForm({ accountBalance: parseFloat(e.target.value) || 0 })}
                className="pl-10"
                placeholder="10000"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Risk Per Trade: {form.riskPercentage}%
            </label>
            <Slider
              value={[form.riskPercentage]}
              onValueChange={([value]) => updateForm({ riskPercentage: value })}
              min={0.5}
              max={5}
              step={0.1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.5%</span>
              <span>5%</span>
            </div>
          </div>
        </div>

        {/* Price Levels */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Entry Price</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="number"
                value={form.entryPrice || ''}
                onChange={(e) => updateForm({ entryPrice: parseFloat(e.target.value) || 0 })}
                className="pl-10"
                placeholder="45000"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Stop Loss</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="number"
                value={form.stopLoss || ''}
                onChange={(e) => updateForm({ stopLoss: parseFloat(e.target.value) || 0 })}
                className="pl-10"
                placeholder="43000"
                step="0.01"
              />
            </div>
            {form.entryPrice && form.stopLoss && (
              <p className="text-xs text-muted-foreground mt-1">
                Distance: {calculateStopLossDistance().toFixed(2)}%
              </p>
            )}
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Leverage: {form.leverage}x
            </label>
            <Slider
              value={[form.leverage]}
              onValueChange={([value]) => updateForm({ leverage: value })}
              min={1}
              max={20}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1x</span>
              <span>20x</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Target R:R: {form.targetRR}:1
            </label>
            <Slider
              value={[form.targetRR]}
              onValueChange={([value]) => updateForm({ targetRR: value })}
              min={1}
              max={5}
              step={0.1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1:1</span>
              <span>5:1</span>
            </div>
          </div>
        </div>

        {/* Results Display */}
        {results && (
          <div className="border border-border rounded-lg p-4 bg-muted/20">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Calculation Results
            </h4>

            {/* Position Info */}
            {results.position && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground">Position Size</p>
                  <p className="font-bold text-lg text-blue-600">
                    {formatCurrency(results.position.positionSize)}
                  </p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground">Risk Amount</p>
                  <p className="font-bold text-lg text-red-600">
                    {formatCurrency(results.position.riskAmount)}
                  </p>
                </div>
              </div>
            )}

            {/* Take Profit */}
            {results.takeProfit && (
              <div className="text-center p-3 bg-background rounded-lg mb-4">
                <p className="text-xs text-muted-foreground">Take Profit</p>
                <p className="font-bold text-lg text-green-600">
                  {formatCurrency(results.takeProfit.takeProfit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  R:R {results.takeProfit.riskReward.toFixed(2)}:1
                </p>
              </div>
            )}

            {/* Validation Status */}
            <div className="flex items-center gap-2 mb-3">
              {results.isValid ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Valid Configuration</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Issues Detected</span>
                </div>
              )}
            </div>

            {/* Warnings */}
            {results.warnings && results.warnings.length > 0 && (
              <div className="space-y-1">
                {results.warnings.map((warning: string, index: number) => (
                  <div key={index} className="flex items-start gap-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Calculation Error</span>
            </div>
            <p className="text-xs text-destructive mt-1">
              {error.message || 'Failed to calculate risk parameters'}
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateForm({ riskPercentage: 1 })}
            className="flex-1"
          >
            Conservative (1%)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateForm({ riskPercentage: 2 })}
            className="flex-1"
          >
            Moderate (2%)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateForm({ riskPercentage: 3 })}
            className="flex-1"
          >
            Aggressive (3%)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}