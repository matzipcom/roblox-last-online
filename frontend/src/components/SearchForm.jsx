import { useId } from 'react'
import { useI18n } from '../lib/i18n.js'

const MODES = [
  { value: 'name', inputMode: 'text', maxLength: 20 },
  { value: 'id', inputMode: 'numeric', maxLength: 15 },
]

export default function SearchForm({ mode, value, error, loading, onModeChange, onValueChange, onSubmit }) {
  const { t } = useI18n()
  const inputId = useId()
  const errorId = useId()
  const current = MODES.find((m) => m.value === mode)

  return (
    <form
      className="search"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <fieldset className="segmented">
        <legend className="visually-hidden">{t('search.legend')}</legend>
        {MODES.map((m) => (
          <label key={m.value} className="segmented__option">
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => onModeChange(m.value)}
            />
            <span>{t(`search.mode.${m.value}`)}</span>
          </label>
        ))}
      </fieldset>

      <div className="search__row">
        <label className="visually-hidden" htmlFor={inputId}>
          {t(`search.mode.${mode}`)}
        </label>
        <input
          id={inputId}
          className="search__input"
          type="text"
          value={value}
          placeholder={t(`search.placeholder.${mode}`)}
          inputMode={current.inputMode}
          maxLength={current.maxLength}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onValueChange(event.target.value)}
        />
        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? t('search.loading') : t('search.submit')}
        </button>
      </div>

      <p id={errorId} className="field-error" role="alert">
        {error ? t(error) : ''}
      </p>
    </form>
  )
}
