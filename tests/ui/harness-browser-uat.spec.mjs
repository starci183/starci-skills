import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureContract, assertHarnessCapture, capturePhase } from '../helpers/harness-browser-uat.mjs';
import { row, save } from '../helpers/browser-proof-artifacts.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const source = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceSha = 'a'.repeat(40);

/** Harmless private raw files exercise media-declaration validity; these are not encoded media or native UAT evidence. */
function complete(t) {
  const dir = mkdtemp(t, 'starci-harness-media-unit-');
  const files = (field, count) => Array.from({ length: count }, (_, id) => {
    const file = path.join(dir, `${field}-${id}.bin`);
    fs.writeFileSync(file, `Harmless raw unit fixture; not browser/UAT evidence: ${field}-${id}\n`);
    return row(file);
  });
  return {
    captures: files('captures', captureContract.screenshots).map(file => ({ file })),
    interactions: Array.from({ length: captureContract.interactions }, (_, id) => ({ id, unitFixture: true })),
    traces: files('traces', captureContract.traces),
    videos: files('videos', captureContract.videos),
  };
}

test('capture completeness refuses missing finalized video or trace after every screenshot and interaction', t => {
  assert.doesNotThrow(() => assertHarnessCapture(complete(t)));
  for (const field of ['videos', 'traces']) {
    const report = complete(t); report[field].pop();
    assert.throws(() => assertHarnessCapture(report), assert.AssertionError, field);
  }
});

test('capture completeness refuses duplicate, empty or missing raw media declarations despite exact counts', t => {
  for (const field of ['videos', 'traces', 'captures']) {
    const duplicate = complete(t);
    duplicate[field][1] = duplicate[field][0];
    assert.throws(() => assertHarnessCapture(duplicate), /Media paths must be unique/);
  }
  const crossKind = complete(t); crossKind.videos[0] = crossKind.traces[0];
  assert.throws(() => assertHarnessCapture(crossKind), /Media paths must be unique/);
  const empty = complete(t), dir = mkdtemp(t, 'starci-harness-empty-unit-'), file = path.join(dir, 'empty.bin');
  fs.writeFileSync(file, ''); empty.videos[0] = row(file);
  assert.equal(empty.videos[0].bytes, 0, 'Generic raw recorder accepts an actual empty regular file');
  assert.throws(() => assertHarnessCapture(empty), /Finalized media must be nonempty/);
  const missing = complete(t); delete missing.traces[0].sha256;
  assert.throws(() => assertHarnessCapture(missing), /Raw media SHA256 required/);
  const badDigest = complete(t); badDigest.videos[0] = { ...badDigest.videos[0], sha256: 'short-digest' };
  assert.throws(() => assertHarnessCapture(badDigest), /Raw media SHA256 required/);
  const missingPath = complete(t); delete missingPath.captures[0].file.path;
  assert.throws(() => assertHarnessCapture(missingPath), /Absolute media path required/);
});

test('capture completeness refuses missing screenshot or interaction despite complete recordings', t => {
  for (const field of ['captures', 'interactions']) {
    const report = complete(t); report[field].pop();
    assert.throws(() => assertHarnessCapture(report), assert.AssertionError, field);
  }
});

test('capture refuses another Source or a shortened revision before creating a browser context', async t => {
  const dir = mkdtemp(t, 'starci-harness-uat-'); let started = 0;
  const browser = { newContext() { started++; throw Error('Context must not open'); } };
  for (const input of [{ source: dir, sourceSha }, { source, sourceSha: sourceSha.slice(0, 8) }]) {
    await assert.rejects(capturePhase({ ...input, browser, dir, report: { ...input } }), assert.AssertionError);
  }
  assert.equal(started, 0);
});

test('capture refuses an output inside Source before touching that path or opening a browser', async () => {
  let started = 0;
  const browser = { newContext() { started++; throw Error('Context must not open'); } };
  await assert.rejects(capturePhase({ source, sourceSha, browser, dir: path.join(source, 'uncreated-uat-output'),
    report: { source, sourceSha } }), /Capture output must be outside Source/);
  assert.equal(started, 0);
});

test('artifact rows preserve private raw bytes and saved receipt pins without treating a directory as a file', t => {
  const dir = mkdtemp(t, 'starci-harness-artifacts-'), file = path.join(dir, 'sample.bin');
  const bytes = Buffer.from([0, 13, 10, 255, 65]); fs.writeFileSync(file, bytes);
  const observed = row(file);
  assert.deepEqual(observed, { path: path.resolve(file), sha256: sha256(bytes), bytes: bytes.length });
  const receipt = save(dir, 'receipt.json', { file: observed });
  assert.deepEqual(row(receipt.path), receipt);
  assert.deepEqual(JSON.parse(fs.readFileSync(receipt.path, 'utf8')), { file: observed });
  assert.throws(() => row(dir), /Regular file required/);
});
