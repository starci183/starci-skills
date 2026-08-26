import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOutput } from './fe/product-uat/validate-output.mjs';

const session = 'session://tasks/task-1/';

function passedOutput() {
  return {
    schemaVersion: 6,
    runId: 'run-1',
    stage: 'product.uat.result',
    status: 'passed',
    facts: ['product-uat-passed'],
    payload: {
      decision: 'passed',
      state: {
        operator: 'fe/product-uat', status: 'passed', code: 'product-uat-passed', retryable: false,
        emits: { stage: 'product.uat.result', status: 'passed', factsAdd: ['product-uat-passed'], factsRemove: [] }
      },
      produced: { artifactRefs: [`${session}uat-report`], mutations: [], externalEffects: [] },
      context: { used: [{ kind: 'running-app', ref: 'http://localhost:3000', revision: 'git:abcdef1' }] },
      cleanup: { scratchRefs: [`${session}scratch/uat`], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' },
      evidenceRefs: [`${session}evidence/viewport`, `${session}evidence/dom`],
      findings: [],
      artifact: {
        artifactType: 'product-uat-report',
        journeyCoverage: [{ stepId: 'review-card', status: 'passed', evidenceRef: `${session}evidence/viewport` }],
        semanticChecks: [
          { kind: 'grammar-object', claim: 'Session facts use SurfaceListCard', variant: 'populated', status: 'passed', evidenceRef: `${session}evidence/dom` },
          { kind: 'semantic-content', claim: 'Answer body contains resolved content', variant: 'entitled', status: 'passed', evidenceRef: `${session}evidence/dom` },
          { kind: 'interaction-container', claim: 'Submission confirmation uses the approved modal and returns focus', variant: 'desktop-mobile', status: 'passed', evidenceRef: `${session}evidence/viewport` },
          { kind: 'state-mapping', claim: 'Question legend distinguishes every state', variant: 'answered-current-future', status: 'passed', evidenceRef: `${session}evidence/viewport` }
        ],
        outcomeStatus: 'proved',
        issues: [],
        potentialSignals: [],
        resolutionRequestRefs: []
      }
    }
  };
}

test('product UAT passes only with exact Grammar-object and semantic-content evidence', () => {
  assert.deepEqual(validateOutput(passedOutput()), { valid: true, errors: [] });
});

test('product UAT rejects surface-count evidence that omits exact Grammar identity', () => {
  const output = passedOutput();
  output.payload.artifact.semanticChecks = output.payload.artifact.semanticChecks.filter((check) => check.kind !== 'grammar-object');

  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /Grammar-object/);
});

test('product UAT rejects state labels whose visual mapping failed', () => {
  const output = passedOutput();
  const stateMapping = output.payload.artifact.semanticChecks.find((check) => check.kind === 'state-mapping');
  stateMapping.status = 'failed';

  assert.equal(validateOutput(output).valid, false);
});

test('product UAT rejects a pass without interaction-container fidelity', () => {
  const output = passedOutput();
  output.payload.artifact.semanticChecks = output.payload.artifact.semanticChecks.filter((check) => check.kind !== 'interaction-container');

  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /passed requires proved outcome/);
});

test('product UAT routes hard UX/UI failures away from generic repair', () => {
  const output = passedOutput();
  output.status = 'repair';
  output.facts = ['product-uat-failed'];
  output.payload.decision = 'repair';
  output.payload.state.status = 'repair';
  output.payload.state.code = 'product-uat-repair';
  output.payload.state.emits.status = 'repair';
  output.payload.state.emits.factsAdd = ['product-uat-failed'];
  output.payload.artifact.outcomeStatus = 'failed';
  output.payload.artifact.issues = [{ domain: 'ux-ui', ownerCapability: 'frontend.ui-detail', severity: 'hard', evidenceRef: `${session}evidence/viewport` }];

  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /ux-ui-repair/);
});
