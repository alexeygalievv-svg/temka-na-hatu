const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Длительность whip pan от географического расстояния.
 * 1 км ≈ 1 с, 100 км ≈ 1.9 с, 1000+ км ≈ 3–3.5 с.
 */
export function whipDurationMs(distanceKm: number): number {
  const raw = 900 + 100 * Math.sqrt(Math.max(0, distanceKm));
  return Math.round(Math.min(3500, Math.max(900, raw)));
}

/** Небольшой наклон камеры в сторону перелёта. */
export function whipRotateDeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dx = to.lng - from.lng;
  const dy = -(to.lat - from.lat);
  if (Math.abs(dx) + Math.abs(dy) < 1e-9) return 0;
  return Math.max(-1.8, Math.min(1.8, Math.sin(Math.atan2(dy, dx)) * 1.8));
}
