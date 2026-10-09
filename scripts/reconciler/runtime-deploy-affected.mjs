// runtime-deploy-affected.mjs - the affected-spec gate of `starci runtime deploy`: the specs the change can break, run in the source clone, judged from a RECEIPT FILE.
// The run is long (hundreds of spec files, a declared budget of tens of minutes). The child writes its receipt to a file (`starci test affected --receipt-file`), its answer and its
// progress go to files, never into a pipe with a size limit; the deploy waits for it with a timeout of the declared budget plus a margin, prints each progress line while it runs and
// says before starting what it is about to do. A receipt already proven for the same base..tip pair (a run somebody made in the source clone) is accepted instead of repeated.
// Every refusal names what happened: the red files, the unfinished files, the budget that ended, or the child that died (signal or exit code and its last lines).
import fs from 'node:fs';
import path from 'node:path';
import { allocationMs } from '../../engine/config.mjs';
import { spawnNode } from '../api/node/spawn-node.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { stopTree } from '../supervisor/host-health.mjs';
import { provenReceiptFile, readReceiptFile } from '../supervisor/affected-receipt-file.mjs';
import { sleep as sleepFor } from '../lib/sleep.mjs';
import { parseJson } from '../lib/json.mjs';
import { repeatInOrder } from '../lib/in-order.mjs';

const CLI = path.join('packages', 'cli', 'bin', 'starci.mjs');
const TAIL = 8;

/** The margin the deploy adds to the affected budget before it declares the child lost (modules/models/runtimes.yaml allocation.deploy). */
export const affectedMarginMs = () => allocationMs('deploy.affectedMarginMs');

const linesOf = (text) => String(text ?? '').split(/\r?\n/).filter(Boolean);
const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };

/** A receipt already proven for this base..tip pair in the source clone, or null: clean, ok, every file passed, on this exact tip against this exact base. */
export function provenFor({ dir, base, tip }) {
  const receipt = readReceiptFile(provenReceiptFile(dir, base, tip));
  return receipt && receipt.ok && receipt.clean && receipt.tip === tip && receipt.base === base && receipt.passed === receipt.total ? receipt : null;
}

/** Prints the lines the child added to its progress file since `from`; returns the new offset. */
function relay(file, from, progress) {
  const text = readText(file);
  if (text.length > from) for (const line of linesOf(text.slice(from))) progress(`affected: ${line}`);
  return text.length;
}

/** Waits for `child` to exit or `timeoutMs` to pass, relaying its progress file meanwhile: {exited, code, signal, timedOut}. */
async function waitFor(child, { errFile, timeoutMs, progress, pollMs, now = Date.now, sleep = sleepFor }) {
  const end = { done: false, code: null, signal: null };
  child.once('exit', (code, signal) => { end.done = true; end.code = code; end.signal = signal; });
  child.once('error', (error) => { end.done = true; end.signal = String(error?.message ?? error); });
  const start = now();
  let offset = 0;
  return repeatInOrder(async () => {
    if (!end.done && now() - start < timeoutMs) {
      await sleep(pollMs);
      offset = relay(errFile, offset, progress);
      return undefined;
    }
    relay(errFile, offset, progress);
    return { exited: end.done, code: end.code, signal: end.signal, timedOut: !end.done };
  });
}

/**
 * Runs `starci test affected --run --base <base>` in the source clone `dir` as a real child: stdout and stderr to files, the receipt to a file.
 * Returns {exit: {exited, code, signal, timedOut}, receipt, answer, tail, red, unfinished}; the caller judges it (affectedRefusal).
 */
export async function runAffectedChild({ dir, base, env, budgetMs, progress = () => {}, pollMs = 2000, cli = path.join(dir, CLI), marginMs = affectedMarginMs(), extraArgs = [], runtime = dir, cwd = dir, now, sleep }) {
  const scratch = makeTempDir('starci-deploy-affected-');
  const files = { out: path.join(scratch, 'answer.json'), err: path.join(scratch, 'progress.log'), receipt: path.join(scratch, 'receipt.json') };
  const out = fs.openSync(files.out, 'w'), err = fs.openSync(files.err, 'w');
  try {
    const child = spawnNode([cli, 'test', 'affected', '--run', '--base', base, '--receipt-file', files.receipt, ...extraArgs, '--json'], { cwd, env: { ...env, STARCI_RUNTIME: runtime }, stdio: ['ignore', out, err] });
    const exit = await waitFor(child, { errFile: files.err, timeoutMs: budgetMs + marginMs, progress, pollMs, now, sleep });
    if (exit.timedOut && child.pid) stopTree(child.pid);
    const answer = parseJson(readText(files.out), null);
    const rows = Array.isArray(answer?.results) ? answer.results : [];
    return { exit, receipt: readReceiptFile(files.receipt), answer, tail: linesOf(readText(files.err)).slice(-TAIL),
      red: rows.filter((r) => !r.pass && !r.skipped).map((r) => r.file), unfinished: rows.filter((r) => r.skipped).map((r) => r.file) };
  } finally {
    fs.closeSync(out);
    fs.closeSync(err);
    try { safeRemove(scratch, { hold: () => null }); } catch { /* best effort */ }
  }
}

const list = (files) => files.slice(0, 12).join(', ') + (files.length > 12 ? ' and ' + (files.length - 12) + ' more' : '');
const endedBy = (exit) => (exit.signal ? 'ended by ' + exit.signal : 'exited ' + exit.code);

/**
 * What the run proved, as {affected} for a clean receipt on `sha` against `base`, else {detail}: exactly what happened. Pure over the run's result.
 */
export function affectedJudgement(run, { sha, base }) {
  const { exit, receipt } = run;
  const tail = run.tail.length ? ' Last lines: ' + run.tail.join(' | ') : '';
  if (exit.timedOut) return { detail: `the affected run did not finish inside its budget plus margin and was stopped.${tail}` };
  if (!receipt) return { detail: `the affected run wrote no receipt: the child ${endedBy(exit)}.${tail}` };
  if (run.red.length) return { detail: `${run.red.length} spec file(s) are red: ${list(run.red)}` };
  if (run.unfinished.length || exit.code === 2) return { detail: `the time budget ended with ${run.unfinished.length} spec file(s) not started: ${list(run.unfinished)}` };
  if (!receipt.ok) return { detail: `the receipt is not ok: ${receipt.passed} of ${receipt.total} of ${receipt.files} selected files passed.${tail}` };
  if (!receipt.clean) return { detail: 'the receipt says the source tree was not clean when the run ended: the run changed it or it changed meanwhile' };
  if (receipt.tip !== sha) return { detail: `the receipt is for tip ${String(receipt.tip).slice(0, 12)}, not the source ${sha.slice(0, 12)}` };
  if (receipt.base !== base) return { detail: `the receipt is against base ${String(receipt.base).slice(0, 12)}, not the host head ${base.slice(0, 12)}` };
  return { affected: { base: receipt.base, tip: receipt.tip, root: receipt.root, passed: receipt.passed, total: receipt.total } };
}
