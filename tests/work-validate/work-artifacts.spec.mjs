import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {checkWorkArtifacts} from '../../scripts/work/validate/check-work-artifacts.mjs';
import {encodePng, screen} from '../helpers/png.mjs';

/**
 * One fixture tree per byte rule in scripts/work/validate/check-work-artifacts.mjs, proving each refuses the exact
 * mismatch between a declaration and the disk it names - and, where the shape is cheap to build correctly,
 * that the corrected bytes are accepted. Fixtures live under one %TEMP% root that the
 * file removes when its tests end (MB-16).
 */
// MB-16: every fixture of this file lives under ONE mkdtemp root in %TEMP%, removed when the file's tests end.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'work-artifacts-'));
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
const EBML = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const pngBytes = () => encodePng({width: 40, height: 40, ...screen({width: 40, height: 40, bands: [{hex: '#2f6bff', rows: 12}]})});
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `artifacts-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content);
  return file;
}

/** A minimal .starciwork carrying a catalog and the files `extra` names; every fixture starts here. */
function tree(extra = {}) {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  for (const [rel, content] of Object.entries(extra)) write(workRoot, rel, content);
  return workRoot;
}

function findingsFor(extra) {
  const out = {refuse: [], suspect: [], info: []};
  checkWorkArtifacts(tree(extra), out);
  return out;
}

const UI_RECORD = (assets) => ({'features/f/ui/one/index.yaml': `schema: work/ui-screen@1\nid: ui.f.one\ntitle: t\nstate: done\nui:\n  assets:\n${assets}`});

test('runtime custody manifests are excluded from canonical artifact verification', () => {
  const found = findingsFor({
    'kernel-evidence/wf/jobs/op/evidence/manifest.yaml': 'schema: work/evidence@1\nid: proof.runtime\nassets:\n  - {path: missing.txt, sha256: deadbeef}\n',
  });
  assert.equal(found.refuse.length, 0, found.refuse.join('\n'));
});

test('ASSET_MISSING: a declared ui asset whose PNG is not on disk is refused; real bytes are accepted', () => {
  const missing = findingsFor(UI_RECORD('    - {path: assets/one.png, role: direction}\n'));
  assert.ok(missing.refuse.some(line => line.includes('ASSET_MISSING') && line.includes('assets/one.png')), missing.refuse.join('\n'));

  const present = findingsFor({
    ...UI_RECORD('    - {path: assets/one.png, role: direction}\n'),
    'features/f/ui/one/assets/one.png': pngBytes(),
  });
  assert.equal(present.refuse.filter(line => line.includes('ASSET_')).join('\n'), '');
});

test('ASSET_EMPTY: a 0-byte file standing in for a raster is refused', () => {
  const found = findingsFor({
    ...UI_RECORD('    - {path: assets/one.png, role: direction}\n'),
    'features/f/ui/one/assets/one.png': Buffer.alloc(0),
  });
  assert.ok(found.refuse.some(line => line.includes('[ASSET_EMPTY]') && line.includes('0-byte placeholder')), found.refuse.join('\n'));
});

test('ASSET_MAGIC: bytes that do not open with the format the extension claims are refused', () => {
  const renamed = findingsFor({
    ...UI_RECORD('    - {path: assets/one.png, role: direction}\n'),
    'features/f/ui/one/assets/one.png': Buffer.from('not a png at all, just a sentence\n', 'utf8'),
  });
  assert.ok(renamed.refuse.some(line => line.includes('[ASSET_MAGIC]') && line.includes('not PNG')), renamed.refuse.join('\n'));

  const honest = findingsFor({
    ...UI_RECORD('    - {path: assets/one.png, role: direction}\n'),
    'features/f/ui/one/assets/one.png': pngBytes(),
  });
  assert.equal(honest.refuse.filter(line => line.includes('[ASSET_MAGIC]')).join('\n'), '');
});

test('ASSET_DIGEST: a stamped sha256 that the bytes on disk do not hash to is refused; a match is silent', () => {
  const bytes = pngBytes();
  const stale = findingsFor({
    ...UI_RECORD(`    - {path: assets/one.png, role: direction, sha256: ${sha256(Buffer.from('some other capture'))}}\n`),
    'features/f/ui/one/assets/one.png': bytes,
  });
  assert.ok(stale.refuse.some(line => line.includes('[ASSET_DIGEST]') && line.includes('assets/one.png')), stale.refuse.join('\n'));

  const fresh = findingsFor({
    ...UI_RECORD(`    - {path: assets/one.png, role: direction, sha256: ${sha256(bytes)}}\n`),
    'features/f/ui/one/assets/one.png': bytes,
  });
  assert.equal(fresh.refuse.filter(line => line.includes('[ASSET_DIGEST]')).join('\n'), '');
});

test('ASSET_STAMP: a stamp that is not a sha256 cannot bind any bytes and is refused', () => {
  // `sha256: 0000...` is not a hex digest to a YAML reader, it is the number 0 - which is also falsy, so a
  // check that skips a falsy stamp verifies nothing while looking like it did.
  const found = findingsFor({
    ...UI_RECORD('    - {path: assets/one.png, role: direction, sha256: 0}\n'),
    'features/f/ui/one/assets/one.png': pngBytes(),
  });
  assert.ok(found.refuse.some(line => line.includes('[ASSET_STAMP]') && line.includes('not a sha256')), found.refuse.join('\n'));
});

test('PROMPT_MISSING / PROMPT_EMPTY: a generated direction needs a prompt it can be re-read from', () => {
  const absent = findingsFor(UI_RECORD('    - {path: assets/one.png, role: direction, generation: {tool: image_gen.imagegen}}\n'));
  assert.ok(absent.refuse.some(line => line.includes('[PROMPT_MISSING]') && line.includes('assets/one.prompt.txt')), absent.refuse.join('\n'));

  const empty = findingsFor({
    ...UI_RECORD('    - {path: assets/one.png, role: direction, generation: {tool: image_gen.imagegen, promptPath: assets/one.prompt.txt}}\n'),
    'features/f/ui/one/assets/one.png': pngBytes(),
    'features/f/ui/one/assets/one.prompt.txt': '   \n',
  });
  assert.ok(empty.refuse.some(line => line.includes('[PROMPT_EMPTY]')), empty.refuse.join('\n'));
  assert.ok(!empty.refuse.some(line => line.includes('[PROMPT_MISSING]')), empty.refuse.join('\n'));
});

test('RUN_MEDIA_FAKE: a stub video is refused in the settled run and only suspected in an unsettled one', () => {
  const stub = Buffer.concat([EBML, Buffer.alloc(64)]);
  const flow = 'features/f/uat/flow/index.yaml';
  const settled = findingsFor({
    [flow]: 'schema: work/uat-flow@1\nid: uat.f.flow\ntitle: t\nstate: done\n',
    'features/f/uat/flow/evidence.yaml': 'schema: work/evidence@1\nrecord: uat.f.flow\nrun: runs/r1\n',
    'features/f/uat/flow/runs/r1/videos/walk.webm': stub,
  });
  assert.ok(settled.refuse.some(line => line.includes('[RUN_MEDIA_FAKE]') && line.includes('settled')), settled.refuse.join('\n'));
  // the census is what makes a clean zero mean something, so the counters are part of the contract
  assert.ok(settled.info.some(line => line.includes('[BYTE_CENSUS]') && line.includes('1 run folder(s) read')
    && line.includes('(1 files)')), settled.info.join('\n'));

  // the same bytes under a run no evidence file settles on: reported, not refused
  const unsettled = findingsFor({
    [flow]: 'schema: work/uat-flow@1\nid: uat.f.flow\ntitle: t\nstate: todo\n',
    'features/f/uat/flow/runs/r1/manifest.yaml': 'schema: starci/uat-run-manifest@1\nid: uat.f.flow.runs.r1\nassets: []\n',
    'features/f/uat/flow/runs/r1/videos/walk.webm': stub,
  });
  assert.ok(unsettled.suspect.some(line => line.includes('[RUN_MEDIA_FAKE]') && line.includes('unsettled')), unsettled.suspect.join('\n'));
  assert.equal(unsettled.refuse.filter(line => line.includes('[RUN_MEDIA_FAKE]')).join('\n'), '');
});

test('a run manifest that lists an asset the run folder does not hold is refused', () => {
  const found = findingsFor({
    'features/f/uat/flow/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.flow\ntitle: t\nstate: todo\n',
    'features/f/uat/flow/runs/r1/manifest.yaml': 'schema: starci/uat-run-manifest@1\nid: uat.f.flow.runs.r1\nassets:\n  - {path: videos/walk.webm, sha256: deadbeef}\n',
  });
  assert.ok(found.refuse.some(line => line.includes('[ASSET_MISSING]') && line.includes('videos/walk.webm') && line.includes('manifest.yaml')), found.refuse.join('\n'));
});

test('RECEIPT_ORPHAN: a receipt binds the artifact it copied, and the tool output name must fit it', () => {
  const bytes = pngBytes();
  const orphan = findingsFor({
    'features/f/ui/one/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.one\ntitle: t\nstate: done\n',
    'features/f/ui/one/assets/generation-receipts.yaml': 'schema: starci/generation-receipts@1\ncalls:\n  - {stage: final, toolOutputBasename: exec-1.png, artifact: assets/one.png, sha256: ' + sha256(bytes) + '}\n',
  });
  assert.ok(orphan.refuse.some(line => line.includes('[ASSET_MISSING]') && line.includes('assets/one.png')), orphan.refuse.join('\n'));

  const renamed = findingsFor({
    'features/f/ui/one/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.one\ntitle: t\nstate: done\n',
    'features/f/ui/one/assets/one.webm': Buffer.concat([EBML, Buffer.alloc(20_000)]),
    'features/f/ui/one/assets/generation-receipts.yaml': 'schema: starci/generation-receipts@1\ncalls:\n  - {stage: final, toolOutputBasename: exec-1.png, artifact: assets/one.webm}\n',
  });
  assert.ok(renamed.refuse.some(line => line.includes('[RECEIPT_ORPHAN]') && line.includes('.png bytes renamed to .webm')), renamed.refuse.join('\n'));
});

test('RESOURCE_FILE_MISSING: the accounts.yaml a uat-flow declares must be there, not read if existsSync', () => {
  const missing = findingsFor({'features/f/uat/flow/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.flow\ntitle: t\nstate: todo\naccounts: accounts.yaml\n'});
  assert.ok(missing.refuse.some(line => line.includes('[RESOURCE_FILE_MISSING]') && line.includes('accounts.yaml')), missing.refuse.join('\n'));

  const present = findingsFor({
    'features/f/uat/flow/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.flow\ntitle: t\nstate: todo\naccounts: accounts.yaml\n',
    'features/f/uat/flow/accounts.yaml': 'schema: work/disposable-accounts@1\ndisposable: true\naccounts: []\n',
  });
  assert.equal(present.refuse.filter(line => line.includes('[RESOURCE_FILE_MISSING]')).join('\n'), '');
});

test('EVIDENCE_ARTIFACT_GHOST: an evidence run that is not a directory on disk is refused', () => {
  const found = findingsFor({
    'features/f/uat/flow/index.yaml': 'schema: work/uat-flow@1\nid: uat.f.flow\ntitle: t\nstate: done\n',
    'features/f/uat/flow/evidence.yaml': 'schema: work/evidence@1\nrecord: uat.f.flow\nrun: runs/never-ran\n',
  });
  assert.ok(found.refuse.some(line => line.includes('[EVIDENCE_ARTIFACT_GHOST]') && line.includes('runs/never-ran')), found.refuse.join('\n'));
});

test('FEATURE_DONE_INCOMPLETE: a done feature over todo members is refused; todo members alone are not', () => {
  const doneParent = findingsFor({
    'features/f/index.yaml': 'schema: work/feature@1\nid: f\ntitle: t\nstate: done\n',
    'features/f/ui/one/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.one\ntitle: t\nstate: todo\n',
  });
  assert.ok(doneParent.refuse.some(line => line.includes('[FEATURE_DONE_INCOMPLETE]') && line.includes('ui.f.one=todo')), doneParent.refuse.join('\n'));

  const todoParent = findingsFor({
    'features/f/index.yaml': 'schema: work/feature@1\nid: f\ntitle: t\nstate: todo\n',
    'features/f/ui/one/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.one\ntitle: t\nstate: todo\n',
  });
  assert.equal(todoParent.refuse.filter(line => line.includes('[FEATURE_DONE_INCOMPLETE]')).join('\n'), '');
});

test('severity discipline: a declared INPUT that is not on disk is suspected, never refused', () => {
  const found = findingsFor(UI_RECORD('    - {path: assets/one.png, role: direction, generation: {tool: image_gen.imagegen, inputRefs: [examples/no-such-fixture-tree/brand/assets/gone.png]}}\n'));
  assert.ok(found.suspect.some(line => line.includes('[EVIDENCE_ARTIFACT_GHOST]') && line.includes('gone.png')), found.suspect.join('\n'));
  assert.equal(found.refuse.filter(line => line.includes('gone.png')).join('\n'), '');
});

test('a superseded direction is checked for its path only - its digest describes the bytes it replaced', () => {
  const bytes = pngBytes();
  const found = findingsFor({
    ...UI_RECORD('    - {path: assets/one.png, role: direction}\n'),
    'features/f/ui/one/assets/one.png': bytes,
    'features/f/ui/one/index.yaml': 'schema: work/ui-screen@1\nid: ui.f.one\ntitle: t\nstate: done\nui:\n  assets:\n    - {path: assets/one.png, role: direction}\n  supersededDirection:\n    revision: 7\n    path: examples/definitely-not-a-real-fixture/one.png\n    sha256: ' + sha256(bytes) + '\n',
  });
  assert.ok(found.refuse.some(line => line.includes('[ASSET_MISSING]') && line.includes('supersededDirection')), found.refuse.join('\n'));
  assert.equal(found.refuse.filter(line => line.includes('[ASSET_DIGEST]')).join('\n'), '');
});

test('selected HFS example citations resolve in their own fixture and refuse absence instead of SUSPECT', () => {
  const runtime = freshDir(), app = path.join(runtime, 'examples', 'lite-app'), work = path.join(app, '.starciwork');
  write(app, 'hfs.json', '{"kind":"app"}\n');
  write(work, 'index.yaml', 'schema: work/catalog@1\nid: lite-app\nfeatures: []\n');
  const bytes = Buffer.from('selected public evidence'), sha = sha256(bytes);
  write(work, 'features/f/impl/one/index.yaml', `schema: work/implementation@1\nid: impl.f.one\nstate: todo\nassets: [{name: proof.txt, sha256: ${sha}}]\n`);
  const invoke = () => { const out = {refuse: [], suspect: [], info: []}; checkWorkArtifacts(work, out, {runtimeRoot: runtime}); return out; };
  const missing = invoke();
  assert.ok(missing.refuse.some(line => line.includes('[ASSET_MISSING]')), missing.refuse.join('\n'));
  assert.equal(missing.suspect.filter(line => line.includes('ASSET_MISSING')).length, 0);
  const cas = path.join(runtime, 'examples', '.runtimes', 'lite-app', 'artifacts');
  write(cas, `${sha.slice(0, 2)}/${sha}`, bytes);
  write(cas, `${sha.slice(0, 2)}/${sha}.json`, JSON.stringify({size: bytes.length, mediaType: 'text/plain', createdAt: '2026-01-01T00:00:00Z'}));
  assert.deepEqual(invoke().refuse, [], 'the actual selected bytes and sidecar are accepted without any catalog row');
  write(cas, `${sha.slice(0, 2)}/${sha}`, Buffer.from('tampered public evidence'));
  assert.ok(invoke().refuse.some(line => line.includes('[ASSET_STORE]')), 'digest corruption is a typed refusal');
});

test('a selected bundle citation cannot pass with an absent member or malformed owner context', () => {
  const runtime = freshDir(), app = path.join(runtime, 'examples', 'scope-app'), work = path.join(app, '.starciwork');
  write(app, 'hfs.json', '{"kind":"app"}\n');
  write(work, 'index.yaml', 'schema: work/catalog@1\nid: scope-app\nfeatures: []\n');
  const member = sha256(Buffer.from('member'));
  const bytes = Buffer.from(JSON.stringify({schema: 'starci/blob-bundle@1', files: {'member.txt': member}})), sha = sha256(bytes);
  write(work, 'features/f/impl/one/index.yaml', `schema: work/implementation@1\nid: impl.f.one\nstate: todo\nassets: [{name: bundle.json, sha256: ${sha}}]\n`);
  const cas = path.join(runtime, 'examples', '.runtimes', 'scope-app', 'artifacts');
  write(cas, `${sha.slice(0, 2)}/${sha}`, bytes);
  write(cas, `${sha.slice(0, 2)}/${sha}.json`, JSON.stringify({size: bytes.length, mediaType: 'application/json', createdAt: '2026-01-01T00:00:00Z'}));
  const out = {refuse: [], suspect: [], info: []};
  checkWorkArtifacts(work, out, {runtimeRoot: runtime});
  assert.ok(out.refuse.some(line => line.includes('[ASSET_BUNDLE]')), out.refuse.join('\n'));
  assert.equal(fs.existsSync(cas + '-views'), false);
  fs.unlinkSync(path.join(app, 'hfs.json'));
  const invalid = {refuse: [], suspect: [], info: []};
  checkWorkArtifacts(work, invalid, {runtimeRoot: runtime});
  assert.ok(invalid.refuse.some(line => line.includes('[ASSET_ROOT]')), invalid.refuse.join('\n'));
});
