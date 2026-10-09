#!/usr/bin/env node
// release-affected.mjs - the `affected tests` row of a release cut under `suite: ci` (release-ci-rows.mjs): the specs the release range (the newest release tag merged in HEAD, up to HEAD) can break, run locally
// while the full suite is CI's. The selection is `starci test affected`'s (affected-test.mjs).
//   whole range within the verb's bound   the range's affected set is run, once
//   range over the bound                  never the full suite and never a silent smoke set: the commits of the range are taken one by one (newest `maxCommits`); a commit whose affected set passed
//                                         in an earlier cut (release-affected-ledger.mjs) is reused, the others' sets run now, the union once; a commit whose own set is over the bound, a commit past
//                                         `maxCommits` and the specs past `maxRunFiles` are listed as not covered
// The last stdout line is `RELEASE_AFFECTED {json}`: the range, the bound, files selected / run / reused / passed / failed, the commits per evidence and the specs NOT run locally (CI's). The full report is
// <git common dir>/starci-release/<head>.affected-report.json. Exit 0 when every spec that ran passed, 1 when one was red or the range has no earlier release tag.
import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { tag as gitTag } from '../api/git/tag.mjs';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { gitCommonDir, proofFileOf } from '../guards/release-record.mjs';
import { resolveTestConcurrency } from '../machine/test-concurrency.mjs';
import { runBounded, runSpecFile, testAffected } from './affected-test.mjs';
import { commitPlans } from './release-affected-commits.mjs';
import { writeAffectedLedger } from './release-affected-ledger.mjs';

const text = (r) => String(r.stdout ?? '').trim();
const policyOf = () => readModuleJson('modules', 'supervisor', 'release-cut.yaml').suite.ci.affected;

/** The newest release tag (v*) merged in HEAD that does not point at HEAD itself: the start of the release range, or null. */
export function rangeBase(root) {
  const head = text(revParseQuery(['HEAD'], { cwd: root }));
  const tags = text(gitTag(['--merged', 'HEAD', '--list', 'v*', '--sort=-creatordate'], { cwd: root })).split(/\r?\n/).filter(Boolean);
  return tags.find((name) => text(revParseQuery([`refs/tags/${name}^{commit}`], { cwd: root })) !== head) ?? null;
}

function runFiles(root, files, deps) {
  const decision = resolveTestConcurrency(undefined, deps);
  const progress = deps.progress ?? ((line) => process.stdout.write(`${line}\n`));
  return runBounded(files, decision.concurrency, (file) => (deps.runSpecFile ?? runSpecFile)(root, file, deps).then((result) => { progress(`${result.pass ? 'PASS' : 'FAIL'} ${result.file}`); return result; }));
}

/** The summary of a run: the counts, the commits per evidence and the specs of the range that did not run here. */
function summaryOf({ base, head, bound, whole, plans, results, notCovered }) {
  const pass = results.filter((r) => r.pass).length;
  const ran = new Set(results.map((r) => r.file));
  const reusedFiles = new Set(plans.filter((p) => p.reused).flatMap((p) => p.files));
  const covered = new Set([...ran, ...reusedFiles]);
  return {
    mode: plans.length ? 'per-commit' : 'range', base, head, bound, rangeFiles: whole.length, selected: new Set(plans.flatMap((p) => p.files)).size || whole.length, run: ran.size, reused: [...reusedFiles].filter((f) => !ran.has(f)).length, pass, fail: results.length - pass,
    commits: { ran: plans.filter((p) => !p.reused).length, reused: plans.filter((p) => p.reused).length, notCovered: notCovered.length },
    notCovered, notRun: whole.filter((file) => !covered.has(file)),
  };
}

function withReport(root, summary, plans) {
  const dir = gitCommonDir(root);
  const short = { ...summary, notCovered: summary.notCovered.slice(0, 20), notRun: summary.notRun.slice(0, 20), notRunCount: summary.notRun.length };
  if (!dir) return short;
  const file = proofFileOf({ commonDir: dir, sha: summary.head, kind: 'report' });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ ...summary, plans })}\n`);
  return { ...short, report: file };
}

/** The wide range, commit by commit: runs the unproven commits' sets once, records the commits whose sets all passed. {results, summary}. */
async function perCommit({ root, base, head, bound, whole, policy, deps }) {
  const { plans, notCovered } = commitPlans({ root, base, head, bound, policy, deps });
  const toRun = [...new Set(plans.filter((p) => !p.reused).flatMap((p) => p.files))];
  const results = await runFiles(root, toRun.slice(0, policy.maxRunFiles), deps);
  const unsettled = new Set([...results.filter((r) => !r.pass).map((r) => r.file), ...toRun.slice(policy.maxRunFiles)]);
  plans.filter((p) => !p.reused && !p.files.some((file) => unsettled.has(file))).forEach((p) => writeAffectedLedger({ repo: root, commit: p.commit, files: p.files, ranAt: head }));
  const past = toRun.length - policy.maxRunFiles;
  const extra = past > 0 ? [{ reason: `${past} spec file(s) past maxRunFiles ${policy.maxRunFiles}` }] : [];
  return withReport(root, summaryOf({ base, head, bound, whole, plans, results, notCovered: [...notCovered, ...extra] }), plans.map(({ commit, reused, files }) => ({ commit, reused, files })));
}

/** Run the affected specs of the release range of `root`: {code, summary}. Seams in `deps`: base, policy, testAffected, runSpecFile, specs, sources. */
export async function affectedRelease({ root, deps = {} }) {
  const base = deps.base ?? rangeBase(root);
  const head = text(revParseQuery(['HEAD'], { cwd: root }));
  if (!base) return { code: 1, summary: { mode: 'no-base', head, why: 'no earlier release tag (v*) is merged in HEAD: the release range has no start' } };
  const range = await (deps.testAffected ?? testAffected)({ cwd: root, args: { base, root } }, deps);
  const whole = range.data.scope ?? [];
  const bound = range.data.maxFiles;
  const summary = range.data.over
    ? await perCommit({ root, base, head, bound, whole, policy: deps.policy ?? policyOf(), deps })
    : withReport(root, summaryOf({ base, head, bound, whole, plans: [], results: await runFiles(root, whole, deps), notCovered: [] }), []);
  return { code: summary.fail ? 1 : 0, summary };
}

if (isMain(import.meta.url)) {
  const { code, summary } = await affectedRelease({ root: process.cwd() });
  const detail = summary.why ?? `${summary.run} run, ${summary.reused} reused, ${summary.pass} pass, ${summary.fail} fail`;
  process.stdout.write(`affected: ${summary.mode}: ${detail}\nRELEASE_AFFECTED ${JSON.stringify(summary)}\n`);
  process.exitCode = code;
}
