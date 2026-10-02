import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { checkArchitecture } from '../../scripts/hfs/architecture/index.mjs';
import { appDeclaration, appDeclarationText } from '../helpers/hfs-arch-fixture.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');

test('scoped architecture matches full findings while building only selected projects and dependencies', t => {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-paths-')), 'be');
  t.after(() => fs.rmSync(path.dirname(root), { recursive: true, force: true }));
  const put = (relative, content) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  // TypeScript projects are derived: the side's tsconfig.json (src/**) and the tsconfig of every app (apps/b) and workspace package.
  const compilerOptions = { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', noEmit: true };
  put('../package.json', JSON.stringify({ private: true }));
  put('../hfs.json', appDeclarationText('be', { apps: [{ name: 'b', kind: 'api' }] }));
  put('tsconfig.json', JSON.stringify({ compilerOptions, include: ['src/**/*.ts'] }));
  put('apps/b/tsconfig.json', JSON.stringify({ compilerOptions, include: ['src/**/*.ts'] }));
  put('src/modules/domain/order/index.ts', 'import { feature } from "../../../features/api/thing"; export const order = feature;\n');
  put('src/features/api/thing/index.ts', 'export const feature = 1;\n');
  put('apps/b/src/main.ts', 'export const other = 2;\n');
  const args = { repositoryRoot: root, injectedTypeScript: ts };
  const orderFile = 'src/modules/domain/order/index.ts';
  const full = checkArchitecture(args);
  const scoped = checkArchitecture({ ...args, paths: [orderFile] });
  const selected = items => items.filter(item => item.path === orderFile);
  assert.ok(selected(full.violations).length > 0, 'fixture produces an architecture finding');
  assert.deepEqual(scoped.violations, selected(full.violations));
  assert.deepEqual(scoped.errors, selected(full.errors));
  assert.deepEqual(scoped.compiler.projects, ['tsconfig.json']);
  assert.deepEqual(scoped.coverage.sourceFiles, ['src/features/api/thing/index.ts', orderFile]);
  fs.mkdirSync(path.join(root, '..', 'node_modules'), { recursive: true });
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(root, '..', 'node_modules/typescript'), 'junction');
  const cli = path.resolve(import.meta.dirname, '..', '..', 'scripts', 'gates', 'canon-scan.mjs');
  const run = paths => {
    const args = [cli, '--root', root, '--stack-kind', 'nest', '--machines', 'architecture', '--json', ...(paths ? ['--paths', paths] : [])];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const fullScan = run();
  const scopedScan = run(orderFile);
  assert.deepEqual(scopedScan.findings, fullScan.findings.filter(item => item.file === orderFile));
  assert.equal(scopedScan.machines.architecture.files, 2);
});

test('scoped architecture includes referenced TypeScript projects but skips unrelated projects', t => {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-references-')), 'be');
  t.after(() => fs.rmSync(path.dirname(root), { recursive: true, force: true }));
  const put = (relative, value) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  // Every app and workspace tsconfig is a derived project; apps/a additionally references packages/shared.
  put('../package.json', { private: true, workspaces: ['be/packages/*'] });
  put('../hfs.json', appDeclaration('be', { apps: [{ name: 'a', kind: 'api' }, { name: 'b', kind: 'api' }] }));
  put('packages/shared/package.json', { name: '@fixture/shared', private: true });
  put('apps/a/tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', noEmit: true }, include: ['src/**/*.ts'], references: [{ path: '../../packages/shared' }] });
  put('apps/b/tsconfig.json', { compilerOptions: { target: 'ES2022', noEmit: true }, include: ['src/**/*.ts'] });
  put('packages/shared/tsconfig.json', { compilerOptions: { target: 'ES2022', composite: true }, include: ['src/**/*.ts'] });
  put('apps/a/src/main.ts', 'export const main = 1;');
  put('apps/b/src/main.ts', 'export const other = 2;');
  put('packages/shared/src/value.ts', 'export const value = 3;');
  const result = checkArchitecture({ repositoryRoot: root, injectedTypeScript: ts, paths: ['apps/a/src/main.ts'] });
  assert.deepEqual(result.compiler.projects, ['apps/a/tsconfig.json', 'packages/shared/tsconfig.json']);
  assert.ok(result.coverage.sourceFiles.includes('packages/shared/src/value.ts'));
  assert.ok(!result.coverage.sourceFiles.includes('apps/b/src/main.ts'));
});

test('a selected project with a missing tsconfig still fails closed', t => {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-config-')), 'be');
  t.after(() => fs.rmSync(path.dirname(root), { recursive: true, force: true }));
  const put = (relative, text) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  // A project list can no longer be authored, so the missing tsconfig is a project reference of the root tsconfig.
  put('../package.json', '{"private":true}');
  put('../hfs.json', appDeclarationText('be', { apps: [{ name: 'a', kind: 'api' }] }));
  put('tsconfig.json', JSON.stringify({ files: [], references: [{ path: 'apps/a/tsconfig.json' }] }));
  put('apps/a/src/main.ts', 'export const main = 1;');
  const result = checkArchitecture({ repositoryRoot: root, injectedTypeScript: ts, paths: ['apps/a/src/main.ts'] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.ruleId === 'ARCH_TSCONFIG_MISSING'), JSON.stringify(result));
});
