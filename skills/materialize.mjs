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
  identity: op('workspace/identity-verify', decided({ ready: 'bootstrap' })),
  bootstrap: op('workspace/bootstrap-verify', decided({ ready: 'declarations' })),
  declarations: op('workspace/declarations-compile', decided({ ready: 'routes' })),
  routes: op('workspace/routes-hydrate', decided({ ready: 'worktree' })),
  worktree: op('workspace/worktree-verify', decided({ ready: 'route' })),
  route: op('workspace/route-verify', decided({ ready: 'complete' })),
  complete: terminal('complete')
};

const businessStates = {
  route: op('workspace/route-verify', decided({ ready: 'evidence' })),
  evidence: op('business/evidence-normalize', decided({ ready: 'model' })),
  model: op('business/model', decided({ ready: 'model-approval' })),
  'model-approval': wait('Approve the displayed business model revision and lifecycle transition.', 'OK BUSINESS <hash>', 'REJECT BUSINESS <hash>', [e({ stage: 'business.model.review', status: 'approved' }, 'publish'), e({ stage: 'business.model.review', status: 'rejected' }, 'evidence')]),
  publish: op('business/publish', decided({ 'direct-plan': 'complete', 'architecture-required': 'complete', blocked: 'blocked' })),
  'reconcile-route': op('workspace/route-verify', decided({ ready: 'reconcile' })),
  reconcile: op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' })),
  complete: terminal('complete'), blocked: terminal('blocked')
};

const architectureStates = {
  route: op('workspace/route-verify', decided({ ready: 'business-staleness' })),
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
  route: op('workspace/route-verify', decided({ ready: 'business-staleness' })),
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
  'boundary-approval': wait('Approve the exact backend plan hash and file boundary.', 'OK BACKEND <hash>', 'REJECT BACKEND <hash>', [e({ stage: 'architecture.boundary.review', status: 'approved' }, 'implement'), e({ stage: 'architecture.boundary.review', status: 'rejected' }, 'boundary-plan')]),
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

const frontendStates = {
  route: op('workspace/route-verify', decided({ ready: 'business-staleness' })),
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
  'e2e-test': op('test/e2e', [e({ stage: 'test.ui', status: 'ready' }, 'ui-test'), e({ stage: 'code.repair', status: 'repair' }, 'implementation'), e({ stage: 'test.review', status: 'blocked' }, 'blocked')]),
  'ui-test': op('test/ui', [e({ stage: 'proof.run', status: 'ready' }, 'product-proof'), e({ stage: 'code.repair', status: 'repair' }, 'implementation'), e({ stage: 'layout.review', status: 'rejected' }, 'layout'), e({ stage: 'test.review', status: 'blocked' }, 'blocked')]),
  'product-proof': op('fe/product-proof', [e({ stage: 'proof.review', status: 'complete' }, 'complete'), e({ stage: 'code.repair', status: 'repair' }, 'implementation'), e({ stage: 'layout.review', status: 'rejected' }, 'layout'), e({ stage: 'proof.review', status: 'blocked' }, 'blocked')]),
  'block-reconcile': op('fe/block-reconcile', decided({ reconciled: 'complete', blocked: 'blocked' })),
  'maintenance-apply': op('fe/maintenance-apply', decided({ applied: 'learning-request', blocked: 'blocked' })),
  'learning-request': op('fe/learning-request', decided({ recorded: 'complete', blocked: 'blocked' })),
  'learning-resolve': op('fe/learning-resolve', decided({ resolved: 'complete', blocked: 'blocked' })),
  'surface-audit': op('fe/surface-audit', decided({ audited: 'authority-approval', blocked: 'blocked' })),
  'authority-approval': wait('Approve the smallest durable design authority and closed consumer set.', 'OK AUTHORITY <hash>', 'REJECT AUTHORITY <hash>', [e({ stage: 'fe.authority.review', status: 'approved' }, 'authority-reconcile'), e({ stage: 'fe.authority.review', status: 'rejected' }, 'surface-audit')]),
  'authority-reconcile': op('fe/authority-reconcile', decided({ reconciled: 'consumer-align', blocked: 'blocked' })),
  'consumer-align': op('fe/consumer-align', decided({ aligned: 'complete', blocked: 'blocked' })),
  complete: terminal('complete'), blocked: terminal('blocked')
};

const qualityStates = {
  diagnose: op('quality/workflow-diagnose', decided({ diagnosed: 'complete', inconclusive: 'blocked', 'external-blocker': 'blocked' })),
  inventory: op('quality/readiness-inventory', decided({ green: 'complete', findings: 'repair-approval', blocked: 'blocked' })),
  'repair-approval': wait('Approve one exact measured finding and repair boundary.', 'OK REPAIR <finding>', 'REJECT REPAIR <finding>', [e({ stage: 'quality.repair.review', status: 'approved' }, 'repair'), e({ stage: 'quality.repair.review', status: 'rejected' }, 'rejected')]),
  repair: op('quality/finding-repair', decided({ repaired: 'inventory', 'stale-finding': 'inventory', 'boundary-drift': 'blocked', 'external-blocker': 'blocked' })),
  debt: op('quality/debt-repay', decided({ closed: 'complete', progress: 'debt', blocked: 'blocked' })),
  bindings: op('quality/rule-binding-check', decided({ pass: 'complete', fail: 'findings', blocked: 'blocked' })),
  findings: terminal('complete'),
  complete: terminal('complete'), rejected: terminal('rejected'), blocked: terminal('blocked')
};

const deploymentStates = {
  route: op('workspace/route-verify', decided({ ready: 'intent' })),
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
  rollout: op('deployment/rollout', decided({ ready: 'monitor' })),
  monitor: op('deployment/monitor', decided({ steady: 'proof', recover: 'recover', rollback: 'rollback', blocked: 'blocked' })),
  recover: op('deployment/recover', decided({ retry: 'monitor', rollback: 'rollback', 'approval-required': 'approval', blocked: 'blocked' })),
  rollback: op('deployment/rollback', decided({ 'rolled-back': 'proof', blocked: 'blocked' })),
  proof: op('deployment/proof', decided({ complete: 'reconcile-choice', blocked: 'blocked' })),
  'reconcile-choice': choice([e({ inputEquals: { 'options.reconcileBusiness': true } }, 'business-reconcile'), e({ inputEquals: { 'options.reconcileBusiness': false } }, 'complete')]),
  'business-reconcile': op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' })),
  complete: terminal('complete'), rejected: terminal('rejected'), blocked: terminal('blocked')
};

const deploymentFollowupStates = {
  monitor: op('deployment/monitor', decided({ steady: 'proof', recover: 'recover', rollback: 'rollback', blocked: 'blocked' })),
  recover: op('deployment/recover', decided({ retry: 'monitor', rollback: 'rollback', 'approval-required': 'recovery-approval', blocked: 'blocked' })),
  'recovery-approval': wait('Approve the exact recovery boundary.', 'OK DEPLOY <hash>', 'REJECT DEPLOY <hash>', [e({ stage: 'deployment.review', status: 'approved' }, 'recover'), e({ stage: 'deployment.review', status: 'rejected' }, 'rejected')]),
  rollback: op('deployment/rollback', decided({ 'rolled-back': 'proof', blocked: 'blocked' })),
  proof: op('deployment/proof', decided({ complete: 'reconcile-choice', blocked: 'blocked' })),
  'reconcile-choice': choice([e({ inputEquals: { 'options.reconcileBusiness': true } }, 'business-reconcile'), e({ inputEquals: { 'options.reconcileBusiness': false } }, 'complete')]),
  'business-reconcile': op('business/reconcile', decided({ implemented: 'complete', discrepancy: 'blocked' })),
  complete: terminal('complete'), rejected: terminal('rejected'), blocked: terminal('blocked')
};

const platformStates = {
  'tunnel-plan': op('platform/tunnel-plan', decided({ ready: 'tunnel-apply' })),
  'tunnel-apply': op('platform/tunnel-apply', decided({ proved: 'complete', blocked: 'blocked' })),
  'mcp-config': op('platform/mcp-config', decided({ ready: 'source-index' })),
  'source-index': op('platform/source-index', decided({ ready: 'mcp-publish-choice' })),
  'mcp-publish-choice': choice([e({ inputEquals: { 'options.publishPublic': false } }, 'complete'), e({ inputEquals: { 'options.publishPublic': true, 'options.ensureTunnel': false } }, 'mcp-publish'), e({ inputEquals: { 'options.publishPublic': true, 'options.ensureTunnel': true } }, 'mcp-tunnel-plan')]),
  'mcp-tunnel-plan': op('platform/tunnel-plan', decided({ ready: 'mcp-tunnel-apply' })),
  'mcp-tunnel-apply': op('platform/tunnel-apply', decided({ proved: 'mcp-publish', blocked: 'blocked' })),
  'mcp-publish': op('platform/mcp-publish', decided({ proved: 'complete', blocked: 'blocked' })),
  sonar: op('platform/sonar-service-reconcile', decided({ proved: 'complete', blocked: 'blocked' })),
  observability: op('platform/observability-reconcile', decided({ proved: 'complete', blocked: 'blocked' })),
  complete: terminal('complete'), blocked: terminal('blocked')
};

const conversationStates = {
  record: op('source/conversation-record', decided({ recorded: 'complete' })),
  query: op('source/conversation-query', decided({ found: 'complete', empty: 'complete' })),
  complete: terminal('complete')
};

const deployOptions = { reconcileBusiness: { type: 'boolean', description: 'Reconcile final proof into the business head.' } };
const backendOptions = { deploymentMode: { enum: ['none', 'handoff'], description: 'Stop after source proof or hand off to deployment.' } };
const repairOptions = { deploymentMode: backendOptions.deploymentMode };

const flows = [
  {
    id: 'workspace-ready', display: 'StarCi Workspace Ready', short: 'Prepare and verify a routed StarCi workspace', entry: 'identity', states: workspaceStates, options: {},
    description: 'Use when a StarCi Source must be initialized or brought to one fully verified workspace-ready state before product work. Do not use for business modeling, implementation, quality repair, or deployment.',
    checks: ['Resolve Source identity and the exact workspace boundary.', 'Verify bootstrap, declarations, routes, worktree and final route as one readiness flow.', 'Reject undeclared paths or targets outside the workspace.']
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
    id: 'backend-repair', display: 'StarCi Backend Repair', short: 'Repair one approved backend source boundary', entry: 'implement', states: backendStates, options: repairOptions,
    description: 'Use to resume one already approved in-boundary backend repair and rerun independent quality proof. Do not use for new feature planning, unapproved boundary changes, frontend work, or deployment.',
    checks: ['Resolve the approved plan hash, finding and current source baseline.', 'Confirm every write remains inside the approved backend boundary.', 'Route source or boundary drift back to planning.']
  },
  {
    id: 'frontend-layout-delivery', display: 'StarCi Frontend Layout Delivery', short: 'Design and deliver complete frontend journeys', entry: 'route', states: frontendStates,
    options: {
      directionCount: { enum: [3, 4], description: 'Generate exactly three or four materially distinct customer journeys.' },
      selectionPolicy: { enum: ['manual', 'auto-recommended'], description: 'Wait for explicit journey approval or bind the recommended direction automatically.' }
    },
    description: 'Use to create or substantially redesign a complete frontend customer journey, page set, page models, layouts, implementation, and proof. Do not use for isolated blocks, approved maintenance, learning resolution, or cross-surface consistency.',
    checks: ['Resolve the complete page set and project route without loading product context.', 'Confirm this is journey-level work and bind the selected Grammar package.', 'Identify creative approvals and permitted source roots.'],
    contextMatrix: [
      ['route + staleness', 'route, commit, revision, receipt and hash metadata', 'business body, Qdrant bodies, source files'],
      ['business initialize', 'exact evidence and business lifecycle law only after stale decision', 'frontend knowledge and coding context'],
      ['preflight', 'request, route and fresh-business receipt headers', 'all semantic bodies'],
      ['customer journey', 'fresh business journey projection + fe.customer-journey', 'Principles, Grammar, coding context, raw source'],
      ['page + state', 'selected journey + exact business slice + one operator law', 'other directions and source'],
      ['context sync', 'metadata first; changed generated JSON/knowledge only on hash miss', 'unchanged bodies and model-visible raw source'],
      ['source fit + Principles + layout + Grammar', 'approved session refs + exact Qdrant records + canonical JSON candidates', 'whole indexes, unrelated features, raw source'],
      ['coding scope freeze', 'approved refs, canonical candidate records, exact file headers', 'file bodies and repository scans'],
      ['implementation + proof', 'only frozen exact files, commands, seeds and receipts', 'undeclared files, broad Qdrant, unrelated business']
    ]
  },
  {
    id: 'frontend-block-reconcile', display: 'StarCi Frontend Block Reconcile', short: 'Reconcile one frontend block and its consumers', entry: 'block-reconcile', states: frontendStates, options: {},
    description: 'Use when one existing frontend block or component contract must be reconciled with its known consumers. Do not use for complete journey design, maintenance, learning resolution, or broad cross-surface authority changes.',
    checks: ['Resolve exactly one block contract and its closed consumer set.', 'Require current source-contract and Grammar identities.', 'Reject journey redesign or unbounded consumer discovery.']
  },
  {
    id: 'frontend-maintenance-apply', display: 'StarCi Frontend Maintenance Apply', short: 'Apply approved frontend maintenance safely', entry: 'maintenance-apply', states: frontendStates, options: {},
    description: 'Use to apply one already approved source-first frontend maintenance change and record its durable learning request. Do not use for design exploration, unapproved feedback, or cross-surface authority selection.',
    checks: ['Resolve approved feedback, exact source boundary and expected evidence.', 'Confirm the design decision is already approved.', 'Identify the required durable learning record.']
  },
  {
    id: 'frontend-learning-resolve', display: 'StarCi Frontend Learning Resolve', short: 'Resolve one queued frontend design learning', entry: 'learning-resolve', states: frontendStates, options: {},
    description: 'Use to resolve one queued frontend design learning item into its declared durable authority. Do not use to apply ordinary feedback, redesign a journey, or reconcile consumers.',
    checks: ['Resolve one queued learning identity and proposed authority.', 'Confirm evidence is current and bounded.', 'Reject ordinary maintenance or unrelated source work.']
  },
  {
    id: 'frontend-surface-reconcile', display: 'StarCi Frontend Surface Reconcile', short: 'Align a closed set of frontend surfaces', entry: 'surface-audit', states: frontendStates, options: {},
    description: 'Use when a closed set of frontend pages or surfaces must converge on the smallest durable design authority. Do not use for a single block, isolated maintenance, or a new customer journey.',
    checks: ['Resolve the closed surface set and inconsistency evidence.', 'Identify the smallest authority and all consumers.', 'Require explicit authority approval before mutation.']
  },
  {
    id: 'workflow-diagnose', display: 'StarCi Workflow Diagnose', short: 'Trace one failing workflow without mutation', entry: 'diagnose', states: qualityStates, options: {},
    description: 'Use to diagnose one failing workflow without changing source or external state. Do not use for readiness inventory, approved repair, quality debt, or rule-binding audit.',
    checks: ['Resolve one failing workflow and observed symptom.', 'Keep the boundary read-only.', 'Reject implied repair or an unbounded request.']
  },
  {
    id: 'quality-readiness', display: 'StarCi Quality Readiness', short: 'Inventory and close measured readiness findings', entry: 'inventory', states: qualityStates, options: {},
    description: 'Use to inventory one delivery boundary and loop through explicitly approved measured repairs until readiness is green. Do not use for diagnosis-only work, debt repayment, or rule-binding audit.',
    checks: ['Resolve one delivery boundary and required checks.', 'Separate measured findings from speculative improvements.', 'Require approval before every source repair.']
  },
  {
    id: 'quality-finding-repair', display: 'StarCi Quality Finding Repair', short: 'Repair one approved measured quality finding', entry: 'repair-approval', states: qualityStates, options: {},
    description: 'Use to repair one already measured quality finding after confirming its exact approval boundary, then re-inventory the target. Do not use for broad readiness assessment, diagnosis, or debt repayment.',
    checks: ['Resolve one finding, baseline and repair target.', 'Require the exact approval before mutation.', 'Re-inventory after repair and stop on boundary drift.']
  },
  {
    id: 'quality-debt-repay', display: 'StarCi Quality Debt Repay', short: 'Repay one approved quality debt boundary', entry: 'debt', states: qualityStates, options: {},
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
    description: 'Use to monitor one existing rollout until steady state, recovery, rollback, or a bounded blocker is proved. Do not use to initiate a new deployment.',
    checks: ['Resolve one existing release and rollout identity.', 'Confirm observation is the starting action.', 'Keep recovery and rollback bound to the same release.']
  },
  {
    id: 'deployment-recover', display: 'StarCi Deployment Recover', short: 'Recover one observed failed rollout safely', entry: 'recover', states: deploymentFollowupStates, options: deployOptions,
    description: 'Use to recover one observed failed rollout, then monitor the same release to proof or rollback. Do not use for a new deployment or a speculative failure.',
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
    id: 'source-index-publish', display: 'StarCi Source Index Publish', short: 'Index and optionally publish StarCi context', entry: 'mcp-config', states: platformStates,
    options: { publishPublic: { type: 'boolean', description: 'Publish MCP through the declared public boundary.' }, ensureTunnel: { type: 'boolean', description: 'Reconcile a tunnel before MCP publication.' } },
    description: 'Use to configure and index StarCi business or generated-contract context, optionally publishing its MCP boundary. Do not use for product delivery, Sonar, observability, or a tunnel-only request.',
    checks: ['Resolve project and declared context inputs.', 'Distinguish local indexing from public MCP mutation.', 'Evaluate tunnel work only for public publication.']
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

for (const flow of flows) flow.id = `starci-${flow.id}`;

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
    activeInputRefs: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
    passiveContextRefs: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } }
  }
});

for (const flow of flows) {
  const directory = path.join(root, flow.id);
  const agentDirectory = path.join(directory, 'agents');
  mkdirSync(agentDirectory, { recursive: true });
  const states = reachableSubgraph(flow.states, flow.entry);
  writeJson(path.join(directory, 'machine.json'), { $schema: '../machine.schema.json', schemaVersion: 6, id: flow.id, start: 'analyze-input', states });
  const optionProperties = Object.fromEntries(Object.entries(flow.options).map(([name, spec]) => [name, spec.enum ? { type: typeof spec.enum[0], enum: spec.enum } : { type: spec.type ?? 'string' }]));
  const selectionSchema = { type: 'object', additionalProperties: false, required: ['analyzerVersion', 'skillId', 'confidence', 'activeInputRefs', 'passiveContextRefs'], properties: { analyzerVersion: { const: 1 }, skillId: { const: flow.id }, confidence: { enum: ['exact', 'clarified'] }, activeInputRefs: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } }, passiveContextRefs: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } } } };
  const inputSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `https://starci.dev/v6/skills/${flow.id}/input.schema.json`, type: 'object', additionalProperties: false, required: ['schemaVersion', 'runId', 'project', 'selection', 'requestRef', 'artifactRefs', 'evidenceRefs', 'scope', 'options'], properties: { schemaVersion: { const: 6 }, runId: { type: 'string', minLength: 1 }, project: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' }, selection: selectionSchema, requestRef: { type: 'string', minLength: 1 }, artifactRefs: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } }, evidenceRefs: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } }, scope: { type: 'object', additionalProperties: false, required: ['targetRefs', 'writeRoots', 'externalMutation', 'approvalRef'], properties: { targetRefs: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } }, writeRoots: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } }, externalMutation: { type: 'boolean' }, approvalRef: { type: ['string', 'null'], minLength: 1 } } }, options: { type: 'object', additionalProperties: false, required: Object.keys(optionProperties), properties: optionProperties } } };
  const outputSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `https://starci.dev/v6/skills/${flow.id}/output.schema.json`, type: 'object', additionalProperties: false, required: ['schemaVersion', 'runId', 'skillId', 'result', 'finalState', 'receiptRefs', 'findings'], properties: { schemaVersion: { const: 6 }, runId: { type: 'string', minLength: 1 }, skillId: { const: flow.id }, result: { enum: ['complete', 'blocked', 'handoff', 'not-needed', 'rejected'] }, finalState: { type: 'string', minLength: 1 }, receiptRefs: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } }, findings: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } } } };
  writeJson(path.join(directory, 'input.schema.json'), inputSchema);
  writeJson(path.join(directory, 'output.schema.json'), outputSchema);
  const checks = flow.checks.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const optionRows = Object.entries(flow.options).map(([name, spec]) => `| \`${name}\` | ${spec.enum ? spec.enum.map((item) => `\`${item}\``).join(' / ') : `\`${spec.type}\``} | ${spec.description} |`).join('\n') || '| — | — | No additional option is loaded. |';
  const contextRows = (flow.contextMatrix ?? []).map(([state, allowed, forbidden]) => `| \`${state}\` | ${allowed} | ${forbidden} |`).join('\n') || '| every state | current operator declaration only | undeclared context |';
  writeFileSync(path.join(directory, 'analyze-input.md'), `# Analyze ${flow.id} input\n\nGlobal \`@selection\` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify \`selection.skillId\` equals \`${flow.id}\`. Then perform these local checks:\n\n${checks}\n\nReject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.\n\nThe fixed first state is \`${flow.entry}\`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.\n\n## Options\n\n| Option | Values | Decision effect |\n| --- | --- | --- |\n${optionRows}\n`);
  writeFileSync(path.join(directory, 'input.md'), `# ${flow.id} input\n\nProvide one closed invocation validated by \`input.schema.json\`. The required \`selection\` object is the ephemeral output of global \`/analyze-input.md\`; it selects this skill directly. This package owns one fixed-entry flow and accepts no secondary mode.\n`);
  writeFileSync(path.join(directory, 'output.md'), `# ${flow.id} output\n\nReturn the terminal result, final state, immutable receipt references and unresolved findings. A handoff is explicit and never mislabeled complete.\n`);
  writeFileSync(path.join(directory, 'execute.md'), `# Execute ${flow.id}\n\n1. Accept only a validated global \`selection\` for this skill, validate the complete input, run local \`analyze-input\`, then enter fixed state \`${flow.entry}\`.\n2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.\n3. Validate operator input, execute it, validate output, then route through exactly one matching edge.\n4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.\n5. Wait states stop before irreversible work and accept only the displayed revision or command.\n6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only approved product-source or external mutations.\n\n## CONTEXT BY STATE\n\n| State or phase | Allowed | Forbidden |\n| --- | --- | --- |\n${contextRows}\n\n## LOADS\n\n| Alias | Target | Kind | Why |\n| --- | --- | --- | --- |\n| \`@selection\` | global \`/analyze-input.md\` output | task-session | prove why this one-flow skill was selected |\n| \`@machine\` | \`machine.json\` | file | state, guard, branch, loop, wait and terminal ownership |\n| \`@input-analysis\` | \`analyze-input.md\` | file | normalize this invocation before its fixed first state |\n\nNo Qdrant knowledge is loaded at skill scope.\n`);
  writeFileSync(path.join(directory, 'SKILL.md'), `---\nname: ${flow.id}\ndescription: ${JSON.stringify(flow.description)}\n---\n\n# ${flow.id}\n\n${flow.description}\n\n## INPUT ANALYSIS\n\nRequire the ephemeral global selection, read \`input.md\`, validate \`input.schema.json\`, then follow local \`analyze-input.md\`. This skill owns one flow with fixed first state \`${flow.entry}\`; local analysis only validates and normalizes scope without loading operator knowledge.\n\n## STATE MACHINE\n\nExecute \`machine.json\` through \`execute.md\`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.\n\n## CONTEXT CONTRACT\n\n| State or phase | Allowed | Forbidden |\n| --- | --- | --- |\n${contextRows}\n\n## LOADS\n\n| Alias | Target | Kind | Why |\n| --- | --- | --- | --- |\n| \`@selection\` | global \`/analyze-input.md\` output | task-session | bind prompt intent directly to this one-flow skill |\n| \`@machine\` | \`machine.json\` | file | executable state-machine graph |\n| \`@analysis\` | \`analyze-input.md\` | file | local validation and normalization before operator load |\n`);
  writeFileSync(path.join(agentDirectory, 'openai.yaml'), `interface:\n  display_name: ${yamlString(flow.display)}\n  short_description: ${yamlString(flow.short)}\n  default_prompt: ${yamlString(`Use $${flow.id} for this selected flow and execute its state machine.`)}\npolicy:\n  allow_implicit_invocation: true\n`);
  writeFileSync(path.join(directory, 'validate-input.mjs'), `import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';\nexport const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url));\nif(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');\n`);
  writeFileSync(path.join(directory, 'validate-output.mjs'), `import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';\nexport const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>value.result==='complete'&&value.receiptRefs.length===0?['$.receiptRefs: completion requires evidence']:[]);\nif(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');\n`);
}

console.log(`materialized ${flows.length} one-flow state-machine skills`);
