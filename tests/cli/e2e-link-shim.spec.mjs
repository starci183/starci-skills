import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'packages', 'cli', 'bin', 'starci.mjs');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const isolatedEnv = (home, shimDir = null) => {
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
  };
  delete env.STARCI_RUNTIME;
  if (shimDir) env.PATH = `${shimDir}${path.delimiter}${env.PATH ?? ''}`;
  return env;
};

const run = (command, args, options) => spawnSync(command, args, {
  encoding: 'utf8',
  windowsHide: true,
  timeout: 25_000,
  ...options,
});

test('runtime link writes a launcher that runs the unified CLI outside the checkout', { timeout: 30_000 }, (t) => {
  const shell = process.platform === 'win32'
    ? run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'exit 0'])
    : run('/bin/sh', ['-c', 'exit 0']);
  if (shell.error?.code === 'ENOENT') return t.skip(`${process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'} is not installed`);
  assert.equal(shell.status, 0, shell.stderr);

  const fixture = mkdtemp(t, 'starci-link-shim-e2e-');
  const home = path.join(fixture, 'home with spaces');
  const outside = path.join(fixture, 'outside with spaces');
  const empty = path.join(fixture, 'not-a-runtime');
  for (const directory of [home, outside, empty]) fs.mkdirSync(directory, { recursive: true });

  const env = isolatedEnv(home);
  const linked = run(process.execPath, [CLI, 'runtime', 'link', '--root', ROOT], { cwd: outside, env });
  assert.equal(linked.status, 0, linked.stderr);

  const starciHome = path.join(home, '.starci');
  const shimDir = path.join(starciHome, 'bin');
  const runtimeJson = path.join(starciHome, 'runtime.json');
  const shim = path.join(shimDir, process.platform === 'win32' ? 'starci.cmd' : 'starci');
  assert.deepEqual(JSON.parse(fs.readFileSync(runtimeJson, 'utf8')), { root: ROOT });
  assert.equal(fs.existsSync(shim), true, `missing linked shim ${shim}`);

  const shimEnv = isolatedEnv(home, shimDir);
  const invoke = (args) => process.platform === 'win32'
    ? run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', ['starci', ...args].join(' ')], { cwd: outside, env: shimEnv })
    : run(shim, args, { cwd: outside, env: shimEnv });

  const version = invoke(['runtime', 'version']);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), VERSION);

  const help = invoke(['gate', '--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: starci gate/);

  const removed = invoke(['api', 'survey']);
  assert.equal(removed.status, 2, removed.stderr);
  assert.match(removed.stderr, /"starci api survey" was removed; use "starci kernel survey"/);

  const unknown = invoke(['runtime', 'version', '--not-a-real-flag']);
  assert.equal(unknown.status, 2, unknown.stderr);
  assert.match(unknown.stderr, /unknown (?:option|flag).*--not-a-real-flag/);

  const refused = run(process.execPath, [CLI, 'runtime', 'link', '--root', empty], { cwd: outside, env });
  assert.equal(refused.status, 2, refused.stderr);
  assert.match(refused.stderr, /is not a StarCi runtime root/);

  const status = invoke(['runtime', 'status', '--json']);
  assert.doesNotThrow(() => JSON.parse(status.stdout));
  assert.equal(JSON.parse(status.stdout).schema, 'starci/runtime-status@1');
  assert.equal(status.status, 0, status.stderr);
});
