-- Remote login control is separate from the retained browser profile on the VPS.
CREATE TABLE IF NOT EXISTS ntu_browser (
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 0,
  session_id TEXT NOT NULL DEFAULT '',
  session_expires INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paused',
  heartbeat INTEGER NOT NULL DEFAULT 0,
  frame_at INTEGER NOT NULL DEFAULT 0,
  host TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  last_connected INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO ntu_browser(id) VALUES(1);
CREATE TABLE IF NOT EXISTS ntu_browser_commands (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires INTEGER NOT NULL,
  created INTEGER NOT NULL
);
