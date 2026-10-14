// a15-findings.mjs - the one place where the alpha.15 content rules (R247-R280) are wired into `starci app check`.
// Each rule module of a batch exports a synchronous finder `({ repoRoot, files, all, repo, resolver, manifest, isRoot, inScope }) => finding[]`
// and is wired here by appending ONE import line and ONE entry to FINDERS. Nothing else in this file changes; the file is union-merged.
// A finder judges its own edition (`repo.edition`): lite and full are both in scope unless the rule says otherwise.
// finders-import-begin
import { featureFileFindings } from './feature-files.mjs';
import { lexiconFindings } from './lexicon.mjs';
import { assetsFindings } from './assets.mjs';
import { unusedSymbolFindings } from './unused-symbol.mjs';
import { databaseBaselineFindings } from './database-baseline.mjs';
import { databaseQueuesFindings } from './database-queues.mjs';
import { databaseConfigFindings } from './database-config.mjs';
import { docFreshFindings } from './doc-fresh.mjs';
import { releaseProvenanceFindings } from './release-provenance.mjs';
// finders-import-end

/** The failure codes the finders above emit, so `starci app check` ships their labels (check.mjs adds them to CHECK_CODES). Append-only; the coordinator regenerates it at merge time. */
export const A15_CODES = [
  // codes-begin
  'DB_API_EXPOSED', 'DB_ARCHIVE_MUTATED', 'DB_BASELINE_SHAPE', 'DB_CRON_OWNED', 'DB_EXTENSION_ALLOWED', 'DB_MIGRATION_DESTRUCTIVE', 'DB_PGMQ_DECLARED', 'DB_VAULT_WRITE', 'HFS_APP_LEXICON', 'HFS_ASSET_KIND', 'HFS_ASSET_OVERSIZE', 'HFS_DB_DEPLOY_UNGUARDED', 'HFS_DOC_COMMAND_UNKNOWN', 'HFS_DOC_ENV_UNKNOWN', 'HFS_DOC_PATH_MISSING', 'HFS_DOC_RULE_UNKNOWN', 'HFS_FEATURE_FILE_BUDGET', 'HFS_RELEASE_TAG_MISMATCH', 'HFS_SEED_PII', 'HFS_UNUSED_SYMBOL',
  // codes-end
];

export const FINDERS = [
  // finders-begin
  featureFileFindings,
  lexiconFindings,
  assetsFindings,
  unusedSymbolFindings,
  databaseBaselineFindings,
  databaseQueuesFindings,
  databaseConfigFindings,
  docFreshFindings,
  releaseProvenanceFindings,
  // finders-end
];

/** Findings of every alpha.15 content rule over one repository. */
export function a15Findings(context) {
  return FINDERS.flatMap((finder) => finder(context));
}
