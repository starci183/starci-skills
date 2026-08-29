import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput as validateUxFlowInput } from './fe/ux-flow/validate-input.mjs';
import { validateOutput as validateUxFlowOutput } from './fe/ux-flow/validate-output.mjs';

const uxInput = () => ({
  schemaVersion: 7,
  operatorId: 'fe/ux-flow',
  context: {
    projectRoute: {
      project: 'starci-academy',
      backendRouteRef: '.workspaces/projects/starci-academy/be.json',
      backendSourceRevision: 'git:abc1234'
    },
    businessHead: {
      ref: '.worktrees/businesses/features/progress-profile/surfaces/learning-dashboard.md',
      revision: 'git:def5678',
      outcome: 'A learner understands progress and chooses the next useful action.',
      constraints: ['Never invent progress.', 'Preserve entitlement boundaries.']
    },
    journeyEvidence: [{ ref: 'evidence://dashboard-entry', revision: 'sha256:entry', claim: 'Learner enters from the signed-in home.' }],
    uxLaws: [
      { id: 'fe.customer-journey', ref: 'knowledge/fe-customer-journey.md', revision: 'sha256:journey' },
      { id: 'fe.state-modeling', ref: 'knowledge/fe-state-modeling.md', revision: 'sha256:state' }
    ]
  },
  input: {
    targetOutcome: 'A learner understands progress and chooses the next useful action.',
    actor: 'learner',
    entryCondition: 'signed-in dashboard entry',
    surfaceSet: ['learning-dashboard'],
    continuityRequirements: ['validation', 'failure', 'recovery', 'refresh', 'resume', 'async']
  }
});

const uxOutput = () => ({
  schemaVersion: 7,
  operatorId: 'fe/ux-flow',
  output: {
    outcome: 'modeled',
    uxFlowGraph: {
      flowId: 'learning-dashboard',
      primaryTask: 'Understand progress and choose the next action.',
      nodes: [
        { id: 'entry', kind: 'entry', userGoal: 'Recognize current learning state.', surfaceRef: 'learning-dashboard', observableState: 'summary ready' },
        { id: 'result', kind: 'result', userGoal: 'Start the selected next action.', surfaceRef: 'learning-dashboard', observableState: 'next action opened' }
      ],
      transitions: [{ from: 'entry', event: 'choose-next-action', to: 'result', userFeedback: 'Selection is visible.', sideEffect: 'approved navigation only' }],
      recoveryPaths: [{ failureNode: 'entry', recoveryAction: 'retry progress load', resumeNode: 'entry', terminalNode: 'result' }],
      continuityCoverage: ['validation', 'failure', 'recovery', 'refresh', 'resume', 'async']
    },
    gaps: [],
    evidenceRefs: ['.worktrees/businesses/features/progress-profile/surfaces/learning-dashboard.md', 'evidence://dashboard-entry']
  }
});

test('UX synthesis accepts one routed business + journey + laws contract', () => {
  assert.deepEqual(validateUxFlowInput(uxInput()), { valid: true, errors: [] });
  assert.deepEqual(validateUxFlowOutput(uxOutput()), { valid: true, errors: [] });
});

test('UX synthesis rejects route drift and partial ready graphs', () => {
  const input = uxInput();
  input.context.projectRoute.project = 'another-project';
  assert.match(validateUxFlowInput(input).errors.join('\n'), /project must match/);

  const output = uxOutput();
  output.output.gaps = ['missing recovery authority'];
  assert.match(validateUxFlowOutput(output).errors.join('\n'), /zero authority gaps/);
});
