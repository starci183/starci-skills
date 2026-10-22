// `starci uat record` files a recorded UAT walk the way a uat.verify run files it: the run folder holds exactly manifest.yaml,
// result.md, screens/*.png and videos/*.webm (each of its type by its bytes), an example's fixture store gets each verified blob
// once, and the evidence cites every file by sha256 with an outcome that is pass only when the walk exited 0 and its manifest says pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { curatedProblem, curationOf, evidenceOf, newRunId, readRunFolder, recordedOutcome } from '../runtime/scripts/lib/uat-run-folder.mjs';

const sha256Of = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png body')]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm body')]);

function tempDir(t, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `uat-run-${name}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A finished run folder; `manifestOutcome` is what the walk's own manifest says. */
function runFolder(t, { manifestOutcome = 'pass', screens = { 'step1-open.png': PNG }, videos = { 'flow.webm': WEBM }, extra = null } = {}) {
  const dir = tempDir(t, 'folder');
  fs.writeFileSync(path.join(dir, 'manifest.yaml'), `outcome: ${manifestOutcome}\nsteps:\n  - {order: 1, observed: yes}\n`);
  fs.writeFileSync(path.join(dir, 'result.md'), '# walk\n\nstep 1: yes\n');
  fs.mkdirSync(path.join(dir, 'screens'));
  fs.mkdirSync(path.join(dir, 'videos'));
  for (const [name, bytes] of Object.entries(screens)) fs.writeFileSync(path.join(dir, 'screens', name), bytes);
  for (const [name, bytes] of Object.entries(videos)) fs.writeFileSync(path.join(dir, 'videos', name), bytes);
  if (extra) fs.writeFileSync(path.join(dir, extra), 'stray');
  return dir;
}

test('a run id has the evidence schema shape', () => {
  assert.equal(newRunId(new Date('2026-10-22T09:08:07.654Z'), 'a1b2c3d4'), '20261022T090807Z-a1b2c3d4');
  assert.match(newRunId(), /^[0-9]{8}T[0-9]{6}Z-[a-f0-9]+$/u);
});

test('a complete run folder reads as its manifest and its four kinds of file', (t) => {
  const { manifest, files } = readRunFolder(runFolder(t));
  assert.equal(manifest.outcome, 'pass');
  assert.deepEqual(files.map(({ name, mediaType }) => [name, mediaType]), [
    ['manifest.yaml', 'application/yaml'], ['result.md', 'text/markdown'], ['screens/step1-open.png', 'image/png'], ['videos/flow.webm', 'video/webm'],
  ]);
});

test('a run folder that is not exactly manifest, result, screens and videos, or holds a file of the wrong bytes, refuses', (t) => {
  assert.throws(() => readRunFolder(runFolder(t, { extra: 'notes.txt' })), (error) => error.code === 'UAT_RECORD_RUN_INCOMPLETE' && /unexpected notes\.txt/u.test(error.message));
  assert.throws(() => readRunFolder(runFolder(t, { videos: {} })), (error) => error.code === 'UAT_RECORD_RUN_INCOMPLETE' && /videos\/ holds no \.webm/u.test(error.message));
  assert.throws(() => readRunFolder(runFolder(t, { screens: { 'step1.jpg': PNG } })), (error) => error.code === 'UAT_RECORD_RUN_INCOMPLETE' && /not a \.png/u.test(error.message));
  assert.throws(() => readRunFolder(runFolder(t, { screens: { 'step1.png': Buffer.from('not a png') } })), (error) => error.code === 'UAT_RECORD_ASSET_INVALID');
  assert.throws(() => readRunFolder(runFolder(t, { videos: { 'flow.webm': PNG } })), (error) => error.code === 'UAT_RECORD_ASSET_INVALID');
  assert.throws(() => readRunFolder(runFolder(t, { videos: { 'flow.webm': Buffer.alloc(0) } })), (error) => error.code === 'UAT_RECORD_ASSET_INVALID' && /empty/u.test(error.message));
  assert.throws(() => readRunFolder(runFolder(t, { manifestOutcome: 'green' })), (error) => error.code === 'UAT_RECORD_RUN_INCOMPLETE' && /outcome/u.test(error.message));
});

test('the outcome is pass only when the walk exited 0 and its manifest says pass', () => {
  assert.equal(recordedOutcome(0, { outcome: 'pass' }), 'pass');
  assert.equal(recordedOutcome(1, { outcome: 'pass' }), 'fail');
  assert.equal(recordedOutcome(0, { outcome: 'fail' }), 'fail');
  assert.equal(recordedOutcome(0, { outcome: 'partial-pass' }), 'partial-pass');
});

test('the evidence cites every file of the run by sha256, the run and the record digest', () => {
  const cited = [
    { name: 'manifest.yaml', sha256: 'a'.repeat(64) }, { name: 'result.md', sha256: 'b'.repeat(64) },
    { name: 'screens/step1-open.png', sha256: 'c'.repeat(64) }, { name: 'videos/flow.webm', sha256: 'd'.repeat(64) },
  ];
  const evidence = evidenceOf({ recordId: 'uat.shop.checkout', recordDigest: 'e'.repeat(64), runId: '20261022T090807Z-a1b2c3d4', outcome: 'pass', cited,
    command: ['npx', 'playwright', 'test'], environment: 'local', capturedAt: '2026-10-22T09:08:07.000Z', baseUrl: 'http://localhost:4069' });
  assert.equal(evidence.schema, 'work/evidence@1');
  assert.equal(evidence.recordDigest, 'e'.repeat(64));
  assert.deepEqual(evidence.run, { id: '20261022T090807Z-a1b2c3d4', outcome: 'pass', result: { name: 'result.md', sha256: 'b'.repeat(64) },
    screens: [{ name: 'screens/step1-open.png', sha256: 'c'.repeat(64) }], videos: [{ name: 'videos/flow.webm', sha256: 'd'.repeat(64) }] });
  assert.deepEqual(evidence.assets.map((asset) => asset.name), cited.map((entry) => `runs/20261022T090807Z-a1b2c3d4/${entry.name}`));
  assert.equal(evidence.provenance.actor, 'uat-record');
  assert.equal(evidence.provenance.tool, 'starci uat record --flow uat.shop.checkout -- npx playwright test');
  assert.match(evidence.provenance.stack, /http:\/\/localhost:4069/u);
  assert.equal(evidenceOf({ recordId: 'uat.x.y', recordDigest: 'e'.repeat(64), runId: 'r', outcome: 'fail', cited, command: ['x'], environment: 'local', capturedAt: 't' }).provenance.stack, undefined);
});

test('an example blob is curated at <ab>/<sha> with its sidecar, and stored bytes must hash to their name', () => {
  const root = path.join(os.tmpdir(), 'cas-root');
  const plan = curationOf(root, { sha256: sha256Of(WEBM), bytes: WEBM, mediaType: 'video/webm', createdAt: '2026-10-22T09:08:07.000Z' });
  assert.equal(plan.dir, path.join(root, sha256Of(WEBM).slice(0, 2)));
  assert.equal(plan.file, path.join(root, sha256Of(WEBM).slice(0, 2), sha256Of(WEBM)));
  assert.equal(plan.sidecar, `${plan.file}.json`);
  assert.deepEqual(JSON.parse(plan.sidecarText), { size: WEBM.length, mediaType: 'video/webm', createdAt: '2026-10-22T09:08:07.000Z' });
  assert.equal(curatedProblem(sha256Of(WEBM), WEBM), null);
  assert.equal(curatedProblem(sha256Of(PNG), WEBM).code, 'UAT_RECORD_ASSET_INVALID');
});
