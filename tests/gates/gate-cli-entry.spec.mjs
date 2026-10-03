// The gate reaches an app's lint and slot map through the one `starci` bin: the CLI landing (db3acdb15) removed
// packages/hfs/bin, so hfsEntry (scripts/lib/package-at.mjs) resolves the app's installed @starci/cli bin, else this runtime's
// packages/cli/bin/starci.mjs (scripts/lib/package-at.mjs starciBin), and runs `starci app lint --changed <file>... --format json`
// at the app root through the real CLI dispatcher and the real @starci/hfs. Nothing here stubs the CLI on the measured path.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GATE_EXIT, runLintGate } from '../../scripts/gates/gate.mjs';
import { kindsOf } from '../../scripts/gates/read-digest.mjs';
import { hfsEntry, starciBin } from '../../scripts/lib/package-at.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const RUNTIME_STARCI_BIN = path.join(ROOT, 'packages', 'cli', 'bin', 'starci.mjs');
const tmp = (t, prefix) => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const put = (root, rel, body) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return abs; };
const gitIn = (cwd) => (...args) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };

/** An app root (hfs.json of kind app, one be/ side) committed on main, then a lane commit that changes two be/ files. */
function laneApp(t) {
  const root = tmp(t, 'starci-gate-cli-');
  const git = gitIn(root);
  git('init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git('config', k, v);
  put(root, '.gitignore', 'node_modules/\n');
  put(root, 'package.json', JSON.stringify({ name: 'app', private: true, workspaces: ['be'] }, null, 2));
  put(root, 'hfs.json', JSON.stringify({ hfs: 2, kind: 'app', project: 'app', sides: { be: { apps: [{ name: 'core', kind: 'api' }], kinds: ['api'] } } }, null, 2));
  put(root, 'be/package.json', JSON.stringify({ name: '@app/be', private: true }));
  put(root, 'be/src/a.ts', 'export const a = 1;\n');
  put(root, 'be/src/b.ts', 'export const b = 1;\n');
  git('add', '-A'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  git('checkout', '-qb', 'lane');
  put(root, 'be/src/a.ts', 'export const a = 2;\n');
  put(root, 'be/src/b.ts', 'export const b = 2;\n');
  git('commit', '-qam', 'slice');
  return { root, base };
}

test('packages/hfs declares no bin: the only bin is @starci/cli `starci`, and it is the runtime fallback', () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'hfs', 'package.json'), 'utf8')).bin, undefined);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', 'cli', 'package.json'), 'utf8')).bin, { starci: './bin/starci.mjs' });
  assert.ok(fs.existsSync(RUNTIME_STARCI_BIN));
});

test('an app with no @starci/cli install lints through the runtime starci bin and loads the runtime @starci/hfs', (t) => {
  const root = tmp(t, 'starci-gate-noinstall-');
  put(root, 'package.json', '{ "name": "app", "private": true }\n');
  assert.deepEqual(hfsEntry(root), { dir: path.join(ROOT, 'packages', 'hfs'), bin: RUNTIME_STARCI_BIN });
  assert.equal(starciBin(root), RUNTIME_STARCI_BIN);
});

test('an app that installs @starci/cli runs its own bin and the @starci/hfs beside it; a declared bin that is missing falls back', (t) => {
  const root = tmp(t, 'starci-gate-install-');
  put(root, 'package.json', '{ "name": "app", "private": true }\n');
  const cli = path.join(root, 'node_modules', '@starci', 'cli');
  put(cli, 'package.json', JSON.stringify({ name: '@starci/cli', version: '1.0.0', bin: { starci: './bin/starci.mjs' } }));
  const bin = put(cli, 'bin/starci.mjs', '');
  const nested = path.join(cli, 'node_modules', '@starci', 'hfs');
  put(nested, 'package.json', JSON.stringify({ name: '@starci/hfs', version: '4.0.9' }));
  assert.deepEqual(hfsEntry(root), { dir: nested, bin });
  // An app that installs @starci/hfs itself loads that one.
  const own = path.join(root, 'node_modules', '@starci', 'hfs');
  put(own, 'package.json', JSON.stringify({ name: '@starci/hfs', version: '4.0.9' }));
  assert.equal(hfsEntry(root).dir, own);
  fs.rmSync(bin);
  assert.equal(starciBin(root), RUNTIME_STARCI_BIN);
});

test('the lint gate runs `starci app lint` for real: every changed file reaches @starci/hfs and a starci/lint@1 report comes back', async (t) => {
  const { root, base } = laneApp(t);
  const lint = await runLintGate({ root, base, files: ['be/src/a.ts', 'be/src/b.ts'] });
  const errors = lint.errors.join('\n');
  assert.doesNotMatch(errors, /produced no starci\/lint@1 report/, errors);
  assert.doesNotMatch(errors, /judged \d+ of \d+ changed files/, errors);
  assert.doesNotMatch(errors, /hfs\.mjs/, errors);
  // The fixture is no complete, installed app: the real report names what could not run, and that is exit 2, never a pass.
  assert.match(errors, /^starci app lint: /m);
  assert.equal(lint.exit, GATE_EXIT.toolFailed);
});

test('a CLI whose app implementation keeps only the last --changed is a lint that did not run on the rest, never clean', async (t) => {
  const { root, base } = laneApp(t);
  const dir = tmp(t, 'starci-gate-lastonly-');
  const bin = put(dir, 'starci.mjs', [
    'const argv = process.argv.slice(2);',
    "const changed = argv.flatMap((arg, i) => (arg === '--changed' ? [argv[i + 1]] : [])).slice(-1);",
    "process.stdout.write(JSON.stringify({ schema: 'starci/lint@1', changed, findings: [], errors: [] }) + '\\n');",
    '',
  ].join('\n'));
  const lint = await runLintGate({ root, base, files: ['be/src/a.ts', 'be/src/b.ts'], hfs: { dir, bin } });
  assert.equal(lint.exit, GATE_EXIT.toolFailed);
  assert.match(lint.errors.join('\n'), /starci app lint judged 1 of 2 changed files \(not be\/src\/a\.ts\)/);
});

test('read-digest explains a path through `starci app explain --json` when the @starci/hfs runtime slice is not loadable', async (t) => {
  const root = path.join(ROOT, 'examples', 'shape-slot');
  const file = 'be/src/features/api/system-health/application/check-liveness.handler.ts';
  const [inProcess] = await kindsOf(root, [file]);
  const [spawned] = await kindsOf(root, [file], { dir: tmp(t, 'starci-no-hfs-'), bin: RUNTIME_STARCI_BIN });
  assert.ok(spawned.slot, `no slot through the CLI for ${file}`);
  assert.deepEqual(spawned, inProcess);
});
