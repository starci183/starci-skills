'use strict';

/**
 * fr.task.create - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- tasks/create
 */

const { call, persona } = require('../lib/client');
const { scenario, assertImplemented } = require('../lib/scenario');
const { uniqueTitle, createTask, listTasks, findTask, acceptInvitation, emailOf } = require('../lib/fixtures');

const GROUP = 'tasks/create';

scenario(GROUP, 'fr.task.create.main-1', async () => {
  const title = uniqueTitle('main-1');
  const owner = await persona('owner');
  const observed = await call('createTask', {
    variables: { input: { title } },
    token: owner.token,
    note: `createTask with the non-empty title "${title}"`,
  });
  expect(observed.errors).toBeNull();
  expect(observed.data.createTask.taskId).toBeTruthy();
  expect(observed.data.createTask.title).toBe(title);
});

scenario(GROUP, 'fr.task.create.main-2', async () => {
  const title = uniqueTitle('main-2');
  const created = await createTask('owner', title);
  const mine = await findTask('owner', created.taskId);
  expect(mine).not.toBeNull();
  expect(mine.complete).toBe(false);
  expect(mine.title).toBe(title);
  const theirs = await listTasks('other');
  expect(theirs.map((task) => task.taskId)).not.toContain(created.taskId);
});

scenario(GROUP, 'fr.task.create.exception-1', async () => {
  const before = await listTasks('owner');
  const owner = await persona('owner');
  const observed = await call('createTask', {
    variables: { input: { title: '' } },
    token: owner.token,
    note: 'createTask with an empty title',
  });
  expect(observed.errorCode).toBe('TASK_TITLE_REQUIRED');
  expect(observed.data).toBeNull();
  const after = await listTasks('owner');
  expect(after.map((task) => task.taskId).sort()).toEqual(before.map((task) => task.taskId).sort());
});

scenario(GROUP, 'fr.task.create.post-1', async () => {
  const title = uniqueTitle('post-1');
  await createTask('owner', title);
  const mine = await listTasks('owner', 'tasks, to count how many rows carry that one submission');
  expect(mine.filter((task) => task.title === title)).toHaveLength(1);
});

scenario(GROUP, 'ac.task.single-owner.refuses-stranger', async () => {
  const title = uniqueTitle('ownership');
  const created = await createTask('owner', title);
  const stranger = await persona('other');

  const strangerCompletes = await call('completeTask', {
    variables: { id: created.taskId },
    token: stranger.token,
    note: 'a stranger attempts to complete the task',
  });
  expect(strangerCompletes.errorCode).toBe('TASK_FORBIDDEN');

  const strangerDeletes = await call('deleteTask', {
    variables: { id: created.taskId },
    token: stranger.token,
    note: 'the same stranger attempts to delete the task',
  });
  expect(strangerDeletes.errorCode).toBe('TASK_FORBIDDEN');

  await acceptInvitation('owner', created.taskId, emailOf('other'), 'editor');
  const editorDeletes = await call('deleteTask', {
    variables: { id: created.taskId },
    token: stranger.token,
    note: 'now an accepted editor: attempts to delete the task anyway',
  });
  expect(editorDeletes.errorCode).toBe('TASK_FORBIDDEN');

  const unchanged = await findTask('owner', created.taskId);
  expect(unchanged).toEqual({ taskId: created.taskId, title, complete: false });
});

scenario(GROUP, 'ac.task.title.required.refuses-empty', async () => {
  const before = await listTasks('owner');
  const owner = await persona('owner');
  for (const title of ['', '   ', '\t']) {
    const observed = await call('createTask', {
      variables: { input: { title } },
      token: owner.token,
      note: `createTask with title ${JSON.stringify(title)}`,
    });
    expect(observed.errorCode).toBe('TASK_TITLE_REQUIRED');
    expect(observed.data).toBeNull();
  }
  const after = await listTasks('owner');
  expect(after.map((task) => task.taskId).sort()).toEqual(before.map((task) => task.taskId).sort());
});

assertImplemented(GROUP);
