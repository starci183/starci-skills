// process-kill-verdict.mjs - the command guard's process rules: a kill that selects processes by image name or pattern
// (PROCESS_KILL_BY_NAME), and a kill whose targets come from a process QUERY - Get-CimInstance Win32_Process, Get-Process,
// ps | grep, pgrep - which ends other lanes' processes by their command line, parent or path (a lane killed other lanes'
// node test runs that way, 2026-10-02). An agent ends only a PID it started and recorded: `taskkill /PID <pid>`,
// `kill <pid>`, `Stop-Process -Id <pid>`, or a variable assigned from its own Start-Process or `cmd & pid=$!`.
// Reads (Get-CimInstance listing, `ps aux | grep node`) and text that only mentions these commands pass: the query rule
// judges parsed commands, so an echo, a commit message or a heredoc never reaches it.
import { assignedCommand } from './assigned-command.mjs';
const TASKKILL_SELECTOR = /^(?:\/\/?|-)(?:im|fi)$/i;
const NAME_PARAMETER = /^-(?:n|na|nam|name|processname)(?::.*)?$/i;
const POWERSHELL_STOP = new Set(['stop-process', 'spps']);
const REMEDY = 'end only a PID you started yourself, the one you recorded when you started it (taskkill /PID <pid>, kill <pid>, Stop-Process -Id <pid>), never one found by a query; a process you did not start is reported, never killed';

/** The refusal for one command that kills by name or pattern, or null. */
export const nameKillVerdict = (program, args) => {
  let how = null;
  if (program === 'taskkill' && args.some((a) => TASKKILL_SELECTOR.test(a))) how = 'taskkill by image name or filter (/IM, /FI)';
  else if (program === 'pkill' || program === 'killall') how = `${program}, which selects processes by name or pattern`;
  // PowerShell's kill alias takes the full -Name/-ProcessName; a POSIX `kill -n <signal>` is not a name.
  else if ((POWERSHELL_STOP.has(program) && args.some((a) => NAME_PARAMETER.test(a))) || (program === 'kill' && args.some((a) => /^-(?:name|processname)(?::.*)?$/i.test(a)))) how = 'Stop-Process -Name';
  else if (program === 'wmic' && args.some((a) => /^process$/i.test(a)) && args.some((a) => /\bname\s*=|^name$/i.test(a))) how = 'wmic process selected by name';
  // wmic process where <filter> delete | call terminate, unless the filter is one literal ProcessId.
  else if (program === 'wmic' && args.some((a) => /^process$/i.test(a)) && args.some((a) => /\b(?:delete|terminate)\b/i.test(a)) && !args.some((a) => /(?<![a-z])(?:process)?id\s*=\s*\d+\s*$/i.test(a))) how = 'wmic process ... delete|terminate selected by a filter';
  if (!how) return null;
  return { code: 'PROCESS_KILL_BY_NAME', command: [program, ...args].join(' ').slice(0, 200),
    reason: `${how} ends every process it matches on the machine, including Orca and other agents' workers (a lane's taskkill of node.exe restarted Orca, 2026-10-01)`,
    remedy: REMEDY };
};

const QUERY_PROGRAMS = new Set(['get-process', 'gps', 'ps', 'pgrep', 'pidof', 'tasklist']);
const CIM_PROGRAMS = new Set(['get-ciminstance', 'gcim', 'get-wmiobject', 'gwmi']);
const isQuery = (c) => QUERY_PROGRAMS.has(c.program) || (CIM_PROGRAMS.has(c.program) && c.args.some((a) => /win32_process/i.test(a))) || (c.program === 'wmic' && c.args.some((a) => /^process$/i.test(a)));
const LITERAL = /^\d+(?:,\d+)*$/;
const OPTION_VALUE = /^-(?:ea|erroraction|wa|warningaction|ev|errorvariable|ov|outvariable|s|n|signal)$/i;
const TARGET_OPTION = /^-(?:id|inputobject)$/i;

// The targets one kill command names ([] when it names none: its targets come down a pipe or an xargs).
function targetsOf(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    const inline = /^-(?:id|inputobject):(.*)$/i.exec(a);
    if (inline) out.push(inline[1]);
    else if (TARGET_OPTION.test(a)) { if (i + 1 < args.length) out.push(args[i + 1]); i += 1; }
    else if (OPTION_VALUE.test(a)) i += 1;
    else if (!a.startsWith('-')) out.push(a);
  }
  return out;
}

// A kill sink whose target is not one literal PID: how it is spelled, or null.
function sinkOf(c) {
  const { program, args } = c;
  if (POWERSHELL_STOP.has(program) || program === 'kill') {
    if (args.some((a) => /^-l$/.test(a))) return null;
    const targets = targetsOf(args);
    return targets.length && targets.every((t) => LITERAL.test(t)) ? null : program === 'kill' ? 'kill' : 'Stop-Process';
  }
  if (program === 'taskkill') {
    const at = args.findIndex((a) => /^(?:\/\/?|-)pid$/i.test(a));
    return at >= 0 && !LITERAL.test(args[at + 1] ?? '') ? 'taskkill /PID' : null;
  }
  if (program === 'invoke-cimmethod' && args.some((a) => /^terminate$/i.test(a))) return 'Invoke-CimMethod Terminate';
  if (/\.(?:terminate|kill)$/.test(program)) return `.${program.split('.').pop()}()`;
  return null;
}

// The variables a kill names in the raw text, once per kill: `Stop-Process -Id $p.Id`, `$p | Stop-Process`, `$p.Kill()`,
// `kill $pid`, `kill $!`. A kill target that is no plain variable (a $(...), a pipe from a query) names none.
const ROOTS = [
  /\b(?:stop-process|spps|kill|taskkill)\b(?:\s+(?:-(?:id|inputobject)(?::|\s+)|(?:\/\/?|-)pid\s+|-\w+\s+(?=\S*\$)))*\s*"?\$(\w+|!)/gi,
  /\$(\w+)\s*\|\s*(?:stop-process|spps)\b/gi,
  /\$(\w+)\.(?:terminate|kill)\s*\(/gi,
];
const OWN_START = (root) => new RegExp(root === '!' ? '$^' : `(?:\\$${root}\\s*=\\s*\\(?\\s*(?:start-process|start-job|\\[[\\w.]+\\]::start)\\b|(?<![\\w$])${root}=\\$!)`, 'i');

/** The refusal for a kill whose targets come from a process query, or null. `commands` are the parsed commands, `text` the raw call. */
export function queryKillVerdict(parsed, text) {
  const commands = parsed.map(assignedCommand);
  if (!commands.some(isQuery)) return null;
  const sinks = commands.map((c) => [c, sinkOf(c)]).filter(([, how]) => how);
  if (!sinks.length) return null;
  const roots = ROOTS.flatMap((re) => [...String(text).matchAll(re)].map((m) => m[1]));
  if (roots.length >= sinks.length && roots.every((r) => r === '!' || OWN_START(r).test(text))) return null;
  const [c, how] = sinks[0];
  return { code: 'PROCESS_KILL_BY_NAME', command: [c.program, ...c.args].join(' ').slice(0, 200),
    reason: `${how} on targets found by a process query (Get-CimInstance Win32_Process, Get-Process, ps, pgrep) ends other lanes' and agents' processes selected by command line, name, path or parent - not a process you started`,
    remedy: REMEDY };
}
