import { useI18n } from '../lib/i18n.js'
import { formatDateTime, formatRelative } from '../lib/time.js'

const TONES = { online: 'online', 'in-game': 'ingame', studio: 'studio', offline: 'offline', invisible: 'offline' }
const ACTIVE = ['online', 'in-game', 'studio']
const UNAVAILABLE_REASONS = ['NO_AUTH', 'AUTH_FAILED', 'RATE_LIMITED']

export default function PresencePanel({ presence, tracking, now }) {
  const { t, locale } = useI18n()

  if (!presence.available) {
    const prefix = UNAVAILABLE_REASONS.includes(presence.reason)
      ? `presence.unavailable.${presence.reason}`
      : 'presence.unavailable'
    return (
      <div className="presence presence--unavailable">
        <p className="presence__headline">{t(`${prefix}.title`)}</p>
        <p className="presence__note">{t(`${prefix}.body`)}</p>
      </div>
    )
  }

  const status = TONES[presence.status] ? presence.status : 'offline'
  const tone = TONES[status]
  const isActive = ACTIVE.includes(status)
  const detail = t(`status.${status}.detail`)
  const hasDetail = detail !== `status.${status}.detail`

  return (
    <div className={`presence presence--${tone}`}>
      <div className="presence__top">
        <span className={`status status--${tone}`}>
          <span className="status__dot" aria-hidden="true" />
          {t(`status.${status}`)}
        </span>
      </div>

      <p className="presence__label">{isActive ? t('presence.current') : t('presence.last')}</p>

      {isActive ? (
        <>
          <p className="presence__headline">{t('presence.active')}</p>
          <p className="presence__note">
            {detail}
            {presence.lastLocation ? ` (${presence.lastLocation})` : ''}
          </p>
        </>
      ) : presence.lastOnline ? (
        <>
          <p className="presence__headline">
            {formatRelative(presence.lastOnline, { locale, justNow: t('time.justNow'), now })}
          </p>
          <p className="presence__note">
            <time dateTime={presence.lastOnline}>{formatDateTime(presence.lastOnline, locale)}</time>
          </p>
          {presence.lastOnlineSource === 'tracked' && <p className="presence__note">{t('presence.trackedNote')}</p>}
          {hasDetail && <p className="presence__note">{detail}</p>}
        </>
      ) : (
        <>
          <p className="presence__headline">{t('presence.unknown')}</p>
          <p className="presence__note">
            {tracking?.enabled
              ? t('presence.trackingStarted', { date: formatDateTime(tracking.since, locale) })
              : t('presence.hiddenNote')}
          </p>
          <p className="presence__note">{t('presence.privacyNote')}</p>
        </>
      )}
    </div>
  )
}
