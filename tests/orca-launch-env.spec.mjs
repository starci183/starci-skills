import test from 'node:test';
import assert from 'node:assert/strict';
import { hostLaunchEnv } from '../scripts/api/orca/lib.mjs';

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

