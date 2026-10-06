import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { winPath } from '../fixtures/win-path.mjs';
import { putBlob, getBlob, blobPath, blobAsFile, bundleDir, resolveBlob, assetFileOf } from '../../engine/db/blob.mjs';

const fixture = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-blob-custody-'));
  const prior = process.env.STARCI_ARTIFACT_ROOT;
  process.env.STARCI_ARTIFACT_ROOT = path.join(root, 'artifacts');
  t.after(() => { if (prior === undefined) delete process.env.STARCI_ARTIFACT_ROOT; else process.env.STARCI_ARTIFACT_ROOT = prior; fs.rmSync(root, { recursive: true, force: true }); });
  return root;
};
const bundle = files => putBlob(Buffer.from(JSON.stringify({ schema: 'starci/blob-bundle@1', files })), { mediaType: 'application/json' }).sha;

test('portable bundle names reject traversal, drive paths, special names and colliding destinations before materialization', t => {
  const root = fixture(t), sha = putBlob(Buffer.from('verified member')).sha;
  for (const rel of ['../escape.txt', '..\\escape.txt', winPath('C', 'escape.txt'), '//server/share', 'a//b', 'a/./b', 'nul.txt', 'a:stream', '.complete', 'a.']) {
    assert.throws(() => bundleDir(bundle({ [rel]: sha })), /unsafe blob bundle path/);
  }
  for (const files of [{ 'A.txt': sha, 'a.txt': sha }, { a: sha, 'a/b.txt': sha }]) assert.throws(() => bundleDir(bundle(files)), /collision|also a directory/);
  assert.equal(fs.existsSync(`${path.join(root, 'artifacts')}-views`), false);
  assert.equal(fs.existsSync(path.join(root, 'escape.txt')), false);
});

test('same-size corrupted source and cached evidence are refused instead of being returned as the cited digest', t => {
  fixture(t);
  const sha = putBlob(Buffer.from('proof-one')).sha;
  const file = blobAsFile(sha, { ext: '.txt' });
  fs.writeFileSync(file, 'proof-two');
  assert.throws(() => blobAsFile(sha, { ext: '.txt' }), /view hash mismatch/);
  fs.writeFileSync(blobPath(sha), 'proof-two');
  assert.throws(() => blobAsFile(sha, { ext: '.txt' }), /blob hash mismatch/);
  assert.throws(() => blobAsFile(sha, { ext: '/../escape' }), /simple suffix/);
});

test('a completion marker cannot hide a missing or changed bundle member', t => {
  fixture(t);
  const sha = putBlob(Buffer.from('proof-one')).sha;
  const manifest = bundle({ 'nested/proof.txt': sha });
  const dir = bundleDir(manifest);
  assert.equal(fs.readFileSync(path.join(dir, 'nested', 'proof.txt'), 'utf8'), 'proof-one');
  fs.writeFileSync(path.join(dir, 'nested', 'proof.txt'), 'proof-two');
  assert.throws(() => bundleDir(manifest), /view hash mismatch/);
  fs.unlinkSync(path.join(dir, 'nested', 'proof.txt'));
  assert.throws(() => bundleDir(manifest), /incomplete/);
});

test('a junction used as a cached bundle root never becomes a write target', t => {
  const root = fixture(t), sha = putBlob(Buffer.from('member')).sha;
  const manifest = bundle({ 'member.txt': sha });
  const parent = `${path.join(root, 'artifacts')}-views`;
  fs.mkdirSync(path.join(parent, 'bundles'), { recursive: true });
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(parent, 'bundles', manifest), 'junction');
  assert.throws(() => bundleDir(manifest), /regular directory/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('a missing store member preserves bundleDir null while getBlob remains an ENOENT reader', t => {
  const root = fixture(t), sha = putBlob(Buffer.from('missing member')).sha;
  const manifest = bundle({ 'member.txt': sha });
  fs.unlinkSync(blobPath(sha));
  assert.throws(() => getBlob(sha), error => error.code === 'ENOENT');
  assert.equal(bundleDir(manifest), null);
  assert.equal(fs.existsSync(`${path.join(root, 'artifacts')}-views`), false, 'missing members must not start materialization');
});

test('explicit read roots isolate selected bytes, bundle members and views from the default store', t => {
  const base = fixture(t), defaultRoot = path.join(base, 'artifacts');
  const sha = putBlob(Buffer.from('selected member'), { mediaType: 'text/plain' }).sha;
  const manifest = bundle({ 'nested/member.txt': sha });
  const first = path.join(base, 'fixture-one', 'artifacts'), second = path.join(base, 'fixture-two', 'artifacts');
  fs.cpSync(defaultRoot, first, { recursive: true });
  fs.mkdirSync(second, { recursive: true });
  const prior = process.env.STARCI_ARTIFACT_ROOT;
  assert.equal(getBlob(sha, { root: first }).toString(), 'selected member');
  assert.equal(resolveBlob(sha, { root: second }), null, 'a default-store hit cannot supply an absent selected fixture');
  assert.throws(() => getBlob(sha, { root: second }), error => error.code === 'ENOENT');
  const view = blobAsFile(sha, { root: first, ext: '.txt' });
  assert.ok(view.startsWith(first + '-views' + path.sep));
  assert.equal(assetFileOf(base, { name: 'member.txt', sha256: sha }, { root: first }), view);
  const directory = bundleDir(manifest, { root: first });
  assert.ok(directory.startsWith(first + '-views' + path.sep));
  assert.equal(fs.readFileSync(path.join(directory, 'nested', 'member.txt'), 'utf8'), 'selected member');
  assert.equal(bundleDir(manifest, { root: second }), null);
  assert.equal(getBlob(sha, { root: first }).toString(), 'selected member', 'A → B → A retains per-call identity');
  assert.equal(process.env.STARCI_ARTIFACT_ROOT, prior);
  assert.equal(fs.existsSync(second + '-views'), false);
});

test('selected readers refuse malformed roots, linked prefixes, case aliases and invalid sidecars', t => {
  const base = fixture(t), defaultRoot = path.join(base, 'artifacts'), sha = putBlob(Buffer.from('proof-one')).sha;
  const selected = path.join(base, 'selected', 'artifacts');
  fs.cpSync(defaultRoot, selected, { recursive: true });
  for (const root of ['', '.', '..', 3, {}]) assert.throws(() => getBlob(sha, { root }), /absolute path/);
  assert.throws(() => getBlob(sha.toUpperCase(), { root: selected }), /lowercase sha256/);
  const prefix = path.join(selected, sha.slice(0, 2));
  fs.rmSync(prefix, { recursive: true });
  fs.symlinkSync(path.join(defaultRoot, sha.slice(0, 2)), prefix, 'junction');
  assert.throws(() => getBlob(sha, { root: selected }), /regular directory|linked|spelling/);
  fs.rmSync(prefix, { recursive: true });
  fs.cpSync(path.join(defaultRoot, sha.slice(0, 2)), prefix, { recursive: true });
  const sidecar = path.join(prefix, sha + '.json');
  fs.writeFileSync(sidecar, JSON.stringify({ size: 9, mediaType: '', createdAt: 'invalid' }));
  assert.throws(() => getBlob(sha, { root: selected }), /sidecar/);
  fs.unlinkSync(sidecar);
  assert.throws(() => getBlob(sha, { root: selected }), error => error.code === 'ENOENT');
  fs.copyFileSync(path.join(defaultRoot, sha.slice(0, 2), sha + '.json'), sidecar);
  fs.renameSync(path.join(prefix, sha), path.join(prefix, sha.toUpperCase()));
  assert.throws(() => getBlob(sha, { root: selected }), /spelling|regular file|not found/);
  assert.equal(getBlob(sha).toString(), 'proof-one', 'refusal never damages the ordinary external store');
});

test('selected bundle verification refuses corrupt or absent members before any reusable view', t => {
  const base = fixture(t), defaultRoot = path.join(base, 'artifacts'), sha = putBlob(Buffer.from('proof-one')).sha;
  const manifest = bundle({ 'member.txt': sha }), selected = path.join(base, 'selected', 'artifacts');
  fs.cpSync(defaultRoot, selected, { recursive: true });
  const member = blobPath(sha, { root: selected });
  fs.writeFileSync(member, 'proof-two');
  assert.throws(() => bundleDir(manifest, { root: selected }), /hash mismatch/);
  assert.equal(fs.existsSync(selected + '-views'), false);
  fs.unlinkSync(member);
  assert.equal(bundleDir(manifest, { root: selected }), null, 'the caller must refuse this missing bundle result');
  assert.equal(fs.existsSync(selected + '-views'), false);
  assert.equal(getBlob(sha).toString(), 'proof-one');
});

test('scoped reader support grants no operational writer permission inside Git', t => {
  const base = fixture(t);
  fs.mkdirSync(path.join(base, '.git'));
  assert.throws(() => putBlob(Buffer.from('must not be written')), /inside a git checkout/);
  assert.equal(fs.existsSync(path.join(base, 'artifacts')), false);
});
