// Fixture-only runtime integration through the existing current runtime.serve and server helper.
// The server is authored as disposable baseline input before any workflow scope is opened.
import assert from 'node:assert/strict';
import path from 'node:path';
import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sha, read, put, git, table, branch, current, actual, planCells, open, accept } from './workflow-source-fixture.mjs';

export const INTEGRATION_SERVER_REF = 'src/modules/integration/server.mjs';
export const INTEGRATION_SERVER_SOURCE = `import assert from 'node:assert/strict';
import http from 'node:http';
import { runFixtureWorker as consumerA } from '../a/worker.mjs';
import { runFixtureWorker as consumerB } from '../../consumers/b/worker.mjs';
export function resultFor(value) { const a = consumerA(value), b = consumerB(value); assert.equal(a,b,'Both actual consumer implementations must agree'); return {value:a,consumers:['consumer-a','consumer-b']}; }
if(process.argv.includes('--check')) { for(const value of ['hello','','again']) assert.equal(resultFor(value).value,value.toUpperCase()); for(const fn of [consumerA,consumerB]) assert.throws(()=>fn(null),TypeError); console.log('Both actual consumer implementations agree on valid, empty, repeated and invalid input.'); }
else { const flag=process.argv.indexOf('--port'),port=Number(process.argv[flag+1]); assert.ok(flag>=0&&Number.isInteger(port)&&port>0); const server=http.createServer((request,response)=>{ const url=new URL(request.url,'http://127.0.0.1'); if(url.pathname!=='/api'){response.writeHead(404);response.end();return;} const value=url.searchParams.get('value'); response.writeHead(200,{'content-type':'application/json'}); response.end(JSON.stringify(value===null?{value:'ready',consumers:['consumer-a','consumer-b']}:resultFor(value))); }); server.listen(port,'127.0.0.1',()=>console.log('Integrated fixture API listening on '+port)); }
`;

const quote = value => '`' + value + '`';
const responseRef = step => `step-${step}/parallel-1/response/response.md`;
async function unusedPort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

// t is mandatory. Call returned stop() in the caller's finally before its fixture home is removed;
// the hook is a second guard, and acceptance failure also stops an already started process here.
export async function acceptRuntimeIntegration(f, { targetHead, baseHead, worktree }, {
  t, step, goal = { prerequisite: `${step + 1}/1` }, coordination = null, changes = null,
} = {}) {
  assert.ok(t && typeof t.after === 'function', 'runtime fixture requires its owning test cleanup context');
  assert.ok(Number.isInteger(step), 'runtime fixture requires an actual planned step');
  worktree = path.resolve(worktree);
  assert.ok(worktree.startsWith(path.resolve(f.home) + path.sep), 'integration checkout stays in its disposable home');
  assert.equal(existsSync(worktree), false, 'runtime fixture never replaces an existing checkout');
  assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), baseHead, 'consumer B remains on its terminal source head');
  for (const head of [baseHead, targetHead]) assert.equal(git(f.repository, 'rev-parse', `${head}^{commit}`), head);
  const pkg = JSON.parse(git(f.repository, 'show', `${baseHead}:package.json`));
  assert.equal(pkg.scripts.dev, `node ${INTEGRATION_SERVER_REF}`, 'the initial source owns the dev command');
  assert.match(pkg.scripts.build, /^node --test [a-zA-Z0-9_./ -]+$/, 'the fixture build is the actual declared Node test command');
  assert.equal(git(f.repository, 'show', `${baseHead}:${INTEGRATION_SERVER_REF}`), INTEGRATION_SERVER_SOURCE.trimEnd());
  const { stackDeclaration } = await f.load('scripts/validate-request.mjs');
  const { acquireWorkerSlot } = await f.load('scripts/worker-slots.mjs');
  const { RUNG_CHECKS } = await f.load('operators/runtime-serve/validate.mjs');
  const serving = await f.load('scripts/serve-runtime.mjs');
  const state = f.state(), project = state.project, routeKey = `${project}/be`, env = 'dev';
  const integrationBranch = `integration/${project}`, port = await unusedPort();
  const endpoint = `http://127.0.0.1:${port}/api`, ownerRef = 'fixture-runtime-owner';
  const dir = branch(f, step), registryFile = path.join(f.source, '.worktrees/sessions/central-runtime/owner.json');
  const registryBefore = existsSync(registryFile) ? read(registryFile) : null;
  assert.equal(registryBefore?.runtimes?.[routeKey], undefined, 'only an absent target route may be initialized by this fixture');
  const registryBytes = existsSync(registryFile) ? readFileSync(registryFile) : null;
  const plan = { routeKey, operation: 'serve', worktree, branch: integrationBranch, baseHead, targetHead,
    port, endpoint, dev: pkg.scripts.dev, build: pkg.scripts.build,
    integrationTests: ['src/modules/fixture/worker.spec.mjs', 'src/modules/a/worker.spec.mjs', 'src/consumers/b/worker.spec.mjs'] };
  put(path.join(dir, 'request/runtime-plan.json'), plan);
  const planSha256 = sha(readFileSync(path.join(dir, 'request/runtime-plan.json')));
  put(path.join(f.source, '.stacks/dev/environment.json'), { schemaVersion: 9, env, production: false });
  const declaration = await stackDeclaration(f.root, env, f.source);
  const effects = ['register-runtime-entry', 'merge-into-integration-branch', 'serve-runtime-head', 'attest-runtime-entry'];
  const requirements = { routeKey, env, operation: 'serve', commit: targetHead, approval: declaration.reference,
    portClaims: [{ port, resourceRef: routeKey }], desiredState: { planSha256, serviceKind: 'runtime', resourceRefs: [routeKey], effects,
      mutableResourceRefs: [routeKey], observationOnlyResourceRefs: [] } };
  planCells(f, [[step, 'runtime.serve']]);
  const request = current(f, { operatorId: 'runtime.serve', contexts: [], requirements, inputs: changes ? { changes } : {} }, step,
    { goal, workspace: false, mode: 'inline', coordination });
  request.environment.writes = ['@worktrees/sessions/central-runtime', '@tools/git'];
  request.environment.exclusive = [path.dirname(registryFile), worktree];
  request.frozenInputs = [{ ref: 'request/runtime-plan.json', sha256: planSha256 }];
  await open(f, request);
  const slot = await acquireWorkerSlot(dir, 'fixture-runtime-integrator', { ranProfile: 'sol-fresh' });
  assert.equal(slot.status, 'acquired');
  assert.equal(existsSync(worktree), false, 'official open and acquire precede the first integration checkout write');
  assert.deepEqual(existsSync(registryFile) ? readFileSync(registryFile) : null, registryBytes, 'inventory did not change during admission');
  assert.equal(await serving.portTaken(port), false, 'the frozen port is still free; this fixture never substitutes another port');
  const inventory = { routeKey, observedAt: new Date().toISOString(), registry: registryBefore,
    registrySha256: registryBytes ? sha(registryBytes) : null, entry: null, port: { port, answered: false, listenerPid: serving.listenerPidByPort(port) },
    declaration: { ref: declaration.reference, dev: pkg.scripts.dev }, integrationCheckoutExisted: false };
  assert.equal(inventory.port.listenerPid, null);
  put(path.join(dir, 'response/data/inventory.json'), inventory);
  const fingerprint = sha(readFileSync(path.join(dir, 'response/data/inventory.json')));
  const custodyRef = 'response/data/custody.json';
  put(path.join(dir, custodyRef), { ownerRef, sessionId: state.id, attemptId: request.attempt.id, workerId: 'fixture-runtime-integrator',
    acquiredAt: slot.lease?.acquiredAt ?? f.state().workerSlots.find(lease => lease.attemptId === request.attempt.id)?.acquiredAt,
    exclusive: request.environment.exclusive, capability: 'runtime:registry-write' });
  const registry = structuredClone(registryBefore ?? { schemaVersion: 9, ownerTaskId: ownerRef, generation: 0, updatedAt: inventory.observedAt, runtimes: {} });
  assert.equal(registry.ownerTaskId, ownerRef);
  const lease = { sessionId: state.id, since: new Date().toISOString(), operation: 'serve', queue: [] };
  let entry = { endpoints: { frontend: endpoint, api: endpoint, identity: endpoint }, branch: integrationBranch, head: baseHead,
    contains: [baseHead], generation: 0, status: 'starting', healthEvidenceRefs: ['response/data/inventory.json'], identity: null, server: null, lease };
  const mutations = [], revisions = [];
  const publish = effect => {
    const beforeRevision = entry.generation ? `g-${entry.generation}` : 'absent';
    entry.generation += 1; registry.generation += 1; registry.updatedAt = new Date().toISOString(); registry.runtimes[routeKey] = structuredClone(entry);
    put(registryFile, registry);
    const evidenceRef = `response/data/registry-${entry.generation}.json`;
    put(path.join(dir, evidenceRef), readFileSync(registryFile));
    revisions.push({ effect, evidenceRef, sha256: sha(readFileSync(registryFile)) });
    mutations.push({ effect, resourceRef: routeKey, beforeRevision, afterRevision: `g-${entry.generation}` });
  };
  const log = path.join(dir, 'response/artifacts/integration-runtime.log');
  let record = null, stopped = false;
  const stop = async () => {
    record ??= serving.readRecord(serving.pidFileOf(log));
    if (stopped || !record) return { stopped };
    const result = await serving.stop(record.pidFileRef);
    assert.equal(result.stopped, true, `owned runtime stop failed: ${JSON.stringify(result)}`);
    assert.equal(await serving.portTaken(port), false, 'owned runtime stop actually frees its frozen port');
    stopped = true; return result;
  };
  t.after(stop);
  try {
    publish('register-runtime-entry');
    const acquired = read(registryFile).runtimes[routeKey]; assert.deepEqual(acquired.lease, lease);
    git(f.repository, 'worktree', 'add', '--quiet', '-b', integrationBranch, worktree, baseHead);
    assert.equal(git(worktree, 'rev-parse', 'HEAD'), baseHead);
    git(worktree, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'merge', '--no-ff', '-m', 'Integrate both accepted fixture consumers', targetHead);
    const head = git(worktree, 'rev-parse', 'HEAD');
    const parents = git(worktree, 'show', '-s', '--format=%P', 'HEAD').split(' ');
    assert.deepEqual(parents, [baseHead, targetHead]);
    const contains = [...new Set([head, baseHead, targetHead])];
    for (const commit of contains) assert.equal(git(worktree, 'merge-base', '--is-ancestor', commit, head), '');
    assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), baseHead, 'merging the runtime never moves B source checkout');
    assert.equal(git(worktree, 'status', '--porcelain=v1'), '');
    entry.head = head; entry.contains = contains; publish('merge-into-integration-branch');
    const mergeRef = 'response/data/merge.json';
    put(path.join(dir, mergeRef), { worktree, branch: integrationBranch, baseHead, targetHead, head, parents, contains,
      consumerHeadAfter: git(f.worktree, 'rev-parse', 'HEAD'), status: git(worktree, 'status', '--porcelain=v1') });
    assert.deepEqual(read(path.join(worktree, 'package.json')).scripts, pkg.scripts, 'merge retains the source-owned delivery/dev scripts');
    const gateEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NODE_TEST_')));
    const commands = [{ id: 'build', args: pkg.scripts.build.slice(5).split(/\s+/), configRef: 'package.json' },
      { id: 'both-consumers', args: ['--test', ...plan.integrationTests], configRef: plan.integrationTests.join(', ') },
      { id: 'server-contract', args: [INTEGRATION_SERVER_REF, '--check'], configRef: INTEGRATION_SERVER_REF }];
    const gates = commands.map(command => {
      const measured = spawnSync(process.execPath, command.args, { cwd: worktree, encoding: 'utf8', windowsHide: true, env: gateEnv, timeout: 30000 });
      const evidenceRef = `response/artifacts/${command.id}.log`;
      put(path.join(dir, evidenceRef), String(measured.stdout ?? '') + String(measured.stderr ?? ''));
      assert.equal(measured.error, undefined, `${command.id}: ${measured.error}`);
      assert.equal(measured.status, 0, `${command.id}: ${measured.stdout}\n${measured.stderr}`);
      return { id: command.id, command: `node ${command.args.join(' ')}`, configRef: command.configRef, worktree, head, exitCode: measured.status, evidenceRef };
    });
    put(path.join(dir, 'response/data/gates.json'), gates);
    assert.equal(git(worktree, 'status', '--porcelain=v1'), '', 'actual delivery gates leave the integration source clean');
    record = await serving.start({ worktree, port, log, command: `${pkg.scripts.dev} --port ${port}`, wait: 15000 });
    assert.equal(record.answered, true); assert.equal(record.reused, false); assert.equal(record.head, head);
    assert.equal(serving.alive(record.pid), true); assert.equal(record.listenerPid, serving.listenerPidByPort(port));
    assert.ok(record.listenerPid > 0);
    const server = { worktree, pid: record.pid, listenerPid: record.listenerPid, port, command: record.command,
      logRef: record.logRef, pidFileRef: record.pidFileRef, startedAt: record.startedAt };
    entry.server = server; publish('serve-runtime-head');
    put(path.join(dir, 'response/data/server.json'), record);
    const probes = [];
    for (const value of [null, 'hello', '', 'again']) {
      const url = new URL(endpoint); if (value !== null) url.searchParams.set('value', value);
      const startedAt = new Date().toISOString(), response = await fetch(url, { signal: AbortSignal.timeout(5000) }), body = await response.json();
      assert.equal(response.status, 200); assert.equal(body.value, value === null ? 'ready' : value.toUpperCase());
      assert.deepEqual(body.consumers, ['consumer-a', 'consumer-b']);
      probes.push({ url: url.href, status: response.status, body, startedAt, endedAt: new Date().toISOString() });
    }
    put(path.join(dir, 'response/data/http.json'), probes);
    assert.deepEqual(read(registryFile).runtimes[routeKey].lease, lease, 'the same lease orders merge, gates and server startup');
    entry.status = 'ready'; entry.lease = null; entry.healthEvidenceRefs = [path.join(dir, 'response/data/http.json')]; publish('attest-runtime-entry');
    const leaseRef = 'response/data/lease.json';
    put(path.join(dir, leaseRef), { held: lease, revisions, releasedAt: registry.updatedAt,
      final: read(registryFile).runtimes[routeKey].lease, slot: { workerId: 'fixture-runtime-integrator', exclusive: request.environment.exclusive } });
    assert.equal(read(registryFile).runtimes[routeKey].lease, null);
    const evidenceByCheck = { 'entry-declared': 'response/data/inventory.json', 'endpoints-served': 'response/data/http.json',
      'head-observed': mergeRef, 'generation-advanced': leaseRef, 'integration-merged': mergeRef, 'server-pid-owned': 'response/data/server.json',
      'lease-honoured': leaseRef, 'gates-passed': 'response/data/gates.json' };
    const checks = RUNG_CHECKS.serve.map(name => ({ name, resourceRef: routeKey, status: 'passed', evidenceRef: evidenceByCheck[name] }));
    const findings = [{ code: 'RUNTIME_HEAD_SERVED', resourceRef: routeKey, port: null, holderRef: null,
      statement: 'Both actual consumer commits were merged; declared build and separate consumer tests passed; the recorded detached server answered both implementations under a released lease.' }];
    const delta = { serviceRef: routeKey, serviceKind: 'runtime', ownerRef, approvalRef: declaration.reference, planSha256, inventoryFingerprint: fingerprint,
      generation: entry.generation, observedAt: new Date().toISOString(), inventoriedResources: [{ resourceRef: routeKey, kind: 'runtime', revision: 'absent', ownerRef }],
      observedPortHolders: [], portClaims: requirements.portClaims, mutableResourceRefs: [routeKey], observationOnlyResourceRefs: [], allowedEffects: effects,
      appliedEffects: effects, capabilities: [{ capability: 'runtime:registry-write', custodyEvidenceRef: custodyRef }], convergence: 'converged', mutations,
      runtimeLadder: { routeKey, operation: 'serve', rung: 'serve', reused: false, sessionId: state.id, wantedCommit: targetHead, servedHead: head, contains,
        integration: { worktreeRef: worktree, branch: integrationBranch, createdFrom: git(f.worktree, 'branch', '--show-current'),
          merges: [{ ref: targetHead, commit: targetHead, mergeCommit: head, kind: 'session', resolutions: [] }], conflict: false }, infra: null, locations: [],
        observed: { head: null, containsWanted: false, pid: null, pidAlive: false, probeAnswered: false, leaseSessionId: null, queue: [] },
        server: { pid: record.pid, previousPid: null, port, command: record.command, logRef: record.logRef, pidFileRef: record.pidFileRef, startedAt: record.startedAt, cache: record.cache }, queuePosition: null, lease: null } };
    const receipt = '# platform-operation-receipt — runtime ' + routeKey + '\n\nOperator Result: ' + endpoint + ', generation ' + entry.generation + ', served head ' + head + '.\n'
      + table('Binding', ['Field', 'Value'], [['Operator', quote('runtime.serve')], ['Step', quote(`step-${step}/parallel-1`)], ['Project', quote(project)], ['Service', routeKey], ['Service kind', 'runtime'], ['Owner', quote(ownerRef)], ['Approval', declaration.reference], ['Desired state', quote(planSha256)], ['Inventory fingerprint', quote(fingerprint)]])
      + table('Convergence', ['Field', 'Value'], [['Convergence', 'converged']])
      + table('Inventoried resources', ['Resource', 'Kind', 'Revision', 'Owner'], [[quote(routeKey), 'runtime', 'absent', quote(ownerRef)]])
      + table('Port holders', ['Port', 'Holder', 'Evidence'])
      + table('Mutations', ['Effect', 'Resource', 'Before', 'After'], mutations.map(item => [quote(item.effect), quote(routeKey), item.beforeRevision, item.afterRevision]))
      + table('Checks', ['Check', 'Resource', 'Status', 'Evidence'], checks.map(item => [quote(item.name), quote(routeKey), item.status, quote(item.evidenceRef)]))
      + table('Findings', ['Code', 'Resource', 'Port', 'Holder', 'Statement'], findings.map(item => [quote(item.code), quote(routeKey), '—', '—', item.statement]));
    const files = git(worktree, 'diff', '--name-status', '--no-renames', baseHead, head).split('\n').filter(Boolean).map(line => line.split('\t'));
    const changesText = `# changes — runtime.serve step-${step}/parallel-1\n`
      + table('Binding', ['Field', 'Value'], [['Operator', 'runtime.serve'], ['Step', `step-${step}/parallel-1`], ['Checkout', worktree], ['Predecessor', changes ?? baseHead], ['Base', baseHead], ['Head', head], ['Branch', integrationBranch]])
      + table('Files', ['Path', 'Change', 'Why', 'Claims'], files.map(([status, file]) => [file, status === 'A' ? 'created' : status === 'D' ? 'deleted' : 'modified', 'Normal merge of accepted consumer source', 'Actual Git diff']))
      + '\n## What the next step must know\n\nThe detached runtime serves both consumer commits at the recorded merge head. B source checkout remains at its own terminal commit.\n';
    put(path.join(dir, 'response/response.md'), receipt); put(path.join(dir, 'response/changes.md'), changesText);
    put(path.join(dir, 'response/data/delta.json'), delta);
    put(path.join(dir, 'response/data/checks.json'), { serviceRef: routeKey, serviceKind: 'runtime', requiredCheckNames: RUNG_CHECKS.serve, checks, findings });
    // The actual contract names declared outputs. Their typed citations and the accepted manifest
    // bind the underlying logs, observations and registry snapshots without inventing output kinds.
    const evidence = ['response/response.md', 'response/changes.md', 'response/data/delta.json', 'response/data/checks.json'];
    await accept(f, request, actual(request, { fields: { 'platform-operation-receipt': 'response/response.md', delta: 'response/data/delta.json', checks: 'response/data/checks.json', changes: 'response/changes.md' }, fallbacks: [], commits: [], next: ['quality.verify'] }, 'done', evidence, 'sol-fresh'));
    const { acceptedProducerProof } = await f.load('scripts/producer-import.mjs');
    const proof = await acceptedProducerProof(f.root, state.id, step, 1, 'delta', { hostRoot: f.source });
    assert.equal(git(f.worktree, 'rev-parse', 'HEAD'), baseHead);
    return { step, head, base: baseHead, targetHead, worktree, ref: responseRef(step), changesRef: `step-${step}/parallel-1/response/changes.md`,
      request, proof, delta, entry: structuredClone(entry), record, endpoint, startedAt: record.startedAt, registryInitialized: true, ownerRef, registryFile, stop };
  } catch (error) { await stop(); throw error; }
}
