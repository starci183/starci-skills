// Disposable current-contract source/verification fixtures. Every successful attempt is opened
// and accepted by the copied runtime. No state record is stamped matched by this helper.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNTIME = path.resolve(import.meta.dirname, '..');
export const sha = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
export const read = file => JSON.parse(readFileSync(file, 'utf8'));
export const put = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n'); };
export const table = (heading, columns, rows = []) => `\n## ${heading}\n\n| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}\n`;
export const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export const commit = (cwd, message, files = ['.']) => { git(cwd, 'add', '--', ...files); git(cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', message); return git(cwd, 'rev-parse', 'HEAD'); };
const ref = step => `step-${step}/parallel-1`;
const scopeRef = (state, goal) => `state.json#mission:v${state.mission.version}/${goal.doneWhen !== undefined ? `doneWhen:${goal.doneWhen}` : `prerequisite:${goal.prerequisite}`}`;
export const branch = (f, step) => path.join(f.session, ref(step));
const stateOf = f => read(path.join(f.session, 'state.json'));
const moduleAt = (f, name) => import(pathToFileURL(path.join(f.root, name)).href);

export function current(f, request, step, { goal = { doneWhen: 0 }, workspace = true, mode = 'isolated', number = 1, previous = null, resume = null, exchange = null, criteria = null, coordination = null } = {}) {
  const state = stateOf(f), id = `${step}/1${exchange ? '/' + exchange : ''}:a${number}`;
  return { ...structuredClone(request), contractVersion: 'starci/v2.2', schemaVersion: 9, sessionId: state.id, step, parallel: 1,
    ...(exchange ? { exchange } : { goal }), resume, attempt: { id, number, kind: number === 1 ? 'initial' : 'repair', previous },
    expected: { version: 1, goalVersion: state.mission.version, sourceRef: exchange ? `${ref(step)}/response/data/stack-model.json` : scopeRef(state, goal), criteria: criteria ?? [{ id: 'delivery', required: true, expected: 'The declared fixture outcome is measured.', verification: 'Validate the actual source, command output and complete typed receipt.' }] },
    environment: { isolationId: id, mode, workspace: workspace ? { alias: '@workspaces/be', worktree: f.worktree, revision: git(f.worktree, 'rev-parse', 'HEAD') } : null, reads: (request.contexts ?? []).map(item => item.alias), writes: [], exclusive: [], outputRoot: 'response' }, frozenInputs: [],
    ...(coordination ? { coordination } : {}) };
}
export function actual(request, response, status, evidence, profile = 'sol-reviewer') {
  const matched = status === 'done', criteria = request.expected.criteria;
  return { ...response, contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: request.operatorId, step: request.step, parallel: 1, ...(request.exchange ? { exchange: request.exchange } : {}), status,
    boundProfile: profile, ranProfile: profile, attempt: { id: request.attempt.id, number: request.attempt.number, expectedVersion: 1 },
    actual: { expectedVersion: 1, observedAt: new Date().toISOString(), observations: criteria.map(item => ({ criterionId: item.id, observed: matched ? 'The fixture outcome is recorded in the actual evidence.' : 'The declared review checkpoint requires its next authority.', evidence })) },
    comparison: { expectedVersion: 1, verdict: matched ? 'matched' : 'inconclusive', criteria: criteria.map(item => ({ criterionId: item.id, verdict: matched ? 'matched' : 'inconclusive', evidence, note: 'Disposable fixture evidence validated by the actual runtime.' })), next: matched ? 'advance' : status === 'waiting' ? 'retry' : 'blocked' },
    ...(matched ? { outcome: { summary: 'The declared fixture evidence is available.', primary: { kind: 'document', label: 'Fixture evidence', ref: evidence[0] } } } : {}),
    ...(matched && !request.exchange && request.goal?.doneWhen !== undefined ? { goalCheck: { achieved: true, evidence } } : {}) };
}
export function planCells(f, cells) {
  const file = path.join(f.session, 'state.json'), state = read(file);
  for (const [step, operatorId] of cells) { const key = `${step}/1`; state.steps[key] = operatorId; if (!state.chain.flat().includes(key)) state.chain.push([key]); }
  state.chain.sort((a, b) => Number(a[0].split('/')[0]) - Number(b[0].split('/')[0])); state.current = `${cells[0][0]}/1`; put(file, state);
}
export async function open(f, request, directory = branch(f, request.step)) {
  put(path.join(directory, 'request/request.json'), request);
  const { openAttempt } = await moduleAt(f, 'scripts/attempt-gate.mjs');
  await openAttempt(directory); return directory;
}
export async function accept(f, request, response, directory = branch(f, request.step)) {
  put(path.join(directory, 'response/response.json'), response);
  const { acceptAttempt } = await moduleAt(f, 'scripts/attempt-gate.mjs');
  const result = await acceptAttempt(directory); assert.equal(result.state, response.status === 'done' ? 'matched' : response.status); return result;
}

export async function createSourceFixture(t, { sessionId = 'source-fixture', mission = null, doneWhen = null, tags = ['backend', 'architecture'], existing = null, draft = false, topology = { mode: 'solo' }, initialFiles = {} } = {}) {
  const home = existing?.home ?? mkdtempSync(path.join(tmpdir(), 'starci-current-source-'));
  const source = existing?.source ?? path.join(home, 'source'), root = existing?.root ?? path.join(source, '.claude'), repository = existing?.repository ?? path.join(home, 'product');
  assert.ok(path.resolve(home).startsWith(path.resolve(tmpdir()) + path.sep), 'shared source fixture must remain disposable');
  for (const directory of [source, root, repository]) assert.ok(path.resolve(directory).startsWith(path.resolve(home) + path.sep), 'shared fixture path stays inside its owning temporary home');
  let base;
  if (!existing) {
    t.after(() => { if (!path.resolve(home).startsWith(path.resolve(tmpdir()) + path.sep)) throw Error('unsafe source fixture cleanup'); rmSync(home, { recursive: true, force: true }); });
    for (const file of ['package.json', ...read(path.join(RUNTIME, 'package.json')).files]) cpSync(path.join(RUNTIME, file), path.join(root, file), { recursive: true });
    mkdirSync(repository); git(repository, 'init', '-q');
    put(path.join(repository, '.gitignore'), '.worktrees/sessions/\n.worktrees/e2e/\n');
    put(path.join(repository, 'package.json'), { private: true, type: 'module', engines: { node: process.version }, scripts: { build: 'node --test src/modules/fixture/worker.spec.mjs' } });
    put(path.join(repository, 'README.md'), 'Disposable stateless Node worker fixture. It has no datastore, network dependency or persisted state. Inputs are copied to a deterministic value; invalid inputs are refused.\n');
    for (const [file, bytes] of Object.entries(initialFiles)) {
      const target = path.resolve(repository, file), relative = path.relative(repository, target);
      assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'initial fixture data stays inside its disposable repository');
      put(target, bytes);
    }
    base = commit(repository, 'Fixture base and explicit source/test contract'); git(repository, 'remote', 'add', 'origin', repository);
  } else base = git(repository, 'rev-parse', '--verify', `${existing.base ?? 'HEAD'}^{commit}`);
  const worktree = path.join(home, sessionId); git(repository, 'worktree', 'add', '--quiet', '-b', `session/${sessionId}`, worktree, base);
  const sessions = path.join(worktree, '.worktrees/sessions'), project = `${sessionId}-${sha(sessions).slice(7, 15)}`;
  put(path.join(source, `.workspaces/projects/${project}/workflow.json`), { version: 1, project, ownerRole: 'be' });
  put(path.join(source, `.workspaces/local/routes/${project}/be/config.json`), { project, role: 'be', source: { path: source }, repository: { diskPath: worktree, gitRepository: repository } });
  const f = { home, source, root, repository, worktree, sessionId, load: name => moduleAt({ root }, name) };
  const { openSession, confirmSession, discoveryFor } = await f.load('scripts/v23-test-fixture.mjs');
  const discovery = discoveryFor(project, { head: base, tags }); discovery.repositories[0].repository = repository;
  const suppliedMission = typeof mission === 'function' ? mission({ ...f, project, discovery }) : mission;
  const fixtureMission = {
    language: 'en', goal: 'Implement and verify a bounded stateless worker.', target: 'Disposable fixture source', includes: ['A stateless Node worker and its measured verification'], excludes: ['Product source and external services'], outputs: ['Accepted source application', 'Accepted quality result'],
    doneWhen: [{ evidence: 'The bounded worker source is implemented and tested.', producedBy: 'backend.generate' }, { evidence: 'The exact source head passes its declared verification.', producedBy: 'quality.verify' }],
    verification: 'Run actual Node tests and preserve accepted current proof.', sourceRef: 'user:source-fixture', discovery, ...suppliedMission };
  if (doneWhen) fixtureMission.doneWhen = doneWhen;
  const opened = await openSession(sessions, { sessionId, project: sessionId, topology, hostBinding: { kind: 'codex-task', hostId: `task-${sessionId}`, worktree, sourcePromptRef: 'user:source-fixture' }, mission: fixtureMission });
  if (!draft) await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:source-fixture-confirmed' });
  return { ...f, ...opened, base, state: () => stateOf({ session: opened.session }) };
}

export async function acceptArchitecture(f, { startStep = 1, sourceStep = startStep + 3, writerRef = 'src/modules/fixture/worker.mjs', operationId = 'fixture-worker', coordination = null, goal = { prerequisite: `${sourceStep}/1` } } = {}) {
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
  const model = { decisionId: decision, selectedAlternativeId: 'stateless-worker', alternatives: [{ alternativeId: 'stateless-worker', status: 'selected', scores: { cost: 5, complexity: 5, reversibility: 5 }, rejectedBecause: null }], boundaries: [{ boundaryId: 'fixture', responsibility: 'Stateless fixture transformation', owner: 'fixture-owner', interfaces: ['runFixtureWorker'], ownsData: false }], stores: [], operations: [operation], components: [{ componentId: 'node', status: 'existing', justification: 'observed-evidence', evidence: `package.json@${head}`, compatibility: ['runtime-version', 'deployable-unit', 'communication-failure', 'datastore-ownership', 'backup-restore'].map(axis => ({ axis, verified: true, evidence: `README.md@${head}` })) }] };
  put(path.join(dir, 'response/restatement.md'), reading); put(path.join(dir, 'response/data/current-state.json'), observed); put(path.join(dir, 'response/data/stack-model.json'), model);
  await accept(f, request, actual(request, { fields: { restatement: 'response/restatement.md', 'current-state': 'response/data/current-state.json', 'stack-model': 'response/data/stack-model.json' }, awaiting: { exchange: 'critique', kind: 'independent-critique' }, fallbacks: [], commits: [], next: [] }, 'waiting', ['response/data/stack-model.json']));
  const critiqueRequest = current(f, { operatorId: 'architecture.decide', contexts: [], requirements: {}, inputs: { 'stack-model': `${ref(architectureStep)}/response/data/stack-model.json` } }, architectureStep, { exchange: 'critique', workspace: false });
  const critiqueDir = path.join(dir, 'critique'); await open(f, critiqueRequest, critiqueDir);
  // A separate process receives only the model and checks every stated stateless adverse path.
  const reviewProgram = "import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; const model=JSON.parse(readFileSync(process.argv[1])); const op=model.operations[0]; assert.equal(model.operations.length,1); assert.equal(op.transport,'worker'); assert.equal(op.transactionBoundary,'read-only'); assert.equal(op.idempotencyKind,'none'); assert.deepEqual(op.storeRefs,[]); assert.deepEqual(op.migrationRefs,[]); assert.deepEqual(model.stores,[]); assert.equal(model.boundaries[0].ownsData,false); process.stdout.write(JSON.stringify({pid:process.pid,paths:['partial-failure','retry-idempotency','concurrency','stale-state','deletion','recovery','dependency-outage','rollback']}));";
  const review = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', reviewProgram, path.join(dir, 'response/data/stack-model.json')], { encoding: 'utf8', windowsHide: true }));
  put(path.join(critiqueDir, 'response/critique.md'), `# independent-critique — ${decision}\n` + table('Execution', ['Field', 'Value'], [['Reviewer execution', `process://${review.pid}`], ['Inherited turns', 'none'], ['Given', 'response/data/stack-model.json']]) + table('Attacks', ['Adverse path', 'Attack', 'Resolution', 'Verdict'], review.paths.map(adverse => [adverse, `Can ${adverse} leave a partial persisted effect?`, 'The separately inspected contract has one read-only worker, no stores, migration or persistent effects.', 'holds'])) + table('Verdict', ['Field', 'Value'], [['Selection', 'keep']]));
  await accept(f, critiqueRequest, actual(critiqueRequest, { fields: { 'independent-critique': 'response/critique.md' }, fallbacks: [], commits: [], next: [] }, 'done', ['response/critique.md']), critiqueDir);
  const { acquireWorkerSlot } = await moduleAt(f, 'scripts/worker-slots.mjs');
  await acquireWorkerSlot(dir, 'fixture-architecture-author', { resume: true, ranProfile: 'sol-reviewer' });
  const md = `# architecture-decision — ${decision}\n` + table('Decision', ['Field', 'Value'], [['Objective', objective], ['Decision id', decision], ['Selected alternative', 'stateless-worker'], ['Selection policy', 'automatic']]) + table('Current state', ['Boundary', 'Responsibility', 'Stores', 'Evidence'], [['`fixture`', 'Stateless fixture transformation', '—', `README.md@${head}`]]) + table('Alternatives', ['Alternative', 'Status', 'Assessment', 'Rejected because'], [['`stateless-worker`', 'selected', 'cost 5; complexity 5; reversibility 5', '—']]) + table('Boundaries', ['Boundary', 'Responsibility', 'Owner', 'Interfaces', 'Owns data'], [['`fixture`', 'Stateless fixture transformation', 'fixture-owner', 'runFixtureWorker', 'no']]) + table('Data ownership', ['Store', 'Owning boundary', 'Writers', 'Readers', 'Migrators', 'Transaction scope', 'Backup', 'Restore']) + table('Stack delta', ['Component', 'Status', 'Justification', 'Evidence', 'Compatibility'], [['`node`', 'existing', 'observed-evidence', `package.json@${head}`, '5/5 verified']]) + table('Operations', ['Operation', 'Transport', 'Writer', 'Stores', 'Transaction', 'Idempotency', 'Dimensions'], [[operationId, operation.transport, writerRef, '—', operation.transactionBoundary, operation.idempotencyKind, 'deterministic-value']]) + table('Handoff', ['Item', 'Kind', 'Detail'], [['determinism', 'invariant', 'Repeated valid input produces the same value without mutating the input.'], ['worker', 'contract', 'A string input yields its uppercase value; a non-string throws TypeError.'], ['source', 'migration', 'No persisted data exists or changes.'], ['revert', 'rollback', 'Remove the worker source commit; no data restore is needed.'], ['tests', 'proof', 'Run Node tests for valid, repeated, concurrent, missing and invalid inputs.']]) + table('Fallbacks taken', ['Code', 'Action']);
  put(path.join(dir, 'response/response.md'), md);
  await accept(f, request, actual(request, { fields: { restatement: 'response/restatement.md', 'architecture-decision': 'response/response.md', 'current-state': 'response/data/current-state.json', 'stack-model': 'response/data/stack-model.json' }, fallbacks: [], commits: [], next: ['backend.generate'] }, 'done', ['response/response.md']));
  return { step: architectureStep, sourceStep, ref: `${ref(architectureStep)}/response/response.md`, model, operation, fingerprint: sha(readFileSync(path.join(dir, 'response/data/stack-model.json'))) };
}

function runTests(worktree, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NODE_TEST_')));
  const ran = spawnSync(process.execPath, args, { cwd: worktree, encoding: 'utf8', windowsHide: true, shell: false, timeout: 15000, env });
  assert.equal(ran.error, undefined); assert.equal(ran.status, 0, ran.stdout + ran.stderr);
  assert.match(ran.stdout, /(?:tests [1-9]|[1-9] pass|ok [1-9])/, 'a real nonempty test run is required');
  return { command: `node ${args.join(' ')}`, args, status: ran.status, output: ran.stdout + ran.stderr };
}
function reflogMark(f) {
  const count = args => { try { return git(f.worktree, 'reflog', 'show', '--format=%H', ...args).split('\n').filter(Boolean).length; } catch { return 0; } };
  return `HEAD ${count(['HEAD'])} ${git(f.worktree, 'rev-parse', 'HEAD')}; stash ${count(['refs/stash'])}`;
}

export async function acceptBackend(f, architecture, { step = architecture.sourceStep, goal = { doneWhen: 0 }, coordination = null, inputs = {}, files = null, testRef = architecture.operation.writerRef.replace(/\.mjs$/, '.spec.mjs'), testArgs = ['--test', testRef], afterOpen = null } = {}) {
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
  const contexts = [{ alias: '@workspaces/be', head: base }, { alias: '@worktrees/businesses/fixture', head: null }, { alias: '@knowledge/patterns/be', head: null }];
  planCells(f, [[step, 'backend.generate']]);
  const request = current(f, { operatorId: 'backend.generate', contexts, requirements: { featureId: 'fixture', outcome: 'Implement the declared stateless worker contract.', mutableFileRefs: Object.keys(files), protectedRefs: [], contractFingerprint: architecture.fingerprint, mode: 'apply', scope: 'full', resume: null }, inputs: { 'architecture-decision': architecture.ref, ...inputs } }, step, { goal, coordination });
  request.environment.writes = Object.keys(files).map(file => `@workspaces/be/${file}`); request.environment.exclusive = [path.join(f.worktree, directory)];
  const dir = await open(f, request);
  if (afterOpen) await afterOpen({ request, dir });
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
  const measured = runTests(f.worktree, testArgs); put(path.join(dir, 'response/artifacts/unit.log'), measured.output);
  const head = commit(f.worktree, 'Implement the declared fixture worker and its actual tests', Object.keys(files)), after = reflogMark(f);
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

export async function acceptQuality(f, source, { step = source.step + 1, goal = { doneWhen: 1 }, coordination = null, criteria = null, testArgs = source.testArgs, testRef = source.testRef } = {}) {
  const head = git(f.worktree, 'rev-parse', 'HEAD'), sessionBranch = git(f.worktree, 'branch', '--show-current');
  assert.equal(head, source.head, 'the quality fixture must consume its exact accepted source head');
  const planned = { gate: 'build', required: true, commandRef: `node ${testArgs.join(' ')}`, configRef: testRef };
  const contexts = [{ alias: '@workspaces/be', head }]; planCells(f, [[step, 'quality.verify']]);
  const request = current(f, { operatorId: 'quality.verify', contexts, requirements: { gates: [planned], thresholds: [], explicitE2eRequest: false, sonarScope: 'new-code', declaredDebts: [], resume: null }, inputs: { 'backend-source-application': source.ref, changes: source.changesRef } }, step, { goal, mode: 'inline', coordination, criteria });
  const dir = await open(f, request), measured = runTests(f.worktree, testArgs);
  assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), head, 'the quality test must leave its measured source head unchanged');
  put(path.join(dir, 'response/artifacts/build.log'), measured.output);
  put(path.join(dir, 'response/data/gates/build.json'), { ...planned, sourceHead: head, sessionBranch, predecessorCommit: source.head, observedAt: new Date().toISOString(), status: 'pass', exitCode: measured.status, evidenceRef: 'response/artifacts/build.log', classification: null, sonarScope: null, debt: null, statement: 'The declared actual Node command passed at the unchanged accepted source head.' });
  const topics = ['presentation', 'composition', 'responsive', 'motion', 'accessibility', 'contrast', 'render-truth', 'taste', 'experience'];
  put(path.join(dir, 'response/response.md'), `# quality-verification — ${head}\n`
    + table('Binding', ['Field', 'Value'], [['Operator', 'quality.verify'], ['Step', ref(step)], ['Checkout', '@workspaces/be'], ['Head', head], ['Session branch', sessionBranch], ['Predecessors', `${source.ref}, ${source.changesRef}`]])
    + table('Gate plan', ['Gate', 'Required', 'Command', 'Configuration'], [['`build`', 'yes', planned.commandRef, planned.configRef]])
    + table('Results', ['Gate', 'Status', 'Exit code', 'Evidence', 'Classification', 'Statement'], [['`build`', 'pass', measured.status, 'response/artifacts/build.log', '—', 'The real declared Node test command passed.']])
    + table('Coverage', ['Metric', 'Measured', 'Threshold', 'Verdict'])
    + table('Sonar', ['Field', 'Value'], [['Scope', 'new-code'], ['Finding', '—']])
    + table('Debts', ['Debt', 'Gate', 'Approval', 'Owner', 'Expires', 'Statement'])
    + table('Findings', ['Code', 'Gate', 'Statement'], [['`PREDECESSOR_CONSUMED`', '—', 'Both original accepted source receipts were consumed unchanged.']])
    + table('Gate verdict', ['Field', 'Value'], [['Verdict', '`pass`']])
    + table('Verdict', ['Topic', 'Verdict', 'Route'], topics.map(topic => ['`' + topic + '`', 'not-applicable', 'none']))
    + '\nVerdict: ship\n' + table('Audit scope', ['Field', 'Value'], [['Mode', 'not-recorded'], ['Coverage claim', 'not-recorded'], ['Deferred states', '—']]));
  await accept(f, request, actual(request, { fields: { 'quality-verification': 'response/response.md', 'gate-result': ['response/data/gates/build.json'] }, fallbacks: [], commits: [], next: ['git.publish'] }, 'done', ['response/response.md', 'response/data/gates/build.json']));
  const { acceptedProducerProof } = await moduleAt(f, 'scripts/producer-import.mjs');
  const proof = await acceptedProducerProof(f.root, stateOf(f).id, step, 1, 'quality-verification', { hostRoot: f.source ?? path.dirname(f.root) });
  return { step, head, ref: `${ref(step)}/response/response.md`, proof, request, measured };
}
