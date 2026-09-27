import test from 'node:test';
import assert from 'node:assert/strict';
import { hostLaunchEnv } from '../scripts/api/orca/lib.mjs';
import { restartOrcaApp } from '../scripts/supervisor/tick-duties.mjs';

const sourceEnv = () => ({
  PATH: 'C:\\Windows;C:\\Tools',
  USERPROFILE: 'C:\\Users\\Operator',
  STARCI_KEEP: 'present',
  CLAUDECODE: '1',
  CLAUDE_CODE_DISABLE_TERMINAL_TITLE: '1',
  CLAUDE_CODE_SESSION_ID: 'session-placeholder',
  CLAUDE_AGENT_ID: 'agent-placeholder',
  CLAUDE_SESSION_ID: 'session-placeholder',
  AGENT_SESSION_ID: 'session-placeholder',
  SESSION_ID: 'session-placeholder',
  ACP_BACKEND: 'backend-placeholder',
  claude_code_lowercase: '1',
});

test('hostLaunchEnv copies the host environment without Claude session and ACP markers', () => {
  const source = sourceEnv();
  const clean = hostLaunchEnv(source);
  assert.notStrictEqual(clean, source);
  assert.deepEqual(clean, {
    PATH: source.PATH,
    USERPROFILE: source.USERPROFILE,
    STARCI_KEEP: source.STARCI_KEEP,
  });
  assert.equal(source.CLAUDECODE, '1', 'the caller environment remains intact');
});

test('restartOrcaApp hands the scrubbed environment to the PowerShell launcher', () => {
  const calls = [];
  const run = (file, argv, options) => {
    calls.push({ file, argv, options });
    return { status: 0, stdout: '{"closed":1,"forced":0}' };
  };
  const result = restartOrcaApp({ closeWaitMs: 10, app: 'C:\\Apps\\Orca.exe', platform: 'win32', env: sourceEnv(), run });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, 'powershell.exe');
  assert.match(calls[0].argv.at(-1), /Start-Process -FilePath \$app/);
  assert.deepEqual(calls[0].options.env, {
    PATH: 'C:\\Windows;C:\\Tools',
    USERPROFILE: 'C:\\Users\\Operator',
    STARCI_KEEP: 'present',
  });
});
