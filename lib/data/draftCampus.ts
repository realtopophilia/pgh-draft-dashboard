// 2026 NFL Draft campus — Pittsburgh venues, fan zones, and landmarks.
// Coordinates calibrated against known Pittsburgh geography.
//
// Reference anchors:
//   Acrisure Stadium   40.4468, -80.0158
//   PNC Park           40.4469, -80.0054
//   Fountain tip       40.4421, -80.0066
//   Fort Pitt Museum   40.4405, -80.0110
//   Wyndham Grand      40.4416, -80.0095
//   Roberto Clemente Bridge (N) 40.4465, -80.0030

export interface DraftVenue {
  id:          string;
  name:        string;
  description: string;
  lat:         number;
  lon:         number;
  type:        'stage' | 'experience' | 'park' | 'transport';
}

// Five major named venues shown as glowing dots at all zoom levels.
export const DRAFT_VENUES: DraftVenue[] = [
  {
    id:          'draft-stage',
    name:        'Draft Theater / Main Stage',
    description: 'Picks announced live on stage. Located on the North Shore fan zone between PNC Park and Acrisure Stadium.',
    lat:          40.4470,
    lon:         -80.0120,
    type:        'stage',
  },
  {
    id:          'nfl-experience',
    name:        'NFL Draft Experience',
    description: 'Fan festival at Point State Park: 40-yard dash, field goal kick, Lombardi Trophy photo ops, autograph stage, and NFL shop.',
    lat:          40.4410,
    lon:         -80.0075,
    type:        'experience',
  },
  {
    id:          'acrisure',
    name:        'Acrisure Stadium',
    description: 'Home of the Pittsburgh Steelers. Draft Theater is on the North Shore plaza just east of the stadium.',
    lat:          40.4468,
    lon:         -80.0158,
    type:        'transport',
  },
  {
    id:          'pnc-park',
    name:        'PNC Park / North Shore Entry',
    description: 'Bus and shuttle drop-off point on the east end of the North Shore fan zone. Roberto Clemente Bridge pedestrian entry nearby.',
    lat:          40.4469,
    lon:         -80.0054,
    type:        'transport',
  },
  {
    id:          'station-square',
    name:        'Station Square',
    description: 'Gateway Clipper ferry landing — river shuttle to North Shore. T-station and parking.',
    lat:          40.4305,
    lon:         -80.0042,
    type:        'transport',
  },
];

export const VENUE_COLORS: Record<DraftVenue['type'], string> = {
  stage:      '#FFB81C',
  experience: '#F5A31C',
  park:       '#86efac',
  transport:  '#93c5fd',
};

// ── Zone polygon definitions ─────────────────────────────────────────────────

export interface DraftZone {
  id:              string;
  name:            string;
  subtitle:        string;
  color:           string;
  center:          [number, number]; // [lng, lat]
  shape:           'circle' | 'ellipse';
  radiusKm?:       number;
  halfWidthKm?:    number;
  halfHeightKm?:   number;
  rotationDeg?:    number;
}

export const DRAFT_ZONES: DraftZone[] = [
  {
    // Spans the ~1 km strip between Acrisure Stadium and PNC Park
    id:       'north-shore',
    name:     'North Shore',
    subtitle: 'Draft Stage · Fan Fest · Acrisure · PNC Park',
    color:    '#FFB81C',
    center:   [-80.0106, 40.4470],
    shape:    'ellipse',
    halfWidthKm:  0.58,   // east-west: nearly covers the whole stadium strip
    halfHeightKm: 0.20,   // north-south: North Shore Drive to Federal St
    rotationDeg:  0,
  },
  {
    // Point State Park at the tip of the Golden Triangle
    id:            'point-state-park',
    name:          'Point State Park',
    subtitle:      'Draft Experience · Red Carpet · Fan Zone',
    color:         '#5EA3C7',
    center:        [-80.0075, 40.4410],
    shape:         'ellipse',
    halfWidthKm:   0.38,   // east-west: Stanwix St to the fountain tip
    halfHeightKm:  0.14,   // north-south: narrow park
    rotationDeg:   0,
  },
];

/** Generate a closed polygon ring approximating the zone boundary. */
export function zoneToRing(zone: DraftZone, steps = 72): [number, number][] {
  const latKm = 110.574;
  const lngKm = 111.320 * Math.cos((zone.center[1] * Math.PI) / 180);
  const pts: [number, number][] = [];

  if (zone.shape === 'ellipse') {
    const hw  = zone.halfWidthKm!;
    const hh  = zone.halfHeightKm!;
    const rot = ((zone.rotationDeg ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    for (let i = 0; i <= steps; i++) {
      const a  = ((i / steps) * Math.PI) * 2;
      const ex = hw * Math.cos(a);
      const ey = hh * Math.sin(a);
      const dx = ex * cos - ey * sin;
      const dy = ex * sin + ey * cos;
      pts.push([zone.center[0] + dx / lngKm, zone.center[1] + dy / latKm]);
    }
  } else {
    for (let i = 0; i <= steps; i++) {
      const a = ((i / steps) * Math.PI) * 2;
      pts.push([
        zone.center[0] + (zone.radiusKm! * Math.cos(a)) / lngKm,
        zone.center[1] + (zone.radiusKm! * Math.sin(a)) / latKm,
      ]);
    }
  }
  return pts;
}

// ── Detailed campus landmarks ─────────────────────────────────────────────────

export type LandmarkType = 'stage' | 'fanfest' | 'exhibit' | 'activity' | 'food' | 'venue' | 'entry';

export interface Landmark {
  name: string;
  lng:  number;
  lat:  number;
  type: LandmarkType;
  zone: 'north-shore' | 'point-state-park';
}

export const LANDMARK_STYLES: Record<LandmarkType, { color: string; icon: string; label: string }> = {
  stage:    { color: '#FFB81C', icon: '▲', label: 'Stage'    },
  fanfest:  { color: '#F5A31C', icon: '★', label: 'Fan Fest' },
  exhibit:  { color: '#E8A84C', icon: '◆', label: 'Exhibit'  },
  activity: { color: '#7FAA6B', icon: '●', label: 'Activity' },
  food:     { color: '#D96846', icon: '■', label: 'Food'     },
  venue:    { color: '#C9C2B2', icon: '◉', label: 'Venue'    },
  entry:    { color: '#5EA3C7', icon: '▸', label: 'Entry'    },
};

// Coordinates calibrated to match actual Pittsburgh geography:
//   Point State Park runs east-west: fountain ~-80.007, Stanwix entry ~-80.003
//   North Shore fan zone: between PNC Park (-80.005) and Acrisure (-80.016)
export const CAMPUS_LANDMARKS: Landmark[] = [
  // ── Point State Park ──────────────────────────────────────────────────────
  { name: 'Red Carpet',            lng: -80.0100, lat: 40.4413, type: 'stage',    zone: 'point-state-park' },
  { name: 'Vince Lombardi Trophy', lng: -80.0080, lat: 40.4415, type: 'exhibit',  zone: 'point-state-park' },
  { name: '1st Overall Pick',      lng: -80.0070, lat: 40.4413, type: 'exhibit',  zone: 'point-state-park' },
  { name: 'Autograph Stage',       lng: -80.0090, lat: 40.4408, type: 'stage',    zone: 'point-state-park' },
  { name: 'Draft Experience',      lng: -80.0060, lat: 40.4410, type: 'fanfest',  zone: 'point-state-park' },
  { name: '40 Yard Dash',          lng: -80.0050, lat: 40.4406, type: 'activity', zone: 'point-state-park' },
  { name: 'Field Goal Kick',       lng: -80.0055, lat: 40.4413, type: 'activity', zone: 'point-state-park' },
  { name: 'Café at the Point',     lng: -80.0095, lat: 40.4405, type: 'food',     zone: 'point-state-park' },
  { name: 'Fort Pitt Museum',      lng: -80.0110, lat: 40.4405, type: 'venue',    zone: 'point-state-park' },
  { name: 'Wyndham Grand',         lng: -80.0095, lat: 40.4416, type: 'venue',    zone: 'point-state-park' },
  { name: 'Park Entry (Stanwix)',  lng: -80.0038, lat: 40.4403, type: 'entry',    zone: 'point-state-park' },
  { name: 'Park Entry (North)',    lng: -80.0075, lat: 40.4422, type: 'entry',    zone: 'point-state-park' },
  { name: 'Fountain',              lng: -80.0066, lat: 40.4421, type: 'venue',    zone: 'point-state-park' },
  // ── North Shore ───────────────────────────────────────────────────────────
  { name: 'Draft Main Stage',      lng: -80.0118, lat: 40.4468, type: 'stage',    zone: 'north-shore' },
  { name: 'Draft Theater',         lng: -80.0138, lat: 40.4464, type: 'stage',    zone: 'north-shore' },
  { name: 'Play 60 Zone',          lng: -80.0085, lat: 40.4472, type: 'activity', zone: 'north-shore' },
  { name: 'Flag Football Field',   lng: -80.0095, lat: 40.4478, type: 'activity', zone: 'north-shore' },
  { name: 'NFL Museum Exhibit',    lng: -80.0105, lat: 40.4465, type: 'exhibit',  zone: 'north-shore' },
  { name: 'Autograph Stage',       lng: -80.0078, lat: 40.4475, type: 'stage',    zone: 'north-shore' },
  { name: 'Beer Hall / Food',      lng: -80.0115, lat: 40.4476, type: 'food',     zone: 'north-shore' },
  { name: 'Acrisure Stadium',      lng: -80.0158, lat: 40.4468, type: 'venue',    zone: 'north-shore' },
  { name: 'PNC Park',              lng: -80.0054, lat: 40.4469, type: 'venue',    zone: 'north-shore' },
  { name: 'Roberto Clemente Bridge Entry', lng: -80.0032, lat: 40.4464, type: 'entry', zone: 'north-shore' },
  { name: 'Art Rooney Ave Entry',  lng: -80.0140, lat: 40.4458, type: 'entry',    zone: 'north-shore' },
  { name: 'Federal St Entry',      lng: -80.0100, lat: 40.4484, type: 'entry',    zone: 'north-shore' },
];
