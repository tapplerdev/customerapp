/**
 * 🔌 WebSocketService
 *
 * Real-time notification delivery via Socket.IO WebSocket connection.
 * Replaces polling with instant server-to-client event streaming.
 *
 * Backend Architecture:
 * - Endpoint: /socket on main API server
 * - Auth: Bearer token in auth payload or Authorization header
 * - Room system: Users auto-join <userType>:<userId> room (e.g., "pro:123")
 * - Events: Backend emits notifications to user rooms
 *
 * Connection Flow:
 * 1. SocketClsMiddleware wraps connection in CLS context
 * 2. AuthSocketMiddleware validates token
 * 3. On success: socket.data.identifier set, user joined to room
 * 4. On failure: connection rejected with "Unauthorized"
 */

import { io, Socket } from 'socket.io-client'
import { EventEmitter } from 'events'
import { API_URL } from '../config'

interface WebSocketConfig {
  token: string
  userId?: number
  userType?: 'pro' | 'customer' | 'employee'
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  lastConnected?: number
  lastDisconnected?: number
  reconnectAttempts: number
  error?: string
}

class WebSocketServiceClass extends EventEmitter {
  private socket: Socket | null = null
  private config: WebSocketConfig | null = null
  private state: ConnectionState = {
    status: 'disconnected',
    reconnectAttempts: 0
  }

  // Configuration
  private readonly maxReconnectAttempts = 10
  private readonly reconnectionDelay = 1000
  private readonly reconnectionDelayMax = 5000

  // Heartbeat health check
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly heartbeatIntervalMs = 30000  // Ping every 30s
  private readonly heartbeatTimeoutMs = 5000    // Wait 5s for pong

  // Background retry after reconnect_failed
  private backgroundRetryInterval: ReturnType<typeof setInterval> | null = null
  private readonly backgroundRetryMs = 60000  // Retry every 60s after giving up

  constructor() {
    super()
    console.log('🔌 [WebSocketService] Initialized')
  }

  /**
   * Connect to WebSocket server with authentication
   */
  connect(config: WebSocketConfig): void {
    if (this.socket?.connected) {
      console.log('🔌 [WebSocketService] Already connected, skipping')
      return
    }

    if (this.state.status === 'connecting') {
      console.log('🔌 [WebSocketService] Connection in progress, skipping')
      return
    }

    this.config = config
    this.state.status = 'connecting'

    // Socket.IO endpoint is at root level, not under /api
    // Remove /api from URL if present
    if (!API_URL) {
      console.error('❌ [WebSocketService] API_URL is undefined - cannot connect')
      this.state.status = 'error'
      this.state.error = 'API_URL not configured'
      this.emit('error', new Error('API_URL not configured'))
      return
    }

    const baseUrl = API_URL.replace(/\/api$/, '')
    const protocol = baseUrl.startsWith('https') ? 'wss' : 'ws'

    console.log('🔌 [WebSocketService] Connecting to WebSocket...', {
      apiUrl: API_URL,
      baseUrl,
      protocol,
      socketPath: '/socket',
      fullUrl: `${baseUrl}/socket`,
      fullWebSocketUrl: `${protocol}://${baseUrl.replace(/^https?:\/\//, '')}/socket`,
      note: 'Backend uses custom path /socket (not default /socket.io/)',
      userType: config.userType,
      userId: config.userId,
      hasToken: !!config.token,
      tokenPrefix: config.token?.substring(0, 10) + '...'
    })

    try {
      // Connect to Socket.IO gateway
      // Backend expects: io('https://api.tappler.com/socket', { transports: ['websocket'], auth: { token: 'Bearer ...' } })
      // Try with polling fallback first for debugging
      this.socket = io(baseUrl, {
        path: '/socket', // ← Backend uses custom path /socket (not default /socket.io/)
        transports: ['websocket'], // ← Backend only supports WebSocket (no polling)
        auth: {
          token: config.token.startsWith('Bearer ') ? config.token : `Bearer ${config.token}`
        },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectionDelay,
        reconnectionDelayMax: this.reconnectionDelayMax,
        timeout: 20000, // 20 second connection timeout (increased for debugging)
        autoConnect: true,
        forceNew: true, // Force new connection
        upgrade: true, // Allow transport upgrade
        rememberUpgrade: false // Don't remember transport for debugging
      })

      console.log('🔌 [WebSocketService] Socket.IO client created', {
        baseUrl,
        path: '/socket',
        transports: ['websocket'],
        timeout: 20000,
        note: 'WebSocket-only (backend does not support polling)'
      })

      this.setupEventHandlers()

    } catch (error) {
      console.error('❌ [WebSocketService] Connection failed:', error)
      this.state.status = 'error'
      this.state.error = error instanceof Error ? error.message : 'Unknown error'
      this.emit('error', error)
    }
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return

    // Connection successful
    this.socket.on('connect', () => {
      console.log('✅ [WebSocketService] Connected successfully', {
        socketId: this.socket?.id,
        transport: this.socket?.io.engine.transport.name
      })

      this.state.status = 'connected'
      this.state.lastConnected = Date.now()
      this.state.reconnectAttempts = 0
      this.state.error = undefined

      this.stopBackgroundRetry()
      this.startHeartbeat()

      this.emit('connected', {
        socketId: this.socket?.id,
        timestamp: Date.now()
      })
    })

    // Connection error (before connect)
    this.socket.on('connect_error', (error) => {
      console.error('❌ [WebSocketService] Connection error:', {
        message: error.message,
        name: error.name,
        description: (error as any).description,
        context: (error as any).context,
        type: (error as any).type,
        attempt: this.state.reconnectAttempts + 1,
        maxAttempts: this.maxReconnectAttempts,
        transport: this.socket?.io?.engine?.transport?.name
      })

      // Log full error for debugging
      console.error('❌ [WebSocketService] Full error object:', error)

      // Log error stack trace
      if (error.stack) {
        console.error('❌ [WebSocketService] Error stack:', error.stack)
      }

      // Log all error properties (including non-enumerable)
      const errorProps = Object.getOwnPropertyNames(error).reduce((acc, key) => {
        acc[key] = (error as any)[key]
        return acc
      }, {} as any)
      console.error('❌ [WebSocketService] All error properties:', JSON.stringify(errorProps, null, 2))

      // Log Socket.IO engine state
      if (this.socket?.io?.engine) {
        console.error('❌ [WebSocketService] Engine state:', {
          readyState: this.socket.io.engine.readyState,
          transport: this.socket.io.engine.transport?.name,
          upgrading: (this.socket.io.engine as any).upgrading,
          secure: (this.socket.io.engine as any).secure,
          hostname: (this.socket.io.engine as any).hostname,
          port: (this.socket.io.engine as any).port,
          path: (this.socket.io.engine as any).path,
        })
      }

      // Log connection configuration
      console.error('❌ [WebSocketService] Connection config:', {
        url: (this.socket?.io as any)?.uri,
        opts: {
          path: (this.socket?.io?.opts as any)?.path,
          transports: (this.socket?.io?.opts as any)?.transports,
          secure: (this.socket?.io?.opts as any)?.secure,
          reconnection: (this.socket?.io?.opts as any)?.reconnection,
        }
      })

      this.state.status = 'error'
      this.state.error = error.message
      this.state.reconnectAttempts++

      // Check for auth errors
      if (error.message.includes('Unauthorized') || error.message.includes('401') || error.message.includes('403')) {
        console.error('🚫 [WebSocketService] Authentication failed - invalid token')
        this.emit('auth_error', error)

        // Stop reconnection attempts on auth failure
        this.stopBackgroundRetry()
        this.disconnect()
        return
      }

      // Check for connection refused / endpoint not found
      if (error.message.includes('ECONNREFUSED') || error.message.includes('404')) {
        console.error('🚫 [WebSocketService] Endpoint not found or connection refused')
        console.error('   Check if Socket.IO server is running at the endpoint')
        console.error('   Current endpoint:', (this.socket?.io as any)?.uri)
      }

      this.emit('connect_error', error)
    })

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [WebSocketService] Disconnected:', reason)

      this.stopHeartbeat()
      this.state.status = 'disconnected'
      this.state.lastDisconnected = Date.now()

      this.emit('disconnected', {
        reason,
        timestamp: Date.now()
      })

      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        // Server forced disconnect (auth revoked, user banned, etc.)
        console.log('🚫 [WebSocketService] Server forced disconnect - not reconnecting')
        this.emit('server_disconnect', { reason })
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        // Network issues - Socket.IO will auto-reconnect
        console.log('🔄 [WebSocketService] Network disconnect - will auto-reconnect')
      }
    })

    // Reconnection attempt
    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 [WebSocketService] Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`)
      this.state.reconnectAttempts = attempt
      this.emit('reconnecting', { attempt })
    })

    // Reconnection successful
    this.socket.io.on('reconnect', (attemptNumber) => {
      console.log(`✅ [WebSocketService] Reconnected after ${attemptNumber} attempts`)
      this.emit('reconnected', { attemptNumber })
    })

    // Reconnection failed
    this.socket.io.on('reconnect_failed', () => {
      console.error('❌ [WebSocketService] Reconnection failed after max attempts')
      console.error('❌ [WebSocketService] Final connection state:', {
        attempts: this.state.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        lastError: this.state.error,
        url: (this.socket?.io as any)?.uri,
        path: (this.socket?.io?.opts as any)?.path,
        transports: (this.socket?.io?.opts as any)?.transports,
        connected: this.socket?.connected,
        disconnected: this.socket?.disconnected,
      })
      console.error('❌ [WebSocketService] WebSocket endpoint may not exist or is unreachable')
      console.error('❌ [WebSocketService] Check backend WebSocket server status')

      this.state.status = 'error'
      this.state.error = 'Max reconnection attempts reached'
      this.emit('reconnect_failed')

      this.startBackgroundRetry()
    })

    // Listen for notification events from backend
    // Backend emits to room "<userType>:<userId>" (e.g., "pro:123")
    this.socket.on('notification', (payload) => {
      console.log('📬 [WebSocketService] ========== RAW NOTIFICATION RECEIVED ==========')
      console.log('📬 [WebSocketService] Full payload:', JSON.stringify(payload, null, 2))
      console.log('📬 [WebSocketService] Summary:', {
        type: payload.type || payload.event,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        timestamp: Date.now()
      })
      console.log('📬 [WebSocketService] ====================================================')

      console.log('[DBG] >>> emitting on NOTIFICATION channel — event:', payload?.event || payload?.type)
      this.emit('notification', payload)
    })

    // Listen for system notifications (alternative event name)
    this.socket.on('system.notification', (payload) => {
      console.log('📬 [WebSocketService] ========== SYSTEM NOTIFICATION RECEIVED ==========')
      console.log('📬 [WebSocketService] Full payload:', JSON.stringify(payload, null, 2))
      console.log('📬 [WebSocketService] Summary:', {
        type: payload.type || payload.event,
        title: payload.title,
        body: payload.body,
        data: payload.data
      })
      console.log('📬 [WebSocketService] ====================================================')

      this.emit('notification', payload)
    })

    // Generic event listener for any other events backend might send
    this.socket.onAny((eventName, ...args) => {
      console.log('📡 [WebSocketService] ========== ANY EVENT RECEIVED ==========')
      console.log('📡 [WebSocketService] Event name:', eventName)
      console.log('📡 [WebSocketService] Args count:', args.length)
      console.log('📡 [WebSocketService] All args:', JSON.stringify(args, null, 2))
      console.log('📡 [WebSocketService] ====================================================')

      // Backend emits custom events like 'custom.screenName.pro.service.screenName'
      // We need to treat ALL backend events as notifications
      if (eventName.startsWith('custom.') || eventName.startsWith('system.')) {
        const payload = args[0]

        console.log('📬 [WebSocketService] ========== CONVERTING TO NOTIFICATION ==========')
        console.log('📬 [WebSocketService] Event type:', eventName)
        console.log('📬 [WebSocketService] Payload:', JSON.stringify(payload, null, 2))
        console.log('📬 [WebSocketService] Title:', payload?.title)
        console.log('📬 [WebSocketService] Body:', payload?.body)
        console.log('📬 [WebSocketService] Data:', payload?.data)
        console.log('📬 [WebSocketService] ====================================================')

        // Add event type to payload if not present
        if (payload && !payload.event) {
          payload.event = eventName
        }

        // Emit as notification so HeaderDashboard picks it up
        console.log('[DBG] >>> onAny emitting on NOTIFICATION channel — event:', eventName)
      this.emit('notification', payload)
      } else {
        console.log('[DBG] >>> onAny emitting on EVENT channel — eventName:', eventName)
        this.emit('event', { eventName, args })
      }
    })

    // Error events
    this.socket.on('error', (error) => {
      console.error('❌ [WebSocketService] Socket error:', error)
      this.emit('error', error)
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (!this.socket) {
      console.log('🔌 [WebSocketService] Already disconnected')
      return
    }

    console.log('🔌 [WebSocketService] Disconnecting...')

    this.stopHeartbeat()
    this.stopBackgroundRetry()

    this.socket.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    this.config = null

    this.state.status = 'disconnected'
    this.state.lastDisconnected = Date.now()
  }

  /**
   * Reconnect with fresh token (for token refresh scenarios)
   */
  reconnect(newToken?: string): void {
    console.log('🔄 [WebSocketService] Reconnecting with fresh token...')

    const currentConfig = this.config

    if (!currentConfig) {
      console.error('❌ [WebSocketService] Cannot reconnect - no previous config')
      return
    }

    // Update token if provided
    if (newToken) {
      currentConfig.token = newToken
    }

    // Disconnect and reconnect
    this.disconnect()

    // Small delay before reconnecting
    setTimeout(() => {
      this.connect(currentConfig)
    }, 500)
  }

  /**
   * Start periodic heartbeat to detect stale connections.
   * Sends a ping every 30s. If no pong within 5s, forces disconnect
   * to trigger Socket.IO's built-in reconnection.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    // Track when we last received any data from the server.
    // Socket.IO engine emits 'pong' automatically in response to its
    // built-in ping frames — no server-side handler needed.
    let lastPong = Date.now()

    const onPong = () => {
      lastPong = Date.now()
    }

    this.socket?.io.engine?.on('pong', onPong)

    this.heartbeatInterval = setInterval(() => {
      if (!this.socket?.connected) {
        this.stopHeartbeat()
        return
      }

      const elapsed = Date.now() - lastPong
      if (elapsed > this.heartbeatIntervalMs + this.heartbeatTimeoutMs) {
        // No engine-level pong for 35s — connection is likely stale
        console.warn(`💔 [WebSocketService] Heartbeat stale — last pong ${Math.round(elapsed / 1000)}s ago, forcing reconnect`)
        this.socket?.disconnect()
      }
    }, this.heartbeatIntervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  /**
   * Start background retry after Socket.IO exhausts its reconnect attempts.
   * Attempts a full fresh connection every 60s until it succeeds.
   */
  private startBackgroundRetry(): void {
    if (this.backgroundRetryInterval) return

    console.log('🔄 [WebSocketService] Starting background retry every 60s')

    this.backgroundRetryInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.stopBackgroundRetry()
        return
      }

      console.log('🔄 [WebSocketService] Background retry — attempting fresh connection...')
      this.reconnect()
    }, this.backgroundRetryMs)
  }

  private stopBackgroundRetry(): void {
    if (this.backgroundRetryInterval) {
      clearInterval(this.backgroundRetryInterval)
      this.backgroundRetryInterval = null
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return { ...this.state }
  }

  /**
   * Get socket ID (useful for debugging)
   */
  getSocketId(): string | undefined {
    return this.socket?.id
  }

  /**
   * Send a custom event to server (if needed for future features)
   */
  emitToServer(event: string, data?: any): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ [WebSocketService] Cannot emit to server - not connected')
      return
    }

    console.log('📤 [WebSocketService] Emitting event to server:', event)
    this.socket.emit(event, data)
  }
}

// Export singleton instance
export const WebSocketService = new WebSocketServiceClass()

// Export types
export type { WebSocketConfig, ConnectionState }