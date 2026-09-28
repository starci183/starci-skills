import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { checkArchitecture } from '../scripts/checks/architecture/index.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');

test('scoped architecture matches full findings while building only selected projects and dependencies', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-paths-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (relative, content) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  put('package.json', JSON.stringify({ private: true }));
  put('architecture.json', JSON.stringify({ schema: 'starci/architecture-config@1', kinds: ['backend'], projects: ['apps/a/tsconfig.json', 'apps/b/tsconfig.json'] }));
  for (const app of ['a', 'b']) put(`apps/${app}/tsconfig.json`, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', noEmit: true }, include: ['src/**/*.ts'] }));
  put('apps/a/src/modules/order.ts', 'import { feature } from "../features/feature"; export const order = feature;\n');
  put('apps/a/src/features/feature.ts', 'export const feature = 1;\n');
  put('apps/b/src/modules/other.ts', 'import { feature } from "../features/feature"; export const other = feature;\n');
  put('apps/b/src/features/feature.ts', 'export const feature = 2;\n');
  const args = { repositoryRoot: root, configFile: 'architecture.json', injectedTypeScript: ts };
  const full = checkArchitecture(args);
  const scoped = checkArchitecture({ ...args, paths: ['apps/a/src/modules/order.ts'] });
  const selected = items => items.filter(item => item.path === 'apps/a/src/modules/order.ts');
  assert.ok(selected(full.violations).length > 0, 'fixture produces an architecture finding');
  assert.deepEqual(scoped.violations, selected(full.violations));
  assert.deepEqual(scoped.errors, selected(full.errors));
  assert.deepEqual(scoped.compiler.projects, ['apps/a/tsconfig.json']);
  assert.deepEqual(scoped.coverage.sourceFiles, ['apps/a/src/features/feature.ts', 'apps/a/src/modules/order.ts']);
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, 'node_modules/typescript'), 'junction');
  const cli = path.resolve(import.meta.dirname, '../scripts/checks/canon-scan.mjs');
  const run = paths => {
    const args = [cli, '--root', root, '--profile', 'nest', '--machines', 'architecture', '--json', ...(paths ? ['--paths', paths] : [])];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const fullScan = run();
  const scopedScan = run('apps/a/src/modules/order.ts');
  assert.deepEqual(scopedScan.findings, fullScan.findings.filter(item => item.file === 'apps/a/src/modules/order.ts'));
  assert.equal(scopedScan.machines.architecture.files, 2);
});

test('scoped architecture includes referenced TypeScript projects but skips unrelated projects', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-references-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (relative, value) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  put('package.json', { private: true });
  put('architecture.json', { schema: 'starci/architecture-config@1', kinds: ['backend'], projects: ['apps/a/tsconfig.json', 'apps/b/tsconfig.json'] });
  put('apps/a/tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', noEmit: true }, include: ['src/**/*.ts'], references: [{ path: '../../packages/shared' }] });
  put('apps/b/tsconfig.json', { compilerOptions: { target: 'ES2022', noEmit: true }, include: ['src/**/*.ts'] });
  put('packages/shared/tsconfig.json', { compilerOptions: { target: 'ES2022', composite: true }, include: ['src/**/*.ts'] });
  put('apps/a/src/main.ts', 'export const main = 1;');
  put('apps/b/src/main.ts', 'export const other = 2;');
  put('packages/shared/src/value.ts', 'export const value = 3;');
  const result = checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json', injectedTypeScript: ts, paths: ['apps/a/src/main.ts'] });
  assert.deepEqual(result.compiler.projects, ['apps/a/tsconfig.json', 'packages/shared/tsconfig.json']);
  assert.ok(result.coverage.sourceFiles.includes('packages/shared/src/value.ts'));
  assert.ok(!result.coverage.sourceFiles.includes('apps/b/src/main.ts'));
});

test('a selected project with a missing tsconfig still fails closed', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-config-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (relative, text) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  put('package.json', '{"private":true}');
  put('architecture.json', JSON.stringify({ schema: 'starci/architecture-config@1', kinds: ['backend'], projects: ['apps/a/tsconfig.json'] }));
  put('apps/a/src/main.ts', 'export const main = 1;');
  const result = checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json', injectedTypeScript: ts, paths: ['apps/a/src/main.ts'] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.ruleId === 'ARCH_TSCONFIG_MISSING'), JSON.stringify(result));
});
