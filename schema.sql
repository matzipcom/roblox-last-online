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
