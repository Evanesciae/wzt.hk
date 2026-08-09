ALTER TABLE city_places ADD COLUMN visit_status TEXT NOT NULL DEFAULT 'want';
ALTER TABLE city_places ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE city_places ADD COLUMN recommendation TEXT;
ALTER TABLE city_places ADD COLUMN address TEXT;
ALTER TABLE city_places ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE city_places ADD COLUMN rating REAL;
ALTER TABLE city_places ADD COLUMN last_visited_at TEXT;
ALTER TABLE city_places ADD COLUMN trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_city_places_city_status
ON city_places(city, visit_status, sort_order);

CREATE INDEX IF NOT EXISTS idx_city_places_trip_id
ON city_places(trip_id);

PRAGMA optimize;
