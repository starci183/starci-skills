// One spelling of the guard hook command: the quoted per-user launcher path with forward slashes, then the verb.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { slashPath, winPath } from '../fixtures/win-path.mjs';
import { PORTABLE_HOME, guardHookCommand, isGuardCommand, toolGuardCommand } from '../../scripts/lib/guard-command.mjs';

const slashed = os.tmpdir().replaceAll(path.sep, '/');

test('the hook command names the launcher by absolute path, quoted, with forward slashes', () => {
  assert.equal(toolGuardCommand({ home: winPath('C', 'Users', 'Some One') }), `"${slashPath('C', 'Users', 'Some One')}/.starci/bin/starci" guard command`);
  assert.equal(toolGuardCommand({ home: os.tmpdir() }), `"${slashed}/.starci/bin/starci" guard command`);
  assert.equal(guardHookCommand('seat-tools', { home: os.tmpdir() }), `"${slashed}/.starci/bin/starci" guard seat-tools`);
  assert.equal(toolGuardCommand({ home: PORTABLE_HOME }), '"$HOME/.starci/bin/starci" guard command');
});

test('the command depends on no PATH entry: its first word is the launcher path', () => {
  assert.match(toolGuardCommand(), /^"[^"]+\/\.starci\/bin\/starci" guard command$/);
});

test('a registered guard command is recognised in its current spelling and in the bare spelling a rewrite replaces', () => {
  assert.equal(isGuardCommand(toolGuardCommand({ home: os.tmpdir() })), true);
  assert.equal(isGuardCommand('starci guard command'), true);
  assert.equal(isGuardCommand('"$HOME/.starci/bin/starci" guard seat-tools'), false);
  assert.equal(isGuardCommand('owner-hook'), false);
  assert.equal(isGuardCommand(undefined), false);
});
