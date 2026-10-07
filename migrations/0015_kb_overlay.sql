-- 0015_kb_overlay.sql
-- Personal Knowledge Base overlay layer.
--
-- Design principles (see docs: Phase 0 discovery):
--   * Overlay only: existing business tables (trips, travel_events, kb_notes, ...)
--     are NOT modified. All kb_* tables reference them via source_type/source_id.
--   * Raw data is frozen in kb_sources; AI only reads snapshots.
--   * Every AI-derived row carries model + processor_version + confidence,
--     so any batch can be re-run after a prompt/model upgrade.
--   * No destructive changes; all tables are new.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- kb_sources: frozen snapshots of raw material (the only AI input)
-- source_type: 'trip' | 'trip_day' | 'travel_event' | 'kb_note' | 'flight'
--              | 'city_place' | 'media' | 'markdown'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  raw_text TEXT NOT NULL,
  raw_hash TEXT NOT NULL,
  captured_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS kb_sources_type_id ON kb_sources(source_type, source_id);
CREATE INDEX IF NOT EXISTS kb_sources_hash ON kb_sources(raw_hash);

-- ---------------------------------------------------------------------------
-- kb_entities: canonical normalized entities
-- entity_type: 'place' | 'person' | 'device' | 'trip' | 'event' | 'media'
--              | 'article' | 'project' | 'tag' | 'org' | ...
-- metadata: JSON, e.g. place -> {lat,lng,city,country,geocode_provider,place_id}
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS kb_entities_type ON kb_entities(entity_type);
CREATE INDEX IF NOT EXISTS kb_entities_name ON kb_entities(canonical_name);
CREATE INDEX IF NOT EXISTS kb_entities_review ON kb_entities(needs_review);

-- ---------------------------------------------------------------------------
-- kb_entity_aliases: alias -> entity_id (the home of entity resolution)
-- e.g. 台大 / 台湾大学 / NTU -> the same entity_id
-- source: 'ai' | 'manual' | 'geocode'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_entity_aliases (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES kb_entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  lang TEXT,
  source TEXT NOT NULL DEFAULT 'ai',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS kb_aliases_norm ON kb_entity_aliases(alias_norm);
CREATE INDEX IF NOT EXISTS kb_aliases_entity ON kb_entity_aliases(entity_id);

-- ---------------------------------------------------------------------------
-- kb_relations: entity <-> entity edges (predicates are NOT hard-coded)
-- predicate examples: contains, visits, occurred_at, captured_with, produced,
--   tagged_with, references, belongs_to, used_in
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_relations (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES kb_entities(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  object_id TEXT NOT NULL REFERENCES kb_entities(id) ON DELETE CASCADE,
  source_type TEXT,
  source_id TEXT,
  confidence REAL,
  model TEXT,
  processor_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS kb_relations_subject ON kb_relations(subject_id, predicate);
CREATE INDEX IF NOT EXISTS kb_relations_object ON kb_relations(object_id, predicate);
CREATE INDEX IF NOT EXISTS kb_relations_pred ON kb_relations(predicate);

-- ---------------------------------------------------------------------------
-- kb_knowledge_items: AI-extracted facts/assertions with full provenance
-- item_type: 'fact' | 'entity_mention' | 'summary' | 'tag_suggestion' | ...
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_knowledge_items (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_text TEXT,
  item_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  confidence REAL,
  model TEXT,
  processor_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS kb_items_source ON kb_knowledge_items(source_type, source_id);
CREATE INDEX IF NOT EXISTS kb_items_type ON kb_knowledge_items(item_type);

-- ---------------------------------------------------------------------------
-- kb_timex: time expressions, incl. fuzzy ones (never hallucinate a date)
-- precision: 'datetime' | 'day' | 'month' | 'year' | 'range' | 'approximate'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_timex (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  value_start TEXT,
  value_end TEXT,
  precision TEXT NOT NULL DEFAULT 'day',
  timezone TEXT,
  raw_text TEXT,
  confidence REAL,
  model TEXT,
  processor_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS kb_timex_source ON kb_timex(source_type, source_id);
CREATE INDEX IF NOT EXISTS kb_timex_start ON kb_timex(value_start);

-- ---------------------------------------------------------------------------
-- kb_chunks: RAG retrieval units (structured summaries + fact passages,
-- NOT whole-site naive chunking)
-- chunk_type: 'summary' | 'passage' | 'fact_sheet'
-- entity_ids: JSON array of kb_entities.id mentioned in this chunk
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_chunks (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  chunk_type TEXT NOT NULL,
  text TEXT NOT NULL,
  entity_ids TEXT NOT NULL DEFAULT '[]',
  embedding_id TEXT,
  model TEXT,
  processor_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS kb_chunks_source ON kb_chunks(source_type, source_id);
CREATE INDEX IF NOT EXISTS kb_chunks_type ON kb_chunks(chunk_type);

-- FTS5 keyword index over chunk text (structured + semantic come from
-- entity_ids / Vectorize respectively; this covers the keyword leg).
CREATE VIRTUAL TABLE IF NOT EXISTS kb_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  text,
  tokenize = 'unicode61'
);
CREATE TRIGGER IF NOT EXISTS kb_chunks_fts_insert AFTER INSERT ON kb_chunks BEGIN
  INSERT INTO kb_chunks_fts(chunk_id, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER IF NOT EXISTS kb_chunks_fts_delete AFTER DELETE ON kb_chunks BEGIN
  DELETE FROM kb_chunks_fts WHERE chunk_id = old.id;
END;

-- ---------------------------------------------------------------------------
-- kb_jobs: AI processing queue (offline workers only; never in request path)
-- job_type: 'extract' | 'resolve' | 'embed' | 'media_describe'
-- status: 'pending' | 'processing' | 'completed' | 'failed'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  source_type TEXT,
  source_id TEXT,
  stage TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  processor_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS kb_jobs_status ON kb_jobs(status, job_type);
CREATE INDEX IF NOT EXISTS kb_jobs_source ON kb_jobs(source_type, source_id);

-- ---------------------------------------------------------------------------
-- kb_media: skeleton for future media ingestion (Phase 6).
-- EXIF / R2 keys / vision descriptions land here later.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  r2_key TEXT,
  web_path TEXT,
  capture_time TEXT,
  camera TEXT,
  lens TEXT,
  gps_lat REAL,
  gps_lng REAL,
  place_id TEXT REFERENCES kb_entities(id) ON DELETE SET NULL,
  trip_id TEXT,
  ai_description TEXT,
  ai_tags TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  processor_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS kb_media_capture ON kb_media(capture_time);
CREATE INDEX IF NOT EXISTS kb_media_camera ON kb_media(camera);
