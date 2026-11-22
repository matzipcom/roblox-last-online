import { ApiError, USERNAME_PATTERN, USER_ID_PATTERN, createRobloxClient } from './roblox.js'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

function createRateLimiter({ windowMs = RATE_LIMIT_WINDOW_MS, max = RATE_LIMIT_MAX } = {}) {
  const hits = new Map()

  return function isLimited(key) {
    const now = Date.now()
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    }
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return false
    }
    entry.count += 1
    return entry.count > max
  }
}

function clientKey(req) {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress ?? 'unknown'
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(payload))
}

function sendError(res, status, code, message) {
  sendJson(res, status, { error: { code, message } })
}

export function parseLookupQuery(searchParams) {
  const name = searchParams.get('name')?.trim()
  const id = searchParams.get('id')?.trim()

  if (name && id) {
    throw new ApiError(400, 'INVALID_QUERY', 'name 과 id 중 하나만 지정해 주세요.')
  }
  if (name) {
    if (!USERNAME_PATTERN.test(name)) {
      throw new ApiError(400, 'INVALID_USERNAME', '사용자 이름은 영문, 숫자, 밑줄(_)로 이루어진 3~20자여야 합니다.')
    }
    return { name }
  }
  if (id) {
    if (!USER_ID_PATTERN.test(id)) {
      throw new ApiError(400, 'INVALID_USER_ID', '사용자 ID는 숫자만 입력할 수 있습니다.')
    }
    return { id }
  }
  throw new ApiError(400, 'INVALID_QUERY', '사용자 이름 또는 ID를 입력해 주세요.')
}

const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$|^https:\/\/[a-z0-9-]+\.app\.github\.dev$/

function isAllowedOrigin(origin) {
  if (!origin) return false
  const extra = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return DEV_ORIGIN.test(origin) || extra.includes(origin)
}

function applyCors(req, res) {
  const origin = req.headers.origin
  if (!isAllowedOrigin(origin)) return
  res.setHeader('access-control-allow-origin', origin)
  res.setHeader('access-control-allow-credentials', 'true')
  res.setHeader('vary', 'Origin')
}

export function createApiHandler({
  client = createRobloxClient(),
  isLimited = createRateLimiter(),
  store = null,
  isAdmin = () => false,
} = {}) {
  return async function handleApi(req, res) {
    const url = new URL(req.url, 'http://localhost')
    applyCors(req, res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-max-age': '600' })
      return res.end()
    }

    if (url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, presenceConfigured: client.presenceConfigured })
    }

    // 추적 중단 + 저장된 기록 삭제. ADMIN_TOKEN 이 설정되어 있고 일치할 때만 허용한다.
    if (url.pathname === '/api/track' && req.method === 'DELETE') {
      if (!store || !isAdmin(req.headers.authorization)) {
        return sendError(res, 403, 'FORBIDDEN', '권한이 없습니다.')
      }
      const id = url.searchParams.get('id')?.trim()
      if (!id || !USER_ID_PATTERN.test(id)) {
        return sendError(res, 400, 'INVALID_USER_ID', '사용자 ID는 숫자만 입력할 수 있습니다.')
      }
      return sendJson(res, 200, { removed: await store.remove(id) })
    }

    if (url.pathname !== '/api/user') {
      return sendError(res, 404, 'NOT_FOUND', '존재하지 않는 API 입니다.')
    }
    if (req.method !== 'GET') {
      return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.')
    }
    if (isLimited(clientKey(req))) {
      return sendError(res, 429, 'RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.')
    }

    try {
      const query = parseLookupQuery(url.searchParams)
      sendJson(res, 200, await client.lookup(query))
    } catch (err) {
      if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message)
      console.error('[api] 예상치 못한 오류:', err)
      sendError(res, 500, 'INTERNAL_ERROR', '서버 내부 오류가 발생했습니다.')
    }
  }
}
