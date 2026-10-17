// runtime-ci-standard.mjs - R301 CI_STANDARD over the runtime repository's OWN workflows (.github/workflows/*.yml at the root): the same standard
// (knowledge/hfs/ci-standard.yaml, OWNER RULING ci-standard 2026-10-18) the managed app CI follows, checked by the same code (scripts/hfs/rules/ci-standard.mjs,
// scope `runtime`: the items whose `covers` names runtime), plus R299 HFS_WORKFLOW_CONTEXT (scripts/hfs/rules/workflow-contexts.mjs), which the app check runs
// only at app roots. The runtime's workflows are not rendered; they are judged. Pure apart from ctx.read.
import { parseWorkflow } from './workflow-source.mjs';
import { ciStandardFindings } from '../rules/ci-standard.mjs';
import { workflowContextFindings } from '../rules/workflow-contexts.mjs';

const OWN_WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;

/** R301 (scope runtime) and R299 over every tracked root workflow of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function runtimeCiStandardFindings(ctx) {
  return ctx.files.filter((file) => OWN_WORKFLOW.test(file)).flatMap((file) => {
    const text = ctx.read(file);
    if (text === null || text === undefined) return [];
    return [...ciStandardFindings({ doc: parseWorkflow(text), file, scope: 'runtime' }), ...workflowContextFindings({ path: file, text })];
  });
}
