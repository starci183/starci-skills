import test from 'node:test';
import assert from 'node:assert/strict';
import { accessName, literalText, nameText, variableInitializerGroups } from '../../scripts/lib/ts-ast.mjs';
import { unwrapCatalogExpression, unwrapExpression } from '../../scripts/lib/ts-analysis.mjs';
import { ts as loadTypescript } from '../../scripts/hfs/runtime-rules/source-ast.mjs';

const ts = loadTypescript();

const expression = text => ts.createSourceFile('source.ts', text, ts.ScriptTarget.Latest, true).statements[0].expression;

test('AST name reads retain each caller\'s identifier, string and numeric policy', () => {
  const identifier = expression('key');
  const numeric = expression('42');
  for (const text of ['"key"', '`key`']) {
    assert.equal(nameText(ts, expression(text)), 'key');
    assert.equal(literalText(ts, expression(text)), 'key');
  }
  assert.equal(nameText(ts, identifier), 'key');
  assert.equal(literalText(ts, identifier), null);
  assert.equal(nameText(ts, identifier, { identifiers: false, numbers: true }), null);
  assert.equal(nameText(ts, numeric), null);
  assert.equal(nameText(ts, numeric, { numbers: true }), '42');
  assert.equal(nameText(ts, numeric, { identifiers: false, numbers: true }), '42');
  assert.equal(nameText(ts, undefined), null);
});

test('AST member reads recognize only property or string-literal selections', () => {
  for (const text of ['object.env', 'object["env"]', 'object[`env`]']) assert.equal(accessName(ts, expression(text)), 'env');
  for (const text of ['object[key]', 'object[42]', 'object', 'object()']) assert.equal(accessName(ts, expression(text)), null);
});

test('catalog wrappers preserve the narrower unused-symbol value contract', () => {
  for (const text of ['(value)', 'value as unknown', 'value satisfies unknown']) {
    assert.equal(unwrapCatalogExpression(ts, expression(text)).getText(), 'value');
  }
  for (const text of ['value!', '<unknown>value']) {
    const node = expression(text);
    assert.equal(unwrapCatalogExpression(ts, node), node);
    assert.equal(unwrapExpression(ts, node).getText(), 'value');
  }
  assert.equal(unwrapCatalogExpression(ts, undefined), undefined);
});

test('variable initializer groups preserve every scope while callers can select the last binding', () => {
  const source = ts.createSourceFile('source.ts', 'const route = First; { let route = Second; } var mutable = Third; let absent; const { ignored } = object;', ts.ScriptTarget.Latest, true);
  const groups = variableInitializerGroups(ts, source);
  assert.deepEqual([...groups].map(([name, nodes]) => [name, nodes.map(node => node.getText())]), [
    ['route', ['First', 'Second']], ['mutable', ['Third']],
  ]);
  assert.equal(groups.get('route').at(-1).getText(), 'Second');
  assert.equal(variableInitializerGroups(ts, expression('empty')).size, 0);
});
