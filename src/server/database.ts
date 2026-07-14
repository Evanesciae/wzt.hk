import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { parse as parseYaml } from 'yaml';
import { seedAirports, fallbackAirport } from './airports';
import type { Airport, EventType, Flight, KbNote, TravelDay, TravelEvent, TravelEventData, TravelPhoto, TravelTrip, TripStatus } from './types';

type Row = Record<string, unknown>;
let database: DatabaseSync | undefined;
let seeded = false;
const photoTimeZone = process.env.APP_TIME_ZONE ?? 'Asia/Hong_Kong';

function parseFrontmatter(source: string) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) throw new Error('Invalid Markdown frontmatter');
  return { data: parseYaml(match[1]) as Record<string, any>, body: match[2].trim() };
}

function toDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, destination TEXT NOT NULL,
      status TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      summary TEXT NOT NULL, pending_items TEXT NOT NULL DEFAULT '[]',
      body TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL,
      draft INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS trip_days (
      id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      date TEXT NOT NULL, city TEXT NOT NULL, title TEXT, summary TEXT, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS travel_events (
      id TEXT PRIMARY KEY, public_id TEXT NOT NULL,
      day_id TEXT NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
      type TEXT NOT NULL, title TEXT NOT NULL, time TEXT,
      time_source TEXT NOT NULL DEFAULT 'photo', note TEXT,
      location_lat REAL, location_lng REAL, location_address TEXT,
      data TEXT NOT NULL DEFAULT '{}', sort_order INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS events_day_public_id ON travel_events(day_id, public_id);
    CREATE TABLE IF NOT EXISTS travel_photos (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES travel_events(id) ON DELETE CASCADE,
      original_path TEXT NOT NULL, variants TEXT NOT NULL, alt TEXT NOT NULL,
      caption TEXT, featured INTEGER NOT NULL DEFAULT 0, taken_at TEXT, created_at TEXT NOT NULL,
      sort_order INTEGER
    );
    CREATE INDEX IF NOT EXISTS days_trip_order ON trip_days(trip_id, sort_order);
    CREATE INDEX IF NOT EXISTS events_day_order ON travel_events(day_id, sort_order);
    CREATE INDEX IF NOT EXISTS photos_event ON travel_photos(event_id, created_at);
    CREATE TABLE IF NOT EXISTS kb_notes (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL,
      category TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', body TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      draft INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0, strict INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS airports (
      code TEXT PRIMARY KEY, icao TEXT, name TEXT NOT NULL, city TEXT NOT NULL,
      country TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, timezone TEXT
    );
    CREATE TABLE IF NOT EXISTS flights (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, flight_number TEXT NOT NULL,
      airline_code TEXT, airline_name TEXT, from_airport TEXT NOT NULL REFERENCES airports(code),
      to_airport TEXT NOT NULL REFERENCES airports(code), scheduled_departure TEXT, scheduled_arrival TEXT,
      actual_departure TEXT, actual_arrival TEXT, aircraft_type TEXT, aircraft_reg TEXT,
      cabin TEXT, seat TEXT, distance_km REAL, duration_minutes INTEGER,
      trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL, note TEXT, source TEXT, raw TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS flights_date ON flights(date DESC);
    CREATE INDEX IF NOT EXISTS flights_route ON flights(from_airport, to_airport);
  `);
  try { db.exec('ALTER TABLE travel_photos ADD COLUMN taken_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE travel_photos ADD COLUMN sort_order INTEGER'); } catch {}
  let addedTimeSource = false;
  try { db.exec("ALTER TABLE travel_events ADD COLUMN time_source TEXT NOT NULL DEFAULT 'photo'"); addedTimeSource = true; } catch {}
  if (addedTimeSource) db.exec("UPDATE travel_events SET time_source='manual' WHERE time IS NOT NULL AND time != ''");
  try { db.exec('ALTER TABLE kb_notes ADD COLUMN strict INTEGER NOT NULL DEFAULT 0'); } catch {}
}

export function getDatabase() {
  if (!database) {
    const path = resolve(process.env.DB_PATH ?? join(process.cwd(), 'data', 'wzt.db'));
    mkdirSync(dirname(path), { recursive: true });
    database = new DatabaseSync(path);
    initSchema(database);
  }
  if (!seeded) {
    seeded = true;
    try { seedTravel(database); } catch (error) { console.error('Seed travel failed:', error); }
    try { migrateLegacyEventIds(database); } catch (error) { console.error('Legacy event migration failed:', error); }
    try { syncPhotoTimes(database); } catch (error) { console.error('Photo time sync failed:', error); }
    try { seedKb(database); } catch (error) { console.error('Seed kb failed:', error); }
    try { seedAirportRows(database); } catch (error) { console.error('Seed airports failed:', error); }
  }
  return database;
}

function seedTravel(db: DatabaseSync) {
  const count = Number((db.prepare('SELECT COUNT(*) AS count FROM trips').get() as Row).count);
  if (count > 0) return;
  const base = resolve(process.env.TRAVEL_SEED_DIR ?? join(process.cwd(), 'src', 'content', 'travel'));
  let directories: string[] = [];
  try {
    directories = readdirSync(base, { withFileTypes: true })
      .filter((item) => item.isDirectory()).map((item) => item.name);
  } catch { return; }

  const insertTrip = db.prepare(`INSERT INTO trips
    (id,title,destination,status,start_date,end_date,summary,pending_items,body,updated_at,draft,featured)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertDay = db.prepare(`INSERT INTO trip_days
    (id,trip_id,date,city,title,summary,sort_order) VALUES (?,?,?,?,?,?,?)`);
  const insertEvent = db.prepare(`INSERT INTO travel_events
    (id,public_id,day_id,type,title,time,time_source,note,location_lat,location_lng,location_address,data,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  db.exec('BEGIN');
  try {
    for (const tripId of directories) {
      let tripSource: string;
      try { tripSource = readFileSync(join(base, tripId, 'index.md'), 'utf8'); } catch { continue; }
      const trip = parseFrontmatter(tripSource);
      insertTrip.run(tripId, trip.data.title, trip.data.destination, trip.data.status,
        toDate(trip.data.startDate), toDate(trip.data.endDate), trip.data.summary,
        JSON.stringify(trip.data.pendingItems ?? []), trip.body, toDate(trip.data.updatedAt),
        trip.data.draft ? 1 : 0, trip.data.featured ? 1 : 0);
      const daysDir = join(base, tripId, 'days');
      let dayFiles: string[] = [];
      try { dayFiles = readdirSync(daysDir).filter((file) => file.endsWith('.md')).sort(); } catch { continue; }
      dayFiles.forEach((file, dayIndex) => {
        const parsed = parseFrontmatter(readFileSync(join(daysDir, file), 'utf8'));
        const date = toDate(parsed.data.date);
        const dayId = `${tripId}/${date}`;
        insertDay.run(dayId, tripId, date, parsed.data.city, parsed.data.title ?? null,
          parsed.data.summary ?? null, dayIndex);
        (parsed.data.events ?? []).forEach((event: Record<string, any>, eventIndex: number) => {
          const location = event.location;
          const extra = { ...event };
          for (const key of ['id', 'type', 'title', 'time', 'note', 'location', 'photos']) delete extra[key];
          insertEvent.run(randomUUID(), event.id, dayId, event.type, event.title,
            event.time ?? null, event.time ? 'manual' : 'photo', event.note ?? null, location?.lat ?? null, location?.lng ?? null,
            location?.address ?? null, JSON.stringify(extra), eventIndex);
        });
      });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrateLegacyEventIds(db: DatabaseSync) {
  type LegacyEventRow = {
    id: string; public_id: string; day_id: string; type: string; title: string;
    time: string | null; time_source?: string | null; note: string | null; location_lat: number | null; location_lng: number | null;
    location_address: string | null; data: string; sort_order: number;
  };
  const rows = db.prepare("SELECT * FROM travel_events WHERE id LIKE '%/%'").all() as LegacyEventRow[];
  if (rows.length === 0) return;
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const newId = randomUUID();
      db.prepare('UPDATE travel_photos SET event_id=? WHERE event_id=?').run(newId, row.id);
      db.prepare('DELETE FROM travel_events WHERE id=?').run(row.id);
      db.prepare(`INSERT INTO travel_events
        (id,public_id,day_id,type,title,time,time_source,note,location_lat,location_lng,location_address,data,sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(newId, row.public_id, row.day_id, row.type, row.title,
        row.time, row.time_source ?? (row.time ? 'manual' : 'photo'), row.note, row.location_lat, row.location_lng, row.location_address, row.data, row.sort_order);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function seedKb(db: DatabaseSync) {
  const count = Number((db.prepare('SELECT COUNT(*) AS count FROM kb_notes').get() as Row).count);
  if (count > 0) return;
  const base = resolve(process.env.KB_SEED_DIR ?? join(process.cwd(), 'src', 'content', 'kb'));
  let files: string[] = [];
  try { files = readdirSync(base).filter((file) => file.endsWith('.md')); } catch { return; }
  const insert = db.prepare(`INSERT INTO kb_notes
    (id,title,summary,category,tags,body,created_at,updated_at,draft,featured,strict)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  try {
    for (const file of files) {
      let source: string;
      try { source = readFileSync(join(base, file), 'utf8'); } catch { continue; }
      const note = parseFrontmatter(source);
      const id = file.replace(/\.md$/, '');
      insert.run(id, note.data.title, note.data.summary ?? '', note.data.category ?? 'reference',
        JSON.stringify(note.data.tags ?? []), note.body, toDate(note.data.createdAt ?? note.data.updatedAt),
        toDate(note.data.updatedAt ?? note.data.createdAt), note.data.draft ? 1 : 0, note.data.featured ? 1 : 0, 0);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function seedAirportRows(db: DatabaseSync) {
  const insert = db.prepare(`INSERT OR IGNORE INTO airports
    (code,icao,name,city,country,lat,lng,timezone) VALUES (?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN');
  try {
    seedAirports.forEach((airport) => insert.run(
      airport.code, airport.icao ?? null, airport.name, airport.city, airport.country,
      airport.lat, airport.lng, airport.timezone ?? null,
    ));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function rowToAirport(row: Row): Airport {
  return {
    code: String(row.code), icao: row.icao ? String(row.icao) : undefined,
    name: String(row.name), city: String(row.city), country: String(row.country),
    lat: Number(row.lat), lng: Number(row.lng), timezone: row.timezone ? String(row.timezone) : undefined,
  };
}

function ensureAirport(db: DatabaseSync, airport: Airport) {
  db.prepare(`INSERT INTO airports (code,icao,name,city,country,lat,lng,timezone)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(code) DO UPDATE SET icao=excluded.icao,name=excluded.name,city=excluded.city,
      country=excluded.country,lat=excluded.lat,lng=excluded.lng,timezone=excluded.timezone`)
    .run(airport.code, airport.icao ?? null, airport.name, airport.city, airport.country,
      airport.lat, airport.lng, airport.timezone ?? null);
}

function rowToFlight(row: Row): Flight {
  return {
    id: String(row.id), date: String(row.date), flightNumber: String(row.flight_number),
    airlineCode: row.airline_code ? String(row.airline_code) : undefined,
    airlineName: row.airline_name ? String(row.airline_name) : undefined,
    fromAirport: {
      code: String(row.from_code), icao: row.from_icao ? String(row.from_icao) : undefined,
      name: String(row.from_name), city: String(row.from_city), country: String(row.from_country),
      lat: Number(row.from_lat), lng: Number(row.from_lng), timezone: row.from_timezone ? String(row.from_timezone) : undefined,
    },
    toAirport: {
      code: String(row.to_code), icao: row.to_icao ? String(row.to_icao) : undefined,
      name: String(row.to_name), city: String(row.to_city), country: String(row.to_country),
      lat: Number(row.to_lat), lng: Number(row.to_lng), timezone: row.to_timezone ? String(row.to_timezone) : undefined,
    },
    scheduledDeparture: row.scheduled_departure ? String(row.scheduled_departure) : undefined,
    scheduledArrival: row.scheduled_arrival ? String(row.scheduled_arrival) : undefined,
    actualDeparture: row.actual_departure ? String(row.actual_departure) : undefined,
    actualArrival: row.actual_arrival ? String(row.actual_arrival) : undefined,
    aircraftType: row.aircraft_type ? String(row.aircraft_type) : undefined,
    aircraftReg: row.aircraft_reg ? String(row.aircraft_reg) : undefined,
    cabin: row.cabin ? String(row.cabin) : undefined,
    seat: row.seat ? String(row.seat) : undefined,
    distanceKm: row.distance_km == null ? undefined : Number(row.distance_km),
    durationMinutes: row.duration_minutes == null ? undefined : Number(row.duration_minutes),
    tripId: row.trip_id ? String(row.trip_id) : undefined,
    note: row.note ? String(row.note) : undefined,
    source: row.source ? String(row.source) : undefined,
    raw: row.raw ? JSON.parse(String(row.raw)) : undefined,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

const flightSelect = `SELECT f.*,
  fa.code from_code,fa.icao from_icao,fa.name from_name,fa.city from_city,fa.country from_country,fa.lat from_lat,fa.lng from_lng,fa.timezone from_timezone,
  ta.code to_code,ta.icao to_icao,ta.name to_name,ta.city to_city,ta.country to_country,ta.lat to_lat,ta.lng to_lng,ta.timezone to_timezone
  FROM flights f JOIN airports fa ON fa.code=f.from_airport JOIN airports ta ON ta.code=f.to_airport`;

export type FlightInput = Omit<Flight, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export function listFlights() {
  return (getDatabase().prepare(`${flightSelect} ORDER BY f.date DESC, f.scheduled_departure DESC, f.flight_number`).all() as Row[]).map(rowToFlight);
}

export function getFlight(id: string) {
  const row = getDatabase().prepare(`${flightSelect} WHERE f.id=?`).get(id) as Row | undefined;
  return row ? rowToFlight(row) : undefined;
}

export function listAirports() {
  return (getDatabase().prepare('SELECT * FROM airports ORDER BY code').all() as Row[]).map(rowToAirport);
}

export function getAirport(code: string) {
  const row = getDatabase().prepare('SELECT * FROM airports WHERE code=?').get(code.trim().toUpperCase()) as Row | undefined;
  return row ? rowToAirport(row) : undefined;
}

export function searchAirports(query: string) {
  const q = `%${query.trim().toUpperCase()}%`;
  return (getDatabase().prepare(`SELECT * FROM airports
    WHERE upper(code) LIKE ? OR upper(coalesce(icao,'')) LIKE ? OR upper(name) LIKE ? OR upper(city) LIKE ? OR upper(country) LIKE ?
    ORDER BY CASE WHEN upper(code)=upper(?) THEN 0 WHEN upper(code) LIKE upper(?) THEN 1 ELSE 2 END, code
    LIMIT 12`).all(q, q, q, q, q, query.trim(), `${query.trim()}%`) as Row[]).map(rowToAirport);
}

export function upsertAirport(airport: Airport) {
  const code = airport.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(code)) throw new Error('INVALID_AIRPORT_CODE');
  ensureAirport(getDatabase(), { ...airport, code });
  return code;
}

export function deleteAirport(code: string) {
  const normalized = code.trim().toUpperCase();
  const db = getDatabase();
  const usage = db.prepare('SELECT COUNT(*) AS count FROM flights WHERE from_airport=? OR to_airport=?')
    .get(normalized, normalized) as Row;
  if (Number(usage.count) > 0) throw new Error('AIRPORT_IN_USE');
  db.prepare('DELETE FROM airports WHERE code=?').run(normalized);
}

function flightDistanceKm(from: Airport, to: Airport) {
  if (!from.lat || !from.lng || !to.lat || !to.lng) return undefined;
  const radius = 6371;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function flightDurationMinutes(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return undefined;
  return Math.round((to - from) / 60000);
}

export function upsertFlight(input: FlightInput) {
  const db = getDatabase();
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  const from = input.fromAirport.code ? input.fromAirport : fallbackAirport(input.fromAirport.code);
  const to = input.toAirport.code ? input.toAirport : fallbackAirport(input.toAirport.code);
  const distance = input.distanceKm ?? flightDistanceKm(from, to);
  const duration = input.durationMinutes ?? flightDurationMinutes(input.actualDeparture ?? input.scheduledDeparture, input.actualArrival ?? input.scheduledArrival);
  db.exec('BEGIN');
  try {
    ensureAirport(db, from);
    ensureAirport(db, to);
    db.prepare(`INSERT INTO flights
      (id,date,flight_number,airline_code,airline_name,from_airport,to_airport,scheduled_departure,
       scheduled_arrival,actual_departure,actual_arrival,aircraft_type,aircraft_reg,cabin,seat,
       distance_km,duration_minutes,trip_id,note,source,raw,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET date=excluded.date,flight_number=excluded.flight_number,
       airline_code=excluded.airline_code,airline_name=excluded.airline_name,from_airport=excluded.from_airport,
       to_airport=excluded.to_airport,scheduled_departure=excluded.scheduled_departure,
       scheduled_arrival=excluded.scheduled_arrival,actual_departure=excluded.actual_departure,
       actual_arrival=excluded.actual_arrival,aircraft_type=excluded.aircraft_type,
       aircraft_reg=excluded.aircraft_reg,cabin=excluded.cabin,seat=excluded.seat,
       distance_km=excluded.distance_km,duration_minutes=excluded.duration_minutes,
       trip_id=excluded.trip_id,note=excluded.note,source=excluded.source,raw=excluded.raw,
       updated_at=excluded.updated_at`)
      .run(id, input.date, input.flightNumber, input.airlineCode ?? null, input.airlineName ?? null,
        from.code, to.code, input.scheduledDeparture ?? null, input.scheduledArrival ?? null,
        input.actualDeparture ?? null, input.actualArrival ?? null, input.aircraftType ?? null,
        input.aircraftReg ?? null, input.cabin ?? null, input.seat ?? null, distance ?? null,
        duration ?? null, input.tripId ?? null, input.note ?? null, input.source ?? null,
        input.raw ? JSON.stringify(input.raw) : null, now, now);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return id;
}

export function deleteFlight(id: string) {
  getDatabase().prepare('DELETE FROM flights WHERE id=?').run(id);
}

function rowToKbNote(row: Row): KbNote {
  return {
    id: String(row.id), title: String(row.title), summary: String(row.summary),
    category: String(row.category), tags: JSON.parse(String(row.tags)), body: String(row.body),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    draft: Boolean(row.draft), featured: Boolean(row.featured), strict: Boolean(row.strict),
  };
}

export function listKbNotes(includeDrafts = false): KbNote[] {
  const rows = getDatabase().prepare(`SELECT * FROM kb_notes ${includeDrafts ? '' : 'WHERE draft = 0'}
    ORDER BY updated_at DESC`).all() as Row[];
  return rows.map(rowToKbNote);
}

export function getKbNote(id: string, includeDrafts = false): KbNote | undefined {
  const row = getDatabase().prepare(`SELECT * FROM kb_notes WHERE id = ? ${includeDrafts ? '' : 'AND draft = 0'}`)
    .get(id) as Row | undefined;
  return row ? rowToKbNote(row) : undefined;
}

export interface KbNoteInput {
  title: string; summary: string; category: string; tags?: string[];
  body?: string; draft?: boolean; featured?: boolean; strict?: boolean;
}

export function createKbNote(id: string, input: KbNoteInput) {
  const now = toDate(new Date().toISOString());
  getDatabase().prepare(`INSERT INTO kb_notes
    (id,title,summary,category,tags,body,created_at,updated_at,draft,featured,strict) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, input.title, input.summary, input.category, JSON.stringify(input.tags ?? []), input.body ?? '', now, now,
      input.draft ? 1 : 0, input.featured ? 1 : 0, input.strict ? 1 : 0);
  return id;
}

export function updateKbNote(id: string, input: KbNoteInput) {
  getDatabase().prepare(`UPDATE kb_notes SET title=?,summary=?,category=?,tags=?,body=?,draft=?,featured=?,strict=?,updated_at=? WHERE id=?`)
    .run(input.title, input.summary, input.category, JSON.stringify(input.tags ?? []), input.body ?? '',
      input.draft ? 1 : 0, input.featured ? 1 : 0, input.strict ? 1 : 0, toDate(new Date().toISOString()), id);
}

export function deleteKbNote(id: string) {
  getDatabase().prepare('DELETE FROM kb_notes WHERE id=?').run(id);
}

function rowToPhoto(row: Row): TravelPhoto {
  return {
    id: String(row.id), eventId: String(row.event_id), originalPath: String(row.original_path),
    variants: JSON.parse(String(row.variants)), alt: String(row.alt),
    caption: row.caption ? String(row.caption) : undefined, featured: Boolean(row.featured),
    takenAt: row.taken_at ? String(row.taken_at) : undefined, createdAt: String(row.created_at),
    sortOrder: row.sort_order == null ? null : Number(row.sort_order),
  };
}

function hourFromTakenAt(value: unknown) {
  if (!value) return null;
  const text = String(value);
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    const local = text.match(/[T\s](\d{2}):\d{2}/);
    if (local) return `${local[1]}:00`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone: photoTimeZone, hour: '2-digit', hourCycle: 'h23' }).format(date);
  return `${hour}:00`;
}

function touchTripForEvent(db: DatabaseSync, eventId: string) {
  db.prepare(`UPDATE trips SET updated_at=date('now') WHERE id=(SELECT d.trip_id FROM trip_days d
    JOIN travel_events e ON e.day_id=d.id WHERE e.id=?)`).run(eventId);
}

export function syncEventTimeFromPhotos(eventId: string) {
  const db = getDatabase();
  const event = db.prepare('SELECT time_source FROM travel_events WHERE id=?').get(eventId) as Row | undefined;
  if (!event || String(event.time_source) !== 'photo') return;
  const row = db.prepare('SELECT MIN(taken_at) AS taken_at FROM travel_photos WHERE event_id=? AND taken_at IS NOT NULL')
    .get(eventId) as Row | undefined;
  db.prepare('UPDATE travel_events SET time=? WHERE id=?').run(hourFromTakenAt(row?.taken_at), eventId);
  touchTripForEvent(db, eventId);
}

function syncPhotoTimes(db: DatabaseSync) {
  const rows = db.prepare(`SELECT e.id, e.time, MIN(p.taken_at) AS taken_at
    FROM travel_events e JOIN travel_photos p ON p.event_id=e.id
    WHERE e.time_source='photo' AND p.taken_at IS NOT NULL
    GROUP BY e.id`).all() as Row[];
  const update = db.prepare('UPDATE travel_events SET time=? WHERE id=?');
  db.exec('BEGIN');
  try {
    rows.forEach((row) => {
      const time = hourFromTakenAt(row.taken_at);
      if (time !== row.time) update.run(time, String(row.id));
    });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function rowToEvent(row: Row, photos: TravelPhoto[]): TravelEvent {
  const location = row.location_lat == null ? undefined : {
    lat: Number(row.location_lat), lng: Number(row.location_lng),
    address: row.location_address ? String(row.location_address) : undefined,
  };
  return {
    id: String(row.id), publicId: String(row.public_id), dayId: String(row.day_id),
    type: String(row.type) as EventType, title: String(row.title),
    time: row.time ? String(row.time) : undefined, note: row.note ? String(row.note) : undefined,
    timeSource: row.time_source === 'manual' ? 'manual' : 'photo',
    location, data: JSON.parse(String(row.data)) as TravelEventData,
    sortOrder: Number(row.sort_order), photos: photos.filter((photo) => photo.eventId === row.id),
  };
}

function baseTrip(row: Row): TravelTrip {
  return {
    id: String(row.id), title: String(row.title), destination: String(row.destination),
    status: String(row.status) as TripStatus, startDate: String(row.start_date), endDate: String(row.end_date),
    summary: String(row.summary), pendingItems: JSON.parse(String(row.pending_items)), body: String(row.body),
    updatedAt: String(row.updated_at), draft: Boolean(row.draft), featured: Boolean(row.featured), days: [],
  };
}

export function listTrips(includeDrafts = false): TravelTrip[] {
  const rows = getDatabase().prepare(`SELECT * FROM trips ${includeDrafts ? '' : 'WHERE draft = 0'}
    ORDER BY featured DESC, start_date DESC`).all() as Row[];
  return rows.map(baseTrip);
}

export function getTrip(tripId: string, includeDrafts = false): TravelTrip | undefined {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM trips WHERE id = ? ${includeDrafts ? '' : 'AND draft = 0'}`)
    .get(tripId) as Row | undefined;
  if (!row) return;
  const dayRows = db.prepare('SELECT * FROM trip_days WHERE trip_id = ? ORDER BY sort_order, date').all(tripId) as Row[];
  const eventRows = db.prepare(`SELECT e.* FROM travel_events e JOIN trip_days d ON d.id=e.day_id
    WHERE d.trip_id=? ORDER BY d.sort_order,e.sort_order`).all(tripId) as Row[];
  const photoRows = db.prepare(`SELECT p.* FROM travel_photos p JOIN travel_events e ON e.id=p.event_id
    JOIN trip_days d ON d.id=e.day_id WHERE d.trip_id=? ORDER BY p.sort_order IS NULL, p.sort_order, p.taken_at IS NULL, p.taken_at, p.created_at`).all(tripId) as Row[];
  const photos = photoRows.map(rowToPhoto);
  const events = eventRows.map((event) => rowToEvent(event, photos));
  const days: TravelDay[] = dayRows.map((day) => ({
    id: String(day.id), tripId: String(day.trip_id), date: String(day.date), city: String(day.city),
    title: day.title ? String(day.title) : undefined, summary: day.summary ? String(day.summary) : undefined,
    sortOrder: Number(day.sort_order), events: events.filter((event) => event.dayId === day.id),
  }));
  return { ...baseTrip(row), days };
}

const tripStatuses = new Set<TripStatus>(['upcoming', 'planning', 'archived']);

export interface TripInput {
  id?: string; title: string; destination: string; status: TripStatus;
  startDate: string; endDate: string; summary: string;
  pendingItems?: string[]; body?: string; draft?: boolean; featured?: boolean;
}

export function createTrip(input: TripInput) {
  const db = getDatabase();
  if (!input.id || !tripStatuses.has(input.status)) throw new Error('INVALID_INPUT');
  db.prepare(`INSERT INTO trips
    (id,title,destination,status,start_date,end_date,summary,pending_items,body,updated_at,draft,featured)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    input.id, input.title, input.destination, input.status, toDate(input.startDate), toDate(input.endDate),
    input.summary, JSON.stringify(input.pendingItems ?? []), input.body ?? '', toDate(new Date().toISOString()), input.draft ? 1 : 0, input.featured ? 1 : 0,
  );
  return input.id;
}

export function updateTrip(tripId: string, input: TripInput) {
  if (!tripStatuses.has(input.status)) throw new Error('INVALID_STATUS');
  getDatabase().prepare(`UPDATE trips SET title=?,destination=?,status=?,start_date=?,end_date=?,summary=?,
    pending_items=?,body=?,draft=?,featured=?,updated_at=date('now') WHERE id=?`).run(
    input.title, input.destination, input.status, toDate(input.startDate), toDate(input.endDate),
    input.summary, JSON.stringify(input.pendingItems ?? []), input.body ?? '', input.draft ? 1 : 0, input.featured ? 1 : 0, tripId,
  );
}

export function deleteTrip(tripId: string) {
  getDatabase().prepare('DELETE FROM trips WHERE id=?').run(tripId);
}

export function listTripPhotoIds(tripId: string) {
  const rows = getDatabase().prepare(`SELECT p.id FROM travel_photos p JOIN travel_events e ON e.id=p.event_id
    JOIN trip_days d ON d.id=e.day_id WHERE d.trip_id=?`).all(tripId) as Row[];
  return rows.map((row) => String(row.id));
}

export interface DayInput { date: string; city: string; title?: string; summary?: string }

export function createDay(tripId: string, input: DayInput) {
  const db = getDatabase();
  const dayId = `${tripId}/${toDate(input.date)}`;
  const sortOrder = Number((db.prepare('SELECT COUNT(*) AS count FROM trip_days WHERE trip_id=?').get(tripId) as Row).count);
  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO trip_days (id,trip_id,date,city,title,summary,sort_order) VALUES (?,?,?,?,?,?,?)`)
      .run(dayId, tripId, toDate(input.date), input.city, input.title ?? null, input.summary ?? null, sortOrder);
    db.prepare('UPDATE trips SET updated_at=date(\'now\') WHERE id=?').run(tripId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return dayId;
}

export function updateDay(dayId: string, input: DayInput) {
  const db = getDatabase();
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE trip_days SET date=?,city=?,title=?,summary=? WHERE id=?')
      .run(toDate(input.date), input.city, input.title ?? null, input.summary ?? null, dayId);
    db.prepare(`UPDATE trips SET updated_at=date('now') WHERE id=(SELECT trip_id FROM trip_days WHERE id=?)`).run(dayId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function deleteDay(dayId: string) {
  const db = getDatabase();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM trip_days WHERE id=?').run(dayId);
    db.prepare(`UPDATE trips SET updated_at=date('now') WHERE id=(SELECT trip_id FROM trip_days WHERE id=?)`).run(dayId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function listDayPhotoIds(dayId: string) {
  const rows = getDatabase().prepare(`SELECT p.id FROM travel_photos p JOIN travel_events e ON e.id=p.event_id
    WHERE e.day_id=?`).all(dayId) as Row[];
  return rows.map((row) => String(row.id));
}

export function reorderDays(tripId: string, dayIds: string[]) {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE trip_days SET sort_order=? WHERE id=? AND trip_id=?');
  db.exec('BEGIN');
  try {
    dayIds.forEach((id, index) => stmt.run(index, id, tripId));
    db.prepare('UPDATE trips SET updated_at=date(\'now\') WHERE id=?').run(tripId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export interface EventInput {
  dayId: string;
  afterEventId?: string;
  type: EventType;
  title: string;
  time?: string;
  timeSource?: 'photo' | 'manual';
  note?: string;
  location?: { lat: number; lng: number; address?: string };
  data?: TravelEventData;
}

export function createEvent(input: EventInput) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM travel_events WHERE day_id=? ORDER BY sort_order').all(input.dayId) as Row[];
  let position = existing.length;
  if (input.afterEventId === '__start__') position = 0;
  else if (input.afterEventId) {
    const index = existing.findIndex((row) => row.id === input.afterEventId);
    if (index >= 0) position = index + 1;
  }
  const id = randomUUID();
  const publicId = `${input.type}-${id.slice(0, 8)}`;
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE travel_events SET sort_order=sort_order+1 WHERE day_id=? AND sort_order>=?').run(input.dayId, position);
    const timeSource = input.timeSource ?? (input.time ? 'manual' : 'photo');
    db.prepare(`INSERT INTO travel_events
      (id,public_id,day_id,type,title,time,time_source,note,location_lat,location_lng,location_address,data,sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, publicId, input.dayId, input.type, input.title,
      timeSource === 'manual' ? input.time ?? null : null, timeSource, input.note ?? null, input.location?.lat ?? null, input.location?.lng ?? null,
      input.location?.address ?? null, JSON.stringify(input.data ?? {}), position);
    db.prepare(`UPDATE trips SET updated_at=date('now') WHERE id=(SELECT trip_id FROM trip_days WHERE id=?)`).run(input.dayId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return id;
}

export function updateEvent(eventId: string, input: Omit<EventInput, 'dayId' | 'afterEventId'>) {
  const db = getDatabase();
  const timeSource = input.timeSource ?? (input.time ? 'manual' : 'photo');
  db.prepare(`UPDATE travel_events SET type=?,title=?,time=?,time_source=?,note=?,location_lat=?,location_lng=?,location_address=?,data=? WHERE id=?`)
    .run(input.type, input.title, timeSource === 'manual' ? input.time ?? null : null, timeSource, input.note ?? null, input.location?.lat ?? null,
      input.location?.lng ?? null, input.location?.address ?? null, JSON.stringify(input.data ?? {}), eventId);
  if (timeSource === 'photo') syncEventTimeFromPhotos(eventId);
  else touchTripForEvent(db, eventId);
}

export function deleteEvent(eventId: string) {
  const db = getDatabase();
  const row = db.prepare('SELECT day_id,sort_order FROM travel_events WHERE id=?').get(eventId) as
    { day_id: string; sort_order: number } | undefined;
  if (!row) return;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM travel_events WHERE id=?').run(eventId);
    db.prepare('UPDATE travel_events SET sort_order=sort_order-1 WHERE day_id=? AND sort_order>?')
      .run(row.day_id, row.sort_order);
    db.prepare(`UPDATE trips SET updated_at=date('now') WHERE id=(SELECT trip_id FROM trip_days WHERE id=?)`).run(row.day_id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function addPhotoRecord(photo: Omit<TravelPhoto, 'createdAt'>) {
  getDatabase().prepare(`INSERT INTO travel_photos
    (id,event_id,original_path,variants,alt,caption,featured,taken_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(photo.id, photo.eventId, photo.originalPath, JSON.stringify(photo.variants), photo.alt,
      photo.caption ?? null, photo.featured ? 1 : 0, photo.takenAt ?? null, new Date().toISOString());
  syncEventTimeFromPhotos(photo.eventId);
}

export function reorderEventPhotos(eventId: string, photoIds: string[]) {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE travel_photos SET sort_order=? WHERE id=? AND event_id=?');
  db.exec('BEGIN');
  try {
    photoIds.forEach((id, index) => stmt.run(index + 1, id, eventId));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function getEventContext(eventId: string) {
  return getDatabase().prepare(`SELECT e.id,e.public_id,e.day_id,d.trip_id
    FROM travel_events e JOIN trip_days d ON d.id=e.day_id WHERE e.id=?`).get(eventId) as
    { id: string; public_id: string; day_id: string; trip_id: string } | undefined;
}

export function getPhoto(photoId: string) {
  const row = getDatabase().prepare('SELECT * FROM travel_photos WHERE id=?').get(photoId) as Row | undefined;
  return row ? rowToPhoto(row) : undefined;
}

export function listEventPhotos(eventId: string) {
  return (getDatabase().prepare('SELECT * FROM travel_photos WHERE event_id=? ORDER BY sort_order IS NULL, sort_order, taken_at IS NULL, taken_at, created_at').all(eventId) as Row[]).map(rowToPhoto);
}

export function deletePhotoRecord(photoId: string) {
  const db = getDatabase();
  const photo = db.prepare('SELECT event_id FROM travel_photos WHERE id=?').get(photoId) as Row | undefined;
  db.prepare('DELETE FROM travel_photos WHERE id=?').run(photoId);
  if (photo) syncEventTimeFromPhotos(String(photo.event_id));
}
