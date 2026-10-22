// terminal-create.mjs — the calls.yaml `terminal-create` call: the plain Orca shell that is the sender terminal of an owner
// or Supervisor `starci workflow start` run from a shell Orca did not open (scripts/kernel/orca-relay.mjs). It launches no agent
// (every agent is an orchestration worker-start worker). Its worktree is the runtime's own registered worktree, its shell
// powershell.exe, its title fixed, and its startup command is the runtime's own start relay with validated arguments; no
// caller-supplied command, environment, focus, agent or retry identity.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../../engine/runtime-root.mjs';
import { orcaCall } from './lib.mjs';

const RELAY = path.join(skillRoot, 'scripts', 'kernel', 'start-relay.mjs');
const ID = /^[a-z0-9][a-z0-9-]{0,127}$/;
// A path PowerShell takes verbatim inside double quotes: no quote, backtick, dollar sign or line break.
const PLAIN_PATH = /^[^"`$\r\n]+$/;

const notIssued = (error) => ({ outcome: 'failed', effectState: 'none', result: null, error, issued: false });
const quoted = (value) => `"${value}"`;

/**
 * Open the start relay's plain PowerShell terminal in the runtime's own worktree; Orca gives the relay the
 * ORCA_TERMINAL_HANDLE a Kernel launch needs as its sender. A refused input issues nothing.
 * @param {object} input - repo (an existing app directory), goal and agent (ids, optional), asJson, resultFile (the relay's receipt).
 * @returns {object} The native call envelope, or a local refusal before any mutation (effectState none).
 */
export function terminalCreate({ repo, goal = null, agent = null, asJson = false, resultFile }) {
  if (!path.isAbsolute(String(repo)) || !PLAIN_PATH.test(repo) || !fs.existsSync(repo)) return notIssued(`the app repository is not a plain existing absolute path: ${repo}`);
  if (goal !== null && !ID.test(goal)) return notIssued(`the goal is not a workflow id: ${goal}`);
  if (agent !== null && !ID.test(agent)) return notIssued(`the agent is not an agent id: ${agent}`);
  if (!path.isAbsolute(String(resultFile)) || !PLAIN_PATH.test(resultFile)) return notIssued('the relay receipt path is not a plain absolute path');
  const argv = [quoted(process.execPath), quoted(RELAY), '--result', quoted(resultFile), '--repo', quoted(repo),
    ...(goal ? ['--goal', goal] : []), ...(agent ? ['--agent', agent] : []), ...(asJson ? ['--json'] : [])];
  // A refused start closes its shell; a booted Kernel keeps it, as the coordinator of its entry Run.
  const command = `& ${argv.join(' ')}; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`;
  return orcaCall('terminal-create', { worktree: `path:${skillRoot}`, shell: 'powershell.exe', title: `[Start] ${goal ?? 'queued goal'}`, command });
}
