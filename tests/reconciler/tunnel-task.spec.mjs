import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TUNNEL_TASK, installTunnelTask, tunnelTaskName, tunnelTaskScript } from '../../scripts/reconciler/tunnel-task.mjs';

test('the harness tunnel task runs node ui/start.mjs --tunnel, never the retired run-cloudflared.ps1', () => {
  const script = tunnelTaskScript({ task: 'StarCi Harness Tunnel', node: 'C:\\node\\node.exe', workdir: 'C:\\src\\.claude\\ui' });
  assert.match(script, /"C:\\node\\node\.exe" "C:\\src\\\.claude\\ui[\\/]start\.mjs" --tunnel/);
  assert.match(script, /-WorkingDirectory 'C:\\src\\\.claude\\ui'/);
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
