import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSignIn, REFUSAL} from './sign-in-form.mjs';

test('the four states of the ui record are reachable', () => {
  assert.equal(renderSignIn().state, 'empty');
  assert.equal(renderSignIn({email: 'a@b.c'}).state, 'filled');
  assert.equal(renderSignIn({submitting: true}).state, 'working');
  assert.equal(renderSignIn({refused: true}).state, 'refused');
});

test('the refusal does not say which half was wrong', () => {
  assert.equal(renderSignIn({refused: true}).message, REFUSAL);
  assert.doesNotMatch(REFUSAL, /email (is )?(unknown|not found)/i);
  assert.doesNotMatch(REFUSAL, /wrong password/i);
});

test('submit stays disabled until both fields carry something', () => {
  assert.equal(renderSignIn({email: 'a@b.c'}).disabled, true);
  assert.equal(renderSignIn({email: 'a@b.c', password: 'x'}).disabled, false);
});

