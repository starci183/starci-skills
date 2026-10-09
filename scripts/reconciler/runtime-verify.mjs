// runtime-verify.mjs - `starci runtime verify [--base <ref>] [--json]`: the one verb a lane runs before it reports a branch fit to merge and deploy.
// `starci runtime check` proves structure (syntax, HFS, self-checks) and never starts a spec; `starci test affected --run` proves the specs and never runs the check. A branch is VERIFIED only when both
// passed on one exact commit: this verb runs the check, then the affected specs for base..tip, and writes ONE receipt (scripts/supervisor/verify-receipt.mjs) that `starci git land` and `starci runtime deploy` read.
// It refuses a tree with uncommitted or untracked changes (a receipt binds a commit) and prints one last line: `verified <sha>: check p/p, affected N/N of <base>..<sha>` or `NOT VERIFIED <sha>: ...` with the red files.
import path from 'node:path';
import { tailLines } from '../lib/clip.mjs';
import { invocationDir } from '../lib/roots.mjs';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { runLandFullCheck } from '../supervisor/git-land-verify.mjs';
import { baseOf } from '../supervisor/affected-test.mjs';
import { judgedIn, verdictOf, verifyRecord, writeVerifyReceipt } from '../supervisor/verify-receipt.mjs';
import { diffNames } from '../api/git/diff-names.mjs';
import { affectedJudgement, provenFor, runAffectedChild } from './runtime-deploy-affected.mjs';
import { isDirty } from './runtime-deploy-source.mjs';

const VERIFY_SCHEMA_ANSWER = 'starci/runtime-verify@1';
const USAGE = 'usage: starci runtime verify [--base <ref>] [--root <tree>] [--json]';
const TAIL_LINES = 6;
const PARTIAL_EXIT = 3;

const tailOf = (output) => tailLines(output, TAIL_LINES, { join: ' | ' });

/** The commit and tree of the checkout at `root` and whether it has changes beside the commit: {sha, tree, dirty}. */
function factsOf(root) {
  const sha = revParse(root, 'HEAD');
  const tree = sha ? String(revParseQuery([`${sha}^{tree}`], { cwd: root }).stdout ?? '').trim() : null;
  return { sha, tree, dirty: isDirty(root) };
}

/** The default seams over the real checkout. `env` is the verb's environment. */
function defaultSeams({ env }) {
  return {
    facts: factsOf,
    base: (root, ref) => baseOf(root, ref),
    runCheck: (root) => runLandFullCheck(root),
    changedSpecs: (root, base) => (diffNames(root, base, 'HEAD') ?? []).filter((file) => /^tests\/.*\.spec\.mjs$/.test(file)),
    provenAffected: (root, base, tip) => provenFor({ dir: root, base, tip }),
    runAffected: (root, base, progress) => runAffectedChild({ dir: root, base, env, budgetMs: readModuleJson('modules', 'supervisor', 'affected-tests.yaml').budgetMs, progress }),
  };
}

const answer = (code, data, lines) => ({ code, text: [...lines, data.verdict].join('\n'), data: { schema: VERIFY_SCHEMA_ANSWER, ok: code === 0, partial: code === PARTIAL_EXIT, ...data } });

/** The affected numbers of a receipt that judged `root`, with the lane's own changed specs checked against the files not started: {passed, total, failed, notStarted, changedSpecsRan, reused, files, ms}. */
function affectedOf({ receipt, unfinished = [], changedSpecs = [] }) {
  return { passed: receipt.passed, total: receipt.total, failed: 0, notStarted: unfinished.length, changedSpecsRan: changedSpecs.every((file) => !unfinished.includes(file)), reused: receipt.reused ?? 0, files: receipt.files, ms: receipt.ms };
}

/** Whether a run that did not finish is a partial the land accepts: nothing red, the receipt is the clean one of this tip and base, the budget (not a crash or a timeout) ended it. */
const isPartial = (run, { sha, base }) => Boolean(run.receipt) && run.red.length === 0 && run.unfinished.length > 0 && run.exit.code === 2 && !run.exit.timedOut && run.receipt.clean === true && run.receipt.tip === sha && run.receipt.base === base;

/** A partial run is a proof for the land only when every spec the lane changed ran: {affected}, else the refusal naming the specs that did not. */
function partialProof({ run, changedSpecs }) {
  const affected = affectedOf({ receipt: run.receipt, unfinished: run.unfinished, changedSpecs });
  const missed = changedSpecs.filter((file) => run.unfinished.includes(file));
  return affected.changedSpecsRan ? { affected } : { detail: `the budget ended before ${missed.length} spec file(s) the change itself touched ran: ${missed.join(', ')}. Run starci runtime verify again: the files that passed are reused and the run continues.`, red: [] };
}

/** The affected proof for `base..sha`: a receipt already proven for the pair, else a real run judged by the deploy's own judgement. {affected} or {detail, red}. */
async function affectedProof({ root, seams, base, sha, progress }) {
  const changedSpecs = seams.changedSpecs(root, base);
  const proven = seams.provenAffected(root, base, sha);
  if (proven) {
    progress(`affected: accepting the receipt already proven for ${base.slice(0, 12)}..${sha.slice(0, 12)} (${proven.passed} of ${proven.total} files passed); not run again`);
    return judgedIn(proven.root, root) ? { affected: affectedOf({ receipt: proven }) } : { detail: `the proven affected receipt ran in ${proven.root ?? 'no named tree'}, not in ${root}`, red: [] };
  }
  progress(`affected: running the specs for ${base.slice(0, 12)}..${sha.slice(0, 12)} in ${root}; progress follows`);
  const run = await seams.runAffected(root, base, progress);
  if (run.receipt && !judgedIn(run.receipt.root, root)) return { detail: `the affected specs ran in ${run.receipt.root ?? 'no named tree'}, not in ${root}`, red: [] };
  if (isPartial(run, { sha, base })) return partialProof({ run, changedSpecs });
  const judged = affectedJudgement(run, { sha, base });
  const resume = run.unfinished.length ? ' Run starci runtime verify again: the files that passed are reused and the run continues with the rest.' : '';
  return judged.affected ? { affected: affectedOf({ receipt: run.receipt, changedSpecs }) } : { detail: judged.detail + resume, red: run.red ?? [] };
}

/** What stops the verification before anything runs: the problems alone decide, or []. */
function startProblems({ facts, base }) {
  const problems = [];
  if (!facts.sha) problems.push('not a git checkout with a commit');
  else if (facts.dirty) problems.push('the working tree has uncommitted or untracked changes: commit them, the receipt binds a commit');
  if (facts.sha && !base) problems.push('no base to diff against (no main or origin/main here, or the named ref has no merge base with HEAD): pass --base <ref>');
  return problems;
}

/** Function-backed `runtime verify` verb. `deps` replaces the seams and the progress sink (specs). */
export async function runtimeVerify(ctx, deps = {}) {
  if ((ctx?.positionals ?? []).length) return { code: 2, text: USAGE, data: { schema: VERIFY_SCHEMA_ANSWER, ok: false, usage: USAGE } };
  const args = ctx?.args ?? {};
  const root = path.resolve(invocationDir(ctx), args.root ?? '.');
  const seams = { ...defaultSeams({ env: ctx?.env ?? process.env }), ...deps.seams };
  const progress = deps.progress ?? ((line) => (ctx?.io?.stderr ? ctx.io.stderr(`${line}\n`) : process.stderr.write(`${line}\n`)));
  const facts = seams.facts(root);
  const base = facts.sha ? seams.base(root, args.base) : null;
  const refused = startProblems({ facts, base });
  const fail = (problems, extra = {}, lines = []) => answer(1, { sha: facts.sha, base, check: null, affected: null, problems, receiptFile: null, verdict: verdictOf({ sha: facts.sha, base, problems, red: extra.red }), ...extra }, lines);
  if (refused.length) return fail(refused);
  progress(`check: running starci runtime check in ${root} (minutes)`);
  const checked = seams.runCheck(root);
  const check = { pass: Number(checked.pass ?? 0), total: Number(checked.total ?? 1) };
  if (!checked.ok) return fail([`the runtime check is red (${check.pass}/${check.total}); the affected specs were not run: ${tailOf(checked.output)}`], { check });
  const proof = await affectedProof({ root, seams, base, sha: facts.sha, progress });
  if (!proof.affected) return fail([proof.detail], { check, red: proof.red });
  const after = seams.facts(root);
  if (after.sha !== facts.sha || after.dirty) return fail(['the check or the specs changed the tree or HEAD moved while they ran; the receipt would not bind the commit'], { check });
  const record = verifyRecord({ sha: facts.sha, tree: facts.tree, root, base, check, affected: proof.affected });
  const receiptFile = writeVerifyReceipt(root, record);
  return answer(proof.affected.notStarted > 0 ? PARTIAL_EXIT : 0, { sha: facts.sha, base, check, affected: proof.affected, problems: [], red: [], receiptFile, verdict: verdictOf({ sha: facts.sha, base, check, affected: proof.affected, problems: [] }) }, [`receipt: ${receiptFile}`]);
}
