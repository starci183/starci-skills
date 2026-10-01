// The per-service coverage law, proven by running jest itself: every `*.service.ts` must reach 100 on lines, branches,
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
  write('jest.config.cjs', `const preset = require(${JSON.stringify(path.join(here, 'index.cjs'))})\nmodule.exports = preset.starciJestConfig()\n`);
  fs.mkdirSync(path.join(app, 'apps'), { recursive: true });
  // A large service, fully covered, and a small one: together the average is far above 99.
  write('src/big.service.ts', service('BigService', 40, false));
  write('src/big.service.spec.ts', spec('BigService', 'big.service', 40, false));
  write('src/small.service.ts', service('SmallService', 1, missBranch));
  write('src/small.service.spec.ts', spec('SmallService', 'small.service', 1, missBranch));
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
