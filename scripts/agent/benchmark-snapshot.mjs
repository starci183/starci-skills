#!/usr/bin/env node
// scripts/agent/benchmark-snapshot.mjs — record one append-only model-pool snapshot under benchmark/snapshots/.
//
//   node scripts/agent/benchmark-snapshot.mjs --since-hours N [--repo <repoRoot> ...] [--date YYYY-MM-DD]
//        [--dir <snapshotsDir>] [--json]
//
// Runs scripts/agent/model-scorecard.mjs (scorecardFor, read-only on every ledger) over the given --repo roots,
// or, with none, over the Work owner of every .workspaces/projects/<p>/work.json binding under the source root
// that holds a ledger. Writes the scorecard JSON (the exact `model-scorecard --json` shape) to
// <dir>/<date>-<N>h.json, then prints a short per-pool delta against the newest earlier snapshot of the same
// window. A snapshot is never overwritten: when the file already exists the run refuses (exit 1) and writes
// nothing. benchmark/README.md owns the update process.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRuntimeRoot, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { sourceRootOf } from '../kernel/target-repo.mjs';
import { scorecardFor, UNROUTED } from './model-scorecard.mjs';

export const SNAPSHOTS_DIR = path.join(skillRoot, 'benchmark', 'snapshots');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const hasLedger = (root) => { try { return !isRuntimeRoot(root) && fs.existsSync(ledgerFileFor(root)); } catch { return false; } };

/** YYYY-MM-DD of `ms` in the host's local time zone (the day the owner reads). */
export const localDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The snapshot file name for one date and window. */
export const snapshotName = (date, sinceHours) => `${date}-${sinceHours}h.json`;

/**
 * The Work owner repo of every .workspaces/projects/<p>/work.json binding under `sourceRoot`
 * (repositories[work.ownerRole ?? 'be'].pathFromSource), each kept once and only when it holds a ledger.
 */
export function boundRepos({ sourceRoot = sourceRootOf() } = {}) {
  const projects = path.join(sourceRoot, '.workspaces', 'projects');
  let entries = [];
  try { entries = fs.readdirSync(projects, { withFileTypes: true }); } catch { return []; }
  const seen = new Set(), out = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const doc = readJson(path.join(projects, entry.name, 'work.json'));
    const rel = doc?.repositories?.[doc?.work?.ownerRole ?? 'be']?.pathFromSource;
    if (typeof rel !== 'string' || !rel.trim()) continue;
    const repo = path.resolve(sourceRoot, rel);
    const key = process.platform === 'win32' ? repo.toLowerCase() : repo;
    if (seen.has(key) || !hasLedger(repo)) continue;
    seen.add(key); out.push(repo);
  }
  return out;
}

/** The newest snapshot in `dir` of the same window whose name sorts before `name`, or null. */
export function previousSnapshot(dir, name, sinceHours) {
  const same = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${sinceHours}h\\.json$`);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => same.test(f) && f < name).sort(); } catch { return null; }
  const file = files.at(-1);
  if (!file) return null;
  const snapshot = readJson(path.join(dir, file));
  return snapshot ? { file, snapshot } : null;
}

const round = (x, digits = 1) => (x == null ? null : Math.round(x * 10 ** digits) / 10 ** digits);
const diff = (a, b) => (a == null || b == null ? null : a - b);

/** Per-pool change from `prev` to `next`: jobs, pass/fail/blocked in percentage points, median in minutes. */
export function snapshotDelta(next, prev) {
  const pools = {};
  const names = [...new Set([...Object.keys(next.pools ?? {}), ...Object.keys(prev?.pools ?? {})])];
  for (const pool of names) {
    const n = next.pools?.[pool], p = prev?.pools?.[pool];
    const pp = (key) => { const d = diff(n?.[key], p?.[key]); return d == null ? null : round(d * 100); };
    const min = (x) => (x == null ? null : x / 60000);
    pools[pool] = {
      jobs: n?.jobs ?? 0, jobsDelta: (n?.jobs ?? 0) - (p?.jobs ?? 0),
      passRate: n?.passRate ?? null, passPp: pp('passRate'), failPp: pp('failRate'), blockedPp: pp('blockedRate'),
      medianMin: round(min(n?.medianMs)), medianMinDelta: round(diff(min(n?.medianMs), min(p?.medianMs))),
      isNew: !p, isGone: !n,
    };
  }
  return { jobs: next.jobs ?? 0, jobsDelta: (next.jobs ?? 0) - (prev?.jobs ?? 0), pools };
}

const signed = (x, unit = '') => (x == null ? '-' : `${x > 0 ? '+' : ''}${x}${unit}`);
const pctText = (x) => (x == null ? '-' : `${Math.round(x * 100)}%`);
const shortPool = (pool) => (pool === UNROUTED ? 'unrouted' : pool.replace(/-agent$/, ''));

/** The short text the CLI prints: the written file, then one delta line per pool (or a first-snapshot note). */
export function formatDelta({ file, snapshot, previous, delta }) {
  const lines = [`benchmark snapshot ${path.basename(file)}: ${snapshot.jobs} jobs over ${snapshot.repos.length} repo(s), window ${snapshot.window.label}`];
  if (!previous) { lines.push(`no earlier ${snapshot.window.label} snapshot: this is the baseline`); return lines.join('\n'); }
  lines.push(`delta vs ${previous.file}: jobs ${snapshot.jobs} (${signed(delta.jobsDelta)})`);
  for (const [pool, d] of Object.entries(delta.pools)) {
    if (d.isGone) { lines.push(`  ${shortPool(pool)}: absent now (was present)`); continue; }
    const rates = pool === UNROUTED ? '' : ` pass ${pctText(d.passRate)} (${signed(d.passPp, 'pp')}) fail ${signed(d.failPp, 'pp')} blk ${signed(d.blockedPp, 'pp')}`;
    lines.push(`  ${shortPool(pool)}: ${d.jobs} jobs (${signed(d.jobsDelta)})${rates} med ${d.medianMin ?? '-'}m (${signed(d.medianMinDelta, 'm')})${d.isNew ? ' [new]' : ''}`);
  }
  return lines.join('\n');
}

/**
 * Take one snapshot. Refuses (throws code EEXIST) when <dir>/<date>-<N>h.json exists, before reading any ledger.
 * Returns { file, snapshot, previous, delta }.
 */
export function takeSnapshot({ repos = null, sinceHours, now = Date.now(), date = localDate(now), dir = SNAPSHOTS_DIR,
  sourceRoot = sourceRootOf(), qwenHome } = {}) {
  if (!(Number(sinceHours) > 0)) throw Object.assign(Error('--since-hours needs a positive number'), { code: 'EUSAGE' });
  if (!DATE.test(date)) throw Object.assign(Error(`--date needs YYYY-MM-DD, got ${date}`), { code: 'EUSAGE' });
  const name = snapshotName(date, Number(sinceHours));
  const file = path.join(dir, name);
  if (fs.existsSync(file)) throw Object.assign(Error(`${file} exists: snapshots are append-only and never overwritten`), { code: 'EEXIST' });
  const targets = repos?.length ? repos : boundRepos({ sourceRoot });
  if (!targets.length) throw Object.assign(Error(`no bound project repo with a ledger under ${sourceRoot}/.workspaces/projects; pass --repo`), { code: 'EUSAGE' });
  const snapshot = scorecardFor({ repos: targets, sinceHours: Number(sinceHours), now, ...(qwenHome ? { qwenHome } : {}) });
  const previous = previousSnapshot(dir, name, Number(sinceHours));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(snapshot)}\n`, { flag: 'wx' });
  return { file, snapshot, previous, delta: previous ? snapshotDelta(snapshot, previous.snapshot) : null };
}

function main(argv = process.argv.slice(2)) {
  const repos = [];
  let sinceHours = null, date, dir;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--repo') repos.push(argv[++i]);
    else if (argv[i] === '--since-hours') sinceHours = Number(argv[++i]);
    else if (argv[i] === '--date') date = argv[++i];
    else if (argv[i] === '--dir') dir = path.resolve(argv[++i]);
  }
  if (sinceHours == null) {
    console.error('usage: benchmark-snapshot.mjs --since-hours N [--repo <repoRoot> ...] [--date YYYY-MM-DD] [--dir <snapshotsDir>] [--json]');
    process.exitCode = 2; return;
  }
  try {
    const result = takeSnapshot({ repos, sinceHours, ...(date ? { date } : {}), ...(dir ? { dir } : {}) });
    console.log(argv.includes('--json')
      ? JSON.stringify({ file: result.file, previous: result.previous?.file ?? null, delta: result.delta })
      : formatDelta(result));
  } catch (error) {
    console.error(String(error?.message ?? error));
    process.exitCode = error?.code === 'EUSAGE' ? 2 : 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
