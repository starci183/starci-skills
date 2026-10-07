// The guard hook command is run through the shells an agent host uses (bash and cmd on Windows, sh on POSIX) with only
// its own spelling to resolve it: the per-user launcher directory is not on the probe's PATH. A missing launcher is red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeGuardCommand } from '../../scripts/api/process/probe-guard-command.mjs';
import { toolGuardCommand } from '../../scripts/lib/guard-command.mjs';
import { writeRuntimeShim } from '../../packages/cli/src/shim.mjs';
import { installGuardLauncher } from '../helpers/guard-launcher.mjs';

const WINDOWS = process.platform === 'win32';
const home = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-guard-probe-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const probe = (dir) => probeGuardCommand({ command: toolGuardCommand({ home: dir }), home: dir });
const bin = (dir) => path.join(dir, '.starci', 'bin');
const shell = (result, name) => result.shells.find((entry) => entry.shell === name);
// Bash is the only shell that needs the extensionless launcher; without Git Bash on a Windows machine nothing can run it.
const NO_BASH = WINDOWS && Boolean(shell(probeGuardCommand({ command: 'exit 0', home: os.tmpdir() }), 'bash')?.skipped) ? 'Git Bash is not installed; Git for Windows provides the bash the extensionless launcher is for' : false;

test('the installed launchers resolve the hook command through every shell of the platform, with the launcher directory off PATH', (t) => {
  const dir = home(t);
  installGuardLauncher(dir);
  const result = probe(dir);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.reason, null);
  const names = result.shells.map((entry) => entry.shell);
  assert.deepEqual(names, WINDOWS ? ['cmd', 'bash'] : ['sh']);
  for (const entry of result.shells) assert.ok(entry.skipped || entry.status === 0, `${entry.shell}: ${JSON.stringify(entry)}`);
});

test('without the extensionless launcher bash cannot resolve the hook command, and the probe is red naming bash', { skip: NO_BASH }, (t) => {
  const dir = home(t);
  installGuardLauncher(dir);
  fs.rmSync(path.join(bin(dir), 'starci'));
  const result = probe(dir);
  assert.equal(result.ok, false);
  assert.match(result.reason, WINDOWS ? /^bash exit 127: .*starci/ : /^sh exit 127: .*starci/);
  if (WINDOWS) assert.equal(shell(result, 'cmd').ok, true, 'the cmd launcher beside it still resolves');
});

test('without the cmd launcher cmd cannot resolve the hook command', { skip: WINDOWS ? false : 'cmd exists on Windows only' }, (t) => {
  const dir = home(t);
  installGuardLauncher(dir);
  fs.rmSync(path.join(bin(dir), 'starci.cmd'));
  const result = probe(dir);
  assert.equal(result.ok, false);
  assert.equal(shell(result, 'cmd').ok, false);
  assert.match(result.reason, /^cmd exit \d+: /);
});

test('an install that wrote only starci.cmd is repaired by writing the launchers again, and the repair is idempotent', { skip: NO_BASH }, (t) => {
  const dir = home(t);
  installGuardLauncher(dir);
  const launcher = path.join(bin(dir), 'starci');
  fs.rmSync(launcher);
  const before = probe(dir);
  assert.equal(before.ok, false);
  const root = path.resolve(import.meta.dirname, '..', '..');
  writeRuntimeShim({ root, home: dir });
  const repaired = probe(dir);
  assert.equal(repaired.ok, true, JSON.stringify(repaired));
  const snapshot = fs.readdirSync(bin(dir)).map((name) => [name, fs.readFileSync(path.join(bin(dir), name), 'utf8')]);
  writeRuntimeShim({ root, home: dir });
  assert.deepEqual(fs.readdirSync(bin(dir)).map((name) => [name, fs.readFileSync(path.join(bin(dir), name), 'utf8')]), snapshot);
});

test('a machine without a shell is a skip with its reason, never a pass: no shell at all is red', () => {
  const none = probeGuardCommand({ command: 'x', home: os.tmpdir(), platform: 'linux', exists: () => false });
  assert.equal(none.ok, false);
  assert.deepEqual(none.shells, [{ shell: 'sh', ok: true, skipped: 'sh is not installed on this machine' }]);
  assert.match(none.reason, /no shell on this machine/);
  const noBash = probeGuardCommand({ command: 'x', home: os.tmpdir(), platform: 'win32', env: { SystemRoot: os.tmpdir(), PATH: '' }, exists: (file) => /cmd\.exe$/i.test(file), run: () => ({ status: 0, stdout: '', stderr: '' }) });
  assert.equal(noBash.ok, true);
  assert.equal(shell(noBash, 'bash').skipped, 'bash is not installed on this machine');
});
