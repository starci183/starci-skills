import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initialize, advance, inspect, validateMatrix, validateInput, digest, definition, repair, support, resume } from '../workflows/frontend.mjs';
import { build } from '../scripts/build-workflows.mjs';
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clone = x => structuredClone(x);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function fixture(t, execution) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-frontend-workflow-'));
  t.after(() => { assert.equal(path.dirname(parent), os.tmpdir()); assert.ok(path.basename(parent).startsWith('starci-frontend-workflow-')); fs.rmSync(parent, { recursive: true, force: true }); });
  const root = path.join(parent, 'run');
  const input = { schema: 'starci/frontend-input@1', runId: 'synthetic-run',
    context: { business: ['business:test'], architecture: ['architecture:test'], knowledge: ['knowledge:test'], repository: 'repository:test', environment: 'environment:test', accounts: [], fixtures: [], authorization: ['synthetic test only; no real effects'] },
    journeys: [{ id: 'flow-1', title: 'Synthetic flow, not product acceptance', entry: '/example', actor: 'anonymous', preconditions: [], cleanup: ['No real resources in this unit fixture'],
      steps: [{ id: 'submit', action: 'Synthetic action', expected: 'Synthetic expected', uxChecks: [{ id: 'loading', question: 'Was loading observed?', expected: 'yes' }] }] }] };
  if(execution) input.context.execution=execution;
  initialize(input, root);
  const artifacts = ['image', 'video', 'log'].map(kind => {
    const name = `synthetic-${kind}.txt`, bytes = Buffer.from(`Synthetic ${kind} test bytes, NOT product proof`);
    fs.writeFileSync(path.join(root, name), bytes);
    return { id: kind, kind, path: name, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
  return { root, parent, input, artifacts };
}
function request(root) { return read(inspect(root).request); }
function response(req, artifacts, outputs) {
  return { schema: 'starci/response@1', workflow: req.workflow, runId: req.runId, step: req.step, slot: req.slot, op: req.op, requestId: req.requestId, requestDigest: digest(req), status: 'pass',
    criteria: req.criteria.map(id => ({ id, status: 'pass', observation: 'Synthetic gate test, no product claim', evidence: ['log'] })), outputs, artifacts: clone(artifacts) };
}
function draw(x) { return response(request(x.root), x.artifacts, { draws: [{ id: 'draw-1', artifact: 'image', screen: 'example', state: 'default', viewport: { width: 800, height: 600 } }] }); }
function implementation(x) {
  return response(request(x.root), x.artifacts, { assets: {reviewedDrawIds:['draw-1'],items:[]}, flows: x.input.journeys.map(f => ({ ...clone(f), sourcePaths: ['synthetic/example.tsx'] })), codeRefs: [{ repository: 'repository:test', commit: 'a'.repeat(40) }], runtime: { environment: 'environment:test', origin: 'http://localhost:3000', build: 'synthetic-build' } });
}
function uat(x) {
  return response(request(x.root), x.artifacts, { results: x.input.journeys.map(f => ({ flowId: f.id, status: 'pass', evidence: ['image', 'video'],
    steps: f.steps.map(s => ({ id: s.id, status: 'pass', observation: 'Synthetic observed result', evidence: ['video'], checks: s.uxChecks.map(c => ({ id: c.id, answer: c.expected, status: 'pass', evidence: ['video'] })) })) })),
    cleanup: { status: 'pass', remaining: [], evidence: ['log'] } });
}
test('matrix means at most three sequential rows and three parallel cells per row', () => {
  assert.equal(validateMatrix(definition.matrix), true);
  const full = Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, col) => ({ id: `${row}-${col}`, op: 'synthetic.op' })));
  assert.equal(validateMatrix(full), true);
  assert.throws(() => validateMatrix([...full, full[0]]), /3 steps/);
  assert.throws(() => validateMatrix([[...full[0], { id: 'extra', op: 'synthetic.op' }]]), /3 parallel/);
  assert.throws(() => validateMatrix([[full[0][0], full[0][0]]]), /Duplicate/);
});
test('draw outputs become FE inputs; FE flows, code and runtime become UAT inputs without a fourth step', t => {
  const x = fixture(t), d = draw(x); const next = advance(x.root, d);
  assert.equal(next.advanced, true);
  same(request(x.root).inputs.draws, d.outputs.draws);
  same(request(x.root).inputs.drawArtifacts, d.artifacts);
  const impl = implementation(x); advance(x.root, impl);
  same(request(x.root).inputs.flows, impl.outputs.flows);
  same(request(x.root).inputs.codeRefs, impl.outputs.codeRefs);
  same(request(x.root).inputs.assets, impl.outputs.assets);
  assert.equal(request(x.root).inputs.draws, undefined);
  assert.deepEqual(advance(x.root, uat(x)), { done: true, advanced: true });
  assert.deepEqual(inspect(x.root), { done: true });
  assert.throws(() => advance(x.root, d), /already complete/);
});
const same = (a, b) => assert.deepEqual(a, b);
test('bad request correlation, unknown fields, missing criteria and unpassed criteria cannot advance', t => {
  const x = fixture(t);
  for (const mutate of [r => { r.op = 'uat.verify'; }, r => { r.requestDigest = '0'.repeat(64); }, r => { r.extra = true; }, r => { r.criteria.pop(); }, r => { r.criteria[0].status = 'fail'; }]) {
    const res = draw(x); mutate(res); assert.throws(() => advance(x.root, res)); assert.equal(request(x.root).step, 1);
  }
  const blocked = draw(x); blocked.status = 'blocked'; blocked.outputs = null; blocked.artifacts = []; blocked.criteria.forEach(c => { c.status = 'not-run'; c.evidence = []; });
  assert.equal(advance(x.root, blocked).advanced, false);
  assert.equal(fs.existsSync(path.join(x.root, '2-implement.request.json')), false);
});
test('all additional requested criteria are required; input and ready-flow shapes are strict', t => {
  const x = fixture(t), changed = clone(x.input); changed.unrecognized = true;
  assert.throws(() => validateInput(changed));
  const plus = clone(x.input); plus.runId = 'extra'; plus.criteria = { draw: ['customer-criterion'] };
  const root = path.join(x.parent, 'other'); initialize(plus, root);
  assert.ok(request(root).criteria.includes('customer-criterion'));
  advance(x.root, draw(x));
  for (const mutate of [r => { r.outputs.flows[0].steps[0].expected = 'weakened'; }, r => { r.outputs.flows[0].sourcePaths = []; }, r => { r.outputs.runtime.environment = 'other'; }, r => { r.outputs.codeRefs[0].commit = 'short'; }]) {
    const res = implementation(x); mutate(res); assert.throws(() => advance(x.root, res)); assert.equal(request(x.root).step, 2);
  }
});
test('evidence corruption, escape, fake references and stale upstream bytes block transition', t => {
  const x = fixture(t);
  const escaped = draw(x); escaped.artifacts[0].path = '../outside.txt'; assert.throws(() => advance(x.root, escaped), /Unsafe/);
  const missing = draw(x); missing.outputs.draws[0].artifact = 'absent'; assert.throws(() => advance(x.root, missing), /evidence/);
  const corrupted = draw(x); corrupted.artifacts[0].sha256 = '0'.repeat(64); assert.throws(() => advance(x.root, corrupted), /digest/);
  advance(x.root, draw(x));
  fs.appendFileSync(path.join(x.root, x.artifacts[0].path), 'changed');
  assert.throws(() => inspect(x.root), /digest/);
});
test('UAT cannot pass with wrong UX answer, missing flow steps/video or unfinished cleanup', t => {
  const x = fixture(t); advance(x.root, draw(x)); advance(x.root, implementation(x));
  for (const mutate of [r => { r.outputs.results[0].steps[0].checks[0].answer = 'no'; }, r => { r.outputs.results[0].steps = []; }, r => { r.outputs.results[0].evidence = ['image']; }, r => { r.outputs.cleanup.remaining = ['synthetic-resource']; }, r => { r.outputs.cleanup.status = 'fail'; }, r => { r.outputs.results = []; }]) {
    const res = uat(x); mutate(res); assert.throws(() => advance(x.root, res)); assert.equal(inspect(x.root).done, false);
  }
});
test('the gate refuses skipped steps and altered emitted requests', t => {
  const x = fixture(t), p = path.join(x.root, '1-draw.request.json'), req = read(p); req.criteria = ['easy']; fs.writeFileSync(p, JSON.stringify(req));
  assert.throws(() => inspect(x.root), /binding/);
});
test('relocated workflow executes without source checkout or native agent dispatch', t => {
  const x = fixture(t), relocated = path.join(x.parent, 'installed'); fs.mkdirSync(relocated);
  fs.cpSync(path.join(packageRoot, 'workflows'), path.join(relocated, 'workflows'), { recursive: true });
  fs.cpSync(path.join(packageRoot, 'contracts'), path.join(relocated, 'contracts'), { recursive: true });
  fs.cpSync(path.join(packageRoot, 'profiles'), path.join(relocated, 'profiles'), { recursive: true });
  fs.mkdirSync(path.join(relocated,'scripts'));
  fs.copyFileSync(path.join(packageRoot,'scripts/config.mjs'),path.join(relocated,'scripts/config.mjs'));
  fs.copyFileSync(path.join(packageRoot,'config.example.json'),path.join(relocated,'config.example.json'));
  fs.copyFileSync(path.join(packageRoot, 'workflows/frontend.mjs'), path.join(relocated, 'workflows/frontend.mjs'));
  const inputFile = path.join(x.parent, 'input.json'); fs.writeFileSync(inputFile, JSON.stringify(x.input));
  const output = spawnSync(process.execPath, [path.join(relocated, 'workflows/frontend.mjs'), 'init', inputFile, path.join(x.parent, 'relocated-run')], { encoding: 'utf8' });
  assert.equal(output.status, 0, output.stderr); assert.equal(JSON.parse(output.stdout).done, false);
});
test('AI repair reopens the existing FE cell and archives downstream acceptance without weakening criteria', t => {
  const x = fixture(t); advance(x.root, draw(x)); advance(x.root, implementation(x));
  const before = read(path.join(x.root, '2-implement.request.json'));
  const result = repair(x.root, { reason: 'frontend-defect', observation: 'Synthetic UAT mismatch', method: 'Inspect integration and fix the owned API caller' });
  assert.equal(result.step, 2); same(request(x.root), before);
  assert.equal(fs.existsSync(path.join(x.root, '3-uat.request.json')), false);
  assert.ok(fs.existsSync(path.join(x.root, 'attempts/attempt-1/2-implement.response.json')));
  assert.equal(repair(x.root, { reason: 'frontend-defect', observation: 'Synthetic UAT mismatch', method: 'Inspect integration and fix the owned API caller' }).reason, 'no-progress');
  advance(x.root, implementation(x)); assert.equal(request(x.root).step, 3);
});
test('backend defects leave the frontend run untouched and require accepted backend delivery',t=>{const x=fixture(t);advance(x.root,draw(x));advance(x.root,implementation(x));const before=read(path.join(x.root,'2-implement.response.json'));const result=repair(x.root,{reason:'backend-defect',observation:'Synthetic backend contract failure',method:'Run the owning backend workflow'});assert.equal(result.transition,'new-workflow');assert.equal(result.workflow,'implement-backend');assert.match(result.requirement,/unit and backend E2E proof/);same(read(path.join(x.root,'2-implement.response.json')),before);assert.equal(fs.existsSync(path.join(x.root,'attempts')),false);assert.equal(repair(x.root,{reason:'product-defect',observation:'Owner unknown',method:'Classify before mutation'}).reason,'defect-owner-unresolved');});
test('FE waits for a scoped backend support response in the same cell and cannot bypass its gate', t => {
  const x = fixture(t); advance(x.root, draw(x));
  const input = { repository: 'repository:backend', paths: ['src/example.ts'], changeKind: 'api-integration', problem: 'Synthetic integration mismatch', businessRefs: x.input.context.business };
  const pending = support(x.root, input); assert.equal(pending.step, 2); assert.equal(pending.slot, 1); assert.equal(inspect(x.root).waiting, true);
  assert.throws(() => advance(x.root, {}), /waits/);
  const req = read(pending.request);
  const result = { schema: 'starci/support-response@1', supportId: req.supportId, requestDigest: digest(req), status: 'pass', criteria: req.criteria.map(id => ({ id, status: 'pass', observation: 'Synthetic support evidence', evidence: ['log'] })),
    outputs: { codeRefs: [{ repository: input.repository, commit: 'b'.repeat(40) }], changedPaths: input.paths, businessChanged: false, apiCompatible: true }, artifacts: x.artifacts };
  const bad = clone(result); bad.outputs.businessChanged = true; assert.throws(() => resume(x.root, bad));
  const wide = clone(result); wide.outputs.changedPaths = ['src/other.ts']; assert.throws(() => resume(x.root, wide), /scope/);
  assert.equal(resume(x.root, result).waiting, false);
  const impl = implementation(x); assert.throws(() => advance(x.root, impl), /backend support commits/);
  impl.outputs.codeRefs.push(...result.outputs.codeRefs); advance(x.root, impl);
  assert.equal(request(x.root).step, 3); same(request(x.root).inputs.codeRefs, impl.outputs.codeRefs);
});
test('one primary admits three disjoint secondaries, refuses a fourth and waits for all three', t => {
  const x = fixture(t); advance(x.root, draw(x));
  const base = { repository: 'repository:backend', changeKind: 'render-data', problem: 'Synthetic data integration', businessRefs: x.input.context.business };
  const first = support(x.root, { ...base, paths: ['src/one.ts'] });
  assert.throws(() => support(x.root, { ...base, paths: ['src/one.ts'] }), /overlap/);
  const second = support(x.root, { ...base, paths: ['src/two.ts'] });
  const third = support(x.root, { ...base, paths: ['src/three.ts'] });
  assert.throws(() => support(x.root, { ...base, paths: ['src/four.ts'] }), /At most 3/);
  for (const [i, job] of [first, second, third].entries()) {
    const req = read(job.request);
    const response = { schema: 'starci/support-response@1', supportId: req.supportId, requestDigest: digest(req), status: 'pass', criteria: req.criteria.map(id => ({ id, status: 'pass', observation: 'Synthetic secondary proof', evidence: ['log'] })),
      outputs: { codeRefs: [{ repository: base.repository, commit: String(i + 1).repeat(40) }], changedPaths: req.inputs.paths, businessChanged: false, apiCompatible: true }, artifacts: x.artifacts };
    assert.equal(resume(x.root, response).waiting, i < 2);
  }
  assert.equal(request(x.root).step, 2);
});
test('compiled JSON is reproducible and remains valid after relocation', t => {
  assert.equal(build({ check: true }).ok, true);
  const x = fixture(t), destination = path.join(x.parent, '.dist');
  fs.cpSync(path.join(packageRoot, '.dist'), destination, { recursive: true });
  const manifest = read(path.join(destination, 'manifest.json'));
  for (const entry of manifest.files) {
    const bytes = fs.readFileSync(path.join(destination, entry.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    if (entry.path.endsWith('.json')) JSON.parse(bytes.toString('utf8'));
  }
  assert.ok(manifest.files.every(entry=>entry.path.endsWith('.json')));
  const role = read(path.join(destination, 'ops/backend.implement/authority.json'));
  assert.equal(Object.hasOwn(role, 'secondary'), false);
  const caller = read(path.join(destination, 'ops/interface.implement/secondary.json'));
  assert.equal(caller.owner, 'interface.implement');
  assert.equal(caller.maxDefinitions, 3);
  assert.deepEqual(caller.calls.map(c => c.op), ['backend.implement']);
  assert.equal(caller.calls[0].businessChanged, false); assert.equal(caller.calls[0].canCallOthers, false);
});

test('Claude decorative assets stay deferred through FE to UAT; missing functional art and fake ready assets block', t => {
  const x=fixture(t,{runtime:'claude',profile:'opus',imageGenerationAvailable:false});
  advance(x.root,draw(x));
  const impl=implementation(x);
  const asset={id:'hero',drawIds:['draw-1'],usage:'Decorative hero',requiredForFlow:false,status:'deferred',sourcePath:null,artifact:null,provenance:'Repository search found no matching art; Claude image generation unavailable.',brief:{prompt:'Draw the approved hero artwork later',width:1200,height:800,format:'webp',placement:'Hero slot',placeholder:'blank-reserved-slot'}};
  impl.outputs.assets.items=[asset];
  const functional=clone(impl);functional.outputs.assets.items[0].requiredForFlow=true;
  assert.throws(()=>advance(x.root,functional));
  const fake=clone(impl);Object.assign(fake.outputs.assets.items[0],{status:'reused',sourcePath:'public/hero.webp',artifact:'missing-image',brief:null});
  assert.throws(()=>advance(x.root,fake));
  const unreviewed=clone(impl);unreviewed.outputs.assets.reviewedDrawIds=[];
  assert.throws(()=>advance(x.root,unreviewed));
  advance(x.root,impl);
  same(request(x.root).inputs.assets,impl.outputs.assets);
  advance(x.root,uat(x));
});
