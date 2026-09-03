import { env } from 'cloudflare:workers';
import { fallbackAirport } from './airports';
import type {
  Airport,
  CityPlaceType,
  CityPhoto,
  CityPlace,
  CitySlug,
  CityVisitStatus,
  EventType,
  Flight,
  KbNote,
  TravelDay,
  TravelEvent,
  TravelEventData,
  TravelPhoto,
  TravelTrip,
  TripStatus,
} from './types';

type Row = Record<string, unknown>;
type Bindings = { DB: D1Database; APP_TIME_ZONE?: string };
type DatabaseValue = string | number | ArrayBuffer | null;

function database() {
  return (env as unknown as Bindings).DB;
}

function statement(sql: string, args: unknown[] = []) {
  const prepared = database().prepare(sql);
  return args.length ? prepared.bind(...args as DatabaseValue[]) : prepared;
}

async function all<T extends Row = Row>(sql: string, args: unknown[] = []) {
  const result = await statement(sql, args).all<T>();
  return result.results ?? [];
}

async function first<T extends Row = Row>(sql: string, args: unknown[] = []) {
  return await statement(sql, args).first<T>() ?? undefined;
}

async function run(sql: string, args: unknown[] = []) {
  return statement(sql, args).run();
}

function prepared(sql: string, args: unknown[] = []) {
  const query = database().prepare(sql);
  return args.length ? query.bind(...args as DatabaseValue[]) : query;
}

function toDate(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function rowToAirport(row: Row): Airport {
  return {
    code: String(row.code),
    icao: row.icao ? String(row.icao) : undefined,
    name: String(row.name),
    city: String(row.city),
    country: String(row.country),
    lat: Number(row.lat),
    lng: Number(row.lng),
    timezone: row.timezone ? String(row.timezone) : undefined,
  };
}

function airportStatement(airport: Airport) {
  return prepared(
    `INSERT INTO airports (code,icao,name,city,country,lat,lng,timezone)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(code) DO UPDATE SET icao=excluded.icao,name=excluded.name,city=excluded.city,
       country=excluded.country,lat=excluded.lat,lng=excluded.lng,timezone=excluded.timezone`,
    [
      airport.code,
      airport.icao ?? null,
      airport.name,
      airport.city,
      airport.country,
      airport.lat,
      airport.lng,
      airport.timezone ?? null,
    ],
  );
}

function rowToFlight(row: Row): Flight {
  return {
    id: String(row.id),
    date: String(row.date),
    datePrecision: row.date_precision === 'unknown' ? 'unknown' : row.date_precision === 'month' ? 'month' : 'day',
    flightNumber: String(row.flight_number),
    airlineCode: row.airline_code ? String(row.airline_code) : undefined,
    airlineName: row.airline_name ? String(row.airline_name) : undefined,
    fromAirport: {
      code: String(row.from_code),
      icao: row.from_icao ? String(row.from_icao) : undefined,
      name: String(row.from_name),
      city: String(row.from_city),
      country: String(row.from_country),
      lat: Number(row.from_lat),
      lng: Number(row.from_lng),
      timezone: row.from_timezone ? String(row.from_timezone) : undefined,
    },
    toAirport: {
      code: String(row.to_code),
      icao: row.to_icao ? String(row.to_icao) : undefined,
      name: String(row.to_name),
      city: String(row.to_city),
      country: String(row.to_country),
      lat: Number(row.to_lat),
      lng: Number(row.to_lng),
      timezone: row.to_timezone ? String(row.to_timezone) : undefined,
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const flightSelect = `SELECT f.*,
  fa.code from_code,fa.icao from_icao,fa.name from_name,fa.city from_city,fa.country from_country,fa.lat from_lat,fa.lng from_lng,fa.timezone from_timezone,
  ta.code to_code,ta.icao to_icao,ta.name to_name,ta.city to_city,ta.country to_country,ta.lat to_lat,ta.lng to_lng,ta.timezone to_timezone
  FROM flights f JOIN airports fa ON fa.code=f.from_airport JOIN airports ta ON ta.code=f.to_airport`;

export type FlightInput = Omit<Flight, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export async function listFlights() {
  return (await all(`${flightSelect}
    ORDER BY CASE WHEN f.date_precision='unknown' THEN 1 ELSE 0 END,
      f.date DESC, f.scheduled_departure DESC, f.flight_number, f.id`)).map(rowToFlight);
}

export async function getFlight(id: string) {
  const row = await first(`${flightSelect} WHERE f.id=?`, [id]);
  return row ? rowToFlight(row) : undefined;
}

export async function listAirports() {
  return (await all('SELECT * FROM airports ORDER BY code')).map(rowToAirport);
}

export async function getAirport(code: string) {
  const row = await first('SELECT * FROM airports WHERE code=?', [code.trim().toUpperCase()]);
  return row ? rowToAirport(row) : undefined;
}

export async function searchAirports(query: string) {
  const normalized = query.trim().toUpperCase();
  const q = `%${normalized}%`;
  return (await all(
    `SELECT * FROM airports
     WHERE upper(code) LIKE ? OR upper(coalesce(icao,'')) LIKE ? OR upper(name) LIKE ? OR upper(city) LIKE ? OR upper(country) LIKE ?
     ORDER BY CASE WHEN upper(code)=upper(?) THEN 0 WHEN upper(code) LIKE upper(?) THEN 1 ELSE 2 END, code
     LIMIT 12`,
    [q, q, q, q, q, normalized, `${normalized}%`],
  )).map(rowToAirport);
}

export async function upsertAirport(airport: Airport) {
  const code = airport.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(code)) throw new Error('INVALID_AIRPORT_CODE');
  await airportStatement({ ...airport, code }).run();
  return code;
}

export async function deleteAirport(code: string) {
  const normalized = code.trim().toUpperCase();
  const usage = await first('SELECT COUNT(*) AS count FROM flights WHERE from_airport=? OR to_airport=?', [normalized, normalized]);
  if (Number(usage?.count) > 0) throw new Error('AIRPORT_IN_USE');
  await run('DELETE FROM airports WHERE code=?', [normalized]);
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

export async function upsertFlight(input: FlightInput) {
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const from = input.fromAirport.code ? input.fromAirport : fallbackAirport(input.fromAirport.code);
  const to = input.toAirport.code ? input.toAirport : fallbackAirport(input.toAirport.code);
  const distance = input.distanceKm ?? flightDistanceKm(from, to);
  const duration = input.durationMinutes
    ?? flightDurationMinutes(input.actualDeparture ?? input.scheduledDeparture, input.actualArrival ?? input.scheduledArrival);
  await database().batch([
    airportStatement(from),
    airportStatement(to),
    prepared(
      `INSERT INTO flights
       (id,date,date_precision,flight_number,airline_code,airline_name,from_airport,to_airport,scheduled_departure,
        scheduled_arrival,actual_departure,actual_arrival,aircraft_type,aircraft_reg,cabin,seat,
        distance_km,duration_minutes,trip_id,note,source,raw,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET date=excluded.date,date_precision=excluded.date_precision,flight_number=excluded.flight_number,
        airline_code=excluded.airline_code,airline_name=excluded.airline_name,from_airport=excluded.from_airport,
        to_airport=excluded.to_airport,scheduled_departure=excluded.scheduled_departure,
        scheduled_arrival=excluded.scheduled_arrival,actual_departure=excluded.actual_departure,
        actual_arrival=excluded.actual_arrival,aircraft_type=excluded.aircraft_type,
        aircraft_reg=excluded.aircraft_reg,cabin=excluded.cabin,seat=excluded.seat,
        distance_km=excluded.distance_km,duration_minutes=excluded.duration_minutes,
        trip_id=excluded.trip_id,note=excluded.note,source=excluded.source,raw=excluded.raw,
        updated_at=excluded.updated_at`,
      [
        id, input.date, input.datePrecision ?? 'day', input.flightNumber,
        input.airlineCode ?? null, input.airlineName ?? null, from.code, to.code,
        input.scheduledDeparture ?? null, input.scheduledArrival ?? null,
        input.actualDeparture ?? null, input.actualArrival ?? null,
        input.aircraftType ?? null, input.aircraftReg ?? null, input.cabin ?? null,
        input.seat ?? null, distance ?? null, duration ?? null, input.tripId ?? null,
        input.note ?? null, input.source ?? null, input.raw ? JSON.stringify(input.raw) : null,
        now, now,
      ],
    ),
  ]);
  return id;
}

export async function deleteFlight(id: string) {
  await run('DELETE FROM flights WHERE id=?', [id]);
}

function rowToKbNote(row: Row): KbNote {
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary),
    category: String(row.category),
    tags: JSON.parse(String(row.tags)),
    body: String(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    draft: Boolean(row.draft),
    featured: Boolean(row.featured),
    strict: Boolean(row.strict),
  };
}

export async function listKbNotes(includeDrafts = false): Promise<KbNote[]> {
  const rows = await all(`SELECT * FROM kb_notes ${includeDrafts ? '' : 'WHERE draft = 0'} ORDER BY created_at DESC, updated_at DESC, id`);
  return rows.map(rowToKbNote);
}

export async function getKbNote(id: string, includeDrafts = false): Promise<KbNote | undefined> {
  const row = await first(`SELECT * FROM kb_notes WHERE id = ? ${includeDrafts ? '' : 'AND draft = 0'}`, [id]);
  return row ? rowToKbNote(row) : undefined;
}

export interface KbNoteInput {
  title: string;
  summary: string;
  category: string;
  tags?: string[];
  body?: string;
  draft?: boolean;
  featured?: boolean;
  strict?: boolean;
}

export async function createKbNote(id: string, input: KbNoteInput) {
  const now = toDate(new Date());
  await run(
    `INSERT INTO kb_notes
     (id,title,summary,category,tags,body,created_at,updated_at,draft,featured,strict)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, input.title, input.summary, input.category, JSON.stringify(input.tags ?? []),
      input.body ?? '', now, now, input.draft ? 1 : 0, input.featured ? 1 : 0,
      input.strict ? 1 : 0,
    ],
  );
  return id;
}

export async function updateKbNote(id: string, input: KbNoteInput) {
  await run(
    `UPDATE kb_notes SET title=?,summary=?,category=?,tags=?,body=?,draft=?,featured=?,strict=?,updated_at=? WHERE id=?`,
    [
      input.title, input.summary, input.category, JSON.stringify(input.tags ?? []), input.body ?? '',
      input.draft ? 1 : 0, input.featured ? 1 : 0, input.strict ? 1 : 0, toDate(new Date()), id,
    ],
  );
}

export async function deleteKbNote(id: string) {
  await run('DELETE FROM kb_notes WHERE id=?', [id]);
}

function rowToPhoto(row: Row): TravelPhoto {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    originalPath: String(row.original_path),
    variants: JSON.parse(String(row.variants)),
    alt: String(row.alt),
    caption: row.caption ? String(row.caption) : undefined,
    featured: Boolean(row.featured),
    takenAt: row.taken_at ? String(row.taken_at) : undefined,
    createdAt: String(row.created_at),
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
  const timeZone = (env as unknown as Bindings).APP_TIME_ZONE ?? 'Asia/Hong_Kong';
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${hour}:00`;
}

async function touchTripForEvent(eventId: string) {
  await run(
    `UPDATE trips SET updated_at=date('now') WHERE id=(
       SELECT d.trip_id FROM trip_days d JOIN travel_events e ON e.day_id=d.id WHERE e.id=?
     )`,
    [eventId],
  );
}

export async function syncEventTimeFromPhotos(eventId: string) {
  const event = await first('SELECT time_source FROM travel_events WHERE id=?', [eventId]);
  if (!event || String(event.time_source) !== 'photo') return;
  const row = await first(
    'SELECT MIN(taken_at) AS taken_at FROM travel_photos WHERE event_id=? AND taken_at IS NOT NULL',
    [eventId],
  );
  await database().batch([
    prepared('UPDATE travel_events SET time=? WHERE id=?', [hourFromTakenAt(row?.taken_at), eventId]),
    prepared(
      `UPDATE trips SET updated_at=date('now') WHERE id=(
         SELECT d.trip_id FROM trip_days d JOIN travel_events e ON e.day_id=d.id WHERE e.id=?
       )`,
      [eventId],
    ),
  ]);
}

function rowToEvent(row: Row, photos: TravelPhoto[]): TravelEvent {
  const location = row.location_lat == null ? undefined : {
    lat: Number(row.location_lat),
    lng: Number(row.location_lng),
    address: row.location_address ? String(row.location_address) : undefined,
  };
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    dayId: String(row.day_id),
    type: String(row.type) as EventType,
    title: String(row.title),
    time: row.time ? String(row.time) : undefined,
    note: row.note ? String(row.note) : undefined,
    timeSource: row.time_source === 'manual' ? 'manual' : 'photo',
    location,
    data: JSON.parse(String(row.data)) as TravelEventData,
    sortOrder: Number(row.sort_order),
    photos: photos.filter((photo) => photo.eventId === row.id),
  };
}

function baseTrip(row: Row): TravelTrip {
  return {
    id: String(row.id),
    title: String(row.title),
    destination: String(row.destination),
    status: String(row.status) as TripStatus,
    startDate: row.start_date ? String(row.start_date) : undefined,
    endDate: row.end_date ? String(row.end_date) : undefined,
    datesTbd: Boolean(row.dates_tbd),
    summary: String(row.summary),
    pendingItems: JSON.parse(String(row.pending_items)),
    body: String(row.body),
    updatedAt: String(row.updated_at),
    draft: Boolean(row.draft),
    featured: Boolean(row.featured),
    days: [],
    previewPhotos: [],
  };
}

export async function listTrips(includeDrafts = false): Promise<TravelTrip[]> {
  const [rows, previewRows] = await Promise.all([
    all(
      `SELECT * FROM trips ${includeDrafts ? '' : 'WHERE draft = 0'}
       ORDER BY CASE status WHEN 'upcoming' THEN 0 WHEN 'planning' THEN 1 ELSE 2 END,
         featured DESC,
         CASE WHEN status = 'upcoming' AND start_date IS NULL THEN 1 ELSE 0 END,
         CASE WHEN status = 'upcoming' THEN start_date END ASC,
         CASE WHEN status != 'upcoming' THEN start_date END DESC,
         dates_tbd DESC, updated_at DESC`,
    ),
    all(
      `SELECT * FROM (
         SELECT p.*, d.trip_id AS preview_trip_id,
           ROW_NUMBER() OVER (
             PARTITION BY d.trip_id
             ORDER BY p.featured DESC, p.sort_order IS NULL, p.sort_order,
               p.taken_at IS NULL, p.taken_at, p.created_at
           ) AS preview_rank
         FROM travel_photos p
         JOIN travel_events e ON e.id = p.event_id
         JOIN trip_days d ON d.id = e.day_id
         JOIN trips t ON t.id = d.trip_id
         ${includeDrafts ? '' : 'WHERE t.draft = 0'}
       ) WHERE preview_rank <= 8
       ORDER BY preview_trip_id, preview_rank`,
    ),
  ]);
  const previewPhotos = previewRows.map((row) => ({ tripId: String(row.preview_trip_id), photo: rowToPhoto(row) }));
  return rows.map((row) => {
    const trip = baseTrip(row);
    trip.previewPhotos = previewPhotos.filter(({ tripId }) => tripId === trip.id).map(({ photo }) => photo);
    return trip;
  });
}

export async function getTrip(tripId: string, includeDrafts = false): Promise<TravelTrip | undefined> {
  const [row, dayRows, eventRows, photoRows] = await Promise.all([
    first(`SELECT * FROM trips WHERE id = ? ${includeDrafts ? '' : 'AND draft = 0'}`, [tripId]),
    all('SELECT * FROM trip_days WHERE trip_id = ? ORDER BY sort_order, date', [tripId]),
    all(
      `SELECT e.* FROM travel_events e JOIN trip_days d ON d.id=e.day_id
       WHERE d.trip_id=? ORDER BY d.sort_order,e.sort_order`,
      [tripId],
    ),
    all(
      `SELECT p.* FROM travel_photos p JOIN travel_events e ON e.id=p.event_id
       JOIN trip_days d ON d.id=e.day_id WHERE d.trip_id=?
       ORDER BY p.sort_order IS NULL, p.sort_order, p.taken_at IS NULL, p.taken_at, p.created_at`,
      [tripId],
    ),
  ]);
  if (!row) return;
  const photos = photoRows.map(rowToPhoto);
  const events = eventRows.map((event) => rowToEvent(event, photos));
  const days: TravelDay[] = dayRows.map((day) => ({
    id: String(day.id),
    tripId: String(day.trip_id),
    date: day.date ? String(day.date) : undefined,
    city: String(day.city),
    title: day.title ? String(day.title) : undefined,
    summary: day.summary ? String(day.summary) : undefined,
    sortOrder: Number(day.sort_order),
    events: events.filter((event) => event.dayId === day.id),
  }));
  return { ...baseTrip(row), days };
}

const tripStatuses = new Set<TripStatus>(['upcoming', 'planning', 'archived']);

export interface TripInput {
  id?: string;
  title: string;
  destination: string;
  status: TripStatus;
  startDate?: string;
  endDate?: string;
  datesTbd?: boolean;
  summary: string;
  pendingItems?: string[];
  body?: string;
  draft?: boolean;
  featured?: boolean;
}

export async function createTrip(input: TripInput) {
  if (!input.id || !tripStatuses.has(input.status)) throw new Error('INVALID_INPUT');
  await run(
    `INSERT INTO trips
     (id,title,destination,status,start_date,end_date,summary,pending_items,body,updated_at,draft,featured,dates_tbd)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.id, input.title, input.destination, input.status,
      input.datesTbd ? '' : toDate(input.startDate),
      input.datesTbd ? '' : toDate(input.endDate),
      input.summary, JSON.stringify(input.pendingItems ?? []), input.body ?? '',
      toDate(new Date()), input.draft ? 1 : 0, input.featured ? 1 : 0, input.datesTbd ? 1 : 0,
    ],
  );
  return input.id;
}

export async function updateTrip(tripId: string, input: TripInput) {
  if (!tripStatuses.has(input.status)) throw new Error('INVALID_STATUS');
  await run(
    `UPDATE trips SET title=?,destination=?,status=?,start_date=?,end_date=?,dates_tbd=?,summary=?,
     pending_items=?,body=?,draft=?,featured=?,updated_at=date('now') WHERE id=?`,
    [
      input.title, input.destination, input.status,
      input.datesTbd ? '' : toDate(input.startDate),
      input.datesTbd ? '' : toDate(input.endDate),
      input.datesTbd ? 1 : 0, input.summary, JSON.stringify(input.pendingItems ?? []),
      input.body ?? '', input.draft ? 1 : 0, input.featured ? 1 : 0, tripId,
    ],
  );
}

export async function deleteTrip(tripId: string) {
  await run('DELETE FROM trips WHERE id=?', [tripId]);
}

export async function listTripPhotoIds(tripId: string) {
  const rows = await all(
    `SELECT p.id FROM travel_photos p JOIN travel_events e ON e.id=p.event_id
     JOIN trip_days d ON d.id=e.day_id WHERE d.trip_id=?`,
    [tripId],
  );
  return rows.map((row) => String(row.id));
}

export interface DayInput {
  date?: string;
  city: string;
  title?: string;
  summary?: string;
}

export async function createDay(tripId: string, input: DayInput) {
  const normalizedDate = input.date ? toDate(input.date) : '';
  const dayId = normalizedDate ? `${tripId}/${normalizedDate}` : `${tripId}/day-${crypto.randomUUID().slice(0, 8)}`;
  const count = await first('SELECT COUNT(*) AS count FROM trip_days WHERE trip_id=?', [tripId]);
  await database().batch([
    prepared(
      'INSERT INTO trip_days (id,trip_id,date,city,title,summary,sort_order) VALUES (?,?,?,?,?,?,?)',
      [dayId, tripId, normalizedDate, input.city, input.title ?? null, input.summary ?? null, Number(count?.count)],
    ),
    prepared("UPDATE trips SET updated_at=date('now') WHERE id=?", [tripId]),
  ]);
  return dayId;
}

export async function updateDay(dayId: string, input: DayInput) {
  await database().batch([
    prepared(
      'UPDATE trip_days SET date=?,city=?,title=?,summary=? WHERE id=?',
      [input.date ? toDate(input.date) : '', input.city, input.title ?? null, input.summary ?? null, dayId],
    ),
    prepared(
      `UPDATE trips SET updated_at=date('now') WHERE id=(SELECT trip_id FROM trip_days WHERE id=?)`,
      [dayId],
    ),
  ]);
}

export async function deleteDay(dayId: string) {
  const day = await first('SELECT trip_id FROM trip_days WHERE id=?', [dayId]);
  if (!day) return;
  await database().batch([
    prepared('DELETE FROM trip_days WHERE id=?', [dayId]),
    prepared("UPDATE trips SET updated_at=date('now') WHERE id=?", [String(day.trip_id)]),
  ]);
}

export async function listDayPhotoIds(dayId: string) {
  const rows = await all(
    `SELECT p.id FROM travel_photos p JOIN travel_events e ON e.id=p.event_id WHERE e.day_id=?`,
    [dayId],
  );
  return rows.map((row) => String(row.id));
}

export async function reorderDays(tripId: string, dayIds: string[]) {
  await database().batch([
    ...dayIds.map((id, index) => prepared(
      'UPDATE trip_days SET sort_order=? WHERE id=? AND trip_id=?',
      [index, id, tripId],
    )),
    prepared("UPDATE trips SET updated_at=date('now') WHERE id=?", [tripId]),
  ]);
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

export async function createEvent(input: EventInput) {
  const existing = await all('SELECT id FROM travel_events WHERE day_id=? ORDER BY sort_order', [input.dayId]);
  let position = existing.length;
  if (input.afterEventId === '__start__') position = 0;
  else if (input.afterEventId) {
    const index = existing.findIndex((row) => row.id === input.afterEventId);
    if (index >= 0) position = index + 1;
  }
  const id = crypto.randomUUID();
  const publicId = `${input.type}-${id.slice(0, 8)}`;
  const timeSource = input.timeSource ?? (input.time ? 'manual' : 'photo');
  await database().batch([
    prepared(
      'UPDATE travel_events SET sort_order=sort_order+1 WHERE day_id=? AND sort_order>=?',
      [input.dayId, position],
    ),
    prepared(
      `INSERT INTO travel_events
       (id,public_id,day_id,type,title,time,time_source,note,location_lat,location_lng,location_address,data,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, publicId, input.dayId, input.type, input.title,
        timeSource === 'manual' ? input.time ?? null : null, timeSource, input.note ?? null,
        input.location?.lat ?? null, input.location?.lng ?? null, input.location?.address ?? null,
        JSON.stringify(input.data ?? {}), position,
      ],
    ),
    prepared(
      `UPDATE trips SET updated_at=date('now') WHERE id=(SELECT trip_id FROM trip_days WHERE id=?)`,
      [input.dayId],
    ),
  ]);
  return id;
}

export async function updateEvent(eventId: string, input: Omit<EventInput, 'dayId' | 'afterEventId'>) {
  const timeSource = input.timeSource ?? (input.time ? 'manual' : 'photo');
  await run(
    `UPDATE travel_events SET type=?,title=?,time=?,time_source=?,note=?,location_lat=?,location_lng=?,location_address=?,data=? WHERE id=?`,
    [
      input.type, input.title, timeSource === 'manual' ? input.time ?? null : null,
      timeSource, input.note ?? null, input.location?.lat ?? null, input.location?.lng ?? null,
      input.location?.address ?? null, JSON.stringify(input.data ?? {}), eventId,
    ],
  );
  if (timeSource === 'photo') await syncEventTimeFromPhotos(eventId);
  else await touchTripForEvent(eventId);
}

export async function deleteEvent(eventId: string) {
  const row = await first<{ day_id: string; sort_order: number }>(
    'SELECT day_id,sort_order FROM travel_events WHERE id=?',
    [eventId],
  );
  if (!row) return;
  await database().batch([
    prepared('DELETE FROM travel_events WHERE id=?', [eventId]),
    prepared(
      'UPDATE travel_events SET sort_order=sort_order-1 WHERE day_id=? AND sort_order>?',
      [row.day_id, row.sort_order],
    ),
    prepared(
      `UPDATE trips SET updated_at=date('now') WHERE id=(SELECT trip_id FROM trip_days WHERE id=?)`,
      [row.day_id],
    ),
  ]);
}

export async function addPhotoRecord(photo: Omit<TravelPhoto, 'createdAt'>) {
  await run(
    `INSERT INTO travel_photos
     (id,event_id,original_path,variants,alt,caption,featured,taken_at,created_at,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      photo.id, photo.eventId, photo.originalPath, JSON.stringify(photo.variants), photo.alt,
      photo.caption ?? null, photo.featured ? 1 : 0, photo.takenAt ?? null,
      new Date().toISOString(), photo.sortOrder ?? null,
    ],
  );
  await syncEventTimeFromPhotos(photo.eventId);
}

export async function reorderEventPhotos(eventId: string, photoIds: string[]) {
  if (!photoIds.length) return;
  await database().batch(photoIds.map((id, index) => prepared(
    'UPDATE travel_photos SET sort_order=? WHERE id=? AND event_id=?',
    [index + 1, id, eventId],
  )));
}

export async function getEventContext(eventId: string) {
  return first<{ id: string; public_id: string; day_id: string; trip_id: string }>(
    `SELECT e.id,e.public_id,e.day_id,d.trip_id
     FROM travel_events e JOIN trip_days d ON d.id=e.day_id WHERE e.id=?`,
    [eventId],
  );
}

export async function getPhoto(photoId: string) {
  const row = await first('SELECT * FROM travel_photos WHERE id=?', [photoId]);
  return row ? rowToPhoto(row) : undefined;
}

export async function listEventPhotos(eventId: string) {
  return (await all(
    `SELECT * FROM travel_photos WHERE event_id=?
     ORDER BY sort_order IS NULL, sort_order, taken_at IS NULL, taken_at, created_at`,
    [eventId],
  )).map(rowToPhoto);
}

export async function deletePhotoRecord(photoId: string) {
  const photo = await first('SELECT event_id FROM travel_photos WHERE id=?', [photoId]);
  await run('DELETE FROM travel_photos WHERE id=?', [photoId]);
  if (photo) await syncEventTimeFromPhotos(String(photo.event_id));
}

function rowToCityPhoto(row: Row): CityPhoto {
  return {
    id: String(row.id),
    placeId: String(row.place_id),
    originalPath: String(row.original_path),
    variants: JSON.parse(String(row.variants)),
    alt: String(row.alt),
    caption: row.caption ? String(row.caption) : undefined,
    featured: Boolean(row.featured),
    createdAt: String(row.created_at),
    sortOrder: row.sort_order == null ? null : Number(row.sort_order),
  };
}

function rowToCityPlace(row: Row, photos: CityPhoto[]): CityPlace {
  return {
    id: String(row.id),
    city: String(row.city) as CitySlug,
    name: String(row.name),
    type: String(row.type) as CityPlaceType,
    district: row.district ? String(row.district) : undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
    note: row.note ? String(row.note) : undefined,
    visitStatus: row.visit_status === 'visited' ? 'visited' : 'want',
    favorite: Boolean(row.favorite),
    recommendation: row.recommendation ? String(row.recommendation) : undefined,
    address: row.address ? String(row.address) : undefined,
    tags: row.tags ? JSON.parse(String(row.tags)) : [],
    rating: row.rating == null ? undefined : Number(row.rating),
    lastVisitedAt: row.last_visited_at ? String(row.last_visited_at) : undefined,
    relatedTrip: row.trip_id && row.trip_title ? { id: String(row.trip_id), title: String(row.trip_title) } : undefined,
    sortOrder: Number(row.sort_order),
    draft: Boolean(row.draft),
    updatedAt: String(row.updated_at),
    photos: photos.filter((photo) => photo.placeId === row.id),
  };
}

export async function listCityPlaces(includeDrafts = false): Promise<CityPlace[]> {
  const [rows, photoRows] = await Promise.all([
    all(`SELECT c.*,t.title AS trip_title FROM city_places c LEFT JOIN trips t ON t.id=c.trip_id
      ${includeDrafts ? '' : 'WHERE c.draft=0'} ORDER BY c.city,c.favorite DESC,c.sort_order,c.name`),
    all(
      `SELECT p.* FROM city_photos p JOIN city_places c ON c.id=p.place_id
       ${includeDrafts ? '' : 'WHERE c.draft=0'}
       ORDER BY p.featured DESC,p.sort_order IS NULL,p.sort_order,p.created_at`,
    ),
  ]);
  const photos = photoRows.map(rowToCityPhoto);
  return rows.map((row) => rowToCityPlace(row, photos));
}

export async function getCityPlace(id: string, includeDrafts = false): Promise<CityPlace | undefined> {
  const [row, photoRows] = await Promise.all([
    first(`SELECT c.*,t.title AS trip_title FROM city_places c LEFT JOIN trips t ON t.id=c.trip_id
      WHERE c.id=? ${includeDrafts ? '' : 'AND c.draft=0'}`, [id]),
    all(
      `SELECT * FROM city_photos WHERE place_id=?
       ORDER BY featured DESC,sort_order IS NULL,sort_order,created_at`,
      [id],
    ),
  ]);
  return row ? rowToCityPlace(row, photoRows.map(rowToCityPhoto)) : undefined;
}

export async function getCityPlaceByRoute(city: string, id: string, includeDrafts = false) {
  const place = await getCityPlace(id, includeDrafts);
  return place?.city === city ? place : undefined;
}

export interface CityPlaceInput {
  id?: string;
  city: CitySlug;
  name: string;
  type: CityPlaceType;
  district?: string;
  lat: number;
  lng: number;
  note?: string;
  visitStatus?: CityVisitStatus;
  favorite?: boolean;
  recommendation?: string;
  address?: string;
  tags?: string[];
  rating?: number;
  lastVisitedAt?: string;
  tripId?: string;
  draft?: boolean;
}

export async function createCityPlace(input: CityPlaceInput) {
  if (!input.id) throw new Error('INVALID_INPUT');
  const count = await first('SELECT COUNT(*) AS count FROM city_places WHERE city=?', [input.city]);
  await run(
    `INSERT INTO city_places
     (id,city,name,type,district,lat,lng,note,visit_status,favorite,recommendation,address,tags,rating,last_visited_at,trip_id,sort_order,draft,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.id, input.city, input.name, input.type, input.district ?? null,
      input.lat, input.lng, input.note ?? null, input.visitStatus ?? 'want', input.favorite ? 1 : 0,
      input.recommendation ?? null, input.address ?? null, JSON.stringify(input.tags ?? []), input.rating ?? null,
      input.lastVisitedAt ?? null, input.tripId ?? null, Number(count?.count), input.draft ? 1 : 0,
      new Date().toISOString(),
    ],
  );
  return input.id;
}

export async function updateCityPlace(id: string, input: CityPlaceInput) {
  await run(
    `UPDATE city_places SET city=?,name=?,type=?,district=?,lat=?,lng=?,note=?,visit_status=?,favorite=?,
      recommendation=?,address=?,tags=?,rating=?,last_visited_at=?,trip_id=?,draft=?,updated_at=? WHERE id=?`,
    [
      input.city, input.name, input.type, input.district ?? null, input.lat, input.lng,
      input.note ?? null, input.visitStatus ?? 'want', input.favorite ? 1 : 0,
      input.recommendation ?? null, input.address ?? null, JSON.stringify(input.tags ?? []), input.rating ?? null,
      input.lastVisitedAt ?? null, input.tripId ?? null, input.draft ? 1 : 0, new Date().toISOString(), id,
    ],
  );
}

export async function deleteCityPlace(id: string) {
  await run('DELETE FROM city_places WHERE id=?', [id]);
}

export async function listCityPlacePhotoIds(placeId: string) {
  return (await all('SELECT id FROM city_photos WHERE place_id=?', [placeId])).map((row) => String(row.id));
}

export async function addCityPhotoRecord(photo: Omit<CityPhoto, 'createdAt'>) {
  const count = await first('SELECT COUNT(*) AS count FROM city_photos WHERE place_id=?', [photo.placeId]);
  await run(
    `INSERT INTO city_photos
     (id,place_id,original_path,variants,alt,caption,featured,created_at,sort_order)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      photo.id, photo.placeId, photo.originalPath, JSON.stringify(photo.variants), photo.alt,
      photo.caption ?? null, Number(count?.count) === 0 || photo.featured ? 1 : 0,
      new Date().toISOString(), Number(count?.count) + 1,
    ],
  );
}

export async function getCityPlaceContext(placeId: string) {
  return first<{ id: string; city: string; name: string }>(
    'SELECT id,city,name FROM city_places WHERE id=?',
    [placeId],
  );
}

export async function getCityPhoto(photoId: string) {
  const row = await first('SELECT * FROM city_photos WHERE id=?', [photoId]);
  return row ? rowToCityPhoto(row) : undefined;
}

export async function deleteCityPhotoRecord(photoId: string) {
  const photo = await first('SELECT place_id,featured FROM city_photos WHERE id=?', [photoId]);
  if (!photo) return;
  const next = photo.featured
    ? await first(
        `SELECT id FROM city_photos WHERE place_id=? AND id<>?
         ORDER BY sort_order IS NULL,sort_order,created_at LIMIT 1`,
        [String(photo.place_id), photoId],
      )
    : undefined;
  await database().batch([
    prepared('DELETE FROM city_photos WHERE id=?', [photoId]),
    ...(next ? [prepared('UPDATE city_photos SET featured=1 WHERE id=?', [String(next.id)])] : []),
  ]);
}

export async function reorderCityPhotos(placeId: string, photoIds: string[]) {
  if (!photoIds.length) return;
  await database().batch(photoIds.map((id, index) => prepared(
    'UPDATE city_photos SET sort_order=? WHERE id=? AND place_id=?',
    [index + 1, id, placeId],
  )));
}

export async function setCityCoverPhoto(placeId: string, photoId: string) {
  const photo = await first('SELECT id FROM city_photos WHERE id=? AND place_id=?', [photoId, placeId]);
  if (!photo) return false;
  await database().batch([
    prepared('UPDATE city_photos SET featured=0 WHERE place_id=?', [placeId]),
    prepared('UPDATE city_photos SET featured=1 WHERE id=?', [photoId]),
  ]);
  return true;
}
