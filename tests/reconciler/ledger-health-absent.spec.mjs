// A ledger whose file does not exist yet (a fresh repo in supervisor.repos, no workflow) is not LEDGER_CORRUPT: no
// quick_check, no clock (an open one clears), no DI, no backup, and the file is never created as a side effect. An
// existing file that is not a database stays LEDGER_CORRUPT as before (cluster ledger-absent-as-corrupt).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHostController } from '../../scripts/reconciler/controllers/host.mjs';
import { hostSettings, memoryStore } from '../../scripts/reconciler/services.mjs';
import { quickCheck } from '../../scripts/reconciler/ledger-health.mjs';
import { ledgersOf } from '../../scripts/reconciler/sources.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { fakeCtx } from '../../scripts/reconciler/testing.mjs';

const S = hostSettings();
const T0 = Date.UTC(2026, 8, 30, 22, 30, 0);

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ledger-absent-')); }

// The real quickCheck (no quickCheck seam): the defect sits in what it answers for an absent file.
function controller(over = {}) {
  return createHostController({
    settings: () => S, registry: () => [], store: () => memoryStore(),
    probeSeat: async () => ({ ok: true, action: 'active' }), listProcesses: async () => [], hostVerdict: async () => ({ stop: [], alert: false }),
    orcaTerminals: async () => null, supervisorMode: async () => 'kernel', backupDue: () => true,
    ...over,
  });
}

function ctxOf({ file, machine } = {}) {
  let t = T0;
  return fakeCtx({
    mode: 'active', controller: 'host', now: () => t, advance: (ms) => { t += ms; },
    ledgers: [{ ledgerId: 'nivo-monorepo', repo: path.dirname(file), file }], ...(machine ? { machine } : {}),
  });
}

test('quickCheck: an absent file is {absent: true}, never opened or created', () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, 'runtime.sqlite');
    const r = quickCheck(file);
    assert.equal(r.ok, false);
    assert.equal(r.absent, true);
    assert.equal(r.error, undefined);
    assert.equal(fs.existsSync(file), false, 'the absent ledger is still absent');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('host ledger health: an absent ledger file opens no LEDGER_CORRUPT clock, no DI, no backup, and is not created', async () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, 'runtime.sqlite');
    const c = controller();
    const ctx = ctxOf({ file });
    const r = await c.reconcile('ledger:nivo-monorepo', ctx);
    assert.equal(r.skipped, 'absent');
    assert.deepEqual(ctx.calls.clock.filter((x) => x.state === 'LEDGER_CORRUPT'), []);
    assert.equal(ctx.calls.decisions.length, 0, 'no DI');
    assert.equal(ctx.calls.run.length, 0, 'no nightly backup of a file that does not exist');
    assert.ok(ctx.calls.clear.some((x) => x.entity === 'ledger:nivo-monorepo' && x.state === 'LEDGER_CORRUPT'), 'an open episode closes');
    assert.equal(fs.existsSync(file), false, 'the pass never creates the ledger');

    // The file appears (a first workflow): the next pass checks it like any other ledger, at once.
    fs.writeFileSync(file, 'not a sqlite database, garbage bytes '.repeat(200));
    ctx.advance(1000);
    await c.reconcile('ledger:nivo-monorepo', ctx);
    assert.ok(ctx.calls.clock.some((x) => x.entity === 'ledger:nivo-monorepo' && x.state === 'LEDGER_CORRUPT'), 'checked once it exists');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('host ledger health: an existing garbage file is still LEDGER_CORRUPT + one owner DI', async () => {
  const dir = tempDir();
  try {
    const file = path.join(dir, 'runtime.sqlite');
    fs.writeFileSync(file, 'not a sqlite database, garbage bytes '.repeat(200));
    const c = controller();
    const ctx = ctxOf({ file });
    await c.reconcile('ledger:nivo-monorepo', ctx);
    const clock = ctx.calls.clock.find((x) => x.state === 'LEDGER_CORRUPT');
    assert.ok(clock, 'LEDGER_CORRUPT clock');
    assert.equal(clock.meta.severity, 'critical');
    assert.equal(ctx.calls.decisions.length, 1);
    assert.equal(ctx.calls.decisions[0].escalateTo, 'owner');
    assert.equal(ctx.calls.run.length, 0, 'no backup of a corrupt ledger');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('ledgersOf: a repo whose ledger file does not exist yet is left out; it joins once the file exists', () => {
  const dir = tempDir();
  try {
    const none = ledgersOf({ repos: [dir], exists: () => false });
    assert.deepEqual(none.map((l) => l.ledgerId), ['supervisor']);
    const some = ledgersOf({ repos: [dir], exists: () => true });
    assert.deepEqual(some.map((l) => l.ledgerId), [path.basename(dir), 'supervisor']);
    assert.ok(some[0].file);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('host list: an open LEDGER_CORRUPT clock of a ledger no longer listed gets the pass that clears it', async () => {
  const dir = tempDir();
  const m = openMachine({ file: path.join(dir, 'machine.sqlite') });
  try {
    m.openSlaEpisode({ entity: 'ledger:nivo-monorepo', state: 'LEDGER_CORRUPT', code: 'LEDGER_CORRUPT', severity: 'critical', ledgerId: 'nivo-monorepo', slaMs: 0, enteredAt: T0 });
    const c = controller();
    const ctx = fakeCtx({ mode: 'active', controller: 'host', now: () => T0, ledgers: [{ ledgerId: 'supervisor', repo: null, file: null }], machine: m });
    const keys = await c.list(ctx);
    assert.ok(keys.includes('ledger:nivo-monorepo'), keys.join(','));
    const r = await c.reconcile('ledger:nivo-monorepo', ctx);
    assert.equal(r.skipped, 'unknown-ledger');
    assert.ok(ctx.calls.clear.some((x) => x.entity === 'ledger:nivo-monorepo' && x.state === 'LEDGER_CORRUPT'));
  } finally { try { m.close(); } catch { /* closed */ } fs.rmSync(dir, { recursive: true, force: true }); }
});

test('host list: the machine\'s own ledger has no file and no ledger-health key, and a ledger that left the registry settles instead of failing every pass', async () => {
  const c = controller();
  const ctx = fakeCtx({ mode: 'active', controller: 'host', now: () => T0, ledgers: [{ ledgerId: 'supervisor', repo: null, file: null }, { ledgerId: 'real', repo: 'r', file: 'real.sqlite' }] });
  const keys = await c.list(ctx);
  assert.ok(!keys.includes('ledger:supervisor'), 'it failed ok:false at every pass of the real engine (60 attempts, then parked)');
  assert.ok(keys.includes('ledger:real'));
  const settled = await c.reconcile('ledger:supervisor', ctx);
  assert.deepEqual([settled.ok, settled.skipped], [true, 'unknown-ledger']);
});
