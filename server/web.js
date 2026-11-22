import { ApiError, USER_ID_PATTERN } from './roblox.js'
import { parseLookupQuery } from './api.js'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

function createRateLimiter() {
  const hits = new Map()
  return (key) => {
    const now = Date.now()
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    }
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
      return false
    }
    entry.count += 1
    return entry.count > RATE_LIMIT_MAX
  }
}

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })

const error = (status, code, message) => json(status, { error: { code, message } })

// Web 표준 Request/Response 기반 API 핸들러 (Cloudflare Pages Functions / Workers 용).
// 같은 출처에서 서빙되므로 CORS 헤더는 붙이지 않는다.
export function createWebHandler({ client, store = null, isAdmin = () => false, isLimited = createRateLimiter() }) {
  return async function handle(request) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return json(200, { ok: true, presenceConfigured: client.presenceConfigured })
    }

    if (url.pathname === '/api/track' && request.method === 'DELETE') {
      if (!store || !isAdmin(request.headers.get('authorization') ?? '')) {
        return error(403, 'FORBIDDEN', '권한이 없습니다.')
      }
      const id = url.searchParams.get('id')?.trim()
      if (!id || !USER_ID_PATTERN.test(id)) {
        return error(400, 'INVALID_USER_ID', '사용자 ID는 숫자만 입력할 수 있습니다.')
      }
      return json(200, { removed: await store.remove(id) })
    }

    if (url.pathname !== '/api/user') return error(404, 'NOT_FOUND', '존재하지 않는 API 입니다.')
    if (request.method !== 'GET') return error(405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.')

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    if (isLimited(ip)) return error(429, 'RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.')

    try {
      return json(200, await client.lookup(parseLookupQuery(url.searchParams)))
    } catch (err) {
      if (err instanceof ApiError) return error(err.status, err.code, err.message)
      console.error('[api] 예상치 못한 오류:', err)
      return error(500, 'INTERNAL_ERROR', '서버 내부 오류가 발생했습니다.')
    }
  }
}
