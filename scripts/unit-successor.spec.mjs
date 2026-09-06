import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createSourceFixture, acceptUnitArchitecture, acceptUnitPlan, completeUnitSource, current, open, planCells, branch, read, put, sha, git } from './unit-successor-fixture.mjs';

const key = request => `${request.step}/${request.parallel}`;
const requestOf = (f, cell) => read(path.join(branch(f, Number(cell.split('/')[0])), 'request/request.json'));
const refused = /PLAN_|GOAL_PARTITION_UNBOUND|changed|fingerprint|hash|seal|request|unit|matched|retry|successor/i;

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

test('accepted module dependencies follow two sealed failed source invocations to the exact matched retry without rewriting historical proof', async t => {
  const f = await createSourceFixture(t, { sessionId: 'unit-successors', doneWhen: [{ producedBy: 'backend.generate', evidence: 'The two dependent fixture modules implement the frozen worker contract.' }, { producedBy: 'quality.verify', evidence: 'The delivered modules pass their measured gates.' }, { producedBy: 'api.verify', evidence: 'The dependent behavior passes the declared client verification.' }], initialFiles: { 'src/modules/fixture/README.md': 'The stateless worker boundary.\n', 'src/modules/consumer/README.md': 'The consumer depends on the worker.\n' } });
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
    forecast.evidenceDependencies[cell] = cell === '5/1' ? ['3/1', '4/1'] : [];
    if (request.resume) forecast.resumes[cell] = `${request.resume.step}/${request.resume.parallel}`;
  }
  await sealFixtureForecast(f, forecast);
  const expand = { edit: { kind: 'expand', cell: '5/1', producer: '4/1' } }, preview = await plans.previewRevision(f.root, f.session, expand);
  let projected = (await plans.commitRevision(f.root, f.session, { flags: expand, previewHash: preview.previewHash, reason: 'Expand the genuinely accepted backend plan into its two dependent modules.' })).forecast;
  assert.deepEqual(projected.units['6/1'].dependsOn, ['5/1']);
  const resolve = cell => plans.acceptedUnitDependency(f.root, f.session, f.state(), cell);
  await assert.rejects(resolve('5/1'), refused, 'unopened source cannot satisfy its module dependency');

  const writer = architecture.operation.writerRef, spec = writer.replace(/\.mjs$/, '.spec.mjs');
  const tests = "import test from 'node:test'; import assert from 'node:assert/strict'; import { runFixtureWorker as run } from './worker.mjs'; test('deterministic, repeated and concurrent values preserve spacing', async () => { assert.equal(run('hello'),'HELLO'); assert.equal(run(' hello '),' HELLO '); assert.equal(run(' hello '),' HELLO '); assert.deepEqual(await Promise.all(['a','b'].map(async value => run(value))),['A','B']); }); test('invalid inputs are rejected without mutation', () => { const value=Object.freeze({input:'x'}); for(const input of [undefined,null,4,value]) assert.throws(()=>run(input),TypeError); assert.deepEqual(value,{input:'x'}); });\n";
  const implementations = ["return input.trim().toUpperCase();", "return input.trimEnd().toUpperCase();", "return input.toUpperCase();"];
  let request = sourceRequest('5/1', 'worker');
  const originals = new Map();
  const remember = cell => originals.set(cell, { attempt: structuredClone(f.state().attempts[cell]), request: readFileSync(path.join(branch(f, Number(cell.split('/')[0])), 'request/request.json')), response: readFileSync(path.join(branch(f, Number(cell.split('/')[0])), 'response/response.json')) });
  for (let index = 0; index < 3; index++) {
    const method = ['Run actual Node regressions for deterministic uppercase values, all leading and trailing spacing, concurrency, and invalid-input identity.', 'Retain every earlier regression and add repeated Unicode case expansion while correcting the first whitespace failure.', 'Retain every earlier regression and add the mixed repeated-space case while correcting the remaining trailing-space failure.'][index];
    request.frozenInputs = [{ ref: 'request/artifacts/method.md', sha256: sha(method) }];
    put(path.join(branch(f, request.step), 'request/artifacts/method.md'), method);
    const additionalTests = (index >= 1 ? "test('Unicode case expansion is deterministic', () => { assert.equal(run('straße'),'STRASSE'); assert.equal(run('straße'),'STRASSE'); });\n" : '') + (index >= 2 ? "test('mixed repeated spaces retain their exact positions', () => { assert.equal(run('  a b  '),'  A B  '); });\n" : '');
    await completeUnitSource(f, architecture, request, { [writer]: `export function runFixtureWorker(input) { if (typeof input !== 'string') throw new TypeError('input must be a string'); ${implementations[index]} }\n`, [spec]: tests + additionalTests }, { blocked: index < 2 });
    remember(key(request));
    if (index === 2) break;
    await assert.rejects(resolve('5/1'), refused, 'a terminal blocked invocation never provides source credit');
    const flags = { edit: { kind: 'retry', cell: key(request), correction: 'source-proof-review', revision: git(f.worktree, 'rev-parse', 'HEAD'), criterionId: 'delivery', methodRef: 'request/artifacts/method.md' } };
    const before = await plans.previewRevision(f.root, f.session, flags);
    projected = (await plans.commitRevision(f.root, f.session, { flags, previewHash: before.previewHash, reason: 'Preserve the real red source commit and run a corrected method on the same logical module.' })).forecast;
    const retryCell = Object.keys(projected.retries).find(cell => projected.retries[cell].source === key(request));
    const consumerCell = Object.keys(projected.units).find(cell => projected.units[cell].id === 'consumer');
    assert.deepEqual(projected.units[consumerCell].dependsOn, [retryCell], 'future public retry rewires the unopened unit edge');
    await assert.rejects(resolve('5/1'), refused, 'an unopened planned retry is not accepted evidence');
    // Reproduce the previous runtime's sealed mapping before the next source invocation opens.
    // Only the unopened consumer unit edge is stale; the public retry binding remains exact.
    projected.units[consumerCell].dependsOn = ['5/1'];
    await sealFixtureForecast(f, projected, f.state().planHistory.active);
    const next = structuredClone(request); next.step = Number(retryCell.split('/')[0]); next.attempt = { id: `${retryCell}:a${index + 2}`, number: index + 2, kind: 'retry', previous: request.attempt.id }; next.environment.isolationId = next.attempt.id;
    next.environment.workspace.revision = git(f.worktree, 'rev-parse', 'HEAD'); next.contexts[0].head = next.environment.workspace.revision;
    request = next;
  }
  const terminal = key(request), consumerCell = Object.keys(projected.units).find(cell => projected.units[cell].id === 'consumer');
  const intermediate = [...originals.keys()][1];
  assert.equal(await resolve('5/1'), terminal);
  assert.equal(await resolve(intermediate), terminal);
  assert.equal(await resolve(terminal), terminal);
  assert.deepEqual(projected.units[consumerCell].dependsOn, ['5/1'], 'existing stale forecast stays immutable during resolution');
  const consumer = sourceRequest(consumerCell, 'consumer');
  assert.deepEqual(await plans.planAdmissionErrors(f.root, f.session, f.state(), consumer), []);
  await open(f, consumer);
  assert.equal(f.state().attempts[consumerCell].status, 'running', 'consumer opens only after the exact successor is accepted');
  assert.deepEqual(plans.planHistoryErrors(f.session, f.state()), []);
  for (const [cell, original] of originals) {
    assert.deepEqual(f.state().attempts[cell], original.attempt);
    assert.deepEqual(readFileSync(path.join(branch(f, Number(cell.split('/')[0])), 'request/request.json')), original.request);
    assert.deepEqual(readFileSync(path.join(branch(f, Number(cell.split('/')[0])), 'response/response.json')), original.response);
  }
  for (const [cell, relative, mutate] of [
    [terminal, 'response/response.json', value => { value.comparison.criteria[0].note += ' altered'; }],
    [intermediate, 'request/request.json', value => { value.unit = 'consumer'; }],
    [intermediate, 'request/request.json', value => { value.inputs.units = 'step-3/parallel-1/response/data/units.json'; }],
    [intermediate, 'request/request.json', value => { value.operatorId = 'interface.generate'; }]
  ]) {
    const file = path.join(branch(f, Number(cell.split('/')[0])), relative), bytes = readFileSync(file), value = JSON.parse(bytes); mutate(value);
    try { put(file, value); await assert.rejects(resolve('5/1'), refused); } finally { writeFileSync(file, bytes); }
  }
  assert.equal(await resolve('5/1'), terminal, 'restored exact seals restore only the genuine successor credit');
  const stateFile = path.join(f.session, 'state.json'), savedState = readFileSync(stateFile);
  const { readContext } = await f.load('scripts/mission-history.mjs');
  const activeForecast = readContext(f.session, f.state().planHistory.active, 'plans').forecast;
  for (const mutate of [
    value => { value.retries['5/1'] = { ...value.retries[terminal], source: terminal }; },
    value => { value.chain.push(['99/1']); value.steps['99/1'] = value.steps[intermediate]; value.goals['99/1'] = value.goals[intermediate]; value.presets['99/1'] = value.presets[intermediate]; value.nodes['99/1'] = 'duplicate-successor'; value.units['99/1'] = value.units[intermediate]; value.retries['99/1'] = { ...value.retries[intermediate] }; },
    value => { value.chain.push(['99/1']); value.steps['99/1'] = value.steps[terminal]; value.goals['99/1'] = value.goals[terminal]; value.presets['99/1'] = value.presets[terminal]; value.nodes['99/1'] = 'unopened-latest-successor'; value.units['99/1'] = value.units[terminal]; value.retries['99/1'] = { ...value.retries[terminal], source: terminal }; },
    value => { value.units[terminal].id = 'consumer'; },
    value => { value.units[terminal].input = 'step-3/parallel-1/response/data/units.json'; },
    value => { value.steps[terminal] = 'interface.generate'; }
  ]) {
    const malformed = structuredClone(activeForecast); mutate(malformed);
    try {
      await sealFixtureForecast(f, malformed, f.state().planHistory.active);
      await assert.rejects(resolve('5/1'), refused, 'a content-addressed but structurally false retry graph cannot provide unit credit');
      await assert.rejects(resolve(terminal), refused, 'starting at the terminal cannot bypass its incoming authority');
    } finally { writeFileSync(stateFile, savedState); }
  }
  assert.equal(await resolve('5/1'), terminal);
});
