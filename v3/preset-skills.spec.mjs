import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { init } from '../bin/starci-skills.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const read = file => fs.readFileSync(file, 'utf8');
const clone = value => structuredClone(value);
const expectedIds = ['architecture', 'build', 'business', 'content', 'data', 'fix', 'goal', 'maintain', 'migrate', 'redesign-fe', 'release', 'runtime', 'uat', 'visual'].map(x => 'starci-' + x);
function inside(root, relative) {
  assert.equal(typeof relative, 'string');
  assert.ok(relative.length && !path.isAbsolute(relative) && !relative.includes('\\'), 'portable relative path');
  const resolved = path.resolve(root, relative);
  const rel = path.relative(root, resolved);
  assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'path stays inside package');
  assert.ok(fs.existsSync(resolved), 'referenced path exists: ' + relative);
  assert.equal(fs.realpathSync(resolved), resolved, 'no symlink escape');
  return resolved;
}
function load(root) {
  const catalog = readJSON(path.join(root, 'skills/catalog.json'));
  const recipes = Object.fromEntries(catalog.skills.map(entry => [entry.id, readJSON(inside(root, 'skills/' + entry.recipe))]));
  return { catalog, recipes };
}
// Structural acceptance only: this is not an agent or a background scheduler.
// Numeric assertions deliberately pin the current common protocol's safety ceiling.
function validate(root, bundle) {
  const { catalog, recipes } = bundle;
  assert.equal(catalog.schema, 'work/skills@1');
  assert.deepEqual(catalog.policy, {
    readOnly: 'answer-or-inspect', noMatch: 'report-gap', crossPresetBudget: 'shared-prompt-budget',
  });
  assert.equal(catalog.limitsSource, '../v3/ops/common.md');
  inside(root, 'v3/ops/common.md');
  const ops = readJSON(path.join(root, 'v3/ops/catalog.json'));
  const profiles = readJSON(path.join(root, 'v3/schemas/profiles.json'));
  const ids = new Set();
  for (const entry of catalog.skills) {
    assert.ok(!ids.has(entry.id), 'unique preset ID');
    ids.add(entry.id);
    assert.ok(entry.purpose.trim() && entry.selection.trim());
    assert.equal(entry.document, entry.id + '/SKILL.md');
    assert.equal(entry.recipe, entry.id + '/recipe.json');
    const document = inside(root, 'skills/' + entry.document);
    const mirror = inside(root, 'skills/' + entry.id + '/SKILL.vi.md');
    inside(root, 'skills/' + entry.recipe);
    const skill = read(document);
    assert.equal(skill.match(/^name: (.+)$/m)?.[1], entry.id);
    assert.ok(skill.match(/^description: (.+)$/m)?.[1].length > 20);
    for (const instruction of [document, mirror]) {
      for (const [, ref] of read(instruction).matchAll(/\]\(([^)]+)\)/g)) {
        const resolved = path.resolve(path.dirname(instruction), ref);
        inside(root, path.relative(root, resolved).replaceAll('\\', '/'));
      }
    }
    const recipe = recipes[entry.id];
    assert.deepEqual(Object.keys(recipe).sort(), ['id', 'modes', 'schema']);
    assert.equal(recipe.schema, 'work/preset@1');
    assert.equal(recipe.id, entry.id);
    assert.ok(Object.keys(recipe.modes).length > 0, 'mode required');
    for (const selected of Object.values(recipe.modes)) {
      assert.ok(selected.when.trim(), 'mode has selection intent');
      assert.ok(selected.waves.length >= 1 && selected.waves.length <= 3, 'bounded waves');
      const waves = new Set();
      const slots = new Set();
      const branchIds = selected.branches?.allowed || [];
      if (selected.branches) {
        assert.equal(selected.branches.min, 1);
        assert.ok(branchIds.length > 0 && branchIds.length <= 3);
        assert.equal(new Set(branchIds).size, branchIds.length);
      }
      const usedBranches = new Set();
      for (const wave of selected.waves) {
        assert.ok(wave.id && !waves.has(wave.id), 'unique wave ID');
        waves.add(wave.id);
        assert.ok(wave.invocations.length >= 1 && wave.invocations.length <= 3, 'bounded width');
        for (const invocation of wave.invocations) {
          assert.deepEqual(Object.keys(invocation).sort(), ['op', 'scope', 'slot', ...(invocation.branch ? ['branch'] : [])].sort(), 'no hidden dispatch or effects fields');
          assert.ok(invocation.slot && !slots.has(invocation.slot), 'unique slot');
          slots.add(invocation.slot);
          assert.ok(invocation.scope.trim());
          const op = ops.ops.find(op => op.id === invocation.op);
          assert.ok(op, 'actual op exists: ' + invocation.op);
          assert.ok(Object.hasOwn(profiles, op.completionProfile), 'implemented completion profile');
          assert.ok(op.nodeKinds.includes(op.completionProfile));
          inside(root, 'v3/ops/' + op.document);
          inside(root, 'v3/ops/' + ops.commonDocument);
          assert.equal(op.contract.graphPolicy.dispatch, 'never');
          if (invocation.branch) {
            assert.ok(branchIds.includes(invocation.branch), 'branch must be declared');
            usedBranches.add(invocation.branch);
          }
        }
      }
      assert.deepEqual([...usedBranches].sort(), [...branchIds].sort(), 'no unused branch declaration');
    }
  }
  return true;
}
function select(bundle, id, mode, branches = []) {
  const selected = bundle.recipes[id].modes[mode];
  assert.ok(selected, 'known mode');
  if (selected.branches) {
    assert.ok(branches.length >= selected.branches.min);
    assert.equal(new Set(branches).size, branches.length);
    assert.ok(branches.every(branch => selected.branches.allowed.includes(branch)), 'known selected branches');
  } else assert.equal(branches.length, 0);
  return selected.waves.map(wave => wave.invocations.filter(invocation => !invocation.branch || branches.includes(invocation.branch)).map(invocation => invocation.op));
}
function enforceSharedBudget(plans) {
  // A conservative aligned preview: no reordering, flattening or synthesizing extra waves.
  const maxWaves = Math.max(...plans.map(plan => plan.length));
  assert.ok(maxWaves <= 3);
  for (let i = 0; i < maxWaves; i++) {
    assert.ok(plans.reduce((count, plan) => count + (plan[i]?.length || 0), 0) <= 3, 'shared prompt width');
  }
}
function snapshot(root) {
  const files = {};
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else files[path.relative(root, file).replaceAll('\\', '/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  };
  walk(root);
  return files;
}
function temp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-presets-'));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-presets-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('all 14 discoverable presets resolve actual op profiles, documents and fixed bounded modes', () => {
  const bundle = load(packageRoot);
  assert.deepEqual(bundle.catalog.skills.map(x => x.id).sort(), expectedIds);
  assert.equal(validate(packageRoot, bundle), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'skills/starci-lite/SKILL.md')), false);
});
test('fixed branch subsets preserve BE/FE pairing and named UAT flow isolation slots', () => {
  const bundle = load(packageRoot);
  assert.deepEqual(select(bundle, 'starci-build', 'default', ['backend']), [['backend.plan'], ['backend.generate'], ['quality.verify']]);
  assert.deepEqual(select(bundle, 'starci-fix', 'default', ['frontend']), [['interface.audit'], ['interface.fix'], ['quality.verify']]);
  assert.deepEqual(select(bundle, 'starci-uat', 'browser', ['flow-1', 'flow-3']), [['uat.plan'], ['uat.verify', 'uat.verify'], ['workflow.verify']]);
  assert.deepEqual(select(bundle, 'starci-uat', 'api'), [['uat.plan'], ['api.verify'], ['workflow.verify']]);
  assert.throws(() => select(bundle, 'starci-uat', 'browser', ['flow-4']));
  assert.throws(() => select(bundle, 'starci-build', 'default', []));
});
test('effect-specific modes cannot silently substitute deployment, identity or data migration', () => {
  const bundle = load(packageRoot);
  assert.deepEqual(select(bundle, 'starci-release', 'publish-only'), [['git.publish']]);
  assert.deepEqual(select(bundle, 'starci-runtime', 'identity'), [['environment.preflight'], ['identity.provision'], ['api.verify']]);
  assert.deepEqual(select(bundle, 'starci-runtime', 'serve'), [['environment.preflight'], ['runtime.serve'], ['api.verify']]);
  assert.deepEqual(select(bundle, 'starci-data', 'seed'), [['data.plan'], ['data.seed'], ['quality.verify']]);
  assert.deepEqual(select(bundle, 'starci-data', 'migrate'), [['data.plan'], ['migration.release'], ['quality.verify']]);
  assert.deepEqual(select(bundle, 'starci-migrate', 'default'), [['workspace.migrate'], ['business.decide'], ['workflow.verify']]);
  assert.throws(() => select(bundle, 'starci-release', 'auto'));
});
test('multiple preset selections share one width budget instead of multiplying their allowances', () => {
  const bundle = load(packageRoot);
  const build = select(bundle, 'starci-build', 'default', ['backend', 'frontend']);
  const uat = select(bundle, 'starci-uat', 'browser', ['flow-1', 'flow-2', 'flow-3']);
  assert.doesNotThrow(() => enforceSharedBudget([build]));
  assert.doesNotThrow(() => enforceSharedBudget([uat]));
  assert.throws(() => enforceSharedBudget([build, uat]), /shared prompt width/);
});
test('structural negatives reject unknown ops, unsafe links, hidden dispatch, excess waves and branch typos', () => {
  const mutate = fn => {
    const bundle = clone(load(packageRoot));
    fn(bundle);
    assert.throws(() => validate(packageRoot, bundle));
  };
  mutate(b => { b.recipes['starci-goal'].modes.default.waves[0].invocations[0].op = 'imaginary.pass'; });
  mutate(b => { b.catalog.skills[0].document = '../../outside/SKILL.md'; });
  mutate(b => { b.recipes['starci-goal'].modes.default.waves[0].invocations[0].dispatch = 'next'; });
  mutate(b => { const m = b.recipes['starci-goal'].modes.default; m.waves.push(clone(m.waves[0])); });
  mutate(b => { const w = b.recipes['starci-architecture'].modes.default.waves[1]; w.invocations.push(clone(w.invocations[0])); });
  mutate(b => { b.recipes['starci-build'].modes.default.waves[1].invocations[0].branch = 'backed'; });
  mutate(b => { b.catalog.policy.readOnly = 'execute'; });
  mutate(b => { b.recipes['starci-goal'].autoNext = 'release.deploy'; });
  mutate(b => { b.catalog.skills.push(clone(b.catalog.skills[0])); });
});
test('relocated installed skills load local recipes and actual contracts without cooking product work', t => {
  const root = temp(t);
  init({ dir: root, bootstrap: true }, () => {});
  const installed = path.join(root, '.claude');
  const before = snapshot(root);
  const bundle = load(installed);
  assert.deepEqual(bundle, load(packageRoot));
  assert.equal(validate(installed, bundle), true);
  for (const op of ['workspace.migrate', 'interface.audit', 'uat.verify']) {
    const result = spawnSync(process.execPath, [path.join(installed, 'bin/starci-skills.mjs'), 'work', 'op', op], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Contract display only/);
    assert.ok(result.stdout.includes(op));
  }
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.existsSync(path.join(root, '.work')), false);
  assert.equal(fs.existsSync(path.join(root, '.worktrees')), false);
  const paths = Object.keys(before);
  assert.ok(!paths.some(file => /(^|\/)(request|response)\.json$/.test(file)));
  assert.ok(!paths.some(file => file.includes('skills/starci-lite/')));
});
