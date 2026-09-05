// The planner: scripts/plan-chain.mjs. Two halves. The first runs on the synthetic tree of
// chain-fixture.mjs and proves each rule of the algorithm. The second runs on this tree's own
// operator packages against tests/chains/*.json — the 2.0.0 example workflows rewritten to the
// current operator ids — and proves that a mission whose done-when lines name an example's outcome
// operators plans a chain validate-chain accepts and that carries the example's operators in a
// compatible order (no pair inverted; extra branches such as a plan step are allowed). A fixture that
// names an operator this tree does not carry yet is skipped by name, never silently passed.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { planChain, previewChain, PlanError } from './plan-chain.mjs';
import { validateChain, operatorGraph, loadOperatorGraph, loadMaxParallel, planOf } from './validate-chain.mjs';
import { loadOperatorPackages } from './operator-md.mjs';
import { fakeTree, fakePackage, fakeMission, line } from './chain-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = fakeTree();
const graph = operatorGraph(packages);
const plan = (doneWhen, options = {}) => planChain({ packages, mission: fakeMission(doneWhen), options: { graph, ...options } });
const ops = (p) => p.chain.map((step) => step.map((c) => p.steps[c] + (p.presets[c]?.role ? `#${p.presets[c].role}` : '')));
const accepted = (p, mission, options = {}) => {
  const byBranch = {}; for (const [c, op] of Object.entries(p.steps)) byBranch[c] = { operatorId: op, requirements: p.presets[c] ?? {}, goal: p.goals[c] };
  return validateChain(null, packages, p.chain, p.steps, byBranch, { graph, mission, ...options });
};
const refuses = (doneWhen, options, pattern) => assert.throws(() => plan(doneWhen, options), (e) => e instanceof PlanError && e.errors.some((x) => pattern.test(x)));

test('a target with no needs is the whole chain; no effect tool, no preflight', () => {
  const p = plan([line('content.generate')]);
  assert.deepEqual(ops(p), [['content.generate']]);
  assert.deepEqual(p.goals, { '1/1': { doneWhen: 0 } });
  assert.equal(p.ends, 'user');
  assert.deepEqual(accepted(p, fakeMission([line('content.generate')])), []);
});
test('required inputs and context roles are walked back to their producers; an effect tool opens the chain with preflight', () => {
  const mission = fakeMission([line('uat.verify')]);
  const p = planChain({ packages, mission, options: { graph } });
  assert.deepEqual(ops(p), [['environment.preflight'], ['workspace.bind#be', 'workspace.bind#fe'], ['interface.generate'], ['interface.audit'], ['quality.verify'], ['uat.verify']]);
  // The surface chain serves and observes a runtime, so the preflight checks the runtime family of every bound role.
  assert.deepEqual(p.presets['1/1'], { roles: ['be', 'fe'], runtimeRoles: ['be', 'fe'] });
  // A chain that touches no runtime binds a checkout and owes no server: the runtime family is skipped.
  assert.deepEqual(plan([line('library.update')], { roles: ['fe'] }).presets['1/1'], { roles: ['fe'], runtimeRoles: [] });
  assert.deepEqual(p.goals['6/1'], { doneWhen: 0 });
  assert.deepEqual(p.goals['1/1'], { prerequisite: '2/1' });
  assert.deepEqual(p.goals['2/1'], { prerequisite: '6/1' }, 'the be bind enables uat.verify, the earliest branch that depends on it');
  assert.deepEqual(p.goals['2/2'], { prerequisite: '3/1' });
  assert.match(p.reasons['1/1'], /opens the chain: .*hold browsercontrol/);
  assert.match(p.reasons['4/1'], /produces frontend-surface-audit, which uat.verify requires/);
  assert.deepEqual(accepted(p, mission), []);
});
test('more than one done-when line for an operator with a plan: the plan runs first, the execute branch fans out by units and stands alone in its step', () => {
  const one = plan([line('interface.generate')]);
  assert.ok(!ops(one).flat().includes('interface.plan'), 'one unit needs no map');
  assert.deepEqual(one.fanout, {});
  const p = plan([line('interface.generate', 'the home page'), line('interface.generate', 'the settings page')]);
  const flat = ops(p).flat();
  assert.ok(flat.indexOf('interface.plan') < flat.indexOf('interface.generate'));
  assert.equal(ops(p)[flat.indexOf('interface.generate')].length, 1);
  assert.match(p.reasons[Object.keys(p.steps).find((c) => p.steps[c] === 'interface.plan')], /lists the units interface.generate fans out over/);
  // The second line is a unit of the same branch, not a second branch; the branch cites the first line.
  const cell = Object.keys(p.steps).find((c) => p.steps[c] === 'interface.generate');
  assert.equal(Object.values(p.steps).filter((op) => op === 'interface.generate').length, 1);
  assert.deepEqual(p.goals[cell], { doneWhen: 0 });
  assert.equal(p.fanout[cell], 'units');
  assert.deepEqual(accepted(p, fakeMission([line('interface.generate', 'a'), line('interface.generate', 'b')])), []);
  // Without a plan, a second line for the same operator is a second branch after the first.
  const twice = plan([line('quality.verify', 'a'), line('quality.verify', 'b')]);
  assert.deepEqual(ops(twice), [['quality.verify'], ['quality.verify']]);
  assert.deepEqual([twice.goals['1/1'], twice.goals['2/1']], [{ doneWhen: 0 }, { doneWhen: 1 }]);
});
test('the long-flow law inserts the audit and the walk between an applied surface and its publish, and not under mode dry', () => {
  const p = plan([line('interface.generate'), line('git.publish')]);
  const flat = ops(p).flat();
  for (const [a, b] of [['interface.generate', 'interface.audit'], ['interface.audit', 'uat.verify'], ['uat.verify', 'git.publish'], ['quality.verify', 'git.publish']]) assert.ok(flat.indexOf(a) < flat.indexOf(b), `${a} before ${b}: ${flat.join(' → ')}`);
  assert.equal(p.ends, 'git.publish');
  // A publish is placed last even when a Next table would admit it earlier: a branch the tables cannot
  // reach before the publish is a refusal, never a branch that runs after the boundary left.
  assert.equal(ops(p).flat().at(-1), 'git.publish');
  const late = plan([line('git.publish'), line('interface.generate'), line('runtime.serve')]);
  assert.equal(ops(late).flat().at(-1), 'git.publish');
  assert.match(p.reasons[flat.indexOf('uat.verify') >= 0 ? Object.keys(p.steps).find((c) => p.steps[c] === 'uat.verify') : ''], /the long-flow law/);
  assert.deepEqual(accepted(p, fakeMission([line('interface.generate'), line('git.publish')])), []);
  const dry = plan([line('interface.generate'), line('git.publish')], { requirements: { 'interface.generate': { mode: 'dry' } } });
  assert.ok(!ops(dry).flat().includes('uat.verify'));
});
test('an optional input orders after an in-chain producer; a one-way Next row orders the hand-over first; a cycle drops the softer edge on record', () => {
  const p = plan([line('business.decide'), line('backend.generate'), line('business.reconcile'), line('git.publish')]);
  assert.deepEqual(ops(p), [['environment.preflight'], ['workspace.bind#be'], ['business.decide'], ['architecture.decide'], ['backend.generate'], ['quality.verify'], ['business.reconcile'], ['git.publish']]);
  assert.ok(p.dropped.some((d) => /architecture.decide → business.decide \(optional architecture-decision\)/.test(d)));
  assert.equal(p.presets['3/1'], undefined, 'no preset, no entry');
});
test('a kind an imported slot carries is already produced: no producer is added, the branch records the slot, the preview says where it came from', () => {
  const imported = [{ cell: '100/1', operatorId: 'architecture.decide', sourceSessionId: 'earlier', sourceStep: 21, sourceParallel: 1, outputs: { 'architecture-decision': 'step-100/parallel-1/response/response.md' } }];
  // "Implement what was already decided": the architecture was imported, so nothing decides it again.
  const decided = [line('backend.generate'), line('quality.verify'), line('business.reconcile')];
  const p = plan(decided, { roles: ['be'], imported });
  assert.deepEqual(ops(p), [['environment.preflight'], ['workspace.bind#be'], ['backend.generate'], ['quality.verify'], ['business.reconcile']]);
  const cell = Object.keys(p.steps).find((c) => p.steps[c] === 'backend.generate');
  assert.deepEqual(p.imports, { [cell]: { 'architecture-decision': { input: 'step-100/parallel-1/response/response.md', cell: '100/1', sourceSessionId: 'earlier', sourceStep: 21, sourceParallel: 1 } } });
  assert.ok(previewChain(p, fakeMission(decided)).split('\n').includes(`[${cell} backend.generate] architecture-decision imported from earlier step 21 (step-100/parallel-1/response/response.md)`));
  assert.deepEqual(accepted(p, fakeMission(decided), { imported: { [cell]: new Set(['architecture-decision']) } }), []);
  // Without the slot the same mission walks back to architecture.decide through the tables.
  assert.ok(ops(plan(decided, { roles: ['be'] })).flat().includes('architecture.decide'));
  // A producer the mission names itself wins over the slot: the person asked for a fresh decision.
  const fresh = plan([line('architecture.decide'), line('backend.generate')], { roles: ['be'], imported });
  assert.ok(ops(fresh).flat().includes('architecture.decide'));
  assert.deepEqual(fresh.imports, {});
});
test('the mission roles bind a checkout no table pulls in; the parallel cap and shared writes shape a step', () => {
  const p = plan([line('release.deploy')], { roles: ['be'] });
  assert.deepEqual(ops(p), [['environment.preflight'], ['workspace.bind#be'], ['quality.verify'], ['release.deploy']]);
  assert.equal(p.ends, 'release.deploy');
  // Without a declared role nothing binds a checkout, and preflight hands to no gate: the planner refuses and names it.
  refuses([line('release.deploy')], {}, /quality.verify could run next, and no Next table of environment.preflight permits/);
  assert.deepEqual(p.goals['2/1'], { prerequisite: '3/1' }, 'the declared bind enables every working branch');
  // Two writers of one alias never share a step, even when nothing else orders them.
  const shared = [
    fakePackage({ id: 'a.write', primary: 'a-out', tools: { sourcewrite: 'declared-write-set' }, outputs: ['a-out'], writes: ['@workspaces/x/branch/session'], next: ['b.write'] }),
    fakePackage({ id: 'b.write', primary: 'b-out', tools: { sourcewrite: 'declared-write-set' }, outputs: ['b-out'], writes: ['@workspaces/x/branch/session'], next: ['a.write'] }),
  ];
  const two = planChain({ packages: shared, mission: fakeMission([line('a.write'), line('b.write')]) });
  assert.deepEqual(two.chain, [['1/1'], ['2/1']]);
  // Two writers of different aliases do share a step.
  const apart = planChain({ packages: [shared[0], fakePackage({ id: 'b.write', primary: 'b-out', tools: { sourcewrite: 'declared-write-set' }, outputs: ['b-out'], writes: ['@workspaces/y/branch/session'], next: ['a.write'] })], mission: fakeMission([line('a.write'), line('b.write')]) });
  assert.deepEqual(apart.chain, [['1/1', '1/2']]);
  // Two writers the tables never chain are a refusal that names them.
  refuses([line('library.update'), line('interface.generate')], {}, /could run next, and no Next table of/);
  const one = planChain({ packages, mission: fakeMission([line('uat.verify')]), options: { graph, maxParallel: 1 } });
  for (const step of one.chain) assert.equal(step.length, 1);
});
test('the planner refuses what the tables leave ambiguous or unreachable, naming it', () => {
  refuses([line('no.such')], {}, /names no.such, which is not an operator/);
  assert.throws(() => planChain({ packages, mission: fakeMission([]), options: { graph } }), /doneWhen is empty/);
  // A required kind with two primary producers and an Inputs row that names neither.
  const ambiguous = fakeTree().concat([]);
  const consumer = ambiguous.find((p) => p.manifest.id === 'interface.audit');
  consumer.en.tables.inputs.rows[0].from = 'the commit under observation';
  assert.throws(() => planChain({ packages: ambiguous, mission: fakeMission([line('interface.audit')]) }), (e) => e instanceof PlanError && /interface.generate, interface.fix all name it as their primary output/.test(e.message));
  // A step no Next table reaches.
  const cut = fakeTree();
  cut.find((p) => p.manifest.id === 'workspace.bind').en.tables.next.rows = [];
  assert.throws(() => planChain({ packages: cut, mission: fakeMission([line('quality.verify')]), options: { roles: ['fe'] } }), (e) => e instanceof PlanError && /no Next table of workspace.bind permits/.test(e.message));
});
test('the preview prints two lines per branch and the end', () => {
  const mission = fakeMission([line('content.generate', 'the unit exists')]);
  const text = previewChain(planChain({ packages, mission, options: { graph } }), mission);
  assert.deepEqual(text.split('\n'), ['[1/1 content.generate] goal: doneWhen:0 the unit exists', '[1/1 content.generate] evidence for done-when 0: "the unit exists"', 'ends: user']);
});

// The fixtures: the example workflows, reproduced from their outcomes on this tree's real packages.
const real = await loadOperatorPackages(root);
const realGraph = await loadOperatorGraph(root, real);
const maxParallel = await loadMaxParallel(root);
const fixturesDir = path.join(root, 'tests', 'chains');
const fixtures = await Promise.all((await readdir(fixturesDir)).filter((f) => f.endsWith('.json')).sort().map(async (f) => JSON.parse(await readFile(path.join(fixturesDir, f), 'utf8'))));
const strip = (id) => id.split('#')[0];
test('every fixture names its mission, its example chain and its end, and its id equals its file name', async () => {
  assert.equal(fixtures.length, 16);
  for (const fx of fixtures) {
    assert.ok(fx.mission?.doneWhen?.length, `${fx.id}: mission.doneWhen`);
    assert.ok(Array.isArray(fx.example) && fx.example.length, `${fx.id}: example`);
    assert.ok(['user', 'git.publish', 'release.deploy'].includes(fx.ends), `${fx.id}: ends`);
    assert.ok(fx.when?.en && fx.when?.vi, `${fx.id}: when`);
    const last = fx.example[fx.example.length - 1].map(strip);
    if (fx.ends !== 'user') assert.ok(last.includes(fx.ends), `${fx.id}: ends must be an operator of the last example step`);
  }
});
for (const fx of fixtures) {
  test(`fixture ${fx.id}: the planner reproduces the example from its done-when lines`, (t) => {
    const needed = [...new Set([...fx.example.flat().map(strip), ...fx.mission.doneWhen.map((l) => l.producedBy)])];
    const missing = needed.filter((id) => !realGraph.has(id));
    if (missing.length) return t.skip(`this tree does not carry ${missing.join(', ')} yet`);
    // A fixture may declare producers an earlier session delivered: the slots the planner would read from the session, as import.json leaves them.
    const imported = (fx.imported ?? []).map((slot, i) => ({ cell: `0/${i + 1}`, operatorId: slot.operatorId, sourceSessionId: 'fixture', sourceStep: 1, sourceParallel: 1, outputs: Object.fromEntries(slot.outputs.map((k) => [k, `step-0/parallel-${i + 1}/response/${k}`])) }));
    const p = planChain({ packages: real, mission: fx.mission, options: { graph: realGraph, maxParallel, roles: fx.options?.roles ?? [], requirements: fx.options?.requirements ?? {}, imported } });
    // Accepted by the gate.
    const byBranch = {}; for (const [c, op] of Object.entries(p.steps)) byBranch[c] = { operatorId: op, requirements: p.presets[c] ?? {}, goal: p.goals[c] };
    const credited = Object.fromEntries(Object.entries(p.imports ?? {}).map(([c, kinds]) => [c, new Set(Object.keys(kinds))]));
    assert.deepEqual(validateChain(root, real, p.chain, p.steps, byBranch, { graph: realGraph, mission: fx.mission, maxParallel, imported: credited }), []);
    // Every example operator is there, no example order is inverted, and the end matches.
    const planned = ops(p);
    const at = (id) => planned.findIndex((step) => step.includes(id));
    for (const id of fx.example.flat()) assert.notEqual(at(id), -1, `${fx.id}: ${id} is missing from ${JSON.stringify(planned)}`);
    fx.example.forEach((step, n) => fx.example.slice(n + 1).forEach((later) => { for (const a of step) for (const b of later) assert.ok(at(a) <= at(b), `${fx.id}: ${a} must not run after ${b}: ${JSON.stringify(planned)}`); }));
    assert.equal(p.ends, fx.ends, `${fx.id}: ends`);
    // Every branch has a goal, and every done-when line has its branch.
    for (const c of Object.keys(p.steps)) assert.ok(p.goals[c], `${fx.id}: ${c} has a goal`);
    fx.mission.doneWhen.forEach((l, i) => assert.ok(Object.values(p.goals).some((g) => g.doneWhen === i) || Object.entries(p.steps).some(([c, op]) => op === l.producedBy && p.fanout[c]), `${fx.id}: done-when ${i} (${l.producedBy}) has a branch, or is a unit of its operator's fanned-out branch`));
    // A plan sibling, when this tree has one and more than one line names the execute operator, precedes
    // its execute branch, which fans out; with one line there is no plan step.
    for (const [c, op] of Object.entries(p.steps)) {
      const sibling = planOf(realGraph, op);
      if (!sibling) continue;
      const count = fx.mission.doneWhen.filter((l) => l.producedBy === op).length;
      if (count > 1) { assert.ok(at(sibling.id) !== -1 && at(sibling.id) < at(op), `${fx.id}: ${sibling.id} precedes ${op}`); assert.equal(p.fanout[c], 'units'); }
      else assert.equal(at(sibling.id), -1, `${fx.id}: one ${op} unit needs no ${sibling.id}`);
    }
    // A served head is observed after it is served, when the chain serves one.
    if (at('runtime.serve') !== -1 && at('interface.audit') !== -1) assert.ok(at('runtime.serve') < at('interface.audit'), `${fx.id}: serve before audit`);
  });
}
