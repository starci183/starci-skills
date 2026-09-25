#!/usr/bin/env node
// define-goal.mjs — executable half of modules/goal/define-goal.yaml.
// One owner prompt -> one workflows row + one goals row (rev 0, carrying the
// derived op chain) + one pending inbox row in <repo>/.starciwork/runtime.sqlite.
// The queue is the contract: kernels claim from inbox, never from chat.
//
//   node scripts/goal/define-goal.mjs --repo <path> --text "<owner prompt>" [--title <t>] [--json] [--plan]
//   node scripts/goal/define-goal.mjs --project <name> --text "<owner prompt>" [--title <t>] [--json] [--plan]
//
// --params '{"<op>": {"<name>": <value>}}' attaches the owner's tunables to the
// matching legs of the derived chain, so a choice like "three candidates per
// screen" is a value on the leg rather than a sentence the op has to read out of
// the goal prose. Each name must be one the op brief declares with setBy owner
// (modules/schemas/op.schema.yaml); `api enqueue` validates the value and
// refuses params-invalid. A leg the chain does not hold is an error here.
//
// --project resolves <source>/.workspaces/projects/<name>/work.json
// (starci/workspace-binding@1), where <source> is the repository that owns this
// .claude runtime. Every repositories.<role>.pathFromSource resolves to a
// project repository the plan cold-scans, and work.ownerRole names the
// repository that owns the project ledger: the goal persists to
// <owner-repo>/.starciwork/runtime.sqlite — project-owned, never the host repo.
// --repo keeps the single-repo behavior (the ledger sits under it). The two
// options are mutually exclusive.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/index.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectLedger, openLedger, ledgerFileFor, SETTLED_JOB_STATUSES } from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { parseJson } from '../lib/json.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Source = the repository containing this .claude; the project registry lives
// beside it at .workspaces/projects/<name>/work.json. STARCI_SOURCE_ROOT points
// the registry lookup at another Source — the seam for fixtures and for a
// runtime copy (a worktree) that does not sit inside its Source.
const sourceRoot = process.env.STARCI_SOURCE_ROOT ? path.resolve(process.env.STARCI_SOURCE_ROOT) : path.dirname(skillRoot);
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const projectName = arg('project');
const repoArg = arg('repo');
const text = arg('text');
const title = arg('title');
const reviseWorkflowId = arg('revise');
const revisionReason = arg('reason', 'owner-approved plan-divergence correction');
const approveRevision = arg('approve-revision');
const routingBias = parseJson(arg('routing-bias', 'null'));
// Owner tunables per leg: {"<op>": {"<name>": <value>}}. Legality is the op
// brief's business (api enqueue validates it); here the only rules are that the
// flag parses as a map of maps and that every named op is in the derived chain.
const legParams = (() => {
  const raw = arg('params');
  if (raw == null) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { console.error(`--params is not JSON: ${e.message}`); process.exit(2); }
  const isMap = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isMap(parsed)) { console.error('--params must be a JSON object keyed by op id: {"<op>": {"<name>": <value>}}'); process.exit(2); }
  for (const [op, values] of Object.entries(parsed)) {
    if (!isMap(values)) { console.error(`--params ${op} must be a JSON object of {name: value}`); process.exit(2); }
  }
  return parsed;
})();
const asJson = process.argv.includes('--json');
const planOnly = process.argv.includes('--plan');
const usage = `usage: define-goal.mjs (--repo <path> | --project <name>) --text "<owner prompt>" [--title] [--params '{"<op>":{"<name>":<value>}}'] [--json] [--plan] [--revise <workflow-id> [--reason <text>] [--approve-revision <preview-token>]]`;
if (projectName && repoArg) { console.error(`--project and --repo are mutually exclusive\n${usage}`); process.exit(2); }
if (!text) { console.error(usage); process.exit(2); }
if (approveRevision && !reviseWorkflowId) { console.error('--approve-revision requires --revise <workflow-id>'); process.exit(2); }

// --project: resolve the workspace binding. work.ownerRole picks the ledger
// owner out of the declared repositories; every declared repository is a
// cold-scan target for --plan.
function resolveProject(name) {
  const file = path.join(sourceRoot, '.workspaces', 'projects', name, 'work.json');
  if (!fs.existsSync(file)) { console.error(`unknown project '${name}': no ${file}`); process.exit(2); }
  let binding;
  try { binding = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(`${file}: ${e.message}`); process.exit(2); }
  const repos = Object.entries(binding?.repositories ?? {})
    .filter(([, r]) => typeof r?.pathFromSource === 'string' && r.pathFromSource.trim())
    .map(([role, r]) => ({ role, path: path.resolve(sourceRoot, r.pathFromSource) }));
  const ownerRole = binding?.work?.ownerRole ?? null;
  const owner = repos.find(r => r.role === ownerRole);
  if (!owner) { console.error(`${file}: work.ownerRole '${ownerRole}' names no repository with a pathFromSource`); process.exit(2); }
  const workPath = typeof binding?.work?.pathFromRepository === 'string' && binding.work.pathFromRepository.trim()
    ? binding.work.pathFromRepository.trim() : '.starciwork';
  return { project: typeof binding?.project === 'string' && binding.project.trim() ? binding.project.trim() : name, file, ownerRole, ownerRepo: owner.path, workRoot: path.resolve(owner.path, workPath), repos };
}

const project = projectName ? resolveProject(projectName) : null;
// `repo` is the ledger owner in both modes: the resolved owner repository for
// --project, the named/current repository for --repo.
const repo = project ? project.ownerRepo : path.resolve(repoArg ?? process.cwd());
const scanRepos = project ? project.repos : [{ role: null, path: repo }];

// The owner repository's Work root, when it exists: route-plan --work reads
// the records that settle a variable out of band (a done brand record).
const workRoot = project ? project.workRoot : path.join(repo, '.starciwork');

// Derive the ideal op chain through the same planner the kernel uses —
// advisory only; the kernel re-derives at boot and diffs, never trusts blindly.
function deriveOpChain(prompt) {
  const work = fs.existsSync(workRoot) ? ['--work', workRoot] : [];
  const r = spawnSync(process.execPath,
    [path.join(skillRoot, 'scripts', 'route', 'route-plan.mjs'), '--text', prompt, '--json', ...work],
    { encoding: 'utf8', timeout: 60000, cwd: skillRoot });
  if (r.status !== 0) return null;
  return parseJson(r.stdout);
}

// Cold per-repo scan for the plan's STATE section (scripts/goal/assess.mjs).
// A missing script or a failed run degrades to 'assess unavailable' — the plan
// still prints the chain and the will-write list; nothing is persisted either way.
function assessRepos(repos) {
  const script = path.join(skillRoot, 'scripts', 'goal', 'assess.mjs');
  if (!fs.existsSync(script)) return { available: false, note: 'assess unavailable', data: null };
  const r = spawnSync(process.execPath,
    [script, ...repos.flatMap(p => ['--repo', p.path]), '--json'],
    { encoding: 'utf8', timeout: 120000, cwd: skillRoot });
  if (r.status !== 0 || !(r.stdout ?? '').trim()) {
    return { available: false, note: 'assess unavailable', data: null, stderr: (r.stderr ?? '').trim().slice(0, 300) || undefined };
  }
  try { return { available: true, data: JSON.parse(r.stdout) }; }
  catch { return { available: false, note: 'assess unavailable', data: null }; }
}

// Cold effort tiers for the plan table — no dispatch has run, so each leg's
// estimate is a class guess, and the table says so ('estimate is cold'). The
// tier is matched on the leg label, so a mode-named instance
// (workspace.manage#stacks) is classed apart from its op's default mode.
const COLD_MINUTES = { easy: 15, medium: 45, hard: 90 };
const COLD_TIER = [
  [/^(provision\.ask|request\.analyze|scope\.define|scope\.finish|decision\.prepare|goal\.revise|workspace\.manage)$/, 'easy'],
  [/\.(implement|refactor)$|^(integration|e2e|uat)\.verify$|^(release\.deliver|runtime\.operate|workspace\.manage#stacks)$/, 'hard'],
];
const tierOf = op => COLD_TIER.find(([re]) => re.test(op))?.[1] ?? 'medium';

// Per-role line for the STATE section. assess.mjs --json prints one object for
// one --repo and an array for several; each entry names its resolved `repo`.
// A row shows its own repository's summary, never another repository's.
const samePath = (a, b) => {
  const norm = p => path.resolve(p);
  return process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};
const assessLineFor = (data, repoPath) => {
  const entries = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : [];
  const hit = entries.find(e => typeof e?.repo === 'string' && samePath(e.repo, repoPath));
  if (!hit) return 'not assessed';
  if (!hit.exists) return 'missing';
  return `files ${hit.size?.files ?? 0}, loc ~${hit.size?.loc ?? 0}, tests ${hit.testInfra?.framework ?? 'none'}, starciwork ${hit.starciwork?.present ? 'present' : 'absent'}`;
};

// Owner config surface for the plan table: <skillRoot>/config.yaml (gitignored,
// seeded from config.example.yaml by the installer) decides the kernel seat
// before route-model does — precedence: --agent flag >
// config.yaml kernel pin > route-model. The plan shows the pin so the owner
// sees the config effect before ok; the kernel itself resolves it at
// start-workflow time. A missing or unparsable file is reported, never fatal.
function ownerConfigSummary() {
  const file = path.join(skillRoot, 'config.yaml');
  if (!fs.existsSync(file)) return { file: null };
  try {
    const c = parseYaml(fs.readFileSync(file, 'utf8')) ?? {};
    return {
      file: path.relative(skillRoot, file),
      kernel: {
        agent: c?.kernel?.agent ?? null,
        model: c?.kernel?.model ?? null,
        effort: c?.kernel?.effort ?? c?.effort ?? null,
        ...(Array.isArray(c?.kernel?.group)
          ? { group: c.kernel.group.map(m => ({ agent: m?.agent ?? null, model: m?.model ?? null })) } : {}),
      },
      budgets: c?.budgets ?? null,
    };
  } catch (e) { return { file: path.relative(skillRoot, file), error: `config.yaml unparsable: ${e.message}` }; }
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'goal';
const workflowId = `wf-${slug(title || text)}-${Date.now().toString(36)}`;
const goalIdentity = sha256(text).slice(0, 16);
// Only a planned (status ok) chain is a chain. When no archetype matches,
// route-plan reports the INTENT tier (needs-owner) — that is an underivable
// chain the kernel derives at boot, never a stored or printed leg list.
const derived = deriveOpChain(text);
const chain = derived?.status === 'ok' ? derived : null;
const underivable = chain ? null : {
  status: derived?.status ?? 'unavailable',
  reason: derived?.ambiguity?.note ?? derived?.reason ?? 'route-plan produced no chain',
};
if (legParams) {
  const ops = new Set((chain?.legs ?? []).map(l => l.op));
  const unknown = Object.keys(legParams).filter(op => !ops.has(op));
  if (unknown.length) {
    console.error(`--params names op(s) the derived chain does not hold: ${unknown.join(', ')}${ops.size ? ` (chain: ${[...ops].join(', ')})` : ' (chain: underivable)'}`);
    process.exit(2);
  }
  for (const leg of chain.legs) if (legParams[leg.op]) leg.params = legParams[leg.op];
}
const now = Date.now();
const legLabel = l => `${l.op}${l.instance ? '#' + l.instance : ''}`;
const chainOps = c => c?.legs?.map(legLabel) ?? [];
const contentDigest = sha256(text);

function readRevisionBase(id) {
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) throw new Error(`cannot revise ${id}: ledger does not exist at ${file}`);
  const ledger = inspectLedger({ file });
  try {
    const workflow = ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(id);
    if (!workflow) throw new Error(`cannot revise ${id}: workflow not found in ${file}`);
    if (workflow.phase === 'finished' || workflow.archived_at !== null) throw new Error(`cannot revise ${id}: finished or archived workflows are immutable`);
    const goals = ledger.db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision').all(id);
    if (!goals.length) throw new Error(`cannot revise ${id}: workflow has no persisted goal`);
    const identities = new Set(goals.map(g => g.goal_identity));
    if (identities.size !== 1) throw new Error(`cannot revise ${id}: persisted goal identity lineage is inconsistent`);
    const goal = goals.at(-1);
    if (workflow.goal_identity && workflow.goal_identity !== goal.goal_identity) {
      throw new Error(`cannot revise ${id}: workflow identity does not match its latest goal`);
    }
    const liveKernel = !!ledger.db.prepare("SELECT 1 FROM signals WHERE scope='kernel' AND key=? AND (expires_at IS NULL OR expires_at>?) LIMIT 1").get(id, Date.now());
    const settled = SETTLED_JOB_STATUSES.map(() => '?').join(',');
    const openOperationJobs = ledger.db.prepare(`SELECT job_id,op_id,status FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN (${settled}) ORDER BY job_id`)
      .all(id, ...SETTLED_JOB_STATUSES);
    const otherLiveWorkflows = ledger.db.prepare("SELECT workflow_id,title,phase FROM workflows WHERE workflow_id<>? AND phase NOT IN ('finished','archived') ORDER BY workflow_id").all(id);
    let json = {};
    try { json = JSON.parse(goal.json || '{}'); } catch { /* invalid JSON yields an empty previous chain */ }
    return { workflow, goal, json, liveKernel, openOperationJobs, otherLiveWorkflows, file };
  } finally { ledger.close(); }
}

const revisionBase = (() => {
  if (!reviseWorkflowId) return null;
  try { return readRevisionBase(reviseWorkflowId); }
  catch (error) { console.error(error.message); process.exit(2); }
})();

function revisionDiff(base, proposedChain) {
  const before = chainOps(base.json?.opChain);
  const after = chainOps(proposedChain);
  const sharedBefore = before.filter(op => after.includes(op));
  const sharedAfter = after.filter(op => before.includes(op));
  return {
    before,
    after,
    added: after.filter(op => !before.includes(op)),
    removed: before.filter(op => !after.includes(op)),
    reordered: JSON.stringify(sharedBefore) !== JSON.stringify(sharedAfter),
    markdownChanged: base.goal.markdown !== text,
    changed: JSON.stringify(before) !== JSON.stringify(after) || base.goal.markdown !== text,
  };
}

function revisionPreview(base) {
  const nextRevision = base.goal.revision + 1;
  const diff = revisionDiff(base, chain);
  const approvalPayload = {
    workflowId: reviseWorkflowId,
    baseRevision: base.goal.revision,
    nextRevision,
    goalIdentity: base.goal.goal_identity,
    contentDigest,
    opChain: diff.after,
    reason: revisionReason,
    routingBias,
  };
  const approvalToken = `rev-${sha256(JSON.stringify(approvalPayload))}`;
  const selectorArgs = projectName ? ['--project', projectName] : ['--repo', repo];
  const approvalArgs = [
    fileURLToPath(import.meta.url), ...selectorArgs, '--revise', reviseWorkflowId,
    '--text', text, '--reason', revisionReason, '--approve-revision', approvalToken, '--json',
  ];
  if (title) approvalArgs.push('--title', title);
  if (routingBias !== null) approvalArgs.push('--routing-bias', JSON.stringify(routingBias));
  return {
    schema: 'starci/goal-revision-preview@1',
    workflowId: reviseWorkflowId,
    baseRevision: base.goal.revision,
    nextRevision,
    goalIdentity: base.goal.goal_identity,
    preservesGoalIdentity: true,
    proposedContentDigest: contentDigest,
    reason: revisionReason,
    scope: {
      kind: chain?.scopeKind ?? null,
      sameLedgerIsNotConflict: true,
      otherLiveWorkflows: base.otherLiveWorkflows.map(w => ({ ...w, conflictInferred: false })),
      note: 'Shared ledger custody is not path-overlap evidence; concrete owned paths and live effects decide conflicts.',
    },
    opChainDiff: diff,
    planDivergence: diff.changed ? {
      action: 'approve-goal-revision',
      added: diff.added,
      removed: diff.removed,
      reordered: diff.reordered,
    } : null,
    kernel: {
      live: base.liveKernel,
      resumeAllowed: false,
      resumeCondition: `goals revision ${nextRevision} and its owner-approval receipt must be committed atomically`,
    },
    openOperationJobs: base.openOperationJobs,
    checkpoint: {
      queuedSupersedable: base.openOperationJobs.filter(job => job.status === 'queued').map(job => job.job_id),
      mustSettleFirst: base.openOperationJobs.filter(job => job.status !== 'queued').map(job => ({ jobId: job.job_id, status: job.status })),
      rule: 'owner-approved revision atomically cancels only queued no-effect jobs; leased/running/effect_unknown jobs must settle or reconcile first',
    },
    approval: {
      required: true,
      ownerReply: 'ok',
      token: approvalToken,
      command: { executable: process.execPath, args: approvalArgs },
    },
  };
}

const preview = revisionBase ? revisionPreview(revisionBase) : null;
const willWrite = revisionBase
  ? [`goals row (revision ${preview.nextRevision}, same workflow + identity)`, 'queued no-effect operation jobs superseded atomically', 'inbox row (kind=goal-revision, status=pending)', 'goal-revised event']
  : ['workflows row (phase=queued)', 'goals row (revision 0)', 'inbox row (kind=goal, status=pending)', 'goal-defined event'];

// --plan: show exactly what would be persisted — a STATE scan of every repo in
// scope, the goal, the op chain with cold leg estimates, the will-write list
// and the ledger path — and write nothing. The skill presents this to the
// owner; only an explicit ok|OK|oK re-runs without it.
if (planOnly) {
  const assess = assessRepos(scanRepos);
  const legs = (chain?.legs ?? []).map(l => {
    const tier = tierOf(legLabel(l));
    return { seq: l.seq, op: legLabel(l), tier, estimateMinutes: COLD_MINUTES[tier], ...(l.params ? { params: l.params } : {}) };
  });
  const totalMinutes = legs.length ? legs.reduce((n, l) => n + l.estimateMinutes, 0) : null;
  const outOfBandAssumed = [...new Set([...(chain?.assumed ?? []), ...(chain?.legs ?? []).flatMap(l => l.assumed ?? [])].filter(a => /satisfied out-of-band, no chain leg$/.test(a)))];
  const out = {
    plan: true,
    mode: revisionBase ? 'revise' : 'define',
    workflowId: revisionBase ? reviseWorkflowId : undefined,
    title: title || text.slice(0, 80),
    prompt: text,
    goalIdentity: revisionBase ? revisionBase.goal.goal_identity : goalIdentity,
    project: project ? { name: project.project, ownerRole: project.ownerRole, ownerRepo: project.ownerRepo, repos: project.repos, binding: project.file } : undefined,
    opChain: chain?.legs?.map(l => l.op) ?? null,
    underivable: underivable ?? undefined,
    legs,
    assumed: outOfBandAssumed.length ? outOfBandAssumed : undefined,
    estimate: { basis: 'cold', minutesPerTier: COLD_MINUTES, totalMinutes },
    assess: assess.available ? assess.data : null,
    assessNote: assess.available ? undefined : assess.note,
    willWrite,
    config: ownerConfigSummary(),
    kernelRoute: 'precedence: --agent flag > config.yaml kernel pin or group > route-model',
    ledger: ledgerFileFor(repo),
    revisionPreview: preview ?? undefined,
  };
  if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
  const lines = [`PLAN — ${revisionBase ? `revise ${reviseWorkflowId} to rev ${preview.nextRevision}` : `goal "${out.title}"`}`, `  identity: ${out.goalIdentity}${revisionBase ? ' (preserved)' : ''}`];
  lines.push(project
    ? `  scope: project '${project.project}' — owner role '${project.ownerRole}' → ${project.ownerRepo}`
    : `  scope: repo ${repo}`);
  lines.push('STATE (cold scan):');
  for (const r of scanRepos) {
    const name = r.role ? `${r.role}  ${r.path}` : `repo  ${r.path}`;
    lines.push(`  ${name}  — ${assess.available ? assessLineFor(assess.data, r.path) : 'assess unavailable'}`);
  }
  lines.push('GOAL:', `  ${text}`);
  lines.push(`OP CHAIN (estimate is cold: easy=${COLD_MINUTES.easy}m medium=${COLD_MINUTES.medium}m hard=${COLD_MINUTES.hard}m):`);
  if (legs.length) {
    for (const l of legs) lines.push(`  ${l.seq}. ${l.op}  ~${l.estimateMinutes}m ${l.tier}${l.params ? `  params ${Object.entries(l.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}` : ''}`);
    lines.push(`  total ~${totalMinutes}m — estimate is cold`);
    for (const a of outOfBandAssumed) lines.push(`  assumed: ${a}`);
  } else {
    lines.push('  underivable (kernel will derive at boot)');
    lines.push(`  reason: ${underivable.status} — ${underivable.reason}`);
  }
  const cfg = out.config;
  lines.push(cfg.file
    ? `CONFIG: ${cfg.file} — ${cfg.kernel?.group
      ? `kernel group ${cfg.kernel.group.map(m => `${m.agent}/${m.model ?? '(pool model)'}`).join(' → ')}`
      : `kernel pin agent=${cfg.kernel?.agent ?? '(none)'} model=${cfg.kernel?.model ?? '(none)'}`} effort=${cfg.kernel?.effort ?? '(default)'}`
      + (cfg.budgets && Object.values(cfg.budgets).some(v => v != null) ? ` budgets=${JSON.stringify(cfg.budgets)}` : '')
      + (cfg.error ? ` (${cfg.error})` : '')
    : 'CONFIG: no config.yaml — kernel route falls to --agent flag or route-model');
  lines.push('WILL WRITE:', ...willWrite.map(w => `  - ${w}`));
  if (revisionBase) {
    lines.push(`REVISION DIFF: remove [${preview.opChainDiff.removed.join(', ') || '-'}] add [${preview.opChainDiff.added.join(', ') || '-'}] reordered=${preview.opChainDiff.reordered}`);
    lines.push(`APPROVAL REQUIRED: exact owner reply ok; token ${preview.approval.token}`);
    lines.push(`KERNEL: ${preview.kernel.live ? 'live' : 'not live'}; resume is forbidden until the approved rev ${preview.nextRevision} transaction lands`);
  }
  lines.push(`ledger: ${out.ledger}`, 're-run without --plan to persist');
  console.log(lines.join('\n'));
  process.exit(0);
}

if (revisionBase) {
  if (!approveRevision) {
    console.error('revision approval required: run --plan, present revisionPreview, then pass --approve-revision <token> only after the owner\'s exact ok');
    process.exit(2);
  }
  if (revisionBase.json?.revision?.approvalToken === approveRevision) {
    const out = {
      workflowId: reviseWorkflowId,
      goalRevision: revisionBase.goal.revision,
      goalIdentity: revisionBase.goal.goal_identity,
      opChain: chainOps(revisionBase.json?.opChain),
      revised: true,
      alreadyApplied: true,
      queued: false,
      kernel: { live: revisionBase.liveKernel, resumeAllowed: true, action: 'resurvey pending goal-revision inbox; do not spawn a second kernel' },
      ledger: revisionBase.file,
    };
    console.log(asJson ? JSON.stringify(out, null, 2) : `revision ${revisionBase.goal.revision} was already applied to ${reviseWorkflowId}`);
    process.exit(0);
  }
  if (approveRevision !== preview.approval.token) {
    console.error(`revision approval token mismatch for ${reviseWorkflowId}; regenerate --plan and obtain owner approval for the current preview`);
    process.exit(2);
  }
  if (!chain || !Array.isArray(chain.legs) || chain.status !== 'ok') {
    console.error(`cannot revise ${reviseWorkflowId}: proposed op chain is not executable (${chain?.status ?? 'underivable'})`);
    process.exit(2);
  }
  const unsafePreviewJobs = revisionBase.openOperationJobs.filter(job => job.status !== 'queued');
  if (unsafePreviewJobs.length) {
    console.error(`cannot revise ${reviseWorkflowId}: ${unsafePreviewJobs.length} operation job(s) have possible effects (${unsafePreviewJobs.map(job => `${job.job_id}:${job.status}`).join(', ')}); settle or reconcile them before revision checkpoint`);
    process.exit(2);
  }

  const ledger = openLedger({ file: revisionBase.file });
  let alreadyApplied = false;
  let supersededJobs = [];
  try {
    ledger.transaction(() => {
      const current = ledger.db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(reviseWorkflowId);
      let currentJson = {};
      try { currentJson = JSON.parse(current?.json || '{}'); } catch { /* handled by revision check */ }
      if (current?.revision === preview.nextRevision && currentJson?.revision?.approvalToken === approveRevision) {
        alreadyApplied = true;
        return;
      }
      if (!current || current.revision !== preview.baseRevision || current.goal_identity !== preview.goalIdentity) {
        throw new Error(`stale revision preview for ${reviseWorkflowId}: expected rev ${preview.baseRevision} and identity ${preview.goalIdentity}`);
      }
      const workflow = ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(reviseWorkflowId);
      if (!workflow || workflow.phase === 'finished' || workflow.archived_at !== null) throw new Error(`workflow ${reviseWorkflowId} is no longer revisable`);
      if (workflow.goal_identity && workflow.goal_identity !== preview.goalIdentity) throw new Error(`workflow ${reviseWorkflowId} identity changed after preview`);
      const settledMarks = SETTLED_JOB_STATUSES.map(() => '?').join(',');
      const openNow = ledger.db.prepare(`SELECT job_id,op_id,status FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN (${settledMarks}) ORDER BY job_id`)
        .all(reviseWorkflowId, ...SETTLED_JOB_STATUSES);
      const unsafeNow = openNow.filter(job => job.status !== 'queued');
      if (unsafeNow.length) {
        throw new Error(`cannot checkpoint revision ${preview.nextRevision}: operation effects are still possible (${unsafeNow.map(job => `${job.job_id}:${job.status}`).join(', ')})`);
      }
      const leasedQueued = ledger.db.prepare(`SELECT l.job_id,l.resource_key FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE j.workflow_id=? AND j.kind<>'kernel' AND j.status='queued' ORDER BY l.job_id,l.resource_key`).all(reviseWorkflowId);
      if (leasedQueued.length) {
        throw new Error(`cannot checkpoint revision ${preview.nextRevision}: queued job lease drift (${leasedQueued.map(row => `${row.job_id}:${row.resource_key}`).join(', ')})`);
      }
      const amendment = {
        schema: 'starci/goal-revision-approval@1',
        source: 'owner-approved-goal-entry',
        baseRevision: preview.baseRevision,
        nextRevision: preview.nextRevision,
        baseGoalIdentity: preview.goalIdentity,
        approvalToken: approveRevision,
        reason: revisionReason,
        changed: preview.opChainDiff,
        ownerApproval: {
          quote: 'ok',
          threadId: null,
          messageId: null,
          messageIdAvailability: 'unavailable-to-cli',
          assurance: 'conversation-context-not-authenticated',
        },
        approvedAt: now,
      };
      const nextJson = {
        ...revisionBase.json,
        derivedFrom: 'owner-approved-revision',
        opChain: chain,
        derivedPlan: null,
        routing_bias: routingBias ?? revisionBase.json?.routing_bias ?? null,
        revision: amendment,
      };
      supersededJobs = openNow.map(job => job.job_id);
      for (const job of openNow) {
        const result = {
          reason: 'goal-revision-superseded', effectState: 'none',
          baseRevision: preview.baseRevision, nextRevision: preview.nextRevision,
          approvalToken: approveRevision, at: now,
        };
        ledger.db.prepare("UPDATE jobs SET status='cancelled',result_json=?,lease_token=NULL,worker_id=NULL,deadline=NULL,updated_at=? WHERE job_id=? AND status='queued'")
          .run(JSON.stringify(result), now, job.job_id);
        ledger.appendEvent({
          workflowId: reviseWorkflowId, entityType: 'job', entityId: job.job_id,
          generation: workflow.generation ?? 0, kind: 'job-superseded-by-goal-revision',
          payload: { opId: job.op_id, ...result }, createdAt: now,
        });
      }
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,amendment_json,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(reviseWorkflowId, preview.nextRevision, preview.goalIdentity, text, JSON.stringify(nextJson), JSON.stringify(amendment), now);
      ledger.db.prepare('UPDATE workflows SET goal_identity=COALESCE(goal_identity,?),updated_at=? WHERE workflow_id=?')
        .run(preview.goalIdentity, now, reviseWorkflowId);
      ledger.db.prepare('INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)')
        .run(reviseWorkflowId, 'goal-revision', `${reviseWorkflowId}:${preview.nextRevision}`, JSON.stringify({
          revision: preview.nextRevision,
          baseRevision: preview.baseRevision,
          goalIdentity: preview.goalIdentity,
          approvalToken: approveRevision,
          reason: revisionReason,
          opChain: preview.opChainDiff.after,
          supersededJobs,
          at: now,
        }), 'pending', now);
      ledger.appendEvent({
        workflowId: reviseWorkflowId,
        entityType: 'goal',
        entityId: reviseWorkflowId,
        generation: workflow.generation ?? 0,
        kind: 'goal-revised',
        payload: {
          revision: preview.nextRevision,
          previousRevision: preview.baseRevision,
          goalIdentity: preview.goalIdentity,
          approvalToken: approveRevision,
          opChainDiff: preview.opChainDiff,
          supersededJobs,
          kernelResume: 'resurvey-pending-revision-inbox',
        },
        createdAt: now,
      });
    });
    const out = {
      workflowId: reviseWorkflowId,
      goalRevision: preview.nextRevision,
      goalIdentity: preview.goalIdentity,
      opChain: preview.opChainDiff.after,
      revised: true,
      alreadyApplied,
      supersededJobs,
      queued: false,
      kernel: { live: revisionBase.liveKernel, resumeAllowed: true, action: 'resurvey pending goal-revision inbox; do not spawn a second kernel' },
      ledger: revisionBase.file,
    };
    console.log(asJson ? JSON.stringify(out, null, 2) : `revised ${reviseWorkflowId} to goal rev ${preview.nextRevision}; ${revisionBase.liveKernel ? 'live kernel may now resurvey' : 'revision awaits the existing workflow kernel'}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  } finally { ledger.close(); }
  process.exit(process.exitCode ?? 0);
}

const ledger = openLedger({ file: ledgerFileFor(repo) });
try {
  ledger.transaction(() => {
    ledger.ensureWorkflow({ workflowId, title: title || text.slice(0, 80), ledgerMode: 'durable', sourceRoots: [repo] });
    ledger.db.prepare('UPDATE workflows SET phase=?,goal_identity=? WHERE workflow_id=?').run('queued', goalIdentity, workflowId);
    ledger.db.prepare(
      'INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)'
    ).run(workflowId, 0, goalIdentity, text, JSON.stringify({ derivedFrom: 'owner-prompt', opChain: chain, ...(underivable ? { underivable } : {}), routing_bias: routingBias }), now);
    ledger.db.prepare(
      "INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)"
    ).run(workflowId, 'goal', workflowId, JSON.stringify({ prompt: text, title: title || null, routing_bias: routingBias, at: now }), 'pending', now);
    ledger.appendEvent({ workflowId, entityType: 'goal', entityId: workflowId, kind: 'goal-defined', payload: { revision: 0, goalIdentity, legs: chain?.legs?.length ?? null } });
  });
  const out = { workflowId, goalRevision: 0, goalIdentity, opChain: chain?.legs?.map(l => l.op) ?? null, queued: true, ledger: ledgerFileFor(repo) };
  console.log(asJson ? JSON.stringify(out, null, 2) : `queued ${workflowId} (goal rev 0, ${goalIdentity}${chain ? `, ${chain.legs.length} legs` : ', chain: underivable'})`);
} finally { ledger.close(); }
