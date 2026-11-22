import { useI18n } from '../lib/i18n.js'

export default function RecentSearches({ items, onSelect, onClear }) {
  const { t } = useI18n()
  if (items.length === 0) return null

  return (
    <section className="recent" aria-label={t('recent.title')}>
      <h2 className="recent__title">{t('recent.title')}</h2>
      <ul className="recent__list">
        {items.map((name) => (
          <li key={name}>
            <button type="button" className="chip" onClick={() => onSelect(name)}>
              {name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="link-button" onClick={onClear}>
        {t('recent.clear')}
      </button>
    </section>
  )
}
