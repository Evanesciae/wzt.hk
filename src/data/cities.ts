import type { CitySlug } from '../server/types';

export interface CityDefinition {
  slug: CitySlug;
  name: string;
  englishName: string;
  center: [number, number];
  zoom: number;
}

export const cities: CityDefinition[] = [
  {
    slug: 'hong-kong',
    name: '香港',
    englishName: 'HONG KONG',
    center: [114.151, 22.335],
    zoom: 10.35,
  },
  {
    slug: 'singapore',
    name: '新加坡',
    englishName: 'SINGAPORE',
    center: [103.8519, 1.3074],
    zoom: 11.15,
  },
];

export const citySlugs = new Set<CitySlug>(cities.map((city) => city.slug));

export function cityName(slug: string) {
  return cities.find((city) => city.slug === slug)?.name ?? slug;
}
