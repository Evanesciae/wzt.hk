-- Meme gallery for meme.wzt.hk. Files live in R2 under public/memes/<id>.<ext>
-- and are served by the existing /media/* route (no transformation, GIFs keep animation).
-- Memes are grouped by "series" (a character/set they belong to); empty series = loose image.
CREATE TABLE memes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  series TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
