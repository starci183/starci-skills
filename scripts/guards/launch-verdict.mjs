// The refusals of launches outside the runtime (raw terminal create, headless agent CLIs, an agent's own Orca worktree, a test
// world in a uat op), split out of command-guard.mjs.
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
// The workspace and runtime rules (workspace.manage, runtime.operate; OPS2 3.1): an agent never creates or removes an Orca
// worktree itself - the runtime's worktree API (scripts/machine/worktree-orca.mjs createOrcaWorktree / removeOrcaWorktree,
// releaseWorkflowWorktree) runs the link check first and keeps the registry and its cap (git worktree writes are
// git-policy.mjs WORKTREE_NOT_OPS).
const ORCA_WORKTREE_WRITES = new Set(['create', 'add', 'rm', 'remove', 'delete', 'prune', 'move']);
// The uat rule (uat.verify, uat.assisted.*; OPS2 3.1): a walk runs on the app's real dev stack, never a test world.
const TEST_WORLD_RUNNER = /(?:^|[\\/])test-world-run\.mjs$/;
export const launchVerdict = (program, args, guard = null) => {
  if (program === 'orca') {
    const words = args.filter((a) => !/^-/.test(a));
    if (words[0] === 'terminal' && words[1] === 'create') return { code: 'RAW_TERMINAL_CREATE', ...launchRefusal(program, args, 'a raw terminal create starts a terminal outside worker-start') };
    if (words[0] === 'worktree' && ORCA_WORKTREE_WRITES.has(words[1])) return { code: 'AGENT_ORCA_WORKTREE', command: [program, ...args].join(' ').slice(0, 200),
      reason: `orca worktree ${words[1]}: an agent never creates or removes a worktree - a removal without the runtime's link check follows node_modules junctions into the live tree (inc-c8fbf76aa499), and a tree outside the registry escapes its cap and GC`,
      remedy: 'inspect with `starci machine worktrees counts`; worktrees are created and removed only by the runtime worktree API (scripts/machine/worktree-orca.mjs createOrcaWorktree / removeOrcaWorktree, scripts/kernel/workflow-worktree.mjs releaseWorkflowWorktree); report a need you cannot meet as blocked environment' };
    return null;
  }
  if (program === 'node' && /^uat\./.test(String(guard?.op ?? '')) && args.some((a) => TEST_WORLD_RUNNER.test(a))) return { code: 'UAT_TEST_WORLD', command: [program, ...args].join(' ').slice(0, 200),
    reason: `${guard.op} walks the app's real dev stack: a test world (test-world-run.mjs) fakes what the walk must prove`,
    remedy: 'bring up the dev stack the app-root .starcistacks/<env> declares with its own start commands, check it with env-health, and walk it; a stack that will not come up is reported blocked environment' };
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
