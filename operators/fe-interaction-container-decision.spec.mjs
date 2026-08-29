import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput } from './fe/interaction-container-decision/validate-input.mjs';
import { validateOutput } from './fe/interaction-container-decision/validate-output.mjs';

const input = () => ({ schemaVersion: 7, operatorId: 'fe/interaction-container-decision', context: { evidenceRefs: ['flow://approved'], authorityRevision: 'sha256:flow' }, input: { targetRef: 'interaction://submit-quiz', constraints: ['compare page, modal, drawer, popover, and inline', 'preserve responsive behavior and focus return'] } });
const output = () => ({ schemaVersion: 7, operatorId: 'fe/interaction-container-decision', output: { outcome: 'containers-ready', result: { summary: 'Modal selected for one bounded consequential decision after comparing all five containers.', artifactRefs: ['artifact://container-plan'] }, gaps: [], evidenceRefs: ['flow://approved', 'evidence://container-comparison'] } });

test('accepts one evidence-bound interaction-container decision', () => {
  assert.deepEqual(validateInput(input()), { valid: true, errors: [] });
  assert.deepEqual(validateOutput(output()), { valid: true, errors: [] });
});
test('rejects workflow routing fields and unrecognized semantic outcomes', () => {
  const routed = input(); routed.stage = 'ux.flow.review';
  assert.equal(validateInput(routed).valid, false);
  const invalid = output(); invalid.output.outcome = 'interaction-containers-ready';
  assert.equal(validateOutput(invalid).valid, false);
});
