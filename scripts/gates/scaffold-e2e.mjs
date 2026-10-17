#!/usr/bin/env node
// scaffold-e2e.mjs - `starci release scaffold-e2e`: the scaffold end-to-end proof of the runtime. With the package clean-test it is one of the two real
// test proofs of the runtime (owner ruling no-runtime-specs, 2026-10-17: the runtime carries no specs of its own; package specs and the scaffold e2e decide).
// It runs e2e/hfs-scaffold-app.e2e.spec.mjs (the full scaffold: npm ci, typecheck, lint, the be unit run, cli migrate over a real Postgres) and
// e2e/hfs-scaffold-lite.e2e.spec.mjs (the lite scaffold over its own local Supabase stack) under the e2e preloads (e2e/setup: low priority and the file
// watchdog, a private temp root with the repository-root guard, a private machine registry, the regenerated runtime copies).
// A skipped test is red here: the proof is that every scaffold test RAN (Docker, npm and the source canon registry are prerequisites, never optional).
//
//   starci release scaffold-e2e        exit 0 every test passed and none skipped, 1 a test failed, was cancelled or skipped, 2 the run could not start
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { tapSummary } from '../lib/tap-summary.mjs';
import { isMain } from '../lib/is-main.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The scaffold e2e files, run in this order (each is its own test process). */
const E2E_FILES = Object.freeze(['e2e/hfs-scaffold-app.e2e.spec.mjs', 'e2e/hfs-scaffold-lite.e2e.spec.mjs']);
/** The preloads every e2e process loads first. */
const E2E_PRELOADS = Object.freeze(['e2e/setup/low-priority.mjs', 'e2e/setup/isolated-temp.mjs', 'e2e/setup/isolated-registry.mjs', 'e2e/setup/runtime-copies.mjs']);
const MAX_BUFFER = 512 * 1024 * 1024;

/** The node arguments of one e2e run writing its TAP report to `tapFile`. */
const e2eArgs = (tapFile, files = E2E_FILES) => [...E2E_PRELOADS.flatMap((file) => ['--import', `./${file}`]), '--test', '--test-concurrency=1',
  '--test-reporter=tap', `--test-reporter-destination=${tapFile}`, '--test-reporter=spec', '--test-reporter-destination=stdout', ...files];

/** The verdict of a finished run over its TAP summary: {ok, pass, total, failed, skipped, line}. */
function e2eVerdict(status, summary) {
  const total = summary.tests ?? 0, pass = summary.pass ?? 0, failed = (summary.fail ?? 0) + (summary.cancelled ?? 0), skipped = (summary.skipped ?? 0) + (summary.todo ?? 0);
  const ok = status === 0 && total > 0 && failed === 0 && skipped === 0 && pass === total;
  const line = `scaffold-e2e: ${pass} of ${total} passed, ${failed} failed, ${skipped} skipped`;
  return { ok, pass, total, failed, skipped, failing: summary.failing ?? [], line };
}

/** Runs the scaffold e2e in `root`: {ok, pass, total, failed, skipped, failing, line, ms, output, unrun}. `deps.runNode` is the process seam. */
export function runScaffoldE2e({ root = runtimeRoot, env = process.env, stdio = 'pipe', deps = {} } = {}) {
  const node = deps.runNode ?? runNode;
  const dir = makeTempDir('scaffold-e2e-');
  const tapFile = path.join(dir, 'e2e.tap');
  const started = Date.now();
  try {
    const run = node(e2eArgs(tapFile), { cwd: root, env, stdio, maxBuffer: MAX_BUFFER });
    const ms = Date.now() - started;
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    if (run.error || run.status === null) return { ok: false, unrun: true, pass: 0, total: 0, failed: 0, skipped: 0, failing: [], ms, output, line: `scaffold-e2e: the run did not start (${run.error?.message ?? run.signal ?? 'no exit status'})` };
    const verdict = e2eVerdict(run.status, tapSummary(fs.existsSync(tapFile) ? fs.readFileSync(tapFile, 'utf8') : ''));
    return { ...verdict, unrun: false, ms, output };
  } finally {
    safeRemove(dir, { hold: artifactHoldReason });
  }
}

if (isMain(import.meta.url)) {
  if (process.argv.length > 2) {
    process.stderr.write('usage: starci release scaffold-e2e\n');
    process.exit(2);
  }
  const result = runScaffoldE2e({ stdio: ['ignore', 'inherit', 'inherit'] });
  const failing = result.failing.length ? `; failing: ${result.failing.join(' | ')}` : '';
  process.stdout.write(`${result.line} (${Math.round(result.ms / 1000)}s)${failing}\n`);
  if (result.unrun) process.exitCode = 2;
  else process.exitCode = result.ok ? 0 : 1;
}
