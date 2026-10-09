// The per-role payload a deploy event carries and the digest line made from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { revisionRepo } from '../helpers/revision-repo.mjs';
import { deployLine, deployRoles } from '../../scripts/reconciler/revision-deploy.mjs';
import { revisionScope } from '../../scripts/reconciler/revision-scope-cli.mjs';

test('a deploy event carries one action and one count per role, never a file list, and the digest line reads them', (t) => {
  const repo = revisionRepo(t, { files: { 'modules/kernel/driver-loop.yaml': 'steps:\n  - a\n  - b\n', 'modules/supervisor/supervisor-menu.yaml': 'items:\n  - a\n  - b\n' } });
  const from = repo.base;
  const to = repo.commit('change', { 'docs/a.md': '# a\n', 'modules/kernel/driver-loop.yaml': 'steps:\n  - a\n  - b\n  - c\n', 'modules/supervisor/supervisor-menu.yaml': 'items:\n  - a\n', 'modules/ops/ops/interface.draw.yaml': 'a: 1\n' });
  const payload = deployRoles(repo.root, from, to);
  assert.equal(payload.roles.kernel.action, 'reread');
  assert.equal(payload.roles.supervisor.action, 'replace');
  assert.equal(payload.roles.op.action, 'admission');
  assert.deepEqual(payload.roles.op.kinds, ['interface.draw']);
  assert.equal(JSON.stringify(payload).includes('driver-loop'), false, 'no file names in the event');
  assert.ok(JSON.stringify(payload).length < 700);
  assert.equal(deployLine(payload), `revision ${to.slice(0, 12)}: Kernel re-read 2 files / Supervisor replaced / Op next attempt reads the new rules / Critic not concerned / engine not concerned`);
});

test('a docs-only deploy reads: every seat not concerned', (t) => {
  const repo = revisionRepo(t);
  const to = repo.commit('docs', { 'docs/a.md': '# a\n' });
  assert.match(deployLine(deployRoles(repo.root, repo.base, to)), /Kernel not concerned \/ Supervisor not concerned/);
});

test('a change git cannot measure is reported as every seat replaced', (t) => {
  const repo = revisionRepo(t);
  assert.match(deployLine(deployRoles(repo.root, '0'.repeat(40), repo.base)), /cannot be measured; every seat is replaced/);
});

test('starci runtime revision-scope answers the payload and the line of a deploy before it is made', (t) => {
  const repo = revisionRepo(t);
  const to = repo.commit('docs', { 'docs/a.md': '# a\n' });
  const answer = revisionScope({ root: repo.root, from: repo.base });
  assert.equal(answer.payload.to, to, 'the target defaults to the HEAD of the tree');
  assert.match(answer.line, /^revision [0-9a-f]{12}: Kernel not concerned/);
});
