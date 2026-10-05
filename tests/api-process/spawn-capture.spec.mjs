import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawnCapture } from '../../scripts/api/process/spawn-capture.mjs';

const fakeChild = (emit, { pid = 424242 } = {}) => {
  const child = new EventEmitter(); child.pid = pid;
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.signals = []; child.kill = signal => { child.signals.push(signal); child.emit('exit', null, signal); return true; };
  child.unref = () => {};
  return { child, spawnChild: () => { queueMicrotask(() => emit(child)); return child; } };
};

test('an accepted kill or exit without stdio close cannot hold capture past its deadline or prove closure', async () => {
  const fx = fakeChild(child => { child.emit('spawn'); child.stdout.write('partial'); child.emit('exit', 0, null); });
  const receipt = await spawnCapture('inert-test-child', [], { timeoutMs: 30, spawnChild: fx.spawnChild });
  assert.deepEqual(fx.child.signals, ['SIGKILL']);
  assert.equal(receipt.stdout, 'partial');
  assert.deepEqual([receipt.timedOut, receipt.processState, receipt.effectState, receipt.recoveryRequired, receipt.outputComplete],
    [true, 'unknown', 'unknown', true, false]);
  fx.child.emit('close', 0, null);
  assert.equal(receipt.processState, 'unknown', 'a late close must not rewrite the already returned recovery evidence');
});

test('capture preserves a complete ordinary close and refuses a signal close as success', async () => {
  const normal = fakeChild(child => { child.emit('spawn'); child.stdout.write('complete'); child.emit('close', 0, null); });
  const good = await spawnCapture('inert-test-child', [], { timeoutMs: 500, spawnChild: normal.spawnChild });
  assert.deepEqual([good.code, good.stdout, good.outputComplete, good.processState], [0, 'complete', true, 'closed']);
  assert.equal(good.capture.stdout.capturedBytes, 8);
  const signaled = fakeChild(child => { child.emit('spawn'); child.emit('close', null, 'SIGTERM'); });
  const uncertain = await spawnCapture('inert-test-child', [], { timeoutMs: 500, spawnChild: signaled.spawnChild });
  assert.deepEqual([uncertain.effectState, uncertain.recoveryRequired, uncertain.outputComplete], ['unknown', true, false]);
});

test('a spawn refusal and invalid deadline prove no child was issued', async () => {
  const fx = fakeChild(child => child.emit('error', Object.assign(new Error('private spawn refused'), { code: 'ENOENT' })), { pid: null });
  const refused = await spawnCapture('inert-test-child', [], { timeoutMs: 500, spawnChild: fx.spawnChild });
  assert.deepEqual([refused.processState, refused.effectState, refused.outputComplete], ['not-started', 'none', false]);
  let calls = 0;
  const invalid = await spawnCapture('inert-test-child', [], { timeoutMs: Infinity, spawnChild: () => { calls += 1; } });
  assert.equal(calls, 0); assert.equal(invalid.effectState, 'none');
});

test('a captured stdio failure returns unknown recovery evidence instead of an unhandled stream error', async () => {
  for (const stream of ['stdout', 'stderr']) {
    const fx = fakeChild(child => { child.emit('spawn'); child[stream].emit('error', new Error('private capture failure')); });
    const receipt = await spawnCapture('inert-test-child', [], { timeoutMs: 500, spawnChild: fx.spawnChild });
    assert.deepEqual([receipt.processState, receipt.effectState, receipt.recoveryRequired, receipt.outputComplete],
      ['unknown', 'unknown', true, false]);
    assert.match(receipt.error, /private capture failure/);
  }
});

test('a real private child exceeding both raw byte caps cannot be reported as complete JSON success', async () => {
  const receipt = await spawnCapture(process.execPath, ['-e',
    "const fs=require('node:fs');const bytes=Buffer.from('€'.repeat(1500000));fs.writeSync(1,bytes);fs.writeSync(2,bytes);"], { timeoutMs: 10_000 });
  const cap = 4 * 1024 * 1024;
  assert.equal(receipt.code, 0); assert.equal(receipt.timedOut, false);
  for (const stream of ['stdout', 'stderr']) {
    assert.equal(receipt.capture[stream].capturedBytes, cap);
    assert.equal(receipt.capture[stream].seenBytes, 4_500_000);
    assert.equal(receipt.capture[stream].truncated, true);
    assert.ok(Buffer.byteLength(receipt[stream]) <= cap);
    assert.equal(receipt[stream].includes('\uFFFD'), false, 'a clipped multibyte suffix is withheld');
  }
  assert.deepEqual([receipt.outputComplete, receipt.effectState, receipt.recoveryRequired], [false, 'unknown', true]);
  assert.match(receipt.error, /byte budget/);
});
