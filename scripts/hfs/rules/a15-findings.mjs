// a15-findings.mjs - the one place where the alpha.15 content rules (R247-R280) are wired into `starci app check`.
// Each rule module of a batch exports a synchronous finder `({ repoRoot, files, all, repo, resolver, manifest, isRoot, inScope }) => finding[]`
// and is wired here by appending ONE import line and ONE entry to FINDERS. Nothing else in this file changes; the file is union-merged.
// A finder judges its own edition (`repo.edition`): lite and full are both in scope unless the rule says otherwise.
// finders-import-begin
import { featureFileFindings } from './feature-files.mjs';
// finders-import-end

/** The failure codes the finders above emit, so `starci app check` ships their labels (check.mjs adds them to CHECK_CODES). Append-only; the coordinator regenerates it at merge time. */
export const A15_CODES = [
  // codes-begin
  'HFS_FEATURE_FILE_BUDGET',
  // codes-end
];

export const FINDERS = [
  // finders-begin
  featureFileFindings,
  // finders-end
];

/** Findings of every alpha.15 content rule over one repository. */
export function a15Findings(context) {
  return FINDERS.flatMap((finder) => finder(context));
}
