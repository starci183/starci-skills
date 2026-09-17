import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskStore, guardOwnership} from './ownership.mjs';

const owner = {personId: 'p1'};
const stranger = {personId: 'p2'};

test('t-owner lets the owner through', () => {
  assert.deepEqual(guardOwnership({actor: owner, task: {owner: 'p1'}}), {allowed: true, transition: 't-owner'});
});

test('t-stranger refuses before anything is written', () => {
  const store = createTaskStore();
  const {task} = store.create({actor: owner, title: 'read the layout'});
  const refused = store.remove({actor: stranger, id: task.id});
  assert.equal(refused.ok, false);
  assert.deepEqual(store.get(task.id), task, 'the task is unchanged');
});

test('consumer-refuses-on-null-instead-of-inventing', () => {
  const store = createTaskStore();
  assert.deepEqual(store.create({actor: null, title: 'x'}), {ok: false, reason: 'unauthenticated'});
  assert.deepEqual(guardOwnership({actor: null, task: {owner: 'p1'}}),
    {allowed: false, reason: 'unauthenticated'});
});

test('a task without a title does not exist', () => {
  const store = createTaskStore();
  assert.equal(store.create({actor: owner, title: '   '}).ok, false);
  assert.equal(store.listFor('p1').length, 0, 'nothing was written');
});

test('a list shows only the reader own tasks', () => {
  const store = createTaskStore();
  store.create({actor: owner, title: 'mine'});
  store.create({actor: stranger, title: 'theirs'});
  assert.deepEqual(store.listFor('p1').map(row => row.title), ['mine']);
});

