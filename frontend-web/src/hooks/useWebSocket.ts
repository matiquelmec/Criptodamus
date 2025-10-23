import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface WebSocketHookOptions {
  enabled?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

export const useWebSocket = (
  url: string,
  options: WebSocketHookOptions = {}
) => {
  const { enabled = true, onConnect, onDisconnect, onError } = options
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const onConnectRef = useRef<typeof onConnect | undefined>(undefined)
  const onDisconnectRef = useRef<typeof onDisconnect | undefined>(undefined)
  const onErrorRef = useRef<typeof onError | undefined>(undefined)

  // Mantener callbacks actualizados sin reiniciar la conexión
  useEffect(() => {
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
    onErrorRef.current = onError
  }, [onConnect, onDisconnect, onError])

  useEffect(() => {
    if (!enabled) return

    // Create socket connection
    const socket = io(url, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true,
      withCredentials: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket.IO connected:', socket.id)
      setIsConnected(true)
      setConnectionError(null)
      onConnectRef.current?.()
    })

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason)
      setIsConnected(false)
      onDisconnectRef.current?.()
    })

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error)
      setIsConnected(false)
      setConnectionError(error.message)
      onErrorRef.current?.(error)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket.IO reconnected after', attemptNumber, 'attempts')
    })

    socket.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection error:', error)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [url, enabled])

  const emit = (event: string, data?: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data)
    }
  }

  const subscribe = (event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback)
    }
  }

  const unsubscribe = (event: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback)
      } else {
        socketRef.current.off(event)
      }
    }
  }

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    emit,
    subscribe,
    unsubscribe,
  }
}