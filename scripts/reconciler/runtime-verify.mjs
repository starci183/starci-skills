// runtime-verify.mjs - `starci runtime verify [--base <ref>] [--json]`: the one verb a lane runs before it reports a branch fit to merge and deploy.
// A branch is VERIFIED only when, on one exact commit, `starci runtime check` (structure, HFS, the self-checks) passed AND the real tests passed (scripts/gates/runtime-tests.mjs: the clean-install
// proof of every published package base..tip touches, and the scaffold e2e). The runtime carries no specs of its own (owner ruling no-runtime-specs, 2026-10-17). The verb writes ONE receipt
// (scripts/supervisor/verify-receipt.mjs) that `starci git land` and `starci runtime deploy` read.
// It refuses a tree with uncommitted or untracked changes (a receipt binds a commit) and prints one last line: `verified <sha>: check p/p, packages g/t, e2e p/t of <base>..<sha>` or `NOT VERIFIED <sha>: ...`.
import path from 'node:path';
import { tailLines } from '../lib/clip.mjs';
import { invocationDir } from '../lib/roots.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { runLandFullCheck } from '../supervisor/git-land-verify.mjs';
import { baseChoice, baseLine } from '../supervisor/diff-base.mjs';
import { verdictOf, verifyRecord, writeVerifyReceipt } from '../supervisor/verify-receipt.mjs';
import { runRuntimeTests } from '../gates/runtime-tests.mjs';
import { isDirty } from './runtime-deploy-source.mjs';

const VERIFY_SCHEMA_ANSWER = 'starci/runtime-verify@2';
const USAGE = 'usage: starci runtime verify [--base <ref>] [--root <tree>] [--json]';
const TAIL_LINES = 6;

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
    base: (root, ref) => baseChoice(root, ref),
    runCheck: (root) => runLandFullCheck(root),
    runTests: (root, base, progress) => runRuntimeTests({ root, base, env, progress }),
  };
}

// The first line says which base was chosen and why (a seam that answers a bare sha has no reason to give).
const baseHead = (choice) => (choice?.why ? [baseLine(choice)] : []);

const answer = (code, data, lines) => ({ code, text: [...(data.baseWhy ? [data.baseWhy] : []), ...lines, data.verdict].join('\n'), data: { schema: VERIFY_SCHEMA_ANSWER, ok: code === 0, ...data } });

/** What stops the verification before anything runs: the problems alone decide, or []. */
function startProblems({ facts, base }) {
  const problems = [];
  if (!facts.sha) problems.push('not a git checkout with a commit');
  else if (facts.dirty) problems.push('the working tree has uncommitted or untracked changes: commit them, the receipt binds a commit');
  if (facts.sha && !base) problems.push('no base to diff against (no main or origin/main here, or the named ref has no merge base with HEAD): pass --base <ref>');
  return problems;
}

/** Function-backed `runtime verify` verb. `deps` replaces the seams and the progress sink. */
export async function runtimeVerify(ctx, deps = {}) {
  if ((ctx?.positionals ?? []).length) return { code: 2, text: USAGE, data: { schema: VERIFY_SCHEMA_ANSWER, ok: false, usage: USAGE } };
  const args = ctx?.args ?? {};
  const root = path.resolve(invocationDir(ctx), args.root ?? '.');
  const seams = { ...defaultSeams({ env: ctx?.env ?? process.env }), ...deps.seams };
  const progress = deps.progress ?? ((line) => (ctx?.io?.stderr ? ctx.io.stderr(`${line}\n`) : process.stderr.write(`${line}\n`)));
  const facts = seams.facts(root);
  const picked = facts.sha ? seams.base(root, args.base) : null;
  const choice = picked && typeof picked === 'object' ? picked : { base: picked ?? null, why: null };
  const base = choice.base;
  const [baseWhy = null] = baseHead(choice);
  if (baseWhy) progress(baseWhy);
  const refused = startProblems({ facts, base });
  const fail = (problems, extra = {}) => answer(1, { sha: facts.sha, base, baseWhy, check: null, tests: null, problems, receiptFile: null, verdict: verdictOf({ sha: facts.sha, base, problems }), ...extra }, []);
  if (refused.length) return fail(refused);
  progress(`check: running starci runtime check in ${root} (minutes)`);
  const checked = seams.runCheck(root);
  const check = { pass: Number(checked.pass ?? 0), total: Number(checked.total ?? 1) };
  if (!checked.ok) return fail([`the runtime check is red (${check.pass}/${check.total}); the tests were not run: ${tailOf(checked.output)}`], { check });
  const run = await seams.runTests(root, base, progress);
  const tests = { packages: run.packages, e2e: run.e2e, ms: run.ms };
  if (!run.ok) return fail(run.problems, { check, tests });
  const after = seams.facts(root);
  if (after.sha !== facts.sha || after.dirty) return fail(['the check or the tests changed the tree or HEAD moved while they ran; the receipt would not bind the commit'], { check, tests });
  const receiptFile = writeVerifyReceipt(root, verifyRecord({ sha: facts.sha, tree: facts.tree, root, base, check, tests }));
  return answer(0, { sha: facts.sha, base, baseWhy, check, tests, problems: [], receiptFile, verdict: verdictOf({ sha: facts.sha, base, check, tests, problems: [] }) }, [`receipt: ${receiptFile}`]);
}
