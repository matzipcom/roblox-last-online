import { useId } from 'react'
import { useI18n } from '../lib/i18n.js'
import { LANGUAGES } from '../lib/messages.js'

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  const id = useId()

  return (
    <div className="lang">
      <label className="visually-hidden" htmlFor={id}>
        {t('language.label')}
      </label>
      <select id={id} className="lang__select" value={lang} onChange={(event) => setLang(event.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  )
}
