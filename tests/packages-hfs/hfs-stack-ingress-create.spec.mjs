import test from 'node:test';
import assert from 'node:assert/strict';
import { createIngress, refuseRunning, stackModel } from '../../packages/hfs/stack/ingress-create.mjs';
import { runIngress } from '../../packages/hfs/stack/ingress.mjs';
import { normalizeIngress } from '../../scripts/hfs/stack-ingress-config.mjs';

const IMAGE = `registry.example/proxy:3@sha256:${'c'.repeat(64)}`;
const NL = String.fromCharCode(10);
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const bad = (stderr = 'nope') => ({ status: 1, stdout: '', stderr });
const ARGS = ['--providers.file.directory=/etc/proxy/dynamic', '--entrypoints.web.address=:80', '--certificatesResolvers.le.acme.storage=/acme/acme.json'];

const base = (extra = {}) => normalizeIngress({
  network: 'edge-shared', acmeVolume: 'edge_acme', image: IMAGE, name: 'edge', service: 'proxy',
  legacy: { dir: '/srv/deploy/old-edge', dynamicDir: '/srv/deploy/old-edge/dynamic', container: 'old-edge-proxy' },
  upstreams: [{ name: 'tool', hosts: ['tool.example'], container: 'tool', port: 3000, aliases: ['tool'] }],
  ...extra,
}, { probe: { exists: () => true } }).ingress;

/** A strict VPS: answers by command content and throws on anything unknown; `s` switches the failures. */
function vps(s = {}) {
  const calls = [];
  const state = { deployed: null, scaled: [], stackTasks: s.tasks ?? '', desired: s.desired ?? null };
  const mounts = s.mounts ?? [{ Source: '/srv/deploy/old-edge/dynamic', Destination: '/etc/proxy/dynamic' }, { Name: 'edge_acme', Destination: '/acme' }];
  const run = (command, options = {}) => {
    calls.push({ command, input: options.input });
    if (command.includes("'--format' '{{json .Args}}'")) return s.argsFail ? ok('not json') : ok(JSON.stringify(s.args ?? ARGS));
    if (command.includes("'{{json .Mounts}}'")) return ok(JSON.stringify(mounts));
    if (command.includes('Swarm.LocalNodeState')) return ok(s.swarm ?? 'active true');
    if (command.includes("'network' 'inspect'")) return ok(s.network ?? 'overlay true');
    if (command.includes("'volume' 'inspect'")) return s.noVolume ? bad() : ok();
    if (command.startsWith('test -d')) return s.noDirectory ? bad() : ok();
    if (command.includes("'service' 'ls'")) {
      if (s.lsFails) return bad();
      return state.desired === null ? ok('') : ok(`edge_proxy ${state.desired === 0 ? 0 : 1}/${state.desired}${NL}`);
    }
    if (command.startsWith("docker 'stack' 'deploy'")) {
      if (s.deployFails) return bad('deploy refused' + NL + 'second');
      state.deployed = JSON.parse(options.input);
      return ok();
    }
    if (command.includes("'service' 'ps'")) return ok(state.stackTasks);
    if (command.includes("'service' 'scale'")) { state.scaled.push(command); return ok(); }
    throw new Error(`unknown command ${command}`);
  };
  return { run, calls, state };
}

const text = (result) => result.lines.join(NL);
const mutating = (calls) => calls.filter((call) => /'stack' 'deploy'|'scale'|'rm'|'stop'/u.test(call.command));

test('stackModel is the shared ingress: pinned image, bind-mounted dynamic directory, certificates volume, external overlay, host-mode 80/443, replicas 0, no email', () => {
  const model = stackModel(base(), { args: ARGS, dynamicTarget: '/etc/proxy/dynamic', acmeTarget: '/acme' });
  const service = model.services.proxy;
  assert.equal(service.image, IMAGE);
  assert.deepEqual(service.command, ARGS);
  assert.deepEqual(service.ports.map((port) => [port.published, port.mode]), [[80, 'host'], [443, 'host']]);
  assert.deepEqual(service.volumes[0], { type: 'bind', source: '/srv/deploy/old-edge/dynamic', target: '/etc/proxy/dynamic', read_only: true });
  assert.deepEqual(service.volumes[1], { type: 'volume', source: 'acme', target: '/acme' });
  assert.equal(service.deploy.replicas, 0);
  assert.deepEqual(model.networks.edge, { external: true, name: 'edge-shared' });
  assert.deepEqual(model.volumes.acme, { external: true, name: 'edge_acme' });
  assert.equal(JSON.stringify(model).includes('acme.email'), false);
  refuseRunning(model);
});

test('refuseRunning refuses a model whose service would start a task', () => {
  const model = stackModel(base(), { args: ARGS, dynamicTarget: '/d', acmeTarget: '/a' });
  model.services.proxy.deploy.replicas = 1;
  assert.throws(() => refuseRunning(model), (error) => error.code === 'STACK_INGRESS_WOULD_START');
  delete model.services.proxy.deploy;
  assert.throws(() => refuseRunning(model), (error) => error.code === 'STACK_INGRESS_WOULD_START');
});

test('a dry run reads the live edge read-only, prints the plan and deploys nothing', () => {
  const v = vps();
  const result = createIngress(v.run, base(), false);
  assert.equal(result.ok, true);
  assert.match(text(result), /dry run: would deploy stack edge: service proxy image registry\.example\/proxy:3@sha256:c+, 3 static argument\(s\), host-mode 80\/443, replicas 0/u);
  assert.equal(mutating(v.calls).length, 0);
});

test('execute deploys the stack from stdin with replicas 0 and confirms that no task runs', () => {
  const v = vps();
  const result = createIngress(v.run, base(), true);
  assert.equal(result.ok, true);
  assert.match(text(result), /no task runs and no port is bound/u);
  assert.equal(v.state.deployed.services.proxy.deploy.replicas, 0);
  assert.deepEqual(v.state.deployed.services.proxy.command, ARGS, 'the live edge arguments, byte for byte');
  const deploy = v.calls.find((call) => call.command.startsWith("docker 'stack' 'deploy'"));
  assert.equal(deploy.command, "docker 'stack' 'deploy' '--detach=true' '-c' '-' 'edge'");
  assert.deepEqual(result.data.steps, [{ step: 'deploy', ok: true }, { step: 'no-task', ok: true }]);
});

test('declared arguments win over the live ones, and an existing service at 0 replicas is updated idempotently', () => {
  const v = vps({ desired: 0 });
  const result = createIngress(v.run, base({ args: ['--log.level=DEBUG'] }), true);
  assert.equal(result.ok, true);
  assert.deepEqual(v.state.deployed.services.proxy.command, ['--log.level=DEBUG']);
});

test('a service that already runs replicas is refused', () => {
  const v = vps({ desired: 1 });
  const result = createIngress(v.run, base(), true);
  assert.equal(result.ok, false);
  assert.match(text(result), /precondition FAILED: service edge_proxy is not running a task \(it already runs 1 replica/u);
  assert.equal(mutating(v.calls).length, 0);
});

test('every precondition refuses with nothing changed', () => {
  const cases = [
    [{ image: undefined }, {}, /an image is declared/u],
    [{}, { args: [] }, /static arguments known/u],
    [{}, { argsFail: true }, /static arguments known/u],
    [{}, { args: ['--certificatesResolvers.le.acme.email=ops@example.test'] }, /no ACME email configured/u],
    [{}, { mounts: [] }, /dynamic directory and certificates mounts found/u],
    [{}, { swarm: 'inactive false' }, /swarm active/u],
    [{}, { network: 'bridge false' }, /attachable overlay/u],
    [{}, { noVolume: true }, /certificates volume edge_acme present/u],
    [{}, { noDirectory: true }, /dynamic directory .* present/u],
  ];
  for (const [extra, behaviour, expected] of cases) {
    const v = vps(behaviour);
    const ingress = base(extra);
    const result = createIngress(v.run, ingress, true);
    assert.equal(result.ok, false);
    assert.match(text(result), expected);
    assert.match(text(result), /create refused: nothing was changed/u);
    assert.equal(mutating(v.calls).length, 0);
  }
});

test('a failing service listing counts as no service, and a failing deploy is reported', () => {
  assert.equal(createIngress(vps({ lsFails: true }).run, base(), false).ok, true);
  const v = vps({ deployFails: true });
  const result = createIngress(v.run, base(), true);
  assert.equal(result.ok, false);
  assert.match(text(result), /docker stack deploy failed: deploy refused$/mu);
  assert.deepEqual(result.data.steps, [{ step: 'deploy', ok: false }]);
});

test('if a task of the service starts anyway it is scaled back to 0 and the run fails', () => {
  const v = vps({ tasks: 'abc123' + NL });
  const result = createIngress(v.run, base(), true);
  assert.equal(result.ok, false);
  assert.match(text(result), /REFUSED: a task of the ingress service started; it was scaled back to 0/u);
  assert.deepEqual(v.state.scaled, ["docker 'service' 'scale' 'edge_proxy=0'"]);
  assert.deepEqual(result.data.steps, [{ step: 'deploy', ok: true }, { step: 'no-task', ok: false }]);
});

test('ingress create is an action of the ingress verb and never starts anything in a dry run', async () => {
  const v = vps();
  const config = { ingress: base(), remote: { host: 'vps', sealed: null } };
  const ctx = { env: {}, cwd: '.', stdout: () => {}, stderr: () => {} };
  const result = await runIngress(ctx, config, { action: 'create' }, { ssh: v.run });
  assert.equal(result.ok, true);
  assert.equal(result.data.action, 'create');
  assert.equal(mutating(v.calls).length, 0);
});

test('the ingress block accepts a pinned image and static arguments, and refuses an unpinned image, a zero digest and a malformed argument', () => {
  const probe = { exists: () => true };
  const valid = { network: 'edge-shared', acmeVolume: 'edge_acme', legacy: { dir: '/srv/o', dynamicDir: '/srv/o/dynamic', container: 'o' } };
  const good = normalizeIngress({ ...valid, image: IMAGE, args: ['--a.b=c', '--ping'] }, { probe });
  assert.deepEqual(good.problems, []);
  assert.equal(good.ingress.image, IMAGE);
  assert.deepEqual(good.ingress.args, ['--a.b=c', '--ping']);
  assert.equal(normalizeIngress(valid, { probe }).ingress.image, null);
  assert.equal(normalizeIngress(valid, { probe }).ingress.args, null);
  for (const image of ['registry.example/proxy:3', `registry.example/proxy@sha256:${'0'.repeat(64)}`]) assert.match(normalizeIngress({ ...valid, image }, { probe }).problems[0].message, /must match/u);
  assert.match(normalizeIngress({ ...valid, args: ['no-dash', '--x y'] }, { probe }).problems[0].message, /must match/u);
});
