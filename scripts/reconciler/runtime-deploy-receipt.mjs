// runtime-deploy-receipt.mjs - the proof that `npm run check` (starci runtime check) AND the real tests passed on one exact commit.
// Three records count, each bound to the commit sha and its tree and each carrying BOTH the check and the tests for a base (a check alone is never a receipt):
//   - a deploy receipt, <state>/deploy/receipts/<sha>.json, written ONLY by `starci runtime deploy` after it ran the check itself in the clean source clone AND the real tests
//     (scripts/gates/runtime-tests.mjs: release clean-test --base <host head> and the scaffold e2e); it stands for the host head it was proven against;
//   - the verify receipt of the source clone (`starci runtime verify`: check p/p AND the tests for the host head..sha, scripts/supervisor/verify-receipt.mjs);
//   - the land note of the host repository (refs/notes/land), whose `Land-Verified: <sha>`, `Check: <pass>/<total>` and `Tests: packages g/t, e2e p/t <base>..<sha>` lines `starci git land`
//     wrote from the verify receipt and its own full check.
// A lane cannot claim green: the verb runs the check and the tests itself when no record exists, and a hand-written receipt fails its tree binding or its digest.
import { notes } from '../api/git/notes.mjs';
import { readVerifyReceipt } from '../supervisor/verify-receipt.mjs';
import { judgedIn, LAND_NOTE_REF, proofBinds, proofDigest, proofFileOf, readProofFile, writeProofFile } from '../gates/commit-proof.mjs';

const RECEIPT_SCHEMA = 'starci/deploy-receipt@2';

export const receiptFile = (sha, env) => proofFileOf({ kind: 'deploy', sha, env });

const digestOf = (r) => proofDigest([r.schema, r.sha, r.tree, r.exit, r.at]);

/** Writes the receipt of a check that exited `exit` on commit `sha` (tree `tree`); the digest ties the fields together. */
export function writeReceipt({ sha, tree, exit, at = Date.now(), by = null, counts = null, tests = null }, env) {
  const record = { schema: RECEIPT_SCHEMA, sha, tree, exit, at, by, counts, tests };
  return writeProofFile(receiptFile(sha, env), { ...record, digest: digestOf(record) });
}

/** Every package green and every scaffold e2e test passed (at least one ran). */
const testsGreen = (tests) => tests.packages?.green === tests.packages?.total && tests.e2e?.total > 0 && tests.e2e.pass === tests.e2e.total;

function readReceipt(sha, tree, base, env, root) {
  const record = readProofFile(receiptFile(sha, env));
  const bound = record?.schema === RECEIPT_SCHEMA && proofBinds(record, { sha, tree }) && record.exit === 0 && record.digest === digestOf(record);
  // The tests ran against a base: the receipt stands for the host it was proven against, never for another host revision.
  const tests = record?.tests;
  const testsOk = tests?.tip === sha && tests.base === base && testsGreen(tests);
  // The tests ran in one tree: a receipt whose tests judged another tree's root is that tree's proof, never this source's.
  const judgedHere = judgedIn(tests?.root, root);
  return bound && testsOk && judgedHere ? { via: 'deploy-receipt', at: record.at, tests } : null;
}

function landNoteReceipt(host, sha, base) {
  const r = notes([`--ref=${LAND_NOTE_REF}`, 'show', sha], { cwd: host });
  if (r.status !== 0) return null;
  const body = String(r.stdout ?? '');
  const check = /^Check: (\d+)\/(\d+)$/m.exec(body);
  const line = /^Tests: packages (\d+)\/(\d+), e2e (\d+)\/(\d+) ([0-9a-f]+)\.\.([0-9a-f]+)$/m.exec(body);
  const verified = new RegExp(`^Land-Verified: ${sha}$`, 'm').test(body);
  // The tests ran against a base: the note stands for the host head it was proven against, like a deploy receipt; a note without the Tests line proves the check alone and is no receipt.
  const tests = line ? { base, tip: sha, packages: { green: Number(line[1]), total: Number(line[2]) }, e2e: { pass: Number(line[3]), total: Number(line[4]) } } : null;
  const testsOk = tests && line[5] === base && line[6] === sha && testsGreen(tests);
  return verified && check && check[1] === check[2] && testsOk ? { via: 'land-note', counts: `${check[1]}/${check[2]}`, tests } : null;
}

/** The verify receipt of the source checkout `root` (`starci runtime verify`), as a deploy receipt, or null. */
function verifyReceipt({ root, sha, tree, base }) {
  const found = readVerifyReceipt({ root, sha, tree, base });
  return found.record ? { via: 'verify-receipt', at: found.record.at, tests: { base, tip: sha, root: found.record.root, packages: found.record.tests.packages, e2e: found.record.tests.e2e } } : null;
}

/** The receipt that stands for `sha`: {via, ...} or null. `host` is the host repository, where the land note lives; `root` the source checkout the tests must have run in. */
export const receiptFor = ({ sha, tree, base, host, env, root }) => readReceipt(sha, tree, base, env, root) ?? verifyReceipt({ root, sha, tree, base }) ?? landNoteReceipt(host, sha, base);
