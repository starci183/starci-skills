// env-dump-verdict.mjs - the command guard's ENV_DUMP rule: a command that writes the WHOLE environment to output (`env`,
// `printenv`, bare `set`, `export -p`, `declare -x|-p`, `Get-ChildItem env:`, [Environment]::GetEnvironmentVariables(),
// `node -p process.env`, `python -c "print(os.environ)"`, `cmd /c set`). The environment carries every token and key the
// session holds (the AWS, Azure and Anthropic values reached a transcript through `env | grep ... | sed`); a filter or a
// redaction after the dump does not make it safe, because names outside the pattern leak. Reading ONE named variable
// (`echo $PATH`, `printenv HOME`, `$env:PATH`, process.env.HOME), `env VAR=x cmd`, `env -u VAR cmd` and shell options
// (`set -e`, `set -euo pipefail`) pass, and so does any text that only mentions these commands: the rule judges parsed
// commands, so an echo, a commit message, a heredoc or a comment never reaches it.
import { assignedCommand } from './assigned-command.mjs';

const ENV_DRIVE = /^env:[\\/]?\*?$/i;
const LISTERS = new Set(['get-childitem', 'gci', 'dir', 'ls', 'get-item', 'gi']);
const GET_ENV = /^\[(?:system\.)?environment\]::getenvironmentvariables$/i;
const NODE_PROGRAMS = new Set(['node', 'nodejs']);
const PYTHON_PROGRAMS = new Set(['python', 'python3', 'python2', 'py']);
// process.env as the whole argument of a printing or serialising call; or the whole value of `node -p`.
const NODE_WHOLE = new RegExp([
  String.raw`(?:console\.\w+|JSON\.stringify|util\.inspect|\binspect|Object\.(?:keys|entries|values)|process\.std(?:out|err)\.write|require\(['"]fs['"]\)\.\w+|writeFileSync)`,
  String.raw`\s*\(\s*(?:[^()]*,\s*)?process\.env\s*[,)]`,
].join(''));
const NODE_PRINT_WHOLE = new RegExp([String.raw`^\s*`, String.raw`process\.env`, String.raw`\s*;?\s*$`].join(''));
const PYTHON_WHOLE = new RegExp([
  String.raw`(?:\bprint|pprint|json\.dumps|\bdict|\blist|\bsorted|\brepr|\bstr)`,
  String.raw`\s*\(\s*(?:[^()]*,\s*)?(?:os\.)?environ\s*[,)\]]|\benviron\.(?:items|keys|values|copy)\s*\(`,
].join(''));
const PYTHON_OUTPUT = /\bprint\b|pprint|json\.dumps|stdout|\.write\(/;

const refusal = (c, how) => ({ code: 'ENV_DUMP', command: [c.program, ...c.args].join(' ').slice(0, 200),
  reason: `${how} writes the whole environment to output, including every token and key the session holds; a grep or a redaction after it still leaks the names it does not match (the AWS, Azure and Anthropic values reached a transcript that way)`,
  remedy: 'read only the one named, non-secret variable you need (echo $NAME, $env:NAME, printenv NAME); never dump the environment' });

const namesNothing = (args) => !args.some((a) => !a.startsWith('-'));
const scriptAfter = (args, flag) => { const at = args.findIndex((a) => flag.test(a)); return at >= 0 ? args[at + 1] ?? '' : null; };

/** The shell-form dumpers (env/printenv/set/export/declare, PowerShell env: listers, GetEnvironmentVariables). */
const shellDumpVerdict = (c) => {
  const { program, args, dialect } = c;
  // A relative path such as runtime/env is a file of that name, not the env program (an absolute path still is).
  const relative = /[\\/]/.test(String(c.word ?? '')) && !/^(?:[a-z]:)?[\\/]/i.test(String(c.word));
  if ((program === 'env' || program === 'printenv') && !relative) return namesNothing(args) ? refusal(c, program) : null;
  if (program === 'set') return args.length === 0 && dialect !== 'powershell' ? refusal(c, 'set') : null;
  if (program === 'export') return args.length === 0 || (args.length === 1 && args[0] === '-p') ? refusal(c, 'export -p') : null;
  if (program === 'declare' || program === 'typeset') {
    const options = args.filter((a) => /^-[a-zA-Z]+$/.test(a)).join('');
    return namesNothing(args) && (!options || /[xp]/.test(options)) ? refusal(c, `${program} with no name`) : null;
  }
  if (LISTERS.has(program) && args.some((a) => ENV_DRIVE.test(a))) return refusal(c, `${program} env:`);
  if (GET_ENV.test(program)) return refusal(c, '[Environment]::GetEnvironmentVariables()');
  return null;
};

/** `node -p|-e` whose script body prints or serializes process.env whole. */
const nodeDumpHow = (args) => {
  const print = scriptAfter(args, /^(?:-p|--print)$/);
  const evalOnly = scriptAfter(args, /^(?:-e|--eval)$/);
  const body = print ?? evalOnly;
  return body != null && (NODE_WHOLE.test(body) || (print != null && NODE_PRINT_WHOLE.test(body))) ? 'a node script printing process.env' : null;
};

/** `python -c` whose script body prints os.environ. */
const pythonDumpHow = (args) => {
  const body = scriptAfter(args, /^-c$/);
  return body != null && PYTHON_WHOLE.test(body) && PYTHON_OUTPUT.test(body) ? 'a python script printing os.environ' : null;
};

/** The ENV_DUMP refusal for one parsed command, or null. */
const interpreterDumpVerdict = (c) => {
  if (NODE_PROGRAMS.has(c.program)) { const how = nodeDumpHow(c.args); if (how) return refusal(c, how); }
  if (PYTHON_PROGRAMS.has(c.program)) { const how = pythonDumpHow(c.args); if (how) return refusal(c, how); }
  return null;
};

export function envDumpVerdict(parsed) {
  const c = assignedCommand(parsed);
  const shell = shellDumpVerdict(c);
  if (shell) return shell;
  return interpreterDumpVerdict(c);
}
