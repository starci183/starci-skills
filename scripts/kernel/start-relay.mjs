#!/usr/bin/env node
// start-relay.mjs — internal entry: the startup command of the plain Orca shell `starci workflow start-in-orca` opens
// (scripts/api/orca/terminal-create.mjs). Inside that shell Orca has set
// ORCA_TERMINAL_HANDLE, so `starci workflow start` (scripts/kernel/start-workflow.mjs, launched by the supervisor) gets
// the sender terminal it needs. The relay prints the start's output in the shell and writes the receipt the caller waits
// for; the shell stays open because it coordinates the Kernel's entry Run.
// Arguments: --result <file> --repo <app> [--goal <workflow_id>] [--agent <agent>].
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { readEnv } from '../lib/env.mjs';
import { arg as argvValue } from '../lib/cli-arg.mjs';

const START = path.join(skillRoot, 'scripts', 'kernel', 'start-workflow.mjs');
// Above start-workflow's own Kernel start reservation (240 s): worker-start blocks until the agent is ready.
const START_TIMEOUT_MS = 270000;
const arg = (name) => argvValue(process.argv, name, null);

const resultFile = arg('result');
const repo = arg('repo');
if (!resultFile || !repo) {
  console.error('start-relay: --result and --repo are required');
  process.exit(2);
}
const terminal = String(readEnv('ORCA_TERMINAL_HANDLE') ?? '').trim();
const goal = arg('goal');
const agent = arg('agent');
const writeReceipt = (receipt) => {
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(`${resultFile}.tmp`, `${JSON.stringify({ schema: 'starci/start-relay@1', terminal: terminal || null, ...receipt }, null, 2)}\n`);
  fs.renameSync(`${resultFile}.tmp`, resultFile);
};

if (terminal) {
  console.log(`starci workflow start (relay in Orca terminal ${terminal}) for ${goal ?? 'the oldest queued goal'} of ${repo} ...`);
  const run = runNode([START, '--repo', repo, ...(goal ? ['--goal', goal] : []), ...(agent ? ['--agent', agent] : []), '--launched-by', 'supervisor'],
    { cwd: skillRoot, timeout: START_TIMEOUT_MS });
  const stdout = String(run.stdout ?? '').trimEnd();
  const stderr = String(run.stderr ?? '').trimEnd();
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  const exitCode = run.status ?? 1;
  writeReceipt({ exitCode, stdout, stderr, error: run.error?.message ?? null });
  console.log(exitCode === 0 ? "start-relay: workflow start exited 0; this terminal stays open as the Kernel's entry coordinator."
    : `start-relay: workflow start exited ${exitCode}; this terminal closes.`);
  process.exitCode = exitCode;
} else {
  writeReceipt({ exitCode: 2, stdout: '', stderr: '', error: 'ORCA_TERMINAL_HANDLE is not set: the relay runs only inside the Orca terminal start-in-orca opens' });
  console.error('start-relay: ORCA_TERMINAL_HANDLE is not set; nothing was started');
  process.exitCode = 2;
}
