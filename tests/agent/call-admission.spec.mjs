// A headless call is admitted by the same picker and the same provider reservation as a seat or an op: the quota threshold,
// the hard filter, the owner bias and one slot for the duration, with a typed refusal instead of a thrown error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { admitCall, beginCall, endCall, liveCall, refusalKind } from '../../scripts/agent/call-admission.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';

const ioOf = (options) => ({ ...fakeAdmission(options), history: () => ({}) });
const ask = (io, extra = {}) => admitCall({ call: 'imagegen', scopeId: 'imagegen:job-1', attemptId: 'imagegen:a1', ...extra }, { io });

test('a call is admitted on the imagegen chain and holds one reserved provider slot', () => {
  const io = ioOf({ used: { codex: 10 } });
  const called = ask(io);
  assert.equal(called.ok, true, JSON.stringify(called));
  assert.deepEqual([called.selected.provider, called.selected.model, called.selected.effort], ['codex', 'gpt-6.1-sol', 'high']);
  assert.equal(called.spec.tier, 'imagegen');
  const reserves = io.calls.filter(([name]) => name === 'reserve');
  assert.equal(reserves.length, 1);
  assert.equal(reserves[0][1].role, 'op');
  assert.equal(reserves[0][1].model, 'gpt-6.1-sol');
  assert.equal(reserves[0][1].tier, 'imagegen');
});

test('the slot crosses reserved, launching, live and released in order; a child that never started is released as no effect', () => {
  const io = ioOf();
  const called = ask(io);
  assert.equal(beginCall(called, { launchIdentity: 'imagegen:a1', io }).ok, true);
  assert.equal(liveCall(called, { pid: 4242, io }).ok, true);
  assert.equal(endCall(called, { pid: 4242, io }).ok, true);
  assert.deepEqual(io.calls.map(([name, value]) => (name === 'mark' ? `mark:${value.state}` : name)), ['reserve', 'mark:launching', 'mark:live', 'release']);
  assert.deepEqual(io.calls.at(-1)[1], { kind: 'process-exited', confirmed: true, pid: 4242 });
  const idle = ioOf();
  const unstarted = admitCall({ call: 'imagegen', scopeId: 'imagegen:job-2', attemptId: 'imagegen:a2' }, { io: idle });
  endCall(unstarted, { io: idle });
  assert.deepEqual(idle.calls.at(-1)[1], { kind: 'failed-before-launch', confirmed: true });
});

test('a member at the reserve threshold is out: a quota refusal, nothing reserved', () => {
  const io = ioOf({ used: { codex: 91 } });
  const refused = ask(io);
  assert.equal(refused.ok, false);
  assert.equal(refused.kind, 'quota');
  assert.equal(refused.reason, 'tokens-out');
  assert.equal(io.calls.filter(([name]) => name === 'reserve').length, 0);
  assert.equal(ask(ioOf({ used: { codex: 100 } })).kind, 'quota');
});

test('no free provider slot is a capacity refusal; a dead login is unavailable; a bias that empties the chain refuses', () => {
  assert.equal(ask(ioOf({ capacity: 10 })).kind, 'capacity');
  const dead = ask(ioOf({ auth: 'dead' }));
  assert.equal(dead.ok, false);
  assert.equal(dead.kind, 'unavailable');
  const biased = ask(ioOf(), { bias: { only: [{ provider: 'claude' }] } });
  assert.equal(biased.ok, false);
  assert.equal(biased.reason, 'bias-empties-chain');
  const preferred = ask(ioOf(), { bias: { prefer: [{ provider: 'codex' }] } });
  assert.equal(preferred.ok, true);
});

test('a reservation the provider budget rejects is a typed refusal; a call the data does not declare throws', () => {
  const io = ioOf({ onReserve: () => ({ ok: false, reason: 'capacity-full' }) });
  const refused = ask(io);
  assert.equal(refused.ok, false);
  assert.equal(refused.kind, 'capacity');
  assert.throws(() => admitCall({ call: 'nothing', scopeId: 's' }, { io: ioOf() }), /declares no call nothing/);
  assert.deepEqual(['tokens-out', 'quota-ineligible', 'provider-capacity', 'incident-open'].map(refusalKind), ['quota', 'quota', 'capacity', 'unavailable']);
});
