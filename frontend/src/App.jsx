import { useCallback, useEffect, useState } from 'react'
import RecentSearches from './components/RecentSearches.jsx'
import SearchForm from './components/SearchForm.jsx'
import UserCard from './components/UserCard.jsx'
import LanguageSwitcher from './components/LanguageSwitcher.jsx'
import { validateQuery } from './lib/api.js'
import { describeError, useI18n } from './lib/i18n.js'
import { useLookup, useNow, useRecentSearches } from './lib/hooks.js'

function readUrlQuery() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('name')) return { mode: 'name', value: params.get('name') }
  if (params.get('id')) return { mode: 'id', value: params.get('id') }
  return null
}

function CardSkeleton() {
  return (
    <div className="card card--skeleton" aria-hidden="true">
      <div className="card__header">
        <div className="avatar skeleton" />
        <div className="identity">
          <div className="skeleton skeleton--line skeleton--w60" />
          <div className="skeleton skeleton--line skeleton--w40" />
        </div>
      </div>
      <div className="skeleton skeleton--block" />
    </div>
  )
}

export default function App() {
  const { t } = useI18n()
  const [initialQuery] = useState(readUrlQuery)
  const [mode, setMode] = useState(initialQuery?.mode ?? 'name')
  const [value, setValue] = useState(initialQuery?.value ?? '')
  const [validationError, setValidationError] = useState(() =>
    initialQuery ? validateQuery(initialQuery.mode, initialQuery.value) : null,
  )

  const { status, data, error, lookup, reset } = useLookup()
  const { recent, add, clear } = useRecentSearches()
  const now = useNow()

  const runLookup = useCallback(
    async (query, options) => {
      const result = await lookup(query, options)
      if (result) add(result.user.name)
    },
    [lookup, add],
  )

  const search = useCallback(
    (query, { push = true } = {}) => {
      const message = validateQuery(query.mode, query.value)
      setValidationError(message)
      if (message) return

      if (push) {
        window.history.pushState(null, '', `?${new URLSearchParams({ [query.mode]: query.value })}`)
      }
      return runLookup(query)
    },
    [runLookup],
  )

  useEffect(() => {
    if (initialQuery && !validateQuery(initialQuery.mode, initialQuery.value)) runLookup(initialQuery)
  }, [initialQuery, runLookup])

  useEffect(() => {
    function onPopState() {
      const query = readUrlQuery()
      if (query) {
        setMode(query.mode)
        setValue(query.value)
        search(query, { push: false })
      } else {
        setValue('')
        setValidationError(null)
        reset()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [search, reset])

  function changeMode(nextMode) {
    setMode(nextMode)
    setValue('')
    setValidationError(null)
  }

  function searchRecent(name) {
    setMode('name')
    setValue(name)
    search({ mode: 'name', value: name })
  }

  const loading = status === 'loading'
  const refreshing = loading && data !== null

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t('brand')}
        </span>
        <LanguageSwitcher />
      </header>

      <main className="main">
        <section className="hero">
          <h1>{t('hero.title')}</h1>
          <p>{t('hero.subtitle')}</p>
        </section>

        <SearchForm
          mode={mode}
          value={value}
          error={validationError}
          loading={loading}
          onModeChange={changeMode}
          onValueChange={(next) => {
            setValue(next)
            if (validationError) setValidationError(null)
          }}
          onSubmit={() => search({ mode, value: value.trim() })}
        />

        <RecentSearches items={recent} onSelect={searchRecent} onClear={clear} />

        <div className="results" aria-live="polite">
          {loading && !refreshing && <CardSkeleton />}

          {status === 'error' && (
            <div className="notice notice--error" role="alert">
              <p className="notice__title">
                {error.code === 'USER_NOT_FOUND' ? t('error.title.notFound') : t('error.title.generic')}
              </p>
              <p>{describeError(t, error)}</p>
            </div>
          )}

          {data && (
            <UserCard
              key={data.user.id}
              data={data}
              now={now}
              refreshing={refreshing}
              onRefresh={() => lookup({ mode: 'id', value: String(data.user.id) }, { keepData: true })}
            />
          )}
        </div>
      </main>

      <footer className="footer">
        {t('footer.disclaimer')}
      </footer>
    </div>
  )
}
