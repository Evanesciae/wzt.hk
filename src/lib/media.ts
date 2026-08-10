export function mediaUrl(path: string, version?: string) {
  const base = `/media/${path}`;
  if (!version) return base;
  const separator = path.includes('?') ? '&' : '?';
  return `${base}${separator}v=${encodeURIComponent(version)}`;
}
