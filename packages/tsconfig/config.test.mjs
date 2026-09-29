import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const here = import.meta.dirname;

// Resolve a config exactly as tsc would (extends chain included) and hand back the effective options.
function effective(name) {
  const file = path.join(here, name);
  const read = ts.readConfigFile(file, ts.sys.readFile);
  assert.equal(read.error, undefined, `${name} parses`);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, here, undefined, file);
  assert.deepEqual(parsed.errors.filter((e) => e.code !== 18003), [], `${name} resolves`);
  return parsed.options;
}

for (const name of ['base.json', 'nest.json', 'next.json', 'e2e.json']) {
  test(`${name} is strict, including noImplicitAny`, () => {
    const options = effective(name);
    assert.equal(options.strict, true);
    assert.equal(options.noImplicitAny, true);
    assert.equal(options.strictNullChecks, true);
    assert.equal(options.isolatedModules, true);
  });
}

test('no config carries a path-relative option that would resolve inside node_modules', () => {
  for (const name of ['base.json', 'nest.json', 'next.json', 'e2e.json']) {
    const raw = JSON.parse(fs.readFileSync(path.join(here, name), 'utf8'));
    const options = raw.compilerOptions ?? {};
    for (const key of ['outDir', 'rootDir', 'baseUrl', 'paths', 'tsBuildInfoFile']) {
      assert.equal(key in options, false, `${name} must not set ${key}; the repo tsconfig owns it`);
    }
    assert.equal('include' in raw || 'exclude' in raw || 'files' in raw, false, `${name} must not set include/exclude`);
  }
});

test('nest is the nodenext decorator profile, next is the bundler jsx profile', () => {
  const nest = effective('nest.json');
  assert.equal(nest.experimentalDecorators, true);
  assert.equal(nest.emitDecoratorMetadata, true);
  assert.equal(ts.ModuleKind[nest.module], 'NodeNext');
  const next = effective('next.json');
  assert.equal(ts.ModuleResolutionKind[next.moduleResolution], 'Bundler');
  assert.equal(next.noEmit, true);
  assert.equal(ts.JsxEmit[next.jsx], 'ReactJSX');
});

test('e2e overlays a repo config: it can be the second entry of an extends array and keeps strict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-tsconfig-'));
  try {
    const repo = { extends: path.join(here, 'nest.json').split(path.sep).join('/'), compilerOptions: { outDir: './dist' } };
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(repo));
    const e2e = { extends: ['./tsconfig.json', path.join(here, 'e2e.json').split(path.sep).join('/')], include: ['e2e/**/*.ts'] };
    fs.writeFileSync(path.join(dir, 'tsconfig.e2e.json'), JSON.stringify(e2e));
    const file = path.join(dir, 'tsconfig.e2e.json');
    const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(file, ts.sys.readFile).config, ts.sys, dir, undefined, file);
    assert.equal(parsed.options.noEmit, true);
    assert.equal(parsed.options.incremental, false);
    assert.equal(parsed.options.strict, true);
    assert.equal(parsed.options.experimentalDecorators, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an implicit any fails to compile under every profile', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-tsconfig-any-'));
  try {
    const source = path.join(dir, 'probe.ts');
    fs.writeFileSync(source, 'export function probe(value) { return value }\n');
    for (const name of ['nest.json', 'next.json', 'e2e.json']) {
      const options = { ...effective(name), noEmit: true, incremental: false, plugins: undefined };
      const program = ts.createProgram([source], options);
      const codes = ts.getPreEmitDiagnostics(program).map((d) => d.code);
      assert.ok(codes.includes(7006), `${name}: expected TS7006, got ${codes.join(',')}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
