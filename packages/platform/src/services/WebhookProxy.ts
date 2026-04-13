import http from 'http'
import httpProxy from 'http-proxy'
import type { InstanceManager } from './InstanceService.js'
import type { TenantService } from './TenantService.js'

/**
 * Webhook 反向代理
 * 将 Kook webhook 请求根据 verify_token 路由到对应的 Bot 实例端口
 */
export class WebhookProxy {
  private proxy: httpProxy
  private server: http.Server | null = null
  // verifyToken → port 的映射
  private tokenToPort = new Map<string, number>()

  constructor(
    private instanceManager: InstanceManager,
    private tenantService: TenantService,
  ) {
    this.proxy = httpProxy.createProxyServer({
      ws: false,
      xfwd: true,
    })

    this.proxy.on('error', (err, _req, res) => {
      console.error('[WebhookProxy] 代理错误:', err)
      if (res instanceof http.ServerResponse) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Bad Gateway' }))
      }
    })
  }

  /** 注册 verify_token → port 映射 */
  registerRoute(verifyToken: string, port: number): void {
    this.tokenToPort.set(verifyToken, port)
  }

  /** 移除映射 */
  unregisterRoute(verifyToken: string): void {
    this.tokenToPort.delete(verifyToken)
  }

  /** 从实例列表刷新路由 */
  async refreshRoutes(): Promise<void> {
    this.tokenToPort.clear()
    const all = await this.tenantService.getAllTenants()
    for (const t of all) {
      if (t.verifyToken && t.assignedPort && t.status === 'running') {
        this.tokenToPort.set(t.verifyToken, t.assignedPort)
      }
    }
  }

  /** 创建 Fastify 路由处理器 */
  createHandler() {
    return async (request: any, reply: any) => {
      try {
        const body = request.body
        if (!body) {
          return reply.code(400).send({ error: 'Empty body' })
        }

        // Kook webhook 校验：使用 verify_token 识别目标实例
        const verifyToken = body.d?.verify_token || body.verify_token
        if (!verifyToken) {
          // 如果无法从 body 中提取 verify_token，尝试从 header 路由
          return reply.code(400).send({ error: 'Missing verify_token' })
        }

        const port = this.tokenToPort.get(verifyToken)
        if (!port) {
          return reply.code(404).send({ error: 'No instance for this token' })
        }

        // 代理到对应实例
        const target = `http://127.0.0.1:${port}`
        const raw = request.raw
        const rawReply = reply.raw

        // 由于 Fastify 已经消费了 body，需要重新写入
        const bodyStr = JSON.stringify(body)
        raw.headers['content-length'] = Buffer.byteLength(bodyStr).toString()
        raw.headers['content-type'] = 'application/json'

        // Fastify 已经 parse 了 body，需要重新序列化发送
        raw._body = bodyStr

        this.proxy.web(raw, rawReply, {
          target,
          buffer: createReadableFromString(bodyStr),
        })

        // 标记 reply 已被 proxy 处理
        reply.hijack()
      } catch (err) {
        console.error('[WebhookProxy] 处理失败:', err)
        return reply.code(500).send({ error: 'Internal proxy error' })
      }
    }
  }
}

/** 从字符串创建 Readable stream（用于 httpProxy buffer 选项） */
function createReadableFromString(str: string) {
  const { Readable } = require('stream')
  const readable = new Readable()
  readable.push(str)
  readable.push(null)
  return readable
}
