// git-triggers.mjs - CI_TRIGGERS_RELEASE_ONLY (knowledge/hfs/rules.yaml, gate runtime): the only workflow triggers are a push of a release tag, a push of a
// release candidate ref and a person dispatching it, and for the runtime repository's own workflows (`.github/workflows/` at the root) also a push to `main`.
// Every tracked workflow of the runtime, its examples and the hfs app templates (so every scaffolded app inherits it) has an `on` that holds only
//   push: {tags: ['v*']}                        a release tag, with no `paths` or `*-ignore` filter beside it
//   push: {branches: [main]}                    the runtime's own workflows only (a workflow may hold the tag and the branch filters together)
//   push: {branches: ['release/candidate-*']}   the release candidate refs (owner ruling candidate-ci, 2026-10-18): `starci release cut` and `starci app release push`
//                                               push the exact release sha to refs/heads/release/candidate-<version> first and move main and the tag only when CI on
//                                               that sha is green. Every workflow may name it (the runtime's beside main), and every ci.yml MUST name it: without
//                                               it no candidate run exists to wait for
//   workflow_dispatch                           a person (inputs are allowed)
// A push to another branch, a pull_request, a schedule, a workflow_call or any other event refuses the workflow, and so does a push to main in an
// example or a template: an app's CI runs on its release candidate and its tag (docs/git-governance.md). Pure apart from ctx.read.
import { parseWorkflow, workflowFindings } from './workflow-source.mjs';
import { workflowEventOptions } from '../../lib/workflow-events.mjs';

export const CODE = 'CI_TRIGGERS_RELEASE_ONLY';
const RELEASE_TAGS = 'v*';
const RUNTIME_BRANCH = 'main';
/** The branch pattern of the release candidate refs (refs/heads/release/candidate-<version>), shared with the release flows. */
export const CANDIDATE_BRANCHES = 'release/candidate-*';
/** The workflows that judge a release (every ci.yml, and the runtime's examples.yml: modules/supervisor/release-cut.yaml candidate.workflows): they must run on the candidate refs. */
const RELEASE_WORKFLOW = /(^|\/)ci\.ya?ml$|^\.github\/workflows\/examples\.ya?ml$/;

const isReleaseTagFilter = (tags) => Array.isArray(tags) && tags.length === 1 && String(tags[0]) === RELEASE_TAGS;
/** The branches a filter may name: main (the runtime's own workflows only) and the candidate pattern. */
const allowedBranches = (ownBranch) => (ownBranch ? [RUNTIME_BRANCH, CANDIDATE_BRANCHES] : [CANDIDATE_BRANCHES]);
const isBranchFilter = (ownBranch, branches) => Array.isArray(branches) && branches.length > 0 && new Set(branches.map(String)).size === branches.length
  && branches.every((branch) => allowedBranches(ownBranch).includes(String(branch)));
const namesCandidate = (branches) => Array.isArray(branches) && branches.map(String).includes(CANDIDATE_BRANCHES);

const missingFilterMessage = (ownBranch) => (ownBranch
  ? `\`push\` must be filtered to \`tags: ['${RELEASE_TAGS}']\` and/or \`branches\` of [${RUNTIME_BRANCH}, '${CANDIDATE_BRANCHES}'] (no other branch starts CI)`
  : `\`push\` must be filtered to \`tags: ['${RELEASE_TAGS}']\` and/or \`branches: ['${CANDIDATE_BRANCHES}']\` (no other branch starts an app's CI)`);

const branchFilterMessage = (ownBranch) => (ownBranch
  ? `\`push.branches\` may name only ${RUNTIME_BRANCH} and '${CANDIDATE_BRANCHES}', each once`
  : `\`push.branches\` may name only '${CANDIDATE_BRANCHES}' in an example or an app template: its CI runs on the release candidate and the release tag`);

function pushFindings({ ownBranch, config, refuse, release }) {
  const filters = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  const { tags, branches } = filters;
  const found = [];
  if (tags === undefined && branches === undefined) found.push(refuse(missingFilterMessage(ownBranch)));
  if (tags !== undefined && !isReleaseTagFilter(tags)) found.push(refuse(`\`push.tags\` must be exactly ['${RELEASE_TAGS}']`));
  if (branches !== undefined && !isBranchFilter(ownBranch, branches)) found.push(refuse(branchFilterMessage(ownBranch)));
  if (release && !namesCandidate(branches)) found.push(refuse(`\`push.branches\` must name '${CANDIDATE_BRANCHES}': the release flows wait for the CI run of the release sha on its candidate ref`));
  for (const other of Object.keys(filters).filter((key) => key !== 'tags' && key !== 'branches')) found.push(refuse(`\`push.${other}\` is not allowed beside the trigger filters`));
  return found;
}

function eventFindings({ event, config, ownBranch, refuse, release }) {
  if (event === 'workflow_dispatch') return [];
  if (event !== 'push') return [refuse(`the trigger \`${event}\` is not allowed: only a push of release tags [${RELEASE_TAGS}], of '${CANDIDATE_BRANCHES}' (and, in the runtime's own workflows, of branch ${RUNTIME_BRANCH}) and workflow_dispatch may start CI`)];
  return pushFindings({ ownBranch, config, refuse, release });
}

/** The CI_TRIGGERS_RELEASE_ONLY findings of one workflow text; a text that is not YAML yields none (the other checks name it). A workflow at the root `.github/workflows/` is the runtime's own and may also push on main. */
function workflowTriggerFindings({ path: file, text }) {
  const doc = parseWorkflow(text);
  if (!doc || typeof doc !== 'object') return [];
  const ownBranch = file.startsWith('.github/workflows/');
  const refuse = (why) => ({ code: CODE, level: 'error', path: file, message: `${CODE} ${file}: ${why}` });
  const on = doc.on;
  if (on === undefined || on === null) return [refuse('the workflow has no `on` trigger block: it must declare push of tags [v*] and/or workflow_dispatch')];
  const events = workflowEventOptions(on, String);
  const release = RELEASE_WORKFLOW.test(file);
  const missingPush = release && !Object.hasOwn(events, 'push') ? [refuse(`the release workflow must run on a push of '${CANDIDATE_BRANCHES}' and of tags [${RELEASE_TAGS}]`)] : [];
  return [...missingPush, ...Object.entries(events).flatMap(([event, config]) => eventFindings({ event, config, ownBranch, refuse, release }))];
}

/** CI_TRIGGERS_RELEASE_ONLY over every tracked workflow (ctx of scripts/hfs/runtime-check.mjs). */
export const gitTriggerFindings = (ctx) => workflowFindings(ctx, workflowTriggerFindings);
