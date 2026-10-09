// 2026-10-09: a lane ran `test affected --run` in its clone with STARCI_RUNTIME unset; the per-user record outranked the checkout, so the live tree's code and specs ran and
// the verdict was about the wrong tree. A verb declares its side: `tree` (about the runtime tree that owns the running bin) runs this checkout unless a tree was chosen
// explicitly; `host` runs the located runtime through the record.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main } from '../../packages/cli/src/main.mjs';
import { locateRuntime } from '../../packages/cli/src/runtime-locate.mjs';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';

const tree = (base, name) => {
  const root = path.join(base, name);
  fs.mkdirSync(path.join(root, 'scripts', 'cli'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'cli', 'main.mjs'), '');
  return root;
};
const verb = (name, runtimeSide) => ({ group: 'runtime', verb: name, summary: name, json: 'none', runtimeSide, flags: [{ name: 'root', type: 'string' }] });
const catalog = { global: [{ name: 'json', type: 'boolean' }, { name: 'cwd', type: 'string' }, { name: 'help', type: 'boolean' }], commands: [],
  groups: { runtime: { owner: 'runtime', summary: 's', verbs: { judge: verb('judge', 'tree'), serve: verb('serve', 'host') } } } };

function setup(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-side-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const own = tree(base, 'clone'), live = tree(base, 'live');
  const home = path.join(base, 'home');
  fs.mkdirSync(path.join(home, '.starci'), { recursive: true });
  fs.writeFileSync(path.join(home, '.starci', 'runtime.json'), JSON.stringify({ root: live }));
  return { own, live, home };
}
async function run(argv, { own, home, env = {} }) {
  const spawned = [];
  let err = '';
  const code = await main(argv, { catalog, env, home, cwd: own, ownRuntimeRoot: () => own, stderr: { write: (x) => { err += x; } }, stdout: { write: () => {} },
    locateRuntime: (o) => locateRuntime({ ...o, home, embeddedRoot: own }), spawn: (...call) => { spawned.push(call); return { status: 0 }; } });
  return { code, err, spawned };
}
const ranTree = (spawned) => path.dirname(path.dirname(path.dirname(spawned[0][1][0])));

test('a tree-side verb started from a clone runs the clone although the record points at the live tree, and says so', async (t) => {
  const world = setup(t);
  const out = await run(['runtime', 'judge'], world);
  assert.equal(out.code, 0, out.err);
  assert.equal(ranTree(out.spawned), world.own);
  assert.match(out.err, /ran .*clone, not .*live/);
});

test('a host-side verb runs the located runtime, the record included', async (t) => {
  const world = setup(t);
  const out = await run(['runtime', 'serve'], world);
  assert.equal(ranTree(out.spawned), world.live);
});

test('a tree chosen explicitly (STARCI_RUNTIME or --root) outranks the side', async (t) => {
  const world = setup(t);
  const byEnv = await run(['runtime', 'judge'], { ...world, env: { STARCI_RUNTIME: world.live } });
  assert.equal(ranTree(byEnv.spawned), world.live);
  const byRoot = await run(['runtime', 'judge', '--root', world.live], world);
  assert.equal(ranTree(byRoot.spawned), world.live, 'the verb keeps its own --root');
});

test('every verb of the shipped catalog declares its side, and the verbs that judge or write the runtime tree are tree-side', () => {
  const sides = Object.entries(CATALOG.groups).flatMap(([group, g]) => Object.entries(g.verbs).map(([name, v]) => [`${group} ${name}`, v.runtimeSide]));
  assert.deepEqual(sides.filter(([, side]) => side !== 'tree' && side !== 'host'), []);
  const side = Object.fromEntries(sides);
  for (const name of ['runtime check', 'runtime revision-scope', 'runtime artefacts', 'runtime gen-catalog', 'runtime readme-blocks', 'test affected', 'release sync-runtime']) assert.equal(side[name], 'tree', name);
  for (const name of ['workflow start', 'kernel status', 'supervisor status', 'reconciler start', 'runtime deploy', 'machine worktrees']) if (side[name] !== undefined) assert.equal(side[name], 'host', name);
});
