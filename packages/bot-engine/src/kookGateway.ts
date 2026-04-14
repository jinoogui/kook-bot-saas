import WebSocket from 'ws'
import axios from 'axios'
import pino from 'pino'

const KOOK_BASE = 'https://www.kookapp.cn/api/v3'

/** Kook WebSocket signal types */
const Signal = {
  EVENT: 0,
  HELLO: 1,
  PING: 2,
  PONG: 3,
  RESUME: 4,
  RECONNECT: 5,
  RESUME_ACK: 6,
} as const

export interface KookGatewayOptions {
  botToken: string
  onEvent: (event: any) => void
  onConnected?: () => void
  onDisconnected?: () => void
  logger?: pino.Logger
}

export class KookGateway {
  private readonly token: string
  private readonly onEvent: (event: any) => void
  private readonly onConnected?: () => void
  private readonly onDisconnected?: () => void
  private readonly logger: pino.Logger

  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private lastSn = 0
  private gatewayUrl: string | null = null

  private heartbeatTimer: NodeJS.Timeout | null = null
  private pongTimeout: NodeJS.Timeout | null = null
  private reconnectDelay = 2000
  private connected = false
  private destroyed = false

  constructor(opts: KookGatewayOptions) {
    this.token = opts.botToken
    this.onEvent = opts.onEvent
    this.onConnected = opts.onConnected
    this.onDisconnected = opts.onDisconnected
    this.logger = opts.logger ?? pino({ name: 'kook-gateway' })
  }

  /** Fetch gateway URL and establish WebSocket connection */
  async connect(): Promise<void> {
    this.destroyed = false
    const url = await this.fetchGatewayUrl()
    this.gatewayUrl = url
    this.openWebSocket(url)
  }

  /** Gracefully disconnect */
  disconnect(): void {
    this.destroyed = true
    this.clearTimers()
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.close(1000)
      this.ws = null
    }
    this.connected = false
    this.sessionId = null
    this.lastSn = 0
    this.gatewayUrl = null
  }

  get isConnected(): boolean {
    return this.connected
  }

  // ── Private ──────────────────────────────────────────

  private async fetchGatewayUrl(): Promise<string> {
    const resp = await axios.get(`${KOOK_BASE}/gateway/index`, {
      params: { compress: 0 },
      headers: { Authorization: `Bot ${this.token}` },
      timeout: 10000,
    })
    const url = resp.data?.data?.url
    if (!url) throw new Error('Failed to get Kook gateway URL')
    return url
  }

  private openWebSocket(url: string): void {
    if (this.destroyed) return
    this.clearTimers()

    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.logger.info('WebSocket connection opened, waiting for HELLO...')
    })

    this.ws.on('message', (raw: WebSocket.Data) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleMessage(msg)
      } catch (err) {
        this.logger.error(`Failed to parse gateway message: ${err}`)
      }
    })

    this.ws.on('close', (code, reason) => {
      this.logger.warn(`WebSocket closed: code=${code} reason=${reason}`)
      this.connected = false
      this.onDisconnected?.()
      this.clearTimers()
      if (!this.destroyed) {
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', (err) => {
      this.logger.error(`WebSocket error: ${err.message}`)
    })
  }

  private handleMessage(msg: { s: number; d?: any; sn?: number }): void {
    switch (msg.s) {
      case Signal.EVENT:
        if (msg.sn != null) this.lastSn = msg.sn
        if (msg.d) this.onEvent(msg.d)
        break

      case Signal.HELLO: {
        const code = msg.d?.code
        if (code === 0) {
          this.sessionId = msg.d?.session_id ?? null
          this.connected = true
          this.reconnectDelay = 2000
          this.startHeartbeat()
          this.logger.info(`Gateway connected, session=${this.sessionId}`)
          this.onConnected?.()
        } else {
          this.logger.error(`HELLO failed with code ${code}, reconnecting...`)
          this.ws?.close()
        }
        break
      }

      case Signal.PONG:
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout)
          this.pongTimeout = null
        }
        break

      case Signal.RECONNECT:
        this.logger.warn('Received RECONNECT signal, reconnecting...')
        this.sessionId = null
        this.lastSn = 0
        this.ws?.close()
        break

      case Signal.RESUME_ACK:
        this.logger.info('Session resumed successfully')
        this.connected = true
        this.startHeartbeat()
        break

      default:
        this.logger.debug(`Unknown signal: ${msg.s}`)
    }
  }

  private startHeartbeat(): void {
    this.clearTimers()
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      this.ws.send(JSON.stringify({ s: Signal.PING, sn: this.lastSn }))
      // Expect PONG within 6 seconds
      this.pongTimeout = setTimeout(() => {
        this.logger.warn('Heartbeat timeout, closing connection...')
        this.ws?.close()
      }, 6000)
    }, 30000)
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    const delay = this.reconnectDelay
    this.logger.info(`Reconnecting in ${delay}ms...`)
    setTimeout(async () => {
      if (this.destroyed) return
      try {
        if (this.sessionId && this.gatewayUrl) {
          // Try session resume
          const resumeUrl = `${this.gatewayUrl}&resume=1&sn=${this.lastSn}&session_id=${this.sessionId}`
          this.openWebSocket(resumeUrl)
        } else {
          // Full reconnect
          const url = await this.fetchGatewayUrl()
          this.gatewayUrl = url
          this.openWebSocket(url)
        }
      } catch (err) {
        this.logger.error(`Reconnect failed: ${err}`)
        this.scheduleReconnect()
      }
    }, delay)
    // Exponential backoff: 2s, 4s, 8s, ... max 60s
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000)
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }
  }
}