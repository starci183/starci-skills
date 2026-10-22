#!/usr/bin/env node
// start-in-orca.mjs — `starci workflow start-in-orca`: an owner or Supervisor `starci workflow start` asked for from a
// shell Orca did not open (the owner's chat, an agent's tool shell). A Kernel launch needs a live Orca terminal as its
// sender (workflow-startup.mjs workflowSender), so this verb opens a plain PowerShell terminal
// (scripts/api/orca/terminal-create.mjs) in the runtime's own worktree, whose startup
// command is the start relay (scripts/kernel/start-relay.mjs), waits for the relay's receipt and answers with the start's
// own output and exit code. It launches no agent itself and never sets ORCA_TERMINAL_HANDLE.
//   starci workflow start-in-orca --repo <app> [--goal <workflow_id>] [--agent <agent>] [--timeout-ms <ms>] [--json]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runtimeStateDir } from '../../engine/runtime-root.mjs';
import { terminalCreate } from '../api/orca/terminal-create.mjs';
import { readEnv } from '../lib/env.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { arg as argvValue } from '../lib/cli-arg.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { invocationDir } from '../lib/roots.mjs';

// The relay's own start bound (270 s) plus the shell's startup.
const DEFAULT_TIMEOUT_MS = 300000;
const POLL_MS = 1000;
const arg = (name, fallback = null) => argvValue(process.argv, name, fallback);
const asJson = process.argv.includes('--json');

const answer = (report, exitCode) => {
  if (asJson) console.log(JSON.stringify({ schema: 'starci/workflow-start-in-orca@1', ...report }, null, 2));
  else {
    if (report.stdout) console.log(report.stdout);
    if (report.stderr) console.error(report.stderr);
    if (report.message) (exitCode === 0 ? console.log : console.error)(`start-in-orca: ${report.message}`);
  }
  process.exit(exitCode);
};

if (String(readEnv('ORCA_TERMINAL_HANDLE') ?? '').trim()) {
  answer({ ok: false, step: 'already-in-orca', message: 'this shell is an Orca terminal already: run starci workflow start here' }, 2);
}
const repo = path.resolve(arg('repo', invocationDir()));
const goal = arg('goal');
const agent = arg('agent');
const timeoutMs = Number(arg('timeout-ms', DEFAULT_TIMEOUT_MS));
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) answer({ ok: false, step: 'bad-usage', message: `--timeout-ms must be a positive number (got ${arg('timeout-ms')})` }, 2);

const resultFile = path.join(runtimeStateDir(), 'start-relay', `${goal ?? 'queued'}-${crypto.randomUUID()}.json`);
const created = terminalCreate({ repo, goal, agent, resultFile });
const handle = created.result?.terminal?.handle ?? created.result?.handle ?? null;
if (created.outcome !== 'ok') {
  const custody = created.effectState === 'none' ? 'no terminal was created' : 'whether a terminal was created is unknown: read orca terminal list before any retry';
  answer({ ok: false, step: 'relay-terminal', effectState: created.effectState ?? 'unknown', message: `${custody} (${created.error?.message ?? created.error ?? 'refused'})` }, 1);
}

const deadline = Date.now() + timeoutMs;
while (!fs.existsSync(resultFile) && Date.now() < deadline) sleepSync(POLL_MS);
const receipt = fs.existsSync(resultFile) ? parseJsonOr(fs.readFileSync(resultFile, 'utf8')) : null;
if (!receipt) {
  answer({ ok: false, step: 'relay-timeout', terminal: handle,
    message: `the start relay in Orca terminal ${handle ?? '(handle not in the receipt)'} gave no receipt within ${timeoutMs} ms; read it with starci orca terminal-read --terminal ${handle ?? '<handle>'} and starci workflow status before any retry` }, 1);
}
fs.rmSync(resultFile, { force: true });
answer({ ok: receipt.exitCode === 0, step: 'relayed', terminal: receipt.terminal ?? handle, exitCode: receipt.exitCode, stdout: receipt.stdout, stderr: receipt.stderr,
  message: `workflow start ran in Orca terminal ${receipt.terminal ?? handle} and exited ${receipt.exitCode}; ${receipt.exitCode === 0 ? "that terminal stays open as the Kernel's entry coordinator" : 'that terminal closes itself'}` }, receipt.exitCode);
