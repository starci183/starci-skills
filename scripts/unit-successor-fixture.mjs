// Actual accepted backend module lineage fixture; no matched status is assigned by this helper.
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createSourceFixture, current, actual, open, accept, planCells, branch, read, put, sha, table, git, commit } from './workflow-source-fixture.mjs';
export { createSourceFixture, current, actual, open, accept, planCells, branch, read, put, sha, table, git };
const ref = step => `step-${step}/parallel-1`;
const stateOf = f => f.state();
const moduleAt = (f, name) => f.load(name);

export async function acceptUnitArchitecture(f, { startStep = 1, sourceStep = startStep + 3, writerRef = 'src/modules/fixture/worker.mjs', operationId = 'fixture-worker', coordination = null, goal = { prerequisite: `${sourceStep}/1` } } = {}) {
  const bindStep = startStep, readingStep = startStep + 1, architectureStep = startStep + 2;
  planCells(f, [[bindStep, 'workspace.bind'], [readingStep, 'architecture.decide'], [architectureStep, 'architecture.decide'], [sourceStep, 'backend.generate']]);
  const state = stateOf(f), head = git(f.worktree, 'rev-parse', 'HEAD'), project = state.project, disk = f.worktree.replaceAll('\\', '/'), sessionBranch = git(f.worktree, 'branch', '--show-current');
  const gitPolicy = { mutationBranch: sessionBranch, worktreeBranches: 'session-only' };
  const routeFile = path.join(f.source ?? path.dirname(f.root), state.mission.discovery.repositories[0].routeRef);
  const declaredRoute = read(routeFile); declaredRoute.gitPolicy = gitPolicy; put(routeFile, declaredRoute);
  put(path.join(f.source ?? path.dirname(f.root), `.workspaces/projects/${project}/be.json`), { project, role: 'be', repository: { gitRepository: git(f.worktree, 'remote', 'get-url', 'origin') }, gitPolicy });
  const route = { project, role: 'be', portableRouteRef: `.workspaces/projects/${project}/be.json`, hydratedRouteRef: state.mission.discovery.repositories[0].routeRef,
    routeFingerprint: sha(readFileSync(routeFile)), identityFingerprint: sha('fixture has no credentials'), sourceHead: head,
    checkout: { diskPath: disk, gitRoot: disk, gitRepository: git(f.worktree, 'remote', 'get-url', 'origin'), branch: sessionBranch, repositoryKind: 'source', directory: null, sourceHead: head }, gitPolicy,
    mutationReadiness: 'ready', writeRoots: [], authorityRoots: { businesses: null }, runtime: null, provenanceHeadRef: null };
  const binding = current(f, { operatorId: 'workspace.bind', contexts: [{ alias: `@workspaces/projects/${project}/be`, head: null }, { alias: `@workspaces/local/routes/${project}/be`, head }, { alias: '@workspaces/device-state', head: null }], requirements: { project, role: 'be', gitPolicy, declaredWriteRoots: [], resume: null }, inputs: {} }, bindStep, { goal: { prerequisite: `${readingStep}/1` }, workspace: false, mode: 'inline', coordination });
  await open(f, binding);
  put(path.join(branch(f, bindStep), 'response/data/route.json'), route);
  put(path.join(branch(f, bindStep), 'response/response.md'), `# workspace-route-binding — ${project}/be\n` + table('Binding', ['Field', 'Value'], [['Project', project], ['Role', 'be'], ['Portable route', route.portableRouteRef], ['Hydrated route', route.hydratedRouteRef], ['Source head', head]]) + table('Checkout', ['Field', 'Value'], [['Disk path', disk], ['Git root', disk], ['Git repository', route.checkout.gitRepository], ['Branch', sessionBranch], ['Repository kind', 'source'], ['Directory', '—'], ['Source head', head], ['Mutation readiness', 'ready'], ['Businesses root', '—'], ['Installed tree', 'absent']]) + table('Policy', ['Field', 'Value'], [['Worktree branches', gitPolicy.worktreeBranches], ['Mutation branch', sessionBranch]]) + table('Write roots', ['Path', 'Why']) + table('Runtime', ['Field', 'Value']) + table('Findings', ['Code', 'Subject', 'Statement'], [['`ROUTE_HYDRATED_FROM_PORTABLE`', route.hydratedRouteRef, 'The declared fixture route names this actual checkout.'], ['`IDENTITY_ROSTER_SEALED`', 'fixture has no credentials', 'No secrets exist or were read.'], ['`WORKTREE_BRANCH_SESSION_ONLY`', sessionBranch, 'Source mutation is confined to this actual session branch.']]));
  await accept(f, binding, actual(binding, { fields: { 'workspace-route-binding': 'response/response.md', route: 'response/data/route.json' }, fallbacks: [], commits: [], next: ['architecture.decide'] }, 'done', ['response/response.md'], 'sol-fresh'));
  const { baseline, confirmed } = await moduleAt(f, 'operators/architecture-decide/self-test.mjs');
  const [template] = confirmed(baseline());
  const objective = 'one deterministic stateless fixture worker', decision = 'fixture-worker-contract';
  const reading = template['response/restatement.md'].replaceAll('one entitlement read path', objective).replaceAll('entitlement-read-path', decision);
  const plain = { operatorId: 'architecture.decide', contexts: [{ alias: '@workspaces/be', head }, { alias: '@worktrees/businesses/fixture', head: null }], requirements: { objective, decisionId: decision, alternatives: 1, tradeoffAxes: ['cost', 'complexity', 'reversibility'], constraints: [{ id: 'deterministic', kind: 'fixed-intent', statement: 'The worker has no side effects.' }, { id: 'invalid-input', kind: 'measurable', statement: 'Invalid inputs throw a TypeError.' }], selectionPolicy: 'automatic', approval: null, resume: null }, inputs: {} };
  const first = current(f, plain, readingStep, { goal, workspace: false, coordination }); await open(f, first);
  const { restatementDecisionId, recordRestatementChoice } = await moduleAt(f, 'scripts/restatement-choice.mjs');
  const decisionId = restatementDecisionId(first, decision, reading); put(path.join(branch(f, readingStep), 'response/restatement.md'), reading);
  await accept(f, first, actual(first, { stop: 'RESTATEMENT_UNCONFIRMED', fields: { restatement: 'response/restatement.md' }, fallbacks: [], commits: [], next: [], interaction: { kind: 'restatement-confirm', decisionId, options: [{ id: 'as-stated', label: 'As stated', tradeoff: 'Use this bounded worker contract' }, { id: 'corrected', label: 'Corrected', tradeoff: 'Correct the worker contract' }] } }, 'blocked', ['response/restatement.md']));
  await recordRestatementChoice(branch(f, readingStep), { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:fixture-worker-reading' });
  const request = current(f, plain, architectureStep, { goal, workspace: false, number: 2, previous: first.attempt.id, resume: { step: readingStep, parallel: 1, token: decisionId }, coordination });
  request.decisionId = decisionId; request.selectedOption = 'as-stated'; request.requirements.resume = decisionId;
  const resumed = stateOf(f); resumed.resumes ??= {}; resumed.resumes[`${architectureStep}/1`] = { resumes: `${readingStep}/1`, stop: 'RESTATEMENT_UNCONFIRMED' }; put(path.join(f.session, 'state.json'), resumed);
  const dir = await open(f, request), observed = { observedHead: head, fingerprint: sha(readFileSync(path.join(f.worktree, 'package.json'))), components: [{ componentId: 'node', layer: 'runtime', name: 'Node.js', version: process.version, evidence: `package.json@${head}` }], boundaries: [{ boundaryId: 'fixture', responsibility: 'Stateless fixture transformation', stores: [], evidence: `README.md@${head}` }] };
  const operation = { operationId, name: 'runFixtureWorker', transport: 'worker', writerRef, storeRefs: [], transactionBoundary: 'read-only', idempotencyKind: 'none', migrationRefs: [], authorityDimensionIds: ['deterministic-value'] };
  const model = { decisionId: decision, selectedAlternativeId: 'stateless-worker', alternatives: [{ alternativeId: 'stateless-worker', status: 'selected', scores: { cost: 5, complexity: 5, reversibility: 5 }, rejectedBecause: null }], boundaries: [{ boundaryId: 'fixture', responsibility: 'Stateless fixture transformation', owner: 'fixture-owner', interfaces: ['runFixtureWorker'], ownsData: false }], stores: [], operations: [operation, { ...operation, operationId: 'fixture-consumer', name: 'consumeFixtureWorker', writerRef: 'src/modules/consumer/worker.mjs' }], components: [{ componentId: 'node', status: 'existing', justification: 'observed-evidence', evidence: `package.json@${head}`, compatibility: ['runtime-version', 'deployable-unit', 'communication-failure', 'datastore-ownership', 'backup-restore'].map(axis => ({ axis, verified: true, evidence: `README.md@${head}` })) }] };
  put(path.join(dir, 'response/restatement.md'), reading); put(path.join(dir, 'response/data/current-state.json'), observed); put(path.join(dir, 'response/data/stack-model.json'), model);
  await accept(f, request, actual(request, { fields: { restatement: 'response/restatement.md', 'current-state': 'response/data/current-state.json', 'stack-model': 'response/data/stack-model.json' }, awaiting: { exchange: 'critique', kind: 'independent-critique' }, fallbacks: [], commits: [], next: [] }, 'waiting', ['response/data/stack-model.json']));
  const critiqueRequest = current(f, { operatorId: 'architecture.decide', contexts: [], requirements: {}, inputs: { 'stack-model': `${ref(architectureStep)}/response/data/stack-model.json` } }, architectureStep, { exchange: 'critique', workspace: false });
  const critiqueDir = path.join(dir, 'critique'); await open(f, critiqueRequest, critiqueDir);
  // A separate process receives only the model and checks every stated stateless adverse path.
  const reviewProgram = "import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; const model=JSON.parse(readFileSync(process.argv[1])); assert.equal(model.operations.length,2); assert.equal(new Set(model.operations.map(op=>op.writerRef)).size,2); for (const op of model.operations) { assert.equal(op.transport,'worker'); assert.equal(op.transactionBoundary,'read-only'); assert.equal(op.idempotencyKind,'none'); assert.deepEqual(op.storeRefs,[]); assert.deepEqual(op.migrationRefs,[]); } assert.deepEqual(model.stores,[]); assert.equal(model.boundaries[0].ownsData,false); process.stdout.write(JSON.stringify({pid:process.pid,paths:['partial-failure','retry-idempotency','concurrency','stale-state','deletion','recovery','dependency-outage','rollback']}));";
  const review = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', reviewProgram, path.join(dir, 'response/data/stack-model.json')], { encoding: 'utf8', windowsHide: true }));
  put(path.join(critiqueDir, 'response/critique.md'), `# independent-critique — ${decision}\n` + table('Execution', ['Field', 'Value'], [['Reviewer execution', `process://${review.pid}`], ['Inherited turns', 'none'], ['Given', 'response/data/stack-model.json']]) + table('Attacks', ['Adverse path', 'Attack', 'Resolution', 'Verdict'], review.paths.map(adverse => [adverse, `Can ${adverse} leave a partial persisted effect?`, 'The separately inspected contract has one read-only worker, no stores, migration or persistent effects.', 'holds'])) + table('Verdict', ['Field', 'Value'], [['Selection', 'keep']]));
  await accept(f, critiqueRequest, actual(critiqueRequest, { fields: { 'independent-critique': 'response/critique.md' }, fallbacks: [], commits: [], next: [] }, 'done', ['response/critique.md']), critiqueDir);
  const { acquireWorkerSlot } = await moduleAt(f, 'scripts/worker-slots.mjs');
  await acquireWorkerSlot(dir, 'fixture-architecture-author', { resume: true, ranProfile: 'sol-reviewer' });
  const md = `# architecture-decision — ${decision}\n` + table('Decision', ['Field', 'Value'], [['Objective', objective], ['Decision id', decision], ['Selected alternative', 'stateless-worker'], ['Selection policy', 'automatic']]) + table('Current state', ['Boundary', 'Responsibility', 'Stores', 'Evidence'], [['`fixture`', 'Stateless fixture transformation', '—', `README.md@${head}`]]) + table('Alternatives', ['Alternative', 'Status', 'Assessment', 'Rejected because'], [['`stateless-worker`', 'selected', 'cost 5; complexity 5; reversibility 5', '—']]) + table('Boundaries', ['Boundary', 'Responsibility', 'Owner', 'Interfaces', 'Owns data'], [['`fixture`', 'Stateless fixture transformation', 'fixture-owner', 'runFixtureWorker', 'no']]) + table('Data ownership', ['Store', 'Owning boundary', 'Writers', 'Readers', 'Migrators', 'Transaction scope', 'Backup', 'Restore']) + table('Stack delta', ['Component', 'Status', 'Justification', 'Evidence', 'Compatibility'], [['`node`', 'existing', 'observed-evidence', `package.json@${head}`, '5/5 verified']]) + table('Operations', ['Operation', 'Transport', 'Writer', 'Stores', 'Transaction', 'Idempotency', 'Dimensions'], model.operations.map(op => [op.operationId, op.transport, op.writerRef, '—', op.transactionBoundary, op.idempotencyKind, 'deterministic-value'])) + table('Handoff', ['Item', 'Kind', 'Detail'], [['determinism', 'invariant', 'Repeated valid input produces the same value without mutating the input.'], ['worker', 'contract', 'A string input yields its uppercase value; a non-string throws TypeError.'], ['source', 'migration', 'No persisted data exists or changes.'], ['revert', 'rollback', 'Remove the worker source commit; no data restore is needed.'], ['tests', 'proof', 'Run Node tests for valid, repeated, concurrent, missing and invalid inputs.']]) + table('Fallbacks taken', ['Code', 'Action']);
  put(path.join(dir, 'response/response.md'), md);
  await accept(f, request, actual(request, { fields: { restatement: 'response/restatement.md', 'architecture-decision': 'response/response.md', 'current-state': 'response/data/current-state.json', 'stack-model': 'response/data/stack-model.json' }, fallbacks: [], commits: [], next: ['backend.generate'] }, 'done', ['response/response.md']));
  return { step: architectureStep, sourceStep, ref: `${ref(architectureStep)}/response/response.md`, model, operation, fingerprint: sha(readFileSync(path.join(dir, 'response/data/stack-model.json'))) };
}

function reflogMark(f) {
  const count = args => { try { return git(f.worktree, 'reflog', 'show', '--format=%H', ...args).split('\n').filter(Boolean).length; } catch { return 0; } };
  return `HEAD ${count(['HEAD'])} ${git(f.worktree, 'rev-parse', 'HEAD')}; stash ${count(['refs/stash'])}`;
}

export async function completeUnitSource(f, architecture, request, files, { blocked = false } = {}) {
  const step = request.step, testRef = architecture.operation.writerRef.replace(/\.mjs$/, '.spec.mjs'), testArgs = ['--test', testRef];
  const writer = architecture.operation.writerRef, directory = path.posix.dirname(writer), fileName = path.posix.basename(writer);
  files ??= {
    [writer]: "export function runFixtureWorker(input) { if (typeof input !== 'string') throw new TypeError('input must be a string'); return input.toUpperCase(); }\n",
    [testRef]: ["import test from 'node:test';", "import assert from 'node:assert/strict';", `import { runFixtureWorker } from './${fileName}';`,
      "test('valid, repeated and empty input are deterministic', () => { assert.equal(runFixtureWorker('hello'), 'HELLO'); assert.equal(runFixtureWorker('hello'), 'HELLO'); assert.equal(runFixtureWorker(''), ''); });",
      "test('invalid and missing input are refused without mutation', () => { for (const input of [undefined, null, 4, {}, []]) assert.throws(() => runFixtureWorker(input), TypeError); const value = Object.freeze({ value: 'x' }); assert.throws(() => runFixtureWorker(value), TypeError); assert.deepEqual(value, { value: 'x' }); });",
      "test('concurrent invocations share no mutable state', async () => { const results = await Promise.all(['a', 'b', 'a'].map(value => Promise.resolve().then(() => runFixtureWorker(value)))); assert.deepEqual(results, ['A', 'B', 'A']); });", ''].join('\n')
  };
  assert.ok(Object.hasOwn(files, writer), 'the declared architecture writer is part of the source write set');
  const base = git(f.worktree, 'rev-parse', 'HEAD'), sessionBranch = git(f.worktree, 'branch', '--show-current');
  const dir = await open(f, request);

  const { acquireWorkerSlot } = await moduleAt(f, 'scripts/worker-slots.mjs');
  await acquireWorkerSlot(dir, 'fixture-backend-writer', { ranProfile: 'sol-fresh' });
  const preflight = `passed at ${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}`, before = reflogMark(f);
  assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), base, 'the actual preflight head must still equal the frozen source base');
  const changes = [];
  for (const [file, bytes] of Object.entries(files)) {
    const target = path.resolve(f.worktree, file), relative = path.relative(f.worktree, target);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'fixture write remains inside its disposable checkout');
    let original = null; try { original = readFileSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    put(target, bytes); changes.push({ path: file, change: original === null ? 'added' : 'modified', operationId: architecture.operation.operationId, beforeHash: original === null ? null : sha(original), afterHash: sha(readFileSync(target)) });
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NODE_TEST_')));
  const ran = spawnSync(process.execPath, testArgs, { cwd: f.worktree, encoding: 'utf8', windowsHide: true, timeout: 15000, env });
  assert.equal(ran.error, undefined); assert.equal(ran.status, blocked ? 1 : 0, ran.stdout + ran.stderr);
  const measured = { command: `node ${testArgs.join(' ')}`, status: ran.status, output: ran.stdout + ran.stderr }; put(path.join(dir, 'response/artifacts/unit.log'), measured.output);
  const head = commit(f.worktree, 'Implement the declared fixture worker and its actual tests', Object.keys(files)), after = reflogMark(f);
  if (blocked) {
    put(path.join(dir, 'response/changes.md'), `# changes — backend.generate step-${step}/parallel-1\n` + table('Binding', ['Field','Value'], [['Operator','backend.generate'],['Step',`${step}/1`],['Checkout',`@workspaces/be at ${base} → ${head} on ${sessionBranch}`],['Predecessor',architecture.ref],['Preflight',preflight],['Reflog before',before],['Reflog after',after]]) + table('Files', ['Path','Change','Why','Claims'], changes.map(change => [change.path, change.change === 'added' ? 'created' : 'modified', 'Preserve the source whose actual required test remains red.', 'deterministic-value'])) + '\n## What the next step must know\n\nThe actual Node regression failed. Preserve this single normal commit and rerun through a fresh frozen method.\n');
    const response = actual(request, { fields: { changes: 'response/changes.md' }, fallbacks: [], commits: [], next: [], stop: 'INVALID_INPUT', reason: 'The actual required Node regression failed after this single normal source commit.' }, 'blocked', ['response/changes.md'], 'sol-fresh');
    await accept(f, request, response);
    return { step, head, base, request, measured, architecture };
  }
  const facets = ['writer', 'transaction', 'idempotency', 'exception-identity', 'concurrency'], operation = { ...architecture.operation, facets, proofKinds: ['unit'] };
  const mutations = { mode: 'apply', contractFingerprint: architecture.fingerprint, base, branch: sessionBranch, commit: head, operations: [operation], changes };
  put(path.join(dir, 'response/data/mutations.json'), mutations);
  const conformance = facets.map(facet => `response/data/conformance/${operation.operationId}.${facet}.json`), proofRef = `response/data/proofs/${operation.operationId}.unit.json`;
  for (const [index, facet] of facets.entries()) put(path.join(dir, conformance[index]), { operationId: operation.operationId, facet, verdict: 'conforms', evidenceRef: 'response/artifacts/unit.log', statement: 'Actual source and Node tests prove the declared stateless behavior, invalid-input identity and repeat/concurrency outcomes.', contractFingerprint: architecture.fingerprint });
  put(path.join(dir, proofRef), { operationId: operation.operationId, proofKind: 'unit', commandRef: measured.command, exitCode: measured.status, result: 'passed', output: measured.output, statement: 'The declared actual test command completed at the source write set before its single commit.', contractFingerprint: architecture.fingerprint });
  put(path.join(dir, 'response/response.md'), '# backend-source-application — fixture\n' + table('Binding', ['Field', 'Value'], [['Outcome', request.requirements.outcome], ['Feature', 'fixture'], ['Mode', 'apply'], ['Contract fingerprint', architecture.fingerprint], ['Base', base], ['Branch', sessionBranch], ['Commit', head]]) + table('Operations', ['Operation', 'Transport', 'Writer', 'Transaction', 'Idempotency', 'Decisions'], [[operation.operationId, operation.transport, writer, operation.transactionBoundary, operation.idempotencyKind, operation.authorityDimensionIds.join(', ')]]) + table('Changes', ['Path', 'Change', 'Operation', 'Before', 'After'], changes.map(change => [change.path, change.change, change.operationId, change.beforeHash ?? '—', change.afterHash])) + table('Widened', ['Path', 'Nearest boundary', 'Why']) + table('Findings', ['Code', 'Operation', 'File', 'Statement'], [['`PATTERN_BOUND`', operation.operationId, writer, 'The worker and tests use the declared dependency-free ESM and Node test conventions.']]) + table('Fallbacks taken', ['Code', 'Action']));
  put(path.join(dir, 'response/changes.md'), `# changes — backend.generate ${ref(step)}\n` + table('Binding', ['Field', 'Value'], [['Operator', 'backend.generate'], ['Step', ref(step)], ['Checkout', `@workspaces/be at ${base} → ${head} on ${sessionBranch}`], ['Predecessor', architecture.ref], ['Preflight', preflight], ['Reflog before', before], ['Reflog after', after]]) + table('Files', ['Path', 'Change', 'Why', 'Claims'], changes.map(change => [change.path, change.change === 'added' ? 'created' : 'modified', 'Implement or test the declared stateless worker contract.', 'deterministic-value'])) + '\n## What the next step must know\n\nRun the same declared Node test command at this exact committed head. The fixture has no datastore or external service.\n');
  const response = actual(request, { fields: { 'backend-source-application': 'response/response.md', changes: 'response/changes.md', mutations: 'response/data/mutations.json', conformance, proof: [proofRef] }, fallbacks: [], commits: [head], next: ['quality.verify'] }, 'done', ['response/changes.md', proofRef], 'sol-fresh');
  response.outcome.primary = { kind: 'code', label: 'Fixture source changes', ref: 'response/changes.md' };
  await accept(f, request, response);
  return { step, head, base, ref: `${ref(step)}/response/response.md`, changesRef: `${ref(step)}/response/changes.md`, testRef, testArgs, request, measured, architecture };
}

export async function acceptUnitPlan(f, architecture, step = 4) {
  planCells(f, [[step, 'backend.plan']]);
  const request = current(f, { operatorId: 'backend.plan', contexts: [{ alias: '@workspaces/be', head: git(f.worktree, 'rev-parse', 'HEAD') }], requirements: { featureId: 'fixture', resume: null }, inputs: { 'architecture-decision': architecture.ref } }, step, { goal: { prerequisite: '5/1' }, workspace: false });
  await open(f, request);
  const units = [
    { id: 'worker', kind: 'module', goal: 'The deterministic fixture worker is implemented and tested.', inputs: [], dependsOn: [] },
    { id: 'consumer', kind: 'module', goal: 'The dependent fixture consumer uses the verified worker.', inputs: [], dependsOn: ['worker'] }
  ];
  put(path.join(branch(f, step), 'response/data/units.json'), { schemaVersion: 9, producedBy: 'backend.plan', units });
  put(path.join(branch(f, step), 'response/response.md'), '# backend-plan — fixture\n' + table('Modules', ['Module', 'Goal', 'Operations', 'Stores', 'Proofs', 'Migrations'], units.map((unit, index) => ['`' + unit.id + '`', unit.goal, '`' + architecture.model.operations[index].operationId + '`', '—', '`unit`', '—'])) + table('Order', ['Module', 'After'], [['`consumer`', '`worker`']]) + table('Fallbacks taken', ['Code', 'Action']));
  await accept(f, request, actual(request, { fields: { 'backend-plan': 'response/response.md', units: 'response/data/units.json' }, fallbacks: [], commits: [], next: ['backend.generate'] }, 'done', ['response/response.md', 'response/data/units.json']));
  return request;
}
