import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isLinkLike } from '../../scripts/api/fs/is-link-like.mjs';
import { safeRemove } from '../../scripts/api/fs/safe-remove.mjs';
import { forbiddenRoot } from '../../scripts/api/fs/forbidden-root.mjs';
import { artifactHoldReason } from '../../scripts/machine/artifact-hold.mjs';
import { safeRemoveWorktree } from '../../scripts/machine/worktree-git.mjs';

// Live defect: a recursive delete of a scratch tree followed node_modules
// junctions into the live repository and deleted 674 tracked files and its node_modules. Git for Windows'
// `git worktree remove --force` follows a junction inside the worktree. The runtime deletes trees only through
// safeRemove, which never descends into a link. Every case here builds a REAL junction (a dir symlink off
// Windows) to a sentinel directory and proves the sentinel is never touched.
const LINK = process.platform === 'win32' ? 'junction' : 'dir';

function sandbox(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-safe-remove-')));
  t.after(() => { safeRemove(root, { hold: artifactHoldReason }); });
  const sentinel = path.join(root, 'sentinel');
  fs.mkdirSync(path.join(sentinel, 'src', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(sentinel, 'package.json'), '{"name":"@scope/ui"}\n');
  fs.writeFileSync(path.join(sentinel, 'src', 'index.ts'), 'export const ui = 1\n');
  fs.writeFileSync(path.join(sentinel, 'src', 'deep', 'leaf.ts'), 'export const leaf = 1\n');
  const intact = () => ['package.json', 'src/index.ts', 'src/deep/leaf.ts'].every((rel) => fs.existsSync(path.join(sentinel, rel)));
  return { root, sentinel, intact };
}

// A scratch shaped like the one that destroyed a live repository: a node_modules whose workspace entries are links to the
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

test('safeRemove removes a tree full of links to a sentinel and never touches the sentinel', (t) => {
  const { root, sentinel, intact } = sandbox(t);
  const scratch = linkedScratch(root, sentinel);
  const out = safeRemove(scratch, { hold: artifactHoldReason });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(fs.existsSync(scratch), false);
  assert.equal(out.removed.links, 2, 'both links are unlinked as links');
  assert.equal(intact(), true, 'the sentinel behind the links is untouched');
  assert.equal(fs.readFileSync(path.join(sentinel, 'src', 'index.ts'), 'utf8'), 'export const ui = 1\n', 'a hard link loses only its name');
});

test('safeRemove on a root that is itself a link unlinks only the link', (t) => {
  const { root, sentinel, intact } = sandbox(t);
  const link = path.join(root, 'root-link');
  fs.symlinkSync(sentinel, link, LINK);
  const out = safeRemove(link, { hold: artifactHoldReason });
  assert.equal(out.ok, true);
  assert.deepEqual(out.removed, { files: 0, dirs: 0, links: 1 });
  assert.equal(intact(), true);
});

test('safeRemove refuses a filesystem root, the home and the temp directory; a missing path is ok', () => {
  assert.equal(forbiddenRoot(path.parse(process.cwd()).root, { hold: artifactHoldReason }), 'a filesystem root');
  assert.equal(safeRemove(os.tmpdir(), { hold: artifactHoldReason }).errors[0].code, 'REFUSED');
  assert.equal(safeRemove(os.homedir(), { hold: artifactHoldReason }).errors[0].code, 'REFUSED');
  assert.equal(safeRemove('', { hold: artifactHoldReason }).ok, false);
  assert.equal(safeRemove(path.join(os.tmpdir(), 'starci-safe-remove-never-made-0'), { hold: artifactHoldReason }).ok, true);
  assert.equal(safeRemove(path.join(os.tmpdir(), 'starci-safe-remove-never-made-0')).errors[0].code, 'REFUSED', 'no artifact-hold check: refused (fail closed)');
});

// The helper that exists to protect live checkouts refuses to remove one whole: the runtime, the repository
// hosting it, the repositories root, and any primary checkout (its .git is a directory). A linked worktree's
// .git is a file, so a scratch worktree still goes.
test('safeRemove refuses the runtime, the repositories root and a primary git checkout', (t) => {
  const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  assert.equal(forbiddenRoot(runtime, { hold: artifactHoldReason }), 'the runtime');
  assert.equal(forbiddenRoot(path.dirname(runtime), { hold: artifactHoldReason }), 'the repository hosting the runtime');
  // A deep checkout names the repositories root; a shallow lane worktree's grandparent is the drive root - refused either way.
  assert.ok(['the repositories root', 'a filesystem root'].includes(forbiddenRoot(path.dirname(path.dirname(runtime)), { hold: artifactHoldReason })));
  const { root } = sandbox(t);
  const { repo, worktree } = repoWithWorktree(root);
  const refused = safeRemove(repo, { hold: artifactHoldReason });
  assert.equal(refused.errors[0]?.code, 'REFUSED');
  assert.match(refused.errors[0].message, /a git checkout/);
  assert.equal(fs.existsSync(path.join(repo, '.git')), true, 'nothing was removed');
  assert.equal(forbiddenRoot(worktree, { hold: artifactHoldReason }), null, 'a linked worktree is removable');
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

// The land gate runs this spec for any change under these roots (land.mjs invariantRootsOf): declared once, here.
export const INVARIANT_ROOTS = ['scripts', 'bin', 'engine'];

test('no runtime script deletes a tree recursively, and only the git call file runs `git worktree remove` (its one caller: worktree-git.mjs safeRemoveWorktree)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(full); continue; }
      if (!/\.(?:mjs|cjs|js)$/.test(entry.name)) continue;
      const rel = path.relative(root, full).replaceAll('\\', '/');
      if (rel === 'scripts/api/fs/safe-remove.mjs' || rel === 'scripts/api/git/worktree-remove.mjs') continue;
      const text = fs.readFileSync(full, 'utf8');
      text.split(/\r?\n/).forEach((line, index) => {
        if (/^\s*(?:\/\/|\*)/.test(line)) return;
        if (/(?:rmSync|rmdirSync|\.rm)\([^)]*recursive\s*:\s*true/.test(line) || /\brimraf\b/.test(line)
          || /['"]worktree['"]\s*,\s*['"]remove['"]/.test(line)) offenders.push(`${rel}:${index + 1}`);
      });
    }
  };
  for (const dir of INVARIANT_ROOTS) if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  assert.deepEqual(offenders, []);
});
