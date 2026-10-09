// release-affected-ledger.mjs - the per-commit evidence of the `affected tests` row of a `suite: ci` release cut (release-affected.mjs): once the affected specs of a commit passed, the commit leaves
// <git common dir>/starci-release/<sha>.affected.json {schema, commit, files, ranAt, at} beside the release record. A later cut finds it and does not run that commit's set again.
// The land gate keeps no such list (machine.sqlite holds a land's spec MODE and failures, not the spec files that passed), so this ledger is the only per-commit evidence the cut reads.
import fs from 'node:fs';
import { gitCommonDir, proofDirOf, proofFileOf } from '../guards/release-record.mjs';

const SCHEMA = 'starci/affected-ledger@1';
const SHA = /^[0-9a-f]{40,64}$/;
const fileOf = (commonDir, commit) => proofFileOf({ commonDir, sha: commit, kind: 'affected' });

/** The spec files that passed for `commit` in an earlier cut, or null when no ledger exists. */
export function readAffectedLedger({ repo, commit, commonDir = null }) {
  const dir = commonDir ?? gitCommonDir(repo);
  if (!dir) return null;
  try {
    const ledger = JSON.parse(fs.readFileSync(fileOf(dir, commit), 'utf8'));
    return ledger?.schema === SCHEMA && ledger.commit === commit && Array.isArray(ledger.files) ? ledger.files : null;
  } catch { return null; }
}

/** Record that the affected specs `files` of `commit` passed while the cut ran on `ranAt`. {ok} or {ok: false, reason}; never throws. */
export function writeAffectedLedger({ repo, commit, files, ranAt, commonDir = null, now = () => new Date() }) {
  if (!SHA.test(String(commit)) || !SHA.test(String(ranAt))) return { ok: false, reason: 'a commit is a full sha' };
  const dir = commonDir ?? gitCommonDir(repo);
  if (!dir) return { ok: false, reason: 'the repository has no git common dir' };
  try {
    fs.mkdirSync(proofDirOf(dir), { recursive: true });
    fs.writeFileSync(fileOf(dir, commit), `${JSON.stringify({ schema: SCHEMA, commit, files, ranAt, at: now().toISOString() })}\n`);
    return { ok: true };
  } catch (error) { return { ok: false, reason: error.message }; }
}
