import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { validateStep } from '../../scripts/validate-step.mjs';
import { sessionRootOf } from '../../scripts/validate-request.mjs';
import { workflowReportErrors, WORKFLOW_OPERATOR } from '../../scripts/workflow-verification.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function validateWorkflowStep(branch, root = ROOT) {
  const base = await validateStep(root, branch);
  const errors = [...base.errors];
  if (base.response?.operatorId !== WORKFLOW_OPERATOR || base.response.status !== 'done') return { errors };
  if ((base.response.commits ?? []).length || (base.response.fallbacks ?? []).length) errors.push('workflow.verify is read-only and has no fallback or commit');
  try {
    const state = JSON.parse(readFileSync(path.join(sessionRootOf(branch), 'state.json'), 'utf8'));
    errors.push(...await workflowReportErrors(root, branch, base.request, state));
  } catch (error) { errors.push(`workflow.verify: ${error.message}`); }
  return { errors };
}
