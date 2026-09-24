// scripts/api/quota/qwen.mjs — qwen viability + plan-quota probe. NO network and
// no console scraping: the Alibaba console usage API is an internal
// cookie + sec_token gateway, and the runtime must not use or store console
// cookies or sec_token. Quota is metered locally instead.
//
// Local meter under ~/.qwen (Qwen Code telemetry):
//   primary   usage/token-usage-*.jsonl — one record per API response usage
//             block ({timestamp, model, inputTokens, outputTokens, totalTokens}),
//             so each record is one billed request
//   fallback  usage_record.jsonl        — one line per session, models.<m>.requests
//
// The plan comparison comes from config.yaml `quota.qwen`:
//   {planQuota: 180000, unit: requests, resetAt: <window end ISO>,
//    calibratedRemainingPercent: <console reading>, calibratedAt: <when>}
// `unit` is the plan's own unit ('requests' | 'tokens') and picks the meter
// dimension compared against planQuota. The window ends at resetAt and rolls
// forward one month at a time once it passes.
//
// Owner calibrations — Telegram `/qwen <remaining%>` (verified owner chat only)
// — land in the runtime state dir (<runtime>/quota/qwen-calibrations.json,
// never in config): each stores {at, remainingPercent, localUnits, unit}. The
// ratio local-units -> plan-units is learned from each calibration: the newest
// consecutive pair with positive deltas gives it; a single calibration falls
// back to planUsed/localUnits anchored at the window start; uncalibrated 'requests'
// or 'tokens' assume 1:1.
//
// Probe mapping: credential absent -> 'dead' (unchanged); remaining <= 10% ->
// 'limited'; <= 0% -> 'dead' (the learned estimate is the best truth); config
// absent -> credential-only 'ok' with the metered counts in detail.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { machineFileFor } from '../../../engine/ledger-db.mjs';
import { configRoot, inspectOwnerConfig } from '../../../engine/config.mjs';

const ENV_KEYS = ['BAILIAN_TOKEN_PLAN_API_KEY', 'DASHSCOPE_API_KEY', 'OPENAI_API_KEY'];
const qwenHomeDefault = () => path.join(os.homedir(), '.qwen');
const qwenEnvFile = (home) => path.join(home, '.env');
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const round1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------ local meter */

/**
 * Every locally-metered usage record under `home`: [{at, requests, tokens}].
 * Primary source is the per-request usage block (token-usage-*.jsonl); when no
 * token-usage files exist the per-session request counts of usage_record.jsonl
 * are the fallback. {source, records}; source null when nothing is metered.
 */
export function meterRecords(home = qwenHomeDefault()) {
  const usageDir = path.join(home, 'usage');
  let files = [];
  try { files = fs.readdirSync(usageDir).filter((f) => /^token-usage-.*\.jsonl$/.test(f)).sort(); } catch { /* no usage dir */ }
  const records = [];
  if (files.length) {
    for (const f of files) {
      let lines;
      try { lines = fs.readFileSync(path.join(usageDir, f), 'utf8').split(/\r?\n/).filter(Boolean); } catch { continue; }
      for (const line of lines) {
        const r = parse(line);
        if (!r) continue;
        const at = typeof r.timestamp === 'number' ? r.timestamp : Date.parse(r.timestamp);
        if (!Number.isFinite(at)) continue;
        records.push({ at, requests: 1, tokens: Number(r.totalTokens) || (Number(r.inputTokens) || 0) + (Number(r.outputTokens) || 0) });
      }
    }
    return { source: 'usage/token-usage-*.jsonl', records };
  }
  const sessions = path.join(home, 'usage_record.jsonl');
  if (fs.existsSync(sessions)) {
    let lines = [];
    try { lines = fs.readFileSync(sessions, 'utf8').split(/\r?\n/).filter(Boolean); } catch { /* unreadable */ }
    for (const line of lines) {
      const r = parse(line);
      if (!r?.models || typeof r.models !== 'object') continue;
      const at = Number(r.timestamp ?? r.startTime);
      if (!Number.isFinite(at)) continue;
      let requests = 0, tokens = 0;
      for (const m of Object.values(r.models)) { requests += Number(m?.requests) || 0; tokens += Number(m?.totalTokens) || 0; }
      if (requests || tokens) records.push({ at, requests, tokens });
    }
    return { source: 'usage_record.jsonl', records };
  }
  return { source: null, records: [] };
}

/* ------------------------------------------------------------ plan config */

/**
 * The normalized quota.qwen block of an owner config, or null when absent or
 * incomplete. `unit` is 'requests' unless the owner says the plan bills tokens.
 */
export function qwenPlan(config) {
  const q = config?.quota?.qwen;
  if (!q || typeof q !== 'object') return null;
  const planQuota = Number(q.planQuota);
  const resetAt = Date.parse(q.resetAt ?? '');
  if (!(planQuota > 0) || !Number.isFinite(resetAt)) return null;
  const calibratedAt = Date.parse(q.calibratedAt ?? '');
  const calibratedRemaining = Number(q.calibratedRemainingPercent);
  return {
    planQuota,
    unit: q.unit === 'tokens' ? 'tokens' : 'requests',
    resetAt,
    seed: Number.isFinite(calibratedAt) && calibratedRemaining >= 0 && calibratedRemaining <= 100
      ? { at: calibratedAt, remainingPercent: calibratedRemaining }
      : null,
  };
}

/**
 * The plan window containing `now`: [resetAt - 1 month, resetAt) with resetAt
 * rolled forward a month at a time while it lies in the past.
 */
export function planWindow(resetAt, now = Date.now()) {
  let end = new Date(resetAt);
  while (end.getTime() <= now) { const next = new Date(end); next.setMonth(next.getMonth() + 1); end = next; }
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  return { start: start.getTime(), end: end.getTime() };
}

/* ------------------------------------------------------------ calibrations (runtime state dir, never config) */

export const quotaStateDir = (env = process.env) => path.join(path.dirname(machineFileFor(env)), 'quota');
export const calibrationsFile = (env = process.env) => path.join(quotaStateDir(env), 'qwen-calibrations.json');

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };

/** Every stored calibration, oldest first: [{at(ms), remainingPercent, localUnits, unit}]. */
export function loadCalibrations(env = process.env) {
  const list = readJson(calibrationsFile(env), []);
  return (Array.isArray(list) ? list : [])
    .map((c) => ({ at: Date.parse(c?.at ?? '') || (Number.isFinite(c?.at) ? c.at : NaN), remainingPercent: Number(c?.remainingPercent), localUnits: Number(c?.localUnits), unit: c?.unit }))
    .filter((c) => Number.isFinite(c.at) && c.remainingPercent >= 0 && c.remainingPercent <= 100 && Number.isFinite(c.localUnits))
    .sort((a, b) => a.at - b.at);
}

/** The owner config read tolerantly: the raw parse even while a key is not yet in the schema. */
const ownerConfigRaw = (root) => { try { return inspectOwnerConfig(root).config; } catch { return null; } };

const localCount = (records, unit, windowStart, until) =>
  records.reduce((n, r) => (r.at >= windowStart && r.at <= until ? n + (unit === 'tokens' ? r.tokens : r.requests) : n), 0);

/**
 * Record one owner calibration (`/qwen <remaining%>`): the meter's current
 * window count is frozen next to the console percent so the next estimate can
 * learn the local->plan ratio from the pair. Returns {calibration, estimate}.
 */
export function recordCalibration({ remainingPercent, env = process.env, home = qwenHomeDefault(), config = undefined, root = configRoot, now = Date.now() } = {}) {
  const plan = qwenPlan(config === undefined ? ownerConfigRaw(root) : config);
  if (!plan) throw Error('config.yaml has no quota.qwen block');
  const pct = Number(remainingPercent);
  if (!(pct >= 0 && pct <= 100)) throw Error('remaining percent must be a number in 0..100');
  const window = planWindow(plan.resetAt, now);
  const meter = meterRecords(home);
  const calibration = {
    at: new Date(now).toISOString(), remainingPercent: pct,
    localUnits: localCount(meter.records, plan.unit, window.start, now), unit: plan.unit,
  };
  const file = calibrationsFile(env);
  const list = [...loadCalibrations(env), calibration].slice(-100);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 1), { mode: 0o600 });
  try { fs.renameSync(tmp, file); } catch { fs.writeFileSync(file, JSON.stringify(list, null, 1), { mode: 0o600 }); try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ } }
  return { calibration, estimate: estimateQuota({ config, env, home, now, root }) };
}

/* ------------------------------------------------------------ the estimate */

/**
 * The quota estimate for the current window: {planQuota, unit, window{start,end},
 * resetsAt, localUnits, planUsed, usedPercent, remainingPercent, ratio,
 * calibrations, metered, source} — or null when no quota.qwen config exists.
 */
export function estimateQuota({ config = undefined, env = process.env, home = qwenHomeDefault(), now = Date.now(), root = configRoot } = {}) {
  const plan = qwenPlan(config === undefined ? ownerConfigRaw(root) : config);
  if (!plan) return null;
  const window = planWindow(plan.resetAt, now);
  const meter = meterRecords(home);
  const countUntil = (t) => localCount(meter.records, plan.unit, window.start, t);
  const localNow = countUntil(now);
  const stored = loadCalibrations(env).filter((c) => !c.unit || c.unit === plan.unit); // a unit change retires old calibrations
  const seed = plan.seed ? { ...plan.seed, localUnits: countUntil(plan.seed.at) } : null;
  const all = [...(seed ? [seed] : []), ...stored].sort((a, b) => a.at - b.at);
  const planUsedAt = (c) => ((100 - c.remainingPercent) / 100) * plan.planQuota;
  // The learned ratio local-units -> plan-units: the newest consecutive pair
  // with positive deltas (a reset flips both deltas negative and is skipped).
  let ratio = null;
  for (let i = 1; i < all.length; i += 1) {
    const dp = planUsedAt(all[i]) - planUsedAt(all[i - 1]);
    const dl = all[i].localUnits - all[i - 1].localUnits;
    if (dp > 0 && dl > 0) ratio = dp / dl;
  }
  // With a lone calibration, anchor at the window start: planUsed of it over
  // the metered units of it.
  if (ratio == null) {
    for (let i = all.length - 1; i >= 0; i -= 1) {
      const c = all[i];
      if (c.at >= window.start && c.localUnits > 0) { ratio = planUsedAt(c) / c.localUnits; break; }
    }
  }
  if (!(ratio > 0)) ratio = 1; // the unit names the plan's own unit; uncalibrated assumes 1:1
  const inWindow = all.filter((c) => c.at >= window.start && c.at <= now);
  const anchor = inWindow.at(-1) ?? null;
  const planUsed = (anchor ? planUsedAt(anchor) : 0) + Math.max(0, localNow - (anchor?.localUnits ?? 0)) * ratio;
  const usedPercent = Math.min(100, Math.max(0, round1((planUsed / plan.planQuota) * 100)));
  return {
    planQuota: plan.planQuota, unit: plan.unit, window, resetsAt: new Date(window.end).toISOString(),
    localUnits: localNow, planUsed: Math.round(planUsed), usedPercent, remainingPercent: round1(100 - usedPercent),
    ratio: round1(ratio * 1000) / 1000, calibrations: all.length, metered: meter.source != null, source: meter.source,
  };
}

/* ------------------------------------------------------------ the probe */

/**
 * The pinned probe. Injectable for specs: env (credential vars + LOCALAPPDATA),
 * home (~/.qwen), config (owner config; default inspects configRoot's
 * config.yaml tolerantly), now.
 */
export function probe({ env = process.env, home = qwenHomeDefault(), config = undefined, root = configRoot, now = Date.now() } = {}) {
  const present = ENV_KEYS.filter((k) => typeof env[k] === 'string' && env[k].trim());
  let credDetail = null;
  if (present.length) {
    credDetail = `credential env present: ${present.join(', ')}`;
  } else {
    try {
      const text = fs.readFileSync(qwenEnvFile(home), 'utf8');
      const fileKeys = ENV_KEYS.filter((k) => new RegExp(`^${k}=`, 'm').test(text));
      if (fileKeys.length) credDetail = `credential in ${qwenEnvFile(home)}: ${fileKeys.join(', ')}`;
    } catch { /* no env file */ }
  }
  if (!credDetail) {
    return { state: 'dead', usedPercent: null, detail: `no qwen credential env (${ENV_KEYS.join(', ')}) and no ${qwenEnvFile(home)} entry` };
  }
  let est = null;
  try { est = estimateQuota({ config, env, home, now, root }); } catch { est = null; }
  if (!est) {
    let metered = '';
    try {
      const meter = meterRecords(home);
      if (meter.source) {
        const total = meter.records.reduce((n, r) => n + r.requests, 0);
        metered = `; metered ${total} requests locally (${meter.source}), no quota.qwen config to compare against`;
      }
    } catch { /* metering is best effort */ }
    return { state: 'ok', usedPercent: null, detail: `${credDetail}${metered}` };
  }
  const base = `qwen plan ${est.usedPercent}% used (~${est.planUsed}/${est.planQuota} ${est.unit}, resets ${est.resetsAt}, meter ${est.source ?? 'none'}${est.calibrations ? `, ${est.calibrations} calibration(s), ratio ${est.ratio}` : ''})`;
  if (est.remainingPercent <= 0) {
    return { state: 'dead', usedPercent: est.usedPercent, resetsAt: est.resetsAt, detail: `${credDetail}; ${base} — plan exhausted` };
  }
  if (est.remainingPercent <= 10) {
    return { state: 'limited', usedPercent: est.usedPercent, resetsAt: est.resetsAt, detail: `${credDetail}; ${base} — under 10% remaining` };
  }
  return { state: 'ok', usedPercent: est.usedPercent, resetsAt: est.resetsAt, detail: `${credDetail}; ${base}` };
}
