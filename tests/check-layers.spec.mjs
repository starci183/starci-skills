// check-layers.spec.mjs — the runtime's layers (modules/kernel/runtime-layers.yaml, scripts/checks/check-layers.mjs):
// an external system's program is started only from scripts/api/<system>/, scripts/lib starts nothing, and an
// unnameable spawn outside scripts/api/ needs a reviewed exception.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLayers, fileFindings, CODES } from '../scripts/checks/check-layers.mjs';
import { spawnCalls } from '../scripts/lib/spawn-calls.mjs';

const RULES = {
  scan: ['scripts', 'engine'],
  apiRoot: 'scripts/api',
  systems: [
    { id: 'orca', home: 'scripts/api/orca', programs: ['orca'] },
    { id: 'git', home: 'scripts/api/git', programs: ['git'] },
    { id: 'npm', home: 'scripts/api/npm', programs: ['npm', 'npx'] },
    { id: 'docker', home: 'scripts/api/docker', programs: ['docker', 'docker-compose'] },
  ],
  layers: [{ id: 'lib', path: 'scripts/lib', forbid: 'child_process' }],
};
const CP = "import { spawnSync, spawn } from 'node:child_process';\n";
const codes = (rel, text) => fileFindings(rel, text, RULES).map((f) => [f.code, f.line, f.system ?? null]);

test('a git spawn outside scripts/api/git is red; the same call in its home is not', () => {
  const text = `${CP}export const a = () => spawnSync('git', ['status']);\n`;
  assert.deepEqual(codes('scripts/kernel/a.mjs', text), [[CODES.external, 2, 'git']]);
  assert.deepEqual(codes('scripts/api/git/status.mjs', text), []);
  assert.deepEqual(codes('scripts/api/npm/status.mjs', text), [[CODES.external, 2, 'git']], 'another system\'s home is not git\'s');
});

test('scripts/lib may not import child_process in any form', () => {
  assert.deepEqual(codes('scripts/lib/x.mjs', "import cp from 'node:child_process';\nexport const y = 1;\n"), [[CODES.lib, 1, null]]);
  assert.deepEqual(codes('scripts/lib/x.mjs', "export const y = async () => (await import('child_process')).spawnSync;\n"), [[CODES.lib, 1, null]]);
  assert.deepEqual(codes('scripts/lib/x.mjs', "import { gitSpawn } from '../api/git/lib.mjs';\nexport const y = () => gitSpawn('git', ['log']);\n"), [], 'calling the api is the lib\'s way');
});

test('the program is found through consts, conditionals, shims, shells, namespaces and command strings', () => {
  assert.deepEqual(codes('scripts/kernel/a.mjs', `${CP}const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';\nspawnSync(NPM, ['ci']);\n`), [[CODES.external, 3, 'npm']]);
  assert.deepEqual(codes('scripts/kernel/a.mjs', `${CP}spawnSync('cmd', ['/d', '/c', 'docker', 'ps']);\n`), [[CODES.external, 2, 'docker']]);
  assert.deepEqual(codes('scripts/kernel/a.mjs', `${CP}spawnSync('npx eslint .', { shell: true });\n`), [[CODES.external, 2, 'npm']]);
  assert.deepEqual(codes('scripts/kernel/a.mjs', "import * as cp from 'node:child_process';\ncp.execFileSync('C:/Program Files/Git/bin/git.exe', ['log']);\n"), [[CODES.external, 2, 'git']]);
  assert.deepEqual(codes('scripts/kernel/a.mjs', "const { execSync } = require('child_process');\nexecSync(`orca terminal list`);\n"), [[CODES.external, 2, 'orca']]);
});

test('a local runner and an injected spawn default are followed to the program their callers name', () => {
  const runner = `${CP}const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });\nconst twice = (c, a) => { run(c, a); return run(c, a); };\nexport const x = () => run('git', ['status']);\nexport const y = () => twice('docker', ['ps']);\n`;
  assert.deepEqual(codes('scripts/supervisor/a.mjs', runner), [[CODES.external, 4, 'git'], [CODES.external, 5, 'docker']]);
  const seam = `${CP}export function head({ root, run = spawnSync } = {}) { return run('git', ['-C', root, 'rev-parse', 'HEAD']); }\n`;
  assert.deepEqual(codes('scripts/kernel/a.mjs', seam), [[CODES.external, 2, 'git']]);
});

test('node children, prose and calls that are no spawn are not findings', () => {
  const text = `${CP}import { runGit } from '../api/git/lib.mjs';\n`
    + "export const a = () => spawnSync(process.execPath, ['x.mjs']);\n"
    + "export const b = () => spawn('node', ['y.mjs'], { detached: true });\n"
    + "export const c = () => runGit(['status']);\n"
    + "export const d = 'never spawnSync(\"git\") by hand';\n"
    + "// spawnSync('git', ['status']) in a comment\n";
  assert.deepEqual(codes('scripts/kernel/a.mjs', text), []);
});

test('a spawn whose program cannot be named is red outside scripts/api and silent inside it', () => {
  const text = `${CP}export const a = (cfg) => spawnSync(cfg.bin, ['x']);\n`;
  assert.deepEqual(codes('scripts/kernel/a.mjs', text), [[CODES.unresolved, 2, null]]);
  assert.deepEqual(codes('scripts/api/orca/lib.mjs', text), []);
  // A runner nobody in the file calls with a literal: its pass-through spawn is not reported twice, its callers are.
  const runner = `${CP}const run = (cmd) => spawnSync(cmd, []);\nexport const b = (cfg) => run(cfg.bin);\n`;
  assert.deepEqual(codes('scripts/kernel/a.mjs', runner), [[CODES.unresolved, 3, null]]);
});

test('spawnCalls reports the shim-free program names and the calls it followed', () => {
  const r = spawnCalls(`${CP}spawnSync('C:\\\\tools\\\\NPM.CMD', ['ci']);\n`, 'x.mjs');
  assert.deepEqual(r.calls.map((c) => [c.callee, c.programs, c.resolved]), [['spawnSync', ['npm'], true]]);
  assert.deepEqual(r.imports, [{ line: 1, module: 'node:child_process' }]);
});

function fixture(t, files, allow) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-layers-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  write('modules/kernel/runtime-layers.yaml', JSON.stringify({ ...RULES, allowlist: 'modules/kernel/runtime-layers.allow.yaml' }));
  write('modules/kernel/runtime-layers.allow.yaml', JSON.stringify({ entries: allow }));
  for (const [rel, text] of Object.entries(files)) write(rel, text);
  return root;
}

test('the allowlist suppresses a matching finding, reports a stale entry and refuses an entry without a reason', (t) => {
  const files = { 'scripts/supervisor/owed.mjs': `${CP}spawnSync('git', ['log']);\n`, 'tests/x.spec.mjs': `${CP}spawnSync('git', ['init']);\n` };
  const clean = checkLayers(fixture(t, files, [{ path: 'scripts/supervisor/owed.mjs', code: CODES.external, system: 'git', lane: 'LAYER-2', reason: 'not moved yet' }]));
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.allowed.map((a) => [a.path, a.lane]), [['scripts/supervisor/owed.mjs', 'LAYER-2']]);
  const stale = checkLayers(fixture(t, files, [
    { path: 'scripts/supervisor/owed.mjs', code: CODES.external, system: 'git', reason: 'not moved yet' },
    { path: 'scripts/supervisor/gone.mjs', code: CODES.external, system: 'npm', reason: 'moved already' },
  ]));
  assert.deepEqual(stale.findings.map((f) => f.code), [CODES.stale]);
  const bare = checkLayers(fixture(t, files, [{ path: 'scripts/supervisor/owed.mjs', code: CODES.external, system: 'git' }]));
  assert.ok(bare.findings.some((f) => f.code === CODES.invalid));
  assert.ok(bare.findings.some((f) => f.code === CODES.external), 'an invalid entry suppresses nothing');
});

test('the runtime itself is clean under its rule set and allowlist', () => {
  const live = checkLayers();
  assert.equal(live.ok, true, JSON.stringify(live.findings.slice(0, 5)));
});
