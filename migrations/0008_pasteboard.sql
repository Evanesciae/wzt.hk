CREATE TABLE IF NOT EXISTS pasteboard_items (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pasteboard_items_channel_created
  ON pasteboard_items(channel_id, created_at DESC);
