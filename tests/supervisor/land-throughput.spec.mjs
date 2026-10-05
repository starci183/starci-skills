// Landing current module edits, conflict preflight and the existing API extension owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { landCommits, runChecks } from '../../scripts/supervisor/land.mjs';
import { loadApiExtensions, statusExtras, readFlagsFile, extensionVerbNames } from '../../scripts/kernel/api-extensions.mjs';
import { checkCliParity } from '../../scripts/checks/check-cli-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => { try { spawnSync('git', ['-C', dir, 'worktree', 'prune'], { windowsHide: true }); } catch { /* none */ } try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* best effort */ } });
  return dir;
};
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, files) => { for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), c); } };
const CHANGELOG = '# Changelog\n\n';
const APPEND_ONLY = 'packages/grammar/CHANGELOG.md';

function repoFixture(t) {
  const root = tmp(t, 'sup-k-lt-repo-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  write(root, { 'scripts/a.mjs': 'export const a = 1;\n', [APPEND_ONLY]: CHANGELOG, 'modules/kernel/rules.yaml': 'rule: one\n', '.gitattributes': `${APPEND_ONLY} merge=union\n` });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}
function sideCommit(root, name, files) {
  const wt = path.join(root, '..', `${path.basename(root)}-${name}`);
  git(root, 'worktree', 'add', '-q', '-b', name, wt, 'main');
  write(wt, files);
  git(wt, 'add', '-A');
  git(wt, 'commit', '-q', '-m', name);
  const sha = git(wt, 'rev-parse', 'HEAD');
  git(root, 'worktree', 'remove', '--force', wt);
  return sha;
}
const envOf = (t) => { const r = tmp(t, 'sup-k-lt-env-'); return { LOCALAPPDATA: path.join(r, 'la'), STARCI_LANES_ROOT: path.join(r, 'lanes') }; };
const lightChecks = (opts) => runChecks({ ...opts, runSpecs: false });

test('current module edits land through actual checks; unparseable edits refuse without moving main', (t) => {
  const root = repoFixture(t), env = envOf(t);
  const accepted = sideCommit(root, 'current-module', { 'modules/kernel/rules.yaml': 'rule: two\n' });
  const green = landCommits({ commits: [accepted], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(green.ok, JSON.stringify(green));
  assert.equal(fs.readFileSync(path.join(root, 'modules/kernel/rules.yaml'), 'utf8'), 'rule: two\n');
  const main = git(root, 'rev-parse', 'main');
  const broken = sideCommit(root, 'broken-module', { 'modules/kernel/broken.yaml': 'value: [unclosed\n' });
  const red = landCommits({ commits: [broken], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(red.ok, false);
  assert.ok(red.checks.some((c) => c.name === 'parse modules/kernel/broken.yaml' && !c.ok), JSON.stringify(red));
  assert.equal(git(root, 'rev-parse', 'main'), main);
});

test('disjoint current module edits from two lanes both land through their actual checks', (t) => {
  const root = repoFixture(t), env = envOf(t);
  const a = sideCommit(root, 'lane-a', { 'modules/kernel/lane-a.yaml': 'value: one\n' });
  const b = sideCommit(root, 'lane-b', { 'modules/kernel/lane-b.yaml': 'value: two\n' });
  for (const sha of [a, b]) {
    const result = landCommits({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks } });
    assert.ok(result.ok, JSON.stringify(result));
  }
  assert.equal(fs.readFileSync(path.join(root, 'modules/kernel/lane-a.yaml'), 'utf8'), 'value: one\n');
  assert.equal(fs.readFileSync(path.join(root, 'modules/kernel/lane-b.yaml'), 'utf8'), 'value: two\n');
});

/* ------------------------------------------------------------ conflicts: exact hunks, before the queue */

test('a pick that cannot apply is refused before the queue with every file and hunk; a union append passes the preflight', async (t) => {
  const { land, conflictPreflight, conflictHunks, describe } = await import('../../scripts/supervisor/land.mjs');
  const env = envOf(t);
  const root = repoFixture(t);
  const theirs = sideCommit(root, 'theirs', { 'scripts/a.mjs': 'export const a = 2;\n' });
  const mine = sideCommit(root, 'mine', { 'scripts/a.mjs': 'export const a = 3;\n' });
  const append = sideCommit(root, 'append', { [APPEND_ONLY]: `${CHANGELOG}## appended
` });
  const first = await land({ commits: [theirs], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(first.ok, JSON.stringify(first));
  let locked = false;
  const refused = await land({ commits: [mine], root, env, push: false, deps: { runChecks: (o) => { locked = true; return lightChecks(o); } } });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'conflict');
  assert.equal(refused.preflight, true, 'refused before it took the lock');
  assert.equal(locked, false, 'no check ran');
  assert.deepEqual(refused.conflicts.map((c) => c.file), ['scripts/a.mjs']);
  assert.match(refused.conflicts[0].hunks[0].text, /<<<<<<<[\s\S]*a = 2[\s\S]*=======[\s\S]*a = 3[\s\S]*>>>>>>>/);
  assert.match(refused.hint, /rebase the lane onto current main.*scripts\/a\.mjs/);
  assert.match(describe(refused), /CONFLICT scripts\/a\.mjs[\s\S]*next: rebase/);
  // The gate's own cherry-pick reports the same shape when main moved after the preflight.
  const inGate = landCommits({ commits: [mine], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(inGate.reason, 'conflict');
  assert.deepEqual(inGate.conflicts.map((c) => c.file), ['scripts/a.mjs']);
  assert.ok(inGate.conflicts[0].hunks.length === 1);
  const appended = sideCommit(root, 'append-2', { [APPEND_ONLY]: `${CHANGELOG}## appended-2
` });
  assert.ok((await land({ commits: [append], root, env, push: false, deps: { runChecks: lightChecks } })).ok);
  assert.equal(conflictPreflight({ root, commits: [appended] }).ok, true, 'merge=union: two appends never conflict');
  assert.deepEqual(conflictHunks('a\n<<<<<<< x\nb\n=======\nc\n>>>>>>> y\nd\n').map((h) => h.line), [2]);
});

/* ------------------------------------------------------------ starci kernel extensions */

test('starci kernel extensions load from files: verbs, flags, status fields; a bad module is a problem, not a crash', async (t) => {
  const root = tmp(t, 'sup-k-lt-ext-');
  write(root, {
    'scripts/kernel/verbs/hello.mjs': "export default { verb: 'hello', required: ['workflow'], kernelOnly: true, flags: ['loud'], usage: '  hello --workflow <id>', run() {} };\n",
    'scripts/kernel/verbs/broken.mjs': "export default { verb: 'not-broken', run() {} };\n",
    'scripts/kernel/status/answer.mjs': "export default { key: 'answer', compute: ({ workflowId }) => `${workflowId}:42`, lines: (v) => [`answer: ${v}`] };\n",
    'scripts/kernel/status/quiet.mjs': "export default { key: 'quiet', compute: () => null };\n",
    'scripts/kernel/status/boom.mjs': "export default { key: 'boom', compute: () => { throw Error('nope'); } };\n",
    'scripts/kernel/api-boolean-flags.txt': '# comment\n--dry-plan\nshout\n\nbad flag\n',
  });
  const ext = await loadApiExtensions({ root });
  assert.deepEqual([...ext.verbs.keys()], ['hello']);
  assert.deepEqual([...ext.flags].sort(), ['dry-plan', 'loud', 'shout']);
  assert.deepEqual([...ext.kernelOnly], ['hello']);
  assert.equal(ext.problems.length, 1);
  assert.match(ext.problems[0], /broken\.mjs/);
  assert.deepEqual(extensionVerbNames(root).sort(), ['broken', 'hello']);
  const { fields, lines } = statusExtras(ext.status, { workflowId: 'wf-1' }, { frontier: 'x' });
  assert.deepEqual(fields, { answer: 'wf-1:42', boomError: 'nope' });
  assert.deepEqual(lines, ['answer: wf-1:42']);
  assert.deepEqual(statusExtras(ext.status, { workflowId: 'wf-1' }, { answer: 'core' }).fields.answer, undefined, 'a core field is never overwritten');
  assert.deepEqual(readFlagsFile(path.join(root, 'absent.txt')), []);
});

test('cli.mjs dispatches an extension verb and check-cli-parity counts it', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/kernel/cli.mjs'), 'extensions', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.verbs.includes('extensions'));
  assert.deepEqual(out.problems, []);
  const parity = checkCliParity(ROOT);
  assert.equal(parity.ok, true, JSON.stringify(parity.findings));
  assert.ok(parity.verbs.includes('kernel extensions'));
  const help = spawnSync(process.execPath, [path.join(ROOT, 'scripts/kernel/cli.mjs'), '--help'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.match(help.stdout + help.stderr, /extension verbs[\s\S]*extensions \[--json\]/);
});

test('the existing append-only files merge union; ui/CONTRACT.md remains an in-place contract', () => {
  const attrs = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
  for (const f of ['packages/grammar/CHANGELOG.md', 'scripts/kernel/api-boolean-flags.txt']) assert.match(attrs, new RegExp(`^${f.replaceAll('.', '\\.')} merge=union$`, 'm'), f);
  assert.doesNotMatch(attrs, /^ui\/CONTRACT\.md merge=union/m);
});
