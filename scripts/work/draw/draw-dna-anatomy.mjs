// draw-dna-anatomy.mjs - the anatomy a capture measured (draw-render record `anatomy`) judged against the HeroUI Alert and
// Meter anatomy: DRAW_ALERT_ANATOMY and DRAW_METER_TRACK findings. draw-dna.mjs re-exports it.
export const DRAW_ALERT_ANATOMY = 'DRAW_ALERT_ANATOMY';
export const DRAW_METER_TRACK = 'DRAW_METER_TRACK';
/** The HeroUI Meter/Progress track height (meter.css `.meter__track` h-2), in CSS px. */
export const METER_TRACK_PX = 8;
/** The segmented Meter track height (grammar 0.5.2 `.starci-core-meter-segments` h-1), in CSS px. */
export const METER_SEGMENTED_TRACK_PX = 4;
/** The widest gap between two segments that still reads as one track (the grammar sets 0.25rem). */
export const METER_SEGMENT_GAP_MAX_PX = 8;
/** The indicator size at which an Alert glyph has become a tile (IconTile sm is 32px; HeroUI's glyph is size-4 + p-1). */
export const ALERT_INDICATOR_MAX_PX = 32;
/** A track at least this share of its band's content width spans it (sub-pixel rounding, borders). */
export const METER_FULL_WIDTH_SHARE = 0.95;

/**
 * The anatomy a capture measured (draw-render record `anatomy`: {alerts:[{desc, background, surface, indicator,
 * indicatorColor, titleColor}], meters:[{desc, track, band, segments}]}) judged: [{code, kind, detail}].
 */
export function anatomyFindings(anatomy, { label = 'the capture' } = {}) {
  const out = [];
  const same = (a, b) => String(a ?? '').replace(/\s+/g, '') === String(b ?? '').replace(/\s+/g, '');
  const clear = (c) => /^rgba\([^)]*,\s*0\)$/.test(String(c ?? '').replace(/\s+/g, '')) || c === 'transparent';
  alertAnatomyFindings(Array.isArray(anatomy?.alerts) ? anatomy.alerts : [], label, out, same, clear);
  meterAnatomyFindings(Array.isArray(anatomy?.meters) ? anatomy.meters : [], label, out);
  return out;
}

function alertAnatomyFindings(alerts, label, out, same, clear) {
  for (const a of alerts) {
    const surface = a.surface && !clear(a.surface) ? a.surface : 'rgb(255, 255, 255)';
    if (a.background && !clear(a.background) && !same(a.background, surface)) out.push({ code: DRAW_ALERT_ANATOMY, kind: 'tone-filled Alert', detail: `${label}: ${a.desc ?? 'an Alert'} renders background ${a.background}, not the surface ${surface}` });
    const size = Math.max(Number(a.indicator?.width) || 0, Number(a.indicator?.height) || 0);
    if (size >= ALERT_INDICATOR_MAX_PX) out.push({ code: DRAW_ALERT_ANATOMY, kind: 'Alert indicator as a tile', detail: `${label}: ${a.desc ?? 'an Alert'} indicator renders ${Math.round(size)}px (HeroUI: a size-4 glyph with p-1)` });
    if (a.tile) out.push({ code: DRAW_ALERT_ANATOMY, kind: 'IconTile in an Alert', detail: `${label}: ${a.desc ?? 'an Alert'} renders an IconTile` });
    if (a.indicatorColor && a.titleColor && !same(a.indicatorColor, a.titleColor)) out.push({ code: DRAW_ALERT_ANATOMY, kind: 'indicator and title in different tones', detail: `${label}: ${a.desc ?? 'an Alert'} indicator ${a.indicatorColor} vs title ${a.titleColor} - both are the tone's soft-foreground` });
  }
}

function meterSegmentFindings(m, t, label, out) {
  const segs = Array.isArray(m.segments) ? m.segments.filter((s) => Number(s.width) > 0).sort((x, y) => x.x - y.x) : [];
  if (segs.length <= 1) return;
  const widths = segs.map((s) => Number(s.width));
  const gaps = segs.slice(1).map((s, i) => s.x - (segs[i].x + segs[i].width));
  const covered = segs.at(-1).x + segs.at(-1).width - segs[0].x;
  if (Math.max(...widths) - Math.min(...widths) > 2) out.push({ code: DRAW_METER_TRACK, kind: 'unequal Meter segments', detail: `${label}: ${m.desc ?? 'a Meter'} segments are ${widths.map(Math.round).join('/')}px - they divide the track equally` });
  if (Math.max(...gaps) > METER_SEGMENT_GAP_MAX_PX || covered < Number(t.width) * METER_FULL_WIDTH_SHARE) out.push({ code: DRAW_METER_TRACK, kind: 'Meter segments do not fill the track', detail: `${label}: ${m.desc ?? 'a Meter'} segments cover ${Math.round(covered)}px of ${Math.round(t.width)}px with gaps up to ${Math.round(Math.max(...gaps))}px - small gaps, the full width` });
}

function meterAnatomyFindings(meters, label, out) {
  for (const m of meters) {
    const t = m.track;
    if (!t) continue;
    const want = m.segmented || (Array.isArray(m.segments) && m.segments.length > 1) ? METER_SEGMENTED_TRACK_PX : METER_TRACK_PX;
    if (Math.abs(Number(t.height) - want) > 0.5) out.push({ code: DRAW_METER_TRACK, kind: 'Meter track off its height', detail: label + ': ' + (m.desc ?? 'a Meter') + ' track renders ' + t.height + 'px tall (' + (want === METER_TRACK_PX ? 'HeroUI h-2 = ' + METER_TRACK_PX + 'px' : 'segmented h-1 = ' + METER_SEGMENTED_TRACK_PX + 'px') + ')' });
    const band = Number(m.band?.width) || 0;
    if (band > 0 && Number(t.width) < band * METER_FULL_WIDTH_SHARE) out.push({ code: DRAW_METER_TRACK, kind: 'Meter as a stub', detail: `${label}: ${m.desc ?? 'a Meter'} track is ${Math.round(t.width)}px of its band's ${Math.round(band)}px - it spans the full width` });
    meterSegmentFindings(m, t, label, out);
  }
}
