const relativeFormat = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })

const dateTimeFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

export function formatRelative(iso, now = Date.now()) {
  const diffSec = Math.trunc((Date.parse(iso) - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return '방금 전'
  const [unit, seconds] = UNITS.find(([, s]) => abs >= s)
  return relativeFormat.format(Math.trunc(diffSec / seconds), unit)
}

export const formatDateTime = (iso) => dateTimeFormat.format(new Date(iso))
export const formatDate = (iso) => dateFormat.format(new Date(iso))
