// POGOH bikeshare — GBFS v3.0 from pittsburgh.publicbikesystem.net
// Joins station_information (static, coords/capacity) with
// station_status (live, bikes/docks available).

const BASE = 'https://pittsburgh.publicbikesystem.net/customer/gbfs/v3.0';

export interface BikeStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  bikesAvailable: number;
  docksAvailable: number;
  isRenting: boolean;
  isReturning: boolean;
  lastReported: string | null;
}

interface GbfsStationInfo {
  station_id: string;
  name: Array<{ text: string; language: string }> | string;
  lat: number;
  lon: number;
  capacity: number;
}

interface GbfsStationStatus {
  station_id: string;
  num_vehicles_available: number;
  num_docks_available: number;
  is_renting: boolean;
  is_returning: boolean;
  is_installed: boolean;
  last_reported: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GBFS ${url} → ${res.status}`);
  return res.json();
}

export async function fetchBikeStations(): Promise<BikeStation[]> {
  const [infoRes, statusRes] = await Promise.all([
    fetchJson<{ data: { stations: GbfsStationInfo[] } }>(`${BASE}/station_information`),
    fetchJson<{ data: { stations: GbfsStationStatus[] } }>(`${BASE}/station_status`),
  ]);

  // Build a status lookup by station_id
  const statusMap = new Map<string, GbfsStationStatus>();
  for (const s of statusRes.data.stations) {
    statusMap.set(s.station_id, s);
  }

  return infoRes.data.stations
    .map((info): BikeStation | null => {
      const status = statusMap.get(info.station_id);
      if (!status || !status.is_installed) return null;

      // GBFS v3 name is an array of {text, language}
      const name = Array.isArray(info.name)
        ? (info.name.find(n => n.language === 'en')?.text ?? info.name[0]?.text ?? info.station_id)
        : String(info.name);

      return {
        id: info.station_id,
        name,
        lat: info.lat,
        lon: info.lon,
        capacity: info.capacity,
        bikesAvailable: status.num_vehicles_available,
        docksAvailable: status.num_docks_available,
        isRenting: status.is_renting,
        isReturning: status.is_returning,
        lastReported: status.last_reported ?? null,
      };
    })
    .filter((s): s is BikeStation => s !== null);
}
