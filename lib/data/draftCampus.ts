// 2026 NFL Draft campus — Pittsburgh venues, fan zones, and landmarks.
// Zone polygons + detailed landmarks sourced from NFL campus map.

export interface DraftVenue {
  id:          string;
  name:        string;
  description: string;
  lat:         number;
  lon:         number;
  type:        'stage' | 'experience' | 'park' | 'transport';
}

export const DRAFT_VENUES: DraftVenue[] = [
  {
    id:          'main-stage',
    name:        'Draft Main Stage',
    description: 'Round 1–7 picks announced here. Draft Theater at Acrisure Stadium.',
    lat:          40.4468,
    lon:         -80.0158,
    type:        'stage',
  },
  {
    id:          'nfl-experience',
    name:        'NFL Draft Experience',
    description: 'Interactive games, 40-yard dash, player meet & greets, Lombardi Trophy photo ops, merchandise.',
    lat:          40.4452,
    lon:         -80.0138,
    type:        'experience',
  },
  {
    id:          'point-state-park',
    name:        'Point State Park',
    description: "Fan activities, overflow viewing, and live performances at the confluence of Pittsburgh's three rivers.",
    lat:          40.4414,
    lon:         -80.0076,
    type:        'park',
  },
  {
    id:          'station-square',
    name:        'Station Square',
    description: 'Gateway Clipper ferry landing — river access to North Shore. Parking and T access.',
    lat:          40.4305,
    lon:         -80.0042,
    type:        'transport',
  },
  {
    id:          'pnc-park-entrance',
    name:        'PNC Park / North Shore Drop-off',
    description: 'Park & Ride bus drop-off point. North Shore pedestrian access.',
    lat:          40.4469,
    lon:         -80.0057,
    type:        'transport',
  },
];

export const VENUE_COLORS: Record<DraftVenue['type'], string> = {
  stage:      '#ffd700',
  experience: '#f59e0b',
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
  radiusKm?:       number;           // circle only
  halfWidthKm?:    number;           // ellipse east-west half-axis
  halfHeightKm?:   number;           // ellipse north-south half-axis
  rotationDeg?:    number;
}

export const DRAFT_ZONES: DraftZone[] = [
  {
    id:       'north-shore',
    name:     'North Shore',
    subtitle: 'Acrisure Stadium · PNC Park · Draft Stage',
    color:    '#FFB81C',
    center:   [-80.0080, 40.4470],
    shape:    'circle',
    radiusKm: 0.55,
  },
  {
    id:            'point-state-park',
    name:          'Point State Park',
    subtitle:      'Draft Experience · Fan Fest',
    color:         '#5EA3C7',
    center:        [-80.0125, 40.4415],
    shape:         'ellipse',
    halfWidthKm:   0.42,
    halfHeightKm:  0.16,
    rotationDeg:   -15,
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

export const CAMPUS_LANDMARKS: Landmark[] = [
  // ── Point State Park ──────────────────────────────────────────────────────
  { name: 'Red Carpet',            lng: -80.0165, lat: 40.4416, type: 'stage',    zone: 'point-state-park' },
  { name: 'Vince Lombardi Trophy', lng: -80.0152, lat: 40.4418, type: 'exhibit',  zone: 'point-state-park' },
  { name: '1st Overall Pick',      lng: -80.0142, lat: 40.4417, type: 'exhibit',  zone: 'point-state-park' },
  { name: 'Autograph Stage',       lng: -80.0138, lat: 40.4410, type: 'stage',    zone: 'point-state-park' },
  { name: 'Draft Experience',      lng: -80.0122, lat: 40.4413, type: 'fanfest',  zone: 'point-state-park' },
  { name: '40 Yard Dash',          lng: -80.0122, lat: 40.4421, type: 'activity', zone: 'point-state-park' },
  { name: 'Field Goal Kick',       lng: -80.0115, lat: 40.4420, type: 'activity', zone: 'point-state-park' },
  { name: 'Café at the Point',     lng: -80.0112, lat: 40.4410, type: 'food',     zone: 'point-state-park' },
  { name: 'Point Pitt Museum',     lng: -80.0135, lat: 40.4404, type: 'venue',    zone: 'point-state-park' },
  { name: 'Wyndham Grand',         lng: -80.0095, lat: 40.4417, type: 'venue',    zone: 'point-state-park' },
  { name: 'Park Entry',            lng: -80.0090, lat: 40.4413, type: 'entry',    zone: 'point-state-park' },
  { name: 'Staff Entry 2',         lng: -80.0128, lat: 40.4424, type: 'entry',    zone: 'point-state-park' },
  { name: 'Stage Entry 3',         lng: -80.0148, lat: 40.4402, type: 'entry',    zone: 'point-state-park' },
  // ── North Shore ───────────────────────────────────────────────────────────
  { name: 'Draft Main Stage',      lng: -80.0084, lat: 40.4471, type: 'stage',    zone: 'north-shore' },
  { name: 'Draft Theater',         lng: -80.0072, lat: 40.4466, type: 'stage',    zone: 'north-shore' },
  { name: 'Acrisure Stadium',      lng: -80.0158, lat: 40.4468, type: 'venue',    zone: 'north-shore' },
  { name: 'PNC Park',              lng: -80.0054, lat: 40.4469, type: 'venue',    zone: 'north-shore' },
  { name: 'Stage Ave Entry',       lng: -80.0090, lat: 40.4462, type: 'entry',    zone: 'north-shore' },
  { name: 'Art Rooney Ave',        lng: -80.0115, lat: 40.4468, type: 'entry',    zone: 'north-shore' },
  { name: 'Fan Fest Zone',         lng: -80.0100, lat: 40.4476, type: 'fanfest',  zone: 'north-shore' },
  { name: 'Autograph Stage',       lng: -80.0082, lat: 40.4479, type: 'stage',    zone: 'north-shore' },
];
