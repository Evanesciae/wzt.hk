import type { APIRoute } from 'astro';
import { searchAirports } from '../../../../server/database';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length < 1) return Response.json({ airports: [] });
  return Response.json({ airports: searchAirports(query) });
};
