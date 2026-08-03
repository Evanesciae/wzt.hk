import type { CityPlaceType, CitySlug } from '../server/types';

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

export const cityPlaceTypes = [
  '山野自然',
  '城市景观',
  '建筑街区',
  '文化艺术',
  '餐饮',
  '商店市集',
] as const satisfies readonly CityPlaceType[];

export const cityPlaceTypeSet = new Set<CityPlaceType>(cityPlaceTypes);

export function cityName(slug: string) {
  return cities.find((city) => city.slug === slug)?.name ?? slug;
}
