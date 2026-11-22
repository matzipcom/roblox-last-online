import { useId } from 'react'

const MODES = [
  { value: 'name', label: '사용자 이름', placeholder: '예: builderman', inputMode: 'text' },
  { value: 'id', label: '사용자 ID', placeholder: '예: 156', inputMode: 'numeric' },
]

export default function SearchForm({ mode, value, error, loading, onModeChange, onValueChange, onSubmit }) {
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
        <legend className="visually-hidden">검색 방식</legend>
        {MODES.map((m) => (
          <label key={m.value} className="segmented__option">
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => onModeChange(m.value)}
            />
            <span>{m.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="search__row">
        <label className="visually-hidden" htmlFor={inputId}>
          {current.label}
        </label>
        <input
          id={inputId}
          className="search__input"
          type="text"
          value={value}
          placeholder={current.placeholder}
          inputMode={current.inputMode}
          maxLength={mode === 'name' ? 20 : 15}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onValueChange(event.target.value)}
        />
        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      <p id={errorId} className="field-error" role="alert">
        {error}
      </p>
    </form>
  )
}
