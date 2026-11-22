export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/
export const USER_ID_PATTERN = /^[1-9]\d{0,14}$/

export class LookupError extends Error {
  constructor(code, message, params = {}) {
    super(message)
    this.code = code
    this.params = params
  }
}

// 오류가 있으면 번역 키를, 없으면 null 을 반환한다.
export function validateQuery(mode, value) {
  if (!value) return mode === 'name' ? 'validate.nameEmpty' : 'validate.idEmpty'
  if (mode === 'name' && !USERNAME_PATTERN.test(value)) return 'validate.nameFormat'
  if (mode === 'id' && !USER_ID_PATTERN.test(value)) return 'validate.idFormat'
  return null
}

export async function fetchUser({ mode, value }, signal) {
  const params = new URLSearchParams({ [mode]: value })
  let response
  try {
    response = await fetch(`/api/user?${params}`, { signal })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new LookupError('NETWORK', '')
  }

  const body = await response.json().catch(() => null)
  if (!body) throw new LookupError('API_BAD_RESPONSE', '', { status: response.status })
  if (!response.ok) throw new LookupError(body.error?.code ?? 'UNKNOWN', body.error?.message ?? '')
  return body
}
