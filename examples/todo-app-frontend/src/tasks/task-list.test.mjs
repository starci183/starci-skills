import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTaskList, STATES} from './task-list.mjs';

test('every state the ui record names has a branch here', () => {
  const produced = new Set([
    renderTaskList().state,
    renderTaskList({tasks: [{id: 't1', title: 'one'}]}).state,
    renderTaskList({tasks: [{id: 't1', title: 'one'}, {id: 't2', title: 'two'}]}).state,
    renderTaskList({refusal: 'not the owner'}).state
  ]);
  assert.deepEqual([...produced].sort(), [...STATES].sort());
});

test('an empty list explains what to do next instead of rendering nothing', () => {
  const view = renderTaskList();
  assert.equal(view.state, 'empty');
  assert.match(view.message, /first one/);
});

test('a refusal shows the reason and no rows', () => {
  const view = renderTaskList({tasks: [{id: 't1', title: 'one'}], refusal: 'not the owner'});
  assert.equal(view.state, 'refused');
  assert.deepEqual(view.rows, []);
});

