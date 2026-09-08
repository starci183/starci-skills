import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createSourceFixture, acceptArchitecture, acceptBackend, acceptQuality, git, read, put, sha, branch } from './workflow-source-fixture.mjs';

test('real current architecture, source commit and quality test complete through actual acceptance and reject altered evidence', async t => {
  const f = await createSourceFixture(t);
  assert.deepEqual(f.state().mission.discovery.impacts[0].tags, ['backend', 'architecture']);
  assert.ok(f.state().mission.doneWhen.some(item => item.producedBy === 'api.verify'), 'backend scope keeps its inherited API verification obligation');
  const architecture = await acceptArchitecture(f);
  assert.equal(f.state().attempts[`${architecture.step}/1`].status, 'matched');
  assert.equal(f.state().attempts[`${architecture.step}/1/critique`].status, 'matched');
  const { acceptedProducerProof } = await f.load('scripts/producer-import.mjs');
  const proof = await acceptedProducerProof(f.root, f.sessionId, architecture.step, 1, 'architecture-decision', { hostRoot: f.source });
  assert.equal(proof.operatorId, 'architecture.decide');
  const source = await acceptBackend(f, architecture);
  const sourceProof = await acceptedProducerProof(f.root, f.sessionId, source.step, 1, 'backend-source-application', { hostRoot: f.source });
  assert.equal(sourceProof.bindings[0].revision, source.head);
  assert.deepEqual(sourceProof.heads, [source.head]);
  const quality = await acceptQuality(f, source);
  assert.equal(quality.proof.bindings[0].revision, source.head);
  assert.equal(quality.proof.operatorId, 'quality.verify');
  assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), source.head);
  assert.ok(Date.parse(f.state().attempts[`${quality.step}/1`].startedAt) >= Date.parse(f.state().attempts[`${source.step}/1`].endedAt));
  const mutations = read(path.join(branch(f, source.step), 'response/data/mutations.json'));
  assert.deepEqual(git(f.worktree, 'diff-tree', '--no-commit-id', '--name-only', '-r', source.head).split('\n').sort(), mutations.changes.map(change => change.path).sort());
  for (const change of mutations.changes) assert.equal(sha(readFileSync(path.join(f.worktree, change.path))), change.afterHash);
  for (const [step, kind, relative] of [[source.step, 'backend-source-application', 'response/artifacts/unit.log'], [quality.step, 'quality-verification', 'response/artifacts/build.log']]) {
    const file = path.join(branch(f, step), relative), bytes = readFileSync(file);
    try { put(file, 'Replaced measurement after acceptance.\n'); await assert.rejects(acceptedProducerProof(f.root, f.sessionId, step, 1, kind, { hostRoot: f.source }), /evidenceManifest/); }
    finally { put(file, bytes); }
  }
  assert.equal((await acceptedProducerProof(f.root, f.sessionId, quality.step, 1, 'quality-verification', { hostRoot: f.source })).manifestFingerprint, quality.proof.manifestFingerprint);
  assert.equal(f.state().status, 'running', 'source and quality evidence alone do not close the broader mission');
});

test('shared fixture roots create distinct normal owners and an untouched draft for public derived enrolment', async t => {
  const a = await createSourceFixture(t, { sessionId: 'shared-a' });
  const b = await createSourceFixture(t, { sessionId: 'shared-b', existing: a });
  const c = await createSourceFixture(t, { sessionId: 'shared-c', existing: a, draft: true });
  assert.equal(a.source, b.source); assert.equal(b.root, c.root); assert.equal(a.repository, c.repository);
  assert.notEqual(a.worktree, b.worktree); assert.notEqual(b.worktree, c.worktree);
  assert.equal(git(a.worktree, 'rev-parse', '--path-format=absolute', '--git-common-dir'), git(c.worktree, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
  for (const f of [a, b, c]) {
    assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), a.base);
    assert.equal(read(path.join(f.source, `.workspaces/local/workflows/${f.sessionId}.json`)).sessionId, f.sessionId);
  }
  assert.equal(a.state().lifecycle.phase, 'active'); assert.equal(b.state().lifecycle.phase, 'active');
  assert.equal(c.state().lifecycle.phase, 'draft'); assert.equal(Object.keys(c.state().attempts).length, 0);
  assert.equal(Object.keys(c.state().missionSnapshots ?? {}).length, 0);
});

test('an actually failing source command cannot create a commit or accepted source proof', async t => {
  const f = await createSourceFixture(t, { sessionId: 'source-command-fails' });
  const architecture = await acceptArchitecture(f), base = git(f.worktree, 'rev-parse', 'HEAD');
  await assert.rejects(acceptBackend(f, architecture, { files: {
    [architecture.operation.writerRef]: "export function runFixtureWorker(input) { return input; }\n",
    'src/modules/fixture/worker.spec.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; import {runFixtureWorker} from './worker.mjs'; test('declared uppercase contract',()=>assert.equal(runFixtureWorker('x'),'X'));\n"
  } }), /ERR_ASSERTION|AssertionError|Expected values/);
  assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), base);
  assert.equal(f.state().attempts[`${architecture.sourceStep}/1`].status, 'running', 'the test never injects a successful verdict after the real command fails');
  const { acceptedProducerProof } = await f.load('scripts/producer-import.mjs');
  await assert.rejects(acceptedProducerProof(f.root, f.sessionId, architecture.sourceStep, 1, 'backend-source-application', { hostRoot: f.source }), /completed producer|matched accepted/);
});
