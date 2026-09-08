import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createSourceFixture, acceptArchitecture, acceptBackend, branch, current, git, open, planCells, put, read, sha } from './workflow-source-fixture.mjs';

// This regression measures original current operator acceptance. Planning adds a future cell;
// neither the test nor the source fixture injects an accepted attempt or changes an old seal.
function inventory(directory) {
  const files = [];
  const visit = relative => {
    for (const entry of readdirSync(path.join(directory, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const ref = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) visit(ref);
      else { assert.ok(entry.isFile(), 'accepted fixture evidence contains regular files only'); files.push({ ref, hash: sha(readFileSync(path.join(directory, ref))) }); }
    }
  };
  visit(''); return files;
}

test('enrolment preserves genuinely accepted pre-assignment source while refusing new uncoordinated writes', { timeout: 180000 }, async t => {
  const f = await createSourceFixture(t, { sessionId: 'history-source' });
  const architecture = await acceptArchitecture(f);
  const source = await acceptBackend(f, architecture);
  const key = `${source.step}/1`, directory = branch(f, source.step);
  const originalRequest = read(path.join(directory, 'request/request.json'));
  const originalAttempt = structuredClone(f.state().attempts[key]);
  assert.equal(originalRequest.coordination, undefined);
  assert.equal(f.state().coordination, undefined);
  assert.equal(originalAttempt.status, 'matched');
  assert.ok(originalAttempt.evidenceManifest?.fingerprint);
  assert.ok(originalAttempt.context, 'the actual open froze an immutable invocation context');
  const evidenceBefore = inventory(directory);
  const { acceptedProducerProof } = await f.load('scripts/producer-import.mjs');
  const proof = () => acceptedProducerProof(f.root, f.sessionId, source.step, 1, 'backend-source-application', { hostRoot: f.source });
  const acceptedBefore = await proof();
  assert.deepEqual(acceptedBefore.heads, [source.head]);

  const coordinator = await createSourceFixture(t, {
    existing: f, sessionId: 'history-coordinator', topology: { mode: 'coordinated' },
    mission: { goal: 'Coordinate the accepted worker and its subsequent authorized source work.', doneWhen: [{ producedBy: 'workflow.verify', evidence: 'Original accepted peer delivery and subsequent ownership are verified.' }] }
  });
  const { enrolWorkflow, assignWorkflows, coordinationAdmissionErrors } = await f.load('scripts/workflow-coordination.mjs');
  await enrolWorkflow(f.root, f.session, coordinator.sessionId);
  const assignment = await assignWorkflows(f.root, coordinator.session, { id: 'adopt-worker', claims: [{ sessionId: f.sessionId, role: 'be', root: 'src/modules/fixture' }] });
  assert.ok(assignment.hash ?? assignment.sha256 ?? assignment.fingerprint, 'the public assignment operation returns its original content address');
  assert.deepEqual(f.state().attempts[key], originalAttempt, 'enrolment and assignment preserve the original accepted attempt');
  assert.deepEqual(inventory(directory), evidenceBefore, 'enrolment and assignment preserve every original request and response byte');

  planCells(f, [[source.step + 1, 'backend.generate']]);
  const fresh = current(f, originalRequest, source.step + 1);
  fresh.contexts = fresh.contexts.map(context => context.alias === '@workspaces/be' ? { ...context, head: source.head } : context);
  fresh.environment.writes = [...originalRequest.environment.writes];
  fresh.environment.exclusive = [...originalRequest.environment.exclusive];
  assert.equal(fresh.coordination, undefined);

  await t.test('fresh writes cannot inherit acceptance or use a caller-supplied historical flag', async () => {
    const admission = await coordinationAdmissionErrors(f.root, f.session, f.state(), fresh);
    assert.match(admission.join('\n'), /COORDINATION_STALE/);
    const claimedHistory = await coordinationAdmissionErrors(f.root, f.session, f.state(), fresh, { historical: true });
    assert.match(claimedHistory.join('\n'), /COORDINATION_STALE|COORDINATION_HISTORY|accepted|historical/i, 'unopened work is not accepted history');
    const stateBefore = readFileSync(path.join(f.session, 'state.json'));
    await assert.rejects(open(f, fresh), /COORDINATION_STALE/);
    assert.deepEqual(readFileSync(path.join(f.session, 'state.json')), stateBefore, 'refused open does not reserve a request, attempt or worker slot');
    assert.equal(f.state().attempts[`${fresh.step}/1`], undefined);
    assert.equal(f.state().requestHashes[`${fresh.step}/1`], undefined);
    assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), source.head);
    assert.equal(git(f.worktree, 'status', '--porcelain'), '', 'refused admission preserves the committed disposable source');
    assert.deepEqual(inventory(directory), evidenceBefore);
  });

  await t.test('original accepted source remains consumable after later enrolment and assignment', async () => {
    const { validateStep } = await f.load('scripts/validate-step.mjs');
    const replay = await validateStep(f.root, directory, { origin: false, operator: true, requestPhase: 'accept' });
    assert.deepEqual(replay.errors, [], 'historical operator replay must not demand a selector that did not exist when this source was accepted');
    assert.deepEqual(await coordinationAdmissionErrors(f.root, f.session, f.state(), originalRequest, { historical: true }), [], 'the exact accepted request can pass historical admission without gaining current write authority');
    assert.deepEqual(await proof(), acceptedBefore, 'the same original request, manifest, artifact and repository/head proof is consumed');
  });

  await t.test('historical consumption still authenticates accepted evidence and original request bytes', async () => {
    for (const relative of ['response/artifacts/unit.log', 'request/request.json']) {
      const file = path.join(directory, relative), bytes = readFileSync(file);
      try {
        put(file, relative.endsWith('.json') ? { ...originalRequest, attempt: { ...originalRequest.attempt, id: 'other-original-attempt' } } : 'Altered evidence after original acceptance.\n');
        await assert.rejects(proof(), /evidenceManifest|frozen request hash|original accepted attempt/);
        assert.ok((await coordinationAdmissionErrors(f.root, f.session, f.state(), originalRequest, { historical: true })).length,
          'a history-consumption exemption requires the intact original request and entire accepted manifest');
      } finally { put(file, bytes); }
    }
    assert.deepEqual(inventory(directory), evidenceBefore, 'every original byte is restored after disposable negative probes');
    assert.deepEqual(f.state().attempts[key], originalAttempt, 'no historical acceptance metadata was restamped');
  });
});

test('an original in-flight source finishes across enrolment and independent extraction without changing its request', { timeout: 180000 }, async t => {
  const f = await createSourceFixture(t, { sessionId: 'inflight-source' });
  const coordinator = await createSourceFixture(t, { existing: f, sessionId: 'inflight-coordinator', topology: { mode: 'coordinated' },
    mission: { goal: 'Coordinate the running worker and its independently extracted shared source.', doneWhen: [{ producedBy: 'workflow.verify', evidence: 'Original source outcomes and shared ownership are proved.' }] } });
  const producer = await createSourceFixture(t, { existing: f, sessionId: 'inflight-producer', draft: true });
  const architecture = await acceptArchitecture(f);
  const coordination = await f.load('scripts/workflow-coordination.mjs');
  let originalBytes, originalContext, originalRequest, directory;
  const source = await acceptBackend(f, architecture, { afterOpen: async ({ request, dir }) => {
    originalRequest = structuredClone(request); directory = dir;
    originalBytes = readFileSync(path.join(dir, 'request/request.json'));
    originalContext = structuredClone(f.state().attempts[`${request.step}/1`].context);
    const contextBytes = readFileSync(path.join(f.session, originalContext.ref));
    assert.equal(request.coordination, undefined);
    await coordination.enrolWorkflow(f.root, f.session, coordinator.sessionId);
    const assignment = await coordination.assignWorkflows(f.root, coordinator.session, { id: 'adopt-running', claims: [{ sessionId: f.sessionId, role: 'be', root: 'src/modules' }] });
    const retained = read(path.join(coordinator.session, assignment.ref));
    assert.deepEqual(retained.inFlight, [{ sessionId: f.sessionId, key: `${request.step}/1`, attemptId: request.attempt.id, requestHash: sha(originalBytes), context: originalContext }]);
    planCells(f, [[request.step + 1, 'backend.generate']]);
    const specification = { id: 'extract-independent', donorSessionId: f.sessionId, producerSessionId: producer.sessionId,
      operatorId: 'backend.generate', selections: [{ impactId: 'bounded', roots: ['src/modules/shared'] }],
      dependencies: [{ consumerSessionId: f.sessionId, kind: 'backend-source-application', cells: [`${request.step + 1}/1`] }] };
    const prepared = await coordination.prepareExtraction(f.root, coordinator.session, specification);
    await coordination.enrolWorkflow(f.root, producer.session, coordinator.sessionId, { preparation: prepared });
    const activated = await coordination.activateExtraction(f.root, coordinator.session, prepared);
    assert.deepEqual(read(path.join(coordinator.session, activated.ref)).inFlight, retained.inFlight);
    assert.deepEqual(await coordination.coordinationAdmissionErrors(f.root, f.session, f.state(), request), []);

    await t.test('fresh, renamed, missing-context, tampered and transferred-root continuations refuse', async () => {
      const check = (candidate, state = f.state()) => coordination.coordinationAdmissionErrors(f.root, f.session, state, candidate);
      const fresh = current(f, request, request.step + 1); fresh.environment.writes = [...request.environment.writes]; fresh.environment.exclusive = [...request.environment.exclusive];
      assert.match((await check(fresh)).join('\n'), /COORDINATION_STALE/);
      const before = readFileSync(path.join(f.session, 'state.json'));
      await assert.rejects(open(f, fresh), /COORDINATION_STALE/);
      assert.deepEqual(readFileSync(path.join(f.session, 'state.json')), before);
      assert.match((await check({ ...request, attempt: { ...request.attempt, id: 'new-invocation-at-old-cell' } })).join('\n'), /COORDINATION_IN_FLIGHT/);
      const renamed = f.state(); renamed.attempts[`${request.step}/1`].requestRef = 'renamed/request.json';
      assert.match((await check(request, renamed)).join('\n'), /COORDINATION_IN_FLIGHT/);
      const missing = f.state(); delete missing.attempts[`${request.step}/1`].context;
      assert.match((await check(request, missing)).join('\n'), /COORDINATION_IN_FLIGHT/);
      const foreign = { ...request, environment: { ...request.environment, writes: ['@workspaces/be/src/modules/shared/new.mjs'] } };
      assert.match((await check(foreign)).join('\n'), /COORDINATION_IN_FLIGHT|COORDINATION_OWNED/);
      try {
        put(path.join(f.session, originalContext.ref), Buffer.concat([contextBytes, Buffer.from(' ')]));
        assert.match((await check(request)).join('\n'), /HISTORY_TAMPERED/);
      } finally { put(path.join(f.session, originalContext.ref), contextBytes); }
      try {
        put(path.join(dir, 'request/request.json'), { ...request, requirements: { ...request.requirements, outcome: 'Altered scope after admission.' } });
        assert.match((await check(request)).join('\n'), /INVOCATION_HISTORY_UNBOUND/);
      } finally { put(path.join(dir, 'request/request.json'), originalBytes); }
    });
    assert.deepEqual(readFileSync(path.join(dir, 'request/request.json')), originalBytes);
    assert.deepEqual(readFileSync(path.join(f.session, originalContext.ref)), contextBytes);
    assert.deepEqual(f.state().attempts[`${request.step}/1`].context, originalContext);
  } });
  assert.equal(f.state().attempts[`${source.step}/1`].status, 'matched', 'real source tests, normal commit and original acceptance finish after extraction');
  assert.deepEqual(readFileSync(path.join(directory, 'request/request.json')), originalBytes);
  assert.deepEqual(f.state().attempts[`${source.step}/1`].context, originalContext);
  assert.match((await coordination.coordinationAdmissionErrors(f.root, f.session, f.state(), originalRequest)).join('\n'), /COORDINATION_IN_FLIGHT/, 'terminal evidence cannot become another current write admission');
  const { acceptedProducerProof } = await f.load('scripts/producer-import.mjs');
  assert.deepEqual((await acceptedProducerProof(f.root, f.sessionId, source.step, 1, 'backend-source-application', { hostRoot: f.source })).heads, [source.head]);
});
