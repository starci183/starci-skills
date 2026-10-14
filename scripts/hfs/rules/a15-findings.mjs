// a15-findings.mjs - the one place where the alpha.15 content rules (R247-R280) are wired into `starci app check`.
// Each rule module of a batch exports a synchronous finder `({ repoRoot, files, all, repo, resolver, manifest, isRoot, inScope }) => finding[]`
// and is wired here by appending ONE import line and ONE entry to FINDERS. Nothing else in this file changes; the file is union-merged.
// A finder judges its own edition (`repo.edition`): lite and full are both in scope unless the rule says otherwise.
// finders-import-begin
import { ageKeyCustodyFindings } from './secrets.mjs';
import { canonCopyDriftFindings } from './canon-copy-drift.mjs';
import { secretCustodyOnlyFindings } from './secret-custody-only.mjs';
// finders-import-end

export const FINDERS = [
  // finders-begin
  ageKeyCustodyFindings,
  canonCopyDriftFindings,
  secretCustodyOnlyFindings,
  // finders-end
];

/** Findings of every alpha.15 content rule over one repository. */
export function a15Findings(context) {
  return FINDERS.flatMap((finder) => finder(context));
}

/** Codes emitted by the finders (coordinator-managed). */
export const A15_CODES = [];

A15_CODES.push('HFS_AGE_KEY_CUSTODY', 'HFS_CANON_COPY_DRIFT', 'HFS_SECRET_PLAINTEXT_FILE', 'HFS_SECRET_OUTSIDE_ENC');
