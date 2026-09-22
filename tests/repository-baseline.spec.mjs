import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = rel => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const BASELINE = 'knowledge/repository-baseline.yaml';

test('the repository baseline is one registered knowledge source with nest and next profiles', () => {
  const index = read('knowledge/index.yaml');
  assert.ok(index.branches.some(b => b.id === 'repository-baseline' && b.path === 'repository-baseline.yaml'));
  const doc = read(BASELINE);
  assert.equal(doc.schema, 'starci/knowledge-source@1');
  assert.equal(doc.id, 'repository-baseline');
  const shapes = Object.fromEntries(doc.shapes.map(s => [s.id, s]));
  assert.deepEqual(Object.keys(shapes).sort(), ['common', 'nest', 'next']);
  assert.equal(shapes.nest.eslintKit, '@starci/eslint-canon-be');
  assert.equal(shapes.next.eslintKit, '@starci/eslint-canon-fe');
  assert.equal(shapes.nest.testRunner, 'jest');
  assert.equal(shapes.next.testRunner, 'vitest');
  assert.equal(shapes.common.typescript.strict, true);
  assert.deepEqual(shapes.common.ci.gates, ['lint', 'typecheck', 'test', 'build']);
  const ciRuns = shapes.common.ci.steps.filter(s => s.name).map(s => s.name);
  assert.deepEqual(ciRuns, shapes.common.ci.gates, 'every CI gate is a named step');
  for (const entry of ['.starciwork/runtime.sqlite*', 'config.yaml', '.env.*', '!.env.example']) {
    assert.ok(shapes.common.gitignore.includes(entry), `gitignore carries ${entry}`);
  }
  assert.ok(shapes.common.gitattributes.includes('* text=auto eol=lf'));
  assert.equal(shapes.common.editorconfig.end_of_line, 'lf');
  assert.ok(doc.provenance.observedReference.some(r => r.repository === 'nivo-backend'));
  assert.ok(doc.provenance.observedReference.some(r => r.repository === 'nivo-fe'));
});

test('baseline numbers live once: every <key.path> placeholder resolves inside the common shape or names a parameter', () => {
  const text = fs.readFileSync(path.join(ROOT, BASELINE), 'utf8');
  const doc = read(BASELINE);
  const common = doc.shapes.find(s => s.id === 'common');
  const placeholders = new Set([...text.matchAll(/<([a-zA-Z][\w.]*)>/g)].map(m => m[1]));
  assert.ok(placeholders.size > 0);
  for (const key of placeholders) {
    if (Object.hasOwn(doc.parameters, key)) continue;
    const value = key.split('.').reduce((node, part) => node?.[part], common);
    assert.ok(value !== undefined && typeof value !== 'object', `<${key}> resolves to a scalar in shapes.common or a declared parameter`);
  }
  for (const key of Object.keys(doc.parameters)) assert.ok(placeholders.has(key), `parameter <${key}> is used`);
  assert.doesNotMatch(text, /--max-warnings=\d/, 'the warning budget is data, not a restated literal');
});

const SCAFFOLD_KEYS = {
  common: {
    scripts: ['lint', 'lint:check', 'typecheck', 'prepare'],
    devDependencies: ['typescript', '@types/node', 'eslint', '@eslint/js', 'typescript-eslint', 'globals', 'husky', 'lint-staged'],
  },
  nest: {
    scripts: ['build', 'start', 'start:dev', 'test', 'test:unit', 'test:ci', 'test:affected'],
    dependencies: ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs'],
    devDependencies: ['@nestjs/cli', '@nestjs/schematics', '@nestjs/testing', 'jest', 'ts-jest', '@types/jest', 'supertest', '@types/supertest'],
    files: ['tsconfig.json', 'tsconfig.build.json', 'nest-cli.json', 'jest.config.js', 'eslint.config.mjs'],
    compilerOptions: ['module', 'moduleResolution', 'target', 'experimentalDecorators', 'emitDecoratorMetadata', 'outDir', 'strict'],
  },
  next: {
    scripts: ['build', 'dev', 'start', 'test', 'test:unit', 'test:ci', 'test:affected'],
    dependencies: ['next', 'react', 'react-dom', '@starci/grammar'],
    devDependencies: ['@types/react', '@types/react-dom', 'tailwindcss', '@tailwindcss/postcss', 'vitest', '@vitest/coverage-v8', 'jsdom', '@testing-library/react', '@testing-library/jest-dom'],
    files: ['tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'vitest.config.ts', 'vitest.setup.ts', 'eslint.config.mjs', 'src/app/globals.css'],
    compilerOptions: ['module', 'moduleResolution', 'target', 'jsx', 'strict'],
  },
};
const MANIFEST_SOURCES = ['name', 'version', 'private', 'packageManager', 'engines', 'scripts', 'lint-staged', 'dependencies', 'devDependencies'];

for (const profile of ['nest', 'next']) {
  test(`the ${profile} shape carries every key a scaffold needs to install, build, lint, typecheck and test`, () => {
    const shapes = Object.fromEntries(read(BASELINE).shapes.map(s => [s.id, s]));
    const { common } = shapes;
    const shape = shapes[profile];
    const want = SCAFFOLD_KEYS[profile];
    for (const key of ['packageManager', 'nodeMajor', 'lockfile', 'install']) assert.ok(common[key], `common.${key}`);
    assert.ok(common.engines.node, 'common.engines.node');
    for (const key of common.manifest.order) assert.ok(MANIFEST_SOURCES.includes(key), `manifest key ${key} has a source`);
    for (const key of ['name', 'version', 'private', 'lint-staged']) assert.notEqual(common.manifest[key], undefined, `common.manifest.${key}`);
    assert.deepEqual(Object.keys(common.hooks.files).sort(), ['.husky/pre-commit', '.husky/pre-push']);
    const merged = {
      scripts: { ...common.scripts, ...shape.scripts },
      dependencies: { ...shape.dependencies },
      devDependencies: { ...common.devDependencies, ...shape.devDependencies },
    };
    const required = {
      scripts: [...SCAFFOLD_KEYS.common.scripts, ...want.scripts],
      dependencies: want.dependencies,
      devDependencies: [...SCAFFOLD_KEYS.common.devDependencies, ...want.devDependencies, shape.eslintKit, ...shape.testDependencies],
    };
    for (const [section, names] of Object.entries(required)) {
      for (const name of names) assert.ok(typeof merged[section][name] === 'string' && merged[section][name], `${profile} ${section} carries ${name}`);
    }
    const pinned = [...Object.keys(common.devDependencies), ...Object.keys(shape.dependencies), ...Object.keys(shape.devDependencies)];
    assert.equal(new Set(pinned).size, pinned.length, 'each package is pinned once');
    const fill = text => text.replace(/<([a-zA-Z][\w.]*)>/g, 'x');
    for (const file of want.files) assert.equal(typeof shape.files[file], 'string', `${profile} files carries ${file}`);
    for (const [file, content] of Object.entries(shape.files)) {
      if (file.endsWith('.json')) assert.doesNotThrow(() => JSON.parse(fill(content)), `${file} is JSON`);
    }
    const { compilerOptions } = JSON.parse(fill(shape.files['tsconfig.json']));
    for (const key of want.compilerOptions) assert.notEqual(compilerOptions[key], undefined, `${profile} tsconfig sets ${key}`);
    assert.equal(compilerOptions.strict, common.typescript.strict, 'the baseline stays strict');
  });
}

for (const [op, profile] of [['backend.scaffold', 'nest'], ['interface.scaffold', 'next']]) {
  test(`${op} takes its toolchain from the baseline and needs a settled SDS only beyond it`, () => {
    const manifest = read(`modules/ops/ops/${op}.yaml`);
    const baseline = manifest.reads.find(r => r.id === 'baseline');
    assert.ok(baseline, 'baseline read declared');
    assert.match(baseline.path, /knowledge\/repository-baseline\.yaml/);
    assert.match(baseline.path, new RegExp(`\\b${profile}\\b`));
    assert.match(baseline.path, /CONTEXT\.md/);
    const citing = manifest.steps.filter(s => /knowledge\/repository-baseline\.yaml/.test(s.action.en));
    assert.equal(citing.length, 1, 'exactly one step writes the toolchain from the baseline');
    assert.ok(citing[0].reads.includes('baseline'));
    const proof = manifest.proofs.find(p => p.id === 'baseline-runs');
    assert.ok(proof, 'baseline-runs proof declared');
    assert.match(proof.requirement.en, /lint-staged/);
    assert.match(proof.requirement.en, /ci\.yml/);
    for (const pre of manifest.route.prerequisites) {
      assert.doesNotMatch(pre, /^architecture\.decide\b/, 'a baseline-only scaffold does not chain architecture.decide');
    }
    assert.ok(manifest.blockers.some(b => b.code === 'SDS_MISSING'), 'SDS-owned wiring without a settled SDS still blocks');
  });
}
