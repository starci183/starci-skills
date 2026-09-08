import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateSpecification } from '../specifications/validate.mjs';
import { validateWorkspace } from '../core/index.mjs';
import { validateFEHandoff } from '../workflows/frontend.mjs';
import { validateCatalog } from '../ops/validate.mjs';
const sample = () => JSON.parse(fs.readFileSync(new URL('../examples/nivo-setup-architecture.json', import.meta.url), 'utf8'));

test('source-grounded examples are valid draft specifications, never approved product work', () => {
  for (const kind of ['business','architecture']) {
    const spec = JSON.parse(fs.readFileSync(new URL('../examples/nivo-setup-' + kind + '.json', import.meta.url), 'utf8'));
    assert.deepEqual(validateSpecification(spec), { ok: true, errors: [] });
    spec.status = 'pass';
    assert.equal(validateSpecification(spec).ok, false);
  }
});

test('specifications reject broken joins, hidden fields, missing service/code/security coverage and malformed input', () => {
  for (const mutate of [
    s => s.requirements[0].acceptanceIds = ['missing'],
    s => s.codeImpacts = [],
    s => s.serviceImpacts = [],
    s => s.security[0].acceptanceIds = ['AC-exact'],
    s => s.codeImpacts[0].path = '../escape.ts',
    s => s.sources[0].revision = 'main',
    s => s.flows[0].steps[0].effects = null,
    s => s.handoff.implementationChecks[0].owner = 'architecture.decide',
    s => s.handoff.implementationChecks[0].status = 'pass',
    s => s.journeyCoverage = [],
    s => s.journeys[0].steps[0].uxChecks = [{id:'x',question:'Observed?',expected:'maybe'}],
    s => s.journeyCoverage[0].stepId = 'missing-step',
    s => s.unexpected = true,
    s => s.sources = [null],
    s => s.requirements[0].sourceRefs = 'not-an-array',
  ]) {
    const spec = sample(); mutate(spec);
    assert.equal(validateSpecification(spec).ok, false);
  }
});

test('.work validates specification owner, source revision binding and non-completion of drafts', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-specification-'));
  t.after(() => { assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('starci-specification-')); fs.rmSync(root, { recursive: true, force: true }); });
  fs.writeFileSync(path.join(root, 'workspace.yaml'), JSON.stringify({schema:'work/workspace@1',id:'test-workspace'}));
  const spec = sample();
  const repositories = [...new Set(spec.sources.map(x => x.repository))];
  for (const id of repositories) {
    const dir = path.join(root, '_resources', id); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'resource.yaml'), JSON.stringify({schema:'work/resource@1',id,kind:'repository',owner:'test-owner',revision:spec.sources.find(s => s.repository === id).revision,details:{note:'Source-reference example, no checkout mutation.'}}));
  }
  const node = {schema:'work/node@1',id:'architecture-example',kind:'architecture',required:true,state:'suspended',suspensionReason:'Source-only example awaiting accepted intent.',assertions:['review'],refs:repositories,extensions:{work3:{specification:spec}}};
  const dir = path.join(root, 'example'); fs.mkdirSync(dir);
  const write = () => fs.writeFileSync(path.join(dir, 'node.md'), '---\n' + JSON.stringify(node) + '\n---\n# Source-only example\nReview required; no product acceptance.\n');
  write(); assert.deepEqual(validateWorkspace(root).errors, []);
  spec.sources[0].revision = 'a'.repeat(40); write();
  assert.ok(validateWorkspace(root).errors.some(e => e.code === 'SPECIFICATION_SOURCE_STALE'));
  spec.sources[0].revision = sample().sources[0].revision;
  node.refs = []; write();
  assert.ok(validateWorkspace(root).errors.some(e => e.code === 'SPECIFICATION_SOURCE_UNBOUND'));
  node.refs = repositories; node.state = 'done'; write();
  assert.ok(validateWorkspace(root).errors.some(e => e.code === 'SPECIFICATION_NOT_ACCEPTED'));
  node.state = 'suspended'; node.kind = 'business'; write();
  assert.ok(validateWorkspace(root).errors.some(e => e.code === 'SPECIFICATION_OWNER'));
  const businessSpec = JSON.parse(fs.readFileSync(new URL('../examples/nivo-setup-business.json', import.meta.url), 'utf8'));
  const businessDir = path.join(root, 'business'); fs.mkdirSync(businessDir);
  fs.writeFileSync(path.join(businessDir, 'node.md'), '---\n' + JSON.stringify({schema:'work/node@1',id:'business-example',kind:'business',required:true,state:'todo',refs:repositories,assertions:['review'],extensions:{work3:{specification:businessSpec}}}) + '\n---\n# Business source example\n');
  node.kind = 'architecture'; node.dependsOn = ['business-example']; write();
  assert.deepEqual(validateWorkspace(root).errors, []);
  spec.journeys[0].steps[0].expected = 'An easier outcome'; write();
  assert.ok(validateWorkspace(root).errors.some(e => e.code === 'SPECIFICATION_JOURNEY_DRIFT'));
});

test('FE standalone handoff preserves expected flow and needs actual-format commit and runtime bindings', () => {
  const journeys = [{id:'synthetic',title:'Synthetic test only',actor:'anonymous',entry:'/test',preconditions:[],cleanup:['No resources in synthetic fixture'],steps:[{id:'one',action:'Example',expected:'Original',uxChecks:[]}]}];
  const out = {assets:{reviewedDrawIds:[],items:[]},flows:journeys.map(x => ({...structuredClone(x),sourcePaths:['src/example.tsx']})),codeRefs:[{repository:'fe',commit:'a'.repeat(40)}],runtime:{environment:'test',origin:'http://localhost:3000',build:'synthetic'}};
  assert.equal(validateFEHandoff(out, journeys, 'fe', 'test'), true);
  out.flows[0].steps[0].expected = 'Weakened';
  assert.throws(() => validateFEHandoff(out, journeys, 'fe', 'test'));
  out.flows[0].steps[0].expected = 'Original'; out.codeRefs = [];
  assert.throws(() => validateFEHandoff(out, journeys, 'fe', 'test'));
});

test('basic operator catalog cannot remove implement quality, commits or always-present FE flow delivery', () => {
  const original = JSON.parse(fs.readFileSync(new URL('../ops/catalog.json', import.meta.url), 'utf8'));
  for (const [id, field] of [['interface.implement','qualityPolicy'],['backend.implement','qualityPolicy'],['backend.implement','commitPolicy'],['interface.implement','deliveryPolicy'],['business.decide','specificationPolicy']]) {
    const catalog = structuredClone(original);
    delete catalog.ops.find(x => x.id === id).contract[field];
    assert.equal(validateCatalog(catalog).ok, false);
  }
});

 test('architecture rejects wrong receiving service, untraced routing and incomplete pattern/security decisions', () => {
   for (const mutate of [
     s => s.serviceCalls[0].calleeServiceId = 'svc-chatbot',
     s => s.serviceCalls[0].bindingSourceRefs = [],
     s => s.serviceCalls[0].sequence = 2,
     s => s.patternDecisions = s.patternDecisions.filter(p => p.pattern !== 'Saga'),
     s => { const saga = s.patternDecisions.find(p => p.pattern === 'Saga'); saga.decision = 'adopt'; saga.mechanism = { coordination: 'orchestration' }; },
     s => s.securityReview = s.securityReview.filter(r => r.category !== 'network-and-ssrf'),
     s => s.securityReview[0].threatIds = ['missing-threat']
   ]) { const spec = sample(); mutate(spec); assert.equal(validateSpecification(spec).ok, false); }
 });

test('six-op map is generated from the actual contracts and business journeys feed the frontend input unchanged', async () => {
  const map = JSON.parse(fs.readFileSync(new URL('../ops/basic-ops.json', import.meta.url), 'utf8'));
  assert.equal(map.ops.length, 6);
  assert.deepEqual(map.ops.map(o => o.id), ['business.decide','architecture.decide','interface.draw','interface.implement','backend.implement','uat.verify']);
  assert.deepEqual(map.ops.filter(o => o.secondaryCalls.length).map(o => o.id), ['interface.implement']);
  const spec = sample();
  const { validateInput } = await import('../workflows/frontend.mjs');
  const input = {schema:'starci/frontend-input@1',runId:'synthetic-integration',context:{business:['business'],architecture:['architecture'],knowledge:['knowledge'],repository:'nivo-fe',environment:'synthetic',accounts:[],fixtures:[],authorization:['Synthetic validation only']},journeys:spec.journeys};
  assert.equal(validateInput(input), true);
  const output = {assets:{reviewedDrawIds:[],items:[]},flows:spec.journeys.map(j => ({...structuredClone(j),sourcePaths:['example/source.tsx']})),codeRefs:[{repository:'nivo-fe',commit:'a'.repeat(40)}],runtime:{environment:'synthetic',origin:'http://localhost:3000',build:'synthetic'}};
  assert.equal(validateFEHandoff(output, input.journeys, 'nivo-fe', 'synthetic'), true);
});

test('backend delivery cannot hand off before unit and backend E2E proof', () => {
  const backend = JSON.parse(fs.readFileSync(new URL('../ops/backend.implement/operator.json', import.meta.url), 'utf8'));
  assert.deepEqual(backend.qualityPolicy.checks, ['lint','typecheck','unit','backend-e2e','coverage','build','sonar']);
  assert.equal(backend.qualityPolicy.unitGate, 'scoped-unit-pass-for-tested-revision');
  assert.equal(backend.qualityPolicy.backendE2EGate, 'scoped-backend-e2e-pass-for-tested-revision');
  assert.equal(backend.qualityPolicy.handoffBinding, 'api-contract-runtime-quality-evidence-and-tested-commit');
  const support = JSON.parse(fs.readFileSync(new URL('../ops/interface.implement/secondary.json', import.meta.url), 'utf8')).calls[0];
  for (const field of ['apiContract','runtime','qualityEvidence','testedCommit']) assert.ok(support.outputFields.includes(field));
  for (const criterion of ['backend-unit-pass','backend-e2e-pass']) assert.ok(support.requiredCriteria.includes(criterion));
  for (const mutate of [
    contract => { contract.qualityPolicy.checks = contract.qualityPolicy.checks.filter(x => x !== 'backend-e2e'); },
    contract => { delete contract.qualityPolicy.backendE2EGate; },
    contract => { delete contract.qualityPolicy.handoffBinding; },
  ]) {
    const catalog = JSON.parse(fs.readFileSync(new URL('../ops/catalog.json', import.meta.url), 'utf8'));
    mutate(catalog.ops.find(x => x.id === 'backend.implement').contract);
    assert.equal(validateCatalog(catalog).ok, false);
  }
});
