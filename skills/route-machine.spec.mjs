import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bypassApprovalReceipt, nextState } from './route-machine.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const machine = (id) => JSON.parse(readFileSync(path.join(root, id, 'machine.json'), 'utf8'));
const enter = (id) => nextState(machine(id), 'analyze-input', {}, { selection: { skillId: id }, options: {} });
const decide = (id, state, decision) => nextState(machine(id), state, { payload: { decision } }, {});
const globalAnalyzer = readFileSync(path.join(root, '..', 'analyze-input.md'), 'utf8');

assert.match(globalAnalyzer, /explicit correction or blame from real product use/);
assert.match(globalAnalyzer, /repair it, and add or strengthen a regression check/);
assert.match(globalAnalyzer, /only when the correction concerns UX\/UI behavior/);

assert.equal(enter('starci-frontend-ui-direction'), 'generate');
assert.equal(decide('starci-frontend-ui-direction', 'generate', 'directions-ready'), 'review');
assert.equal(decide('starci-frontend-design-critique', 'critique', 'revise'), 'revision-handoff');
assert.equal(decide('starci-frontend-ux-flow', 'model', 'flow-ready'), 'containers');
assert.equal(decide('starci-frontend-ux-flow', 'containers', 'containers-ready'), 'review');
assert.equal(decide('starci-frontend-ui-detail', 'freeze', 'detail-frozen'), 'review');
assert.equal(decide('starci-frontend-contract-plan', 'plan', 'grammar-gap'), 'gap-handoff');
assert.equal(decide('starci-frontend-implementation', 'implement', 'design-feasibility-conflict'), 'handoff');
assert.equal(decide('starci-frontend-visual-fidelity', 'verify', 'repair'), 'repair-handoff');
assert.equal(decide('starci-product-uat', 'verify', 'passed'), 'complete');
assert.equal(nextState(machine('starci-product-uat'), 'verify', {
  payload: { decision: 'passed' },
  facts: ['ux-ui-resolution-close-required']
}, {}), 'resolve-ux-ui');
assert.equal(decide('starci-product-uat', 'verify', 'ux-ui-repair'), 'resolve-ux-ui');
assert.equal(decide('starci-product-uat', 'resolve-ux-ui', 'repair-ready'), 'repair-handoff');
assert.equal(decide('starci-product-uat', 'resolve-ux-ui', 'resolved'), 'complete');

assert.equal(decide('starci-architecture-discover', 'evidence', 'ready'), 'model');
assert.equal(decide('starci-architecture-discover', 'model', 'revise'), 'evidence');
assert.equal(decide('starci-data-ownership-model', 'ownership', 'ready'), 'contradictions');
assert.equal(decide('starci-data-ownership-model', 'contradictions', 'revise'), 'ownership');
assert.equal(decide('starci-architecture-option-design', 'options', 'ready'), 'approval');
assert.equal(nextState(machine('starci-architecture-option-design'), 'approval', { stage: 'architecture.option.review', status: 'approved' }, {}), 'handoff');
assert.equal(nextState(machine('starci-architecture-option-design'), 'approval', {}, { selection: { mode: 'bypass' } }), 'handoff');
assert.deepEqual(
  bypassApprovalReceipt(
    machine('starci-architecture-option-design'),
    'approval',
    { runId: 'run-1', selection: { mode: 'bypass' } },
    'sha256:approved-option'
  ),
  {
    schemaVersion: 1,
    kind: 'bypass-authorization',
    source: 'selection.mode',
    mode: 'bypass',
    skillId: 'starci-architecture-option-design',
    stateId: 'approval',
    revisionRef: 'sha256:approved-option',
    target: 'handoff',
    ref: 'session://tasks/run-1/approvals/bypass/approval',
    retention: 'until-skill-terminal'
  }
);
assert.throws(
  () => nextState(machine('starci-architecture-option-design'), 'approval', {}, { selection: { mode: 'unknown' } }),
  /unknown approval mode/
);

for (const entry of readdirSync(root, { withFileTypes: true }).filter((item) => item.isDirectory() && item.name.startsWith('starci-'))) {
  const candidate = machine(entry.name);
  for (const [stateId, state] of Object.entries(candidate.states)) {
    if (state.kind !== 'wait') continue;
    assert.equal(
      nextState(candidate, stateId, {}, { selection: { mode: 'bypass' } }),
      state.approval.bypassTarget,
      `${entry.name}/${stateId}`
    );
    assert.throws(
      () => nextState(candidate, stateId, {}, { selection: { mode: 'gated' } }),
      /expected one route, matched 0/,
      `${entry.name}/${stateId} gated wait`
    );
  }
}
assert.equal(decide('starci-architecture-critique', 'critique', 'revise'), 'revision-handoff');
assert.equal(decide('starci-architecture-realization', 'realize', 'ready'), 'conformance');
assert.equal(decide('starci-architecture-realization', 'conformance', 'revise'), 'realize');

assert.equal(decide('starci-backend-solution-design', 'design', 'ready'), 'handoff');
assert.equal(decide('starci-backend-contract-plan', 'contract', 'revise'), 'contract');
assert.equal(decide('starci-backend-contract-critique', 'critique', 'revise'), 'revision-handoff');
assert.equal(decide('starci-backend-implementation', 'scope', 'ready'), 'preflight');
assert.equal(decide('starci-backend-implementation', 'preflight', 'ready'), 'implement');
assert.equal(decide('starci-backend-implementation', 'implement', 'ready'), 'conformance');
assert.equal(decide('starci-backend-implementation', 'conformance', 'revise'), 'scope');
assert.equal(decide('starci-backend-proof', 'prove', 'revise'), 'repair-handoff');

assert.equal(decide('starci-static-quality-gates', 'lint', 'pass'), 'typecheck');
assert.equal(decide('starci-static-quality-gates', 'typecheck', 'pass'), 'sonar');
assert.equal(decide('starci-static-quality-gates', 'sonar', 'pass'), 'complete');
assert.equal(decide('starci-static-quality-gates', 'lint', 'in-boundary'), 'handoff');

const maintenance = machine('starci-frontend-maintenance-apply');
assert.equal(nextState(maintenance, 'analyze-input', {}, { selection: { skillId: 'starci-frontend-maintenance-apply' }, options: {} }), 'maintenance-feedback-request');

const deployment = machine('starci-deployment');
assert.equal(nextState(deployment, 'monitor', { payload: { decision: 'recover' } }, {}), 'recover');
assert.equal(nextState(deployment, 'monitor', { payload: { decision: 'progressing' } }, {}), 'monitor');
assert.equal(nextState(deployment, 'recover', { payload: { decision: 'retry' } }, {}), 'monitor');
assert.equal(nextState(deployment, 'proof', { payload: { decision: 'rolled-back' } }, {}), 'rolled-back');

assert.throws(
  () => nextState({ id: 'ambiguous', states: { start: { kind: 'choice', on: [
    { when: {}, target: 'a' }, { when: {}, target: 'b' }
  ] } } }, 'start', {}, {}),
  /expected one route, matched 2/
);

console.log('v6.2 capability routing tests passed');
