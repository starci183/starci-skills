// orca-relay.mjs — an owner or Supervisor `starci workflow start` run from a shell Orca did not open (the owner's chat, an
// agent's tool shell). A Kernel launch needs a live Orca terminal as its sender (workflow-startup.mjs workflowSender), so the
// start relays itself: it opens a plain PowerShell terminal (scripts/api/orca/terminal-create.mjs) in the runtime's own
// worktree whose startup command is the start relay (scripts/kernel/start-relay.mjs), which runs the same start inside it,
// waits for the relay's receipt and answers with the start's own output and exit code. It launches no agent itself and
// never sets ORCA_TERMINAL_HANDLE.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runtimeStateDir } from '../../engine/runtime-root.mjs';
import { terminalCreate } from '../api/orca/terminal-create.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { parseJsonOr } from '../lib/json.mjs';

// The relay's own start bound (270 s) plus the shell's startup.
const RELAY_TIMEOUT_MS = 300000;
const POLL_MS = 1000;

const finish = ({ stdout = '', stderr = '', note }, exitCode) => {
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  console.error(`start-workflow: ${note}`);
  process.exit(exitCode);
};

/**
 * Run `starci workflow start` in a new plain Orca terminal and exit with its exit code; never returns.
 * @param {object} input - repo, goal and agent of this start, and asJson (the relayed start prints its JSON receipt).
 */
export function relayIntoOrca({ repo, goal = null, agent = null, asJson = false }) {
  const resultFile = path.join(runtimeStateDir(), 'start-relay', `${goal ?? 'queued'}-${crypto.randomUUID()}.json`);
  const created = terminalCreate({ repo, goal, agent, asJson, resultFile });
  const handle = created.result?.terminal?.handle ?? created.result?.handle ?? null;
  if (created.outcome !== 'ok') {
    const custody = created.effectState === 'none' ? 'no terminal was created' : 'whether a terminal was created is unknown: read orca terminal list before any retry';
    finish({ note: `orca-relay: ${custody} (${created.error?.message ?? created.error ?? 'refused'})` }, 1);
  }
  const deadline = Date.now() + RELAY_TIMEOUT_MS;
  while (!fs.existsSync(resultFile) && Date.now() < deadline) sleepSync(POLL_MS);
  const receipt = fs.existsSync(resultFile) ? parseJsonOr(fs.readFileSync(resultFile, 'utf8')) : null;
  if (!receipt) {
    finish({ note: `orca-relay: the start relayed into Orca terminal ${handle ?? '(handle not in the receipt)'} gave no receipt within ${RELAY_TIMEOUT_MS} ms; read it with starci orca terminal-read --terminal ${handle ?? '<handle>'} and starci workflow status before any retry` }, 1);
  }
  fs.rmSync(resultFile, { force: true });
  const where = receipt.terminal ?? handle;
  finish({ stdout: receipt.stdout, stderr: receipt.stderr,
    note: `relayed into Orca terminal ${where} (this shell has no ORCA_TERMINAL_HANDLE); ${receipt.exitCode === 0 ? "that terminal stays open as the Kernel's entry coordinator" : 'that terminal closes itself'}` }, receipt.exitCode);
}
