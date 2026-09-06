import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { revision, diagnostic } from './source-review-fixture.mjs';
import { createSourceFixture, acceptUnitArchitecture, acceptUnitPlan, completeUnitSource, current, open, planCells, branch, read, put, sha, git } from './unit-successor-fixture.mjs';

const requestOf = (f, cell) => read(path.join(branch(f, Number(cell.split('/')[0])), 'request/request.json'));
const refused = /PLAN_|changed|fingerprint|hash|seal|request|unit|matched|retry|successor/i;

async function sealFixtureForecast(f, forecast, previous = null) {
  const { retainContext } = await f.load('scripts/mission-history.mjs');
  const { scopeHash } = await f.load('scripts/mission-scope.mjs');
  const state = f.state(), planned = Object.fromEntries(Object.entries(forecast.presets).map(([cell, requirements]) => [cell, { requirements }]));
  const address = await retainContext(f.session, 'plans', { version: 1, sessionId: state.id, previous, missionVersion: state.mission.version, scopeHash: scopeHash(state.mission), forecast, planned, retained: { choices: {}, attempts: {}, requestHashes: {}, steps: {}, inventoryCells: [], files: {} } });
  state.planHistory ??= { revisions: [] }; state.planHistory.revisions.push(address); state.planHistory.active = address;
  state.chain = forecast.chain; state.steps = { ...state.steps, ...forecast.steps }; state.planned = { ...state.planned, ...planned };
  put(path.join(f.session, 'state.json'), state);
  return address;
}

test('unit dependency delivery excludes a disputed and retired accepted source, then admits only its genuine source repair', async t => {
  const f = await createSourceFixture(t, { sessionId: 'unit-successor-review', doneWhen: [{ producedBy: 'backend.generate', evidence: 'The two dependent fixture modules implement the frozen worker contract.' }, { producedBy: 'quality.verify', evidence: 'The delivered modules pass their measured gates.' }, { producedBy: 'api.verify', evidence: 'The dependent behavior passes the declared client verification.' }], initialFiles: { 'src/modules/fixture/README.md': 'The stateless worker boundary.\n', 'src/modules/consumer/README.md': 'The consumer depends on the worker.\n' } });
  const architecture = await acceptUnitArchitecture(f, { sourceStep: 5 });
  await acceptUnitPlan(f, architecture);
  planCells(f, [[6, 'runtime.serve'], [7, 'quality.verify'], [8, 'api.verify']]);
  const plans = await f.load('scripts/plan-history.mjs');
  assert.equal(typeof plans.acceptedUnitDependency, 'function');
  const requirements = { featureId: 'fixture', outcome: 'Implement the selected bounded fixture module.', mutableFileRefs: ['src/modules/**'], protectedRefs: [], contractFingerprint: architecture.fingerprint, mode: 'apply', scope: 'full', resume: null };
  const sourceRequest = (cell, unit) => {
    const head = git(f.worktree, 'rev-parse', 'HEAD');
    const request = current(f, { operatorId: 'backend.generate', unit, contexts: [{ alias: '@workspaces/be', head }, { alias: '@knowledge/patterns/be', head: null }], requirements, inputs: { 'architecture-decision': architecture.ref, units: 'step-4/parallel-1/response/data/units.json' } }, Number(cell.split('/')[0]));
    request.environment.writes = ['@workspaces/be/src/modules']; request.environment.exclusive = [path.join(f.worktree, 'src/modules')];
    return request;
  };
  const state = f.state(), forecast = { chain: state.chain, steps: state.steps, goals: {}, presets: {}, nodes: {}, dependencies: {}, evidenceDependencies: {}, reasons: {}, imports: {}, fanout: { '5/1': 'units' }, handoffs: {}, resumes: {} };
  for (const cell of forecast.chain.flat()) {
    const pending = { '6/1': { goal: { prerequisite: '8/1' }, requirements: {} }, '7/1': { goal: { doneWhen: 1 }, requirements: {} }, '8/1': { goal: { doneWhen: 2 }, requirements: {} } };
    const request = pending[cell] ?? (cell === '5/1' ? sourceRequest(cell, 'worker') : requestOf(f, cell));
    forecast.goals[cell] = request.goal; forecast.presets[cell] = request.requirements; forecast.nodes[cell] = `original:${cell}`;
    forecast.dependencies[cell] = ({ '1/1': [], '5/1': ['3/1', '4/1'], '6/1': ['5/1'], '7/1': ['5/1', '6/1'], '8/1': ['6/1', '7/1'] })[cell] ?? ['1/1'];
    forecast.evidenceDependencies[cell] = ({ '5/1': ['3/1', '4/1'], '6/1': ['5/1'], '7/1': ['5/1', '6/1'], '8/1': ['6/1', '7/1'] })[cell] ?? [];
    if (request.resume) forecast.resumes[cell] = `${request.resume.step}/${request.resume.parallel}`;
  }
  await sealFixtureForecast(f, forecast);
  const expand = { edit: { kind: 'expand', cell: '5/1', producer: '4/1' } }, preview = await plans.previewRevision(f.root, f.session, expand);
  let projected = (await plans.commitRevision(f.root, f.session, { flags: expand, previewHash: preview.previewHash, reason: 'Expand the genuinely accepted backend plan into its two dependent modules.' })).forecast;
  assert.deepEqual(projected.units['6/1'].dependsOn, ['5/1']);
  const resolve = cell => plans.acceptedUnitDependency(f.root, f.session, f.state(), cell);
  const writer = architecture.operation.writerRef, spec = writer.replace(/\.mjs$/, '.spec.mjs');
  // Genuine acceptance of the original test suite leaves the missed whitespace case visible.
  const tests = "import test from 'node:test'; import assert from 'node:assert/strict'; import { runFixtureWorker as run } from './worker.mjs'; test('normal, empty, repeated and concurrent values', async () => { assert.equal(run('hello'),'HELLO'); assert.equal(run('hello'),'HELLO'); assert.equal(run(''),''); assert.deepEqual(await Promise.all(['a','b'].map(async value => run(value))),['A','B']); }); test('invalid inputs preserve exception identity and input', () => { const value=Object.freeze({input:'x'}); for(const input of [undefined,null,4,value]) assert.throws(()=>run(input),TypeError); assert.deepEqual(value,{input:'x'}); });\n";
  const source = trim => `export function runFixtureWorker(input) { if(typeof input !== 'string') throw new TypeError('input must be a string'); return input${trim ? '.trim()' : ''}.toUpperCase(); }\n`;
  const original = await completeUnitSource(f, architecture, sourceRequest('5/1', 'worker'), { [writer]: source(true), [spec]: tests });
  const preserved = { attempt: structuredClone(f.state().attempts['5/1']), request: readFileSync(path.join(branch(f, 5), 'request/request.json')), response: readFileSync(path.join(branch(f, 5), 'response/response.json')), units: readFileSync(path.join(branch(f, 4), 'response/data/units.json')) };
  const imports = await f.load('scripts/producer-import.mjs'), reviewApi = await f.load('scripts/source-review.mjs');
  const historical = () => imports.acceptedProducerProof(f.root, f.sessionId, 5, 1, 'backend-source-application', { hostRoot: f.source });
  assert.equal(await resolve('5/1'), '5/1');
  assert.equal((await historical()).manifestFingerprint, preserved.attempt.evidenceManifest.fingerprint);
  const deliveryQualityCell = Object.keys(projected.steps).find(cell => projected.steps[cell] === 'quality.verify');
  const deliveryQuality = current(f, { operatorId: 'quality.verify', contexts: [{ alias: '@workspaces/be', head: original.head }], requirements: projected.presets[deliveryQualityCell], inputs: { 'backend-source-application': original.ref } }, Number(deliveryQualityCell.split('/')[0]), { goal: projected.goals[deliveryQualityCell], mode: 'inline' });
  assert.match((await plans.planAdmissionErrors(f.root, f.session, f.state(), deliveryQuality)).join('\n'), /GOAL_PARTITION_PENDING/, 'ordinary delivery quality still requires the complete worker and consumer obligation');

  const method = `import assert from 'node:assert/strict'; import {runFixtureWorker} from ${JSON.stringify(pathToFileURL(path.join(f.worktree, writer)).href)}; assert.equal(runFixtureWorker(' hello '),' HELLO ','uppercase must preserve surrounding input characters'); console.log('Actual declared worker preserves whitespace');\n`;
  const binding = { ref: 'request/source-contract.mjs', sha256: sha(method) };
  const edit = { kind: 'review', cell: '5/1', criterionId: 'delivery', method: binding, gates: [{ gate: 'integration', required: true, commandRef: 'node request/source-contract.mjs', configRef: 'request/source-contract.mjs' }] };
  projected = await revision(f, edit);
  const reviewCell = Object.keys(projected.sourceReviews)[0];
  let consumerCell = Object.keys(projected.units).find(cell => projected.units[cell].id === 'consumer');
  await assert.rejects(resolve('5/1'), /SOURCE_REVIEW_PENDING/, 'pending review withholds current unit credit from the matched source');
  assert.match((await plans.planAdmissionErrors(f.root, f.session, f.state(), sourceRequest(consumerCell, 'consumer'))).join('\n'), /SOURCE_REVIEW_PENDING/, 'the actual unit dependency consumer waits on the same current-delivery guard');
  assert.equal((await historical()).manifestFingerprint, preserved.attempt.evidenceManifest.fingerprint, 'review does not revoke historical accepted producer proof');
  const { partitionAdmissionErrors } = await f.load('scripts/goal-partitions.mjs');
  const diagnosticRequest = current(f, { operatorId: 'quality.verify', contexts: [{ alias: '@workspaces/be', head: original.head }], requirements: projected.presets[reviewCell], inputs: { 'backend-source-application': original.ref } }, Number(reviewCell.split('/')[0]), { goal: projected.goals[reviewCell], mode: 'inline' });
  diagnosticRequest.frozenInputs = [binding];
  for (const mutate of [
    request => { request.inputs['backend-source-application'] = 'step-4/parallel-1/response/response.md'; },
    request => { request.frozenInputs = []; },
    request => { request.environment.writes = ['@workspaces/be/src/modules']; }
  ]) {
    const malformed = structuredClone(diagnosticRequest); mutate(malformed);
    assert.match((await partitionAdmissionErrors(f.root, f.session, f.state(), malformed, projected)).join('\n'), /SOURCE_REVIEW_UNBOUND/, 'a review marker cannot bypass the exact readonly source, method and effect gates');
  }

  const review = await diagnostic(f, original, projected, reviewCell, method);
  const coverage = await reviewApi.sourceReviewCoverage(f.root, f.session, f.state(), projected);
  assert.deepEqual(coverage.errors, []); assert.deepEqual(coverage.retiredSources, ['5/1']);
  assert.equal(f.state().attempts[reviewCell].status, 'matched', 'the genuinely red diagnostic is an accepted quality observation');
  const gate = read(path.join(review.dir, 'response/data/gates/integration.json'));
  assert.equal(gate.exitCode, 1); assert.equal(gate.status, 'fail'); assert.equal(gate.classification, 'in-boundary');
  await assert.rejects(resolve('5/1'), /SOURCE_REVIEW_PENDING/, 'retired source remains unavailable as unit credit');
  assert.equal((await historical()).manifestFingerprint, preserved.attempt.evidenceManifest.fingerprint);

  projected = await revision(f, { kind: 'source-repair', cell: '5/1', review: reviewCell, gateRef: 'response/data/gates/integration.json' });
  const repairCell = Object.keys(projected.sourceRepairs)[0], repairStep = Number(repairCell.split('/')[0]);
  consumerCell = Object.keys(projected.units).find(cell => projected.units[cell].id === 'consumer');
  assert.deepEqual(projected.units[consumerCell].dependsOn, [repairCell], 'typed source repair redirects the unopened unit consumer');
  await assert.rejects(resolve(repairCell), refused, 'a planned source repair cannot supply accepted unit credit');
  const repairedRequest = structuredClone(original.request);
  repairedRequest.step = repairStep; repairedRequest.attempt = { id: `${repairCell}:a2`, number: 2, kind: 'repair', previous: original.request.attempt.id };
  repairedRequest.environment.isolationId = repairedRequest.attempt.id; repairedRequest.environment.workspace.revision = original.head; repairedRequest.contexts[0].head = original.head;
  repairedRequest.frozenInputs = [binding]; put(path.join(branch(f, repairStep), binding.ref), method);
  const repaired = await completeUnitSource(f, architecture, repairedRequest, { [writer]: source(false), [spec]: tests + "test('whitespace remains part of the declared string value', () => { assert.equal(run(' hello '),' HELLO '); assert.equal(run('  a b  '),'  A B  '); });\n" });
  assert.notEqual(repaired.head, original.head); assert.equal(git(f.worktree, 'rev-parse', `${repaired.head}^`), original.head);
  const rerun = spawnSync(process.execPath, [path.join(review.dir, binding.ref)], { cwd: f.worktree, encoding: 'utf8', windowsHide: true });
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.equal(await resolve(repairCell), repairCell, 'only the exact accepted repair supplies current unit credit');
  await assert.rejects(resolve('5/1'), /SOURCE_REVIEW_PENDING/, 'successful repair never revives the retired original source coordinate');
  const consumer = sourceRequest(consumerCell, 'consumer');
  assert.deepEqual(await plans.planAdmissionErrors(f.root, f.session, f.state(), consumer), []);
  await open(f, consumer);
  assert.equal(f.state().attempts[consumerCell].status, 'running');
  assert.equal((await historical()).manifestFingerprint, preserved.attempt.evidenceManifest.fingerprint);
  assert.deepEqual(f.state().attempts['5/1'], preserved.attempt);
  assert.deepEqual(readFileSync(path.join(branch(f, 5), 'request/request.json')), preserved.request);
  assert.deepEqual(readFileSync(path.join(branch(f, 5), 'response/response.json')), preserved.response);
  assert.deepEqual(readFileSync(path.join(branch(f, 4), 'response/data/units.json')), preserved.units);
  assert.deepEqual(plans.planHistoryErrors(f.session, f.state()), []);
});
