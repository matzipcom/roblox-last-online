export class TtlCache {
  #map = new Map()

  constructor({ ttlMs, maxEntries = 500 }) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
  }

  get(key) {
    const entry = this.#map.get(key)
    if (!entry) return undefined
    if (entry.expires <= Date.now()) {
      this.#map.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key, value) {
    this.#map.delete(key)
    this.#map.set(key, { value, expires: Date.now() + this.ttlMs })
    if (this.#map.size > this.maxEntries) {
      this.#map.delete(this.#map.keys().next().value)
    }
  }

  clear() {
    this.#map.clear()
  }
}
