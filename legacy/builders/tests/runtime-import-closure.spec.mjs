import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRuntimeImportClosure } from '../runtime-compile/import-closure.mjs';

const files = entries => new Map(entries.map(([name, source]) => [name, Buffer.from(source)]));

test('build refuses an omitted imported or re-exported runtime module', () => {
  assert.throws(() => assertRuntimeImportClosure(files([
    ['checks/index.mjs', 'import { check } from "./owners.mjs"; export {check};'],
  ])), /missing static dependency.*owners\.mjs/);
  assert.throws(() => assertRuntimeImportClosure(files([
    ['checks/index.mjs', 'export { check } from "./owners.mjs";'],
  ])), /missing static dependency/);
});

test('static dependency parsing never evaluates modules or mistakes comments/literals for imports', () => {
  assert.doesNotThrow(() => assertRuntimeImportClosure(files([
    ['checks/index.mjs', `import './owner.mjs';
      import fs from 'node:fs';
      const description = 'import "./missing.mjs"';
      // export {bad} from './also-missing.mjs';
      throw Error('MUST NOT EXECUTE');`],
    ['checks/owner.mjs', 'export const identity = 1;'],
  ])));
});

test('build rejects invalid syntax and dependencies escaping the compiled payload', () => {
  assert.throws(() => assertRuntimeImportClosure(files([['index.mjs', 'class {']])) , /syntax\/dependency inspection failed/);
  assert.throws(() => assertRuntimeImportClosure(files([['index.mjs', 'import "../external.mjs";']])) , /missing static dependency/);
});

test('URL query and encoding resolve to the actual payload member', () => {
  assert.doesNotThrow(() => assertRuntimeImportClosure(files([
    ['index.mjs', 'import "./a%20file.mjs?version=1#marker";'],
    ['a file.mjs', 'export const value = 1;'],
  ])));
});
