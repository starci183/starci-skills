import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextState } from './route-machine.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const machine = (id) => JSON.parse(readFileSync(path.join(root, id, 'machine.json'), 'utf8'));

const workspaceReady = machine('starci-workspace-ready');
assert.equal(nextState(workspaceReady, 'analyze-input', {}, { selection: { skillId: 'starci-workspace-ready' }, options: {} }), 'identity');
assert.equal(nextState(workspaceReady, 'routes', { payload: { decision: 'ready' } }, {}), 'worktree');
assert.equal(nextState(workspaceReady, 'routes', { payload: { decision: 'blocked' } }, {}), 'blocked');
assert.equal(nextState(workspaceReady, 'route', { payload: { decision: 'ready' } }, {}), 'complete');
assert.equal(nextState(workspaceReady, 'route', { payload: { decision: 'initialize-required' } }, {}), 'routes');
assert.equal(nextState(workspaceReady, 'route', { payload: { decision: 'blocked' } }, {}), 'blocked');

const backend = machine('starci-backend-delivery');
assert.equal(nextState(backend, 'analyze-input', {}, { selection: { skillId: 'starci-backend-delivery' }, options: {} }), 'route');
assert.equal(nextState(backend, 'route', { payload: { decision: 'ready' } }, {}), 'business-staleness');
assert.equal(nextState(backend, 'business-staleness', { payload: { decision: 'initialize-required' } }, {}), 'business-evidence');
assert.equal(nextState(backend, 'business-staleness', { payload: { decision: 'fresh' } }, {}), 'architecture-frame');
assert.equal(nextState(backend, 'architecture-challenge', { payload: { decision: 'revise' } }, {}), 'architecture-alternatives');
assert.equal(nextState(backend, 'boundary-approval', { stage: 'architecture.boundary.review', status: 'approved' }, {}), 'coding-scope');

const backendRepair = machine('starci-backend-repair');
assert.equal(nextState(backendRepair, 'analyze-input', {}, { selection: { skillId: 'starci-backend-repair' }, options: {} }), 'route');
assert.equal(nextState(backendRepair, 'repair-prerequisites', { payload: { decision: 'ready' } }, {}), 'coding-scope');
assert.equal(nextState(backendRepair, 'repair-prerequisites', { payload: { decision: 'replan-required' } }, {}), 'replan-handoff');
assert.equal(nextState(backendRepair, 'coding-scope', { payload: { decision: 'source-drift' } }, {}), 'replan-handoff');

const frontend = machine('starci-frontend-layout-delivery');
assert.equal(nextState(frontend, 'analyze-input', {}, { selection: { skillId: 'starci-frontend-layout-delivery' }, options: {} }), 'layout-feedback-request');
assert.equal(nextState(frontend, 'layout-feedback-request', { payload: { decision: 'recorded' } }, {}), 'route');
assert.equal(nextState(frontend, 'business-staleness', { payload: { decision: 'fresh' } }, {}), 'preflight');
assert.equal(nextState(frontend, 'journey', { stage: 'flow.review', status: 'pending' }, {}), 'flow-approval');
assert.equal(nextState(frontend, 'journey', { stage: 'flow.review', status: 'approved' }, {}), 'page-model');
assert.equal(nextState(frontend, 'request-choice', { facts: ['grammar-gap', 'create-required'] }, {}), 'requests');
assert.equal(nextState(frontend, 'request-choice', { facts: [] }, {}), 'coding-scope');
assert.equal(nextState(frontend, 'implementation', { stage: 'seed.materialize', status: 'ready' }, {}), 'seed');
assert.equal(nextState(frontend, 'seed', { stage: 'test.unit', status: 'ready' }, {}), 'unit-test');
assert.equal(nextState(frontend, 'unit-test', { stage: 'test.e2e', status: 'ready' }, {}), 'e2e-test');
assert.equal(nextState(frontend, 'e2e-test', { stage: 'test.ui', status: 'ready' }, {}), 'ui-quality-test');
assert.equal(nextState(frontend, 'ui-quality-test', { payload: { decision: 'delivery-pass' } }, {}), 'ui-test');
assert.equal(nextState(frontend, 'ui-test', { stage: 'proof.run', status: 'ready' }, {}), 'product-proof');
assert.equal(nextState(frontend, 'product-proof', { stage: 'proof.review', status: 'complete' }, {}), 'mission-proof');
assert.equal(nextState(frontend, 'mission-impact', { payload: { decision: 'frontend-only' } }, {}), 'grammar');
assert.equal(nextState(frontend, 'mission-impact', { payload: { decision: 'backend-required' } }, {}), 'ship-architecture-frame');
assert.equal(nextState(frontend, 'ship-source-proof', { payload: { decision: 'pass' } }, {}), 'ship-resume');
assert.equal(nextState(frontend, 'ship-resume', { payload: { decision: 'ready' } }, {}), 'grammar');
assert.equal(nextState(frontend, 'mission-proof', { payload: { decision: 'pass' } }, {}), 'mission-business-reconcile');
assert.equal(nextState(frontend, 'mission-business-reconcile', { payload: { decision: 'implemented' } }, {}), 'complete');
assert.deepEqual(
  Object.entries(frontend.states)
    .filter(([, state]) => state.on?.some((edge) => edge.target === 'complete'))
    .map(([state]) => state),
  ['mission-business-reconcile']
);

const maintenance = machine('starci-frontend-maintenance-apply');
assert.equal(nextState(maintenance, 'analyze-input', {}, { selection: { skillId: 'starci-frontend-maintenance-apply' }, options: {} }), 'maintenance-feedback-request');
assert.equal(nextState(maintenance, 'maintenance-feedback-request', { payload: { decision: 'recorded' } }, {}), 'mission-route');
assert.equal(nextState(maintenance, 'mission-route', { payload: { decision: 'ready' } }, {}), 'mission-business-staleness');
assert.equal(nextState(maintenance, 'mission-business-staleness', { payload: { decision: 'fresh' } }, {}), 'mission-impact');
assert.equal(nextState(maintenance, 'mission-impact', { payload: { decision: 'frontend-only' } }, {}), 'maintenance-apply');
assert.equal(nextState(maintenance, 'mission-impact', { payload: { decision: 'backend-required' } }, {}), 'ship-architecture-frame');
assert.equal(nextState(maintenance, 'maintenance-apply', { payload: { decision: 'applied' } }, {}), 'maintenance-seed');
assert.equal(nextState(maintenance, 'maintenance-seed', { stage: 'test.unit', status: 'ready' }, {}), 'maintenance-unit-test');
assert.equal(nextState(maintenance, 'maintenance-unit-test', { stage: 'test.e2e', status: 'ready' }, {}), 'maintenance-e2e-test');
assert.equal(nextState(maintenance, 'maintenance-e2e-test', { stage: 'test.ui', status: 'ready' }, {}), 'maintenance-ui-quality-test');
assert.equal(nextState(maintenance, 'maintenance-ui-quality-test', { payload: { decision: 'delivery-pass' } }, {}), 'maintenance-ui-test');
assert.equal(nextState(maintenance, 'maintenance-ui-test', { stage: 'proof.run', status: 'ready' }, {}), 'maintenance-product-proof');
assert.equal(nextState(maintenance, 'maintenance-product-proof', { stage: 'proof.review', status: 'complete' }, {}), 'mission-proof');
assert.equal(nextState(maintenance, 'mission-proof', { payload: { decision: 'pass' } }, {}), 'mission-business-reconcile');
assert.equal(nextState(maintenance, 'mission-business-reconcile', { payload: { decision: 'implemented' } }, {}), 'learning-request');
assert.equal(nextState(maintenance, 'maintenance-unit-test', { stage: 'code.repair', status: 'repair' }, {}), 'maintenance-repair-handoff');
assert.equal(nextState(maintenance, 'maintenance-e2e-test', { stage: 'code.repair', status: 'repair' }, {}), 'maintenance-repair-handoff');
assert.equal(nextState(maintenance, 'maintenance-ui-quality-test', { payload: { decision: 'delivery-in-boundary' } }, {}), 'maintenance-repair-handoff');
assert.equal(nextState(maintenance, 'maintenance-ui-quality-test', { payload: { decision: 'delivery-boundary-drift' } }, {}), 'maintenance-authority-handoff');
assert.equal(nextState(maintenance, 'maintenance-ui-test', { stage: 'code.repair', status: 'repair' }, {}), 'maintenance-repair-handoff');
assert.equal(nextState(maintenance, 'maintenance-ui-test', { stage: 'layout.review', status: 'rejected' }, {}), 'maintenance-authority-handoff');
assert.equal(nextState(maintenance, 'maintenance-product-proof', { stage: 'code.repair', status: 'repair' }, {}), 'maintenance-repair-handoff');
assert.equal(nextState(maintenance, 'maintenance-product-proof', { stage: 'layout.review', status: 'rejected' }, {}), 'maintenance-authority-handoff');
assert.equal(nextState(maintenance, 'learning-request', { payload: { decision: 'recorded' } }, {}), 'complete');
assert.deepEqual(
  ['maintenance-seed', 'maintenance-unit-test', 'maintenance-e2e-test', 'maintenance-ui-quality-test', 'maintenance-ui-test', 'maintenance-product-proof']
    .map((state) => maintenance.states[state].ref),
  ['fe/product-seed', 'test/unit', 'test/e2e', 'test/ui-quality-audit', 'test/ui', 'fe/product-proof']
);
assert.deepEqual(
  Object.entries(maintenance.states)
    .filter(([, state]) => state.on?.some((edge) => edge.target === 'learning-request'))
    .map(([state]) => state),
  ['mission-business-reconcile']
);

const requestReview = machine('starci-frontend-request-review');
assert.equal(nextState(requestReview, 'analyze-input', {}, { selection: { skillId: 'starci-frontend-request-review' }, options: {} }), 'request-review');
assert.equal(nextState(requestReview, 'request-review', { payload: { decision: 'approved' } }, {}), 'complete');
assert.equal(nextState(requestReview, 'request-review', { payload: { decision: 'rejected' } }, {}), 'complete');
assert.equal(nextState(requestReview, 'request-review', { payload: { decision: 'blocked' } }, {}), 'blocked');
assert.equal(requestReview.states['request-review'].ref, 'fe/request-review');

const assertReconcileAcceptanceChain = (candidate) => {
  assert.equal(nextState(candidate, 'reconcile-seed', { stage: 'test.unit', status: 'ready' }, {}), 'reconcile-unit-test');
  assert.equal(nextState(candidate, 'reconcile-unit-test', { stage: 'test.e2e', status: 'ready' }, {}), 'reconcile-e2e-test');
  assert.equal(nextState(candidate, 'reconcile-e2e-test', { stage: 'test.ui', status: 'ready' }, {}), 'reconcile-ui-quality-test');
  assert.equal(nextState(candidate, 'reconcile-ui-quality-test', { payload: { decision: 'delivery-pass' } }, {}), 'reconcile-ui-test');
  assert.equal(nextState(candidate, 'reconcile-ui-test', { stage: 'proof.run', status: 'ready' }, {}), 'reconcile-product-proof');
  assert.equal(nextState(candidate, 'reconcile-product-proof', { stage: 'proof.review', status: 'complete' }, {}), 'mission-proof');
  assert.equal(nextState(candidate, 'mission-proof', { payload: { decision: 'pass' } }, {}), 'mission-business-reconcile');
  assert.equal(nextState(candidate, 'mission-business-reconcile', { payload: { decision: 'implemented' } }, {}), 'complete');
  assert.equal(nextState(candidate, 'reconcile-unit-test', { stage: 'code.repair', status: 'repair' }, {}), 'reconcile-repair-handoff');
  assert.equal(nextState(candidate, 'reconcile-ui-quality-test', { payload: { decision: 'delivery-boundary-drift' } }, {}), 'reconcile-authority-handoff');
  assert.deepEqual(
    ['reconcile-seed', 'reconcile-unit-test', 'reconcile-e2e-test', 'reconcile-ui-quality-test', 'reconcile-ui-test', 'reconcile-product-proof']
      .map((state) => candidate.states[state].ref),
    ['fe/product-seed', 'test/unit', 'test/e2e', 'test/ui-quality-audit', 'test/ui', 'fe/product-proof']
  );
  assert.deepEqual(
    Object.entries(candidate.states)
      .filter(([, state]) => state.on?.some((edge) => edge.target === 'complete'))
      .map(([state]) => state),
    ['mission-business-reconcile']
  );
};

const blockReconcile = machine('starci-frontend-block-reconcile');
assert.equal(nextState(blockReconcile, 'analyze-input', {}, { selection: { skillId: 'starci-frontend-block-reconcile' }, options: {} }), 'block-feedback-request');
assert.equal(nextState(blockReconcile, 'block-feedback-request', { payload: { decision: 'recorded' } }, {}), 'mission-route');
assert.equal(nextState(blockReconcile, 'mission-route', { payload: { decision: 'ready' } }, {}), 'mission-business-staleness');
assert.equal(nextState(blockReconcile, 'mission-business-staleness', { payload: { decision: 'fresh' } }, {}), 'block-reconcile');
assert.equal(nextState(blockReconcile, 'block-reconcile', { payload: { decision: 'reconciled' } }, {}), 'block-approval');
assert.equal(nextState(blockReconcile, 'block-approval', { stage: 'fe.block.review', status: 'approved' }, {}), 'mission-impact');
assert.equal(nextState(blockReconcile, 'mission-impact', { payload: { decision: 'frontend-only' } }, {}), 'block-consumer-align');
assert.equal(nextState(blockReconcile, 'mission-impact', { payload: { decision: 'backend-required' } }, {}), 'ship-architecture-frame');
assert.equal(nextState(blockReconcile, 'block-consumer-align', { payload: { decision: 'aligned' } }, {}), 'reconcile-seed');
assertReconcileAcceptanceChain(blockReconcile);

const surfaceReconcile = machine('starci-frontend-surface-reconcile');
assert.equal(nextState(surfaceReconcile, 'analyze-input', {}, { selection: { skillId: 'starci-frontend-surface-reconcile' }, options: {} }), 'surface-feedback-request');
assert.equal(nextState(surfaceReconcile, 'surface-feedback-request', { payload: { decision: 'recorded' } }, {}), 'mission-route');
assert.equal(nextState(surfaceReconcile, 'mission-route', { payload: { decision: 'ready' } }, {}), 'mission-business-staleness');
assert.equal(nextState(surfaceReconcile, 'mission-business-staleness', { payload: { decision: 'fresh' } }, {}), 'surface-audit');
assert.equal(nextState(surfaceReconcile, 'authority-approval', { stage: 'fe.authority.review', status: 'approved' }, {}), 'mission-impact');
assert.equal(nextState(surfaceReconcile, 'mission-impact', { payload: { decision: 'frontend-only' } }, {}), 'authority-reconcile');
assert.equal(nextState(surfaceReconcile, 'mission-impact', { payload: { decision: 'backend-required' } }, {}), 'ship-architecture-frame');
assert.equal(nextState(surfaceReconcile, 'authority-reconcile', { payload: { decision: 'reconciled' } }, {}), 'consumer-align');
assert.equal(nextState(surfaceReconcile, 'consumer-align', { payload: { decision: 'aligned' } }, {}), 'reconcile-seed');
assertReconcileAcceptanceChain(surfaceReconcile);

const deployment = machine('starci-deployment');
assert.equal(nextState(deployment, 'monitor', { payload: { decision: 'recover' } }, {}), 'recover');
assert.equal(nextState(deployment, 'monitor', { payload: { decision: 'progressing' } }, {}), 'monitor');
assert.equal(nextState(deployment, 'recover', { payload: { decision: 'retry' } }, {}), 'monitor');
assert.equal(nextState(deployment, 'proof', { payload: { decision: 'rolled-back' } }, {}), 'rolled-back');

const debt = machine('starci-quality-debt-repay');
assert.equal(nextState(debt, 'debt', { payload: { decision: 'closure-candidate' } }, {}), 'debt-proof');
assert.equal(nextState(debt, 'debt-proof', { payload: { decision: 'green' } }, {}), 'debt-close');

assert.throws(
  () => nextState({ id: 'ambiguous', states: { start: { kind: 'choice', on: [
    { when: {}, target: 'a' }, { when: {}, target: 'b' }
  ] } } }, 'start', {}, {}),
  /expected one route, matched 2/
);

console.log('state-machine routing tests passed');
