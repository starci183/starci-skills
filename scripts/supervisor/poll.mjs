#!/usr/bin/env node
// poll.mjs — chat-facing supervisor: one ledger digest per interval, forever.
// Designed to run FOREGROUND inside a monitoring chat — the chat agent reads
// this process's stdout between cycles and relays what changed. It is a pure
// observer: reads the durable ledger + Orca terminal liveness, never writes,
// never dispatches, never repairs (that is watchdog.mjs's lane).
//
//   node scripts/supervisor/poll.mjs --repo <ledger-owner>
//       [--workflow <id>]...   default: every non-finished workflow
//       [--interval-ms <ms>] [--once] [--json]
//
// DEFAULT_INTERVAL_MS is the supervisor cadence's one authority;
// modules/supervisor/supervise.yaml cites this file instead of restating it.
//
// Each cycle prints: new op reports since the last cycle, open asks with
// their serving URLs, direction artifacts newer than the last cycle, and
// kernel terminal liveness. First cycle prints the current state as baseline.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { classifyAgentScreen } from '../kernel/terminal-liveness.mjs';

export const DEFAULT_INTERVAL_MS = 180000;
// The digest's first cycle has no previous cycle to diff against: it prints
// this many trailing reports so the chat starts from a state, not a blank.
export const BASELINE_REPORTS = 8;

const short = (wf) => wf.replace(/^wf-/, '').replace(/-[a-z0-9]{8}$/i, '');
const ts = (ms) => new Date(ms).toISOString().slice(11, 19);
const mine = (wanted, workflowId) => !wanted.size || wanted.has(workflowId);

// --- ledger projections -----------------------------------------------------
export const workflows = (db, wanted = new Set()) =>
  db.prepare("SELECT workflow_id, phase FROM workflows WHERE phase != 'finished' ORDER BY workflow_id").all()
    .filter((w) => mine(wanted, w.workflow_id));

// Filter in SQL, never after a LIMIT: a cycle that saw more than a page of
// reports would otherwise drop the oldest of them and skip past their ids
// forever.
export const reportsSince = (db, sinceId, wanted = new Set()) =>
  db.prepare('SELECT report_id, workflow_id, op_id, attempt, outcome, created_at FROM reports WHERE report_id > ? ORDER BY report_id')
    .all(sinceId)
    .filter((r) => mine(wanted, r.workflow_id));

// How long a form URL gets to answer before the digest calls it stale. The
// probe is a courtesy to the owner, not a health check: a loopback form that
// cannot answer in this window is not worth relaying either way.
export const PROBE_TIMEOUT_MS = 1500;

// events.event_id is a random token; seq is the order. Latest means highest seq.
const lastEvent = (db, kind, dispatchId) => db.prepare(
  `SELECT seq, payload_json FROM events WHERE kind=?
     AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(kind, dispatchId);

const probe = async (url, timeoutMs) => {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    return res.status >= 200 && res.status < 300 ? 'live' : 'stale';
  } catch { return 'stale'; }
};

// An open ask's URL is worth relaying only when it still answers. The ledger
// already knows when a form server gave up (serve-ask.mjs appends
// 'ask-serving-expired'), so a dead ask costs no network at all; everything
// else is probed once per cycle.
export const askLiveness = async (db, dispatchId, { timeoutMs = PROBE_TIMEOUT_MS } = {}) => {
  const serving = lastEvent(db, 'ask-serving', dispatchId);
  if (!serving) return { url: null, liveness: 'unserved' };
  const url = JSON.parse(serving.payload_json ?? '{}').url ?? null;
  const expired = lastEvent(db, 'ask-serving-expired', dispatchId);
  if (expired && expired.seq > serving.seq) return { url, liveness: 'dead' };
  if (!url) return { url: null, liveness: 'unserved' };
  return { url, liveness: await probe(url, timeoutMs) };
};

export const openAsks = async (db, wanted = new Set(), { timeoutMs = PROBE_TIMEOUT_MS } = {}) => {
  const asks = db.prepare(
    `SELECT r.workflow_id, r.dispatch_id, r.report_id, r.created_at FROM reports r
      WHERE r.outcome='ask' AND NOT EXISTS (
        SELECT 1 FROM events e WHERE e.workflow_id=r.workflow_id AND e.kind='ask-answered'
          AND json_extract(e.payload_json,'$.dispatchId')=r.dispatch_id)
      ORDER BY r.report_id DESC`).all();
  const seen = new Set(); const out = [];
  for (const a of asks) {
    if (seen.has(a.dispatch_id) || !mine(wanted, a.workflow_id)) continue;
    seen.add(a.dispatch_id);
    out.push({ ...a, ...(await askLiveness(db, a.dispatch_id, { timeoutMs })) });
  }
  return out;
};

export const kernelState = (db, wf) => {
  const sig = db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(wf);
  const terminal = JSON.parse(sig?.value_json ?? '{}').terminal;
  if (!terminal) return { terminal: null, state: 'no-signal' };
  try {
    const sh = terminalShow({ terminal });
    if (!sh?.ok || sh.connected !== true) return { terminal, state: 'dead' };
    const rd = terminalRead({ terminal, screen: true });
    return { terminal, state: rd?.ok ? classifyAgentScreen(rd.screen).state : 'unknown' };
  } catch { return { terminal, state: 'unreachable' }; }
};

// Newest direction/artifact images under .starciwork, bounded walk.
export const newArtifacts = (repo, sinceMs) => {
  const root = path.join(repo, '.starciwork');
  const found = [];
  const queue = [root]; let head = 0, visited = 0;
  while (head < queue.length && visited++ < 6000) {
    const dir = queue[head++];
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== 'kernel-strays') queue.push(p); continue; }
      if (!/\.(png|jpe?g|webp)$/i.test(e.name)) continue;
      try { const st = fs.statSync(p); if (st.mtimeMs > sinceMs) found.push({ path: p, mtime: st.mtimeMs }); } catch { /* skip */ }
    }
  }
  return found.sort((a, b) => b.mtime - a.mtime).slice(0, 12);
};

// --- the cycle ---------------------------------------------------------------
export const cycle = async (db, { repo, wanted = new Set(), state, timeoutMs = PROBE_TIMEOUT_MS }) => {
  const lines = [`===== poll ${ts(Date.now())} =====`];
  const wfs = workflows(db, wanted);
  for (const w of wfs) {
    const k = kernelState(db, w.workflow_id);
    lines.push(`${short(w.workflow_id)} [${w.phase}] kernel ${k.state} ${k.terminal ?? ''}`);
  }
  const reps = reportsSince(db, state.first ? state.lastReportId - BASELINE_REPORTS : state.lastReportId, wanted);
  for (const r of reps) lines.push(`  report ${short(r.workflow_id)} ${r.op_id} a${r.attempt} -> ${r.outcome} @${ts(r.created_at)}`);
  if (reps.length) state.lastReportId = Math.max(state.lastReportId, ...reps.map((r) => r.report_id));
  const asks = await openAsks(db, wanted, { timeoutMs });
  for (const a of asks) lines.push(`  ASK-OPEN ${short(a.workflow_id)} ${a.dispatch_id} [${a.liveness}] ${a.url ?? '(not serving)'}`);
  const arts = newArtifacts(repo, state.lastArtifacts);
  for (const a of arts) lines.push(`  artifact+ ${path.relative(repo, a.path)}`);
  if (arts.length) state.lastArtifacts = Date.now();
  state.first = false;
  return { text: lines.join('\n'), workflows: wfs, asks, reports: reps };
};

const main = () => {
  const argv = process.argv.slice(2);
  const valuesOf = (name) => { const out = []; for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}`) out.push(argv[++i]); return out; };
  const valueOf = (name, d = null) => valuesOf(name).pop() ?? d;
  const has = (n) => argv.includes(`--${n}`);

  const repo = path.resolve(valueOf('repo') ?? '.');
  const intervalMs = Number(valueOf('interval-ms', DEFAULT_INTERVAL_MS));
  const once = has('once');
  const asJson = has('json');
  const wanted = new Set(valuesOf('workflow'));

  const ledger = openLedger({ file: ledgerFileFor(repo) });
  const db = ledger.db;
  const state = {
    lastReportId: db.prepare('SELECT COALESCE(MAX(report_id),0) m FROM reports').get().m,
    lastArtifacts: Date.now(),
    first: true,
  };
  const run = async () => {
    const out = await cycle(db, { repo, wanted, state });
    if (asJson) console.log(JSON.stringify({ at: Date.now(), workflows: out.workflows.map((w) => w.workflow_id), asks: out.asks }, null, 0));
    console.log(out.text);
  };
  return run().then(() => {
    if (once) { ledger.close(); return; }
    const timer = setInterval(run, intervalMs);
    process.on('SIGINT', () => { clearInterval(timer); process.exit(0); });
  });
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
