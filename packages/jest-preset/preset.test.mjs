import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const preset = require('./index.cjs');
const { createMock } = require('./mock.cjs');

// A stand-in for jest.fn(): a callable that records calls. mock<T>() must work with any factory.
function fakeFn() {
  const fn = (...args) => { fn.calls.push(args); return fn.impl?.(...args); };
  fn.calls = [];
  fn.mockReturnValue = (value) => { fn.impl = () => value; return fn; };
  return fn;
}
const mock = createMock(fakeFn);

test('mock<T>() yields one stable function per property, created on first read', () => {
  const repo = mock();
  assert.equal(typeof repo.find, 'function');
  assert.equal(repo.find, repo.find);
  assert.notEqual(repo.find, repo.save);
  repo.find.mockReturnValue(42);
  assert.equal(repo.find('a'), 42);
  assert.deepEqual(repo.find.calls, [['a']]);
});

test('mock<T>(overrides) lets a provided value win over a generated function', () => {
  const clock = mock({ now: () => 7, name: 'utc' });
  assert.equal(clock.now(), 7);
  assert.equal(clock.name, 'utc');
  assert.equal(typeof clock.other, 'function');
});

test('mock<T>() is not thenable, so awaiting or returning it from an async function does not hang', async () => {
  const service = mock();
  assert.equal(service.then, undefined);
  assert.equal(await Promise.resolve(service), service);
  const wrapped = await (async () => service)();
  assert.equal(wrapped, service);
});

test('mock<T>() survives string conversion, JSON, symbols and the `in` operator', () => {
  const service = mock({ id: 1 });
  assert.equal(String(service), '[object Object]');
  assert.equal(JSON.stringify(service), '{"id":1}');
  assert.equal(service[Symbol.toPrimitive], undefined);
  assert.equal('id' in service, true);
  assert.equal('missing' in service, false);
  service.missing;
  assert.equal('missing' in service, true);
});

test('assigning a property replaces the generated function', () => {
  const service = mock();
  const first = service.run;
  service.run = () => 'real';
  assert.equal(service.run(), 'real');
  assert.notEqual(service.run, first);
});

test('the default mock needs the jest runtime and says so outside it', () => {
  assert.throws(() => preset.mock().anything, /needs the jest runtime/);
});

test('starciJestConfig is unit + integration + e2e + contract, ts-jest, diagnostics false (K20), isolatedModules from the tsconfig', () => {
  const config = preset.starciJestConfig();
  assert.deepEqual(config.projects.map((p) => p.displayName), ['unit', 'integration', 'e2e', 'contract']);
  for (const project of config.projects) {
    const [name, options] = project.transform[String.raw`^.+\.ts$`];
    assert.equal(name, 'ts-jest');
    assert.equal(options.diagnostics, false);
    assert.equal('isolatedModules' in options, false, 'the deprecated ts-jest option is not set; @starci/tsconfig carries it');
  }
  assert.equal(new RegExp(String.raw`^.+\.ts$`).test('a.ts'), true);
  assert.equal(new RegExp(String.raw`^.+\.ts$`).test('a.tsx'), false);
});

test('starciJestConfig takes no option: the managed jest.config.js has nothing to tune, and every call is a fresh, equal value', () => {
  assert.equal(preset.starciJestConfig.length, 0);
  const tuned = preset.starciJestConfig({ moduleNameMapper: { '^@x/(.*)$': '<rootDir>/x/$1' }, e2e: { globalSetup: 'x' }, unit: { setupFiles: ['x'] } });
  assert.deepEqual(tuned, preset.starciJestConfig(), 'an argument changes nothing');
  assert.notEqual(preset.starciJestConfig().projects[0].moduleNameMapper, preset.starciJestConfig().projects[0].moduleNameMapper);
});

test('every project maps exactly the three aliases the managed tsconfig.json declares', () => {
  const expected = { '^@features/(.*)$': '<rootDir>/src/features/$1', '^@modules/(.*)$': '<rootDir>/src/modules/$1', '^@tests/(.*)$': '<rootDir>/src/tests/$1' };
  assert.deepEqual(preset.MODULE_NAME_MAPPER, expected);
  for (const project of preset.starciJestConfig().projects) assert.deepEqual(project.moduleNameMapper, expected);
});

test('coverage is measured by v8, not istanbul', () => {
  assert.equal(preset.starciJestConfig().coverageProvider, 'v8');
});

test('the unit project matches *.spec.ts only and never a file of src/tests/{world,integration,e2e,contract}', () => {
  const [unit] = preset.starciJestConfig().projects;
  assert.deepEqual(unit.testMatch, ['**/*.spec.ts']);
  const ignored = (file) => unit.testPathIgnorePatterns.some((pattern) => new RegExp(pattern).test(file));
  for (const folder of ['world', 'integration', 'e2e', 'contract']) {
    assert.equal(ignored(`/r/src/tests/${folder}/a/x.spec.ts`), true, folder);
    assert.equal(ignored(`C:\\r\\src\\tests\\${folder}\\a\\x.spec.ts`), true, folder);
  }
  assert.equal(ignored('/r/src/features/x/y.spec.ts'), false);
  assert.equal(ignored('/r/src/tests/fixtures/database.spec.ts'), false);
});

test('each test kind is its own project, matched by folder and suffix together; contract is never unit or e2e', () => {
  const byName = Object.fromEntries(preset.starciJestConfig().projects.map((p) => [p.displayName, p]));
  assert.deepEqual(byName.integration.testMatch, ['<rootDir>/src/tests/integration/**/*.integration-spec.ts']);
  assert.deepEqual(byName.e2e.testMatch, ['<rootDir>/src/tests/e2e/**/*.e2e-spec.ts']);
  assert.deepEqual(byName.contract.testMatch, ['<rootDir>/src/tests/contract/**/*.contract-spec.ts']);
  for (const name of ['integration', 'e2e', 'contract']) {
    assert.equal(byName[name].maxWorkers, 1, name);
    assert.equal(byName[name].transform[String.raw`^.+\.ts$`][1].tsconfig, 'src/tests/tsconfig.json', name);
    assert.equal(byName[name].globalSetup, '<rootDir>/src/tests/world/global-setup.ts', name);
    assert.equal(byName[name].globalTeardown, '<rootDir>/src/tests/world/global-teardown.ts', name);
    assert.equal('setupFilesAfterEnv' in byName[name], false, name);
  }
  assert.equal(byName.unit.transform[String.raw`^.+\.ts$`][1].tsconfig, 'tsconfig.json');
  assert.equal('globalSetup' in byName.unit, false, 'unit specs need no world');
  assert.deepEqual(preset.TEST_KIND_FOLDERS, ['world', 'integration', 'e2e', 'contract']);
});

test('coverage denominators: same production set Sonar counts (sources src+apps, no tests, no entrypoints)', () => {
  const globs = preset.collectCoverageFrom();
  assert.deepEqual(globs.filter((g) => !g.startsWith('!')), ['src/**/*.ts', 'apps/**/*.ts']);
  for (const excluded of ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.d.ts', '**/main.ts', 'src/tests/**', '**/dist/**', '**/coverage/**']) {
    assert.ok(globs.includes(`!${excluded}`), `${excluded} is outside the denominator`);
  }
});

test('the Sonar exclusion strings render from the same lists as the jest globs', () => {
  const sonar = [...preset.sonarExclusions().split(','), ...preset.sonarCoverageExclusions().split(',')];
  const jest = preset.collectCoverageFrom().filter((g) => g.startsWith('!')).map((g) => g.slice(1));
  assert.deepEqual([...sonar].sort(), [...jest].sort());
  assert.match(preset.sonarCoverageExclusions(), /src\/tests\/\*\*/);
});

test('coverage reports lcov at coverage/lcov.info, the one file Codecov and Sonar read', () => {
  const config = preset.starciJestConfig();
  assert.equal(config.coverageDirectory, 'coverage');
  assert.ok(config.coverageReporters.includes('lcov'));
});

test('the mock<T>() types replace `as unknown as`: typed jest.Mock members, assignable to T, wrong stubs rejected', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const ts = require('typescript');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-mock-types-'));
  try {
    fs.copyFileSync(path.join(import.meta.dirname, 'mock.d.ts'), path.join(dir, 'mock.d.ts'));
    fs.writeFileSync(path.join(dir, 'probe.ts'), [
      'import { mock } from "./mock"',
      'interface Repo { find(id: string): Promise<{ id: string } | null>; readonly name: string }',
      'const repo = mock<Repo>()',
      'repo.find.mockResolvedValue({ id: "a" })',
      'const asRepo: Repo = repo',
      'const named = mock<Repo>({ name: "x" })',
      'export const ok: string = named.name + String(asRepo)',
      '// @ts-expect-error a stub of the wrong shape is a compile error',
      'repo.find.mockResolvedValue(1)',
      '// @ts-expect-error a member the interface does not have is a compile error',
      'repo.missing',
      '',
    ].join('\n'));
    const program = ts.createProgram([path.join(dir, 'probe.ts')], {
      strict: true, noEmit: true, skipLibCheck: true, types: ['jest'], typeRoots: [path.resolve(import.meta.dirname, '../../node_modules/@types')],
      module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022,
    });
    const problems = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    assert.deepEqual(problems, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const { FakeClock } = require('./clock.cjs');

test('FakeClock starts at a chosen instant and holds still until moved', () => {
  const clock = new FakeClock('2026-01-01T00:00:00.000Z');
  assert.equal(clock.now().toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(clock.now().toISOString(), '2026-01-01T00:00:00.000Z');
});

test('FakeClock.advance moves the clock by a duration, forward or back', () => {
  const clock = new FakeClock('2026-01-01T00:00:00.000Z');
  clock.advance(1000);
  assert.equal(clock.now().toISOString(), '2026-01-01T00:00:01.000Z');
  clock.advance(-500);
  assert.equal(clock.now().toISOString(), '2026-01-01T00:00:00.500Z');
});

test('FakeClock.set moves the clock to a new instant', () => {
  const clock = new FakeClock('2026-01-01T00:00:00.000Z');
  clock.set('2030-06-15T12:00:00.000Z');
  assert.equal(clock.now().toISOString(), '2030-06-15T12:00:00.000Z');
});

test('FakeClock with no argument starts at the real now, once, at construction', () => {
  const before = Date.now();
  const clock = new FakeClock();
  const after = Date.now();
  const started = clock.now().getTime();
  assert.ok(started >= before && started <= after);
});
