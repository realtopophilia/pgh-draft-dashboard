// 2026 NFL Draft — three principal site pins.
// All zone polygons, fan-zone ellipses, and detailed landmarks removed.

export interface DraftSite {
  id:          string;
  name:        string;
  description: string;
  lat:         number;
  lon:         number;
  icon:        string;   // emoji / glyph shown inside the pin chip
  color:       string;   // border + text accent color
}

export const DRAFT_SITES: DraftSite[] = [
  {
    id:          'acrisure',
    name:        'Acrisure Stadium',
    description: 'Home of the Pittsburgh Steelers. Draft Theater and Main Stage on the North Shore plaza.',
    lat:          40.4468,
    lon:         -80.0158,
    icon:        '🏟',
    color:       '#FFB81C',
  },
  {
    id:          'pnc-park',
    name:        'PNC Park',
    description: 'Bus and shuttle drop-off for the North Shore fan zone. Roberto Clemente Bridge pedestrian entry nearby.',
    lat:          40.4469,
    lon:         -80.0054,
    icon:        '⚾',
    color:       '#5EA3C7',
  },
  {
    id:          'point-state-park',
    name:        'Point State Park',
    description: 'NFL Draft Experience: 40-yard dash, Lombardi Trophy, autograph stage, fan festival at the tip of the Golden Triangle.',
    lat:          40.4421,
    lon:         -80.0075,
    icon:        '⭐',
    color:       '#00B6B0',
  },
];
