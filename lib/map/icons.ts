/**
 * Shared map-icon registry.
 *
 * Each category (bus, train, parking, bike, camera, incident) gets a set of
 * SVG pictographs rendered into the MapLibre image atlas. Variants encode
 * status (parking fill-level, bike availability, etc) so we can swap which
 * icon-image each feature uses via a `match` expression in the layer.
 *
 * Design: rounded-square background in the status color + white pictograph glyph.
 * The shape is universal; color carries the signal.
 *
 * Call `ensureMapIcons(map)` once per map instance (idempotent) before any
 * layer that references an icon name.
 */
import maplibregl from 'maplibre-gl';

// ── status palette ──────────────────────────────────────────────────────────
// Tied to the Visit-PGH-inspired draft palette defined in globals.css.
const STATUS = {
  gold:    '#FFCE1F',
  teal:    '#00B6B0',
  steel:   '#5EA3C7',
  moss:    '#7FAA6B',
  amber:   '#E69545',
  rust:    '#C8352D',
  magenta: '#E83E8C',
  grey:    '#6B7280',
} as const;

// Icon body size (px) — rendered at @2x for retina clarity.
const ICON_PX = 32;

// ── SVG glyph library (path data only, 24×24 viewport) ──────────────────────
// All glyphs are white-stroked/filled; they render on top of the colored chip.
const GLYPHS: Record<string, string> = {
  // Bus — classic front-view silhouette
  bus: `
    <rect x="6" y="5" width="12" height="12" rx="2" fill="#fff"/>
    <rect x="7.5" y="6.5" width="9"  height="3.5" rx=".6" fill="currentColor"/>
    <circle cx="9"  cy="16.5" r="1.3" fill="currentColor"/>
    <circle cx="15" cy="16.5" r="1.3" fill="currentColor"/>
    <line x1="6" y1="11.5" x2="18" y2="11.5" stroke="currentColor" stroke-width=".8"/>
  `,
  // Train — light rail front with windshields
  train: `
    <rect x="6" y="4" width="12" height="14" rx="3" fill="#fff"/>
    <rect x="7.5" y="5.8" width="9" height="3.2" rx=".6" fill="currentColor"/>
    <rect x="7.5" y="10" width="3.5" height="5" rx=".4" fill="currentColor"/>
    <rect x="13"  y="10" width="3.5" height="5" rx=".4" fill="currentColor"/>
    <circle cx="8.5"  cy="17" r=".9" fill="currentColor"/>
    <circle cx="15.5" cy="17" r=".9" fill="currentColor"/>
  `,
  // Bike — two wheels + frame
  bike: `
    <circle cx="7.5"  cy="15.5" r="3.2" fill="none" stroke="#fff" stroke-width="1.6"/>
    <circle cx="16.5" cy="15.5" r="3.2" fill="none" stroke="#fff" stroke-width="1.6"/>
    <path d="M7.5 15.5 L11 9 L16 9 M11 9 L15.5 15.5 M13 9 L16 15.5"
          fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="11" cy="9" r=".9" fill="#fff"/>
  `,
  // Parking — bold P
  parking: `
    <path d="M9 5 H13.5 a4 4 0 0 1 0 8 H10 V19 H9 Z"
          fill="#fff" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M10 8.5 H13 a1.2 1.2 0 0 1 0 2.4 H10 Z" fill="currentColor"/>
  `,
  // Camera — CCTV mount
  camera: `
    <rect x="5"  y="9" width="12" height="8" rx="1.2" fill="#fff"/>
    <path d="M17 11 L20 9 V17 L17 15 Z" fill="#fff"/>
    <circle cx="9.5" cy="13" r="1.8" fill="currentColor"/>
    <rect x="10.5" y="17" width="1" height="2" fill="#fff"/>
    <rect x="8"    y="19" width="6" height="1" rx=".3" fill="#fff"/>
  `,
  // Incident — warning triangle with exclamation
  incident: `
    <path d="M12 4 L21 19 H3 Z" fill="#fff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="11.2" y="9"  width="1.6" height="5.5" rx=".3" fill="currentColor"/>
    <circle cx="12" cy="16.3" r="1" fill="currentColor"/>
  `,
};

// ── registry: all icon variants ─────────────────────────────────────────────
/** Map of icon name → background color. Glyph is looked up by prefix. */
export const ICON_SET: Record<string, { bg: string; glyph: keyof typeof GLYPHS }> = {
  // Transit — speed-based pressure variants
  'bus-moving':     { bg: STATUS.gold,    glyph: 'bus'   },  // normal
  'bus-slow':       { bg: STATUS.amber,   glyph: 'bus'   },  // < 10 mph
  'bus-stopped':    { bg: STATUS.rust,    glyph: 'bus'   },  // < 3 mph (delayed)
  // keep legacy name so existing references don't break during transition
  'bus-icon':       { bg: STATUS.gold,    glyph: 'bus'   },
  'train-icon':     { bg: STATUS.steel,   glyph: 'train' },
  // Parking — 5 fill levels + closed
  'parking-empty':  { bg: STATUS.moss,    glyph: 'parking' },
  'parking-low':    { bg: STATUS.gold,    glyph: 'parking' },
  'parking-med':    { bg: STATUS.amber,   glyph: 'parking' },
  'parking-high':   { bg: STATUS.rust,    glyph: 'parking' },
  'parking-full':   { bg: '#8B1E17',       glyph: 'parking' },
  'parking-closed': { bg: STATUS.grey,    glyph: 'parking' },
  // Bikes — availability buckets
  'bike-good':      { bg: STATUS.teal,    glyph: 'bike' },
  'bike-low':       { bg: STATUS.gold,    glyph: 'bike' },
  'bike-critical':  { bg: STATUS.amber,   glyph: 'bike' },
  'bike-empty':     { bg: STATUS.rust,    glyph: 'bike' },
  'bike-closed':    { bg: STATUS.grey,    glyph: 'bike' },
  // Cameras — one variant
  'camera-icon':    { bg: STATUS.moss,    glyph: 'camera' },
  // Incidents — one variant (could split by severity later)
  'incident-icon':  { bg: STATUS.rust,    glyph: 'incident' },
};

// ── SVG → image loading ─────────────────────────────────────────────────────
function buildSvg(bg: string, glyphKey: keyof typeof GLYPHS): string {
  const glyph = GLYPHS[glyphKey].trim();
  // Slightly darker stroke = the same hue shifted to black mix
  const stroke = '#1A1814';
  // The chip uses a rounded square at 24×24 viewbox; glyph paints on top in white.
  // `color: ${bg}` so `currentColor` inside the glyph picks up the chip tint for
  // inner negative-space details (e.g., bus windows).
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ICON_PX*2}" height="${ICON_PX*2}"
         viewBox="0 0 24 24" style="color:${bg}">
      <defs>
        <filter id="s" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy=".5" stdDeviation=".6" flood-color="#000" flood-opacity=".4"/>
        </filter>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="5"
            fill="${bg}" stroke="${stroke}" stroke-width="1" filter="url(#s)"/>
      ${glyph}
    </svg>
  `.trim();
}

async function svgToImage(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  try {
    const img = new Image(ICON_PX*2, ICON_PX*2);
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject(new Error('icon load failed'));
      img.src = url;
    });
    // Hold reference so the Image stays decoded before addImage
    await img.decode().catch(() => {});
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Register every icon in ICON_SET on the given map.
 * Idempotent — safe to call from every layer's init hook.
 */
const _loaded = new WeakSet<maplibregl.Map>();
export async function ensureMapIcons(map: maplibregl.Map): Promise<void> {
  if (_loaded.has(map)) return;
  _loaded.add(map);

  await Promise.all(
    Object.entries(ICON_SET).map(async ([name, { bg, glyph }]) => {
      if (map.hasImage(name)) return;
      try {
        const img = await svgToImage(buildSvg(bg, glyph));
        if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
      } catch (err) {
        console.warn(`[map-icons] failed to register ${name}:`, err);
      }
    }),
  );
}

// ── status → icon-name helpers ──────────────────────────────────────────────
/** Parking: icon name from percentFull + state. */
export function parkingIconName(percentFull: number, state: string): string {
  if (state === 'closed')   return 'parking-closed';
  if (percentFull >= 100)   return 'parking-full';
  if (percentFull >= 85)    return 'parking-high';
  if (percentFull >= 60)    return 'parking-med';
  if (percentFull >= 30)    return 'parking-low';
  return 'parking-empty';
}

/** POGOH: icon name from availability + rent state. */
export function bikeIconName(bikes: number, capacity: number, isRenting: boolean): string {
  if (!isRenting)                       return 'bike-closed';
  if (bikes === 0)                      return 'bike-empty';
  if (bikes <= 2)                       return 'bike-critical';
  if (capacity > 0 && bikes/capacity < 0.25) return 'bike-low';
  return 'bike-good';
}
