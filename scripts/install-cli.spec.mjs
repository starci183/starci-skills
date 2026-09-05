// The installer must produce a tree the validators accept, refuse to overwrite a .claude it did not
// install, keep a person's local edit across update, and write the two bootstraps exactly once.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as nodeTest } from 'node:test';
import { fileURLToPath } from 'node:url';
// An installed tree has no bin/ and no package.json beside scripts/, so doctor skips this file there.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isPackage = existsSync(path.join(root, 'bin', 'starci-skills.mjs')) && existsSync(path.join(root, 'package.json'));
const { PAYLOAD, init, update, doctor } = isPackage ? await import('../bin/starci-skills.mjs') : {};
const pkg = isPackage ? JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) : null;
const test = (name, fn) => nodeTest(name, { skip: isPackage ? false : 'not the package checkout' }, fn);
const quiet = () => {};

function freshRepo() {
  const repo = mkdtempSync(path.join(tmpdir(), 'starci-skills-'));
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  return repo;
}

test('package.json ships exactly the runtime paths the installer copies, plus bin and the READMEs', () => {
  const shipped = pkg.files.map((f) => f.replace(/\/$/, ''));
  for (const p of PAYLOAD) assert.ok(shipped.includes(p), `${p} is copied by init but not in package.json files`);
  for (const stale of ['sites', 'docs', 'tests', '.github']) assert.ok(!shipped.includes(stale), `${stale} must not ship`);
  assert.equal(pkg.bin['starci-skills'], 'bin/starci-skills.mjs');
  assert.equal(pkg.publishConfig.access, 'public');
  assert.match(readFileSync(path.join(root, 'INDEX.md'), 'utf8'), new RegExp(`^# StarCi Skills ${pkg.version.replace(/\./g, '\\.')}$`, 'm'));
});

test('init installs the tree, writes both bootstraps and the sessions ignore, and doctor --quick passes', () => {
  const repo = freshRepo();
  try {
    const manifest = init({ dir: repo, force: false, bootstrap: true }, quiet);
    assert.equal(manifest.version, pkg.version);
    for (const p of PAYLOAD) assert.ok(existsSync(path.join(repo, '.claude', p)), `${p} not installed`);
    assert.ok(!existsSync(path.join(repo, '.claude', 'package.json')), 'the package manifest is not part of the runtime');
    for (const name of ['CLAUDE.md', 'AGENTS.md']) {
      const text = readFileSync(path.join(repo, name), 'utf8');
      assert.match(text, /\.claude\/INDEX\.md/);
      // Every prompt reaches the one entry; its protocol owns session and goal mechanics.
      assert.match(text, /For every user prompt, enter \[StarCi\]\(\.claude\/INDEX\.md\)/);
      assert.match(text, /Follow-up prompts reuse that host session/);
    }
    assert.match(readFileSync(path.join(repo, '.gitignore'), 'utf8'), /^\.worktrees\/sessions\/$/m);
    assert.equal(doctor({ dir: repo, quick: true }, quiet), 0);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('init refuses a populated .claude it did not install, and --force replaces only runtime paths', () => {
  const repo = freshRepo();
  try {
    mkdirSync(path.join(repo, '.claude'));
    writeFileSync(path.join(repo, '.claude', 'settings.json'), '{}\n');
    assert.throws(() => init({ dir: repo, force: false, bootstrap: false }, quiet), /was not installed by/);
    init({ dir: repo, force: true, bootstrap: false }, quiet);
    assert.ok(existsSync(path.join(repo, '.claude', 'settings.json')), 'a file outside the runtime paths survives --force');
    assert.ok(!existsSync(path.join(repo, 'CLAUDE.md')), '--no-bootstrap writes no bootstrap');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('update keeps a locally changed file and lists it; --force takes the package version', () => {
  const repo = freshRepo();
  try {
    init({ dir: repo, force: false, bootstrap: false }, quiet);
    const target = path.join(repo, '.claude', 'workflows', 'README.md');
    const original = readFileSync(target, 'utf8');
    writeFileSync(target, `${original}\nlocal note\n`);
    unlinkSync(path.join(repo, '.claude', 'routing.json'));
    const lines = [];
    const manifest = update({ dir: repo, force: false }, (l) => lines.push(l));
    assert.deepEqual(manifest.keptLocal, ['workflows/README.md']);
    assert.match(readFileSync(target, 'utf8'), /local note/);
    assert.ok(existsSync(path.join(repo, '.claude', 'routing.json')), 'a deleted runtime file comes back');
    assert.ok(lines.some((l) => l.startsWith('kept workflows/README.md')));
    update({ dir: repo, force: true }, quiet);
    assert.equal(readFileSync(target, 'utf8'), original);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('update adds prompt routing once to an existing bootstrap without replacing local instructions', () => {
  const repo = freshRepo();
  try {
    init({ dir: repo, force: false, bootstrap: false }, quiet);
    const custom = '# Team instructions\n\nRead .claude/INDEX.md first.\nKeep our local review policy.\n';
    writeFileSync(path.join(repo, 'AGENTS.md'), custom);
    update({ dir: repo, force: false }, quiet);
    const first = readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');
    assert.ok(first.startsWith(custom), 'local instructions survive the entry upgrade');
    assert.equal(first.split('<!-- starci:prompt-entry -->').length - 1, 1);
    update({ dir: repo, force: false }, quiet);
    assert.equal(readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'), first, 'updating again does not append duplicate policy');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('update --no-bootstrap preserves existing host instructions byte for byte', () => {
  const repo = freshRepo();
  try {
    init({ dir: repo, force: false, bootstrap: false }, quiet);
    const custom = '# Existing host\nRead .claude/INDEX.md.\n';
    writeFileSync(path.join(repo, 'AGENTS.md'), custom);
    update({ dir: repo, force: false, bootstrap: false }, quiet);
    assert.equal(readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'), custom);
    assert.ok(!existsSync(path.join(repo, 'CLAUDE.md')));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
