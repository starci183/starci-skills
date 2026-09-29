#!/usr/bin/env node
// core-watch.mjs — the chat's continuous, READ-ONLY watch over the StarCi core while workflows run (skills/claude-debug).
//
//   node scripts/supervisor/core-watch.mjs                      one stdout line per CHANGE, every --interval seconds, forever
//   node scripts/supervisor/core-watch.mjs --once [--json]      one snapshot (all facts and alerts), then exit
//     [--interval <sec>]         default 60
//     [--child-timeout <sec>]    timeout of every child call (api status, boot --status, services --list), default 90
//     [--token-window <min>]     llm_usage window for the token-spike fact, default 10
//     [--token-spike <n>]        input+output tokens in that window that raise TOKENS, default 3000000 (0 disables)
//
// Facts (each is ok or an alert; a line prints only when a fact turns into an alert, changes its alert text, or recovers):
//   ENGINE    leader missing/STALE (heartbeat > 90 s), safe mode, a controller configured active but effective shadow/off
//   SERVICE   harness-ui local and public /healthz, harness-tunnel, ask-gateway, ask-tunnel, telegram-bridge, orca, every seat
//   WORKFLOW  per non-finished workflow of EVERY registered active ledger (no hard-coded ids): phase, legs turning
//             failed/blocked/cancelled, wedged / dead-worker / stale-operation / stuck jobs, open owner asks
//   TOKENS    input+output tokens of the last window above --token-spike (machine.sqlite llm_usage; there is no `api usage` verb)
//
// It never restarts, writes, dispatches or types into anything: machine.sqlite and every ledger are opened read-only, the
// only children are read-only verbs, every one with a timeout. Auto-restart made crash-loop safe mode worse; the fix path
// is a lane (skills/claude-debug). Suitable for a Monitor stream: stdout has lines only on change.
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HEARTBEAT_STALE_MS = 90_000;
const LEG_BAD = /failed|blocked|cancel/;

/* ------------------------------------------------------------ helpers */

/** A read-only child call that always ends: {ok, stdout, error}. Never throws. */
export function child(args, { timeoutMs, cwd = ROOT } = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, args, { cwd, encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => resolve({ ok: !error, stdout: stdout ?? '', error: error ? (error.killed ? `timeout ${Math.round(timeoutMs / 1000)}s` : `exit ${error.code}: ${String(stderr || error.message).trim().split('\n').filter(Boolean).pop()?.slice(0, 200)}`) : null }));
  });
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

const machineFile = () => path.join(process.env.STARCI_HOME ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'StarCi'), 'machine.sqlite');

function readOnly(file, fn) {
  let db;
  try { db = new DatabaseSync(file, { readOnly: true }); db.exec('PRAGMA query_only = ON'); return fn(db); } finally { try { db?.close(); } catch { /* read-only handle */ } }
}

async function httpProbe(url, timeoutMs) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    await r.arrayBuffer().catch(() => null);
    return r.status === 200 ? null : `HTTP ${r.status}`;
  } catch (e) { return e?.name === 'TimeoutError' ? `timeout ${Math.round(timeoutMs / 1000)}s` : `unreachable (${e?.cause?.code ?? e?.message ?? e})`.slice(0, 120); }
}

/* ------------------------------------------------------------ fact collectors: each returns Map<key, alertText|null> */

async function engineFacts(o) {
  const facts = new Map();
  const r = await child(['scripts/reconciler/boot.mjs', '--status', '--json'], o);
  const s = r.ok ? firstJson(r.stdout) : null;
  if (!s) { facts.set('engine', `status failed (${r.error ?? 'no json'})`); return facts; }
  const l = s.leader ?? {};
  const age = l.ageMs == null ? null : Math.round(l.ageMs / 1000);
  const problems = [];
  if (!l.holder) problems.push('NO LEADER');
  else if (!l.fresh || (l.ageMs ?? Infinity) > HEARTBEAT_STALE_MS) problems.push(`leader STALE heartbeat ${age ?? '?'}s`);
  if (l.safe) problems.push('SAFE MODE');
  if (s.ok === false) problems.push(`machine read failed: ${s.error}`);
  facts.set('engine', problems.length ? `${problems.join(', ')} | leader pid ${l.pid ?? '-'} epoch ${l.epoch ?? '-'} starts24h ${s.starts24h ?? '?'} start_reason ${l.startReason ?? '-'}` : null);
  const bad = Object.entries(s.modes ?? {}).filter(([, m]) => m.configured === 'active' && m.effective !== 'active');
  facts.set('engine-controllers', bad.length ? `configured active but running ${bad.map(([n, m]) => `${n}=${m.effective}`).join(' ')}` : null);
  facts.set('engine-queue', Object.values(s.queue ?? {}).some((q) => q.failing) ? `failing queue items: ${Object.entries(s.queue).filter(([, q]) => q.failing).map(([c, q]) => `${c} ${q.failing}`).join(' ')}` : null);
  return facts;
}

async function serviceFacts(o) {
  const facts = new Map();
  let ports = {};
  try { ports = (await import('../reconciler/services.mjs')).servicePorts(); } catch { /* reported below */ }
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
  const ledgers = readOnly(machineFile(), (m) => m.prepare("SELECT ledger_id, name, repo_root, file FROM ledgers WHERE state='active' ORDER BY name").all());
  for (const l of ledgers) {
    try {
      const wfs = readOnly(l.file, (db) => db.prepare("SELECT workflow_id, phase FROM workflows WHERE archived_at IS NULL AND phase NOT IN ('finished','archived') ORDER BY workflow_id").all());
      for (const w of wfs) out.push({ ledger: l.name, repo: l.repo_root, id: w.workflow_id, phase: w.phase });
    } catch { out.push({ ledger: l.name, repo: l.repo_root, id: null, phase: null, error: 'ledger unreadable' }); }
  }
  return out;
}

const statusFails = new Map();
let lastFacts = new Map();
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
    const r = await child(['scripts/kernel/api.mjs', 'status', '--repo', w.repo, '--workflow', w.id, '--json'], o);
    const j = r.ok || r.stdout ? firstJson(r.stdout) : null;
    if (!j) { // one failed call is noise; two in a row is a fact. The last known facts of this workflow stay meanwhile.
      const n = (statusFails.get(k) ?? 0) + 1; statusFails.set(k, n);
      facts.set(`${k}:status`, n >= 2 ? `api status failed ${n}x (${r.error ?? 'no json'})` : null);
      for (const [key, text] of lastFacts) if (key.startsWith(`${k}:`) && key !== `${k}:status`) facts.set(key, text);
      return;
    }
    statusFails.delete(k);
    facts.set(`${k}:status`, null);
    const f = j.frontier ?? {};
    for (const leg of j.legs ?? []) {
      const st = leg.status ?? leg.state;
      const lk = `${k}:leg:${leg.op ?? leg.opId}:${leg.jobId ?? ''}`;
      facts.set(lk, LEG_BAD.test(st ?? '') ? `${leg.op ?? leg.opId} ${st}` : null);
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
    const rows = readOnly(machineFile(), (m) => m.prepare('SELECT provider, COALESCE(SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)),0) AS t, COUNT(*) AS n FROM llm_usage WHERE at >= ? GROUP BY provider ORDER BY t DESC').all(now - o.tokenWindowMs));
    const total = rows.reduce((a, r) => a + Number(r.t), 0);
    facts.set('tokens', total > o.tokenSpike ? `${total} input+output tokens in ${Math.round(o.tokenWindowMs / 60000)} min (limit ${o.tokenSpike}); top ${rows.slice(0, 3).map((r) => `${r.provider} ${r.t}/${r.n} calls`).join(', ')}` : null);
  } catch (e) { facts.set('tokens', `llm_usage unreadable: ${String(e.message).slice(0, 100)}`); }
  return facts;
}

/* ------------------------------------------------------------ diff, output */

/** The lines one tick owes, given the previous alert map (mutated) and this tick's facts. */
export function diffFacts(prev, facts, { first = false } = {}) {
  const lines = [];
  for (const [key, text] of facts) {
    const before = prev.get(key) ?? null;
    if (text) { if (text !== before) lines.push(`[core-watch] ALERT ${key}: ${text}`); prev.set(key, text); }
    else { if (before && !first) lines.push(`[core-watch] OK ${key} (was: ${before})`); prev.delete(key); }
  }
  for (const key of [...prev.keys()]) if (!facts.has(key)) { lines.push(`[core-watch] GONE ${key} (was: ${prev.get(key)})`); prev.delete(key); }
  return lines;
}

async function collect(o) {
  const parts = await Promise.all([engineFacts(o), serviceFacts(o), workflowFacts(o), tokenFacts(o)].map((p) => Promise.resolve(p).catch((e) => new Map([['collector', `collector crashed: ${String(e?.message ?? e).slice(0, 120)}`]]))));
  lastFacts = new Map(parts.flatMap((m) => [...m]));
  return lastFacts;
}

function parseArgs(argv) {
  const val = (name, d) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] != null ? Number(argv[i + 1]) : d; };
  return { once: argv.includes('--once'), json: argv.includes('--json'), intervalMs: val('--interval', 60) * 1000, timeoutMs: val('--child-timeout', 90) * 1000,
    tokenWindowMs: val('--token-window', 10) * 60_000, tokenSpike: val('--token-spike', 3_000_000) };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log('usage: core-watch.mjs [--once [--json]] [--interval <sec>] [--child-timeout <sec>] [--token-window <min>] [--token-spike <n>]  (read-only)'); return; }
  const o = parseArgs(argv);
  const prev = new Map();
  if (o.once) {
    const facts = await collect(o);
    const alerts = [...facts].filter(([, t]) => t).map(([key, text]) => ({ key, text }));
    if (o.json) console.log(JSON.stringify({ at: new Date().toISOString(), ok: alerts.length === 0, alerts, facts: facts.size }));
    else console.log(alerts.length ? alerts.map((a) => `[core-watch] ALERT ${a.key}: ${a.text}`).join('\n') : `[core-watch] OK (${facts.size} facts, no alert)`);
    return;
  }
  let first = true;
  for (;;) {
    const started = Date.now();
    try { for (const line of diffFacts(prev, await collect(o), { first })) console.log(line); } catch (e) { console.log(`[core-watch] ALERT watcher: ${String(e?.message ?? e).slice(0, 160)}`); }
    if (first) { console.log(`[core-watch] baseline done, ${prev.size} alert(s) open; printing changes only`); first = false; }
    await new Promise((r) => setTimeout(r, Math.max(1000, o.intervalMs - (Date.now() - started))));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
