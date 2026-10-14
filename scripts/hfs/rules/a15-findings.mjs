// a15-findings.mjs - the one place where the alpha.15 content rules (R247-R280) are wired into `starci app check`.
// Each rule module of a batch exports a synchronous finder `({ repoRoot, files, all, repo, resolver, manifest, isRoot, inScope }) => finding[]`
// and is wired here by appending ONE import line and ONE entry to FINDERS. Nothing else in this file changes; the file is union-merged.
// A finder judges its own edition (`repo.edition`): lite and full are both in scope unless the rule says otherwise.
// finders-import-begin
import { databaseBaselineFindings } from './database-baseline.mjs';
import { databaseQueuesFindings } from './database-queues.mjs';
import { databaseConfigFindings } from './database-config.mjs';
// finders-import-end

export const FINDERS = [
  // finders-begin
  databaseBaselineFindings,
  databaseQueuesFindings,
  databaseConfigFindings,
  // finders-end
];

/** Findings of every alpha.15 content rule over one repository. */
export function a15Findings(context) {
  return FINDERS.flatMap((finder) => finder(context));
}

/** Codes emitted by the finders (coordinator-managed). */
export const A15_CODES = [];
