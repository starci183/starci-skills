// interrupt-cleanup.spec.mjs - scripts/lib/interrupt-cleanup.mjs against a fake process: a signal runs the registered undos (newest first, once each, a throwing one never stops the rest) and exits 128 + signal
// number; an exit with open registrations runs them; a disposed registration never runs; handlers are installed with the first registration and removed with the last.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createInterruptRegistry } from '../../scripts/lib/interrupt-cleanup.mjs';

const fakeProc = () => {
  const proc = new EventEmitter();
  proc.exits = [];
  proc.exit = (code) => { proc.exits.push(code); };
  return proc;
};
const listening = (proc) => proc.eventNames().length;

test('SIGINT runs every open undo newest first, once, survives a throwing undo, and exits 130', () => {
  const proc = fakeProc();
  const { onInterrupt, pending } = createInterruptRegistry({ proc });
  const order = [];
  onInterrupt(() => order.push('lock'));
  onInterrupt(() => { throw new Error('container gone'); });
  onInterrupt(() => order.push('report'));
  assert.equal(pending(), 3);
  proc.emit('SIGINT');
  assert.deepEqual(order, ['report', 'lock']);
  assert.deepEqual(proc.exits, [130]);
  assert.equal(pending(), 0);
  assert.equal(listening(proc), 0, 'the handlers are gone with the work');
  proc.emit('exit');
  assert.deepEqual(order, ['report', 'lock'], 'nothing runs twice');
});

test('SIGTERM exits 143 and a process exit with an open registration runs it', () => {
  const termed = fakeProc();
  createInterruptRegistry({ proc: termed }).onInterrupt(() => {});
  termed.emit('SIGTERM');
  assert.deepEqual(termed.exits, [143]);
  const proc = fakeProc();
  let ran = 0;
  createInterruptRegistry({ proc }).onInterrupt(() => { ran += 1; });
  proc.emit('exit');
  assert.equal(ran, 1);
});

test('a disposed registration never runs; the last disposal removes the process handlers', () => {
  const proc = fakeProc();
  const { onInterrupt } = createInterruptRegistry({ proc });
  let ran = 0;
  const first = onInterrupt(() => { ran += 1; });
  const second = onInterrupt(() => { ran += 1; });
  assert.ok(listening(proc) > 0);
  first();
  second();
  assert.equal(listening(proc), 0);
  proc.emit('SIGINT');
  assert.equal(ran, 0);
  assert.deepEqual(proc.exits, []);
});
