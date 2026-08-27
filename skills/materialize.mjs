import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const e = (when, target, label) => ({ when, target, ...(label ? { label } : {}) });
const op = (ref, on) => ({ kind: 'operator', ref, on });
const choice = (on) => ({ kind: 'choice', on });
const wait = (prompt, approve, reject, on) => ({
  kind: 'wait',
  approval: { prompt, approve, reject, bypassTarget: on[0].target },
  on
});
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

const workflowHandoffStates = {
  route: op('workspace/route-verify', routeEdges('handoff')),
  handoff: op('workspace/workflow-handoff', decided({ published: 'complete', resumed: 'complete', blocked: 'blocked' })),
  complete: terminal('complete'),
  blocked: terminal('blocked')
};

const businessStates = {
  route: op('workspace/route-verify', routeEdges('evidence')),
  evidence: op('business/evidence-normalize', decided({ ready: 'model' })),
  model: op('business/model', decided({ ready: 'model-approval', revise: 'evidence', blocked: 'blocked' })),
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
  'decision-selection': wait('Review the rendered visualize comparison, then approve one exact architecture decision and option-set hash.', 'OK ARCHITECTURE <decision>', 'REJECT ARCHITECTURE <decision>', [e({ stage: 'architecture.decision.handoff', status: 'ready', allFacts: ['architecture-visual-preview-ready'] }, 'handoff'), e({ stage: 'architecture.decision.alternatives', status: 'ready' }, 'alternatives')]),
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
  'architecture-selection': wait('Review the rendered visualize comparison, then approve one exact architecture decision and option-set hash.', 'OK ARCHITECTURE <decision>', 'REJECT ARCHITECTURE <decision>', [e({ stage: 'architecture.decision.handoff', status: 'ready', allFacts: ['architecture-visual-preview-ready'] }, 'architecture-handoff'), e({ stage: 'architecture.decision.alternatives', status: 'ready' }, 'architecture-alternatives')]),
  'architecture-handoff': op('architecture/decision-handoff', decided({ ready: 'source-discovery' })),
  'source-discovery': op('architecture/source-discovery', decided({ ready: 'pattern-bind' })),
  'pattern-bind': op('architecture/pattern-bind', decided({ ready: 'boundary-plan' })),
  'boundary-plan': op('architecture/boundary-plan', decided({ ready: 'boundary-challenge' })),
  'boundary-challenge': op('architecture/boundary-challenge', decided({ clean: 'boundary-approval', revise: 'boundary-plan', blocked: 'blocked' })),
  'boundary-approval': wait('Approve the exact backend plan hash and file boundary.', 'OK BACKEND <hash>', 'REJECT BACKEND <hash>', [e({ stage: 'architecture.boundary.review', status: 'approved' }, 'coding-scope'), e({ stage: 'architecture.boundary.review', status: 'rejected' }, 'boundary-plan')]),
  'coding-scope': op('be/coding-scope-freeze', decided({ ready: 'coding-preflight', 'source-drift': 'boundary-plan', 'boundary-drift': 'boundary-plan', blocked: 'blocked' })),
  'coding-preflight': op('quality/coding-preflight', decided({ ready: 'implement', 'reference-gap': 'boundary-plan', blocked: 'blocked' })),
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
  'coding-scope': op('be/coding-scope-freeze', decided({ ready: 'coding-preflight', 'source-drift': 'replan-handoff', 'boundary-drift': 'replan-handoff', blocked: 'blocked' })),
  'coding-preflight': op('quality/coding-preflight', decided({ ready: 'implement', 'reference-gap': 'replan-handoff', blocked: 'blocked' })),
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
  'coding-scope': op('fe/coding-scope-freeze', [e({ stage: 'code.implement', status: 'ready' }, 'coding-preflight'), e({ stage: 'code.result', status: 'blocked' }, 'blocked')]),
  'coding-preflight': op('quality/coding-preflight', decided({ ready: 'implementation', 'reference-gap': 'blocked', blocked: 'blocked' })),
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
  'ship-architecture-selection': wait('Review the rendered visualize comparison, then approve the exact backend architecture required by this mission.', 'OK ARCHITECTURE <decision>', 'REJECT ARCHITECTURE <decision>', [
    e({ stage: 'architecture.decision.handoff', status: 'ready', allFacts: ['architecture-visual-preview-ready'] }, 'ship-architecture-handoff'),
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
  'ship-coding-scope': op('be/coding-scope-freeze', decided({ ready: 'ship-coding-preflight', 'source-drift': 'ship-boundary-plan', 'boundary-drift': 'ship-boundary-plan', blocked: 'blocked' })),
  'ship-coding-preflight': op('quality/coding-preflight', decided({ ready: 'ship-implement', 'reference-gap': 'ship-boundary-plan', blocked: 'blocked' })),
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
    "id": "workspace-ready",
    "display": "StarCi Workspace Ready",
    "short": "Prepare and verify a routed StarCi workspace",
    "entry": "identity",
    "states": {
      "identity": {
        "kind": "operator",
        "ref": "workspace/identity-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "bootstrap",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "bootstrap": {
        "kind": "operator",
        "ref": "workspace/bootstrap-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "declarations",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "declarations": {
        "kind": "operator",
        "ref": "workspace/declarations-compile",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "routes",
            "label": "ready"
          }
        ]
      },
      "routes": {
        "kind": "operator",
        "ref": "workspace/routes-hydrate",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "worktree",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "worktree": {
        "kind": "operator",
        "ref": "workspace/worktree-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "route",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "complete",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "routes",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use when a StarCi Source must be initialized or brought to one fully verified workspace-ready state before product work. Do not use for business modeling, implementation, quality repair, or deployment.",
    "checks": [
      "Resolve Source identity and the exact workspace boundary.",
      "Verify bootstrap, declarations, routes, worktree and final route as one readiness flow.",
      "Reject undeclared paths or targets outside the workspace."
    ]
  },
  {
    "id": "device-checkpoint",
    "display": "StarCi Device Checkpoint",
    "short": "Push proven work and encrypted local service state",
    "entry": "route",
    "states": {
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "checkpoint",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "checkpoint": {
        "kind": "operator",
        "ref": "workspace/device-checkpoint",
        "on": [
          {
            "when": {
              "decision": "published"
            },
            "target": "complete",
            "label": "published"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use when the user explicitly stops, ends, or checkpoints current StarCi work and wants proven source heads plus encrypted local Docker service state synchronized to another trusted device. Do not use for ordinary commits, deployment, unapproved external publication, or destructive restore.",
    "checks": [
      "Resolve one verified project-role route and the exact mission-owned checkout set.",
      "Require explicit stop/checkpoint authority for source pushes and private release publication.",
      "Block dirty, behind, diverged, detached or force-push source state.",
      "Quiesce every Source-declared Docker volume, stream encrypted archives, restart containers and prove one complete private release manifest."
    ]
  },
  {
    id: 'workflow-handoff',
    display: 'StarCi Workflow Handoff',
    short: 'Pause work in Git and resume it on another device',
    entry: 'route',
    states: workflowHandoffStates,
    options: {
      mode: {
        enum: ['publish', 'resume'],
        description: 'Publish a portable Git checkpoint or adopt one on the current device.'
      }
    },
    description: 'Use when the user explicitly wants to pause an active StarCi coding workflow, push a minimal continuation checkpoint to Git, or resume that exact checkpoint on another device. Do not use for ordinary commits, deployment, Docker-volume transfer, or storing prompts and reasoning.',
    checks: [
      'Resolve the exact mission-owned project-role routes and reject adjacent checkouts.',
      'Require explicit authority before creating commits, branches, tags, pushes, checkouts or worktrees.',
      'Persist only Git heads, the next capability and durable artifact references; never persist prompts, reasoning, loaded context, credentials or session scratch.',
      'On resume, verify the checkpoint tag, every repository identity and exact head before emitting the next capability.'
    ],
    inputBoundary: 'The mode is explicit: publish creates the portable checkpoint; resume verifies and adopts one exact checkpoint before emitting the next capability.'
  },
  {
    "id": "business-authority",
    "display": "StarCi Business Authority",
    "short": "Model and publish approved StarCi business truth",
    "entry": "route",
    "states": {
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "evidence",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "model",
            "label": "ready"
          }
        ]
      },
      "model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "model-approval",
            "label": "ready"
          }
        ]
      },
      "model-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the displayed business model revision and lifecycle transition.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "evidence"
          }
        ]
      },
      "publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "complete",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "complete",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "reconcile",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use when evidence-backed business truth must be modeled, approved, and published as one feature head. Do not use to reconcile delivered source, implement product code, or make architecture decisions.",
    "checks": [
      "Resolve one feature head, lifecycle state and immutable evidence set.",
      "Confirm a new approved business revision is the requested outcome.",
      "Reject product-source mutation or stale evidence."
    ]
  },
  {
    "id": "business-reconcile",
    "display": "StarCi Business Reconcile",
    "short": "Reconcile delivered source with business truth",
    "entry": "reconcile-route",
    "states": {
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "evidence",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "model",
            "label": "ready"
          }
        ]
      },
      "model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "model-approval",
            "label": "ready"
          }
        ]
      },
      "model-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the displayed business model revision and lifecycle transition.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "evidence"
          }
        ]
      },
      "publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "complete",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "complete",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "reconcile",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use when immutable delivery evidence must be reconciled against one published business feature head. Do not use to create a business model or implement source.",
    "checks": [
      "Resolve one published business head and one delivery proof.",
      "Verify both identities belong to the same feature boundary.",
      "Reject missing proof or any requested source mutation."
    ]
  },
  {
    "id": "frontend-quality-audit",
    "display": "StarCi Frontend Quality Audit",
    "short": "Audit bounded UI quality with executable evidence",
    "entry": "audit",
    "states": {
      "audit": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "blocked",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "blocked",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "blocked",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "complete",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "findings",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "findings": {
        "kind": "terminal",
        "result": "complete"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to audit one verified frontend surface set against StarCi-owned product-neutral UI quality rules and return evidence-linked findings without changing source. Do not use for journey design, source repair, design-authority reconciliation, or delivery proof.",
    "checks": [
      "Resolve one verified frontend route and closed surface set.",
      "Require an executable browser target and explicit viewport and state coverage.",
      "Keep the audit check-only and reject implied source repair or business interpretation."
    ],
    "contextMatrix": [
      [
        "audit",
        "verified route receipt, closed surface refs, exact browser target, pinned fe.ui-quality-review knowledge and task-session evidence",
        "business bodies, broad source context, external skill runtime and undeclared surfaces"
      ],
      [
        "terminal",
        "quality receipt and evidence-linked rule findings only",
        "screenshots, traces, raw observations and source mutations"
      ]
    ]
  },
  {
    "id": "frontend-block-reconcile",
    "display": "StarCi Block Reconcile",
    "short": "Reconcile one product block across all roles",
    "entry": "block-feedback-request",
    "states": {
      "request-review": {
        "kind": "operator",
        "ref": "fe/request-review",
        "on": [
          {
            "when": {
              "decision": "approved"
            },
            "target": "complete",
            "label": "approved"
          },
          {
            "when": {
              "decision": "rejected"
            },
            "target": "complete",
            "label": "rejected"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "layout-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "route",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "mission-route",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "maintenance-apply",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "surface-audit",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-staleness",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-staleness": {
        "kind": "operator",
        "ref": "business/staleness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "preflight",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "business-evidence",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-model",
            "label": "ready"
          }
        ]
      },
      "business-model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-approval",
            "label": "ready"
          }
        ]
      },
      "business-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve regenerated business authority before customer-journey work.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "business-publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "business-evidence"
          }
        ]
      },
      "business-publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "business-staleness",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "business-staleness",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "preflight": {
        "kind": "operator",
        "ref": "fe/preflight",
        "on": [
          {
            "when": {
              "stage": "flow.generate",
              "status": "ready"
            },
            "target": "journey"
          }
        ]
      },
      "journey": {
        "kind": "operator",
        "ref": "fe/customer-journey",
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "pending"
            },
            "target": "flow-approval"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          }
        ]
      },
      "flow-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact customer-journey direction.",
          "approve": "OK FLOW <id>",
          "reject": "REJECT FLOW <id>"
        },
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "rejected"
            },
            "target": "journey"
          }
        ]
      },
      "page-model": {
        "kind": "operator",
        "ref": "fe/page-model",
        "on": [
          {
            "when": {
              "stage": "state.generate",
              "status": "ready"
            },
            "target": "state"
          }
        ]
      },
      "state": {
        "kind": "operator",
        "ref": "fe/state",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "context-sync"
          },
          {
            "when": {
              "stage": "state.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "context-sync": {
        "kind": "operator",
        "ref": "fe/context-sync",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "source-fit"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "source-fit": {
        "kind": "operator",
        "ref": "fe/source-fit",
        "on": [
          {
            "when": {
              "stage": "principles.compile",
              "status": "ready"
            },
            "target": "principles"
          }
        ]
      },
      "principles": {
        "kind": "operator",
        "ref": "fe/principle-compile",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "layout.generate",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "layout": {
        "kind": "operator",
        "ref": "fe/layout",
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "pending"
            },
            "target": "layout-approval"
          }
        ]
      },
      "layout-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact layout direction and complete page set.",
          "approve": "OK LAYOUT <id>",
          "reject": "REJECT LAYOUT <id>"
        },
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "approved"
            },
            "target": "grammar"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          }
        ]
      },
      "grammar": {
        "kind": "operator",
        "ref": "fe/grammar-convergence",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "request-choice"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "request-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "allFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "allFacts": [
                "create-required"
              ],
              "noneFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "noneFacts": [
                "grammar-gap",
                "create-required"
              ]
            },
            "target": "coding-scope"
          }
        ]
      },
      "requests": {
        "kind": "operator",
        "ref": "fe/request-emission",
        "on": [
          {
            "when": {
              "stage": "request.result",
              "status": "ready"
            },
            "target": "coding-scope"
          },
          {
            "when": {
              "stage": "request.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "coding-scope": {
        "kind": "operator",
        "ref": "fe/coding-scope-freeze",
        "on": [
          {
            "when": {
              "stage": "code.implement",
              "status": "ready"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "implementation": {
        "kind": "operator",
        "ref": "fe/implementation",
        "on": [
          {
            "when": {
              "stage": "seed.materialize",
              "status": "ready"
            },
            "target": "seed"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "implementation",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "layout",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "complete"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "block-reconcile": {
        "kind": "operator",
        "ref": "fe/block-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "block-approval",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact Block reconciliation and closed consumer boundary.",
          "approve": "OK BLOCK <hash>",
          "reject": "REJECT BLOCK <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.block.review",
              "status": "approved"
            },
            "target": "mission-impact"
          },
          {
            "when": {
              "stage": "fe.block.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "block-consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-apply": {
        "kind": "operator",
        "ref": "fe/maintenance-apply",
        "on": [
          {
            "when": {
              "decision": "applied"
            },
            "target": "maintenance-seed",
            "label": "applied"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "maintenance-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "maintenance-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "maintenance-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "maintenance-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "maintenance-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "maintenance-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "maintenance-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "learning-request"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "maintenance-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "learning-request": {
        "kind": "operator",
        "ref": "fe/learning-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "complete",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "learning-resolve": {
        "kind": "operator",
        "ref": "fe/learning-resolve",
        "on": [
          {
            "when": {
              "decision": "resolved"
            },
            "target": "complete",
            "label": "resolved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-audit": {
        "kind": "operator",
        "ref": "fe/surface-audit",
        "on": [
          {
            "when": {
              "decision": "audited"
            },
            "target": "authority-approval",
            "label": "audited"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "authority-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the smallest durable design authority and closed consumer set.",
          "approve": "OK AUTHORITY <hash>",
          "reject": "REJECT AUTHORITY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "approved"
            },
            "target": "authority-reconcile"
          },
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "rejected"
            },
            "target": "surface-audit"
          }
        ]
      },
      "authority-reconcile": {
        "kind": "operator",
        "ref": "fe/authority-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "consumer-align",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "reconcile-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "reconcile-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "reconcile-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "reconcile-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "reconcile-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "reconcile-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "reconcile-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "mission-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "reconcile-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      },
      "mission-route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-staleness",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-staleness": {
        "kind": "operator",
        "ref": "business/staleness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "block-reconcile",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "mission-business-evidence",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-model",
            "label": "ready"
          }
        ]
      },
      "mission-business-model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-approval",
            "label": "ready"
          }
        ]
      },
      "mission-business-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve regenerated business authority before mission delivery.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "mission-business-publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "mission-business-evidence"
          }
        ]
      },
      "mission-business-publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "mission-business-staleness",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "mission-business-staleness",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-impact": {
        "kind": "operator",
        "ref": "delivery/impact-classify",
        "on": [
          {
            "when": {
              "decision": "backend-required"
            },
            "target": "ship-architecture-frame",
            "label": "backend-required"
          },
          {
            "when": {
              "decision": "frontend-only"
            },
            "target": "block-consumer-align",
            "label": "frontend-only"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-architecture-frame": {
        "kind": "operator",
        "ref": "architecture/decision-frame",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-current",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-current": {
        "kind": "operator",
        "ref": "architecture/current-state",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-alternatives",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-alternatives": {
        "kind": "operator",
        "ref": "architecture/alternatives",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-challenge",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-challenge": {
        "kind": "operator",
        "ref": "architecture/decision-challenge",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-selection",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "ship-architecture-alternatives",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-architecture-selection": {
        "kind": "wait",
        "approval": {
          "prompt": "Review the rendered visualize comparison, then approve the exact backend architecture required by this mission.",
          "approve": "OK ARCHITECTURE <decision>",
          "reject": "REJECT ARCHITECTURE <decision>"
        },
        "on": [
          {
            "when": {
              "stage": "architecture.decision.handoff",
              "status": "ready",
              "allFacts": [
                "architecture-visual-preview-ready"
              ]
            },
            "target": "ship-architecture-handoff"
          },
          {
            "when": {
              "stage": "architecture.decision.alternatives",
              "status": "ready"
            },
            "target": "ship-architecture-alternatives"
          }
        ]
      },
      "ship-architecture-handoff": {
        "kind": "operator",
        "ref": "architecture/decision-handoff",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-source-discovery",
            "label": "ready"
          }
        ]
      },
      "ship-source-discovery": {
        "kind": "operator",
        "ref": "architecture/source-discovery",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-pattern-bind",
            "label": "ready"
          }
        ]
      },
      "ship-pattern-bind": {
        "kind": "operator",
        "ref": "architecture/pattern-bind",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-boundary-plan",
            "label": "ready"
          }
        ]
      },
      "ship-boundary-plan": {
        "kind": "operator",
        "ref": "architecture/boundary-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-boundary-challenge",
            "label": "ready"
          }
        ]
      },
      "ship-boundary-challenge": {
        "kind": "operator",
        "ref": "architecture/boundary-challenge",
        "on": [
          {
            "when": {
              "decision": "clean"
            },
            "target": "ship-boundary-approval",
            "label": "clean"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "ship-boundary-plan",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-boundary-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact backend plan required to complete this mission.",
          "approve": "OK BACKEND <hash>",
          "reject": "REJECT BACKEND <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "architecture.boundary.review",
              "status": "approved"
            },
            "target": "ship-coding-scope"
          },
          {
            "when": {
              "stage": "architecture.boundary.review",
              "status": "rejected"
            },
            "target": "ship-boundary-plan"
          }
        ]
      },
      "ship-coding-scope": {
        "kind": "operator",
        "ref": "be/coding-scope-freeze",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-implement",
            "label": "ready"
          },
          {
            "when": {
              "decision": "source-drift"
            },
            "target": "ship-boundary-plan",
            "label": "source-drift"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-implement": {
        "kind": "operator",
        "ref": "be/implementation",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-format",
            "label": "ready"
          },
          {
            "when": {
              "decision": "source-drift"
            },
            "target": "ship-boundary-plan",
            "label": "source-drift"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-format": {
        "kind": "operator",
        "ref": "quality/format",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-lint",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-lint": {
        "kind": "operator",
        "ref": "quality/lint",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-typecheck",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-typecheck": {
        "kind": "operator",
        "ref": "quality/typecheck",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-build",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-build": {
        "kind": "operator",
        "ref": "quality/build",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-unit",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-unit": {
        "kind": "operator",
        "ref": "quality/unit-coverage",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-integration",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-integration": {
        "kind": "operator",
        "ref": "quality/integration",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-e2e",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-e2e": {
        "kind": "operator",
        "ref": "quality/e2e",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-sonar",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-sonar": {
        "kind": "operator",
        "ref": "quality/sonar",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-source-proof",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-source-proof": {
        "kind": "operator",
        "ref": "quality/delivery-proof",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-resume",
            "label": "pass"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-resume": {
        "kind": "operator",
        "ref": "delivery/mission-resume",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "block-consumer-align",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-proof": {
        "kind": "operator",
        "ref": "delivery/mission-proof",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "mission-business-reconcile",
            "label": "pass"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      }
    },
    "options": {},
    "description": "Use when one existing product block or component contract must be reconciled across its closed consumers and every affected backend/frontend role, then proven end to end. Do not use for complete journey design, ordinary maintenance, learning resolution, or broad cross-surface authority changes.",
    "checks": [
      "Capture the feedback session with explicit accepts and rejects in .claude/requests before reconciliation.",
      "Resolve exactly one block contract, its closed consumer set, fresh business head and complete acceptance proof matrix.",
      "Classify role impact and require backend boundary approval and proof when the block changes persisted or server-owned behavior.",
      "Require complete unit, E2E, UI-quality, browser, joined mission proof and business reconciliation; reject journey redesign or unbounded consumer discovery."
    ],
    "contextMatrix": [
      [
        "block plan",
        "one Block identity, current contract generation, closed consumers and proof-plan headers",
        "unrelated blocks, broad source and raw business context"
      ],
      [
        "approval + consumer mutation",
        "frozen reconciliation hash, exact consumer files, approval receipt and complete acceptance-plan identity",
        "undeclared consumers, new design discovery and scope expansion"
      ],
      [
        "proof",
        "change-set receipt, deterministic seed/reset, declared commands, UI-quality receipt, browser/account handles and complete state-and-viewport evidence",
        "partial proof, skipped scenarios, raw credentials and unrelated design history"
      ]
    ]
  },
  {
    "id": "frontend-maintenance-apply",
    "display": "StarCi Product Maintenance",
    "short": "Apply approved maintenance across affected roles",
    "entry": "maintenance-feedback-request",
    "states": {
      "request-review": {
        "kind": "operator",
        "ref": "fe/request-review",
        "on": [
          {
            "when": {
              "decision": "approved"
            },
            "target": "complete",
            "label": "approved"
          },
          {
            "when": {
              "decision": "rejected"
            },
            "target": "complete",
            "label": "rejected"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "layout-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "route",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "block-reconcile",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "mission-route",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "surface-audit",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-staleness",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-staleness": {
        "kind": "operator",
        "ref": "business/staleness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "preflight",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "business-evidence",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-model",
            "label": "ready"
          }
        ]
      },
      "business-model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-approval",
            "label": "ready"
          }
        ]
      },
      "business-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve regenerated business authority before customer-journey work.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "business-publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "business-evidence"
          }
        ]
      },
      "business-publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "business-staleness",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "business-staleness",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "preflight": {
        "kind": "operator",
        "ref": "fe/preflight",
        "on": [
          {
            "when": {
              "stage": "flow.generate",
              "status": "ready"
            },
            "target": "journey"
          }
        ]
      },
      "journey": {
        "kind": "operator",
        "ref": "fe/customer-journey",
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "pending"
            },
            "target": "flow-approval"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          }
        ]
      },
      "flow-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact customer-journey direction.",
          "approve": "OK FLOW <id>",
          "reject": "REJECT FLOW <id>"
        },
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "rejected"
            },
            "target": "journey"
          }
        ]
      },
      "page-model": {
        "kind": "operator",
        "ref": "fe/page-model",
        "on": [
          {
            "when": {
              "stage": "state.generate",
              "status": "ready"
            },
            "target": "state"
          }
        ]
      },
      "state": {
        "kind": "operator",
        "ref": "fe/state",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "context-sync"
          },
          {
            "when": {
              "stage": "state.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "context-sync": {
        "kind": "operator",
        "ref": "fe/context-sync",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "source-fit"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "source-fit": {
        "kind": "operator",
        "ref": "fe/source-fit",
        "on": [
          {
            "when": {
              "stage": "principles.compile",
              "status": "ready"
            },
            "target": "principles"
          }
        ]
      },
      "principles": {
        "kind": "operator",
        "ref": "fe/principle-compile",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "layout.generate",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "layout": {
        "kind": "operator",
        "ref": "fe/layout",
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "pending"
            },
            "target": "layout-approval"
          }
        ]
      },
      "layout-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact layout direction and complete page set.",
          "approve": "OK LAYOUT <id>",
          "reject": "REJECT LAYOUT <id>"
        },
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "approved"
            },
            "target": "grammar"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          }
        ]
      },
      "grammar": {
        "kind": "operator",
        "ref": "fe/grammar-convergence",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "request-choice"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "request-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "allFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "allFacts": [
                "create-required"
              ],
              "noneFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "noneFacts": [
                "grammar-gap",
                "create-required"
              ]
            },
            "target": "coding-scope"
          }
        ]
      },
      "requests": {
        "kind": "operator",
        "ref": "fe/request-emission",
        "on": [
          {
            "when": {
              "stage": "request.result",
              "status": "ready"
            },
            "target": "coding-scope"
          },
          {
            "when": {
              "stage": "request.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "coding-scope": {
        "kind": "operator",
        "ref": "fe/coding-scope-freeze",
        "on": [
          {
            "when": {
              "stage": "code.implement",
              "status": "ready"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "implementation": {
        "kind": "operator",
        "ref": "fe/implementation",
        "on": [
          {
            "when": {
              "stage": "seed.materialize",
              "status": "ready"
            },
            "target": "seed"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "implementation",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "layout",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "complete"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "block-reconcile": {
        "kind": "operator",
        "ref": "fe/block-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "block-approval",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact Block reconciliation and closed consumer boundary.",
          "approve": "OK BLOCK <hash>",
          "reject": "REJECT BLOCK <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.block.review",
              "status": "approved"
            },
            "target": "block-consumer-align"
          },
          {
            "when": {
              "stage": "fe.block.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "block-consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-apply": {
        "kind": "operator",
        "ref": "fe/maintenance-apply",
        "on": [
          {
            "when": {
              "decision": "applied"
            },
            "target": "maintenance-seed",
            "label": "applied"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "maintenance-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "maintenance-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "maintenance-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "maintenance-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "maintenance-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "maintenance-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "maintenance-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "mission-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "maintenance-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "learning-request": {
        "kind": "operator",
        "ref": "fe/learning-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "complete",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "learning-resolve": {
        "kind": "operator",
        "ref": "fe/learning-resolve",
        "on": [
          {
            "when": {
              "decision": "resolved"
            },
            "target": "complete",
            "label": "resolved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-audit": {
        "kind": "operator",
        "ref": "fe/surface-audit",
        "on": [
          {
            "when": {
              "decision": "audited"
            },
            "target": "authority-approval",
            "label": "audited"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "authority-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the smallest durable design authority and closed consumer set.",
          "approve": "OK AUTHORITY <hash>",
          "reject": "REJECT AUTHORITY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "approved"
            },
            "target": "authority-reconcile"
          },
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "rejected"
            },
            "target": "surface-audit"
          }
        ]
      },
      "authority-reconcile": {
        "kind": "operator",
        "ref": "fe/authority-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "consumer-align",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "reconcile-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "reconcile-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "reconcile-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "reconcile-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "reconcile-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "reconcile-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "reconcile-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "complete"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "reconcile-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      },
      "mission-route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-staleness",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-staleness": {
        "kind": "operator",
        "ref": "business/staleness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "mission-impact",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "mission-business-evidence",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-model",
            "label": "ready"
          }
        ]
      },
      "mission-business-model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-approval",
            "label": "ready"
          }
        ]
      },
      "mission-business-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve regenerated business authority before mission delivery.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "mission-business-publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "mission-business-evidence"
          }
        ]
      },
      "mission-business-publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "mission-business-staleness",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "mission-business-staleness",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-impact": {
        "kind": "operator",
        "ref": "delivery/impact-classify",
        "on": [
          {
            "when": {
              "decision": "backend-required"
            },
            "target": "ship-architecture-frame",
            "label": "backend-required"
          },
          {
            "when": {
              "decision": "frontend-only"
            },
            "target": "maintenance-apply",
            "label": "frontend-only"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-architecture-frame": {
        "kind": "operator",
        "ref": "architecture/decision-frame",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-current",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-current": {
        "kind": "operator",
        "ref": "architecture/current-state",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-alternatives",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-alternatives": {
        "kind": "operator",
        "ref": "architecture/alternatives",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-challenge",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-challenge": {
        "kind": "operator",
        "ref": "architecture/decision-challenge",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-selection",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "ship-architecture-alternatives",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-architecture-selection": {
        "kind": "wait",
        "approval": {
          "prompt": "Review the rendered visualize comparison, then approve the exact backend architecture required by this mission.",
          "approve": "OK ARCHITECTURE <decision>",
          "reject": "REJECT ARCHITECTURE <decision>"
        },
        "on": [
          {
            "when": {
              "stage": "architecture.decision.handoff",
              "status": "ready",
              "allFacts": [
                "architecture-visual-preview-ready"
              ]
            },
            "target": "ship-architecture-handoff"
          },
          {
            "when": {
              "stage": "architecture.decision.alternatives",
              "status": "ready"
            },
            "target": "ship-architecture-alternatives"
          }
        ]
      },
      "ship-architecture-handoff": {
        "kind": "operator",
        "ref": "architecture/decision-handoff",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-source-discovery",
            "label": "ready"
          }
        ]
      },
      "ship-source-discovery": {
        "kind": "operator",
        "ref": "architecture/source-discovery",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-pattern-bind",
            "label": "ready"
          }
        ]
      },
      "ship-pattern-bind": {
        "kind": "operator",
        "ref": "architecture/pattern-bind",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-boundary-plan",
            "label": "ready"
          }
        ]
      },
      "ship-boundary-plan": {
        "kind": "operator",
        "ref": "architecture/boundary-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-boundary-challenge",
            "label": "ready"
          }
        ]
      },
      "ship-boundary-challenge": {
        "kind": "operator",
        "ref": "architecture/boundary-challenge",
        "on": [
          {
            "when": {
              "decision": "clean"
            },
            "target": "ship-boundary-approval",
            "label": "clean"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "ship-boundary-plan",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-boundary-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact backend plan required to complete this mission.",
          "approve": "OK BACKEND <hash>",
          "reject": "REJECT BACKEND <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "architecture.boundary.review",
              "status": "approved"
            },
            "target": "ship-coding-scope"
          },
          {
            "when": {
              "stage": "architecture.boundary.review",
              "status": "rejected"
            },
            "target": "ship-boundary-plan"
          }
        ]
      },
      "ship-coding-scope": {
        "kind": "operator",
        "ref": "be/coding-scope-freeze",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-implement",
            "label": "ready"
          },
          {
            "when": {
              "decision": "source-drift"
            },
            "target": "ship-boundary-plan",
            "label": "source-drift"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-implement": {
        "kind": "operator",
        "ref": "be/implementation",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-format",
            "label": "ready"
          },
          {
            "when": {
              "decision": "source-drift"
            },
            "target": "ship-boundary-plan",
            "label": "source-drift"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-format": {
        "kind": "operator",
        "ref": "quality/format",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-lint",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-lint": {
        "kind": "operator",
        "ref": "quality/lint",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-typecheck",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-typecheck": {
        "kind": "operator",
        "ref": "quality/typecheck",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-build",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-build": {
        "kind": "operator",
        "ref": "quality/build",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-unit",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-unit": {
        "kind": "operator",
        "ref": "quality/unit-coverage",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-integration",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-integration": {
        "kind": "operator",
        "ref": "quality/integration",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-e2e",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-e2e": {
        "kind": "operator",
        "ref": "quality/e2e",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-sonar",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-sonar": {
        "kind": "operator",
        "ref": "quality/sonar",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-source-proof",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-source-proof": {
        "kind": "operator",
        "ref": "quality/delivery-proof",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-resume",
            "label": "pass"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-resume": {
        "kind": "operator",
        "ref": "delivery/mission-resume",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "maintenance-apply",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-proof": {
        "kind": "operator",
        "ref": "delivery/mission-proof",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "mission-business-reconcile",
            "label": "pass"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "learning-request",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      }
    },
    "options": {},
    "description": "Use to apply one already approved source-first product maintenance change across every affected backend/frontend role and prove the mission end to end. Do not use for design exploration, unapproved feedback, or cross-surface authority selection.",
    "checks": [
      "Capture the feedback session with explicit accepts and rejects in .claude/requests before source mutation.",
      "Resolve approved feedback, fresh business head, exact routed role boundaries and a complete acceptance proof matrix.",
      "Classify role impact before mutation and require backend planning and proof when server-owned behavior changes.",
      "Require complete unit, E2E, UI-quality, browser, joined mission proof and business reconciliation before recording the durable learning request."
    ],
    "contextMatrix": [
      [
        "route + target verification",
        "project route, approved target refs, source/contract hashes and receipt headers",
        "business bodies, broad Qdrant and repository scans"
      ],
      [
        "audit or reconcile",
        "exact component/surface contracts, selected Grammar pair and closed consumer refs",
        "other Grammar packages, unrelated consumers and raw business context"
      ],
      [
        "approval + mutation",
        "frozen decision hash, exact files, approval receipt and complete acceptance-plan identity",
        "new discovery, undeclared files and scope expansion"
      ],
      [
        "proof + learning",
        "changed-file receipt, approved proof matrix, deterministic seed, declared unit/E2E commands, UI-quality receipt, browser/account handles, complete state-and-viewport proof and one durable learning request",
        "partial proof, skipped scenarios, raw credentials, session scratch and unrelated design history"
      ]
    ]
  },
  {
    "id": "frontend-request-review",
    "display": "StarCi Frontend Request Review",
    "short": "Approve or reject one feedback ledger entry",
    "entry": "request-review",
    "states": {
      "request-review": {
        "kind": "operator",
        "ref": "fe/request-review",
        "on": [
          {
            "when": {
              "decision": "approved"
            },
            "target": "complete",
            "label": "approved"
          },
          {
            "when": {
              "decision": "rejected"
            },
            "target": "complete",
            "label": "rejected"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "layout-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "route",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "block-reconcile",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "maintenance-apply",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "surface-audit",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-staleness",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-staleness": {
        "kind": "operator",
        "ref": "business/staleness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "preflight",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "business-evidence",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-model",
            "label": "ready"
          }
        ]
      },
      "business-model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-approval",
            "label": "ready"
          }
        ]
      },
      "business-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve regenerated business authority before customer-journey work.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "business-publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "business-evidence"
          }
        ]
      },
      "business-publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "business-staleness",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "business-staleness",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "preflight": {
        "kind": "operator",
        "ref": "fe/preflight",
        "on": [
          {
            "when": {
              "stage": "flow.generate",
              "status": "ready"
            },
            "target": "journey"
          }
        ]
      },
      "journey": {
        "kind": "operator",
        "ref": "fe/customer-journey",
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "pending"
            },
            "target": "flow-approval"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          }
        ]
      },
      "flow-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact customer-journey direction.",
          "approve": "OK FLOW <id>",
          "reject": "REJECT FLOW <id>"
        },
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "rejected"
            },
            "target": "journey"
          }
        ]
      },
      "page-model": {
        "kind": "operator",
        "ref": "fe/page-model",
        "on": [
          {
            "when": {
              "stage": "state.generate",
              "status": "ready"
            },
            "target": "state"
          }
        ]
      },
      "state": {
        "kind": "operator",
        "ref": "fe/state",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "context-sync"
          },
          {
            "when": {
              "stage": "state.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "context-sync": {
        "kind": "operator",
        "ref": "fe/context-sync",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "source-fit"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "source-fit": {
        "kind": "operator",
        "ref": "fe/source-fit",
        "on": [
          {
            "when": {
              "stage": "principles.compile",
              "status": "ready"
            },
            "target": "principles"
          }
        ]
      },
      "principles": {
        "kind": "operator",
        "ref": "fe/principle-compile",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "layout.generate",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "layout": {
        "kind": "operator",
        "ref": "fe/layout",
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "pending"
            },
            "target": "layout-approval"
          }
        ]
      },
      "layout-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact layout direction and complete page set.",
          "approve": "OK LAYOUT <id>",
          "reject": "REJECT LAYOUT <id>"
        },
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "approved"
            },
            "target": "grammar"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          }
        ]
      },
      "grammar": {
        "kind": "operator",
        "ref": "fe/grammar-convergence",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "request-choice"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "request-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "allFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "allFacts": [
                "create-required"
              ],
              "noneFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "noneFacts": [
                "grammar-gap",
                "create-required"
              ]
            },
            "target": "coding-scope"
          }
        ]
      },
      "requests": {
        "kind": "operator",
        "ref": "fe/request-emission",
        "on": [
          {
            "when": {
              "stage": "request.result",
              "status": "ready"
            },
            "target": "coding-scope"
          },
          {
            "when": {
              "stage": "request.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "coding-scope": {
        "kind": "operator",
        "ref": "fe/coding-scope-freeze",
        "on": [
          {
            "when": {
              "stage": "code.implement",
              "status": "ready"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "implementation": {
        "kind": "operator",
        "ref": "fe/implementation",
        "on": [
          {
            "when": {
              "stage": "seed.materialize",
              "status": "ready"
            },
            "target": "seed"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "implementation",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "layout",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "complete"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "block-reconcile": {
        "kind": "operator",
        "ref": "fe/block-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "block-approval",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact Block reconciliation and closed consumer boundary.",
          "approve": "OK BLOCK <hash>",
          "reject": "REJECT BLOCK <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.block.review",
              "status": "approved"
            },
            "target": "block-consumer-align"
          },
          {
            "when": {
              "stage": "fe.block.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "block-consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-apply": {
        "kind": "operator",
        "ref": "fe/maintenance-apply",
        "on": [
          {
            "when": {
              "decision": "applied"
            },
            "target": "maintenance-seed",
            "label": "applied"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "maintenance-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "maintenance-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "maintenance-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "maintenance-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "maintenance-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "maintenance-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "maintenance-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "learning-request"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "maintenance-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "learning-request": {
        "kind": "operator",
        "ref": "fe/learning-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "complete",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "learning-resolve": {
        "kind": "operator",
        "ref": "fe/learning-resolve",
        "on": [
          {
            "when": {
              "decision": "resolved"
            },
            "target": "complete",
            "label": "resolved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-audit": {
        "kind": "operator",
        "ref": "fe/surface-audit",
        "on": [
          {
            "when": {
              "decision": "audited"
            },
            "target": "authority-approval",
            "label": "audited"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "authority-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the smallest durable design authority and closed consumer set.",
          "approve": "OK AUTHORITY <hash>",
          "reject": "REJECT AUTHORITY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "approved"
            },
            "target": "authority-reconcile"
          },
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "rejected"
            },
            "target": "surface-audit"
          }
        ]
      },
      "authority-reconcile": {
        "kind": "operator",
        "ref": "fe/authority-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "consumer-align",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "reconcile-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "reconcile-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "reconcile-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "reconcile-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "reconcile-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "reconcile-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "reconcile-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "complete"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "reconcile-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use only to durably approve or reject one exact `.claude/requests/*.request.json` frontend feedback ledger with bounded priority before learning resolution. Do not use to resolve authority, mutate product source, or bypass evidence because a request is urgent.",
    "checks": [
      "Resolve exactly one .claude/requests identity and current revision.",
      "Require an explicit approve or reject decision, bounded owners, durable rationale and evidence hash.",
      "Treat urgent as queue priority only; never relax proof or ownership.",
      "Emit an approved request for learning resolution without mutating .claude, Grammar or product source."
    ],
    "contextMatrix": [
      [
        "request review",
        "one durable request, its feedback-session ledger, current proof status and explicit review evidence",
        "other requests, raw transcripts and unrelated source"
      ],
      [
        "decision persistence",
        "exact request target, bounded owners, priority, rationale and decision hash",
        "authority mutation, product mutation and owner expansion"
      ]
    ]
  },
  {
    "id": "frontend-learning-resolve",
    "display": "StarCi Frontend Learning Resolve",
    "short": "Resolve one queued frontend design learning",
    "entry": "learning-resolve",
    "states": {
      "request-review": {
        "kind": "operator",
        "ref": "fe/request-review",
        "on": [
          {
            "when": {
              "decision": "approved"
            },
            "target": "complete",
            "label": "approved"
          },
          {
            "when": {
              "decision": "rejected"
            },
            "target": "complete",
            "label": "rejected"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "layout-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "route",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "block-reconcile",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "maintenance-apply",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "surface-audit",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-staleness",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-staleness": {
        "kind": "operator",
        "ref": "business/staleness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "preflight",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "business-evidence",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-model",
            "label": "ready"
          }
        ]
      },
      "business-model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-approval",
            "label": "ready"
          }
        ]
      },
      "business-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve regenerated business authority before customer-journey work.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "business-publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "business-evidence"
          }
        ]
      },
      "business-publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "business-staleness",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "business-staleness",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "preflight": {
        "kind": "operator",
        "ref": "fe/preflight",
        "on": [
          {
            "when": {
              "stage": "flow.generate",
              "status": "ready"
            },
            "target": "journey"
          }
        ]
      },
      "journey": {
        "kind": "operator",
        "ref": "fe/customer-journey",
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "pending"
            },
            "target": "flow-approval"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          }
        ]
      },
      "flow-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact customer-journey direction.",
          "approve": "OK FLOW <id>",
          "reject": "REJECT FLOW <id>"
        },
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "rejected"
            },
            "target": "journey"
          }
        ]
      },
      "page-model": {
        "kind": "operator",
        "ref": "fe/page-model",
        "on": [
          {
            "when": {
              "stage": "state.generate",
              "status": "ready"
            },
            "target": "state"
          }
        ]
      },
      "state": {
        "kind": "operator",
        "ref": "fe/state",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "context-sync"
          },
          {
            "when": {
              "stage": "state.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "context-sync": {
        "kind": "operator",
        "ref": "fe/context-sync",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "source-fit"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "source-fit": {
        "kind": "operator",
        "ref": "fe/source-fit",
        "on": [
          {
            "when": {
              "stage": "principles.compile",
              "status": "ready"
            },
            "target": "principles"
          }
        ]
      },
      "principles": {
        "kind": "operator",
        "ref": "fe/principle-compile",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "layout.generate",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "layout": {
        "kind": "operator",
        "ref": "fe/layout",
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "pending"
            },
            "target": "layout-approval"
          }
        ]
      },
      "layout-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact layout direction and complete page set.",
          "approve": "OK LAYOUT <id>",
          "reject": "REJECT LAYOUT <id>"
        },
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "approved"
            },
            "target": "grammar"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          }
        ]
      },
      "grammar": {
        "kind": "operator",
        "ref": "fe/grammar-convergence",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "request-choice"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "request-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "allFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "allFacts": [
                "create-required"
              ],
              "noneFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "noneFacts": [
                "grammar-gap",
                "create-required"
              ]
            },
            "target": "coding-scope"
          }
        ]
      },
      "requests": {
        "kind": "operator",
        "ref": "fe/request-emission",
        "on": [
          {
            "when": {
              "stage": "request.result",
              "status": "ready"
            },
            "target": "coding-scope"
          },
          {
            "when": {
              "stage": "request.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "coding-scope": {
        "kind": "operator",
        "ref": "fe/coding-scope-freeze",
        "on": [
          {
            "when": {
              "stage": "code.implement",
              "status": "ready"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "implementation": {
        "kind": "operator",
        "ref": "fe/implementation",
        "on": [
          {
            "when": {
              "stage": "seed.materialize",
              "status": "ready"
            },
            "target": "seed"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "implementation",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "layout",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "complete"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "block-reconcile": {
        "kind": "operator",
        "ref": "fe/block-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "block-approval",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact Block reconciliation and closed consumer boundary.",
          "approve": "OK BLOCK <hash>",
          "reject": "REJECT BLOCK <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.block.review",
              "status": "approved"
            },
            "target": "block-consumer-align"
          },
          {
            "when": {
              "stage": "fe.block.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "block-consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-apply": {
        "kind": "operator",
        "ref": "fe/maintenance-apply",
        "on": [
          {
            "when": {
              "decision": "applied"
            },
            "target": "maintenance-seed",
            "label": "applied"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "maintenance-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "maintenance-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "maintenance-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "maintenance-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "maintenance-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "maintenance-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "maintenance-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "learning-request"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "maintenance-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "learning-request": {
        "kind": "operator",
        "ref": "fe/learning-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "complete",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "learning-resolve": {
        "kind": "operator",
        "ref": "fe/learning-resolve",
        "on": [
          {
            "when": {
              "decision": "resolved"
            },
            "target": "complete",
            "label": "resolved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-audit": {
        "kind": "operator",
        "ref": "fe/surface-audit",
        "on": [
          {
            "when": {
              "decision": "audited"
            },
            "target": "authority-approval",
            "label": "audited"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "authority-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the smallest durable design authority and closed consumer set.",
          "approve": "OK AUTHORITY <hash>",
          "reject": "REJECT AUTHORITY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "approved"
            },
            "target": "authority-reconcile"
          },
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "rejected"
            },
            "target": "surface-audit"
          }
        ]
      },
      "authority-reconcile": {
        "kind": "operator",
        "ref": "fe/authority-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "consumer-align",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "reconcile-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "reconcile-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "reconcile-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "reconcile-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "reconcile-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "reconcile-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "reconcile-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "complete"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "reconcile-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to resolve one durably approved frontend design learning request into its declared authority. Do not use to review requests, apply ordinary feedback, redesign a journey, or reconcile consumers.",
    "checks": [
      "Require one request approved by starci-frontend-request-review and bind its exact revision.",
      "Resolve the approved learning identity and proposed authority.",
      "Confirm evidence is current and bounded.",
      "Reject unreviewed requests, ordinary maintenance or unrelated source work."
    ]
  },
  {
    "id": "frontend-surface-reconcile",
    "display": "StarCi Surface Reconcile",
    "short": "Align closed product surfaces across all roles",
    "entry": "surface-feedback-request",
    "states": {
      "request-review": {
        "kind": "operator",
        "ref": "fe/request-review",
        "on": [
          {
            "when": {
              "decision": "approved"
            },
            "target": "complete",
            "label": "approved"
          },
          {
            "when": {
              "decision": "rejected"
            },
            "target": "complete",
            "label": "rejected"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "layout-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "route",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "block-reconcile",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "maintenance-apply",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-feedback-request": {
        "kind": "operator",
        "ref": "fe/feedback-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "mission-route",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-staleness",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-staleness": {
        "kind": "operator",
        "ref": "business/staleness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "preflight",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "business-evidence",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "business-evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-model",
            "label": "ready"
          }
        ]
      },
      "business-model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "business-approval",
            "label": "ready"
          }
        ]
      },
      "business-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve regenerated business authority before customer-journey work.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "business-publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "business-evidence"
          }
        ]
      },
      "business-publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "business-staleness",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "business-staleness",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "preflight": {
        "kind": "operator",
        "ref": "fe/preflight",
        "on": [
          {
            "when": {
              "stage": "flow.generate",
              "status": "ready"
            },
            "target": "journey"
          }
        ]
      },
      "journey": {
        "kind": "operator",
        "ref": "fe/customer-journey",
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "pending"
            },
            "target": "flow-approval"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          }
        ]
      },
      "flow-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact customer-journey direction.",
          "approve": "OK FLOW <id>",
          "reject": "REJECT FLOW <id>"
        },
        "on": [
          {
            "when": {
              "stage": "flow.review",
              "status": "approved"
            },
            "target": "page-model"
          },
          {
            "when": {
              "stage": "flow.review",
              "status": "rejected"
            },
            "target": "journey"
          }
        ]
      },
      "page-model": {
        "kind": "operator",
        "ref": "fe/page-model",
        "on": [
          {
            "when": {
              "stage": "state.generate",
              "status": "ready"
            },
            "target": "state"
          }
        ]
      },
      "state": {
        "kind": "operator",
        "ref": "fe/state",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "context-sync"
          },
          {
            "when": {
              "stage": "state.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "context-sync": {
        "kind": "operator",
        "ref": "fe/context-sync",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "source-fit"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "source-fit": {
        "kind": "operator",
        "ref": "fe/source-fit",
        "on": [
          {
            "when": {
              "stage": "principles.compile",
              "status": "ready"
            },
            "target": "principles"
          }
        ]
      },
      "principles": {
        "kind": "operator",
        "ref": "fe/principle-compile",
        "on": [
          {
            "when": {
              "stage": "layout.generate",
              "status": "ready"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "layout.generate",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "layout": {
        "kind": "operator",
        "ref": "fe/layout",
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "pending"
            },
            "target": "layout-approval"
          }
        ]
      },
      "layout-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact layout direction and complete page set.",
          "approve": "OK LAYOUT <id>",
          "reject": "REJECT LAYOUT <id>"
        },
        "on": [
          {
            "when": {
              "stage": "layout.review",
              "status": "approved"
            },
            "target": "grammar"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          }
        ]
      },
      "grammar": {
        "kind": "operator",
        "ref": "fe/grammar-convergence",
        "on": [
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "ready"
            },
            "target": "request-choice"
          },
          {
            "when": {
              "stage": "source-fit.resolve",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "request-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "allFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "allFacts": [
                "create-required"
              ],
              "noneFacts": [
                "grammar-gap"
              ]
            },
            "target": "requests"
          },
          {
            "when": {
              "noneFacts": [
                "grammar-gap",
                "create-required"
              ]
            },
            "target": "coding-scope"
          }
        ]
      },
      "requests": {
        "kind": "operator",
        "ref": "fe/request-emission",
        "on": [
          {
            "when": {
              "stage": "request.result",
              "status": "ready"
            },
            "target": "coding-scope"
          },
          {
            "when": {
              "stage": "request.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "coding-scope": {
        "kind": "operator",
        "ref": "fe/coding-scope-freeze",
        "on": [
          {
            "when": {
              "stage": "code.implement",
              "status": "ready"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "implementation": {
        "kind": "operator",
        "ref": "fe/implementation",
        "on": [
          {
            "when": {
              "stage": "seed.materialize",
              "status": "ready"
            },
            "target": "seed"
          },
          {
            "when": {
              "stage": "code.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "implementation",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "layout",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "complete"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "implementation"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "layout"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "block-reconcile": {
        "kind": "operator",
        "ref": "fe/block-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "block-approval",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "block-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact Block reconciliation and closed consumer boundary.",
          "approve": "OK BLOCK <hash>",
          "reject": "REJECT BLOCK <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.block.review",
              "status": "approved"
            },
            "target": "block-consumer-align"
          },
          {
            "when": {
              "stage": "fe.block.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "block-consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-apply": {
        "kind": "operator",
        "ref": "fe/maintenance-apply",
        "on": [
          {
            "when": {
              "decision": "applied"
            },
            "target": "maintenance-seed",
            "label": "applied"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "maintenance-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "maintenance-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "maintenance-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "maintenance-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "maintenance-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "maintenance-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "maintenance-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "maintenance-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "learning-request"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "maintenance-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "maintenance-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "maintenance-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "maintenance-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "learning-request": {
        "kind": "operator",
        "ref": "fe/learning-request",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "complete",
            "label": "recorded"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "learning-resolve": {
        "kind": "operator",
        "ref": "fe/learning-resolve",
        "on": [
          {
            "when": {
              "decision": "resolved"
            },
            "target": "complete",
            "label": "resolved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "surface-audit": {
        "kind": "operator",
        "ref": "fe/surface-audit",
        "on": [
          {
            "when": {
              "decision": "audited"
            },
            "target": "authority-approval",
            "label": "audited"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "authority-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the smallest durable design authority and closed consumer set.",
          "approve": "OK AUTHORITY <hash>",
          "reject": "REJECT AUTHORITY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "approved"
            },
            "target": "mission-impact"
          },
          {
            "when": {
              "stage": "fe.authority.review",
              "status": "rejected"
            },
            "target": "surface-audit"
          }
        ]
      },
      "authority-reconcile": {
        "kind": "operator",
        "ref": "fe/authority-reconcile",
        "on": [
          {
            "when": {
              "decision": "reconciled"
            },
            "target": "consumer-align",
            "label": "reconciled"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "consumer-align": {
        "kind": "operator",
        "ref": "fe/consumer-align",
        "on": [
          {
            "when": {
              "decision": "aligned"
            },
            "target": "reconcile-seed",
            "label": "aligned"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-seed": {
        "kind": "operator",
        "ref": "fe/product-seed",
        "on": [
          {
            "when": {
              "stage": "test.unit",
              "status": "ready"
            },
            "target": "reconcile-unit-test"
          },
          {
            "when": {
              "stage": "seed.result",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-unit-test": {
        "kind": "operator",
        "ref": "test/unit",
        "on": [
          {
            "when": {
              "stage": "test.e2e",
              "status": "ready"
            },
            "target": "reconcile-e2e-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-e2e-test": {
        "kind": "operator",
        "ref": "test/e2e",
        "on": [
          {
            "when": {
              "stage": "test.ui",
              "status": "ready"
            },
            "target": "reconcile-ui-quality-test"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-ui-quality-test": {
        "kind": "operator",
        "ref": "test/ui-quality-audit",
        "on": [
          {
            "when": {
              "decision": "delivery-pass"
            },
            "target": "reconcile-ui-test",
            "label": "delivery-pass"
          },
          {
            "when": {
              "decision": "delivery-in-boundary"
            },
            "target": "reconcile-repair-handoff",
            "label": "delivery-in-boundary"
          },
          {
            "when": {
              "decision": "delivery-boundary-drift"
            },
            "target": "reconcile-authority-handoff",
            "label": "delivery-boundary-drift"
          },
          {
            "when": {
              "decision": "audit-pass"
            },
            "target": "blocked",
            "label": "audit-pass"
          },
          {
            "when": {
              "decision": "audit-findings"
            },
            "target": "blocked",
            "label": "audit-findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-ui-test": {
        "kind": "operator",
        "ref": "test/ui",
        "on": [
          {
            "when": {
              "stage": "proof.run",
              "status": "ready"
            },
            "target": "reconcile-product-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "test.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-product-proof": {
        "kind": "operator",
        "ref": "fe/product-proof",
        "on": [
          {
            "when": {
              "stage": "proof.review",
              "status": "complete"
            },
            "target": "mission-proof"
          },
          {
            "when": {
              "stage": "code.repair",
              "status": "repair"
            },
            "target": "reconcile-repair-handoff"
          },
          {
            "when": {
              "stage": "layout.review",
              "status": "rejected"
            },
            "target": "reconcile-authority-handoff"
          },
          {
            "when": {
              "stage": "proof.review",
              "status": "blocked"
            },
            "target": "blocked"
          }
        ]
      },
      "reconcile-repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "reconcile-authority-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      },
      "mission-route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-staleness",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-staleness": {
        "kind": "operator",
        "ref": "business/staleness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "surface-audit",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "mission-business-evidence",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-evidence": {
        "kind": "operator",
        "ref": "business/evidence-normalize",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-model",
            "label": "ready"
          }
        ]
      },
      "mission-business-model": {
        "kind": "operator",
        "ref": "business/model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mission-business-approval",
            "label": "ready"
          }
        ]
      },
      "mission-business-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve regenerated business authority before mission delivery.",
          "approve": "OK BUSINESS <hash>",
          "reject": "REJECT BUSINESS <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "business.model.review",
              "status": "approved"
            },
            "target": "mission-business-publish"
          },
          {
            "when": {
              "stage": "business.model.review",
              "status": "rejected"
            },
            "target": "mission-business-evidence"
          }
        ]
      },
      "mission-business-publish": {
        "kind": "operator",
        "ref": "business/publish",
        "on": [
          {
            "when": {
              "decision": "direct-plan"
            },
            "target": "mission-business-staleness",
            "label": "direct-plan"
          },
          {
            "when": {
              "decision": "architecture-required"
            },
            "target": "mission-business-staleness",
            "label": "architecture-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-impact": {
        "kind": "operator",
        "ref": "delivery/impact-classify",
        "on": [
          {
            "when": {
              "decision": "backend-required"
            },
            "target": "ship-architecture-frame",
            "label": "backend-required"
          },
          {
            "when": {
              "decision": "frontend-only"
            },
            "target": "authority-reconcile",
            "label": "frontend-only"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-architecture-frame": {
        "kind": "operator",
        "ref": "architecture/decision-frame",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-current",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-current": {
        "kind": "operator",
        "ref": "architecture/current-state",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-alternatives",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-alternatives": {
        "kind": "operator",
        "ref": "architecture/alternatives",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-challenge",
            "label": "ready"
          }
        ]
      },
      "ship-architecture-challenge": {
        "kind": "operator",
        "ref": "architecture/decision-challenge",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-architecture-selection",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "ship-architecture-alternatives",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-architecture-selection": {
        "kind": "wait",
        "approval": {
          "prompt": "Review the rendered visualize comparison, then approve the exact backend architecture required by this mission.",
          "approve": "OK ARCHITECTURE <decision>",
          "reject": "REJECT ARCHITECTURE <decision>"
        },
        "on": [
          {
            "when": {
              "stage": "architecture.decision.handoff",
              "status": "ready",
              "allFacts": [
                "architecture-visual-preview-ready"
              ]
            },
            "target": "ship-architecture-handoff"
          },
          {
            "when": {
              "stage": "architecture.decision.alternatives",
              "status": "ready"
            },
            "target": "ship-architecture-alternatives"
          }
        ]
      },
      "ship-architecture-handoff": {
        "kind": "operator",
        "ref": "architecture/decision-handoff",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-source-discovery",
            "label": "ready"
          }
        ]
      },
      "ship-source-discovery": {
        "kind": "operator",
        "ref": "architecture/source-discovery",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-pattern-bind",
            "label": "ready"
          }
        ]
      },
      "ship-pattern-bind": {
        "kind": "operator",
        "ref": "architecture/pattern-bind",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-boundary-plan",
            "label": "ready"
          }
        ]
      },
      "ship-boundary-plan": {
        "kind": "operator",
        "ref": "architecture/boundary-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-boundary-challenge",
            "label": "ready"
          }
        ]
      },
      "ship-boundary-challenge": {
        "kind": "operator",
        "ref": "architecture/boundary-challenge",
        "on": [
          {
            "when": {
              "decision": "clean"
            },
            "target": "ship-boundary-approval",
            "label": "clean"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "ship-boundary-plan",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-boundary-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact backend plan required to complete this mission.",
          "approve": "OK BACKEND <hash>",
          "reject": "REJECT BACKEND <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "architecture.boundary.review",
              "status": "approved"
            },
            "target": "ship-coding-scope"
          },
          {
            "when": {
              "stage": "architecture.boundary.review",
              "status": "rejected"
            },
            "target": "ship-boundary-plan"
          }
        ]
      },
      "ship-coding-scope": {
        "kind": "operator",
        "ref": "be/coding-scope-freeze",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-implement",
            "label": "ready"
          },
          {
            "when": {
              "decision": "source-drift"
            },
            "target": "ship-boundary-plan",
            "label": "source-drift"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-implement": {
        "kind": "operator",
        "ref": "be/implementation",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "ship-format",
            "label": "ready"
          },
          {
            "when": {
              "decision": "source-drift"
            },
            "target": "ship-boundary-plan",
            "label": "source-drift"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-format": {
        "kind": "operator",
        "ref": "quality/format",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-lint",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-lint": {
        "kind": "operator",
        "ref": "quality/lint",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-typecheck",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-typecheck": {
        "kind": "operator",
        "ref": "quality/typecheck",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-build",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-build": {
        "kind": "operator",
        "ref": "quality/build",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-unit",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-unit": {
        "kind": "operator",
        "ref": "quality/unit-coverage",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-integration",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-integration": {
        "kind": "operator",
        "ref": "quality/integration",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-e2e",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-e2e": {
        "kind": "operator",
        "ref": "quality/e2e",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-sonar",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-sonar": {
        "kind": "operator",
        "ref": "quality/sonar",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-source-proof",
            "label": "pass"
          },
          {
            "when": {
              "decision": "in-boundary"
            },
            "target": "ship-implement",
            "label": "in-boundary"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "ship-boundary-plan",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "ship-source-proof": {
        "kind": "operator",
        "ref": "quality/delivery-proof",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "ship-resume",
            "label": "pass"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "ship-resume": {
        "kind": "operator",
        "ref": "delivery/mission-resume",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "authority-reconcile",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-proof": {
        "kind": "operator",
        "ref": "delivery/mission-proof",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "mission-business-reconcile",
            "label": "pass"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mission-business-reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      }
    },
    "options": {},
    "description": "Use when a closed set of product surfaces must converge on the smallest durable authority and every affected backend/frontend consumer, then pass complete end-to-end proof. Do not use for a single block, isolated maintenance, or a new customer journey.",
    "checks": [
      "Capture the feedback session with explicit accepts and rejects in .claude/requests before reconciliation.",
      "Resolve the closed surface set, fresh business head, inconsistency evidence and complete acceptance proof matrix.",
      "Identify the smallest authority and classify role impact, with explicit authority and any required backend boundary approval before mutation.",
      "When the closed surface set includes a landing page, require complete purposeful Framer Motion coverage for hero entrance, section reveal, staggered content and interactive feedback, plus deterministic reduced-motion proof; unspecified or decorative-only motion is incomplete.",
      "When public child surfaces inherit a landing authority, bound display type so useful content remains visible near the first viewport, require purposeful route media, and prove primary lists, documents and reading regions use the full available content grid instead of leaving an unexplained empty column.",
      "Require complete unit, E2E, UI-quality, browser, joined mission proof and business reconciliation before completion."
    ],
    "contextMatrix": [
      [
        "surface audit + authority",
        "closed surface IDs, current authority/consumer revisions, observed inconsistency and proof-plan headers",
        "unrelated surfaces, broad source and raw business context"
      ],
      [
        "approval + reconcile",
        "frozen authority hash, exact authority and consumer targets, approval receipt and complete acceptance-plan identity",
        "undeclared consumers, new discovery and scope expansion"
      ],
      [
        "proof",
        "joined authority/source change receipt, deterministic seed/reset, declared commands, UI-quality receipt, browser/account handles and complete state-and-viewport evidence",
        "partial proof, skipped scenarios, raw credentials and unrelated design history"
      ]
    ]
  },
  {
    "id": "workflow-diagnose",
    "display": "StarCi Workflow Diagnose",
    "short": "Trace one failing workflow without mutation",
    "entry": "diagnose",
    "states": {
      "diagnose": {
        "kind": "operator",
        "ref": "quality/workflow-diagnose",
        "on": [
          {
            "when": {
              "decision": "diagnosed"
            },
            "target": "complete",
            "label": "diagnosed"
          },
          {
            "when": {
              "decision": "inconclusive"
            },
            "target": "blocked",
            "label": "inconclusive"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "inventory": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "complete",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "repair-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "repair-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact measured finding and repair boundary.",
          "approve": "OK REPAIR <finding>",
          "reject": "REJECT REPAIR <finding>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "approved"
            },
            "target": "repair"
          },
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "repair": {
        "kind": "operator",
        "ref": "quality/finding-repair",
        "on": [
          {
            "when": {
              "decision": "repaired"
            },
            "target": "inventory",
            "label": "repaired"
          },
          {
            "when": {
              "decision": "stale-finding"
            },
            "target": "inventory",
            "label": "stale-finding"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "blocked",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "debt-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact debt identity, baseline, closure criterion and bounded iteration budget.",
          "approve": "OK DEBT <hash>",
          "reject": "REJECT DEBT <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "approved"
            },
            "target": "debt"
          },
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "debt": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "debt",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "debt-proof",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-proof": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "debt-close",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "debt-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-close": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "blocked",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "blocked",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "bindings": {
        "kind": "operator",
        "ref": "quality/rule-binding-check",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "complete",
            "label": "pass"
          },
          {
            "when": {
              "decision": "fail"
            },
            "target": "findings",
            "label": "fail"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "findings": {
        "kind": "terminal",
        "result": "complete"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to find why one workflow fails and return a report-only diagnosis without changing source or external state. Do not use for readiness inventory, approved repair, quality debt, or rule-binding audit.",
    "checks": [
      "Resolve one failing workflow and observed symptom.",
      "Keep the boundary read-only.",
      "Reject implied repair or an unbounded request."
    ]
  },
  {
    "id": "quality-readiness",
    "display": "StarCi Quality Readiness",
    "short": "Inventory and close measured readiness findings",
    "entry": "inventory",
    "states": {
      "diagnose": {
        "kind": "operator",
        "ref": "quality/workflow-diagnose",
        "on": [
          {
            "when": {
              "decision": "diagnosed"
            },
            "target": "complete",
            "label": "diagnosed"
          },
          {
            "when": {
              "decision": "inconclusive"
            },
            "target": "blocked",
            "label": "inconclusive"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "inventory": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "complete",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "repair-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "repair-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact measured finding and repair boundary.",
          "approve": "OK REPAIR <finding>",
          "reject": "REJECT REPAIR <finding>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "approved"
            },
            "target": "repair"
          },
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "repair": {
        "kind": "operator",
        "ref": "quality/finding-repair",
        "on": [
          {
            "when": {
              "decision": "repaired"
            },
            "target": "inventory",
            "label": "repaired"
          },
          {
            "when": {
              "decision": "stale-finding"
            },
            "target": "inventory",
            "label": "stale-finding"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "blocked",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "debt-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact debt identity, baseline, closure criterion and bounded iteration budget.",
          "approve": "OK DEBT <hash>",
          "reject": "REJECT DEBT <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "approved"
            },
            "target": "debt"
          },
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "debt": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "debt",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "debt-proof",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-proof": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "debt-close",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "debt-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-close": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "blocked",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "blocked",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "bindings": {
        "kind": "operator",
        "ref": "quality/rule-binding-check",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "complete",
            "label": "pass"
          },
          {
            "when": {
              "decision": "fail"
            },
            "target": "findings",
            "label": "fail"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "findings": {
        "kind": "terminal",
        "result": "complete"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to inventory one delivery boundary and loop through explicitly approved measured repairs until readiness is green. Do not use for diagnosis-only work, debt repayment, or rule-binding audit.",
    "checks": [
      "Resolve one delivery boundary and required checks.",
      "Separate measured findings from speculative improvements.",
      "Require approval before every source repair."
    ]
  },
  {
    "id": "quality-finding-repair",
    "display": "StarCi Quality Finding Repair",
    "short": "Repair one approved measured quality finding",
    "entry": "repair-approval",
    "states": {
      "diagnose": {
        "kind": "operator",
        "ref": "quality/workflow-diagnose",
        "on": [
          {
            "when": {
              "decision": "diagnosed"
            },
            "target": "complete",
            "label": "diagnosed"
          },
          {
            "when": {
              "decision": "inconclusive"
            },
            "target": "blocked",
            "label": "inconclusive"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "inventory": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "complete",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "repair-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "repair-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact measured finding and repair boundary.",
          "approve": "OK REPAIR <finding>",
          "reject": "REJECT REPAIR <finding>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "approved"
            },
            "target": "repair"
          },
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "repair": {
        "kind": "operator",
        "ref": "quality/finding-repair",
        "on": [
          {
            "when": {
              "decision": "repaired"
            },
            "target": "finding-proof",
            "label": "repaired"
          },
          {
            "when": {
              "decision": "stale-finding"
            },
            "target": "finding-proof",
            "label": "stale-finding"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "blocked",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "debt-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact debt identity, baseline, closure criterion and bounded iteration budget.",
          "approve": "OK DEBT <hash>",
          "reject": "REJECT DEBT <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "approved"
            },
            "target": "debt"
          },
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "debt": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "debt",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "debt-proof",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-proof": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "debt-close",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "debt-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-close": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "blocked",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "blocked",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "bindings": {
        "kind": "operator",
        "ref": "quality/rule-binding-check",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "complete",
            "label": "pass"
          },
          {
            "when": {
              "decision": "fail"
            },
            "target": "findings",
            "label": "fail"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "findings": {
        "kind": "terminal",
        "result": "complete"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      },
      "finding-proof": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "complete",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "residual-findings",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "residual-findings": {
        "kind": "terminal",
        "result": "handoff"
      }
    },
    "options": {},
    "description": "Use to repair one already measured quality finding after confirming its exact approval boundary, then re-inventory the target. Do not use for broad readiness assessment, diagnosis, or debt repayment.",
    "checks": [
      "Resolve one finding, baseline and repair target.",
      "Require the exact approval before mutation.",
      "Re-inventory after repair and stop on boundary drift."
    ]
  },
  {
    "id": "quality-debt-repay",
    "display": "StarCi Quality Debt Repay",
    "short": "Repay one approved quality debt boundary",
    "entry": "debt-approval",
    "states": {
      "diagnose": {
        "kind": "operator",
        "ref": "quality/workflow-diagnose",
        "on": [
          {
            "when": {
              "decision": "diagnosed"
            },
            "target": "complete",
            "label": "diagnosed"
          },
          {
            "when": {
              "decision": "inconclusive"
            },
            "target": "blocked",
            "label": "inconclusive"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "inventory": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "complete",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "repair-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "repair-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact measured finding and repair boundary.",
          "approve": "OK REPAIR <finding>",
          "reject": "REJECT REPAIR <finding>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "approved"
            },
            "target": "repair"
          },
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "repair": {
        "kind": "operator",
        "ref": "quality/finding-repair",
        "on": [
          {
            "when": {
              "decision": "repaired"
            },
            "target": "inventory",
            "label": "repaired"
          },
          {
            "when": {
              "decision": "stale-finding"
            },
            "target": "inventory",
            "label": "stale-finding"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "blocked",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "debt-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact debt identity, baseline, closure criterion and bounded iteration budget.",
          "approve": "OK DEBT <hash>",
          "reject": "REJECT DEBT <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "approved"
            },
            "target": "debt"
          },
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "debt": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "debt",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "debt-proof",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-proof": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "debt-close",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "debt-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-close": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "blocked",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "blocked",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "bindings": {
        "kind": "operator",
        "ref": "quality/rule-binding-check",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "complete",
            "label": "pass"
          },
          {
            "when": {
              "decision": "fail"
            },
            "target": "findings",
            "label": "fail"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "findings": {
        "kind": "terminal",
        "result": "complete"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to repay one declared and approved quality-debt item through a measured progress loop. Do not use for ordinary findings, diagnosis, readiness inventory, or feature delivery.",
    "checks": [
      "Resolve one approved debt identity and closure criterion.",
      "Confirm the permitted mutation boundary.",
      "Reject undocumented cleanup or unrelated refactoring."
    ]
  },
  {
    "id": "rule-binding-audit",
    "display": "StarCi Rule Binding Audit",
    "short": "Audit executable rule ownership and binding",
    "entry": "bindings",
    "states": {
      "diagnose": {
        "kind": "operator",
        "ref": "quality/workflow-diagnose",
        "on": [
          {
            "when": {
              "decision": "diagnosed"
            },
            "target": "complete",
            "label": "diagnosed"
          },
          {
            "when": {
              "decision": "inconclusive"
            },
            "target": "blocked",
            "label": "inconclusive"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "inventory": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "complete",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "repair-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "repair-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one exact measured finding and repair boundary.",
          "approve": "OK REPAIR <finding>",
          "reject": "REJECT REPAIR <finding>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "approved"
            },
            "target": "repair"
          },
          {
            "when": {
              "stage": "quality.repair.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "repair": {
        "kind": "operator",
        "ref": "quality/finding-repair",
        "on": [
          {
            "when": {
              "decision": "repaired"
            },
            "target": "inventory",
            "label": "repaired"
          },
          {
            "when": {
              "decision": "stale-finding"
            },
            "target": "inventory",
            "label": "stale-finding"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "blocked",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "external-blocker"
            },
            "target": "blocked",
            "label": "external-blocker"
          }
        ]
      },
      "debt-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact debt identity, baseline, closure criterion and bounded iteration budget.",
          "approve": "OK DEBT <hash>",
          "reject": "REJECT DEBT <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "approved"
            },
            "target": "debt"
          },
          {
            "when": {
              "stage": "quality.debt.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "debt": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "debt",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "debt-proof",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-proof": {
        "kind": "operator",
        "ref": "quality/readiness-inventory",
        "on": [
          {
            "when": {
              "decision": "green"
            },
            "target": "debt-close",
            "label": "green"
          },
          {
            "when": {
              "decision": "findings"
            },
            "target": "debt-approval",
            "label": "findings"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "debt-close": {
        "kind": "operator",
        "ref": "quality/debt-repay",
        "on": [
          {
            "when": {
              "decision": "closed"
            },
            "target": "complete",
            "label": "closed"
          },
          {
            "when": {
              "decision": "progress"
            },
            "target": "blocked",
            "label": "progress"
          },
          {
            "when": {
              "decision": "closure-candidate"
            },
            "target": "blocked",
            "label": "closure-candidate"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "bindings": {
        "kind": "operator",
        "ref": "quality/rule-binding-check",
        "on": [
          {
            "when": {
              "decision": "pass"
            },
            "target": "complete",
            "label": "pass"
          },
          {
            "when": {
              "decision": "fail"
            },
            "target": "findings",
            "label": "fail"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "findings": {
        "kind": "terminal",
        "result": "complete"
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to audit whether declared rules have one accountable executable binding. Do not use to repair source, inventory readiness, diagnose a workflow, or repay debt.",
    "checks": [
      "Resolve the declared rules and expected owners.",
      "Keep the audit check-only.",
      "Reject policy interpretation with no executable target."
    ]
  },
  {
    "id": "deployment",
    "display": "StarCi Deployment",
    "short": "Adopt and deploy one immutable release",
    "entry": "route",
    "states": {
      "route": {
        "kind": "operator",
        "ref": "workspace/route-verify",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "intent",
            "label": "ready"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "blocked",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "intent": {
        "kind": "operator",
        "ref": "deployment/intent-bind",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "manifest",
            "label": "ready"
          }
        ]
      },
      "manifest": {
        "kind": "operator",
        "ref": "deployment/manifest-validate",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "plan",
            "label": "ready"
          }
        ]
      },
      "plan": {
        "kind": "operator",
        "ref": "deployment/execution-plan",
        "on": [
          {
            "when": {
              "decision": "execute"
            },
            "target": "execution-root",
            "label": "execute"
          },
          {
            "when": {
              "decision": "approval-required"
            },
            "target": "approval",
            "label": "approval-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve only new host/domain/tenant/project/destructive/rotation deployment boundary.",
          "approve": "OK DEPLOY <hash>",
          "reject": "REJECT DEPLOY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "deployment.review",
              "status": "approved"
            },
            "target": "execution-root"
          },
          {
            "when": {
              "stage": "deployment.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "execution-root": {
        "kind": "operator",
        "ref": "deployment/execution-root-init",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "credentials",
            "label": "ready"
          }
        ]
      },
      "credentials": {
        "kind": "operator",
        "ref": "deployment/credential-resolve",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "host",
            "label": "ready"
          }
        ]
      },
      "host": {
        "kind": "operator",
        "ref": "deployment/host-prepare",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "artifact-build",
            "label": "ready"
          }
        ]
      },
      "artifact-build": {
        "kind": "operator",
        "ref": "deployment/artifact-build",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "artifact-publish",
            "label": "ready"
          }
        ]
      },
      "artifact-publish": {
        "kind": "operator",
        "ref": "deployment/artifact-publish",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "migration",
            "label": "ready"
          }
        ]
      },
      "migration": {
        "kind": "operator",
        "ref": "deployment/migration",
        "on": [
          {
            "when": {
              "decision": "applied"
            },
            "target": "domain",
            "label": "applied"
          },
          {
            "when": {
              "decision": "not-applicable"
            },
            "target": "domain",
            "label": "not-applicable"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "domain": {
        "kind": "operator",
        "ref": "deployment/domain-reconcile",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "rollout",
            "label": "ready"
          }
        ]
      },
      "rollout": {
        "kind": "operator",
        "ref": "deployment/rollout",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "monitor",
            "label": "ready"
          },
          {
            "when": {
              "decision": "partial"
            },
            "target": "blocked",
            "label": "partial"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "monitor": {
        "kind": "operator",
        "ref": "deployment/monitor",
        "on": [
          {
            "when": {
              "decision": "progressing"
            },
            "target": "monitor",
            "label": "progressing"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "monitor",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "steady"
            },
            "target": "proof",
            "label": "steady"
          },
          {
            "when": {
              "decision": "recover"
            },
            "target": "recover",
            "label": "recover"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "recover": {
        "kind": "operator",
        "ref": "deployment/recover",
        "on": [
          {
            "when": {
              "decision": "retry"
            },
            "target": "monitor",
            "label": "retry"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "approval-required"
            },
            "target": "recovery-approval",
            "label": "approval-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "recovery-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact recovery boundary.",
          "approve": "OK DEPLOY <hash>",
          "reject": "REJECT DEPLOY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "deployment.review",
              "status": "approved"
            },
            "target": "recover"
          },
          {
            "when": {
              "stage": "deployment.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "rollback": {
        "kind": "operator",
        "ref": "deployment/rollback",
        "on": [
          {
            "when": {
              "decision": "rolled-back"
            },
            "target": "proof",
            "label": "rolled-back"
          },
          {
            "when": {
              "decision": "partial"
            },
            "target": "blocked",
            "label": "partial"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "proof": {
        "kind": "operator",
        "ref": "deployment/proof",
        "on": [
          {
            "when": {
              "decision": "complete"
            },
            "target": "reconcile-choice",
            "label": "complete"
          },
          {
            "when": {
              "decision": "rolled-back"
            },
            "target": "rolled-back",
            "label": "rolled-back"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.reconcileBusiness": true
              }
            },
            "target": "business-reconcile"
          },
          {
            "when": {
              "inputEquals": {
                "options.reconcileBusiness": false
              }
            },
            "target": "complete"
          }
        ]
      },
      "business-reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rolled-back": {
        "kind": "terminal",
        "result": "rolled-back"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {
      "reconcileBusiness": {
        "type": "boolean",
        "description": "Reconcile final proof into the business head."
      }
    },
    "description": "Use to adopt deployment intent when needed and execute one immutable release through public steady-state proof. Do not use merely to monitor, recover, or roll back an existing rollout.",
    "checks": [
      "Resolve environment, manifest, artifact and provider identities.",
      "Confirm a new rollout is the outcome.",
      "Flag new resources, destructive changes and credential rotation for approval."
    ]
  },
  {
    "id": "deployment-monitor",
    "display": "StarCi Deployment Monitor",
    "short": "Monitor one existing rollout to steady state",
    "entry": "monitor",
    "states": {
      "monitor": {
        "kind": "operator",
        "ref": "deployment/monitor",
        "on": [
          {
            "when": {
              "decision": "progressing"
            },
            "target": "monitor",
            "label": "progressing"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "monitor",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "steady"
            },
            "target": "proof",
            "label": "steady"
          },
          {
            "when": {
              "decision": "recover"
            },
            "target": "recover",
            "label": "recover"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "recover": {
        "kind": "operator",
        "ref": "deployment/recover",
        "on": [
          {
            "when": {
              "decision": "retry"
            },
            "target": "monitor",
            "label": "retry"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "approval-required"
            },
            "target": "recovery-approval",
            "label": "approval-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "recovery-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact recovery boundary.",
          "approve": "OK DEPLOY <hash>",
          "reject": "REJECT DEPLOY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "deployment.review",
              "status": "approved"
            },
            "target": "recover"
          },
          {
            "when": {
              "stage": "deployment.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "rollback": {
        "kind": "operator",
        "ref": "deployment/rollback",
        "on": [
          {
            "when": {
              "decision": "rolled-back"
            },
            "target": "proof",
            "label": "rolled-back"
          },
          {
            "when": {
              "decision": "partial"
            },
            "target": "blocked",
            "label": "partial"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "proof": {
        "kind": "operator",
        "ref": "deployment/proof",
        "on": [
          {
            "when": {
              "decision": "complete"
            },
            "target": "reconcile-choice",
            "label": "complete"
          },
          {
            "when": {
              "decision": "rolled-back"
            },
            "target": "rolled-back",
            "label": "rolled-back"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.reconcileBusiness": true
              }
            },
            "target": "business-reconcile"
          },
          {
            "when": {
              "inputEquals": {
                "options.reconcileBusiness": false
              }
            },
            "target": "complete"
          }
        ]
      },
      "business-reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rolled-back": {
        "kind": "terminal",
        "result": "rolled-back"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {
      "reconcileBusiness": {
        "type": "boolean",
        "description": "Reconcile final proof into the business head."
      }
    },
    "description": "Use to watch one release that is already rolling out until steady state when observation is the starting action, continuing to recovery, rollback, or a bounded blocker only if evidence requires it. Do not use when recovery is already approved or to initiate a new deployment.",
    "checks": [
      "Resolve one existing release and rollout identity.",
      "Confirm observation is the starting action.",
      "Keep recovery and rollback bound to the same release."
    ]
  },
  {
    "id": "deployment-recover",
    "display": "StarCi Deployment Recover",
    "short": "Recover one observed failed rollout safely",
    "entry": "recover",
    "states": {
      "monitor": {
        "kind": "operator",
        "ref": "deployment/monitor",
        "on": [
          {
            "when": {
              "decision": "progressing"
            },
            "target": "monitor",
            "label": "progressing"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "monitor",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "steady"
            },
            "target": "proof",
            "label": "steady"
          },
          {
            "when": {
              "decision": "recover"
            },
            "target": "recover",
            "label": "recover"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "recover": {
        "kind": "operator",
        "ref": "deployment/recover",
        "on": [
          {
            "when": {
              "decision": "retry"
            },
            "target": "monitor",
            "label": "retry"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "approval-required"
            },
            "target": "recovery-approval",
            "label": "approval-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "recovery-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact recovery boundary.",
          "approve": "OK DEPLOY <hash>",
          "reject": "REJECT DEPLOY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "deployment.review",
              "status": "approved"
            },
            "target": "recover"
          },
          {
            "when": {
              "stage": "deployment.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "rollback": {
        "kind": "operator",
        "ref": "deployment/rollback",
        "on": [
          {
            "when": {
              "decision": "rolled-back"
            },
            "target": "proof",
            "label": "rolled-back"
          },
          {
            "when": {
              "decision": "partial"
            },
            "target": "blocked",
            "label": "partial"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "proof": {
        "kind": "operator",
        "ref": "deployment/proof",
        "on": [
          {
            "when": {
              "decision": "complete"
            },
            "target": "reconcile-choice",
            "label": "complete"
          },
          {
            "when": {
              "decision": "rolled-back"
            },
            "target": "rolled-back",
            "label": "rolled-back"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.reconcileBusiness": true
              }
            },
            "target": "business-reconcile"
          },
          {
            "when": {
              "inputEquals": {
                "options.reconcileBusiness": false
              }
            },
            "target": "complete"
          }
        ]
      },
      "business-reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rolled-back": {
        "kind": "terminal",
        "result": "rolled-back"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {
      "reconcileBusiness": {
        "type": "boolean",
        "description": "Reconcile final proof into the business head."
      }
    },
    "description": "Use when recovery is the approved starting action for one observed failed rollout before any rollback, then monitor the same release to proof. Do not use for a new deployment or a speculative failure.",
    "checks": [
      "Resolve one observed failure and release identity.",
      "Confirm recovery stays inside its boundary.",
      "Require approval for any expansion."
    ]
  },
  {
    "id": "deployment-rollback",
    "display": "StarCi Deployment Rollback",
    "short": "Roll back one declared release identity",
    "entry": "rollback",
    "states": {
      "monitor": {
        "kind": "operator",
        "ref": "deployment/monitor",
        "on": [
          {
            "when": {
              "decision": "progressing"
            },
            "target": "monitor",
            "label": "progressing"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "monitor",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "steady"
            },
            "target": "proof",
            "label": "steady"
          },
          {
            "when": {
              "decision": "recover"
            },
            "target": "recover",
            "label": "recover"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "recover": {
        "kind": "operator",
        "ref": "deployment/recover",
        "on": [
          {
            "when": {
              "decision": "retry"
            },
            "target": "monitor",
            "label": "retry"
          },
          {
            "when": {
              "decision": "rollback"
            },
            "target": "rollback",
            "label": "rollback"
          },
          {
            "when": {
              "decision": "approval-required"
            },
            "target": "recovery-approval",
            "label": "approval-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "recovery-approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact recovery boundary.",
          "approve": "OK DEPLOY <hash>",
          "reject": "REJECT DEPLOY <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "deployment.review",
              "status": "approved"
            },
            "target": "recover"
          },
          {
            "when": {
              "stage": "deployment.review",
              "status": "rejected"
            },
            "target": "rejected"
          }
        ]
      },
      "rollback": {
        "kind": "operator",
        "ref": "deployment/rollback",
        "on": [
          {
            "when": {
              "decision": "rolled-back"
            },
            "target": "proof",
            "label": "rolled-back"
          },
          {
            "when": {
              "decision": "partial"
            },
            "target": "blocked",
            "label": "partial"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "proof": {
        "kind": "operator",
        "ref": "deployment/proof",
        "on": [
          {
            "when": {
              "decision": "complete"
            },
            "target": "reconcile-choice",
            "label": "complete"
          },
          {
            "when": {
              "decision": "rolled-back"
            },
            "target": "rolled-back",
            "label": "rolled-back"
          },
          {
            "when": {
              "decision": "external-error"
            },
            "target": "blocked",
            "label": "external-error"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "reconcile-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.reconcileBusiness": true
              }
            },
            "target": "business-reconcile"
          },
          {
            "when": {
              "inputEquals": {
                "options.reconcileBusiness": false
              }
            },
            "target": "complete"
          }
        ]
      },
      "business-reconcile": {
        "kind": "operator",
        "ref": "business/reconcile",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "discrepancy"
            },
            "target": "blocked",
            "label": "discrepancy"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "rolled-back": {
        "kind": "terminal",
        "result": "rolled-back"
      },
      "rejected": {
        "kind": "terminal",
        "result": "rejected"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {
      "reconcileBusiness": {
        "type": "boolean",
        "description": "Reconcile final proof into the business head."
      }
    },
    "description": "Use to roll back one declared failed or rejected release identity and prove the resulting state. Do not use to deploy, monitor, or attempt recovery first.",
    "checks": [
      "Resolve release and rollback target identities.",
      "Confirm rollback authority and expected state.",
      "Reject an undeclared destructive target."
    ]
  },
  {
    "id": "tunnel-reconcile",
    "display": "StarCi Tunnel Reconcile",
    "short": "Reconcile one bounded tunnel and DNS route",
    "entry": "tunnel-plan",
    "states": {
      "tunnel-plan": {
        "kind": "operator",
        "ref": "platform/tunnel-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "tunnel-apply",
            "label": "ready"
          }
        ]
      },
      "tunnel-apply": {
        "kind": "operator",
        "ref": "platform/tunnel-apply",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-config": {
        "kind": "operator",
        "ref": "platform/mcp-config",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "source-index",
            "label": "ready"
          }
        ]
      },
      "source-index": {
        "kind": "operator",
        "ref": "platform/source-index",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-publish-choice",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-publish-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": false
              }
            },
            "target": "complete"
          },
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": true,
                "options.ensureTunnel": false
              }
            },
            "target": "mcp-publish"
          },
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": true,
                "options.ensureTunnel": true
              }
            },
            "target": "mcp-tunnel-plan"
          }
        ]
      },
      "mcp-tunnel-plan": {
        "kind": "operator",
        "ref": "platform/tunnel-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-tunnel-apply",
            "label": "ready"
          }
        ]
      },
      "mcp-tunnel-apply": {
        "kind": "operator",
        "ref": "platform/tunnel-apply",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "mcp-publish",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-publish": {
        "kind": "operator",
        "ref": "platform/mcp-publish",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "sonar": {
        "kind": "operator",
        "ref": "platform/sonar-service-reconcile",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "observability": {
        "kind": "operator",
        "ref": "platform/observability-reconcile",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to reconcile one bounded HTTP tunnel and DNS route. Do not use for source indexing, Sonar, observability, product deployment, or unrelated Cloudflare work.",
    "checks": [
      "Resolve account, tunnel, hostname and service target.",
      "Confirm one HTTP route is the full boundary.",
      "Require authority for public DNS mutation."
    ]
  },
  {
    "id": "source-index-publish",
    "display": "StarCi Source Index Publish",
    "short": "Index and optionally publish StarCi context",
    "entry": "mcp-config",
    "states": {
      "tunnel-plan": {
        "kind": "operator",
        "ref": "platform/tunnel-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "tunnel-apply",
            "label": "ready"
          }
        ]
      },
      "tunnel-apply": {
        "kind": "operator",
        "ref": "platform/tunnel-apply",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-config": {
        "kind": "operator",
        "ref": "platform/mcp-config",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "index-kind-choice",
            "label": "ready"
          }
        ]
      },
      "source-index": {
        "kind": "operator",
        "ref": "platform/source-index",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-publish-choice",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-publish-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": false
              }
            },
            "target": "complete"
          },
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": true,
                "options.ensureTunnel": false
              }
            },
            "target": "mcp-publish"
          },
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": true,
                "options.ensureTunnel": true
              }
            },
            "target": "mcp-tunnel-plan"
          }
        ]
      },
      "mcp-tunnel-plan": {
        "kind": "operator",
        "ref": "platform/tunnel-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-tunnel-apply",
            "label": "ready"
          }
        ]
      },
      "mcp-tunnel-apply": {
        "kind": "operator",
        "ref": "platform/tunnel-apply",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "mcp-publish",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-publish": {
        "kind": "operator",
        "ref": "platform/mcp-publish",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "sonar": {
        "kind": "operator",
        "ref": "platform/sonar-service-reconcile",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "observability": {
        "kind": "operator",
        "ref": "platform/observability-reconcile",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      },
      "index-kind-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.indexReferences": true
              }
            },
            "target": "reference-reindex"
          },
          {
            "when": {
              "inputEquals": {
                "options.indexReferences": false
              }
            },
            "target": "source-index"
          }
        ]
      },
      "reference-reindex": {
        "kind": "operator",
        "ref": "platform/reference-reindex",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-publish-choice",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      }
    },
    "options": {
      "publishPublic": {
        "type": "boolean",
        "description": "Publish MCP through the declared public boundary."
      },
      "ensureTunnel": {
        "type": "boolean",
        "description": "Reconcile a tunnel before MCP publication."
      },
      "indexReferences": {
        "type": "boolean",
        "description": "Index clean local reference checkouts instead of business/generated-contract context."
      }
    },
    "description": "Use to configure and index StarCi business, generated-contract, or clean .worktrees/references context, optionally publishing its MCP boundary. Do not use for product delivery, Sonar, observability, or a tunnel-only request.",
    "checks": [
      "Resolve project and declared context inputs.",
      "Distinguish local indexing from public MCP mutation.",
      "Evaluate tunnel work only for public publication.",
      "For reference mode, resolve portable routes into clean .worktrees/references checkouts and require a versioned adaptive drift policy, Python Qdrant Edge, full-text/path lookup, optional embeddings, loopback Caddy, and ignored machine-local runtime state."
    ],
    "inputBoundary": "This package owns one fixed-entry flow. Set `options.indexReferences=true` to select clean local reference indexing; false retains business/generated-contract indexing. No undeclared mode is accepted."
  },
  {
    "id": "sonar-service-reconcile",
    "display": "StarCi Sonar Service Reconcile",
    "short": "Reconcile shared Sonar quality enforcement",
    "entry": "sonar",
    "states": {
      "tunnel-plan": {
        "kind": "operator",
        "ref": "platform/tunnel-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "tunnel-apply",
            "label": "ready"
          }
        ]
      },
      "tunnel-apply": {
        "kind": "operator",
        "ref": "platform/tunnel-apply",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-config": {
        "kind": "operator",
        "ref": "platform/mcp-config",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "source-index",
            "label": "ready"
          }
        ]
      },
      "source-index": {
        "kind": "operator",
        "ref": "platform/source-index",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-publish-choice",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-publish-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": false
              }
            },
            "target": "complete"
          },
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": true,
                "options.ensureTunnel": false
              }
            },
            "target": "mcp-publish"
          },
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": true,
                "options.ensureTunnel": true
              }
            },
            "target": "mcp-tunnel-plan"
          }
        ]
      },
      "mcp-tunnel-plan": {
        "kind": "operator",
        "ref": "platform/tunnel-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-tunnel-apply",
            "label": "ready"
          }
        ]
      },
      "mcp-tunnel-apply": {
        "kind": "operator",
        "ref": "platform/tunnel-apply",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "mcp-publish",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-publish": {
        "kind": "operator",
        "ref": "platform/mcp-publish",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "sonar": {
        "kind": "operator",
        "ref": "platform/sonar-service-reconcile",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "observability": {
        "kind": "operator",
        "ref": "platform/observability-reconcile",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to reconcile the shared Sonar service and its quality-enforcement boundary. Do not use to fix product findings, deploy releases, index context, or configure observability.",
    "checks": [
      "Resolve service, project and enforcement identities.",
      "Keep product repair outside this flow.",
      "Require authority for external service mutation."
    ]
  },
  {
    "id": "observability-reconcile",
    "display": "StarCi Observability Reconcile",
    "short": "Reconcile shared metrics and remote write",
    "entry": "observability",
    "states": {
      "tunnel-plan": {
        "kind": "operator",
        "ref": "platform/tunnel-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "tunnel-apply",
            "label": "ready"
          }
        ]
      },
      "tunnel-apply": {
        "kind": "operator",
        "ref": "platform/tunnel-apply",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-config": {
        "kind": "operator",
        "ref": "platform/mcp-config",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "source-index",
            "label": "ready"
          }
        ]
      },
      "source-index": {
        "kind": "operator",
        "ref": "platform/source-index",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-publish-choice",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-publish-choice": {
        "kind": "choice",
        "on": [
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": false
              }
            },
            "target": "complete"
          },
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": true,
                "options.ensureTunnel": false
              }
            },
            "target": "mcp-publish"
          },
          {
            "when": {
              "inputEquals": {
                "options.publishPublic": true,
                "options.ensureTunnel": true
              }
            },
            "target": "mcp-tunnel-plan"
          }
        ]
      },
      "mcp-tunnel-plan": {
        "kind": "operator",
        "ref": "platform/tunnel-plan",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "mcp-tunnel-apply",
            "label": "ready"
          }
        ]
      },
      "mcp-tunnel-apply": {
        "kind": "operator",
        "ref": "platform/tunnel-apply",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "mcp-publish",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "mcp-publish": {
        "kind": "operator",
        "ref": "platform/mcp-publish",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "sonar": {
        "kind": "operator",
        "ref": "platform/sonar-service-reconcile",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "observability": {
        "kind": "operator",
        "ref": "platform/observability-reconcile",
        "on": [
          {
            "when": {
              "decision": "proved"
            },
            "target": "complete",
            "label": "proved"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Use to reconcile shared metrics collection and remote-write boundaries. Do not use for product diagnosis, deployment monitoring, Sonar, or context indexing.",
    "checks": [
      "Resolve metrics source, tenant and remote-write target.",
      "Distinguish service work from product diagnosis.",
      "Require authority for external mutation."
    ]
  },
  {
    "id": "conversation-record",
    "display": "StarCi Conversation Record",
    "short": "Record redacted conversation provenance safely",
    "entry": "record",
    "states": {
      "record": {
        "kind": "operator",
        "ref": "source/conversation-record",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "complete",
            "label": "recorded"
          }
        ]
      },
      "query": {
        "kind": "operator",
        "ref": "source/conversation-query",
        "on": [
          {
            "when": {
              "decision": "found"
            },
            "target": "complete",
            "label": "found"
          },
          {
            "when": {
              "decision": "empty"
            },
            "target": "complete",
            "label": "empty"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      }
    },
    "options": {},
    "description": "Use only to append one provider-neutral redacted conversation-provenance snapshot head. Do not use to query provenance, store raw transcripts, or analyze product work.",
    "checks": [
      "Resolve one conversation identity and redacted refs.",
      "Reject raw transcripts or secrets.",
      "Confirm append-only provenance is the outcome."
    ]
  },
  {
    "id": "conversation-query",
    "display": "StarCi Conversation Query",
    "short": "Query bounded conversation provenance safely",
    "entry": "query",
    "states": {
      "record": {
        "kind": "operator",
        "ref": "source/conversation-record",
        "on": [
          {
            "when": {
              "decision": "recorded"
            },
            "target": "complete",
            "label": "recorded"
          }
        ]
      },
      "query": {
        "kind": "operator",
        "ref": "source/conversation-query",
        "on": [
          {
            "when": {
              "decision": "found"
            },
            "target": "complete",
            "label": "found"
          },
          {
            "when": {
              "decision": "empty"
            },
            "target": "complete",
            "label": "empty"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      }
    },
    "options": {},
    "description": "Use only to query one bounded provider-neutral conversation-provenance identity. Do not use to record a snapshot, retrieve raw transcripts, or analyze product work.",
    "checks": [
      "Resolve one bounded conversation identity.",
      "Reject raw transcript or secret retrieval.",
      "Keep the flow read-only."
    ]
  },
  {
    "id": "tech-stack",
    "display": "StarCi Tech Stack",
    "short": "Define operational stack topology and ownership",
    "entry": "freshness",
    "states": {
      "freshness": {
        "kind": "operator",
        "ref": "context/freshness-check",
        "on": [
          {
            "when": {
              "decision": "fresh"
            },
            "target": "complete",
            "label": "fresh"
          },
          {
            "when": {
              "decision": "initialize-required"
            },
            "target": "discover",
            "label": "initialize-required"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "discover": {
        "kind": "operator",
        "ref": "tech-stack/discover",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "model",
            "label": "ready"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "model": {
        "kind": "operator",
        "ref": "tech-stack/topology-model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "compatibility",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "model",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "compatibility": {
        "kind": "operator",
        "ref": "tech-stack/compatibility-check",
        "on": [
          {
            "when": {
              "decision": "compatible"
            },
            "target": "approval",
            "label": "compatible"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "model",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve the exact operational tech-stack model and hash.",
          "approve": "OK TECH STACK <hash>",
          "reject": "REJECT TECH STACK <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "tech-stack.review",
              "status": "approved"
            },
            "target": "publish"
          },
          {
            "when": {
              "stage": "tech-stack.review",
              "status": "rejected"
            },
            "target": "model"
          }
        ]
      },
      "publish": {
        "kind": "operator",
        "ref": "tech-stack/constraint-publish",
        "on": [
          {
            "when": {
              "decision": "published"
            },
            "target": "complete",
            "label": "published"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {
      "targetMode": {
        "enum": [
          "observe-only",
          "recommend-target"
        ],
        "description": "Inventory only or recommend a separately approved target stack."
      }
    },
    "description": "Discover, challenge, approve, and publish one project operational tech-stack contract. Use when a stack is missing, stale, disputed, or must define microservice runtime, communication, persistence, deployment, and ownership; do not use to implement product code or make feature architecture decisions.",
    "checks": [
      "Resolve one project, source generation and target boundary.",
      "Separate observed facts from a proposed target.",
      "Reject generic datastore identities, missing migration ownership, and unresolved critical contradictions."
    ],
    "contextMatrix": [
      [
        "freshness",
        "source, generator and schema hashes plus cached receipt metadata",
        "source bodies and cached artifact body"
      ],
      [
        "discovery",
        "declared manifests, lockfiles, runtime configuration and deployment descriptors",
        "feature source and unrelated documentation"
      ],
      [
        "model",
        "observed inventory plus approved business and architecture constraints",
        "treating source conventions as target truth"
      ],
      [
        "compatibility + publish",
        "exact candidate, version, deployment and approval evidence",
        "new broad discovery and unresolved critical contradictions"
      ]
    ],
    "handAuthored": true
  },
  {
    "id": "frontend-ui-direction",
    "display": "StarCi Frontend UI Direction",
    "short": "Visualize materially different UI directions",
    "handAuthored": true,
    "description": "Create and visualize three or four materially different UI directions before UX-flow or implementation work. Use for new UI or substantial visual redesign, not for an already approved direction.",
    "contextMatrix": [
      [
        "route + target verification",
        "project route, approved target refs, source/contract hashes and receipt headers",
        "business bodies, broad Qdrant and repository scans"
      ],
      [
        "audit or reconcile",
        "exact component/surface contracts, selected Grammar pair and closed consumer refs",
        "other Grammar packages, unrelated consumers and raw business context"
      ],
      [
        "approval + mutation",
        "frozen decision hash, exact files and approval receipt",
        "new discovery, undeclared files and scope expansion"
      ],
      [
        "proof + learning",
        "changed-file receipts, focused checks and one durable learning request",
        "session scratch and unrelated design history"
      ]
    ]
  },
  {
    "id": "frontend-design-critique",
    "display": "StarCi Frontend Design Critique",
    "short": "Challenge one frontend design independently",
    "handAuthored": true,
    "description": "Challenge one UI direction, UX flow, UI-detail artifact, or frontend contract with fresh context. Use before approval or when source convention may be wrong; do not implement source.",
    "contextMatrix": [
      [
        "route + target verification",
        "project route, approved target refs, source/contract hashes and receipt headers",
        "business bodies, broad Qdrant and repository scans"
      ],
      [
        "audit or reconcile",
        "exact component/surface contracts, selected Grammar pair and closed consumer refs",
        "other Grammar packages, unrelated consumers and raw business context"
      ],
      [
        "approval + mutation",
        "frozen decision hash, exact files and approval receipt",
        "new discovery, undeclared files and scope expansion"
      ],
      [
        "proof + learning",
        "changed-file receipts, focused checks and one durable learning request",
        "session scratch and unrelated design history"
      ]
    ]
  },
  {
    "id": "frontend-ux-flow",
    "display": "StarCi Frontend UX Flow",
    "short": "Model a flow and choose every interaction container",
    "handAuthored": true,
    "description": "Model one approved UI direction as a complete user flow, then choose page, modal, drawer, popover, or inline placement for every meaningful interaction. Do not choose visual styling or edit source.",
    "contextMatrix": [
      [
        "route + target verification",
        "project route, approved target refs, source/contract hashes and receipt headers",
        "business bodies, broad Qdrant and repository scans"
      ],
      [
        "audit or reconcile",
        "exact component/surface contracts, selected Grammar pair and closed consumer refs",
        "other Grammar packages, unrelated consumers and raw business context"
      ],
      [
        "approval + mutation",
        "frozen decision hash, exact files and approval receipt",
        "new discovery, undeclared files and scope expansion"
      ],
      [
        "proof + learning",
        "changed-file receipts, focused checks and one durable learning request",
        "session scratch and unrelated design history"
      ]
    ]
  },
  {
    "id": "product-potential",
    "display": "StarCi Product Potential",
    "short": "Assess product opportunities without mutation",
    "handAuthored": true,
    "description": "Assess one typed product potential discovered by another capability, separate evidence from hypothesis, and route any approved business, backend, or database branch before resuming the parent objective.",
    "contextMatrix": [
      [
        "route + freshness",
        "project route, source commit, business baseline and generator/schema hashes",
        "business body, Qdrant bodies and product source"
      ],
      [
        "evidence normalization",
        "exact declared evidence only",
        "frontend/backend implementation and unrelated feature evidence"
      ],
      [
        "model + review",
        "normalized evidence, lifecycle law and current feature head",
        "repository source and unrelated business heads"
      ],
      [
        "publish or reconcile",
        "approved revision or frozen pre-delivery receipt plus delivery proof",
        "mutable session plans and broad source scans"
      ]
    ]
  },
  {
    "id": "frontend-ui-detail",
    "display": "StarCi Frontend UI Detail",
    "short": "Freeze executable frontend design detail",
    "handAuthored": true,
    "description": "Freeze an approved UI direction, UX flow, and interaction-container plan into an executable screen specification covering breadcrumbs, surfaces, overlays, decoration, state, responsive behavior, and deterministic baselines. Do not implement source.",
    "contextMatrix": [
      [
        "route + target verification",
        "project route, approved target refs, source/contract hashes and receipt headers",
        "business bodies, broad Qdrant and repository scans"
      ],
      [
        "audit or reconcile",
        "exact component/surface contracts, selected Grammar pair and closed consumer refs",
        "other Grammar packages, unrelated consumers and raw business context"
      ],
      [
        "approval + mutation",
        "frozen decision hash, exact files and approval receipt",
        "new discovery, undeclared files and scope expansion"
      ],
      [
        "proof + learning",
        "changed-file receipts, focused checks and one durable learning request",
        "session scratch and unrelated design history"
      ]
    ]
  },
  {
    "id": "frontend-contract-plan",
    "display": "StarCi Frontend Contract Plan",
    "short": "Compile approved UI detail into contracts",
    "handAuthored": true,
    "description": "Compile one approved UI-detail artifact into exact Grammar, component, consumer, and source-boundary contracts. Route Grammar or backend gaps explicitly; do not approximate or implement.",
    "contextMatrix": [
      [
        "route + target verification",
        "project route, approved target refs, source/contract hashes and receipt headers",
        "business bodies, broad Qdrant and repository scans"
      ],
      [
        "audit or reconcile",
        "exact component/surface contracts, selected Grammar pair and closed consumer refs",
        "other Grammar packages, unrelated consumers and raw business context"
      ],
      [
        "approval + mutation",
        "frozen decision hash, exact files and approval receipt",
        "new discovery, undeclared files and scope expansion"
      ],
      [
        "proof + learning",
        "changed-file receipts, focused checks and one durable learning request",
        "session scratch and unrelated design history"
      ]
    ]
  },
  {
    "id": "frontend-implementation",
    "display": "StarCi Frontend Implementation",
    "short": "Implement one frozen frontend contract",
    "entry": "preflight",
    "states": {
      "preflight": {
        "kind": "operator",
        "ref": "quality/coding-preflight",
        "on": [
          {
            "when": { "decision": "ready" },
            "target": "implement",
            "label": "ready"
          },
          {
            "when": { "decision": "reference-gap" },
            "target": "handoff",
            "label": "reference-gap"
          },
          {
            "when": { "decision": "blocked" },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "implement": {
        "kind": "operator",
        "ref": "fe/design-implementation",
        "on": [
          {
            "when": {
              "decision": "implemented"
            },
            "target": "complete",
            "label": "implemented"
          },
          {
            "when": {
              "decision": "contract-gap"
            },
            "target": "handoff",
            "label": "contract-gap"
          },
          {
            "when": {
              "decision": "grammar-gap"
            },
            "target": "handoff",
            "label": "grammar-gap"
          },
          {
            "when": {
              "decision": "backend-gap"
            },
            "target": "handoff",
            "label": "backend-gap"
          },
          {
            "when": {
              "decision": "design-feasibility-conflict"
            },
            "target": "handoff",
            "label": "design-feasibility-conflict"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Implement one approved and frozen frontend contract inside its exact source boundary. Do not redesign surfaces, navigation, decoration, state, or responsive behavior.",
    "checks": [
      "Require approved UI-detail and contract refs.",
      "Require a frozen exact source boundary.",
      "Route every design, Grammar, backend, or scope gap instead of approximating."
    ],
    "contextMatrix": [
      [
        "route + target verification",
        "project route, approved target refs, source/contract hashes and receipt headers",
        "business bodies, broad Qdrant and repository scans"
      ],
      [
        "audit or reconcile",
        "exact component/surface contracts, selected Grammar pair and closed consumer refs",
        "other Grammar packages, unrelated consumers and raw business context"
      ],
      [
        "approval + mutation",
        "frozen decision hash, exact files and approval receipt",
        "new discovery, undeclared files and scope expansion"
      ],
      [
        "proof + learning",
        "changed-file receipts, focused checks and one durable learning request",
        "session scratch and unrelated design history"
      ]
    ]
  },
  {
    "id": "frontend-visual-fidelity",
    "display": "StarCi Frontend Visual Fidelity",
    "short": "Compare implementation with approved design",
    "entry": "verify",
    "states": {
      "verify": {
        "kind": "operator",
        "ref": "fe/visual-fidelity",
        "on": [
          {
            "when": {
              "decision": "passed"
            },
            "target": "complete",
            "label": "passed"
          },
          {
            "when": {
              "decision": "repair"
            },
            "target": "repair-handoff",
            "label": "repair"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Verify structural, visual, responsive, and interaction fidelity against approved deterministic frontend baselines. Use after implementation and before product UAT; do not repair source.",
    "checks": [
      "Require approved structure and visual baselines.",
      "Compare the same viewport, state, seed, locale and theme.",
      "Emit a typed repair handoff for every unauthorized deviation."
    ],
    "contextMatrix": [
      [
        "route + target verification",
        "project route, approved target refs, source/contract hashes and receipt headers",
        "business bodies, broad Qdrant and repository scans"
      ],
      [
        "audit or reconcile",
        "exact component/surface contracts, selected Grammar pair and closed consumer refs",
        "other Grammar packages, unrelated consumers and raw business context"
      ],
      [
        "approval + mutation",
        "frozen decision hash, exact files and approval receipt",
        "new discovery, undeclared files and scope expansion"
      ],
      [
        "proof + learning",
        "changed-file receipts, focused checks and one durable learning request",
        "session scratch and unrelated design history"
      ]
    ]
  },
  {
    "id": "product-uat",
    "display": "StarCi Product UAT",
    "short": "Prove an approved user journey end to end",
    "entry": "verify",
    "states": {
      "verify": {
        "kind": "operator",
        "ref": "fe/product-uat",
        "on": [
          {
            "when": {
              "decision": "passed",
              "allFacts": [
                "ux-ui-resolution-close-required"
              ]
            },
            "target": "resolve-ux-ui",
            "label": "close proved UX/UI requests"
          },
          {
            "when": {
              "decision": "passed",
              "noneFacts": [
                "ux-ui-resolution-close-required"
              ]
            },
            "target": "complete",
            "label": "passed"
          },
          {
            "when": {
              "decision": "ux-ui-repair"
            },
            "target": "resolve-ux-ui",
            "label": "resolve UX/UI failure"
          },
          {
            "when": {
              "decision": "repair"
            },
            "target": "repair-handoff",
            "label": "repair"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "resolve-ux-ui": {
        "kind": "operator",
        "ref": "fe/ux-ui-resolve",
        "on": [
          {
            "when": {
              "decision": "repair-ready"
            },
            "target": "repair-handoff",
            "label": "typed repair handoff"
          },
          {
            "when": {
              "decision": "resolved"
            },
            "target": "complete",
            "label": "requests closed after proof"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Prove that a running product completes one approved business journey, turn UX/UI failures into a typed repair contract, and close exact feedback requests only after rerun proof passes.",
    "checks": [
      "Require a passed fidelity receipt.",
      "Exercise every required journey transition and recovery path.",
      "Classify UX/UI failures separately from functional, backend-contract and business failures.",
      "Close a UX/UI request only when the repaired state, Grammar object and journey outcome all pass independent UAT."
    ],
    "contextMatrix": [
      [
        "diagnosis or inventory",
        "declared command fingerprints, cached green receipts and exact failing evidence",
        "unrelated source, broad Qdrant and speculative fixes"
      ],
      [
        "approval",
        "one finding/debt identity, baseline, boundary and approval hash",
        "source bodies and other findings"
      ],
      [
        "repair",
        "only approved exact files and narrow repair law",
        "scope expansion, unrelated findings and whole-repository scans"
      ],
      [
        "verification + loop",
        "independent proof, prior fingerprint, loop counter and residual identity",
        "stale observations and reloaded unrelated context"
      ]
    ]
  },
  {
    "id": "architecture-discover",
    "display": "StarCi Architecture Discover",
    "short": "Map observed architecture without choosing it",
    "entry": "evidence",
    "states": {
      "evidence": {
        "kind": "operator",
        "ref": "architecture/evidence-discovery",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "model",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "evidence",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "model": {
        "kind": "operator",
        "ref": "architecture/system-model",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "handoff",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "evidence",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Discover and classify the observed architecture and deployment model without treating source as target authority. Use before architecture option or data-ownership work.",
    "checks": [
      "Bind fresh business, tech-stack, source and deployment revisions.",
      "Separate observed, authorized, target and unknown claims.",
      "Keep contradictions explicit."
    ],
    "contextMatrix": [
      [
        "route + business freshness",
        "route, commits, hashes and receipt headers",
        "raw source and unrelated business bodies"
      ],
      [
        "frame + current state",
        "exact business projection, canonical coding-context candidates and architecture law",
        "raw source files and whole indexes"
      ],
      [
        "alternatives + challenge",
        "frozen constraints and two-to-four candidate summaries",
        "reloading business, source or unrelated knowledge"
      ],
      [
        "selection + handoff",
        "option-set hash, selected decision and approval receipt",
        "unselected bodies and new discovery"
      ]
    ]
  },
  {
    "id": "data-ownership-model",
    "display": "StarCi Data Ownership Model",
    "short": "Qualify datastore and mutation ownership",
    "entry": "ownership",
    "states": {
      "ownership": {
        "kind": "operator",
        "ref": "architecture/data-ownership",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "contradictions",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "ownership",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "contradictions": {
        "kind": "operator",
        "ref": "architecture/contradiction-analysis",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "handoff",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "ownership",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Model exact physical stores, logical resources, readers, writers, migrators, transaction boundaries, isolation, backup, and restore ownership. Use before approving state-changing architecture or backend contracts.",
    "checks": [
      "Require an observed system model.",
      "Reject generic datastore or resource identities.",
      "Route unresolved source, business, and deployment contradictions."
    ],
    "contextMatrix": [
      [
        "route + business freshness",
        "route, commits, hashes and receipt headers",
        "raw source and unrelated business bodies"
      ],
      [
        "frame + current state",
        "exact business projection, canonical coding-context candidates and architecture law",
        "raw source files and whole indexes"
      ],
      [
        "alternatives + challenge",
        "frozen constraints and two-to-four candidate summaries",
        "reloading business, source or unrelated knowledge"
      ],
      [
        "selection + handoff",
        "option-set hash, selected decision and approval receipt",
        "unselected bodies and new discovery"
      ]
    ]
  },
  {
    "id": "architecture-option-design",
    "display": "StarCi Architecture Option Design",
    "short": "Design and approve architecture alternatives",
    "entry": "options",
    "states": {
      "options": {
        "kind": "operator",
        "ref": "architecture/alternatives",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "approval",
            "label": "ready"
          }
        ]
      },
      "approval": {
        "kind": "wait",
        "approval": {
          "prompt": "Approve one architecture option and its exact option-set hash.",
          "approve": "OK ARCHITECTURE OPTION <hash>",
          "reject": "REJECT ARCHITECTURE OPTION <hash>"
        },
        "on": [
          {
            "when": {
              "stage": "architecture.option.review",
              "status": "approved"
            },
            "target": "handoff"
          },
          {
            "when": {
              "stage": "architecture.option.review",
              "status": "rejected"
            },
            "target": "options"
          }
        ]
      },
      "handoff": {
        "kind": "terminal",
        "result": "handoff"
      }
    },
    "options": {},
    "description": "Produce and approve materially different target architecture options from frozen constraints, observed state, and ownership evidence. Do not implement or silently copy source precedent.",
    "checks": [
      "Require observed architecture and ownership refs.",
      "Produce materially different options with migration and failure tradeoffs.",
      "Wait for approval of one exact option hash."
    ],
    "contextMatrix": [
      [
        "route + business freshness",
        "route, commits, hashes and receipt headers",
        "raw source and unrelated business bodies"
      ],
      [
        "frame + current state",
        "exact business projection, canonical coding-context candidates and architecture law",
        "raw source files and whole indexes"
      ],
      [
        "alternatives + challenge",
        "frozen constraints and two-to-four candidate summaries",
        "reloading business, source or unrelated knowledge"
      ],
      [
        "selection + handoff",
        "option-set hash, selected decision and approval receipt",
        "unselected bodies and new discovery"
      ]
    ]
  },
  {
    "id": "architecture-critique",
    "display": "StarCi Architecture Critique",
    "short": "Challenge architecture with fresh evidence",
    "entry": "critique",
    "states": {
      "critique": {
        "kind": "operator",
        "ref": "architecture/independent-critique",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "complete",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "revision-handoff",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "revision-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Independently challenge one architecture proposal across business value, data ownership, consistency, deployment, recovery, and adversarial source precedent. Do not mutate source or approve its own revision.",
    "checks": [
      "Receive candidate artifacts without author reasoning.",
      "Require store-qualified mutations and deployment realization.",
      "Return accepted, revision, evidence, or authority outcomes explicitly."
    ],
    "contextMatrix": [
      [
        "route + business freshness",
        "route, commits, hashes and receipt headers",
        "raw source and unrelated business bodies"
      ],
      [
        "frame + current state",
        "exact business projection, canonical coding-context candidates and architecture law",
        "raw source files and whole indexes"
      ],
      [
        "alternatives + challenge",
        "frozen constraints and two-to-four candidate summaries",
        "reloading business, source or unrelated knowledge"
      ],
      [
        "selection + handoff",
        "option-set hash, selected decision and approval receipt",
        "unselected bodies and new discovery"
      ]
    ]
  },
  {
    "id": "architecture-realization",
    "display": "StarCi Architecture Realization",
    "short": "Bind architecture to deployable implementation",
    "entry": "realize",
    "states": {
      "realize": {
        "kind": "operator",
        "ref": "architecture/design-realization",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "conformance",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "realize",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "conformance": {
        "kind": "operator",
        "ref": "architecture/conformance",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "handoff",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "realize",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Map an approved architecture to composition roots, modules, connections, qualified resources, deployment units, migrations, credentials, and proof paths. Use before backend source mutation.",
    "checks": [
      "Require approved option, ownership, and critique refs.",
      "Reject diagram-only components and writes.",
      "Emit an exact realization handoff."
    ],
    "contextMatrix": [
      [
        "route + business freshness",
        "route, commits, hashes and receipt headers",
        "raw source and unrelated business bodies"
      ],
      [
        "frame + current state",
        "exact business projection, canonical coding-context candidates and architecture law",
        "raw source files and whole indexes"
      ],
      [
        "alternatives + challenge",
        "frozen constraints and two-to-four candidate summaries",
        "reloading business, source or unrelated knowledge"
      ],
      [
        "selection + handoff",
        "option-set hash, selected decision and approval receipt",
        "unselected bodies and new discovery"
      ]
    ]
  },
  {
    "id": "backend-solution-design",
    "display": "StarCi Backend Solution Design",
    "short": "Design one bounded backend solution",
    "entry": "design",
    "states": {
      "design": {
        "kind": "operator",
        "ref": "be/solution-design",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "handoff",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "design",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Design one bounded backend solution from approved business, tech-stack, architecture, ownership, and realization artifacts. Do not edit source or reopen unrelated architecture.",
    "checks": [
      "Require approved upstream artifacts.",
      "Define responsibilities, invariants, compatibility and failures.",
      "Emit one solution handoff."
    ],
    "contextMatrix": [
      [
        "route + freshness",
        "route, source commit, authority and coding-context hash metadata",
        "business bodies, raw source and Qdrant bodies"
      ],
      [
        "architecture + boundary planning",
        "exact business projection, canonical coding-context records and narrow operator knowledge",
        "raw source files, whole indexes and unrelated modules"
      ],
      [
        "approval + coding-scope freeze",
        "plan hash, source HEAD and exact target path/hash headers",
        "file bodies and repository scans"
      ],
      [
        "implementation",
        "approved boundary, exact frozen files and be.implementation knowledge",
        "undeclared files, broad Qdrant and adjacent business"
      ],
      [
        "quality + proof + reconcile",
        "changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof",
        "new design context and unfrozen source discovery"
      ]
    ]
  },
  {
    "id": "backend-contract-plan",
    "display": "StarCi Backend Contract Plan",
    "short": "Freeze backend mutation contracts",
    "entry": "contract",
    "states": {
      "contract": {
        "kind": "operator",
        "ref": "be/mutation-contract",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "handoff",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "contract",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Freeze one backend state-change contract with exact writer, physical store, database, schema or collection, resource, transaction behavior, migration owner, and proof. Do not implement source.",
    "checks": [
      "Require an approved backend solution and data-ownership matrix.",
      "Reject unqualified writes and cross-store atomicity fiction.",
      "Emit one reviewable contract handoff."
    ],
    "contextMatrix": [
      [
        "route + freshness",
        "route, source commit, authority and coding-context hash metadata",
        "business bodies, raw source and Qdrant bodies"
      ],
      [
        "architecture + boundary planning",
        "exact business projection, canonical coding-context records and narrow operator knowledge",
        "raw source files, whole indexes and unrelated modules"
      ],
      [
        "approval + coding-scope freeze",
        "plan hash, source HEAD and exact target path/hash headers",
        "file bodies and repository scans"
      ],
      [
        "implementation",
        "approved boundary, exact frozen files and be.implementation knowledge",
        "undeclared files, broad Qdrant and adjacent business"
      ],
      [
        "quality + proof + reconcile",
        "changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof",
        "new design context and unfrozen source discovery"
      ]
    ]
  },
  {
    "id": "backend-contract-critique",
    "display": "StarCi Backend Contract Critique",
    "short": "Challenge one backend contract independently",
    "entry": "critique",
    "states": {
      "critique": {
        "kind": "operator",
        "ref": "be/contract-critique",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "complete",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "revision-handoff",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "revision-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Independently challenge one backend contract for wrong-store writes, authority drift, transaction gaps, failure handling, compatibility, and source overfitting. Do not mutate source.",
    "checks": [
      "Receive the contract without author reasoning.",
      "Include a wrong-store counterexample.",
      "Route revisions to the owning planning capability."
    ],
    "contextMatrix": [
      [
        "route + freshness",
        "route, source commit, authority and coding-context hash metadata",
        "business bodies, raw source and Qdrant bodies"
      ],
      [
        "architecture + boundary planning",
        "exact business projection, canonical coding-context records and narrow operator knowledge",
        "raw source files, whole indexes and unrelated modules"
      ],
      [
        "approval + coding-scope freeze",
        "plan hash, source HEAD and exact target path/hash headers",
        "file bodies and repository scans"
      ],
      [
        "implementation",
        "approved boundary, exact frozen files and be.implementation knowledge",
        "undeclared files, broad Qdrant and adjacent business"
      ],
      [
        "quality + proof + reconcile",
        "changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof",
        "new design context and unfrozen source discovery"
      ]
    ]
  },
  {
    "id": "coding-preflight",
    "display": "StarCi Coding Preflight",
    "short": "Bind templates and static contracts before coding",
    "entry": "preflight",
    "states": {
      "preflight": {
        "kind": "operator",
        "ref": "quality/coding-preflight",
        "on": [
          {
            "when": { "decision": "ready" },
            "target": "complete",
            "label": "ready"
          },
          {
            "when": { "decision": "reference-gap" },
            "target": "handoff",
            "label": "reference-gap"
          },
          {
            "when": { "decision": "blocked" },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": { "kind": "terminal", "result": "complete" },
      "handoff": { "kind": "terminal", "result": "handoff" },
      "blocked": { "kind": "terminal", "result": "blocked" }
    },
    "options": {},
    "description": "Bind the nearest implementation template, applicable ESLint rules, TypeScript contracts, and a bounded lint/typecheck/Sonar plan that activates before commit or by explicit standalone request. Do not run static gates or mutate source.",
    "checks": [
      "Require one frozen exact source boundary.",
      "Read the nearest maintained implementation reference before coding.",
      "Read applicable ESLint and TypeScript contracts, then defer static gates until a commit request or explicit standalone gate request."
    ],
    "contextMatrix": [
      [
        "coding preflight",
        "exact target hashes, nearest declared templates, governing ESLint rules and TypeScript contracts",
        "whole-repository scans, unrelated references and product-source mutation"
      ],
      [
        "commit-triggered quality plan",
        "exact lint, typecheck and Sonar commands, commit or explicit activation, dependency order, parallel eligibility and time budgets",
        "running gates during ordinary coding, unbounded waits, hidden check suppression and quality-gate weakening"
      ]
    ]
  },
  {
    "id": "static-quality-gates",
    "display": "StarCi Static Quality Gates",
    "short": "Run lint, typecheck and Sonar before commit",
    "entry": "lint",
    "states": {
      "lint": {
        "kind": "operator",
        "ref": "quality/lint",
        "on": [
          { "when": { "decision": "pass" }, "target": "typecheck", "label": "pass" },
          { "when": { "decision": "in-boundary" }, "target": "handoff", "label": "in-boundary" },
          { "when": { "decision": "boundary-drift" }, "target": "handoff", "label": "boundary-drift" },
          { "when": { "decision": "external-blocker" }, "target": "blocked", "label": "external-blocker" }
        ]
      },
      "typecheck": {
        "kind": "operator",
        "ref": "quality/typecheck",
        "on": [
          { "when": { "decision": "pass" }, "target": "sonar", "label": "pass" },
          { "when": { "decision": "in-boundary" }, "target": "handoff", "label": "in-boundary" },
          { "when": { "decision": "boundary-drift" }, "target": "handoff", "label": "boundary-drift" },
          { "when": { "decision": "external-blocker" }, "target": "blocked", "label": "external-blocker" }
        ]
      },
      "sonar": {
        "kind": "operator",
        "ref": "quality/sonar",
        "on": [
          { "when": { "decision": "pass" }, "target": "complete", "label": "pass" },
          { "when": { "decision": "in-boundary" }, "target": "handoff", "label": "in-boundary" },
          { "when": { "decision": "boundary-drift" }, "target": "handoff", "label": "boundary-drift" },
          { "when": { "decision": "external-blocker" }, "target": "blocked", "label": "external-blocker" }
        ]
      },
      "complete": { "kind": "terminal", "result": "complete" },
      "handoff": { "kind": "terminal", "result": "handoff" },
      "blocked": { "kind": "terminal", "result": "blocked" }
    },
    "options": {
      "trigger": {
        "enum": ["commit", "explicit"],
        "description": "Record whether the gates were activated by a commit request or a standalone gate request."
      }
    },
    "inputBoundary": "The trigger is evidence for activation only; both values execute the same fixed lint, typecheck and Sonar flow.",
    "description": "Run lint, TypeScript typecheck and Sonar for one exact source revision automatically before commit or when explicitly requested as a standalone gate. Do not mutate or commit source.",
    "checks": [
      "Require one verified checkout, exact source revision and pinned commands before execution.",
      "Activate automatically for a commit request, or directly for an explicit lint/typecheck/Sonar gate request.",
      "Allow independent read-only preparation in parallel, but serialize Sonar after its required coverage artifact.",
      "Block the commit on any non-green gate and hand repair findings back without mutating source."
    ],
    "contextMatrix": [
      [
        "gate binding",
        "verified route, exact source revision, pinned commands, toolchain and timeout identities",
        "business bodies, broad repository scans and unrelated source"
      ],
      [
        "gate execution",
        "structured lint, typecheck, coverage and Sonar evidence for the exact revision",
        "source mutation, hidden suppression, commit creation and unbounded retries"
      ]
    ]
  },
  {
    "id": "backend-implementation",
    "display": "StarCi Backend Implementation",
    "short": "Implement one approved backend contract",
    "entry": "scope",
    "states": {
      "scope": {
        "kind": "operator",
        "ref": "be/coding-scope-freeze",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "preflight",
            "label": "ready"
          },
          {
            "when": {
              "decision": "source-drift"
            },
            "target": "replan-handoff",
            "label": "source-drift"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "replan-handoff",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "preflight": {
        "kind": "operator",
        "ref": "quality/coding-preflight",
        "on": [
          {
            "when": { "decision": "ready" },
            "target": "implement",
            "label": "ready"
          },
          {
            "when": { "decision": "reference-gap" },
            "target": "replan-handoff",
            "label": "reference-gap"
          },
          {
            "when": { "decision": "blocked" },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "implement": {
        "kind": "operator",
        "ref": "be/implementation",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "conformance",
            "label": "ready"
          },
          {
            "when": {
              "decision": "source-drift"
            },
            "target": "replan-handoff",
            "label": "source-drift"
          },
          {
            "when": {
              "decision": "boundary-drift"
            },
            "target": "replan-handoff",
            "label": "boundary-drift"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "conformance": {
        "kind": "operator",
        "ref": "be/implementation-conformance",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "complete",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "scope",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "replan-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Implement one approved backend contract in a frozen exact source boundary, then run semantic architecture and data-placement conformance before generic quality checks.",
    "checks": [
      "Require approved contract and critique receipts.",
      "Freeze exact source files before mutation.",
      "Route source, boundary, architecture, or datastore drift back to planning."
    ],
    "contextMatrix": [
      [
        "route + freshness",
        "route, source commit, authority and coding-context hash metadata",
        "business bodies, raw source and Qdrant bodies"
      ],
      [
        "architecture + boundary planning",
        "exact business projection, canonical coding-context records and narrow operator knowledge",
        "raw source files, whole indexes and unrelated modules"
      ],
      [
        "approval + coding-scope freeze",
        "plan hash, source HEAD and exact target path/hash headers",
        "file bodies and repository scans"
      ],
      [
        "implementation",
        "approved boundary, exact frozen files and be.implementation knowledge",
        "undeclared files, broad Qdrant and adjacent business"
      ],
      [
        "quality + proof + reconcile",
        "changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof",
        "new design context and unfrozen source discovery"
      ]
    ]
  },
  {
    "id": "backend-proof",
    "display": "StarCi Backend Proof",
    "short": "Prove backend delivery against contracts",
    "entry": "prove",
    "states": {
      "prove": {
        "kind": "operator",
        "ref": "be/delivery-proof",
        "on": [
          {
            "when": {
              "decision": "ready"
            },
            "target": "complete",
            "label": "ready"
          },
          {
            "when": {
              "decision": "revise"
            },
            "target": "repair-handoff",
            "label": "revise"
          },
          {
            "when": {
              "decision": "blocked"
            },
            "target": "blocked",
            "label": "blocked"
          }
        ]
      },
      "complete": {
        "kind": "terminal",
        "result": "complete"
      },
      "repair-handoff": {
        "kind": "terminal",
        "result": "handoff"
      },
      "blocked": {
        "kind": "terminal",
        "result": "blocked"
      }
    },
    "options": {},
    "description": "Close one backend delivery with contract, implementation, migration, runtime, and semantic conformance evidence. Use after implementation conformance; do not repair source.",
    "checks": [
      "Require semantic conformance before lint or test evidence is credited.",
      "Bind proof to exact contract and source revisions.",
      "Route residual findings to repair."
    ],
    "contextMatrix": [
      [
        "route + freshness",
        "route, source commit, authority and coding-context hash metadata",
        "business bodies, raw source and Qdrant bodies"
      ],
      [
        "architecture + boundary planning",
        "exact business projection, canonical coding-context records and narrow operator knowledge",
        "raw source files, whole indexes and unrelated modules"
      ],
      [
        "approval + coding-scope freeze",
        "plan hash, source HEAD and exact target path/hash headers",
        "file bodies and repository scans"
      ],
      [
        "implementation",
        "approved boundary, exact frozen files and be.implementation knowledge",
        "undeclared files, broad Qdrant and adjacent business"
      ],
      [
        "quality + proof + reconcile",
        "changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof",
        "new design context and unfrozen source discovery"
      ]
    ]
  }
];

for (const flow of flows) {
  flow.id = `starci-${flow.id}`;
  for (const state of Object.values(flow.states ?? {})) {
    if (state.kind === 'wait') state.approval.bypassTarget = state.on[0].target;
  }
  const businessEvidenceState = Object.entries(flow.states ?? {}).find(([, state]) => state.ref === 'business/evidence')?.[0] ?? 'blocked';
  for (const state of Object.values(flow.states ?? {})) {
    if (state.ref !== 'business/model') continue;
    const decisions = new Set((state.on ?? []).map((edge) => edge.when?.decision));
    if (!decisions.has('revise')) state.on.push(e({ decision: 'revise' }, businessEvidenceState, 'revise'));
    if (!decisions.has('blocked')) state.on.push(e({ decision: 'blocked' }, 'blocked', 'blocked'));
  }
  if (flow.contextMatrix) continue;
  if (['starci-workspace-ready', 'starci-device-checkpoint', 'starci-workflow-handoff'].includes(flow.id)) flow.contextMatrix = domainContextMatrices.workspace;
  else if (['starci-business-authority', 'starci-business-reconcile'].includes(flow.id)) flow.contextMatrix = domainContextMatrices.business;
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
  systemVersion: '6.2.1',
  skills: flows.map(({ id, description }) => ({
    id,
    capability: id.replace(/^starci-/, '').replaceAll('-', '.'),
    description
  }))
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
    mode: { enum: ['gated', 'bypass'] },
    activeInputRefs: { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?![^:]+:(?:\\/\\/)?(?:entire-repository|whole-repository|all-history|all-source|\\*)$)[a-z][a-z0-9+.-]*:[^\\s]+$' } },
    passiveContextRefs: { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?![^:]+:(?:\\/\\/)?(?:entire-repository|whole-repository|all-history|all-source|\\*)$)[a-z][a-z0-9+.-]*:[^\\s]+$' } }
  }
});

for (const flow of flows) {
  const directory = path.join(root, flow.id);
  if (flow.handAuthored) {
    const machine = JSON.parse(readFileSync(path.join(directory, 'machine.json'), 'utf8'));
    const inputSchema = JSON.parse(readFileSync(path.join(directory, 'input.schema.json'), 'utf8'));
    const outputSchema = JSON.parse(readFileSync(path.join(directory, 'output.schema.json'), 'utf8'));
    const boundedReference = { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?![^:]+:(?:\\/\\/)?(?:entire-repository|whole-repository|all-history|all-source|\\*)$)[a-z][a-z0-9+.-]*:[^\\s]+$' };
    for (const key of ['activeInputRefs', 'passiveContextRefs']) {
      const rule = inputSchema.properties.selection.properties[key];
      Object.assign(rule, { maxItems: 8, uniqueItems: true, items: { ...boundedReference } });
    }
    inputSchema.properties.selection.properties.mode = { enum: ['gated', 'bypass'] };
    for (const state of Object.values(machine.states)) {
      if (state.kind === 'wait') state.approval.bypassTarget = state.on[0].target;
    }
    writeJson(path.join(directory, 'machine.json'), machine);
    const writeRoots = inputSchema.properties.scope.properties?.writeRoots;
    if (writeRoots) {
      writeRoots.maxItems ??= 32;
      writeRoots.uniqueItems = true;
      writeRoots.items = { type: 'string', minLength: 1, maxLength: 512, pattern: '^(?![\\/]|[A-Za-z]:[\\/])(?!.*(?:^|[\\/])\\.\\.(?:[\\/]|$)).+$' };
    }
    writeJson(path.join(directory, 'input.schema.json'), inputSchema);
    const terminalEntries = Object.entries(machine.states).filter(([, state]) => state.kind === 'terminal');
    const terminalStatus = (result) => result === 'complete' ? 'completed' : result;
    outputSchema.required = [...new Set([...outputSchema.required, 'state', 'cleanup'])];
    outputSchema.allOf = [{ oneOf: terminalEntries.map(([stateId, state]) => ({
      properties: {
        result: { const: state.result },
        finalState: { const: stateId },
        state: {
          properties: {
            status: { const: terminalStatus(state.result) },
            code: { const: `${flow.id}-${stateId}` },
            retryable: { const: false },
            terminalState: { const: stateId }
          },
          required: ['status', 'code', 'retryable', 'terminalState']
        }
      },
      required: ['result', 'finalState', 'state']
    })) }];
    outputSchema.properties.finalState = { enum: terminalEntries.map(([stateId]) => stateId) };
    outputSchema.properties.receiptRefs.maxItems = 64;
    outputSchema.properties.receiptRefs.items = { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?:receipt:sha256:[0-9a-f]{64}|session://tasks/[A-Za-z0-9._-]+/.+)$' };
    outputSchema.properties.state = {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'code', 'retryable', 'terminalState'],
      properties: {
        status: { enum: [...new Set(terminalEntries.map(([, state]) => terminalStatus(state.result)))] },
        code: { enum: terminalEntries.map(([stateId]) => `${flow.id}-${stateId}`) },
        retryable: { const: false },
        terminalState: { enum: terminalEntries.map(([stateId]) => stateId) }
      }
    };
    outputSchema.properties.cleanup = {
      type: 'object',
      additionalProperties: false,
      required: ['scratchRefs', 'retention', 'purgeAt'],
      properties: {
        scratchRefs: { type: 'array', maxItems: 64, uniqueItems: true, items: { type: 'string', minLength: 1 } },
        retention: { const: 'until-skill-terminal' },
        purgeAt: { const: 'skill-terminal' }
      }
    };
    writeJson(path.join(directory, 'output.schema.json'), outputSchema);
    continue;
  }
  const agentDirectory = path.join(directory, 'agents');
  mkdirSync(agentDirectory, { recursive: true });
  const states = reachableSubgraph(flow.states, flow.entry);
  const hasArchitectureApproval = Object.values(states).some((state) => state.kind === 'wait' && state.approval?.approve === 'OK ARCHITECTURE <decision>');
  const hasLayoutApproval = Object.values(states).some((state) => state.kind === 'wait' && state.approval?.approve === 'OK LAYOUT <id>');
  const waitReviewRule = [
    hasLayoutApproval ? 'Before a layout approval wait, read and apply `review-widget.md`; the validated HTML preview must be rendered through `visualize` before requesting `OK LAYOUT`.' : null,
    hasArchitectureApproval ? 'Before an architecture approval wait, read and apply `../../operators/architecture/review-widget.md`; `architecture/decision-challenge` must emit a validated HTML preview and the host must render it through `visualize` before requesting `OK ARCHITECTURE`.' : null
  ].filter(Boolean).join(' ');
  writeJson(path.join(directory, 'machine.json'), { $schema: '../machine.schema.json', schemaVersion: 6, id: flow.id, start: 'analyze-input', states });
  const optionProperties = Object.fromEntries(Object.entries(flow.options).map(([name, spec]) => [name, spec.enum ? { type: typeof spec.enum[0], enum: spec.enum } : { type: spec.type ?? 'string' }]));
  const reference = { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?![^:]+:(?:\\/\\/)?(?:entire-repository|whole-repository|all-history|all-source|\\*)$)[a-z][a-z0-9+.-]*:[^\\s]+$' };
  const receiptReference = { type: 'string', minLength: 3, maxLength: 512, pattern: '^(?:receipt:sha256:[0-9a-f]{64}|session://tasks/[A-Za-z0-9._-]+/.+)$' };
  const referenceArray = (maxItems, minItems = 0) => ({ type: 'array', minItems, maxItems, uniqueItems: true, items: { ...reference } });
  const selectionSchema = { type: 'object', additionalProperties: false, required: ['analyzerVersion', 'skillId', 'confidence', 'activeInputRefs', 'passiveContextRefs'], properties: { analyzerVersion: { const: 1 }, skillId: { const: flow.id }, confidence: { enum: ['exact', 'clarified'] }, mode: { enum: ['gated', 'bypass'] }, activeInputRefs: referenceArray(8, 1), passiveContextRefs: referenceArray(8) } };
  const inputSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `https://starci.dev/v6/skills/${flow.id}/input.schema.json`, type: 'object', additionalProperties: false, required: ['schemaVersion', 'runId', 'project', 'selection', 'requestRef', 'artifactRefs', 'evidenceRefs', 'scope', 'options'], allOf: [{ if: { properties: { scope: { properties: { externalMutation: { const: true } }, required: ['externalMutation'] } }, required: ['scope'] }, then: { properties: { scope: { properties: { approvalRef: { ...receiptReference } } } } } }], properties: { schemaVersion: { const: 6 }, runId: { type: 'string', minLength: 1, maxLength: 128 }, project: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 80 }, selection: selectionSchema, requestRef: { ...reference }, artifactRefs: referenceArray(64), evidenceRefs: referenceArray(64), scope: { type: 'object', additionalProperties: false, required: ['targetRefs', 'writeRoots', 'externalMutation', 'approvalRef'], properties: { targetRefs: referenceArray(64, 1), writeRoots: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 512, pattern: '^(?![\\/]|[A-Za-z]:[\\/])(?!.*(?:^|[\\/])\\.\\.(?:[\\/]|$)).+$' } }, externalMutation: { type: 'boolean' }, approvalRef: { anyOf: [{ ...receiptReference }, { type: 'null' }] } } }, options: { type: 'object', additionalProperties: false, required: Object.keys(optionProperties), properties: optionProperties } } };
  const terminalEntries = Object.entries(states).filter(([, state]) => state.kind === 'terminal');
  const terminalResults = [...new Set(terminalEntries.map(([, state]) => state.result))];
  const terminalStatus = (result) => result === 'complete' ? 'completed' : result;
  const terminalBranches = terminalEntries.map(([stateId, state]) => ({ properties: { result: { const: state.result }, finalState: { const: stateId }, state: { properties: { status: { const: terminalStatus(state.result) }, code: { const: `${flow.id}-${stateId}` }, retryable: { const: false }, terminalState: { const: stateId } }, required: ['status', 'code', 'retryable', 'terminalState'] } }, required: ['result', 'finalState', 'state'] }));
  const receiptArray = (maxItems, minItems = 0) => ({ type: 'array', minItems, maxItems, uniqueItems: true, items: { ...receiptReference } });
  const findingSchema = { type: 'object', additionalProperties: false, required: ['code', 'severity', 'message', 'evidenceRefs'], properties: { code: { type: 'string', pattern: '^[a-z0-9]+(?:[.-][a-z0-9]+)*$', maxLength: 120 }, severity: { enum: ['info', 'warning', 'error'] }, message: { type: 'string', minLength: 1, maxLength: 500 }, evidenceRefs: receiptArray(8) } };
  const outputSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `https://starci.dev/v6/skills/${flow.id}/output.schema.json`, type: 'object', additionalProperties: false, required: ['schemaVersion', 'runId', 'skillId', 'result', 'finalState', 'state', 'handoffRef', 'receiptRefs', 'findings', 'cleanup'], allOf: [{ oneOf: terminalBranches }], properties: { schemaVersion: { const: 6 }, runId: { type: 'string', minLength: 1, maxLength: 128 }, skillId: { const: flow.id }, result: { enum: terminalResults }, finalState: { enum: terminalEntries.map(([stateId]) => stateId) }, state: { type: 'object', additionalProperties: false, required: ['status', 'code', 'retryable', 'terminalState'], properties: { status: { enum: [...new Set(terminalResults.map(terminalStatus))] }, code: { enum: terminalEntries.map(([stateId]) => `${flow.id}-${stateId}`) }, retryable: { const: false }, terminalState: { enum: terminalEntries.map(([stateId]) => stateId) } } }, handoffRef: { type: ['string', 'null'], pattern: '^session://tasks/[A-Za-z0-9._-]+/.+$' }, receiptRefs: receiptArray(64), findings: { type: 'array', maxItems: 20, uniqueItems: true, items: findingSchema }, cleanup: { type: 'object', additionalProperties: false, required: ['scratchRefs', 'retention', 'purgeAt'], properties: { scratchRefs: receiptArray(64), retention: { const: 'until-skill-terminal' }, purgeAt: { const: 'skill-terminal' } } } } };
  writeJson(path.join(directory, 'input.schema.json'), inputSchema);
  writeJson(path.join(directory, 'output.schema.json'), outputSchema);
  const checks = flow.checks.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const optionRows = Object.entries(flow.options).map(([name, spec]) => `| \`${name}\` | ${spec.enum ? spec.enum.map((item) => `\`${item}\``).join(' / ') : `\`${spec.type}\``} | ${spec.description} |`).join('\n') || '| — | — | No additional option is loaded. |';
  const contextRows = (flow.contextMatrix ?? []).map(([state, allowed, forbidden]) => `| \`${state}\` | ${allowed} | ${forbidden} |`).join('\n') || '| every state | current operator declaration only | undeclared context |';
  writeFileSync(path.join(directory, 'analyze-input.md'), `# Analyze ${flow.id} input\n\nGlobal \`@selection\` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify \`selection.skillId\` equals \`${flow.id}\`. Then perform these local checks:\n\n${checks}\n\nReject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.\n\nThe fixed first state is \`${flow.entry}\`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.\n\n## Options\n\n| Option | Values | Decision effect |\n| --- | --- | --- |\n${optionRows}\n`);
  writeFileSync(path.join(directory, 'input.md'), `# ${flow.id} input\n\nProvide one closed invocation validated by \`input.schema.json\`. The required \`selection\` object is the ephemeral output of global \`/analyze-input.md\`; it selects this skill directly. ${flow.inputBoundary ?? 'This package owns one fixed-entry flow and accepts no secondary mode.'}\n`);
  writeFileSync(path.join(directory, 'output.md'), `# ${flow.id} output\n\nReturn one terminal result bound to an exact machine terminal through \`state.status\`, \`state.code\`, and \`state.terminalState\`. Return only immutable receipt references and bounded evidence-linked findings. Set \`handoffRef\` to the validated session handoff artifact only for a handoff result; otherwise set it to \`null\`. \`cleanup\` always purges task-session scratch at the skill terminal.\n`);
  writeFileSync(path.join(directory, 'execute.md'), `# Execute ${flow.id}\n\n1. Accept only a validated global \`selection\` for this skill, validate the complete input, run local \`analyze-input\`, then enter fixed state \`${flow.entry}\`. Treat an omitted \`selection.mode\` as \`gated\`.\n2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.\n3. Validate operator input, execute it, validate output, then route through exactly one matching edge.\n4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.\n5. In \`gated\` mode, wait states stop before irreversible work and accept only the displayed revision or command. In \`bypass\` mode, do not pause: bind the currently displayed revision to an ephemeral bypass-authorization receipt and continue only to \`approval.bypassTarget\`; never describe that receipt as human approval.${waitReviewRule ? ` ${waitReviewRule}` : ''}\n6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only authorized product-source or external mutations.\n\n## CONTEXT BY STATE\n\n| State or phase | Allowed | Forbidden |\n| --- | --- | --- |\n${contextRows}\n`);
  writeFileSync(path.join(directory, 'SKILL.md'), `---\nname: ${flow.id}\ndescription: ${JSON.stringify(flow.description)}\n---\n\n# ${flow.id}\n\n${flow.description}\n\n## INPUT ANALYSIS\n\nRequire the ephemeral global selection, read \`input.md\`, validate \`input.schema.json\`, then follow local \`analyze-input.md\`. This skill owns one flow with fixed first state \`${flow.entry}\`; local analysis only validates and normalizes scope without loading operator knowledge.\n\n## STATE MACHINE\n\nExecute \`machine.json\` through \`execute.md\`. Branches and loops are machine-owned; operators never invoke one another.${waitReviewRule ? ` ${waitReviewRule}` : ''} An omitted \`selection.mode\` is \`gated\`: stop at waits for the exact displayed revision. With explicit \`selection.mode=bypass\`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared \`approval.bypassTarget\`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.\n\n## CONTEXT CONTRACT\n\n| State or phase | Allowed | Forbidden |\n| --- | --- | --- |\n${contextRows}\n`);
  writeFileSync(path.join(agentDirectory, 'openai.yaml'), `interface:\n  display_name: ${yamlString(flow.display)}\n  short_description: ${yamlString(flow.short)}\n  default_prompt: ${yamlString(`Use $${flow.id} for this selected flow and execute its state machine.`)}\npolicy:\n  allow_implicit_invocation: true\n`);
  writeFileSync(path.join(directory, 'validate-input.mjs'), `import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';\nexport const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url));\nif(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');\n`);
  writeFileSync(path.join(directory, 'validate-output.mjs'), `import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';\nexport const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{const errors=[];if(value.result==='complete'&&value.receiptRefs.length===0)errors.push('$.receiptRefs: completion requires evidence');if(value.finalState!==value.state.terminalState)errors.push('$.state.terminalState: must equal finalState');if(value.result==='handoff'&&!value.handoffRef)errors.push('$.handoffRef: handoff requires a typed session artifact');if(value.result!=='handoff'&&value.handoffRef!==null)errors.push('$.handoffRef: only handoff may expose a handoff artifact');for(const finding of value.findings)if(finding.severity==='error'&&finding.evidenceRefs.length===0)errors.push('$.findings: error findings require evidence');return errors});\nif(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');\n`);
}

console.log(`materialized ${flows.length} one-flow state-machine skills`);
