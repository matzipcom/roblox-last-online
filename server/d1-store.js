import { isActive } from './presence.js'

// Cloudflare D1 용 저장소. store.js(SQLite)와 같은 메서드를 비동기로 제공한다.
export function createD1Store({ db, retentionDays = 30, maxTargets = 200, now = () => Date.now() }) {
  const iso = () => new Date(now()).toISOString()
  const getRow = (id) => db.prepare('SELECT * FROM targets WHERE user_id = ?').bind(id).first()

  async function track(userId, name) {
    const id = String(userId)
    if (await getRow(id)) {
      await db.prepare('UPDATE targets SET name = ? WHERE user_id = ?').bind(name, id).run()
      return true
    }
    const { n } = await db.prepare('SELECT COUNT(*) AS n FROM targets').first()
    if (n >= maxTargets) return false
    await db.prepare('INSERT OR IGNORE INTO targets (user_id, name, added_at) VALUES (?, ?, ?)').bind(id, name, iso()).run()
    return true
  }

  async function record(userId, presence) {
    const id = String(userId)
    if (!presence?.available) return
    const target = await getRow(id)
    if (!target) return
    const at = iso()
    const lastSeen = isActive(presence.status) ? at : target.last_seen_online
    const location = presence.lastLocation ?? null
    const prev = await db
      .prepare('SELECT status, location FROM observations WHERE user_id = ? ORDER BY id DESC LIMIT 1')
      .bind(id)
      .first()

    const statements = [
      db
        .prepare('UPDATE targets SET last_status = ?, last_polled_at = ?, last_seen_online = ?, api_last_online = ? WHERE user_id = ?')
        .bind(presence.status, at, lastSeen, presence.lastOnline ?? target.api_last_online, id),
    ]
    if (!prev || prev.status !== presence.status || prev.location !== location) {
      statements.push(
        db.prepare('INSERT INTO observations (user_id, observed_at, status, location) VALUES (?, ?, ?, ?)').bind(id, at, presence.status, location),
      )
    }
    await db.batch(statements)
  }

  async function getTracking(userId) {
    const row = await getRow(String(userId))
    if (!row) return null
    return {
      since: row.added_at,
      lastPolledAt: row.last_polled_at,
      lastSeenOnline: row.last_seen_online,
      apiLastOnline: row.api_last_online,
    }
  }

  async function listTargetIds() {
    const { results } = await db.prepare('SELECT user_id FROM targets ORDER BY COALESCE(last_polled_at, added_at)').all()
    return results.map((r) => r.user_id)
  }

  async function prune() {
    const cutoff = new Date(now() - retentionDays * 86_400_000).toISOString()
    const result = await db.prepare('DELETE FROM observations WHERE observed_at < ?').bind(cutoff).run()
    return result.meta?.changes ?? 0
  }

  async function remove(userId) {
    const id = String(userId)
    await db.prepare('DELETE FROM observations WHERE user_id = ?').bind(id).run()
    const result = await db.prepare('DELETE FROM targets WHERE user_id = ?').bind(id).run()
    return (result.meta?.changes ?? 0) > 0
  }

  return { track, record, getTracking, listTargetIds, prune, remove }
}
