// critic-guard.mjs — binds the Critic's terminal to the guard of the `critic` role (modules/kernel/command-policy.yaml roles.bound).
// The guard names the one directory the Critic may read and the one file it may write (scripts/guards/critic-reach.mjs enforces
// them for its shell, its file tools and, on Claude and Devin, its read tools). The guard is written before the launch and bound
// to the terminal the moment Orca names it; a Critic whose terminal is not bound afterwards is not trusted.
import { boundGuard } from '../guards/rights.mjs';
import { bindGuardTerminal, unbindGuardTerminal, writeJobGuard } from '../guards/hook-install.mjs';

/** The job guard file of a Critic reading `dir` (and the one `taskFile` the runtime wrote outside it) and writing `verdictFile` inside it. */
export function writeCriticGuard({ dir, verdictFile, taskFile = null, context = null, id }) {
  return writeJobGuard({ jobId: `critic-${id}`, workflowId: context?.workflowId ?? null, ledgerRepo: null, owned: [], workflowWorktree: null, role: 'critic',
    op: 'critic', reach: { dir, verdictFile, ...(taskFile ? { taskFile } : {}) } });
}

/** The onCreated callback that binds the Critic's terminal to its guard file. */
export const bindCriticTerminal = (jobFile) => (handle) => bindGuardTerminal({ handle, jobFile });

/** True when the terminal `handle` is bound to a guard of the critic role. */
export const criticBound = (handle) => boundGuard(handle)?.role === 'critic';

/** Removes the binding of the Critic's terminal once the worker is closed. */
export const unbindCriticTerminal = (handle) => unbindGuardTerminal({ handle });
