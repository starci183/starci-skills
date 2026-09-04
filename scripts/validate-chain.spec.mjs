// The chain gate: scripts/validate-chain.mjs on the synthetic tree of chain-fixture.mjs.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateChain, operatorGraph, writesSurface, planOf, primaryProducerOf, producersOf } from './validate-chain.mjs';
import { fakeTree, fakeMission, line } from './chain-fixture.mjs';

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
