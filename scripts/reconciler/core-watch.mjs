#!/usr/bin/env node
// starci debug run core-watch — one READ-ONLY snapshot of the StarCi core: every fact, every open alert, then exit.
//
//   starci debug run core-watch [--json]
//     [--child-timeout <sec>]    timeout of every child call (starci kernel status, services --list), default 90
//     [--token-window <min>]     llm_usage window for the token-spike fact, default 10
//     [--token-spike <n>]        input+output tokens in that window that raise TOKENS, default 3000000 (0 disables)
//
// Facts (each is ok or an alert):
//   ENGINE    leader missing/STALE (heartbeat > 90 s), safe mode, a controller configured active but effective shadow/off
//   SERVICE   harness-ui local and public /healthz, harness-tunnel, ask-gateway, ask-tunnel, telegram-bridge, orca, every seat
//   WORKFLOW  per non-finished workflow of EVERY registered active ledger (no hard-coded ids): phase, legs turning
//             failed/blocked/cancelled, wedged / dead-worker / stale-operation / stuck jobs, open owner asks
//   TOKENS    input+output tokens of the last window above --token-spike (machine.sqlite llm_usage; there is no `starci kernel usage` verb)
//   LEDGER    a registered ledger whose state directory or every source root is gone (hk-orphan-ledgers)
//   WORKTREE  per repository (the runtime and every active ledger's repo), from Orca's `worktree ps`: more than
//             coreDebug.worktreeLimit worktrees, a tree whose directory is gone, or a tree carrying the runtime's
//             ownership stamp with no registry row (the GC adopts or removes it)
//   INTEGRITY the runtime's main checkout: tracked files deleted, node_modules or packages/node_modules missing or empty
//   GATE      in the last day: a lane whose latest land run did not pass, a repository whose latest push failed
//   CONFIG    config.yaml coreDebug missing or invalid
//
// It never restarts, writes, dispatches or types into anything: machine.sqlite and every ledger are opened read-only, the
// only children are read-only verbs, every one with a timeout. Auto-restart made crash-loop safe mode worse; the fix path
// is a lane. Repetition is the caller's verified native scheduler over scripts/reconciler/debug-pass.mjs (skills/debug), never a
// scheduler in this script.
import fs from 'node:fs';
import path from 'node:path';
import { execNode } from '../api/node/exec-node.mjs';
import { fileURLToPath } from 'node:url';
import { probe } from '../api/http/probe.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { coreDebugSettings } from '../../engine/config.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { worktreeListQuery } from '../api/git/worktree-list-query.mjs';
import { gitResultOf } from '../lib/git.mjs';
import { parseWorktreeList } from '../housekeeping/hk-lanes.mjs';
import { orphanLedgerFindings } from '../housekeeping/hk-orphan-ledgers.mjs';
import { parseRuntimeStamp } from '../lib/orca-orphans.mjs';
import { worktreePs } from '../api/orca/worktree-ps.mjs';
import { CONTROLLER_NAMES, LEADER_NAME, configuredMode, reconcilerConfig, reconcilerNumbers } from './state.mjs';
import { isMain } from '../lib/is-main.mjs';
import { sameResolvedPath } from '../lib/path-key.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HEARTBEAT_STALE_MS = 90_000;
const LEG_BAD = /failed|blocked|cancel/;

/* ------------------------------------------------------------ helpers */

/** A read-only child call that always ends: {ok, stdout, error}. Never throws. */
export function child(args, { timeoutMs, cwd = ROOT } = {}) {
  return execNode(args, { cwd, timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 })
    .then(({ error, stdout, stderr }) => ({ ok: !error, stdout: stdout ?? '', error: error ? (error.killed ? `timeout ${Math.round(timeoutMs / 1000)}s` : `exit ${error.code}: ${String(stderr || error.message).trim().split('\n').filter(Boolean).pop()?.slice(0, 200)}`) : null }));
}

/** The first balanced JSON object in text (a verb may print a banner before it), or null. */
export function firstJson(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
}

async function httpProbe(url, timeoutMs) {
  const r = await probe(url, { timeoutMs });
  if (r.state === 'answered') return r.status === 200 ? null : `HTTP ${r.status}`;
  return r.state === 'hung' || r.code === 'CONNECT_TIMEOUT' ? `timeout ${Math.round(timeoutMs / 1000)}s` : `unreachable (${r.code})`.slice(0, 120);
}

/* ------------------------------------------------------------ fact collectors: each returns Map<key, alertText|null> */

/** The leader row, controller modes and failing queue, read through the machine reader (never boot.mjs --status text). */
function readEngine() {
  return readMachine((m) => {
    // One query failing (an older live schema lacks a column a newer reader expects) must not blind the others.
    const q = (sql, args, one, fallback) => { try { const st = m.db.prepare(sql); return one ? st.get(...args) ?? fallback : st.all(...args); } catch { return fallback; } };
    const leader = q('SELECT * FROM engine_leader WHERE name=?', [LEADER_NAME], true, null);
    const run = leader?.process_run_id != null ? q('SELECT start_reason FROM process_runs WHERE run_id=?', [leader.process_run_id], true, null) : null;
    const safe = q("SELECT controller FROM controller_modes WHERE reason LIKE 'safe mode%'", [], false, []).map((r) => r.controller);
    const modes = Object.fromEntries(q('SELECT controller, mode FROM controller_modes', [], false, []).map((r) => [r.controller, r.mode]));
    const failing = q('SELECT controller, COUNT(*) AS n FROM engine_queue WHERE tries>0 GROUP BY controller', [], false, []);
    return { leader, run, safe, modes, failing };
  }, undefined);
}

async function engineFacts() {
  const facts = new Map();
  let s;
  try { s = readEngine(); } catch (e) { s = null; facts.set('engine', `machine.sqlite unreadable: ${String(e.message).slice(0, 120)}`); return facts; }
  if (!s) { facts.set('engine', 'machine.sqlite missing'); return facts; }
  const l = s.leader;
  const ageMs = l ? Date.now() - Number(l.heartbeat_at) : null;
  const problems = [];
  if (!l) problems.push('NO LEADER');
  else if (ageMs > HEARTBEAT_STALE_MS) problems.push(`leader STALE heartbeat ${Math.round(ageMs / 1000)}s`);
  if (s.safe.length) problems.push('SAFE MODE');
  facts.set('engine', problems.length ? `${problems.join(', ')} | leader pid ${l?.pid ?? '-'} epoch ${l?.epoch ?? '-'} start_reason ${s.run?.start_reason ?? '-'} last_pass_ms ${l?.last_pass_ms ?? '-'}` : null);
  const config = reconcilerConfig();
  const fresh = l && ageMs <= HEARTBEAT_STALE_MS;
  const bad = [...new Set([...CONTROLLER_NAMES, ...Object.keys(s.modes)])].map((n) => [n, configuredMode(n, config), fresh ? s.modes[n] ?? 'off' : 'off']).filter(([, c, e]) => c === 'active' && e !== 'active');
  facts.set('engine-controllers', bad.length ? `configured active but running ${bad.map(([n, , e]) => `${n}=${e}`).join(' ')}` : null);
  facts.set('engine-queue', s.failing.length ? `failing queue items: ${s.failing.map((q) => `${q.controller} ${q.n}`).join(' ')}` : null);
  return facts;
}

async function serviceFacts(o) {
  const facts = new Map();
  let ports = {};
  try { ports = (await import('./services.mjs')).servicePorts(); } catch { /* reported below */ }
  const probes = [];
  if (ports.harnessUrl) probes.push(['service:harness-ui-local', `${ports.harnessUrl}/healthz`]);
  else facts.set('service:harness-ui-local', 'no harness port resolved');
  if (ports.harnessPublicUrl) probes.push(['service:harness-ui-public', `${ports.harnessPublicUrl}/healthz`]);
  for (const p of ports.problems ?? []) facts.set(`service:ports:${p.slice(0, 20)}`, p);
  await Promise.all(probes.map(async ([key, url]) => facts.set(key, await httpProbe(url, Math.min(o.timeoutMs, 15_000)))));
  const r = await child(['scripts/reconciler/services.mjs', '--list', '--json'], o);
  const rows = r.ok ? firstJson(r.stdout)?.rows : null;
  if (!rows) { facts.set('service:list', `services --list failed (${r.error ?? 'no json'})`); return facts; }
  for (const row of rows) {
    if (row.name.startsWith('ledger:') || row.name.startsWith('sched-task:')) continue;
    const okState = row.name.startsWith('seat:') ? row.state === 'live' : row.state === 'healthy';
    const probe = row.lastProbe ?? {};
    facts.set(`service:${row.name}`, okState ? null : `${row.state}${probe.error ? ` (${String(probe.error).slice(0, 100)})` : ''}${row.failStreak ? ` failStreak ${row.failStreak}` : ''}`);
  }
  return facts;
}

function runningWorkflows() {
  const out = [];
  const ledgers = readMachine((m) => m.db.prepare("SELECT name, repo_root, file FROM ledgers WHERE state='active' ORDER BY name").all(), []);
  for (const l of ledgers) {
    let db = null;
    try {
      db = openLedgerReader(l.file);
      for (const w of db.prepare("SELECT workflow_id, phase FROM workflows WHERE archived_at IS NULL AND phase NOT IN ('finished','archived') ORDER BY workflow_id").all()) out.push({ ledger: l.name, repo: l.repo_root, id: w.workflow_id, phase: w.phase });
    } catch { out.push({ ledger: l.name, repo: l.repo_root, id: null, phase: null, error: 'ledger unreadable' }); }
    finally { try { db?.close(); } catch { /* closed */ } }
  }
  return out;
}

const short = (id) => String(id).replace(/^wf-/, '').replace(/-mu\w+$/, '');
const count = (a) => (Array.isArray(a) ? a.length : 0);

async function workflowFacts(o) {
  const facts = new Map();
  let list;
  try { list = runningWorkflows(); } catch (e) { facts.set('workflows', `registry unreadable: ${String(e.message).slice(0, 120)}`); return facts; }
  await Promise.all(list.map(async (w) => {
    if (!w.id) { facts.set(`wf:${w.ledger}`, w.error); return; }
    const k = `wf:${w.ledger}:${short(w.id)}`;
    if (w.phase !== 'running') { facts.set(`${k}:phase`, w.phase === 'paused' || w.phase === 'queued' ? null : `phase ${w.phase}`); return; }
    // One failed call is noise; the snapshot asks twice and only two failures in a row are a fact.
    const ask = () => child(['scripts/kernel/cli.mjs', 'status', '--repo', w.repo, '--workflow', w.id, '--json'], o);
    const parse = (r) => (r.ok || r.stdout ? firstJson(r.stdout) : null);
    let r = await ask();
    let j = parse(r);
    if (!j) { r = await ask(); j = parse(r); }
    if (!j) { facts.set(`${k}:status`, `starci kernel status failed 2x (${r.error ?? 'no json'})`); return; }
    facts.set(`${k}:status`, null);
    const f = j.frontier ?? {};
    for (const leg of j.legs ?? []) {
      const st = leg.status ?? leg.state;
      const lk = `${k}:leg:${leg.op ?? leg.opId}:${leg.jobId ?? ''}`;
      // The leg's why (scripts/kernel/why.mjs): the owner-facing headline after the raw state.
      facts.set(lk, LEG_BAD.test(st ?? '') ? `${leg.op ?? leg.opId} ${st}${leg.why?.headline ? ` - ${leg.why.headline}` : ''}` : null);
    }
    const counts = { wedged: count(f.wedgedJobs), dead: count(f.deadWorkerJobs), stale: count(f.staleOperations), stuck: count(j.stuck), owner: count(j.awaitingOwner), held: count(f.heldSettleJobs) + count(f.heldWorkerJobs) };
    const ids = (a, key) => (Array.isArray(a) ? a.slice(0, 3).map((x) => (typeof x === 'string' ? x : x?.[key] ?? x?.jobId ?? x?.id ?? x?.opId ?? '?')).join(',') : '');
    const detail = { wedged: ids(f.wedgedJobs, 'jobId'), dead: ids(f.deadWorkerJobs, 'jobId'), stale: ids(f.staleOperations, 'opId'), stuck: ids(j.stuck, 'jobId'), owner: ids(j.awaitingOwner, 'id'), held: '' };
    for (const [name, n] of Object.entries(counts)) facts.set(`${k}:${name}`, n ? `${name}=${n}${detail[name] ? ` [${detail[name]}]` : ''}` : null);
  }));
  return facts;
}

function tokenFacts(o) {
  const facts = new Map();
  if (!(o.tokenSpike > 0)) return facts;
  try {
    const now = Date.now();
    const rows = readMachine((m) => m.db.prepare('SELECT provider, COALESCE(SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)),0) AS t, COUNT(*) AS n FROM llm_usage WHERE at >= ? GROUP BY provider ORDER BY t DESC').all(now - o.tokenWindowMs), []);
    const total = rows.reduce((a, r) => a + Number(r.t), 0);
    facts.set('tokens', total > o.tokenSpike ? `${total} input+output tokens in ${Math.round(o.tokenWindowMs / 60000)} min (limit ${o.tokenSpike}); top ${rows.slice(0, 3).map((r) => `${r.provider} ${r.t}/${r.n} calls`).join(', ')}` : null);
  } catch (e) { facts.set('tokens', `llm_usage unreadable: ${String(e.message).slice(0, 100)}`); }
  return facts;
}

/** Every registered ledger that lost its state directory or every source root (scripts/housekeeping/hk-orphan-ledgers.mjs, read only). */
function ledgerFacts() {
  const facts = new Map();
  for (const f of orphanLedgerFindings()) facts.set(`ledger:orphan:${f.ledgerId}`, `${f.registered ? 'registered' : 'unregistered'} ledger ${f.name ?? f.ledgerId} ${f.reason} (${f.file})`);
  return facts;
}

/** `git worktree list` of `repo` as [{path, branch, prunable, ...}], or null when git refuses. */
function worktreesOf(repo) {
  const r = gitResultOf(worktreeListQuery(['--porcelain'], { cwd: repo }));
  return r.ok ? parseWorktreeList(r.stdout) : null;
}

/** The Orca ids of every live registry row (machine.sqlite worktrees, read only). */
const registeredOrcaIds = () => new Set(readMachine((m) => m.db.prepare('SELECT orca_id FROM worktrees WHERE orca_id IS NOT NULL AND removed_at IS NULL').all().map((r) => r.orca_id), []));


/**
 * Worktree count and orphans per repository (the runtime and every active ledger's repo), from Orca's `worktree ps`
 * (the source of truth for worktrees): more than `worktreeLimit` worktrees, a tree whose directory is gone, or a tree
 * stamped as the runtime's (scripts/lib/orca-orphans.mjs) with no live registry row. A repository Orca does not know has
 * no Orca tree to judge. Read only. `worktreeLimit` null (config.yaml has no coreDebug block) checks orphans only.
 */
export function worktreeFacts(repos, { worktreeLimit = null, ps = worktreePs, registered = registeredOrcaIds, exists = fs.existsSync } = {}) {
  const facts = new Map();
  const page = ps();
  if (!page?.ok) { facts.set('worktrees:orca', `orca worktree ps failed: ${String(page?.error ?? 'no answer').slice(0, 160)}`); return facts; }
  facts.set('worktrees:orca', null);
  const ids = registered();
  for (const repo of repos) {
    const key = `worktrees:${path.basename(repo)}`;
    const main = page.worktrees.find((w) => w.isMainWorktree && w.path && sameResolvedPath(w.path, repo));
    const list = main ? page.worktrees.filter((w) => w.repoId === main.repoId && w.hostId === main.hostId) : [];
    const gone = list.filter((w) => !exists(w.path)).map((w) => w.path);
    const unbound = list.filter((w) => !w.isMainWorktree && parseRuntimeStamp(w.comment) && !ids.has(w.id)).map((w) => w.path);
    const problems = [];
    if (worktreeLimit != null && list.length > worktreeLimit) problems.push(`${list.length} worktrees (limit ${worktreeLimit})`);
    if (gone.length) problems.push(`${gone.length} orphan (directory gone): ${gone.slice(0, 3).join(', ')}`);
    if (unbound.length) problems.push(`${unbound.length} runtime-stamped tree(s) with no registry row: ${unbound.slice(0, 3).join(', ')}`);
    facts.set(key, problems.length ? problems.join('; ') : null);
  }
  return facts;
}

/** Entries in `dir`: a number, or null when the directory is missing or unreadable. */
function entryCount(dir) { try { return fs.readdirSync(dir).length; } catch { return null; } }

/**
 * Main-checkout integrity of the runtime repository checkout `main`: tracked files deleted from the working tree (a
 * worktree removal through a junction empties it), and node_modules / packages/node_modules missing or empty. Read only.
 */
export function integrityFacts(main, { git = (args, opts) => gitResultOf(lsFiles(args, opts)) } = {}) {
  const facts = new Map();
  const deleted = git(['--deleted'], { cwd: main });
  if (!deleted.ok) facts.set('integrity:tracked-deleted', `git ls-files --deleted failed in ${main}: ${deleted.error}`);
  else {
    const files = deleted.stdout.split(/\r?\n/).filter(Boolean);
    facts.set('integrity:tracked-deleted', files.length ? `${files.length} tracked file(s) deleted in the main checkout ${main} (${files.slice(0, 3).join(', ')}${files.length > 3 ? ', ...' : ''})` : null);
  }
  for (const rel of ['node_modules', 'packages/node_modules']) {
    const n = entryCount(path.join(main, rel));
    facts.set(`integrity:${rel}`, n == null ? `${rel} is missing in the main checkout ${main}` : n === 0 ? `${rel} is empty in the main checkout ${main}` : null);
  }
  return facts;
}

/** The runtime repository's main checkout (first `git worktree list` entry) and every active ledger's repo root. */
function inspectedRepos() {
  const main = path.resolve(worktreesOf(ROOT)?.[0]?.path ?? ROOT);
  const ledgerRepos = readMachine((m) => m.db.prepare("SELECT DISTINCT repo_root FROM ledgers WHERE state='active' AND repo_root IS NOT NULL").all().map((r) => path.resolve(r.repo_root)), []);
  const repos = new Map([main, ...ledgerRepos].map((r) => [r.toLowerCase(), r]));
  return { main, repos: [...repos.values()] };
}

/** Failing gates of the last day: a lane whose latest land run did not pass, a repository whose latest push failed. */
function gateFacts() {
  const facts = new Map();
  const since = Date.now() - 24 * 3_600_000;
  const rows = readMachine((m) => {
    const q = (sql) => { try { return m.db.prepare(sql).all(since); } catch { return []; } };
    return {
      lands: q('SELECT lane, result, reason, commit_sha FROM land_runs r WHERE started_at >= ? AND run_id = (SELECT MAX(run_id) FROM land_runs WHERE lane IS r.lane)'),
      pushes: q('SELECT repo_root, result, reason FROM pushes p WHERE at >= ? AND push_id = (SELECT MAX(push_id) FROM pushes WHERE repo_root = p.repo_root)'),
    };
  }, { lands: [], pushes: [] });
  for (const l of rows.lands) if (l.result !== 'passed') facts.set(`gate:land:${l.lane ?? '-'}`, `land ${l.result} at ${String(l.commit_sha).slice(0, 9)}${l.reason ? `: ${String(l.reason).slice(0, 140)}` : ''}`);
  for (const p of rows.pushes) if (p.result === 'failed' || p.result === 'refused') facts.set(`gate:push:${path.basename(p.repo_root)}`, `push ${p.result}${p.reason ? `: ${String(p.reason).slice(0, 140)}` : ''}`);
  return facts;
}

/** config.yaml coreDebug for this tick; a missing or invalid block is itself an alert (the worktree limit is then skipped). */
function debugSettings(facts) {
  try { const s = coreDebugSettings(); facts.set('config:coreDebug', null); return s; } catch (e) { facts.set('config:coreDebug', String(e.message).slice(0, 200)); return { worktreeLimit: null }; }
}

function hostFacts() {
  const facts = new Map();
  const settings = debugSettings(facts);
  const { main, repos } = inspectedRepos();
  for (const part of [integrityFacts(main), worktreeFacts(repos, { worktreeLimit: settings.worktreeLimit }), ledgerFacts(), gateFacts()]) for (const [k, v] of part) facts.set(k, v);
  return facts;
}

/* ------------------------------------------------------------ snapshot, output */

/** Every fact of the core now: Map<key, alertText|null>. A crashed collector is itself an alert. */
async function collect(o) {
  const collectors = { engine: engineFacts, services: () => serviceFacts(o), workflows: () => workflowFacts(o), tokens: () => tokenFacts(o), host: hostFacts };
  const parts = await Promise.all(Object.entries(collectors).map(([name, run]) => Promise.resolve().then(run).catch((e) => new Map([[`collector:${name}`, `collector crashed: ${String(e?.message ?? e).slice(0, 120)}`]]))));
  return new Map(parts.flatMap((m) => [...m]));
}

/** The watch options from argv (defaults when absent). */
export function watchOptions(argv = []) {
  const val = (name, d) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] != null ? Number(argv[i + 1]) : d; };
  return { timeoutMs: val('--child-timeout', 90) * 1000, tokenWindowMs: val('--token-window', 10) * 60_000, tokenSpike: val('--token-spike', 3_000_000) };
}

/** One read-only snapshot: {at, ok, alerts: [{key, text}], facts: <count>}. */
export async function snapshot(o = watchOptions()) {
  const facts = await collect(o);
  const alerts = [...facts].filter(([, t]) => t).map(([key, text]) => ({ key, text }));
  return { at: new Date().toISOString(), ok: alerts.length === 0, alerts, facts: facts.size };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log('usage: starci debug run core-watch [--json] [--child-timeout <sec>] [--token-window <min>] [--token-spike <n>] (one read-only snapshot)'); return; }
  const snap = await snapshot(watchOptions(argv));
  if (argv.includes('--json')) console.log(JSON.stringify(snap));
  else console.log(snap.alerts.length ? snap.alerts.map((a) => `[core-watch] ALERT ${a.key}: ${a.text}`).join('\n') : `[core-watch] OK (${snap.facts} facts, no alert)`);
}

if (isMain(import.meta.url)) await main();
