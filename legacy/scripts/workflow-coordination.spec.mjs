import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const runtimeSource = path.resolve(import.meta.dirname, '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const put = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n'); };
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function fixture(t) {
  const home = mkdtempSync(path.join(tmpdir(), 'starci-coordination-'));
  const source = path.join(home, 'source'), root = path.join(source, '.claude'), product = path.join(home, 'product');
  t.after(() => {
    if (!path.resolve(home).startsWith(path.resolve(tmpdir()) + path.sep)) throw Error('unsafe coordination fixture cleanup');
    rmSync(home, { recursive: true, force: true });
  });
  for (const file of ['package.json', ...read(path.join(runtimeSource, 'package.json')).files]) cpSync(path.join(runtimeSource, file), path.join(root, file), { recursive: true });
  mkdirSync(product); git(product, 'init', '-q');
  put(path.join(product, 'src/modules/shared/contract.txt'), 'Shared contract fixture.\n');
  put(path.join(product, 'src/modules/a/feature.txt'), 'Consumer A fixture.\n');
  put(path.join(product, 'src/modules/b/feature.txt'), 'Consumer B fixture.\n');
  git(product, 'add', 'src');
  git(product, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic coordination source');
  git(product, 'remote', 'add', 'origin', product);
  const head = git(product, 'rev-parse', 'HEAD');
  const moduleAt = ref => import(pathToFileURL(path.join(root, ref)).href);
  const [sessions, coordination] = await Promise.all([moduleAt('scripts/v23-test-fixture.mjs'), moduleAt('scripts/workflow-coordination.mjs')]);
  const peers = {};
  async function open(id, { coordinated = false, draft = false, transport = 'path' } = {}) {
    const worktree = path.join(home, id);
    git(product, 'worktree', 'add', '--quiet', '--detach', worktree, head);
    const sessionsRoot = path.join(worktree, '.worktrees/sessions');
    const project = `${id}-${sha(sessionsRoot).slice(0, 8)}`;
    const repository = transport === 'file' ? pathToFileURL(product).href : product;
    const discovery = sessions.discoveryFor(project, { tags: ['documentation'], head });
    discovery.repositories[0].repository = repository;
    discovery.impacts[0].code = ['src/modules'];
    put(path.join(source, `.workspaces/projects/${project}/workflow.json`), { version: 1, project, ownerRole: 'be' });
    put(path.join(source, `.workspaces/local/routes/${project}/be/config.json`), { project, role: 'be', source: { path: source }, repository: { diskPath: worktree, gitRepository: repository } });
    const doneWhen = coordinated ? [{ evidence: `The ${id} outcome is proven.`, producedBy: 'workflow.verify' }] : [{ evidence: `The ${id} fixture plan is proven.`, producedBy: 'data.plan' }, { evidence: `The ${id} declared seed is placed.`, producedBy: 'data.seed' }];
    const opened = await sessions.openSession(sessionsRoot, { sessionId: id, project: id, topology: { mode: coordinated ? 'coordinated' : 'solo' }, hostBinding: { kind: 'codex-task', hostId: `native-${id}`, worktree, sourcePromptRef: `user:${id}` }, mission: { language: 'en', goal: `Deliver the ${id} authorized outcome.`, target: 'Shared fixture repository', includes: ['Declared bounded implementation'], excludes: ['Other product scope'], outputs: ['Accepted fixture outcome'], doneWhen, verification: 'Validate actual accepted evidence and selected write ownership.', sourceRef: `user:${id}`, discovery } });
    if (!draft) await sessions.confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: `user:${id}:scope` });
    const stateFile = path.join(opened.session, 'state.json');
    if (!coordinated && !draft) {
      const state = read(stateFile); state.steps = { '1/1': 'data.plan', '2/1': 'data.seed', '3/1': 'data.plan' }; state.chain = [['1/1'], ['2/1'], ['3/1']]; state.current = '1/1'; put(stateFile, state);
    }
    const peer = { ...opened, worktree, stateFile, state: () => read(stateFile), locator: path.join(source, `.workspaces/local/workflows/${id}.json`) };
    peers[id] = peer; return peer;
  }
  const coordinator = await open('coordinator', { coordinated: true });
  const a = await open('consumer-a'), b = await open('consumer-b', { transport: 'file' }), c = await open('producer-c', { draft: true });
  const invoke = (name, peer, ...args) => coordination[name](root, peer.session, ...args);
  const request = (peer, rootPath, assignment, cell = '3/1') => {
    const [step, parallel] = cell.split('/').map(Number);
    return { operatorId: peer.state().steps?.[cell] ?? 'data.plan', sessionId: peer.sessionId, step, parallel, inputs: {}, environment: { workspace: { alias: '@workspaces/be', worktree: peer.worktree, revision: head }, writes: [`@workspaces/be/${rootPath}`] }, ...(assignment ? { coordination: { coordinatorSessionId: coordinator.sessionId, assignment } } : {}) };
  };
  const admission = (peer, wanted, options) => coordination.coordinationAdmissionErrors(root, peer.session, peer.state(), wanted, options);
  const claims = [{ sessionId: a.sessionId, role: 'be', root: 'src/modules/a' }, { sessionId: a.sessionId, role: 'be', root: 'src/modules/shared' }, { sessionId: b.sessionId, role: 'be', root: 'src/modules/b' }];
  const specification = { id: 'extract-shared', donorSessionId: a.sessionId, producerSessionId: c.sessionId, operatorId: 'data.plan', selections: [{ impactId: 'bounded', roots: ['src/modules/shared'] }], dependencies: [{ consumerSessionId: a.sessionId, kind: 'units', cells: ['2/1'] }, { consumerSessionId: b.sessionId, kind: 'units', cells: ['2/1'] }] };
  return { home, source, root, product, head, peers, coordinator, a, b, c, open, invoke, request, admission, claims, specification, moduleAt, ...coordination };
}

async function producePlan(f, peer, { assignment = null, accept = true } = {}) {
  const { openAttempt, acceptAttempt } = await f.moduleAt('scripts/attempt-gate.mjs');
  const state = peer.state(); state.steps['1/1'] = 'data.plan'; state.chain = [['1/1']]; state.current = '1/1'; put(peer.stateFile, state);
  const branch = path.join(peer.session, 'step-1/parallel-1');
  const contexts = [{ alias: '@workspaces/be', head: null }, { alias: '@worktrees/_templates', head: null }, { alias: '@worktrees/uat/items', head: null }];
  const request = { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: 'data.plan', sessionId: peer.sessionId, step: 1, parallel: 1, contexts,
    requirements: { goal: 'Plan one attributable fixture unit.', feature: 'items', env: 'dev' }, inputs: {}, resume: null, goal: { doneWhen: 0 },
    attempt: { id: '1/1:plan', number: 1, kind: 'initial', previous: null }, expected: { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'unit', required: true, expected: 'An attributable unit is planned.', verification: 'Validate the complete plan and its unit model.' }] },
    environment: { isolationId: 'accepted-plan', mode: 'isolated', workspace: { alias: '@workspaces/be', worktree: peer.worktree, revision: f.head }, reads: contexts.map(context => context.alias), writes: [], exclusive: [], outputRoot: 'response' }, frozenInputs: [],
    ...(assignment ? { coordination: { coordinatorSessionId: f.coordinator.sessionId, assignment } } : {}) };
  put(path.join(branch, 'request/request.json'), request); await openAttempt(branch);
  const table = (title, columns, rows) => `\n## ${title}\n\n| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}\n`;
  const goal = 'The owned fixture can be read back.';
  put(path.join(branch, 'response/response.md'), '# seed-plan — items\n' + table('Units', ['Unit', 'Serves', 'Namespace', 'Goal'], [['`first`', 'flow `first`', '`uat-first`', goal]]) + table('Targets', ['Unit', 'Store', 'Attribution', 'Volume', 'Rollback'], [['`first`', '`items`', 'owner', '2', 'Remove every record owned by the unit account.']]) + table('Fixtures', ['Unit', 'State', 'Action', 'JSON', 'SQL', 'Expected', 'Creates outcome'], [['`first`', 'valid', 'reuse', '`.worktrees/uat/items/first/seed/records.json`', '—', 'Two owned records read back.', 'false']]) + table('Fallbacks taken', ['Code', 'Action'], []));
  put(path.join(branch, 'response/data/units.json'), { schemaVersion: 9, producedBy: 'data.plan', units: [{ id: 'first', kind: 'table', goal, inputs: [], dependsOn: [] }] });
  const evidence = ['response/response.md', 'response/data/units.json'];
  put(path.join(branch, 'response/response.json'), { contractVersion: 'starci/v2.2', schemaVersion: 9, operatorId: 'data.plan', step: 1, parallel: 1, status: 'done', fields: { 'seed-plan': evidence[0], units: evidence[1] }, fallbacks: [], commits: [], next: ['data.seed'], boundProfile: 'sol-reviewer', ranProfile: 'sol-reviewer', attempt: { id: request.attempt.id, number: 1, expectedVersion: 1 }, actual: { expectedVersion: 1, observedAt: new Date().toISOString(), observations: [{ criterionId: 'unit', observed: 'The attributable unit is declared.', evidence }] }, comparison: { expectedVersion: 1, verdict: 'matched', criteria: [{ criterionId: 'unit', verdict: 'matched', evidence, note: 'The plan and unit validate.' }], next: 'advance' }, goalCheck: { achieved: true, evidence }, outcome: { summary: 'The attributable fixture unit is planned.', primary: { kind: 'document', label: 'Seed plan', ref: evidence[0] } } });
  if (accept) assert.equal((await acceptAttempt(branch)).state, 'matched');
  return { branch, accept: () => acceptAttempt(branch) };
}

test('A/B retain independent work while a derived C gains only the extracted shared ownership', async t => {
  const f = await fixture(t);
  const { coordinator, a, b, c } = f;
  const originalMission = new Map([a, b].map(peer => [peer.sessionId, JSON.stringify(peer.state().mission)]));
  const originalMissionSeals = new Map([a, b].map(peer => [peer.sessionId, readFileSync(path.join(peer.session, peer.state().missionSnapshots[1].ref))]));
  await f.invoke('enrolWorkflow', a, coordinator.sessionId); await f.invoke('enrolWorkflow', b, coordinator.sessionId);
  const initial = await f.invoke('assignWorkflows', coordinator, { id: 'initial-owners', claims: f.claims });
  assert.deepEqual(await f.invoke('assignWorkflows', coordinator, { id: 'initial-owners', claims: f.claims }), initial, 'identical assignment retries return their original seal');
  const staleDonor = f.request(a, 'src/modules/shared', initial);
  const unaffectedA = f.request(a, 'src/modules/a', initial), unaffectedB = f.request(b, 'src/modules/b', initial);
  assert.deepEqual(await f.admission(a, staleDonor), []); assert.deepEqual(await f.admission(b, unaffectedB), []);
  const originalAssignment = readFileSync(path.join(coordinator.session, initial.ref));
  const prepared = await f.invoke('prepareExtraction', coordinator, f.specification);
  assert.deepEqual(await f.invoke('prepareExtraction', coordinator, f.specification), prepared);
  assert.equal(c.state().lifecycle.phase, 'draft', 'preparation never edits the new producer ledger');
  assert.deepEqual(await f.admission(a, staleDonor), [], 'preparation alone does not transfer ownership');
  await f.invoke('enrolWorkflow', c, coordinator.sessionId, { preparation: prepared });
  const derived = c.state();
  assert.equal(derived.mission.confirmation.authority.kind, 'coordination-extraction');
  assert.equal(derived.mission.confirmation.authority.sourceRef, a.state().mission.confirmation.sourceRef);
  assert.deepEqual(derived.mission.discovery.impacts.flatMap(impact => impact.code), ['src/modules/shared']);
  assert.deepEqual(await f.coordinationStateErrors(f.root, c.session, derived), []);
  const transferred = await f.invoke('activateExtraction', coordinator, prepared);
  assert.notEqual(transferred.hash, initial.hash); assert.deepEqual(await f.invoke('activateExtraction', coordinator, prepared), transferred);
  assert.match((await f.admission(a, staleDonor)).join('\n'), /COORDINATION_OWNED/);
  assert.match((await f.admission(a, staleDonor, { historical: true })).join('\n'), /COORDINATION_HISTORY/, 'an unopened request cannot claim historical acceptance');
  assert.deepEqual(await f.admission(a, unaffectedA), [], 'A retains independent work without rewriting its old assignment selector');
  assert.deepEqual(await f.admission(b, unaffectedB), [], 'B retains independent work without rewriting its old assignment selector');
  assert.deepEqual(await f.admission(c, f.request(c, 'src/modules/shared', transferred)), []);
  assert.match((await f.admission(a, f.request(a, 'src/modules/a', transferred, '2/1'))).join('\n'), /COORDINATION_WAIT/);
  assert.match((await f.admission(b, f.request(b, 'src/modules/b', transferred, '2/1'))).join('\n'), /COORDINATION_WAIT/);
  assert.match((await f.admission(a, f.request(a, 'src/modules/a', null, '2/1'))).join('\n'), /COORDINATION_STALE/);
  assert.match((await f.admission(b, { ...unaffectedB, coordination: { ...unaffectedB.coordination, coordinatorSessionId: 'foreign-coordinator' } })).join('\n'), /COORDINATION_IDENTITY/);
  await assert.rejects(f.invoke('resolveExtraction', coordinator, 'extract-shared:consumer-a:units', { step: 1, parallel: 1 }), /missing|ENOENT|producer/);
  assert.deepEqual(readFileSync(path.join(coordinator.session, initial.ref)), originalAssignment);
  for (const peer of [a, b]) {
    assert.equal(JSON.stringify(peer.state().mission), originalMission.get(peer.sessionId));
    assert.deepEqual(readFileSync(path.join(peer.session, peer.state().missionSnapshots[1].ref)), originalMissionSeals.get(peer.sessionId));
  }
});

test('ownership rejects repository aliases, locator loss, cross-coordinator claims and wrong producer derivation', async t => {
  const f = await fixture(t), { a, b, c, coordinator } = f;
  await f.invoke('enrolWorkflow', a, coordinator.sessionId); await f.invoke('enrolWorkflow', b, coordinator.sessionId);
  assert.equal(f.canonicalRepository(f.product), f.canonicalRepository(pathToFileURL(f.product).href));
  assert.equal(f.canonicalRepository(f.product), f.canonicalRepository(a.worktree), 'linked worktree paths resolve one Git repository');
  assert.equal(f.canonicalRepository('git@github.com:Sample/Shared.git'), f.canonicalRepository('https://github.com/sample/shared'));
  await assert.rejects(f.invoke('assignWorkflows', coordinator, { id: 'aliased-overlap', claims: [f.claims[1], { sessionId: b.sessionId, role: 'be', root: 'src/modules/shared/child' }] }), /COORDINATION_OWNED/);
  assert.equal(coordinator.state().coordination?.active, undefined, 'failed assignment creates no owner');
  const initial = await f.invoke('assignWorkflows', coordinator, { id: 'initial-owners', claims: f.claims });
  await assert.rejects(f.invoke('assignWorkflows', coordinator, { id: 'initial-owners', claims: f.claims.slice(0, 1) }), /COORDINATION_REPLAY/);
  const savedLocator = readFileSync(coordinator.locator); unlinkSync(coordinator.locator);
  try { assert.match((await f.admission(a, f.request(a, 'src/modules/a', initial))).join('\n'), /COORDINATION_LOCATOR/); }
  finally { put(coordinator.locator, savedLocator); }
  const prepared = await f.invoke('prepareExtraction', coordinator, f.specification);
  const wrong = await f.open('wrong-producer', { draft: true });
  await assert.rejects(f.invoke('enrolWorkflow', wrong, coordinator.sessionId, { preparation: prepared }), /different producer|another producer/);
  assert.equal(wrong.state().lifecycle.phase, 'draft');
  const other = await f.open('other-coordinator', { coordinated: true });
  await assert.rejects(f.invoke('enrolWorkflow', a, other.sessionId), /two coordinators/);
  const outsider = await f.open('other-consumer'); await f.invoke('enrolWorkflow', outsider, other.sessionId);
  await assert.rejects(f.invoke('assignWorkflows', other, { id: 'competing-owners', claims: [{ sessionId: outsider.sessionId, role: 'be', root: 'src/modules/shared' }] }), /COORDINATION_OWNED/);
  const outsiderWrite = f.request(outsider, 'src/modules/shared', null);
  assert.match((await f.admission(outsider, outsiderWrite)).join('\n'), /COORDINATION_OWNED/);
  for (const root of ['../shared', 'src//modules', 'src/modules/../shared', 'src\\modules', '/absolute', 'src/*']) assert.throws(() => f.repositoryPath(root), /COORDINATION_ROOT/);
  await f.invoke('enrolWorkflow', c, coordinator.sessionId, { preparation: prepared });
  await f.invoke('activateExtraction', coordinator, prepared);
  const escaped = f.request(a, 'src/modules/SHARED', initial);
  if (process.platform === 'win32') assert.match((await f.admission(a, escaped)).join('\n'), /COORDINATION_OWNED/, 'Windows path case cannot hide transferred ownership');
});

test('a separate-process compare-and-reserve wins before transfer, which refuses the durable running reservation', async t => {
  const f = await fixture(t), { a, b, c, coordinator } = f;
  await f.invoke('enrolWorkflow', a, coordinator.sessionId); await f.invoke('enrolWorkflow', b, coordinator.sessionId);
  const initial = await f.invoke('assignWorkflows', coordinator, { id: 'initial-owners', claims: f.claims });
  const prepared = await f.invoke('prepareExtraction', coordinator, f.specification);
  await f.invoke('enrolWorkflow', c, coordinator.sessionId, { preparation: prepared });
  const request = { ...f.request(a, 'src/modules/shared', initial, '1/1'), contractVersion: 'starci/v2.2', schemaVersion: 9,
    contexts: [], requirements: {}, resume: null, goal: { doneWhen: 0 },
    attempt: { id: '1/1:reserved', number: 1, kind: 'initial', previous: null },
    expected: { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'ownership', required: true, expected: 'The exact assigned source root remains owned.', verification: 'Compare and reserve under the Source coordination lock.' }] }, frozenInputs: [] };
  Object.assign(request.environment, { isolationId: 'coordination-race', mode: 'isolated', reads: [], exclusive: [path.join(a.worktree, 'src/modules/shared')], outputRoot: 'response' });
  const requestRef = 'step-1/parallel-1/request/request.json', requestFile = path.join(a.session, requestRef);
  put(requestFile, request); const bytes = readFileSync(requestFile);
  // Exercise the same Source-lock compare/reserve domain as worker acquisition. This fixture
  // records only a running reservation over real frozen bytes; it runs no product operator and
  // creates no response, accepted verdict or completion proof. Teardown owns the live fixture.
  const childScript = `
    import { readFileSync } from 'node:fs';
    import { createHash } from 'node:crypto';
    import { pathToFileURL } from 'node:url';
    import path from 'node:path';
    const [root, session, requestRef] = process.argv.slice(1);
    const { mutateSession } = await import(pathToFileURL(path.join(root, 'scripts/session-lock.mjs')).href);
    const { coordinationAdmissionErrors } = await import(pathToFileURL(path.join(root, 'scripts/workflow-coordination.mjs')).href);
    const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
    try {
      await mutateSession(session, async state => {
        const bytes = readFileSync(path.join(session, requestRef)), request = JSON.parse(bytes);
        const errors = await coordinationAdmissionErrors(root, session, state, request);
        if (errors.length) throw Error(errors.join('; '));
        const resume = new Promise(resolve => process.once('message', resolve));
        process.send({ event: 'admitted-under-lock' });
        await resume;
        if (!readFileSync(path.join(session, requestRef)).equals(bytes)) throw Error('request changed while reserving');
        state.requestHashes['1/1'] = digest(bytes);
        state.attempts['1/1'] = { ...request.attempt, operatorId: request.operatorId, status: 'running',
          expectedVersion: request.expected.version, expectedHash: digest(JSON.stringify(request.expected)), expected: request.expected,
          frozenInputs: request.frozenInputs, requestRef, startedAt: new Date().toISOString() };
      });
      process.send({ event: 'reserved' }); process.disconnect();
    } catch (error) { process.stderr.write(error.message); process.exitCode = 1; process.disconnect(); }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', childScript, f.root, a.session, requestRef], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let stderr = ''; child.stderr.on('data', data => { stderr += data; });
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code)); });
  const admitted = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('reservation process did not enter its Source lock')), 10000);
    child.on('message', message => { if (message.event === 'admitted-under-lock') { clearTimeout(timeout); resolve(); } });
    child.once('exit', code => { if (code) { clearTimeout(timeout); reject(Error(stderr || `reservation process exited ${code}`)); } });
  });
  await admitted;
  let settled = false;
  const transfer = f.invoke('activateExtraction', coordinator, prepared).then(value => ({ value }), error => ({ error })).finally(() => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(settled, false, 'transfer cannot overtake an admitted reservation holding the common Source lock');
  child.send({ command: 'reserve' });
  assert.equal(await exited, 0, stderr);
  const result = await transfer;
  assert.match(String(result.error), /COORDINATION_BUSY/);
  assert.deepEqual(coordinator.state().coordination.active, initial, 'busy transfer preserves the previous assignment');
  assert.equal(a.state().attempts['1/1'].status, 'running');
  assert.equal(a.state().requestHashes['1/1'], `sha256:${sha(bytes)}`);
  assert.deepEqual(readFileSync(requestFile), bytes);
  assert.equal(existsSync(path.join(a.session, 'step-1/parallel-1/response/response.json')), false, 'reservation is not fabricated operator evidence');
});

test('initial assignment refuses an already-running foreign reservation before any coordinator owns the root', async t => {
  const f = await fixture(t), foreign = await f.open('unassigned-writer');
  const wanted = f.request(foreign, 'src/modules/shared', null, '1/1');
  const ref = 'step-1/parallel-1/request/request.json'; put(path.join(foreign.session, ref), wanted);
  const { mutateSession } = await f.moduleAt('scripts/session-lock.mjs');
  await mutateSession(foreign.session, async state => {
    assert.deepEqual(await f.coordinationAdmissionErrors(f.root, foreign.session, state, wanted), []);
    state.requestHashes['1/1'] = `sha256:${sha(readFileSync(path.join(foreign.session, ref)))}`;
    state.attempts['1/1'] = { id: 'running-foreign', operatorId: wanted.operatorId, requestRef: ref, status: 'running' };
  });
  await f.invoke('enrolWorkflow', f.a, f.coordinator.sessionId); await f.invoke('enrolWorkflow', f.b, f.coordinator.sessionId);
  await assert.rejects(f.invoke('assignWorkflows', f.coordinator, { id: 'initial-owners', claims: f.claims }), /COORDINATION_BUSY/);
  assert.equal(f.coordinator.state().coordination?.active, undefined);
  assert.equal(foreign.state().attempts['1/1'].status, 'running');
});

test('extraction freezes selected logical nodes from genuinely committed consumer forecasts', async t => {
  const f = await fixture(t), { a, b, c, coordinator } = f;
  const plans = await f.moduleAt('scripts/plan-history.mjs');
  const forecasts = new Map();
  for (const peer of [a, b]) {
    const flags = { requirements: { 'data.plan': { feature: 'items', goal: 'Plan the declared attributable fixture unit.', env: 'dev' } } };
    const preview = await plans.previewRevision(f.root, peer.session, flags);
    const committed = await plans.commitRevision(f.root, peer.session, { previewHash: preview.previewHash, flags, reason: 'The complete generated consumer forecast is reviewed for this fixture.' });
    forecasts.set(peer.sessionId, committed.forecast);
    assert.deepEqual(plans.planHistoryErrors(peer.session, peer.state()), []);
    await f.invoke('enrolWorkflow', peer, coordinator.sessionId);
  }
  await f.invoke('assignWorkflows', coordinator, { id: 'initial-owners', claims: f.claims });
  const dependencies = [a, b].map(peer => ({ consumerSessionId: peer.sessionId, kind: 'units', cells: Object.entries(forecasts.get(peer.sessionId).steps).filter(([, operator]) => operator === 'data.seed').map(([cell]) => cell) }));
  const prepared = await f.invoke('prepareExtraction', coordinator, { ...f.specification, dependencies });
  const record = read(path.join(coordinator.session, prepared.ref));
  for (const dependency of record.dependencies) {
    assert.equal(dependency.cells.length, 1);
    assert.deepEqual(dependency.nodes, dependency.cells.map(cell => forecasts.get(dependency.consumerSessionId).nodes[cell]));
    assert.equal(dependency.nodes.length, 1, 'the dependency retains a planner-issued logical identity');
  }
  await f.invoke('enrolWorkflow', c, coordinator.sessionId, { preparation: prepared });
  const assignment = await f.invoke('activateExtraction', coordinator, prepared);
  for (const peer of [a, b]) {
    const forecast = forecasts.get(peer.sessionId), selected = dependencies.find(dependency => dependency.consumerSessionId === peer.sessionId).cells[0];
    assert.match((await f.admission(peer, f.request(peer, `src/modules/${peer === a ? 'a' : 'b'}`, assignment, selected))).join('\n'), /COORDINATION_WAIT/);
    const independent = Object.keys(forecast.steps).find(cell => cell !== selected);
    assert.ok(independent, 'the generated chain contains unaffected prerequisite work');
    assert.deepEqual(await f.admission(peer, f.request(peer, `src/modules/${peer === a ? 'a' : 'b'}`, assignment, independent)), []);
    assert.deepEqual(plans.planHistoryErrors(peer.session, peer.state()), []);
  }
});

test('only an accepted exact producer import wakes selected consumers; unaccepted, changed and foreign proof cannot wake them', async t => {
  const f = await fixture(t), { a, b, c, coordinator } = f;
  await f.invoke('enrolWorkflow', a, coordinator.sessionId); await f.invoke('enrolWorkflow', b, coordinator.sessionId);
  await f.invoke('assignWorkflows', coordinator, { id: 'initial-owners', claims: f.claims });
  const prepared = await f.invoke('prepareExtraction', coordinator, f.specification);
  await f.invoke('enrolWorkflow', c, coordinator.sessionId, { preparation: prepared });
  const assignment = await f.invoke('activateExtraction', coordinator, prepared);
  const producer = await producePlan(f, c, { assignment, accept: false });
  const dependencyA = 'extract-shared:consumer-a:units', dependencyB = 'extract-shared:consumer-b:units';
  await assert.rejects(f.invoke('resolveExtraction', coordinator, dependencyA, { step: 1, parallel: 1 }), /matched accepted attempt/);
  assert.deepEqual(coordinator.state().coordination.active, assignment, 'unaccepted done creates no resolution revision');
  assert.equal((await producer.accept()).state, 'matched');
  const modelFile = path.join(producer.branch, 'response/data/units.json'), modelBytes = readFileSync(modelFile);
  put(modelFile, { ...read(modelFile), units: [] });
  await assert.rejects(f.invoke('resolveExtraction', coordinator, dependencyA, { step: 1, parallel: 1 }), /evidenceManifest/);
  put(modelFile, modelBytes);
  const resolvedA = await f.invoke('resolveExtraction', coordinator, dependencyA, { step: 1, parallel: 1 });
  assert.deepEqual(await f.invoke('resolveExtraction', coordinator, dependencyA, { step: 1, parallel: 1 }), resolvedA);
  const aRequest = f.request(a, 'src/modules/a', resolvedA, '2/1'), bRequest = f.request(b, 'src/modules/b', resolvedA, '2/1');
  assert.match((await f.admission(a, aRequest)).join('\n'), /COORDINATION_INPUT/, 'accepted producer alone does not bind the consumer artifact');
  assert.match((await f.admission(b, bRequest)).join('\n'), /COORDINATION_WAIT/, 'resolving A does not resolve B');
  const { importProducer } = await f.moduleAt('scripts/producer-import.mjs');
  const importInto = (sourcePeer, targetPeer, step = 100) => importProducer({ root: f.root, hostRoot: f.source, sourceSessionId: sourcePeer.sessionId, sourceStep: 1, sourceParallel: 1, targetSessionId: targetPeer.sessionId, targetStep: step, targetParallel: 1 });
  await importInto(c, a); aRequest.inputs.units = 'step-100/parallel-1/response/data/units.json'; aRequest.inputs['seed-plan'] = 'step-100/parallel-1/response/response.md';
  assert.deepEqual(await f.admission(a, aRequest), []);
  const copiedModel = path.join(a.session, aRequest.inputs.units); put(copiedModel, '{}');
  assert.match((await f.admission(a, aRequest)).join('\n'), /COORDINATION_INPUT.*bytes or origin/);
  put(copiedModel, modelBytes);
  const otherProducer = await f.open('foreign-proof'); await producePlan(f, otherProducer); await importInto(otherProducer, a, 101);
  aRequest.inputs.units = 'step-101/parallel-1/response/data/units.json';
  assert.match((await f.admission(a, aRequest)).join('\n'), /COORDINATION_INPUT.*another producer/);
  aRequest.inputs.units = 'step-100/parallel-1/response/data/units.json';
  const resolvedB = await f.invoke('resolveExtraction', coordinator, dependencyB, { step: 1, parallel: 1 });
  await importInto(c, b); bRequest.inputs = { ...aRequest.inputs }; bRequest.coordination.assignment = resolvedB;
  assert.deepEqual(await f.admission(b, bRequest), []); assert.deepEqual(await f.admission(a, aRequest), []);
  const snapshot = read(path.join(coordinator.session, resolvedB.ref));
  assert.equal(snapshot.dependencies[0].proof.manifestFingerprint, snapshot.dependencies[1].proof.manifestFingerprint);
  assert.deepEqual(snapshot.dependencies[0].proof.artifacts, snapshot.dependencies[1].proof.artifacts);
});

test('one consumer retains independent dependencies for distinct accepted output kinds', async t => {
  const f=await fixture(t),{a,b,c,coordinator}=f;
  await f.invoke('enrolWorkflow',a,coordinator.sessionId);await f.invoke('enrolWorkflow',b,coordinator.sessionId);
  await f.invoke('assignWorkflows',coordinator,{id:'initial-owners',claims:f.claims});
  const dependencies=[{consumerSessionId:a.sessionId,kind:'units',cells:['2/1']},{consumerSessionId:a.sessionId,kind:'seed-plan',cells:['2/1']}];
  const prepared=await f.invoke('prepareExtraction',coordinator,{...f.specification,dependencies});
  await f.invoke('enrolWorkflow',c,coordinator.sessionId,{preparation:prepared});
  const active=await f.invoke('activateExtraction',coordinator,prepared),before=read(path.join(coordinator.session,active.ref));
  assert.equal(new Set(before.dependencies.map(item=>item.id)).size,2,'typed output dependencies cannot share an identity');
  await producePlan(f,c,{assignment:active});
  const units=before.dependencies.find(item=>item.kind==='units'),plan=before.dependencies.find(item=>item.kind==='seed-plan');
  const first=await f.invoke('resolveExtraction',coordinator,units.id,{step:1,parallel:1}),one=read(path.join(coordinator.session,first.ref));
  assert.ok(one.dependencies.find(item=>item.id===units.id).proof);
  assert.equal(one.dependencies.find(item=>item.id===plan.id).proof,null,'one accepted kind never resolves another obligation');
  const second=await f.invoke('resolveExtraction',coordinator,plan.id,{step:1,parallel:1});
  assert.ok(read(path.join(coordinator.session,second.ref)).dependencies.every(item=>item.proof));
});

test('duplicate same-consumer same-kind dependency rows refuse before preparation is retained', async t => {
  const f=await fixture(t),{a,b,coordinator}=f;
  await f.invoke('enrolWorkflow',a,coordinator.sessionId);await f.invoke('enrolWorkflow',b,coordinator.sessionId);
  await f.invoke('assignWorkflows',coordinator,{id:'initial-owners',claims:f.claims});
  const before=readFileSync(coordinator.stateFile),row={consumerSessionId:a.sessionId,kind:'units',cells:['2/1']};
  await assert.rejects(f.invoke('prepareExtraction',coordinator,{...f.specification,dependencies:[row,{...row,cells:['3/1']}]}),/COORDINATION_DEPENDENCY.*duplicate/);
  assert.deepEqual(readFileSync(coordinator.stateFile),before);
});

test('broad ownership extracts a subtree during independent work and rejects holes, overlaps and filesystem aliases', async t => {
  const f = await fixture(t), { a, b, c, coordinator } = f;
  await f.invoke('enrolWorkflow', a, coordinator.sessionId); await f.invoke('enrolWorkflow', b, coordinator.sessionId);
  const initial = await f.invoke('assignWorkflows', coordinator, { id: 'broad-owner', claims: [{ sessionId: a.sessionId, role: 'be', root: 'src/modules' }] });
  const originalAssignmentBytes = readFileSync(path.join(coordinator.session, initial.ref));
  const broad = f.request(a, 'src/modules', initial), independent = f.request(a, 'src/modules/a', initial);
  for (const [id, roots] of [['duplicate-transfer', ['src/modules/shared', 'src/modules/shared']], ['nested-transfer', ['src/modules/shared', 'src/modules/shared/deeper']]]) {
    await assert.rejects(f.invoke('prepareExtraction', coordinator, { ...f.specification, id, selections: [{ impactId: 'bounded', roots }] }), /COORDINATION_EXTRACTION|COORDINATION_SCOPE/);
  }
  const requestRef = 'step-3/parallel-1/request/request.json'; put(path.join(a.session, requestRef), independent);
  const independentBytes = readFileSync(path.join(a.session, requestRef));
  const { mutateSession } = await f.moduleAt('scripts/session-lock.mjs');
  await mutateSession(a.session, async state => {
    assert.deepEqual(await f.coordinationAdmissionErrors(f.root, a.session, state, independent), []);
    state.requestHashes['3/1'] = `sha256:${sha(independentBytes)}`;
    state.attempts['3/1'] = { id: 'independent-reservation', operatorId: independent.operatorId, status: 'running', requestRef };
  });
  const prepared = await f.invoke('prepareExtraction', coordinator, f.specification);
  await f.invoke('enrolWorkflow', c, coordinator.sessionId, { preparation: prepared });
  const transferred = await f.invoke('activateExtraction', coordinator, prepared);
  const assignment = read(path.join(coordinator.session, transferred.ref));
  assert.deepEqual(assignment.claims.find(claim => claim.ownerSessionId === a.sessionId).excludes, ['src/modules/shared']);
  assert.equal(assignment.claims.find(claim => claim.ownerSessionId === c.sessionId).root, 'src/modules/shared');
  assert.match((await f.admission(a, broad)).join('\n'), /COORDINATION_OWNED/);
  assert.deepEqual(await f.admission(a, independent), [], 'the running sibling reservation remains authorized');
  assert.equal(a.state().attempts['3/1'].status, 'running'); assert.deepEqual(readFileSync(path.join(a.session, requestRef)), independentBytes);
  assert.deepEqual(await f.admission(c, f.request(c, 'src/modules/shared', transferred)), []);
  assert.match((await f.admission(c, f.request(c, 'src/modules/a', transferred))).join('\n'), /COORDINATION_OWNED/);
  const otherCheckout = f.request(a, 'src/modules/a', transferred);
  otherCheckout.environment.writes = [path.join(c.worktree, 'src/modules/shared/contract.txt')];
  assert.match((await f.admission(a, otherCheckout)).join('\n'), /COORDINATION_OWNED/, 'another linked checkout cannot hide the reserved repository-relative subtree');
  const localLink = path.join(a.worktree, 'src/modules/a/shared-link');
  symlinkSync(path.join(a.worktree, 'src/modules/shared'), localLink, process.platform === 'win32' ? 'junction' : 'dir');
  assert.match((await f.admission(a, f.request(a, 'src/modules/a/shared-link/new.txt', transferred))).join('\n'), /COORDINATION_OWNED/);
  const foreignLink = path.join(a.worktree, 'src/modules/a/foreign-link');
  symlinkSync(path.join(c.worktree, 'src/modules/shared'), foreignLink, process.platform === 'win32' ? 'junction' : 'dir');
  assert.match((await f.admission(a, f.request(a, 'src/modules/a/foreign-link/new.txt', transferred))).join('\n'), /COORDINATION_ROOT/);
  for (const [name, expected] of [['shared-link', /COORDINATION_OWNED/], ['foreign-link', /COORDINATION_ROOT/]]) {
    const routed = f.request(a, `src/modules/a/${name}/new.txt`, transferred); routed.environment.workspace = null;
    assert.match((await f.admission(a, routed)).join('\n'), expected, 'an unbound alias still resolves its actual routed checkout before ownership admission');
  }
  const next = await f.open('next-producer', { draft: true });
  await assert.rejects(f.invoke('prepareExtraction', coordinator, { ...f.specification, id: 'excluded-subtree', producerSessionId: next.sessionId, selections: [{ impactId: 'bounded', roots: ['src/modules/shared/deeper'] }] }), /uninterrupted donor owner/);
  const savedState = readFileSync(coordinator.stateFile);
  const { retainContext } = await f.moduleAt('scripts/mission-history.mjs');
  for (const [id, corrupt] of [
    ['hole', claims => claims.splice(claims.findIndex(claim => claim.ownerSessionId === c.sessionId), 1)],
    ['overlap', claims => { delete claims.find(claim => claim.ownerSessionId === a.sessionId).excludes; }],
    ['duplicate-exclusions', claims => claims.find(claim => claim.ownerSessionId === a.sessionId).excludes.push('src/modules/shared')],
    ['nested-exclusions', claims => claims.find(claim => claim.ownerSessionId === a.sessionId).excludes.push('src/modules/shared/deeper')]
  ]) {
    try {
      const forged = structuredClone(assignment); forged.id = id; forged.previous = transferred; corrupt(forged.claims);
      // A consistent address cannot make malformed ownership legal. Only the negative case writes
      // this forged revision; every positive assignment above came through its public mutation.
      const address = await retainContext(coordinator.session, 'assignments', forged);
      const state = coordinator.state(); state.coordination.revisions.push(address); state.coordination.active = address; put(coordinator.stateFile, state);
      assert.match((await f.admission(a, independent)).join('\n'), /COORDINATION_ASSIGNMENT/, id);
    } finally { put(coordinator.stateFile, savedState); }
  }
  assert.deepEqual(readFileSync(path.join(coordinator.session, initial.ref)), originalAssignmentBytes);
});

test('normal scope correction or revocation after preparation cannot reuse old authority for producer enrolment or transfer', async t => {
  for (const scenario of [
    { name: 'coordinator confirms a corrected scope', actor: 'coordinator', reconfirm: true },
    { name: 'donor confirms a corrected scope', actor: 'a', reconfirm: true },
    { name: 'consumer confirms a corrected scope', actor: 'b', reconfirm: true },
    { name: 'consumer revokes its confirmation with a corrected draft', actor: 'b' },
    { name: 'donor corrects its scope after producer enrolment', actor: 'a', enrolled: true },
    { name: 'producer changes its untouched draft after preparation', actor: 'c' }
  ]) await t.test(scenario.name, async child => {
    const f = await fixture(child), { coordinator, a, b, c } = f;
    const { confirmSession } = await f.moduleAt('scripts/v23-test-fixture.mjs');
    await f.invoke('enrolWorkflow', a, coordinator.sessionId); await f.invoke('enrolWorkflow', b, coordinator.sessionId);
    const initial = await f.invoke('assignWorkflows', coordinator, { id: 'original-authority', claims: f.claims });
    const prepared = await f.invoke('prepareExtraction', coordinator, f.specification);
    const historicalRequest = f.request(a, 'src/modules/shared', initial);
    if (scenario.enrolled) await f.invoke('enrolWorkflow', c, coordinator.sessionId, { preparation: prepared });
    const sealFiles = [path.join(coordinator.session, initial.ref), path.join(coordinator.session, prepared.ref),
      ...[coordinator, a, b, c].flatMap(peer => Object.values(peer.state().missionSnapshots ?? {}).map(address => path.join(peer.session, address.ref)))];
    const originals = new Map(sealFiles.map(file => [file, readFileSync(file)]));
    const actor = f[scenario.actor], previous = actor.state().mission;
    const corrected = await confirmSession(actor.session, { selected: 'corrected', selectedBy: 'user', sourceRef: `user:${actor.sessionId}:corrected`, mission: {
      ...structuredClone(previous), goal: `${previous.goal} Apply the newly corrected boundary.`, includes: [...previous.includes, 'The corrected boundary supersedes the earlier authority.']
    } });
    assert.equal(corrected.status, 'corrected'); assert.equal(actor.state().mission.version, previous.version + 1);
    assert.equal(actor.state().lifecycle.phase, 'draft', 'normal correction revokes dispatch until the new draft is confirmed');
    if (scenario.reconfirm) {
      assert.equal((await confirmSession(actor.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: `user:${actor.sessionId}:corrected-confirmed` })).status, 'confirmed');
      assert.equal(actor.state().mission.confirmation.status, 'confirmed', 'a newly valid scope still cannot authorize the older extraction');
    }
    await assert.rejects(f.invoke('enrolWorkflow', c, coordinator.sessionId, { preparation: prepared }), /COORDINATION_SCOPE/);
    await assert.rejects(f.invoke('activateExtraction', coordinator, prepared), scenario.actor === 'c' ? /COORDINATION_ENROLMENT/ : /COORDINATION_SCOPE/);
    assert.deepEqual(coordinator.state().coordination.active, initial);
    assert.deepEqual(coordinator.state().coordination.revisions, [initial], 'no replacement ownership seal is published');
    assert.deepEqual(coordinator.state().coordination.preparations, [prepared], 'the old preparation remains available as immutable history');
    for (const [file, bytes] of originals) assert.deepEqual(readFileSync(file), bytes, `retained seal changed: ${file}`);
    assert.match((await f.admission(a, historicalRequest, { historical: true })).join('\n'), /COORDINATION_HISTORY/, 'an earlier selector alone does not establish accepted history');
    if (scenario.actor !== 'c') assert.match((await f.admission(a, historicalRequest)).join('\n'), /COORDINATION_SCOPE/, 'current admission cannot reuse revoked or superseded authority');
    if (!scenario.enrolled) assert.equal(c.state().lifecycle.phase, 'draft', 'failed derived enrolment never activates the producer');
  });
});
