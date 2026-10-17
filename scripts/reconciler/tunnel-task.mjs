import { harnessTunnelTaskScript, TASK_DEFINITIONS } from '../machine/task-register.mjs';

const DEFAULT_TUNNEL_TASK = TASK_DEFINITIONS['harness-tunnel'].taskName;


/** The PowerShell that registers the harness tunnel task (boot.mjs taskScript pattern). Pure. */
export function tunnelTaskScript({ task = DEFAULT_TUNNEL_TASK, starci, workdir } = {}) {
  return harnessTunnelTaskScript({ taskName: task, starci, workdir });
}
