import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describeClash, edgeAttachments, edgeAttachmentsOf, edgeCollisions, reconcileEdgeAliases, verifyEdgeAttachment } from '../../packages/hfs/stack/edge-alias.mjs';
import { fakeHost, networkIdOf } from '../helpers/stack-fakes.mjs';
import { fakeRunner, shellWords } from '../helpers/stack-remote-fakes.mjs';

const EDGE = 'shared-edge';
const config = { stack: 'nivo' };
const edgeStack = (aliases = ['nivo-api']) => `services:
  api:
    image: x
    networks:
      edge:
        aliases:
${aliases.map((alias) => `          - ${alias}`).join('\n')}
      internal:
  worker:
    image: x
    networks:
      - internal
networks:
  edge:
    external: true
    name: ${EDGE}
  internal:
    driver: overlay
`;
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stack-edge-'));
after(() => fs.rmSync(work, { recursive: true, force: true }));
const fileOf = (text) => {
  const file = path.join(work, `stack-${Math.random().toString(16).slice(2)}.yaml`);
  fs.writeFileSync(file, text);
  return file;
};

/** A fake manager that knows the edge network, with `names` attached, and a ctx that deploys through the fake `docker stack deploy`. */
function manager({ names = [], services = [], overrides = {} } = {}) {
  const host = fakeHost({ fileReader: (file) => fs.readFileSync(file, 'utf8'), overrides: { docker: overrides } });
  host.state.networks.set(EDGE, { containers: names, services });
  const ctx = host.ctx();
  return { host, ctx, deploy: (text) => host.spawn('docker', ['stack', 'deploy', '-c', fileOf(text), config.stack]), run: fakeRunner(host) };
}
const edgeOf = (host, service = 'nivo_api') => host.state.services.get(service).networks;

test('the attachments are the services joined to an external network, with the aliases they declare', () => {
  assert.deepEqual(edgeAttachments(edgeStack()), [{ service: 'api', network: EDGE, aliases: ['nivo-api'] }]);
  assert.deepEqual(edgeAttachments('services:\n  api:\n    networks:\n      - edge\nnetworks:\n  edge:\n    external: true\n'), [{ service: 'api', network: 'edge', aliases: [] }]);
  assert.deepEqual(edgeAttachments('services:\n  api:\n    networks:\n      edge:\nnetworks:\n  edge:\n    external: true\n  other:\n'), [{ service: 'api', network: 'edge', aliases: [] }]);
  for (const text of ['# nothing\n', 'services:\n  api:\n', 'services:\n  api:\n    networks:\n      inner:\nnetworks:\n  inner:\n']) assert.deepEqual(edgeAttachments(text), []);
  assert.deepEqual(edgeAttachmentsOf(fileOf(edgeStack())), edgeAttachments(edgeStack()));
});

test('preflight: a short service name that another container or service of the edge network resolves is a clash, naming alias, service and network', async () => {
  const { run } = manager({ names: ['tayson-web', 'api', 'nivo_worker.1.abc'], services: ['tayson_cache'] });
  const found = await edgeCollisions(run, config, edgeStack());
  assert.deepEqual(found.networks, [EDGE]);
  assert.deepEqual(found.clashes, [{ service: 'nivo_api', alias: 'api', network: EDGE, holder: 'api' }]);
  const text = describeClash(found.clashes[0]);
  for (const part of ['nivo_api', 'alias api', EDGE]) assert.ok(text.includes(part), part);
  const viaService = manager({ services: ['api'] });
  assert.equal((await edgeCollisions(viaService.run, config, edgeStack())).clashes.length, 1);
});

test('preflight: other names, the own services of the stack and an empty network are no clash; the commands are read-only and quoted', async () => {
  const { run } = manager({ names: ['tayson-web', 'nivo_api.1.xyz'], services: ['nivo_api'] });
  assert.deepEqual((await edgeCollisions(run, config, edgeStack())).clashes, []);
  const bare = manager();
  assert.deepEqual((await edgeCollisions(bare.run, config, edgeStack())).clashes, []);
  assert.deepEqual((await edgeCollisions(bare.run, config, 'services:\n  a:\n')).networks, []);
  assert.deepEqual(shellWords(run.commands[0].command), ['docker', 'network', 'inspect', EDGE, '--verbose', '--format', '{{json .}}']);
  assert.ok(run.commands.every((entry) => /^docker 'network' 'inspect' /u.test(entry.command)));
});

test('preflight: an edge network that cannot be read is refused with a stable code', async () => {
  const failing = manager({ overrides: { 'network inspect': () => ({ status: 1, stdout: '', stderr: 'No such network' }) } });
  await assert.rejects(() => edgeCollisions(failing.run, config, edgeStack()), /STACK_DEPLOY_EDGE_UNREADABLE.*shared-edge/u);
  for (const stdout of ['not json', 'null']) {
    const odd = manager({ overrides: { 'network inspect': () => ({ status: 0, stdout, stderr: '' }) } });
    await assert.rejects(() => edgeCollisions(odd.run, config, edgeStack()), /STACK_DEPLOY_EDGE_UNREADABLE/u);
  }
  const bare = manager({ overrides: { 'network inspect': () => ({ status: 0, stdout: '{}', stderr: '' }) } });
  assert.deepEqual((await edgeCollisions(bare.run, config, edgeStack())).clashes, []);
});

test('docker stack deploy leaves the short name on the edge; the reconcile removes it and keeps only the declared alias', () => {
  const { host, ctx, deploy } = manager();
  assert.equal(deploy(edgeStack()).status, 0);
  assert.deepEqual(edgeOf(host), [{ network: EDGE, aliases: ['nivo-api', 'api'] }], 'the implicit alias exists after the deploy');
  const result = reconcileEdgeAliases(ctx, config, fileOf(edgeStack()));
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines, [`edge: nivo_api on ${EDGE}: aliases [nivo-api, api] -> [nivo-api]`]);
  assert.deepEqual(edgeOf(host), [{ network: EDGE, aliases: ['nivo-api'] }]);
  assert.deepEqual(host.state.updates, [
    ['--detach=true', '--network-rm', EDGE, 'nivo_api'],
    ['--detach=true', '--network-add', `name=${EDGE},alias=nivo-api`, 'nivo_api'],
  ]);
});

test('the reconcile is idempotent: an exact attachment is left alone', () => {
  const { host, ctx, deploy } = manager();
  deploy(edgeStack());
  const file = fileOf(edgeStack());
  reconcileEdgeAliases(ctx, config, file);
  const updates = host.state.updates.length;
  const again = reconcileEdgeAliases(ctx, config, file);
  assert.deepEqual(again.lines, [`edge: nivo_api on ${EDGE}: aliases [nivo-api] (already exact)`]);
  assert.equal(host.state.updates.length, updates);
});

test('the reconcile keeps several declared aliases, handles none, and attaches a service that is not attached yet', () => {
  const many = manager();
  many.deploy(edgeStack(['nivo-api', 'nivo-graphql']));
  reconcileEdgeAliases(many.ctx, config, fileOf(edgeStack(['nivo-api', 'nivo-graphql'])));
  assert.deepEqual(edgeOf(many.host), [{ network: EDGE, aliases: ['nivo-api', 'nivo-graphql'] }]);
  assert.deepEqual(many.host.state.updates.at(-1), ['--detach=true', '--network-add', `name=${EDGE},alias=nivo-api,alias=nivo-graphql`, 'nivo_api']);
  const none = manager();
  const bare = 'services:\n  api:\n    networks:\n      - edge\nnetworks:\n  edge:\n    external: true\n    name: shared-edge\n';
  none.deploy(bare);
  reconcileEdgeAliases(none.ctx, config, fileOf(bare));
  assert.deepEqual(edgeOf(none.host), [{ network: EDGE, aliases: [] }]);
  assert.deepEqual(none.host.state.updates.at(-1), ['--detach=true', '--network-add', `name=${EDGE}`, 'nivo_api']);
  const detached = manager();
  detached.host.state.services.set('nivo_api', { replicas: 1 });
  reconcileEdgeAliases(detached.ctx, config, fileOf(edgeStack()));
  assert.equal(detached.host.state.updates.length, 1, 'only the add: there was nothing to remove');
  assert.deepEqual(edgeOf(detached.host), [{ network: EDGE, aliases: ['nivo-api'] }]);
});

test('the reconcile fails with a stable code when the aliases still differ afterwards, and reads an entry without aliases as none', () => {
  const stuck = manager({ overrides: { 'service update': () => ({ status: 0, stdout: '', stderr: '' }) } });
  stuck.deploy(edgeStack());
  assert.throws(() => reconcileEdgeAliases(stuck.ctx, config, fileOf(edgeStack())), /STACK_DEPLOY_EDGE_ALIAS: nivo_api carries the aliases \[nivo-api, api\] on shared-edge after the reconcile, declared \[nivo-api\]/u);
  const noAliases = manager({ overrides: { 'service inspect': () => ({ status: 0, stdout: JSON.stringify({ Spec: { TaskTemplate: { Networks: [{ Target: networkIdOf(EDGE) }] } } }), stderr: '' }), 'service update': () => ({ status: 0, stdout: '', stderr: '' }) } });
  assert.throws(() => reconcileEdgeAliases(noAliases.ctx, config, fileOf(edgeStack())), /STACK_DEPLOY_EDGE_ALIAS.*carries the aliases \[\]/u);
});

test('the reconcile refuses a name that is not a plain docker name, before any docker call', () => {
  const { host, ctx } = manager();
  for (const text of [edgeStack(['nivo-api,alias=api']), edgeStack(['nivo api']), edgeStack().replace('name: shared-edge', 'name: "a b"')]) {
    assert.throws(() => reconcileEdgeAliases(ctx, config, fileOf(text)), /STACK_DEPLOY_EDGE_NAME/u);
  }
  assert.equal(host.calls.length, 0);
});

test('verify: exactly the declared aliases pass; an extra alias, a missing attachment or a docker failure throws', async () => {
  const { host, ctx, deploy } = manager();
  const item = { service: 'api', network: EDGE, aliases: ['nivo-api'] };
  deploy(edgeStack());
  assert.throws(() => verifyEdgeAttachment(ctx, config, item), /nivo_api carries the aliases \[nivo-api, api\] on shared-edge, declared \[nivo-api\]/u);
  reconcileEdgeAliases(ctx, config, fileOf(edgeStack()));
  assert.equal(verifyEdgeAttachment(ctx, config, item), 'aliases [nivo-api]');
  host.state.services.set('nivo_api', { replicas: 1 });
  assert.throws(() => verifyEdgeAttachment(ctx, config, item), /nivo_api is not attached to shared-edge/u);
  host.state.networks.delete(EDGE);
  assert.throws(() => verifyEdgeAttachment(ctx, config, item), /network inspect/u);
});
