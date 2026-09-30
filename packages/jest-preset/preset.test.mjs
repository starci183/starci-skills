import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  assert.deepEqual(byName.unit.transform[String.raw`^.+\.ts$`][1].tsconfig, { isolatedModules: false, importHelpers: true });
  assert.equal('globalSetup' in byName.unit, false, 'unit specs need no world');
  assert.deepEqual(preset.TEST_KIND_FOLDERS, ['world', 'integration', 'e2e', 'contract']);
});

test('coverage is measured on *.service.ts only, with a per-file threshold of 100', () => {
  const globs = preset.collectCoverageFrom();
  assert.deepEqual(globs.filter((g) => !g.startsWith('!')), ['src/**/*.service.ts']);
  for (const excluded of ['src/tests/**', '**/dist/**', '**/coverage/**']) {
    assert.ok(globs.includes(`!${excluded}`), `${excluded} is outside the denominator`);
  }
  const { coverageThreshold } = preset.starciJestConfig();
  assert.deepEqual(Object.keys(coverageThreshold), ['./src/**/*.service.ts']);
  assert.deepEqual(coverageThreshold['./src/**/*.service.ts'], { lines: 100, branches: 100, functions: 100, statements: 100 });
});

test('Sonar does not depend on coverage: the preset renders no coverage exclusion and reports no lcov', () => {
  assert.equal(preset.sonarCoverageExclusions, undefined);
  assert.equal(preset.sonarExclusions(), '**/*.spec.ts,**/*.e2e-spec.ts,**/dist/**,**/coverage/**');
  assert.ok(!preset.starciJestConfig().coverageReporters.includes('lcov'));
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
const { recordingOutbox } = require('./outbox.cjs');
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

test('recordingOutbox claim side: hands out the backlog by queue and limit, empty and duplicate claims, reports and one-shot failures', async () => {
  const outbox = recordingOutbox();
  const params = { at: new Date(0), queues: ['mail'], limit: 2, visibilityMs: 1000 };
  const record = (id, queue) => ({ id, queue, eventId: `e-${id}`, payload: {}, attempts: 1 });
  assert.deepEqual(await outbox.claimDue(params), []);
  outbox.queueRecords(record('a', 'mail'), record('b', 'sms'), record('c', 'mail'), record('d', 'mail'));
  assert.deepEqual((await outbox.claimDue(params)).map((r) => r.id), ['a', 'c']);
  assert.deepEqual(outbox.backlog.map((r) => r.id), ['b', 'd']);
  assert.deepEqual((await outbox.claimDue(params)).map((r) => r.id), ['d']);
  const duplicate = record('x', 'mail');
  outbox.queueRecords(duplicate, duplicate);
  assert.deepEqual(await outbox.claimDue(params), [duplicate, duplicate]);
  assert.equal(outbox.claims.length, 4);
  await outbox.complete('a');
  await outbox.retry({ id: 'b', at: new Date(1), error: 'x' });
  await outbox.bury({ id: 'c', error: 'y' });
  assert.deepEqual(outbox.completed, ['a']);
  assert.deepEqual(outbox.retried, [{ id: 'b', at: new Date(1), error: 'x' }]);
  assert.deepEqual(outbox.buried, [{ id: 'c', error: 'y' }]);
  const boom = new Error('boom');
  const calls = {
    claimDue: () => outbox.claimDue(params),
    complete: () => outbox.complete('a'),
    retry: () => outbox.retry({ id: 'b', at: new Date(1), error: 'x' }),
    bury: () => outbox.bury({ id: 'c', error: 'y' }),
    enqueue: () => outbox.enqueue({}, { queue: 'mail', eventId: 'z', payload: {} }),
  };
  for (const [operation, call] of Object.entries(calls)) {
    outbox.failNext(operation, boom);
    await assert.rejects(call(), boom, operation);
    await call();
  }
  outbox.failNext('bury', boom);
  outbox.queueRecords(record('q', 'mail'));
  outbox.clear();
  assert.deepEqual([outbox.claims, outbox.completed, outbox.retried, outbox.buried, outbox.backlog, outbox.messages], [[], [], [], [], [], []]);
  await outbox.bury({ id: 'c', error: 'y' });
});

test('recordingOutbox: keeps one message per (queue, eventId), remembers every write and whether it was inside a transaction', async () => {
  const outbox = recordingOutbox();
  assert.equal(outbox.allInTransaction, false);
  const tx = fakeTransaction();
  const message = { queue: 'mail', eventId: 'e-1', payload: { to: 'a' } };
  await tx.em.transaction(async (manager) => { await outbox.enqueue(manager, message); await outbox.enqueue(manager, message); });
  await outbox.enqueue(tx.em, { queue: 'sms', eventId: 'e-1', payload: {} });
  assert.equal(outbox.writes.length, 3);
  assert.deepEqual(outbox.messages.map((m) => m.queue), ['mail', 'sms']);
  assert.deepEqual(outbox.messagesOf('mail'), [message]);
  assert.deepEqual(outbox.entries.map((entry) => entry.inTransaction), [true, true, false]);
  assert.equal(outbox.allInTransaction, false);
  outbox.clear();
  assert.deepEqual(outbox.messages, []);
});

test('builder: the defaults with the overrides applied, never mutating the defaults', () => {
  const options = builder({ maxLines: 50, guest: false });
  assert.deepEqual(options(), { maxLines: 50, guest: false });
  assert.deepEqual(options({ guest: true }), { maxLines: 50, guest: true });
  assert.deepEqual(options(), { maxLines: 50, guest: false });
});

test('fakeIds: deterministic UUID-shaped ids in sequence, resettable, prefix-separated', () => {
  const ids = fakeIds();
  assert.equal(ids.next(), '00000000-0000-4000-8000-000000000001');
  assert.equal(ids.next(), '00000000-0000-4000-8000-000000000002');
  assert.deepEqual(ids.issued, ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']);
  ids.reset();
  assert.equal(ids.next(), '00000000-0000-4000-8000-000000000001');
  assert.equal(fakeIds('ab').next(), '000000ab-0000-4000-8000-000000000001');
  assert.throws(() => fakeIds('xyz'), /hex digits/);
  assert.match(fakeIds().next(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});

// The matchers run against a minimal `this` (jest supplies utils and equals).
const context = {
  equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  utils: { printReceived: (v) => JSON.stringify(v), printExpected: (v) => JSON.stringify(v) },
};
const run = (name, ...args) => matchers[name].call(context, ...args);

test('toBeRefused: matches a refusal by code, by code with params, and rejects success or another code', () => {
  const refused = { kind: 'refused', code: 'STOCK_EXHAUSTED', params: { sku: 'a' } };
  assert.equal(run('toBeRefused', refused, 'STOCK_EXHAUSTED').pass, true);
  assert.equal(run('toBeRefused', refused, { code: 'STOCK_EXHAUSTED', params: { sku: 'a' } }).pass, true);
  assert.equal(run('toBeRefused', refused, { code: 'STOCK_EXHAUSTED', params: { sku: 'b' } }).pass, false);
  assert.equal(run('toBeRefused', refused, 'OTHER').pass, false);
  assert.equal(run('toBeRefused', { kind: 'ok', value: 1 }, 'STOCK_EXHAUSTED').pass, false);
  assert.match(run('toBeRefused', { kind: 'ok', value: 1 }, 'X').message(), /received/);
});

test('toSucceedWith: matches an ok outcome by value and rejects a refusal, another value or a non-outcome', () => {
  assert.equal(run('toSucceedWith', { kind: 'ok', value: { id: 1 } }, { id: 1 }).pass, true);
  assert.equal(run('toSucceedWith', { kind: 'ok', value: { id: 1 } }, { id: 2 }).pass, false);
  assert.equal(run('toSucceedWith', { kind: 'refused', code: 'X' }, { id: 1 }).pass, false);
  const notOutcome = run('toSucceedWith', 42, 42);
  assert.equal(notOutcome.pass, false);
  assert.match(notOutcome.message(), /expected an Outcome/);
  assert.match(run('toBeRefused', null, 'X').message(), /expected an Outcome/);
});

test('the index exports the whole kit and the package.json declares typeorm as an optional peer only', () => {
  for (const name of ['mock', 'mockEntityManager', 'fakeTransaction', 'FakeClock', 'fakeIds', 'fakeCache', 'fakeLock', 'recordingOutbox', 'builder']) assert.equal(typeof preset[name], 'function', name);
  const pkg = require('./package.json');
  assert.equal(pkg.version, '2.1.0');
  assert.equal(pkg.peerDependenciesMeta.typeorm.optional, true);
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
  for (const file of ['entity-manager.cjs', 'ids.cjs', 'matchers.cjs', 'mock.cjs', 'clock.cjs', 'cache.cjs', 'lock.cjs', 'outbox.cjs', 'builders.cjs']) {
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
      strict: true, noEmit: true, skipLibCheck: true, types: ['jest'], typeRoots: [path.resolve(import.meta.dirname, '../../node_modules/@types')],
      module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022,
    });
    const problems = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    assert.deepEqual(problems, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
