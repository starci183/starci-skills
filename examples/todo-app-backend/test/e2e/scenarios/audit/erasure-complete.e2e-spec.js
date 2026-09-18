'use strict';

/**
 * fr.audit.erasure.complete - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- audit/erasure-complete
 *
 * Every scenario here erases the same persona (demo2), because a completed erasure is destructive to
 * that identity's key for the rest of the run. Each one therefore produces its own lines, requests its
 * own erasure and completes it, so no scenario depends on another's leftovers. demo is never erased.
 *
 * Not run, by the registry: fr.audit.erasure.complete.exception-1 (needs a store whose key survives
 * destroyKey, i.e. an out-of-band mutation), fr.audit.erasure.complete.post-2 (line bytes, position and
 * hash are not exposed by any public operation) and ac.audit.erasure.logged.request-and-completion-are-lines
 * (the two erasure lines are sealed under the system actor's key, which no caller can ever read).
 */

const { call, persona } = require('../../lib/client');
const { scenario, assertImplemented } = require('../../lib/scenario');
const { uniqueTitle, createTask, sleep, requestErasure, completeErasure, exportLines, auditLines } = require('../../lib/fixtures');

const GROUP = 'audit/erasure-complete';

async function produceLinesAsOther(label) {
  const created = await createTask('other', uniqueTitle(label));
  await sleep(1200);
  const lines = await exportLines('other');
  if (!lines.some((line) => line.target === created.taskId)) {
    throw new Error(`precondition failed: demo2 produced no readable line naming ${created.taskId}`);
  }
  return created;
}

async function eraseOther() {
  const requested = await requestErasure('other');
  if (requested.errorCode) throw new Error(`requestErasure failed: ${requested.errorCode} ${requested.errorMessage}`);
  const requestId = requested.data.requestErasure.requestId;
  const completed = await completeErasure('other', requestId);
  if (completed.errorCode) throw new Error(`completeErasure failed: ${completed.errorCode} ${completed.errorMessage}`);
  return { requestId, state: completed.data.completeErasure.state };
}

scenario(GROUP, 'fr.audit.erasure.complete.main-1', async () => {
  await produceLinesAsOther('erasure-complete-main-1');
  const requested = await requestErasure('other');
  const requestId = requested.data.requestErasure.requestId;
  const completed = await call('completeErasure', {
    variables: { requestId },
    token: (await persona('other')).token,
    note: `completeErasure(${requestId})`,
  });
  expect(completed.errors).toBeNull();
  expect(completed.data.completeErasure.requestId).toBe(requestId);
  expect(completed.data.completeErasure.state).toBe('complete');
});

scenario(GROUP, 'fr.audit.erasure.complete.main-2', async () => {
  const created = await produceLinesAsOther('erasure-complete-main-2');
  await eraseOther();
  const token = (await persona('other')).token;
  const log = await call('auditLog', { token, note: "the erased subject's own log read after completion" });
  const exported = await call('exportMyData', { token, note: 'the erased subject\'s export after completion' });
  expect(log.errors).toBeNull();
  expect(exported.errors).toBeNull();
  expect(log.data.auditLog).toEqual([]);
  expect(exported.data.exportMyData).toEqual([]);
  expect(log.data.auditLog.map((line) => line.target)).not.toContain(created.taskId);
});

scenario(GROUP, 'fr.audit.erasure.complete.main-3', async () => {
  await produceLinesAsOther('erasure-complete-main-3');
  const requested = await requestErasure('other');
  const requestId = requested.data.requestErasure.requestId;
  const completed = await completeErasure('other', requestId);
  expect(completed.data.completeErasure).toEqual({ requestId, state: 'complete' });
});

scenario(GROUP, 'fr.audit.erasure.complete.post-1', async () => {
  const erasedTask = await produceLinesAsOther('erasure-complete-post-1');
  const ownTask = await createTask('owner', uniqueTitle('erasure-complete-post-1-owner'));
  const { requestId } = await eraseOther();
  expect(requestId).toBeTruthy();

  const erasedToken = (await persona('other')).token;
  const otherExport = await call('exportMyData', { token: erasedToken, note: "the erased subject's export after completion" });
  const otherLog = await call('auditLog', { token: erasedToken, note: "the erased subject's log after completion" });
  expect(otherExport.data.exportMyData).toEqual([]);
  expect(otherLog.data.auditLog).toEqual([]);

  const ownerExport = await call('exportMyData', { token: (await persona('owner')).token, note: 'a different, unerased person exports after the completion' });
  const ownerTargets = ownerExport.data.exportMyData.map((line) => line.target).filter(Boolean);
  expect(ownerTargets).toContain(ownTask.taskId);
  expect(ownerTargets).not.toContain(erasedTask.taskId);
});

scenario(GROUP, 'ac.audit.erasure.right.identifying-fields-unreadable', async () => {
  const first = await createTask('other', uniqueTitle('erasure-ac-lines-a'));
  const second = await createTask('other', uniqueTitle('erasure-ac-lines-b'));
  await sleep(1200);
  const before = await exportLines('other');
  const targets = before.map((line) => line.target);
  expect(targets).toContain(first.taskId);
  expect(targets).toContain(second.taskId);

  await eraseOther();

  const token = (await persona('other')).token;
  expect((await call('exportMyData', { token, note: "the erased subject's own export" })).data.exportMyData).toEqual([]);
  expect((await call('auditLog', { token, note: "the erased subject's own log" })).data.auditLog).toEqual([]);
  const otherReader = await call('exportMyData', { token: (await persona('owner')).token, note: "another person's export, checked for the erased subject's targets" });
  const otherTargets = otherReader.data.exportMyData.map((line) => line.target).filter(Boolean);
  expect(otherTargets).not.toContain(first.taskId);
  expect(otherTargets).not.toContain(second.taskId);
  void auditLines;
});

assertImplemented(GROUP);
