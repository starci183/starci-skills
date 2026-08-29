import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { templatePath, validateReviewJson, validateReviewMarkdown } from './validate-review.mjs';
import { featureTemplatePath, validateFeatureJson, validateFeatureMarkdown } from './validate-feature.mjs';
import { validateResult } from './validate-result.mjs';

test('canonical review template exposes every required contract section', () => {
  const source = fs.readFileSync(templatePath, 'utf8');
  assert.deepEqual(validateReviewMarkdown(source), []);
});

test('feature index aggregates minimal-sufficient flows for user review', () => {
  const source = fs.readFileSync(featureTemplatePath, 'utf8');
  assert.deepEqual(validateFeatureMarkdown(source), []);
  const feature = {
    schemaVersion: 2,
    feature: 'authentication',
    objective: 'A member can establish and recover access.',
    owner: 'product-auth',
    sourceRevision: 'git:abc1234',
    authorityRevision: 'sha256:authority',
    flows: [{
      id: 'sign-in', distinctBy: ['business-outcome-terminal'], reviewRef: '.worktrees/uat/reviews/authentication/sign-in/review.md', status: 'active',
      happyCaseId: 'authentication.sign-in.happy', unhappyCaseCount: 2, selectedCaseCount: 3, delegatedPermutationCount: 6,
      exclusiveResourceRefs: [], openFindingRefs: [], suspenseQuestionRefs: [], userActionRefs: [], latestRunRefs: ['runs/run-1/result.json'], userFeedbackStatus: 'pending'
    }],
    sharedFixtureRefs: ['shared/fixtures.md'], sharedResourceRefs: ['shared/resources.md'], rootCauseRefs: [], feedbackRefs: [], suspenseQuestionRefs: [], userActionRefs: [], userFeedbackStatus: 'pending'
  };
  assert.deepEqual(validateFeatureJson(feature), []);
  feature.flows[0].reviewRef = '.uat/reviews/authentication/sign-in/review.md';
  assert.match(validateFeatureJson(feature).join('\n'), /reviewRef/);
  feature.flows[0].reviewRef = '.worktrees/uat/reviews/authentication/sign-in/review.md';
  feature.flows[0].selectedCaseCount = 9;
  assert.match(validateFeatureJson(feature).join('\n'), /one happy plus unhappyCaseCount/);
});

test('review machine contract rejects case inflation without distinct overflow reasons', () => {
  const unhappy = (index) => ({
    id: `auth.sign-in.unhappy-${index}`, class: 'unhappy', startState: 'form-ready', semanticOwner: 'auth', sideEffect: 'none', recoveryAction: `correct-${index}`, terminalState: 'authenticated', faultScope: `fault-${index}`, resourceClass: 'partitioned', delegatedProofRefs: []
  });
  const review = {
    schemaVersion: 2, feature: 'authentication', flow: 'sign-in', sourceRevision: 'git:abc1234', authorityRevision: 'sha256:authority',
    flowIdentity: { actorEntry: 'member at sign-in', businessOutcomeTerminal: 'authenticated dashboard', semanticOwnerSideEffect: 'auth owns session creation', recoveryTopology: 'correct or retry then success', distinctBy: ['business-outcome-terminal'] },
    coverage: { strategy: 'product-decision-branches', selectedCaseCount: 6, delegatedPermutationCount: 0, uncoveredTransitionCount: 0, delegationRefs: [], overflowReasons: [] },
    cases: [{ id: 'auth.sign-in.happy', class: 'happy', startState: 'form-ready', semanticOwner: 'auth', sideEffect: 'session-created', recoveryAction: 'n/a', terminalState: 'authenticated', faultScope: 'none', resourceClass: 'partitioned', delegatedProofRefs: [] }, ...Array.from({ length: 5 }, (_, index) => unhappy(index + 1))],
    resources: [], runs: [], findings: [], feedback: [], suspense: [], userActions: []
  };
  const errors = validateReviewJson(review);
  assert.match(errors.join('\n'), /every case beyond five requires/);
  review.coverage.overflowReasons = ['distinct concurrency recovery topology'];
  assert.deepEqual(validateReviewJson(review), []);
});

test('review machine contract rejects account reuse across case-runs', () => {
  const resource = (caseId, runId) => ({
    caseId, runId, executionOrder: Number(runId.slice(-1)), declaredBeforeExecute: true, declarationReceiptRef: `receipts/${runId}-declaration.json`, constraintPreflightReceiptRef: `receipts/${runId}-constraints.json`, precondition: 'fresh member fixture', expectedOutcome: 'authenticated dashboard', agent: `${runId}-agent`, accountProvisioning: 'fresh', account: 'shared-account', browserContext: `${runId}-context`, browserSessionRef: `browser://${runId}`, browserLeaseRef: `lease://${runId}`, browserProfileRefs: ['profiles/native-100'], origin: `http://${runId}.localhost`,
    fixtureNamespace: `${caseId}.${runId}`, artifactDirectory: `runs/${runId}/`, locks: [], cleanupSelector: { caseId, runId, isUat: true }
  });
  const review = {
    schemaVersion: 2, feature: 'authentication', flow: 'sign-in', sourceRevision: 'git:abc1234', authorityRevision: 'sha256:authority',
    flowIdentity: { actorEntry: 'member at sign-in', businessOutcomeTerminal: 'authenticated dashboard', semanticOwnerSideEffect: 'auth owns session creation', recoveryTopology: 'correct or retry then success', distinctBy: ['business-outcome-terminal'] },
    coverage: { strategy: 'product-decision-branches', selectedCaseCount: 1, delegatedPermutationCount: 0, uncoveredTransitionCount: 0, delegationRefs: [], overflowReasons: [] },
    cases: [{ id: 'auth.sign-in.happy', class: 'happy', startState: 'form-ready', semanticOwner: 'auth', sideEffect: 'session-created', recoveryAction: 'n/a', terminalState: 'authenticated', faultScope: 'none', resourceClass: 'partitioned', delegatedProofRefs: [] }],
    resources: [resource('auth.sign-in.happy', 'run-1'), resource('auth.sign-in.happy', 'run-2')], runs: [], findings: [], feedback: [], suspense: [], userActions: []
  };
  assert.match(validateReviewJson(review).join('\n'), /unique fresh account/);
});

test('review validator rejects screenshot-only and incomplete journals', () => {
  const errors = validateReviewMarkdown('# UAT Review\n\n![error](error.png)\n');
  assert.ok(errors.some((error) => error.includes('Flow graph and coverage')));
  assert.ok(errors.some((error) => error.includes('full-viewport')));
  assert.ok(errors.some((error) => error.includes('fixture lifecycle')));
});

const passingResult = () => ({
  schemaVersion: 2,
  runId: 'run-1',
  caseId: 'authentication.sign-in.happy',
  sourceRevision: 'git:abc1234',
  authorityRevision: 'sha256:authority',
  verdicts: { behavior: 'PASS', ux: 'PASS', ui: 'PASS' },
  uiAuthority: { uiPrinciples: 'PASS', grammar: 'PASS', conflict: false, evidenceRefs: ['authority/ui.json', 'authority/grammar.json'] },
  recoveryComplete: true,
  terminalProved: true,
  checkpoints: [
    { id: 'entry-wide', kind: 'entry', state: 'sign-in-ready', viewport: '1440x900', scaleMode: 'native', scalePercent: 100, assertion: 'Sign-in task is recognizable.', fullScreenshotRef: 'screenshots/01-entry.full.png', regionRefs: [], runtimeEvidenceRefs: ['dom/01-entry.json'] },
    { id: 'terminal-wide', kind: 'terminal', state: 'dashboard-ready', viewport: '1440x900', scaleMode: 'native', scalePercent: 100, assertion: 'Authenticated destination and account identity are visible.', fullScreenshotRef: 'screenshots/05-terminal.full.png', regionRefs: [], runtimeEvidenceRefs: ['dom/05-terminal.json', 'accessibility/05-terminal.json'] }
  ],
  resultVerification: { mode: 'read-only', queryRefs: ['queries/account-session.json'], mutationCount: 0 },
  fixture: { caseSelector: 'authentication.sign-in.happy', isUat: true, constraintPreflightReceiptRef: 'receipts/constraints.json', prepareReceiptRef: 'receipts/prepare.json', renderSeedRefs: ['fixtures/profile.json'], preparedBeforeExecute: true, executeReceiptRef: 'receipts/execute.json', verifyReceiptRef: 'receipts/verify.json', cleanupReceiptRef: 'receipts/cleanup.json', outcomeMutationAfterExecute: false },
  resources: { executionOrder: 1, declaredBeforeExecute: true, declarationReceiptRef: 'receipts/declaration.json', precondition: 'fresh member at sign-in', expectedOutcome: 'authenticated dashboard', accountProvisioning: 'fresh', account: 'authentication.sign-in.happy.run-1', accountProvisioningReceiptRef: 'receipts/account-provision.json', agent: 'agent-1', browserContext: 'context-1', browserSessionRef: 'browser://session/run-1', browserLeaseReceiptRef: 'receipts/browser-lease.json', origin: 'http://sign-in-happy.localhost', mailQueryNamespace: 'sign-in-happy', fixtureNamespace: 'sign-in-happy', artifactDirectory: 'runs/run-1', locks: ['partitioned:auth-db:sign-in-happy'] },
  findings: [],
  feedbackRefs: [],
  suspenseQuestions: [],
  userActions: [],
  overall: 'PASS'
});

test('result contract accepts read-only verified terminal proof', () => {
  assert.deepEqual(validateResult(passingResult()), { valid: true, errors: [] });
});

test('result contract requires declaration before visible Browser execution', () => {
  const value = passingResult();
  value.resources.declaredBeforeExecute = false;
  const result = validateResult(value);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /published before execute|declaredBeforeExecute/);
});

test('result contract rejects manufactured outcomes and screenshot-only error terminals', () => {
  const value = passingResult();
  value.fixture.outcomeMutationAfterExecute = true;
  value.checkpoints = value.checkpoints.filter((checkpoint) => checkpoint.kind !== 'terminal');
  const result = validateResult(value);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /outcomeMutationAfterExecute|terminal checkpoint/);
});

test('result contract does not let missing UI detail hide a Grammar failure', () => {
  const value = passingResult();
  value.verdicts.ui = 'SUSPENSE';
  value.uiAuthority = { uiPrinciples: 'SUSPENSE', grammar: 'FAIL', conflict: false, evidenceRefs: ['authority/ui-gap.json', 'authority/grammar-failure.json'] };
  value.suspenseQuestions = ['dashboard-rail-width'];
  value.overall = 'SUSPENSE';
  const result = validateResult(value);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /authority failure requires UI FAIL/);
});

test('Behavior and UX may pass while unresolved UI authority remains SUSPENSE', () => {
  const value = passingResult();
  value.verdicts.ui = 'SUSPENSE';
  value.uiAuthority = { uiPrinciples: 'SUSPENSE', grammar: 'PASS', conflict: false, evidenceRefs: ['authority/ui-gap.json', 'authority/grammar-pass.json'] };
  value.suspenseQuestions = ['dashboard-rail-detail'];
  value.overall = 'SUSPENSE';
  assert.deepEqual(validateResult(value), { valid: true, errors: [] });
});

test('login MFA pauses for user browser action and resumes the same leased case-run', () => {
  const paused = passingResult();
  paused.verdicts = { behavior: 'REQUIRE_USER_ACTION', ux: 'REQUIRE_USER_ACTION', ui: 'REQUIRE_USER_ACTION' };
  paused.recoveryComplete = false;
  paused.terminalProved = false;
  paused.checkpoints = [
    paused.checkpoints[0],
    { id: 'mfa-prompt', kind: 'feedback', state: 'external-approval-required', viewport: '1440x900', scaleMode: 'native', scalePercent: 100, assertion: 'The browser identifies the exact approval action without losing login context.', fullScreenshotRef: 'screenshots/03-mfa-prompt.full.png', regionRefs: [], runtimeEvidenceRefs: ['dom/03-mfa-prompt.json'] }
  ];
  paused.userActions = [{
    id: 'approve-login-mfa', reason: 'The registered authenticator requires direct user presence.', controlChannel: 'browser', controlRef: paused.resources.browserSessionRef,
    exactAction: 'Approve the login request in the leased browser session.', completionEvidence: 'The browser returns to the authenticated redirect.', resumeCommand: 'USER ACTION COMPLETE approve-login-mfa'
  }];
  paused.overall = 'REQUIRE_USER_ACTION';
  assert.deepEqual(validateResult(paused), { valid: true, errors: [] });

  const resumed = passingResult();
  assert.equal(resumed.runId, paused.runId);
  assert.equal(resumed.resources.account, paused.resources.account);
  assert.equal(resumed.resources.browserSessionRef, paused.resources.browserSessionRef);
  assert.deepEqual(validateResult(resumed), { valid: true, errors: [] });
});
