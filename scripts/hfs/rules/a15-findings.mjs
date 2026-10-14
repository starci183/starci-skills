// a15-findings.mjs - the one place where the alpha.15 content rules (R247-R280) are wired into `starci app check`.
// Each rule module of a batch exports a synchronous finder `({ repoRoot, files, all, repo, resolver, manifest, isRoot, inScope }) => finding[]`
// and is wired here by appending ONE import line and ONE entry to FINDERS. Nothing else in this file changes; the file is union-merged.
// A finder judges its own edition (`repo.edition`): lite and full are both in scope unless the rule says otherwise.
// finders-import-begin
import { deployScanFindings } from './deploy-scan.mjs';
import { deployWorkflowFindings } from './deploy-workflow.mjs';
import { scriptHygieneFindings } from './script-hygiene.mjs';
import { supplyChainFindings } from './supply-chain.mjs';
// finders-import-end

export const FINDERS = [
  // finders-begin
  deployScanFindings,
  deployWorkflowFindings,
  scriptHygieneFindings,
  supplyChainFindings,
  // finders-end
];

/** Findings of every alpha.15 content rule over one repository. */
export function a15Findings(context) {
  return FINDERS.flatMap((finder) => finder(context));
}

/** Codes emitted by the finders (coordinator-managed). */
export const A15_CODES = [];

// A02: include every deployment and supply-chain finding in the bundled app-check catalog.
A15_CODES.push(
  'HFS_HOST_CRON', 'HFS_DEPLOY_NO_LOGIC', 'HFS_DEPLOY_COMPOSE_ON_VPS', 'HFS_DEPLOY_SCHEDULER',
  'HFS_DEPLOY_WORKFLOW', 'HFS_WORKFLOW_PIN', 'HFS_CI_TOOL_INSTALL', 'HFS_APP_WORKFLOW_TRIGGER',
  'HFS_SCRIPT_PLAINTEXT_LOAD', 'HFS_SCRIPT_XTRACE', 'HFS_SERVICE_ROLE_SCOPE',
  'HFS_DEPENDABOT_MISSING', 'HFS_AUDIT_STEP_MISSING', 'HFS_SBOM_MISSING',
);
