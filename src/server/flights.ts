import { fallbackAirport, seedAirports } from './airports';
import type { Airport, Flight } from './types';

export interface FlightSearchResult extends Omit<Flight, 'id' | 'createdAt' | 'updatedAt'> {
  providerId: string;
}

const airportIndex = new Map(seedAirports.map((airport) => [airport.code, airport]));

function airport(code: unknown, name?: unknown, city?: unknown, country?: unknown, lat?: unknown, lng?: unknown): Airport {
  const normalized = String(code ?? '').trim().toUpperCase();
  const known = airportIndex.get(normalized);
  if (known) return known;
  return {
    ...fallbackAirport(normalized),
    name: String(name ?? normalized),
    city: String(city ?? normalized),
    country: String(country ?? ''),
    lat: Number(lat ?? 0),
    lng: Number(lng ?? 0),
  };
}

function toDate(value: string) {
  return value.slice(0, 10);
}

function toMinutes(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return undefined;
  return Math.round((to - from) / 60000);
}

function distanceKm(from: Airport, to: Airport) {
  if (!from.lat || !from.lng || !to.lat || !to.lng) return undefined;
  const radius = 6371;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function demoFlights(flightNumber: string, date: string): FlightSearchResult[] {
  const normalized = flightNumber.trim().toUpperCase() || 'CX000';
  const samples = [
    { number: normalized, airlineCode: normalized.slice(0, 2), airlineName: 'Demo Airways', from: 'HKG', to: 'TPE', dep: '08:15', arr: '10:05', aircraft: 'A321neo' },
    { number: normalized, airlineCode: normalized.slice(0, 2), airlineName: 'Demo Airways', from: 'KHH', to: 'HKG', dep: '11:20', arr: '13:05', aircraft: 'A320' },
  ];
  return samples.map((sample, index) => {
    const from = airport(sample.from);
    const to = airport(sample.to);
    const scheduledDeparture = `${date}T${sample.dep}:00+08:00`;
    const scheduledArrival = `${date}T${sample.arr}:00+08:00`;
    return {
      providerId: `demo-${date}-${sample.number}-${index}`,
      date, flightNumber: sample.number, airlineCode: sample.airlineCode, airlineName: sample.airlineName,
      fromAirport: from, toAirport: to, scheduledDeparture, scheduledArrival,
      durationMinutes: toMinutes(scheduledDeparture, scheduledArrival),
      aircraftType: sample.aircraft, distanceKm: distanceKm(from, to), source: 'demo',
      raw: { demo: true },
    };
  });
}

function normalizeAviationstack(item: any, fallbackDate: string): FlightSearchResult | undefined {
  const departure = item.departure ?? {};
  const arrival = item.arrival ?? {};
  const flight = item.flight ?? {};
  const airline = item.airline ?? {};
  const aircraft = item.aircraft ?? {};
  const from = airport(departure.iata, departure.airport, departure.timezone, '', departure.latitude, departure.longitude);
  const to = airport(arrival.iata, arrival.airport, arrival.timezone, '', arrival.latitude, arrival.longitude);
  if (!from.code || !to.code || !flight.iata) return undefined;
  const scheduledDeparture = departure.scheduled ?? undefined;
  const scheduledArrival = arrival.scheduled ?? undefined;
  return {
    providerId: `aviationstack-${item.flight_date ?? fallbackDate}-${flight.iata}-${departure.scheduled ?? ''}`,
    date: toDate(item.flight_date ?? fallbackDate),
    flightNumber: String(flight.iata),
    airlineCode: airline.iata ? String(airline.iata) : undefined,
    airlineName: airline.name ? String(airline.name) : undefined,
    fromAirport: from,
    toAirport: to,
    scheduledDeparture,
    scheduledArrival,
    actualDeparture: departure.actual ?? undefined,
    actualArrival: arrival.actual ?? undefined,
    aircraftType: aircraft.iata ?? undefined,
    aircraftReg: aircraft.registration ?? undefined,
    durationMinutes: toMinutes(scheduledDeparture, scheduledArrival),
    distanceKm: distanceKm(from, to),
    source: 'aviationstack',
    raw: item,
  };
}

export async function searchFlights(flightNumber: string, date: string): Promise<FlightSearchResult[]> {
  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) return demoFlights(flightNumber, date);
  const url = new URL('https://api.aviationstack.com/v1/flights');
  url.searchParams.set('access_key', key);
  url.searchParams.set('flight_iata', flightNumber.trim().toUpperCase());
  url.searchParams.set('flight_date', date);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`FLIGHT_PROVIDER_${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(String(payload.error.code ?? 'FLIGHT_PROVIDER_ERROR'));
  return (payload.data ?? []).map((item: any) => normalizeAviationstack(item, date)).filter(Boolean);
}
