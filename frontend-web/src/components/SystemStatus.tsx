import React from 'react'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { useSystemHealth } from '@/hooks/useSystemHealth'
import { cn } from '@/lib/utils'

interface SystemStatusProps {
  className?: string
  showText?: boolean
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  className,
  showText = true
}) => {
  const { data: isHealthy, isLoading, error } = useSystemHealth()

  const getStatus = () => {
    if (isLoading) {
      return {
        icon: AlertTriangle,
        text: 'Checking...',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500'
      }
    }

    if (error || !isHealthy) {
      return {
        icon: XCircle,
        text: 'Disconnected',
        color: 'text-red-500',
        bgColor: 'bg-red-500'
      }
    }

    return {
      icon: CheckCircle,
      text: 'Connected',
      color: 'text-green-500',
      bgColor: 'bg-green-500'
    }
  }

  const status = getStatus()
  // const StatusIcon = status.icon

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="relative">
        <div className={cn(
          "h-2 w-2 rounded-full",
          status.bgColor,
          isHealthy && !isLoading && "animate-pulse"
        )} />
      </div>
      {showText && (
        <span className={cn("text-sm", status.color)}>
          {status.text}
        </span>
      )}
    </div>
  )
}