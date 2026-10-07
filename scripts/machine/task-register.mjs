// task-register.mjs - define and register the runtime's per-user Windows scheduled tasks (harness app, harness tunnel, reconciler).
//
// The default output is the exact reviewable PowerShell script. Only --apply crosses the injected schtasks seam.
import os from 'node:os';
import path from 'node:path';
import { allocationSettings } from '../../engine/config.mjs';
import { scheduleRegister as registerScheduledTask } from '../api/schtasks/schedule-register.mjs';
import { resultDetail, resultOk, resultOutput } from '../lib/verb-call.mjs';
import { shortHash } from '../lib/hash.mjs';

/** The Windows task that runs the harness UI: modules/models/runtimes.yaml statusApp.task, the one declaration the reconciler restarts by too. */
const harnessAppTaskName = () => {
  const name = allocationSettings().supervisorTick?.statusApp?.task;
  if (typeof name !== 'string' || !name.trim()) throw new Error('modules/models/runtimes.yaml allocation.supervisorTick.statusApp.task must name the harness app task');
  return name;
};

export const TASK_DEFINITIONS = Object.freeze({
  'harness-app': Object.freeze({
    taskName: harnessAppTaskName(),
    action: 'starci harness start',
    trigger: Object.freeze({ atLogon: true, everyMinutes: null }),
    userContext: 'current interactive user with limited privileges',
  }),
  'harness-tunnel': Object.freeze({
    taskName: 'StarCi Harness Tunnel',
    action: 'starci harness start --tunnel',
    trigger: Object.freeze({ atLogon: true, everyMinutes: null }),
    userContext: 'current interactive user with limited privileges',
  }),
  reconciler: Object.freeze({
    taskName: 'StarCi-Reconciler',
    action: 'starci reconciler start',
    trigger: Object.freeze({ atLogon: true, everyMinutes: 5 }),
    userContext: 'current interactive user with limited privileges',
  }),
});

/** The task names a verb accepts, for its usage message. */
export const KNOWN_TASKS_TEXT = `${Object.keys(TASK_DEFINITIONS).slice(0, -1).join(', ')} or ${Object.keys(TASK_DEFINITIONS).at(-1)}`;

const quote = (value) => String(value).replaceAll("'", "''");
export const taskOf = (name) => TASK_DEFINITIONS[String(name ?? '')] ?? null;

/** The per-user launcher written by `starci runtime install`; retained for internal callers that need the resolved path. */
export const starciShimPath = ({ home = os.homedir(), platform = process.platform } = {}) =>
  (platform === 'win32' ? path.win32 : path.posix).join(home, '.starci', 'bin', platform === 'win32' ? 'starci.cmd' : 'starci');

// The task action's argument line is these parts around the cmd.exe path, the shim path and the starci command; the
// registration script concatenates them in PowerShell and registeredAction concatenates them here, so one table owns both.
const ARGUMENT_PARTS = Object.freeze(['--headless "', '" /d /s /c ""', '" ', '"']);

/** The starci arguments of a task's action (its action without the leading `starci`). */
export const commandOf = (definition) => definition.action.replace(/^starci\s+/, '');

/** The action Task Scheduler reports for a task registered today ("<Execute> <Arguments>"), compared by the host checks. */
export function registeredAction(name, { systemRoot, starci }) {
  const definition = taskOf(name);
  if (!definition) throw new Error(`unknown runtime task: ${name}`);
  const [head, mid, tail, end] = ARGUMENT_PARTS;
  const system32 = path.win32.join(systemRoot, 'System32');
  const argument = `${head}${path.win32.join(system32, 'cmd.exe')}${mid}${starci}${tail}${commandOf(definition)}${end}`;
  return `${path.win32.join(system32, 'conhost.exe')} ${argument}`;
}

const launcherLine = (starci) => starci
  ? `$starci = '${quote(starci)}'`
  : String.raw`$starci = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.starci\bin\starci.cmd'`;

/** Build the exact idempotent, per-user Register-ScheduledTask script for one known runtime task. */
function taskRegistrationScript(name, { taskName, starci, workdir, everyMinutes } = {}) {
  const definition = taskOf(name);
  if (!definition) throw new Error(`unknown runtime task: ${name}`);
  const registeredName = taskName ?? definition.taskName;
  const command = commandOf(definition);
  const every = everyMinutes ?? definition.trigger.everyMinutes;
  const workdirArgument = workdir ? ` -WorkingDirectory '${quote(workdir)}'` : '';
  const action = `$action = New-ScheduledTaskAction -Execute $conhost -Argument $argLine${workdirArgument}`;
  const trigger = every == null ? [
    '$logon = New-ScheduledTaskTrigger -AtLogOn -User $user',
  ] : [
    `$every = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes ${every})`,
    '$logon = New-ScheduledTaskTrigger -AtLogOn -User $user',
    '$logon.Repetition = $every.Repetition',
  ];
  const settings = every == null
    ? "$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden"
    : "$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -Priority 7 -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden";
  const schedule = every == null ? 'at logon, restarted on failure' : `at logon and every ${every} minutes`;
  return [
    "$ErrorActionPreference = 'Stop'",
    String.raw`$conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'`,
    String.raw`$cmd = Join-Path $env:SystemRoot 'System32\cmd.exe'`,
    launcherLine(starci),
    `$argLine = '${ARGUMENT_PARTS[0]}' + $cmd + '${ARGUMENT_PARTS[1]}' + $starci + '${ARGUMENT_PARTS[2]}${command}${ARGUMENT_PARTS[3]}'`,
    action,
    '$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name',
    ...trigger,
    settings,
    '$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited',
    `$registered = Register-ScheduledTask -TaskName '${quote(registeredName)}' -Action $action -Trigger ${every == null ? '$logon' : '@($logon, $every)'} -Settings $settings -Principal $principal -Description 'StarCi scheduled task: ${quote(definition.action)}' -Force`,
    `Write-Output ("registered {0}: ${schedule} -> ${quote(definition.action)}" -f $registered.TaskName)`,
  ].join('\n');
}

/** Existing internal printer names delegate to the one task definition table. */
export const reconcilerTaskScript = (options = {}) => taskRegistrationScript('reconciler', options);
export const harnessTunnelTaskScript = (options = {}) => taskRegistrationScript('harness-tunnel', options);

const refusal = (name) => ({
  code: 2,
  stderr: `starci task register: unknown task "${name}" (expected ${KNOWN_TASKS_TEXT})`,
  data: { schema: 'starci/task-register@1', ok: false, name: String(name ?? '') },
});

/** Print a task registration script, or apply that same script through exactly one external call. */
export async function taskRegister(ctx, deps = {}) {
  const [name, ...extra] = ctx?.positionals ?? [];
  const definition = taskOf(name);
  if (!definition || extra.length) return refusal(name);
  const script = deps.taskRegistrationScript
    ? deps.taskRegistrationScript(name)
    : taskRegistrationScript(name);
  const scriptSha256 = shortHash(script, { n: 16 });
  if (ctx?.args?.apply !== true) {
    return {
      code: 0,
      text: script,
      data: { schema: 'starci/task-register@1', ok: true, applied: false, name, taskName: definition.taskName, action: definition.action, scriptSha256, script },
    };
  }
  if ((deps.platform ?? process.platform) !== 'win32') return { code: 1, stderr: 'starci task register: not-windows: scheduled tasks can only be registered on Windows; print the script without --apply and register it by hand',
    data: { schema: 'starci/task-register@1', ok: false, applied: false, name, reason: 'not-windows' } };
  const result = await (deps.registerScheduledTask ?? registerScheduledTask)(script, { env: ctx?.env });
  const ok = resultOk(result);
  const detail = resultOutput(result).slice(0, 600) || resultDetail(result, { limit: 600 });
  const failureDetail = detail ? `: ${detail}` : '';
  return {
    code: ok ? 0 : 1,
    ...(ok ? { text: detail || `registered ${definition.taskName}: ${definition.action}` }
      : { stderr: `starci task register: failed to register ${definition.taskName}${failureDetail}` }),
    data: { schema: 'starci/task-register@1', ok, applied: true, name, taskName: definition.taskName, action: definition.action, scriptSha256 },
  };
}
