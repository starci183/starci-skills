#!/usr/bin/env node
// define-goal.mjs — executable half of modules/goal/define-goal.yaml.
// One owner prompt -> one workflows row + one goals row (rev 0, carrying the
// derived op chain) + one pending inbox row in <repo>/.starciwork/runtime.sqlite.
// The queue is the contract: kernels claim from inbox, never from chat.
//
//   node scripts/goal/define-goal.mjs --repo <path> --text "<owner prompt>" [--title <t>] [--json] [--plan]
//   node scripts/goal/define-goal.mjs --project <name> --text "<owner prompt>" [--title <t>] [--json] [--plan]
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
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Source = the repository containing this .claude; the project registry lives
// beside it at .workspaces/projects/<name>/work.json.
const sourceRoot = path.dirname(skillRoot);
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const projectName = arg('project');
const repoArg = arg('repo');
const text = arg('text');
const title = arg('title');
const routingBias = (() => { try { return JSON.parse(arg('routing-bias', 'null')); } catch { return null; } })();
const asJson = process.argv.includes('--json');
const planOnly = process.argv.includes('--plan');
const usage = 'usage: define-goal.mjs (--repo <path> | --project <name>) --text "<owner prompt>" [--title] [--json] [--plan]';
if (projectName && repoArg) { console.error(`--project and --repo are mutually exclusive\n${usage}`); process.exit(2); }
if (!text) { console.error(usage); process.exit(2); }

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
  return { project: typeof binding?.project === 'string' && binding.project.trim() ? binding.project.trim() : name, file, ownerRole, ownerRepo: owner.path, repos };
}

const project = projectName ? resolveProject(projectName) : null;
// `repo` is the ledger owner in both modes: the resolved owner repository for
// --project, the named/current repository for --repo.
const repo = project ? project.ownerRepo : path.resolve(repoArg ?? process.cwd());
const scanRepos = project ? project.repos : [{ role: null, path: repo }];

// Derive the ideal op chain through the same planner the kernel uses —
// advisory only; the kernel re-derives at boot and diffs, never trusts blindly.
function deriveOpChain(prompt) {
  const r = spawnSync(process.execPath,
    [path.join(skillRoot, 'scripts', 'route', 'route-plan.mjs'), '--text', prompt, '--json'],
    { encoding: 'utf8', timeout: 60000, cwd: skillRoot });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
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
// estimate is a class guess, and the table says so ('estimate is cold').
const COLD_MINUTES = { easy: 15, medium: 45, hard: 90 };
const COLD_TIER = [
  [/^(provision\.ask|request\.analyze|scope\.define|scope\.finish|decision\.prepare|goal\.revise|workspace\.manage)$/, 'easy'],
  [/\.(implement|refactor)$|^(integration|e2e|uat)\.verify$|^(release\.deliver|runtime\.operate)$/, 'hard'],
];
const tierOf = op => COLD_TIER.find(([re]) => re.test(op))?.[1] ?? 'medium';

// Per-repo signals line for the STATE section. assess.mjs's output shape is
// its own contract, so the lookup is tolerant: a repos/repositories list keyed
// by repo|path|root|name, an object keyed by the repo path, or a raw dump.
const assessLineFor = (data, repoPath) => {
  const entries = Array.isArray(data?.repos) ? data.repos
    : Array.isArray(data?.repositories) ? data.repositories : null;
  const hit = entries?.find(e => [e.repo, e.path, e.root, e.name].includes(repoPath))
    ?? (data?.repos?.[repoPath] ?? data?.repositories?.[repoPath] ?? null);
  if (hit) {
    const signals = hit.signals ?? hit.summary ?? hit.state ?? hit;
    return typeof signals === 'string' ? signals : JSON.stringify(signals);
  }
  return JSON.stringify(data).slice(0, 160);
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
      },
      budgets: c?.budgets ?? null,
    };
  } catch (e) { return { file: path.relative(skillRoot, file), error: `config.yaml unparsable: ${e.message}` }; }
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'goal';
const workflowId = `wf-${slug(title || text)}-${Date.now().toString(36)}`;
const goalIdentity = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const chain = deriveOpChain(text);
const now = Date.now();
const willWrite = ['workflows row (phase=queued)', 'goals row (revision 0)', 'inbox row (kind=goal, status=pending)', 'goal-defined event'];
const legLabel = l => `${l.op}${l.instance ? '#' + l.instance : ''}`;

// --plan: show exactly what would be persisted — a STATE scan of every repo in
// scope, the goal, the op chain with cold leg estimates, the will-write list
// and the ledger path — and write nothing. The skill presents this to the
// owner; only an explicit ok|OK|oK re-runs without it.
if (planOnly) {
  const assess = assessRepos(scanRepos);
  const legs = (chain?.legs ?? []).map(l => {
    const tier = tierOf(l.op);
    return { seq: l.seq, op: legLabel(l), tier, estimateMinutes: COLD_MINUTES[tier] };
  });
  const totalMinutes = legs.length ? legs.reduce((n, l) => n + l.estimateMinutes, 0) : null;
  const out = {
    plan: true,
    title: title || text.slice(0, 80),
    prompt: text,
    goalIdentity,
    project: project ? { name: project.project, ownerRole: project.ownerRole, ownerRepo: project.ownerRepo, repos: project.repos, binding: project.file } : undefined,
    opChain: chain?.legs?.map(l => l.op) ?? null,
    legs,
    estimate: { basis: 'cold', minutesPerTier: COLD_MINUTES, totalMinutes },
    assess: assess.available ? assess.data : null,
    assessNote: assess.available ? undefined : assess.note,
    willWrite,
    config: ownerConfigSummary(),
    kernelRoute: 'precedence: --agent flag > config.yaml kernel pin > route-model',
    ledger: ledgerFileFor(repo),
  };
  if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
  const lines = [`PLAN — goal "${out.title}"`, `  identity: ${goalIdentity}`];
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
    for (const l of legs) lines.push(`  ${l.seq}. ${l.op}  ~${l.estimateMinutes}m ${l.tier}`);
    lines.push(`  total ~${totalMinutes}m — estimate is cold`);
  } else {
    lines.push('  underivable (kernel will derive at boot)');
  }
  const cfg = out.config;
  lines.push(cfg.file
    ? `CONFIG: ${cfg.file} — kernel pin agent=${cfg.kernel?.agent ?? '(none)'} model=${cfg.kernel?.model ?? '(none)'} effort=${cfg.kernel?.effort ?? '(default)'}`
      + (cfg.budgets && Object.values(cfg.budgets).some(v => v != null) ? ` budgets=${JSON.stringify(cfg.budgets)}` : '')
      + (cfg.error ? ` (${cfg.error})` : '')
    : 'CONFIG: no config.yaml — kernel route falls to --agent flag or route-model');
  lines.push('WILL WRITE:', ...willWrite.map(w => `  - ${w}`));
  lines.push(`ledger: ${out.ledger}`, 're-run without --plan to persist');
  console.log(lines.join('\n'));
  process.exit(0);
}

const ledger = openLedger({ file: ledgerFileFor(repo) });
try {
  ledger.transaction(() => {
    ledger.ensureWorkflow({ workflowId, title: title || text.slice(0, 80), ledgerMode: 'durable', sourceRoots: [repo] });
    ledger.db.prepare('UPDATE workflows SET phase=? WHERE workflow_id=?').run('queued', workflowId);
    ledger.db.prepare(
      'INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)'
    ).run(workflowId, 0, goalIdentity, text, JSON.stringify({ derivedFrom: 'owner-prompt', opChain: chain, routing_bias: routingBias }), now);
    ledger.db.prepare(
      "INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)"
    ).run(workflowId, 'goal', workflowId, JSON.stringify({ prompt: text, title: title || null, routing_bias: routingBias, at: now }), 'pending', now);
    ledger.appendEvent({ workflowId, entityType: 'goal', entityId: workflowId, kind: 'goal-defined', payload: { revision: 0, goalIdentity, legs: chain?.legs?.length ?? null } });
  });
  const out = { workflowId, goalRevision: 0, goalIdentity, opChain: chain?.legs?.map(l => l.op) ?? null, queued: true, ledger: ledgerFileFor(repo) };
  console.log(asJson ? JSON.stringify(out, null, 2) : `queued ${workflowId} (goal rev 0, ${goalIdentity}${chain ? `, ${chain.legs.length} legs` : ', chain: underivable'})`);
} finally { ledger.close(); }
