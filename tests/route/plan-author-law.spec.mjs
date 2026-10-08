// work.author writes implementation records that prove against the requirement, design and interface records
// (work/implementation@1 proves/dependsOn). The 2026-10-08 StarCi plan let it run after scope.define alone, so it was
// dispatched with no sds, contract or ui record to point at and blocked (op-work.author-c10c110700).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planGraphOf, planAncestorsOf, authorPrerequisitesOf } from '../../scripts/route/plan-edges.mjs';

const STORED = {
  legs: ['scope.define', 'business.decide', 'architecture.decide', 'brand.decide', 'interface.draw', 'work.author', 'backend.implement'].map((op) => ({ op })),
  edges: [['scope.define', 'business.decide'], ['scope.define', 'brand.decide'], ['scope.define', 'work.author'], ['business.decide', 'architecture.decide'],
    ['architecture.decide', 'interface.draw'], ['brand.decide', 'interface.draw'], ['interface.draw', 'backend.implement'], ['work.author', 'backend.implement']],
};

test('a stored plan whose work.author follows scope.define alone reads it behind the design legs', () => {
  const ancestors = planAncestorsOf({ derivedPlan: STORED }).get('work.author');
  for (const op of ['scope.define', 'business.decide', 'architecture.decide', 'interface.draw']) assert.ok(ancestors.includes(op), op);
  assert.ok(!ancestors.includes('backend.implement'));
});

test('the law adds no edge that closes a cycle and none for a leg the plan lacks', () => {
  assert.deepEqual(authorPrerequisitesOf(['work.author', 'business.decide'], []), ['business.decide']);
  assert.deepEqual(authorPrerequisitesOf(['work.author', 'interface.draw'], [['work.author', 'interface.draw']]), []);
  assert.deepEqual(authorPrerequisitesOf(['scope.define', 'business.decide'], []), []);
  assert.doesNotThrow(() => planGraphOf({ legs: STORED.legs, edges: STORED.edges }));
});
