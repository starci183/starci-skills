import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { checkNestTests, NEST_TEST_RULES } from '../checks/code-patterns/nest-tests.mjs';
const require = createRequire(import.meta.url);

function fixture(t, subject, spec, name = 'store.handler') {
  // A disposable miniature project. Never mutate a consuming project's dependencies.
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nest-test-form-'));
  const write = (file, content) => { const target = path.join(fixtureRoot, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content)); };
  write('package.json', { private: true });
  write('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['backend'], tsconfig: 'tsconfig.json' });
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
  return { root: fixtureRoot, write, input: { root: fixtureRoot, files: [`src/${name}.spec.ts`], contextFiles: [`src/${name}.ts`], ruleIds: NEST_TEST_RULES, architectureConfig: 'architecture.json' } };
}
const subject = 'export class StoreHandler { execute() { return this.process() } protected process() { return 1 } }';
const valid = `import { StoreHandler } from './store.handler';
describe('StoreHandler',
  () => {
    it('returns the stored value',
      () => { const handler = new StoreHandler(); expect(handler.execute()).toBe(1); });
  });`;

test('direct handler spec exercises its public entry without mandatory casts or a Nest container', t => {
  const f = fixture(t, subject, valid), result = checkNestTests(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  assert.deepEqual(result.checkedRuleIds, [...NEST_TEST_RULES].sort());
});

test('protected hook access is a violation even behind a test cast', t => {
  const f = fixture(t, subject, valid.replace('handler.execute()', '(handler as any).process()'));
  const result = checkNestTests(f.input);
  assert.ok(result.violations.some(item => item.message.includes('protected/private')));
  assert.ok(result.violations.some(item => item.message.includes('invokes its real public API')));
});

test('outer suite binds the exported subject and callbacks retain selected layout', t => {
  const f = fixture(t, subject, valid.replace("describe('StoreHandler',\n  ()", "describe('Anything', ()"));
  const result = checkNestTests(f.input);
  assert.ok(result.violations.some(item => item.ruleId === 'NEST_TEST_NAME_FORM' && item.message.includes('actual exported')));
  assert.ok(result.violations.some(item => item.message.includes('line after')));
  assert.ok(result.errors.some(item => item.ruleId === 'NEST_TEST_SUBJECT_FORM'));
});

test('aliased Jest imports and subject.name preserve identity; local same-spelling helpers do not', t => {
  const f = fixture(t, subject, valid.replace("import { StoreHandler }", "import { describe as suite, it as check } from '@jest/globals';\nimport { StoreHandler }").replace("describe('StoreHandler'", 'suite(StoreHandler.name').replace("it('returns", "check('returns"));
  assert.deepEqual(checkNestTests(f.input).violations, []);
  f.write('src/store.handler.spec.ts', "const describe = (name: string, body: () => void) => body();\n" + valid);
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('outer suite')));
});

test('function subjects and scenario nesting do not need class construction or duplicate files', t => {
  const f = fixture(t, 'export function sum(a: number, b: number) { return a + b }', `import { sum } from './sum';
describe('sum',
  () => {
    describe('positive values',
      () => { it.each([[1, 2]])('adds %i and %i',
        (a, b) => { expect(sum(a, b)).toBe(3); }); });
  });`, 'sum');
  const result = checkNestTests(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
});

test('opaque subject factories cannot count as proven real construction', t => {
  const f = fixture(t, subject, valid.replace('new StoreHandler()', '({ execute: () => 1 } as StoreHandler)'));
  const result = checkNestTests(f.input);
  assert.ok(result.errors.some(item => item.message.includes('real constructor')));
  assert.deepEqual(result.checkedRuleIds, []);
});

test('an unused real constructor does not authorize a fake receiver or an out-of-suite call', t => {
  const f = fixture(t, subject, valid.replace('const handler = new StoreHandler();', 'new StoreHandler(); const handler = { execute: () => 1 } as StoreHandler;'));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('real construction')));
  f.write('src/store.handler.spec.ts', valid.replace('expect(handler.execute()).toBe(1);', 'expect(1).toBe(1);') + '\nnew StoreHandler().execute();');
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('invokes its real public API')));
});

test('a suite fixture assigned to the real constructor preserves receiver identity', t => {
  const f = fixture(t, subject, valid.replace("    it('returns", "    let handler: StoreHandler;\n    beforeEach(() => { handler = new StoreHandler(); });\n    it('returns").replace('const handler = new StoreHandler(); ', ''));
  const result = checkNestTests(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  f.write('src/store.handler.spec.ts', valid.replace('const handler = new StoreHandler();', 'let handler = new StoreHandler(); handler = { execute: () => 1 } as StoreHandler;'));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('real construction')));
});

test('resolved real Nest compile/get is an alternative construction; cast-only modules are unavailable', t => {
  const spec = valid.replace("import { StoreHandler }", "import { Test, TestingModule } from '@nestjs/testing';\nimport { StoreHandler }")
    .replace('() => { const handler = new StoreHandler();', 'async () => { const moduleRef = await Test.createTestingModule({ providers: [StoreHandler] }).compile(); const handler = moduleRef.get(StoreHandler);');
  const f = fixture(t, subject, spec);
  const result = checkNestTests(f.input);
  assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
  f.write('src/store.handler.spec.ts', spec.replace('await Test.createTestingModule({ providers: [StoreHandler] }).compile()', '{} as TestingModule'));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('real construction')));
  f.write('src/store.handler.spec.ts', spec.replace('providers: [StoreHandler]', 'providers: [{ provide: StoreHandler, useValue: { execute: () => 1 } }]'));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('real construction')));
});

test('missing subject inputs and compiler coverage remain unavailable', t => {
  const f = fixture(t, subject, valid);
  assert.ok(checkNestTests({ ...f.input, contextFiles: [] }).errors.length);
  f.write('tsconfig.json', { compilerOptions: {}, include: ['src/store.handler.ts'] });
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('owning TypeScript')));
});

test('disabled suites/tests and cross-named suites do not credit the selected subject', t => {
  const f = fixture(t, subject, valid);
  for (const text of [valid.replace('describe(', 'describe.skip('), valid.replace('it(', 'it.skip(')]) {
    f.write('src/store.handler.spec.ts', text);
    assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('enabled suite/test')));
  }
  f.write('src/store.handler.ts', 'export class Alpha { execute() {} } export class Beta { execute() {} }');
  f.write('src/store.handler.spec.ts', `import { Alpha, Beta } from './store.handler';
describe('Alpha',
  () => { it('calls the entry',
    () => { new Beta().execute(); }); });
describe('Beta',
  () => { it('calls the entry',
    () => { new Alpha().execute(); }); });`);
  assert.equal(checkNestTests(f.input).violations.filter(item => item.message.includes('enabled suite/test')).length, 2);
});

test('language builtins, project-declared test APIs and non-action titles cannot satisfy the profile', t => {
  const f = fixture(t, 'export class StoreService { save() { return 1 } }', valid.replaceAll('StoreHandler', 'StoreService').replaceAll('store.handler', 'store.service').replace('handler.execute()', 'handler.toString()'), 'store.service');
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('language builtins')));
  f.write('src/store.service.spec.ts', valid.replaceAll('StoreHandler', 'StoreService').replaceAll('store.handler', 'store.service').replace('handler.execute()', 'handler.save()').replace('returns the stored value', 'the stored value'));
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('action')));
  f.write('tsconfig.json', { compilerOptions: { types: [] }, include: ['src/**/*.ts'] });
  f.write('src/custom.d.ts', 'declare function describe(name: string, callback: () => void): void; declare function it(name: string, callback: () => void): void;');
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('cannot be bound')));
});

test('suite registration calls do not replace a runnable test callback and subject import aliases preserve identity', t => {
  const f = fixture(t, subject, valid.replace("    it('returns", "    new StoreHandler().execute();\n    it('returns").replace('expect(handler.execute()).toBe(1);', 'expect(true).toBe(true);'));
  assert.ok(checkNestTests(f.input).violations.some(item => item.message.includes('enabled suite/test')));
  f.write('src/store.handler.spec.ts', valid.replaceAll('StoreHandler', 'Subject').replace('import { Subject }', 'import { StoreHandler as Subject }').replace("describe('Subject'", 'describe(Subject.name'));
  assert.deepEqual(checkNestTests(f.input).violations, []);
  f.write('src/store.handler.spec.ts', valid.replace("() => { const handler = new StoreHandler(); expect(handler.execute()).toBe(1); }", 'undefined'));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('runnable callback')));
});

test('uncalled functions cannot supply proof; transparent called helpers work and opaque helper arguments are unavailable', t => {
  const f = fixture(t, subject, valid.replace('expect(handler.execute()).toBe(1);', 'const never = () => handler.execute(); expect(true).toBe(true);'));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('helper indirection')));
  f.write('src/store.handler.spec.ts', valid.replace("    it('returns", "    let handler: StoreHandler; const never = () => { handler = new StoreHandler(); };\n    it('returns").replace('const handler = new StoreHandler(); ', ''));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('real construction')));
  f.write('src/store.handler.spec.ts', valid.replace('expect(handler.execute()).toBe(1);', 'const run = () => handler.execute(); expect(run()).toBe(1);'));
  assert.deepEqual(checkNestTests(f.input).errors, []);
  assert.deepEqual(checkNestTests(f.input).violations, []);
  f.write('src/store.handler.spec.ts', valid.replace('expect(handler.execute()).toBe(1);', 'const run = (value: StoreHandler) => value.execute(); expect(run(handler)).toBe(1);'));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('helper indirection')));
  f.write('src/store.handler.ts', subject.replace('export class', 'export default class'));
  f.write('src/store.handler.spec.ts', valid.replace("{ StoreHandler }", 'StoreHandler').replace("describe('StoreHandler'", "describe('default'"));
  assert.ok(checkNestTests(f.input).errors.some(item => item.message.includes('no named')));
});
