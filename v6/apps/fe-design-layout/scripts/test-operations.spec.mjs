import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput as validateUnitInput } from '../../../operations/test/unit/validate-input.mjs';
import { validateOutput as validateUnitOutput } from '../../../operations/test/unit/validate-output.mjs';
import { validateInput as validateE2eInput } from '../../../operations/test/e2e/validate-input.mjs';
import { validateOutput as validateE2eOutput } from '../../../operations/test/e2e/validate-output.mjs';
import { validateInput as validateUiInput } from '../../../operations/test/ui/validate-input.mjs';
import { validateOutput as validateUiOutput } from '../../../operations/test/ui/validate-output.mjs';

const envelope = (kind, stage, status, facts, payload) => ({
  kind, schemaVersion: 6, appId: 'fe-design-layout', runId: 'test-run', stage, status, facts, payload
});

const unitInput = envelope('test.unit.input', 'test.unit', 'ready', ['seed-evidence'], {
  workspaceRouteRef: 'route:fe', sourceRole: 'fe', sourceReferenceRef: 'starci-academy-fe', manifestRefs: ['package.json'],
  changeSetRef: 'changes:1', changeSetHash: 'hash:changes', targetRefs: ['src/example.spec.ts'], evidenceRoot: '.worktrees/run/evidence'
});
const unitOutput = envelope('test.unit.output', 'test.e2e', 'ready', ['seed-evidence', 'unit-pass', 'unit-evidence'], {
  unitEvidenceRef: 'evidence:unit', unitEvidenceHash: 'hash:unit',
  commandReceipts: [{ commandRef: 'command:test-unit', status: 'pass', selected: 2, passed: 2, failed: 0, skipped: 0, evidenceRef: 'log:unit' }],
  selected: 2, passed: 2, failed: 0, skipped: 0, failedTargetRefs: [], stopReasons: []
});
const e2eInput = envelope('test.e2e.input', 'test.e2e', 'ready', ['seed-evidence', 'unit-pass', 'unit-evidence'], {
  workspaceRouteRefs: { fe: 'route:fe', be: 'route:be' }, sourceReferenceRefs: ['starci-academy-fe', 'starci-academy-be'],
  manifestRefs: ['fe/package.json', 'be/package.json'], selectedFlowRef: 'flow:approved', selectedFlowHash: 'hash:flow',
  seedEvidenceRef: 'evidence:seed', seedEvidenceHash: 'hash:seed', scenarioRefs: ['scenario:create'], environmentRef: 'env:test',
  credentialProviderRef: 'provider:test-account', evidenceRoot: '.worktrees/run/evidence'
});
const e2eOutput = envelope('test.e2e.output', 'test.ui', 'ready', ['seed-evidence', 'unit-pass', 'unit-evidence', 'e2e-pass', 'e2e-evidence'], {
  e2eEvidenceRef: 'evidence:e2e', e2eEvidenceHash: 'hash:e2e',
  scenarioReceipts: [{ scenarioId: 'create', setupRef: 'seed:create', actionRef: 'api:create', observableRef: 'db:vps', resetRef: 'reset:create', status: 'pass', evidenceRefs: ['log:e2e'] }],
  selected: 1, passed: 1, failed: 0, skipped: 0, cleanupComplete: true, failedScenarioIds: [], stopReasons: []
});
const uiInput = envelope('test.ui.input', 'test.ui', 'ready', ['seed-evidence', 'unit-pass', 'e2e-pass', 'e2e-evidence'], {
  workspaceRouteRef: 'route:fe', sourceReferenceRef: 'starci-academy-fe', manifestRef: 'package.json', appUrl: 'http://localhost:3000',
  testAccountRef: 'account:ordinary-user', credentialProviderRef: 'provider:test-account', selectedFlowRef: 'flow:approved', selectedFlowHash: 'hash:flow',
  approvedLayoutRef: 'layout:approved', approvedLayoutHash: 'hash:layout', seedEvidenceRef: 'evidence:seed', seedEvidenceHash: 'hash:seed',
  scenarioRefs: ['scenario:create'], viewportIds: ['wide', 'intermediate', 'compact'], evidenceRoot: '.worktrees/run/evidence'
});
const uiOutput = envelope('test.ui.output', 'proof.run', 'ready', ['seed-evidence', 'unit-pass', 'unit-evidence', 'e2e-pass', 'e2e-evidence', 'ui-pass', 'ui-evidence'], {
  uiEvidenceRef: 'evidence:ui', uiEvidenceHash: 'hash:ui', testAccountRef: 'account:ordinary-user',
  scenarioReceipts: [{ scenarioId: 'create', pageIds: ['select', 'configure', 'review', 'result'], viewportIds: ['wide', 'intermediate', 'compact'], interactionCount: 12, assertionCount: 18, screenshotRefs: ['shot:wide', 'shot:middle', 'shot:compact'], traceRef: 'trace:ui', accessibilityRef: 'axe:ui', status: 'pass', ordinaryUserPath: true, secretsRedacted: true }],
  selected: 1, passed: 1, failed: 0, skipped: 0, failedScenarioIds: [], boundaryDriftReasons: [], stopReasons: [], secretsRedacted: true
});

test('all three test operations accept closed valid input and output', () => {
  for (const [validate, value] of [[validateUnitInput, unitInput], [validateUnitOutput, unitOutput], [validateE2eInput, e2eInput], [validateE2eOutput, e2eOutput], [validateUiInput, uiInput], [validateUiOutput, uiOutput]]) {
    assert.deepEqual(validate(value), { valid: true, errors: [] });
  }
});

test('unit operation refuses garbage fields and zero-test passes', () => {
  const dirty = structuredClone(unitInput); dirty.payload.className = 'hidden';
  assert.equal(validateUnitInput(dirty).valid, false);
  const zero = structuredClone(unitOutput); zero.payload.selected = 0; zero.payload.passed = 0; zero.payload.commandReceipts = [];
  assert.equal(validateUnitOutput(zero).valid, false);
});

test('E2E operation refuses incomplete cleanup', () => {
  const dirty = structuredClone(e2eOutput); dirty.payload.cleanupComplete = false;
  assert.equal(validateE2eOutput(dirty).valid, false);
});

test('UI operation refuses raw credentials and browser shortcuts', () => {
  const rawCredential = structuredClone(uiInput); rawCredential.payload.password = 'must-never-enter-artifact';
  assert.equal(validateUiInput(rawCredential).valid, false);
  const shortcut = structuredClone(uiOutput); shortcut.payload.scenarioReceipts[0].ordinaryUserPath = false;
  assert.equal(validateUiOutput(shortcut).valid, false);
});

test('UI operation refuses missing responsive evidence', () => {
  const partial = structuredClone(uiOutput); partial.payload.scenarioReceipts[0].viewportIds = ['wide', 'compact']; partial.payload.scenarioReceipts[0].screenshotRefs = ['shot:wide', 'shot:compact'];
  assert.equal(validateUiOutput(partial).valid, false);
});
