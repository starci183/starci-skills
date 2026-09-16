import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNestBoundaries, NEST_BOUNDARY_RULES } from '../checks/code-patterns/nest-boundaries.mjs';

const require = createRequire(import.meta.url);
function fixture(t, files, contract = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nest-boundary-'));
  const write = (relative, value) => {
    const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const boundary = { schema: 'starci/nest-boundary-contract@1', envParsers: [], cacheOwners: [], jestLifecycleEntries: [], ...contract };
  write('package.json', { private: true, starci: { codePatterns: { nest: { boundaries: boundary } } } });
  write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['backend'], tsconfig: 'tsconfig.json' });
  write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', baseUrl: '.', paths: { '@modules/*': ['src/modules/*'] } }, include: ['src/**/*.ts'] });
  for (const [file, content] of Object.entries(files)) write(file, content);
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, 'node_modules/typescript'), 'junction');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, write, boundary, input: { root, architectureConfig: 'architecture.json', files: Object.keys(files).filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts')), ruleIds: NEST_BOUNDARY_RULES } };
}
const rule = (f, id) => checkNestBoundaries({ ...f.input, ruleIds: [id] });

test('environment access tracks process aliases, global access and destructuring', t => {
  const f = fixture(t, { 'src/source.ts': `
export const direct = process.env.MODE;
const proc = process; export const alias = proc['env'].MODE;
const { env: environment } = process; export const destructured = environment.MODE;
export const globalValue = globalThis['process'].env.MODE;
import { env as imported } from 'node:process'; export const importedValue = imported.MODE;
import procImport from 'process'; export const defaultImported = procImport.env.MODE;
` });
  const result = rule(f, 'NEST_ENV_ACCESS');
  assert.deepEqual(result.errors, []);
  for (const line of [2, 3, 4, 5, 6, 7]) assert.ok(result.violations.some(item => item.line === line), `line ${line}`);
});

test('parser ownership is exact and a local process-shaped parameter is not the Node process', t => {
  const f = fixture(t, {
    'src/modules/env/parse-env.ts': 'export const parseEnv = () => process.env.MODE;',
    'src/source.ts': 'export function read(process: { env: { MODE: string } }) { return process.env.MODE }',
  }, { envParsers: ['src/modules/env/parse-env.ts'] });
  const result = rule(f, 'NEST_ENV_ACCESS');
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  f.write('src/modules/env/other.ts', 'export const mode = process.env.MODE;');
  f.input.files.push('src/modules/env/other.ts');
  assert.ok(rule(f, 'NEST_ENV_ACCESS').violations.some(item => item.path.endsWith('other.ts')));
  f.write('src/modules/env/other.ts', 'export const available = typeof process !== "undefined";');
  assert.deepEqual(rule(f, 'NEST_ENV_ACCESS').errors, []);
});

test('computed process property cannot masquerade as clean environment coverage', t => {
  const f = fixture(t, { 'src/source.ts': 'export const name = "env"; export const value = process[name];' });
  const result = rule(f, 'NEST_ENV_ACCESS');
  assert.ok(result.errors.some(item => item.ruleId === 'NEST_ENV_ACCESS'));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('mutable or escaped process aliases cannot produce clean static coverage', t => {
  const f = fixture(t, { 'src/source.ts': 'let selected = {}; selected = process; export const result = selected; consume(process);' });
  const result = rule(f, 'NEST_ENV_ACCESS');
  assert.ok(result.errors.some(item => item.message.includes('Assigning')));
  assert.ok(result.errors.some(item => item.message.includes('Passing')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('literal CommonJS, dynamic import and builtin process acquisition keep the same boundary', t => {
  const f = fixture(t, { 'src/source.ts': `
const first = require('node:process'); export const one = first.env.MODE;
const second = await import('node:process'); export const two = second.env.MODE;
const third = process.getBuiltinModule('process'); export const three = third.env.MODE;
` });
  const result = rule(f, 'NEST_ENV_ACCESS');
  assert.deepEqual(result.errors, []);
  for (const line of [2, 3, 4]) assert.ok(result.violations.some(item => item.line === line), `line ${line}`);
});

test('object, array, field and function return escapes cannot hide the process object', t => {
  const f = fixture(t, { 'src/source.ts': `
const holder = { process }; export const one = holder.process.env.MODE;
const array = [process]; export const two = array[0].env.MODE;
class Holder { process = process; } export const three = new Holder().process.env.MODE;
const get = () => process; export const four = get().env.MODE;
` });
  const result = rule(f, 'NEST_ENV_ACCESS');
  for (const line of [2, 3, 4, 5]) assert.ok(result.errors.some(item => item.line === line), `line ${line}`);
  assert.deepEqual(result.checkedRuleIds, []);
});

test('raw cache token follows renamed imports, namespace properties and public re-exports', t => {
  const f = fixture(t, {
    'src/modules/cache/tokens.ts': 'export const CACHE_MANAGER = Symbol("cache");',
    'src/modules/cache/index.ts': 'import { CACHE_MANAGER } from "./tokens"; export const Manager = CACHE_MANAGER;',
    'src/modules/cache/owner.ts': 'import { CACHE_MANAGER } from "./tokens"; export const local = CACHE_MANAGER;',
    'src/features/use.ts': 'import { Manager as value } from "@modules/cache"; import * as Cache from "@modules/cache"; export const token = value; export const other = Cache.Manager;',
  }, { cacheOwners: [{ root: 'src/modules/cache', tokens: [{ path: 'src/modules/cache/tokens.ts', export: 'CACHE_MANAGER' }] }] });
  const result = rule(f, 'NEST_CACHE_TOKEN_BOUNDARY');
  assert.deepEqual(result.errors, []);
  assert.ok(result.violations.length >= 2);
  assert.ok(result.violations.every(item => item.path === 'src/features/use.ts'));
});

test('an unresolved imported cache token does not count as a checked harmless name', t => {
  const f = fixture(t, { 'src/source.ts': 'import { CACHE_MANAGER as missing } from "uninstalled-cache"; export const token = missing;' });
  const result = rule(f, 'NEST_CACHE_TOKEN_BOUNDARY');
  assert.ok(result.errors.some(item => item.message.includes('cannot be resolved')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('namespace bracket access cannot hide a raw cache export', t => {
  const f = fixture(t, {
    'src/modules/cache/tokens.ts': 'export const CACHE_MANAGER = Symbol("cache");',
    'src/features/use.ts': 'import * as Cache from "@modules/cache/tokens"; export const token = Cache["CACHE_MANAGER"];',
  }, { cacheOwners: [{ root: 'src/modules/cache', tokens: [{ path: 'src/modules/cache/tokens.ts', export: 'CACHE_MANAGER' }] }] });
  const result = rule(f, 'NEST_CACHE_TOKEN_BOUNDARY');
  assert.deepEqual(result.errors, []);
  assert.ok(result.violations.some(item => item.path === 'src/features/use.ts'));
  f.write('src/features/use.ts', 'import * as Cache from "@modules/cache/tokens"; const key = "CACHE_MANAGER"; export const token = Cache[key];');
  assert.ok(rule(f, 'NEST_CACHE_TOKEN_BOUNDARY').errors.some(item => item.message.includes('Computed')));
  f.write('src/features/use.ts', 'import * as Cache from "@modules/cache/tokens"; const { CACHE_MANAGER: hidden } = Cache; export const token = hidden;');
  assert.ok(rule(f, 'NEST_CACHE_TOKEN_BOUNDARY').violations.some(item => item.path === 'src/features/use.ts'));
  f.write('src/features/use.ts', 'import * as Cache from "@modules/cache/tokens"; const conceal = (x: unknown) => x; export const token = conceal(Cache);');
  assert.ok(rule(f, 'NEST_CACHE_TOKEN_BOUNDARY').errors.some(item => item.message.includes('exposing raw cache')));
});

test('owner bracket aliases and raw-token getter exports cannot launder cache identity', t => {
  const f = fixture(t, {
    'src/modules/cache/tokens.ts': 'export const CACHE_MANAGER = Symbol("cache");',
    'src/modules/cache/index.ts': 'import * as Cache from "./tokens"; export const Manager = Cache["CACHE_MANAGER"]; export const getManager = () => Cache.CACHE_MANAGER;',
    'src/features/use.ts': 'import { Manager, getManager } from "@modules/cache"; export const token = Manager; export const getterToken = getManager();',
  }, { cacheOwners: [{ root: 'src/modules/cache', tokens: [{ path: 'src/modules/cache/tokens.ts', export: 'CACHE_MANAGER' }] }] });
  const result = rule(f, 'NEST_CACHE_TOKEN_BOUNDARY');
  assert.ok(result.violations.some(item => item.path === 'src/features/use.ts'));
  assert.ok(result.errors.some(item => item.path === 'src/modules/cache/index.ts' && item.message.includes('Returning a raw cache token')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('unowned raw token cannot pass, unrelated object property with the same spelling can', t => {
  const f = fixture(t, { 'src/source.ts': 'const shape = { CACHE_MANAGER: 1 }; const key = "CACHE_MANAGER"; export const ordinary = shape.CACHE_MANAGER + shape[key]; export const CACHE_MANAGER = Symbol("raw");' });
  const result = rule(f, 'NEST_CACHE_TOKEN_BOUNDARY');
  assert.deepEqual(result.errors, []); assert.equal(result.violations.length, 1);
});

test('named-export rule sees declarations and re-exported default bindings', t => {
  const f = fixture(t, {
    'src/value.ts': 'export const value = 1;',
    'src/first.ts': 'export default class Value {}',
    'src/second.ts': 'export { value as default } from "./value";',
    'src/third.ts': 'const value = 1; export = value;',
    'src/fourth.ts': 'export * as default from "./value";',
    'src/fifth.ts': 'module.exports = 1; exports.default = 2; module.exports.default = 3;',
  });
  const result = rule(f, 'NEST_NAMED_EXPORTS');
  assert.deepEqual(result.errors, []); assert.equal(result.violations.length, 7);
  f.write('src/fifth.ts', 'const key = "default"; exports[key] = 1;');
  assert.ok(rule(f, 'NEST_NAMED_EXPORTS').errors.some(item => item.message.includes('Computed CommonJS')));
  f.write('src/fifth.ts', 'const alias = module.exports; alias.default = 1;');
  assert.ok(rule(f, 'NEST_NAMED_EXPORTS').errors.some(item => item.message.includes('Aliasing')));
  f.write('src/fifth.ts', 'Object.defineProperty(exports, "default", { value: 1 }); Reflect.set(module.exports, "default", 1); Object.assign(exports, { default: 1 });');
  assert.ok(rule(f, 'NEST_NAMED_EXPORTS').errors.length >= 3);
});

test('invalid boundaries, stale owners, links and missing project coverage stay unavailable', t => {
  const f = fixture(t, { 'src/source.ts': 'export const value = 1;' });
  f.write('package.json', { private: true });
  assert.ok(rule(f, 'NEST_ENV_ACCESS').errors.length);
  f.write('package.json', { private: true, starci: { codePatterns: { nest: { boundaries: { ...f.boundary, envParsers: ['../escape.ts'] } } } } });
  assert.ok(rule(f, 'NEST_ENV_ACCESS').errors.length);
  f.write('package.json', { private: true, starci: { codePatterns: { nest: { boundaries: f.boundary } } } });
  f.write('outside.ts', 'export const value = 1;'); f.input.files.push('outside.ts');
  assert.ok(rule(f, 'NEST_ENV_ACCESS').errors.some(item => item.message.includes('outside the checked')));
});

test('separate monorepo programs do not require an unrelated cache owner in every app', t => {
  const f = fixture(t, {
    'apps/first/src/modules/cache/tokens.ts': 'export const CACHE_MANAGER = Symbol("cache");',
    'apps/second/src/source.ts': 'export const other = 1;',
  }, { cacheOwners: [{ root: 'apps/first/src/modules/cache', tokens: [{ path: 'apps/first/src/modules/cache/tokens.ts', export: 'CACHE_MANAGER' }] }] });
  f.write('tsconfig.json', { files: [], references: [{ path: './apps/first' }, { path: './apps/second' }] });
  for (const app of ['first', 'second']) f.write(`apps/${app}/tsconfig.json`, { compilerOptions: { target: 'ES2022', module: 'ESNext', noEmit: true }, include: ['src/**/*.ts'] });
  const result = rule(f, 'NEST_CACHE_TOKEN_BOUNDARY');
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  assert.deepEqual(result.files, [...f.input.files].sort());
});

test('all production TypeScript extensions receive boundary checks', t => {
  const f = fixture(t, { 'src/source.ts': 'export const value = 1;' });
  for (const extension of ['mts', 'cts', 'tsx']) {
    const file = `src/source-${extension}.${extension}`;
    f.write(file, 'export const value = process.env.MODE;'); f.input.files.push(file);
  }
  f.write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', jsx: 'preserve' }, include: ['src/**/*'] });
  const result = rule(f, 'NEST_ENV_ACCESS');
  assert.deepEqual(result.errors, []);
  for (const extension of ['mts', 'cts', 'tsx']) assert.ok(result.violations.some(item => item.path === `src/source-${extension}.${extension}`));
  f.write('src/types.d.mts', 'export declare const value: string;'); f.input.files.push('src/types.d.mts');
  assert.ok(rule(f, 'NEST_ENV_ACCESS').errors.some(item => item.message.includes('non-declaration')));
});

test('overlapping projects cannot select one convenient alias interpretation', t => {
  const f = fixture(t, { 'src/source.ts': 'export const value = 1;' });
  f.write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['backend'], projects: ['tsconfig.json', 'tsconfig.other.json'] });
  f.write('tsconfig.other.json', { compilerOptions: { target: 'ES2022', module: 'CommonJS' }, include: ['src/**/*.ts'] });
  const result = rule(f, 'NEST_ENV_ACCESS');
  assert.ok(result.errors.some(item => item.message.includes('conflicting TypeScript')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('default-export exception requires actual Jest identity and never runs setup', t => {
  const f = fixture(t, {
    'src/tests/setup.ts': 'throw Error("Must not execute"); export default function setup() {}',
    'src/source.ts': 'export const value = 1;',
  }, { jestLifecycleEntries: ['src/tests/setup.ts'] });
  f.write('jest.config.cjs', 'module.exports = {};');
  f.write('node_modules/jest/package.json', { name: 'jest', version: '30.0.0-fixture', bin: { jest: 'bin/jest.js' } });
  f.write('node_modules/jest/bin/jest.js', `const path=require('node:path');process.stdout.write(JSON.stringify({configs:[{rootDir:process.cwd(),globalSetup:path.join(process.cwd(),'src/tests/setup.ts'),moduleNameMapper:[['^@modules/(.*)$',path.join(process.cwd(),'src/modules/$1')]]}]}));`);
  const result = rule(f, 'NEST_NAMED_EXPORTS');
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  f.write('node_modules/jest/bin/jest.js', `process.stdout.write(JSON.stringify({configs:[{rootDir:process.cwd(),moduleNameMapper:[]}]}));`);
  assert.ok(rule(f, 'NEST_NAMED_EXPORTS').errors.some(item => item.message.includes('not a resolved Jest')));
});
