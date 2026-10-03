// The findings of the rules that compare a file with its render or run the repository's own tool: R04 the managed .gitignore block
// (packages/hfs/sync/managed.mjs, next to the other managed files; R11 sonar-project.properties is proved in tests/gates/hfs-sync.spec.mjs)
// and R19 prettier (packages/hfs/sync/format.mjs). Each has a violating and a passing repository and names its code; `starci app check`
// reports them through the CLI with their Vietnamese why.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { trackedFiles } from '../../scripts/hfs/check.mjs';
import { main } from '../../packages/hfs/src/main.mjs';
import { SyncError } from '../../packages/hfs/sync/index.mjs';
import { formatFindings, loadPrettier } from '../../packages/hfs/sync/format.mjs';
import { managedFindings } from '../../packages/hfs/sync/managed.mjs';
import { APP, FORMATTED, PRESETS, cleanup, gitAdd, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

const made = [];
const repoOf = (declaration = APP, mutate) => {
  const dir = writeCleanRepo(declaration);
  made.push(dir);
  if (mutate) mutate(dir);
  return gitAdd(dir);
};
test.after(() => cleanup(made));

const read = (dir, relative) => fs.readFileSync(path.join(dir, ...relative.split('/')), 'utf8');
const write = (dir, relative, text) => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const only = (findings, code) => findings.filter((f) => f.code === code);
const managed = (dir) => managedFindings({ repoRoot: dir, tracked: trackedFiles(dir), presets: PRESETS });

// ------------------------------------------------------------------------------------------------ R04 HFS_GITIGNORE_BLOCK_DRIFT

test('HFS_GITIGNORE_BLOCK_DRIFT: an edited block of the app .gitignore, and one with no block, are refused; the app\'s own lines are not judged', async () => {
  const edited = repoOf(APP, (dir) => write(dir, '.gitignore', read(dir, '.gitignore').replace('node_modules/\n', '')));
  const [drift] = only(await managed(edited), 'HFS_GITIGNORE_BLOCK_DRIFT');
  assert.equal(drift.path, '.gitignore');
  assert.match(drift.message, /not its render/);
  assert.match(drift.message, /line \d+ expected "node_modules\/"/);
  const unmanaged = repoOf(APP, (dir) => write(dir, '.gitignore', 'node_modules/\n'));
  assert.match(only(await managed(unmanaged), 'HFS_GITIGNORE_BLOCK_DRIFT')[0].message, /block of \.gitignore is missing/);
});

test('HFS_GITIGNORE_BLOCK_DRIFT: the rendered block, with the repository\'s own lines around it, is clean', async () => {
  const dir = repoOf(APP, (d) => write(d, '.gitignore', `# ours\nlocal-notes/\n${read(d, '.gitignore')}\n.idea/\n`));
  assert.deepEqual(only(await managed(dir), 'HFS_GITIGNORE_BLOCK_DRIFT'), []);
  assert.deepEqual(only(await managed(repoOf()), 'HFS_GITIGNORE_BLOCK_DRIFT'), []);
});

test('the CLI reports the block drift with its Vietnamese why, and an app with no preset installed is a refusal', async () => {
  const dir = repoOf(APP, (d) => write(d, '.gitignore', 'dist/\n'));
  let out = '';
  let err = '';
  const seams = { stdout: (s) => { out += s; }, stderr: (s) => { err += s; }, presets: PRESETS, prettier: FORMATTED };
  const code = await main(['check', '--cwd', dir, '--json'], seams);
  assert.equal(code, 1);
  const [finding] = JSON.parse(out).findings.filter((f) => f.code === 'HFS_GITIGNORE_BLOCK_DRIFT');
  assert.ok(finding);
  assert.match(finding.titleVi, /[\u00c0-\u1ef9]/);
  const refused = await main(['check', '--cwd', dir], { ...seams, presets: undefined, stdout: () => {} });
  assert.equal(refused, 2);
  assert.match(err, /HFS_SYNC_PRESET_MISSING/);
});

// ------------------------------------------------------------------------------------------------ R19 HFS_FORMAT

test('HFS_FORMAT: the runtime declares and resolves its pinned prettier from this checkout', () => {
  const runtime = path.resolve(import.meta.dirname, '..', '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(runtime, 'package.json'), 'utf8'));
  assert.equal(manifest.devDependencies.prettier, '3.9.6');
  const installed = createRequire(import.meta.url).resolve('prettier/package.json');
  // Junction-aware: node_modules may be a junction (the land gate's scratch links the live runtime's), so compare realpaths;
  // an ancestor's node_modules (e.g. the host repo one level up) still falls outside realpath(runtime/node_modules).
  const ownModules = fs.realpathSync(path.join(runtime, 'node_modules'));
  const inside = path.relative(ownModules, fs.realpathSync(installed));
  assert.ok(inside && !inside.startsWith('..') && !path.isAbsolute(inside), `prettier must resolve from this checkout's node_modules (${ownModules}): ${installed}`);
  assert.ok(installed.includes(`${path.sep}node_modules${path.sep}prettier${path.sep}`));
  assert.equal(JSON.parse(fs.readFileSync(installed, 'utf8')).version, '3.9.6');
});

const prettierOf = path.dirname(createRequire(import.meta.url).resolve('prettier/package.json'));

/** A tracked app whose root node_modules holds the runtime's own prettier, the way `npm ci` would have installed it. */
function withPrettier(files) {
  const dir = writeCleanRepo(APP);
  made.push(dir);
  for (const [relative, text] of Object.entries(files)) write(dir, relative, text);
  gitAdd(dir);
  fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
  fs.symlinkSync(prettierOf, path.join(dir, 'node_modules', 'prettier'), 'junction');
  return dir;
}
const formatOf = (dir, files) => formatFindings({ repoRoot: dir, files });

test('HFS_FORMAT: a file the repository\'s own prettier would change, and one it cannot parse, are refused', async () => {
  const dir = withPrettier({ 'be/src/a.ts': 'const a = {b:1}\n', 'be/src/broken.ts': 'const = ;\n', 'be/src/ok.ts': 'export const ok = 1;\n', '.prettierrc': '{ "semi": true }\n' });
  const found = only(await formatOf(dir, ['be/src/a.ts', 'be/src/broken.ts', 'be/src/ok.ts']), 'HFS_FORMAT');
  assert.deepEqual(found.map((f) => f.path).sort(), ['be/src/a.ts', 'be/src/broken.ts']);
  assert.match(found.find((f) => f.path === 'be/src/broken.ts').message, /cannot be formatted/);
  assert.equal(found[0].level, 'error');
});

test('HFS_FORMAT: formatted files, a .prettierignore entry and a lockfile are clean; the repository\'s prettier config is the judge', async () => {
  const dir = withPrettier({
    'be/src/ok.ts': 'export const ok = 1;\n',
    'be/src/generated.ts': 'const   generated = {a:1}\n',
    '.prettierignore': 'be/src/generated.ts\n',
    'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
    '.prettierrc': '{ "semi": true }\n',
  });
  assert.deepEqual(only(await formatOf(dir, ['be/src/ok.ts', 'be/src/generated.ts', 'package-lock.json']), 'HFS_FORMAT'), []);
  write(dir, 'be/src/no-semi.ts', 'export const ok = 1\n');
  assert.deepEqual(only(await formatOf(dir, ['be/src/no-semi.ts']), 'HFS_FORMAT').map((f) => f.path), ['be/src/no-semi.ts']);
  write(dir, '.prettierrc', '{ "semi": false }\n');
  assert.deepEqual(only(await formatOf(dir, ['be/src/no-semi.ts']), 'HFS_FORMAT'), []);
});

test('HFS_FORMAT: an app without prettier is a refusal (HFS_FORMAT_TOOL_MISSING), never a pass', async () => {
  const dir = repoOf();
  assert.throws(() => loadPrettier(dir), (error) => error instanceof SyncError && error.code === 'HFS_FORMAT_TOOL_MISSING');
  await assert.rejects(formatFindings({ repoRoot: dir, files: ['README.md'] }), /HFS_FORMAT_TOOL_MISSING/);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-format-'));
  made.push(tmp);
  assert.throws(() => loadPrettier(tmp), /prettier is not installed/);
});
