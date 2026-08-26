import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOutput } from './fe/interaction-container-decision/validate-output.mjs';

const session = 'session://tasks/task-1/';

function readyOutput() {
  return {
    schemaVersion: 6,
    runId: 'run-1',
    stage: 'ux.flow.review',
    status: 'pending',
    facts: ['ux-flow-ready', 'interaction-containers-modeled'],
    payload: {
      decision: 'containers-ready',
      state: {
        operator: 'fe/interaction-container-decision',
        status: 'pending',
        code: 'interaction-containers-ready',
        retryable: false,
        emits: {
          stage: 'ux.flow.review',
          status: 'pending',
          factsAdd: ['ux-flow-ready', 'interaction-containers-modeled'],
          factsRemove: []
        }
      },
      produced: { artifactRefs: [`${session}container-plan`], mutations: [], externalEffects: [] },
      context: { used: [{ kind: 'ux-flow', ref: `${session}ux-flow`, revision: 'sha256:flow' }] },
      cleanup: { scratchRefs: [`${session}scratch/containers`], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' },
      evidenceRefs: [`${session}evidence/container-comparison`],
      findings: [],
      artifact: {
        artifactType: 'frontend-interaction-container-plan',
        flowRef: `${session}ux-flow`,
        decisions: [{
          interactionId: 'submit-quiz',
          triggerRef: `${session}interaction/submit`,
          taskRole: 'bounded-decision',
          considered: ['page', 'modal', 'drawer', 'popover', 'inline'],
          selected: 'modal',
          rejections: [
            { container: 'page', reason: 'Submission is not a new durable destination.' },
            { container: 'drawer', reason: 'Background comparison is unnecessary.' },
            { container: 'popover', reason: 'The decision must block accidental continuation.' },
            { container: 'inline', reason: 'The confirmation requires focused interruption.' }
          ],
          decisionBasis: 'A short consequential confirmation must complete or cancel before the quiz continues.',
          behavior: {
            blocksBackground: true,
            preservesPageContext: false,
            mustCompleteOrCancel: true,
            urlOwned: false,
            resumable: false,
            comparisonRequired: false,
            stepCount: 1,
            longContent: false,
            stableInlineOwnerRef: null,
            focusReturnRef: `${session}trigger/submit`,
            dismissal: 'confirm-or-cancel'
          },
          responsive: {
            desktop: 'modal',
            mobile: 'fullscreen-modal',
            transformReason: 'The same bounded decision needs a safer constrained-viewport presentation.'
          }
        }],
        decisionHash: `sha256:${'a'.repeat(64)}`
      }
    }
  };
}

test('accepts a bounded modal after all five containers are compared', () => {
  assert.deepEqual(validateOutput(readyOutput()), { valid: true, errors: [] });
});

test('rejects a modal that contains resumable multi-step work', () => {
  const output = readyOutput();
  output.payload.artifact.decisions[0].behavior.resumable = true;
  output.payload.artifact.decisions[0].behavior.stepCount = 3;

  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /bounded blocking decision/);
});

test('rejects a container decision that does not reject every alternative', () => {
  const output = readyOutput();
  output.payload.artifact.decisions[0].rejections[3].container = 'page';

  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /every non-selected container/);
});

test('rejects a drawer without contextual preservation or mobile sheet behavior', () => {
  const output = readyOutput();
  const decision = output.payload.artifact.decisions[0];
  decision.taskRole = 'contextual-secondary';
  decision.selected = 'drawer';
  decision.rejections = [
    { container: 'page', reason: 'The work is secondary.' },
    { container: 'modal', reason: 'The background must remain available.' },
    { container: 'popover', reason: 'The content needs more room.' },
    { container: 'inline', reason: 'The page needs contextual expansion.' }
  ];
  decision.behavior.blocksBackground = false;
  decision.behavior.mustCompleteOrCancel = false;
  decision.behavior.preservesPageContext = false;
  decision.responsive.desktop = 'drawer';
  decision.responsive.mobile = 'popover';

  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /preserves the page/);
  assert.match(result.errors.join('\n'), /sheet or fullscreen/);
});
