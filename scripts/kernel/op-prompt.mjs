// op-prompt.mjs — the one [Op] prompt builder for every dispatch path (OPS-07).
// api.mjs dispatch and scripts/route/dispatch-op.mjs's dry-run/spawn preview render the same
// contract text from the same packet shape, so the preview can never drift from the prompt a real
// worker receives (shared-checkout rules, commit policy, report filing and questions used to exist
// only in api.mjs's private copy).

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { OP_REPORT_OUTCOMES, BLOCKER_KINDS } from './report-envelope.mjs';
import { ownerAnswerLine } from './owner-answers.mjs';
import { commitPolicyOf, policyCommits } from './settle-landed.mjs';
import { PATHSPEC_LIST_COMMIT } from '../guards/git-policy.mjs';
import { renderPromptReads } from '../context/pack.mjs';

const VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml';

// An owned path as the worker reads it: bare when it lives in the worker's
// checkout, rooted at its own checkout otherwise.
export const renderOwnedPath = (p, cwd) => (p.root && path.resolve(p.root) !== path.resolve(cwd)
  ? `${p.root.replace(/\\/g, '/')}/${p.path}`.replace(/\/\.$/, '') : p.path);

// The commitPolicy an op's brief declares (modules/ops/ops/<op>.yaml). An unreadable brief means no
// policy - the same fallback dispatch and settle already use.
export const opCommitPolicyOf = ({ skillRoot, op }) => {
  try { return commitPolicyOf(parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'))); } catch { return null; }
};

// packet: the dispatch packet both callers build ({op, brief, params?, context{...}, constraints}).
// A standalone preview (dispatch-op.mjs) has no job, repo or bound workflow - jobId/repo may be null
// and render as the <job-id>/<target-repo> placeholders a real dispatch would substitute.
// contextPack: a resolved scripts/context/pack.mjs context; when given, the mandatory-reads block
// enumerates its resolved file list instead of the fixed load order.
export function buildOpPrompt({ skillRoot, packet, jobId = null, repo = null, priorFailures = [], cwd = repo, reservedReports = [], contextPack = null }) {
  const jobLabel = jobId ?? '<job-id>';
  const repoLabel = repo ?? '<target-repo>';
  const owned = packet.context.owned_paths;
  const unresolved = owned.filter((p) => p.unresolved);
  const roots = [...new Map(owned.filter((p) => p.root).map((p) => [path.resolve(p.root), p])).values()];
  const entrySkill = path.join(skillRoot, 'CONTEXT.md');
  const brief = path.join(skillRoot, packet.brief);
  const verdictContract = path.join(skillRoot, VERDICT_CONTRACT);
  return [
  `[Op] ${packet.op} — one operation, one verdict. You are an ephemeral op agent spawned by the workflow kernel (job ${jobLabel}, attempt ${packet.context.attempt ?? 1}).`,
  ...(packet.context.owner_answers?.length ? [
    `owner_answers: these questions were ALREADY ANSWERED in this job's retry lineage (packet context.owner_answers). Each answer is binding input for`,
    `  this attempt: apply it and record the decision with its answeredBy source. Do NOT ask it again — not reworded, not with the same options;`,
    `  api report refuses such an ask (ask-already-answered). Ask only a genuinely new question the answer left open:`,
    ...packet.context.owner_answers.map(ownerAnswerLine),
  ] : []),
  ...(priorFailures.length ? [
    `prior_attempt_failures: an earlier attempt of this same op settled fail on the kernel checks below.`,
    `  They are your authoritative residual defects — verify and repair them first; records already on`,
    `  disk are prior attempts' output you must check, not license to file done. Re-filing another`,
    `  attempt's report or claiming done without new authored writes is an automatic fail:`,
    ...priorFailures.map((f) => `  - [${f.name}] ${f.evidence}`),
  ] : []),
  ...(contextPack
    ? renderPromptReads(contextPack)
    : [
      `MANDATORY LOAD ORDER — read before any action:`,
      `  1. ${entrySkill} — canonical Source runtime load order (the routed repository may not contain .claude)`,
      `  2. ${brief} — your contract. It declares your reads, writes, steps, proofs and blockers.`,
      `  3. ${verdictContract} — what your return must look like`,
    ]),
  `source_runtime: ${skillRoot}`,
  `target_repository: ${repoLabel}`,
  `brief: ${brief}  (your contract — never renegotiate it)`,
  ...(packet.params ? [`params: ${Object.entries(packet.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')} — the resolved tunables for this dispatch; use these values, never a number you read in prose`] : []),
  `workflow: ${packet.context.workflow?.id ?? '(unbound — packet preview)'} goal_revision=${packet.context.workflow?.goal_revision ?? '(unbound)'} goal_identity=${packet.context.workflow?.goal_identity ?? '(unbound)'}`,
  `owner_language: ${packet.context.owner_language ?? 'en'} — every string the owner reads (ask text, option and pick labels, owner-facing summaries) is written in this language in plain words; canonical records stay English`,
  `product_locale: ${packet.context.product_locale ? `${packet.context.product_locale.locale} (${packet.context.product_locale.source})` : '(unset - no shell or brand locale)'} — every string a product user reads (UI copy, labels, sample data in prompts, message files) is written in this locale, never in owner_language; chrome, nav labels and the demo persona come from .starciwork/shell/index.yaml verbatim`,
  ...(packet.context.owner_delegation ? [`owner_delegation: the owner delegated ask answers to ${packet.context.owner_delegation.asks} until ${packet.context.owner_delegation.until} (config.yaml delegation); an answer receipt with answeredBy ${packet.context.owner_delegation.asks} inside that window IS the owner's answer, except for the excluded classes ${JSON.stringify(packet.context.owner_delegation.excludes)} which stay owner-only`] : []),
  `records: ${packet.context.records.join(', ') || '(none bound)'}`,
  ...(packet.context.cut ? [`cut: ${packet.context.cut.id} ordinal=${packet.context.cut.ordinal}/${packet.context.cut.total} — this job owns only this bounded SAME-op slice; never widen to sibling slices`] : []),
  ...(roots.length ? [`writes_in: ${roots.map((p) => `${path.resolve(p.root)}${p.repository ? ` (repository ${p.repository})` : ''}`).join(', ')} — each owned path below is relative to your checkout ${cwd} unless it is written rooted at another checkout; edit, commit and report head in the checkout that holds it (api settle checks it there)`] : []),
  `owned_paths: ${[...new Set(owned.filter((p) => !p.unresolved).map((p) => renderOwnedPath(p, cwd)))].join(', ') || '(per brief write-ceiling)'}`,
  `   only owned_paths may be modified; anything else is out of scope.`,
  `shared_checkout: other workflows edit, build and commit in this same checkout and branch while you run (modules/kernel/api.yaml conventions.sharedCheckout).`,
  `  never git reset/rebase/commit --amend/stash/clean -f/switch, never checkout or restore a path you do not own, never force-push; a wrong commit is undone with git revert.`,
  `  stage and commit ONLY your owned paths, by name: git add -- <owned paths>; git diff --cached --name-only (only yours); git commit -m "<msg>" -- <owned paths>.`,
  `  dependencies: npm install runs under the repository's dependency lock; never npm ci or delete node_modules while other workflows run (the guard refuses it) - report blocked environment instead.`,
  `  never create a git worktree, junction, symlink or hard link anywhere (git worktree add, mklink, New-Item -ItemType Junction/SymbolicLink, ln): work in this checkout with its own node_modules - a private worktree linked into the live repository deleted 674 live files when it was removed (nivo-fe inc-c8fbf76aa499); report a need for another tree, never make one.`,
  `  your git and npm are the runtime guard: a refusal prints "starci guard: refused ..." and exits 3 - report the need, never work around it.`,
  ...(packet.context.goal ? [`goal: the owner's goal (revision ${packet.context.goal.revision}) is packet context.goal.statement - read it with api op-contract --json; never read the ledger for it.`] : []),
  ...(unresolved.length ? [`unresolved_owned_paths: ${unresolved.map((p) => `${p.path} (repository ${p.repository} is not bound)`).join(', ')} — report blocked with kind authority; never guess a root`] : []),
  `constraints: lease=${packet.constraints.lease ?? '(none)'} model=${packet.constraints.model} budget=${packet.constraints.budget ?? '(unset)'}`,
  `machines: check names in your brief (layoutPolicy.checks, proofs) are executable canonical validators — run them verbatim, never invent placeholder commands (e.g. validateWorkspace):`,
  `  starci-validate → node ${path.join(skillRoot, 'bin', 'starci.mjs')} validate <work-root-or-record-dir> [--json]`,
  `  starci-stacks-check → checkApplicationStacks({repoRoot,environment,deploymentModelFile}) in ${path.join(skillRoot, 'scripts', 'checks', 'stacks.mjs')}`,
  `  starci-starcistacks-check → node ${path.join(skillRoot, 'scripts', 'checks', 'check-starcistacks.mjs')} <repo-root> [--new when this leg creates the repository] [--admitted-at <op-contract admission.admittedAt>] [--json] — the stack declaration's services block (sonar, codecov, ...); read it before asking for any credential`,
  `  starci-code-patterns-check → node ${path.join(skillRoot, 'scripts', 'checks', 'check-scoped-lint.mjs')} --profile <nest|next> --root <repo> [--architecture-config <file>] (--all|[--base <commit>] -- <files>)`,
  `  a check you cannot execute is reported as environment/unavailable evidence — a placeholder result is NOT proof of an upstream defect.`,
  `persistence: workflow state lives in the ledger, reached only through the api commands below (op-contract, report) — never open, query or copy a ledger file; the api refuses kernel verbs from an op terminal (inc-360891316369). Your own state lives in files under owned_paths, never in your memory.`,
  // Every limit below is the exact rule validateOpReport enforces (scripts/kernel/report-envelope.mjs):
  // stated here so a worker's first report passes without a corrective second commit.
  `reporting: your answer is a starci/op-report@1 JSON envelope — report.json on disk (the artifact) filed into the ledger (the durable signal):`,
  `  {"schema":"starci/op-report@1","outcome":"${OP_REPORT_OUTCOMES.join('|')}","summary":"<=600 chars (required)","files":["unique paths under owned_paths"],"checks":[{"name","command","exitCode":<integer>,"evidence":"<=400 chars"}],`,
  `   "open":["unfinished items"] when partial, "question":{"text","options":[],"recommended":<0-based index into options>,"recommendedReason":"<=600 chars"} when ask, "blocker":{"kind":"${BLOCKER_KINDS.join('|')}","detail"} when blocked,`,
  `   "head":"<7-40 hex sha of git rev-parse HEAD>" on done|partial of a committing op, "branch":"<branch>" when pushing, "credentialPending":["ENV_VAR_OR_CUSTODY_KEY"]}`,
  `  only these fields exist: schema, outcome, run, task, dispatch, from, summary, files, checks, open, question, blocker, branch, head, credentialPending.`,
  `  run/task/dispatch/from are stamped by the api — never write another job's identity.`,
  `questions: a question for the owner is outcome ask filed with api report, then end your turn. An Orca orchestration ask reaches only the Kernel (technical guidance inside this contract) and never the owner (inc-b944cbaef24b).`,
  ...(policyCommits(opCommitPolicyOf({ skillRoot, op: packet.op })) ? [`  your op commits (commitPolicy): commit every file you wrote under owned_paths - Work records included - with exact pathspecs (git add -- <path>...; git commit), never another path; on done|partial add "head": the output of \`git rev-parse HEAD\` in the checkout holding your owned paths, after your commit — api report refuses a done|partial report without it, and settle refuses not-landed while one of them is untracked or dirty.`] : []),
  ...(packet.context.commit_only ? [`  commit_only: this attempt authors nothing. The files under owned_paths were written by settled job(s) ${[].concat(packet.context.commit_only.of).join(', ')}${packet.context.commit_only.adoptedFrom ? ` of finished workflow ${packet.context.commit_only.adoptedFrom}, adopted by this workflow` : ''} and never committed: confirm each is one of those jobs' settled output, commit exactly them - a long list goes one path per line, relative to the directory you run git in, into a list file outside the checkout, then ${PATHSPEC_LIST_COMMIT.join('; ')} (the git guard reads the list and refuses it when any line is outside owned_paths) - and report done with head. Changing their content, or touching any other path, is out of scope; a file that is not that job's output is reported blocked, never committed.`] : []),
  `  Write report.json as UTF-8 (Node fs.writeFileSync, or PowerShell Out-File -Encoding utf8); Windows PowerShell Set-Content turns every non-ASCII letter into '?' and the api refuses it. File it:`,
  `  node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} report --repo ${repoLabel} --job ${jobLabel} --report <path-to-report.json>`,
  ...(reservedReports.length ? [`  report paths another op owns under your owned_paths: ${reservedReports.map((r) => `${r.path} (${r.op})`).join(', ')} - never write them; write yours as report.${jobLabel}.json beside them (api report files it there and keeps the owner's).`] : []),
  `  read your contract the same way: node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} op-contract --repo ${repoLabel} --job ${jobLabel}`,
  `returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string} — contract: ${verdictContract}`,
  `Return verdict + evidence paths. Cite suspicion instead of fixing out of scope — a wrong spec is a blocker, not a guess.`,
  ].join('\n');
}
