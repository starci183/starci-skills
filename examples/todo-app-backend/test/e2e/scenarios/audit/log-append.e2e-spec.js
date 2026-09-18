'use strict';

/**
 * fr.audit.log.append - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- audit/log-append
 *
 * Audit lines are written by AuditEventSubscriber off the event bus, and the response can beat the
 * write, so every count below is taken after the read has settled rather than immediately after the
 * action: settle, snapshot, act, wait for the change, settle again, then assert the delta.
 *
 * Not run, by the registry: fr.audit.log.append.post-2, ac.audit.append-only.chain-detects-tamper and
 * ac.audit.retention.available-through-window - no public operation reports the hash chain, recomputes
 * it, or moves the clock.
 */

const { call, signIn } = require('../../lib/client');
const { scenario, assertImplemented } = require('../../lib/scenario');
const { uniqueTitle, createTask, auditLines, sleep, until } = require('../../lib/fixtures');

const GROUP = 'audit/log-append';
const DEMO = 'demo@todo.dev';
const DEMO_PASSWORD = 'todo-demo-pass';
const TRACKED_ACTIONS = ['login.signed-in', 'login.signed-out', 'task.created', 'task.completed', 'task.deleted'];

async function tokenFor(email, password) {
  return (await signIn(email, password, `sign in as ${email} to emit event.login.signed-in`)).token;
}

async function settleLineCount(personaName = 'owner') {
  let previous = -1;
  let current = (await auditLines(personaName, 'settle: read the audit log')).length;
  while (current !== previous) {
    previous = current;
    await sleep(700);
    current = (await auditLines(personaName, 'settle: read the audit log again')).length;
  }
  return current;
}

scenario(GROUP, 'fr.audit.log.append.main-1', async () => {
  const seen = await settleLineCount();
  const created = await createTask('owner', uniqueTitle('append-actions'));
  const token = await tokenFor(DEMO, DEMO_PASSWORD);
  await call('completeTask', { variables: { id: created.taskId }, token, note: 'complete the task (event.task.completed)' });
  await call('deleteTask', { variables: { id: created.taskId }, token, note: 'delete the task (event.task.deleted)' });
  const freshIn = await signIn(DEMO, DEMO_PASSWORD, 'a sign-in that emits event.login.signed-in');
  await call('signOut', { variables: { input: { sessionToken: freshIn.token } }, note: 'a sign-out that emits event.login.signed-out' });

  const read = await until('the tracked actions to appear as audit lines', async () => {
    const lines = await auditLines('owner', 'read the audit log after the tracked actions');
    return { done: TRACKED_ACTIONS.every((action) => lines.some((line) => line.action === action)), value: lines };
  });

  expect(read.value.length).toBeGreaterThan(seen);
  for (const action of TRACKED_ACTIONS) {
    expect(read.value.some((line) => line.action === action)).toBe(true);
  }
  expect(read.value.filter((line) => line.action === 'task.created' && line.target === created.taskId)).toHaveLength(1);
});

scenario(GROUP, 'fr.audit.log.append.main-2', async () => {
  const title = uniqueTitle('append-one-line');
  const before = await settleLineCount();
  const created = await createTask('owner', title, `createTask "${title}" (event.task.created)`);
  const after = await until('exactly one more audit line', async () => {
    const count = (await auditLines('owner', 'read the audit log after one tracked action')).length;
    return { done: count === before + 1, value: count };
  });
  await settleLineCount();
  const lines = await auditLines('owner', 'read the audit log to check the one new line');
  const fresh = lines.filter((line) => line.target === created.taskId && line.action === 'task.created');
  expect(fresh).toHaveLength(1);
  expect(after.value).toBe(before + 1);
});

scenario(GROUP, 'fr.audit.log.append.post-1', async () => {
  const before = await settleLineCount();
  const created = await createTask('owner', uniqueTitle('post-1-count'));
  const after = await until('the caller\'s line count to rise by one', async () => {
    const count = (await auditLines('owner', 'read the audit log after one createTask')).length;
    return { done: count > before, value: count };
  });
  await settleLineCount();
  const settled = (await auditLines('owner', 'read the settled audit log')).length;
  expect(settled).toBe(before + 1);
  const lines = await auditLines('owner', 'read the audit log once more for the target');
  expect(lines.filter((line) => line.target === created.taskId)).toHaveLength(1);
  void after;
});

assertImplemented(GROUP);
