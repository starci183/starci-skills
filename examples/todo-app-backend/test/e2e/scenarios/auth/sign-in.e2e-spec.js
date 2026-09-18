'use strict';

/**
 * fr.login.sign-in - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- auth/sign-in
 */

const { call, persona } = require('../../lib/client');
const { scenario, assertImplemented } = require('../../lib/scenario');
const { listTasks, uniqueTitle } = require('../../lib/fixtures');

const GROUP = 'auth/sign-in';
const DEMO = 'demo@todo.dev';
const DEMO_PASSWORD = 'todo-demo-pass';

/** One scenario per assertion; the assertion text lives in lib/registry.js, frozen before any effect. */

scenario(GROUP, 'fr.login.sign-in.main-1', async () => {
  const observed = await call('signIn', {
    variables: { input: { email: DEMO, password: DEMO_PASSWORD } },
    note: 'signIn with the correct pair',
  });
  expect(observed.errors).toBeNull();
  expect(observed.httpStatus).toBe(200);
  expect(typeof observed.data.signIn.sessionToken).toBe('string');
  expect(observed.data.signIn.sessionToken.length).toBeGreaterThan(0);
  // A person is Keycloak's subject for this identity: stable across sign-ins, never a bare email.
  expect(observed.data.signIn.personId).toBeTruthy();
  const again = await call('signIn', {
    variables: { input: { email: DEMO, password: DEMO_PASSWORD } },
    note: 'signIn again with the same correct pair',
  });
  expect(again.data.signIn.personId).toBe(observed.data.signIn.personId);
  expect(again.data.signIn.sessionToken).not.toBe(observed.data.signIn.sessionToken);

  const other = await call('signIn', {
    variables: { input: { email: 'demo2@todo.dev', password: 'todo-demo-pass-2' } },
    note: 'signIn as the other demo identity, to show the pair really is what decides',
  });
  expect(other.data.signIn.personId).not.toBe(observed.data.signIn.personId);

  const wrongPair = await call('signIn', {
    variables: { input: { email: DEMO, password: 'definitely-not-the-password' } },
    note: 'signIn with a wrong pair',
  });
  expect(wrongPair.errorCode).toBe('INVALID_CREDENTIALS');
});

scenario(GROUP, 'fr.login.sign-in.main-2', async () => {
  const session = await call('signIn', {
    variables: { input: { email: DEMO, password: DEMO_PASSWORD } },
    note: 'signIn, then land on the list that session grants',
  });
  const token = session.data.signIn.sessionToken;
  const title = uniqueTitle('sign-in-list');
  const created = await call('createTask', {
    variables: { input: { title } },
    token,
    note: 'createTask through the session this sign-in created',
  });
  expect(created.errorCode).toBeNull();
  const listed = await call('listTasks', { token, note: 'tasks with the session this sign-in created' });
  expect(listed.errors).toBeNull();
  expect(listed.data.tasks.map((task) => task.taskId)).toContain(created.data.createTask.taskId);
  expect(listed.data.tasks.find((task) => task.taskId === created.data.createTask.taskId).title).toBe(title);

  const stranger = await persona('other');
  const strangerList = await call('listTasks', { token: stranger.token, note: "tasks as the other person, to show the list is the signer's own" });
  expect(strangerList.data.tasks.map((task) => task.taskId)).not.toContain(created.data.createTask.taskId);
});

scenario(GROUP, 'fr.login.sign-in.exception-1', async () => {
  const observed = await call('signIn', {
    variables: { input: { email: DEMO, password: 'wrong-on-purpose' } },
    note: 'signIn with a wrong pair',
  });
  expect(observed.errorCode).toBe('INVALID_CREDENTIALS');
  const message = observed.errorMessage ?? '';
  // "without naming which half was wrong": a refusal may name both halves or neither, but it must not
  // single one out - no "unknown email", no "wrong password".
  expect(message).not.toMatch(/unknown|not found|no such|does ?n['’]?t exist|unregistered|no account/i);
  expect(message).not.toMatch(/(wrong|incorrect|invalid|bad) (password|passphrase)/i);
  expect(observed.data).toBeNull();
});

scenario(GROUP, 'fr.login.sign-in.post-1', async () => {
  const first = await call('signIn', {
    variables: { input: { email: DEMO, password: DEMO_PASSWORD } },
    note: 'first sign-in',
  });
  const second = await call('signIn', {
    variables: { input: { email: DEMO, password: DEMO_PASSWORD } },
    note: 'second sign-in for the same person',
  });
  expect(second.data.signIn.sessionToken).toBeTruthy();
  const withFirst = await call('listTasks', { token: first.data.signIn.sessionToken, note: 'read the list with the FIRST session token' });
  expect(withFirst.errorCode).toBe('SESSION_NOT_FOUND');
});

scenario(GROUP, 'ac.login.password.sign-in.wrong-pair-is-refused', async () => {
  const before = await listTasks('owner');
  const observed = await call('signIn', {
    variables: { input: { email: DEMO, password: 'the-wrong-half-only' } },
    note: 'signIn: known email, wrong password',
  });
  expect(observed.errorCode).toBe('INVALID_CREDENTIALS');
  expect(observed.data).toBeNull();
  const after = await listTasks('owner');
  expect(after.map((task) => task.taskId)).toEqual(before.map((task) => task.taskId));
});

scenario(GROUP, 'ac.login.password.sign-in.refusal-does-not-name-the-half', async () => {
  const unknownEmail = await call('signIn', {
    variables: { input: { email: `nobody-${Date.now()}@todo.dev`, password: 'whatever' } },
    note: 'signIn with an unknown email',
  });
  const wrongPassword = await call('signIn', {
    variables: { input: { email: DEMO, password: 'whatever' } },
    note: 'signIn with a known email and a wrong password',
  });
  expect(unknownEmail.errorCode).toBe('INVALID_CREDENTIALS');
  expect(wrongPassword.errorCode).toBe('INVALID_CREDENTIALS');
  expect(unknownEmail.httpStatus).toBe(wrongPassword.httpStatus);
  expect(unknownEmail.errorMessage).toBe(wrongPassword.errorMessage);
  expect(JSON.stringify(unknownEmail.errors)).toBe(JSON.stringify(wrongPassword.errors));
});

// ac.login.session.restores.returning-within-the-window-stays-signed-in has no scenario body: the
// registry marks it not-run, and the harness fails that assertion loudly with its recorded reason.

assertImplemented(GROUP);
