#!/usr/bin/env node
// housekeeping.mjs — the ONE host housekeeping run of the live runtime (item 1 of the storage spec): keeps C:
// and RAM bounded by sweeping the things nobody else removes — %TEMP% fixtures, agent session archives, Claude
// Code transcripts, Devin data, StarCi logs, finished-workflow ledgers.
//
//   node scripts/supervisor/housekeeping.mjs [--dry-run] [--apply] [--json] [--only tmp,sessions,...]
//
// Default is a dry run: every sweep reports what it WOULD free or move and mutates nothing; --apply performs
// the removals and archive moves. --only restricts the run to the named areas (default: all of them). The
// stdout report is the JSON envelope `starci/housekeeping-report@1`; --json is accepted for call-site symmetry
// with the other supervisor CLIs (stdout is always the report).
//
// Each area runs its own sweep module (scripts/lib/hk-*.mjs) as sweep({apply, now, env, allocation}) and gets
// {ok, freedBytes?, movedBytes?, deleted?, moved?, skipped?, errors?, report?} back. `allocation` is the
// runtimes.yaml allocation block — every retention window lives under allocation.housekeeping.* there; this
// file carries no literal windows. Sweep modules differ in how they read it (some want the whole block, some
// the bare housekeeping sub-block), so housekeepingAllocation() hands each of them a merged view that serves
// both. One area failing (a throwing sweep, a missing module, ok:false) is recorded in its own entry and
// never stops the remaining areas.
import '../lib/hide-child-windows.mjs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allocationSettings } from '../../engine/config.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const SCHEMA = 'starci/housekeeping-report@1';

/** The areas a run covers, in sweep order: name -> the lib module and the export that sweeps it. */
export const AREAS = Object.freeze({
  tmp: { module: '../lib/hk-tmp.mjs', sweep: 'sweepTmp' },
  sessions: { module: '../lib/hk-sessions.mjs', sweep: 'sweepAgentSessions' },
  claude: { module: '../lib/hk-claude.mjs', sweep: 'sweepClaudeTranscripts' },
  devin: { module: '../lib/hk-devin.mjs', sweep: 'sweepDevinData' },
  logs: { module: '../lib/hk-logs.mjs', sweep: 'sweepStarciLogs' },
  lanes: { module: '../lib/hk-lanes.mjs', sweep: 'sweepLanes' },
  ledgers: { module: '../lib/hk-ledger.mjs', sweep: 'sweepLedgers' },
});
export const AREA_NAMES = Object.freeze(Object.keys(AREAS));

const csv = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
const number = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
/** A sweep's errors list as strings: plain entries, Error-likes, and {path, error} records (hk-tmp). */
const errorStrings = (v) => (Array.isArray(v) ? v.map((e) => {
  if (e == null) return '';
  if (typeof e !== 'object') return String(e);
  if (e.message) return String(e.message);
  if (e.error !== undefined) return `${e.path ? `${e.path}: ` : ''}${String(e.error)}`;
  return JSON.stringify(e);
}).filter(Boolean) : []);

/**
 * The argv contract: {ok, apply, only, json} or {ok:false, error}. Default is the dry run — `--apply` is the
 * only flag that mutates; `--dry-run` spells the default out for scheduled tasks and docs.
 */
export function parseArgs(argv = []) {
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const only = csv(value('only'));
  const unknown = only.filter((name) => !AREA_NAMES.includes(name));
  if (unknown.length) return { ok: false, error: `unknown --only area(s): ${unknown.join(', ')} (known: ${AREA_NAMES.join(', ')})` };
  const unknownFlags = argv.filter((a) => a.startsWith('--') && !['dry-run', 'apply', 'json', 'only'].includes(a.slice(2)));
  if (unknownFlags.length) return { ok: false, error: `unknown flag(s): ${unknownFlags.join(' ')}` };
  return { ok: true, apply: has('apply'), only: only.length ? only : null, json: has('json') };
}

/**
 * The `allocation` the sweeps share: the whole allocationSettings() block with the housekeeping sub-block's
 * keys also at top level and `housekeeping` present — so a sweep reading `allocation.housekeeping.*` and a
 * sweep reading `allocation.*` directly both see the declared windows. Specs inject `allocation` verbatim.
 */
export function housekeepingAllocation(allocation = allocationSettings()) {
  const hk = allocation?.housekeeping ?? {};
  return { ...allocation, ...hk, housekeeping: hk };
}

/** The sweep one area runs: an override from `sweeps` (specs) else the lib module's named export. */
async function resolveSweep(name, { module: modulePath, sweep }, sweeps) {
  if (sweeps) {
    const fn = sweeps[name];
    if (typeof fn !== 'function') throw Error(`no sweep supplied for area '${name}'`);
    return fn;
  }
  const file = fileURLToPath(new URL(modulePath, import.meta.url));
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod[sweep] !== 'function') throw Error(`${modulePath} exports no ${sweep}()`);
  return mod[sweep];
}

/** The report entry for one area: the schema's five keys plus the detail a sweep chooses to return. */
function areaResult(raw) {
  const entry = {
    ok: raw?.ok === true,
    freedBytes: number(raw?.freedBytes),
    movedBytes: number(raw?.movedBytes),
    // `skipped` is a count for some sweeps and the {path, reason} list itself for others (hk-tmp); keep both.
    skipped: Array.isArray(raw?.skipped) ? raw.skipped : number(raw?.skipped),
    errors: errorStrings(raw?.errors),
  };
  for (const key of ['deleted', 'moved', 'report']) if (raw?.[key] !== undefined) entry[key] = raw[key];
  if (!entry.ok && !entry.errors.length) entry.errors.push('sweep returned ok:false');
  return entry;
}

/**
 * One housekeeping run. `only` (area names) restricts the run; `sweeps` replaces the lib modules in specs;
 * `allocation` defaults to the runtimes.yaml allocation block the sweeps read their windows from. Returns the
 * `starci/housekeeping-report@1` report. A failing area lands in its own entry — the run itself always
 * produces a report.
 */
export async function runHousekeeping({ apply = false, only = null, env = process.env, now = Date.now(), sweeps = null, allocation = null } = {}) {
  const started = Date.now();
  const names = only ?? AREA_NAMES;
  const areas = {};
  for (const name of names) {
    try {
      const fn = await resolveSweep(name, AREAS[name], sweeps);
      areas[name] = areaResult(await fn({ apply, now, env, allocation: allocation ?? housekeepingAllocation() }));
    } catch (error) {
      areas[name] = { ok: false, freedBytes: 0, movedBytes: 0, skipped: 0, errors: [String(error?.message ?? error)] };
    }
  }
  const totals = Object.values(areas).reduce((acc, a) => ({ freedBytes: acc.freedBytes + a.freedBytes, movedBytes: acc.movedBytes + a.movedBytes }), { freedBytes: 0, movedBytes: 0 });
  return {
    schema: SCHEMA,
    generatedAt: new Date(now).toISOString(),
    apply: apply === true,
    ok: Object.values(areas).every((a) => a.ok),
    areas,
    totals,
    durationMs: Date.now() - started,
  };
}

const mb = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`);

/** The one-line summary stall-alert and the scheduled task can quote. */
export function describe(report) {
  const failed = Object.entries(report.areas).filter(([, a]) => !a.ok).map(([name]) => name);
  const base = `HOUSEKEEPING ${report.apply ? 'apply' : 'dry-run'}: freed ${mb(report.totals.freedBytes)}, moved ${mb(report.totals.movedBytes)} in ${report.durationMs} ms`;
  return failed.length ? `${base}; FAILED: ${failed.join(', ')}` : `${base}; all areas ok`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(`use: housekeeping.mjs [--dry-run] [--apply] [--json] [--only <${AREA_NAMES.join(',')}>] (${args.error})`);
    process.exitCode = 2;
  } else {
    const report = await runHousekeeping({ apply: args.apply, only: args.only });
    console.log(JSON.stringify(report, null, args.json ? 2 : undefined));
    if (!report.ok) process.exitCode = 1;
  }
}
