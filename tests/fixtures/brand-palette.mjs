// Fixture parts for the brand-palette specs: small drawn parts in the shape an image model returns them - a
// warm off-white page, navy ink, a filled primary button, a text link, a soft tinted selection row and a status
// dot - painted once in the brand's red and once in the image model's default blue. The nivo brand is ONE
// accent, Unicorn red #e3001f, which is also its focus and danger colour; success, warning and info are its
// declared status colours (nivo-backend .starciwork/brand/index.yaml).
import { blankImage, drawOver } from '../../scripts/work/png.mjs';

export const NIVO_BRAND = {
  identity: { name: 'Nivo', family: 'nivo' },
  color: {
    policy: { dangerMayMatchPrimary: true },
    tokens: [
      { token: '--nivo-accent', value: 'oklch(57% 0.24 25)', role: 'primary' },
      { token: '--focus', value: 'oklch(57% 0.24 25)', role: 'focus' },
      { token: '--nivo-canvas', value: 'oklch(97.02% 0.0015 354.13)', role: 'surface' },
      { token: '--nivo-surface', value: 'oklch(100% 0.0008 354.13)', role: 'surface' },
      { token: '--nivo-foreground', value: 'oklch(21.03% 0.0015 354.13)', role: 'other' },
      { token: '--nivo-brand-ink', value: 'oklch(16% 0.035 255)', role: 'other' },
      { token: '--nivo-success', value: 'oklch(73.29% 0.1941 162.85)', role: 'success' },
      { token: '--nivo-warning', value: 'oklch(78.19% 0.159 84.37)', role: 'warning' },
      { token: '--nivo-danger', value: 'oklch(57% 0.24 25)', role: 'danger' },
      { token: '--nivo-info', value: 'oklch(72% 0.17 250)', role: 'info' },
    ],
  },
};

const rect = (image, x, y, w, h, rgb) => drawOver(image, blankImage(w, h, [...rgb, 255]), x, y);
const hex = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));

/**
 * A 240 x 160 part. `accent` paints the primary button, the link and the selection bar; `tint` the selected
 * row; the ink lines, the status dot and the page stay the same in both.
 */
export function drawnPart({ accent, tint, link = accent, dot = '#3bad57', fringe = false } = {}) {
  const image = blankImage(240, 160, [...hex('#fbf9f7'), 255]);
  rect(image, 12, 10, 150, 8, hex('#060f23'));            // title ink (near-black navy)
  rect(image, 12, 24, 110, 4, hex('#6d6b6c'));            // muted copy
  rect(image, 12, 40, 216, 26, hex(tint));                // selected row, soft tint
  rect(image, 12, 40, 3, 26, hex(accent));                // selection bar
  rect(image, 22, 50, 90, 5, hex('#060f23'));             // row label
  rect(image, 200, 50, 10, 10, hex(dot));                 // status dot
  rect(image, 12, 120, 90, 26, hex(accent));              // primary button
  rect(image, 30, 131, 54, 4, hex('#ffffff'));            // button label
  rect(image, 120, 130, 60, 3, hex(link));                // text link
  if (fringe) for (let y = 80; y < 110; y += 1) { rect(image, 40, y, 1, 1, hex('#d08040')); rect(image, 44, y, 1, 1, hex('#4080d0')); }
  return image;
}

/** The part as it should be: Unicorn red primary, a pink selection tint, a green status dot. */
export const redAccentPart = () => drawnPart({ accent: '#e3001f', tint: '#fbd7da' });
/** The part as the image model drew it: default blue button, link and selection (the owner's complaint). */
export const bluePrimaryPart = () => drawnPart({ accent: '#065cdc', tint: '#e3edfb' });
