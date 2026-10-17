// verify-receipt.mjs - the ONE receipt that makes a runtime commit "verified": `starci runtime verify` writes it, `starci git land` and `starci runtime deploy` read it.
// It binds one exact commit, its tree and the ROOT the proofs ran in to BOTH facts a branch needs before it moves toward the host: `check` (the runtime check passed N of N, structure and the
// self-checks) and `tests` (the real tests, scripts/gates/runtime-tests.mjs: the clean-install proof of the packages the change touches and the scaffold e2e; the runtime has no specs of its own,
// owner ruling no-runtime-specs). A digest ties the fields together, so a hand-written file fails. Land, deploy and release read it the same way: every proof passed.
// The file lives in the tree it verified: <runtime state dir>/verify/<sha>.json.
import path from 'node:path';
import { judgedIn, proofBinds, proofDigest, proofFileOf, readProofFile, writeProofFile } from '../gates/commit-proof.mjs';

const VERIFY_SCHEMA = 'starci/verify-receipt@2';
const SHORT = 12;
export const short = (sha) => String(sha ?? '').slice(0, SHORT);

const verifyReceiptFile = (root, sha) => proofFileOf({ kind: 'verify', root, sha });

const digestOf = (r) => proofDigest([r.schema, r.sha, r.tree, r.root, r.base, r.at, r.check?.pass, r.check?.total, r.tests?.packages?.green, r.tests?.packages?.total,
  r.tests?.e2e?.pass, r.tests?.e2e?.total, r.node]);

/** The receipt record of a finished verification; `check` = {pass, total}, `tests` = {packages: {green, total}, e2e: {pass, total}, ms}. */
export function verifyRecord({ sha, tree, root, base, check, tests, at = Date.now(), nodeVersion = process.version }) {
  const record = { schema: VERIFY_SCHEMA, sha, tree, root: path.resolve(root), base, at, node: nodeVersion, check, tests };
  return { ...record, digest: digestOf(record) };
}

// DEPRECATED, one release only - REMOVE IN 1.0.0-alpha.20 (with its call below). The host runtime deployed before alpha.19 runs the alpha.18 `runtime deploy`,
// which accepts the proven affected receipt <root>/.runtime/affected/<base12>-<tip12>.json (schema starci/affected-receipt@1: ok, clean, base, tip, passed === total)
// before it would run the removed spec verb. A verified commit leaves that file too: 0 of 0 runtime spec files (the runtime has none, owner ruling no-runtime-specs),
// written only here, after the check, the package clean-test and the scaffold e2e passed, and carrying this verify receipt's digest. Nothing in alpha.19 reads it.
const LEGACY_AFFECTED_SCHEMA = 'starci/affected-receipt@1';
const legacyAffectedOf = (record) => ({ schema: LEGACY_AFFECTED_SCHEMA, root: record.root, base: record.base, tip: record.sha, clean: true, ok: true, files: 0, passed: 0, total: 0,
  reused: 0, via: 'runtime-verify', verify: { schema: record.schema, digest: record.digest, check: record.check, tests: record.tests } });

/** Writes `record` (tmp + rename: a reader never sees a torn file) and its one-release alpha.18 deployer receipt; returns the verify receipt file. */
export function writeVerifyReceipt(root, record) {
  const file = writeProofFile(verifyReceiptFile(root, record.sha), record);
  writeProofFile(proofFileOf({ kind: 'affected-receipt', root, base: record.base, sha: record.sha }), legacyAffectedOf(record));
  return file;
}

function testsProblem(tests) {
  const { packages, e2e } = tests ?? {};
  if (!(packages?.total >= 0) || packages.green !== packages.total) return `the verify receipt records the package clean-test at ${packages?.green}/${packages?.total}`;
  if (!(e2e?.total > 0) || e2e.pass !== e2e.total) return `the verify receipt records the scaffold e2e at ${e2e?.pass}/${e2e?.total}`;
  return null;
}

/** Why `record` does not verify `sha`/`tree` against `base` in `root`, or null when it does. */
function verifyProblem(record, { sha, tree, base, root }) {
  if (record?.schema !== VERIFY_SCHEMA) return 'no verify receipt';
  if (record.digest !== digestOf(record)) return 'the verify receipt does not match its digest (edited by hand)';
  if (!proofBinds(record, { sha, tree })) return `the verify receipt is for ${short(record.sha)}, not ${short(sha)}`;
  if (record.base !== base) return `the verify receipt proved the tests against ${short(record.base)}, not ${short(base)}`;
  if (!judgedIn(record.root, root)) return `the verify receipt's proofs ran in ${record.root ?? 'no named tree'}, not in ${root}`;
  const { check } = record;
  if (!(check?.total > 0) || check.pass !== check.total) return `the verify receipt records the check at ${check?.pass}/${check?.total}`;
  return testsProblem(record.tests);
}

/** The verify receipt of `sha` in the tree at `root` when it verifies `sha`/`tree` against `base`: {record} or {problem}. */
export function readVerifyReceipt({ root, sha, tree, base }) {
  const record = readProofFile(verifyReceiptFile(root, sha));
  const problem = verifyProblem(record, { sha, tree, base, root });
  return problem ? { problem } : { record };
}

/** The tests part of a verdict line: `packages g/t, e2e p/t`. */
const testsLine = (tests) => `packages ${tests.packages.green}/${tests.packages.total}, e2e ${tests.e2e.pass}/${tests.e2e.total}`;

/** The one-line verdict a human reads last. Verified: `verified <sha>: check p/p, packages g/t, e2e p/t of <base>..<sha>`. Otherwise `NOT VERIFIED <sha>: <why>`. */
export function verdictOf({ sha, base, check, tests, problems }) {
  if (problems.length) return `NOT VERIFIED ${short(sha)}: ${problems.join('; ')}`;
  return `verified ${short(sha)}: check ${check.pass}/${check.total}, ${testsLine(tests)} of ${short(base)}..${short(sha)}`;
}
