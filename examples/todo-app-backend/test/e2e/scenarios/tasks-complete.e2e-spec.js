'use strict';

/**
 * fr.task.complete - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- tasks/complete
 */

const { call, persona } = require('../lib/client');
const { scenario, assertImplemented } = require('../lib/scenario');
const { uniqueTitle, createTask, listTasks, findTask, acceptInvitation, emailOf } = require('../lib/fixtures');

const GROUP = 'tasks/complete';

async function tokenOf(name) {
  return (await persona(name)).token;
}

scenario(GROUP, 'fr.task.complete.main-1', async () => {
  const own = await createTask('owner', uniqueTitle('complete-owner'));
  const byOwner = await call('completeTask', {
    variables: { id: own.taskId },
    token: await tokenOf('owner'),
    note: 'the owner names a task they own at this door',
  });
  expect(byOwner.errors).toBeNull();
  expect(byOwner.data.completeTask.complete).toBe(true);

  const shared = await createTask('owner', uniqueTitle('complete-editor'));
  await acceptInvitation('owner', shared.taskId, emailOf('other'), 'editor');
  const byEditor = await call('completeTask', {
    variables: { id: shared.taskId },
    token: await tokenOf('other'),
    note: 'an accepted editor collaborator names that task at this door',
  });
  expect(byEditor.errors).toBeNull();
  expect(byEditor.data.completeTask.taskId).toBe(shared.taskId);
});

scenario(GROUP, 'fr.task.complete.main-2', async () => {
  const created = await createTask('owner', uniqueTitle('complete-effect'));
  const before = await findTask('owner', created.taskId);
  expect(before.complete).toBe(false);
  await call('completeTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'completeTask as the owner' });
  const after = await findTask('owner', created.taskId);
  expect(after.complete).toBe(true);
  const listed = await listTasks('owner', 'tasks, to read the completion back through the list too');
  expect(listed.find((task) => task.taskId === created.taskId).complete).toBe(true);
});

scenario(GROUP, 'fr.task.complete.exception-1', async () => {
  const created = await createTask('owner', uniqueTitle('complete-stranger'));
  const observed = await call('completeTask', {
    variables: { id: created.taskId },
    token: await tokenOf('other'),
    note: 'an actor who neither owns the task nor holds an invitation completes it',
  });
  expect(observed.errorCode).toBe('TASK_FORBIDDEN');
  const unchanged = await findTask('owner', created.taskId);
  expect(unchanged.complete).toBe(false);
});

scenario(GROUP, 'ac.task.complete.once.is-idempotent', async () => {
  const created = await createTask('owner', uniqueTitle('idempotent'));
  const first = await call('completeTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'complete it once' });
  const second = await call('completeTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'complete the already-complete task again' });
  expect(first.errors).toBeNull();
  expect(second.errors).toBeNull();
  expect(second.data).toEqual(first.data);
  const readBack = await findTask('owner', created.taskId);
  expect(readBack.complete).toBe(true);
  expect(readBack.title).toBe(created.title);
});

scenario(GROUP, 'ac.task.complete.once.is-reversible', async () => {
  const created = await createTask('owner', uniqueTitle('reversible-from-complete'));
  await call('completeTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'the owner completes it' });
  const reopened = await call('reopenTask', { variables: { id: created.taskId }, token: await tokenOf('owner'), note: 'the owner reopens it' });
  expect(reopened.errors).toBeNull();
  expect(reopened.data.reopenTask.complete).toBe(false);
  expect((await findTask('owner', created.taskId)).complete).toBe(false);
});

scenario(GROUP, 'ac.share.role.permissions.viewer-read-only', async () => {
  const created = await createTask('owner', uniqueTitle('viewer'));
  await acceptInvitation('owner', created.taskId, emailOf('other'), 'viewer');
  const observed = await call('completeTask', {
    variables: { id: created.taskId },
    token: await tokenOf('other'),
    note: 'an accepted viewer collaborator attempts to complete the task',
  });
  expect(observed.errorCode).toBe('TASK_FORBIDDEN');
  expect((await findTask('owner', created.taskId)).complete).toBe(false);
});

scenario(GROUP, 'ac.share.role.permissions.editor-can-complete', async () => {
  const created = await createTask('owner', uniqueTitle('editor'));
  await acceptInvitation('owner', created.taskId, emailOf('other'), 'editor');
  const observed = await call('completeTask', {
    variables: { id: created.taskId },
    token: await tokenOf('other'),
    note: 'an accepted editor collaborator completes the task',
  });
  expect(observed.errors).toBeNull();
  expect(observed.data.completeTask.complete).toBe(true);
  const forTheOwner = await findTask('owner', created.taskId);
  expect(forTheOwner.complete).toBe(true);
});

assertImplemented(GROUP);
