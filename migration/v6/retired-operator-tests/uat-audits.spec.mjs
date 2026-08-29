import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput as validateBehaviorInput } from './test/behavior-audit/validate-input.mjs';
import { validateInput as validateFlowInput } from './test/flow-coverage-audit/validate-input.mjs';
import { validateOutput as validateFlowOutput } from './test/flow-coverage-audit/validate-output.mjs';
import { validateOutput as validateBehaviorOutput } from './test/behavior-audit/validate-output.mjs';
import { validateInput as validateUiInput } from './test/ui-audit/validate-input.mjs';
import { validateOutput as validateUiOutput } from './test/ui-audit/validate-output.mjs';
import { validateInput as validateUxInput } from './test/ux-audit/validate-input.mjs';
import { validateOutput as validateUxOutput } from './test/ux-audit/validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const baseInput = (operatorId, caseRefs = ['authentication.sign-in.happy']) => ({
  schemaVersion: 7,
  operatorId,
  context: {
    featureIndexRef: '.worktrees/uat/reviews/authentication/INDEX.md',
    reviewRef: '.worktrees/uat/reviews/authentication/sign-in/review.md',
    siblingFlowRefs: ['.worktrees/uat/reviews/authentication/password-reset/review.md'],
    knowledgeRefs: ['knowledge/uat-protocol.md'],
    sourceRefs: ['git:abc1234']
  },
  input: {
    project: 'starci-academy',
    flowId: 'authentication.sign-in',
    caseRefs,
    sourceRevision: 'git:abc1234',
    authorityRevision: hash,
    runtimeRef: 'http://sign-in-happy.localhost',
    fixturePlanRef: 'artifact://fixtures/sign-in',
    resourcePlanRef: 'artifact://resources/sign-in'
  }
});

const caseResult = () => ({
  caseId: 'authentication.sign-in.happy',
  executionOrder: 1,
  declaredBeforeExecute: true,
  browserRef: 'browser://run-1',
  accountProvisioning: 'fresh-isolated',
  accountRef: 'authentication.sign-in.happy.run-1',
  result: 'passed',
  recoveryComplete: true,
  terminalProved: true,
  evidenceRefs: ['evidence://terminal']
});

const auditOutput = (lens = 'ui', outcome = 'passed') => ({
  schemaVersion: 7,
  operatorId: `test/${lens}-audit`,
  output: {
    outcome,
    resultRef: 'artifact://uat/report',
    evidenceRefs: ['evidence://terminal'],
    findings: [],
    caseResults: [caseResult()],
    coverageSummary: lens === 'flow-coverage' ? { selectedCaseCount: 1, delegatedPermutationCount: 2, uncoveredTransitionCount: 0, delegationRefs: ['test://component/validation'], overflowReasons: [], mergeCandidateRefs: [] } : null,
    suspenseQuestions: [],
    userActions: [],
    authorityVerdicts: lens === 'ui' ? { uiPrinciples: 'passed', grammar: 'passed', conflict: false, evidenceRefs: ['evidence://ui', 'evidence://grammar'] } : null,
    reason: null
  }
});

test('flow compiler requires a separate canonical happy case', () => {
  assert.equal(validateFlowInput(baseInput('test/flow-coverage-audit', ['authentication.sign-in.happy', 'authentication.sign-in.wrong-password'])).valid, true);
  const result = validateFlowInput(baseInput('test/flow-coverage-audit', ['authentication.sign-in.invalid-credentials']));
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /happy case/);
});

test('all UAT inputs require canonical backend Source authority and reject checkout-local legacy refs', () => {
  for (const [validate, id] of [[validateFlowInput,'test/flow-coverage-audit'],[validateBehaviorInput,'test/behavior-audit'],[validateUxInput,'test/ux-audit'],[validateUiInput,'test/ui-audit']]) {
    assert.deepEqual(validate(baseInput(id)), { valid: true, errors: [] });
    const legacy = baseInput(id);
    legacy.context.featureIndexRef = '.uat/reviews/authentication/INDEX.md';
    legacy.context.reviewRef = '.uat/reviews/authentication/sign-in/review.md';
    assert.equal(validate(legacy).valid, false);
  }
});

test('flow readiness rejects uncovered transitions and equivalent sibling inflation', () => {
  const output = auditOutput('flow-coverage', 'ready');
  output.output.coverageSummary.uncoveredTransitionCount = 1;
  output.output.coverageSummary.mergeCandidateRefs = ['.worktrees/uat/reviews/authentication/sign-in-email/review.md'];
  const result = validateFlowOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /zero uncovered transitions and zero equivalent sibling/);
});

test('require-user-action requires one exact resumable action and is not pass', () => {
  const output = auditOutput('ux', 'require-user-action');
  assert.match(validateUxOutput(output).errors.join('\n'), /requires an exact action/);
  output.output.userActions = [{ id:'confirm-external-login', reason:'External identity approval is user controlled.', controlRef:'browser://run-1', exactAction:'Approve the sign-in prompt on the registered device.', completionEvidence:'Browser shows approval.', resumeCommand:'USER ACTION COMPLETE confirm-external-login' }];
  assert.deepEqual(validateUxOutput(output), { valid: true, errors: [] });
});

test('UI suspense requires a finite authority question and owner', () => {
  const output = auditOutput('ui', 'suspense');
  output.output.authorityVerdicts.uiPrinciples = 'suspense';
  assert.equal(validateUiOutput(output).valid, false);
  output.output.suspenseQuestions = [{ id:'ui-question-1', situation:'sign-in/error/compact', authoritiesChecked:['fe.ui','grammar.common'], question:'Should recovery remain inline?', owner:'fe.ui' }];
  assert.deepEqual(validateUiOutput(output), { valid: true, errors: [] });
});

test('UI failure dominance prevents suspense from hiding Grammar failure', () => {
  const output = auditOutput('ui', 'suspense');
  output.output.authorityVerdicts = { uiPrinciples:'suspense', grammar:'failed', conflict:false, evidenceRefs:['evidence://ui','evidence://grammar'] };
  output.output.suspenseQuestions = [{ id:'q', situation:'dashboard/wide', authoritiesChecked:['fe.ui','grammar.common'], question:'How wide should the rail be?', owner:'fe.ui' }];
  const result = validateUiOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authority failure requires failed UI verdict/);
});

test('UX cannot borrow the UI suspense outcome', () => {
  const output = auditOutput('ux', 'passed');
  output.output.outcome = 'suspense';
  assert.equal(validateUxOutput(output).valid, false);
});

test('success requires terminal proof, fresh isolated accounts, and rejects hard findings', () => {
  const output = auditOutput();
  output.output.caseResults[0].terminalProved = false;
  output.output.caseResults[0].accountProvisioning = 'reused';
  output.output.findings.push({ id:'ui-1', severity:'hard', claim:'terminal action is obscured', evidenceRefs:['evidence://terminal'] });
  const result = validateUiOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /terminal proof|fresh isolated|fresh-isolated/);
});

test('case execution rejects undeclared or non-contiguous visible Browser order', () => {
  const undeclared = auditOutput();
  undeclared.output.caseResults[0].declaredBeforeExecute = false;
  assert.match(validateUiOutput(undeclared).errors.join('\n'), /declaredBeforeExecute|declared before execute/);
  const outOfOrder = auditOutput();
  outOfOrder.output.caseResults[0].executionOrder = 2;
  assert.match(validateUiOutput(outOfOrder).errors.join('\n'), /contiguous from 1/);
});

test('behavior audit rejects fixture finalization that could manufacture success', () => {
  const output = auditOutput('behavior', 'passed');
  output.output.findings.push({ id:'behavior-1', severity:'hard', claim:'post-journey fixture finalization mutation manufactured the result', evidenceRefs:['evidence://fixture-write'] });
  assert.match(validateBehaviorOutput(output).errors.join('\n'), /read-only|manufacture/);
});
