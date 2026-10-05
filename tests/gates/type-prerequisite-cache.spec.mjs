// A successful prerequisite cache may skip only while its real source and output bytes remain current.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { runGate } from '../../scripts/gates/gate.mjs';
import { installBoundLintCanons, lintFixtureDeclaration } from '../helpers/lint-canon-fixture.mjs';

const ts = createRequire(new URL('../../package.json', import.meta.url))('typescript');
const put = (root, rel, text) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

test('real npm prerequisite commands rerun for M-to-M source, deleted inputs and changed dist bytes', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-type-prereq-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const git = (...args) => { const run = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }); assert.equal(run.status, 0, run.stderr); return run.stdout.trim(); };
  put(root, '.gitignore', 'node_modules/\npackages/public/dist/\nbe/src/generated.d.ts\n');
  put(root, 'hfs.json', JSON.stringify(lintFixtureDeclaration('prereq-app')) + '\n');
  put(root, 'package.json', JSON.stringify({ name: 'prereq-app', private: true, workspaces: ['be', 'packages/*'], scripts: { codegen: 'node scripts/prerequisites.cjs codegen' } }));
  put(root, 'be/package.json', '{"name":"prereq-be","private":true}\n');
  put(root, 'fe/package.json', '{"name":"prereq-fe","private":true}\n');
  put(root, 'be/tsconfig.json', JSON.stringify({ compilerOptions: { noEmit: true, noLib: true, types: [], strict: true }, include: ['src'] }));
  put(root, 'be/src/globals.d.ts', 'interface Array<T> {}\ninterface Boolean {}\ninterface CallableFunction {}\ninterface Function {}\ninterface IArguments {}\ninterface NewableFunction {}\ninterface Number {}\ninterface Object {}\ninterface RegExp {}\ninterface String {}\n');
  put(root, 'be/src/a.ts', 'export const a: number = 1;\n');
  put(root, 'be/contracts/schema.txt', 'initial contract\n');
  put(root, 'packages/public/package.json', JSON.stringify({ name: '@fixture/public', private: true, types: 'dist/index.d.ts', scripts: { build: 'node ../../scripts/prerequisites.cjs build' } }));
  put(root, 'scripts/prerequisites.cjs', `const fs = require('node:fs');
const path = require('node:path');
const root = path.dirname(__dirname), mode = process.argv[2];
fs.appendFileSync(path.join(root, 'node_modules/prereq-calls.log'), mode + '\\n');
if (mode === 'codegen') fs.writeFileSync(path.join(root, 'be/src/generated.d.ts'), 'export declare const generated: number;\\n');
else { fs.mkdirSync(path.join(process.cwd(), 'dist'), { recursive: true }); fs.writeFileSync(path.join(process.cwd(), 'dist/index.d.ts'), 'export declare const built: number;\\n'); }
`);
  // Only lint is held at its existing tool edge. The gate, target TypeScript and npm commands are real.
  put(root, 'node_modules/hfs-prereq-fixture.mjs', 'console.log(JSON.stringify({ schema: "starci/lint@1", findings: [], errors: [] }));\n');
  installBoundLintCanons(root);
  git('init', '-q', '-b', 'main'); git('config', 'user.name', 'spec'); git('config', 'user.email', 'spec@starci.test'); git('config', 'commit.gpgsign', 'false');
  git('add', '-A'); git('commit', '-qm', 'prerequisite fixture');
  const base = git('rev-parse', 'HEAD'), hfs = { dir: root, bin: path.join(root, 'node_modules/hfs-prereq-fixture.mjs') };
  const calls = () => fs.readFileSync(path.join(root, 'node_modules/prereq-calls.log'), 'utf8').trim().split(/\r?\n/);
  const measure = async () => { const result = await runGate({ root, base, changed: ['be/src/a.ts'], hfs, ts }); assert.equal(result.exit, 0, JSON.stringify(result)); return result; };
  put(root, 'be/src/a.ts', 'export const a: number = 2;\n');
  const dirty = git('status', '--porcelain', '--', 'be/src/a.ts');
  await measure(); assert.deepEqual(calls(), ['codegen', 'build']);
  assert.equal(git('check-ignore', 'be/src/generated.d.ts'), 'be/src/generated.d.ts', 'the generated declaration is derived output');
  const cached = await measure(); assert.equal(cached.steps.codegen.ran, false); assert.equal(cached.steps.build[0].ran, false); assert.equal(calls().length, 2);
  put(root, 'be/src/a.ts', 'export const a: number = 3;\n');
  assert.equal(git('status', '--porcelain', '--', 'be/src/a.ts'), dirty);
  await measure(); assert.deepEqual(calls(), ['codegen', 'build', 'codegen', 'build']);
  fs.rmSync(path.join(root, 'be/contracts/schema.txt'));
  await measure(); assert.equal(calls().length, 6, 'removed source input invalidates both prerequisites');
  put(root, 'packages/public/dist/index.d.ts', 'export declare const built: string;\n');
  const outputChanged = await measure(); assert.equal(outputChanged.steps.codegen.ran, false); assert.equal(outputChanged.steps.build[0].ran, true);
  assert.deepEqual(calls(), ['codegen', 'build', 'codegen', 'build', 'codegen', 'build', 'build']);
  assert.match(fs.readFileSync(path.join(root, 'packages/public/dist/index.d.ts'), 'utf8'), /built: number/);
});
