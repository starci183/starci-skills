// ram-mode.mjs — the host RAM/CPU mode of the throttle: the three modes, the number helpers it reads samples with, and the
// next mode from the previous state and one host sample (hysteresis on both edges). ram-throttle.mjs owns the thresholds.

export const MODES = Object.freeze(['normal', 'heavy-paused', 'critical']);

export const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
export const pct1 = (n) => `${Math.round(num(n) * 10) / 10}%`;

// The RAM mode of one free-RAM sample: it drops at the stop thresholds and rises only past the resume thresholds.
function ramModeOf(pct, was, t) {
  if (pct < t.landSpecPauseBelowPct) return 'critical';
  if (was === 'critical' && pct <= t.landSpecResumeAbovePct) return 'critical';
  if (pct < t.heavyStopBelowPct) return 'heavy-paused';
  if (was !== 'normal' && pct <= t.heavyResumeAbovePct) return 'heavy-paused';
  return 'normal';
}

// Whether the CPU holds heavy ops back: hot at the stop level, cooling only below the resume level; no sample keeps the previous state.
function cpuHotOf(prev, cpu, t) {
  if (cpu == null) return Boolean(prev?.cpuHot);
  return cpu >= t.cpuHeavyStopAbove || (Boolean(prev?.cpuHot) && cpu > t.cpuHeavyResumeBelow);
}

// Why the RAM mode holds, or null for normal.
function ramWhy(ramMode, pct, t) {
  if (ramMode === 'critical') return pct < t.landSpecPauseBelowPct ? `free RAM ${pct1(pct)} < ${t.landSpecPauseBelowPct}%: heavy ops and land-gate spec runs paused` : `free RAM ${pct1(pct)} not yet above ${t.landSpecResumeAbovePct}% since going critical: heavy ops and land-gate spec runs stay paused`;
  if (ramMode === 'heavy-paused') return pct < t.heavyStopBelowPct ? `free RAM ${pct1(pct)} < ${t.heavyStopBelowPct}%: no new heavy op below the top priority` : `free RAM ${pct1(pct)} not yet above ${t.heavyResumeAbovePct}% since the heavy pause: no new heavy op below the top priority`;
  return null;
}

function cpuWhy(cpu, t) {
  const threshold = cpu != null && cpu >= t.cpuHeavyStopAbove ? `>= ${Math.round(t.cpuHeavyStopAbove * 100)}%` : `not yet below ${Math.round(t.cpuHeavyResumeBelow * 100)}%`;
  return `CPU ${Math.round(num(cpu ?? 1) * 100)}% ${threshold}: no new heavy op below the top priority`;
}

/**
 * The next mode from the previous state and one host sample, with hysteresis, over the thresholds \`t\`. \`prev\`: {ramMode, cpuHot}
 * (a missing or unknown one reads normal). Returns {mode, ramMode, cpuHot, why}.
 */
export function nextModeOf(prev, { freeRamPct, cpuBusy = null }, t) {
  const was = MODES.includes(prev?.ramMode) ? prev.ramMode : 'normal';
  const pct = num(freeRamPct, 100);
  const ramMode = ramModeOf(pct, was, t);
  const cpu = cpuBusy == null ? null : num(cpuBusy);
  const cpuHot = cpuHotOf(prev, cpu, t);
  const mode = ramMode === 'normal' && cpuHot ? 'heavy-paused' : ramMode;
  const why = [ramWhy(ramMode, pct, t), cpuHot ? cpuWhy(cpu, t) : null].filter(Boolean);
  return { mode, ramMode, cpuHot, why: why.join('; ') || `free RAM ${pct1(pct)}: normal` };
}
