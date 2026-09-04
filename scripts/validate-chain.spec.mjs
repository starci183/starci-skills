// The chain gate: scripts/validate-chain.mjs on the synthetic tree of chain-fixture.mjs.
import assert from 'node:assert/strict';
import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateChain, operatorGraph, writesSurface, planOf, primaryProducerOf, producersOf, readImportedInputs, readImportedSlots } from './validate-chain.mjs';
import { plannedRequirementErrors } from './validate-request.mjs';
import { importProducer } from './producer-import.mjs';
import { producerImportFixture, write } from './producer-import-fixture.mjs';
import { fakeTree, fakePackage, fakeMission, line } from './chain-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = fakeTree();
const graph = operatorGraph(packages);
// A chain from a list of steps, each a list of [operator, request extras]; requests carry operatorId and requirements.
function chainOf(spec) {
  const chain = []; const steps = {}; const byBranch = {};
  spec.forEach((step, n) => {
    chain.push(step.map((b, m) => {
      const [op, extra = {}] = Array.isArray(b) ? b : [b];
      const cell = `${n + 1}/${m + 1}`;
      steps[cell] = op; byBranch[cell] = { operatorId: op, requirements: {}, ...extra };
      return cell;
    }));
  });
  return { chain, steps, byBranch };
}
const check = (spec, options = {}) => { const { chain, steps, byBranch } = chainOf(spec); return validateChain(null, packages, chain, steps, byBranch, { graph, ...options }); };
const surface = [['environment.preflight'], [['workspace.bind', { requirements: { role: 'be' } }], ['workspace.bind', { requirements: { role: 'fe' } }]], ['interface.generate'], ['runtime.serve'], ['interface.audit'], ['quality.verify'], ['uat.verify'], ['git.publish']];

test('the graph reads primary output, inputs with their named sources, roles, writes, next and effects from the tables', () => {
  const audit = graph.get('interface.audit');
  assert.equal(audit.primary, 'frontend-surface-audit');
  assert.deepEqual(audit.required.map((i) => i.kind), ['frontend-source-application', 'frontend-presentation-resolution', 'route']);
  assert.deepEqual(audit.required[0].from, ['interface.generate', 'interface.fix']);
  assert.deepEqual([...audit.roles], ['fe']);
  assert.ok(audit.next.has('quality.verify') && audit.effects);
  assert.deepEqual([...graph.get('interface.generate').writes], ['@workspaces/fe/branch/session']);
  assert.equal(graph.get('workspace.bind').effects, false);
  assert.equal(primaryProducerOf(graph, 'frontend-source-application'), null, 'two primaries: interface.generate and interface.fix');
  assert.equal(primaryProducerOf(graph, 'frontend-surface-audit'), 'interface.audit');
  assert.deepEqual(producersOf(graph, 'route'), ['workspace.bind']);
  assert.equal(planOf(graph, 'interface.generate').id, 'interface.plan');
  assert.equal(planOf(graph, 'interface.audit').id, 'interface.plan', 'a plan operator is the domain\'s: every other operator of the domain executes its units');
  assert.equal(planOf(graph, 'interface.plan'), null);
  assert.equal(planOf(graph, 'quality.verify'), null);
  assert.equal(writesSurface(graph.get('interface.generate')), true);
  assert.equal(writesSurface(graph.get('interface.generate'), { mode: 'dry' }), false);
  assert.equal(writesSurface(graph.get('interface.audit')), false);
});
test('a lawful surface chain passes', () => {
  assert.deepEqual(check(surface), []);
});
test('shape: cells sit in their step, every cell has an operator, every recorded branch is in the chain', () => {
  const errors = validateChain(null, packages, [['1/1'], ['3/1']], { '1/1': 'workspace.bind', '2/1': 'quality.verify' }, {}, { graph });
  assert.ok(errors.some((e) => e.includes('3/1') && e.includes('step number is not 2')));
  assert.ok(errors.some((e) => e.includes('records no operator')));
  assert.ok(errors.some((e) => e.includes('steps records 2/1')));
  assert.ok(validateChain(null, packages, [], {}, {}, { graph }).some((e) => e.includes('non-empty')));
  const mismatch = check([[['workspace.bind', { operatorId: 'quality.verify' }]]]);
  assert.ok(mismatch.some((e) => e.includes('request.json runs quality.verify')));
});
test('an unknown operator, a step no Next table reaches, and a same-operator re-entry', () => {
  assert.ok(check([['no.such']]).some((e) => e.includes('unknown operator no.such')));
  assert.ok(check([['environment.preflight'], ['quality.verify']]).some((e) => e.includes('no Next table of step 1')));
  assert.deepEqual(check([['workspace.bind'], ['workspace.bind'], ['quality.verify']]), []);
});
test('a required input needs an earlier producer; a required role needs an earlier bind of that role', () => {
  const noInput = check([['workspace.bind'], ['git.publish']]);
  assert.ok(noInput.some((e) => e.includes('git.publish requires input changes')));
  const noRole = check([[['workspace.bind', { requirements: { role: 'be' } }]], ['interface.generate']]);
  assert.ok(noRole.some((e) => e.includes('requires @workspaces/fe')));
  assert.deepEqual(check([[['workspace.bind', { requirements: { role: 'fe' } }]], ['interface.generate']]), []);
});
test('a required input is fed by an imported slot the request names, and only when the import gate accepts it', async () => {
  const be = ['workspace.bind', { requirements: { role: 'be' } }];
  // Credited, the kind feeds the branch as an earlier producer would; uncredited, the branch is unfed.
  assert.deepEqual(check([[be], ['backend.generate']], { imported: { '2/1': new Set(['architecture-decision']) } }), []);
  assert.ok(check([[be], ['backend.generate']]).some((e) => e.includes('2/1: backend.generate requires input architecture-decision') && e.includes('no imported slot')));
  // The credit comes from the import gate over a real bundle on disk that the request references.
  const f = producerImportFixture();
  try {
    const tree = [fakePackage({ id: 'release.note', primary: 'release-note', outputs: ['release-note'], inputs: [['git-publication', '`git.publish`; the publication it annotates', true]] })];
    const g = operatorGraph(tree);
    const byBranch = { '1/1': { operatorId: 'release.note', sessionId: 'receiver', requirements: {}, inputs: { 'git-publication': 'step-10/parallel-1/response/response.md' } } };
    const gate = async () => validateChain(root, tree, [['1/1']], { '1/1': 'release.note' }, byBranch, { graph: g, imported: await readImportedInputs(root, f.targetSession, byBranch, { hostRoot: f.host }) });
    assert.ok((await gate()).some((e) => e.includes('requires input git-publication')), 'nothing imported yet');
    await importProducer(f.args);
    assert.deepEqual(await gate(), [], 'an accepted import feeds the branch');
    // The slot as the planner reads it: its cell, origin and the outputs the origin operator declares.
    assert.deepEqual(await readImportedSlots(f.targetSession, graph), [{ cell: '10/1', operatorId: 'git.publish', sourceSessionId: 'original', sourceStep: 1, sourceParallel: 1, outputs: { 'git-publication': 'step-10/parallel-1/response/response.md' } }]);
    assert.deepEqual((await readImportedSlots(f.targetSession, g))[0].outputs, {}, 'an origin operator the graph cannot name declares nothing');
    // A slot the gate refuses feeds nothing; a slot without import.json is not an import at all.
    write(path.join(f.target, 'response/artifacts/raw.log'), 'tampered');
    assert.ok((await gate()).some((e) => e.includes('requires input git-publication')), 'a refused import feeds nothing');
    unlinkSync(path.join(f.target, 'import.json'));
    assert.ok((await gate()).some((e) => e.includes('requires input git-publication')), 'a slot without import.json is not an import');
    assert.deepEqual(await readImportedSlots(f.targetSession, graph), []);
  } finally { f.cleanup(); }
});
test('a bind whose request is not written yet binds the role the plan fixed; a written request carries the planned values', () => {
  const steps = { '1/1': 'workspace.bind', '2/1': 'interface.generate' };
  const planned = { '1/1': { requirements: { role: 'fe' } } };
  assert.deepEqual(validateChain(null, packages, [['1/1'], ['2/1']], steps, { '1/1': null, '2/1': null }, { graph, planned }), []);
  assert.ok(validateChain(null, packages, [['1/1'], ['2/1']], steps, { '1/1': null, '2/1': null }, { graph }).some((e) => e.includes('2/1: interface.generate requires @workspaces/fe')));
  const drifted = validateChain(null, packages, [['1/1'], ['2/1']], steps, { '1/1': { operatorId: 'workspace.bind', requirements: { role: 'be' } }, '2/1': null }, { graph, planned });
  assert.ok(drifted.some((e) => e.includes('1/1: request.json: requirements.role is "be" and the plan fixed it as "fe"')));
  assert.ok(validateChain(null, packages, [['1/1']], { '1/1': 'workspace.bind' }, {}, { graph, planned: { '3/1': { requirements: {} } } }).some((e) => e.includes('planned records 3/1, which the chain does not name')));
  assert.deepEqual(plannedRequirementErrors({ requirements: { roles: ['be', 'fe'] } }, { requirements: { roles: ['be', 'fe'] } }), []);
  assert.equal(plannedRequirementErrors({ requirements: { roles: ['be', 'fe'] } }, { requirements: {} }).length, 1);
  assert.deepEqual(plannedRequirementErrors(undefined, { requirements: {} }), [], 'a branch the plan fixed nothing for is free');
});
test('at most the parallel cap per step, and no shared write alias inside a step', () => {
  const four = check([['workspace.bind', 'workspace.bind', 'workspace.bind', 'workspace.bind']]);
  assert.ok(four.some((e) => e.includes('4 branches; at most 3')));
  assert.ok(check([['workspace.bind', 'workspace.bind']], { maxParallel: 1 }).some((e) => e.includes('at most 1')));
  const shared = check([[['workspace.bind', { requirements: { role: 'fe' } }]], ['interface.generate', 'library.update']]);
  assert.ok(shared.some((e) => e.includes('both write @workspaces/fe/branch/session')));
});
test('the long-flow law: an applied surface that is published is audited and walked in between; mode dry owes nothing', () => {
  const noProof = check([['environment.preflight'], [['workspace.bind', { requirements: { role: 'fe' } }]], ['interface.generate'], ['quality.verify'], ['git.publish']]);
  assert.ok(noProof.some((e) => e.includes('no interface.audit anywhere')));
  assert.ok(noProof.some((e) => e.includes('no uat.verify anywhere')));
  const dry = check([['environment.preflight'], [['workspace.bind', { requirements: { role: 'fe' } }]], [['interface.generate', { requirements: { mode: 'dry' } }]], ['quality.verify'], ['git.publish']]);
  assert.ok(!dry.some((e) => e.includes('anywhere in the chain')));
  // The fix operator writes the surface too, so a published fix owes the same proofs.
  const fix = check([['environment.preflight'], [['workspace.bind', { requirements: { role: 'fe' } }]], ['interface.generate'], ['interface.fix'], ['quality.verify'], ['git.publish']]);
  assert.ok(fix.some((e) => e.includes('no interface.audit anywhere')));
});
test('a publish or a deploy ends the chain', () => {
  const after = check([...surface, ['release.deploy']]);
  assert.deepEqual(after, [], 'a deploy may follow a publish');
  const goesOn = check([['workspace.bind'], ['quality.verify'], ['release.deploy'], ['workspace.bind']]);
  assert.ok(goesOn.some((e) => e.includes('release.deploy runs at step 3 and the chain goes on')));
});
test('on a mission every branch names a goal that resolves: a done-when line this operator produces, or a later branch', () => {
  const mission = fakeMission([line('quality.verify')]);
  const served = [[['workspace.bind', { goal: { prerequisite: '2/1' } }]], [['quality.verify', { goal: { doneWhen: 0 } }]]];
  assert.deepEqual(check(served, { mission }), []);
  assert.ok(check([[['workspace.bind', {}]], [['quality.verify', { goal: { doneWhen: 0 } }]]], { mission }).some((e) => e.includes('1/1: request.json names no goal')));
  assert.ok(check([[['workspace.bind', { goal: { doneWhen: 0 } }]], [['quality.verify', { goal: { doneWhen: 0 } }]]], { mission }).some((e) => e.includes('produced by quality.verify, not by workspace.bind')));
  assert.ok(check([[['workspace.bind', { goal: { doneWhen: 4 } }]], [['quality.verify', { goal: { doneWhen: 0 } }]]], { mission }).some((e) => e.includes('doneWhen 4 is not a line')));
  assert.ok(check([[['workspace.bind', { goal: { prerequisite: '9/9' } }]], [['quality.verify', { goal: { doneWhen: 0 } }]]], { mission }).some((e) => e.includes('9/9, which the chain does not have')));
  assert.ok(check([[['workspace.bind', { goal: { prerequisite: '1/1' } }]], [['quality.verify', { goal: { doneWhen: 0 } }]]], { mission }).some((e) => e.includes('does not run after this branch')));
  // Without a mission, goals are not required; a branch whose request is not written yet is not judged.
  assert.deepEqual(check([['workspace.bind'], ['quality.verify']]), []);
  assert.deepEqual(validateChain(null, packages, [['1/1']], { '1/1': 'workspace.bind' }, { '1/1': null }, { graph, mission }), []);
});
test('when the chain holds a plan, it runs before the branches that execute its units; the unit itself is the request gate\'s', () => {
  const fe = ['workspace.bind', { requirements: { role: 'fe' } }];
  assert.deepEqual(check([[fe], ['interface.plan'], ['interface.generate']]), []);
  assert.deepEqual(check([[fe], ['interface.generate']]), [], 'a single unit needs no plan');
  const late = check([[fe], ['interface.generate'], ['interface.plan']]);
  assert.ok(late.some((e) => e.includes('2/1: interface.generate runs in step 2 and interface.plan, whose units it executes, runs in step 3')));
  const same = check([[fe], ['interface.generate', 'interface.plan']]);
  assert.ok(same.some((e) => e.includes('runs in step 2 and interface.plan')));
});
