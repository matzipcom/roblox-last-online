import { useCallback, useEffect, useMemo, useState } from 'react'
import { I18nContext, LANGUAGE_STORAGE_KEY } from '../lib/i18n.js'
import { LANGUAGES, MESSAGES, detectLanguage, translate } from '../lib/messages.js'

function initialLanguage() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang')
  if (fromUrl && MESSAGES[fromUrl]) return fromUrl
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved && MESSAGES[saved]) return saved
  } catch {
    // 저장소를 쓸 수 없으면 브라우저 언어를 사용한다.
  }
  return detectLanguage(navigator.languages ?? [navigator.language])
}

export default function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage)

  const setLang = useCallback((next) => {
    if (!MESSAGES[next]) return
    setLangState(next)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      // 저장소를 쓸 수 없는 환경에서는 이번 세션에서만 유지한다.
    }
  }, [])

  const value = useMemo(
    () => ({
      lang,
      locale: LANGUAGES.find((l) => l.code === lang).locale,
      setLang,
      t: (key, params) => translate(lang, key, params),
    }),
    [lang, setLang],
  )

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = translate(lang, 'app.title')
    document.querySelector('meta[name="description"]')?.setAttribute('content', translate(lang, 'app.description'))
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
