// scripts/reconciler/tunnel-task.mjs — the registration of the harness tunnel's scheduled task (modules/reconciler/host.yaml
// services.harness-tunnel.task, 'StarCi Harness Tunnel'). The task runs `starci harness start --tunnel` (cloudflared through
// scripts/api/cloudflared/tunnel-run.mjs) at logon and restarts it when it fails; scripts/reconciler/services.mjs only ends
// and runs the task by name, so this file is the one place that says what the task executes.
//
//   This internal printer emits the task action used by the reconciler host; `starci task register` owns application.
import { hostSettings } from './services.mjs';
import { harnessTunnelTaskScript, TASK_DEFINITIONS } from '../machine/task-register.mjs';

export const DEFAULT_TUNNEL_TASK = TASK_DEFINITIONS['harness-tunnel'].taskName;

/** The task name the reconciler restarts (modules/reconciler/host.yaml services.harness-tunnel.task), or the default. */
export function tunnelTaskName(settings = null) {
  try { return (settings ?? hostSettings()).services?.['harness-tunnel']?.task || DEFAULT_TUNNEL_TASK; } catch { return DEFAULT_TUNNEL_TASK; }
}

/** The PowerShell that registers the harness tunnel task (boot.mjs taskScript pattern). Pure. */
export function tunnelTaskScript({ task = DEFAULT_TUNNEL_TASK, starci, workdir } = {}) {
  return harnessTunnelTaskScript({ taskName: task, starci, workdir });
}
