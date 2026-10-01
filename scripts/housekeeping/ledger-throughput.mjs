#!/usr/bin/env node
// ledger-throughput.mjs — load test of the ledger write path with typed logging (owner ruling 2026-09-27: 20 concurrent
// ops + 9 kernels logging must not slow ledger writes). Spawns N writer PROCESSES against a temp ledger; each loops
// for --seconds doing an enqueue-like transaction (a queued job + its event) and a settle-like one (the job settled +
// its event), each timed, and a burst of typed log rows between them, then reports ledger-write latency (p50/p95/p99,
// max), transactions/s, log rows stored and SQLITE_BUSY failures per scenario:
//
//   inline   logs in the ledger, one transaction per row (appendLog), tuned pragmas and beginImmediate (WITHOUT the buffered writer)
//   after    logs in the ledger through the buffered writer (scripts/kernel/log-writer.mjs), tuned pragmas and
//            beginImmediate (engine/db/ledger.mjs: spin for the lock before the busy handler's sleeps); 1 row in 10
//            is written like `api log` (flushed at once), the rest queued (flushed every 250 ms or 200 rows)
//   nolog    tuned pragmas, beginImmediate and no logging: the baseline the target compares with
//
//   node scripts/housekeeping/ledger-throughput.mjs [--writers 30] [--seconds 8] [--burst 10] [--interval 100] [--scenarios inline,after,nolog] [--dir <tmp>] [--json]
//
// --interval paces each writer (one iteration per ~interval ms, jittered 0.5x-1.5x); --interval 1 is a saturation test.
//
// Target: zero SQLITE_BUSY failures, and `after` ledger-write p95 not worse than `nolog` (within noise).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openLedger, appendEvent, appendLog, createUnit, createWorkflow, changeWorkflowPhase, enqueueJob, setJobStatus } from '../../engine/db/ledger.mjs';
import { logWriterFor } from '../kernel/log-writer.mjs';
import { safeRemoveTree } from '../api/fs/safe-remove.mjs';

const SELF = fileURLToPath(import.meta.url);
const WF = 'wf-throughput';
export const SCENARIOS = Object.freeze(['inline', 'after', 'nolog']);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const isBusy = (error) => /SQLITE_BUSY|database is locked/i.test(String(error?.message ?? error)) || error?.errcode === 5;
const argsOf = (argv) => { const a = {}; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) continue; const n = k.slice(2); if (['json', 'child'].includes(n)) a[n] = true; else a[n] = argv[++i]; } return a; };

const logRow = (id, i) => ({ at: Date.now(), workflowId: WF, jobId: `op-load-${id}-${i % 7}`, actor: 'op', nodeId: null, level: 'info', kind: 'cmd.run',
  msg: `w${id} cmd ${i}`, data: { cmd: 'npm test', exit: 0, durationMs: 12 }, refs: [], src: null });

/** One writer process: loops until the deadline; prints {lat:[ms...], busy, logRows, logBusy, txns}. */
function child({ scenario, file, id, seconds, burst, interval }) {
  const ledger = openLedger({ file });
  const txn = (fn) => ledger.transaction(fn);
  const writer = scenario === 'after' ? logWriterFor(file).retain() : null;
  const out = { lat: [], busy: 0, logRows: 0, logBusy: 0, txns: 0 };
  const timed = (fn) => {
    const t0 = process.hrtime.bigint();
    try { txn(fn); out.lat.push(Number(process.hrtime.bigint() - t0) / 1e6); out.txns += 1; }
    catch (error) { if (isBusy(error)) out.busy += 1; else throw error; }
  };
  const logBurst = (i) => {
    for (let k = 0; k < burst; k++) {
      const row = logRow(id, i * burst + k);
      try {
        if (scenario === 'inline') ledger.transaction((db) => appendLog(db, row));
        else if (scenario === 'after') { if (k === 0) writer.write([row]); else writer.enqueue([row]); }
        out.logRows += 1;
      } catch (error) { if (isBusy(error)) out.logBusy += 1; else throw error; }
    }
  };
  const deadline = Date.now() + seconds * 1000;
  let i = 0;
  while (Date.now() < deadline) {
    const iterStart = Date.now();
    const jobId = `job-${id}-${i}`;
    timed((db) => { createUnit(db, { workflowId: WF, unitId: jobId, opId: 'load.op', subjectKey: jobId, goalRevision: 1 }); enqueueJob(db, { jobId, workflowId: WF, unitId: jobId, opId: 'load.op' }); appendEvent(db, { workflowId: WF, entityType: 'job', entityId: jobId, kind: 'op-dispatched', payload: { op: 'load.op' } }); });
    if (scenario !== 'nolog') logBurst(i);
    timed((db) => { setJobStatus(db, { jobId, to: 'cancelled', reason: 'load' }); appendEvent(db, { workflowId: WF, entityType: 'job', entityId: jobId, kind: 'op-settled', payload: { verdict: 'pass' } }); });
    i += 1;
    // Paced like a busy op or kernel: one iteration per ~interval ms (jittered), never a tight loop.
    const spent = Date.now() - iterStart;
    sleep(Math.max(1, Math.round(interval * (0.5 + ((id * 7919 + i * 104729) % 1000) / 1000)) - spent));
  }
  if (writer) { writer.flush({ force: true }); out.logBusy += writer.stats.busy; writer.release(); }
  ledger.close();
  process.stdout.write(JSON.stringify(out));
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : null);
const round = (v) => (v == null ? null : Math.round(v * 100) / 100);

/** Run one scenario with `writers` processes; resolves its summary. */
export async function runScenario(scenario, { writers = 30, seconds = 8, burst = 10, interval = 100, dir }) {
  const root = fs.mkdtempSync(path.join(dir, `throughput-${scenario}-`));
  const file = path.join(root, 'runtime.sqlite');
  const seed = openLedger({ file });
  seed.transaction((db) => { createWorkflow(db, { workflowId: WF, phase: 'queued', by: 'owner', reason: 'load test' }); changeWorkflowPhase(db, { workflowId: WF, to: 'running', by: 'owner', reason: 'load test' }); });
  seed.close();
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: writers }, (_, id) => new Promise((resolve) => {
    const p = spawn(process.execPath, ['--no-warnings', SELF, '--child', '--scenario', scenario, '--file', file, '--id', String(id), '--seconds', String(seconds), '--burst', String(burst), '--interval', String(interval)],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = '';
    p.stdout.on('data', (d) => { so += d; }); p.stderr.on('data', (d) => { se += d; });
    p.on('close', (code) => { try { resolve({ ...JSON.parse(so), code }); } catch { resolve({ lat: [], busy: 0, logRows: 0, logBusy: 0, txns: 0, code, error: se.slice(0, 400) }); } });
  })));
  const elapsed = (Date.now() - started) / 1000;
  const lat = results.flatMap((r) => r.lat).sort((a, b) => a - b);
  const check = openLedger({ file });
  const storedLogs = Number(check.db.prepare('SELECT count(*) n FROM logs').get().n);
  check.close();
  safeRemoveTree(root, { retries: 20 });
  return {
    scenario, writers, seconds, burst, interval,
    ledgerWrites: lat.length, txnPerSec: round(lat.length / elapsed),
    p50: round(pct(lat, 50)), p95: round(pct(lat, 95)), p99: round(pct(lat, 99)), max: round(lat.at(-1) ?? null),
    busy: results.reduce((n, r) => n + r.busy, 0), logBusy: results.reduce((n, r) => n + r.logBusy, 0),
    logRows: results.reduce((n, r) => n + r.logRows, 0), storedLogs, failedWriters: results.filter((r) => r.code !== 0).map((r) => r.error ?? `exit ${r.code}`),
  };
}

async function main() {
  const a = argsOf(process.argv.slice(2));
  if (a.child) return child({ scenario: a.scenario, file: a.file, id: Number(a.id), seconds: Number(a.seconds), burst: Number(a.burst), interval: Number(a.interval) || 100 });
  const scenarios = String(a.scenarios ?? SCENARIOS.join(',')).split(',').filter((s) => SCENARIOS.includes(s));
  const opts = { writers: Number(a.writers) || 30, seconds: Number(a.seconds) || 8, burst: Number(a.burst ?? 10), interval: Number(a.interval) || 100, dir: a.dir ?? os.tmpdir() };
  fs.mkdirSync(opts.dir, { recursive: true });
  const rows = [];
  for (const s of scenarios) rows.push(await runScenario(s, opts));
  const by = Object.fromEntries(rows.map((r) => [r.scenario, r]));
  const verdict = {
    busyFree: rows.every((r) => r.busy === 0 && r.logBusy === 0),
    afterP95VsNolog: by.after && by.nolog ? round(by.after.p95 / by.nolog.p95) : null,
  };
  const out = { ok: verdict.busyFree && rows.every((r) => !r.failedWriters.length), node: process.version, platform: process.platform, ...opts, rows, verdict };
  if (a.json) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`ledger throughput: ${opts.writers} writers x ${opts.seconds}s, one iteration (2 ledger txns + ${opts.burst} log rows) per ~${opts.interval} ms each`);
    console.log('scenario  writes  txn/s    p50ms   p95ms   p99ms   maxms  busy logBusy  logRows stored');
    for (const r of rows) console.log(`${r.scenario.padEnd(8)} ${String(r.ledgerWrites).padStart(7)} ${String(r.txnPerSec).padStart(6)} ${String(r.p50).padStart(8)} ${String(r.p95).padStart(7)} ${String(r.p99).padStart(7)} ${String(r.max).padStart(7)} ${String(r.busy).padStart(5)} ${String(r.logBusy).padStart(7)} ${String(r.logRows).padStart(8)} ${String(r.storedLogs).padStart(6)}`);
    console.log(`busy-free: ${verdict.busyFree}; after p95 / nolog p95 = ${verdict.afterP95VsNolog}`);
  }
  if (!out.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main().catch((error) => { console.error(error?.stack ?? error); process.exit(1); });
