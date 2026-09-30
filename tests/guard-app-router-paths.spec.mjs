import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyGit, pathspecsWithinOwned, literalPathspec, literalAppRouterArgv } from '../scripts/guards/git-policy.mjs';
import { ensureHistoryHook, writeJobGuard, bindGuardTerminal, unbindGuardTerminal } from '../scripts/guards/install.mjs';
import { commandVerdict } from '../scripts/guards/command-guard.mjs';
import { normalizeOwnedPath, ownedPathspec } from '../engine/admission.mjs';

// nivo-fe inc-21f76abb6d10: the op git guard refused `git add` and `git commit` of the op's OWN paths under
// Next.js App Router segments (apps/app/src/app/[locale]/(console)/..., [workspaceId], [templateKey]) with
// PATH_NOT_OWNED - it cut every pathspec at its first `[` as a glob, so `src/app/[locale]/x` was scoped to
// `src/app/`, outside the grant. Owned-path admission (engine/admission.mjs) reads such a segment as a
// literal name; the guard now reads it the same way, named verbatim, in a pathspec list or as :(literal).
const ROOT = path.resolve(import.meta.dirname, '..');

// Owned grants as admission normalizes them, and one file each the op writes under them.
const GRANTS = ['src/app/[locale]', 'src/app/[...slug]', 'src/app/[[...opt]]', 'src/app/(group)', 'src/app/@slot'];
const FILES = [
  'src/app/[locale]/(console)/route-pages.spec.tsx',
  'src/app/[locale]/(console)/agentos/workspaces/[workspaceId]/modules/page.spec.tsx',
  'src/app/[locale]/(console)/(.)[photoId]/page.tsx',
  'src/app/[...slug]/page.tsx',
  'src/app/[[...opt]]/page.tsx',
  'src/app/(group)/settings/page.tsx',
  'src/app/@slot/default.tsx',
];
// A sibling a glob reading of `[locale]` would reach, and a peer's route.
const PEER = ['src/app/l/page.tsx', 'src/app/(auth)/sign-in/page.tsx'];

test('App Router segments in owned paths are literal names to the guard, as to admission', () => {
  const cwd = path.resolve(os.tmpdir(), 'nivo-fe');
  for (const grant of GRANTS) assert.equal(normalizeOwnedPath(grant), grant, `admission admits ${grant} literally`);
  const owned = GRANTS.map((g) => path.join(cwd, g));
  const ctx = { cwd, owned, top: cwd };
  const literal = (p) => `:(literal)${p}`;
  for (const specs of [FILES, FILES.map(literal), FILES.map(ownedPathspec), GRANTS, GRANTS.map(ownedPathspec), ...(process.platform === 'win32' ? [FILES.map((f) => f.replace(/\//g, '\\'))] : [])])
    assert.deepEqual(pathspecsWithinOwned(specs, ctx), { ok: true, outside: [] }, JSON.stringify(specs));
  for (const argv of [['add', '--', ...FILES], ['add', ...FILES], ['commit', '-m', 'x', '--', ...FILES], ['commit', '-m', 'x', ...FILES],
    ['restore', '--staged', '--', ...FILES], ['checkout', '--', FILES[0]], ['reset', '-q', '--', FILES[1]], ['rm', '--cached', FILES[3]],
    ['-C', 'src/app', 'add', '--', '[locale]/(console)/route-pages.spec.tsx', '@slot']])
    assert.equal(classifyGit(argv, ctx).allow, true, `expected allow: git ${argv.join(' ')} ${JSON.stringify(classifyGit(argv, ctx))}`);
  // Still refused: a peer's route, the parent of a grant, and a real glob whose base is outside the grants.
  for (const argv of [['add', '--', PEER[0]], ['add', '--', PEER[1]], ['add', '--', 'src/app'], ['commit', '-m', 'x', '--', FILES[0], PEER[1]],
    ['add', '--', 'src/app/*/page.tsx'], ['add', '--', 'src/app/[locale]/(console)/*.tsx'], ['add', '--', ':(glob)src/app/[locale]/x'], ['add', '--', 'src/app/[lo]*/page.tsx'], ['add', '--', 'src/app/[!x]/page.tsx'], ['add', '--', ':(literal)src/app/[locale]x/page.tsx']]) {
    const v = classifyGit(argv, ctx);
    assert.equal(v.code, 'PATH_NOT_OWNED', `expected PATH_NOT_OWNED: git ${argv.join(' ')}`);
  }
});

test('literalAppRouterArgv names the App Router pathspecs literally, and nothing else', (t) => {
  // git reads a plain [...slug] as a character class: the guard's literal reading holds only if git gets :(literal)
  assert.equal(literalPathspec('src/app/[locale]/(console)/x.tsx'), ':(literal)src/app/[locale]/(console)/x.tsx');
  assert.equal(literalPathspec('src/app/[[...opt]]'), ':(literal)src/app/[[...opt]]');
  assert.equal(literalPathspec(':/src/app/[id]'), ':(top,literal)src/app/[id]');
  assert.equal(literalPathspec(':(top,icase)src/app/[id]'), ':(top,icase,literal)src/app/[id]');
  assert.equal(literalPathspec(':!src/app/[id]'), ':(exclude,literal)src/app/[id]');
  for (const same of ['src/app/(group)/page.tsx', 'src/app/@slot', 'src/mine/a.ts', ':(literal)src/app/[id]', ':(glob)src/app/[id]', 'src/app/[id]/*.tsx', 'src/app/[!x]', 'HEAD', '.'])
    assert.equal(literalPathspec(same), same, same);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'literal-argv-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const A = 'src/app/[locale]/a.tsx', L = `:(literal)${A}`;
  const cases = [
    [['add', '--', A, 'src/x'], ['add', '--', L, 'src/x']],
    [['add', A], ['add', L]],
    [['-C', 'x', 'commit', '-m', 'src/app/[id] message', '-q', A], ['-C', 'x', 'commit', '-m', 'src/app/[id] message', '-q', L]],
    [['restore', '-s', 'HEAD', '--staged', A], ['restore', '-s', 'HEAD', '--staged', L]],
    [['reset', 'HEAD', '--', A], ['reset', 'HEAD', '--', L]],
    [['checkout', 'HEAD', '--', A], ['checkout', 'HEAD', '--', L]],
    [['log', '--', A], ['log', '--', A]],
    [['commit', '-m', 'x', '--', 'src/mine'], ['commit', '-m', 'x', '--', 'src/mine']],
  ];
  for (const [argv, want] of cases) assert.deepEqual(literalAppRouterArgv(argv, { cwd }).argv, want, argv.join(' '));
  fs.writeFileSync(path.join(cwd, 'list.txt'), `${A}\nsrc/mine/b.ts\n`);
  const listFile = path.join(cwd, 'out.nul');
  const viaFile = literalAppRouterArgv(['commit', '-m', 'x', '--pathspec-from-file', 'list.txt'], { cwd, listFile });
  assert.deepEqual(viaFile.argv, ['commit', '-m', 'x', `--pathspec-from-file=${listFile}`, '--pathspec-file-nul']);
  assert.equal(viaFile.list, `${L}\0src/mine/b.ts\0`);
  const viaStdin = literalAppRouterArgv(['add', '--pathspec-from-file=-', '--pathspec-file-nul'], { cwd, listFile, stdin: `${A}\0` });
  assert.deepEqual(viaStdin.argv, ['add', `--pathspec-from-file=${listFile}`, '--pathspec-file-nul']);
  assert.equal(viaStdin.list, `${L}\0`);
  const plain = literalAppRouterArgv(['add', '--pathspec-from-file=-'], { cwd, listFile, stdin: 'src/mine/b.ts\n' });
  assert.deepEqual(plain, { argv: ['add', '--pathspec-from-file=-'], list: null, changed: false }, 'a list without App Router paths passes untouched');
});

const sh = (cwd, args, env = {}) => spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
const write = (repo, rel, text) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), text); };
const committed = (repo) => sh(repo, ['diff-tree', '-r', '--name-only', '--no-commit-id', '-z', 'HEAD']).stdout.split('\0').filter(Boolean).sort();

test('through the command guard, real git stages and commits App Router owned paths as argv, a pathspec list and :(literal)', async (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-approuter-'));
  const guards = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-root-'));
  const lists = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-lists-'));
  const handle = `term_spec-approuter-${process.pid}`;
  t.after(() => { unbindGuardTerminal({ skillRoot: ROOT, handle }); for (const d of [repo, guards, lists]) fs.rmSync(d, { recursive: true, force: true }); });
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['config', 'commit.gpgsign', 'false'], ['config', 'core.quotePath', 'false']]) sh(repo, args);
  for (const rel of [...FILES, ...PEER]) write(repo, rel, 'base\n');
  sh(repo, ['add', '.']);
  assert.equal(sh(repo, ['commit', '-q', '-m', 'base']).status, 0);
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).installed, true);
  const file = writeJobGuard({ skillRoot: guards, jobId: 'op-test.author-approuter', workflowId: 'wf-x', ledgerRepo: null, owned: GRANTS.map((g) => path.join(repo, g)) });
  // The history hook finds the op by the Orca terminal it runs in.
  bindGuardTerminal({ skillRoot: ROOT, handle, jobFile: file });
  const guard = JSON.parse(fs.readFileSync(file, 'utf8'));
  const env = { ...process.env, ORCA_TERMINAL_HANDLE: handle };
  const quote = (a) => `'${a.replace(/'/g, `'\\''`)}'`;
  // What an agent's shell call does: the hook decides first, and only an allowed command reaches git.
  const run = async (args, input) => {
    const refused = await commandVerdict({ command: `git ${args.map(quote).join(' ')}`, cwd: repo, guard, env });
    if (refused) return { status: 2, stderr: `${refused.code}: ${refused.reason}`, refused };
    return spawnSync('git', args, { cwd: repo, encoding: 'utf8', env, ...(input == null ? {} : { input }) });
  };
  const edit = (round) => { for (const rel of FILES) write(repo, rel, `round ${round}\n`); for (const rel of PEER) write(repo, rel, `peer ${round}\n`); };
  const expected = [...FILES].sort();
  const ok = (r, what) => assert.equal(r.status, 0, `${what}: ${r.stderr}`);

  // 1. named verbatim in argv: `[...slug]` is a character class to git that also matches the peer's src/app/l, so
  // that command is refused with its :(literal) form; the paths whose glob reading reaches nothing else pass as written.
  edit(1);
  const slug = FILES.filter((f) => f.startsWith('src/app/[...slug]'));
  const plain = FILES.filter((f) => !slug.includes(f));
  const globbed = await run(['add', '--', ...FILES]);
  assert.equal(globbed.refused?.code, 'APP_ROUTER_GLOB', globbed.stderr);
  assert.match(globbed.refused.reason, /src\/app\/l\/page\.tsx/);
  assert.match(globbed.refused.remedy, /:\(literal\)src\/app\/\[\.\.\.slug\]\/page\.tsx/);
  ok(await run(['add', '--', ...plain]), 'git add -- <App Router paths no glob reading reaches past>');
  ok(await run(['add', '--', ...slug.map((f) => `:(literal)${f}`)]), 'git add -- :(literal)<[...slug] path>');
  ok(await run(['commit', '-q', '-m', 'argv', '--', ...plain, ...slug.map((f) => `:(literal)${f}`)]), 'git commit -- <App Router paths>');
  assert.deepEqual(committed(repo), expected);

  // 2. a --pathspec-from-file list; a stdin list is one the guard cannot read before the command runs
  edit(2);
  const list = path.join(lists, 'owned.txt');
  fs.writeFileSync(list, `${FILES.join('\n')}\n`);
  assert.equal((await run(['add', `--pathspec-from-file=${list}`])).refused?.code, 'APP_ROUTER_GLOB', 'a list entry git would glob past its path');
  fs.writeFileSync(list, `${[...plain, ...slug.map((f) => `:(literal)${f}`)].join('\n')}\n`);
  ok(await run(['add', `--pathspec-from-file=${list}`]), 'git add --pathspec-from-file');
  ok(await run(['commit', '-q', '-m', 'list', `--pathspec-from-file=${list}`]), 'git commit --pathspec-from-file');
  assert.deepEqual(committed(repo), expected);
  edit(3);
  assert.equal((await run(['commit', '-q', '-m', 'stdin list', '--pathspec-from-file=-'], `${FILES.join('\n')}\n`)).refused?.code, 'PATHSPEC_FILE_UNREADABLE');

  // 3. :(literal) pathspecs, and the grants themselves as directories
  ok(await run(['add', '--', ...FILES.map((f) => `:(literal)${f}`)]), 'git add -- :(literal)<paths>');
  ok(await run(['commit', '-q', '-m', 'literal', '--', ...GRANTS.map(ownedPathspec)]), 'git commit -- :(literal)<grants>');
  assert.deepEqual(committed(repo), expected);
  // A grant named verbatim: git's glob reading of the directory reaches no path the literal one does not, so it passes.
  edit(5);
  ok(await run(['commit', '-q', '-m', 'grants', '--', ...GRANTS]), 'git commit -- <grants verbatim>');
  assert.deepEqual(committed(repo), expected);

  // A peer's route is still refused, and its change stays uncommitted.
  const head = sh(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const foreign = await run(['commit', '-q', '-m', 'x', '--', FILES[0], PEER[1]]);
  assert.equal(foreign.status, 2);
  assert.match(foreign.stderr, /PATH_NOT_OWNED[\s\S]*\(auth\)\/sign-in/);
  const foreignList = path.join(lists, 'foreign.txt');
  fs.writeFileSync(foreignList, `${FILES[0]}\n${PEER[0]}\n`);
  assert.equal((await run(['add', `--pathspec-from-file=${foreignList}`])).status, 2);
  assert.equal(sh(repo, ['rev-parse', 'HEAD']).stdout.trim(), head);
  assert.deepEqual(sh(repo, ['status', '--porcelain', '-z', '--', 'src/app/l', 'src/app/(auth)']).stdout.split('\0').filter(Boolean).sort(),
    [' M src/app/(auth)/sign-in/page.tsx', ' M src/app/l/page.tsx'], 'the peer changes stay unstaged and uncommitted');
});
