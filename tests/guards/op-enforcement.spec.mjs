// op-enforcement.spec.mjs — what an Op may do on the host (modules/kernel/command-policy.yaml `op` and `orca.self-lifecycle` refuse-for,
// scripts/guards/op-starci.mjs, op-write-scope.mjs): it reports only to its own Kernel, runs the capability verbs of its work and
// not the control plane, and writes only inside the paths its attempt owns and the runtime temp directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileWriteVerdict } from '../../scripts/guards/rights.mjs';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = loadCommandPolicy({ root: ROOT });
const HANDLE = 'term-op-enforce';
const verdict = (role, program, args) => policyVerdict({ role, command: { program, args, cwd: ROOT }, handle: HANDLE, policy: POLICY });
const send = (...extra) => ['orchestration', 'send', '--from', HANDLE, '--type', 'escalation', '--subject', 'blocked', ...extra];

test('an Op addresses no one: --to and --run on send and ask are refused with the report verb named', () => {
  const calls = [send('--to', 'term_other'), send('--run', 'run_other'), send(`--to=term_other`),
    ['orchestration', 'ask', '--from', HANDLE, '--question', 'what next', '--to', 'term_other'], ['orchestration', 'ask', '--from', HANDLE, '--question', 'what next', '--run', 'run_x']];
  for (const args of calls) {
    const refused = verdict('op', 'orca', args);
    assert.equal(refused?.code, 'OP_REPORTS_TO_KERNEL', args.join(' '));
    assert.match(refused.remedy, /starci kernel report/);
  }
});

test('an Op still sends its own heartbeat, escalation and ask to the Run of its Kernel', () => {
  assert.equal(verdict('op', 'orca', send()), null);
  assert.equal(verdict('op', 'orca', ['orchestration', 'ask', '--from', HANDLE, '--question', 'what next', '--options', 'a,b']), null);
});

test('the other bound roles keep the recipient options of the Orca protocol', () => {
  for (const role of ['lead', 'coordinator']) assert.equal(verdict(role, 'orca', send('--to', 'term_other')), null, role);
});

test('an Op runs the capability verbs of its work and reports; the control plane is refused with them named', () => {
  for (const args of [['kernel', 'report', '--job', 'j'], ['test', 'run', '--level', 'L1'], ['gate', 'unit', '--root', 'app'], ['app', 'stack', 'up'], ['work', 'draw-render', '--help'], ['runtime', 'validate']]) {
    assert.equal(verdict('op', 'starci', args), null, args.join(' '));
  }
  for (const group of ['supervisor', 'reconciler', 'workflow', 'route', 'debug']) {
    const refused = verdict('op', 'starci', [group, 'status']);
    assert.equal(refused?.code, 'RIGHTS_OP_CONTROL_PLANE', group);
    assert.match(refused.remedy, /starci kernel report/);
    assert.match(refused.remedy, /starci app stack/);
  }
});

const WORKTREE = path.join(path.parse(ROOT).root, 'starci-op-scope', 'wf-tree');
const OWNED = path.join(WORKTREE, 'apps', 'web');
const GUARD = { role: 'op', workflowWorktree: WORKTREE, owned: [OWNED] };
const write = (file, guard = GUARD) => fileWriteVerdict({ role: 'op', filePath: file, guard, zone: { runtimeRoot: null } });

test('an Op writes inside its owned paths and the runtime temp directory only', () => {
  assert.equal(write(path.join(OWNED, 'src', 'page.tsx')), null);
  assert.equal(write(path.join(os.tmpdir(), 'starci-op-scratch', 'report.json')), null);
  for (const outside of [path.join(WORKTREE, 'apps', 'api', 'main.ts'), path.join(WORKTREE, 'package.json'), path.join(path.dirname(WORKTREE), 'wf-other', 'a.ts')]) {
    const refused = write(outside);
    assert.equal(refused?.code, 'RIGHTS_OP_OUTSIDE_OWNED', outside);
    assert.match(refused.remedy, /owed in your report/);
  }
});

test('a worktree under the temp directory is still confined', () => {
  const tree = path.join(os.tmpdir(), 'starci-op-scope-tmp', 'wf-tree');
  const guard = { role: 'op', workflowWorktree: tree, owned: [path.join(tree, 'a')] };
  assert.equal(write(path.join(tree, 'b', 'x.ts'), guard)?.code, 'RIGHTS_OP_OUTSIDE_OWNED');
  assert.equal(write(path.join(tree, 'a', 'x.ts'), guard), null);
});

test('an Op that owns no path writes nothing in its worktree, and a guard without a worktree is not confined', () => {
  assert.equal(write(path.join(WORKTREE, 'apps', 'web', 'x.ts'), { ...GUARD, owned: [] })?.code, 'RIGHTS_OP_OUTSIDE_OWNED');
  assert.equal(write(path.join(WORKTREE, 'x.ts'), { role: 'op', owned: [OWNED] }), null);
});

test('a write inside the runtime checkout keeps its own refusal', () => {
  const zone = { runtimeRoot: ROOT, rel: 'scripts/kernel/cli.mjs', zone: null, catalog: null };
  assert.equal(fileWriteVerdict({ role: 'op', filePath: path.join(ROOT, zone.rel), guard: GUARD, zone })?.code, 'RIGHTS_OP_RUNTIME_WRITE');
});
