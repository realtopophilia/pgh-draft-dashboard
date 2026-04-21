import { inBounds } from '@/lib/bounds';

const BASE = 'https://511pa.com/map/mapIcons';

export interface Incident {
  id: string;
  lat: number;
  lon: number;
  severity: 'major' | 'other';
}

async function fetchMarkers(endpoint: string, severity: 'major' | 'other'): Promise<Incident[]> {
  const res = await fetch(`${BASE}/${endpoint}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  const items: Array<{ itemId: string; location: [number, number] }> = json.item2 ?? [];
  return items
    .map(item => ({
      id: item.itemId,
      lat: item.location[0],
      lon: item.location[1],
      severity,
    }))
    .filter(i => inBounds(i.lat, i.lon));
}

export async function fetchIncidents(): Promise<Incident[]> {
  const [major, other] = await Promise.allSettled([
    fetchMarkers('MajorRouteIncident', 'major'),
    fetchMarkers('OtherRouteIncident', 'other'),
  ]);
  return [
    ...(major.status === 'fulfilled' ? major.value : []),
    ...(other.status === 'fulfilled' ? other.value : []),
  ];
}
