-- Additive only: no existing site data is changed.
CREATE TABLE IF NOT EXISTS ntu_settings (id INTEGER PRIMARY KEY CHECK (id=1), config TEXT NOT NULL, secrets TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ntu_state (id INTEGER PRIMARY KEY CHECK (id=1), lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0, last_attempt TEXT, last_success TEXT, error TEXT, warning TEXT, last_alert TEXT);
INSERT OR IGNORE INTO ntu_state (id) VALUES (1);
CREATE TABLE IF NOT EXISTS ntu_courses (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL, baseline INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ntu_items (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, source_url TEXT NOT NULL, source_date TEXT, due_at TEXT, fingerprint TEXT NOT NULL, summary TEXT, important INTEGER NOT NULL DEFAULT 0, ai_status TEXT NOT NULL DEFAULT 'pending', read_at TEXT, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ntu_items_due ON ntu_items(due_at);
CREATE TABLE IF NOT EXISTS ntu_delivery (id TEXT PRIMARY KEY, item_id TEXT, fingerprint TEXT, category TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, sent_at TEXT, error TEXT);
CREATE INDEX IF NOT EXISTS ntu_delivery_pending ON ntu_delivery(status,next_attempt);
