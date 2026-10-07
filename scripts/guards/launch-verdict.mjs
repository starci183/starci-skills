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
    if (a.startsWith('-')) {
      if (valued.test(a)) { i += 1; }
      continue;
    }
    return a;
  }
  return null;
};
const CODEX_VALUED = /^(?:-m|--model|-c|--config|-C|--cd|-s|--sandbox|-a|--ask-for-approval|-p|--profile|-i|--image|--enable|--disable|--add-dir|--local-provider)$/;
const printFlag = (args, flags) => {
  const options = args.includes('--') ? args.slice(0, args.indexOf('--')) : args;
  return options.find((a) => flags.includes(a)) ?? null;
};
// The one headless call the runtime makes for an op (tiers.yaml calls.imagegen; owner decision 2026-10-07).
const IMAGE_CALL = ' An image is generated with `starci work imagegen` (interface.draw, interface.asset and brand.decide), never with a hand-run codex exec.';
const launchRefusal = (program, args, how) => ({ command: [program, ...args].join(' ').slice(0, 200),
  reason: `${how} outside Orca's supervision: no liveness, no stop or release, and a dead worker goes unnoticed (owner rule 2026-10-01)`,
  remedy: `launch every agent and worker through ${WORKER_START}${program === 'codex' ? IMAGE_CALL : ''}` });
// The workspace and runtime rules (workspace.manage, runtime.operate; OPS2 3.1): an agent never creates or removes an Orca
// worktree itself - the runtime's worktree API (scripts/machine/worktree-orca.mjs createOrcaWorktree / removeOrcaWorktree,
// releaseWorkflowWorktree) runs the link check first and keeps the registry and its cap (git worktree writes are
// git-policy.mjs WORKTREE_NOT_OPS).
const ORCA_WORKTREE_WRITES = new Set(['create', 'add', 'rm', 'remove', 'delete', 'prune', 'move']);
// The uat rule (uat.verify, uat.assisted.*; OPS2 3.1): a walk runs on the app's real dev stack, never a test world.
const TEST_WORLD_RUNNER = /(?:^|[\\/])test-world-run\.mjs$/;
const testWorldOf = (program, args) => {
  if (program === 'node' && args.some((a) => TEST_WORLD_RUNNER.test(a))) return 'test-world-run.mjs';
  if (program !== 'starci') return null;
  const words = args.filter((a) => !a.startsWith('-'));
  return words[0] === 'gate' && words[1] === 'test-world' ? 'starci gate test-world' : null;
};
const headlessHow = (program, args) => {
  if (program === 'codex') {
    const sub = subcommandOf(args, CODEX_VALUED);
    return sub === 'exec' || sub === 'e' ? `codex ${sub} runs a headless Codex agent` : null;
  }
  if (program === 'claude' || program === 'cursor-agent' || program === 'devin') {
    const flag = printFlag(args, ['-p', '--print']);
    return flag ? `${program} ${flag} runs a headless agent` : null;
  }
  if (program === 'gemini') {
    const flag = printFlag(args, ['-p', '--prompt']);
    return flag ? `gemini ${flag} runs a headless agent` : null;
  }
  if (program === 'opencode' && subcommandOf(args, /^(?:-m|--model|--agent|--log-level)$/) === 'run') return 'opencode run runs a headless agent';
  return null;
};
export const launchVerdict = (program, args, guard = null) => {
  if (program === 'orca') {
    const words = args.filter((a) => !a.startsWith('-'));
    if (words[0] === 'terminal' && words[1] === 'create') return { code: 'RAW_TERMINAL_CREATE', ...launchRefusal(program, args, 'a raw terminal create starts a terminal outside worker-start') };
    if (words[0] === 'worktree' && ORCA_WORKTREE_WRITES.has(words[1])) return { code: 'AGENT_ORCA_WORKTREE', command: [program, ...args].join(' ').slice(0, 200),
      reason: `orca worktree ${words[1]}: an agent never creates or removes a worktree - a removal without the runtime's link check follows node_modules junctions into the live tree (inc-c8fbf76aa499), and a tree outside the registry escapes its cap and GC`,
      remedy: 'inspect with `starci machine worktrees counts`; worktrees are created and removed only by the runtime worktree API (scripts/machine/worktree-orca.mjs createOrcaWorktree / removeOrcaWorktree, scripts/kernel/workflow-worktree.mjs releaseWorkflowWorktree); report a need you cannot meet as blocked environment' };
    return null;
  }
  const testWorld = String(guard?.op ?? '').startsWith('uat.') ? testWorldOf(program, args) : null;
  if (testWorld) return { code: 'UAT_TEST_WORLD', command: [program, ...args].join(' ').slice(0, 200),
    reason: `${guard.op} walks the app's real dev stack: a test world (${testWorld}) fakes what the walk must prove`,
    remedy: 'bring up the dev stack the app-root .starcistacks/<env> declares with its own start commands, check it with env-health, and walk it; a stack that will not come up is reported blocked environment' };
  const how = headlessHow(program, args);
  return how ? { code: 'AGENT_HEADLESS_LAUNCH', ...launchRefusal(program, args, how) } : null;
};
