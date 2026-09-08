import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages } from './operator-md.mjs';
import { operatorGraph, validateChain } from './validate-chain.mjs';
import { planChain } from './plan-chain.mjs';
import { effectiveOperator, requiredWhen, conditionalRequirementErrors } from './operator-conditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = await loadOperatorPackages(root), graph = operatorGraph(packages);
const modes = { access: 'anonymous', fixtures: 'none', sourceRoles: 'frontend' };
test('auth and fixture dependencies are independent; missing modes retain all prerequisites', () => {
  const op = graph.get('uat.verify');
  assert.deepEqual([...effectiveOperator(op).roles], ['be','fe']);
  const kinds = requirements => effectiveOperator(op, requirements).required.map(input => input.kind);
  for (const kind of ['uat-account', 'seed-receipt']) assert.ok(kinds({}).includes(kind));
  assert.ok(!kinds({ access: 'anonymous' }).includes('uat-account'));
  assert.ok(kinds({ access: 'anonymous' }).includes('seed-receipt'));
  assert.ok(kinds({ fixtures: 'none' }).includes('uat-account'));
  assert.ok(!kinds({ fixtures: 'none' }).includes('seed-receipt'));
  assert.deepEqual([...effectiveOperator(op, modes).roles], ['fe']);
  assert.ok(conditionalRequirementErrors(op.pkg.en, { access: 'anything' }).length);
  assert.throws(() => requiredWhen('when arbitrary text'), /invalid Required/);
});
test('a public frontend delivery still audits, runs browser UAT and reconciles source before publication', () => {
  const mission = { doneWhen: ['interface.generate', 'business.reconcile', 'git.publish'].map(producedBy => ({ evidence: producedBy, producedBy })) };
  const plan = planChain({ packages, mission, options: { graph, requirements: { 'uat.plan': modes, 'uat.verify': modes, 'business.reconcile': { sourceRole: 'fe' } } } });
  const operators = Object.values(plan.steps);
  for (const absent of ['backend.generate', 'identity.provision', 'data.plan', 'data.seed']) assert.ok(!operators.includes(absent), absent);
  for (const expected of ['uat.plan','interface.generate','interface.audit','quality.verify','uat.verify','business.reconcile','git.publish']) assert.ok(operators.includes(expected), expected);
  assert.ok(operators.indexOf('uat.verify') < operators.indexOf('git.publish'));
  assert.ok(operators.indexOf('business.reconcile') < operators.indexOf('git.publish'));
  const requests = Object.fromEntries(Object.entries(plan.steps).map(([cell, operatorId]) => [cell, { operatorId, requirements: plan.presets[cell] ?? {}, goal: plan.goals[cell] }]));
  assert.deepEqual(validateChain(null, packages, plan.chain, plan.steps, requests, { graph, mission }), []);
  const walkCell = Object.keys(plan.steps).find(cell => plan.steps[cell] === 'uat.verify');
  requests[walkCell].requirements = {};
  assert.ok(validateChain(null, packages, plan.chain, plan.steps, requests, { graph, mission }).some(error => /uat-account|seed-receipt|be/.test(error)), 'omitting modes cannot erase authenticated prerequisite gates');
});

test('nested required checkout aliases retain their role and enum spaces are normalized', () => {
  const node=structuredClone(graph.get('uat.verify'));
  node.pkg.en.tables.context.rows=[{alias:'@workspaces/fe/routes',required:'when sourceRoles=frontend'}];
  assert.deepEqual([...effectiveOperator(node,{sourceRoles:'frontend'}).roles],['fe']);
  assert.deepEqual([...effectiveOperator(node,{sourceRoles:'full'}).roles],[]);
  node.pkg.en.tables.requirements.rows=[{field:'sourceRoles',type:'enum:full, frontend',default:'full'}];
  assert.deepEqual(conditionalRequirementErrors(node.pkg.en,{sourceRoles:'frontend'}),[]);
});
