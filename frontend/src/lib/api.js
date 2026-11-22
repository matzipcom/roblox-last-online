export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/
export const USER_ID_PATTERN = /^[1-9]\d{0,14}$/

export class LookupError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export function validateQuery(mode, value) {
  if (!value) {
    return mode === 'name' ? '사용자 이름을 입력해 주세요.' : '사용자 ID를 입력해 주세요.'
  }
  if (mode === 'name' && !USERNAME_PATTERN.test(value)) {
    return '사용자 이름은 영문, 숫자, 밑줄(_)로 이루어진 3~20자여야 합니다.'
  }
  if (mode === 'id' && !USER_ID_PATTERN.test(value)) {
    return '사용자 ID는 숫자만 입력할 수 있습니다.'
  }
  return null
}

export async function fetchUser({ mode, value }, signal) {
  const params = new URLSearchParams({ [mode]: value })
  let response
  try {
    response = await fetch(`/api/user?${params}`, { signal })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new LookupError('NETWORK', '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.')
  }

  const body = await response.json().catch(() => null)
  if (!body) {
    throw new LookupError(
      'API_UNREACHABLE',
      `API 서버(/api/user)에 연결되지 않았습니다 (HTTP ${response.status}). 서버를 \`npm run dev\` 또는 \`npm start\` 로 실행해 주세요.`,
    )
  }
  if (!response.ok) {
    throw new LookupError(body.error?.code ?? 'UNKNOWN', body.error?.message ?? '조회 중 오류가 발생했습니다.')
  }
  return body
}
