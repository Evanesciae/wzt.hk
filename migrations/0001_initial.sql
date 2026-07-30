PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  summary TEXT NOT NULL,
  pending_items TEXT NOT NULL DEFAULT '[]',
  body TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  draft INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  dates_tbd INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  city TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS travel_events (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL,
  day_id TEXT NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  time TEXT,
  note TEXT,
  location_lat REAL,
  location_lng REAL,
  location_address TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL,
  time_source TEXT NOT NULL DEFAULT 'photo'
);

CREATE UNIQUE INDEX IF NOT EXISTS events_day_public_id ON travel_events(day_id, public_id);

CREATE TABLE IF NOT EXISTS travel_photos (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES travel_events(id) ON DELETE CASCADE,
  original_path TEXT NOT NULL,
  variants TEXT NOT NULL,
  alt TEXT NOT NULL,
  caption TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  taken_at TEXT,
  sort_order INTEGER
);

CREATE INDEX IF NOT EXISTS days_trip_order ON trip_days(trip_id, sort_order);
CREATE INDEX IF NOT EXISTS events_day_order ON travel_events(day_id, sort_order);
CREATE INDEX IF NOT EXISTS photos_event ON travel_photos(event_id, created_at);

CREATE TABLE IF NOT EXISTS kb_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  draft INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  strict INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS airports (
  code TEXT PRIMARY KEY,
  icao TEXT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  timezone TEXT
);

CREATE TABLE IF NOT EXISTS flights (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  airline_code TEXT,
  airline_name TEXT,
  from_airport TEXT NOT NULL REFERENCES airports(code),
  to_airport TEXT NOT NULL REFERENCES airports(code),
  scheduled_departure TEXT,
  scheduled_arrival TEXT,
  actual_departure TEXT,
  actual_arrival TEXT,
  aircraft_type TEXT,
  aircraft_reg TEXT,
  cabin TEXT,
  seat TEXT,
  distance_km REAL,
  duration_minutes INTEGER,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  note TEXT,
  source TEXT,
  raw TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  date_precision TEXT NOT NULL DEFAULT 'day'
);

CREATE INDEX IF NOT EXISTS flights_date ON flights(date DESC);
CREATE INDEX IF NOT EXISTS flights_route ON flights(from_airport, to_airport);

CREATE TABLE IF NOT EXISTS city_places (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  district TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  draft INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS city_photos (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES city_places(id) ON DELETE CASCADE,
  original_path TEXT NOT NULL,
  variants TEXT NOT NULL,
  alt TEXT NOT NULL,
  caption TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  sort_order INTEGER
);

CREATE INDEX IF NOT EXISTS city_places_city_order ON city_places(city, sort_order, name);
CREATE INDEX IF NOT EXISTS city_photos_place_order ON city_photos(place_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS app_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
