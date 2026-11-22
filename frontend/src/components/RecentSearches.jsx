export default function RecentSearches({ items, onSelect, onClear }) {
  if (items.length === 0) return null

  return (
    <section className="recent" aria-label="최근 검색">
      <h2 className="recent__title">최근 검색</h2>
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
        지우기
      </button>
    </section>
  )
}
