// The refusals of agent launches outside Orca (raw terminal create, headless agent CLIs), split out of command-guard.mjs.
// An agent launch outside Orca is invisible to it: no liveness, no stop, no release, and a dead worker sits unnoticed
// (owner rule 2026-10-01). Every agent and every worker terminal starts through `orca orchestration worker-start`.
const WORKER_START = '`orca orchestration worker-start --agent <provider> [--model <id>] --worktree <selector> --spec "<task>" --task-title "<title>"`, supervised with worker-show / worker-read / worker-stop / worker-release';
// The first non-flag word of `args`, skipping the values of `valued` flags.
const subcommandOf = (args, valued) => {
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--') return args[i + 1] ?? null;
    if (/^-/.test(a)) { if (valued.test(a)) i += 1; continue; }
    return a;
  }
  return null;
};
const CODEX_VALUED = /^(?:-m|--model|-c|--config|-C|--cd|-s|--sandbox|-a|--ask-for-approval|-p|--profile|-i|--image|--enable|--disable|--add-dir|--local-provider)$/;
const printFlag = (args, flags) => {
  const options = args.includes('--') ? args.slice(0, args.indexOf('--')) : args;
  return options.find((a) => flags.includes(a)) ?? null;
};
const launchRefusal = (program, args, how) => ({ command: [program, ...args].join(' ').slice(0, 200),
  reason: `${how} outside Orca's supervision: no liveness, no stop or release, and a dead worker goes unnoticed (owner rule 2026-10-01)`,
  remedy: `launch every agent and worker through ${WORKER_START}` });
export const launchVerdict = (program, args) => {
  if (program === 'orca') {
    const words = args.filter((a) => !/^-/.test(a));
    if (words[0] === 'terminal' && words[1] === 'create') return { code: 'RAW_TERMINAL_CREATE', ...launchRefusal(program, args, 'a raw terminal create starts a terminal outside worker-start') };
    return null;
  }
  let how = null;
  if (program === 'codex') {
    const sub = subcommandOf(args, CODEX_VALUED);
    if (sub === 'exec' || sub === 'e') how = `codex ${sub} runs a headless Codex agent`;
  } else if (program === 'claude' || program === 'cursor-agent' || program === 'devin') {
    const flag = printFlag(args, ['-p', '--print']);
    if (flag) how = `${program} ${flag} runs a headless agent`;
  } else if (program === 'gemini') {
    const flag = printFlag(args, ['-p', '--prompt']);
    if (flag) how = `gemini ${flag} runs a headless agent`;
  } else if (program === 'opencode') {
    if (subcommandOf(args, /^(?:-m|--model|--agent|--log-level)$/) === 'run') how = 'opencode run runs a headless agent';
  }
  return how ? { code: 'AGENT_HEADLESS_LAUNCH', ...launchRefusal(program, args, how) } : null;
};
