import { useEffect, useState } from 'react'
import { useWebSocket } from './useWebSocket'

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
    process.env.NODE_ENV === 'development'
      ? 'ws://localhost:3001'
      : 'wss://your-production-domain.com',
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

    // Subscribe to price updates
    subscribe('priceUpdate', handlePriceUpdate)
    subscribe('bulkPriceUpdate', handleBulkPriceUpdate)

    // Request specific symbols if provided
    if (symbols && symbols.length > 0 && isConnected) {
      emit('subscribeToPrices', { symbols })
    }

    return () => {
      unsubscribe('priceUpdate', handlePriceUpdate)
      unsubscribe('bulkPriceUpdate', handleBulkPriceUpdate)
    }
  }, [subscribe, unsubscribe, emit, symbols, isConnected])

  const subscribeTo = (newSymbols: string[]) => {
    if (isConnected) {
      emit('subscribeToPrices', { symbols: newSymbols })
    }
  }

  const unsubscribeFrom = (symbolsToRemove: string[]) => {
    if (isConnected) {
      emit('unsubscribeFromPrices', { symbols: symbolsToRemove })
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