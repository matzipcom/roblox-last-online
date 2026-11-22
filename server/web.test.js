import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from './roblox.js'
import { createStore } from './store.js'
import { createWebHandler } from './web.js'

const request = (path, init) => new Request(`https://example.com${path}`, init)

describe('createWebHandler', () => {
  const client = {
    presenceConfigured: true,
    lookup: async ({ id, name }) => {
      if (name === 'nobody') throw new ApiError(404, 'USER_NOT_FOUND', 'not found')
      return { user: { id: Number(id ?? 1) } }
    },
  }

  it('조회 결과와 오류를 JSON 으로 반환한다', async () => {
    const handle = createWebHandler({ client })

    const ok = await handle(request('/api/user?id=156'))
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { user: { id: 156 } })

    assert.equal((await handle(request('/api/user?name=nobody'))).status, 404)
    assert.equal((await handle(request('/api/user?name=a'))).status, 400)
    assert.equal((await handle(request('/api/user?id=1', { method: 'POST' }))).status, 405)
    assert.equal((await handle(request('/api/other'))).status, 404)
  })

  it('IP 별 요청 제한을 적용한다', async () => {
    const handle = createWebHandler({ client })
    const headers = { 'cf-connecting-ip': '9.9.9.9' }
    let last
    for (let i = 0; i < 31; i++) last = await handle(request('/api/user?id=1', { headers }))
    assert.equal(last.status, 429)
  })

  it('DELETE /api/track 은 토큰이 맞을 때만 기록을 삭제한다', async () => {
    const store = createStore()
    store.track(156, 'a')
    const handle = createWebHandler({ client, store, isAdmin: (h) => h === 'Bearer secret' })
    const del = (headers = {}) => handle(request('/api/track?id=156', { method: 'DELETE', headers }))

    assert.equal((await del()).status, 403)
    assert.ok(store.getTracking(156))
    const ok = await del({ authorization: 'Bearer secret' })
    assert.deepEqual(await ok.json(), { removed: true })
    assert.equal(store.getTracking(156), null)
  })
})
