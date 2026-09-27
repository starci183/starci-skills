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
import { renderGrammarContext } from './grammar-context.mjs';
import { jobLogDirOf, sidecarFileOf } from './typed-logs.mjs';
import { seamPromptLines } from './cut-seam.mjs';
import { resumePromptLines } from './resume-context.mjs';

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

// Whether the op's brief (its manifest text) names `needle`: a machine line is printed only for the ops
// whose contract uses it. An unreadable brief names nothing.
const briefUses = (briefFile, needle) => { try { return fs.readFileSync(briefFile, 'utf8').includes(needle); } catch { return false; } };

// The typed-log rule (scripts/kernel/typed-logs.mjs, modules/kernel/api.yaml log): the owner's console renders the
// rows an op logs, never its terminal, so every step, command, edit, check and failure is one typed row.
function loggingLines({ skillRoot, packet, jobLabel, repoLabel, jobId, repo }) {
  const api = path.join(skillRoot, 'scripts', 'kernel', 'api.mjs');
  const wf = packet.context.workflow?.id ?? '<workflow-id>';
  const sidecar = jobId && repo && packet.context.workflow?.id ? sidecarFileOf(repo, packet.context.workflow.id, jobId) : '<repo>/.starciwork/kernel-evidence/<workflow>/jobs/<job>/log.jsonl';
  return [
    `logging: the owner reads your work as TYPED LOG ROWS, not terminal text - log each step, command, file edit, check, test run, render and failure as it happens; --msg is one short line in owner_language, facts go in --data (JSON, at most 4 KB), bulk output goes in a file named in --refs:`,
    `  node ${api} log --repo ${repoLabel} --workflow ${wf} --job ${jobLabel} --kind cmd.run --msg "Chạy unit test" --data '{"cmd":"npm run test:unit","exit":1,"durationMs":41200,"stdoutRef":"<path>"}'`,
    `  kinds: step.start {name} | step.end {name, durationMs, ok} | cmd.run {cmd, exit, durationMs, stdoutRef?, output?} | file.edit {path, added, removed, diffRef?} | check.result {name, pass, evidenceRef?} | test.result {suite, passed, failed, failures:[{name, message, file}]} | render {artifactRef, label} | video {artifactRef, label} | trace {artifactRef} | decision {markdown} | narration {markdown} | error {code, message, hint}`,
    `  owed at minimum: a step.start and a step.end around each step of your brief, and one cmd.run {cmd, exit, durationMs} per check command you put in report.checks (the same command string) - settle warns ${'LOG_TYPED_MISSING'} on your job when they are missing.`,
    `  a browser run (Playwright via scripts/uat/uat-slots.mjs run) records video, trace.zip and screenshots by default into your job's recording folder; name the video and trace in report.files - settle indexes them either way.`,
    `  a burst is cheaper as one JSON object per line appended to ${sidecar} - {"kind","msg","data","refs","at"} - ingested at settle, kept if your terminal dies. Never log a credential, token, password or OTP; never log dispatch/report/settle rows (the runtime derives them).`,
  ];
}

// A long owned-path list rides in a file, never inline: the prompt is the Orca task-create --spec argv,
// and Windows caps a command line at 32,767 characters. nivo workspace-provision's commit-only adoption
// of 993 frozen paths (op-business.decide-cc63d20d87) failed task-create with spawnSync ENAMETOOLONG on
// every dispatch and sat behind owner gates (inc-826e077777de, inc-95fe7c597bd0). Past OWNED_INLINE_MAX
// paths or OWNED_INLINE_CHARS characters the list is written one path per line to owned-paths.txt in the
// job's kernel-evidence folder; the prompt names the file, the count and the first few.
export const OWNED_INLINE_MAX = 60;
export const OWNED_INLINE_CHARS = 6000;
export const ownedPathsFileOf = (repo, workflowId, jobId) => path.join(jobLogDirOf(repo, workflowId, jobId), 'owned-paths.txt');
export function ownedPathsLine({ paths, repo = null, workflowId = null, jobId = null }) {
  if (!paths.length) return 'owned_paths: (per brief write-ceiling)';
  const inline = paths.join(', ');
  if (paths.length <= OWNED_INLINE_MAX && inline.length <= OWNED_INLINE_CHARS) return `owned_paths: ${inline}`;
  const head = paths.slice(0, 10).join(', ');
  if (!repo || !workflowId || !jobId) return `owned_paths: ${paths.length} paths (a real dispatch lists them in owned-paths.txt); first 10: ${head}`;
  const file = ownedPathsFileOf(repo, workflowId, jobId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${paths.join('\n')}\n`, 'utf8');
  return `owned_paths: ${paths.length} paths, one per line in ${file} (read it before any write; it is also your git pathspec list: git add --pathspec-from-file=<it>). First 10: ${head}`;
}

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
  ...(packet.context.environment ? [
    `environment: the runtime checked the stack this walk runs on before dispatch (scripts/uat/env-health.mjs) - ${packet.context.environment.ready ? 'READY' : 'NOT READY'} at ${packet.context.environment.checkedAt}:`,
    ...packet.context.environment.services.map((s) => `  - ${s.env}/${s.service} ${s.state} ${s.url}${s.status != null ? ` (${s.status})` : ''}${s.discovered ? ` - discovered ${s.discovered}` : ''}${s.action ? ` - ${s.action}` : ''}`),
    ...(packet.context.environment.remedies ?? []).map((r) => `  remedy: ${r}`),
    `  Bring a down service up ONLY through: node ${path.join(skillRoot, 'scripts', 'uat', 'env-health.mjs')} serve --repo ${repo ?? '<target-repo>'} --env <id> --service <name> --cwd <checkout> [--url <probe>] -- <start command> (it registers the server so the next pre-step restarts it itself), then re-run env-health check and put its result in report.checks as name "env-health" with its exit code (0 ready, 3 not ready).`,
    `  If the stack is still not ready, file outcome blocked with blocker kind environment - never failed: a walk on a dead stack proves nothing about the product. A probe-drift row is a stale declaration, not a failure.`,
  ] : []),
  ...(packet.context.repair_for ? [
    `repair_for: this job repairs what ${packet.context.repair_for.op} ${packet.context.repair_for.of} found (route ${packet.context.repair_for.route}, class ${packet.context.repair_for.class}). Its root-cause claim, evidence, counterCheck and expectedFix are packet context.repair_for.rootCause: confirm the claim against the code first (the counterCheck), fix it inside owned_paths, run the recheck the claim names if you can, and report done - ${packet.context.repair_for.op} runs again behind you.`,
  ] : []),
  ...(priorFailures.length ? [
    `prior_attempt_failures: an earlier attempt of this same op settled fail on the kernel checks below.`,
    `  They are your authoritative residual defects — verify and repair them first; records already on`,
    `  disk are prior attempts' output you must check, not license to file done. Re-filing another`,
    `  attempt's report or claiming done without new authored writes is an automatic fail:`,
    ...priorFailures.map((f) => `  - [${f.name}] ${f.evidence}`),
  ] : []),
  ...resumePromptLines(packet.context.resume_from),
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
  ...renderGrammarContext(packet.context.grammar),
  ...(packet.context.cut ? [`cut: ${packet.context.cut.id} ordinal=${packet.context.cut.ordinal}/${packet.context.cut.total} — this job owns only this bounded SAME-op slice; never widen to sibling slices`] : []),
  ...seamPromptLines({ cut: packet.context.cut, jobLabel, api: path.join(skillRoot, 'scripts', 'kernel', 'api.mjs'), repoLabel }),
  ...(roots.length ? [`writes_in: ${roots.map((p) => `${path.resolve(p.root)}${p.repository ? ` (repository ${p.repository})` : ''}`).join(', ')} — each owned path below is relative to your checkout ${cwd} unless it is written rooted at another checkout; edit, commit and report head in the checkout that holds it (api settle checks it there)`] : []),
  ownedPathsLine({ paths: [...new Set(owned.filter((p) => !p.unresolved).map((p) => renderOwnedPath(p, cwd)))], repo, workflowId: packet.context.workflow?.id ?? null, jobId }),
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
  `    a run wider than your owned_paths (the whole feature, the Work root) adds --owned <your owned paths, comma-separated>: a refused finding in a record outside them moves to outOfScope - another owner's pre-existing finding, named in your report (rootCause when it blocks your result) and never a reason to report blocked or failed. Only an in-scope refusal is yours.`,
  `  starci-stacks-check → checkApplicationStacks({repoRoot,environment,deploymentModelFile}) in ${path.join(skillRoot, 'scripts', 'checks', 'stacks.mjs')}`,
  `  starci-starcistacks-check → node ${path.join(skillRoot, 'scripts', 'checks', 'check-starcistacks.mjs')} <repo-root> [--new when this leg creates the repository] [--admitted-at <op-contract admission.admittedAt>] [--json] — the stack declaration's services block (sonar, codecov, ...); read it before asking for any credential`,
  `  starci-code-patterns-check → node ${path.join(skillRoot, 'scripts', 'checks', 'check-scoped-lint.mjs')} --profile <nest|next> --root <repo> [--architecture-config <file>] (--all|[--base <commit>] -- <files>) --compact  (--compact for any output you keep as evidence: the full report is 20-30 MB)`,
  ...(briefUses(brief, '--isolate') ? [`  sonar → node ${path.join(skillRoot, 'scripts', 'checks', 'sonar-local.mjs')} scan --cwd <absolute repository root> --wait --isolate --lcov <this attempt's slice lcov, in a job-private directory outside the checkout> --base <commit before your first edit> --paths <owned paths> --out E/sonar.json --log E/sonar.txt`] : []),
  `  a check you cannot execute is reported as environment/unavailable evidence — a placeholder result is NOT proof of an upstream defect.`,
  `  a repository-wide gate (typecheck, lint, tests over the whole tree) red ONLY on files you did not change and that import nothing you changed, while your scoped runs pass, is another op's defect: record that check with its real exitCode and "failing":["path[:line]", ...] plus rootCause {node:"<the op that owns that file, or its workflow>", self:false, category:"shared-change", claim, evidence:[the failing line]}; it is never an open item, never partial, never a blocker, and it never turns an otherwise green done into anything else (modules/ops/_common.yaml Bounded finish and blockers (d)). The api attributes it to the peer whose commit left it and routes it there.`,
  `persistence: workflow state lives in the ledger, reached only through the api commands below (op-contract, report) — never open, query or copy a ledger file; the api refuses kernel verbs from an op terminal (inc-360891316369). Your own state lives in files under owned_paths, never in your memory.`,
  // Every limit below is the exact rule validateOpReport enforces (scripts/kernel/report-envelope.mjs):
  // stated here so a worker's first report passes without a corrective second commit.
  `reporting: your answer is a starci/op-report@1 JSON envelope — report.json on disk (the artifact) filed into the ledger (the durable signal):`,
  `  {"schema":"starci/op-report@1","outcome":"${OP_REPORT_OUTCOMES.join('|')}","summary":"<=600 chars (required)","files":["unique paths under owned_paths"],"checks":[{"name","command","exitCode":<integer>,"evidence":"<=400 chars"}],`,
  `   "open":["unfinished items"] when partial, "question":{"text","options":[],"recommended":<0-based index into options>,"recommendedReason":"<=600 chars"} when ask, "blocker":{"kind":"${BLOCKER_KINDS.join('|')}","detail"} when blocked,`,
  `   "head":"<7-40 hex sha of git rev-parse HEAD>" on done|partial of a committing op, "branch":"<branch>" when pushing, "credentialPending":["ENV_VAR_OR_CUSTODY_KEY"],`,
  `   "rootCause":{"node":"<op, op#instance, or Work record id e.g. impl.<feature>.<repo>.<name>>","self":<boolean>,"category","claim":"<=600 chars","evidence":["<=400 chars"],"counterCheck","expectedFix","recheck","op":"<build op owning the fix, e.g. backend.implement>","files":["repo paths the fix touches"]} when the failure is another node's output (node, category, claim, evidence required) - the runtime routes a repair to that owner instead of re-running you,`,
  `   "failureClass":"environment|tool|findings|product|deterministic|transient" on failed: environment = the stack under test was not up, tool = a checker could not run, product = the thing you verified is wrong (name its owner in rootCause), transient = a flake a plain re-run may clear; only transient and tool are retried as-is,`,
  `   "claims":[{"paths":["proof files it covers; none = all"],"frs":["fr.<feature>.<name>"],"cases":["ANATOMY-2 case-1"],"shapes":["XBase#state"],"specs":["<spec path>"]}] naming what your proof files verified}`,
  `  only these fields exist: schema, outcome, run, task, dispatch, from, summary, files, checks, open, question, blocker, branch, head, credentialPending, rootCause, claims, failureClass.`,
  `  run/task/dispatch/from are stamped by the api — never write another job's identity.`,
  ...loggingLines({ skillRoot, packet, jobLabel, repoLabel, jobId, repo }),
  `questions: a question for the owner is outcome ask filed with api report, then end your turn. An Orca orchestration ask reaches only the Kernel (technical guidance inside this contract) and never the owner (inc-b944cbaef24b).`,
  ...(policyCommits(opCommitPolicyOf({ skillRoot, op: packet.op })) ? [`  your op commits (commitPolicy): commit every file you wrote under owned_paths - Work records included - with exact pathspecs (git add -- <path>...; git commit), never another path; on done|partial add "head": the output of \`git rev-parse HEAD\` in the checkout holding your owned paths, after your commit — api report refuses a done|partial report without it, and settle refuses not-landed while one of them is untracked or dirty.`] : []),
  ...(packet.context.commit_only ? [`  commit_only: this attempt authors nothing. The files under owned_paths were written by settled job(s) ${[].concat(packet.context.commit_only.of).join(', ')}${packet.context.commit_only.adoptedFrom ? ` of finished workflow ${packet.context.commit_only.adoptedFrom}, adopted by this workflow` : ''} and never committed: confirm each is one of those jobs' settled output - the runtime attributed each file by the job's report files, its run window (the file's mtime inside the job's dispatch-to-report span) or, for a finished workflow's debt, the newest covering job (api reconcile --work-debt); a file attributed by window or cover is that output even when the job's report.files does not list it, so check it is uncommitted and under owned_paths, never that report.files names it - commit exactly them - a long list goes one path per line, relative to the directory you run git in, into a list file outside the checkout, then ${PATHSPEC_LIST_COMMIT.join('; ')} (the git guard reads the list and refuses it when any line is outside owned_paths) - and report done with head. Changing their content, or touching any other path, is out of scope; a file that is not that job's output is reported blocked, never committed.`] : []),
  `  Write report.json as UTF-8 (Node fs.writeFileSync, or PowerShell Out-File -Encoding utf8); Windows PowerShell Set-Content turns every non-ASCII letter into '?' and the api refuses it. File it:`,
  `  node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} report --repo ${repoLabel} --job ${jobLabel} --report <path-to-report.json>`,
  ...(reservedReports.length ? [`  report paths another op owns under your owned_paths: ${reservedReports.map((r) => `${r.path} (${r.op})`).join(', ')} - never write them; write yours as report.${jobLabel}.json beside them (api report files it there and keeps the owner's).`] : []),
  `  read your contract the same way: node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} op-contract --repo ${repoLabel} --job ${jobLabel}`,
  `returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string} — contract: ${verdictContract}`,
  `Return verdict + evidence paths. Cite suspicion instead of fixing out of scope — a wrong spec is a blocker, not a guess.`,
  ].join('\n');
}
