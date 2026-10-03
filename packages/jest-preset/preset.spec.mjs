import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const preset = require('./index.cjs');
// The @types folder that holds the jest types this package's own install resolves (a devDependency), never a path above it.
const jestTypeRoot = () => path.dirname(path.dirname(require.resolve('@types/jest/package.json')));

// The config is read from a repository root (jest runs there): the default one below has a test world, so all four
// projects exist; `withoutWorld` is a repository whose world is not written yet.
// The coverage scope the managed jest.config.js passes (starci app sync renders it from the slot manifest): roots, the logic roles measured in them, the none directories inside a root.
const SCOPE = { roots: ['src/modules/domain/*/', 'src/modules/platform/*/'], roles: ['service', 'guard'], excludes: ['src/modules/domain/*/persistence/**'] };
const OPTIONS = { coverage: SCOPE };
const withWorld = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-world-'));
fs.mkdirSync(path.join(withWorld, 'src', 'tests', 'world'), { recursive: true });
fs.writeFileSync(path.join(withWorld, 'src', 'tests', 'world', 'global-setup.ts'), 'export default async () => {}\n');
const withoutWorld = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-noworld-'));
const home = process.cwd();
process.chdir(withWorld);
test.after(() => { process.chdir(home); fs.rmSync(withWorld, { recursive: true, force: true }); fs.rmSync(withoutWorld, { recursive: true, force: true }); });

test('a repository without its test world gets the unit project only, so unit specs run with the managed config', () => {
  process.chdir(withoutWorld);
  try {
    assert.deepEqual(preset.starciJestConfig(OPTIONS).projects.map((p) => p.displayName), ['unit']);
  } finally {
    process.chdir(withWorld);
  }
  assert.deepEqual(preset.starciJestConfig(OPTIONS).projects.map((p) => p.displayName), ['unit', 'integration', 'e2e', 'contract']);
});
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
  const config = preset.starciJestConfig(OPTIONS);
  assert.deepEqual(config.projects.map((p) => p.displayName), ['unit', 'integration', 'e2e', 'contract']);
  for (const project of config.projects) {
    const [name, options] = project.transform[String.raw`^.+\.ts$`];
    assert.equal(name, 'ts-jest');
    assert.equal(options.diagnostics, false);
    assert.equal('isolatedModules' in options, false, 'the deprecated ts-jest option is not set; the tsconfig carries it');
  }
  // The unit project overlays compiler options over the repository tsconfig; the other projects use the file as it is.
  const [, unit] = config.projects[0].transform[String.raw`^.+\.ts$`];
  assert.deepEqual(unit.tsconfig, { isolatedModules: false, importHelpers: true });
  assert.deepEqual(preset.UNIT_COMPILER_OPTIONS, { isolatedModules: false, importHelpers: true });
  for (const project of config.projects.slice(1)) assert.equal(typeof project.transform[String.raw`^.+\.ts$`][1].tsconfig, 'string');
  assert.equal(new RegExp(String.raw`^.+\.ts$`).test('a.ts'), true);
  assert.equal(new RegExp(String.raw`^.+\.ts$`).test('a.tsx'), false);
});

test('starciJestConfig takes ONE option, the coverage scope starci app sync renders: it refuses to run without it, and any other option changes nothing', () => {
  assert.equal(preset.starciJestConfig.length, 1);
  assert.throws(() => preset.starciJestConfig(), /needs the coverage scope starci app sync renders/);
  assert.throws(() => preset.starciJestConfig({ coverage: { roots: ['src/'], roles: [], excludes: [] } }), /needs the coverage scope/, 'a scope that measures no role is refused');
  assert.throws(() => preset.starciJestConfig({ coverage: { roots: 'src/', roles: ['service'], excludes: [] } }), /needs the coverage scope/);
  const tuned = preset.starciJestConfig({ coverage: SCOPE, moduleNameMapper: { '^@x/(.*)$': '<rootDir>/x/$1' }, e2e: { globalSetup: 'x' }, unit: { setupFiles: ['x'] } });
  assert.deepEqual(tuned, preset.starciJestConfig(OPTIONS), 'an argument other than the scope changes nothing');
  assert.notEqual(preset.starciJestConfig(OPTIONS).projects[0].moduleNameMapper, preset.starciJestConfig(OPTIONS).projects[0].moduleNameMapper);
});

test('every project maps exactly the three aliases the managed tsconfig.json declares', () => {
  const expected = { '^@features/(.*)$': '<rootDir>/src/features/$1', '^@modules/(.*)$': '<rootDir>/src/modules/$1', '^@tests/(.*)$': '<rootDir>/src/tests/$1' };
  assert.deepEqual(preset.MODULE_NAME_MAPPER, expected);
  for (const project of preset.starciJestConfig(OPTIONS).projects) assert.deepEqual(project.moduleNameMapper, expected);
});

test('coverage is measured by v8, not istanbul', () => {
  assert.equal(preset.starciJestConfig(OPTIONS).coverageProvider, 'v8');
});

test('the unit project matches *.spec.ts only and never a file of src/tests/{world,integration,e2e,contract}', () => {
  const [unit] = preset.starciJestConfig(OPTIONS).projects;
  assert.deepEqual(unit.testMatch, ['**/*.spec.ts']);
  const ignored = (file) => unit.testPathIgnorePatterns.some((pattern) => new RegExp(pattern).test(file));
  for (const folder of ['world', 'integration', 'e2e', 'contract']) {
    assert.equal(ignored(`/r/src/tests/${folder}/a/x.spec.ts`), true, folder);
    assert.equal(ignored(`${path.parse(withWorld).root}r\\src\\tests\\${folder}\\a\\x.spec.ts`), true, folder);
  }
  assert.equal(ignored('/r/src/features/x/y.spec.ts'), false);
  assert.equal(ignored('/r/src/tests/fixtures/database.spec.ts'), false);
});

test('each test kind is its own project, matched by folder and suffix together; contract is never unit or e2e', () => {
  const byName = Object.fromEntries(preset.starciJestConfig(OPTIONS).projects.map((p) => [p.displayName, p]));
  assert.deepEqual(byName.integration.testMatch, ['<rootDir>/src/tests/integration/**/*.integration-spec.ts']);
  assert.deepEqual(byName.e2e.testMatch, ['<rootDir>/src/tests/e2e/**/*.e2e-spec.ts']);
  assert.deepEqual(byName.contract.testMatch, ['<rootDir>/src/tests/contract/**/*.contract-spec.ts']);
  for (const name of ['integration', 'e2e', 'contract']) {
    assert.equal(byName[name].runner, preset.WORLD_RUNNER, `${name} runs every file in a process of its own`);
    assert.equal('maxWorkers' in byName[name], false, `${name}: maxWorkers is a global option, a project never carries it`);
    assert.equal(byName[name].transform[String.raw`^.+\.ts$`][1].tsconfig, 'src/tests/tsconfig.json', name);
    assert.equal(byName[name].globalSetup, '<rootDir>/src/tests/world/global-setup.ts', name);
    assert.equal(byName[name].globalTeardown, '<rootDir>/src/tests/world/global-teardown.ts', name);
    assert.equal('setupFilesAfterEnv' in byName[name], false, name);
  }
  assert.deepEqual(byName.unit.transform[String.raw`^.+\.ts$`][1].tsconfig, { isolatedModules: false, importHelpers: true });
  assert.equal('globalSetup' in byName.unit, false, 'unit specs need no world');
  assert.equal('runner' in byName.unit, false, 'unit specs run on the stock runner');
  assert.equal(path.basename(preset.WORLD_RUNNER), 'world-runner.cjs');
  assert.deepEqual(preset.TEST_KIND_FOLDERS, ['world', 'integration', 'e2e', 'contract']);
});

test('coverage is measured on the logic roles of the rendered roots only, with a per-file threshold of 100', () => {
  const globs = preset.collectCoverageFrom(SCOPE);
  assert.deepEqual(globs.filter((g) => !g.startsWith('!')), ['src/modules/domain/*/**/*.{service,guard}.ts', 'src/modules/platform/*/**/*.{service,guard}.ts']);
  for (const excluded of ['src/modules/domain/*/persistence/**', '**/dist/**', '**/coverage/**']) {
    assert.ok(globs.includes(`!${excluded}`), `${excluded} is outside the denominator`);
  }
  assert.equal(preset.rootGlob('src/', ['service']), 'src/**/*.service.ts', 'one role needs no braces');
  const { coverageThreshold } = preset.starciJestConfig(OPTIONS);
  const expected = new Set(SCOPE.roots.map((root) => `./${preset.rootGlob(root, SCOPE.roles)}`));
  assert.ok(Object.keys(coverageThreshold).every((key) => expected.has(key)));
  for (const glob of Object.keys(coverageThreshold)) assert.deepEqual(coverageThreshold[glob], { lines: 100, branches: 100, functions: 100, statements: 100 });
});

test('a coverage glob with no file in the repository gets no threshold key (jest refuses a key that matches nothing); one with files gets it', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-roles-'));
  try {
    fs.mkdirSync(path.join(root, 'src', 'modules', 'domain', 'a'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'modules', 'domain', 'a', 'a.service.ts'), 'export {};\n');
    assert.equal(preset.hasCoverageSubjects(root, 'src/modules/domain/*/**/*.{service,guard}.ts'), true);
    assert.equal(preset.hasCoverageSubjects(root, 'src/modules/domain/*/**/*.guard.ts'), false, 'no guard yet');
    assert.equal(preset.hasCoverageSubjects(root, 'src/modules/platform/*/**/*.{service,guard}.ts'), false, 'no platform capability yet');
    fs.mkdirSync(path.join(root, 'src', 'modules', 'domain', 'a', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'modules', 'domain', 'a', 'deep', 'auth.guard.ts'), 'export {};\n');
    assert.equal(preset.hasCoverageSubjects(root, 'src/modules/domain/*/**/*.guard.ts'), true, '** spans directories');
    fs.mkdirSync(path.join(root, 'src', 'modules', 'platform', 'node_modules', 'x'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'modules', 'platform', 'node_modules', 'x', 'x.service.ts'), 'export {};\n');
    assert.equal(preset.hasCoverageSubjects(root, 'src/modules/platform/**/*.service.ts'), false, 'dependencies are never subjects');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the unit run writes the lcov Sonar imports, keeps the text summary, and renders no coverage exclusion', () => {
  assert.equal(preset.sonarCoverageExclusions, undefined);
  assert.equal(preset.sonarExclusions(), '**/*.spec.ts,**/*.e2e-spec.ts,**/dist/**,**/coverage/**');
  const config = preset.starciJestConfig(OPTIONS);
  assert.ok(config.coverageReporters.includes('lcov'), 'lcov is the report Sonar imports (sonar.javascript.lcov.reportPaths)');
  assert.ok(config.coverageReporters.includes('text-summary'));
  assert.equal(config.coverageDirectory, 'coverage');
  // The scope is NOT a constant of the preset: starci app sync derives it from the slot manifest (scripts/hfs/coverage-scope.mjs) into the repository's jest.config.js.
  assert.equal(preset.COVERAGE_SOURCES, undefined);
});

test('the mock<T>() types replace `as unknown as`: typed jest.Mock members, assignable to T, wrong stubs rejected', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const ts = require('typescript');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-mock-types-'));
  try {
    fs.copyFileSync(path.join(import.meta.dirname, 'mock.d.ts'), path.join(dir, 'mock.d.ts'));
    fs.writeFileSync(path.join(dir, 'probe.ts'), fs.readFileSync(new URL('probe-mock.fixture', import.meta.url), 'utf8'));
    const program = ts.createProgram([path.join(dir, 'probe.ts')], {
      strict: true, noEmit: true, skipLibCheck: true, types: ['jest'], typeRoots: [jestTypeRoot()],
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

// ---- the double kit -------------------------------------------------------------------------------------------------

const { createEntityManagerKit } = require('./entity-manager.cjs');
const { fakeIds } = require('./ids.cjs');
const { matchers } = require('./matchers.cjs');

// A jest.fn stand-in with mockResolvedValue and a default implementation, enough to drive the kit outside jest.
function stubFn(implementation) {
  const fn = (...args) => { fn.calls.push(args); return fn.impl(...args); };
  fn.calls = [];
  fn.impl = implementation ?? (() => undefined);
  fn.mockResolvedValue = (value) => { fn.impl = async () => value; return fn; };
  fn.mockImplementation = (impl) => { fn.impl = impl; return fn; };
  return fn;
}
const { mockEntityManager, fakeTransaction } = createEntityManagerKit(stubFn);

class Order {}
class Payment {}

test('mockEntityManager: a stubbed method answers for its entity, and an unstubbed one throws an error naming the method', async () => {
  const order = new Order();
  const em = mockEntityManager({ findOne: [Order, order] });
  assert.equal(await em.findOne(Order, { where: { id: 'a' } }), order);
  assert.deepEqual(em.findOne.calls, [[Order, { where: { id: 'a' } }]]);
  assert.throws(() => em.save({}), /mockEntityManager: em\.save\(\) was called but this spec did not stub it/);
  assert.throws(() => em.query('select 1'), /em\.query\(\)/);
  await assert.rejects(em.findOne(Payment), /em\.findOne\(Payment\) was called but this spec stubbed em\.findOne only for Order/);
});

test('mockEntityManager: pairs of one method answer per entity, in order, and the last answer repeats; query matches its sql', async () => {
  const first = new Order();
  const second = new Order();
  const em = mockEntityManager({ findOne: [[Order, first], [Order, second], [Payment, null]], query: ['select 1', [{ n: 1 }]] });
  assert.equal(await em.findOne(Order), first);
  assert.equal(await em.findOne(Order), second);
  assert.equal(await em.findOne(Order), second);
  assert.equal(await em.findOne(Payment), null);
  assert.deepEqual(await em.query('select 1'), [{ n: 1 }]);
  await assert.rejects(em.query('select 2'), /em\.query\("select 2"\)/);
});

test('mockEntityManager: create builds an entity without a stub, the double is not thenable, a malformed stub is refused', async () => {
  const em = mockEntityManager();
  const built = em.create(Order, { id: 'o-1' });
  assert.ok(built instanceof Order);
  assert.equal(built.id, 'o-1');
  assert.equal(await Promise.resolve(em), em);
  assert.throws(() => mockEntityManager({ count: 3 }), /must be \[Entity, result\]/);
});

test('fakeTransaction: runs the callback with a scoped view, records a commit and the writes it made', async () => {
  const tx = fakeTransaction(mockEntityManager({ save: [Order, new Order()], query: ['update t set a = 1', []] }));
  const seen = [];
  const result = await tx.em.transaction(async (manager) => { seen.push(manager); await manager.query('update t set a = 1'); return manager.save(Order, {}); });
  assert.ok(result instanceof Order);
  assert.notEqual(seen[0], tx.em);
  assert.deepEqual(tx.outcomes, ['commit']);
  assert.equal(tx.commits, 1);
  assert.equal(tx.rollbacks, 0);
  assert.deepEqual(tx.committedWrites.map((write) => write.method), ['query', 'save']);
  assert.deepEqual(tx.rolledBackWrites, []);
});

test('fakeTransaction: a throwing callback is rolled back, its writes are reported as discarded and the error is rethrown', async () => {
  const tx = fakeTransaction(mockEntityManager({ insert: [Order, {}], query: ['select 1', []] }));
  await assert.rejects(tx.em.transaction('SERIALIZABLE', async (manager) => { await manager.insert(Order, {}); await manager.query('select 1'); throw new Error('boom'); }), /boom/);
  await tx.em.transaction(async (manager) => manager.query('select 1'));
  assert.deepEqual(tx.outcomes, ['rollback', 'commit']);
  assert.equal(tx.rollbacks, 1);
  assert.deepEqual(tx.rolledBackWrites.map((write) => write.method), ['insert']);
  assert.deepEqual(tx.committedWrites, []);
  await assert.rejects(tx.em.transaction(), /needs a callback/);
});

test('fakeTransaction: a nested transaction reuses the same scoped view', async () => {
  const tx = fakeTransaction();
  const nested = await tx.em.transaction(async (outer) => outer.transaction(async (inner) => inner === outer));
  assert.equal(nested, true);
});

// ---- behavioural fakes ------------------------------------------------------------------------------------------------

const { fakeCache } = require('./cache.cjs');
const { fakeLock } = require('./lock.cjs');
const { recordingEventBus } = require('./event-bus.cjs');
const { recordingQueueOutbox } = require('./queue.cjs');
const { builder } = require('./builders.cjs');

const PROFILE = { name: 'member.profile', ttl: { seconds: 300 }, parse: (stored) => (typeof stored === 'object' && stored !== null ? stored : null) };

test('fakeCache: a typed entry round-trips as JSON, has a ttl, and expires when the clock advances', async () => {
  const clock = new FakeClock('2026-01-01T00:00:00.000Z');
  const cache = fakeCache(clock);
  assert.equal(await cache.get({ key: PROFILE, args: ['m-1'] }), null);
  await cache.set({ key: PROFILE, args: ['m-1'], value: { name: 'An', at: new Date('2026-01-01T00:00:00.000Z') } });
  assert.deepEqual(await cache.get({ key: PROFILE, args: ['m-1'] }), { name: 'An', at: '2026-01-01T00:00:00.000Z' });
  assert.equal(cache.has('member.profile:m-1'), true);
  assert.equal(cache.ttlOf('member.profile:m-1'), 300);
  clock.advance(299_500);
  assert.equal(cache.ttlOf({ key: PROFILE, args: ['m-1'] }), 1);
  clock.advance(500);
  assert.equal(cache.has({ key: PROFILE, args: ['m-1'] }), false);
  assert.equal(cache.ttlOf('member.profile:m-1'), null);
  assert.equal(await cache.get({ key: PROFILE, args: ['m-1'] }), null);
  assert.deepEqual(cache.keys(), []);
});

test('fakeCache: parse narrows a stored value; del and clear remove; the cache-manager shape works; a bad ttl or clock is refused', async () => {
  const clock = new FakeClock('2026-01-01T00:00:00.000Z');
  const cache = fakeCache(clock);
  await cache.set({ key: PROFILE, args: ['m-2'], value: 'not an object' });
  assert.equal(await cache.get({ key: PROFILE, args: ['m-2'] }), null);
  await cache.set('plain', { a: 1 }, 1000);
  await cache.set('forever', 1);
  assert.deepEqual(await cache.get('plain'), { a: 1 });
  assert.equal(cache.ttlOf('forever'), null);
  assert.equal(cache.has('forever'), true);
  assert.equal(await cache.get('absent'), null);
  clock.advance(1000);
  assert.equal(cache.has('plain'), false);
  await cache.del('forever');
  assert.equal(cache.has('forever'), false);
  await cache.set('x', 1, 5000);
  cache.clear();
  assert.deepEqual(cache.keys(), []);
  await assert.rejects(cache.set('bad', 1, 0), /ttl of bad must be positive/);
  assert.throws(() => fakeCache(undefined), /pass the FakeClock/);
});

test('fakeLock: grants, refuses a second holder, renews for the same holder, releases only the current grant, frees on ttl expiry', async () => {
  const clock = new FakeClock('2026-01-01T00:00:00.000Z');
  const lock = fakeLock(clock);
  const first = await lock.acquire({ name: 'job', holder: 'a', ttlMs: 1000 });
  assert.deepEqual(first, { name: 'job', holder: 'a', fence: 1 });
  assert.equal(await lock.acquire({ name: 'job', holder: 'b', ttlMs: 1000 }), null);
  assert.deepEqual(await lock.acquire({ name: 'job', holder: 'a', ttlMs: 1000 }), { name: 'job', holder: 'a', fence: 1 });
  assert.equal(lock.isHeld('job'), true);
  assert.equal(lock.holderOf('job'), 'a');
  await lock.release({ grant: { name: 'job', holder: 'b', fence: 1 } });
  assert.equal(lock.isHeld('job'), true);
  await lock.release({ grant: first });
  assert.equal(lock.isHeld('job'), false);
  assert.equal(lock.holderOf('job'), null);
  const second = await lock.acquire({ name: 'job', holder: 'b', ttlMs: 1000 });
  assert.equal(second.fence, 2);
  clock.advance(1000);
  assert.equal(lock.isHeld('job'), false);
  assert.equal((await lock.acquire({ name: 'job', holder: 'a', ttlMs: 1000 })).fence, 3);
  assert.equal(lock.fenceOf('job'), 3);
  assert.equal(lock.fenceOf('other'), null);
});

test('fakeLock: an explicit `at` wins and no clock is refused without one', async () => {
  const lock = fakeLock();
  const at = new Date('2026-01-01T00:00:00.000Z');
  assert.ok(await lock.acquire({ name: 'n', holder: 'a', ttlMs: 10, at }));
  assert.equal(await lock.acquire({ name: 'n', holder: 'b', ttlMs: 10, at: new Date(at.getTime() + 5) }), null);
  assert.ok(await lock.acquire({ name: 'n', holder: 'b', ttlMs: 10, at: new Date(at.getTime() + 10) }));
  assert.equal(lock.isHeld('n'), true);
  await assert.rejects(lock.acquire({ name: 'x', holder: 'a', ttlMs: 1 }), /pass the FakeClock/);
});

class PlacedEvent { static eventName = 'order.placed'; constructor(eventId) { this.eventId = eventId; } }
class ShippedEvent { static eventName = 'order.shipped'; constructor(eventId) { this.eventId = eventId; } }

test('recordingEventBus: keeps one event per (name, id), remembers every publication and whether it was inside a transaction', async () => {
  const bus = recordingEventBus();
  assert.equal(bus.allInTransaction, false);
  const tx = fakeTransaction(mockEntityManager());
  const placed = new PlacedEvent('e-1');
  await tx.em.transaction(async (manager) => { await bus.publish(placed, manager); await bus.publish(placed, manager); });
  await bus.publish(new ShippedEvent('e-1'), tx.em);
  assert.equal(bus.writes.length, 3);
  assert.deepEqual(bus.events.map((event) => event.constructor.eventName), ['order.placed', 'order.shipped']);
  assert.deepEqual(bus.eventsOf(PlacedEvent), [placed]);
  assert.deepEqual(bus.entries.map((entry) => entry.inTransaction), [true, true, false]);
  assert.equal(bus.allInTransaction, false);
  bus.clear();
  assert.deepEqual(bus.events, []);
});

test('recordingEventBus read side: scripted pending retries, dead letters, requeue and one-shot failures', async () => {
  const bus = recordingEventBus();
  assert.equal(await bus.pendingRetries(PlacedEvent), 0);
  bus.setPendingRetries(2);
  assert.equal(await bus.pendingRetries(PlacedEvent), 2);
  const letter = { id: 'd-1', eventName: 'order.placed', eventId: 'e-1', reason: 'boom', attempts: 3 };
  bus.queueDeadLetters(letter, { ...letter, id: 'd-2', eventName: 'order.shipped' });
  assert.deepEqual(await bus.deadLetters(PlacedEvent), [letter]);
  await bus.requeue('d-1');
  assert.deepEqual(bus.requeued, ['d-1']);
  const boom = new Error('down');
  for (const [operation, call] of Object.entries({
    publish: () => bus.publish(new PlacedEvent('z'), {}),
    pendingRetries: () => bus.pendingRetries(PlacedEvent),
    deadLetters: () => bus.deadLetters(PlacedEvent),
    requeue: () => bus.requeue('d-1'),
  })) {
    bus.failNext(operation, boom);
    await assert.rejects(call(), /down/, operation);
    await call();
  }
  bus.failNext('requeue', boom);
  bus.clear();
  assert.deepEqual([bus.requeued, bus.writes], [[], []]);
  assert.equal(await bus.pendingRetries(PlacedEvent), 0);
  await bus.requeue('after-clear');
});

const { fakeInbox } = require('./inbox.cjs');
test('fakeInbox: the first claim of a pair wins, a repeat loses until the claim is released, a seen pair is a redelivery, one-shot failures reject once', async () => {
  const inbox = fakeInbox();
  assert.equal(await inbox.claim('sepay', 'e-1'), true);
  assert.equal(await inbox.claim('sepay', 'e-1'), false);
  assert.equal(await inbox.claim('mail', 'e-1'), true, 'the pair is (source, eventId), not the event id alone');
  assert.deepEqual(inbox.claims, [{ source: 'sepay', eventId: 'e-1' }, { source: 'sepay', eventId: 'e-1' }, { source: 'mail', eventId: 'e-1' }]);
  assert.deepEqual(inbox.claimed, [{ source: 'sepay', eventId: 'e-1' }, { source: 'mail', eventId: 'e-1' }]);
  await inbox.release('sepay', 'e-1');
  assert.deepEqual(inbox.released, [{ source: 'sepay', eventId: 'e-1' }]);
  assert.equal(await inbox.claim('sepay', 'e-1'), true, 'a released claim is processed again');
  inbox.seen('sepay', 'e-2');
  assert.equal(await inbox.claim('sepay', 'e-2'), false);
  inbox.failNext('claim', new Error('db down'));
  await assert.rejects(() => inbox.claim('sepay', 'e-3'), /db down/);
  assert.equal(await inbox.claim('sepay', 'e-3'), true, 'the failure is one-shot and the failed call claimed nothing');
  inbox.failNext('release', new Error('db down'));
  await assert.rejects(() => inbox.release('sepay', 'e-3'), /db down/);
  inbox.clear();
  assert.deepEqual([inbox.claims, inbox.claimed, inbox.released], [[], [], []]);
  assert.equal(await inbox.claim('sepay', 'e-1'), true);
});

test('recordingQueueOutbox: records every job with its manager, by queue, and fails once when scripted', async () => {
  const outbox = recordingQueueOutbox();
  assert.equal(outbox.allInTransaction, false);
  const tx = fakeTransaction(mockEntityManager());
  await tx.em.transaction(async (manager) => { await outbox.write(manager, 'mail', { to: 'a' }); });
  await outbox.write(tx.em, 'sms', { to: 'b' });
  assert.deepEqual(outbox.jobs, [{ queue: 'mail', payload: { to: 'a' } }, { queue: 'sms', payload: { to: 'b' } }]);
  assert.deepEqual(outbox.jobsOf('mail'), [{ queue: 'mail', payload: { to: 'a' } }]);
  assert.deepEqual(outbox.entries.map((entry) => entry.inTransaction), [true, false]);
  assert.equal(outbox.allInTransaction, false);
  const boom = new Error('down');
  outbox.failNext('write', boom);
  await assert.rejects(outbox.write({}, 'mail', {}), /down/);
  await outbox.write({}, 'mail', {});
  outbox.clear();
  assert.deepEqual(outbox.jobs, []);
});

test('the index exports the whole kit and the package.json declares typeorm as an optional peer only', () => {
  for (const name of ['mock', 'mockEntityManager', 'fakeTransaction', 'FakeClock', 'fakeIds', 'fakeCache', 'fakeLock', 'recordingEventBus', 'recordingQueueOutbox', 'builder']) assert.equal(typeof preset[name], 'function', name);
  const pkg = require('./package.json');
  assert.equal(pkg.peerDependenciesMeta.typeorm.optional, true);
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
  for (const file of ['entity-manager.cjs', 'ids.cjs', 'matchers.cjs', 'mock.cjs', 'clock.cjs', 'cache.cjs', 'lock.cjs', 'event-bus.cjs', 'queue.cjs', 'builders.cjs', 'world-runner.cjs']) {
    assert.doesNotMatch(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), /require\(["'](typeorm|@nestjs)/, `${file} pulls in no infra`);
  }
});

test('the kit types: mockEntityManager() is assignable to EntityManager with no cast, stubs are typed, the matchers and ids type-check', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const ts = require('typescript');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-kit-types-'));
  try {
    for (const file of ['mock.d.ts', 'entity-manager.d.ts', 'ids.d.ts', 'matchers.d.ts', 'clock.d.ts']) fs.copyFileSync(path.join(import.meta.dirname, file), path.join(dir, file));
    fs.mkdirSync(path.join(dir, 'node_modules', 'typeorm'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'typeorm', 'index.d.ts'), fs.readFileSync(new URL('typeorm-stub.fixture', import.meta.url), 'utf8'));
    fs.writeFileSync(path.join(dir, 'probe.ts'), fs.readFileSync(new URL('probe-kit.fixture', import.meta.url), 'utf8'));
    const program = ts.createProgram([path.join(dir, 'probe.ts')], {
      strict: true, noEmit: true, skipLibCheck: true, types: ['jest'], typeRoots: [jestTypeRoot()],
      module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022,
    });
    const problems = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    assert.deepEqual(problems, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// -- e2e isolation: a real jest run of the preset's e2e project ----------------------------------------------------------
// A stand-in for @nestjs/graphql's type registry, with its exact mechanism: the storage lives on the process global
// (`global.GqlTypeMetadataStorage || (global.GqlTypeMetadataStorage = new Storage())`) and two different classes under one
// type name are refused with the error a Nest boot reports. The globalSetup loads it in jest's main process, as the test
// world's migrate step loads the application's modules there.
const FAKE_GRAPHQL = `"use strict"
class TypeMetadataStorageHost {
  constructor() { this.types = new Map() }
  add(name, target) {
    const known = this.types.get(name)
    if (known !== undefined && known !== target) throw new Error("Cannot determine a GraphQL output type for the \\"" + name + "\\": two classes declare it")
    this.types.set(name, target)
  }
}
const globalRef = global
exports.TypeMetadataStorage = globalRef.GqlTypeMetadataStorage || (globalRef.GqlTypeMetadataStorage = new TypeMetadataStorageHost())
exports.ObjectType = (name) => (target) => { exports.TypeMetadataStorage.add(name, target); return target }
`;
// Each file logs `start <label> <slot> <pid>` and, a little later, `end <label> <slot> <pid>` to timeline.log at the repository
// root, so a spec can see which files ran at the same time, in which process and on which data slot.
const E2E_SPEC = (label) => `const { ObjectType } = require("fake-graphql")
const fs = require("fs")
const log = (event) => fs.appendFileSync(require("path").join(process.cwd(), "timeline.log"), event + " ${label} " + process.env.STARCI_TEST_WORLD_SLOT + " " + process.pid + String.fromCharCode(10))
class Person {}
ObjectType("Person")(Person)
test("${label} boots with its own Person type", async () => {
  log("start")
  await new Promise((resolve) => setTimeout(resolve, 1500))
  expect(require("fake-graphql").TypeMetadataStorage.types.get("Person")).toBe(Person)
  log("end")
})
`;

/** The state file @starci/test-world 1.1.x publishes (protocol 2), with `slots` data slots. */
const worldState = (slots) => ({ version: 2, library: '@starci/test-world@1.1.0', runId: 'r', slots: Array.from({ length: slots }, (_, index) => ({ slot: index + 1 })) });

/**
 * A repository with the preset's jest config, a world that loads the registry in the main process and publishes `state` as
 * its state file (as the test world's globalSetup does), and three e2e files.
 */
function isolationRepo({ stockRunner, state = worldState(2) }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-isolation-'));
  const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  put('package.json', JSON.stringify({ name: 'isolation-fixture', private: true }));
  put('node_modules/fake-graphql/package.json', JSON.stringify({ name: 'fake-graphql', main: 'index.js' }));
  put('node_modules/fake-graphql/index.js', FAKE_GRAPHQL);
  // The fixture's files are plain JavaScript, so ts-jest is not needed: its preset and transform are dropped, nothing else changes.
  put('jest.config.js', `const config = require(${JSON.stringify(require.resolve('./index.cjs'))}).starciJestConfig({ coverage: { roots: ['src/modules/*/'], roles: ['service'], excludes: [] } })
for (const project of config.projects) {
  delete project.preset
  project.transform = {}
  ${stockRunner ? 'delete project.runner' : ''}
}
module.exports = config
`);
  put('src/tests/world/global-setup.ts', `module.exports = async () => {
  require("fake-graphql")
  const file = require("path").join(process.cwd(), "world-state.json")
  require("fs").writeFileSync(file, ${JSON.stringify(JSON.stringify(state))})
  process.env.STARCI_TEST_WORLD_STATE = file
}
`);
  put('src/tests/world/global-teardown.ts', 'module.exports = async () => {}\n');
  put('apps/.keep', ''); // the preset's roots are src/ and apps/
  put('src/tests/e2e/people/first.e2e-spec.ts', E2E_SPEC('the first file'));
  put('src/tests/e2e/people/second.e2e-spec.ts', E2E_SPEC('the second file'));
  put('src/tests/e2e/people/third.e2e-spec.ts', E2E_SPEC('the third file'));
  return root;
}

/** Runs the repository's jest (the preset's peer) on the e2e project and answers its exit status and output. */
function spawnE2e(root, extra) {
  const jestPackage = require.resolve('jest/package.json');
  const jestBin = path.join(path.dirname(jestPackage), 'bin', 'jest.js');
  const result = spawnSync(process.execPath, [jestBin, '--selectProjects', 'e2e', '--ci', '--json', '--outputFile', path.join(root, 'report.json'), '--cacheDirectory', path.join(root, '.jest-cache'), ...extra], {
    cwd: root,
    encoding: 'utf8',
    // the fixture resolves jest (and the world runner its jest-runner) from the same installation as this spec
    env: { ...process.env, NODE_PATH: path.dirname(path.dirname(jestPackage)) },
    timeout: 240_000,
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}${result.error ? `\n${result.error.message}` : ''}` };
}

/** Runs the repository's jest on the e2e project and answers its JSON report. */
function runE2e(root, extra) {
  fs.rmSync(path.join(root, 'report.json'), { force: true });
  const { status, output } = spawnE2e(root, extra);
  assert.equal(fs.existsSync(path.join(root, 'report.json')), true, `jest wrote no report:\n${output}`);
  return { status, report: JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8')), output };
}

const resultsOf = (report) => Object.fromEntries(report.testResults.map((file) => [path.basename(file.name), { status: file.status, message: file.message }]));

/** The timeline the files logged: `{ event, label, slot, pid }` in the order they happened. */
function timelineOf(root) {
  return fs.readFileSync(path.join(root, 'timeline.log'), 'utf8').trim().split(/\r?\n/).map((line) => {
    const words = line.split(' ');
    return { event: words[0], label: words.slice(1, -2).join(' '), slot: words.at(-2), pid: words.at(-1) };
  });
}

/** The largest number of files that ran at the same time, and every set of labels that overlapped with their slots. */
function concurrencyOf(events) {
  const running = new Map();
  let widest = 0;
  for (const entry of events) {
    if (entry.event === 'start') {
      for (const other of running.values()) assert.notEqual(other.slot, entry.slot, `${entry.label} started on slot ${entry.slot} while ${other.label} held it`);
      running.set(entry.label, entry);
      widest = Math.max(widest, running.size);
    } else running.delete(entry.label);
  }
  return widest;
}

test('e2e isolation: in one preset run, three e2e files that each register a GraphQL type named Person all pass, even with --runInBand', () => {
  const root = isolationRepo({ stockRunner: false });
  try {
    for (const extra of [[], ['--runInBand'], ['--maxWorkers=2']]) {
      const { status, report, output } = runE2e(root, extra);
      const results = resultsOf(report);
      assert.deepEqual(Object.keys(results).sort(), ['first.e2e-spec.ts', 'second.e2e-spec.ts', 'third.e2e-spec.ts'], `${extra.join(' ')}\n${output}`);
      for (const [file, result] of Object.entries(results)) assert.equal(result.status, 'passed', `${extra.join(' ') || 'default'}: ${file}: ${result.message}`);
      assert.equal(status, 0, output);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('e2e isolation is the runner: on the stock in-band runner the same files collide on the process-global registry', () => {
  const root = isolationRepo({ stockRunner: true });
  try {
    const { status, report } = runE2e(root, ['--runInBand']);
    const results = resultsOf(report);
    // jest orders the files itself: whichever runs first passes, the one after it inherits the registry and fails to boot.
    const outcomes = Object.values(results).map((result) => result.status).sort();
    assert.deepEqual(outcomes, ['failed', 'failed', 'passed']);
    assert.match(Object.values(results).find((result) => result.status === 'failed').message, /Cannot determine a GraphQL output type/);
    assert.equal(status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the world runner runs up to min(--maxWorkers, slots) files at once, each in its own process, never two on one slot', () => {
  const root = isolationRepo({ stockRunner: false, state: worldState(2) });
  try {
    for (const [extra, width] of [[['--maxWorkers=3'], 2], [['--maxWorkers=2'], 2], [['--maxWorkers=1'], 1], [['--runInBand'], 1]]) {
      fs.rmSync(path.join(root, 'timeline.log'), { force: true });
      const { status, output } = runE2e(root, extra);
      assert.equal(status, 0, output);
      const events = timelineOf(root);
      assert.equal(events.length, 6, output);
      assert.equal(concurrencyOf(events), width, `${extra.join(' ')}: ${events.map((e) => `${e.event} ${e.label}@${e.slot}`).join(', ')}`);
      for (const entry of events) assert.ok(['1', '2'].slice(0, width).includes(entry.slot), `${entry.label} ran on slot ${entry.slot}`);
      assert.equal(new Set(events.map((entry) => entry.pid)).size, 3, 'each file ran in a process of its own');
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the world runner widens with the slots the world provisioned: three slots run three files at once', () => {
  const root = isolationRepo({ stockRunner: false, state: worldState(3) });
  try {
    const { status, output } = runE2e(root, ['--maxWorkers=3']);
    assert.equal(status, 0, output);
    const events = timelineOf(root);
    assert.equal(concurrencyOf(events), 3, events.map((e) => `${e.event} ${e.label}@${e.slot}`).join(', '));
    assert.deepEqual([...new Set(events.map((entry) => entry.slot))].sort(), ['1', '2', '3']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a state file of another test-world protocol is a typed pair mismatch naming both versions, never a fallback mode', () => {
  for (const state of [{ version: 1, runId: 'r' }, { version: 3, library: '@starci/test-world@9.0.0', runId: 'r', slots: [{ slot: 1 }] }]) {
    const root = isolationRepo({ stockRunner: false, state });
    try {
      const { status, output } = spawnE2e(root, ['--maxWorkers=2']);
      assert.notEqual(status, 0, output);
      assert.match(output, /JEST_PRESET_WORLD_PAIR_MISMATCH/);
      assert.match(output, new RegExp(`@starci/jest-preset@${require('./package.json').version.replace(/\./g, '\\.')}`));
      assert.match(output, state.library === undefined ? /@starci\/test-world before 1\.1\.0/ : /@starci\/test-world@9\.0\.0/);
      assert.match(output, /canon-pins/);
      assert.equal(fs.existsSync(path.join(root, 'timeline.log')), false, 'no file ran');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});
