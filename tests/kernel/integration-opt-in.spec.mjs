import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { deferralOf, planLegDeferral, explicitAsksOf, opExplicitAskKind, deferReasonOf } from '../../scripts/route/spec-deferral.mjs';
import { explicitAsk } from '../../scripts/route/explicit-ask.mjs';

const skillRoot = path.resolve(import.meta.dirname, '..', '..');
const on = { unit: true, e2e: true };

test('integration.verify declares itself explicit-ask-only; other ops do not', () => {
  assert.equal(opExplicitAskKind({ skillRoot, op: 'integration.verify' }), 'integration');
  assert.equal(opExplicitAskKind({ skillRoot, op: 'e2e.verify' }), null);
  assert.equal(opExplicitAskKind({ skillRoot, op: 'backend.implement' }), null);
});

test('explicit asks read the archetypes phrase data, English and Vietnamese, negation cancels', () => {
  for (const yes of ['run the integration tests', 'kiểm thử tích hợp cho thanh toán', 'verify SMTP live', 'do a live verification of OAuth'])
    assert.equal(explicitAsk('integration', yes, { skillRoot }), true, yes);
  for (const no of ['integrate Google OAuth into the backend', 'build the sign-in feature', 'skip integration tests', 'không kiểm thử tích hợp'])
    assert.equal(explicitAsk('integration', no, { skillRoot }), false, no);
  assert.deepEqual(explicitAsksOf({ skillRoot, text: 'run the integration tests' }), ['integration']);
  assert.deepEqual(explicitAsksOf({ skillRoot, text: 'build it' }), []);
});

test('a leg without the stamp is deferred; a stamped or forced one runs; other ops are untouched', () => {
  const d = deferralOf({ skillRoot, op: 'integration.verify', payload: {}, settings: on });
  assert.equal(d.kind, 'integration');
  assert.equal(d.reason, deferReasonOf('integration'));
  assert.equal(deferralOf({ skillRoot, op: 'integration.verify', payload: { explicitAsk: ['integration'] }, settings: on }), null);
  assert.equal(deferralOf({ skillRoot, op: 'integration.verify', payload: { specsForced: { kind: 'integration' } }, settings: on }), null);
  assert.equal(deferralOf({ skillRoot, op: 'backend.implement', payload: {}, settings: on }), null);
});

test('a plan leg is deferred unless the approved goal text asks for it', () => {
  assert.equal(planLegDeferral({ skillRoot, op: 'integration.verify', settings: on, goalText: 'integrate Stripe payments' })?.kind, 'integration');
  assert.equal(planLegDeferral({ skillRoot, op: 'integration.verify', settings: on, goalText: null })?.kind, 'integration');
  assert.equal(planLegDeferral({ skillRoot, op: 'integration.verify', settings: on, goalText: 'integrate Stripe payments and run the integration tests' }), null);
  assert.equal(planLegDeferral({ skillRoot, op: 'review.verify', settings: on, goalText: null }), null);
});
