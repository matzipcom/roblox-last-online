import { timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createApiHandler } from './api.js'
import { createRobloxClient } from './roblox.js'
import { createStore } from './store.js'
import { createTracker } from './tracker.js'

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// 환경변수로 구성한 저장소/클라이언트/수집기/API 핸들러를 한 번에 만든다.
export function createApp(env = process.env) {
  const store = createStore({
    file: env.TRACK_DB_FILE || fileURLToPath(new URL('../data/presence.db', import.meta.url)),
    retentionDays: positiveInt(env.TRACK_RETENTION_DAYS, 30),
    maxTargets: positiveInt(env.TRACK_MAX_TARGETS, 200),
  })
  const client = createRobloxClient({ cookie: env.ROBLOX_COOKIE, store })
  const tracker = createTracker({ client, store, intervalMs: positiveInt(env.TRACK_INTERVAL_SECONDS, 300) * 1000 })

  const adminToken = env.ADMIN_TOKEN || ''
  const isAdmin = (header = '') => {
    const supplied = Buffer.from(header.replace(/^Bearer\s+/i, ''))
    const expected = Buffer.from(adminToken)
    return adminToken !== '' && supplied.length === expected.length && timingSafeEqual(supplied, expected)
  }

  const handleApi = createApiHandler({ client, store, isAdmin })
  return { handleApi, tracker, store }
}
