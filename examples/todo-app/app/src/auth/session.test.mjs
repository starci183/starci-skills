import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionStore} from './session.mjs';

test('t-accept writes one row and actorOf returns its person', () => {
  const store = createSessionStore();
  store.accept({token: 'a', personId: 'p1'});
  assert.deepEqual(store.actorOf('a'), {personId: 'p1'});
  assert.equal(store.size(), 1);
});

test('actor-of-a-live-session-is-the-person', () => {
  const store = createSessionStore();
  store.accept({token: 'a', personId: 'p1'});
  assert.equal(store.actorOf('a').personId, 'p1');
});

test('actor-of-no-session-is-null-not-a-throw', () => {
  const store = createSessionStore();
  assert.equal(store.actorOf('missing'), null);
  assert.equal(store.actorOf(undefined), null);
});

test('t-expire refuses a read past the window and forgets the row', () => {
  let clock = 0;
  const store = createSessionStore({now: () => clock});
  store.accept({token: 'a', personId: 'p1'});
  clock = 31 * 24 * 60 * 60 * 1000;
  assert.equal(store.actorOf('a'), null);
  assert.equal(store.size(), 0, 'the expired row left on the way out');
});

test('t-revoke deletes the row and the next read finds nothing', () => {
  const store = createSessionStore();
  store.accept({token: 'a', personId: 'p1'});
  assert.equal(store.revoke('a'), true);
  assert.equal(store.actorOf('a'), null);
});

