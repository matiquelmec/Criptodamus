import React from 'react'
import { TradingSignalsPanel } from '@/components/TradingSignalsPanel'

export const Signals: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Trading Signals</h2>
        <p className="text-muted-foreground">AI-generated trading opportunities with confluence scoring.</p>
      </div>
      <TradingSignalsPanel />
    </div>
  )
}
