// 2026 NFL Draft campus — Pittsburgh venues and fan zones.
// Coordinates verified against known Pittsburgh landmarks.

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
    description: 'Fan activities, overflow viewing, and live performances at the confluence of Pittsburgh\'s three rivers.',
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

// Color by venue type
export const VENUE_COLORS: Record<DraftVenue['type'], string> = {
  stage:      '#ffd700', // NFL gold
  experience: '#f59e0b', // amber
  park:       '#86efac', // light green
  transport:  '#93c5fd', // light blue
};
