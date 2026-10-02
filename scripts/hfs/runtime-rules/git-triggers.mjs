// git-triggers.mjs - CI_TRIGGERS_RELEASE_ONLY (knowledge/hfs/rules.yaml, gate runtime): the only workflow triggers are a push of a release tag and a person
// dispatching it. Every tracked workflow of the runtime, its examples and the hfs app templates (so every scaffolded app inherits it) has an `on`
// that holds only
//   push: {tags: ['v*']}   a release tag, with no `branches`, `paths` or `*-ignore` filter beside it
//   workflow_dispatch      a person (inputs are allowed)
// A branch push, a pull_request, a schedule, a workflow_call or any other event refuses the workflow: CI runs once per release, on its tag
// (docs/git-governance.md). Pure apart from ctx.read.
import { parseWorkflow, workflowFindings } from './workflow-source.mjs';

export const CODE = 'CI_TRIGGERS_RELEASE_ONLY';
const RELEASE_TAGS = 'v*';

/** The CI_TRIGGERS_RELEASE_ONLY findings of one workflow text; a text that is not YAML yields none (the other checks name it). */
export function workflowTriggerFindings({ path: file, text }) {
  const doc = parseWorkflow(text);
  if (!doc || typeof doc !== 'object') return [];
  const refuse = (why) => ({ code: CODE, level: 'error', path: file, message: `${CODE} ${file}: ${why}` });
  const on = doc.on;
  if (on === undefined || on === null) return [refuse('the workflow has no `on` trigger block: it must declare push of tags [v*] and/or workflow_dispatch')];
  const events = typeof on === 'string' ? { [on]: null } : Array.isArray(on) ? Object.fromEntries(on.map((event) => [String(event), null])) : on;
  const found = [];
  for (const [event, config] of Object.entries(events)) {
    if (event === 'workflow_dispatch') continue;
    if (event !== 'push') { found.push(refuse(`the trigger \`${event}\` is not allowed: only a push of release tags [${RELEASE_TAGS}] and workflow_dispatch may start CI`)); continue; }
    const filters = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
    const tags = filters.tags;
    if (!Array.isArray(tags) || tags.length !== 1 || String(tags[0]) !== RELEASE_TAGS) found.push(refuse(`\`push\` must be filtered to \`tags: ['${RELEASE_TAGS}']\` (a branch push never starts CI)`));
    for (const other of Object.keys(filters).filter((key) => key !== 'tags')) found.push(refuse(`\`push.${other}\` is not allowed beside the release-tag filter`));
  }
  return found;
}

/** CI_TRIGGERS_RELEASE_ONLY over every tracked workflow (ctx of scripts/hfs/runtime-check.mjs). */
export const gitTriggerFindings = (ctx) => workflowFindings(ctx, workflowTriggerFindings);
