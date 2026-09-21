#!/usr/bin/env node
// poll.mjs — chat-facing supervisor: one ledger digest per interval, forever.
// Designed to run FOREGROUND inside a monitoring chat — the chat agent reads
// this process's stdout between cycles and relays what changed. It is a pure
// observer: reads the durable ledger + Orca terminal liveness, never writes,
// never dispatches, never repairs (that is watchdog.mjs's lane).
//
//   node .claude/modules/supervisor/poll.mjs --repo <ledger-owner>
//       [--workflow <id>]...   default: every non-finished workflow
//       [--interval-ms 180000] [--once] [--json]
//
// Each cycle prints: new op reports since the last cycle, open asks with
// their serving URLs, direction artifacts newer than the last cycle, and
// kernel terminal liveness. First cycle prints the current state as baseline.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { terminalRead } from '../../scripts/api/orca/terminal-read.mjs';
import { terminalShow } from '../../scripts/api/orca/terminal-show.mjs';
import { classifyAgentScreen } from '../../scripts/kernel/terminal-liveness.mjs';

const argv = process.argv.slice(2);
const valuesOf = (name) => { const out = []; for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}`) out.push(argv[++i]); return out; };
const valueOf = (name, d = null) => valuesOf(name).pop() ?? d;
const has = (n) => argv.includes(`--${n}`);

const repo = path.resolve(valueOf('repo') ?? '.');
const intervalMs = Number(valueOf('interval-ms', 180000));
const once = has('once');
const asJson = has('json');
const wanted = new Set(valuesOf('workflow'));

const ledger = openLedger({ file: ledgerFileFor(repo) });
const db = ledger.db;

const short = (wf) => wf.replace(/^wf-/, '').replace(/-[a-z0-9]{8}$/i, '');
const ts = (ms) => new Date(ms).toISOString().slice(11, 19);

// --- ledger projections -----------------------------------------------------
const workflows = () =>
  db.prepare("SELECT workflow_id, phase FROM workflows WHERE phase != 'finished' ORDER BY workflow_id").all()
    .filter((w) => !wanted.size || wanted.has(w.workflow_id));

const reportsSince = (sinceId) =>
  db.prepare("SELECT report_id, workflow_id, op_id, attempt, outcome, created_at FROM reports ORDER BY report_id DESC LIMIT 30").all()
    .filter((r) => r.report_id > sinceId && (!wanted.size || wanted.has(r.workflow_id)));

const openAsks = () => {
  const asks = db.prepare(
    `SELECT r.workflow_id, r.dispatch_id, r.report_id, r.created_at FROM reports r
      WHERE r.outcome='ask' AND NOT EXISTS (
        SELECT 1 FROM events e WHERE e.workflow_id=r.workflow_id AND e.kind='ask-answered'
          AND json_extract(e.payload_json,'$.dispatchId')=r.dispatch_id)
      ORDER BY r.report_id DESC`).all();
  const seen = new Set(); const out = [];
  for (const a of asks) {
    if (seen.has(a.dispatch_id) || (wanted.size && !wanted.has(a.workflow_id))) continue;
    seen.add(a.dispatch_id);
    const serving = db.prepare(
      `SELECT payload_json FROM events WHERE kind='ask-serving'
        AND json_extract(payload_json,'$.dispatchId')=? ORDER BY event_id DESC LIMIT 1`).get(a.dispatch_id);
    out.push({ ...a, url: JSON.parse(serving?.payload_json ?? '{}').url ?? null });
  }
  return out;
};

const kernelState = (wf) => {
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
const newArtifacts = (sinceMs) => {
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
let lastReportId = db.prepare('SELECT COALESCE(MAX(report_id),0) m FROM reports').get().m;
let lastArtifacts = Date.now();
let first = true;

const cycle = () => {
  const lines = [`===== poll ${ts(Date.now())} =====`];
  const wfs = workflows();
  for (const w of wfs) {
    const k = kernelState(w.workflow_id);
    lines.push(`${short(w.workflow_id)} [${w.phase}] kernel ${k.state} ${k.terminal ?? ''}`);
  }
  const reps = reportsSince(first ? lastReportId - 8 : lastReportId);
  for (const r of reps.reverse()) lines.push(`  report ${short(r.workflow_id)} ${r.op_id} a${r.attempt} -> ${r.outcome} @${ts(r.created_at)}`);
  if (reps.length) lastReportId = Math.max(lastReportId, ...reps.map((r) => r.report_id));
  const asks = openAsks();
  for (const a of asks) lines.push(`  ASK-OPEN ${short(a.workflow_id)} ${a.dispatch_id} ${a.url ?? '(not serving)'}`);
  const arts = newArtifacts(lastArtifacts);
  for (const a of arts) lines.push(`  artifact+ ${path.relative(repo, a.path)}`);
  if (arts.length) lastArtifacts = Date.now();
  if (first) first = false;
  const text = lines.join('\n');
  if (asJson) console.log(JSON.stringify({ at: Date.now(), workflows: wfs.map((w) => w.workflow_id), asks }, null, 0));
  console.log(text);
};

cycle();
if (!once) {
  const timer = setInterval(cycle, intervalMs);
  process.on('SIGINT', () => { clearInterval(timer); process.exit(0); });
}
