// ci-upload.mjs - CI_UPLOAD_NOT_SILENT (knowledge/hfs/rules.yaml, gate runtime): a coverage upload of a CI workflow never skips or
// fails silently. Every step that uses codecov/codecov-action, in a root workflow, an example workflow or a template workflow of
// packages/hfs/templates, must
//   authenticate by OIDC   `with.use_oidc: true`, and the job (or the workflow) grants `permissions.id-token: write`
//   fail the job           `with.fail_ci_if_error: true`, and no `continue-on-error` on the step
//   never be gated         no `if:` that reads a secret or CODECOV_TOKEN: a missing token must not turn the upload into a skipped step
// A template's `{{placeholder}}` lines are blanked before the YAML is parsed. Pure apart from ctx.read.
import { parseWorkflow, workflowFindings } from './workflow-source.mjs';

export const CODE = 'CI_UPLOAD_NOT_SILENT';
const UPLOAD = /^codecov\/codecov-action(?:@|$)/;
const SECRET_GATE = /\bsecrets\.|\bCODECOV_TOKEN\b/;

const truthy = (value) => value === true || String(value).toLowerCase() === 'true';
const grantsIdToken = (permissions) => permissions !== null && typeof permissions === 'object' && String(permissions['id-token']) === 'write';

/** The CI_UPLOAD_NOT_SILENT findings of one workflow text; a text that is not YAML yields none (the other checks name it). */
function workflowUploadFindings({ path: file, text }) {
  if (!text.includes('codecov/codecov-action')) return [];
  const doc = parseWorkflow(text);
  if (!doc) return [];
  const found = [];
  const at = (job, step) => `${file} job ${job} step ${step.name ?? step.uses}`;
  const refuse = (job, step, why) => found.push({ code: CODE, level: 'error', path: file, message: `${CODE} ${at(job, step)}: ${why}` });
  for (const [job, spec] of Object.entries(doc?.jobs ?? {})) {
    for (const step of spec?.steps ?? []) {
      if (typeof step?.uses !== 'string' || !UPLOAD.test(step.uses)) continue;
      const inputs = step.with ?? {};
      if (!truthy(inputs.use_oidc)) refuse(job, step, 'the Codecov upload does not set `use_oidc: true`; a repository secret that is absent turns the upload into a silent skip');
      else if (!grantsIdToken(spec.permissions) && !grantsIdToken(doc.permissions)) refuse(job, step, 'use_oidc needs `permissions: id-token: write` on the job or the workflow, or the OIDC token is never issued');
      if (!truthy(inputs.fail_ci_if_error)) refuse(job, step, 'the upload does not set `fail_ci_if_error: true`; a failed upload would pass the job');
      if (truthy(step['continue-on-error'])) refuse(job, step, 'the upload step has `continue-on-error: true`; a failed upload would pass the job');
      if (typeof step.if === 'string' && SECRET_GATE.test(step.if)) refuse(job, step, 'the upload step is gated on a secret or CODECOV_TOKEN; with the secret absent it is skipped without a failure');
    }
  }
  return found;
}

/** CI_UPLOAD_NOT_SILENT over every tracked workflow (ctx of scripts/hfs/runtime-check.mjs). */
export const ciUploadFindings = (ctx) => workflowFindings(ctx, workflowUploadFindings);
