import test from 'node:test';
import assert from 'node:assert/strict';
import { astNodes, expressionReach, sourceIndex } from '../../scripts/checks/lib/coverage-ast.mjs';
import { resultReach } from '../../scripts/checks/lib/coverage-results.mjs';

test('assertion result tracing retains every node of a large invoked enforcer closure', () => {
  const spec = 'tests/checks/large.spec.mjs';
  const enforcer = 'scripts/checks/large.mjs';
  const context = { files: new Map([
    [spec, "import { large } from '../../scripts/checks/large.mjs';\nconst result = large();"],
    [enforcer, `export function large() { ${'inspect(0);'.repeat(40000)} return 'last-finding'; }`],
  ]) };
  const index = sourceIndex(context, spec);
  const call = index.bindings.get('result');
  const reached = resultReach(context, index, call).get(enforcer);
  assert.ok(reached.length > 130000, 'the closure exceeds the JavaScript argument-list limit');
  assert.equal(reached.filter((node) => node.type === 'CallExpression').length, 40000);
  assert.ok(reached.some((node) => node.value === 'last-finding'));
  assert.equal(resultReach(context, index, call, { helpersOnly: true }).has(enforcer), false);
});

test('coverage worklists traverse wide authored trees without argument-list expansion', () => {
  const file = 'scripts/checks/wide.mjs';
  const context = { files: new Map([[file, ';'.repeat(140000)]]) };
  const index = sourceIndex(context, file);
  assert.equal(astNodes(index.tree).length, 140001);
  assert.equal(expressionReach(context, index, index.tree).get(file).length, 140001);
  assert.equal(resultReach(context, index, index.tree).get(file).length, 140001);
});
