import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { putBlob, getBlob, blobAsFile, bundleDir, ensureExternalRoot } from '../../engine/db/blob.mjs';

// A trusted root reached through a spelling that is not its canonical path (a symlinked or junctioned prefix, a Windows 8.3 short name) is the
// root's own business; only what lies below the root is judged.
const LINK = process.platform === 'win32' ? 'junction' : 'dir';
const fixture = t => {
  const real = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-blob-spelling-'))), holder = `${real}-via`;
  const prior = process.env.STARCI_ARTIFACT_ROOT;
  process.env.STARCI_ARTIFACT_ROOT = path.join(real, 'artifacts');
  fs.symlinkSync(path.dirname(real), holder, LINK);
  t.after(() => {
    if (prior === undefined) delete process.env.STARCI_ARTIFACT_ROOT; else process.env.STARCI_ARTIFACT_ROOT = prior;
    fs.rmSync(holder, { recursive: true, force: true }); fs.rmSync(real, { recursive: true, force: true });
  });
  return { real, linked: path.join(holder, path.basename(real)) };
};
// The Windows 8.3 short spelling of a directory, or the reason this host has none.
const shortOf = dir => {
  if (process.platform !== 'win32') return { reason: 'only Windows volumes have 8.3 short names' };
  const run = spawnSync('cmd.exe', ['/d', '/s', '/c', `"for %I in ("${dir}") do @echo %~sI"`], { encoding: 'utf8', windowsVerbatimArguments: true });
  const short = run.status === 0 ? run.stdout.trim() : '';
  return short && short.toLowerCase() !== dir.toLowerCase() ? { alias: short } : { reason: 'this volume has no 8.3 short name for the temp directory (fsutil 8dot3name query <drive>:)' };
};
const store = () => {
  const member = putBlob(Buffer.from('member bytes')).sha;
  const manifest = putBlob(Buffer.from(JSON.stringify({ schema: 'starci/blob-bundle@1', files: { 'a/member.txt': member } }))).sha;
  return { member, manifest };
};
const readAll = (root, { member, manifest }) => {
  assert.equal(getBlob(member, { root }).toString(), 'member bytes');
  assert.ok(fs.readFileSync(blobAsFile(member, { root, ext: '.txt' }), 'utf8') === 'member bytes');
  assert.equal(fs.readFileSync(path.join(bundleDir(manifest, { root }), 'a', 'member.txt'), 'utf8'), 'member bytes');
};

test('an explicit read root through a symlinked or junctioned prefix reads blobs, views and bundles', t => {
  const fx = fixture(t), ids = store();
  readAll(path.join(fx.linked, 'artifacts'), ids);
});

test('an explicit read root through its 8.3 short spelling reads blobs, views and bundles', t => {
  const fx = fixture(t), ids = store(), { alias, reason } = shortOf(fx.real);
  if (!alias) return t.skip(`this host offers no 8.3 short spelling of the temp directory: ${reason}`);
  readAll(path.join(alias, 'artifacts'), ids);
});

test('a link or junction directory below the read root is still refused, under every spelling of the root', t => {
  const fx = fixture(t), { member } = store(), { alias } = shortOf(fx.real);
  const prefix = path.join(fx.real, 'artifacts', member.slice(0, 2)), moved = `${prefix}-moved`;
  fs.renameSync(prefix, moved);
  fs.symlinkSync(moved, prefix, LINK);
  for (const base of [fx.real, fx.linked, alias].filter(Boolean)) assert.throws(() => getBlob(member, { root: path.join(base, 'artifacts') }), /regular directory|linked|spelling/);
});

test('a symlinked leaf below the read root is still refused', t => {
  const fx = fixture(t), { member } = store(), leaf = path.join(fx.real, 'artifacts', member.slice(0, 2), member), copy = `${leaf}.copy`;
  fs.renameSync(leaf, copy);
  try { fs.symlinkSync(copy, leaf, 'file'); } catch { fs.mkdirSync(`${copy}-dir`); fs.symlinkSync(`${copy}-dir`, leaf, LINK); } // no file-symlink privilege: a junction leaf is the link
  for (const base of [fx.real, fx.linked]) assert.throws(() => getBlob(member, { root: path.join(base, 'artifacts') }), /contained regular file|not found/);
});

test('the writer root: .runtime/artifacts is accepted under a non-canonical spelling, an un-ignored in-checkout root is refused under both', t => {
  const fx = fixture(t), spellings = [fx.real, fx.linked, shortOf(fx.real).alias].filter(Boolean), repo = path.join(fx.real, 'repo');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const state = path.join(repo, '.runtime');
  for (const base of spellings) {
    const root = path.join(base, 'repo', '.runtime', 'artifacts');
    assert.throws(() => ensureExternalRoot(root, state), /not git-ignored/);
    assert.throws(() => ensureExternalRoot(path.join(base, 'repo', 'artifacts'), state), /inside a git checkout/);
  }
  fs.writeFileSync(path.join(repo, '.gitignore'), '/.runtime/\n');
  for (const base of spellings) for (const stateSpelling of spellings.map(other => path.join(other, 'repo', '.runtime'))) {
    assert.doesNotThrow(() => ensureExternalRoot(path.join(base, 'repo', '.runtime', 'artifacts'), stateSpelling));
    assert.throws(() => ensureExternalRoot(path.join(base, 'repo', 'artifacts'), stateSpelling), /inside a git checkout/);
  }
});

test('a root that reaches a checkout through a link outside it is still judged inside the checkout', t => {
  const fx = fixture(t), repo = path.join(fx.real, 'repo'), gateway = path.join(fx.real, 'gateway');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true }); fs.mkdirSync(path.join(repo, 'sub'));
  fs.symlinkSync(path.join(repo, 'sub'), gateway, LINK); // no .git is visible above the link's own spelling
  assert.throws(() => ensureExternalRoot(path.join(gateway, 'artifacts'), path.join(repo, '.runtime')), /inside a git checkout/);
});
