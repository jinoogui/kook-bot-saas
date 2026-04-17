import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { URL } from 'url'
import type { ApiRouteDefinition, PluginContext } from '@kook-saas/shared'

function sendJson(reply: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  reply.statusCode = statusCode
  reply.setHeader('Content-Type', 'application/json; charset=utf-8')
  reply.end(JSON.stringify(payload))
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(raw)
      }
    })
    req.on('error', reject)
  })
}

function normalizeRoutePath(path: string): string {
  if (!path.startsWith('/')) return `/${path}`
  return path
}

function matchPath(pattern: string, actual: string): { matched: boolean; params: Record<string, string> } {
  const patternParts = pattern.split('/').filter(Boolean)
  const actualParts = actual.split('/').filter(Boolean)
  if (patternParts.length !== actualParts.length) {
    return { matched: false, params: {} }
  }

  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i += 1) {
    const p = patternParts[i]
    const a = actualParts[i]
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(a)
      continue
    }
    if (p !== a) {
      return { matched: false, params: {} }
    }
  }

  return { matched: true, params }
}

function resolveMethod(method: string): ApiRouteDefinition['method'] | null {
  const normalized = method.toUpperCase()
  if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(normalized)) {
    return normalized as ApiRouteDefinition['method']
  }
  return null
}

export interface PluginRuntimeServerOptions {
  tenantId: string
  internalToken: string
  getPluginEntry: (pluginId: string) => { plugin: { getApiRoutes: () => ApiRouteDefinition[] }; ctx: PluginContext } | undefined
}

export function createPluginRuntimeServer(options: PluginRuntimeServerOptions) {
  const { tenantId, internalToken, getPluginEntry } = options

  return createServer(async (req, reply) => {
    try {
      const method = resolveMethod(req.method || 'GET')
      if (!method) {
        return sendJson(reply, 405, { success: false, code: 'METHOD_NOT_ALLOWED', error: '不支持的请求方法' })
      }

      const token = req.headers['x-internal-token']
      if (!internalToken || token !== internalToken) {
        return sendJson(reply, 401, { success: false, code: 'UNAUTHORIZED_INTERNAL', error: '内部鉴权失败' })
      }

      const rawUrl = req.url || '/'
      const parsedUrl = new URL(rawUrl, 'http://127.0.0.1')
      const pathname = parsedUrl.pathname

      const prefix = '/internal/plugins/'
      if (!pathname.startsWith(prefix)) {
        return sendJson(reply, 404, { success: false, code: 'PLUGIN_ROUTE_NOT_FOUND', error: '插件路由不存在' })
      }

      const rest = pathname.slice(prefix.length)
      const segments = rest.split('/').filter(Boolean)
      const pluginId = segments[0]
      const relativePath = `/${segments.slice(1).join('/')}`

      if (!pluginId) {
        return sendJson(reply, 400, { success: false, code: 'INVALID_PLUGIN_ID', error: '缺少 pluginId' })
      }

      const entry = getPluginEntry(pluginId)
      if (!entry) {
        return sendJson(reply, 404, { success: false, code: 'PLUGIN_NOT_LOADED', error: '插件未加载或不存在' })
      }

      const routes = entry.plugin.getApiRoutes() || []
      let matchedRoute: ApiRouteDefinition | null = null
      let matchedParams: Record<string, string> = {}

      for (const route of routes) {
        if (route.method !== method) continue
        const normalizedRoutePath = normalizeRoutePath(route.path)
        const match = matchPath(normalizedRoutePath, relativePath)
        if (match.matched) {
          matchedRoute = route
          matchedParams = match.params
          break
        }
      }

      if (!matchedRoute) {
        return sendJson(reply, 404, { success: false, code: 'PLUGIN_ROUTE_NOT_FOUND', error: '插件路由不存在' })
      }

      const body = await readBody(req)
      const query: Record<string, string> = {}
      for (const [key, value] of parsedUrl.searchParams.entries()) {
        query[key] = value
      }

      const requestLike = {
        method,
        headers: req.headers,
        params: matchedParams,
        query,
        body,
        tenantId,
      }

      let settled = false
      const replyLike = {
        code(statusCode: number) {
          reply.statusCode = statusCode
          return replyLike
        },
        status(statusCode: number) {
          reply.statusCode = statusCode
          return replyLike
        },
        header(key: string, value: string) {
          reply.setHeader(key, value)
          return replyLike
        },
        send(payload: any) {
          if (settled) return
          settled = true
          if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
            if (!reply.getHeader('Content-Type')) {
              reply.setHeader('Content-Type', 'text/plain; charset=utf-8')
            }
            reply.end(payload)
            return
          }
          sendJson(reply, reply.statusCode || 200, payload)
        },
      }

      await matchedRoute.handler(requestLike as any, replyLike as any, entry.ctx)

      if (!settled) {
        sendJson(reply, reply.statusCode || 200, { success: true })
      }
    } catch (err: any) {
      sendJson(reply, 500, {
        success: false,
        code: 'PLUGIN_RUNTIME_INTERNAL_ERROR',
        error: err?.message || '插件运行时内部错误',
      })
    }
  })
}
