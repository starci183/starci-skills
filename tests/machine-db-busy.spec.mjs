import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openMachine, withMachine, isMachineBusy, MACHINE_BUSY_CODE } from '../engine/machine-db.mjs';
import { acquireLand } from '../scripts/supervisor/land.mjs';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../engine/machine-db.mjs');
/** A fresh temp dir removed when the test ends (retries: Windows may hold the sqlite file briefly after the holder exits). */
const tmp = (t) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-busy-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 })); return dir; };
/** sleep-sync reads process.env, so the scale is set there for the test's duration (busy backoff is the wait under test). */
const withScale = async (scale, fn) => { const saved = process.env.STARCI_SLEEP_SCALE; process.env.STARCI_SLEEP_SCALE = scale; try { return await fn(); } finally { if (saved === undefined) delete process.env.STARCI_SLEEP_SCALE; else process.env.STARCI_SLEEP_SCALE = saved; } };
const envFor = (file) => ({ ...process.env, STARCI_TEST_MACHINE_FILE: file, STARCI_MACHINE_BUSY_TIMEOUT_MS: '50', });

/** A second process that holds a write transaction on the file for holdMs, then commits. Resolves once the lock is held. */
function holdWriteLock(file, holdMs) {
  const code = `import { pathToFileURL } from 'node:url'; const { openMachine } = await import(pathToFileURL(${JSON.stringify(ENGINE)}).href);
    const m = openMachine({ file: ${JSON.stringify(file)} }); m.db.exec('BEGIN IMMEDIATE'); console.log('held');
    setTimeout(() => { m.db.exec('COMMIT'); m.close(); }, ${holdMs});`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, STARCI_TEST_MACHINE_FILE: file } });
  const held = new Promise((resolve, reject) => { child.stdout.on('data', (d) => String(d).includes('held') && resolve()); child.on('error', reject); child.on('exit', () => resolve()); });
  const exited = new Promise((resolve) => child.on('exit', resolve));
  return { held, exited };
}

test('claimLandGate waits out a write lock held by another connection and then succeeds', (t) => withScale('1', async () => {
  const file = path.join(tmp(t), 'machine.sqlite');
  const env = envFor(file);
  const ticketId = withMachine((m) => m.enqueueLand({ lane: 'a', commitSha: 'abc', commits: 1 }), { env, file });
  const holder = holdWriteLock(file, 1200);
  await holder.held;
  const started = Date.now();
  const got = withMachine((m) => m.claimLandGate({ ticketId }), { env, file });
  assert.equal(got.ok, true);
  assert.ok(Date.now() - started >= 300, 'it waited for the lock rather than racing it');
  assert.equal(got.ticket.state, 'running');
  await holder.exited;
}));

test('claimLandGate past the busy budget throws the coded busy error and claims nothing', (t) => withScale('0.01', async () => {
  const file = path.join(tmp(t), 'machine.sqlite');
  const env = { ...envFor(file) };
  const ticketId = withMachine((m) => m.enqueueLand({ lane: 'a', commitSha: 'abc', commits: 1 }), { env, file });
  const holder = holdWriteLock(file, 2500);
  await holder.held;
  let error;
  try { withMachine((m) => m.claimLandGate({ ticketId }), { env, file }); } catch (e) { error = e; }
  assert.ok(isMachineBusy(error), String(error));
  assert.equal(error.code, MACHINE_BUSY_CODE);
  assert.match(error.message, /machine-db-busy/);
  await holder.exited;
  const rows = openMachine({ file, env });
  try { assert.equal(rows.landQueue()[0].state, 'queued', 'no half-claimed gate'); } finally { rows.close(); }
}));

test('acquireLand never throws on a busy database: it reports gate-busy with why db-busy and leaves no running ticket', (t) => withScale('0.01', async () => {
  const file = path.join(tmp(t), 'machine.sqlite');
  const env = { ...envFor(file) };
  withMachine(() => {}, { env, file });
  const holder = holdWriteLock(file, 2500);
  await holder.held;
  const lock = acquireLand({ env, waitMs: 0, lane: 'a', commits: ['abc'], sleep: () => {} });
  assert.equal(lock.ok, false);
  assert.equal(lock.why, 'db-busy');
  await holder.exited;
  const m = openMachine({ file, env });
  try { assert.deepEqual(m.landQueue().filter((t) => t.state === 'running'), []); } finally { m.close(); }
}));

test('acquireLand waits through a lock held by another process and wins the gate once it is released', (t) => withScale('1', async () => {
  const file = path.join(tmp(t), 'machine.sqlite');
  const env = envFor(file);
  withMachine(() => {}, { env, file });
  const holder = holdWriteLock(file, 1000);
  await holder.held;
  const saved = process.env.STARCI_TEST_MACHINE_FILE; process.env.STARCI_TEST_MACHINE_FILE = file;
  try {
    const lock = acquireLand({ env, waitMs: 20000, pollMs: 50, lane: 'a', commits: ['abc'] });
    assert.equal(lock.ok, true);
    lock.release('passed');
    await holder.exited;
  } finally { if (saved === undefined) delete process.env.STARCI_TEST_MACHINE_FILE; else process.env.STARCI_TEST_MACHINE_FILE = saved; }
}));
