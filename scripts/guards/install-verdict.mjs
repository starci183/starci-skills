// The refusals of install-family and Kernel-mailbox commands, split out of command-guard.mjs (which calls them).
/** The install-through-link refusal of one npm/pnpm/yarn command (no guard needed), or null. `npm`: deps-guard.mjs. */
export function installLinkVerdict({ program, args, cwd, npm }) {
  if (npm.classifyInstall(program, args).kind === 'pass') return null;
  const linked = npm.linkedNodeModulesOf(program, args, cwd);
  if (!linked) return null;
  return { tool: program, code: 'DEPS_THROUGH_LINK', command: `${program} ${args.join(' ')}`.slice(0, 200),
    reason: `${linked.nodeModules} is a link to ${linked.target ?? 'another tree'}: ${program} would empty that live node_modules`,
    remedy: 'node_modules here is a link to another checkout: unlink it first (cmd /c rmdir) and install for real' };
}

export async function installVerdict({ program, args, cwd, guard, deps }) {
  const { classifyInstall, peerLeasedJobs } = deps.npm;
  const kind = classifyInstall(program, args).kind;
  if (kind === 'pass') return null;
  const command = `${program} ${args.join(' ')}`.slice(0, 200);
  const linked = installLinkVerdict({ program, args, cwd, npm: deps.npm });
  if (linked) return linked;
  if (kind !== 'clean-install' || !guard?.ledgerRepo) return null;
  let peers;
  try { peers = await peerLeasedJobs({ ledgerRepo: guard.ledgerRepo, workflowId: guard.workflowId }); }
  catch (e) { deps.say(`starci guard: could not read peer leases (${e?.message ?? e})`); return null; }
  if (!peers.jobs.length) return null;
  const names = peers.jobs.slice(0, 5).map((j) => `${j.jobId} (${j.workflowId})`).join(', ');
  return { tool: 'npm', code: 'DEPS_DELETE_WHILE_PEER_LEASED', command,
    reason: `${command} deletes node_modules while other workflows' jobs run checks from it: ${names}`,
    remedy: 'use `npm install`, or report blocked environment naming the missing dependency' };
}

// The Kernel never reads Orca's mailbox itself: `orchestration check --ack` consumes deliveries before the ledger records
// them, so it reads through `api messages` / `api questions` and the runtime's api drains (lane MAILC). Ops and
// [Worker]s keep `check`: Orca's worker protocol has them read their own Run's deliveries (modules/host/orca/api.yaml
// operationAgent), and no ledger record depends on those.
export function kernelMailboxVerdict(program, args, guard) {
  if (program !== 'orca' || guard?.role !== 'kernel') return null;
  const words = args.filter((a) => !/^-/.test(a));
  if (words[0] !== 'orchestration' || words[1] !== 'check') return null;
  return { code: 'KERNEL_ORCA_CHECK', command: ['orca', ...args].join(' ').slice(0, 200),
    reason: 'the Kernel never runs orca orchestration check: its --ack consumes deliveries before the ledger records them',
    remedy: 'read messages with `node <api> messages --repo <repo> --workflow <id>` and questions with `api questions`; the runtime drains the mailbox' };
}
