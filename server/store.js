import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const ACTIVE = new Set(['online', 'in-game', 'studio'])

export const isActive = (status) => ACTIVE.has(status)

export function createStore({ file = ':memory:', retentionDays = 30, maxTargets = 200, now = () => Date.now() } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS targets (
      user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      added_at TEXT NOT NULL,
      last_status TEXT,
      last_polled_at TEXT,
      last_seen_online TEXT,
      api_last_online TEXT
    );
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_observations_user ON observations (user_id, observed_at);
  `)

  const iso = () => new Date(now()).toISOString()
  const q = {
    get: db.prepare('SELECT * FROM targets WHERE user_id = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM targets'),
    insert: db.prepare('INSERT INTO targets (user_id, name, added_at) VALUES (?, ?, ?)'),
    rename: db.prepare('UPDATE targets SET name = ? WHERE user_id = ?'),
    list: db.prepare('SELECT user_id FROM targets ORDER BY COALESCE(last_polled_at, added_at)'),
    update: db.prepare(
      `UPDATE targets SET last_status = ?, last_polled_at = ?, last_seen_online = ?, api_last_online = ? WHERE user_id = ?`,
    ),
    lastObs: db.prepare('SELECT status, location FROM observations WHERE user_id = ? ORDER BY id DESC LIMIT 1'),
    addObs: db.prepare('INSERT INTO observations (user_id, observed_at, status, location) VALUES (?, ?, ?, ?)'),
    pruneObs: db.prepare('DELETE FROM observations WHERE observed_at < ?'),
    delTarget: db.prepare('DELETE FROM targets WHERE user_id = ?'),
    delObs: db.prepare('DELETE FROM observations WHERE user_id = ?'),
  }

  // 새 대상이면 추적 목록에 추가한다. 상한에 도달하면 추가하지 않고 false 를 반환한다.
  function track(userId, name) {
    const id = String(userId)
    if (q.get.get(id)) {
      q.rename.run(name, id)
      return true
    }
    if (q.count.get().n >= maxTargets) return false
    q.insert.run(id, name, iso())
    return true
  }

  // 관찰 결과를 기록한다. 활성 상태가 관찰될 때마다 "마지막으로 접속이 관찰된 시각" 을 갱신한다.
  function record(userId, presence) {
    const id = String(userId)
    const target = q.get.get(id)
    if (!target || !presence?.available) return
    const at = iso()
    const lastSeen = isActive(presence.status) ? at : target.last_seen_online
    q.update.run(presence.status, at, lastSeen, presence.lastOnline ?? target.api_last_online, id)

    const prev = q.lastObs.get(id)
    const location = presence.lastLocation ?? null
    if (!prev || prev.status !== presence.status || prev.location !== location) {
      q.addObs.run(id, at, presence.status, location)
    }
  }

  function getTracking(userId) {
    const row = q.get.get(String(userId))
    if (!row) return null
    return {
      since: row.added_at,
      lastPolledAt: row.last_polled_at,
      lastSeenOnline: row.last_seen_online,
      apiLastOnline: row.api_last_online,
    }
  }

  const listTargetIds = () => q.list.all().map((r) => r.user_id)

  function prune() {
    const cutoff = new Date(now() - retentionDays * 86_400_000).toISOString()
    return Number(q.pruneObs.run(cutoff).changes)
  }

  // 추적 중단 + 기록 삭제 (삭제 요청 대응)
  function remove(userId) {
    const id = String(userId)
    q.delObs.run(id)
    return Number(q.delTarget.run(id).changes) > 0
  }

  const close = () => db.close()

  return { track, record, getTracking, listTargetIds, prune, remove, close }
}
