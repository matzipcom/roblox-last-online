import { useState } from 'react'
import PresencePanel from './PresencePanel.jsx'
import { formatDate, formatRelative } from '../lib/time.js'

const VerifiedIcon = () => (
  <svg className="verified" viewBox="0 0 24 24" role="img" aria-label="인증 배지">
    <path
      fill="currentColor"
      d="M12 2l2.4 1.8 3-.1 1 2.8 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-1 2.8-3-.1L12 22l-2.4-1.8-3 .1-1-2.8L3.1 15.8 4 12.9 3.1 10l2.5-1.7 1-2.8 3 .1L12 2zm-1.2 13.2l5.1-5.1-1.2-1.2-3.9 3.9-1.7-1.7-1.2 1.2 2.9 2.9z"
    />
  </svg>
)

export default function UserCard({ data, now, refreshing, onRefresh }) {
  const { user, avatarUrl, presence, tracking } = data
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // 클립보드 접근이 불가능한 환경(비보안 컨텍스트 등)에서는 조용히 무시한다.
    }
  }

  return (
    <article className="card" aria-busy={refreshing}>
      <header className="card__header">
        {avatarUrl ? (
          <img className="avatar" src={avatarUrl} alt="" width="96" height="96" referrerPolicy="no-referrer" />
        ) : (
          <div className="avatar avatar--empty" aria-hidden="true" />
        )}
        <div className="identity">
          <h2 className="identity__display">
            {user.displayName}
            {user.hasVerifiedBadge && <VerifiedIcon />}
          </h2>
          <p className="identity__name">@{user.name}</p>
          <p className="identity__meta">
            <span>ID {user.id}</span>
            {user.created && (
              <span>
                가입 {formatDate(user.created)} ({formatRelative(user.created, now)})
              </span>
            )}
          </p>
        </div>
        {user.isBanned && <span className="tag tag--danger">정지된 계정</span>}
      </header>

      <PresencePanel presence={presence} tracking={tracking} now={now} />

      {user.description && <p className="bio">{user.description}</p>}

      <footer className="card__actions">
        <button type="button" className="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? '새로고침 중…' : '새로고침'}
        </button>
        <button type="button" className="button" onClick={copyLink}>
          {copied ? '복사됨 ✓' : '링크 복사'}
        </button>
        <a
          className="button"
          href={`https://www.roblox.com/users/${user.id}/profile`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Roblox 프로필 ↗
        </a>
      </footer>
    </article>
  )
}
