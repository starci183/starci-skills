import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AREAS, AREA_NAMES, SCHEMA, parseArgs, runHousekeeping, housekeepingAllocation, describe } from '../scripts/supervisor/housekeeping.mjs';

// scripts/supervisor/housekeeping.mjs assembles the hk-* sweep modules into one run and one
// `starci/housekeeping-report@1` report. The lib modules land from their own lanes, so every run here
// injects the `sweeps` map — the same seam the CLI's per-area isolation uses when a module is absent.
const CLI = fileURLToPath(new URL('../scripts/supervisor/housekeeping.mjs', import.meta.url));

const okSweep = (extra = {}) => async () => ({ ok: true, freedBytes: 0, movedBytes: 0, skipped: 0, errors: [], ...extra });
const allSweeps = (over = {}) => Object.fromEntries(AREA_NAMES.map((n) => [n, over[n] ?? okSweep()]));

function sandbox(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-housekeeping-')));
  t.after(() => { try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } });
  return root;
}

test('parseArgs: dry-run is the default, --apply mutates, --only names known areas', () => {
  assert.deepEqual(parseArgs([]), { ok: true, apply: false, only: null, json: false });
  assert.deepEqual(parseArgs(['--dry-run', '--json']), { ok: true, apply: false, only: null, json: true });
  assert.deepEqual(parseArgs(['--apply']), { ok: true, apply: true, only: null, json: false });
  assert.deepEqual(parseArgs(['--only', 'tmp, sessions ,,ledgers']), { ok: true, apply: false, only: ['tmp', 'sessions', 'ledgers'], json: false });
  assert.equal(parseArgs(['--only', 'tmp,nope']).ok, false);
  assert.match(parseArgs(['--only', 'nope']).error, /unknown --only area/);
  assert.equal(parseArgs(['--force']).ok, false);
  assert.match(parseArgs(['--force']).error, /unknown flag/);
});

test('every declared area maps to a lib module and a named sweep export', () => {
  assert.deepEqual(AREA_NAMES, ['tmp', 'sessions', 'claude', 'devin', 'logs', 'lanes', 'ledgers']);
  for (const [name, area] of Object.entries(AREAS)) {
    assert.match(area.module, /^\.\.\/lib\/hk-.+\.mjs$/, name);
    assert.match(area.sweep, /^sweep[A-Z]/, name);
  }
});

test('a dry run passes apply:false to every sweep and mutates nothing', async (t) => {
  const root = sandbox(t);
  const fixture = path.join(root, 'tmp-fixture');
  fs.mkdirSync(fixture);
  const seen = [];
  const sweeps = allSweeps({ tmp: async ({ apply }) => { seen.push(apply); if (apply) fs.rmSync(fixture, { recursive: true, force: true }); return { ok: true, freedBytes: 4 }; } });
  const report = await runHousekeeping({ sweeps, allocation: {} });
  assert.equal(report.apply, false);
  assert.deepEqual(seen, [false]);
  assert.ok(fs.existsSync(fixture), 'dry run must not mutate');
});

test('--apply wires apply:true through to the sweep, which may then mutate', async (t) => {
  const root = sandbox(t);
  const fixture = path.join(root, 'tmp-fixture');
  fs.mkdirSync(fixture);
  const seen = [];
  const sweeps = allSweeps({ tmp: async ({ apply }) => { seen.push(apply); if (apply) fs.rmSync(fixture, { recursive: true, force: true }); return { ok: true, freedBytes: 4, deleted: 1 }; } });
  const report = await runHousekeeping({ apply: true, sweeps, allocation: {} });
  assert.equal(report.apply, true);
  assert.deepEqual(seen, [true]);
  assert.ok(!fs.existsSync(fixture), 'apply run performs the mutation');
  assert.equal(report.areas.tmp.deleted, 1);
});

test('--only restricts the run: unselected sweeps never run and are absent from the report', async () => {
  const ran = [];
  const sweeps = allSweeps();
  for (const name of AREA_NAMES) sweeps[name] = async () => { ran.push(name); return { ok: true, freedBytes: 1 }; };
  const report = await runHousekeeping({ only: ['tmp', 'logs'], sweeps, allocation: {} });
  assert.deepEqual(ran.sort(), ['logs', 'tmp']);
  assert.deepEqual(Object.keys(report.areas).sort(), ['logs', 'tmp']);
  assert.equal(report.ok, true);
});

test('a throwing sweep is recorded in its own area and never stops the others', async () => {
  const ran = [];
  const sweeps = allSweeps({
    sessions: async () => { ran.push('sessions'); throw new Error('archive root offline'); },
    ledgers: async () => { ran.push('ledgers'); return { ok: true, freedBytes: 9 }; },
  });
  for (const name of AREA_NAMES) if (!['sessions', 'ledgers'].includes(name)) sweeps[name] = async () => { ran.push(name); return { ok: true }; };
  const report = await runHousekeeping({ sweeps, allocation: {} });
  assert.deepEqual(ran.sort(), [...AREA_NAMES].sort(), 'every area still ran');
  assert.equal(report.ok, false);
  assert.equal(report.areas.sessions.ok, false);
  assert.deepEqual(report.areas.sessions.errors, ['archive root offline']);
  assert.equal(report.areas.ledgers.ok, true);
  assert.equal(report.totals.freedBytes, 9);
});

test('an area with no sweep behind it (module not landed yet) is an area error, not a crash', async () => {
  const report = await runHousekeeping({ only: ['tmp'], sweeps: {}, allocation: {} });
  assert.equal(report.ok, false);
  assert.equal(report.areas.tmp.ok, false);
  assert.match(report.areas.tmp.errors[0], /no sweep supplied for area 'tmp'/);
});

test('a sweep returning ok:false keeps its errors and fails the run', async () => {
  // hk-devin shape: skipped is [{path, reason}], errors are {path, code, message} records.
  const sweeps = allSweeps({
    devin: async () => ({
      ok: false,
      skipped: [{ path: 'C:/x/y.db', reason: 'devin.exe running' }],
      errors: [{ path: 'C:/x/z', code: 'EBUSY', message: 'held open' }, 'plain string error'],
      report: { sessionsDbBytes: 4_000_000 },
    }),
  });
  const report = await runHousekeeping({ sweeps, allocation: {} });
  assert.equal(report.areas.devin.ok, false);
  assert.deepEqual(report.areas.devin.errors, ['held open', 'plain string error']);
  assert.deepEqual(report.areas.devin.skipped, [{ path: 'C:/x/y.db', reason: 'devin.exe running' }]);
  assert.equal(report.areas.devin.report.sessionsDbBytes, 4_000_000);
});

test('the report is starci/housekeeping-report@1 with per-area entries and summed totals', async () => {
  const now = 1_700_000_000_000;
  const sweeps = allSweeps({
    tmp: async () => ({ ok: true, freedBytes: 100, movedBytes: 5, skipped: 2, deleted: 3 }),
    sessions: async () => ({ ok: true, freedBytes: 0, movedBytes: 50, skipped: 1 }),
  });
  const report = await runHousekeeping({ apply: true, only: ['tmp', 'sessions'], now, sweeps, allocation: {} });
  assert.equal(report.schema, SCHEMA);
  assert.equal(report.schema, 'starci/housekeeping-report@1');
  assert.equal(report.generatedAt, new Date(now).toISOString());
  assert.equal(report.apply, true);
  assert.equal(report.ok, true);
  for (const name of ['tmp', 'sessions']) {
    const a = report.areas[name];
    assert.equal(typeof a.ok, 'boolean');
    assert.equal(typeof a.freedBytes, 'number');
    assert.equal(typeof a.movedBytes, 'number');
    assert.equal(typeof a.skipped, 'number');
    assert.ok(Array.isArray(a.errors));
  }
  assert.equal(report.totals.freedBytes, 100);
  assert.equal(report.totals.movedBytes, 55);
  assert.equal(typeof report.durationMs, 'number');
  assert.ok(report.durationMs >= 0);
});

test('sweeps receive {apply, now, env, allocation} — allocation is the runtimes.yaml block, not literals', async () => {
  const got = {};
  const env = { SENTINEL: '1' };
  const allocation = { housekeeping: { tmpMaxAgeMs: 123 } };
  const sweeps = { tmp: async (args) => { Object.assign(got, args); return { ok: true }; } };
  await runHousekeeping({ apply: true, only: ['tmp'], now: 42, env, sweeps, allocation });
  assert.equal(got.apply, true);
  assert.equal(got.now, 42);
  assert.equal(got.env, env);
  assert.equal(got.allocation, allocation);
  assert.equal(got.allocation.housekeeping.tmpMaxAgeMs, 123);
});

test('housekeepingAllocation serves both allocation.housekeeping.* and bare-* sweep readers', () => {
  const merged = housekeepingAllocation({ policy: 'x', housekeeping: { tmpMaxAgeMs: 7, tmpPrefixes: ['starci'] } });
  assert.equal(merged.housekeeping.tmpMaxAgeMs, 7);          // full-block readers
  assert.equal(merged.tmpMaxAgeMs, 7);                        // sub-block readers (hk-tmp.mjs)
  assert.deepEqual(merged.tmpPrefixes, ['starci']);
  assert.equal(merged.policy, 'x');                           // non-housekeeping keys survive
  assert.deepEqual(housekeepingAllocation({}), { housekeeping: {} });
});

test('describe renders a one-line summary naming failed areas', async () => {
  const sweeps = allSweeps({ logs: async () => { throw new Error('locked'); } });
  const report = await runHousekeeping({ apply: true, sweeps, allocation: {} });
  const line = describe(report);
  assert.match(line, /^HOUSEKEEPING apply: freed /);
  assert.match(line, /FAILED: logs/);
});

test('the CLI refuses an unknown --only area with exit 2 and prints the report JSON on a real run', () => {
  const bad = spawnSync(process.execPath, [CLI, '--only', 'bogus'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown --only area/);
});
