// Pittsburgh city limits bounding box
export const PITTSBURGH_BOUNDS = {
  sw: { lat: 40.358, lon: -80.095 },
  ne: { lat: 40.501, lon: -79.865 },
} as const;

// MapLibre expects [lng, lat]
export const PITTSBURGH_CENTER: [number, number] = [-80.0, 40.44];
export const PITTSBURGH_ZOOM = 12;

export function inBounds(lat: number, lon: number): boolean {
  return (
    lat >= PITTSBURGH_BOUNDS.sw.lat &&
    lat <= PITTSBURGH_BOUNDS.ne.lat &&
    lon >= PITTSBURGH_BOUNDS.sw.lon &&
    lon <= PITTSBURGH_BOUNDS.ne.lon
  );
}

// LngLatBoundsLike for MapLibre fitBounds
export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [PITTSBURGH_BOUNDS.sw.lon, PITTSBURGH_BOUNDS.sw.lat],
  [PITTSBURGH_BOUNDS.ne.lon, PITTSBURGH_BOUNDS.ne.lat],
];
