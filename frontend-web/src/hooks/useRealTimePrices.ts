import { useEffect, useState } from 'react'
import { useWebSocket } from './useWebSocket'
import { config } from '@/lib/config'

interface PriceUpdate {
  symbol: string
  price: number
  changePercent24h: number
  volume24h: number
  timestamp: number
}

interface RealTimePricesState {
  prices: Record<string, PriceUpdate>
  lastUpdate: number | null
  isConnected: boolean
  connectionError: string | null
}

export const useRealTimePrices = (symbols?: string[]) => {
  const [state, setState] = useState<RealTimePricesState>({
    prices: {},
    lastUpdate: null,
    isConnected: false,
    connectionError: null,
  })

  const { isConnected, connectionError, subscribe, unsubscribe, emit } = useWebSocket(
    config.wsUrl,
    {
      onConnect: () => {
        console.log('WebSocket connected for real-time prices')
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected')
      },
      onError: (error) => {
        console.error('WebSocket error:', error)
      },
    }
  )

  useEffect(() => {
    setState(prev => ({
      ...prev,
      isConnected,
      connectionError,
    }))
  }, [isConnected, connectionError])

  useEffect(() => {
    const handlePriceUpdate = (data: PriceUpdate) => {
      setState(prev => ({
        ...prev,
        prices: {
          ...prev.prices,
          [data.symbol]: data,
        },
        lastUpdate: Date.now(),
      }))
    }

    const handleBulkPriceUpdate = (data: PriceUpdate[]) => {
      setState(prev => {
        const newPrices = { ...prev.prices }
        data.forEach(priceData => {
          newPrices[priceData.symbol] = priceData
        })
        return {
          ...prev,
          prices: newPrices,
          lastUpdate: Date.now(),
        }
      })
    }

    const handleConnected = (data: any) => {
      console.log('Socket.IO connected confirmation:', data)
    }

    const handleSubscribed = (data: any) => {
      console.log('Socket.IO subscribed confirmation:', data)
    }

    // Subscribe to events
    subscribe('priceUpdate', handlePriceUpdate)
    subscribe('bulkPriceUpdate', handleBulkPriceUpdate)
    subscribe('connected', handleConnected)
    subscribe('subscribed', handleSubscribed)

    // Request specific symbols if provided
    if (symbols && symbols.length > 0 && isConnected) {
      emit('subscribe-prices', symbols)
    }

    return () => {
      unsubscribe('priceUpdate', handlePriceUpdate)
      unsubscribe('bulkPriceUpdate', handleBulkPriceUpdate)
      unsubscribe('connected', handleConnected)
      unsubscribe('subscribed', handleSubscribed)
    }
  }, [subscribe, unsubscribe, emit, symbols, isConnected])

  const subscribeTo = (newSymbols: string[]) => {
    if (isConnected) {
      emit('subscribe-prices', newSymbols)
    }
  }

  const unsubscribeFrom = (symbolsToRemove: string[]) => {
    if (isConnected) {
      emit('unsubscribe-prices', symbolsToRemove)
    }
  }

  return {
    prices: state.prices,
    lastUpdate: state.lastUpdate,
    isConnected: state.isConnected,
    connectionError: state.connectionError,
    subscribeTo,
    unsubscribeFrom,
  }
}