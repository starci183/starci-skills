'use strict';

/**
 * fr.login.sign-out - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- auth/sign-out
 *
 * Not run, by the registry: ac.login.session.restores.returning-within-the-window-stays-signed-in (no
 * public operation ages a session, so "signed in yesterday" cannot be created).
 */

const { call, signIn, forgetPersona, persona } = require('../../lib/client');
const { scenario, assertImplemented } = require('../../lib/scenario');
const { listTasks } = require('../../lib/fixtures');

const GROUP = 'auth/sign-out';
const DEMO = 'demo@todo.dev';
const DEMO_PASSWORD = 'todo-demo-pass';

scenario(GROUP, 'fr.login.sign-out.main-1', async () => {
  const session = await signIn(DEMO, DEMO_PASSWORD, 'sign in, then sign the same session out');
  const live = await call('listTasks', { token: session.token, note: 'tasks before sign-out, to show the session was live' });
  expect(live.errors).toBeNull();

  const out = await call('signOut', {
    variables: { input: { sessionToken: session.token } },
    note: 'signOut with that session token',
  });
  expect(out.errors).toBeNull();
  expect(out.data.signOut.signedOut).toBe(true);

  const after = await call('listTasks', { token: session.token, note: 'tasks after sign-out, with the same token' });
  expect(after.errorCode).toBe('SESSION_NOT_FOUND');
  expect(after.data).toBeNull();
});

scenario(GROUP, 'ac.login.session.single-device.second-sign-in-ends-the-first', async () => {
  forgetPersona('owner');
  forgetPersona('other');
  const first = await signIn(DEMO, DEMO_PASSWORD, 'signed in on the first device');
  const second = await signIn(DEMO, DEMO_PASSWORD, 'the same person signs in on another device');
  expect(second.personId).toBe(first.personId);

  const otherStillLive = await listTasks('other');
  expect(Array.isArray(otherStillLive)).toBe(true);

  const withFirst = await call('listTasks', { token: first.token, note: 'the first device reads the list again' });
  expect(withFirst.errorCode).toBe('SESSION_NOT_FOUND');
});

assertImplemented(GROUP);
