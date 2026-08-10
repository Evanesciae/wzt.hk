const recoveredPhotoIds = new Set([
  '7dc97826-8f7d-42cd-bc4f-87f57fef0043',
  'c2203c04-9f27-4320-b4fc-ce321d190978',
]);

export function mediaUrl(path: string, version?: string) {
  const recovered = version && recoveredPhotoIds.has(version);
  const base = `/${recovered ? 'recovered-media' : 'media'}/${path}`;
  if (!version) return base;
  const separator = path.includes('?') ? '&' : '?';
  const cacheVersion = recovered ? `2-${version}` : version;
  return `${base}${separator}v=${encodeURIComponent(cacheVersion)}`;
}
