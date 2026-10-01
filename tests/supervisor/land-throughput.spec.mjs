// Landing throughput (lane land-throughput, 2026-09-28): the append-only registries lanes used to edit at the same
// tail are one file per thing, so parallel lanes stop invalidating each other at the land gate.
//   scripts/kernel/contract-changes-store.mjs - modules/kernel/contract-changes/<id>.yaml, one file per entry
//   scripts/kernel/api-extensions.mjs         - api verbs, status fields and boolean flags as files
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mergeContractChanges, readContractChangesDoc, readContractChangesDocAt } from '../../scripts/kernel/contract-changes-store.mjs';
import { isContractChangesPath, entryFileOf, CONTRACT_CHANGES_DIR } from '../../scripts/lib/contract-changes-path.mjs';
import { loadContractChanges } from '../../scripts/kernel/contract-version.mjs';
import { landCommits, runChecks, governedPaths } from '../../scripts/supervisor/land.mjs';
import { loadApiExtensions, statusExtras, readFlagsFile, extensionVerbNames } from '../../scripts/kernel/api-extensions.mjs';
import { checkApiSurface } from '../../scripts/checks/check-api-surface.mjs';

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
const OLD_ENTRY = "id: old\neffectiveAt: '2026-01-01T00:00:00Z'\nsummary: x\n";
const CHANGELOG = '# Changelog\n\n';
const APPEND_ONLY = 'packages/grammar/CHANGELOG.md';

function repoFixture(t) {
  const root = tmp(t, 'sup-k-lt-repo-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  write(root, { 'scripts/a.mjs': 'export const a = 1;\n', [entryFileOf('old')]: OLD_ENTRY, [APPEND_ONLY]: CHANGELOG, 'modules/kernel/rules.yaml': 'rule: one\n', '.gitattributes': `${APPEND_ONLY} merge=union\n` });
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

/* ------------------------------------------------------------ contract-changes: one file per entry */

test('the registry merges entry files; an entry whose id is not its file name is a problem; nothing reads a single-file list', (t) => {
  const entries = [
    { rel: 'modules/kernel/contract-changes/b-new.yaml', text: "id: b-new\neffectiveAt: '2026-09-28T00:00:00Z'\nsummary: from a file\n" },
    { rel: 'modules/kernel/contract-changes/old.yaml', text: OLD_ENTRY },
    { rel: 'modules/kernel/contract-changes/wrong-name.yaml', text: 'id: other\n' },
  ];
  const { doc, problems } = mergeContractChanges({ entries });
  assert.deepEqual(doc.changes.map((c) => [c.id, c.summary]), [['b-new', 'from a file'], ['old', 'x']]);
  assert.deepEqual(problems, ['modules/kernel/contract-changes/wrong-name.yaml: id must be its file name (wrong-name)']);
  assert.equal(mergeContractChanges({ entries: [] }).doc.changes.length, 0, 'no registry registers nothing');
  assert.ok(isContractChangesPath('modules/kernel/contract-changes/x.yaml') && !isContractChangesPath('modules/kernel/contract-changes.yaml') && !isContractChangesPath('modules/kernel/rules.yaml'));
  assert.equal(entryFileOf('x'), 'modules/kernel/contract-changes/x.yaml');
  // A single-file list at the old path is not a registry: it registers nothing and is no problem.
  const dir = tmp(t, 'sup-k-lt-nolist-');
  write(dir, { 'modules/kernel/contract-changes.yaml': 'schema: starci/contract-changes@1\nchanges:\n  - id: listed\n    summary: ignored\n', [entryFileOf('filed')]: 'id: filed\nsummary: y\n' });
  const read = readContractChangesDoc(dir);
  assert.deepEqual(read.doc.changes.map((c) => c.id), ['filed']);
  assert.deepEqual(read.problems, []);
  assert.equal(`${CONTRACT_CHANGES_DIR}/`, 'modules/kernel/contract-changes/');
});

test('loadContractChanges reads the entry files: the live registry is well-formed and the old list file is gone', () => {
  const live = loadContractChanges(ROOT);
  assert.deepEqual(live.problems, []);
  const ids = new Set(live.changes.map((c) => c.id));
  assert.ok(ids.has('land-gate-specs-harness-switch') && ids.has('land-conflict-free-registries'), 'entry files');
  assert.equal(fs.existsSync(path.join(ROOT, 'modules/kernel/contract-changes.yaml')), false, 'no single-file list');
  assert.ok(governedPaths(['modules/kernel/contract-changes/x.yaml', 'modules/kernel/api.yaml']).length === 1, 'registry files need no entry of their own');
});

test('the land gate: an entry file covers governed paths; the registry at a revision reads entry files', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const bare = sideCommit(root, 'bare', { 'modules/kernel/rules.yaml': 'rule: two\n' });
  const red = landCommits({ commits: [bare], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(red.reason, 'checks-red');
  assert.match(red.checks.find((c) => c.name === 'contract-changes paths').output, /modules\/kernel\/contract-changes\/<id>\.yaml/);
  const filed = sideCommit(root, 'filed', { 'modules/kernel/rules.yaml': 'rule: two\n',
    'modules/kernel/contract-changes/rules-two.yaml': "id: rules-two\neffectiveAt: '2026-09-28T00:00:00Z'\nsummary: y\nreach: new-legs\npaths: [modules/kernel/rules.yaml]\n" });
  const one = landCommits({ commits: [filed], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(one.ok, JSON.stringify(one.checks));
  assert.deepEqual(one.checks.find((c) => c.name === 'contract-changes paths').entries, ['rules-two']);
  const at = readContractChangesDocAt(root, 'main');
  assert.deepEqual(at.doc.changes.map((c) => c.id).sort(), ['old', 'rules-two']);
  assert.equal(readContractChangesDocAt(root, 'no-such-rev'), null);
});

test('two lanes each adding an entry file never conflict at the gate', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const entry = (id) => ({ [`modules/kernel/contract-changes/${id}.yaml`]: `id: ${id}\neffectiveAt: '2026-09-28T00:00:00Z'\nsummary: s\npaths: [modules/kernel/${id}.yaml]\n`, [`modules/kernel/${id}.yaml`]: 'k: 1\n' });
  const a = sideCommit(root, 'lane-a', entry('lane-a'));
  const b = sideCommit(root, 'lane-b', entry('lane-b'));
  for (const sha of [a, b]) { const r = landCommits({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks } }); assert.ok(r.ok, JSON.stringify(r)); }
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

/* ------------------------------------------------------------ api extensions */

test('api extensions load from files: verbs, flags, status fields; a bad module is a problem, not a crash', async (t) => {
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

test('cli.mjs dispatches an extension verb and check-api-surface counts it', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/kernel/cli.mjs'), 'extensions', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.verbs.includes('extensions'));
  assert.deepEqual(out.problems, []);
  const surface = checkApiSurface(ROOT);
  assert.equal(surface.ok, true, JSON.stringify(surface.drift));
  assert.ok(surface.implemented.includes('extensions'));
  const help = spawnSync(process.execPath, [path.join(ROOT, 'scripts/kernel/cli.mjs'), '--help'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.match(help.stdout + help.stderr, /extension verbs[\s\S]*extensions \[--json\]/);
});

test('the append-only files merge union (contract-change entries are files, not an append-only list); ui/CONTRACT.md does not (lanes edit it in place)', () => {
  const attrs = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
  for (const f of ['packages/grammar/CHANGELOG.md', 'scripts/kernel/api-boolean-flags.txt']) assert.match(attrs, new RegExp(`^${f.replaceAll('.', '\\.')} merge=union$`, 'm'), f);
  assert.doesNotMatch(attrs, /contract-changes\.yaml/);
  assert.doesNotMatch(attrs, /^ui\/CONTRACT\.md merge=union/m);
});
