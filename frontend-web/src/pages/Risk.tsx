import React from 'react'
import { RiskManagementWidget } from '@/components/RiskManagementWidget'

export const Risk: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Risk Management</h2>
        <p className="text-muted-foreground">Calculate position size, validate stop losses, and manage risk.</p>
      </div>
      <RiskManagementWidget />
    </div>
  )
}
