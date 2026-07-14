// ponytail: shared HTTP-body → typed parsers. Empty string must NOT coerce to 0
// (Number('')===0 would otherwise turn blank lat/lng into a real (0,0) coordinate).

function finiteNumber(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

/** Normalize a user-supplied slug to URL/filesystem-safe segments. Empty → invalid. */
export function safeSlug(value: unknown): string | undefined {
  const slug = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || undefined;
}

export interface LocationInput { lat: number; lng: number; address?: string }

/** Parse a {lat,lng,address} location from flat form fields. Returns undefined when lat or lng is blank/invalid. */
export function parseLocation(body: Record<string, any>, prefix = ''): LocationInput | undefined {
  const lat = finiteNumber(body[`${prefix}lat`]);
  const lng = finiteNumber(body[`${prefix}lng`]);
  if (lat === undefined || lng === undefined) return undefined;
  const address = body[`${prefix}address`];
  return { lat, lng, address: address ? String(address) : undefined };
}
