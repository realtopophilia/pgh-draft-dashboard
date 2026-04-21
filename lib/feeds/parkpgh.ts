import { inBounds } from '@/lib/bounds';

export interface ParkingGarage {
  id: number | string;
  name: string;
  url: string;
  lat: number;
  lon: number;
  percentFull: number;
  percentAvailable: number;
  state: 'open' | 'closed' | string;
  color: 'green' | 'yellow' | 'red' | string;
  displaySpaces: number;
}

/**
 * Extract the garage JSON array embedded in parkpgh.org's HTML.
 * The page bakes a JS array into a <script> tag — we bracket-match
 * outward from the first "percent_full" occurrence to grab the whole thing.
 */
function extractGarageArray(html: string): unknown[] {
  const pctIdx = html.indexOf('"percent_full"');
  if (pctIdx === -1) throw new Error('No parking data found in HTML');

  // Walk backward to find the opening [ of the array
  let depth = 0;
  let start = pctIdx;
  while (start >= 0) {
    const ch = html[start];
    if (ch === ']') depth++;
    if (ch === '[') {
      if (depth === 0) break;
      depth--;
    }
    start--;
  }
  if (start < 0) throw new Error('Could not find array start');

  // Walk forward from [ to find the matching closing ]
  depth = 0;
  let end = start;
  while (end < html.length) {
    const ch = html[end];
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) break;
    }
    end++;
  }
  if (end >= html.length) throw new Error('Could not find array end');

  return JSON.parse(html.slice(start, end + 1)) as unknown[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGarage(raw: any): ParkingGarage | null {
  try {
    const status = raw.status ?? {};
    const lat = parseFloat(raw.lat);
    const lon = parseFloat(raw.lon);
    if (isNaN(lat) || isNaN(lon)) return null;
    if (!inBounds(lat, lon)) return null;

    return {
      id: raw.id ?? raw.url ?? `${lat},${lon}`,
      name: raw.name ?? 'Unknown Garage',
      url: raw.url ?? '',
      lat,
      lon,
      percentFull: status.percent_full ?? 0,
      percentAvailable: status.percent_available ?? 100,
      state: status.state ?? 'unknown',
      color: status.color ?? 'green',
      displaySpaces: status.display_spaces ?? 0,
    };
  } catch {
    return null;
  }
}

export async function fetchParkingGarages(): Promise<ParkingGarage[]> {
  const res = await fetch('https://parkpgh.org/', {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PghDraftDashboard/1.0)',
    },
  });
  if (!res.ok) throw new Error(`ParkPGH returned ${res.status}`);

  const html = await res.text();
  const raw = extractGarageArray(html);

  return raw
    .map(parseGarage)
    .filter((g): g is ParkingGarage => g !== null);
}
