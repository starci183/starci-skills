// land-gate.spec.mjs — the runtime children a seat terminal spawns run without the seat's Orca identity
// (scripts/lib/seat-env.mjs withoutSeatEnv): a caller/guard bound to that identity would admit them as the seat —
// a spec's `cli.mjs` child resolved the seat's custody (kernel-caller-unknown), a staging `npm ci`'s `node install.js`
// postinstall read as a raw supervisor tool call (RIGHTS_RAW_TOOL) once the spawn loop's worker-start had put the PATH
// shim first — so a spec's result depended on which terminal ran it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { specRunEnv, packageProofCheck, PACKAGE_PROOF } from '../../scripts/supervisor/land.mjs';
import { checkoutPaths } from '../../scripts/api/git/checkout-paths.mjs';
import { fastForwardLive } from '../../scripts/machine/live-fast-forward.mjs';
import { createStaging } from '../../scripts/supervisor/workers.mjs';
import { ci } from '../../scripts/api/npm/ci.mjs';
import { SEAT_ENV_VARS, withoutSeatEnv } from '../../scripts/lib/seat-env.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

const SEATED = { ORCA_TERMINAL_HANDLE: 'term_seat', ORCA_PANE_KEY: 'pane-1', ORCA_TAB_ID: 'tab-1', ORCA_WORKTREE_ID: 'wt-1', ORCA_AGENT_HOOK_TOKEN: 'tok', ORCA_AGENT_HOOK_PORT: '1', STARCI_ROLE: 'supervisor', STARCI_GUARD_FILE: 'g.json', STARCI_CALLER: 'runtime-settler' };
const seatKeys = (env) => Object.keys(env).filter((k) => SEAT_ENV_VARS.includes(k) || k.startsWith('ORCA_AGENT_'));
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

test('withoutSeatEnv takes the env as a parameter: no process.env default (RT_BASE_IMPURE)', () => {
  assert.deepEqual(withoutSeatEnv(), {});
  assert.deepEqual(withoutSeatEnv({ ...SEATED, PATH: '/bin', GIT_AUTHOR_NAME: 'kept' }), { PATH: '/bin', GIT_AUTHOR_NAME: 'kept' });
});

test('the gate spec env carries none of the seat identity when the parent exports it', () => {
  const env = specRunEnv({ PATH: '/bin', NODE_TEST_CONTEXT: 'child', GIT_DIR: '/leaked', GIT_AUTHOR_NAME: 'kept', ...SEATED });
  assert.deepEqual(seatKeys(env), []);
  assert.equal(env.PATH, '/bin');
  assert.equal(env.GIT_AUTHOR_NAME, 'kept');
  assert.equal(env.GIT_DIR, undefined, 'repository-local git vars stay dropped');
  assert.equal(env.NODE_TEST_CONTEXT, undefined);
});

test('the package proof child gets the spec env: no seat identity reaches it', (t) => {
  for (const [key, value] of Object.entries(SEATED)) process.env[key] = value;
  t.after(() => { for (const key of Object.keys(SEATED)) delete process.env[key]; });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-land-proof-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const script = path.join(dir, PACKAGE_PROOF);
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, '// proof\n');
  let seen;
  const out = packageProofCheck({ dir, base: 'b'.repeat(40), runner: (args, opts) => { seen = opts.env; return { ok: true, status: 0, stdout: '', stderr: '' }; } });
  assert.equal(out.ok, true);
  assert.deepEqual(seatKeys(seen), []);
});

test('both stagings of one spawn install with the seat identity scrubbed from the shared env', (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-seat-stage-')));
  t.after(() => { spawnSync('git', ['-C', path.join(base, 'rt'), 'worktree', 'prune'], { windowsHide: true }); fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const root = path.join(base, 'rt');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'spec@starci.test');
  git(root, 'config', 'user.name', 'spec');
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'lock');
  // One env object serves the whole spawn pass, like spawnWorkers' pass.env — the seat identity rides it.
  const env = { ...process.env, ...SEATED, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite'), STARCI_LOCAL_ROOT: path.join(base, 'la') };
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
  const installs = [];
  const install = (dir, opts) => { installs.push({ dir: path.resolve(dir), env: opts?.env }); return { ok: true, status: 0, stderr: '' }; };
  const first = createStaging({ jobId: 'fix-seat-1', root, env, orca, install });
  const second = createStaging({ jobId: 'fix-seat-2', root, env, orca, install });
  assert.ok(first.ok && second.ok, first.error ?? second.error);
  assert.equal(installs.length, 2, 'both stagings install');
  for (const { env: installed } of installs) {
    assert.ok(installed && typeof installed === 'object', 'the staging install names the env it runs with');
    assert.deepEqual(seatKeys(installed), [], 'the install env has no seat identity');
  }
});

test('npm ci runs its lifecycle scripts without the seat identity (a `node postinstall.js` binds no role)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-seat-ci-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'seat-env-ci', version: '1.0.0', scripts: { postinstall: 'node postinstall.js' } }));
  fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ name: 'seat-env-ci', version: '1.0.0', lockfileVersion: 3, requires: true, packages: { '': { name: 'seat-env-ci', version: '1.0.0' } } }));
  fs.writeFileSync(path.join(dir, 'postinstall.js'), `require('fs').writeFileSync('installed-env.json', JSON.stringify(process.env));\n`);
  const r = ci(dir, { env: { ...process.env, ...SEATED } });
  assert.ok(r.ok, r.stderr);
  const seen = JSON.parse(fs.readFileSync(path.join(dir, 'installed-env.json'), 'utf8'));
  assert.deepEqual(seatKeys(seen), []);
});

/* land-non-atomic-tree-update: the gate's live-tree update must never let a reader see a partial file. */

const makeLiveRepo = (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-land-atomic-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'spec@starci.test');
  git(root, 'config', 'user.name', 'spec');
  git(root, 'config', 'core.autocrlf', 'false'); // the live runtime's own config: worktree bytes are the blob bytes
  return root;
};

test('a live-tree path update is atomic: a concurrent reader only ever reads the old or the new full content', async (t) => {
  const root = makeLiveRepo(t);
  const aux = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-land-reader-')));
  t.after(() => fs.rmSync(aux, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const file = 'mod.mjs';
  const oldContent = `// old\nconst blob = '${'a'.repeat(4 * 1024 * 1024)}';\nexport default blob;\n`;
  const newContent = `// new\nconst blob = '${'b'.repeat(4 * 1024 * 1024)}';\nexport default blob;\n`;
  fs.writeFileSync(path.join(root, file), oldContent);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  const base = git(root, 'rev-parse', 'main');
  fs.writeFileSync(path.join(root, file), newContent);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'head');
  const head = git(root, 'rev-parse', 'main');
  git(root, 'reset', '--hard', '-q', base); // the live checkout sits on base while the gate moves it to head
  // A reader polls the changed file until the done flag appears; every read that is neither the old nor the new
  // full content - a truncated write, an empty file, an ENOENT while the name is unlinked - is a violation.
  const contents = path.join(aux, 'contents.json');
  const doneFlag = path.join(aux, 'done');
  const outFile = path.join(aux, 'out.json');
  fs.writeFileSync(contents, JSON.stringify([oldContent, newContent]));
  const readerFile = path.join(aux, 'reader.mjs');
  fs.writeFileSync(readerFile, `import fs from 'node:fs';
const [file, contents, doneFlag, outFile] = process.argv.slice(2);
const ok = new Set(JSON.parse(fs.readFileSync(contents, 'utf8')));
const bad = [];
const pause = new Int32Array(new SharedArrayBuffer(4));
let reads = 0;
for (;;) {
  let s;
  try { s = fs.readFileSync(file, 'utf8'); } catch (e) { s = 'THREW:' + (e && e.code); }
  reads++;
  if (!ok.has(s) && bad.length < 10) bad.push(s.startsWith('THREW:') ? s : 'len=' + s.length);
  if (fs.existsSync(doneFlag)) break;
  Atomics.wait(pause, 0, 0, 10); // a sparse poll: a Windows read holds the file open, and a rename over an open file is EPERM - the gate retries that, so the poll leaves the file closed most of the time
}
fs.writeFileSync(outFile, JSON.stringify({ reads, bad }));
`);
  const child = spawn(process.execPath, [readerFile, path.join(root, file), contents, doneFlag, outFile], { windowsHide: true, stdio: 'ignore' });
  t.after(() => { try { child.kill(); } catch { /* exited */ } });
  const rows = [['M', file]];
  for (let i = 0; i < 10; i++) {
    const fwd = fastForwardLive({ root, base, head, rows });
    assert.ok(fwd.ok, JSON.stringify(fwd));
    const back = fastForwardLive({ root, base: head, head: base, rows });
    assert.ok(back.ok, JSON.stringify(back));
  }
  fs.writeFileSync(doneFlag, '1');
  await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  const report = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.ok(report.reads > 0, 'the reader ran');
  assert.deepEqual(report.bad, [], `a reader saw a partial or missing file during the live tree update (${report.reads} reads)`);
});

test('checkoutPaths retries a rename refused while the target is open elsewhere, and gives up bounded', (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-land-eperm-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const tmpName = '.merge_file_spec';
  const fakeGit = (args, opts) => {
    const verb = args.find((a) => !a.startsWith('-'));
    if (verb === 'ls-tree') return { ok: true, stdout: `100644 blob ${'a'.repeat(40)}\tsub/tgt.mjs\0`, stderr: '' };
    if (verb === 'update-index') { assert.ok(String(opts.input).includes('sub/tgt.mjs'), 'the index stages the rev entry'); return { ok: true, stdout: '', stderr: '' }; }
    if (verb === 'checkout-index') { fs.writeFileSync(path.join(root, tmpName), 'new full content'); return { ok: true, stdout: `${tmpName}\tsub/tgt.mjs\0`, stderr: '' }; }
    return { ok: true, stdout: '', stderr: '' };
  };
  let renames = 0;
  const flaky = (from, to) => { renames++; if (renames < 3) throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' }); fs.renameSync(from, to); };
  const retried = checkoutPaths(root, 'HEAD', ['sub/tgt.mjs'], { git: fakeGit, rename: flaky, sleep: () => {} });
  assert.ok(retried.ok, JSON.stringify(retried));
  assert.equal(renames, 3);
  assert.equal(fs.readFileSync(path.join(root, 'sub', 'tgt.mjs'), 'utf8'), 'new full content');
  // A refusal that never clears is bounded: the call fails, never a partial write.
  let clock = 0;
  fs.writeFileSync(path.join(root, tmpName), 'new full content');
  const refused = checkoutPaths(root, 'HEAD', ['sub/tgt.mjs'], {
    git: fakeGit,
    rename: () => { throw Object.assign(new Error('resource busy'), { code: 'EBUSY' }); },
    sleep: () => {},
    now: () => (clock += 40),
    waitMs: 100,
  });
  assert.equal(refused.ok, false);
  assert.match(refused.stderr, /EBUSY.*busy|rename over sub\/tgt\.mjs/);
});

test('checkoutPaths keeps the index consistent with the tree - writes, additions and deletions - and refuses an unknown path', (t) => {
  const root = makeLiveRepo(t);
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sub', 'keep.txt'), 'old\n');
  fs.writeFileSync(path.join(root, 'dead.txt'), 'x\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  const base = git(root, 'rev-parse', 'main');
  fs.writeFileSync(path.join(root, 'sub', 'keep.txt'), 'new\n');
  fs.writeFileSync(path.join(root, 'fresh.txt'), 'f\n');
  git(root, 'rm', '-q', 'dead.txt');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'head');
  const head = git(root, 'rev-parse', 'main');
  git(root, 'reset', '--hard', '-q', base);
  const r = checkoutPaths(root, head, ['sub/keep.txt', 'fresh.txt', 'dead.txt']);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(fs.readFileSync(path.join(root, 'sub', 'keep.txt'), 'utf8'), 'new\n');
  assert.equal(fs.readFileSync(path.join(root, 'fresh.txt'), 'utf8'), 'f\n');
  assert.equal(fs.existsSync(path.join(root, 'dead.txt')), false, 'gone at head: removed from the tree');
  assert.equal(git(root, 'diff', '--name-only'), '', 'the worktree matches the index');
  const staged = git(root, 'ls-files', '-s');
  assert.match(staged, /fresh\.txt/);
  assert.doesNotMatch(staged, /dead\.txt/);
  assert.equal(fs.readdirSync(root).filter((n) => n.includes('merge_file')).length, 0, 'no temp file left behind');
  const bad = checkoutPaths(root, head, ['never-known.txt']);
  assert.equal(bad.ok, false, 'a path absent at the rev and the index refuses like a checkout pathspec that matches nothing');
});
