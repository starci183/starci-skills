// The live smoke's trust step reads the real agent homes: without the test-runner marker the targets are not skipped, with it they are.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { trustTargets } from '../../scripts/agent/trust.mjs';
import { liveLaunchTrust, unmarkedEnv } from '../helpers/live-launch-trust.mjs';

const marked = { NODE_TEST_CONTEXT: 'child-v8', KEEP: '1' };

test('the unmarked environment drops only the marker, and its trust targets are the real homes', () => {
  assert.match(trustTargets({ env: marked }).skipped, /STARCI_AGENT_TRUST_HOME/);
  const env = unmarkedEnv(marked);
  assert.deepEqual(env, { KEEP: '1' });
  const targets = trustTargets({ env });
  assert.equal(targets.skipped, undefined);
  assert.equal(targets.claudeJson, path.join(os.homedir(), '.claude.json'));
});

test('a launch repository outside the owner roots is declined with its reason before any target is touched', () => {
  const r = liveLaunchTrust({ agent: 'claude', cwd: os.tmpdir(), config: { launchTrust: null }, env: marked });
  assert.equal(r.status, 'declined');
  assert.match(r.reason, /not adopted/);
});
