import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { runIngress, rehearsalArgs } from '../../packages/hfs/stack/ingress.mjs';
import { makeTree, makeVps, table, liveFiles, LIVE_HOSTS, HELPER_IMAGE } from '../helpers/stack-ingress-fakes.mjs';

const trees = [];
const tree = (...args) => {
  const made = makeTree(...args);
  trees.push(made);
  return made;
};
after(() => { for (const made of trees) made.cleanup(); });

const vpsWith = (extra = {}) => makeVps({ network: 'overlay', ...extra });
const call = (vps, config, options = {}, ssh = vps.run) => runIngress(vps.ctx, config, { action: 'rehearse', ...options }, { ssh });
const text = (result) => result.lines.join('\n');
const created = (vps) => vps.calls.filter((command) => /^docker '(volume' 'create|service' 'create|run)'/u.test(command));

/** Whatever happened, the live edge and the production store are never mutated and 80/443 are never published. */
function assertLiveEdgeUntouched(vps) {
  for (const command of vps.calls) {
    assert.doesNotMatch(command, /^docker '(stop|kill|rm|start)'/u, command);
    assert.doesNotMatch(command, /'(stop|kill|rm|start)'.*'app-edge-proxy'/u, command);
    assert.doesNotMatch(command, /published=(80|443)(,|')/u, command);
    assert.doesNotMatch(command, /'service' '(scale|update)'/u, command);
    if (/^docker 'volume' '(rm|create)'/u.test(command)) assert.match(command, /'edge_acme-rehearsal'/u, command);
    if (/^docker 'service' '(rm|create)'/u.test(command)) assert.match(command, /'edge-rehearsal'/u, command);
    if (command.includes("'edge_acme:")) assert.match(command, /'edge_acme:\/from:ro'/u, command);
  }
  assert.equal(vps.state.legacyRunning, true);
}

test('rehearse is an action; extra arguments are refused', async () => {
  const { config } = tree();
  await assert.rejects(call(vpsWith(), config, { args: ['x'] }), /STACK_USAGE/u);
});

test('rehearsal arguments move the http challenge to an unused entrypoint', () => {
  const args = rehearsalArgs(['--a=1', '--certificatesResolvers.le.acme.httpChallenge.entryPoint=web']);
  assert.deepEqual(args, ['--a=1', '--certificatesResolvers.le.acme.httpChallenge.entryPoint=rehearsal-unused', '--entrypoints.rehearsal-unused.address=127.0.0.1:1']);
});

test('dry run: preconditions and read-only probes only', async () => {
  const { config } = tree();
  const vps = vpsWith();
  const result = await call(vps, config);
  assert.equal(result.ok, true, text(result));
  assert.match(text(result), /precondition ok: plan green/u);
  assert.match(text(result), /live edge api\.tenant\.example\/: status 200/u);
  assert.match(text(result), /dry run: would copy edge_acme read-only into edge_acme-rehearsal, start edge-rehearsal on host ports 18080\/18443 with no certificate requests, compare 3 host\(s\)/u);
  assert.deepEqual(result.data.steps, ['plan', 'preconditions', 'baseline']);
  assert.deepEqual(created(vps), []);
  assertLiveEdgeUntouched(vps);
});

const REFUSALS = [
  ['plan not green', {}, { files: { ...liveFiles(), 'x.yml': JSON.stringify({ http: { routers: { x: { rule: 'Host(`orphan.example`)', service: 's' } } } }) } }, /precondition FAILED: plan green/u],
  ['network missing', {}, { network: 'missing' }, /precondition FAILED: network edge-shared/u],
  ['certificates volume missing', {}, { volume: false }, /precondition FAILED: certificates volume edge_acme present/u],
  ['no helper image', { helper: false }, {}, /precondition FAILED: helper image declared/u],
  ['service unreadable', {}, { fail: new Set(['spec']) }, /precondition FAILED: swarm service edge_ingress readable/u],
  ['service spec is not json', {}, { specRaw: 'nope' }, /readable/u],
  ['service spec without arguments', {}, { ingressSpec: { Image: 'p:1', Args: null, Mounts: [] } }, /readable/u],
  ['service spec without the mounts', {}, { ingressSpec: { Image: 'p:1', Args: ['--a'], Mounts: 'x' } }, /readable/u],
  ['leftover service', {}, { rehearsal: { volume: false, service: true } }, /precondition FAILED: no leftover edge-rehearsal service or edge_acme-rehearsal volume/u],
  ['leftover volume', {}, { rehearsal: { volume: true, service: false } }, /no leftover/u],
];

for (const [title, treeOptions, extra, pattern] of REFUSALS) {
  test(`rehearse refuses and creates nothing: ${title}`, async () => {
    const { config } = tree({}, treeOptions);
    const vps = vpsWith(extra);
    const result = await call(vps, config, { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), pattern);
    assert.match(text(result), /rehearsal refused: nothing was changed/u);
    assert.deepEqual(created(vps), []);
    assertLiveEdgeUntouched(vps);
  });
}

test('rehearse stops at once when the edge directory cannot be read', async () => {
  const { config } = tree();
  const vps = vpsWith({ dirError: true });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, false);
  assert.deepEqual(created(vps), []);
});

test('rehearse: copy, start, compare every host, check the log, tear down', async () => {
  const { config } = tree();
  const vps = vpsWith({ rehearsalBoot: 1 });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, true, text(result));
  assert.match(text(result), /ok api\.tenant\.example\/: status 200 \(live 200\), certificate serial and subject equal/u);
  assert.match(text(result), /ok www\.tenant\.example\/: status 301 \(live 301\), certificate serial and subject equal/u);
  assert.match(text(result), /teardown: service removed/u);
  assert.match(text(result), /teardown: tasks gone/u);
  assert.match(text(result), /teardown: volume removed/u);
  assert.match(text(result), /rehearsal passed/u);
  assert.deepEqual(result.data.steps, ['plan', 'preconditions', 'baseline', 'volume-create', 'volume-copy', 'service-create', 'service-ready', 'probe', 'acme-log', 'teardown:service-rm', 'teardown:tasks-gone', 'teardown:volume-rm']);
  assert.deepEqual(result.data.hosts.map((host) => host.certificate), ['equal', 'equal', 'equal']);
  assert.equal(result.data.teardown, 'clean');
  const create = vps.calls.find((command) => command.startsWith("docker 'service' 'create'"));
  assert.match(create, /'--publish' 'mode=host,target=80,published=18080' '--publish' 'mode=host,target=443,published=18443'/u);
  assert.match(create, /'type=bind,source=\/srv\/deploy\/app-edge\/dynamic,target=\/etc\/traefik\/dynamic,readonly'/u);
  assert.match(create, /'type=volume,source=edge_acme-rehearsal,target=\/acme'/u);
  assert.match(create, /'--certificatesResolvers\.le\.acme\.httpChallenge\.entryPoint=rehearsal-unused'/u);
  assert.doesNotMatch(create, /entryPoint=web/u);
  const copyCommand = vps.calls.find((command) => command.startsWith("docker 'run'"));
  assert.ok(copyCommand.includes("'--network' 'none' '-v' 'edge_acme:/from:ro' '-v' 'edge_acme-rehearsal:/to'"));
  assert.ok(copyCommand.includes(HELPER_IMAGE));
  assert.equal(vps.state.rehearsal.service, false);
  assert.equal(vps.state.rehearsal.volume, false);
  assertLiveEdgeUntouched(vps);
});

test('hosts without a live certificate are skipped: needs fresh issuance', async () => {
  const { config } = tree();
  const legacyTable = table(LIVE_HOSTS);
  legacyTable['tool.example'].cert = '';
  const vps = vpsWith({ legacyTable });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, true, text(result));
  assert.match(text(result), /skipped: needs fresh issuance tool\.example\//u);
  assert.deepEqual(result.data.hosts.map((host) => host.certificate), ['equal', 'skipped', 'equal']);
});

test('a different certificate or status fails the rehearsal and still tears down', async () => {
  const { config } = tree();
  const differentCert = vpsWith({ rehearsalTable: { ...table(LIVE_HOSTS), 'tool.example': { code: 200, cert: 'serial=ZZ' } } });
  const first = await call(differentCert, config, { execute: true });
  assert.equal(first.ok, false);
  assert.match(text(first), /MISMATCH tool\.example\/: status 200 \(live 200\), certificate serial and subject different/u);
  assert.match(text(first), /rehearsal FAILED: mismatch on tool\.example\//u);
  assert.equal(differentCert.state.rehearsal.service, false);
  const differentStatus = vpsWith({ rehearsalTable: { ...table(LIVE_HOSTS), 'api.tenant.example': { code: 502, cert: table(LIVE_HOSTS)['api.tenant.example'].cert } } });
  const second = await call(differentStatus, config, { execute: true });
  assert.equal(second.ok, false);
  assert.match(text(second), /MISMATCH api\.tenant\.example\/: status 502/u);
  assertLiveEdgeUntouched(differentCert);
  assertLiveEdgeUntouched(differentStatus);
});

test('certificate activity in the rehearsal log, or an unreadable log, fails the rehearsal', async () => {
  const { config } = tree();
  const active = vpsWith({ rehearsalLog: 'level=error msg="Unable to obtain ACME certificate for domains"\n' });
  const first = await call(active, config, { execute: true });
  assert.equal(first.ok, false);
  assert.match(text(first), /the rehearsal log shows certificate activity/u);
  const unreadable = vpsWith({ fail: new Set(['logs']) });
  const second = await call(unreadable, config, { execute: true });
  assert.equal(second.ok, false);
  assert.match(text(second), /cannot read the rehearsal log/u);
  assert.equal(unreadable.state.rehearsal.volume, false);
});

const SETUP_FAILURES = [
  ['the volume cannot be created', { fail: new Set(['volume create']) }, /creating edge_acme-rehearsal FAILED: create refused/u, 0],
  ['the copy fails', { fail: new Set(['copy']) }, /copying the certificates store FAILED: copy failed/u, 1],
  ['the service cannot be created', { fail: new Set(['service create']) }, /creating edge-rehearsal FAILED: create refused/u, 1],
  ['the service never starts', { rehearsalBoot: 100000 }, /edge-rehearsal did not start/u, 2],
];

for (const [title, extra, pattern, removed] of SETUP_FAILURES) {
  test(`tears down what exists when ${title}`, async () => {
    const { config } = tree();
    const vps = vpsWith(extra);
    const result = await call(vps, config, { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), pattern);
    assert.equal(vps.calls.filter((command) => /^docker '(service|volume)' 'rm'/u.test(command)).length, removed);
    assert.equal(vps.state.rehearsal.service, false);
    assert.equal(vps.state.rehearsal.volume, false);
    assertLiveEdgeUntouched(vps);
  });
}

test('teardown retries while tasks linger and the volume is in use', async () => {
  const { config } = tree();
  const vps = vpsWith({ taskLinger: 2, volumeRmFailures: 2 });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, true, text(result));
  assert.ok(vps.sleeps.length >= 4);
});

const TEARDOWN_FAILURES = [
  ['the service cannot be removed', { fail: new Set(['service rm']) }, /TEARDOWN FAILED: service removed not done/u],
  ['the tasks never go away', { fail: new Set(['tasks stuck']) }, /TEARDOWN FAILED: tasks gone not done/u],
  ['the volume cannot be removed', { fail: new Set(['volume rm']) }, /TEARDOWN FAILED: volume removed not done/u],
];

for (const [title, extra, pattern] of TEARDOWN_FAILURES) {
  test(`a failed teardown is reported with the manual cleanup: ${title}`, async () => {
    const { config } = tree();
    const vps = vpsWith(extra);
    const result = await call(vps, config, { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), pattern);
    assert.match(text(result), /manual: remove the service edge-rehearsal and the volume edge_acme-rehearsal/u);
    assert.equal(result.data.teardown, 'failed');
  });
}

test('an exception during the rehearsal still runs the teardown', async () => {
  const { config } = tree();
  const vps = vpsWith();
  const ssh = (command) => {
    if (command.includes("'service' 'logs'")) throw new Error('connection lost');
    return vps.run(command);
  };
  await assert.rejects(call(vps, config, { execute: true }, ssh), /connection lost/u);
  assert.equal(vps.state.rehearsal.service, false);
  assert.equal(vps.state.rehearsal.volume, false);
  assertLiveEdgeUntouched(vps);
});

test('the other ingress spec still sees a plain ingress service', async () => {
  const { config } = tree();
  const vps = vpsWith();
  const result = await runIngress(vps.ctx, config, { action: 'plan' }, { ssh: vps.run });
  assert.equal(result.ok, true);
});

test('a redirect rule that depends on the URL text is probed exactly as in production: --connect-to, no port in the URL', async () => {
  const { config } = tree();
  // the host redirects (301) only while the URL carries no explicit port; with a port in the URL it would answer 200
  const rehearsalTable = table(LIVE_HOSTS);
  rehearsalTable['www.tenant.example'] = { ...rehearsalTable['www.tenant.example'], portSensitive: 200 };
  const vps = vpsWith({ rehearsalBoot: 1, rehearsalTable });
  const result = await call(vps, config, { execute: true });
  assert.equal(result.ok, true, text(result));
  assert.match(text(result), /ok www\.tenant\.example\/: status 301 \(live 301\), certificate serial and subject equal/u);
  const probes = vps.calls.filter((command) => command.startsWith('curl ') && command.includes('18443'));
  assert.ok(probes.length >= 3);
  for (const command of probes) {
    assert.match(command, /'--connect-to' '[a-z.]+:443:127\.0\.0\.1:18443'/u);
    assert.doesNotMatch(command, /'--resolve'/u);
    assert.doesNotMatch(command, /https:\/\/[a-z.]+:\d+/u, 'the URL carries no port');
  }
  assertLiveEdgeUntouched(vps);
});
