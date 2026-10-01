// 3.3: the typed ESLint run never reads types from above the app root (packages/hfs/lint/bound-sys.cjs). typescript-eslint's
// projectService builds its host from tsserver.sys and takes no host option, so `hfs lint` preloads a bounded `sys`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { lintRepository, parseLintArgs, linterBoundArgs, BOUND_ENV } from '../../packages/hfs/lint/run.mjs';
import { appDeclarationText, DEFAULT_APPS } from '../helpers/hfs-arch-fixture.mjs';

const PACKAGES = path.resolve(import.meta.dirname, '..', '..', 'packages');
const require = createRequire(path.join(PACKAGES, 'package.json'));
const { bindSys } = require('../packages/hfs/lint/bound-sys.cjs');
const ts = require('typescript');

const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });
const tmp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-bound-')); made.push(dir); return dir; };

/** An enclosing directory holding a type only the enclosure installs, and an app inside it with its own. */
const world = () => {
  const outer = tmp();
  const app = path.join(outer, 'app');
  fs.mkdirSync(path.join(outer, 'node_modules', 'leak'), { recursive: true });
  fs.writeFileSync(path.join(outer, 'node_modules', 'leak', 'index.d.ts'), 'export declare const leaked: number;\n');
  fs.mkdirSync(path.join(app, 'node_modules', 'own'), { recursive: true });
  fs.writeFileSync(path.join(app, 'node_modules', 'own', 'index.d.ts'), 'export declare const own: number;\n');
  fs.writeFileSync(path.join(app, 'tsconfig.json'), '{}\n');
  return { outer, app };
};
const bound = (app) => bindSys({ ...ts.sys }, app, path.dirname(ts.getDefaultLibFilePath({})));

test('a bounded sys answers inside the app root and TypeScript\'s lib directory (passing)', () => {
  const { app } = world();
  const sys = bound(app);
  assert.equal(sys.fileExists(path.join(app, 'node_modules', 'own', 'index.d.ts')), true);
  assert.match(sys.readFile(path.join(app, 'tsconfig.json')) ?? '', /\{\}/);
  assert.equal(sys.directoryExists(path.join(app, 'node_modules', 'own')), true);
  assert.ok(sys.getDirectories(path.join(app, 'node_modules')).includes('own'));
  assert.equal(sys.fileExists(ts.getDefaultLibFilePath({})), true, 'the lib files of TypeScript itself stay readable');
  assert.equal(sys.realpath(path.join(app, 'tsconfig.json')), path.join(app, 'tsconfig.json'), 'realpath is the identity');
});

test('a bounded sys refuses every read above the app root, so an enclosing node_modules satisfies nothing (violating)', () => {
  const { outer, app } = world();
  const sys = bound(app);
  const leak = path.join(outer, 'node_modules', 'leak');
  assert.equal(fs.existsSync(path.join(leak, 'index.d.ts')), true, 'the enclosing install is real');
  assert.equal(sys.fileExists(path.join(leak, 'index.d.ts')), false);
  assert.equal(sys.readFile(path.join(leak, 'index.d.ts')), undefined);
  assert.equal(sys.directoryExists(leak), false);
  assert.deepEqual(sys.getDirectories(path.join(outer, 'node_modules')), []);
  assert.deepEqual(sys.readDirectory(path.join(outer, 'node_modules'), ['.ts', '.d.ts'], undefined, ['**/*']), []);
  assert.equal(sys.fileExists(path.join(outer, 'app-sibling', 'x.ts')), false);
  // a sibling folder whose name merely starts with the app root's is not inside it
  fs.mkdirSync(`${app}-twin`, { recursive: true });
  fs.writeFileSync(path.join(`${app}-twin`, 'x.d.ts'), 'export {};\n');
  assert.equal(sys.fileExists(path.join(`${app}-twin`, 'x.d.ts')), false);
});

test('the preload binds a real process\'s TypeScript when STARCI_LINT_BOUND is set, and does nothing without it', () => {
  const { outer, app } = world();
  const probe = `const ts = require('typescript'); const s = require('typescript/lib/tsserverlibrary');
    const inApp = process.argv[1], outside = process.argv[2];
    process.stdout.write(JSON.stringify({ own: [ts.sys.fileExists(inApp), s.sys.fileExists(inApp)], leak: [ts.sys.fileExists(outside), s.sys.fileExists(outside)] }));`;
  const probeAt = (env) => JSON.parse(spawnSync(process.execPath, [...linterBoundArgs(), '-e', probe, path.join(app, 'tsconfig.json'), path.join(outer, 'node_modules', 'leak', 'index.d.ts')],
    { cwd: PACKAGES, encoding: 'utf8', env: { ...process.env, ...env } }).stdout);
  assert.deepEqual(probeAt({ [BOUND_ENV]: app }), { own: [true, true], leak: [false, false] });
  const unset = { ...process.env }; delete unset[BOUND_ENV];
  assert.deepEqual(JSON.parse(spawnSync(process.execPath, [...linterBoundArgs(), '-e', probe, path.join(app, 'tsconfig.json'), path.join(outer, 'node_modules', 'leak', 'index.d.ts')],
    { cwd: PACKAGES, encoding: 'utf8', env: unset }).stdout), { own: [true, true], leak: [true, true] }, 'unbound: nothing is patched');
});

test('hfs lint starts ESLint with the bound preload and the app root, and no other linter (passing and violating)', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'hfs.json'), appDeclarationText('be', { apps: DEFAULT_APPS.be }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo', private: true }));
  fs.mkdirSync(path.join(dir, 'be', 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'be', 'src', 'a.ts'), 'export {};\n');
  fs.mkdirSync(path.join(dir, 'fe'), { recursive: true });
  const fake = (side, name, body, stream = 'stdout') => {
    const pkg = path.join(dir, side, 'node_modules', name);
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name, version: '9.0.0', bin: { [name]: 'bin.js' } }));
    fs.writeFileSync(path.join(pkg, 'bin.js'), `process.${stream}.write(JSON.stringify(${body}));\n`);
  };
  const seen = (name) => `[{ filePath: ${JSON.stringify(path.join(dir, 'be', 'src', 'a.ts'))}, messages: [{ ruleId: 'x', line: 1, column: 1, message: [${name}, process.env.${BOUND_ENV} ?? 'unset', process.execArgv.join(' ')].join('|') }] }]`;
  fake('be', 'eslint', seen("'be'"));
  fake('fe', 'eslint', seen("'fe'"));
  fake('fe', 'stylelint', '[]', 'stderr');
  const { report } = await lintRepository({ repoRoot: dir, opts: parseLintArgs([]), hfsCheck: async () => ({ findings: [], tracked: [] }), trackedFiles: () => [] });
  const eslint = report.findings.filter((f) => f.engine === 'eslint');
  assert.equal(eslint.length, 2);
  for (const f of eslint) {
    const [, bound_, args] = f.message.split('|');
    assert.equal(bound_, dir, 'ESLint is bound to the app root, not its side folder');
    assert.match(args, /--require .*bound-sys\.cjs/);
  }
});
