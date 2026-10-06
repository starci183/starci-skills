import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import crypto from 'node:crypto';
import { captureProcessIdentity } from '../../scripts/api/process/capture-process-identity.mjs';
import { stopOwnedProcess } from '../../scripts/api/process/stop-owned-process.mjs';
import { OWNED_PROCESS_SCHEMA } from '../../scripts/lib/process-identity.mjs';
import { CONNECTOR_LAUNCH_ENV } from '../../scripts/connectors/lib.mjs';
import { winPath } from '../fixtures/win-path.mjs';

const identity = { pid: 4123, birth: '134038224001234567', exe: winPath('C', 'fixture', 'node.exe') };
const reply = (extra = {}) => ({ status: 0, stdout: JSON.stringify({ schema: OWNED_PROCESS_SCHEMA, pid: identity.pid,
  ok: true, outcome: 'stopped', proof: 'process-handle-signaled', birth: identity.birth, exe: identity.exe, ...extra }) });

test('only an exact identity and completed same-handle native receipt can prove process closure', () => {
  const stopped = stopOwnedProcess(identity, { platform: 'win32', run: () => reply() });
  assert.equal(stopped.ok, true);
  assert.equal(stopped.outcome, 'stopped');
  assert.deepEqual(stopped.identity, identity);
  for (const made of [{ ...reply(), status: null }, { ...reply(), signal: 'SIGTERM' },
    { ...reply(), error: Error('native call incomplete') }, { status: 0, stdout: '{}' },
    reply({ birth: '134038224001234568' }), reply({ exe: winPath('C', 'foreign', 'node.exe') }),
    reply({ outcome: 'captured' }), reply({ proof: 'termination-requested' }), { status: 0, stdout: 'not-json' }]) {
    const result = stopOwnedProcess(identity, { platform: 'win32', run: () => made });
    assert.equal(result.ok, false);
    assert.equal(result.outcome, 'unknown');
    assert.deepEqual(result.identity, identity, 'original custody survives a failed or contradictory call');
  }
  const thrown = stopOwnedProcess(identity, { platform: 'win32', run: () => { throw Error('spawn refused'); } });
  assert.equal(thrown.ok, false);
  assert.equal(thrown.reason, 'process-call-incomplete');
});

test('identity absence, invalid waits and unsupported native platforms cause no termination attempt', () => {
  let calls = 0;
  const run = () => { calls++; return reply(); };
  for (const invalid of [null, { pid: identity.pid }, { ...identity, birth: '0' }, { ...identity, exe: 'relative.exe' }]) {
    const result = stopOwnedProcess(invalid, { platform: 'win32', run });
    assert.equal(result.ok, false);
    assert.equal(result.outcome, 'refused');
  }
  assert.equal(stopOwnedProcess(identity, { platform: 'linux', run }).reason, 'process-platform-unverified');
  assert.equal(stopOwnedProcess(identity, { platform: 'win32', waitMs: 0, run }).reason, 'process-wait-invalid');
  assert.equal(captureProcessIdentity(identity.pid, { platform: 'win32', ownership: { key: '', value: 'nonce' }, run }).ok, false);
  assert.equal(calls, 0);
});

test('native identity conflict is refusal and preserves both original custody and the observed foreign identity', () => {
  const result = stopOwnedProcess(identity, { platform: 'win32', run: () => reply({ ok: false,
    outcome: 'refused', proof: 'process-identity-conflict', birth: '134038224001234568' }) });
  assert.equal(result.ok, false);
  assert.equal(result.outcome, 'refused');
  assert.equal(result.reason, 'process-identity-conflict');
  assert.deepEqual(result.identity, identity);
  assert.equal(result.observedIdentity.birth, '134038224001234568');
});

test('capture stays a read even when an injected caller supplies a stop identity', () => {
  const result = captureProcessIdentity(identity.pid, { platform: 'win32', identity, run: () => reply({
    outcome: 'captured', proof: 'process-handle-live' }) });
  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'captured');
  assert.deepEqual(result.identity, identity);
});

test('real isolated native child refuses wrong birth/image/launch nonce, then exact process-handle closure is observed', async (t) => {
  if (process.platform !== 'win32') {
    assert.equal(captureProcessIdentity(process.pid).reason, 'process-platform-unverified');
    assert.equal(stopOwnedProcess(identity).ok, false);
    return;
  }
  const nonce = crypto.randomUUID();
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { windowsHide: true,
    stdio: 'ignore', env: { ...process.env, [CONNECTOR_LAUNCH_ENV]: nonce } });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  });
  await once(child, 'spawn');
  const capture = () => captureProcessIdentity(child.pid, { ownership: { key: CONNECTOR_LAUNCH_ENV, value: nonce } });
  const wrongNonce = captureProcessIdentity(child.pid, { ownership: { key: CONNECTOR_LAUNCH_ENV, value: 'wrong-fixture-nonce' } });
  assert.equal(wrongNonce.ok, false);
  assert.equal(wrongNonce.reason, 'process-launch-custody-unverified');
  const actual = capture();
  assert.equal(actual.ok, true, JSON.stringify(actual));
  assert.equal(actual.outcome, 'captured');
  for (const wrong of [{ ...actual.identity, birth: String(BigInt(actual.identity.birth) + 1n) },
    { ...actual.identity, exe: winPath('C', 'foreign-fixture', 'node.exe') }]) {
    const refused = stopOwnedProcess(wrong);
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.outcome, 'refused');
    assert.equal(refused.reason, 'process-identity-conflict');
    assert.equal(capture().ok, true, 'a conflicting identity leaves the owned process live');
  }
  const exited = once(child, 'exit');
  const closed = stopOwnedProcess(actual.identity);
  assert.equal(closed.ok, true, JSON.stringify(closed));
  assert.equal(closed.proof, 'process-handle-signaled');
  assert.deepEqual(closed.identity, actual.identity);
  await exited;
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});

test('the stop call keeps its original custody when options contain another identity', () => {
  const foreign = { ...identity, pid: identity.pid + 1, birth: '134038224001234568', exe: winPath('C', 'foreign', 'node.exe') };
  let calls = 0;
  const result = stopOwnedProcess(identity, { platform: 'win32', identity: foreign,
    run: () => { calls++; return reply(); } });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'stopped');
  assert.deepEqual(result.identity, identity, 'options cannot replace the exact captured process object');
});
