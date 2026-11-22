import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchUser } from './api.js'

const IDLE = { status: 'idle', data: null, error: null }

export function useLookup() {
  const [state, setState] = useState(IDLE)
  const controllerRef = useRef(null)

  const lookup = useCallback(async (query, { keepData = false } = {}) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState((prev) => ({ status: 'loading', data: keepData ? prev.data : null, error: null }))
    try {
      const data = await fetchUser(query, controller.signal)
      setState({ status: 'success', data, error: null })
      return data
    } catch (error) {
      if (error.name === 'AbortError') return null
      setState({ status: 'error', data: null, error })
      return null
    }
  }, [])

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    setState(IDLE)
  }, [])

  useEffect(() => () => controllerRef.current?.abort(), [])

  return { ...state, lookup, reset }
}

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const STORAGE_KEY = 'rlo:recent'
const MAX_RECENT = 6

function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'string') : []
  } catch {
    return []
  }
}

function writeRecent(names) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names))
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 메모리에서만 유지한다.
  }
}

export function useRecentSearches() {
  const [recent, setRecent] = useState(readRecent)

  const add = useCallback((name) => {
    setRecent((prev) => {
      const next = [name, ...prev.filter((n) => n.toLowerCase() !== name.toLowerCase())].slice(0, MAX_RECENT)
      writeRecent(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    writeRecent([])
    setRecent([])
  }, [])

  return { recent, add, clear }
}
