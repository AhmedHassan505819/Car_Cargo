/**
 * Geo utilities: validation, grid snapping, and distance helpers.
 */

/**
 * Snap a coordinate to a ~200m grid for privacy (used in browse-map view).
 * Rounds to ~0.002 degrees (≈200m at Pakistani latitudes).
 */
export function snapToGrid(lat: number, lng: number, gridSize = 0.002): { lat: number; lng: number } {
  return {
    lat: Math.round(lat / gridSize) * gridSize,
    lng: Math.round(lng / gridSize) * gridSize,
  };
}

/**
 * Validate that a GPS reading has acceptable accuracy.
 * Returns false if the accuracy is too poor for matching.
 */
export function isAccurateEnough(accuracyM: number, threshold = 150): boolean {
  return accuracyM <= threshold;
}

/**
 * Check if two consecutive GPS pings indicate impossible movement.
 * Used for fake-location detection.
 */
export function isTeleport(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  timeDeltaMs: number,
  maxSpeedKmh = 120
): boolean {
  const distanceKm = haversineKm(lat1, lng1, lat2, lng2);
  const timeDeltaH = timeDeltaMs / (1000 * 3600);

  if (timeDeltaH <= 0) return true; // Simultaneous pings from different locations

  const speedKmh = distanceKm / timeDeltaH;
  return speedKmh > maxSpeedKmh;
}

/**
 * Haversine distance in km.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Format coordinates for PostGIS geography point.
 * PostGIS uses POINT(lng lat) — note the order!
 */
export function toPostGISPoint(lng: number, lat: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/**
 * Round a coordinate to ~300m for approximate area display.
 */
export function approximateArea(lat: number, lng: number): { lat: number; lng: number } {
  return snapToGrid(lat, lng, 0.003);
}
