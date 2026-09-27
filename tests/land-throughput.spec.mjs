// Landing throughput (lane land-throughput, 2026-09-28): the append-only registries lanes used to edit at the same
// tail are one file per thing, so parallel lanes stop invalidating each other at the land gate.
//   scripts/kernel/contract-changes-store.mjs - modules/kernel/contract-changes/<id>.yaml + the old list
//   scripts/kernel/api-extensions.mjs         - api verbs, status fields and boolean flags as files
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../engine/yaml.mjs';
import { mergeContractChanges, readContractChangesDoc, readContractChangesDocAt, migrateLegacy, splitLegacy, isContractChangesPath, entryFileOf, CONTRACT_CHANGES_FILE } from '../scripts/kernel/contract-changes-store.mjs';
import { loadContractChanges } from '../scripts/kernel/contract-version.mjs';
import { landCommits, runChecks, governedPaths } from '../scripts/supervisor/land.mjs';
import { loadApiExtensions, statusExtras, readFlagsFile, extensionVerbNames } from '../scripts/kernel/api-extensions.mjs';
import { checkApiSurface } from '../scripts/checks/check-api-surface.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const LEGACY = 'schema: starci/contract-changes@1\nchanges:\n  - id: old\n    effectiveAt: \'2026-01-01T00:00:00Z\'\n    summary: x\n';

function repoFixture(t) {
  const root = tmp(t, 'lt-repo-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  write(root, { 'scripts/a.mjs': 'export const a = 1;\n', [CONTRACT_CHANGES_FILE]: LEGACY, 'modules/kernel/rules.yaml': 'rule: one\n', '.gitattributes': `${CONTRACT_CHANGES_FILE} merge=union\n` });
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
const envOf = (t) => { const r = tmp(t, 'lt-env-'); return { LOCALAPPDATA: path.join(r, 'la'), STARCI_SUPERVISOR_HOME: path.join(r, 'home'), STARCI_LANES_ROOT: path.join(r, 'lanes') }; };
const lightChecks = (opts) => runChecks({ ...opts, runSpecs: false });

/* ------------------------------------------------------------ contract-changes: one file per entry */

test('the registry merges entry files and the old list; an old-list item wins over a file of the same id', () => {
  const entries = [
    { rel: 'modules/kernel/contract-changes/b-new.yaml', text: "id: b-new\neffectiveAt: '2026-09-28T00:00:00Z'\nsummary: from a file\n" },
    { rel: 'modules/kernel/contract-changes/old.yaml', text: "id: old\neffectiveAt: '2026-01-01T00:00:00Z'\nsummary: stale copy\n" },
    { rel: 'modules/kernel/contract-changes/wrong-name.yaml', text: 'id: other\n' },
  ];
  const { doc, problems } = mergeContractChanges({ legacy: LEGACY, entries });
  assert.deepEqual(doc.changes.map((c) => [c.id, c.summary]), [['b-new', 'from a file'], ['old', 'x']]);
  assert.deepEqual(problems, ['modules/kernel/contract-changes/wrong-name.yaml: id must be its file name (wrong-name)']);
  assert.equal(mergeContractChanges({ legacy: null, entries: [] }).doc.changes.length, 0, 'no registry registers nothing');
  assert.ok(isContractChangesPath('modules/kernel/contract-changes/x.yaml') && isContractChangesPath(CONTRACT_CHANGES_FILE) && !isContractChangesPath('modules/kernel/rules.yaml'));
  assert.equal(entryFileOf('x'), 'modules/kernel/contract-changes/x.yaml');
});

test('loadContractChanges reads the entry files: the live registry is well-formed and carries both forms', () => {
  const live = loadContractChanges(ROOT);
  assert.deepEqual(live.problems, []);
  const ids = new Set(live.changes.map((c) => c.id));
  assert.ok(ids.has('land-gate-specs-harness-switch'), 'an old-list item');
  assert.ok(ids.has('land-conflict-free-registries'), 'an entry file');
  assert.ok(governedPaths(['modules/kernel/contract-changes/x.yaml', CONTRACT_CHANGES_FILE, 'modules/kernel/api.yaml']).length === 1, 'registry files need no entry of their own');
});

test('the old list migrates losslessly: every item round-trips as its own file', (t) => {
  const text = fs.readFileSync(path.join(ROOT, CONTRACT_CHANGES_FILE), 'utf8');
  const listed = parseYaml(text).changes ?? [];
  const { blocks } = splitLegacy(text);
  assert.equal(blocks.length, listed.length);
  blocks.forEach((b, i) => assert.deepEqual(parseYaml(b.text), listed[i], b.id));
  const dir = tmp(t, 'lt-migrate-');
  write(dir, { [CONTRACT_CHANGES_FILE]: text });
  const before = readContractChangesDoc(dir).doc.changes;
  const r = migrateLegacy(dir);
  assert.equal(r.moved.length, listed.length);
  assert.equal(parseYaml(fs.readFileSync(path.join(dir, CONTRACT_CHANGES_FILE), 'utf8')).changes ?? null, null, 'the old list is left empty');
  const after = readContractChangesDoc(dir);
  assert.deepEqual(after.problems, []);
  const byId = (list) => Object.fromEntries(list.map((c) => [c.id, c]));
  assert.deepEqual(byId(after.doc.changes), byId(before), 'same entries, now one file each');
});

test('the land gate: an entry file covers governed paths; the registry at a revision reads both forms', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const bare = sideCommit(root, 'bare', { 'modules/kernel/rules.yaml': 'rule: two\n' });
  const red = landCommits({ commits: [bare], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(red.reason, 'checks-red');
  assert.match(red.checks.find((c) => c.name === 'contract-changes paths').output, /modules\/kernel\/contract-changes\/<id>\.yaml/);
  const filed = sideCommit(root, 'filed', { 'modules/kernel/rules.yaml': 'rule: two\n',
    'modules/kernel/contract-changes/rules-two.yaml': "id: rules-two\neffectiveAt: '2026-09-28T00:00:00Z'\nsummary: y\nreach: new-legs\npaths: [modules/kernel/rules.yaml]\n" });
  // A lane branched before the split still appends to the old list: it lands too, the union keeps both.
  const appended = sideCommit(root, 'appended', { 'modules/kernel/rules.yaml': 'rule: two\n', 'scripts/b.mjs': 'export const b = 1;\n',
    [CONTRACT_CHANGES_FILE]: `${LEGACY}  - id: rules-legacy\n    effectiveAt: '2026-09-28T00:00:00Z'\n    summary: z\n    paths: [modules/kernel/rules.yaml]\n` });
  const one = landCommits({ commits: [filed], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(one.ok, JSON.stringify(one.checks));
  assert.deepEqual(one.checks.find((c) => c.name === 'contract-changes paths').entries, ['rules-two']);
  const two = landCommits({ commits: [appended], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(two.ok, JSON.stringify(two));
  const at = readContractChangesDocAt(root, 'main');
  assert.deepEqual(at.doc.changes.map((c) => c.id).sort(), ['old', 'rules-legacy', 'rules-two']);
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

/* ------------------------------------------------------------ api extensions */

test('api extensions load from files: verbs, flags, status fields; a bad module is a problem, not a crash', async (t) => {
  const root = tmp(t, 'lt-ext-');
  write(root, {
    'scripts/kernel/api-verbs/hello.mjs': "export default { verb: 'hello', required: ['workflow'], kernelOnly: true, flags: ['loud'], usage: '  hello --workflow <id>', run() {} };\n",
    'scripts/kernel/api-verbs/broken.mjs': "export default { verb: 'not-broken', run() {} };\n",
    'scripts/kernel/api-status/answer.mjs': "export default { key: 'answer', compute: ({ workflowId }) => `${workflowId}:42`, lines: (v) => [`answer: ${v}`] };\n",
    'scripts/kernel/api-status/quiet.mjs': "export default { key: 'quiet', compute: () => null };\n",
    'scripts/kernel/api-status/boom.mjs': "export default { key: 'boom', compute: () => { throw Error('nope'); } };\n",
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

test('api.mjs dispatches an extension verb and check-api-surface counts it', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/kernel/api.mjs'), 'extensions', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.verbs.includes('extensions'));
  assert.deepEqual(out.problems, []);
  const surface = checkApiSurface(ROOT);
  assert.equal(surface.ok, true, JSON.stringify(surface.drift));
  assert.ok(surface.implemented.includes('extensions'));
  const help = spawnSync(process.execPath, [path.join(ROOT, 'scripts/kernel/api.mjs'), '--help'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.match(help.stdout + help.stderr, /extension verbs[\s\S]*extensions \[--json\]/);
});

test('the append-only files merge union; ui/CONTRACT.md does not (lanes edit it in place)', () => {
  const attrs = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
  for (const f of [CONTRACT_CHANGES_FILE, 'packages/grammar/CHANGELOG.md', 'scripts/kernel/api-boolean-flags.txt']) assert.match(attrs, new RegExp(`^${f.replaceAll('.', '\\.')} merge=union$`, 'm'), f);
  assert.doesNotMatch(attrs, /^ui\/CONTRACT\.md merge=union/m);
});
