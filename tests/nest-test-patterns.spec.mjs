import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNestTests, NEST_TEST_RULES } from '../scripts/checks/code-patterns/nest-tests.mjs';
const require = createRequire(import.meta.url);

function fixture(t, subject, spec, name = 'store.service') {
  // A disposable miniature project. Never mutate a consuming project's dependencies.
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nest-test-form-'));
  const write = (file, content) => { const target = path.join(fixtureRoot, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content)); };
  write('package.json', { private: true });
  write('hfs.json', { hfs: 1, profile: 'be', project: 'fixture', apps: [{ name: 'core', kind: 'api' }] });
  write('tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler' }, include: ['src/**/*.ts'] });
  write(`src/${name}.ts`, subject); write(`src/${name}.spec.ts`, spec);
  // Resolve against real, lockfile-pinned compiler and Jest declarations, not handwritten API stubs.
  for (const packageName of ['typescript', '@jest/globals', '@types/jest', '@nestjs/testing']) {
    const link = path.join(fixtureRoot, 'node_modules', packageName);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(path.dirname(require.resolve(`${packageName}/package.json`)), link, 'junction');
  }
  t.after(() => {
    const cleanup = path.resolve(fixtureRoot);
    assert.equal(path.dirname(cleanup), path.resolve(os.tmpdir()));
    assert.ok(path.basename(cleanup).startsWith('starci-nest-test-form-'));
    // rm removes the junction entries; it does not traverse their external package targets.
    fs.rmSync(cleanup, { recursive: true, force: true });
  });
  return { root: fixtureRoot, write, input: { root: fixtureRoot, files: [`src/${name}.spec.ts`], ruleIds: NEST_TEST_RULES } };
}
const subject = 'export class StoreService { read() { return 1 } }';
const valid = `import { Test } from '@nestjs/testing';
import { StoreService } from './store.service';
describe('StoreService',
  () => {
    it('returns the stored value',
      async () => { const moduleRef = await Test.createTestingModule({ providers: [StoreService] }).compile(); expect(moduleRef.get(StoreService).read()).toBe(1); });
  });`;

test('a service spec with action-verb titles is clean and only NEST_TEST_NAME_FORM exists', t => {
  const f = fixture(t, subject, valid), result = checkNestTests(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  assert.deepEqual([...NEST_TEST_RULES], ['NEST_TEST_NAME_FORM']);
  assert.deepEqual(result.checkedRuleIds, ['NEST_TEST_NAME_FORM']);
});

test('only *.service.spec.ts files are accepted', t => {
  const f = fixture(t, 'export class StoreHandler {}', valid, 'store.handler');
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('*.service.spec.ts')));
});

test('the checker no longer judges how the subject is built', t => {
  const direct = valid.split('\n').map(line => line.includes('createTestingModule') ? "      () => { expect(new StoreService().read()).toBe(1); });" : line).join('\n');
  const f = fixture(t, subject, direct);
  const result = checkNestTests(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('a non-action title, an empty title and a same-line callback are violations', t => {
  const f = fixture(t, subject, valid.replace('returns the stored value', 'the stored value'));
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('action')));
  f.write('src/store.service.spec.ts', valid.replace('returns the stored value', ' '));
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('static behavior title')));
  f.write('src/store.service.spec.ts', valid.replace("describe('StoreService',\n  ()", "describe('StoreService', ()"));
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('line after')));
});

test('a spec without an outer describe and a disabled callback-less test are reported', t => {
  const f = fixture(t, subject, valid.replace('describe(', 'suite('));
  assert.ok(checkNestTests(f.input).errors.length || checkNestTests(f.input).violations.length);
  const noCallback = valid.split('\n').map(line => line.includes('createTestingModule') ? "      undefined);" : line).join('\n').replace("it('returns the stored value',", "it('returns the stored value',");
  f.write('src/store.service.spec.ts', noCallback);
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('runnable callback')));
});

test('aliased Jest imports keep identity; a local helper named describe is not a suite', t => {
  const aliased = valid.replace("import { Test }", "import { describe as suite, it as check } from '@jest/globals';\nimport { Test }").replace("describe('StoreService'", "suite('StoreService'").replace("it('returns", "check('returns");
  const f = fixture(t, subject, aliased);
  assert.deepEqual(checkNestTests(f.input).violations, []);
  f.write('src/store.service.spec.ts', "const describe = (name: string, body: () => void) => body();\n" + valid);
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('outer describe')));
});

test('it.each placeholders and nested scenario suites are allowed', t => {
  const f = fixture(t, 'export function sum(a: number, b: number) { return a + b }', `import { sum } from './sum';
describe('sum',
  () => {
    describe('positive values',
      () => { it.each([[1, 2]])('adds %i and %i',
        (a, b) => { expect(sum(a, b)).toBe(3); }); });
  });`, 'sum.service');
  const result = checkNestTests(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});
