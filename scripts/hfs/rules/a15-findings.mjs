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
import { feStackAllowlistFindings } from './fe-stack.mjs';
import { appEnvRequiredFindings } from './app-env-required.mjs';
import { ageKeyCustodyFindings } from './secrets.mjs';
import { canonCopyDriftFindings } from './canon-copy-drift.mjs';
import { secretCustodyOnlyFindings } from './secret-custody-only.mjs';
import { bootProofFindings } from './boot-proof.mjs';
import { coverageBelowFindings } from './coverage-below.mjs';
import { deployScanFindings } from './deploy-scan.mjs';
import { deployWorkflowFindings } from './deploy-workflow.mjs';
import { scriptHygieneFindings } from './script-hygiene.mjs';
import { supplyChainFindings } from './supply-chain.mjs';
import { envParityFindings } from './env-parity.mjs';
import { envValueShapeFindings } from './env-value-shape.mjs';
import { liteProofLaneFindings } from './lite-proof-lane.mjs';
import { stacksSwarmFindings } from './stacks-swarm.mjs';
import { stacksReleaseFindings } from './stacks-release.mjs';
import { stacksIngressFindings } from './stacks-ingress.mjs';
import { stacksLiteBackingFindings } from './stacks-lite-backing.mjs';
import { stackToolingFindings } from './stack-tooling.mjs';
import { stacksDeployFindings } from './stacks-deploy.mjs';
import { ciCustodyFindings } from './ci-custody.mjs';
import { workflowContextsFindings } from './workflow-contexts.mjs';
import { ciStandardAppFindings } from './ci-standard.mjs';
import { feBuildArgsFindings } from './fe-build-args.mjs';
// finders-import-end

/** The failure codes the finders above emit, so `starci app check` ships their labels (check.mjs adds them to CHECK_CODES). Append-only; the coordinator regenerates it at merge time. */
export const A15_CODES = [
  // codes-begin
  'FE_PUBLIC_BUILD_ARG_MISSING',
  'HFS_WORKFLOW_CONTEXT',
  'CI_STANDARD',
  'CI_SECRET_SEALED', 'APP_SECRET_IN_CI', 'CI_DECLARATION_DRIFT',
  'BACKUP_PROOF_MISSING', 'BACKUP_UNDECLARED', 'BE_APP_BOOT_PROOF_MISSING', 'BE_APP_ENV_REQUIRED', 'BE_APP_MODULE_LIST_INLINE', 'BE_LITE_PROOF_LANE_MISSING', 'DB_API_EXPOSED', 'DB_ARCHIVE_MUTATED', 'DB_BASELINE_SHAPE', 'DB_CRON_OWNED', 'DB_EXTENSION_ALLOWED', 'DB_MIGRATION_DESTRUCTIVE', 'DB_PGMQ_DECLARED', 'DB_VAULT_WRITE', 'ENV_DUPLICATE', 'ENV_EXAMPLE_DRIFT', 'ENV_PUBLIC_SEALED', 'ENV_REQUIRED_UNSET', 'ENV_SEALED_UNREAD', 'ENV_VALUE_SHAPE', 'FE_STACK_CORE_MISSING', 'FE_STACK_UNLISTED', 'HFS_AGE_KEY_CUSTODY', 'HFS_APP_LEXICON', 'HFS_APP_WORKFLOW_TRIGGER', 'HFS_ASSET_KIND', 'HFS_ASSET_OVERSIZE', 'HFS_AUDIT_STEP_MISSING', 'HFS_CANON_COPY_DRIFT', 'HFS_CI_TOOL_INSTALL', 'HFS_COVERAGE_BELOW', 'HFS_DB_DEPLOY_UNGUARDED', 'HFS_DEPENDABOT_MISSING', 'HFS_DEPLOY_COMPOSE_ON_VPS', 'HFS_DEPLOY_NO_LOGIC', 'HFS_DEPLOY_SCHEDULER', 'HFS_DEPLOY_WORKFLOW', 'HFS_DOC_COMMAND_UNKNOWN', 'HFS_DOC_ENV_UNKNOWN', 'HFS_DOC_PATH_MISSING', 'HFS_DOC_RULE_UNKNOWN', 'HFS_FEATURE_FILE_BUDGET', 'HFS_HOST_CRON', 'HFS_RELEASE_TAG_MISMATCH', 'HFS_SBOM_MISSING', 'HFS_SCHEDULE_UNDECLARED', 'HFS_SCRIPT_PLAINTEXT_LOAD', 'HFS_SCRIPT_XTRACE', 'HFS_SECRET_OUTSIDE_ENC', 'HFS_SECRET_PLAINTEXT_FILE', 'HFS_SEED_PII', 'HFS_SERVICE_ROLE_SCOPE', 'HFS_UNUSED_SYMBOL', 'HFS_WORKFLOW_PIN', 'STACKS_DEPLOY_CONFIG_INVALID', 'STACKS_DNS_UNDECLARED', 'STACKS_HEALTHCHECK_MISSING', 'STACKS_HOST_UNROUTED', 'STACKS_INGRESS_UNDECLARED', 'STACKS_INGRESS_UNKNOWN', 'STACKS_LITE_SELFHOSTED_DB', 'STACKS_MODEL_UNAVAILABLE', 'STACKS_PLACEMENT_MISSING', 'STACKS_PORT_PUBLISHED', 'STACKS_REALTIME_SCALED', 'STACKS_RELEASE_UNDECLARED', 'STACKS_SECOND_INGRESS', 'STACKS_SECRET_ENV_LITERAL', 'STACKS_SECRET_NOT_EXTERNAL', 'STACKS_SECRET_UNVERSIONED', 'STACKS_SIDECAR_DB_UNSUPPORTED', 'STACKS_SIDECAR_VOLUME_UNDECLARED', 'STACKS_TLS_UNDECLARED', 'STACKS_UPDATE_POLICY_MISSING', 'STACK_TOOLING_REIMPLEMENTED',
  // codes-end
];

export const FINDERS = [
  // finders-begin
  feBuildArgsFindings,
  workflowContextsFindings,
  ciStandardAppFindings,
  featureFileFindings,
  lexiconFindings,
  assetsFindings,
  unusedSymbolFindings,
  databaseBaselineFindings,
  databaseQueuesFindings,
  databaseConfigFindings,
  docFreshFindings,
  releaseProvenanceFindings,
  feStackAllowlistFindings,
  appEnvRequiredFindings,
  ageKeyCustodyFindings,
  canonCopyDriftFindings,
  secretCustodyOnlyFindings,
  bootProofFindings,
  coverageBelowFindings,
  deployScanFindings,
  deployWorkflowFindings,
  scriptHygieneFindings,
  supplyChainFindings,
  envParityFindings,
  envValueShapeFindings,
  liteProofLaneFindings,
  stacksSwarmFindings,
  stacksReleaseFindings,
  stacksIngressFindings,
  stacksLiteBackingFindings,
  stackToolingFindings,
  stacksDeployFindings,
  ciCustodyFindings,
  // finders-end
];

/** Findings of every alpha.15 content rule over one repository. */
export function a15Findings(context) {
  // `starci app check` always passes the full context; a partial one (a finder spec driving the registry with only the fields its rule reads) must not crash the finders of other rules.
  const full = Boolean(context.repoRoot && context.repo && context.resolver && context.manifest);
  return FINDERS.flatMap((finder) => {
    if (full) return finder(context);
    try { return finder(context); } catch { return []; }
  });
}

// A02: include every deployment and supply-chain finding in the bundled app-check catalog.
