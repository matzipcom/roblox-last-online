import { createD1Store } from './d1-store.js'
import { createRobloxClient } from './roblox.js'
import { createTracker } from './tracker.js'
import { createWebHandler } from './web.js'

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// 길이와 무관하게 전체를 비교하는 상수 시간 문자열 비교
function safeEqual(a, b) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

// Cloudflare 바인딩(env)으로 저장소/클라이언트/수집기/핸들러를 구성한다.
// env.DB: D1 바인딩, env.ROBLOX_COOKIE / env.ADMIN_TOKEN: 시크릿
export function createCloudflareApp(env) {
  const store = createD1Store({
    db: env.DB,
    retentionDays: positiveInt(env.TRACK_RETENTION_DAYS, 30),
    maxTargets: positiveInt(env.TRACK_MAX_TARGETS, 200),
  })
  const client = createRobloxClient({ cookie: env.ROBLOX_COOKIE ?? '', store })
  const adminToken = env.ADMIN_TOKEN ?? ''
  const isAdmin = (header) => adminToken !== '' && safeEqual(header.replace(/^Bearer\s+/i, ''), adminToken)

  return {
    handle: createWebHandler({ client, store, isAdmin }),
    tracker: createTracker({ client, store, intervalMs: positiveInt(env.TRACK_INTERVAL_SECONDS, 300) * 1000 }),
  }
}
