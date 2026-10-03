// op-placement.mjs — the explicit operator placement for specs whose workflows never had a Kernel start. Every workflow in a
// git checkout works in its Orca-made workflow worktree (owner decision WFWT, scripts/kernel/workflow-worktree.mjs), and
// starci kernel dispatch refuses an op of a workflow without one (workflow-worktree-missing). A spec about leases, host resources or
// repository targeting dispatches with `--worktree <repo>`: the op is placed on the repo checkout itself, exactly where
// it ran before the workflow worktree existed. Anything else passes through unchanged.
export const placeOnRepo = (args, repo) => (args.includes('dispatch') && args.includes('--spawn') && !args.includes('--worktree') ? [...args, '--worktree', repo] : args);
