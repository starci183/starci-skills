// The per-file coverage law, proven by running jest itself: every file of a measured logic role (a service, a guard) must reach 100 on lines, branches,
// functions and statements ON ITS OWN. A large fully covered service cannot carry a small one that misses a single branch,
// however high the average is. The fixture app lives in a temporary folder inside this package (so jest, ts-jest and
// typescript resolve from this package's own devDependencies; no link is ever made) and is removed afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const jestBin = require.resolve('jest/bin/jest');

/** A service with `n` covered methods, and optionally one branch its spec never takes. */
function service(name, n, missBranch) {
  const methods = Array.from({ length: n }, (_, i) => `  m${i}(x: number): number {\n    return x + ${i}\n  }`).join('\n');
  const branch = missBranch ? '  pick(flag: boolean): string {\n    if (flag) return "yes"\n    return "no"\n  }\n' : '';
  return `export class ${name} {\n${methods}\n${branch}}\n`;
}
function spec(name, file, n, missBranch) {
  const calls = Array.from({ length: n }, (_, i) => `    expect(s.m${i}(1)).toBe(${1 + i})`).join('\n');
  const branch = missBranch ? '    expect(s.pick(false)).toBe("no")\n' : '';
  return `import { ${name} } from "./${file}"\n\ndescribe("${name}", () => {\n  it("works", () => {\n    const s = new ${name}()\n${calls}\n${branch}  })\n})\n`;
}

function runFixture(t, missBranch) {
  const app = fs.mkdtempSync(path.join(here, '.coverage-fixture-'));
  t.after(() => fs.rmSync(app, { recursive: true, force: true }));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), text); };
  write('package.json', JSON.stringify({ name: 'coverage-fixture', private: true }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', strict: true, esModuleInterop: true, isolatedModules: true } }));
  write('jest.config.cjs', `const preset = require(${JSON.stringify(path.join(here, 'index.cjs'))})\nmodule.exports = preset.starciJestConfig({ coverage: { roots: ['src/modules/*/'], roles: ['service', 'guard'], excludes: ['src/modules/*/persistence/**'] } })\n`);
  fs.mkdirSync(path.join(app, 'apps'), { recursive: true });
  // A large service, fully covered, and a small one: together the average is far above 99.
  write('src/modules/big/big.service.ts', service('BigService', 40, false));
  write('src/modules/big/big.service.spec.ts', spec('BigService', 'big.service', 40, false));
  write('src/modules/big/small.service.ts', service('SmallService', 1, missBranch));
  write('src/modules/big/small.service.spec.ts', spec('SmallService', 'small.service', 1, missBranch));
  return spawnSync(process.execPath, [jestBin, '--selectProjects', 'unit', '--coverage', '--ci', '--coverageReporters=text-summary'], { cwd: app, encoding: 'utf8', timeout: 300_000 });
}

test('one service below 100 fails the run although the average across services is above 99', (t) => {
  const r = runFixture(t, true);
  assert.notEqual(r.status, 0, `jest must fail: ${r.stdout}\n${r.stderr}`);
  assert.match(`${r.stdout}\n${r.stderr}`, /small\.service\.ts.*threshold|coverage threshold.*small\.service/is, 'the failure names the small service');
});

test('every service at 100 passes', (t) => {
  const r = runFixture(t, false);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test('a guard (a logic role other than service) below 100 fails the run, and a none directory inside a root is never measured', (t) => {
  const app = fs.mkdtempSync(path.join(here, '.coverage-fixture-'));
  t.after(() => fs.rmSync(app, { recursive: true, force: true }));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), text); };
  write('package.json', JSON.stringify({ name: 'coverage-fixture', private: true }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', strict: true, esModuleInterop: true, isolatedModules: true } }));
  write('jest.config.cjs', `const preset = require(${JSON.stringify(path.join(here, 'index.cjs'))})\nmodule.exports = preset.starciJestConfig({ coverage: { roots: ['src/modules/*/'], roles: ['service', 'guard'], excludes: ['src/modules/*/persistence/**'] } })\n`);
  fs.mkdirSync(path.join(app, 'apps'), { recursive: true });
  write('src/modules/a/a.guard.ts', 'export class AGuard {\n  pick(flag: boolean): string {\n    if (flag) return "yes"\n    return "no"\n  }\n}\n');
  write('src/modules/a/a.guard.spec.ts', 'import { AGuard } from "./a.guard"\n\ndescribe("AGuard", () => {\n  it("works", () => {\n    expect(new AGuard().pick(false)).toBe("no")\n  })\n})\n');
  write('src/modules/a/persistence/p.service.ts', 'export class PService {\n  unused(): number {\n    return 1\n  }\n}\n');
  const run = () => spawnSync(process.execPath, [jestBin, '--selectProjects', 'unit', '--coverage', '--ci', '--coverageReporters=text-summary'], { cwd: app, encoding: 'utf8', timeout: 300_000 });
  const failed = run();
  assert.notEqual(failed.status, 0, `jest must fail: ${failed.stdout}\n${failed.stderr}`);
  assert.match(`${failed.stdout}\n${failed.stderr}`, /a\.guard\.ts/, 'the failure names the guard');
  assert.doesNotMatch(`${failed.stdout}\n${failed.stderr}`, /p\.service\.ts/, 'the none directory is not measured');
  write('src/modules/a/a.guard.spec.ts', 'import { AGuard } from "./a.guard"\n\ndescribe("AGuard", () => {\n  it("takes both paths", () => {\n    expect(new AGuard().pick(false)).toBe("no")\n    expect(new AGuard().pick(true)).toBe("yes")\n  })\n})\n');
  const passed = run();
  assert.equal(passed.status, 0, `${passed.stdout}\n${passed.stderr}`);
});

/** Decorated imported dependencies retain their metadata while only real source branches affect the per-file gate. */
function decoratedFixture(t, covered) {
  const app = fs.mkdtempSync(path.join(here, '.coverage-fixture-'));
  t.after(() => fs.rmSync(app, { recursive: true, force: true }));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), text); };
  write('package.json', JSON.stringify({ name: 'metadata-fixture', private: true }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', experimentalDecorators: true, emitDecoratorMetadata: true, removeComments: true, isolatedModules: false, sourceMap: false } }));
  write('jest.config.cjs', `module.exports = require(${JSON.stringify(path.join(here, 'index.cjs'))}).starciJestConfig({ coverage: { roots: ['src/modules/*/'], roles: ['service'], excludes: [] } })`);
  fs.mkdirSync(path.join(app, 'apps'), { recursive: true });
  write('src/modules/a/dep.ts', 'export class Dep {}\nexport interface NotClass {}\nexport const NotClass = 42\nexport interface Missing {}\nexport const Missing = undefined\n');
  write('src/modules/a/a.service.ts', `import { Dep as Alias, NotClass, Missing } from "./dep"
import * as deps from "./dep"
const decorated: ClassDecorator = () => {}
@decorated
export class AService {
  constructor(readonly dep: Alias, readonly other: deps.Dep, readonly value: NotClass, readonly missing: Missing, readonly list: ReadonlyArray<Alias>) {}
  pick(flag: boolean): number { return flag ? 1 : 2 }
}
export const tail = (flag: boolean): number => flag ? 3 : 4
export const hooks = [{ run: () => 1 }, { run: () => 2 }]
`);
  write('src/modules/a/a.service.spec.ts', `const captured: unknown[][] = []
Reflect.metadata = (_key: string, value: unknown[]) => { captured.push(value); return () => {} }
const { AService, tail, hooks } = require("./a.service")
const { Dep } = require("./dep")
test("metadata and source branches", () => {
  expect(captured).toEqual([[Dep, Dep, Object, Object, Object]])
  const service = new AService(new Dep(), new Dep(), 42, undefined, [])
  expect(hooks.map(hook => hook.run())).toEqual([1, 2])
  expect(tail(true)).toBe(3)
  expect(tail(false)).toBe(4)
  expect(service.pick(false)).toBe(2)
  ${covered ? 'expect(service.pick(true)).toBe(1)' : ''}
})
`);
  const result = spawnSync(process.execPath, [jestBin, '--selectProjects', 'unit', '--coverage', '--ci', '--runInBand', '--no-cache', '--coverageReporters=json-summary', '--coverageReporters=text-summary', '--coverageReporters=' + path.join(here, 'lcov.cjs')], { cwd: app, encoding: 'utf8', timeout: 120_000 });
  const lcov = fs.readFileSync(path.join(app, 'coverage/lcov.info'), 'utf8');
  assert.doesNotMatch(lcov, /^SF:.*unit-metadata\.generated\.cjs/m, 'the generated anchor is absent');
  for (const record of lcov.split('end_of_record')) {
    const names = [...record.matchAll(/^FN:\d+,(.+)$/gm)].map(match => match[1]);
    assert.equal(new Set(names).size, names.length, 'LCOV function identities are unique');
  }
  return result;
}

test('isolated decorated services preserve metadata and reach every per-file metric at 100', (t) => {
  const result = decoratedFixture(t, true);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Branches\s*:\s*100%/);
});

test('a source ternary on a decorated service still fails per-file branch coverage', (t) => {
  const result = decoratedFixture(t, false);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /a\.service\.ts.*threshold|coverage threshold.*a\.service/is);
});

/** Preserve duplicate rows so comparing reports proves function counts as well as names. */
function lcovRecords(text) {
  return new Map(text.split('end_of_record').filter(record => record.trim()).map(record => {
    const rows = record.trim().split(/\r?\n/);
    return [rows.find(row => row.startsWith('SF:')), rows];
  }));
}

function functionRows(rows, stripIds = false) {
  return rows.filter(row => /^(FN|FNDA):/.test(row)).map(row => stripIds ? row.replace(/#\d+$/, '') : row).sort();
}

/** Report both views of one coverage map, including repeated callbacks and a file with unique function names. */
function reporterFixture(t) {
  const app = fs.mkdtempSync(path.join(here, '.coverage-fixture-'));
  t.after(() => fs.rmSync(app, { recursive: true, force: true }));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), text); };
  write('package.json', JSON.stringify({ name: 'reporter-fixture', private: true }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', isolatedModules: true } }));
  write('jest.config.cjs', `module.exports = require(${JSON.stringify(path.join(here, 'index.cjs'))}).starciJestConfig({ coverage: { roots: ['src/modules/*/'], roles: ['service'], excludes: [] } })\nmodule.exports.coverageReporters = [['lcov', { file: 'stock/lcov.info' }], [${JSON.stringify(path.join(here, 'lcov.cjs'))}, { file: 'custom/lcov.info' }]]\n`);
  fs.mkdirSync(path.join(app, 'apps'), { recursive: true });
  write('src/modules/a/a.service.ts', 'export const hooks = [{ run: (flag: boolean) => flag ? 1 : 2 }, { run: () => 3 }]\n');
  write('src/modules/a/a.service.spec.ts', 'import { hooks } from "./a.service"\ntest("callbacks", () => { expect(hooks[0].run(true)).toBe(1); expect(hooks[0].run(false)).toBe(2); expect(hooks[1].run(false)).toBe(3) })\n');
  write('src/modules/a/unique.service.ts', 'export function unique(flag: boolean): number { return flag ? 1 : 2 }\n');
  write('src/modules/a/unique.service.spec.ts', 'import { unique } from "./unique.service"\ntest("both paths", () => { expect(unique(true)).toBe(1); expect(unique(false)).toBe(2) })\n');
  return app;
}

test('custom LCOV preserves stock records and only suffixes function names with coverage ids', (t) => {
  const app = reporterFixture(t);
  const result = spawnSync(process.execPath, [jestBin, '--selectProjects', 'unit', '--coverage', '--ci', '--runInBand', '--no-cache'], { cwd: app, encoding: 'utf8', timeout: 120_000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const stock = lcovRecords(fs.readFileSync(path.join(app, 'coverage/stock/lcov.info'), 'utf8'));
  const custom = lcovRecords(fs.readFileSync(path.join(app, 'coverage/custom/lcov.info'), 'utf8'));
  assert.equal(stock.size, 2, 'both application files are reported');
  assert.deepEqual([...custom.keys()].sort(), [...stock.keys()].sort(), 'SF lists match');
  for (const records of [stock, custom]) {
    assert.ok([...records.keys()].every(file => !file.includes('unit-metadata.generated.cjs')), 'the generated anchor is absent');
  }
  const metrics = /^(SF|DA|BRDA|BRF|BRH|LF|LH|FNF|FNH):/;
  for (const [file, rows] of stock) {
    const actual = custom.get(file);
    assert.deepEqual(actual.filter(row => metrics.test(row)), rows.filter(row => metrics.test(row)), file);
    assert.ok(functionRows(actual).every(row => /#\d+$/.test(row)), 'every custom function has an id suffix');
    assert.deepEqual(functionRows(actual, true), functionRows(rows), 'FN/FNDA match as multisets after stripping ids');
  }
  const repeated = [...stock.entries()].find(([file]) => /[\\/]a\.service\.ts$/.test(file))[1];
  const repeatedNames = repeated.filter(row => row.startsWith('FN:')).map(row => row.slice(row.indexOf(',') + 1));
  assert.ok(new Set(repeatedNames).size < repeatedNames.length, 'the fixture exercises repeated function names');
  const uniqueFile = [...stock.keys()].find(file => /[\\/]unique\.service\.ts$/.test(file));
  const stockFunctions = stock.get(uniqueFile).filter(row => row.startsWith('FN:')).sort();
  assert.equal(stockFunctions.length, 1, 'the unique-name file has one function');
  assert.deepEqual(functionRows(custom.get(uniqueFile), true).filter(row => row.startsWith('FN:')), stockFunctions, 'unique FN rows equal stock exactly');
});
