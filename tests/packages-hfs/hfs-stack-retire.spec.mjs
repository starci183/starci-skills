import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { retireCompose } from '../../packages/hfs/stack/retire.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { fakeRunner, makeApp } from '../helpers/stack-remote-fakes.mjs';

const app = makeApp();
after(() => app.cleanup());
const NL = String.fromCharCode(10);
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const bad = () => ({ status: 1, stdout: '', stderr: 'no' });

const CONTAINERS = [
  { name: 'old-web-web-1', project: 'old-web', service: 'web', depends: '', image: 'shop/web' },
  { name: 'old-engine-api-1', project: 'old-engine', service: 'api', depends: 'db:service_healthy:true', image: 'shop/api' },
  { name: 'old-engine-db-1', project: 'old-engine', service: 'db', depends: '', image: 'postgres:16' },
  { name: 'tenant-web-1', project: 'tenant', service: 'web', depends: '', image: 'tenant/web' },
  { name: 'old-edge-proxy', project: 'old-edge', service: 'proxy', depends: '', image: 'traefik:v3' },
];

function setup({ failStop = null } = {}) {
  const state = { updated: [], stopped: [] };
  const docker = {
    ps: () => ok(CONTAINERS.map((item) => item.name).join(NL) + NL),
    inspect: (args) => {
      const item = CONTAINERS.find((entry) => entry.name === args.at(-1));
      return ok(`/${item.name}|${item.project}|${item.service}|${item.depends}|always|${item.image}${NL}`);
    },
    update: (args) => { state.updated.push(args.at(-1)); return ok(); },
    stop: (args) => { if (args.at(-1) === failStop) return bad(); state.stopped.push(args.at(-1)); return ok(); },
  };
  const host = fakeHost({ overrides: { docker } });
  const run = fakeRunner(host, {});
  return { host, state, run, ctx: host.ctx({ env: {} }), deps: { ssh: run } };
}

const config = { ...app.config, ingress: { legacy: { container: 'old-edge-proxy' } } };

test('retire needs projects, valid names, and never the swarm stack itself', async () => {
  const { ctx, deps } = setup();
  await assert.rejects(retireCompose(ctx, config, { projects: [] }, deps), (error) => error.code === 'STACK_RETIRE_NO_PROJECT');
  await assert.rejects(retireCompose(ctx, config, { projects: ['Bad Name'] }, deps), (error) => error.code === 'STACK_RETIRE_PROJECT');
  await assert.rejects(retireCompose(ctx, config, { projects: [config.stack] }, deps), (error) => error.code === 'STACK_RETIRE_PROJECT');
});

test('a dry run lists the containers of the selected projects (applications before data) and changes nothing', async () => {
  const { ctx, deps, state } = setup();
  const result = await retireCompose(ctx, config, { projects: ['old-web', 'old-engine'] }, deps);
  assert.equal(result.ok, true);
  assert.ok(result.lines.some((line) => line.includes('3 running container(s)')));
  assert.ok(result.lines.some((line) => line.startsWith('dry run:')));
  const order = result.lines[0].split(': ')[1].split(', ');
  assert.ok(order.indexOf('old-engine-api-1') < order.indexOf('old-engine-db-1'), 'the api stops before its database');
  assert.ok(!order.includes('tenant-web-1'));
  assert.deepEqual([state.updated, state.stopped], [[], []]);
});

test('execute sets the restart policy to no, stops, and removes nothing', async () => {
  const { ctx, deps, state, run } = setup();
  const result = await retireCompose(ctx, config, { projects: ['old-web', 'old-engine'], execute: true }, deps);
  assert.equal(result.ok, true);
  assert.deepEqual([...state.stopped].sort(), ['old-engine-api-1', 'old-engine-db-1', 'old-web-web-1']);
  assert.deepEqual([...state.updated].sort(), [...state.stopped].sort());
  assert.equal(run.commands.some((entry) => /'rm'|'down'/u.test(entry.command)), false);
  assert.ok(result.lines.some((line) => line.startsWith('retired 3 container(s)')));
});

test('a container that cannot be stopped is reported and fails the result', async () => {
  const { ctx, deps } = setup({ failStop: 'old-web-web-1' });
  const result = await retireCompose(ctx, config, { projects: ['old-web'], execute: true }, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('FAILED to retire: old-web-web-1'));
  assert.deepEqual(result.data.failed, ['old-web-web-1']);
});

test('a project that still runs the legacy edge is refused, and an empty selection is nothing to do', async () => {
  const { ctx, deps } = setup();
  await assert.rejects(retireCompose(ctx, config, { projects: ['old-edge'], execute: true }, deps), (error) => error.code === 'STACK_RETIRE_EDGE');
  const none = await retireCompose(ctx, config, { projects: ['unknown-project'], execute: true }, deps);
  assert.equal(none.ok, true);
  assert.ok(none.lines.includes('nothing to retire'));
  const noEdge = await retireCompose(ctx, { ...app.config }, { projects: ['unknown-project'] }, deps);
  assert.equal(noEdge.ok, true);
});
