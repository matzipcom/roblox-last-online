import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createApiHandler } from './api.js'
import { createRobloxClient } from './roblox.js'
import { createStore } from './store.js'
import { createTracker } from './tracker.js'

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })

const presence = (status, extra = {}) => ({ available: true, status, lastOnline: null, lastLocation: null, ...extra })

function clock(start = '2026-11-20T00:00:00.000Z') {
  let t = Date.parse(start)
  const now = () => t
  now.advance = (ms) => (t += ms)
  return now
}

describe('store', () => {
  it('활성 상태가 관찰될 때마다 마지막 접속 관찰 시각을 갱신하고, 오프라인이 되면 유지한다', () => {
    const now = clock()
    const store = createStore({ now })
    store.track(1, 'a')

    store.record(1, presence('online'))
    now.advance(300_000)
    store.record(1, presence('in-game', { lastLocation: 'Game' }))
    const lastActive = new Date(now()).toISOString()
    now.advance(300_000)
    store.record(1, presence('offline'))
    now.advance(300_000)
    store.record(1, presence('offline'))

    assert.equal(store.getTracking(1).lastSeenOnline, lastActive)
  })

  it('추적하지 않는 사용자의 기록은 무시하고, 추적 수 상한을 지킨다', () => {
    const store = createStore({ maxTargets: 2 })
    store.record(9, presence('online'))
    assert.equal(store.getTracking(9), null)

    assert.equal(store.track(1, 'a'), true)
    assert.equal(store.track(2, 'b'), true)
    assert.equal(store.track(3, 'c'), false)
    assert.equal(store.track(1, 'a2'), true)
  })

  it('보관 기간이 지난 상세 기록만 삭제하고 마지막 접속 시각은 유지한다', () => {
    const now = clock()
    const store = createStore({ now, retentionDays: 30 })
    store.track(1, 'a')
    store.record(1, presence('online'))
    const seen = store.getTracking(1).lastSeenOnline
    now.advance(31 * 86_400_000)

    assert.equal(store.prune(), 1)
    assert.equal(store.getTracking(1).lastSeenOnline, seen)
  })

  it('remove 는 추적과 기록을 모두 삭제한다', () => {
    const store = createStore()
    store.track(1, 'a')
    store.record(1, presence('online'))

    assert.equal(store.remove(1), true)
    assert.equal(store.getTracking(1), null)
    assert.equal(store.remove(1), false)
  })
})

describe('tracker', () => {
  it('추적 대상을 묶어서 조회하고 결과를 기록한다', async () => {
    const store = createStore()
    store.track(1, 'a')
    store.track(2, 'b')
    const calls = []
    const client = {
      presenceConfigured: true,
      getPresences: async (ids) => {
        calls.push(ids)
        return new Map(ids.map((id) => [id, presence(id === '1' ? 'online' : 'offline')]))
      },
    }
    const tracker = createTracker({ client, store, log: { info() {}, warn() {} } })

    const { polled } = await tracker.pollOnce()

    assert.equal(polled, 2)
    assert.equal(calls.length, 1)
    assert.ok(store.getTracking(1).lastSeenOnline)
    assert.equal(store.getTracking(2).lastSeenOnline, null)
  })

  it('실패하면 한 주기 동안 재시도하지 않는다', async () => {
    const store = createStore()
    store.track(1, 'a')
    let calls = 0
    const client = {
      presenceConfigured: true,
      getPresences: async () => {
        calls += 1
        throw new Error('auth')
      },
    }
    const tracker = createTracker({ client, store, intervalMs: 300_000, log: { info() {}, warn() {} } })

    await tracker.pollOnce(1_000)
    await tracker.pollOnce(2_000)
    assert.equal(calls, 1)
    await tracker.pollOnce(1_000 + 300_000)
    assert.equal(calls, 2)
  })
})

describe('lookup + store 연동', () => {
  const routes = (presenceBody) => async (url) => {
    const u = String(url)
    if (u.includes('/v1/users/156')) return json({ id: 156, name: 'builderman', displayName: 'b', isBanned: false, created: '2006-03-08T00:00:00Z' })
    if (u.includes('avatar-headshot')) return json({ data: [] })
    if (u.includes('/v1/presence/users')) return json({ userPresences: [presenceBody] })
    throw new Error(`unexpected ${u}`)
  }

  it('API 가 lastOnline 을 주지 않으면 저장된 관찰 기록으로 보완한다', async () => {
    const store = createStore()
    store.track(156, 'builderman')
    store.record(156, presence('online'))
    store.record(156, presence('online'))
    const stored = store.getTracking(156).lastSeenOnline

    const client = createRobloxClient({ fetch: routes({ userId: 156, userPresenceType: 0 }), cookie: 'c', store })
    const result = await client.lookup({ id: '156' })

    assert.equal(result.presence.lastOnline, stored)
    assert.equal(result.presence.lastOnlineSource, 'tracked')
    assert.equal(result.tracking.enabled, true)
  })

  it('조회된 사용자는 추적 목록에 추가되지만 쿠키가 없으면 추가되지 않는다', async () => {
    const store = createStore()
    const withCookie = createRobloxClient({ fetch: routes({ userId: 156, userPresenceType: 0 }), cookie: 'c', store })
    await withCookie.lookup({ id: '156' })
    assert.deepEqual(store.listTargetIds(), ['156'])

    const store2 = createStore()
    const noCookie = createRobloxClient({ fetch: routes({}), cookie: '', store: store2 })
    const result = await noCookie.lookup({ id: '156' })
    assert.deepEqual(store2.listTargetIds(), [])
    assert.equal(result.tracking, null)
  })
})

describe('DELETE /api/track', () => {
  const call = async (handler, { method = 'DELETE', url = '/api/track?id=156', authorization } = {}) => {
    const res = { status: 0, body: '', writeHead(s) { this.status = s }, setHeader() {}, end(b) { this.body = b } }
    await handler({ method, url, headers: { authorization }, socket: { remoteAddress: '1.1.1.1' } }, res)
    return res
  }

  it('토큰이 맞을 때만 기록을 삭제한다', async () => {
    const store = createStore()
    store.track(156, 'a')
    const handler = createApiHandler({ client: { presenceConfigured: true }, store, isAdmin: (h) => h === 'Bearer secret' })

    assert.equal((await call(handler)).status, 403)
    assert.equal((await call(handler, { authorization: 'Bearer wrong' })).status, 403)
    assert.ok(store.getTracking(156))

    const ok = await call(handler, { authorization: 'Bearer secret' })
    assert.equal(ok.status, 200)
    assert.equal(store.getTracking(156), null)
  })
})
