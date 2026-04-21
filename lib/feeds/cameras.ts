// 511PA traffic camera feed. The public site uses a DataTables-style endpoint
// filtered by DOT district + county. We paginate (page size capped at 100
// server-side), parse the WKT POINT lat/lng, and return only cameras inside
// the Pittsburgh bounding box.

import { inBounds } from '@/lib/bounds';

const BASE = 'https://www.511pa.com';
const PAGE_SIZE = 100;

export interface TrafficCamera {
  id: number;
  roadway: string;
  direction: string | null;
  location: string;
  lat: number;
  lon: number;
  imageUrl: string;   // absolute URL, live JPG, max-age 60s
  district: string | null;
}

interface RawCameraRecord {
  id: number;
  roadway: string | null;
  direction: string | null;
  location: string | null;
  district: string | null;
  images: Array<{ imageUrl: string }>;
  latLng?: { geography?: { wellKnownText?: string } };
}

interface RawCameraResponse {
  recordsFiltered: number;
  data: RawCameraRecord[];
}

function buildQueryUrl(start: number): string {
  // Mirror the site's request shape: filter by Southwestern Region + Allegheny.
  const query = {
    columns: [
      { data: null, name: '' },
      { name: 'sortOrder', s: true },
      { name: 'dotDistrict', search: { value: 'Southwestern Region (Pittsburgh)' }, s: true },
      { name: 'county', search: { value: 'Allegheny' }, s: true },
      { name: 'roadway', s: true },
      { name: 'turnpikeOnly' },
      { name: 'location' },
      { name: 'cameraName' },
      { name: 'district' },
      { data: 9, name: '' },
    ],
    order: [{ column: 1, dir: 'asc' }, { column: 2, dir: 'asc' }],
    start,
    length: PAGE_SIZE,
    search: { value: '' },
  };
  const q = encodeURIComponent(JSON.stringify(query));
  return `${BASE}/List/GetData/Cameras?query=${q}&lang=en-US`;
}

function parseWkt(wkt: string | undefined): [number, number] | null {
  if (!wkt) return null;
  const m = wkt.match(/POINT \(([-\d.]+) ([-\d.]+)\)/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2])]; // [lon, lat]
}

async function fetchPage(start: number): Promise<RawCameraResponse> {
  const res = await fetch(buildQueryUrl(start), {
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
      'referer': `${BASE}/cctv`,
    },
  });
  if (!res.ok) throw new Error(`511PA cameras ${res.status}`);
  return res.json();
}

export async function fetchAllCameras(): Promise<TrafficCamera[]> {
  const first = await fetchPage(0);
  const total = first.recordsFiltered;

  const rest: Promise<RawCameraResponse>[] = [];
  for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
    rest.push(fetchPage(start));
  }
  const pages = [first, ...(await Promise.all(rest))];

  const cameras: TrafficCamera[] = [];
  for (const page of pages) {
    for (const c of page.data) {
      const ll = parseWkt(c.latLng?.geography?.wellKnownText);
      if (!ll) continue;
      const [lon, lat] = ll;
      if (!inBounds(lat, lon)) continue;

      const imagePath = c.images?.[0]?.imageUrl;
      if (!imagePath) continue;

      cameras.push({
        id: c.id,
        roadway: c.roadway ?? '',
        direction: c.direction,
        location: c.location ?? '',
        lat,
        lon,
        imageUrl: imagePath.startsWith('http') ? imagePath : `${BASE}${imagePath}`,
        district: c.district,
      });
    }
  }
  return cameras;
}
