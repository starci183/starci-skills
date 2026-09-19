import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNestPatterns, NEST_SCRIPT_RULES } from '../scripts/checks/code-patterns/nest.mjs';

const require = createRequire(import.meta.url);
function fixture(t, source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nest-pattern-'));
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, 'node_modules/typescript'), 'junction');
  fs.writeFileSync(path.join(root, 'package.json'), '{"private":true}');
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/source.ts'), source);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, files: ['src/source.ts'] };
}
const checked = (context, ruleIds) => checkNestPatterns({ ...context, ruleIds });

test('member docs cover decorated fields, methods, signatures and generic parameters', t => {
  const context = fixture(t, `class Store<T> {
  @Inject()
  value: T;
  run<U>(input: U): T { return this.value }
}
interface View { label: string; read(): string }
`);
  const result = checked(context, ['NEST_MEMBER_DOCUMENTATION']);
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 6);
  assert.ok(result.violations.every(item => item.ruleId === 'NEST_MEMBER_DOCUMENTATION' && item.path === 'src/source.ts'));
});

test('member docs accept real blocks after decorators and generic tags', t => {
  const context = fixture(t, `/** @template T Stored value. */
class Store<T> {
  @Inject()
  /** Stable value for this instance. */
  value: T;
  /** Reads a value. @template U Input contract. */
  run<U>(input: U): T { return this.value }
}
interface View {
  /** Visible text. */
  label: string;
  /** Reads visible text. */
  read(): string;
}
/** @typeParam T - Input contract. */
const identity = <T>(input: T) => input;
`);
  const result = checked(context, ['NEST_MEMBER_DOCUMENTATION']);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
});

test('comment form detects trailing/capitalized prose and lowercase body block', t => {
  const context = fixture(t, `const a = 1; // trailing explanation
// Uppercase explanation
function run() {
  /* lower case claim */
  return a;
}
`);
  const result = checked(context, ['NEST_COMMENT_FORM']);
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 3);
});

test('a docblock inside a decorator argument cannot document the decorated member', t => {
  const context = fixture(t, `class Store {
  @Inject(/** Names only this token. */ TOKEN)
  value: string;
}`);
  const result = checked(context, ['NEST_MEMBER_DOCUMENTATION']);
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 1);
});

test('comment scan distinguishes literal contents, compiler directives and locale annotations', t => {
  const context = fixture(t, `/// <reference lib="es2022" />
const value = "// Not a comment";
const regex = /https?:\\/\\//;
const template = \`// Not prose \${value}\`;
// explain the reason above its code
function run() {
  /* Keep this operation bounded. */
  return "hello"; // vn-ok: locale output explanation
}
`);
  const result = checked(context, ['NEST_COMMENT_FORM']);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.violations, []);
});

test('named import form checks lines, comma and aliased bindings without banning other forms', t => {
  const context = fixture(t, `import { A, B } from "bad";
import {
  C
} from "bad2";
import {
  A as Alias,
  type Type,
} from "good";
import Default from "default";
import * as Namespace from "namespace";
import "side-effect";
`);
  const result = checked(context, ['NEST_IMPORT_FORMAT']);
  assert.deepEqual(result.errors, []);
  assert.equal(result.violations.length, 2);
});

test('adapter does not certify malformed, missing, unsupported or duplicate input', t => {
  const context = fixture(t, 'class {');
  assert.ok(checked(context, NEST_SCRIPT_RULES).errors.length);
  assert.deepEqual(checked(context, NEST_SCRIPT_RULES).checkedRuleIds, []);
  assert.ok(checked(context, ['UNSUPPORTED']).errors.length);
  assert.ok(checked({ ...context, files: [] }, NEST_SCRIPT_RULES).errors.length);
  assert.ok(checked({ ...context, files: ['src/missing.ts'] }, NEST_SCRIPT_RULES).errors.length);
  assert.ok(checked({ ...context, files: ['../outside.ts'] }, NEST_SCRIPT_RULES).errors.length);
  assert.ok(checked({ ...context, files: ['src/source.ts', 'src/source.ts'] }, NEST_SCRIPT_RULES).errors.length);
});

test('adapter refuses redirected source parents and reports exact complete clean scope', t => {
  const context = fixture(t, 'const value = 1;');
  const result = checked(context, ['NEST_IMPORT_FORMAT']);
  assert.deepEqual(result.files, ['src/source.ts']);
  assert.deepEqual(result.checkedRuleIds, ['NEST_IMPORT_FORMAT']);
  assert.ok(result.compiler.version);
  fs.symlinkSync(path.join(context.root, 'src'), path.join(context.root, 'redirected'), 'junction');
  assert.ok(checked({ ...context, files: ['redirected/source.ts'] }, ['NEST_IMPORT_FORMAT']).errors.length);
});
