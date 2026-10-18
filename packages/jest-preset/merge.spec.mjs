// The sharded unit run of the managed CI: each shard (STARCI_COVERAGE_SHARD=1, --shard=i/N) measures only the files its tests load and writes istanbul
// JSON, and merge.cjs joins the shards by source location into the lcov an unsharded run writes. Proven with real jest runs: per file, the merged lines,
// functions and branches equal the unsharded run's, a file loaded by another shard's spec without its own spec merges cleanly, and a file no shard loads is
// absent from the merge (the coverage proof then refuses it).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const preset = require('./index.cjs');
const { mergeCoverage } = require('./merge.cjs');
const SCOPE = { coverage: { roots: ['src/modules/domain/*/'], roles: ['service'], excludes: [] } };

const SOURCES = {
  'src/modules/domain/alpha/alpha.service.ts': 'export class AlphaService {\n  pick(value: number): string {\n    if (value > 0) return "positive";\n    return value < 0 ? "negative" : "zero";\n  }\n  constant(): number {\n    return 1;\n  }\n}\n',
  'src/modules/domain/alpha/alpha.service.spec.ts': 'import { AlphaService } from "./alpha.service";\ntest("pick", () => {\n  const alpha = new AlphaService();\n  expect([alpha.pick(1), alpha.pick(-1), alpha.pick(0), alpha.constant()]).toEqual(["positive", "negative", "zero", 1]);\n});\n',
  'src/modules/domain/beta/beta.service.ts': 'import { AlphaService } from "../alpha/alpha.service";\nexport class BetaService {\n  private readonly alpha = new AlphaService();\n  run(flag: boolean): string {\n    return flag ? this.alpha.pick(1) : "off";\n  }\n}\n',
  'src/modules/domain/beta/beta.service.spec.ts': 'import { BetaService } from "./beta.service";\ntest("run", () => {\n  const beta = new BetaService();\n  expect([beta.run(true), beta.run(false)]).toEqual(["positive", "off"]);\n});\n',
  'src/modules/domain/gamma/gamma.service.ts': 'export class GammaService {\n  id(): string {\n    return "gamma";\n  }\n}\n',
  'src/modules/domain/gamma/gamma.service.spec.ts': 'import { GammaService } from "./gamma.service";\ntest("id", () => expect(new GammaService().id()).toBe("gamma"));\n',
  'src/modules/domain/delta/delta.service.ts': 'export class DeltaService {\n  never(): number {\n    return 0;\n  }\n}\n',
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-merge-'));
  const be = path.join(root, 'be');
  for (const [file, source] of Object.entries({ ...SOURCES, 'apps/.keep': '', 'src/tests/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'commonjs', target: 'es2022', isolatedModules: true } }) })) {
    fs.mkdirSync(path.dirname(path.join(be, file)), { recursive: true });
    fs.writeFileSync(path.join(be, file), source);
  }
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ edition: 'lite' }));
  fs.writeFileSync(path.join(be, 'jest.config.js'), `const config = require(${JSON.stringify(require.resolve('./index.cjs'))}).starciJestConfig(${JSON.stringify(SCOPE)})
for (const project of config.projects) {
  delete project.preset
  for (const entry of Object.values(project.transform)) entry[0] = require.resolve(entry[0])
}
module.exports = config
`);
  return { root, be };
}

function jest(be, args, env = {}) {
  const jestPackage = require.resolve('jest/package.json');
  const result = spawnSync(process.execPath, [path.join(path.dirname(jestPackage), 'bin', 'jest.js'), '--selectProjects', 'unit', '--coverage', '--ci', '--runInBand', '--cacheDirectory', path.join(be, '.jest-cache'), ...args], {
    cwd: be, encoding: 'utf8', env: { ...process.env, NODE_PATH: path.dirname(path.dirname(jestPackage)), ...env }, timeout: 180_000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

/** Per source file (relative to be/): the lcov totals {LF, LH, FNF, FNH, BRF, BRH}. */
function totals(lcov, be) {
  const out = {};
  let current = null;
  for (const line of fs.readFileSync(lcov, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      const source = line.slice(3);
      current = path.relative(be, path.resolve(be, source)).split(path.sep).join('/');
      out[current] = {};
    } else if (current && /^(LF|LH|FNF|FNH|BRF|BRH):/.test(line)) {
      const [tag, value] = line.split(':');
      out[current][tag] = Number(value);
    }
  }
  return out;
}

test('a shard measures only what it loads, writes istanbul JSON and keeps no threshold', () => {
  const previous = process.cwd();
  const { root, be } = fixture();
  try {
    process.chdir(be);
    process.env.STARCI_COVERAGE_SHARD = '1';
    const shard = preset.starciJestConfig(SCOPE);
    delete process.env.STARCI_COVERAGE_SHARD;
    const whole = preset.starciJestConfig(SCOPE);
    assert.equal(shard.collectCoverageFrom, undefined);
    assert.equal(shard.coverageThreshold, undefined);
    assert.deepEqual(shard.coverageReporters, ['text-summary', 'json']);
    assert.ok(whole.collectCoverageFrom.length > 0 && Object.keys(whole.coverageThreshold).length > 0);
  } finally {
    delete process.env.STARCI_COVERAGE_SHARD;
    process.chdir(previous);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the merged shards equal the unsharded run per file; a file no shard loads is absent', () => {
  const { root, be } = fixture();
  try {
    jest(be, ['--coverageThreshold={}', '--coverageDirectory', path.join(be, 'coverage', 'whole')]);
    for (const shard of [1, 2, 3]) jest(be, [`--shard=${shard}/3`, '--passWithNoTests', '--coverageDirectory', path.join(be, 'coverage', 'shards', `shard-${shard}`)], { STARCI_COVERAGE_SHARD: '1' });
    const previous = process.cwd();
    process.chdir(be);
    let merged;
    try { merged = mergeCoverage({ inputs: [path.join(be, 'coverage', 'shards')], outDir: path.join(be, 'coverage', 'merged') }); } finally { process.chdir(previous); }
    assert.equal(merged.reports, 3);
    const whole = totals(path.join(be, 'coverage', 'whole', 'lcov.info'), be);
    const joined = totals(path.join(be, 'coverage', 'merged', 'lcov.info'), be);
    for (const file of ['alpha', 'beta', 'gamma'].map((name) => `src/modules/domain/${name}/${name}.service.ts`)) {
      assert.deepEqual(joined[file], whole[file], `${file}: merged ${JSON.stringify(joined[file])} vs unsharded ${JSON.stringify(whole[file])}`);
      assert.equal(joined[file].FNH, joined[file].FNF, `${file} functions are all covered`);
    }
    assert.equal(joined['src/modules/domain/delta/delta.service.ts'], undefined, 'a file no shard loads is not in the merge');
    assert.ok(whole['src/modules/domain/delta/delta.service.ts'], 'the unsharded run lists it from collectCoverageFrom');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
