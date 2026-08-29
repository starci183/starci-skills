import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput } from './fe/product-uat/validate-input.mjs';
import { validateOutput } from './fe/product-uat/validate-output.mjs';
const input = () => ({ schemaVersion: 7, operatorId: 'fe/product-uat', context: { evidenceRefs: ['.worktrees/uat/reviews/learning/session/review.md', 'receipt://behavior', 'receipt://ux', 'receipt://ui'], authorityRevision: 'git:abcdef1' }, input: { targetRef: 'uat-case://learning.session.happy', constraints: ['read-only result verification', 'exact Grammar-object identity', 'interaction-container fidelity', 'state mapping'] } });
const output = (outcome = 'passed') => ({ schemaVersion: 7, operatorId: 'fe/product-uat', output: { outcome, result: { summary: 'Case proved through Behavior, UX, and UI evidence with scoped cleanup.', artifactRefs: ['.worktrees/uat/runs/learning.session.happy.json'] }, gaps: [], evidenceRefs: ['evidence://viewport', 'evidence://dom'] } });
test('accepts canonical backend UAT authority and a proved semantic outcome', () => { assert.deepEqual(validateInput(input()), { valid: true, errors: [] }); assert.deepEqual(validateOutput(output()), { valid: true, errors: [] }); });
test('rejects legacy envelopes and preserves hard UX/UI repair as typed data', () => { const legacy = input(); legacy.stage = 'product.uat'; assert.equal(validateInput(legacy).valid, false); assert.deepEqual(validateOutput(output('ux-ui-repair')), { valid: true, errors: [] }); assert.equal(validateOutput(output('generic-repair')).valid, false); });
