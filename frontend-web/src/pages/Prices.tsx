import React from 'react'
import { RealTimePricesPanel } from '@/components/RealTimePricesPanel'

export const Prices: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Real-Time Prices</h2>
        <p className="text-muted-foreground">Top cryptocurrencies with live WebSocket updates.</p>
      </div>
      <RealTimePricesPanel />
    </div>
  )
}
