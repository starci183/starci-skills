// run-shell.mjs — run one operator-given command line through the shell with the parent's stdio and extra environment
// (scripts/gates/custody-exec.mjs execWithCustody: the command the operator asked to run with the custody keys).
import { spawnSync } from 'node:child_process';

/** The command's exit status (1 when it reported none). `env` is added to this process's environment. */
export function runShellInherit(command, env = {}) {
  const child = spawnSync(command, { shell: true, stdio: 'inherit', env: { ...process.env, ...env } });
  return child.status ?? 1;
}
