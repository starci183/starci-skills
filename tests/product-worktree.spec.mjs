// Product worktrees (DESIGN §16.7, FMEA #20; scripts/kernel/product-worktree.mjs). fe-canon 2026-09-28: 16 code.refactor
// slices shared ONE nivo-fe tree, a slice moving apps/app/src/i18n/request.ts changed a sibling's checker inputs mid-run
// (INPUTS_CHANGED_DURING_CHECK). Each op now works in its own worktree off main, lands straight into main at its settle, with a
// node_modules junction overlay whose workspace packages point at the worktree's OWN copy, and the worktree is removed
// (junctions unlinked first, verified) right after the job is released.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import {
  ensureOpWorktree, ensureWorkflowWorktree, landOp, removeOpWorktree, removeWorkflowWorktree, layoutOf, verifyResolution,
  reapJobWorktree, preservedOpRef, planIsolation, shortIdOf, EVENTS, applyDepsUnit, installedIn,
} from '../scripts/kernel/product-worktree.mjs';
import { WORKTREES_REL } from '../scripts/lib/worktree-exclude.mjs';

// The land gate is judged by tests/op-land.spec.mjs and tests/op-gate-loop.spec.mjs; these fixtures carry no app install, so
// their land gate is green, and they have no remote, so nothing is pushed.
const noPush = () => ({ pushed: false, detail: 'spec' });
const greenGate = () => ({ exit: 0, counts: { new: 0 }, findings: [], errors: [] });

const WF = 'wf-nivo-fe-canon-mujek980';
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const real = (p) => fs.realpathSync.native(p);

/** A monorepo like nivo-fe: npm workspaces, node_modules/@nivo/ui -> packages/ui (a junction), tsconfig `@/*` alias. */
function fixtureRepo(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pwt-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'nivo-fe');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'spec@starci.test');
  git(repo, 'config', 'user.name', 'spec');
  git(repo, 'config', 'core.autocrlf', 'false');
  write(repo, '.gitignore', 'node_modules/\n');
  write(repo, 'package.json', JSON.stringify({ name: 'nivo', private: true, workspaces: ['apps/*', 'packages/*'] }));
  write(repo, 'packages/ui/package.json', JSON.stringify({ name: '@nivo/ui', version: '1.0.0', main: 'index.js' }));
  write(repo, 'packages/ui/index.js', 'module.exports = "root-ui";\n');
  write(repo, 'apps/app/package.json', JSON.stringify({ name: '@nivo/app', version: '1.0.0' }));
  write(repo, 'apps/app/tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }));
  write(repo, 'apps/app/src/i18n/request.ts', 'export const locale = "vi";\n');
  write(repo, 'apps/app/src/a.ts', 'import { locale } from "@/i18n/request";\nexport const a = locale;\n');
  write(repo, 'apps/app/src/b.ts', 'import { locale } from "./i18n/request";\nexport const b = locale;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  // The installed tree: a real package, a workspace link (a junction, as npm makes on Windows), a nested node_modules.
  write(repo, 'node_modules/react/package.json', JSON.stringify({ name: 'react', version: '19.0.0', main: 'index.js' }));
  write(repo, 'node_modules/react/index.js', 'module.exports = "react";\n');
  write(repo, 'node_modules/.package-lock.json', '{}');
  fs.mkdirSync(path.join(repo, 'node_modules', '@nivo'), { recursive: true });
  fs.symlinkSync(path.join(repo, 'packages', 'ui'), path.join(repo, 'node_modules', '@nivo', 'ui'), 'junction');
  write(repo, 'apps/app/node_modules/lodash/package.json', JSON.stringify({ name: 'lodash', version: '4.0.0' }));
  write(repo, 'package-lock.json', '{"lockfileVersion":3}');
  git(repo, 'add', 'package-lock.json');
  git(repo, 'commit', '-q', '-m', 'lock');
  return { base, repo };
}

test('two jobs of one workflow get two sibling worktrees off main; the product checkout stays clean', (t) => {
  const { repo } = fixtureRepo(t);
  const a = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-d704825abb' });
  const b = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-97666fb9ba' });
  assert.ok(a.ok, JSON.stringify(a)); assert.ok(b.ok, JSON.stringify(b));
  const root = path.join(repo, ...WORKTREES_REL.split('/'), 'mujek980');
  assert.equal(a.record.workflow.path, path.join(root, '_wf'));
  assert.equal(a.record.op.path, path.join(root, 'd704825a'));
  assert.equal(b.record.op.path, path.join(root, '97666fb9'));
  assert.equal(a.record.op.branch, 'op/d704825a');
  assert.equal(a.record.workflow.branch, 'wf/mujek980');
  assert.equal(git(repo, 'config', '--get', 'branch.op/d704825a.description'), 'op-code.refactor-d704825abb', 'the short branch names its full job id');
  assert.equal(git(repo, 'config', '--get', 'core.longpaths'), 'true');
  assert.match(fs.readFileSync(path.join(repo, '.git', 'info', 'exclude'), 'utf8'), /^\/\.starciwork\/worktrees\/$/m);
  assert.equal(git(repo, 'status', '--porcelain', '--untracked-files=all'), '', 'the worktrees dir never shows in the product checkout');
  assert.equal(a.record.baseSha, git(repo, 'rev-parse', 'main'));
  // A requeued attempt of the same job reuses its tree.
  const again = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-d704825abb' });
  assert.ok(again.ok && again.created === false);
});

test('the node_modules overlay: real dirs of junctions, workspace packages resolve INSIDE the worktree', (t) => {
  const { repo } = fixtureRepo(t);
  const a = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-d704825abb' });
  assert.ok(a.ok, JSON.stringify(a));
  const wt = a.record.op.path;
  assert.ok(!fs.lstatSync(path.join(wt, 'node_modules')).isSymbolicLink(), 'node_modules is a real directory, not one junction');
  assert.ok(!fs.lstatSync(path.join(wt, 'node_modules', '@nivo')).isSymbolicLink(), 'a scope dir is real too');
  assert.equal(real(path.join(wt, 'node_modules', '@nivo', 'ui')), real(path.join(wt, 'packages', 'ui')), '@nivo/ui is the worktree\'s own packages/ui');
  assert.equal(real(path.join(wt, 'node_modules', 'react')), real(path.join(repo, 'node_modules', 'react')), 'a third-party package is the root install');
  assert.equal(real(path.join(wt, 'apps', 'app', 'node_modules', 'lodash')), real(path.join(repo, 'apps', 'app', 'node_modules', 'lodash')), 'a workspace dir\'s own node_modules is overlaid too');
  assert.ok(fs.existsSync(path.join(wt, 'node_modules', '.package-lock.json')), 'files are copied');
  // Node itself resolves the workspace package inside the worktree.
  write(wt, 'packages/ui/index.js', 'module.exports = "worktree-ui";\n');
  const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(require("@nivo/ui"))'], { cwd: wt, encoding: 'utf8' });
  assert.equal(r.stdout, 'worktree-ui', `require('@nivo/ui') from the worktree reads the worktree's copy (${r.stderr})`);
  const check = verifyResolution(wt, { workspace: [{ name: 'node_modules/@nivo/ui' }] });
  assert.ok(check.ok, JSON.stringify(check));
});

test('a file move in one op worktree is invisible to its sibling; removal never touches a junction target', (t) => {
  const { repo } = fixtureRepo(t);
  const a = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-d704825abb' }).record;
  const b = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-97666fb9ba' }).record;
  fs.mkdirSync(path.join(a.op.path, 'apps/app/src/modules/i18n'), { recursive: true });
  git(a.op.path, 'mv', 'apps/app/src/i18n/request.ts', 'apps/app/src/modules/i18n/request.ts');
  git(a.op.path, 'commit', '-q', '-m', 'move i18n');
  assert.ok(fs.existsSync(path.join(b.op.path, 'apps/app/src/i18n/request.ts')), 'the sibling\'s check inputs never moved');
  assert.ok(fs.existsSync(path.join(repo, 'apps/app/src/i18n/request.ts')), 'nor did the product checkout');
  // Evidence the op left uncommitted under .starciwork is salvaged, verified, before the tree goes.
  write(a.op.path, '.starciwork/evidence/run.json', '{"ok":true}');
  const salvage = path.join(path.dirname(repo), 'evidence', WF, 'op-a');
  const removed = removeOpWorktree({ record: a, salvageTo: salvage });
  assert.ok(removed.ok, JSON.stringify(removed));
  assert.deepEqual(removed.verified, { dirGone: true, pruned: true });
  assert.equal(fs.readFileSync(path.join(salvage, 'worktree-salvage', '.starciwork', 'evidence', 'run.json'), 'utf8'), '{"ok":true}');
  assert.ok(!fs.existsSync(a.op.path));
  assert.ok(!git(repo, 'worktree', 'list', '--porcelain').includes(a.op.path.replace(/\\/g, '/')), 'no registration left');
  assert.ok(fs.existsSync(path.join(repo, 'node_modules', 'react', 'index.js')), 'the root install is untouched');
  assert.ok(fs.existsSync(path.join(repo, 'packages', 'ui', 'index.js')), 'the root workspace package is untouched');
  assert.ok(fs.existsSync(path.join(repo, 'apps', 'app', 'node_modules', 'lodash', 'package.json')));
  assert.ok(fs.existsSync(path.join(b.op.path, 'packages', 'ui', 'index.js')), 'the sibling worktree is untouched');
  // Its commit never landed: the work is kept on preserved/<op> for a continuation, not lost.
  assert.equal(removed.branch.preserved?.branch, `preserved/${a.op.short}`, JSON.stringify(removed.branch));
  assert.equal(preservedOpRef(repo, 'op-code.refactor-d704825abb')?.sha, git(repo, 'rev-parse', removed.branch.preserved.branch));
  assert.notEqual(spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${a.op.branch}`], { cwd: repo }).status, 0, 'op/<op> is deleted');
  // A continuation of that job starts from the preserved work and consumes the branch.
  const cont = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-aa11bb22cc', handFrom: ['op-code.refactor-d704825abb'] });
  assert.ok(cont.ok, JSON.stringify(cont));
  assert.ok(fs.existsSync(path.join(cont.record.op.path, 'apps/app/src/modules/i18n/request.ts')), 'the continuation holds the partial commit');
  assert.equal(preservedOpRef(repo, 'op-code.refactor-d704825abb'), null, 'the preserved branch was handed over');
});

test('land: a green op lands straight into main; a conflicting one is refused with hunks; a red pre-land verify leaves main untouched', (t) => {
  const { repo } = fixtureRepo(t);
  const a = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-d704825abb' }).record;
  const b = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-97666fb9ba' }).record;
  write(a.op.path, 'apps/app/src/i18n/request.ts', 'export const locale = "en";\n');
  git(a.op.path, 'commit', '-qam', 'a: en');
  write(b.op.path, 'apps/app/src/i18n/request.ts', 'export const locale = "fr";\n');
  git(b.op.path, 'commit', '-qam', 'b: fr');
  const okA = landOp({ gate: greenGate, push: noPush, record: a, head: git(a.op.path, 'rev-parse', 'HEAD') });
  assert.ok(okA.ok, JSON.stringify(okA));
  assert.equal(git(repo, 'rev-parse', 'main'), okA.after, 'main fast-forwarded to the op head');
  assert.equal(okA.after, git(a.op.path, 'rev-parse', 'HEAD'), 'an op on top of main lands as it is');
  assert.equal(fs.readFileSync(path.join(repo, 'apps/app/src/i18n/request.ts'), 'utf8'), 'export const locale = "en";\n', 'the live checkout moved with main');
  assert.equal(git(repo, 'status', '--porcelain', '--untracked-files=no'), '', 'and is clean');
  assert.equal(git(repo, 'rev-parse', 'wf/mujek980'), okA.after, 'wf/<wf> follows main');
  assert.equal(okA.push.detail, 'spec');
  assert.equal(landOp({ gate: greenGate, push: noPush, record: a, head: git(a.op.path, 'rev-parse', 'HEAD') }).already, true, 'idempotent');
  const conflict = landOp({ gate: greenGate, push: noPush, record: b, head: git(b.op.path, 'rev-parse', 'HEAD') });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'product-integrate-conflict');
  assert.equal(conflict.conflicts[0].file, 'apps/app/src/i18n/request.ts');
  assert.match(conflict.conflicts[0].hunks[0].text, /<<<<<<< /);
  assert.equal(git(repo, 'rev-parse', 'main'), okA.after, 'a refused land leaves main untouched');
  // An op green on its own base that imports a path main lacks: refused before main moves, a continuation.
  const c = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-cc33dd44ee' }).record;
  write(c.op.path, 'apps/app/src/c.ts', 'import { x } from "@/i18n/gone";\nexport const c = x;\n');
  git(c.op.path, 'add', '-A'); git(c.op.path, 'commit', '-qm', 'c');
  const cHead = git(c.op.path, 'rev-parse', 'HEAD');
  const red = landOp({ gate: greenGate, push: noPush, record: c, head: cHead });
  assert.equal(red.reason, 'product-integrate-red', JSON.stringify(red));
  assert.match(red.failures.join(' '), /IMPORTS_BROKEN_AFTER_MOVE/);
  assert.equal(red.continuation.base, okA.after);
  assert.equal(git(repo, 'rev-parse', 'main'), okA.after, 'main never moved');
  assert.equal(git(c.op.path, 'rev-parse', 'HEAD'), cHead, 'the op worktree is back on its own head');
  assert.ok(!fs.existsSync(path.join(repo, 'apps/app/src/c.ts')));
  // A dependency manifest change is the deps unit's.
  const d = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: 'op-code.refactor-ee55ff66aa' }).record;
  write(d.op.path, 'package.json', JSON.stringify({ name: 'nivo', private: true, workspaces: ['apps/*', 'packages/*'], dependencies: { x: '1' } }));
  git(d.op.path, 'commit', '-qam', 'deps');
  const refused = landOp({ gate: greenGate, push: noPush, record: d });
  assert.equal(refused.reason, 'deps-unit-required');
  assert.match(refused.hint, /api product-deps --workflow wf-nivo-fe-canon-mujek980 --from-job op-code.refactor-ee55ff66aa/);
  // The serial deps unit: the manifests land on main, _wf gets a real install, the op overlays now mirror it.
  const installs = [];
  const deps = applyDepsUnit({ record: d, push: noPush, install: (argv, cwd) => { installs.push({ argv, cwd }); write(cwd, 'node_modules/x/package.json', '{"name":"x"}'); return { ok: true, exitCode: 0 }; } });
  assert.ok(deps.ok, JSON.stringify(deps));
  assert.deepEqual(deps.files, ['package.json']);
  assert.equal(git(repo, 'rev-parse', 'main'), deps.commit, 'the deps commit landed on main');
  assert.deepEqual(installs, [{ argv: ['npm', 'ci'], cwd: d.workflow.path }]);
  assert.ok(installedIn(d.workflow.path), 'the _wf holds the real install');
  assert.equal(real(path.join(d.op.path, 'node_modules', 'x')), real(path.join(d.workflow.path, 'node_modules', 'x')), 'the op overlay mirrors the workflow install');
  assert.ok(deps.rebuilt.some((r) => r.path === d.op.path && r.ok));
  assert.equal(landOp({ gate: greenGate, push: noPush, record: d }).ok, true, 'its manifests are main\'s now: the op settles');
});

test('released -> worktree-removed: the reap records the transition once; the workflow worktree goes at the workflow end', (t) => {
  const { base, repo } = fixtureRepo(t);
  const ledgerRepo = path.join(base, 'nivo-backend');
  fs.mkdirSync(ledgerRepo);
  const ledger = openLedger({ file: ledgerFileFor(ledgerRepo) });
  try {
  ledger.ensureWorkflow({ workflowId: WF, title: 'fe canon' });
  const jobId = 'op-code.refactor-d704825abb';
  const made = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId });
  ledger.write.createUnit({ workflowId: WF, unitId: jobId, opId: 'code.refactor', subjectKey: jobId, goalRevision: 1 });
  ledger.enqueueJob({ jobId, workflowId: WF, unitId: jobId, opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor', productWorktree: made.record, terminalClosed: { ok: true, verified: { ok: true, proof: 'spec' } } } });
  const now = Date.now();
  assert.equal(reapJobWorktree({ ledger, ledgerRepo, jobId, now }).skipped, 'job-queued', 'a live job keeps its tree');
  for (const to of ['ready', 'leased', 'running', 'reported', 'succeeded'])
    ledger.db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE job_id=?').run(to, now, jobId);
  const r = reapJobWorktree({ ledger, ledgerRepo, jobId, now: now + 1000 });
  assert.equal(r.removed, true, JSON.stringify(r));
  const ev = ledger.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=?').all(jobId, EVENTS.removed);
  assert.equal(ev.length, 1);
  assert.deepEqual(JSON.parse(ev[0].payload_json).verified, { dirGone: true, pruned: true });
  assert.equal(JSON.parse(ev[0].payload_json).from, 'released');
  assert.equal(reapJobWorktree({ ledger, ledgerRepo, jobId }).skipped, 'already-removed', 'idempotent');
  // The workflow worktree: removed with its branch once no op dir is left, <wf> dir gone.
  const lay = layoutOf({ repoRoot: repo, workflowId: WF });
  const wfGone = removeWorkflowWorktree({ repoRoot: repo, workflowId: WF });
  assert.equal(wfGone.ok, true, JSON.stringify(wfGone));
  assert.equal(wfGone.branch.preserved, null, 'wf/<wf> holds nothing main lacks: nothing to preserve');
  assert.ok(!fs.existsSync(lay.wfDir), 'the empty <wf> directory is removed');
  assert.ok(fs.existsSync(path.join(repo, 'node_modules', 'react', 'index.js')));
  } finally { ledger.close(); }
});

test('isolation is opt-in by op policy and uses the one app repository for either side', (t) => {
  const { repo } = fixtureRepo(t);
  const binding = { appRoot: repo, repos: [{ role: 'be', root: path.join(repo, 'be') }, { role: 'fe', root: path.join(repo, 'fe') }] };
  assert.equal(planIsolation({ brief: { policy: {} }, placements: [], binding }).reason, 'policy-shared');
  assert.equal(planIsolation({ brief: { policy: { isolation: 'worktree' } }, placements: [{ role: 'be', via: 'placement' }], binding }).repoRoot, repo);
  assert.equal(planIsolation({ brief: { policy: { isolation: 'worktree' } }, placements: [{ role: 'be' }, { role: 'fe' }], binding }).repoRoot, repo);
  assert.equal(shortIdOf('wf-nivo-fe-canon-mujek980'), 'mujek980');
  assert.equal(shortIdOf('op-code.refactor-d704825abb'), 'd704825a');
});

test('the .starciwork holding the worktrees container is never the Work root of a path inside a worktree', async () => {
  const { workRootOf } = await import('../scripts/work/work-io.mjs');
  const repo = path.resolve(os.tmpdir(), 'nivo-fe');
  assert.equal(workRootOf(path.join(repo, '.starciwork', 'worktrees', 'mujek980', 'd704825a', 'apps', 'app')), null);
  assert.equal(workRootOf(path.join(repo, '.starciwork', 'worktrees', 'mujek980', 'd704825a', '.starciwork', 'features')),
    path.join(repo, '.starciwork', 'worktrees', 'mujek980', 'd704825a', '.starciwork'), 'a worktree\'s own Work dir still is');
});

test('defaultIsolation worktree takes every committing op; non-committing ops and the runtime repo keep the shared tree', async () => {
  const { isolationOf, productSettings, SKILL_ROOT } = await import('../scripts/kernel/product-worktree.mjs');
  const settings = { ...productSettings(), defaultIsolation: 'worktree' };
  assert.equal(isolationOf({ policy: { commitPolicy: { mode: 'scoped-local-commit' } } }, settings), 'worktree');
  assert.equal(isolationOf({ policy: { commitPolicy: { mode: 'none' } } }, settings), 'shared', 'an op that never commits would lose its writes');
  assert.equal(isolationOf({ policy: {} }, settings), 'shared');
  assert.equal(isolationOf({ policy: { isolation: 'shared', commitPolicy: { mode: 'scoped-local-commit' } } }, settings), 'shared', 'a brief may opt out');
  const binding = { appRoot: SKILL_ROOT, repos: [{ role: 'be', root: path.join(SKILL_ROOT, 'be') }, { role: 'fe', root: path.join(SKILL_ROOT, 'fe') }] };
  assert.equal(planIsolation({ brief: { policy: { isolation: 'worktree' } }, placements: [{ role: 'fe', via: 'path-repository' }], binding }).reason, 'runtime-repo');
});

test('the environment pre-step serves the product repo\'s services from the WORKFLOW worktree on its own port', async () => {
  const { retargetEnvironment } = await import('../scripts/uat/env-health.mjs');
  const repo = path.resolve(os.tmpdir(), 'nivo-backend'), fe = path.resolve(os.tmpdir(), 'nivo-fe');
  const wf = path.join(fe, '.starciwork', 'worktrees', 'mujek980', '_wf');
  const doc = { id: 'env.local', configuration: { ports: { app: 3067, api: 3068 },
    start: { app: { command: 'npm run dev -- -p 3067', cwd: '../nivo-fe/apps/app' }, api: { command: 'npm run start', cwd: '.' } } },
  probes: [{ id: 'app', target: 'http://localhost:3067/', expect: 200 }, { id: 'api', target: 'http://localhost:3068/health/live' }],
  target: { origins: { app: 'http://localhost:3067' } } };
  const { doc: out, moved } = retargetEnvironment(doc, { repo, worktree: { path: wf, repoRoot: fe, port: 43500, tag: 'mujek980' } });
  assert.deepEqual(Object.keys(moved), ['app'], 'only the product repository\'s service moves; the API stays shared');
  assert.equal(out.id, 'env.local@mujek980', 'one registry entry per worktree');
  assert.equal(out.configuration.start.app.cwd, path.join(wf, 'apps', 'app'));
  assert.deepEqual(out.configuration.start.app.command, ['npm', 'run', 'dev', '--', '-p', '43500']);
  assert.equal(out.configuration.start.app.env.PORT, '43500');
  assert.equal(out.probes[0].target, 'http://localhost:43500/');
  assert.equal(out.probes[1].target, 'http://localhost:3068/health/live');
  assert.equal(out.target.origins.app, 'http://localhost:43500');
  assert.equal(doc.configuration.start.app.cwd, '../nivo-fe/apps/app', 'the declaration itself is untouched');
  assert.equal(retargetEnvironment(doc, { repo, worktree: null }).doc, doc, 'no worktree: the live checkout as before');
});
