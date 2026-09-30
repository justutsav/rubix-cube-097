/** Palette lifted off the flowchart so the video and the chart read as one artefact. */
export const T = {
  bg: '#eef2f0',
  card: '#ffffff',
  ink: '#0f172a',
  inkSoft: '#475569',
  line: '#cbd5e1',
  mint: '#a7e3b8',
  mintDeep: '#15803d',
  green: '#16a34a',
  orange: '#f4a638',
  orangeSoft: '#fdecd2',
  blue: '#2563eb',
  blueSoft: '#dbeafe',
  red: '#dc2626',
  shadow: '0 18px 44px rgba(15,23,42,0.13)',
  shadowSm: '0 6px 18px rgba(15,23,42,0.10)',
  font: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const;

export const STAGE = { w: 1920, h: 1080 };
/** where the flowchart sits once it has shrunk to the rail */
export const RAIL = { x: 56, y: 148, w: 616, h: 784 };
/** where the explanation panel lives */
export const PANEL = { x: 712, y: 148, w: 1152, h: 784 };
/** where the flowchart sits while it owns the frame */
export const FULL = { x: 210, y: 130, w: 1500, h: 800 };
