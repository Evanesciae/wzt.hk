-- Private study materials; existing public notes and business tables are untouched.
CREATE TABLE study_settings (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0, auto_analyze INTEGER NOT NULL DEFAULT 0, interval_minutes INTEGER NOT NULL DEFAULT 60, model TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 0);
INSERT INTO study_settings(id) VALUES(1);
ALTER TABLE study_settings ADD COLUMN daily_jobs INTEGER NOT NULL DEFAULT 2;
CREATE TABLE study_attempts(token TEXT PRIMARY KEY,job_id TEXT NOT NULL,started_at TEXT NOT NULL);
CREATE TABLE study_course_state(course_id TEXT PRIMARY KEY, baseline_at TEXT NOT NULL);
CREATE TABLE automation_runs (id TEXT PRIMARY KEY, workflow TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, lease_until INTEGER NOT NULL, result TEXT, error TEXT);
CREATE INDEX automation_runs_workflow ON automation_runs(workflow,started_at);
CREATE TABLE study_sources (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, content_id TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, source_url TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', due_at TEXT, fingerprint TEXT NOT NULL, checked_at TEXT NOT NULL, version_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX study_sources_course ON study_sources(course_id,updated_at);
CREATE TABLE study_versions (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES study_sources(id), hash TEXT NOT NULL, object_key TEXT NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(source_id,hash));
CREATE TABLE automation_jobs (id TEXT PRIMARY KEY, workflow TEXT NOT NULL, source_id TEXT NOT NULL REFERENCES study_sources(id), version_id TEXT NOT NULL REFERENCES study_versions(id), processor_version TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX automation_jobs_pending ON automation_jobs(status,available_at);
CREATE TABLE study_notes (id TEXT PRIMARY KEY REFERENCES automation_jobs(id), source_id TEXT NOT NULL REFERENCES study_sources(id), version_id TEXT NOT NULL REFERENCES study_versions(id), markdown TEXT NOT NULL, model TEXT NOT NULL, processor_version TEXT NOT NULL, usage TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
