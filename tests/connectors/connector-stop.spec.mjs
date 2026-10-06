import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import { withLedger } from '../helpers/ledger-fixture.mjs';
import { connectorState, writeConnectorState, stopConnector, claimManager, claimOrTakeOver, connectorManagerBlocked } from '../../scripts/connectors/lib.mjs';
import { ensureAskConnectors, managerAlive, runManager } from '../../scripts/connectors/tunnel.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { OWNED_PROCESS_SCHEMA } from '../../scripts/lib/process-identity.mjs';
import { winPath, slashPath } from '../fixtures/win-path.mjs';

const source = slashPath('D', 'fixture-runtime', 'scripts', 'connectors', 'tunnel.mjs');
const manager = { pid: 4123, birth: '134038224001234567', exe: winPath('C', 'fixture', 'node.exe') };
const child = { pid: 4124, birth: '134038224001234568', exe: winPath('C', 'fixture', 'cloudflared.exe') };
const closed = (identity) => ({ schema: OWNED_PROCESS_SCHEMA, pid: identity.pid, ok: true,
  outcome: 'stopped', proof: 'process-handle-signaled', identity });
// Seed only the private fixture directly, including concurrent owner changes. Production writes are exercised separately below.
const put = (name = 'tunnel', config = {}, pid = manager.pid) => withMachine(m => m.upsert('connectors', { name, kind: name, pid,
  state: 'connected', public_url: 'https://fixture.invalid', updated_at: m.now(), config_json: {
    source, startedAt: 0, processIdentity: manager, childPid: child.pid,
    childIdentity: child, childLaunchNonce: 'launch-child-a', ...config } }, ['name']));
const assertCustody = (actual, expected) => {
  for (const key of ['pid', 'source', 'processIdentity', 'childPid', 'childIdentity', 'childCapture', 'childLaunchNonce', 'childClosure'])
    assert.deepEqual(actual[key], expected[key], `original ${key} is retained`);
};

test('legacy or conflicting connector custody refuses without any process call or row mutation', (t) => withLedger(t, () => {
  for (const config of [{ processIdentity: null }, { source: slashPath('D', 'other-runtime', 'tunnel.mjs') }, { processIdentity: { ...manager, pid: 9999 } }]) {
    put('tunnel', config);
    const before = connectorState('tunnel');
    let calls = 0;
    const result = stopConnector('tunnel', { source, child: true, stop: () => { calls++; return closed(manager); } });
    assert.equal(result.ok, false);
    assert.equal(result.effectState, 'none');
    assert.equal(calls, 0);
    assert.deepEqual(connectorState('tunnel'), before);
  }
}));

test('manager uncertainty and incomplete or wrong closure receipts never reach the child or stopped state', (t) => withLedger(t, () => {
  for (const receipt of [{ ok: true }, { ...closed(manager), pid: 9999 }, { ...closed(manager), identity: { ...manager, birth: child.birth } },
    { ...closed(manager), ok: false, outcome: 'unknown' }, { ...closed(manager), ok: false, outcome: 'refused' }]) {
    put();
    const before = connectorState('tunnel'), calls = [];
    const result = stopConnector('tunnel', { source, child: true, stop: (identity) => { calls.push(identity); return receipt; } });
    assert.equal(result.ok, false);
    assert.deepEqual(calls, [manager]);
    assert.deepEqual(connectorState('tunnel'), before);
  }
}));

test('a new connector owner during exact manager closure is retained and its child is never stopped', (t) => withLedger(t, () => {
  put();
  const newer = { pid: 5123, birth: '134038224001234569', exe: manager.exe }, calls = [];
  const result = stopConnector('tunnel', { source, child: true, stop: (identity) => {
    calls.push(identity);
    put('tunnel', { processIdentity: newer, childPid: 5124, childIdentity: { ...child, pid: 5124 }, childLaunchNonce: 'new-owner-launch' }, newer.pid);
    return closed(identity);
  } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'connector-owner-changed');
  assert.equal(result.effectState, 'unknown');
  assert.deepEqual(calls, [manager]);
  assert.deepEqual(connectorState('tunnel').processIdentity, newer);
  assert.equal(connectorState('tunnel').state, 'connected');
}));

test('stop reads the last owned tunnel child after manager closure, then commits exact receipts and supports verified replay', (t) => withLedger(t, () => {
  put();
  const finalChild = { ...child, pid: 4125, birth: '134038224001234570' }, calls = [];
  const result = stopConnector('tunnel', { source, child: true, stop: (identity) => {
    calls.push(identity);
    if (calls.length === 1) put('tunnel', { childPid: finalChild.pid, childIdentity: finalChild, childLaunchNonce: 'launch-child-final' });
    return closed(identity);
  } });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(calls, [manager, finalChild]);
  const stored = connectorState('tunnel');
  assert.equal(stored.state, 'stopped');
  assert.equal(stored.pid, null);
  assert.equal(stored.publicUrl, null);
  assert.deepEqual(stored.processIdentity, manager);
  assert.deepEqual(stored.stopReceipt, result.receipt);
  assert.equal(stored.stopReceipt.child.launchNonce, 'launch-child-final');
  const replay = stopConnector('tunnel', { source, child: true, stop: () => { throw Error('completed receipt must not kill a recycled PID'); } });
  assert.equal(replay.ok, true);
  assert.equal(replay.already, true);
  assert.deepEqual(replay.receipt, result.receipt);
}));

test('child uncertainty or refused stopped-row commit remains unknown with original custody retained', (t) => withLedger(t, () => {
  put();
  const before = connectorState('tunnel'), calls = [];
  const unknown = stopConnector('tunnel', { source, child: true, stop: (identity) => {
    calls.push(identity);
    return calls.length === 1 ? closed(identity) : { ...closed(identity), ok: false, outcome: 'unknown', proof: 'process-closure-unverified' };
  } });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.effectState, 'unknown');
  assert.equal(unknown.reason, 'connector-child-closure-unverified');
  assert.deepEqual(unknown.receipt.manager.identity, manager);
  assertCustody(connectorState('tunnel'), before);
  assert.deepEqual(connectorState('tunnel').stopReceipt.manager, closed(manager));
  for (const commit of [() => false, () => { throw Error('private store refused stopped state'); }]) {
    const result = stopConnector('tunnel', { source, child: true, stop: closed, commit });
    assert.equal(result.ok, false);
    assert.equal(result.effectState, 'unknown');
    assert.equal(result.reason, 'connector-stop-record-refused');
    assertCustody(connectorState('tunnel'), before);
    assert.deepEqual(connectorState('tunnel').stopReceipt.manager, closed(manager));
    assert.equal(connectorManagerBlocked(connectorState('tunnel')), false, 'exact retained child closure clears custody even if final stopped publication refuses');
  }
  const replay = stopConnector('tunnel', { source, child: true, stop: () => assert.fail('both original object closures are already retained') });
  assert.equal(replay.ok, true);
}));

test('absent child pid alone cannot prove closure; a bound natural exit or failed spawn receipt can', (t) => withLedger(t, () => {
  put('tunnel', { childPid: null, childClosure: null });
  const before = connectorState('tunnel');
  assert.equal(stopConnector('tunnel', { source, child: true, stop: closed }).reason, 'connector-child-custody-unverified');
  assertCustody(connectorState('tunnel'), before);
  assert.deepEqual(connectorState('tunnel').stopReceipt.manager, closed(manager));
  for (const closure of [{ ok: true, proof: 'owned-child-process-exit', pid: child.pid, launchNonce: 'launch-child-a', code: 0, signal: null },
    { ok: true, proof: 'owned-child-spawn-failed', pid: null, launchNonce: 'launch-child-a', error: 'ENOENT' }]) {
    put('tunnel', { childPid: null, childClosure: closure });
    const calls = [], result = stopConnector('tunnel', { source, child: true, stop: (identity) => { calls.push(identity); return closed(identity); } });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(calls, [manager]);
    assert.deepEqual(result.receipt.child, closure);
  }
  put('tunnel', { childPid: null, childClosure: { ok: true, proof: 'owned-child-process-exit', pid: child.pid, launchNonce: 'foreign-launch' } });
  assert.equal(stopConnector('tunnel', { source, child: true, stop: closed }).ok, false);
}));

test('gateway exact closure writes a stopped row; a nonexistent record never implies a verified process stop', (t) => withLedger(t, () => {
  assert.equal(stopConnector('unrecorded', { source, stop: closed }).reason, 'connector-custody-missing');
  put('gateway', { childPid: null, childIdentity: null });
  const result = stopConnector('gateway', { source, stop: closed });
  assert.equal(result.ok, true);
  assert.equal(result.receipt.child, null);
  assert.equal(connectorState('gateway').state, 'stopped');
}));

test('unknown original child refuses ensure, manager claim, takeover and replacement without launching or erasing custody', (t) => withLedger(t, ({ root, machine }) => {
  put('tunnel', { childCapture: { ok: false, outcome: 'unknown' } });
  const before = connectorState('tunnel');
  const result = stopConnector('tunnel', { source, child: true, stop: identity => identity.pid === manager.pid ? closed(identity)
    : { schema: OWNED_PROCESS_SCHEMA, pid: identity.pid, identity, ok: false, outcome: 'unknown', proof: 'process-closure-unverified' } });
  assert.equal(result.ok, false);
  const owed = connectorState('tunnel');
  assertCustody(owed, before);
  assert.equal(connectorManagerBlocked(owed), true);
  assert.equal(managerAlive()?.blocked, true);
  const env = { ...process.env, STARCI_CLOUDFLARED_COMMAND: 'fixture-cloudflared' };
  const config = { ...parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8')),
    connectors: { cloudflare: { mode: 'quick' }, gateway: { port: 7070 } } };
  let launches = 0;
  const ensure = ensureAskConnectors({ env, config, root, spawn: () => { launches++; return process.pid; } });
  assert.equal(ensure.reason, 'connector-child-custody-unreconciled');
  assert.equal(claimManager('tunnel', { current: null }).reason, 'connector-child-custody-unreconciled', 'fresh transaction refuses even a stale caller read');
  assert.equal(claimOrTakeOver('tunnel', { from: manager.pid }).ok, false);
  const start = runManager({ mode: 'quick' }, { port: 7070, env, checkMs: 0 }, {
    supervise: () => { launches++; assert.fail('unknown child cannot reach the supervisor launch'); } });
  assert.equal(start.reason, 'connector-child-custody-unreconciled');
  assert.equal(launches, 0);
  assert.equal(machine.hostLock('tunnel'), null);
  assert.throws(() => writeConnectorState('tunnel', { pid: process.pid, config: {
    source, processIdentity: { ...manager, pid: process.pid }, childPid: null, childIdentity: null, childLaunchNonce: null } }), /connector-child-custody-unreconciled/);
  assert.deepEqual(connectorState('tunnel'), owed, 'all normal replacement paths preserve the same durable row');
}));

test('dead manager with unproved child is blocked even before a stop receipt exists', (t) => withLedger(t, () => {
  put();
  const before = connectorState('tunnel');
  assert.equal(before.stopReceipt, undefined);
  assert.equal(claimManager('tunnel').reason, 'connector-child-custody-unreconciled');
  assert.equal(managerAlive()?.blocked, true);
  assert.deepEqual(connectorState('tunnel'), before);
}));

test('retry uses retained original manager proof and only exact child closure admits one subsequent start', (t) => withLedger(t, ({ root }) => {
  put();
  const first = stopConnector('tunnel', { source, child: true, stop: identity => identity.pid === manager.pid ? closed(identity) : { ok: false, outcome: 'unknown' } });
  assert.equal(first.ok, false);
  const owed = connectorState('tunnel'), calls = [];
  const wrong = stopConnector('tunnel', { source, child: true, stop: identity => { calls.push(identity); return closed({ ...identity, birth: manager.birth }); } });
  assert.equal(wrong.ok, false);
  assert.deepEqual(calls, [child], 'a retained manager receipt prevents a second call against a possibly recycled manager PID');
  assertCustody(connectorState('tunnel'), owed);
  const retryCalls = [];
  const done = stopConnector('tunnel', { source, child: true, stop: identity => { retryCalls.push(identity); return closed(identity); } });
  assert.equal(done.ok, true);
  assert.deepEqual(retryCalls, [child]);
  assert.equal(connectorManagerBlocked(connectorState('tunnel')), false);
  withMachine(m => m.upsert('connectors', { name: 'gateway', kind: 'gateway', state: 'running', pid: process.pid,
    updated_at: m.now(), config_json: { startedAt: new Date().toISOString() } }, ['name']));
  const env = { ...process.env, STARCI_CLOUDFLARED_COMMAND: 'fixture-cloudflared' };
  const config = { ...parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8')),
    connectors: { cloudflare: { mode: 'quick' }, gateway: { port: 7070 } } };
  const launches = [];
  const spawn = script => { launches.push(script); return process.pid; };
  assert.equal(ensureAskConnectors({ env, config, root, spawn }).ok, true);
  assert.equal(ensureAskConnectors({ env, config, root, spawn }).ok, true);
  assert.equal(launches.length, 1, 'known exact closure admits one tunnel launch; the starting lock prevents a duplicate');
}));

test('refused retention writes never reach child termination or erase original custody', (t) => withLedger(t, () => {
  put();
  const before = connectorState('tunnel'), calls = [];
  const result = stopConnector('tunnel', { source, child: true, retain: () => false,
    stop: identity => { calls.push(identity); return closed(identity); } });
  assert.equal(result.reason, 'connector-stop-record-refused');
  assert.deepEqual(calls, [manager]);
  assert.deepEqual(connectorState('tunnel'), before);
}));
