// modules/kernel/revision-scope.yaml: one spec per row of the table - what a change of the runtime tree asks of each role.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { revisionRepo } from '../helpers/revision-repo.mjs';
import { changeScope, structureOf, wordingOnly } from '../../scripts/machine/revision-change.mjs';
import { actionsFor, loadScope } from '../../scripts/machine/revision-scope.mjs';
import { engineLoadedPredicate } from '../../scripts/supervisor/engine-loaded.mjs';
import { checkRevisionScope } from '../../scripts/checks/check-revision-scope.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const actionsOf = (scope) => Object.fromEntries(Object.entries(scope.roles).map(([role, r]) => [role, r.action]));
const ALL = ['kernel', 'supervisor', 'op', 'critic', 'engine'];
const NONE = { kernel: 'none', supervisor: 'none', op: 'none', critic: 'none', engine: 'none' };
const scopeOf = (repo, changes, message = 'change') => {
  const from = repo.git('rev-parse', 'HEAD');
  const to = repo.commit(message, changes);
  return changeScope(repo.root, from, to, { roles: ALL, engineLoaded: engineLoadedPredicate(repo.root, loadScope(repo.root)) });
};
const textOf = (repo, file) => fs.readFileSync(path.join(repo.root, file), 'utf8');

test('docs, tests, changelog and tooling concern no role and cost no seat anything', (t) => {
  const repo = revisionRepo(t);
  const scope = scopeOf(repo, { 'docs/guide.md': '# a\n', 'CHANGELOG.md': 'x\n', 'tests/a.spec.mjs': 'x\n', 'ui/src/a.ts': 'x\n', 'packages/x/readme.txt': 'x\n', 'examples/e/a.txt': 'x\n' });
  assert.deepEqual(actionsOf(scope), NONE);
  assert.equal(scope.fileCount, 6);
});

test('CLI verb code no long-lived process imports needs nothing from anyone: each command is a new process that reads the tree', (t) => {
  const repo = revisionRepo(t);
  const scope = scopeOf(repo, { 'scripts/kernel/verbs/new-verb.mjs': 'export default {};\n', 'scripts/supervisor/tool.mjs': 'export default {};\n', 'modules/cli/commands/kernel-extra.yaml': 'verb: x\n' });
  assert.deepEqual(actionsOf(scope), NONE);
});

test('guards bite on the next command and ask nothing to be read or restarted', (t) => {
  const repo = revisionRepo(t);
  const scope = scopeOf(repo, { 'scripts/guards/seat-tools.mjs': 'export const x = 1;\n' });
  assert.deepEqual(actionsOf(scope), { kernel: 'immediate', supervisor: 'immediate', op: 'immediate', critic: 'immediate', engine: 'none' });
  assert.deepEqual(scope.roles.kernel.files, []);
});

test('code the engine process imports restarts the engine, and only that code: the set is derived from the import graph', (t) => {
  const repo = revisionRepo(t);
  const loaded = scopeOf(repo, { 'scripts/lib/loaded.mjs': 'export const loaded = 2;\n' });
  assert.deepEqual(actionsOf(loaded), { ...NONE, engine: 'restart' });
  assert.deepEqual(loaded.roles.engine.files, ['scripts/lib/loaded.mjs']);
  const apart = scopeOf(repo, { 'scripts/lib/apart.mjs': 'export const apart = 1;\n' });
  assert.deepEqual(actionsOf(apart), NONE, 'a script nothing the engine imports is a new process on every use');
});

test('the engine tables restart the engine and nothing else', (t) => {
  const repo = revisionRepo(t);
  const scope = scopeOf(repo, { 'modules/reconciler/job.yaml': 'a: 1\n', 'modules/kernel/failure-codes.yaml': 'A: 1\n' });
  assert.deepEqual(actionsOf(scope), { ...NONE, engine: 'restart' });
});

test('a rule only added to a Kernel contract file updates the live Kernel in place and concerns the Supervisor nothing', (t) => {
  const repo = revisionRepo(t, { files: { 'modules/kernel/driver-loop.yaml': 'steps:\n  - a\n  - b\n' } });
  const scope = scopeOf(repo, { 'modules/kernel/driver-loop.yaml': 'steps:\n  - a\n  - b\n  - c\n' });
  assert.deepEqual(actionsOf(scope), { ...NONE, kernel: 'reread' });
  assert.deepEqual(scope.roles.kernel.files, ['modules/kernel/driver-loop.yaml']);
});

test('a rule removed or reversed in a Kernel contract file replaces the Kernel; a modified line counts as a removal', (t) => {
  const repo = revisionRepo(t, { files: { 'modules/kernel/driver-loop.yaml': 'steps:\n  - a\n  - b\nnever: x\n' } });
  const removed = scopeOf(repo, { 'modules/kernel/driver-loop.yaml': 'steps:\n  - a\nnever: x\n' });
  assert.equal(removed.roles.kernel.action, 'replace');
  assert.deepEqual(removed.roles.kernel.replaceFiles, ['modules/kernel/driver-loop.yaml']);
  const reversed = scopeOf(repo, { 'modules/kernel/driver-loop.yaml': 'steps:\n  - a\nnever: y\n' });
  assert.equal(reversed.roles.kernel.action, 'replace');
  assert.equal(reversed.roles.supervisor.action, 'none');
});

test('a diff git cannot measure is unknown, and the notice treats an unknown diff as a replacement', (t) => {
  const repo = revisionRepo(t);
  const unknown = changeScope(repo.root, '0'.repeat(40), repo.base);
  assert.equal(unknown.known, false);
});

test('a commit may declare an edit wording-only: it downgrades the replacement only while the file keeps its structure', (t) => {
  const base = 'steps:\n  - first step\n  - second step\nchoices:\n  keep: say it\n  drop: say that\n';
  const repo = revisionRepo(t, { files: { 'modules/kernel/driver-loop.yaml': base } });
  const reworded = scopeOf(repo, { 'modules/kernel/driver-loop.yaml': base.replace('say it', 'say it better') }, 'reword\n\nRevision-Wording: modules/kernel/driver-loop.yaml');
  assert.equal(reworded.roles.kernel.action, 'reread');
  assert.deepEqual(reworded.wording.accepted, ['modules/kernel/driver-loop.yaml']);
  const undeclared = scopeOf(repo, { 'modules/kernel/driver-loop.yaml': textOf(repo, 'modules/kernel/driver-loop.yaml').replace('say it better', 'say it best') });
  assert.equal(undeclared.roles.kernel.action, 'replace', 'a modification nobody declared stays a replacement');
  const dropped = scopeOf(repo, { 'modules/kernel/driver-loop.yaml': textOf(repo, 'modules/kernel/driver-loop.yaml').replace('  drop: say that\n', '') }, 'drop a choice\n\nRevision-Wording: modules/kernel/driver-loop.yaml');
  assert.equal(dropped.roles.kernel.action, 'replace', 'a declaration cannot cover a deleted choice');
  assert.equal(dropped.wording.refused.length, 1);
  assert.match(dropped.wording.refused[0].reason, /structure/);
});

test('the wording comparison refuses a deleted list entry, a deleted choice and a deleted bullet, and accepts reworded text', () => {
  assert.equal(wordingOnly('a.yaml', 'x:\n  - 1\n  - 2\n', 'x:\n  - 1\n').ok, false);
  assert.equal(wordingOnly('a.yaml', 'c:\n  p: 1\n  q: 2\n', 'c:\n  p: 1\n').ok, false);
  assert.equal(wordingOnly('a.md', '# T\n\n- a\n- b\n', '# T\n\n- a\n').ok, false);
  assert.equal(wordingOnly('a.yaml', 'c:\n  p: one\n', 'c:\n  p: uno\n').ok, true);
  assert.equal(wordingOnly('a.yaml', 'c: [', 'c: 1\n').ok, false, 'a text that does not parse is not wording only');
  assert.equal(structureOf('a.txt', 'same'), 'same');
});

test('the file a seat boots from replaces it on ANY change, even an addition: the launch prompt is loaded once at birth', (t) => {
  const repo = revisionRepo(t);
  const kernel = scopeOf(repo, { 'modules/kernel/kernel-prompt.md': `${textOf(repo, 'modules/kernel/kernel-prompt.md')}\nOne more line.\n` });
  assert.deepEqual(actionsOf(kernel), { ...NONE, kernel: 'replace' });
  const supervisor = scopeOf(repo, { 'modules/supervisor/supervise.yaml': `${textOf(repo, 'modules/supervisor/supervise.yaml')}\n# note\n` });
  assert.deepEqual(actionsOf(supervisor), { ...NONE, supervisor: 'replace' });
});

test('a Supervisor contract change concerns the Supervisor and not the Kernel; an addition updates in place', (t) => {
  const repo = revisionRepo(t, { files: { 'modules/supervisor/supervisor-menu.yaml': 'items:\n  - a\n' } });
  const scope = scopeOf(repo, { 'modules/supervisor/supervisor-menu.yaml': 'items:\n  - a\n  - b\n' });
  assert.deepEqual(actionsOf(scope), { ...NONE, supervisor: 'reread' });
});

test('the Kernel menu and policy are the Kernel contract; the Supervisor, who rules on the gates they raise, re-reads them', (t) => {
  const repo = revisionRepo(t, { files: { 'modules/kernel/op-incident-policy.yaml': 'rows:\n  - a\n' } });
  const scope = scopeOf(repo, { 'modules/kernel/op-incident-policy.yaml': 'rows:\n  - a\n  - b\n' });
  assert.deepEqual(actionsOf(scope), { ...NONE, kernel: 'reread', supervisor: 'reread', engine: 'restart' });
});

test('an op brief: the attempt in flight keeps its admission, the next try is admitted under the new rules, the Kernel re-reads before it enqueues', (t) => {
  const repo = revisionRepo(t);
  const scope = scopeOf(repo, { 'modules/ops/ops/interface.draw.yaml': 'a: 1\n', 'modules/ops/ops/code.refactor.yaml': 'a: 1\n' });
  assert.deepEqual(actionsOf(scope), { ...NONE, op: 'admission', kernel: 'reread' });
  assert.deepEqual(scope.roles.op.kinds, ['code.refactor', 'interface.draw']);
  const shared = scopeOf(repo, { 'modules/ops/_common.yaml': 'a: 1\n' });
  assert.deepEqual(shared.roles.op.kinds, ['*'], 'a shared op document concerns every op kind');
});

test('the rubric of the Critic is read by the next Critic run, never mid-run', (t) => {
  const repo = revisionRepo(t);
  const scope = scopeOf(repo, { 'modules/kernel/critic-rubrics.yaml': 'a: 1\n' });
  assert.equal(scope.roles.critic.action, 'admission');
  assert.equal(scope.roles.supervisor.action, 'none');
});

test('an ambiguous path takes the heaviest action of its rows and a path no row names takes the default', () => {
  const doc = loadScope(skillRoot);
  assert.equal(actionsFor(doc, 'modules/kernel/kernel-prompt.md').actions.kernel, 'boot', 'a prompt is Markdown (docs row) and the Kernel boot file: boot wins');
  assert.equal(actionsFor(doc, 'brand/new/thing.bin').actions.kernel, 'contract', 'an unmatched path is read by every seat');
  assert.equal(actionsFor(doc, 'brand/new/thing.bin').rows.length, 0);
});

test('RT_REVISION_SCOPE passes on the shipped table: it covers every tracked path, derives the engine set and names the boot files of both seats', () => {
  assert.deepEqual(checkRevisionScope(skillRoot).map((f) => f.message), []);
});

test('RT_REVISION_SCOPE is red for a tracked path in no row, a hand-listed engine restart and a boot file the generator does not read', (t) => {
  const repo = revisionRepo(t);
  repo.commit('add', { 'strange/unmatched.zzz': 'x\n' });
  assert.match(checkRevisionScope(repo.root).map((f) => f.message).join('\n'), /covers no row for the tracked path strange\/unmatched\.zzz/);
  const table = textOf(repo, 'modules/kernel/revision-scope.yaml');
  repo.commit('hand list', { 'modules/kernel/revision-scope.yaml': table.replace('paths: ["engine/**/*.sql"', 'paths: ["scripts/lib/**", "engine/**/*.sql"'), 'strange/unmatched.zzz': null });
  assert.match(checkRevisionScope(repo.root).map((f) => f.message).join('\n'), /hand-lists an engine restart for the script scripts\/lib\/loaded\.mjs/);
  repo.commit('boot', { 'modules/kernel/revision-scope.yaml': table.replace('files: [modules/kernel/kernel-prompt.md]', 'files: [modules/kernel/kernel-prompt.md, modules/kernel/driver-loop.yaml]') });
  assert.match(checkRevisionScope(repo.root).map((f) => f.message).join('\n'), /seatBoot\.kernel lists modules\/kernel\/driver-loop\.yaml, which scripts\/kernel\/start-workflow\.mjs does not read/);
});
