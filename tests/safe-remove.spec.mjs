import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isLinkLike, safeRemoveTree, safeRemoveWorktree, forbiddenRoot } from '../scripts/lib/safe-remove.mjs';

// nivo-fe inc-c8fbf76aa499 (2026-09-25 05:47): a recursive delete of a scratch tree followed node_modules
// junctions into the live repository and deleted 674 tracked files and its node_modules. Git for Windows'
// `git worktree remove --force` follows a junction inside the worktree. The runtime deletes trees only through
// safeRemoveTree, which never descends into a link. Every case here builds a REAL junction (a dir symlink off
// Windows) to a sentinel directory and proves the sentinel is never touched.
const LINK = process.platform === 'win32' ? 'junction' : 'dir';

function sandbox(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-safe-remove-')));
  t.after(() => { safeRemoveTree(root); });
  const sentinel = path.join(root, 'sentinel');
  fs.mkdirSync(path.join(sentinel, 'src', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(sentinel, 'package.json'), '{"name":"@scope/ui"}\n');
  fs.writeFileSync(path.join(sentinel, 'src', 'index.ts'), 'export const ui = 1\n');
  fs.writeFileSync(path.join(sentinel, 'src', 'deep', 'leaf.ts'), 'export const leaf = 1\n');
  const intact = () => ['package.json', 'src/index.ts', 'src/deep/leaf.ts'].every((rel) => fs.existsSync(path.join(sentinel, rel)));
  return { root, sentinel, intact };
}

// A scratch shaped like the one that destroyed nivo-fe: a node_modules whose workspace entries are links to the
// sentinel (the live package), a direct link at the top, plain files, and a hard link to a sentinel file.
function linkedScratch(root, sentinel, name = 'scratch') {
  const scratch = path.join(root, name);
  fs.mkdirSync(path.join(scratch, 'node_modules', '@scope'), { recursive: true });
  fs.mkdirSync(path.join(scratch, 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'node_modules', 'dep', 'index.js'), 'module.exports = 1\n');
  fs.symlinkSync(sentinel, path.join(scratch, 'node_modules', '@scope', 'ui'), LINK);
  fs.symlinkSync(path.join(sentinel, 'src'), path.join(scratch, 'src-link'), LINK);
  fs.writeFileSync(path.join(scratch, 'plain.txt'), 'x\n');
  fs.linkSync(path.join(sentinel, 'src', 'index.ts'), path.join(scratch, 'hard-index.ts'));
  return scratch;
}

test('isLinkLike: a junction (or dir symlink) is a link, a plain directory and a file are not', (t) => {
  const { root, sentinel } = sandbox(t);
  const link = path.join(root, 'link');
  fs.symlinkSync(sentinel, link, LINK);
  assert.equal(isLinkLike(link), true);
  assert.equal(isLinkLike(sentinel), false);
  assert.equal(isLinkLike(path.join(sentinel, 'package.json')), false);
  assert.equal(isLinkLike(path.join(root, 'missing')), false);
});

test('safeRemoveTree removes a tree full of links to a sentinel and never touches the sentinel', (t) => {
  const { root, sentinel, intact } = sandbox(t);
  const scratch = linkedScratch(root, sentinel);
  const out = safeRemoveTree(scratch);
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(fs.existsSync(scratch), false);
  assert.equal(out.removed.links, 2, 'both links are unlinked as links');
  assert.equal(intact(), true, 'the sentinel behind the links is untouched');
  assert.equal(fs.readFileSync(path.join(sentinel, 'src', 'index.ts'), 'utf8'), 'export const ui = 1\n', 'a hard link loses only its name');
});

test('safeRemoveTree on a root that is itself a link unlinks only the link', (t) => {
  const { root, sentinel, intact } = sandbox(t);
  const link = path.join(root, 'root-link');
  fs.symlinkSync(sentinel, link, LINK);
  const out = safeRemoveTree(link);
  assert.equal(out.ok, true);
  assert.deepEqual(out.removed, { files: 0, dirs: 0, links: 1 });
  assert.equal(intact(), true);
});

test('safeRemoveTree refuses a filesystem root, the home and the temp directory; a missing path is ok', () => {
  assert.equal(forbiddenRoot(path.parse(process.cwd()).root), 'a filesystem root');
  assert.equal(safeRemoveTree(os.tmpdir()).errors[0].code, 'REFUSED');
  assert.equal(safeRemoveTree(os.homedir()).errors[0].code, 'REFUSED');
  assert.equal(safeRemoveTree('').ok, false);
  assert.equal(safeRemoveTree(path.join(os.tmpdir(), 'starci-safe-remove-never-made-0')).ok, true);
});

// The helper that exists to protect live checkouts refuses to remove one whole: the runtime, the repository
// hosting it, the repositories root, and any primary checkout (its .git is a directory). A linked worktree's
// .git is a file, so a scratch worktree still goes.
test('safeRemoveTree refuses the runtime, the repositories root and a primary git checkout', (t) => {
  const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  assert.equal(forbiddenRoot(runtime), 'the runtime');
  assert.equal(forbiddenRoot(path.dirname(runtime)), 'the repository hosting the runtime');
  assert.equal(forbiddenRoot(path.dirname(path.dirname(runtime))), 'the repositories root');
  const { root } = sandbox(t);
  const { repo, worktree } = repoWithWorktree(root);
  const refused = safeRemoveTree(repo);
  assert.equal(refused.errors[0]?.code, 'REFUSED');
  assert.match(refused.errors[0].message, /a git checkout/);
  assert.equal(fs.existsSync(path.join(repo, '.git')), true, 'nothing was removed');
  assert.equal(forbiddenRoot(worktree), null, 'a linked worktree is removable');
});

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=spec', '-c', 'user.email=spec@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
function repoWithWorktree(root) {
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  const worktree = path.join(root, 'wt');
  git(repo, 'worktree', 'add', '-q', '--detach', worktree, 'main');
  return { repo, worktree };
}

test('safeRemoveWorktree removes a worktree holding node_modules links without git walking it, and prunes it', (t) => {
  const { root, sentinel, intact } = sandbox(t);
  const { repo, worktree } = repoWithWorktree(root);
  fs.mkdirSync(path.join(worktree, 'node_modules', '@scope'), { recursive: true });
  fs.symlinkSync(sentinel, path.join(worktree, 'node_modules', '@scope', 'ui'), LINK);
  fs.symlinkSync(sentinel, path.join(worktree, 'live'), LINK);
  const out = safeRemoveWorktree(worktree, { repo });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(fs.existsSync(worktree), false);
  assert.doesNotMatch(git(repo, 'worktree', 'list', '--porcelain'), /[\\/]wt\b/);
  assert.equal(intact(), true);
});

test('no runtime script deletes a tree recursively or through `git worktree remove` except via safe-remove', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(full); continue; }
      if (!/\.(?:mjs|cjs|js)$/.test(entry.name)) continue;
      const rel = path.relative(root, full).replaceAll('\\', '/');
      if (rel === 'scripts/lib/safe-remove.mjs') continue;
      const text = fs.readFileSync(full, 'utf8');
      text.split(/\r?\n/).forEach((line, index) => {
        if (/^\s*(?:\/\/|\*)/.test(line)) return;
        if (/(?:rmSync|rmdirSync|\.rm)\([^)]*recursive\s*:\s*true/.test(line) || /\brimraf\b/.test(line)
          || /['"]worktree['"]\s*,\s*['"]remove['"]/.test(line)) offenders.push(`${rel}:${index + 1}`);
      });
    }
  };
  for (const dir of ['scripts', 'bin', 'engine']) if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  assert.deepEqual(offenders, []);
});
