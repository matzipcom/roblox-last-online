import { useCallback, useEffect, useState } from 'react'
import RecentSearches from './components/RecentSearches.jsx'
import SearchForm from './components/SearchForm.jsx'
import UserCard from './components/UserCard.jsx'
import { validateQuery } from './lib/api.js'
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
          Last Online
        </span>
      </header>

      <main className="main">
        <section className="hero">
          <h1>Roblox 마지막 접속 시간 조회</h1>
          <p>사용자 이름 또는 ID로 마지막 접속 시간과 현재 접속 상태를 확인하세요.</p>
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
                {error.code === 'USER_NOT_FOUND' ? '사용자를 찾을 수 없습니다' : '조회하지 못했습니다'}
              </p>
              <p>{error.message}</p>
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
        Roblox Corporation과 제휴하지 않은 비공식 사이트입니다. 접속 시간은 사용자의 개인정보 설정에 따라 표시되지 않을 수 있습니다.
      </footer>
    </div>
  )
}
