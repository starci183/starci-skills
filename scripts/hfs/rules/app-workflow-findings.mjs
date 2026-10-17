// app-workflow-findings.mjs - app-root workflow scope shared by deployment and expression-context rules.
import { workflowFindings } from '../runtime-rules/workflow-source.mjs';
import { readText } from './read.mjs';

/** Judge tracked workflows only at full/lite app roots, preserving each caller's duplicate-file policy. */
export function appWorkflowFindings({ repoRoot, files, all = files, repo, isRoot, inScope = () => true }, perWorkflow, { dedupe = false } = {}) {
  if (isRoot === false || repo?.kind !== 'app' || !['lite', 'full'].includes(repo.edition)) return [];
  const selected = dedupe ? [...new Set(all)] : all;
  return workflowFindings({ files: selected.filter((file) => inScope(file)), read: (file) => readText(repoRoot, file) }, perWorkflow);
}
