/**
 * Shared popup/tooltip styling tokens.
 *
 * MapLibre popup HTML is a raw string so it can't use CSS variables directly.
 * We centralise the hex values here so every layer uses identical typography.
 */

export const P = {
  // Backgrounds
  bg:        '#1F1D22',   // --bg-2
  bgCard:    '#26232A',   // --bg-3

  // Text hierarchy
  ink:       '#F5F1E8',   // --ink       (headings, primary values)
  inkDim:    '#C7C1B8',   // --ink-dim   (body copy, secondary info)
  inkMute:   '#8A857E',   // --ink-mute  (labels, captions)
  inkFaint:  '#5A554F',   // --ink-faint (fine print, meta)

  // Accents (pulled from design token palette)
  gold:      '#FFCE1F',
  teal:      '#00B6B0',
  steel:     '#5EA3C7',
  rust:      '#C8352D',
  amber:     '#E69545',
  moss:      '#7FAA6B',
  magenta:   '#E83E8C',
  grey:      '#6B7280',

  // Divider
  line:      '#302C36',
} as const;

/** Wrap popup body in a consistently-styled container div. */
export function popupWrap(inner: string, minWidth = 160): string {
  return `<div style="font-family:'Inter',system-ui,sans-serif;min-width:${minWidth}px;color:${P.inkDim};line-height:1.5">${inner}</div>`;
}

/** Coloured dot + bold label row — used as popup heading. */
export function popupHead(label: string, color: string): string {
  return `
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;flex-shrink:0;background:${color}"></span>
      <p style="font-weight:600;font-size:13px;color:${P.ink};margin:0;line-height:1.25">${label}</p>
    </div>`;
}

/** Small monospace meta line (source · cadence). */
export function popupMeta(text: string): string {
  return `<p style="font-size:10px;color:${P.inkFaint};margin:6px 0 0;font-family:'IBM Plex Mono',monospace;letter-spacing:.02em">${text}</p>`;
}

/** Big stat number + small label beneath it. */
export function popupStat(value: string | number, label: string, color: string = P.ink): string {
  return `
    <div style="text-align:center">
      <p style="font-size:22px;font-weight:700;color:${color};margin:0;line-height:1;letter-spacing:-.01em">${value}</p>
      <p style="color:${P.inkMute};font-size:10px;margin:2px 0 0;letter-spacing:.06em;text-transform:uppercase">${label}</p>
    </div>`;
}
