// 2026-10-09: two lanes ran `starci runtime gen-catalog --write` from a clone with STARCI_RUNTIME unset: the per-user record outranks the checkout, so the live
// tree's runtime ran and wrote the live tree. A verb that writes the runtime tree now needs the located tree to be the CLI's own, or an explicit choice.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main } from '../../packages/cli/src/main.mjs';
import { locateRuntime } from '../../packages/cli/src/runtime-locate.mjs';
import { RUNTIME_TREE_FOREIGN, treeTargetRefusal } from '../../packages/cli/src/runtime-target.mjs';

const tree = (base, name) => {
  const root = path.join(base, name);
  fs.mkdirSync(path.join(root, 'scripts', 'cli'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'cli', 'main.mjs'), '');
  return root;
};
const catalog = { global: [{ name: 'json', type: 'boolean' }, { name: 'cwd', type: 'string' }, { name: 'help', type: 'boolean' }], commands: [], groups: { runtime: { owner: 'runtime', summary: 's', verbs: {
  gen: { group: 'runtime', verb: 'gen', summary: 'g', json: 'none', writesRuntimeTree: 'write', flags: [{ name: 'write', type: 'boolean' }, { name: 'check', type: 'boolean' }, { name: 'root', type: 'string' }] },
  sync: { group: 'runtime', verb: 'sync', summary: 's', json: 'none', writesRuntimeTree: '!check', flags: [{ name: 'check', type: 'boolean' }] },
  look: { group: 'runtime', verb: 'look', summary: 'l', json: 'none', flags: [] } } } } };

function setup(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-tree-target-'));
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

test('a write verb started from a clone is refused when the record points at the live tree, and nothing is spawned', async (t) => {
  const w = setup(t);
  const out = await run(['runtime', 'gen', '--write'], w);
  assert.equal(out.code, 2);
  assert.match(out.err, new RegExp(RUNTIME_TREE_FOREIGN));
  assert.equal(out.spawned.length, 0);
  assert.equal((await run(['runtime', 'sync'], w)).spawned.length, 0, 'a verb that writes unless --check');
});

test('an explicit choice, the same tree, a read form and a read verb all run', async (t) => {
  const w = setup(t);
  assert.equal((await run(['runtime', 'gen', '--write'], { ...w, env: { STARCI_RUNTIME: w.own } })).spawned.length, 1, 'STARCI_RUNTIME');
  assert.equal((await run(['runtime', 'gen', '--write', '--root', w.own], w)).spawned.length, 1, '--root');
  assert.equal((await run(['runtime', 'gen', '--check'], w)).spawned.length, 1, 'the check form');
  assert.equal((await run(['runtime', 'sync', '--check'], w)).spawned.length, 1);
  assert.equal((await run(['runtime', 'look'], w)).spawned.length, 1, 'a read verb resolves the host runtime');
  fs.rmSync(path.join(w.home, '.starci', 'runtime.json'));
  assert.equal((await run(['runtime', 'gen', '--write'], w)).spawned.length, 1, 'no record: the CLI own tree');
});

test('the refusal is pure over the verb, the located tree and the CLI own tree', () => {
  const command = { writesRuntimeTree: true };
  assert.equal(treeTargetRefusal({ command, args: [], located: { root: '/a', source: 'upward' }, own: '/b' })?.code, RUNTIME_TREE_FOREIGN);
  assert.equal(treeTargetRefusal({ command, args: [], located: { root: '/a', source: 'upward' }, own: null }), null, 'a CLI outside a runtime');
  assert.equal(treeTargetRefusal({ command: {}, args: [], located: { root: '/a', source: 'record' }, own: '/b' }), null);
});
