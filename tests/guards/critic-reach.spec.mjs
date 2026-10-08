import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hookDecision } from '../../scripts/guards/command-guard.mjs';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';
import { CRITIC_REACH_CODE } from '../../scripts/guards/critic-reach.mjs';
import { rightsRoleOf } from '../../scripts/guards/rights.mjs';
import { currentRole, requireRole } from '../../scripts/cli/roles.mjs';
import { writeJobGuard } from '../../scripts/guards/hook-install.mjs';
import { CRITIC_TOOL_GUARD_MATCHER, ensureLaunchTrust } from '../../scripts/agent/trust-launch.mjs';
import { TOOL_GUARD_MATCHER } from '../../scripts/agent/trust.mjs';

// The Critic reaches nothing but its own directory: its shell runs only read-only programs on paths inside it and writes only
// the verdict file, its file tools write only the verdict file, and on Claude its read tools read only inside the directory.
// Every refusal carries RIGHTS_CRITIC_REACH. The same table judges the PreToolUse hook and the PATH shim (policyVerdict).

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const HANDLE = 'term_critic_reach';
const policy = loadCommandPolicy({ root: ROOT });

const world = (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-reach-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const dir = path.join(base, 'critic-dir');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'render-1.png'), 'png');
  fs.writeFileSync(path.join(base, 'secret.txt'), 'the op worktree');
  const guard = { schema: 'starci/op-guard@1', role: 'critic', terminal: HANDLE, jobId: 'critic-1', workflowId: 'wf-critic', owned: [], reach: { dir, verdictFile: 'verdict.json' } };
  return { base, dir, guard };
};

const shell = (w, command, tool = 'Bash') => hookDecision({ tool_name: tool, tool_input: { command }, cwd: w.dir }, { env: { ORCA_TERMINAL_HANDLE: HANDLE }, bindings: { guard: w.guard, seat: null } });
const tool = (w, name, input) => hookDecision({ tool_name: name, tool_input: input, cwd: w.dir }, { env: { ORCA_TERMINAL_HANDLE: HANDLE }, bindings: { guard: w.guard, seat: null } });
const verdictOf = (w, program, args, cwd = w.dir) => policyVerdict({ role: 'critic', command: { program, args, cwd }, guard: w.guard, handle: HANDLE, policy });

test('the critic role is taken from its bound guard, never claimed, and no starci verb is open to it', () => {
  const guard = { role: 'critic' };
  assert.equal(rightsRoleOf({ guard, seat: null, env: {} }), 'critic');
  assert.equal(rightsRoleOf({ guard: null, seat: null, env: { STARCI_ROLE: 'critic' } }), null, 'STARCI_ROLE cannot claim the critic role');
  assert.deepEqual(policy.roles.bound.includes('critic'), true);
  const saved = process.env.ORCA_TERMINAL_HANDLE;
  assert.notEqual(currentRole({ env: { ORCA_TERMINAL_HANDLE: 'no-such-terminal' } }), 'critic');
  assert.match(requireRole({ role: 'critic', group: 'kernel', verb: 'status', roles: ['worker', 'lead'] }), /role critic may not run this/);
  assert.equal(process.env.ORCA_TERMINAL_HANDLE, saved);
});

test('the shell reads inside the critic directory and nothing outside it', (t) => {
  const w = world(t);
  for (const [program, args] of [['ls', []], ['cat', ['render-1.png']], ['head', ['-c', '16', path.join(w.dir, 'render-1.png')]], ['rg', ['-n', 'title', 'screen.html']],
    ['echo', ['{"checks":[]}']], ['get-content', ['rubric.yaml']], ['sha256sum', ['render-1.png']]]) {
    assert.equal(verdictOf(w, program, args), null, `${program} ${args.join(' ')}`);
  }
  for (const [program, args] of [['cat', [path.join(w.base, 'secret.txt')]], ['cat', ['../secret.txt']], ['ls', ['..']], ['cat', ['$HOME/.ssh/id_rsa']], ['cat', ['~/x']],
    ['rg', ['-f', '../patterns']], ['grep', ['--file=../patterns', 'x']], ['echo', ['$(cat ../secret.txt)']], ['cat', ['render-1.png', '..\\secret.txt']]]) {
    const refused = verdictOf(w, program, args);
    assert.equal(refused?.code, CRITIC_REACH_CODE, `${program} ${args.join(' ')} is refused`);
  }
  assert.equal(verdictOf(w, 'ls', [], w.base)?.code, CRITIC_REACH_CODE, 'a shell standing outside the directory reads nothing');
});

test('the critic runs only read-only programs: no starci verb, git, interpreter, deletion or launch', (t) => {
  const w = world(t);
  for (const [program, args] of [['starci', ['kernel', 'status']], ['git', ['status']], ['node', ['-e', '1']], ['rm', ['render-1.png']], ['cp', ['render-1.png', 'x']],
    ['sed', ['-i', 's/a/b/', 'screen.html']], ['curl', ['http://example.invalid']], ['orca', ['terminal', 'create']], ['python', ['-c', '1']], ['cd', ['..']]]) {
    assert.equal(verdictOf(w, program, args)?.code, CRITIC_REACH_CODE, `${program} is refused`);
  }
});

test('writers reach the verdict file only; the Orca lifecycle verbs for its own terminal stay open', (t) => {
  const w = world(t);
  assert.equal(verdictOf(w, 'set-content', ['verdict.json', '{"a":1}']), null);
  assert.equal(verdictOf(w, 'out-file', ['-FilePath', path.join(w.dir, 'verdict.json')]), null);
  assert.equal(verdictOf(w, 'set-content', ['-Path', 'render-1.png', '-Value', 'verdict.json'])?.code, CRITIC_REACH_CODE, 'the product is no write target');
  assert.equal(verdictOf(w, 'set-content', ['../outside.json', 'x'])?.code, CRITIC_REACH_CODE);
  assert.equal(verdictOf(w, 'add-content', ['screen.html', 'x'])?.code, CRITIC_REACH_CODE);
  const done = ['orchestration', 'send', '--from', HANDLE, '--type', 'worker_done', '--subject', 'done'];
  assert.equal(verdictOf(w, 'orca', done), null, 'worker_done from its own terminal');
  assert.equal(verdictOf(w, 'orca', ['orchestration', 'send', '--from', HANDLE, '--type', 'escalation', '--body', 'cannot judge']), null);
  assert.equal(verdictOf(w, 'orca', ['orchestration', 'send', '--from', 'term_other', '--type', 'worker_done'])?.code, CRITIC_REACH_CODE, 'a message as another terminal');
  assert.equal(verdictOf(w, 'orca', ['orchestration', 'ask', '--from', HANDLE, '--question', 'what is the brand?'])?.code, CRITIC_REACH_CODE, 'the critic asks nobody');
  assert.equal(verdictOf(w, 'orca', ['orchestration', 'send', '--from', HANDLE, '--type', 'heartbeat'])?.code, CRITIC_REACH_CODE, 'heartbeat is not a critic verb');
});

test('through the PreToolUse hook: shell redirections, the file tools and the read tools', async (t) => {
  const w = world(t);
  assert.equal(await shell(w, 'cat render-1.png'), null);
  assert.equal(await shell(w, 'echo "{}" > verdict.json'), null);
  assert.equal((await shell(w, 'echo "{}" > ../x.json'))?.verdict.code, CRITIC_REACH_CODE);
  assert.equal((await shell(w, 'echo "{}" > render-1.png'))?.verdict.code, CRITIC_REACH_CODE, 'the product is not overwritten by a redirect');
  assert.equal((await shell(w, `cat ${path.join(w.base, 'secret.txt')}`))?.verdict.code, CRITIC_REACH_CODE);
  assert.equal((await shell(w, 'cat render-1.png | tee ../copy'))?.verdict.code, CRITIC_REACH_CODE, 'tee is not a read program');
  assert.equal((await shell(w, 'Get-Content ..\\secret.txt', 'PowerShell'))?.verdict.code, CRITIC_REACH_CODE);

  const verdict = path.join(w.dir, 'verdict.json');
  assert.equal(await tool(w, 'Write', { file_path: verdict, content: '{}' }), null);
  assert.equal(await tool(w, 'Edit', { file_path: verdict, old_string: 'a', new_string: 'b' }), null);
  assert.equal((await tool(w, 'Edit', { file_path: path.join(w.dir, 'screen.html'), old_string: 'a', new_string: 'b' }))?.verdict.code, CRITIC_REACH_CODE, 'the product is never edited');
  assert.equal((await tool(w, 'Write', { file_path: path.join(w.base, 'x.txt'), content: 'x' }))?.verdict.code, CRITIC_REACH_CODE);

  assert.equal(await tool(w, 'Read', { file_path: path.join(w.dir, 'render-1.png') }), null);
  assert.equal(await tool(w, 'Grep', { pattern: 'title' }), null, 'a grep with no path reaches the working directory');
  assert.equal(await tool(w, 'Glob', { pattern: '*.png' }), null);
  assert.equal((await tool(w, 'Read', { file_path: path.join(w.base, 'secret.txt') }))?.verdict.code, CRITIC_REACH_CODE, "the op's files are not readable");
  assert.equal((await tool(w, 'Grep', { pattern: 'x', path: w.base }))?.verdict.code, CRITIC_REACH_CODE);
  assert.equal((await tool(w, 'Glob', { pattern: '../*' }))?.verdict.code, CRITIC_REACH_CODE);
  assert.equal((await tool(w, 'Glob', { pattern: '*', path: path.dirname(w.base) }))?.verdict.code, CRITIC_REACH_CODE);
});

test('a read tool of an op or of an unbound session is not the critic guard\'s business', async (t) => {
  const w = world(t);
  const op = { ...w.guard, role: 'op', reach: undefined, owned: [w.dir] };
  const decision = await hookDecision({ tool_name: 'Read', tool_input: { file_path: path.join(w.base, 'secret.txt') }, cwd: w.dir }, { env: { ORCA_TERMINAL_HANDLE: HANDLE }, bindings: { guard: op, seat: null } });
  assert.equal(decision, null);
  assert.equal(await hookDecision({ tool_name: 'Read', tool_input: { file_path: path.join(w.base, 'secret.txt') }, cwd: w.dir }, { env: {}, bindings: { guard: null, seat: null } }), null);
});

test('a critic guard without a reach refuses everything (nothing is reachable)', (t) => {
  const w = world(t);
  const bare = { ...w.guard, reach: undefined };
  assert.equal(policyVerdict({ role: 'critic', command: { program: 'ls', args: [], cwd: w.dir }, guard: bare, handle: HANDLE, policy })?.code, CRITIC_REACH_CODE);
});

test('the job guard of a critic records the one directory and the one file, and the hook writes the same read tools into the critic worktree only', (t) => {
  const w = world(t);
  const file = writeJobGuard({ jobId: 'critic-spec', workflowId: 'wf', ledgerRepo: null, owned: [], role: 'critic', op: 'critic', reach: { dir: w.dir, verdictFile: 'verdict.json' } });
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual([written.role, written.reach.verdictFile, path.resolve(written.reach.dir)], ['critic', 'verdict.json', path.resolve(w.dir)]);
  fs.rmSync(file, { force: true });
  assert.throws(() => writeJobGuard({ jobId: 'x', workflowId: 'wf', ledgerRepo: null, owned: [], role: 'auditor' }), /unknown guard role/);

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-trust-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-trust-cwd-'));
  t.after(() => { fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(cwd, { recursive: true, force: true }); });
  const env = { NODE_TEST_CONTEXT: 'child-v8', STARCI_AGENT_TRUST_HOME: home };
  const config = { launchTrust: { profile: 'automatic', approvedBy: 'owner', approvalRef: 'critic reach spec', roots: [cwd] } };
  const matcherOf = (role) => {
    ensureLaunchTrust({ agent: 'claude', cwd, env, config, role, guardProbe: () => ({ ok: true }) });
    const groups = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.local.json'), 'utf8')).hooks.PreToolUse;
    return groups.map((group) => group.matcher);
  };
  assert.deepEqual(matcherOf('critic'), [CRITIC_TOOL_GUARD_MATCHER]);
  assert.match(CRITIC_TOOL_GUARD_MATCHER, /Read\|Grep\|Glob$/);
  assert.deepEqual(matcherOf('op'), [TOOL_GUARD_MATCHER], 'an op keeps the unchanged matcher: its Read calls pay no hook');
});
