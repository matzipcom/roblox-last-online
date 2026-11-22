import { formatDateTime, formatRelative } from '../lib/time.js'

const STATUS = {
  online: { label: '온라인', tone: 'online', detail: 'Roblox에 접속해 있습니다.' },
  'in-game': { label: '게임 중', tone: 'ingame', detail: '지금 게임을 플레이하고 있습니다.' },
  studio: { label: 'Studio 작업 중', tone: 'studio', detail: 'Roblox Studio에서 작업하고 있습니다.' },
  offline: { label: '오프라인', tone: 'offline', detail: null },
  invisible: { label: '상태 숨김', tone: 'offline', detail: '접속 상태를 숨기고 있습니다.' },
}

const UNAVAILABLE = {
  NO_AUTH: {
    title: '접속 정보를 조회할 수 없습니다',
    body: '이 서버에는 접속 정보 조회용 Roblox 계정이 설정되어 있지 않습니다. 관리자는 README의 설정 방법을 참고해 주세요.',
  },
  AUTH_FAILED: {
    title: '서버의 Roblox 인증이 만료되었습니다',
    body: '관리자가 ROBLOX_COOKIE 를 갱신해야 접속 정보를 조회할 수 있습니다.',
  },
  RATE_LIMITED: {
    title: 'Roblox 요청 한도를 초과했습니다',
    body: '잠시 후 다시 조회해 주세요.',
  },
}

const UNAVAILABLE_FALLBACK = {
  title: '접속 정보를 일시적으로 가져올 수 없습니다',
  body: '잠시 후 다시 시도해 주세요.',
}

export default function PresencePanel({ presence, tracking, now }) {
  if (!presence.available) {
    const { title, body } = UNAVAILABLE[presence.reason] ?? UNAVAILABLE_FALLBACK
    return (
      <div className="presence presence--unavailable">
        <p className="presence__headline">{title}</p>
        <p className="presence__note">{body}</p>
      </div>
    )
  }

  const status = STATUS[presence.status] ?? STATUS.offline
  const isActive = ['online', 'in-game', 'studio'].includes(presence.status)

  return (
    <div className={`presence presence--${status.tone}`}>
      <div className="presence__top">
        <span className={`status status--${status.tone}`}>
          <span className="status__dot" aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <p className="presence__label">{isActive ? '현재 상태' : '마지막 접속'}</p>

      {isActive ? (
        <>
          <p className="presence__headline">지금 접속 중</p>
          <p className="presence__note">
            {status.detail}
            {presence.lastLocation ? ` (${presence.lastLocation})` : ''}
          </p>
        </>
      ) : presence.lastOnline ? (
        <>
          <p className="presence__headline">{formatRelative(presence.lastOnline, now)}</p>
          <p className="presence__note">
            <time dateTime={presence.lastOnline}>{formatDateTime(presence.lastOnline)}</time>
          </p>
          {presence.lastOnlineSource === 'tracked' && (
            <p className="presence__note">접속 기록 수집으로 확인한 시각입니다. (수집 주기만큼 오차가 있을 수 있습니다)</p>
          )}
          {status.detail && <p className="presence__note">{status.detail}</p>}
        </>
      ) : (
        <>
          <p className="presence__headline">확인할 수 없음</p>
          <p className="presence__note">
            {tracking?.enabled
              ? `접속 기록 수집을 시작했습니다(${formatDateTime(tracking.since)}). 접속이 관찰되면 마지막 접속 시간이 기록됩니다.`
              : '사용자의 개인정보 설정에 따라 마지막 접속 시간이 공개되지 않을 수 있습니다.'}
          </p>
        </>
      )}
    </div>
  )
}
