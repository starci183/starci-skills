// scripts/reconciler/tunnel-task.mjs — the registration of the harness tunnel's scheduled task (modules/reconciler/host.yaml
// services.harness-tunnel.task, 'StarCi Harness Tunnel'). The task runs `starci harness start --tunnel` (cloudflared through
// scripts/api/cloudflared/tunnel-run.mjs) at logon and restarts it when it fails; scripts/reconciler/services.mjs only ends
// and runs the task by name, so this file is the one place that says what the task executes.
//
//   This internal printer emits the task action used by the reconciler host.
//                                    print (default) or register the task; the owner or the coordinator runs --apply
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPowershell } from '../api/process/run-powershell.mjs';
import { hostSettings } from './services.mjs';
import { starciShimPath } from './boot.mjs';
import { isMain } from '../lib/is-main.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_TUNNEL_TASK = 'StarCi Harness Tunnel';

/** The task name the reconciler restarts (modules/reconciler/host.yaml services.harness-tunnel.task), or the default. */
export function tunnelTaskName(settings = null) {
  try { return (settings ?? hostSettings()).services?.['harness-tunnel']?.task || DEFAULT_TUNNEL_TASK; } catch { return DEFAULT_TUNNEL_TASK; }
}

/** The PowerShell that registers the harness tunnel task (boot.mjs taskScript pattern). Pure. */
export function tunnelTaskScript({ task = DEFAULT_TUNNEL_TASK, starci = starciShimPath(), workdir = SKILL_ROOT } = {}) {
  const q = (s) => String(s).replace(/'/g, "''");
  return [
    "$ErrorActionPreference = 'Stop'",
    "$conhost = Join-Path $env:SystemRoot 'System32\\conhost.exe'",
    "$cmd = Join-Path $env:SystemRoot 'System32\\cmd.exe'",
    `$starci = '${q(starci)}'`,
    `$argLine = '--headless "' + $cmd + '" /d /s /c ""' + $starci + '" harness start --tunnel"'`,
    `$action = New-ScheduledTaskAction -Execute $conhost -Argument $argLine -WorkingDirectory '${q(workdir)}'`,
    '$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name',
    '$logon = New-ScheduledTaskTrigger -AtLogOn -User $user',
    "$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden",
    '$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited',
    `$registered = Register-ScheduledTask -TaskName '${q(task)}' -Action $action -Trigger $logon -Settings $settings -Principal $principal -Description 'StarCi harness tunnel: starci harness start --tunnel' -Force`,
    `Write-Output ("registered {0}: at logon, restarted on failure -> {1} {2}" -f $registered.TaskName, $conhost, $argLine)`,
  ].join('\n');
}

/** Print the registration, or (apply) run it: {ok, applied, task, powershell | output}. Seam: powershell. */
export function installTunnelTask({ apply = false, task = tunnelTaskName(), powershell = runPowershell, platform = process.platform } = {}) {
  const script = tunnelTaskScript({ task });
  if (!apply) return { ok: true, applied: false, task, powershell: script };
  if (platform !== 'win32') return { ok: false, applied: false, task, reason: 'not-windows' };
  const r = powershell(script);
  return { ok: r.status === 0, applied: true, task, output: String(r.stdout || r.stderr || '').trim().slice(0, 600) };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (!argv.includes('--install-task')) {
    console.error('starci: the harness tunnel task printer is internal to the reconciler host');
    process.exitCode = 2;
  } else {
    const out = installTunnelTask({ apply: argv.includes('--apply') });
    if (argv.includes('--json')) console.log(JSON.stringify(out));
    else if (!out.applied && out.ok) console.log(`Would register ${out.task} (re-run with --apply to create it; the owner or the coordinator does):\n${out.powershell}`);
    else console.log(`${out.ok ? 'registered' : 'FAILED'} ${out.task}: ${out.output ?? out.reason}`);
    if (!out.ok) process.exitCode = 1;
  }
}
