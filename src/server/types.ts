export type TripStatus = 'upcoming' | 'planning' | 'archived';
export type EventType = 'place' | 'transit' | 'meal' | 'stay' | 'note';

export interface Airport {
  code: string;
  icao?: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone?: string;
}

export interface Flight {
  id: string;
  date: string;
  datePrecision?: 'day' | 'month';
  flightNumber: string;
  airlineCode?: string;
  airlineName?: string;
  fromAirport: Airport;
  toAirport: Airport;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  aircraftType?: string;
  aircraftReg?: string;
  cabin?: string;
  seat?: string;
  distanceKm?: number;
  durationMinutes?: number;
  tripId?: string;
  note?: string;
  source?: string;
  raw?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KbNote {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  body: string;
  createdAt: string;
  updatedAt: string;
  draft: boolean;
  featured: boolean;
  strict: boolean;
}

export interface PhotoVariant { width: number; height: number; path: string; size: number }

export type CitySlug = 'hong-kong' | 'singapore';
export type CityPlaceType = '山野自然' | '城市景观' | '建筑街区' | '文化艺术' | '餐饮' | '商店市集';
export type CityVisitStatus = 'want' | 'visited';

export interface CityPhoto {
  id: string;
  placeId: string;
  originalPath: string;
  variants: PhotoVariant[];
  alt: string;
  caption?: string;
  featured: boolean;
  createdAt: string;
  sortOrder?: number | null;
}

export interface CityPlace {
  id: string;
  city: CitySlug;
  name: string;
  type: CityPlaceType;
  district?: string;
  lat: number;
  lng: number;
  note?: string;
  visitStatus: CityVisitStatus;
  favorite: boolean;
  recommendation?: string;
  address?: string;
  tags: string[];
  rating?: number;
  lastVisitedAt?: string;
  relatedTrip?: { id: string; title: string };
  sortOrder: number;
  draft: boolean;
  updatedAt: string;
  photos: CityPhoto[];
}

export interface TravelPhoto {
  id: string;
  eventId: string;
  originalPath: string;
  variants: PhotoVariant[];
  alt: string;
  caption?: string;
  featured: boolean;
  takenAt?: string;
  createdAt: string;
  sortOrder?: number | null;
}

export interface TravelEventData {
  method?: string;
  from?: string;
  to?: string;
  number?: string;
  endLocation?: { lat: number; lng: number; address?: string };
  category?: string;
  mealType?: string;
  dishes?: string[];
  cost?: string;
  rating?: number;
  booking?: string;
}

export interface TravelEvent {
  id: string;
  publicId: string;
  dayId: string;
  type: EventType;
  title: string;
  time?: string;
  timeSource: 'photo' | 'manual';
  note?: string;
  location?: { lat: number; lng: number; address?: string };
  data: TravelEventData;
  sortOrder: number;
  photos: TravelPhoto[];
}

export interface TravelDay {
  id: string;
  tripId: string;
  date?: string;
  city: string;
  title?: string;
  summary?: string;
  sortOrder: number;
  events: TravelEvent[];
}

export interface TravelTrip {
  id: string;
  title: string;
  destination: string;
  status: TripStatus;
  startDate?: string;
  endDate?: string;
  datesTbd: boolean;
  summary: string;
  pendingItems: string[];
  body: string;
  updatedAt: string;
  draft: boolean;
  featured: boolean;
  days: TravelDay[];
  previewPhotos: TravelPhoto[];
}
