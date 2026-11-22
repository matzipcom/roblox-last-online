import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseLookupQuery } from './api.js'
import { ApiError, createRobloxClient } from './roblox.js'

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...init.headers },
    ...init,
  })

function mockFetch(routes) {
  const calls = []
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    for (const [pattern, handler] of routes) {
      if (String(url).includes(pattern)) return handler(url, init, calls)
    }
    throw new Error(`unexpected request: ${url}`)
  }
  impl.calls = calls
  return impl
}

const baseRoutes = () => [
  ['/v1/usernames/users', (_u, init) => {
    const { usernames } = JSON.parse(init.body)
    return json({ data: usernames[0] === 'builderman' ? [{ id: 156, name: 'builderman', displayName: 'builderman', hasVerifiedBadge: true }] : [] })
  }],
  ['/v1/users/156', () => json({ id: 156, name: 'builderman', displayName: 'builderman', hasVerifiedBadge: true, isBanned: false, created: '2006-03-08T00:00:00Z', description: 'hi' })],
  ['avatar-headshot', () => json({ data: [{ state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/x.png' }] })],
]

describe('createRobloxClient.lookup', () => {
  it('쿠키가 없으면 프로필은 반환하되 접속 정보는 NO_AUTH 로 표시하고 presence API 는 호출하지 않는다', async () => {
    const fetch = mockFetch(baseRoutes())
    const client = createRobloxClient({ fetch, cookie: '' })

    const result = await client.lookup({ name: 'builderman' })

    assert.equal(result.user.id, 156)
    assert.equal(result.user.created, '2006-03-08T00:00:00Z')
    assert.equal(result.avatarUrl, 'https://tr.rbxcdn.com/x.png')
    assert.deepEqual(result.presence, { available: false, reason: 'NO_AUTH' })
    assert.ok(!fetch.calls.some((c) => c.url.includes('presence.roblox.com')))
  })

  it('CSRF 토큰으로 재시도하고 lastOnline 을 ISO 형식으로 반환한다', async () => {
    let presenceCalls = 0
    const fetch = mockFetch([
      ...baseRoutes(),
      ['/v1/presence/users', (_u, init) => {
        presenceCalls += 1
        assert.equal(init.headers.cookie, '.ROBLOSECURITY=secret')
        if (!init.headers['x-csrf-token']) {
          return new Response('{}', { status: 403, headers: { 'x-csrf-token': 'tok' } })
        }
        assert.equal(init.headers['x-csrf-token'], 'tok')
        return json({ userPresences: [{ userId: 156, userPresenceType: 0, lastLocation: 'Offline', lastOnline: '2026-11-20T10:00:00.000Z' }] })
      }],
    ])
    const client = createRobloxClient({ fetch, cookie: 'secret' })

    const { presence } = await client.lookup({ id: '156' })

    assert.equal(presenceCalls, 2)
    assert.deepEqual(presence, {
      available: true,
      status: 'offline',
      lastOnline: '2026-11-20T10:00:00.000Z',
      lastLocation: null,
      placeId: null,
    })
  })

  it('게임 중이면 위치와 placeId 를 포함한다', async () => {
    const fetch = mockFetch([
      ...baseRoutes(),
      ['/v1/presence/users', () => json({ userPresences: [{ userId: 156, userPresenceType: 2, lastLocation: 'Brookhaven', placeId: 4924922222, lastOnline: '2026-11-22T01:00:00Z' }] })],
    ])
    const client = createRobloxClient({ fetch, cookie: 'secret' })

    const { presence } = await client.lookup({ id: '156' })

    assert.equal(presence.status, 'in-game')
    assert.equal(presence.lastLocation, 'Brookhaven')
    assert.equal(presence.placeId, 4924922222)
  })

  it('쿠키가 만료되어 401 이면 AUTH_FAILED 로 표시한다', async () => {
    const fetch = mockFetch([
      ...baseRoutes(),
      ['/v1/presence/users', () => json({ errors: [] }, { status: 401 })],
    ])
    const client = createRobloxClient({ fetch, cookie: 'expired' })

    const { presence } = await client.lookup({ id: '156' })

    assert.deepEqual(presence, { available: false, reason: 'AUTH_FAILED' })
  })

  it('존재하지 않는 사용자 이름/ID 는 404 USER_NOT_FOUND 이다', async () => {
    const fetch = mockFetch([
      ...baseRoutes(),
      ['/v1/users/999', () => json({ errors: [{ code: 3 }] }, { status: 404 })],
    ])
    const client = createRobloxClient({ fetch, cookie: '' })

    await assert.rejects(client.lookup({ name: 'nobody_here' }), { status: 404, code: 'USER_NOT_FOUND' })
    await assert.rejects(client.lookup({ id: '999' }), { status: 404, code: 'USER_NOT_FOUND' })
  })

  it('이름 조회 시 상세 API 가 레이트 리밋이어도 기본 정보로 응답한다', async () => {
    const routes = baseRoutes().filter(([p]) => p !== '/v1/users/156')
    routes.push(['/v1/users/156', () => json({}, { status: 429 })])
    const client = createRobloxClient({ fetch: mockFetch(routes), cookie: '' })

    const result = await client.lookup({ name: 'builderman' })

    assert.equal(result.user.name, 'builderman')
    assert.equal(result.user.created, null)
  })

  it('ID 조회 시 상세 API 가 레이트 리밋이면 429 를 전달한다', async () => {
    const client = createRobloxClient({
      fetch: mockFetch([['/v1/users/156', () => json({}, { status: 429 })]]),
      cookie: '',
    })

    await assert.rejects(client.lookup({ id: '156' }), (err) => err instanceof ApiError && err.status === 429)
  })
})

describe('parseLookupQuery', () => {
  const parse = (qs) => parseLookupQuery(new URLSearchParams(qs))

  it('유효한 이름과 ID 를 받아들인다', () => {
    assert.deepEqual(parse('name=Builder_man1'), { name: 'Builder_man1' })
    assert.deepEqual(parse('id=156'), { id: '156' })
  })

  it('잘못된 입력은 400 으로 거부한다', () => {
    for (const qs of ['', 'name=ab', 'name=has space', 'name=../etc', 'id=abc', 'id=0', 'id=12345678901234567', 'id=1/../2', 'name=abc&id=1']) {
      assert.throws(() => parse(qs), { status: 400 }, qs)
    }
  })
})
