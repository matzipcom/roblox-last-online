const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

const cache = new Map()
function formatters(locale) {
  if (!cache.has(locale)) {
    cache.set(locale, {
      relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
      dateTime: new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
      date: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    })
  }
  return cache.get(locale)
}

export function formatRelative(iso, { locale, justNow, now = Date.now() }) {
  const diffSec = Math.trunc((Date.parse(iso) - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return justNow
  const [unit, seconds] = UNITS.find(([, s]) => abs >= s)
  return formatters(locale).relative.format(Math.trunc(diffSec / seconds), unit)
}

export const formatDateTime = (iso, locale) => formatters(locale).dateTime.format(new Date(iso))
export const formatDate = (iso, locale) => formatters(locale).date.format(new Date(iso))
