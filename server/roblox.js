import { TtlCache } from './cache.js'
import { isActive } from './presence.js'

const USERS_API = 'https://users.roblox.com'
const THUMBNAILS_API = 'https://thumbnails.roblox.com'
const PRESENCE_API = 'https://presence.roblox.com'
const REQUEST_TIMEOUT_MS = 8000

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const PRESENCE_STATUS = {
  0: 'offline',
  1: 'online',
  2: 'in-game',
  3: 'studio',
  4: 'invisible',
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/
export const USER_ID_PATTERN = /^[1-9]\d{0,14}$/

export function createRobloxClient({
  fetch: fetchImpl = globalThis.fetch,
  cookie = globalThis.process?.env?.ROBLOX_COOKIE,
  store = null,
} = {}) {
  const securityCookie = cookie?.trim() || null
  const userCache = new TtlCache({ ttlMs: 5 * 60_000 })
  const avatarCache = new TtlCache({ ttlMs: 10 * 60_000 })
  const presenceCache = new TtlCache({ ttlMs: 30_000 })
  let csrfToken = null

  async function request(url, { method = 'GET', body, headers = {} } = {}) {
    let response
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw new ApiError(502, 'UPSTREAM_ERROR', 'Roblox 서버에 연결하지 못했습니다.')
    }
    return response
  }

  function assertUsable(response) {
    if (response.status === 429) {
      throw new ApiError(429, 'RATE_LIMITED', 'Roblox 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (!response.ok) {
      throw new ApiError(502, 'UPSTREAM_ERROR', 'Roblox 서버가 올바르지 않은 응답을 반환했습니다.')
    }
  }

  async function resolveUsername(username) {
    const response = await request(`${USERS_API}/v1/usernames/users`, {
      method: 'POST',
      body: { usernames: [username], excludeBannedUsers: false },
    })
    assertUsable(response)
    const { data } = await response.json()
    return data?.[0] ?? null
  }

  async function getUserDetails(id) {
    const cached = userCache.get(id)
    if (cached) return cached

    const response = await request(`${USERS_API}/v1/users/${id}`)
    if (response.status === 404 || response.status === 400) return null
    assertUsable(response)
    const user = await response.json()
    userCache.set(id, user)
    return user
  }

  async function getAvatarUrl(id) {
    const cached = avatarCache.get(id)
    if (cached !== undefined) return cached

    let avatarUrl = null
    try {
      const response = await request(
        `${THUMBNAILS_API}/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png&isCircular=false`,
      )
      if (response.ok) {
        const { data } = await response.json()
        const entry = data?.[0]
        if (entry?.state === 'Completed') avatarUrl = entry.imageUrl
      }
    } catch {
      // 아바타는 부가 정보이므로 실패해도 조회 자체는 계속한다.
    }
    avatarCache.set(id, avatarUrl)
    return avatarUrl
  }

  async function fetchPresences(ids) {
    const send = () =>
      request(`${PRESENCE_API}/v1/presence/users`, {
        method: 'POST',
        body: { userIds: ids.map(Number) },
        headers: {
          cookie: `.ROBLOSECURITY=${securityCookie}`,
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
      })

    let response = await send()
    if (response.status === 403 && response.headers.get('x-csrf-token')) {
      csrfToken = response.headers.get('x-csrf-token')
      response = await send()
    }
    return response
  }

  function normalizePresence(entry) {
    const status = PRESENCE_STATUS[entry.userPresenceType] ?? 'offline'
    const lastOnlineMs = Date.parse(entry.lastOnline)
    return {
      available: true,
      status,
      rawType: entry.userPresenceType ?? null,
      lastOnline: Number.isNaN(lastOnlineMs) ? null : new Date(lastOnlineMs).toISOString(),
      lastLocation: status === 'in-game' || status === 'studio' ? (entry.lastLocation ?? null) : null,
      placeId: status === 'in-game' ? (entry.placeId ?? null) : null,
    }
  }

  // 여러 사용자의 접속 상태를 한 번의 요청으로 조회한다. (캐시를 거치지 않는다)
  async function getPresences(ids) {
    const result = new Map()
    if (!securityCookie) throw new ApiError(401, 'NO_AUTH', 'ROBLOX_COOKIE 가 설정되지 않았습니다.')
    if (ids.length === 0) return result

    const response = await fetchPresences(ids)
    if (response.status === 401 || response.status === 403) {
      console.warn('[roblox] ROBLOX_COOKIE 인증에 실패했습니다. 쿠키가 만료되었는지 확인하세요.')
      throw new ApiError(401, 'AUTH_FAILED', 'Roblox 인증에 실패했습니다.')
    }
    assertUsable(response)

    const { userPresences } = await response.json()
    for (const entry of userPresences ?? []) result.set(String(entry.userId), normalizePresence(entry))
    return result
  }

  async function getPresence(id) {
    if (!securityCookie) return { available: false, reason: 'NO_AUTH' }

    const cached = presenceCache.get(id)
    if (cached) return { ...cached }

    let presence
    try {
      presence = (await getPresences([id])).get(String(id))
    } catch (err) {
      if (err.code === 'AUTH_FAILED') return { available: false, reason: 'AUTH_FAILED' }
      throw err
    }
    if (!presence) return { available: false, reason: 'NO_DATA' }
    presenceCache.set(id, presence)
    return { ...presence }
  }

  // 조회된 사용자를 추적 목록에 넣고, 현재 관찰값을 기록한 뒤, 저장된 기록으로 마지막 접속 시간을 보완한다.
  async function trackAndMerge(userId, name, presence) {
    if (!store || !securityCookie) return null
    const tracked = await store.track(userId, name)
    if (!tracked) return { enabled: false, reason: 'LIMIT_REACHED' }

    await store.record(userId, presence)
    const info = await store.getTracking(userId)
    if (presence.available && !isActive(presence.status) && !presence.lastOnline && info.lastSeenOnline) {
      presence.lastOnline = info.lastSeenOnline
      presence.lastOnlineSource = 'tracked'
    }
    return { enabled: true, since: info.since, lastPolledAt: info.lastPolledAt }
  }

  async function lookup({ name, id }) {
    let userId = id
    let basic = null

    if (name) {
      basic = await resolveUsername(name)
      if (!basic) throw new ApiError(404, 'USER_NOT_FOUND', '해당 사용자를 찾을 수 없습니다.')
      userId = String(basic.id)
    }

    let details = null
    try {
      details = await getUserDetails(userId)
    } catch (err) {
      // 이름으로 조회한 경우 기본 정보만으로도 결과를 보여줄 수 있다.
      if (!basic) throw err
    }
    if (!details && !basic) throw new ApiError(404, 'USER_NOT_FOUND', '해당 사용자를 찾을 수 없습니다.')

    const [avatarUrl, presence] = await Promise.all([
      getAvatarUrl(userId),
      getPresence(userId).catch((err) => {
        if (err instanceof ApiError) return { available: false, reason: err.code }
        throw err
      }),
    ])

    const source = details ?? basic
    const tracking = await trackAndMerge(userId, source.name, presence)
    return {
      user: {
        id: source.id,
        name: source.name,
        displayName: source.displayName,
        hasVerifiedBadge: Boolean(source.hasVerifiedBadge),
        isBanned: details?.isBanned ?? null,
        created: details?.created ?? null,
        description: details?.description ?? '',
      },
      avatarUrl,
      presence,
      tracking,
      fetchedAt: new Date().toISOString(),
    }
  }

  return { lookup, getPresences, presenceConfigured: Boolean(securityCookie) }
}
