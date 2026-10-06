import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrcaCommand } from '../../scripts/api/orca/lib.mjs';
import { winPath } from '../fixtures/win-path.mjs';

const forbidden = () => { throw new Error('binary lookup must not run'); };

test('Linux selects the IDE command and macOS selects Orca without probing or launching either', () => {
  assert.equal(resolveOrcaCommand({ platform: 'linux', env: {}, run: forbidden }), 'orca-ide');
  assert.equal(resolveOrcaCommand({ platform: 'darwin', env: {}, run: forbidden }), 'orca');
});

test('explicit StarCi command wins over the managed-session executable on every supported OS', () => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    assert.equal(resolveOrcaCommand({ platform, env: { STARCI_ORCA_COMMAND: 'owned-test-orca', ORCA_CLI_COMMAND: 'other-orca' }, run: forbidden }), 'owned-test-orca');
  }
});

test('Orca managed WSL executable is retained verbatim rather than redirected to a different Linux install', () => {
  const executable = '/mnt/c/Orca/resources/bin/orca.exe';
  assert.equal(resolveOrcaCommand({ platform: 'linux', env: { ORCA_CLI_COMMAND: executable }, run: forbidden }), executable);
});

test('Windows keeps the existing executable-only resolution and fallback, avoiding the command shim', () => {
  const cmdShim = winPath('C', 'Tools', 'orca.cmd'), exe = winPath('C', 'Orca', 'resources', 'bin', 'orca.exe');
  const seen = [];
  const run = (...args) => { seen.push(args); return { status: 0, stdout: `${cmdShim}\r\n${exe}\r\n` }; };
  assert.equal(resolveOrcaCommand({ platform: 'win32', env: {}, run }), exe);
  assert.deepEqual(seen, [['where.exe', ['orca'], { encoding: 'utf8' }]]);
  assert.equal(resolveOrcaCommand({ platform: 'win32', env: {}, run: () => ({ status: 1, stdout: '' }) }), 'orca.exe');
  assert.equal(resolveOrcaCommand({ platform: 'win32', env: {}, run: () => ({ status: 0, stdout: `${cmdShim}\r\n` }) }), 'orca.exe');
});
