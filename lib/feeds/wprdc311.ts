// Pittsburgh 311 complaints via WPRDC CKAN API (no key required).
// Returns the most recent complaints with lat/lon so they can be mapped.

const RESOURCE_ID = '76fda9d0-69be-4dd5-8108-0de7907fc5a5';
const BASE = 'https://data.wprdc.org/api/3/action/datastore_search_sql';

export interface Complaint {
  id: string;
  type: string;
  status: string;
  department: string;
  neighborhood: string;
  lat: number | null;
  lon: number | null;
  createdAt: string; // ISO string
}

interface RawRecord {
  _id: number;
  CREATED_ON: string;
  REQUEST_TYPE: string;
  STATUS: string;
  DEPARTMENT: string | null;
  NEIGHBORHOOD: string | null;
  Y: string | null; // latitude
  X: string | null; // longitude
}

export async function fetchRecentComplaints(hours = 48): Promise<Complaint[]> {
  // Pull complaints created in the last N hours, most recent first
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  const sql = `SELECT _id, "CREATED_ON", "REQUEST_TYPE", "STATUS", "DEPARTMENT", "NEIGHBORHOOD", "X", "Y"
               FROM "${RESOURCE_ID}"
               WHERE "CREATED_ON" > '${since}'
               ORDER BY "CREATED_ON" DESC
               LIMIT 200`;

  const url = `${BASE}?sql=${encodeURIComponent(sql)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PghDraftDashboard/1.0 (civic data project)',
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`WPRDC 311 → ${res.status}`);

  const json = await res.json();
  if (!json.success) throw new Error('WPRDC API returned success:false');

  const records: RawRecord[] = json.result?.records ?? [];

  return records.map((r): Complaint => ({
    id: String(r._id),
    type: r.REQUEST_TYPE ?? 'Unknown',
    status: r.STATUS ?? '',
    department: r.DEPARTMENT ?? '',
    neighborhood: r.NEIGHBORHOOD ?? '',
    lat: r.Y ? parseFloat(r.Y) : null,
    lon: r.X ? parseFloat(r.X) : null,
    createdAt: r.CREATED_ON,
  })).filter(c => c.lat !== null && c.lon !== null && !isNaN(c.lat!) && !isNaN(c.lon!));
}
