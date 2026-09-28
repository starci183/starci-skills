import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkSliceTypecheck } from '../scripts/checks/slice-typecheck.mjs';

const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(path.join(runtime, 'ui', 'package.json'))('typescript');
const gitBinary = (process.env.PATH ?? '').split(path.delimiter)
  .filter((directory) => !directory.replaceAll('\\', '/').includes('/runtime/guards/bin'))
  .map((directory) => path.join(directory, process.platform === 'win32' ? 'git.exe' : 'git'))
  .find((candidate) => fs.existsSync(candidate)) ?? 'git';
const git = (root, ...args) => {
  const run = spawnSync(gitBinary, ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
};
const put = (root, relative, value) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
};

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slice-typecheck-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'core.autocrlf', 'false');
  put(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'esnext', moduleResolution: 'bundler', target: 'es2020' }, include: ['src/**/*.ts'] }));
  put(root, 'src/slice/a.ts', 'export const foo = 1;\n');
  put(root, 'src/user.ts', "import { foo } from './slice/a';\nexport const u = foo;\n");
  put(root, 'src/residue.ts', "import { gone } from './nowhere';\nexport const r = gone;\n");
  git(root, 'add', '--', 'tsconfig.json', 'src/slice/a.ts', 'src/user.ts', 'src/residue.ts');
  git(root, 'commit', '-qm', 'admission');
  return { root, base: git(root, 'rev-parse', 'HEAD') };
}

test('wrongly blocked: a changed slice passes with only untouched preexisting type errors', (t) => {
  const { root, base } = fixture(t);
  put(root, 'src/slice/a.ts', 'export const foo: number = 1;\n');
  const result = checkSliceTypecheck({ root, base, paths: ['src/slice'], ts });
  assert.equal(result.status, 'clean', JSON.stringify(result));
  assert.deepEqual(result.newErrors, []);
  assert.ok(result.notes.some((note) => note.code === 'SLICE_PREEXISTING' && note.count > 0));
});

test('a new error in the changed file fails', (t) => {
  const { root, base } = fixture(t);
  put(root, 'src/slice/a.ts', 'export const foo: number = "wrong";\n');
  const result = checkSliceTypecheck({ root, base, paths: ['src/slice'], ts });
  assert.equal(result.status, 'findings', JSON.stringify(result));
  assert.ok(result.newErrors.some((error) => error.file === 'src/slice/a.ts' && error.owned));
});

test('a slice breaking an untouched importer fails', (t) => {
  const { root, base } = fixture(t);
  put(root, 'src/slice/a.ts', 'export const bar = 1;\n');
  const result = checkSliceTypecheck({ root, base, paths: ['src/slice'], ts });
  assert.equal(result.status, 'findings', JSON.stringify(result));
  assert.ok(result.newErrors.some((error) => error.file === 'src/user.ts' && !error.owned));
});

test('code.refactor uses the slice typecheck before and after, with old debt advisory', () => {
  const contract = fs.readFileSync(path.join(runtime, 'modules/ops/ops/code.refactor.yaml'), 'utf8');
  assert.match(contract, /slice-typecheck\.mjs[\s\S]*BEFORE editing/);
  assert.match(contract, /SAME slice-typecheck\.mjs command AFTER the edit/);
  assert.match(contract, /SLICE_PREEXISTING notes are advisory/);
});
