import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from './workspace/workflow-handoff/validate-input.mjs';
import { validateOutput } from './workspace/workflow-handoff/validate-output.mjs';

const sha = `sha256:${'a'.repeat(64)}`;
const taskRef = (name) => `session://tasks/task-1/${name}`;
const artifact = (ref) => ({ ref, revision: sha, loadMode: 'session-exact' });

function publishInput() {
  const route = taskRef('route');
  const approval = taskRef('approval');
  const checkout = taskRef('checkout-fe');
  return {
    schemaVersion: 6,
    runId: 'run-1',
    stage: 'workspace.workflow-handoff',
    status: 'ready',
    facts: ['workspace-route-ready', 'workflow-handoff-explicitly-authorized'],
    payload: {
      provided: {
        mode: 'publish',
        routeReceiptRef: route,
        approvalRef: approval,
        missionId: 'interview-redesign',
        checkpointTag: null,
        resumeCapability: 'starci-frontend-ui-direction',
        resumeStage: 'ui.direction.generate',
        durableArtifactRefs: ['request:starci-academy/interview-redesign'],
        touchedCheckoutRefs: [checkout]
      },
      loads: {
        artifacts: [artifact(route), artifact(approval), artifact(checkout)],
        knowledge: [],
        orchestration: {
          mode: 'economical',
          profileRef: 'orchestration/modes/economical.json',
          providerRef: 'orchestration/providers/openai.json'
        }
      },
      session: {
        taskId: 'task-1',
        inputRef: taskRef('input'),
        outputRef: taskRef('output'),
        scratchPrefix: taskRef('scratch'),
        retention: 'until-skill-terminal'
      }
    }
  };
}

function completedOutput(decision = 'published') {
  const resumed = decision === 'resumed';
  return {
    schemaVersion: 6,
    runId: 'run-1',
    stage: 'workspace.workflow-handoff.result',
    status: 'complete',
    facts: [resumed ? 'workflow-checkpoint-resumed' : 'workflow-checkpoint-published'],
    payload: {
      decision,
      state: {
        operator: 'workspace/workflow-handoff',
        status: 'completed',
        code: resumed ? 'workspace-workflow-handoff-resumed' : 'workspace-workflow-handoff-published',
        retryable: false,
        emits: {
          stage: 'workspace.workflow-handoff.result',
          status: 'complete',
          factsAdd: [resumed ? 'workflow-checkpoint-resumed' : 'workflow-checkpoint-published']
        }
      },
      produced: {
        checkpointTag: 'starci-workflow/interview-redesign/20260826-1',
        sourcePushRefs: [taskRef('git-head')],
        resumeCapability: 'starci-frontend-ui-direction',
        resumeStage: 'ui.direction.generate',
        resumeReceiptRef: taskRef('resume'),
        durableWrites: ['checkpoint branch', 'annotated continuation tag']
      },
      context: {
        used: [{ kind: 'git-ref', ref: 'refs/tags/starci-workflow/interview-redesign/20260826-1', revision: sha }]
      },
      cleanup: {
        scratchRefs: [taskRef('scratch')],
        retention: 'until-skill-terminal',
        purgeAt: 'skill-terminal'
      },
      evidenceRefs: [taskRef('proof')],
      findings: []
    }
  };
}

test('accepts a minimal publish checkpoint without conversational context', () => {
  assert.equal(validateInput(publishInput()).valid, true);
});

test('rejects session-only artifacts from the portable continuation manifest', () => {
  const input = publishInput();
  input.payload.provided.durableArtifactRefs = [taskRef('design')];
  assert.equal(validateInput(input).valid, false);
});

test('accepts published and resumed outcomes only when state agrees', () => {
  assert.equal(validateOutput(completedOutput('published')).valid, true);
  assert.equal(validateOutput(completedOutput('resumed')).valid, true);
  const drifted = completedOutput('published');
  drifted.payload.state.code = 'workspace-workflow-handoff-resumed';
  assert.equal(validateOutput(drifted).valid, false);
});
