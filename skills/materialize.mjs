import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const e = (when, target, label) => ({ when, target, ...(label ? { label } : {}) });
const op = (ref, on) => ({ kind: 'operator', ref, on });
const choice = (on) => ({ kind: 'choice', on });
const wait = (prompt, approve, reject, on) => ({ kind: 'wait', approval: { prompt, approve, reject }, on });
const terminal = (result) => ({ kind: 'terminal', result });
const decided = (routes) => Object.entries(routes).map(([decision, target]) => e({ decision }, target, decision));
const qualityEdges = (pass) => decided({ pass, 'in-boundary': 'implement', 'boundary-drift': 'boundary-plan', 'external-blocker': 'blocked' });
const repairQualityEdges = (pass) => decided({ pass, 'in-boundary': 'implement', 'boundary-drift': 'replan-handoff', 'external-blocker': 'blocked' });
const missionQualityEdges = (pass) => decided({ pass, 'in-boundary': 'ship-implement', 'boundary-drift': 'ship-boundary-plan', 'external-blocker': 'blocked' });
const routeEdges = (readyTarget, initializeTarget = 'blocked') => decided({ ready: readyTarget, 'initialize-required': initializeTarget, blocked: 'blocked' });

function reachableSubgraph(states, entry) {
  const selected = { 'analyze-input': { kind: 'analysis', on: [e({}, entry, `enter ${entry}`)] } };
  const queue = [entry];
  while (queue.length) {
    const stateId = queue.shift();
    if (selected[stateId]) continue;
    const state = states[stateId];
    if (!state) throw new Error(`missing state ${stateId}`);
    selected[stateId] = state;
    for (const edge of state.on ?? []) queue.push(edge.target);
  }
  return selected;
}

const workspaceStates = {
  identity: op('workspace/identity-verify', routeEdges('bootstrap')),
  bootstrap: op('workspace/bootstrap-verify', routeEdges('declarations')),
  declarations: op('workspace/declarations-compile', decided({ ready: 'routes' })),
  routes: op('workspace/routes-hydrate', decided({ ready: 'worktree', blocked: 'blocked' })),
  worktree: op('workspace/worktree-verify', routeEdges('route')),
  route: op('workspace/route-verify', routeEdges('complete', 'routes')),
  complete: terminal('complete'), blocked: terminal('blocked')
};

const deviceCheckpointStates = {
  route: op('workspace/route-verify', routeEdges('checkpoint')),
  checkpoint: op('workspace/device-checkpoint', decided({ published: 'complete', blocked: 'blocked' })),
  complete: terminal('complete'),
  blocked: terminal('blocked')
};

const businessStates = {
  route: op('workspace/route-verify', routeEdges('evidence')),
  evidence: op('business/evidence-normalize', decided({ ready: 'model' })),
  model: op('business/model', decided({ ready: 'model-approval' })),
  'model-approval': wait('Approve the displayed business model revision and lifecycle transition.', 'OK BUSINESS <hash>', 'REJECT BUSINESS <hash>', [e({ stage: 'business.model.review', status: 'approved' }, 'publish'), e({ stage: 'business.model.review', status: 'rejected' }, 'evidence')]),
  publish: op('business/publish', decided({ 'direct-plan': 'complete', 'architecture-required': 'complete', blocked: 'blocked' })),
  'reconcile-route': op('workspace/route-verify', routeEdges('reconcile')),
  reconcile: op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' })),
  complete: terminal('complete'), blocked: terminal('blocked')
};

const architectureStates = {
  route: op('workspace/route-verify', routeEdges('business-staleness')),
  'business-staleness': op('business/staleness-check', decided({ fresh: 'frame', 'initialize-required': 'business-evidence', blocked: 'blocked' })),
  'business-evidence': op('business/evidence-normalize', decided({ ready: 'business-model' })),
  'business-model': op('business/model', decided({ ready: 'business-approval' })),
  'business-approval': wait('Approve the regenerated business authority before architecture analysis.', 'OK BUSINESS <hash>', 'REJECT BUSINESS <hash>', [e({ stage: 'business.model.review', status: 'approved' }, 'business-publish'), e({ stage: 'business.model.review', status: 'rejected' }, 'business-evidence')]),
  'business-publish': op('business/publish', decided({ 'direct-plan': 'business-staleness', 'architecture-required': 'business-staleness', blocked: 'blocked' })),
  frame: op('architecture/decision-frame', decided({ ready: 'current' })),
  current: op('architecture/current-state', decided({ ready: 'alternatives' })),
  alternatives: op('architecture/alternatives', decided({ ready: 'challenge' })),
  challenge: op('architecture/decision-challenge', decided({ ready: 'decision-selection', revise: 'alternatives', blocked: 'blocked' })),
  'decision-selection': wait('Approve the recommended architecture decision and exact option-set hash.', 'OK ARCHITECTURE <decision>', 'REJECT ARCHITECTURE <decision>', [e({ stage: 'architecture.decision.handoff', status: 'ready' }, 'handoff'), e({ stage: 'architecture.decision.alternatives', status: 'ready' }, 'alternatives')]),
  handoff: op('architecture/decision-handoff', decided({ ready: 'complete' })),
  complete: terminal('complete'), blocked: terminal('blocked')
};

const backendStates = {
  route: op('workspace/route-verify', routeEdges('business-staleness')),
  'business-staleness': op('business/staleness-check', decided({ fresh: 'architecture-frame', 'initialize-required': 'business-evidence', blocked: 'blocked' })),
  'business-evidence': op('business/evidence-normalize', decided({ ready: 'business-model' })),
  'business-model': op('business/model', decided({ ready: 'business-approval' })),
  'business-approval': wait('Approve regenerated business authority before backend planning.', 'OK BUSINESS <hash>', 'REJECT BUSINESS <hash>', [e({ stage: 'business.model.review', status: 'approved' }, 'business-publish'), e({ stage: 'business.model.review', status: 'rejected' }, 'business-evidence')]),
  'business-publish': op('business/publish', decided({ 'direct-plan': 'business-staleness', 'architecture-required': 'business-staleness', blocked: 'blocked' })),
  'architecture-frame': op('architecture/decision-frame', decided({ ready: 'architecture-current' })),
  'architecture-current': op('architecture/current-state', decided({ ready: 'architecture-alternatives' })),
  'architecture-alternatives': op('architecture/alternatives', decided({ ready: 'architecture-challenge' })),
  'architecture-challenge': op('architecture/decision-challenge', decided({ ready: 'architecture-selection', revise: 'architecture-alternatives', blocked: 'blocked' })),
  'architecture-selection': wait('Approve the recommended architecture decision and option-set hash.', 'OK ARCHITECTURE <decision>', 'REJECT ARCHITECTURE <decision>', [e({ stage: 'architecture.decision.handoff', status: 'ready' }, 'architecture-handoff'), e({ stage: 'architecture.decision.alternatives', status: 'ready' }, 'architecture-alternatives')]),
  'architecture-handoff': op('architecture/decision-handoff', decided({ ready: 'source-discovery' })),
  'source-discovery': op('architecture/source-discovery', decided({ ready: 'pattern-bind' })),
  'pattern-bind': op('architecture/pattern-bind', decided({ ready: 'boundary-plan' })),
  'boundary-plan': op('architecture/boundary-plan', decided({ ready: 'boundary-challenge' })),
  'boundary-challenge': op('architecture/boundary-challenge', decided({ clean: 'boundary-approval', revise: 'boundary-plan', blocked: 'blocked' })),
  'boundary-approval': wait('Approve the exact backend plan hash and file boundary.', 'OK BACKEND <hash>', 'REJECT BACKEND <hash>', [e({ stage: 'architecture.boundary.review', status: 'approved' }, 'coding-scope'), e({ stage: 'architecture.boundary.review', status: 'rejected' }, 'boundary-plan')]),
  'coding-scope': op('be/coding-scope-freeze', decided({ ready: 'implement', 'source-drift': 'boundary-plan', 'boundary-drift': 'boundary-plan', blocked: 'blocked' })),
  implement: op('be/implementation', decided({ ready: 'format', 'source-drift': 'boundary-plan', 'boundary-drift': 'boundary-plan', blocked: 'blocked' })),
  format: op('quality/format', qualityEdges('lint')), lint: op('quality/lint', qualityEdges('typecheck')),
  typecheck: op('quality/typecheck', qualityEdges('build')), build: op('quality/build', qualityEdges('unit')),
  unit: op('quality/unit-coverage', qualityEdges('integration')), integration: op('quality/integration', qualityEdges('e2e')),
  e2e: op('quality/e2e', qualityEdges('sonar')), sonar: op('quality/sonar', qualityEdges('post-quality')),
  'post-quality': choice([e({ inputEquals: { 'options.deploymentMode': 'none' } }, 'source-proof'), e({ inputEquals: { 'options.deploymentMode': 'handoff' } }, 'deployment-handoff')]),
  'source-proof': op('quality/delivery-proof', decided({ pass: 'business-reconcile', blocked: 'blocked' })),
  'business-reconcile': op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' })),
  complete: terminal('complete'), 'deployment-handoff': terminal('handoff'), blocked: terminal('blocked')
};

const backendRepairStates = {
  route: op('workspace/route-verify', routeEdges('business-staleness')),
  'business-staleness': op('business/staleness-check', decided({ fresh: 'repair-prerequisites', 'initialize-required': 'business-evidence', blocked: 'blocked' })),
  'business-evidence': op('business/evidence-normalize', decided({ ready: 'business-model' })),
  'business-model': op('business/model', decided({ ready: 'business-approval' })),
  'business-approval': wait('Approve regenerated business authority before resuming the backend repair.', 'OK BUSINESS <hash>', 'REJECT BUSINESS <hash>', [e({ stage: 'business.model.review', status: 'approved' }, 'business-publish'), e({ stage: 'business.model.review', status: 'rejected' }, 'business-evidence')]),
  'business-publish': op('business/publish', decided({ 'direct-plan': 'business-staleness', 'architecture-required': 'business-staleness', blocked: 'blocked' })),
  'repair-prerequisites': op('be/repair-prerequisite-check', decided({ ready: 'coding-scope', 'route-required': 'route', 'business-refresh-required': 'business-staleness', 'replan-required': 'replan-handoff', blocked: 'blocked' })),
  'coding-scope': op('be/coding-scope-freeze', decided({ ready: 'implement', 'source-drift': 'replan-handoff', 'boundary-drift': 'replan-handoff', blocked: 'blocked' })),
  implement: op('be/implementation', decided({ ready: 'format', 'source-drift': 'replan-handoff', 'boundary-drift': 'replan-handoff', blocked: 'blocked' })),
  format: op('quality/format', repairQualityEdges('lint')), lint: op('quality/lint', repairQualityEdges('typecheck')),
  typecheck: op('quality/typecheck', repairQualityEdges('build')), build: op('quality/build', repairQualityEdges('unit')),
  unit: op('quality/unit-coverage', repairQualityEdges('integration')), integration: op('quality/integration', repairQualityEdges('e2e')),
  e2e: op('quality/e2e', repairQualityEdges('sonar')), sonar: op('quality/sonar', repairQualityEdges('post-quality')),
  'post-quality': choice([e({ inputEquals: { 'options.deploymentMode': 'none' } }, 'source-proof'), e({ inputEquals: { 'options.deploymentMode': 'handoff' } }, 'deployment-handoff')]),
  'source-proof': op('quality/delivery-proof', decided({ pass: 'business-reconcile', blocked: 'blocked' })),
  'business-reconcile': op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' })),
  complete: terminal('complete'), 'deployment-handoff': terminal('handoff'), 'replan-handoff': terminal('handoff'), blocked: terminal('blocked')
};

const frontendStates = {
  'request-review': op('fe/request-review', decided({ approved: 'complete', rejected: 'complete', blocked: 'blocked' })),
  'layout-feedback-request': op('fe/feedback-request', decided({ recorded: 'route', blocked: 'blocked' })),
  'block-feedback-request': op('fe/feedback-request', decided({ recorded: 'block-reconcile', blocked: 'blocked' })),
  'maintenance-feedback-request': op('fe/feedback-request', decided({ recorded: 'maintenance-apply', blocked: 'blocked' })),
  'surface-feedback-request': op('fe/feedback-request', decided({ recorded: 'surface-audit', blocked: 'blocked' })),
  route: op('workspace/route-verify', routeEdges('business-staleness')),
  'business-staleness': op('business/staleness-check', decided({ fresh: 'preflight', 'initialize-required': 'business-evidence', blocked: 'blocked' })),
  'business-evidence': op('business/evidence-normalize', decided({ ready: 'business-model' })),
  'business-model': op('business/model', decided({ ready: 'business-approval' })),
  'business-approval': wait('Approve regenerated business authority before customer-journey work.', 'OK BUSINESS <hash>', 'REJECT BUSINESS <hash>', [e({ stage: 'business.model.review', status: 'approved' }, 'business-publish'), e({ stage: 'business.model.review', status: 'rejected' }, 'business-evidence')]),
  'business-publish': op('business/publish', decided({ 'direct-plan': 'business-staleness', 'architecture-required': 'business-staleness', blocked: 'blocked' })),
  preflight: op('fe/preflight', [e({ stage: 'flow.generate', status: 'ready' }, 'journey')]),
  journey: op('fe/customer-journey', [e({ stage: 'flow.review', status: 'pending' }, 'flow-approval'), e({ stage: 'flow.review', status: 'approved' }, 'page-model')]),
  'flow-approval': wait('Approve one exact customer-journey direction.', 'OK FLOW <id>', 'REJECT FLOW <id>', [e({ stage: 'flow.review', status: 'approved' }, 'page-model'), e({ stage: 'flow.review', status: 'rejected' }, 'journey')]),
  'page-model': op('fe/page-model', [e({ stage: 'state.generate', status: 'ready' }, 'state')]),
  state: op('fe/state', [e({ stage: 'layout.generate', status: 'ready' }, 'context-sync'), e({ stage: 'state.result', status: 'blocked' }, 'blocked')]),
  'context-sync': op('fe/context-sync', [e({ stage: 'source-fit.resolve', status: 'ready' }, 'source-fit'), e({ stage: 'source-fit.resolve', status: 'blocked' }, 'blocked')]),
  'source-fit': op('fe/source-fit', [e({ stage: 'principles.compile', status: 'ready' }, 'principles')]),
  principles: op('fe/principle-compile', [e({ stage: 'layout.generate', status: 'ready' }, 'layout'), e({ stage: 'layout.generate', status: 'blocked' }, 'blocked')]),
  layout: op('fe/layout', [e({ stage: 'layout.review', status: 'pending' }, 'layout-approval')]),
  'layout-approval': wait('Approve one exact layout direction and complete page set.', 'OK LAYOUT <id>', 'REJECT LAYOUT <id>', [e({ stage: 'layout.review', status: 'approved' }, 'grammar'), e({ stage: 'layout.review', status: 'rejected' }, 'layout')]),
  grammar: op('fe/grammar-convergence', [e({ stage: 'source-fit.resolve', status: 'ready' }, 'request-choice'), e({ stage: 'source-fit.resolve', status: 'blocked' }, 'blocked')]),
  'request-choice': choice([e({ allFacts: ['grammar-gap'] }, 'requests'), e({ allFacts: ['create-required'], noneFacts: ['grammar-gap'] }, 'requests'), e({ noneFacts: ['grammar-gap', 'create-required'] }, 'coding-scope')]),
  requests: op('fe/request-emission', [e({ stage: 'request.result', status: 'ready' }, 'coding-scope'), e({ stage: 'request.result', status: 'blocked' }, 'blocked')]),
  'coding-scope': op('fe/coding-scope-freeze', [e({ stage: 'code.implement', status: 'ready' }, 'implementation'), e({ stage: 'code.result', status: 'blocked' }, 'blocked')]),
  implementation: op('fe/implementation', [e({ stage: 'seed.materialize', status: 'ready' }, 'seed'), e({ stage: 'code.result', status: 'blocked' }, 'blocked')]),
  seed: op('fe/product-seed', [e({ stage: 'test.unit', status: 'ready' }, 'unit-test'), e({ stage: 'seed.result', status: 'blocked' }, 'blocked')]),
  'unit-test': op('test/unit', [e({ stage: 'test.e2e', status: 'ready' }, 'e2e-test'), e({ stage: 'code.repair', status: 'repair' }, 'implementation'), e({ stage: 'test.review', status: 'blocked' }, 'blocked')]),
  'e2e-test': op('test/e2e', [e({ stage: 'test.ui', status: 'ready' }, 'ui-quality-test'), e({ stage: 'code.repair', status: 'repair' }, 'implementation'), e({ stage: 'test.review', status: 'blocked' }, 'blocked')]),
  'ui-quality-test': op('test/ui-quality-audit', decided({ 'delivery-pass': 'ui-test', 'delivery-in-boundary': 'implementation', 'delivery-boundary-drift': 'layout', 'audit-pass': 'blocked', 'audit-findings': 'blocked', blocked: 'blocked' })),
  'ui-test': op('test/ui', [e({ stage: 'proof.run', status: 'ready' }, 'product-proof'), e({ stage: 'code.repair', status: 'repair' }, 'implementation'), e({ stage: 'layout.review', status: 'rejected' }, 'layout'), e({ stage: 'test.review', status: 'blocked' }, 'blocked')]),
  'product-proof': op('fe/product-proof', [e({ stage: 'proof.review', status: 'complete' }, 'complete'), e({ stage: 'code.repair', status: 'repair' }, 'implementation'), e({ stage: 'layout.review', status: 'rejected' }, 'layout'), e({ stage: 'proof.review', status: 'blocked' }, 'blocked')]),
  'block-reconcile': op('fe/block-reconcile', decided({ reconciled: 'block-approval', blocked: 'blocked' })),
  'block-approval': wait('Approve the exact Block reconciliation and closed consumer boundary.', 'OK BLOCK <hash>', 'REJECT BLOCK <hash>', [
    e({ stage: 'fe.block.review', status: 'approved' }, 'block-consumer-align'),
    e({ stage: 'fe.block.review', status: 'rejected' }, 'rejected')
  ]),
  'block-consumer-align': op('fe/consumer-align', decided({ aligned: 'reconcile-seed', blocked: 'blocked' })),
  'maintenance-apply': op('fe/maintenance-apply', decided({ applied: 'maintenance-seed', blocked: 'blocked' })),
  'maintenance-seed': op('fe/product-seed', [
    e({ stage: 'test.unit', status: 'ready' }, 'maintenance-unit-test'),
    e({ stage: 'seed.result', status: 'blocked' }, 'blocked')
  ]),
  'maintenance-unit-test': op('test/unit', [
    e({ stage: 'test.e2e', status: 'ready' }, 'maintenance-e2e-test'),
    e({ stage: 'code.repair', status: 'repair' }, 'maintenance-repair-handoff'),
    e({ stage: 'test.review', status: 'blocked' }, 'blocked')
  ]),
  'maintenance-e2e-test': op('test/e2e', [
    e({ stage: 'test.ui', status: 'ready' }, 'maintenance-ui-quality-test'),
    e({ stage: 'code.repair', status: 'repair' }, 'maintenance-repair-handoff'),
    e({ stage: 'test.review', status: 'blocked' }, 'blocked')
  ]),
  'maintenance-ui-quality-test': op('test/ui-quality-audit', decided({
    'delivery-pass': 'maintenance-ui-test',
    'delivery-in-boundary': 'maintenance-repair-handoff',
    'delivery-boundary-drift': 'maintenance-authority-handoff',
    'audit-pass': 'blocked',
    'audit-findings': 'blocked',
    blocked: 'blocked'
  })),
  'maintenance-ui-test': op('test/ui', [
    e({ stage: 'proof.run', status: 'ready' }, 'maintenance-product-proof'),
    e({ stage: 'code.repair', status: 'repair' }, 'maintenance-repair-handoff'),
    e({ stage: 'layout.review', status: 'rejected' }, 'maintenance-authority-handoff'),
    e({ stage: 'test.review', status: 'blocked' }, 'blocked')
  ]),
  'maintenance-product-proof': op('fe/product-proof', [
    e({ stage: 'proof.review', status: 'complete' }, 'learning-request'),
    e({ stage: 'code.repair', status: 'repair' }, 'maintenance-repair-handoff'),
    e({ stage: 'layout.review', status: 'rejected' }, 'maintenance-authority-handoff'),
    e({ stage: 'proof.review', status: 'blocked' }, 'blocked')
  ]),
  'maintenance-repair-handoff': terminal('handoff'),
  'maintenance-authority-handoff': terminal('handoff'),
  'learning-request': op('fe/learning-request', decided({ recorded: 'complete', blocked: 'blocked' })),
  'learning-resolve': op('fe/learning-resolve', decided({ resolved: 'complete', blocked: 'blocked' })),
  'surface-audit': op('fe/surface-audit', decided({ audited: 'authority-approval', blocked: 'blocked' })),
  'authority-approval': wait('Approve the smallest durable design authority and closed consumer set.', 'OK AUTHORITY <hash>', 'REJECT AUTHORITY <hash>', [e({ stage: 'fe.authority.review', status: 'approved' }, 'authority-reconcile'), e({ stage: 'fe.authority.review', status: 'rejected' }, 'surface-audit')]),
  'authority-reconcile': op('fe/authority-reconcile', decided({ reconciled: 'consumer-align', blocked: 'blocked' })),
  'consumer-align': op('fe/consumer-align', decided({ aligned: 'reconcile-seed', blocked: 'blocked' })),
  'reconcile-seed': op('fe/product-seed', [
    e({ stage: 'test.unit', status: 'ready' }, 'reconcile-unit-test'),
    e({ stage: 'seed.result', status: 'blocked' }, 'blocked')
  ]),
  'reconcile-unit-test': op('test/unit', [
    e({ stage: 'test.e2e', status: 'ready' }, 'reconcile-e2e-test'),
    e({ stage: 'code.repair', status: 'repair' }, 'reconcile-repair-handoff'),
    e({ stage: 'test.review', status: 'blocked' }, 'blocked')
  ]),
  'reconcile-e2e-test': op('test/e2e', [
    e({ stage: 'test.ui', status: 'ready' }, 'reconcile-ui-quality-test'),
    e({ stage: 'code.repair', status: 'repair' }, 'reconcile-repair-handoff'),
    e({ stage: 'test.review', status: 'blocked' }, 'blocked')
  ]),
  'reconcile-ui-quality-test': op('test/ui-quality-audit', decided({
    'delivery-pass': 'reconcile-ui-test',
    'delivery-in-boundary': 'reconcile-repair-handoff',
    'delivery-boundary-drift': 'reconcile-authority-handoff',
    'audit-pass': 'blocked',
    'audit-findings': 'blocked',
    blocked: 'blocked'
  })),
  'reconcile-ui-test': op('test/ui', [
    e({ stage: 'proof.run', status: 'ready' }, 'reconcile-product-proof'),
    e({ stage: 'code.repair', status: 'repair' }, 'reconcile-repair-handoff'),
    e({ stage: 'layout.review', status: 'rejected' }, 'reconcile-authority-handoff'),
    e({ stage: 'test.review', status: 'blocked' }, 'blocked')
  ]),
  'reconcile-product-proof': op('fe/product-proof', [
    e({ stage: 'proof.review', status: 'complete' }, 'complete'),
    e({ stage: 'code.repair', status: 'repair' }, 'reconcile-repair-handoff'),
    e({ stage: 'layout.review', status: 'rejected' }, 'reconcile-authority-handoff'),
    e({ stage: 'proof.review', status: 'blocked' }, 'blocked')
  ]),
  'reconcile-repair-handoff': terminal('handoff'),
  'reconcile-authority-handoff': terminal('handoff'),
  complete: terminal('complete'), rejected: terminal('rejected'), blocked: terminal('blocked')
};

const missionFreshnessStates = (freshTarget) => ({
  'mission-route': op('workspace/route-verify', routeEdges('mission-business-staleness')),
  'mission-business-staleness': op('business/staleness-check', decided({ fresh: freshTarget, 'initialize-required': 'mission-business-evidence', blocked: 'blocked' })),
  'mission-business-evidence': op('business/evidence-normalize', decided({ ready: 'mission-business-model' })),
  'mission-business-model': op('business/model', decided({ ready: 'mission-business-approval' })),
  'mission-business-approval': wait('Approve regenerated business authority before mission delivery.', 'OK BUSINESS <hash>', 'REJECT BUSINESS <hash>', [
    e({ stage: 'business.model.review', status: 'approved' }, 'mission-business-publish'),
    e({ stage: 'business.model.review', status: 'rejected' }, 'mission-business-evidence')
  ]),
  'mission-business-publish': op('business/publish', decided({ 'direct-plan': 'mission-business-staleness', 'architecture-required': 'mission-business-staleness', blocked: 'blocked' }))
});

const missionBackendStates = (resumeTarget) => ({
  'mission-impact': op('delivery/impact-classify', decided({ 'backend-required': 'ship-architecture-frame', 'frontend-only': resumeTarget, blocked: 'blocked' })),
  'ship-architecture-frame': op('architecture/decision-frame', decided({ ready: 'ship-architecture-current' })),
  'ship-architecture-current': op('architecture/current-state', decided({ ready: 'ship-architecture-alternatives' })),
  'ship-architecture-alternatives': op('architecture/alternatives', decided({ ready: 'ship-architecture-challenge' })),
  'ship-architecture-challenge': op('architecture/decision-challenge', decided({ ready: 'ship-architecture-selection', revise: 'ship-architecture-alternatives', blocked: 'blocked' })),
  'ship-architecture-selection': wait('Approve the backend architecture required by this mission.', 'OK ARCHITECTURE <decision>', 'REJECT ARCHITECTURE <decision>', [
    e({ stage: 'architecture.decision.handoff', status: 'ready' }, 'ship-architecture-handoff'),
    e({ stage: 'architecture.decision.alternatives', status: 'ready' }, 'ship-architecture-alternatives')
  ]),
  'ship-architecture-handoff': op('architecture/decision-handoff', decided({ ready: 'ship-source-discovery' })),
  'ship-source-discovery': op('architecture/source-discovery', decided({ ready: 'ship-pattern-bind' })),
  'ship-pattern-bind': op('architecture/pattern-bind', decided({ ready: 'ship-boundary-plan' })),
  'ship-boundary-plan': op('architecture/boundary-plan', decided({ ready: 'ship-boundary-challenge' })),
  'ship-boundary-challenge': op('architecture/boundary-challenge', decided({ clean: 'ship-boundary-approval', revise: 'ship-boundary-plan', blocked: 'blocked' })),
  'ship-boundary-approval': wait('Approve the exact backend plan required to complete this mission.', 'OK BACKEND <hash>', 'REJECT BACKEND <hash>', [
    e({ stage: 'architecture.boundary.review', status: 'approved' }, 'ship-coding-scope'),
    e({ stage: 'architecture.boundary.review', status: 'rejected' }, 'ship-boundary-plan')
  ]),
  'ship-coding-scope': op('be/coding-scope-freeze', decided({ ready: 'ship-implement', 'source-drift': 'ship-boundary-plan', 'boundary-drift': 'ship-boundary-plan', blocked: 'blocked' })),
  'ship-implement': op('be/implementation', decided({ ready: 'ship-format', 'source-drift': 'ship-boundary-plan', 'boundary-drift': 'ship-boundary-plan', blocked: 'blocked' })),
  'ship-format': op('quality/format', missionQualityEdges('ship-lint')),
  'ship-lint': op('quality/lint', missionQualityEdges('ship-typecheck')),
  'ship-typecheck': op('quality/typecheck', missionQualityEdges('ship-build')),
  'ship-build': op('quality/build', missionQualityEdges('ship-unit')),
  'ship-unit': op('quality/unit-coverage', missionQualityEdges('ship-integration')),
  'ship-integration': op('quality/integration', missionQualityEdges('ship-e2e')),
  'ship-e2e': op('quality/e2e', missionQualityEdges('ship-sonar')),
  'ship-sonar': op('quality/sonar', missionQualityEdges('ship-source-proof')),
  'ship-source-proof': op('quality/delivery-proof', decided({ pass: 'ship-resume', blocked: 'blocked' })),
  'ship-resume': op('delivery/mission-resume', decided({ ready: resumeTarget, blocked: 'blocked' }))
});

const missionCompletionStates = {
  'mission-proof': op('delivery/mission-proof', decided({ pass: 'mission-business-reconcile', blocked: 'blocked' })),
  'mission-business-reconcile': op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' }))
};

const layoutMissionStates = {
  ...frontendStates,
  ...missionBackendStates('grammar'),
  ...missionCompletionStates,
  'layout-approval': wait('Approve one exact layout direction and complete page set.', 'OK LAYOUT <id>', 'REJECT LAYOUT <id>', [
    e({ stage: 'layout.review', status: 'approved' }, 'mission-impact'),
    e({ stage: 'layout.review', status: 'rejected' }, 'layout')
  ]),
  'product-proof': op('fe/product-proof', [
    e({ stage: 'proof.review', status: 'complete' }, 'mission-proof'),
    e({ stage: 'code.repair', status: 'repair' }, 'implementation'),
    e({ stage: 'layout.review', status: 'rejected' }, 'layout'),
    e({ stage: 'proof.review', status: 'blocked' }, 'blocked')
  ])
};

const blockMissionStates = {
  ...frontendStates,
  ...missionFreshnessStates('block-reconcile'),
  ...missionBackendStates('block-consumer-align'),
  ...missionCompletionStates,
  'block-feedback-request': op('fe/feedback-request', decided({ recorded: 'mission-route', blocked: 'blocked' })),
  'block-approval': wait('Approve the exact Block reconciliation and closed consumer boundary.', 'OK BLOCK <hash>', 'REJECT BLOCK <hash>', [
    e({ stage: 'fe.block.review', status: 'approved' }, 'mission-impact'),
    e({ stage: 'fe.block.review', status: 'rejected' }, 'rejected')
  ]),
  'reconcile-product-proof': op('fe/product-proof', [
    e({ stage: 'proof.review', status: 'complete' }, 'mission-proof'),
    e({ stage: 'code.repair', status: 'repair' }, 'reconcile-repair-handoff'),
    e({ stage: 'layout.review', status: 'rejected' }, 'reconcile-authority-handoff'),
    e({ stage: 'proof.review', status: 'blocked' }, 'blocked')
  ])
};

const maintenanceMissionStates = {
  ...frontendStates,
  ...missionFreshnessStates('mission-impact'),
  ...missionBackendStates('maintenance-apply'),
  ...missionCompletionStates,
  'mission-business-reconcile': op('business/reconcile', decided({ implemented: 'learning-request', discrepancy: 'blocked' })),
  'maintenance-feedback-request': op('fe/feedback-request', decided({ recorded: 'mission-route', blocked: 'blocked' })),
  'maintenance-product-proof': op('fe/product-proof', [
    e({ stage: 'proof.review', status: 'complete' }, 'mission-proof'),
    e({ stage: 'code.repair', status: 'repair' }, 'maintenance-repair-handoff'),
    e({ stage: 'layout.review', status: 'rejected' }, 'maintenance-authority-handoff'),
    e({ stage: 'proof.review', status: 'blocked' }, 'blocked')
  ])
};

const surfaceMissionStates = {
  ...frontendStates,
  ...missionFreshnessStates('surface-audit'),
  ...missionBackendStates('authority-reconcile'),
  ...missionCompletionStates,
  'surface-feedback-request': op('fe/feedback-request', decided({ recorded: 'mission-route', blocked: 'blocked' })),
  'authority-approval': wait('Approve the smallest durable design authority and closed consumer set.', 'OK AUTHORITY <hash>', 'REJECT AUTHORITY <hash>', [
    e({ stage: 'fe.authority.review', status: 'approved' }, 'mission-impact'),
    e({ stage: 'fe.authority.review', status: 'rejected' }, 'surface-audit')
  ]),
  'reconcile-product-proof': op('fe/product-proof', [
    e({ stage: 'proof.review', status: 'complete' }, 'mission-proof'),
    e({ stage: 'code.repair', status: 'repair' }, 'reconcile-repair-handoff'),
    e({ stage: 'layout.review', status: 'rejected' }, 'reconcile-authority-handoff'),
    e({ stage: 'proof.review', status: 'blocked' }, 'blocked')
  ])
};

const frontendQualityAuditStates = {
  audit: op('test/ui-quality-audit', decided({ 'delivery-pass': 'blocked', 'delivery-in-boundary': 'blocked', 'delivery-boundary-drift': 'blocked', 'audit-pass': 'complete', 'audit-findings': 'findings', blocked: 'blocked' })),
  findings: terminal('complete'),
  complete: terminal('complete'),
  blocked: terminal('blocked')
};

const qualityStates = {
  diagnose: op('quality/workflow-diagnose', decided({ diagnosed: 'complete', inconclusive: 'blocked', 'external-blocker': 'blocked' })),
  inventory: op('quality/readiness-inventory', decided({ green: 'complete', findings: 'repair-approval', blocked: 'blocked' })),
  'repair-approval': wait('Approve one exact measured finding and repair boundary.', 'OK REPAIR <finding>', 'REJECT REPAIR <finding>', [e({ stage: 'quality.repair.review', status: 'approved' }, 'repair'), e({ stage: 'quality.repair.review', status: 'rejected' }, 'rejected')]),
  repair: op('quality/finding-repair', decided({ repaired: 'inventory', 'stale-finding': 'inventory', 'boundary-drift': 'blocked', 'external-blocker': 'blocked' })),
  'debt-approval': wait('Approve the exact debt identity, baseline, closure criterion and bounded iteration budget.', 'OK DEBT <hash>', 'REJECT DEBT <hash>', [e({ stage: 'quality.debt.review', status: 'approved' }, 'debt'), e({ stage: 'quality.debt.review', status: 'rejected' }, 'rejected')]),
  debt: op('quality/debt-repay', decided({ closed: 'complete', progress: 'debt', 'closure-candidate': 'debt-proof', blocked: 'blocked' })),
  'debt-proof': op('quality/readiness-inventory', decided({ green: 'debt-close', findings: 'debt-approval', blocked: 'blocked' })),
  'debt-close': op('quality/debt-repay', decided({ closed: 'complete', progress: 'blocked', 'closure-candidate': 'blocked', blocked: 'blocked' })),
  bindings: op('quality/rule-binding-check', decided({ pass: 'complete', fail: 'findings', blocked: 'blocked' })),
  findings: terminal('complete'),
  complete: terminal('complete'), rejected: terminal('rejected'), blocked: terminal('blocked')
};

const qualityFindingStates = {
  ...qualityStates,
  repair: op('quality/finding-repair', decided({ repaired: 'finding-proof', 'stale-finding': 'finding-proof', 'boundary-drift': 'blocked', 'external-blocker': 'blocked' })),
  'finding-proof': op('quality/readiness-inventory', decided({ green: 'complete', findings: 'residual-findings', blocked: 'blocked' })),
  'residual-findings': terminal('handoff')
};

const deploymentStates = {
  route: op('workspace/route-verify', routeEdges('intent')),
  intent: op('deployment/intent-bind', decided({ ready: 'manifest' })),
  manifest: op('deployment/manifest-validate', decided({ ready: 'plan' })),
  plan: op('deployment/execution-plan', decided({ execute: 'execution-root', 'approval-required': 'approval', blocked: 'blocked' })),
  approval: wait('Approve only new host/domain/tenant/project/destructive/rotation deployment boundary.', 'OK DEPLOY <hash>', 'REJECT DEPLOY <hash>', [e({ stage: 'deployment.review', status: 'approved' }, 'execution-root'), e({ stage: 'deployment.review', status: 'rejected' }, 'rejected')]),
  'execution-root': op('deployment/execution-root-init', decided({ ready: 'credentials' })),
  credentials: op('deployment/credential-resolve', decided({ ready: 'host' })),
  host: op('deployment/host-prepare', decided({ ready: 'artifact-build' })),
  'artifact-build': op('deployment/artifact-build', decided({ ready: 'artifact-publish' })),
  'artifact-publish': op('deployment/artifact-publish', decided({ ready: 'migration' })),
  migration: op('deployment/migration', decided({ applied: 'domain', 'not-applicable': 'domain', rollback: 'rollback', blocked: 'blocked' })),
  domain: op('deployment/domain-reconcile', decided({ ready: 'rollout' })),
  rollout: op('deployment/rollout', decided({ ready: 'monitor', partial: 'blocked', 'external-error': 'blocked', blocked: 'blocked' })),
  monitor: op('deployment/monitor', decided({ progressing: 'monitor', 'external-error': 'monitor', steady: 'proof', recover: 'recover', rollback: 'rollback', blocked: 'blocked' })),
  recover: op('deployment/recover', decided({ retry: 'monitor', rollback: 'rollback', 'approval-required': 'recovery-approval', blocked: 'blocked' })),
  'recovery-approval': wait('Approve the exact recovery boundary.', 'OK DEPLOY <hash>', 'REJECT DEPLOY <hash>', [e({ stage: 'deployment.review', status: 'approved' }, 'recover'), e({ stage: 'deployment.review', status: 'rejected' }, 'rejected')]),
  rollback: op('deployment/rollback', decided({ 'rolled-back': 'proof', partial: 'blocked', 'external-error': 'blocked', blocked: 'blocked' })),
  proof: op('deployment/proof', decided({ complete: 'reconcile-choice', 'rolled-back': 'rolled-back', 'external-error': 'blocked', blocked: 'blocked' })),
  'reconcile-choice': choice([e({ inputEquals: { 'options.reconcileBusiness': true } }, 'business-reconcile'), e({ inputEquals: { 'options.reconcileBusiness': false } }, 'complete')]),
  'business-reconcile': op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' })),
  complete: terminal('complete'), 'rolled-back': terminal('rolled-back'), rejected: terminal('rejected'), blocked: terminal('blocked')
};

const deploymentFollowupStates = {
  monitor: op('deployment/monitor', decided({ progressing: 'monitor', 'external-error': 'monitor', steady: 'proof', recover: 'recover', rollback: 'rollback', blocked: 'blocked' })),
  recover: op('deployment/recover', decided({ retry: 'monitor', rollback: 'rollback', 'approval-required': 'recovery-approval', blocked: 'blocked' })),
  'recovery-approval': wait('Approve the exact recovery boundary.', 'OK DEPLOY <hash>', 'REJECT DEPLOY <hash>', [e({ stage: 'deployment.review', status: 'approved' }, 'recover'), e({ stage: 'deployment.review', status: 'rejected' }, 'rejected')]),
  rollback: op('deployment/rollback', decided({ 'rolled-back': 'proof', partial: 'blocked', 'external-error': 'blocked', blocked: 'blocked' })),
  proof: op('deployment/proof', decided({ complete: 'reconcile-choice', 'rolled-back': 'rolled-back', 'external-error': 'blocked', blocked: 'blocked' })),
  'reconcile-choice': choice([e({ inputEquals: { 'options.reconcileBusiness': true } }, 'business-reconcile'), e({ inputEquals: { 'options.reconcileBusiness': false } }, 'complete')]),
  'business-reconcile': op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' })),
  complete: terminal('complete'), 'rolled-back': terminal('rolled-back'), rejected: terminal('rejected'), blocked: terminal('blocked')
};

const platformStates = {
  'tunnel-plan': op('platform/tunnel-plan', decided({ ready: 'tunnel-apply' })),
  'tunnel-apply': op('platform/tunnel-apply', decided({ proved: 'complete', blocked: 'blocked' })),
  'mcp-config': op('platform/mcp-config', decided({ ready: 'source-index' })),
  'source-index': op('platform/source-index', decided({ ready: 'mcp-publish-choice', blocked: 'blocked' })),
  'mcp-publish-choice': choice([e({ inputEquals: { 'options.publishPublic': false } }, 'complete'), e({ inputEquals: { 'options.publishPublic': true, 'options.ensureTunnel': false } }, 'mcp-publish'), e({ inputEquals: { 'options.publishPublic': true, 'options.ensureTunnel': true } }, 'mcp-tunnel-plan')]),
  'mcp-tunnel-plan': op('platform/tunnel-plan', decided({ ready: 'mcp-tunnel-apply' })),
  'mcp-tunnel-apply': op('platform/tunnel-apply', decided({ proved: 'mcp-publish', blocked: 'blocked' })),
  'mcp-publish': op('platform/mcp-publish', decided({ proved: 'complete', blocked: 'blocked' })),
  sonar: op('platform/sonar-service-reconcile', decided({ proved: 'complete', blocked: 'blocked' })),
  observability: op('platform/observability-reconcile', decided({ proved: 'complete', blocked: 'blocked' })),
  complete: terminal('complete'), blocked: terminal('blocked')
};

const sourceIndexStates = {
  ...platformStates,
  'mcp-config': op('platform/mcp-config', decided({ ready: 'index-kind-choice' })),
  'index-kind-choice': choice([
    e({ inputEquals: { 'options.indexReferences': true } }, 'reference-reindex'),
    e({ inputEquals: { 'options.indexReferences': false } }, 'source-index')
  ]),
  'reference-reindex': op('platform/reference-reindex', decided({ ready: 'mcp-publish-choice', blocked: 'blocked' }))
};

const conversationStates = {
  record: op('source/conversation-record', decided({ recorded: 'complete' })),
  query: op('source/conversation-query', decided({ found: 'complete', empty: 'complete' })),
  complete: terminal('complete')
};

const deployOptions = { reconcileBusiness: { type: 'boolean', description: 'Reconcile final proof into the business head.' } };
const backendOptions = { deploymentMode: { enum: ['none', 'handoff'], description: 'Stop after source proof or hand off to deployment.' } };
const repairOptions = { deploymentMode: backendOptions.deploymentMode };

const domainContextMatrices = {
  workspace: [
    ['identity + freshness checks', 'project id, repository root, commit, config hashes and receipt headers', 'business bodies, Qdrant bodies, product source bodies'],
    ['initialize one stale layer', 'only that layer manifest and exact initializer contract', 'later workspace layers and product context'],
    ['route verification', 'compiled route refs and hash metadata', 'business, design, source and deployment context']
  ],
  business: [
    ['route + freshness', 'project route, source commit, business baseline and generator/schema hashes', 'business body, Qdrant bodies and product source'],
    ['evidence normalization', 'exact declared evidence only', 'frontend/backend implementation and unrelated feature evidence'],
    ['model + review', 'normalized evidence, lifecycle law and current feature head', 'repository source and unrelated business heads'],
    ['publish or reconcile', 'approved revision or frozen pre-delivery receipt plus delivery proof', 'mutable session plans and broad source scans']
  ],
  architecture: [
    ['route + business freshness', 'route, commits, hashes and receipt headers', 'raw source and unrelated business bodies'],
    ['frame + current state', 'exact business projection, canonical coding-context candidates and architecture law', 'raw source files and whole indexes'],
    ['alternatives + challenge', 'frozen constraints and two-to-four candidate summaries', 'reloading business, source or unrelated knowledge'],
    ['selection + handoff', 'option-set hash, selected decision and approval receipt', 'unselected bodies and new discovery']
  ],
  backend: [
    ['route + freshness', 'route, source commit, authority and coding-context hash metadata', 'business bodies, raw source and Qdrant bodies'],
    ['architecture + boundary planning', 'exact business projection, canonical coding-context records and narrow operator knowledge', 'raw source files, whole indexes and unrelated modules'],
    ['approval + coding-scope freeze', 'plan hash, source HEAD and exact target path/hash headers', 'file bodies and repository scans'],
    ['implementation', 'approved boundary, exact frozen files and be.implementation knowledge', 'undeclared files, broad Qdrant and adjacent business'],
    ['quality + proof + reconcile', 'changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof', 'new design context and unfrozen source discovery']
  ],
  frontendMaintenance: [
    ['route + target verification', 'project route, approved target refs, source/contract hashes and receipt headers', 'business bodies, broad Qdrant and repository scans'],
    ['audit or reconcile', 'exact component/surface contracts, selected Grammar pair and closed consumer refs', 'other Grammar packages, unrelated consumers and raw business context'],
    ['approval + mutation', 'frozen decision hash, exact files and approval receipt', 'new discovery, undeclared files and scope expansion'],
    ['proof + learning', 'changed-file receipts, focused checks and one durable learning request', 'session scratch and unrelated design history']
  ],
  quality: [
    ['diagnosis or inventory', 'declared command fingerprints, cached green receipts and exact failing evidence', 'unrelated source, broad Qdrant and speculative fixes'],
    ['approval', 'one finding/debt identity, baseline, boundary and approval hash', 'source bodies and other findings'],
    ['repair', 'only approved exact files and narrow repair law', 'scope expansion, unrelated findings and whole-repository scans'],
    ['verification + loop', 'independent proof, prior fingerprint, loop counter and residual identity', 'stale observations and reloaded unrelated context']
  ],
  deployment: [
    ['intent + plan', 'release, manifest, provider and environment metadata', 'credentials, product source and unrelated provider inventory'],
    ['approval + apply', 'frozen plan, exact approval and opaque credential handles', 'raw secrets, new discovery and undeclared resources'],
    ['monitor', 'same release identity, declared probes, attempt counter and backoff metadata', 'new deployment context and unrelated telemetry'],
    ['recover or rollback', 'observed failure, bounded action plan and mutation receipts', 'different release targets and business reconciliation'],
    ['proof + reconcile', 'public steady/rolled-back proof and frozen business receipt when eligible', 'raw credentials and mutable intermediate plans']
  ],
  platform: [
    ['inspect + plan', 'exact service identities, current revisions and declared target metadata', 'product source, broad provider discovery and raw credentials'],
    ['approval + apply', 'frozen delta, approval receipt and opaque handles', 'undeclared resources and new context'],
    ['proof or partial recovery', 'declared probes, before/after receipts and bounded retry state', 'adjacent services and unrelated tenant data']
  ],
  conversation: [
    ['record', 'redacted snapshot refs, provider-neutral identity and append head metadata', 'raw transcript, prompts, secrets and product reasoning'],
    ['query', 'bounded conversation identity, authorized index metadata and returned refs', 'raw transcript bodies and unrelated conversations']
  ]
};

const flows = [
  {
    id: 'workspace-ready', display: 'StarCi Workspace Ready', short: 'Prepare and verify a routed StarCi workspace', entry: 'identity', states: workspaceStates, options: {},
    description: 'Use when a StarCi Source must be initialized or brought to one fully verified workspace-ready state before product work. Do not use for business modeling, implementation, quality repair, or deployment.',
    checks: ['Resolve Source identity and the exact workspace boundary.', 'Verify bootstrap, declarations, routes, worktree and final route as one readiness flow.', 'Reject undeclared paths or targets outside the workspace.']
  },
  {
    id: 'device-checkpoint', display: 'StarCi Device Checkpoint', short: 'Push proven work and encrypted local service state', entry: 'route', states: deviceCheckpointStates, options: {},
    description: 'Use when the user explicitly stops, ends, or checkpoints current StarCi work and wants proven source heads plus encrypted local Docker service state synchronized to another trusted device. Do not use for ordinary commits, deployment, unapproved external publication, or destructive restore.',
    checks: ['Resolve one verified project-role route and the exact mission-owned checkout set.', 'Require explicit stop/checkpoint authority for source pushes and private release publication.', 'Block dirty, behind, diverged, detached or force-push source state.', 'Quiesce every Source-declared Docker volume, stream encrypted archives, restart containers and prove one complete private release manifest.']
  },
  {
    id: 'business-authority', display: 'StarCi Business Authority', short: 'Model and publish approved StarCi business truth', entry: 'route', states: businessStates, options: {},
    description: 'Use when evidence-backed business truth must be modeled, approved, and published as one feature head. Do not use to reconcile delivered source, implement product code, or make architecture decisions.',
    checks: ['Resolve one feature head, lifecycle state and immutable evidence set.', 'Confirm a new approved business revision is the requested outcome.', 'Reject product-source mutation or stale evidence.']
  },
  {
    id: 'business-reconcile', display: 'StarCi Business Reconcile', short: 'Reconcile delivered source with business truth', entry: 'reconcile-route', states: businessStates, options: {},
    description: 'Use when immutable delivery evidence must be reconciled against one published business feature head. Do not use to create a business model or implement source.',
    checks: ['Resolve one published business head and one delivery proof.', 'Verify both identities belong to the same feature boundary.', 'Reject missing proof or any requested source mutation.']
  },
  {
    id: 'architecture-decide', display: 'StarCi Architecture Decide', short: 'Resolve difficult cross-system architecture choices', entry: 'route', states: architectureStates, options: {},
    description: 'Use only for a genuinely difficult cross-system architecture choice with material alternatives or irreversible tradeoffs. Do not use for ordinary known-shape planning or implementation.',
    checks: ['Confirm a material cross-system decision exists.', 'Resolve its question, constraints, current evidence and system boundary.', 'Reject ordinary work with no meaningful alternative.']
  },
  {
    id: 'backend-delivery', display: 'StarCi Backend Delivery', short: 'Plan, implement, and prove backend delivery', entry: 'route', states: backendStates, options: backendOptions,
    description: 'Use to plan, approve, implement, test, and prove one new backend delivery from current business authority. Do not use for a pre-approved repair, frontend work, standalone diagnosis, or deployment.',
    checks: ['Resolve business authority, target module, permitted write roots and evidence freshness.', 'Confirm this is new delivery rather than a pre-approved repair.', 'Choose architecture depth and deployment handoff explicitly.']
  },
  {
    id: 'backend-repair', display: 'StarCi Backend Repair', short: 'Repair one approved backend source boundary', entry: 'route', states: backendRepairStates, options: repairOptions,
    description: 'Use to resume one already approved in-boundary backend repair and rerun independent quality proof. Do not use for new feature planning, unapproved boundary changes, frontend work, or deployment.',
    checks: ['Resolve the approved plan hash, finding and current source baseline.', 'Confirm every write remains inside the approved backend boundary.', 'Route source or boundary drift back to planning.']
  },
  {
    id: 'frontend-layout-delivery', display: 'StarCi Journey Delivery', short: 'Ship complete cross-stack product journeys', entry: 'layout-feedback-request', states: layoutMissionStates,
    options: {
      directionCount: { enum: [3, 4], description: 'Generate exactly three or four materially distinct customer journeys.' },
      selectionPolicy: { enum: ['manual', 'auto-recommended'], description: 'Wait for explicit journey approval or bind the recommended direction automatically.' }
    },
    description: 'Use to create or substantially redesign and ship one complete customer journey. Own every required business, backend, frontend and proof layer while skipping roles proven unaffected. Do not use for isolated blocks, approved maintenance, learning resolution, or cross-surface consistency.',
    checks: ['Capture the feedback session with explicit accepts and rejects in .claude/requests before route work.', 'Resolve the complete page set and every routed source role without loading product context.', 'Confirm this is journey-level work, bind the selected Grammar package and classify backend impact from approved business behavior.', 'Require backend source proof when impacted plus seeded unit, E2E, UI-quality, real-browser acceptance, joined mission proof and business reconciliation before completion.'],
    contextMatrix: [
      ['route + staleness', 'route, commit, revision, receipt and hash metadata', 'business body, Qdrant bodies, source files'],
      ['business initialize', 'exact evidence and business lifecycle law only after stale decision', 'frontend knowledge and coding context'],
      ['preflight', 'request, route and fresh-business receipt headers', 'all semantic bodies'],
      ['customer journey', 'fresh business journey projection + fe.customer-journey', 'Principles, Grammar, coding context, raw source'],
      ['page + state', 'selected journey + exact business slice + one operator law', 'other directions and source'],
      ['context sync', 'metadata first; changed generated JSON/knowledge only on hash miss', 'unchanged bodies and model-visible raw source'],
      ['source fit + Principles + layout + Grammar', 'approved session refs + exact Qdrant records + canonical JSON candidates', 'whole indexes, unrelated features, raw source'],
      ['role impact + backend delivery', 'approved mission, fresh business head, route metadata, exact backend boundary and declared quality receipts', 'unaffected roles, broad source discovery and partial backend proof'],
      ['coding scope freeze', 'approved refs, canonical candidate records, exact file headers', 'file bodies and repository scans'],
      ['implementation + proof', 'only frozen exact files, complete proof matrix, deterministic seeds, declared commands, browser/account handles and sanitized receipts for every state and viewport', 'partial proof, skipped scenarios, raw credentials, undeclared files, broad Qdrant and unrelated business']
    ]
  },
  {
    id: 'frontend-quality-audit', display: 'StarCi Frontend Quality Audit', short: 'Audit bounded UI quality with executable evidence', entry: 'audit', states: frontendQualityAuditStates, options: {},
    description: 'Use to audit one verified frontend surface set against StarCi-owned product-neutral UI quality rules and return evidence-linked findings without changing source. Do not use for journey design, source repair, design-authority reconciliation, or delivery proof.',
    checks: ['Resolve one verified frontend route and closed surface set.', 'Require an executable browser target and explicit viewport and state coverage.', 'Keep the audit check-only and reject implied source repair or business interpretation.'],
    contextMatrix: [
      ['audit', 'verified route receipt, closed surface refs, exact browser target, pinned fe.ui-quality-review knowledge and task-session evidence', 'business bodies, broad source context, external skill runtime and undeclared surfaces'],
      ['terminal', 'quality receipt and evidence-linked rule findings only', 'screenshots, traces, raw observations and source mutations']
    ]
  },
  {
    id: 'frontend-block-reconcile', display: 'StarCi Block Reconcile', short: 'Reconcile one product block across all roles', entry: 'block-feedback-request', states: blockMissionStates, options: {},
    description: 'Use when one existing product block or component contract must be reconciled across its closed consumers and every affected backend/frontend role, then proven end to end. Do not use for complete journey design, ordinary maintenance, learning resolution, or broad cross-surface authority changes.',
    checks: ['Capture the feedback session with explicit accepts and rejects in .claude/requests before reconciliation.', 'Resolve exactly one block contract, its closed consumer set, fresh business head and complete acceptance proof matrix.', 'Classify role impact and require backend boundary approval and proof when the block changes persisted or server-owned behavior.', 'Require complete unit, E2E, UI-quality, browser, joined mission proof and business reconciliation; reject journey redesign or unbounded consumer discovery.'],
    contextMatrix: [
      ['block plan', 'one Block identity, current contract generation, closed consumers and proof-plan headers', 'unrelated blocks, broad source and raw business context'],
      ['approval + consumer mutation', 'frozen reconciliation hash, exact consumer files, approval receipt and complete acceptance-plan identity', 'undeclared consumers, new design discovery and scope expansion'],
      ['proof', 'change-set receipt, deterministic seed/reset, declared commands, UI-quality receipt, browser/account handles and complete state-and-viewport evidence', 'partial proof, skipped scenarios, raw credentials and unrelated design history']
    ]
  },
  {
    id: 'frontend-maintenance-apply', display: 'StarCi Product Maintenance', short: 'Apply approved maintenance across affected roles', entry: 'maintenance-feedback-request', states: maintenanceMissionStates, options: {},
    description: 'Use to apply one already approved source-first product maintenance change across every affected backend/frontend role and prove the mission end to end. Do not use for design exploration, unapproved feedback, or cross-surface authority selection.',
    checks: ['Capture the feedback session with explicit accepts and rejects in .claude/requests before source mutation.', 'Resolve approved feedback, fresh business head, exact routed role boundaries and a complete acceptance proof matrix.', 'Classify role impact before mutation and require backend planning and proof when server-owned behavior changes.', 'Require complete unit, E2E, UI-quality, browser, joined mission proof and business reconciliation before recording the durable learning request.'],
    contextMatrix: [
      ['route + target verification', 'project route, approved target refs, source/contract hashes and receipt headers', 'business bodies, broad Qdrant and repository scans'],
      ['audit or reconcile', 'exact component/surface contracts, selected Grammar pair and closed consumer refs', 'other Grammar packages, unrelated consumers and raw business context'],
      ['approval + mutation', 'frozen decision hash, exact files, approval receipt and complete acceptance-plan identity', 'new discovery, undeclared files and scope expansion'],
      ['proof + learning', 'changed-file receipt, approved proof matrix, deterministic seed, declared unit/E2E commands, UI-quality receipt, browser/account handles, complete state-and-viewport proof and one durable learning request', 'partial proof, skipped scenarios, raw credentials, session scratch and unrelated design history']
    ]
  },
  {
    id: 'frontend-request-review', display: 'StarCi Frontend Request Review', short: 'Approve or reject one feedback ledger entry', entry: 'request-review', states: frontendStates, options: {},
    description: 'Use only to durably approve or reject one exact `.claude/requests/*.request.json` frontend feedback ledger with bounded priority before learning resolution. Do not use to resolve authority, mutate product source, or bypass evidence because a request is urgent.',
    checks: ['Resolve exactly one .claude/requests identity and current revision.', 'Require an explicit approve or reject decision, bounded owners, durable rationale and evidence hash.', 'Treat urgent as queue priority only; never relax proof or ownership.', 'Emit an approved request for learning resolution without mutating .claude, Grammar or product source.'],
    contextMatrix: [
      ['request review', 'one durable request, its feedback-session ledger, current proof status and explicit review evidence', 'other requests, raw transcripts and unrelated source'],
      ['decision persistence', 'exact request target, bounded owners, priority, rationale and decision hash', 'authority mutation, product mutation and owner expansion']
    ]
  },
  {
    id: 'frontend-learning-resolve', display: 'StarCi Frontend Learning Resolve', short: 'Resolve one queued frontend design learning', entry: 'learning-resolve', states: frontendStates, options: {},
    description: 'Use to resolve one durably approved frontend design learning request into its declared authority. Do not use to review requests, apply ordinary feedback, redesign a journey, or reconcile consumers.',
    checks: ['Require one request approved by starci-frontend-request-review and bind its exact revision.', 'Resolve the approved learning identity and proposed authority.', 'Confirm evidence is current and bounded.', 'Reject unreviewed requests, ordinary maintenance or unrelated source work.']
  },
  {
    id: 'frontend-surface-reconcile', display: 'StarCi Surface Reconcile', short: 'Align closed product surfaces across all roles', entry: 'surface-feedback-request', states: surfaceMissionStates, options: {},
    description: 'Use when a closed set of product surfaces must converge on the smallest durable authority and every affected backend/frontend consumer, then pass complete end-to-end proof. Do not use for a single block, isolated maintenance, or a new customer journey.',
    checks: ['Capture the feedback session with explicit accepts and rejects in .claude/requests before reconciliation.', 'Resolve the closed surface set, fresh business head, inconsistency evidence and complete acceptance proof matrix.', 'Identify the smallest authority and classify role impact, with explicit authority and any required backend boundary approval before mutation.', 'Require complete unit, E2E, UI-quality, browser, joined mission proof and business reconciliation before completion.'],
    contextMatrix: [
      ['surface audit + authority', 'closed surface IDs, current authority/consumer revisions, observed inconsistency and proof-plan headers', 'unrelated surfaces, broad source and raw business context'],
      ['approval + reconcile', 'frozen authority hash, exact authority and consumer targets, approval receipt and complete acceptance-plan identity', 'undeclared consumers, new discovery and scope expansion'],
      ['proof', 'joined authority/source change receipt, deterministic seed/reset, declared commands, UI-quality receipt, browser/account handles and complete state-and-viewport evidence', 'partial proof, skipped scenarios, raw credentials and unrelated design history']
    ]
  },
  {
    id: 'workflow-diagnose', display: 'StarCi Workflow Diagnose', short: 'Trace one failing workflow without mutation', entry: 'diagnose', states: qualityStates, options: {},
    description: 'Use to find why one workflow fails and return a report-only diagnosis without changing source or external state. Do not use for readiness inventory, approved repair, quality debt, or rule-binding audit.',
    checks: ['Resolve one failing workflow and observed symptom.', 'Keep the boundary read-only.', 'Reject implied repair or an unbounded request.']
  },
  {
    id: 'quality-readiness', display: 'StarCi Quality Readiness', short: 'Inventory and close measured readiness findings', entry: 'inventory', states: qualityStates, options: {},
    description: 'Use to inventory one delivery boundary and loop through explicitly approved measured repairs until readiness is green. Do not use for diagnosis-only work, debt repayment, or rule-binding audit.',
    checks: ['Resolve one delivery boundary and required checks.', 'Separate measured findings from speculative improvements.', 'Require approval before every source repair.']
  },
  {
    id: 'quality-finding-repair', display: 'StarCi Quality Finding Repair', short: 'Repair one approved measured quality finding', entry: 'repair-approval', states: qualityFindingStates, options: {},
    description: 'Use to repair one already measured quality finding after confirming its exact approval boundary, then re-inventory the target. Do not use for broad readiness assessment, diagnosis, or debt repayment.',
    checks: ['Resolve one finding, baseline and repair target.', 'Require the exact approval before mutation.', 'Re-inventory after repair and stop on boundary drift.']
  },
  {
    id: 'quality-debt-repay', display: 'StarCi Quality Debt Repay', short: 'Repay one approved quality debt boundary', entry: 'debt-approval', states: qualityStates, options: {},
    description: 'Use to repay one declared and approved quality-debt item through a measured progress loop. Do not use for ordinary findings, diagnosis, readiness inventory, or feature delivery.',
    checks: ['Resolve one approved debt identity and closure criterion.', 'Confirm the permitted mutation boundary.', 'Reject undocumented cleanup or unrelated refactoring.']
  },
  {
    id: 'rule-binding-audit', display: 'StarCi Rule Binding Audit', short: 'Audit executable rule ownership and binding', entry: 'bindings', states: qualityStates, options: {},
    description: 'Use to audit whether declared rules have one accountable executable binding. Do not use to repair source, inventory readiness, diagnose a workflow, or repay debt.',
    checks: ['Resolve the declared rules and expected owners.', 'Keep the audit check-only.', 'Reject policy interpretation with no executable target.']
  },
  {
    id: 'deployment', display: 'StarCi Deployment', short: 'Adopt and deploy one immutable release', entry: 'route', states: deploymentStates, options: deployOptions,
    description: 'Use to adopt deployment intent when needed and execute one immutable release through public steady-state proof. Do not use merely to monitor, recover, or roll back an existing rollout.',
    checks: ['Resolve environment, manifest, artifact and provider identities.', 'Confirm a new rollout is the outcome.', 'Flag new resources, destructive changes and credential rotation for approval.']
  },
  {
    id: 'deployment-monitor', display: 'StarCi Deployment Monitor', short: 'Monitor one existing rollout to steady state', entry: 'monitor', states: deploymentFollowupStates, options: deployOptions,
    description: 'Use to watch one release that is already rolling out until steady state when observation is the starting action, continuing to recovery, rollback, or a bounded blocker only if evidence requires it. Do not use when recovery is already approved or to initiate a new deployment.',
    checks: ['Resolve one existing release and rollout identity.', 'Confirm observation is the starting action.', 'Keep recovery and rollback bound to the same release.']
  },
  {
    id: 'deployment-recover', display: 'StarCi Deployment Recover', short: 'Recover one observed failed rollout safely', entry: 'recover', states: deploymentFollowupStates, options: deployOptions,
    description: 'Use when recovery is the approved starting action for one observed failed rollout before any rollback, then monitor the same release to proof. Do not use for a new deployment or a speculative failure.',
    checks: ['Resolve one observed failure and release identity.', 'Confirm recovery stays inside its boundary.', 'Require approval for any expansion.']
  },
  {
    id: 'deployment-rollback', display: 'StarCi Deployment Rollback', short: 'Roll back one declared release identity', entry: 'rollback', states: deploymentFollowupStates, options: deployOptions,
    description: 'Use to roll back one declared failed or rejected release identity and prove the resulting state. Do not use to deploy, monitor, or attempt recovery first.',
    checks: ['Resolve release and rollback target identities.', 'Confirm rollback authority and expected state.', 'Reject an undeclared destructive target.']
  },
  {
    id: 'tunnel-reconcile', display: 'StarCi Tunnel Reconcile', short: 'Reconcile one bounded tunnel and DNS route', entry: 'tunnel-plan', states: platformStates, options: {},
    description: 'Use to reconcile one bounded HTTP tunnel and DNS route. Do not use for source indexing, Sonar, observability, product deployment, or unrelated Cloudflare work.',
    checks: ['Resolve account, tunnel, hostname and service target.', 'Confirm one HTTP route is the full boundary.', 'Require authority for public DNS mutation.']
  },
  {
    id: 'source-index-publish', display: 'StarCi Source Index Publish', short: 'Index and optionally publish StarCi context', entry: 'mcp-config', states: sourceIndexStates,
    options: {
      publishPublic: { type: 'boolean', description: 'Publish MCP through the declared public boundary.' },
      ensureTunnel: { type: 'boolean', description: 'Reconcile a tunnel before MCP publication.' },
      indexReferences: { type: 'boolean', description: 'Index clean local reference checkouts instead of business/generated-contract context.' }
    },
    description: 'Use to configure and index StarCi business, generated-contract, or clean .worktrees/references context, optionally publishing its MCP boundary. Do not use for product delivery, Sonar, observability, or a tunnel-only request.',
    checks: [
      'Resolve project and declared context inputs.',
      'Distinguish local indexing from public MCP mutation.',
      'Evaluate tunnel work only for public publication.',
      'For reference mode, resolve portable routes into clean .worktrees/references checkouts and require a versioned adaptive drift policy, Python Qdrant Edge, full-text/path lookup, optional embeddings, loopback Caddy, and ignored machine-local runtime state.'
    ],
    inputBoundary: 'This package owns one fixed-entry flow. Set `options.indexReferences=true` to select clean local reference indexing; false retains business/generated-contract indexing. No undeclared mode is accepted.'
  },
  {
    id: 'sonar-service-reconcile', display: 'StarCi Sonar Service Reconcile', short: 'Reconcile shared Sonar quality enforcement', entry: 'sonar', states: platformStates, options: {},
    description: 'Use to reconcile the shared Sonar service and its quality-enforcement boundary. Do not use to fix product findings, deploy releases, index context, or configure observability.',
    checks: ['Resolve service, project and enforcement identities.', 'Keep product repair outside this flow.', 'Require authority for external service mutation.']
  },
  {
    id: 'observability-reconcile', display: 'StarCi Observability Reconcile', short: 'Reconcile shared metrics and remote write', entry: 'observability', states: platformStates, options: {},
    description: 'Use to reconcile shared metrics collection and remote-write boundaries. Do not use for product diagnosis, deployment monitoring, Sonar, or context indexing.',
    checks: ['Resolve metrics source, tenant and remote-write target.', 'Distinguish service work from product diagnosis.', 'Require authority for external mutation.']
  },
  {
    id: 'conversation-record', display: 'StarCi Conversation Record', short: 'Record redacted conversation provenance safely', entry: 'record', states: conversationStates, options: {},
    description: 'Use only to append one provider-neutral redacted conversation-provenance snapshot head. Do not use to query provenance, store raw transcripts, or analyze product work.',
    checks: ['Resolve one conversation identity and redacted refs.', 'Reject raw transcripts or secrets.', 'Confirm append-only provenance is the outcome.']
  },
  {
    id: 'conversation-query', display: 'StarCi Conversation Query', short: 'Query bounded conversation provenance safely', entry: 'query', states: conversationStates, options: {},
    description: 'Use only to query one bounded provider-neutral conversation-provenance identity. Do not use to record a snapshot, retrieve raw transcripts, or analyze product work.',
    checks: ['Resolve one bounded conversation identity.', 'Reject raw transcript or secret retrieval.', 'Keep the flow read-only.']
  }
];

for (const flow of flows) {
  flow.id = `starci-${flow.id}`;
  if (flow.contextMatrix) continue;
  if (['starci-workspace-ready', 'starci-device-checkpoint'].includes(flow.id)) flow.contextMatrix = domainContextMatrices.workspace;
  else if (['starci-business-authority', 'starci-business-reconcile'].includes(flow.id)) flow.contextMatrix = domainContextMatrices.business;
  else if (flow.id === 'starci-architecture-decide') flow.contextMatrix = domainContextMatrices.architecture;
  else if (['starci-backend-delivery', 'starci-backend-repair'].includes(flow.id)) flow.contextMatrix = domainContextMatrices.backend;
  else if (flow.id.startsWith('starci-frontend-')) flow.contextMatrix = domainContextMatrices.frontendMaintenance;
  else if (flow.id.startsWith('starci-quality-') || ['starci-workflow-diagnose', 'starci-rule-binding-audit'].includes(flow.id)) flow.contextMatrix = domainContextMatrices.quality;
  else if (flow.id.startsWith('starci-deployment')) flow.contextMatrix = domainContextMatrices.deployment;
  else if (['starci-tunnel-reconcile', 'starci-source-index-publish', 'starci-sonar-service-reconcile', 'starci-observability-reconcile'].includes(flow.id)) flow.contextMatrix = domainContextMatrices.platform;
  else if (flow.id.startsWith('starci-conversation-')) flow.contextMatrix = domainContextMatrices.conversation;
}

for (const retired of ['starci-frontend-design-delivery', 'starci-platform-services', 'starci-conversation-provenance']) {
  rmSync(path.join(root, retired), { recursive: true, force: true });
}

const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const yamlString = (value) => JSON.stringify(value);

writeJson(path.join(root, 'catalog.json'), {
  schemaVersion: 6,
  skills: flows.map(({ id, description }) => ({ id, description }))
});

writeJson(path.resolve(root, '..', 'analyze-input.schema.json'), {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://starci.dev/v6/analyze-input.schema.json',
  type: 'object',
  additionalProperties: false,
  required: ['analyzerVersion', 'skillId', 'confidence', 'activeInputRefs', 'passiveContextRefs'],
  properties: {
    analyzerVersion: { const: 1 },
    skillId: { enum: flows.map(({ id }) => id) },
    confidence: { enum: ['exact', 'clarified'] },
    activeInputRefs: { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?![^:]+:(?:\\/\\/)?(?:entire-repository|whole-repository|all-history|all-source|\\*)$)[a-z][a-z0-9+.-]*:[^\\s]+$' } },
    passiveContextRefs: { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?![^:]+:(?:\\/\\/)?(?:entire-repository|whole-repository|all-history|all-source|\\*)$)[a-z][a-z0-9+.-]*:[^\\s]+$' } }
  }
});

for (const flow of flows) {
  const directory = path.join(root, flow.id);
  const agentDirectory = path.join(directory, 'agents');
  mkdirSync(agentDirectory, { recursive: true });
  const states = reachableSubgraph(flow.states, flow.entry);
  writeJson(path.join(directory, 'machine.json'), { $schema: '../machine.schema.json', schemaVersion: 6, id: flow.id, start: 'analyze-input', states });
  const optionProperties = Object.fromEntries(Object.entries(flow.options).map(([name, spec]) => [name, spec.enum ? { type: typeof spec.enum[0], enum: spec.enum } : { type: spec.type ?? 'string' }]));
  const reference = { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?![^:]+:(?:\\/\\/)?(?:entire-repository|whole-repository|all-history|all-source|\\*)$)[a-z][a-z0-9+.-]*:[^\\s]+$' };
  const receiptReference = { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?:receipt:sha256:[0-9a-f]{64}|session://tasks/[A-Za-z0-9._-]+/.+)$' };
  const referenceArray = (maxItems, minItems = 0) => ({ type: 'array', minItems, maxItems, uniqueItems: true, items: { ...reference } });
  const selectionSchema = { type: 'object', additionalProperties: false, required: ['analyzerVersion', 'skillId', 'confidence', 'activeInputRefs', 'passiveContextRefs'], properties: { analyzerVersion: { const: 1 }, skillId: { const: flow.id }, confidence: { enum: ['exact', 'clarified'] }, activeInputRefs: referenceArray(8, 1), passiveContextRefs: referenceArray(8) } };
  const inputSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `https://starci.dev/v6/skills/${flow.id}/input.schema.json`, type: 'object', additionalProperties: false, required: ['schemaVersion', 'runId', 'project', 'selection', 'requestRef', 'artifactRefs', 'evidenceRefs', 'scope', 'options'], allOf: [{ if: { properties: { scope: { properties: { externalMutation: { const: true } }, required: ['externalMutation'] } }, required: ['scope'] }, then: { properties: { scope: { properties: { approvalRef: { ...receiptReference } } } } } }], properties: { schemaVersion: { const: 6 }, runId: { type: 'string', minLength: 1, maxLength: 128 }, project: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 80 }, selection: selectionSchema, requestRef: { ...reference }, artifactRefs: referenceArray(64), evidenceRefs: referenceArray(64), scope: { type: 'object', additionalProperties: false, required: ['targetRefs', 'writeRoots', 'externalMutation', 'approvalRef'], properties: { targetRefs: referenceArray(64, 1), writeRoots: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 512, pattern: '^(?![\\/]|[A-Za-z]:[\\/])(?!.*(?:^|[\\/])\\.\\.(?:[\\/]|$)).+$' } }, externalMutation: { type: 'boolean' }, approvalRef: { anyOf: [{ ...receiptReference }, { type: 'null' }] } } }, options: { type: 'object', additionalProperties: false, required: Object.keys(optionProperties), properties: optionProperties } } };
  const terminalEntries = Object.entries(states).filter(([, state]) => state.kind === 'terminal');
  const terminalResults = [...new Set(terminalEntries.map(([, state]) => state.result))];
  const terminalStatus = (result) => result === 'complete' ? 'completed' : result;
  const terminalBranches = terminalEntries.map(([stateId, state]) => ({ properties: { result: { const: state.result }, finalState: { const: stateId }, state: { properties: { status: { const: terminalStatus(state.result) }, code: { const: `${flow.id}-${stateId}` }, retryable: { const: false }, terminalState: { const: stateId } }, required: ['status', 'code', 'retryable', 'terminalState'] } }, required: ['result', 'finalState', 'state'] }));
  const receiptArray = (maxItems, minItems = 0) => ({ type: 'array', minItems, maxItems, uniqueItems: true, items: { ...receiptReference } });
  const findingSchema = { type: 'object', additionalProperties: false, required: ['code', 'severity', 'message', 'evidenceRefs'], properties: { code: { type: 'string', pattern: '^[a-z0-9]+(?:[.-][a-z0-9]+)*$', maxLength: 120 }, severity: { enum: ['info', 'warning', 'error'] }, message: { type: 'string', minLength: 1, maxLength: 500 }, evidenceRefs: receiptArray(8) } };
  const outputSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `https://starci.dev/v6/skills/${flow.id}/output.schema.json`, type: 'object', additionalProperties: false, required: ['schemaVersion', 'runId', 'skillId', 'result', 'finalState', 'state', 'receiptRefs', 'findings', 'cleanup'], allOf: [{ oneOf: terminalBranches }], properties: { schemaVersion: { const: 6 }, runId: { type: 'string', minLength: 1, maxLength: 128 }, skillId: { const: flow.id }, result: { enum: terminalResults }, finalState: { enum: terminalEntries.map(([stateId]) => stateId) }, state: { type: 'object', additionalProperties: false, required: ['status', 'code', 'retryable', 'terminalState'], properties: { status: { enum: [...new Set(terminalResults.map(terminalStatus))] }, code: { enum: terminalEntries.map(([stateId]) => `${flow.id}-${stateId}`) }, retryable: { const: false }, terminalState: { enum: terminalEntries.map(([stateId]) => stateId) } } }, receiptRefs: receiptArray(64), findings: { type: 'array', maxItems: 20, uniqueItems: true, items: findingSchema }, cleanup: { type: 'object', additionalProperties: false, required: ['scratchRefs', 'retention', 'purgeAt'], properties: { scratchRefs: receiptArray(64), retention: { const: 'until-skill-terminal' }, purgeAt: { const: 'skill-terminal' } } } } };
  writeJson(path.join(directory, 'input.schema.json'), inputSchema);
  writeJson(path.join(directory, 'output.schema.json'), outputSchema);
  const checks = flow.checks.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const optionRows = Object.entries(flow.options).map(([name, spec]) => `| \`${name}\` | ${spec.enum ? spec.enum.map((item) => `\`${item}\``).join(' / ') : `\`${spec.type}\``} | ${spec.description} |`).join('\n') || '| — | — | No additional option is loaded. |';
  const contextRows = (flow.contextMatrix ?? []).map(([state, allowed, forbidden]) => `| \`${state}\` | ${allowed} | ${forbidden} |`).join('\n') || '| every state | current operator declaration only | undeclared context |';
  writeFileSync(path.join(directory, 'analyze-input.md'), `# Analyze ${flow.id} input\n\nGlobal \`@selection\` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify \`selection.skillId\` equals \`${flow.id}\`. Then perform these local checks:\n\n${checks}\n\nReject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.\n\nThe fixed first state is \`${flow.entry}\`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.\n\n## Options\n\n| Option | Values | Decision effect |\n| --- | --- | --- |\n${optionRows}\n`);
  writeFileSync(path.join(directory, 'input.md'), `# ${flow.id} input\n\nProvide one closed invocation validated by \`input.schema.json\`. The required \`selection\` object is the ephemeral output of global \`/analyze-input.md\`; it selects this skill directly. ${flow.inputBoundary ?? 'This package owns one fixed-entry flow and accepts no secondary mode.'}\n`);
  writeFileSync(path.join(directory, 'output.md'), `# ${flow.id} output\n\nReturn one terminal result bound to an exact machine terminal through \`state.status\`, \`state.code\`, and \`state.terminalState\`. Return only immutable receipt references and bounded evidence-linked findings. A handoff is explicit and never mislabeled complete. \`cleanup\` always purges task-session scratch at the skill terminal.\n`);
  writeFileSync(path.join(directory, 'execute.md'), `# Execute ${flow.id}\n\n1. Accept only a validated global \`selection\` for this skill, validate the complete input, run local \`analyze-input\`, then enter fixed state \`${flow.entry}\`.\n2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.\n3. Validate operator input, execute it, validate output, then route through exactly one matching edge.\n4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.\n5. Wait states stop before irreversible work and accept only the displayed revision or command.\n6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only approved product-source or external mutations.\n\n## CONTEXT BY STATE\n\n| State or phase | Allowed | Forbidden |\n| --- | --- | --- |\n${contextRows}\n`);
  writeFileSync(path.join(directory, 'SKILL.md'), `---\nname: ${flow.id}\ndescription: ${JSON.stringify(flow.description)}\n---\n\n# ${flow.id}\n\n${flow.description}\n\n## INPUT ANALYSIS\n\nRequire the ephemeral global selection, read \`input.md\`, validate \`input.schema.json\`, then follow local \`analyze-input.md\`. This skill owns one flow with fixed first state \`${flow.entry}\`; local analysis only validates and normalizes scope without loading operator knowledge.\n\n## STATE MACHINE\n\nExecute \`machine.json\` through \`execute.md\`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.\n\n## CONTEXT CONTRACT\n\n| State or phase | Allowed | Forbidden |\n| --- | --- | --- |\n${contextRows}\n`);
  writeFileSync(path.join(agentDirectory, 'openai.yaml'), `interface:\n  display_name: ${yamlString(flow.display)}\n  short_description: ${yamlString(flow.short)}\n  default_prompt: ${yamlString(`Use $${flow.id} for this selected flow and execute its state machine.`)}\npolicy:\n  allow_implicit_invocation: true\n`);
  writeFileSync(path.join(directory, 'validate-input.mjs'), `import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';\nexport const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url));\nif(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');\n`);
  writeFileSync(path.join(directory, 'validate-output.mjs'), `import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';\nexport const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{const errors=[];if(value.result==='complete'&&value.receiptRefs.length===0)errors.push('$.receiptRefs: completion requires evidence');if(value.finalState!==value.state.terminalState)errors.push('$.state.terminalState: must equal finalState');for(const finding of value.findings)if(finding.severity==='error'&&finding.evidenceRefs.length===0)errors.push('$.findings: error findings require evidence');return errors});\nif(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');\n`);
}

console.log(`materialized ${flows.length} one-flow state-machine skills`);
