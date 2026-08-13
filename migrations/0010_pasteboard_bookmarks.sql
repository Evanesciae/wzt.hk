CREATE TABLE IF NOT EXISTS pasteboard_bookmarks (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pasteboard_bookmarks_channel_created
  ON pasteboard_bookmarks(channel_id, created_at DESC);
