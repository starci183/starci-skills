import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyInstall, linkedNodeModulesOf, packageRootOf } from '../scripts/guards/deps-guard.mjs';
import { hookDecision } from '../scripts/guards/command-guard.mjs';
import { kernelMailboxVerdict } from '../scripts/guards/install-verdict.mjs';
import { bindGuardTerminal, writeJobGuard } from '../scripts/guards/install.mjs';

// Contract change install-through-link: an install-family command of npm, pnpm or yarn whose node_modules is a junction
// or symlink empties the live tree it points to (the third wipe, 2026-10-01: a lane's `npm ci` emptied main's
// packages/grammar/node_modules). The command guard refuses it with or without a guard file, through every wrapper.
// The fixtures make junctions in a temp dir only, and each is unlinked (never deleted recursively) before cleanup.
// No refused command is ever run.

const linkType = process.platform === 'win32' ? 'junction' : 'dir';
const fixture = (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'install-link-')));
  const links = [];
  t.after(() => { for (const l of links) { try { fs.unlinkSync(l); } catch { /* gone */ } } fs.rmSync(base, { recursive: true, force: true }); });
  const live = path.join(base, 'main', 'node_modules');
  fs.mkdirSync(path.join(live, 'dep'), { recursive: true });
  fs.writeFileSync(path.join(live, 'dep', 'index.js'), 'live');
  const pkg = (dir, body = '{}') => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'package.json'), body); return dir; };
  const link = (at) => { fs.symlinkSync(live, at, linkType); links.push(at); return at; };
  return { base, live, pkg, link };
};
const unguarded = (command, cwd, tool = 'Bash') => hookDecision({ tool_name: tool, cwd, tool_input: { command } }, { env: { ...process.env, ORCA_TERMINAL_HANDLE: '' } });

test('classifyInstall: the npm, pnpm and yarn install families rewrite node_modules; scripts, globals and dry runs do not', () => {
  for (const [program, argv] of [['npm', ['ci']], ['npm', ['i']], ['npm', ['uninstall', 'x']], ['npm', ['prune']], ['pnpm', ['install']], ['pnpm', ['i', '--frozen-lockfile']],
    ['pnpm', ['add', 'x']], ['pnpm', ['remove', 'x']], ['pnpm', ['prune']], ['pnpm', ['-C', 'pkg', 'install']], ['yarn', []], ['yarn', ['--frozen-lockfile']], ['yarn', ['install']],
    ['yarn', ['add', 'x']], ['yarn', ['remove', 'x']], ['yarn', ['--cwd', 'pkg', 'install']]])
    assert.notEqual(classifyInstall(program, argv).kind, 'pass', `${program} ${argv.join(' ')}`);
  for (const [program, argv] of [['npm', ['run', 'build']], ['npm', ['test']], ['npm', ['ci', '--dry-run']], ['npm', ['i', '-g', 'x']], ['pnpm', ['run', 'build']],
    ['pnpm', ['test']], ['pnpm', ['install', '--lockfile-only']], ['yarn', ['build']], ['yarn', ['global', 'add', 'x']], ['git', ['status']]])
    assert.equal(classifyInstall(program, argv).kind, 'pass', `${program} ${argv.join(' ')}`);
  assert.equal(classifyInstall('npm', ['ci']).kind, 'clean-install');
});

test('the package root comes from the cwd, --prefix, -C, --dir and --cwd (= forms too)', (t) => {
  const f = fixture(t);
  const app = f.pkg(path.join(f.base, 'app'));
  fs.mkdirSync(path.join(app, 'src'));
  assert.equal(packageRootOf(['ci'], path.join(app, 'src')), app);
  for (const argv of [['--prefix', app, 'ci'], [`--prefix=${app}`, 'ci'], ['-C', app, 'install'], ['--dir', app, 'install'], ['--cwd', app], [`--cwd=${app}`]])
    assert.equal(packageRootOf(argv, f.base), app, argv.join(' '));
});

test('a linked node_modules is found at the root, around the root and at the workspace root; a real or missing one is not', (t) => {
  const f = fixture(t);
  // The root's own node_modules is a junction.
  const lane = f.pkg(path.join(f.base, 'lane'));
  f.link(path.join(lane, 'node_modules'));
  for (const program of ['npm', 'pnpm', 'yarn']) assert.ok(linkedNodeModulesOf(program, ['install'], lane), program);
  // A workspace package whose root's node_modules is a junction (the package itself has none yet).
  const ws = f.pkg(path.join(f.base, 'ws'), JSON.stringify({ workspaces: ['packages/*'] }));
  const grammar = f.pkg(path.join(ws, 'packages', 'grammar'));
  f.link(path.join(ws, 'node_modules'));
  assert.equal(linkedNodeModulesOf('npm', ['ci'], grammar)?.nodeModules, path.join(ws, 'node_modules'));
  // A root that sits inside a linked node_modules.
  const inside = path.join(f.base, 'outer');
  f.pkg(inside);
  f.link(path.join(inside, 'node_modules'));
  assert.ok(linkedNodeModulesOf('npm', ['install'], path.join(inside, 'node_modules', 'dep')), 'the root dep/ sits inside the junction');
  // yarn --modules-folder names the folder it writes.
  const plain = f.pkg(path.join(f.base, 'plain'));
  f.link(path.join(f.base, 'elsewhere-nm'));
  assert.ok(linkedNodeModulesOf('yarn', ['--modules-folder', path.join(f.base, 'elsewhere-nm')], plain));
  // A real folder, and no node_modules at all, are not links.
  const real = f.pkg(path.join(f.base, 'real'));
  fs.mkdirSync(path.join(real, 'node_modules'));
  assert.equal(linkedNodeModulesOf('npm', ['ci'], real), null);
  assert.equal(linkedNodeModulesOf('npm', ['ci'], plain), null);
});

test('the hook refuses an install through a junction with no guard file, through cmd, PowerShell and bash wrappers', async (t) => {
  const f = fixture(t);
  const lane = f.pkg(path.join(f.base, 'lane'));
  fs.mkdirSync(path.join(lane, 'sub'));
  f.link(path.join(lane, 'node_modules'));
  const fwd = lane.replace(/\\/g, '/');
  const refused = [
    ['npm ci', lane, 'Bash'],
    ['npm i', path.join(lane, 'sub'), 'Bash'],
    ['npm uninstall left-pad', lane, 'Bash'],
    ['npm prune', lane, 'Bash'],
    [`npm --prefix ${fwd} install`, f.base, 'Bash'],
    ['pnpm install --frozen-lockfile', lane, 'Bash'],
    [`pnpm -C ${fwd} install`, f.base, 'Bash'],
    [`pnpm --dir ${fwd} add x`, f.base, 'Bash'],
    ['yarn', lane, 'Bash'],
    [`yarn --cwd ${fwd} install`, f.base, 'Bash'],
    ['corepack pnpm install', lane, 'Bash'],
    [`cd ${fwd} && npm ci`, f.base, 'Bash'],
    [`cmd //c "cd /d ${lane} && npm ci"`, f.base, 'Bash'],
    [`bash -c "cd ${fwd} && pnpm i"`, f.base, 'Bash'],
    [`powershell -Command "Set-Location '${lane}'; npm install"`, f.base, 'Bash'],
    [`Set-Location '${lane}'; npm ci`, f.base, 'PowerShell'],
  ];
  for (const [command, cwd, tool] of refused) {
    const d = await unguarded(command, cwd, tool);
    assert.ok(d, `refused: ${command}`);
    assert.equal(d.verdict.code, 'DEPS_THROUGH_LINK', command);
    assert.equal(d.verdict.remedy, 'node_modules here is a link to another checkout: unlink it first (cmd /c rmdir) and install for real');
    assert.equal(d.guard, null);
  }
  assert.equal(fs.readFileSync(path.join(f.live, 'dep', 'index.js'), 'utf8'), 'live', 'nothing ran');
  // Allowed: scripts through the junction, an install in a real folder, an install where no node_modules exists yet.
  const real = f.pkg(path.join(f.base, 'real'));
  fs.mkdirSync(path.join(real, 'node_modules'));
  const fresh = f.pkg(path.join(f.base, 'fresh'));
  for (const [command, cwd] of [['npm run build', lane], ['npm test', lane], ['pnpm run lint', lane], ['yarn build', lane], ['npm ci', real], ['pnpm install', real],
    ['npm ci', fresh], ['yarn', fresh], ['git status', lane], ['echo npm ci', lane]])
    assert.equal(await unguarded(command, cwd), null, `${command} in ${path.basename(cwd)}`);
});

test("orca orchestration check is refused from the Kernel's terminal; ops keep it; the Kernel's api reads pass", async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kernel-check-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const seat = (role, handle) => bindGuardTerminal({ skillRoot: root, handle, jobFile: writeJobGuard({ skillRoot: root, jobId: `${role}-job`, workflowId: 'wf', ledgerRepo: null, owned: [], role }) });
  seat('kernel', 'term_kernel');
  seat('op', 'term_op');
  const decide = (command, handle) => hookDecision({ tool_name: 'Bash', cwd: root, tool_input: { command } }, { env: { ...process.env, ORCA_TERMINAL_HANDLE: handle }, root });
  for (const command of ['orca orchestration check --ack', 'orca orchestration check --json', 'orca orchestration check --wait --timeout-ms 600000']) {
    const d = await decide(command, 'term_kernel');
    assert.equal(d?.verdict.code, 'KERNEL_ORCA_CHECK', command);
    assert.match(d.verdict.remedy, /api> messages/);
  }
  for (const command of ['orca orchestration check --ack', 'orca orchestration check --json']) assert.equal(await decide(command, 'term_op'), null, `an op keeps ${command}`);
  for (const command of ['orca orchestration inbox --json', 'orca orchestration worker-show --dispatch d-1', 'node scripts/kernel/api.mjs messages --repo D:/app --workflow wf'])
    assert.equal(await decide(command, 'term_kernel'), null, command);
  assert.equal(kernelMailboxVerdict('orca', ['orchestration', 'check'], null), null, 'no guard, no mailbox rule');
});
