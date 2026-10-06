// git-triggers.mjs - CI_TRIGGERS_RELEASE_ONLY (knowledge/hfs/rules.yaml, gate runtime): the only workflow triggers are a push of a release tag and a person
// dispatching it, and for the runtime repository's own workflows (`.github/workflows/` at the root) also a push to `main`. Every tracked workflow of the
// runtime, its examples and the hfs app templates (so every scaffolded app inherits it) has an `on` that holds only
//   push: {tags: ['v*']}        a release tag, with no `paths` or `*-ignore` filter beside it
//   push: {branches: [main]}    the runtime's own workflows only: `branches` is exactly [main] (a workflow may hold both filters)
//   workflow_dispatch           a person (inputs are allowed)
// A push to another branch, a pull_request, a schedule, a workflow_call or any other event refuses the workflow, and so does a push to main in an
// example or a template: an app's CI runs once per release, on its tag (docs/git-governance.md). Pure apart from ctx.read.
import { parseWorkflow, workflowFindings } from './workflow-source.mjs';

export const CODE = 'CI_TRIGGERS_RELEASE_ONLY';
const RELEASE_TAGS = 'v*';
const RUNTIME_BRANCH = 'main';

/** The CI_TRIGGERS_RELEASE_ONLY findings of one workflow text; a text that is not YAML yields none (the other checks name it). A workflow at the root `.github/workflows/` is the runtime's own and may also push on main. */
export function workflowTriggerFindings({ path: file, text }) {
  const doc = parseWorkflow(text);
  if (!doc || typeof doc !== 'object') return [];
  const ownBranch = file.startsWith('.github/workflows/');
  const refuse = (why) => ({ code: CODE, level: 'error', path: file, message: `${CODE} ${file}: ${why}` });
  const on = doc.on;
  if (on === undefined || on === null) return [refuse('the workflow has no `on` trigger block: it must declare push of tags [v*] and/or workflow_dispatch')];
  let events = on;
  if (typeof on === 'string') events = { [on]: null };
  else if (Array.isArray(on)) events = Object.fromEntries(on.map((event) => [String(event), null]));
  const found = [];
  for (const [event, config] of Object.entries(events)) {
    if (event === 'workflow_dispatch') continue;
    if (event !== 'push') { found.push(refuse(`the trigger \`${event}\` is not allowed: only a push of release tags [${RELEASE_TAGS}] (and, in the runtime's own workflows, of branch ${RUNTIME_BRANCH}) and workflow_dispatch may start CI`)); continue; }
    const filters = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
    const { tags, branches } = filters;
    const tagFilter = Array.isArray(tags) && tags.length === 1 && String(tags[0]) === RELEASE_TAGS;
    const branchFilter = ownBranch && Array.isArray(branches) && branches.length === 1 && String(branches[0]) === RUNTIME_BRANCH;
    if (tags === undefined && branches === undefined) found.push(refuse(ownBranch ? `\`push\` must be filtered to \`tags: ['${RELEASE_TAGS}']\` and/or \`branches: [${RUNTIME_BRANCH}]\` (no other branch starts CI)` : `\`push\` must be filtered to \`tags: ['${RELEASE_TAGS}']\` (a branch push never starts an app's CI)`));
    if (tags !== undefined && !tagFilter) found.push(refuse(`\`push.tags\` must be exactly ['${RELEASE_TAGS}']`));
    if (branches !== undefined && !branchFilter) found.push(refuse(ownBranch ? `\`push.branches\` must be exactly [${RUNTIME_BRANCH}]` : '`push.branches` is not allowed in an example or an app template: its CI runs on the release tag only (`tags: [v*]`)'));
    for (const other of Object.keys(filters).filter((key) => key !== 'tags' && key !== 'branches')) found.push(refuse(`\`push.${other}\` is not allowed beside the trigger filters`));
  }
  return found;
}

/** CI_TRIGGERS_RELEASE_ONLY over every tracked workflow (ctx of scripts/hfs/runtime-check.mjs). */
export const gitTriggerFindings = (ctx) => workflowFindings(ctx, workflowTriggerFindings);
