import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { asksFor, explicitAsk } from '../../scripts/route/explicit-ask.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ROUTE_PLAN = path.join(ROOT, 'scripts', 'route', 'route-plan.mjs');
const ops = text => {
  const r = spawnSync(process.execPath, [ROUTE_PLAN, '--text', text, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  return JSON.parse(r.stdout).legs.map(leg => leg.op);
};

const FEATURE = 'Build the authentication feature as an explicit test workflow. Deliver registration, login and forgot-password by email, the frontend flows and backend APIs, and Google and GitHub OAuth. Add and run the applicable automated tests, browser end-to-end tests and actual end-to-end email and OAuth integration verification.';
const SCAN = 'Current scan: the repository holds the canonical HFS app baseline: a package manifest, the be/ and fe/ sides, jest with 24 spec files and a Sonar declaration.';
const STATE_NEGATED = `${FEATURE}\n\n${SCAN} It has no authentication feature, no end-to-end test files, and no UAT, evidence or media records in .starciwork.`;
const STATE_PENDING = `${FEATURE}\n\n${SCAN} The authentication feature, its browser end-to-end tests, and its UAT, evidence and media records are all still to be built.`;

test('a clause or sentence that describes the repository is not an ask for a proof leg', () => {
  const phrases = { intent: ['uat', 'end-to-end test*'], negation: ['no', 'skip'], state: ['still to be'] };
  assert.equal(asksFor('Run UAT.', phrases), true);
  assert.equal(asksFor('Run browser end-to-end tests, then close.', phrases), true);
  assert.equal(asksFor('It has no authentication, no end-to-end test files, and no UAT records.', phrases), false);
  assert.equal(asksFor('Its UAT, evidence and media records are all still to be built.', phrases), false);
  assert.equal(asksFor('Skip UAT. Run the end-to-end tests.', phrases), true, 'a cue of one sentence does not reach the next');
  assert.equal(asksFor('Run the end-to-end tests, skip UAT', phrases), true, 'a cue of one clause does not reach the next');
  assert.equal(asksFor('Run the end-to-end tests, skip UAT', { ...phrases, intent: ['uat'] }), false);
  assert.equal(asksFor(null, phrases), false);
});

test('explicitAsk reads the archetypes.yaml cue sets for every kind', () => {
  assert.equal(explicitAsk('e2e', 'build it and run e2e tests'), true);
  assert.equal(explicitAsk('e2e', 'build it, skip e2e'), false);
  assert.equal(explicitAsk('uat', 'there is no UAT yet'), false);
  assert.equal(explicitAsk('uat', 'run UAT, no e2e'), true, 'a negated e2e does not cancel UAT');
  assert.equal(explicitAsk('e2e', 'run UAT, no e2e'), false);
  assert.equal(explicitAsk('integration', 'the integration tests are still to be written'), false);
  assert.equal(explicitAsk('integration', 'run the integration tests'), true);
  assert.equal(explicitAsk('integration', 'kh\u00f4ng ki\u1ec3m th\u1eed t\u00edch h\u1ee3p'), false);
});

test('the chain of one feature request is the same with and without a description of what the repository lacks', () => {
  const plain = ops(FEATURE);
  assert.ok(plain.includes('e2e.verify') && plain.includes('integration.verify'), 'the ask names browser end-to-end tests and live integration verification');
  assert.ok(!plain.includes('uat.verify'), 'no UAT is asked');
  assert.equal(plain.length, 15);
  assert.deepEqual(ops(STATE_NEGATED), plain, '"no end-to-end test files, no UAT" keeps e2e.verify');
  assert.deepEqual(ops(STATE_PENDING), plain, '"its UAT ... still to be built" adds no uat.verify');
});

test('an explicit request for either proof still selects its leg beside a description of the other', () => {
  const uat = ops(`${FEATURE} Run UAT in the browser.\n\n${SCAN} It has no end-to-end test files.`);
  assert.ok(uat.includes('uat.verify') && uat.includes('e2e.verify'));
  const none = ops('build the backend API for wishlist. There are no e2e tests and no UAT yet.');
  assert.ok(!none.includes('e2e.verify') && !none.includes('uat.verify'));
});
