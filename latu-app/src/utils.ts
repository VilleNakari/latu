export function timeAgo(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60000);
  if (min < 1) return 'juuri nyt';
  if (min < 60) return `${min} min sitten`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h sitten`;
  const d = Math.round(h / 24);
  return d === 1 ? 'eilen' : `${d} pv sitten`;
}

export function km(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded.toFixed(rounded % 1 ? 1 : 0).replace('.', ',') + ' km';
}

/** Etäisyys kilometreinä (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}
