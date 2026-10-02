import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_TUNNEL_TASK, installTunnelTask, tunnelTaskName, tunnelTaskScript } from '../../scripts/reconciler/tunnel-task.mjs';

test('the harness tunnel task runs node ui/start.mjs --tunnel, never the retired run-cloudflared.ps1', () => {
  // Host paths are built under the temp directory, never spelled with a drive letter (RT_ABSOLUTE_PATH).
  const node = path.join(os.tmpdir(), 'node', 'node.exe');
  const workdir = path.join(os.tmpdir(), 'src', '.claude', 'ui');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const script = tunnelTaskScript({ task: 'StarCi Harness Tunnel', node, workdir });
  assert.match(script, new RegExp(`"${esc(node)}" "${esc(workdir)}[\\\\/]start\\.mjs" --tunnel`));
  assert.match(script, new RegExp(`-WorkingDirectory '${esc(workdir)}'`));
  assert.match(script, /Register-ScheduledTask -TaskName 'StarCi Harness Tunnel'/);
  assert.match(script, /-RestartCount 999/);
  assert.doesNotMatch(script, /run-cloudflared|\.ps1/);
});

test('the task name comes from modules/reconciler/host.yaml services.harness-tunnel.task', () => {
  assert.equal(tunnelTaskName({ services: { 'harness-tunnel': { task: 'X Tunnel' } } }), 'X Tunnel');
  assert.equal(tunnelTaskName({ services: {} }), DEFAULT_TUNNEL_TASK);
  assert.equal(tunnelTaskName(), 'StarCi Harness Tunnel');
});

test('--install-task prints the registration; only --apply runs it', () => {
  const calls = [];
  const powershell = (script) => { calls.push(script); return { status: 0, stdout: 'registered', stderr: '' }; };
  const dry = installTunnelTask({ task: 'T', powershell, platform: 'win32' });
  assert.equal(dry.applied, false);
  assert.match(dry.powershell, /--tunnel/);
  assert.equal(calls.length, 0, 'a dry run registers nothing');
  const applied = installTunnelTask({ apply: true, task: 'T', powershell, platform: 'win32' });
  assert.deepEqual([applied.ok, applied.applied, calls.length], [true, true, 1]);
  assert.equal(installTunnelTask({ apply: true, task: 'T', powershell, platform: 'linux' }).reason, 'not-windows');
});
