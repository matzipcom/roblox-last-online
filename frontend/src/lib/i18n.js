import { createContext, useContext } from 'react'
import { DEFAULT_LANGUAGE, LANGUAGES, translate } from './messages.js'

export const LANGUAGE_STORAGE_KEY = 'rlo:lang'

export const I18nContext = createContext({
  lang: DEFAULT_LANGUAGE,
  locale: LANGUAGES[0].locale,
  setLang: () => {},
  t: (key, params) => translate(DEFAULT_LANGUAGE, key, params),
})

export const useI18n = () => useContext(I18nContext)

// 서버가 준 한국어 메시지 대신, 오류 코드에 대응하는 현재 언어의 메시지를 만든다.
export function describeError(t, error) {
  if (error.code === 'API_BAD_RESPONSE') return t('error.apiBadResponse', error.params)
  const key = `error.${error.code}`
  const text = t(key)
  return text === key ? t('error.UNKNOWN') : text
}
