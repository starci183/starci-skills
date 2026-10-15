import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runIngress, hostsOfRule, routesOfDocument } from '../../packages/hfs/stack/ingress.mjs';
import { StackError } from '../../packages/hfs/stack/errors.mjs';
import { makeTree, makeVps, table, liveFiles, LIVE_HOSTS, SECRET_TOKENS } from '../helpers/stack-ingress-fakes.mjs';

const trees = [];
const tree = (...args) => {
  const made = makeTree(...args);
  trees.push(made);
  return made;
};
after(() => { for (const made of trees) made.cleanup(); });

const call = (vps, config, action, options = {}) => runIngress(vps.ctx, config, { action, ...options }, { ssh: vps.run });
const text = (result) => result.lines.join('\n');
const readyVps = (extra = {}) => makeVps({ network: 'overlay', containers: { 'tenant-api': { running: 'true', networks: ['bridge', 'edge-shared'] } }, ...extra });
const refused = (promise, code) => assert.rejects(promise, (error) => error instanceof StackError && error.code === code);
const noSecrets = (result) => {
  const everything = JSON.stringify(result);
  for (const token of SECRET_TOKENS) assert.ok(!everything.includes(token), `${token} leaked`);
};

test('usage: unknown action, extra arguments, undeclared ingress', async () => {
  const { config } = tree();
  const vps = makeVps();
  await refused(call(vps, config, 'burn'), 'STACK_USAGE');
  await refused(call(vps, config, 'plan', { args: ['x'] }), 'STACK_USAGE');
  await refused(call(vps, { ...config, ingress: null }, 'plan'), 'STACK_INGRESS_UNDECLARED');
  assert.deepEqual(vps.calls, []);
});

test('rule and document parsing tolerate odd shapes', () => {
  assert.deepEqual(hostsOfRule('Host(`A.example`, `b.example`) && PathPrefix(`/x`)'), ['a.example', 'b.example']);
  assert.deepEqual(hostsOfRule('HostRegexp(`^x$`)'), ['regexp:^x$']);
  assert.deepEqual(hostsOfRule(7), []);
  assert.deepEqual(routesOfDocument(null), { routes: [], middlewares: [] });
  assert.deepEqual(routesOfDocument(5), { routes: [], middlewares: [] });
  assert.deepEqual(routesOfDocument({ http: 5 }), { routes: [], middlewares: [] });
});

test('plan: every live host covered, nothing printed from route files but hosts and origins', async () => {
  const { config } = tree();
  const vps = makeVps();
  const result = await call(vps, config, 'plan');
  assert.equal(result.ok, true);
  const output = text(result);
  assert.match(output, /live api\.tenant\.example -> \[unparsed\], http:\/\/tenant-api:3000: declared \(upstream tenant-api\)/u);
  assert.match(output, /live tool\.example -> http:\/\/172\.29\.0\.1:5678: declared \(upstream tool\)/u);
  assert.match(output, /live old\.example -> http:\/\/\S*|live old\.example -> \(no target\): declared \(dropped\)/u);
  assert.match(output, /live www\.tenant\.example .*declared \(redirect to tenant\.example\)/u);
  assert.match(output, /live regexp:.*declared \(routes file\)/u);
  assert.match(output, /plan green/u);
  assert.match(output, /container tenant-api: running, not attached/u);
  assert.match(output, /network edge-shared: missing/u);
  assert.match(output, /certificates volume edge_acme: present/u);
  assert.equal(result.data.action, 'plan');
  assert.deepEqual(result.data.steps, ['plan']);
  noSecrets(result);
  assert.deepEqual(vps.mutating(), []);
});

test('plan: a live host the declaration does not cover is refused and named', async () => {
  const { config } = tree();
  const files = liveFiles();
  files['extra.yml'] = JSON.stringify({ http: { routers: { x: { rule: 'Host(`orphan.example`)', service: 's' }, y: { rule: 'Host(`orphan2.example`)', service: 's' } } } });
  const vps = makeVps({ files });
  const result = await call(vps, config, 'plan');
  assert.equal(result.ok, false);
  assert.match(text(result), /orphan\.example -> .*: NOT DECLARED/u);
  assert.match(text(result), /REFUSED: 2 live host\(s\) not covered by the declaration: orphan\.example, orphan2\.example/u);
  assert.deepEqual(result.data.missing, ['orphan.example', 'orphan2.example']);
  assert.match(text(result), /plan NOT green/u);
});

test('plan: declared but not live is information only', async () => {
  const { config } = tree();
  const files = liveFiles();
  delete files['old.yml'];
  const vps = makeVps({ files });
  const result = await call(vps, config, 'plan');
  assert.equal(result.ok, true);
  assert.match(text(result), /declared, not live yet: old\.example \(dropped\)/u);
  assert.deepEqual(result.data.declaredNotLive, ['old.example']);
});

test('plan: tolerated yaml shapes, an unparsable file and an unreadable directory', async () => {
  const { config } = tree();
  const files = liveFiles();
  files['empty.yml'] = '';
  files['scalar.yml'] = '5';
  files['odd.yml'] = JSON.stringify({
    http: {
      routers: { a: 5, b: { rule: 7, service: 9 }, c: { rule: 'Host(`c.example`)', service: 'missing' }, d: { rule: 'Host(`d.example`)' }, e: { rule: 'Host(`e.example`)', service: 's' } },
      services: { s: { loadBalancer: { servers: 'x' } } },
    },
  });
  const odd = await call(makeVps({ files }), config, 'plan');
  assert.equal(odd.ok, false);
  assert.match(text(odd), /live c\.example -> \(no target\): NOT DECLARED/u);
  assert.match(text(odd), /live e\.example -> \(no target\)/u);
  const broken = await call(makeVps({ files: { ...liveFiles(), 'bad.yml': 'a: [' } }), config, 'plan');
  assert.equal(broken.ok, false);
  assert.match(text(broken), /WARNING bad\.yml is not valid YAML/u);
  const none = await call(makeVps({ files: {} }), config, 'plan');
  assert.match(text(none), /live edge files: none/u);
  const unreadable = await call(makeVps({ dirError: true }), config, 'plan');
  assert.equal(unreadable.ok, false);
  assert.match(text(unreadable), /cannot read .*dynamic on the manager: No such file or directory/u);
  assert.equal(unreadable.data.error !== undefined, true);
});

test('plan: an undeclared middleware, missing containers, a wrong network and a missing certificates volume are reported', async () => {
  const { config } = tree();
  fs.writeFileSync(path.join(config.envDir, 'edge', 'routes.yml'), JSON.stringify({ http: { routers: { wild: { rule: 'HostRegexp(`^.+\\.x\\.example$`)', service: 'w' } } } }));
  const vps = makeVps({ containers: {}, network: 'bridge', volume: false });
  const result = await call(vps, config, 'plan');
  assert.equal(result.ok, false);
  assert.match(text(result), /middleware secure \(upstream tenant-api\) is declared nowhere/u);
  assert.match(text(result), /container tenant-api: MISSING or not running/u);
  assert.match(text(result), /network edge-shared: wrong/u);
  assert.match(text(result), /certificates volume edge_acme: MISSING/u);
  const attached = await call(readyVps(), config, 'plan');
  assert.match(text(attached), /container tenant-api: running, attached/u);
  assert.match(text(attached), /network edge-shared: ok/u);
});

test('plan: the own routes file is unreadable or invalid; no routes file declared', async () => {
  const broken = tree();
  fs.writeFileSync(path.join(broken.config.envDir, 'edge', 'routes.yml'), 'a: [');
  await refused(call(makeVps(), broken.config, 'plan'), 'STACK_INGRESS_ROUTES');
  const missing = tree();
  fs.rmSync(path.join(missing.config.envDir, 'edge', 'routes.yml'));
  await refused(call(makeVps(), missing.config, 'plan'), 'STACK_INGRESS_ROUTES');
  const none = tree({ routes: undefined, middlewares: { secure: {} } });
  const result = await call(makeVps(), none.config, 'plan');
  assert.equal(result.ok, false);
  assert.match(text(result), /NOT DECLARED/u);
});

test('the ssh runner notes come first and the session is cleaned up', async () => {
  const { config } = tree();
  const vps = makeVps();
  let cleaned = 0;
  const run = Object.assign((command) => vps.run(command), { notes: ['note one'], cleanup: () => { cleaned += 1; } });
  const result = await runIngress(vps.ctx, config, { action: 'plan' }, { ssh: run });
  assert.equal(result.lines[0], 'note one');
  assert.equal(cleaned, 1);
});

test('attach: dry run changes nothing', async () => {
  const { config } = tree();
  const vps = makeVps();
  const result = await call(vps, config, 'attach');
  assert.equal(result.ok, true);
  assert.match(text(result), /dry run: would create the attachable overlay network edge-shared/u);
  assert.match(text(result), /dry run: would connect tenant-api to edge-shared \(aliases tenant-api, tenant-api-b\)/u);
  assert.deepEqual(vps.mutating(), []);
});

test('attach: creates the network and connects with unique aliases, then is idempotent', async () => {
  const { config } = tree();
  const vps = makeVps();
  const first = await call(vps, config, 'attach', { execute: true });
  assert.equal(first.ok, true);
  assert.deepEqual(vps.mutating(), [
    "docker 'network' 'create' '--driver' 'overlay' '--attachable' 'edge-shared'",
    "docker 'network' 'connect' '--alias' 'tenant-api' '--alias' 'tenant-api-b' '--gw-priority' '-1' 'edge-shared' 'tenant-api'",
  ]);
  assert.deepEqual(first.data.steps, ['network-create', 'connect:tenant-api']);
  const before = vps.mutating().length;
  const second = await call(vps, config, 'attach', { execute: true });
  assert.equal(second.ok, true);
  assert.equal(vps.mutating().length, before);
  assert.match(text(second), /tenant-api is already on edge-shared: skipped/u);
  const dry = await call(vps, config, 'attach');
  assert.equal(dry.ok, true);
});

test('attach: a missing or stopped container is a failure that changes nothing', async () => {
  const { config } = tree();
  await Promise.all([{}, { 'tenant-api': { running: 'false', networks: [] } }].map(async (containers) => {
    const vps = makeVps({ containers });
    const result = await call(vps, config, 'attach', { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), /missing or not running: tenant-api; nothing was changed/u);
    assert.deepEqual(vps.mutating(), []);
  }));
});

test('attach: a network that is not an attachable overlay is refused; command failures are reported', async () => {
  const { config } = tree();
  const wrong = makeVps({ network: 'bridge' });
  const refusedNetwork = await call(wrong, config, 'attach', { execute: true });
  assert.equal(refusedNetwork.ok, false);
  assert.match(text(refusedNetwork), /not an attachable overlay/u);
  assert.deepEqual(wrong.mutating(), []);
  const createFails = makeVps({ fail: new Set(['network create']) });
  assert.match(text(await call(createFails, config, 'attach', { execute: true })), /creating edge-shared FAILED: create refused/u);
  const connectFails = makeVps({ network: 'overlay', fail: new Set(['network connect']) });
  const failed = await call(connectFails, config, 'attach', { execute: true });
  assert.equal(failed.ok, false);
  assert.match(text(failed), /connect tenant-api to edge-shared FAILED: connect refused/u);
});

test('attach: odd inspect output is tolerated', async () => {
  const { config } = tree();
  await Promise.all(['true|not json', 'true', 'true|null'].map(async (raw) => {
    const vps = makeVps({ network: 'overlay', containers: { 'tenant-api': { raw, networks: [] } } });
    const result = await call(vps, config, 'attach');
    assert.match(text(result), /dry run: would connect tenant-api/u);
  }));
});

// ---- takeover ----------------------------------------------------------------------------------------------------------

test('takeover: usage-level refusals', async () => {
  const noBackup = tree({ backup: undefined });
  await refused(call(readyVps(), noBackup.config, 'takeover'), 'STACK_INGRESS_BACKUP_UNDECLARED');
  const noRecipient = tree({}, { recipient: false });
  await refused(call(readyVps(), noRecipient.config, 'takeover'), 'STACK_INGRESS_RECIPIENT');
  const wrongRecipient = tree();
  fs.writeFileSync(path.join(wrongRecipient.config.repoRoot, '.sops.yaml'), JSON.stringify({ creation_rules: [{ age: 'nothing' }] }));
  await refused(call(readyVps(), wrongRecipient.config, 'takeover'), 'STACK_INGRESS_RECIPIENT');
});

test('takeover: an unreadable edge directory stops it at once', async () => {
  const { config } = tree();
  const vps = readyVps({ dirError: true });
  const result = await call(vps, config, 'takeover', { execute: true });
  assert.equal(result.ok, false);
  assert.deepEqual(vps.mutating(), []);
});

const PRECONDITIONS = [
  ['plan not green', { files: { ...liveFiles(), 'x.yml': JSON.stringify({ http: { routers: { x: { rule: 'Host(`orphan.example`)', service: 's' } } } }) } }, /precondition FAILED: plan green/u],
  ['swarm inactive', { swarm: 'inactive false' }, /precondition FAILED: swarm active/u],
  ['service missing', { services: {} }, /precondition FAILED: swarm service edge_ingress exists with 0 replicas/u],
  ['service already scaled', { services: { edge_ingress: 1 } }, /precondition FAILED: swarm service edge_ingress/u],
  ['service ls fails', { fail: new Set(['service ls']) }, /precondition FAILED: swarm service edge_ingress/u],
  ['network missing', { network: 'missing' }, /precondition FAILED: network edge-shared is an attachable overlay \(network state: missing\)/u],
  ['container detached', { containers: { 'tenant-api': { running: 'true', networks: ['bridge'] } } }, /precondition FAILED: every upstream container attached \(not attached: tenant-api\)/u],
  ['certificates missing', { volume: false }, /precondition FAILED: certificates volume edge_acme present/u],
];

for (const [title, extra, pattern] of PRECONDITIONS) {
  test(`takeover refuses and changes nothing: ${title}`, async () => {
    const { config } = tree();
    const vps = readyVps(extra);
    const result = await call(vps, config, 'takeover', { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), pattern);
    assert.match(text(result), /takeover refused: nothing was changed/u);
    assert.deepEqual(vps.mutating(), []);
    assert.deepEqual(result.data.steps, ['plan', 'preconditions']);
  });
}

const BASELINES = [
  ['an old-edge host answers 5xx', (state) => { state.legacyTable['tool.example'].code = 502; }],
  ['an old-edge host does not answer', (state) => { delete state.legacyTable['tool.example']; }],
  ['an old-edge host presents no certificate', (state) => { state.legacyTable['tool.example'].cert = ''; }],
];

for (const [title, mutate] of BASELINES) {
  test(`takeover refuses before stopping anything: ${title}`, async () => {
    const { config } = tree();
    const vps = readyVps({ legacyTable: table(LIVE_HOSTS) });
    mutate(vps.state);
    const result = await call(vps, config, 'takeover', { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), /baseline FAILED tool\.example\/:/u);
    assert.match(text(result), /the old edge does not answer as declared; nothing was changed/u);
    assert.deepEqual(vps.mutating(), []);
  });
}

test('takeover expects exactly what the old edge answers; a declared status of the post-publish phase does not block it', async () => {
  // 204 is what the app's own routes will answer AFTER publish; the takeover phase serves the same directory as the old edge (200)
  const { config } = tree({ verify: [{ host: 'api.tenant.example', path: '/health', status: 204 }] });
  const dry = await call(readyVps(), config, 'takeover');
  assert.equal(dry.ok, true, text(dry));
  assert.match(text(dry), /baseline ok api\.tenant\.example\/health: old edge answers 200/u);
  const vps = readyVps();
  const result = await call(vps, config, 'takeover', { execute: true });
  assert.equal(result.ok, true, text(result));
  assert.match(text(result), /api\.tenant\.example\/health/u);
});

test('takeover dry run proves the preconditions and the baseline but changes nothing', async () => {
  const { config } = tree();
  const vps = readyVps();
  const result = await call(vps, config, 'takeover');
  assert.equal(result.ok, true);
  assert.match(text(result), /precondition ok: plan green/u);
  assert.match(text(result), /baseline ok api\.tenant\.example\/: old edge answers 200/u);
  assert.match(text(result), /baseline ok www\.tenant\.example\/: old edge answers 301/u);
  assert.doesNotMatch(text(result), /old\.example\//u);
  assert.match(text(result), /dry run: would back up .* to \/srv\/deploy\/backups, stop app-edge-proxy and scale edge_ingress to 1, verify 3 host\(s\)/u);
  assert.deepEqual(result.data.steps, ['plan', 'preconditions', 'baseline']);
  assert.deepEqual(vps.mutating(), []);
});

test('takeover: backup first, then one stop-and-scale, gap measured, every host and certificate verified', async () => {
  const { config } = tree({ verify: [{ host: 'api.tenant.example', path: '/health', status: 200 }, { host: 'tool.example' }] });
  const vps = readyVps({ bootSleeps: 1 });
  const result = await call(vps, config, 'takeover', { execute: true });
  assert.equal(result.ok, true, text(result));
  const mutating = vps.mutating();
  assert.equal(mutating.length, 3);
  assert.match(mutating[0], /sudo -n tar -cf - -C .*edge_acme\/_data.* \. \| age -r .*acme-20231114-221320\.tar\.age/u);
  assert.match(mutating[1], /sudo -n tar -cf - -C .*dynamic.* \. \| age -r .*dynamic-20231114-221320\.tar\.age/u);
  assert.equal(mutating[2], "docker 'stop' '-t' '10' 'app-edge-proxy' && docker 'service' 'scale' 'edge_ingress=1'");
  assert.match(mutating[0], /set -o pipefail; umask 077; mkdir -p/u);
  assert.equal(result.data.gapMs, 4000);
  assert.equal(result.data.fallback, null);
  assert.deepEqual(result.data.steps, ['plan', 'preconditions', 'baseline', 'backup', 'stop-and-scale']);
  assert.match(text(result), /measured unavailability gap: 4000 ms \(gate 30 s\)/u);
  assert.match(text(result), /takeover complete: .* 2 host\(s\)/u);
  assert.equal(vps.state.legacyRunning, false);
  assert.equal(vps.state.services.edge_ingress, 1);
  assert.ok(vps.sleeps.length >= 1);
  assert.ok(!vps.calls.some((command) => command.includes('docker \'rm\'')));
  noSecrets(result);
});

const BACKUP_FAILURES = [
  ['the volume cannot be inspected', { fail: new Set(['volume mountpoint']) }, /cannot locate the volume edge_acme/u],
  ['the mount point is not a path', { mountpoint: 'not a path' }, /cannot locate the volume edge_acme/u],
  ['the certificates archive fails', { fail: new Set(['age acme']) }, /backup .*acme-.* FAILED: sudo: a password is required/u],
  ['the dynamic directory archive fails', { fail: new Set(['age dynamic']) }, /backup .*dynamic-.* FAILED/u],
];

for (const [title, extra, pattern] of BACKUP_FAILURES) {
  test(`takeover changes nothing when ${title}`, async () => {
    const { config } = tree();
    const vps = readyVps(extra);
    const result = await call(vps, config, 'takeover', { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), pattern);
    assert.match(text(result), /takeover refused: nothing was changed/u);
    assert.ok(vps.mutating().every((command) => command.includes(' age ')));
    assert.equal(vps.state.legacyRunning, true);
  });
}

const FALLBACKS = [
  ['the stop fails', { fail: new Set(['stop']) }, /stop and scale FAILED: stop refused/u],
  ['the scale fails after the stop', { fail: new Set(['scale1']) }, /stop and scale FAILED: scale refused/u],
  ['port 443 never opens', { fail: new Set(['tcp']) }, /port 443 was not accepting connections within 30 s/u],
  ['the gap exceeds the gate', { tcpMs: 31000 }, /port 443 was not accepting connections within 30 s/u],
  ['a host presents another certificate', { newTable: { ...table(LIVE_HOSTS), 'tool.example': { code: 200, cert: 'serial=ZZ\nsubject=CN=other' } } }, /hosts differ from the old edge: tool\.example\/=200/u],
  ['a host answers differently', { newTable: { ...table(LIVE_HOSTS), 'api.tenant.example': { code: 502, cert: 'x' } } }, /hosts differ from the old edge: api\.tenant\.example\/=502/u],
  ['the new ingress never answers', { bootSleeps: 1000 }, /hosts differ from the old edge: .*=0/u],
];

for (const [title, extra, pattern] of FALLBACKS) {
  test(`takeover falls back automatically when ${title}`, async () => {
    const { config } = tree();
    const vps = readyVps(extra);
    const result = await call(vps, config, 'takeover', { execute: true });
    assert.equal(result.ok, false);
    assert.match(text(result), pattern);
    assert.match(text(result), /FALLBACK ok: app-edge-proxy answers every host again; the ingress service is scaled to 0/u);
    assert.equal(result.data.fallback, 'ok');
    assert.equal(vps.state.legacyRunning, true);
    assert.equal(vps.state.services.edge_ingress, 0);
    assert.match(text(result), /measured unavailability gap: \d+ ms/u);
    assert.deepEqual(result.data.steps.slice(-3), ['fallback-scale-0', 'fallback-start-old-edge', 'fallback-verify']);
  });
}

test('the fallback retries `docker start` while the ports are released', async () => {
  const { config } = tree();
  const vps = readyVps({ fail: new Set(['tcp']), startFailures: 2 });
  const result = await call(vps, config, 'takeover', { execute: true });
  assert.match(text(result), /FALLBACK ok/u);
  assert.ok(vps.sleeps.length >= 2);
});

test('FALLBACK FAILED is reported with the manual commands', async () => {
  const { config } = tree();
  const scaleFails = readyVps({ fail: new Set(['tcp', 'scale0']) });
  const first = await call(scaleFails, config, 'takeover', { execute: true });
  assert.equal(first.ok, false);
  assert.equal(first.data.fallback, 'failed');
  assert.match(text(first), /FALLBACK FAILED \(manual: docker service scale edge_ingress=0; docker start app-edge-proxy; check every host\)/u);
  const neverStarts = readyVps({ fail: new Set(['tcp']), startFailures: 1000 });
  assert.match(text(await call(neverStarts, config, 'takeover', { execute: true })), /FALLBACK FAILED/u);
  const notAnswering = readyVps({
    fail: new Set(['tcp']),
    afterStop: (state) => { state.legacyTable = table(LIVE_HOSTS.map(([host]) => [host, 503])); },
  });
  const third = await call(notAnswering, config, 'takeover', { execute: true });
  assert.match(text(third), /FALLBACK FAILED \(manual: the old edge started but does not answer as before \(/u);
  assert.equal(third.data.fallback, 'failed');
});
