import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const here = import.meta.dirname;
const PRESETS = ['base.json', 'be.json', 'build.json', 'next.json', 'e2e.json'];

// Resolve a config exactly as tsc would (extends chain included) and hand back the effective options.
function effective(name) {
  const file = path.join(here, name);
  const read = ts.readConfigFile(file, ts.sys.readFile);
  assert.equal(read.error, undefined, `${name} parses`);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, here, undefined, file);
  assert.deepEqual(parsed.errors.filter((e) => e.code !== 18003), [], `${name} resolves`);
  return parsed.options;
}

for (const name of PRESETS) {
  test(`${name} is strict, including noImplicitAny`, () => {
    const options = effective(name);
    assert.equal(options.strict, true);
    assert.equal(options.noImplicitAny, true);
    assert.equal(options.strictNullChecks, true);
    assert.equal(options.isolatedModules, true);
  });
}

test('no config carries a path-relative option that would resolve inside node_modules', () => {
  for (const name of PRESETS) {
    const raw = JSON.parse(fs.readFileSync(path.join(here, name), 'utf8'));
    const options = raw.compilerOptions ?? {};
    for (const key of ['outDir', 'rootDir', 'baseUrl', 'paths', 'tsBuildInfoFile']) {
      assert.equal(key in options, false, `${name} must not set ${key}; the repo tsconfig owns it`);
    }
    assert.equal('include' in raw || 'exclude' in raw || 'files' in raw, false, `${name} must not set include/exclude`);
  }
});

test('nest.json is gone: be.json is the one back-end preset, and the package exports exactly the files it ships', () => {
  assert.equal(fs.existsSync(path.join(here, 'nest.json')), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.exports).sort(), PRESETS.map((name) => `./${name}`).sort());
  for (const target of Object.values(manifest.exports)) assert.ok(fs.existsSync(path.join(here, target)), target);
});

test('be.json carries every flag of the locked back-end contract, none of them lowered', () => {
  const be = effective('be.json');
  for (const flag of ['strict', 'noImplicitAny', 'strictNullChecks', 'noUncheckedIndexedAccess', 'noImplicitOverride', 'noImplicitReturns', 'noFallthroughCasesInSwitch', 'noUnusedLocals', 'noUnusedParameters', 'isolatedModules', 'experimentalDecorators', 'emitDecoratorMetadata', 'importHelpers']) {
    assert.equal(be[flag], true, flag);
  }
  assert.equal(be.allowJs, false);
  assert.equal(be.noEmit, true, 'a plain `tsc -p tsconfig.json` never emits');
  assert.equal(ts.ModuleKind[be.module], 'NodeNext');
  assert.equal(ts.ModuleResolutionKind[be.moduleResolution], 'NodeNext');
});

test('build.json only turns emit on; next is the bundler jsx profile', () => {
  const build = effective('build.json');
  assert.equal(build.noEmit, false);
  assert.equal(build.strict, true);
  assert.equal(build.noUncheckedIndexedAccess, true);
  const next = effective('next.json');
  assert.equal(ts.ModuleResolutionKind[next.moduleResolution], 'Bundler');
  assert.equal(next.noEmit, true);
  assert.equal(ts.JsxEmit[next.jsx], 'ReactJSX');
});

test('the managed repository configs resolve through the presets: paths only in tsconfig.json, overlays after it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-tsconfig-'));
  try {
    const posix = (name) => path.join(here, name).split(path.sep).join('/');
    const paths = { '@features/*': ['./src/features/*'], '@modules/*': ['./src/modules/*'], '@tests/*': ['./src/tests/*'] };
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ extends: posix('be.json'), compilerOptions: { paths } }));
    fs.writeFileSync(path.join(dir, 'tsconfig.build.json'), JSON.stringify({ extends: ['./tsconfig.json', posix('build.json')], compilerOptions: { outDir: './dist' }, exclude: ['dist', '**/*.spec.ts'] }));
    fs.writeFileSync(path.join(dir, 'tsconfig.e2e.json'), JSON.stringify({ extends: ['./tsconfig.json', posix('e2e.json')], include: ['e2e/**/*.ts'] }));
    const parse = (name) => {
      const file = path.join(dir, name);
      return ts.parseJsonConfigFileContent(ts.readConfigFile(file, ts.sys.readFile).config, ts.sys, dir, undefined, file).options;
    };
    const repo = parse('tsconfig.json');
    assert.deepEqual(Object.keys(repo.paths).sort(), Object.keys(paths).sort());
    assert.equal(repo.noEmit, true);
    const build = parse('tsconfig.build.json');
    assert.equal(build.noEmit, false);
    assert.equal(build.experimentalDecorators, true);
    assert.equal(path.basename(build.outDir), 'dist');
    const e2e = parse('tsconfig.e2e.json');
    assert.equal(e2e.noEmit, true);
    assert.equal(e2e.incremental, false);
    assert.equal(e2e.strict, true);
    assert.equal(e2e.experimentalDecorators, true);
    assert.equal(e2e.noUncheckedIndexedAccess, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an implicit any, an unchecked index and an unused local each fail to compile under be.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-tsconfig-any-'));
  try {
    const cases = [
      ['implicit-any.ts', 'export function probe(value) { return value }\n', 7006],
      ['indexed.ts', 'export const first = (items: string[]): string => items[0]\n', 2322],
      ['unused.ts', 'export function probe(): number { const unused = 1; return 2 }\n', 6133],
      ['returns.ts', 'export function probe(flag: boolean): number | undefined { if (flag) { return 1 } }\n', 7030],
    ];
    for (const name of ['be.json', 'next.json']) {
      for (const [file, text, code] of cases.slice(0, name === 'be.json' ? cases.length : 1)) {
        const source = path.join(dir, file);
        fs.writeFileSync(source, text);
        const options = { ...effective(name), noEmit: true, incremental: false, plugins: undefined };
        const codes = ts.getPreEmitDiagnostics(ts.createProgram([source], options)).map((d) => d.code);
        assert.ok(codes.includes(code), `${name} ${file}: expected TS${code}, got ${codes.join(',')}`);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
