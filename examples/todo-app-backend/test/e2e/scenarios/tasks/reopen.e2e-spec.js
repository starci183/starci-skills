'use strict';

/**
 * fr.task.reopen - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- tasks/reopen
 */

const { call, persona } = require('../../lib/client');
const { scenario, assertImplemented } = require('../../lib/scenario');
const { uniqueTitle, createTask, findTask, listTasks } = require('../../lib/fixtures');

const GROUP = 'tasks/reopen';

async function tokenOf(name) {
  return (await persona(name)).token;
}

async function completedTask(label) {
  const created = await createTask('owner', uniqueTitle(label));
  const done = await call('completeTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'complete it first, so there is something to reopen' });
  if (done.errorCode) throw new Error(`precondition completeTask failed: ${done.errorCode}`);
  return created;
}

scenario(GROUP, 'fr.task.reopen.main-1', async () => {
  const created = await completedTask('reopen-main-1');
  const observed = await call('reopenTask', {
    variables: { id: created.taskId },
    token: await tokenOf('owner'),
    note: 'the owner names their own completed task at the reopen door',
  });
  expect(observed.errors).toBeNull();
  expect(observed.data.reopenTask.taskId).toBe(created.taskId);
});

scenario(GROUP, 'fr.task.reopen.main-2', async () => {
  const created = await completedTask('reopen-main-2');
  await call('reopenTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'reopen it' });
  const single = await findTask('owner', created.taskId);
  expect(single.complete).toBe(false);
  const listed = await listTasks('owner', 'tasks, to read the reopened row back through the list too');
  expect(listed.find((task) => task.taskId === created.taskId).complete).toBe(false);
});

scenario(GROUP, 'fr.task.reopen.exception-1', async () => {
  const created = await completedTask('reopen-stranger');
  const observed = await call('reopenTask', {
    variables: { id: created.taskId },
    token: await tokenOf('other'),
    note: 'an actor who does not own the task reopens it',
  });
  expect(observed.errorCode).toBe('TASK_FORBIDDEN');
  expect((await findTask('owner', created.taskId)).complete).toBe(true);
});

scenario(GROUP, 'ac.task.complete.once.is-idempotent', async () => {
  const created = await completedTask('reopen-idempotent');
  const again = await call('completeTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'complete the already-complete task' });
  expect(again.errors).toBeNull();
  expect(again.data.completeTask).toEqual({ taskId: created.taskId, complete: true });
  const reopened = await call('reopenTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'reopen it' });
  expect(reopened.data.reopenTask).toEqual({ taskId: created.taskId, complete: false });
  const third = await call('completeTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'complete it a second time' });
  expect(third.errors).toBeNull();
  expect((await findTask('owner', created.taskId)).complete).toBe(true);
});

scenario(GROUP, 'ac.task.complete.once.is-reversible', async () => {
  const created = await completedTask('reopen-reversible');
  const observed = await call('reopenTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'the owner reopens the completed task' });
  expect(observed.errors).toBeNull();
  expect(observed.data.reopenTask.complete).toBe(false);
  const readBack = await findTask('owner', created.taskId);
  expect(readBack.complete).toBe(false);
  expect(readBack.title).toBe(created.title);
});

assertImplemented(GROUP);
