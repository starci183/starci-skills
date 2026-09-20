#!/usr/bin/env node
// api.mjs — the kernel agent's ONLY gate to the ledger. One thin command per
// state operation; the long-lived [Kernel] never opens .starciwork/runtime.sqlite
// itself and never spawns op terminals by hand — `dispatch` owns that.
//
//   node scripts/kernel/api.mjs <cmd> --repo <path> [...] [--json]
//
//   survey   --repo <path> --workflow <id>
//   status   --repo <path> --workflow <id>
//   plan     --repo <path> --workflow <id> --file <plan.json>
//   enqueue  --repo <path> --workflow <id> --op <opId> --paths <csv> [--title <t>] [--risk <r>]
//   route    --repo <path> --job <job_id> [--prefer <pool>] [--avoid <pool>] [--difficulty <d>]
//   dispatch --repo <path> --job <job_id> [--model <target>] [--worktree <sel>] [--spawn] [--lease-ttl <ms>]
//   settle   --repo <path> --job <job_id> --verdict <pass|fail|blocked> --report <path>
//   report   --repo <path> --job <job_id> --outcome <done|partial|failed|ask|blocked> --report <file>
//   op-contract --repo <path> --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
//   check    --repo <path> --job <job_id> (--checks '<json>' | --checks-file <path>)
//   consume-report --repo <path> --job <job_id>
//   incident --repo <path> --workflow <id> --kind <k> --detail <s> [--op <opId>]
//   retire   --repo <path> --workflow <id>
//
// Every read prints a JSON-safe result; every write runs inside one
// ledger.transaction. --json gives the machine form; without it each command
// prints a compact human line. Bad arguments exit 2 with usage.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openLedger, ledgerFileFor, machineFileFor, openMachine,
  newToken, SETTLED_JOB_STATUSES, reserveTwoPhase,
} from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { spawnAgent, buildSpawnCommand } from '../agent/lib.mjs';
import { terminalClose } from '../api/orca/terminal-close.mjs';
// Pool selection + launch-model resolution (pinned lane: scripts/agent/models.mjs)
// and the Orca orchestration wrappers the managed-agent dispatch path drives —
// one thin wrapper per calls.yaml verb (run-create/task-create/worker-start/
// dispatch/dispatch-show/worker-show/worker-stop/worker-release).
import { selectPool, resolveLaunchModel } from '../agent/models.mjs';
import { accountList } from '../api/orca/account-list.mjs';
import { runCreate } from '../api/orca/run-create.mjs';
import { taskCreate } from '../api/orca/task-create.mjs';
import { workerStart } from '../api/orca/worker-start.mjs';
import { orchDispatch } from '../api/orca/orch-dispatch.mjs';
import { dispatchShow } from '../api/orca/dispatch-show.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { workerRelease } from '../api/orca/worker-release.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml';

// The kernel-agent status vocabulary. enqueue writes 'queued' — the durable
// engine's own word (ledger.enqueueJob); 'pending' was the spec's alias and is
// still accepted as dispatchable for jobs written before the op-IPC wiring
// (reserveOpLeases bridges it forward at admission, since reserveTwoPhase only
// takes 'queued'). settle writes the engine's settled vocabulary:
// 'succeeded'|'failed' — so liveRow/retireWorkflow see settled jobs correctly.
const SETTLED = [...new Set([...SETTLED_JOB_STATUSES, 'effect_unknown'])];
const DISPATCHABLE = ['pending', 'queued', 'leased', 'running', 'answering'];
// The reports.outcome vocabulary — the worker-facing half of the op IPC.
const REPORT_OUTCOMES = ['done', 'partial', 'failed', 'ask', 'blocked'];

const usage = (code) => {
  console.error(`use: node scripts/kernel/api.mjs <cmd> --repo <path> [...] [--json]
  survey   --workflow <id>
  status   --workflow <id>
  plan     --workflow <id> --file <plan.json>
  enqueue  --workflow <id> --op <opId> --paths <csv> [--title <t>] [--risk <r>]
  route    --job <job_id> [--prefer <pool>] [--avoid <pool>] [--difficulty <d>]
  dispatch --job <job_id> [--model <target>] [--worktree <sel>] [--spawn]
  settle   --job <job_id> --verdict <pass|fail|blocked> --report <path>
  report   --job <job_id> --outcome <done|partial|failed|ask|blocked> --report <file>
  op-contract --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
  check    --job <job_id> (--checks '<json>' | --checks-file <path>)
  consume-report --job <job_id>
  incident --workflow <id> --kind <k> --detail <s> [--op <opId>]
  retire   --workflow <id>`);
  process.exit(code);
};

const parseJson = (text, fallback = null) => { try { return JSON.parse(text); } catch { return fallback; } };
const parseArgs = (argv) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { a._.push(k); continue; }
    const name = k.slice(2);
    if (['json', 'spawn'].includes(name)) { a[name] = true; continue; }
    const v = argv[++i];
    if (v === undefined) usage(2);
    a[name] = v;
  }
  return a;
};
const need = (cond, msg) => { if (!cond) { console.error(`api: ${msg}`); usage(2); } };

const openRepoLedger = (repo) => {
  const file = ledgerFileFor(repo); // throws ledger-root-is-runtime on a runtime root — deliberate
  if (!fs.existsSync(file)) throw Object.assign(new Error(`ledger-missing: ${file} — no .starciwork/runtime.sqlite at that repo`), { code: 'ledger-missing' });
  return openLedger({ file });
};

const emit = (out, human, asJson) => {
  if (asJson) console.log(JSON.stringify(out, null, 2));
  else console.log(human);
};

const getWorkflow = (db, workflowId) => db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
const latestGoal = (db, workflowId) => db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
const goalJsonOf = (row) => parseJson(row?.json ?? '', {});
const jobPayloadOf = (row) => parseJson(row?.payload_json ?? '', {});

/* ---------------------------------------------------------------- survey */
function cmdSurvey(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const g = latestGoal(db, workflowId), gj = goalJsonOf(g);
  const openJobs = db.prepare(
    `SELECT * FROM jobs WHERE workflow_id=? AND status NOT IN (${SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`
  ).all(workflowId, ...SETTLED)
    .map((r) => ({ job_id: r.job_id, op_id: r.op_id, kind: r.kind, status: r.status, attempt: r.attempt, generation: r.generation, worker_id: r.worker_id, payload: jobPayloadOf(r), created_at: r.created_at, updated_at: r.updated_at }));
  const inbox = db.prepare('SELECT * FROM inbox WHERE workflow_id=? ORDER BY inbox_id').all(workflowId)
    .map((r) => ({ ...r, payload: parseJson(r.payload_json), disposition: parseJson(r.disposition_json) }));
  const signals = db.prepare(
    'SELECT scope,key,holder_pid,token,value_json,at,expires_at FROM signals WHERE (scope=? OR key=?) AND (expires_at IS NULL OR expires_at>?) ORDER BY scope,key'
  ).all(workflowId, workflowId, now).map((r) => ({ ...r, value: parseJson(r.value_json) }));
  const events = db.prepare('SELECT seq,event_id,generation,entity_type,entity_id,kind,payload_json,created_at FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 10')
    .all(workflowId).reverse().map((r) => ({ ...r, payload: parseJson(r.payload_json) }));
  const incidents = db.prepare("SELECT * FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId);
  const out = {
    ok: true, workflowId,
    workflow: wf,
    goal: g ? {
      revision: g.revision, identity: g.goal_identity, markdown: g.markdown,
      opChain: gj.opChain ?? null, derivedPlan: gj.derivedPlan ?? null, json: gj,
    } : null,
    jobs: openJobs,
    inbox, signals, events,
    incidentsOpen: incidents,
    eventsHead: ledger.eventsHead(workflowId),
  };
  emit(out, [
    `workflow ${workflowId} — phase=${wf.phase ?? '-'} title=${wf.title ?? '-'}`,
    `goal rev ${g?.revision ?? '-'} (${g?.goal_identity ?? '-'}) chain: ${(gj.opChain?.legs ?? []).map((l) => l.op).join(' → ') || '(none stored)'}`,
    `open jobs: ${openJobs.length} (${openJobs.map((j) => `${j.job_id}:${j.status}`).join(', ') || 'none'})`,
    `inbox: ${inbox.length} rows (${inbox.filter((i) => i.status === 'pending').length} pending) | live signals: ${signals.length} | open incidents: ${incidents.length}`,
    `last events: ${events.map((e) => `${e.seq}:${e.kind}`).join(', ') || 'none'}`,
  ].join('\n'), args.json);
}

/* ---------------------------------------------------------------- status */
function cmdStatus(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const byStatus = {};
  for (const r of db.prepare('SELECT status,count(*) n FROM jobs WHERE workflow_id=? GROUP BY status ORDER BY status').all(workflowId)) byStatus[r.status] = r.n;
  const leases = db.prepare('SELECT resource_key,job_id,expires_at FROM leases WHERE workflow_id=? AND expires_at>? ORDER BY resource_key').all(workflowId, now);
  const inboxPending = db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(workflowId).n;
  const out = { ok: true, workflowId, phase: wf.phase ?? null, jobs: byStatus, activeLeases: leases, inboxPending };
  emit(out,
    `${workflowId} phase=${out.phase ?? '-'} jobs{${Object.entries(byStatus).map(([s, n]) => `${s}:${n}`).join(',') || '-'}} leases=${leases.length} inbox-pending=${inboxPending}`,
    args.json);
}

/* ------------------------------------------------------------------ plan */
function cmdPlan(ledger, args) {
  const db = ledger.db, workflowId = args.workflow;
  const file = path.resolve(args.file);
  if (!fs.existsSync(file)) throw Object.assign(new Error(`plan file missing: ${file}`), { code: 'plan-file-missing' });
  const plan = parseJson(fs.readFileSync(file, 'utf8'));
  if (!plan || !Array.isArray(plan.legs) || plan.legs.some((l) => !l || typeof l.op !== 'string' || !l.op)) {
    throw Object.assign(new Error(`invalid plan file ${file} — expected {legs:[{op,paths?,notes?}]}`), { code: 'plan-file-invalid' });
  }
  const legs = plan.legs.map((l) => ({ op: l.op, ...(l.paths ? { paths: l.paths } : {}), ...(l.notes ? { notes: l.notes } : {}) }));
  const planOps = legs.map((l) => l.op);

  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const g = latestGoal(db, workflowId);
  const storedLegs = goalJsonOf(g)?.opChain?.legs ?? null;
  const storedOps = storedLegs ? storedLegs.map((l) => l?.op ?? l).filter(Boolean) : null;
  // Structural diff only: which stored legs the plan dropped, which plan ops
  // were never in the approved chain, whether shared ops changed order.
  const divergence = {
    storedOps: storedOps ?? null,
    planOps,
    missing: storedOps ? storedOps.filter((o) => !planOps.includes(o)) : [],
    extra: storedOps ? planOps.filter((o) => !storedOps.includes(o)) : [...planOps],
    reordered: storedOps
      ? JSON.stringify(storedOps.filter((o) => planOps.includes(o))) !== JSON.stringify(planOps.filter((o) => storedOps.includes(o)))
      : false,
    noStoredChain: storedOps === null,
  };
  divergence.diverged = divergence.missing.length > 0 || divergence.extra.length > 0 || divergence.reordered;

  ledger.transaction(() => {
    if (g) {
      const gj = goalJsonOf(g);
      gj.derivedPlan = { legs, divergence, derivedAt: Date.now() };
      db.prepare('UPDATE goals SET json=? WHERE goal_seq=?').run(JSON.stringify(gj), g.goal_seq);
    }
    ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'plan-derived', payload: { legs, divergence, file },
    });
  });

  const out = { ok: true, workflowId, divergence, legs };
  emit(out,
    `plan-derived for ${workflowId}: ${legs.length} legs — diverged=${divergence.diverged}` +
    (divergence.missing.length ? ` missing=[${divergence.missing.join(',')}]` : '') +
    (divergence.extra.length ? ` extra=[${divergence.extra.join(',')}]` : '') +
    (divergence.reordered ? ' reordered' : '') +
    (divergence.noStoredChain ? ' (no stored opChain to diff)' : ''),
    args.json);
}

/* --------------------------------------------------------------- enqueue */
function cmdEnqueue(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const ownedPaths = [...new Set(String(args.paths).split(',').map((s) => s.trim()).filter(Boolean))];
  const jobId = `op-${args.op}-${newToken().slice(0, 10)}`;
  const payload = { opId: args.op, owned_paths: ownedPaths, title: args.title ?? args.op, risk: args.risk ?? null };

  let job;
  ledger.transaction(() => {
    const attempt = db.prepare('SELECT COALESCE(MAX(attempt),0)+1 a FROM jobs WHERE workflow_id=? AND op_id=?').get(workflowId, args.op).a;
    db.prepare(
      "INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at) VALUES(?,?,?,?,?, 'op','op',?, 'queued',?,?)"
    ).run(jobId, workflowId, args.op, attempt, wf.generation ?? 0, JSON.stringify(payload), now, now);
    ledger.appendEvent({
      workflowId, entityType: 'job', entityId: jobId,
      kind: 'job-enqueued', payload: { opId: args.op, attempt, ownedPaths: ownedPaths.length, risk: payload.risk },
    });
    job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  });

  const out = { ok: true, job_id: jobId, workflowId, op: args.op, status: job.status, attempt: job.attempt };
  emit(out, `enqueued ${jobId} (op ${args.op}, attempt ${job.attempt}, status ${job.status})`, args.json);
}

/* ----------------------------------------------------------------- route */
// scripts/api/quota is a pinned sibling lane: the module is imported lazily
// and every probe degrades to {state:'unknown'} when it is absent or throws —
// routing still decides on the capacity rows it can prove (running counts,
// maxParallel, open incidents).
const quotaModule = import('../api/quota/index.mjs').catch(() => null);
const probeQuotaSafe = async (provider) => {
  try {
    const mod = await quotaModule;
    if (typeof mod?.probeQuota !== 'function') {
      return { state: 'unknown', usedPercent: null, detail: 'quota module unavailable' };
    }
    const probe = await mod.probeQuota(provider);
    return probe && typeof probe === 'object' ? probe : { state: 'unknown', usedPercent: null, detail: 'quota probe returned no result' };
  } catch (e) {
    return { state: 'unknown', usedPercent: null, detail: String(e?.message ?? e) };
  }
};

const csvList = (v) => (v == null ? [] : (Array.isArray(v) ? v : String(v).split(','))
  .map((s) => String(s).trim()).filter(Boolean));

// `api route` — resolve the pool/model for one job and persist the decision on
// its payload so `dispatch --spawn` launches exactly what was routed. Bias:
// routing_bias {prefer[], avoid[]} on the workflow goal's json, with --prefer/
// --avoid flags taking precedence (flag entries lead the merged list).
// Difficulty: --difficulty > job payload.difficulty > 'medium'.
async function cmdRoute(ledger, args) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  const payload = jobPayloadOf(job);
  const kind = job.op_id ?? payload.opId;
  if (!kind) throw Object.assign(new Error(`job ${jobId} carries no op identity`), { code: 'job-no-op' });

  const gj = goalJsonOf(latestGoal(db, job.workflow_id));
  const goalBias = gj.routing_bias ?? gj.routingBias ?? {};
  const bias = {
    prefer: [...new Set([...csvList(args.prefer), ...csvList(goalBias.prefer)])],
    avoid: [...new Set([...csvList(args.avoid), ...csvList(goalBias.avoid)])],
  };
  const difficulty = args.difficulty ?? payload.difficulty ?? 'medium';

  // Capacity per runtimes.yaml pool: live running count, declared maxParallel,
  // the provider quota probe (auth 'dead' when the probe reports dead) and any
  // open incident that mentions the provider.
  const rtFile = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  const rtDoc = fs.existsSync(rtFile) ? parseYaml(fs.readFileSync(rtFile, 'utf8')) : null;
  const pools = rtDoc?.runtimes ?? {};
  const runningByModel = {};
  for (const r of db.prepare("SELECT payload_json FROM jobs WHERE status='running'").all()) {
    const p = parseJson(r.payload_json, {});
    if (p?.model) runningByModel[p.model] = (runningByModel[p.model] ?? 0) + 1;
  }
  const openIncidents = db.prepare("SELECT last_progress FROM incidents WHERE status='open'").all();
  let accounts = null;
  try { accounts = await accountList() ?? null; } catch { accounts = null; }
  const capacity = {};
  for (const [poolId, rt] of Object.entries(pools)) {
    const target = rt?.target ?? poolId;
    const provider = rt?.provider ?? null;
    const quota = provider
      ? await probeQuotaSafe(provider)
      : { state: 'unknown', usedPercent: null, detail: 'pool declares no provider' };
    capacity[target] = {
      running: runningByModel[target] ?? 0,
      maxParallel: rt?.maxParallel ?? null,
      quota,
      auth: quota?.state === 'dead' ? 'dead' : 'ok',
      openIncident: provider ? openIncidents.some((i) => String(i.last_progress ?? '').includes(provider)) : false,
    };
  }

  const decision = selectPool({ kind, difficulty, bias, capacity });
  if (!decision || decision.error) {
    const out = { ok: false, jobId, kind, difficulty, bias, error: decision?.error ?? 'selectPool returned no decision' };
    emit(out, `route REFUSED for ${jobId} (${kind}, ${difficulty}): ${out.error}`, args.json);
    process.exit(1);
  }

  const decided = {
    model: decision.target, modelId: decision.modelId ?? null, effort: decision.effort ?? null,
    routeChain: decision.chain ?? [], routeRejected: decision.rejected ?? [],
  };
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?')
      .run(JSON.stringify({ ...payload, ...decided, difficulty }), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'route-decided', payload: { kind, difficulty, bias, ...decided },
    });
  });

  const out = { ok: true, jobId, kind, difficulty, bias, decision: decided, rejected: decided.routeRejected, ...(accounts ? { accounts } : {}) };
  emit(out, [
    `route ${jobId} (${kind}, ${difficulty}) → ${decided.model} model=${decided.modelId ?? '-'} effort=${decided.effort ?? '-'}`,
    `  chain: ${decided.routeChain.join(' → ') || '(none)'}`,
    ...(decided.routeRejected.length
      ? ['  rejected:', ...decided.routeRejected.map((r) => `    ${r.target}: ${r.reason}`)]
      : []),
  ].join('\n'), args.json);
}

/* -------------------------------------------------------------- dispatch */
const resolveModel = (target) => {
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${target}.yaml`);
  if (!fs.existsSync(file)) return { error: `no model profile ${target} at ${path.relative(skillRoot, file)}` };
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const orca = doc?.launch?.orca ?? {};
  return { target, provider: doc?.provider ?? null, kind: orca.kind ?? 'unknown', command: orca.command ?? null, profile: path.relative(skillRoot, file) };
};

// dispatch-op.mjs's packet builder is not exported (it runs main() on import),
// so the packet shape is replicated here: same fields, same returns contract.
const buildPacket = ({ job, payload, model }) => ({
  op: job.op_id ?? payload.opId,
  brief: `modules/ops/ops/${job.op_id ?? payload.opId}.yaml`,
  context: {
    records: payload.records ?? [],
    owned_paths: (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? { path: p } : p)),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.risk ? { risk: payload.risk } : {}),
  },
  constraints: { model: model.target, provider: model.provider, budget: payload.budget ?? null, lease: job.lease_token ?? null },
  returns: { verdict: 'pass|fail|blocked', evidence: ['...paths'], suspicion: 'string?' },
});

const buildPrompt = (packet, jobId, repo) => [
  `[Op] ${packet.op} — one operation, one verdict. You are an ephemeral op agent spawned by the workflow kernel (job ${jobId}).`,
  `MANDATORY LOAD ORDER — read before any action:`,
  `  1. SKILL.md (repo root) — the runtime's load order`,
  `  2. ${packet.brief} — your contract. It declares your reads, writes, steps, proofs and blockers.`,
  `  3. ${VERDICT_CONTRACT} — what your return must look like`,
  `brief: ${packet.brief}  (your contract — never renegotiate it)`,
  `records: ${packet.context.records.join(', ') || '(none bound)'}`,
  `owned_paths: ${[...new Set(packet.context.owned_paths.map((p) => p.path))].join(', ') || '(per brief write-ceiling)'}`,
  `   only owned_paths may be modified; anything else is out of scope.`,
  `constraints: lease=${packet.constraints.lease ?? '(none)'} model=${packet.constraints.model} budget=${packet.constraints.budget ?? '(unset)'}`,
  `persistence: state lives in .starciwork/runtime.sqlite and files on disk — never in your memory. Markers and reports are the truth.`,
  `reporting: when you finish you MUST file your report into the ledger — write report.json on disk (the artifact) AND record the durable signal:`,
  `  node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} report --repo ${repo} --job ${jobId} --outcome <done|partial|failed|ask|blocked> --report <path-to-report.json>`,
  `  read your contract the same way: node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} op-contract --repo ${repo} --job ${jobId}`,
  `returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string} — contract: ${VERDICT_CONTRACT}`,
  `Return verdict + evidence paths. Cite suspicion instead of fixing out of scope — a wrong spec is a blocker, not a guess.`,
].join('\n');

// dispatch-rejected — the shared refusal for every launch kind: the job must
// NEVER stand 'running' on a launch that failed. Job → failed with a typed
// result, lease rows released, one event — and when `incident` is set (the
// post-launch attestation failures) a typed infra-provider incident so survey
// sees it without parsing events. `terminal` is the launch's handle: a
// terminal handle for command-terminal jobs, a Dispatch id for managed ones.
const rejectDispatch = (ledger, job, jobId, op, model, { step, signal = null, error = null, terminal = null, incident = false }) => {
  ledger.transaction(() => {
    const now = Date.now();
    const leasesReleased = ledger.db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
    ledger.db.prepare("UPDATE jobs SET status='failed', result_json=?, worker_id=NULL, lease_token=NULL, deadline=NULL, updated_at=? WHERE job_id=?")
      .run(JSON.stringify({ reason: 'dispatch-rejected', step, signal, detail: error, provider: model.provider, at: now }), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'dispatch-rejected',
      payload: { op, step, signal, error, provider: model.provider, model: model.target, terminal, leasesReleased },
    });
    if (incident) {
      ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,0,0,0,0,?,'open',?)")
        .run(`inc-${newToken().slice(0, 12)}`, job.workflow_id, op,
          `[infra-provider] ${JSON.stringify({ provider: model.provider, signal: signal ?? error ?? null, jobId })}`, now);
    }
  });
};

/* ------------------------------------------------------ op IPC helpers */
// §6 admission for an op dispatch. The durable fence is taken BEFORE anything
// launches, on both launch kinds: one `path:<normalized owned_path>` resource
// per payload.owned_paths entry (capacity 1 = exclusive write ownership —
// seeded OR IGNORE so an operator-declared capacity is never overwritten),
// then reserveTwoPhase flips the job queued → leased with its fencing token
// and registers the ledger on the machine arbiter. The arbiter is REQUIRED by
// reserveTwoPhase's signature even for repo-only leases (it registers the
// ledger and would hold any machineNeeds) — the same openMachine handle
// settle already uses. An open failure returns !ok: a dispatch that cannot
// fence must not launch.
const DISPATCH_LEASE_TTL_MS = 30 * 60 * 1000; // bounds a crashed worker's fence; settle releases early
const normalizeOwnedPath = (p) => String(p).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
const opLeaseRequests = (payload) => [...new Set((payload.owned_paths ?? [])
  .map((p) => (typeof p === 'string' ? p : p?.path))
  .filter(Boolean)
  .map((p) => `path:${normalizeOwnedPath(p)}`))]
  .map((resourceKey) => ({ resourceKey, units: 1 }));

const reserveOpLeases = (ledger, job, payload, { ttlMs = DISPATCH_LEASE_TTL_MS } = {}) => {
  const db = ledger.db, leases = opLeaseRequests(payload);
  // Declare the path resources, then bridge jobs enqueued before 'queued'
  // became the written status — reserveTwoPhase only admits 'queued'.
  ledger.transaction(() => {
    db.prepare("UPDATE jobs SET status='queued', updated_at=? WHERE job_id=? AND status='pending'").run(Date.now(), job.job_id);
    for (const l of leases) db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,1)').run(l.resourceKey);
  });
  let machine;
  try { machine = openMachine({ file: machineFileFor() }); }
  catch (e) { return { ok: false, reasons: [`machine arbiter unavailable: ${String(e?.message ?? e)}`], machineUnavailable: true }; }
  try {
    return reserveTwoPhase(ledger, machine, {
      job: {
        jobId: job.job_id, workflowId: job.workflow_id, opId: job.op_id,
        attempt: job.attempt, generation: job.generation, kind: job.kind, role: job.role ?? null,
      },
      leases, ttlMs,
    });
  } finally { machine.close(); }
};

// The canonical workflows.phase write (mirrors start-workflow.mjs): guarded
// on phase='queued' so a finished/archived workflow is never regressed, and
// the phase-transition event is appended only when the row actually moved.
const transitionQueuedToRunning = (ledger, workflowId, now) => {
  const moved = ledger.db.prepare("UPDATE workflows SET phase='running',updated_at=? WHERE workflow_id=? AND phase='queued'").run(now, workflowId);
  if (moved.changes > 0) {
    ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'phase-transition', payload: { from: 'queued', to: 'running' }, createdAt: now });
  }
};

// The kernel → worker half of the op IPC: one contracts row per
// (workflow_id,op_id,attempt) carrying what the worker was actually asked to
// do — the rendered prompt plus the structured packet. Written before the job
// is marked running; dispatch_id is the worker's handle (terminal handle for
// command-terminal launches, Dispatch id for managed ones).
const buildContractMarkdown = ({ op, jobId, prompt, packet }) =>
  `# dispatch contract — [Op] ${op} (job ${jobId})\n\n${prompt}\n\n## packet\n\n\`\`\`json\n${JSON.stringify(packet, null, 2)}\n\`\`\`\n`;
const fileContract = (db, { job, op, dispatchId, markdown, context, now }) =>
  db.prepare('INSERT OR REPLACE INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(job.workflow_id, op, job.attempt, dispatchId, markdown, JSON.stringify(context ?? null), now);

function cmdDispatch(ledger, args, repo) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  const payload = jobPayloadOf(job);
  const op = job.op_id ?? payload.opId;
  if (!op) throw Object.assign(new Error(`job ${jobId} carries no op identity`), { code: 'job-no-op' });

  const model = resolveModel(args.model ?? payload.model ?? 'qwen-agent'); // orchestrationDefault: qwen-agent
  if (model.error) throw Object.assign(new Error(model.error), { code: 'model-unknown' });
  const briefAbs = path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`);
  const briefExists = fs.existsSync(briefAbs);

  const packet = buildPacket({ job: { ...job, op_id: op }, payload, model });
  const prompt = buildPrompt(packet, jobId, repo);
  const worktree = args.worktree ?? repo;
  const title = `[Op] ${op}`;
  // The composed command is what a spawn would actually run — card env prefix
  // + credential strip + requirements (the --yolo/dangerous flags). Dry-run
  // prints it so reviewers see the injected flags, not just the profile body.
  const spawnCmd = model.kind === 'command-terminal'
    ? buildSpawnCommand({ provider: model.provider, command: model.command })
    : null;
  const composedCommand = spawnCmd?.command ?? model.command;
  const orcaCommands = model.kind === 'command-terminal'
    ? [
      { step: 'create', argv: ['terminal', 'create', '--worktree', worktree, '--title', title, '--command', composedCommand ?? '<command>', '--json'] },
      { step: 'read', argv: ['terminal', 'read', '--terminal', '<handle>', '--screen', '--json'], note: 'readiness — verify the prompt landed before sending' },
      { step: 'send', argv: ['terminal', 'send', '--terminal', '<handle>', '--text', '<prompt>', '--enter', '--json'] },
    ]
    : [{ step: 'worker-start', argv: ['orchestration', 'worker-start', '--task', '<task-id>', '--worktree', worktree, '--agent', model.provider ?? '<agent>', '--json'], note: `${model.target} is a managed agent (launch.orca.kind=${model.kind}) — needs an orchestration Task id, not terminal create` }];

  if (!args.spawn) {
    const out = {
      ok: true, spawned: false, jobId, packet, prompt,
      leases: opLeaseRequests(payload),
      spawnCommand: spawnCmd
        ? { command: spawnCmd.command ?? null, commandSource: spawnCmd.commandSource ?? null, ...(spawnCmd.error ? { error: spawnCmd.error } : {}) }
        : { command: null, error: `${model.target} is launch kind '${model.kind}' — composed by 'orca orchestration worker-start', not terminal create` },
      orca: { worktree, title, launchKind: model.kind, profile: model.profile, commands: orcaCommands.map((c) => ({ step: c.step, cli: `orca ${c.argv.join(' ')}`, note: c.note })) },
      ...(briefExists ? {} : { briefMissing: `modules/ops/ops/${op}.yaml not present — spawn will refuse` }),
    };
    emit(out, [
      `PACKET job=${jobId} op=${op} model=${model.target} (${model.kind})`,
      `  brief: ${packet.brief}${briefExists ? '' : ' — MISSING ON DISK'}`,
      `  owned_paths: ${packet.context.owned_paths.map((p) => p.path).join(', ') || '(none)'}`,
      `  spawn command: ${out.spawnCommand.command ?? `(none — ${out.spawnCommand.error})`}`,
      ...(out.spawnCommand.commandSource ? [`  command source: ${out.spawnCommand.commandSource}`] : []),
      '  orca commands:', ...out.orca.commands.map((c) => `    $ ${c.cli}`),
      '  (dry run — pass --spawn to launch)',
    ].join('\n'), args.json);
    return;
  }

  if (!briefExists) throw Object.assign(new Error(`spawn refused — no brief at modules/ops/ops/${op}.yaml`), { code: 'brief-missing' });
  // §6 admission — the repo-path leases and the job's fencing token are taken
  // BEFORE anything launches, for both launch kinds. A refusal (a live lease
  // already owns a path, or the machine arbiter can't open) is a dispatch
  // rejection: the worker must never be what discovers the write set was
  // already taken, and an unfenced dispatch is exactly what this layer kills.
  const leaseTtlMs = Number(args['lease-ttl'] ?? payload.leaseTtlMs ?? 0) || DISPATCH_LEASE_TTL_MS;
  let reserve;
  try {
    reserve = reserveOpLeases(ledger, job, payload, { ttlMs: leaseTtlMs });
  } catch (e) {
    // Identity/status refusal (job already leased/running, or row drift): the
    // job is left untouched — an operator error, not a dispatch rejection.
    const error = String(e?.message ?? e);
    emit({ ok: false, jobId, refused: 'reserve-failed', error }, `dispatch REFUSED for ${jobId}: ${error}`, args.json);
    process.exit(1);
  }
  if (!reserve.ok) {
    const reason = (reserve.reasons ?? [reserve.reason]).filter(Boolean).join('; ') || 'reservation refused';
    rejectDispatch(ledger, job, jobId, op, model, { step: 'reserve', error: reason });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, reserve },
      `dispatch REJECTED for ${jobId} (reserve): ${reason} — job status=failed`, args.json);
    process.exit(1);
  }
  // Managed-agent launch (managed-agent / native-managed-agent): the run →
  // task → worker-start → return-preamble → attest pipeline owns this profile.
  if (MANAGED_KINDS.includes(model.kind)) {
    return cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, worktree, title, reserve });
  }
  if (model.kind !== 'command-terminal') {
    throw Object.assign(new Error(`spawn refused: ${model.target} is launch kind '${model.kind}' — use 'orca orchestration worker-start' with a Task id (managed-agent path)`), { code: 'managed-agent' });
  }
  // spawnAgent assembles the command: the profile's launch.orca.command carries
  // model+tuning flags; the provider adapter card injects its credential/env
  // prefix (devin ACP strip, qwen key unset) and requirements automatically.
  // The pipeline runs create → readiness → deliver → submission → attestation;
  // an attestation rejection means the terminal died after consuming the
  // prompt (observed: qwen 401 Invalid API-key) — spawnAgent already closed it.
  const spawned = spawnAgent({
    provider: model.provider, worktree, title, prompt,
    command: model.command, dispatchId: jobId,
  });
  const handle = spawned.terminal ?? null;
  const spawn = { step: spawned.step, error: spawned.error, signal: spawned.signal ?? null, command: spawned.command, handle };
  spawn.ok = spawned.ok === true;
  if (!spawn.ok) {
    // dispatch-rejected: the job must NEVER sit 'running' on a dead spawn.
    // Job → failed with a typed result, lease rows released, one event — and
    // for attestation rejections a typed infra-provider incident so survey
    // sees it without parsing events. Terminal is already closed by spawnAgent.
    const reason = spawned.signal ?? spawned.error ?? `spawn failed at ${spawned.step}`;
    rejectDispatch(ledger, job, jobId, op, model, {
      step: spawned.step, signal: spawned.signal ?? null, error: spawned.error ?? null,
      terminal: handle, incident: spawned.step === 'attestation',
    });
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, spawn: { ...spawn, reason } };
    emit(out, `dispatch REJECTED for ${jobId} (${spawned.step}): ${reason} — job status=failed, terminal closed`, args.json);
    process.exit(1);
  }

  if (spawn.ok) {
    const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
    ledger.transaction(() => {
      const now = Date.now();
      // The durable kernel→worker contract lands BEFORE the running mark —
      // the row is the dispatch authority, the terminal text is not.
      fileContract(db, {
        job, op, dispatchId: handle, markdown: contractMarkdown, now,
        context: { packet, worktree, model: model.target, lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing } },
      });
      db.prepare("UPDATE jobs SET status='running', worker_id=?, updated_at=? WHERE job_id=?").run(handle, now, jobId);
      transitionQueuedToRunning(ledger, job.workflow_id, now);
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: 'op-dispatched',
        payload: { op, terminal: handle, model: model.target, worktree, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
      });
    });
  }
  const out = { ok: spawn.ok, jobId, spawned: spawn.ok, handle, packet, spawn };
  emit(out, spawn.ok
    ? `dispatched ${jobId} — [Op] ${op} on ${handle} (${model.target}); job status=running`
    : `spawn FAILED for ${jobId}: ${spawned.error ?? 'unknown'}`, args.json);
  if (!spawn.ok) process.exit(1);
}

// launch.orca.kind values that take the managed pipeline — profiles write
// 'managed-agent', agent cards write 'native-managed-agent'; both mean
// orchestration worker-start, never terminal create.
const MANAGED_KINDS = ['native-managed-agent', 'managed-agent'];

// Managed-agent dispatch: run → task → worker-start → return-preamble →
// worker-show attestation. Any step's failure takes the same dispatch-rejected
// path as a dead terminal spawn (job failed + event + infra-provider incident
// on attestation failures) — after stopping and releasing whatever partial
// Dispatch the attempt created, per calls.yaml settle-dispatch.
function cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, worktree, title, reserve }) {
  const db = ledger.db;

  const cleanupWorker = (dispatchId) => {
    if (!dispatchId) return null;
    let stop = null, release = null;
    try { stop = workerStop({ dispatch: dispatchId }); } catch (e) { stop = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
    try { release = workerRelease({ dispatch: dispatchId }); } catch (e) { release = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
    return { stop, release };
  };

  const reject = ({ step, signal = null, error = null, dispatchId = null, incident = false }) => {
    const cleanup = cleanupWorker(dispatchId);
    rejectDispatch(ledger, job, jobId, op, model, { step, signal, error, terminal: dispatchId, incident });
    const reason = signal ?? error ?? `managed dispatch failed at ${step}`;
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, managed: { step, dispatchId, ...(cleanup ? { cleanup } : {}) } };
    emit(out, `dispatch REJECTED for ${jobId} (${step}): ${reason} — job status=failed${cleanup ? `, worker ${dispatchId} cleanup stop=${cleanup.stop?.ok} release=${cleanup.release?.ok}` : ''}`, args.json);
    process.exit(1);
  };

  // 1. Launch model: the `api route` decision on the job payload wins; without
  // it resolveLaunchModel picks the pool's pin for the job's difficulty.
  let modelId = payload.modelId ?? null;
  let effort = payload.effort ?? null;
  if (!modelId) {
    const resolved = resolveLaunchModel(model.target, payload.difficulty ?? 'medium');
    if (!resolved || resolved.error || !resolved.modelId) {
      return reject({ step: 'route', error: resolved?.error ?? 'resolveLaunchModel returned no modelId' });
    }
    modelId = resolved.modelId;
    effort = resolved.effort ?? null;
  }

  // 2. Run id — the workflow's Orca run lives on the kernel job's payload
  // (kind='kernel', same workflow). The first managed dispatch creates it and
  // persists it back there (onto this job's payload when no kernel job exists).
  const kernelJob = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY updated_at DESC LIMIT 1").get(job.workflow_id);
  const kernelPayload = jobPayloadOf(kernelJob);
  let runId = kernelPayload?.orca?.runId ?? payload?.orca?.runId ?? null;
  if (!runId) {
    const wf = getWorkflow(db, job.workflow_id);
    const created = runCreate({ objective: wf?.title ?? job.workflow_id, from: kernelJob?.worker_id ?? null });
    if (!created?.ok || !created.runId) {
      return reject({ step: 'run-create', error: created?.error ?? 'run-create returned no runId' });
    }
    runId = created.runId;
    ledger.transaction(() => {
      const now = Date.now();
      if (kernelJob) {
        kernelPayload.orca = { ...(kernelPayload.orca ?? {}), runId };
        db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify(kernelPayload), now, kernelJob.job_id);
      } else {
        payload.orca = { ...(payload.orca ?? {}), runId };
        db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify(payload), now, jobId);
      }
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: 'run-created', payload: { runId, storedOn: kernelJob ? kernelJob.job_id : jobId },
      });
    });
  }

  // 3. Task — the operation's contract. The spec is the rendered packet prompt
  // (the same text a command-terminal launch would have sent).
  const task = taskCreate({ run: runId, spec: prompt, taskTitle: op, displayName: title, from: kernelJob?.worker_id ?? null });
  if (!task?.ok || !task.taskId) {
    return reject({ step: 'task-create', error: task?.error ?? 'task-create returned no taskId' });
  }
  const taskId = task.taskId;

  // 4. worker-start — outcome ok means a ready worker (calls.yaml classify:
  // exit 0 + result.state 'ready'). Anything else, including a receipt with no
  // dispatchId, is a rejection; a partial effect is stopped + released.
  const started = workerStart({ task: taskId, worktree, agent: model.provider, model: modelId, effort, run: runId });
  const dispatchId = started?.dispatchId ?? null;
  if (started?.ok !== true || (started.outcome != null && started.outcome !== 'ok') || !dispatchId) {
    return reject({
      step: 'worker-start', dispatchId,
      error: started?.error ?? `worker-start outcome=${started?.outcome ?? 'none'} state=${started?.state ?? 'none'} effect=${started?.effectState ?? 'none'}`,
    });
  }

  // 5. Deliver the packet — return-preamble dispatch to the assignee the
  // worker-start bound (dispatch-show is the read of record for the handle).
  const shown = dispatchShow({ task: taskId });
  if (!shown?.ok || !shown.assigneeHandle) {
    return reject({ step: 'dispatch-show', error: shown?.error ?? 'dispatch-show returned no assignee', dispatchId });
  }
  const delivered = orchDispatch({ task: taskId, to: shown.assigneeHandle, run: runId });
  if (!delivered?.ok) {
    return reject({ step: 'dispatch', error: delivered?.error ?? 'orchestration dispatch failed', dispatchId });
  }

  // 6. Attest — the worker's EFFECTIVE agent/model must equal what routing
  // decided. A mismatch is a provider-side defect: rejected with the typed
  // infra-provider incident (same as a terminal attestation rejection).
  const attest = workerShow({ dispatch: dispatchId });
  const eff = attest?.effective ?? {};
  const effAgent = eff.agent ?? eff.provider ?? null;
  const effModel = eff.model ?? eff.modelId ?? null;
  if (attest?.ok !== true || effAgent !== model.provider || effModel !== modelId) {
    return reject({
      step: 'attestation', dispatchId, incident: true,
      signal: `worker attest failed: expected agent=${model.provider} model=${modelId}, got agent=${effAgent} model=${effModel} state=${attest?.state ?? 'none'}`,
    });
  }

  // 7. Running — worker_id is the Dispatch id (managed workers have no
  // command-terminal handle); payload.managed carries the Orca ids settle needs.
  payload.managed = { runId, taskId, dispatchId };
  payload.model = model.target;
  payload.modelId = modelId;
  payload.effort = effort;
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  ledger.transaction(() => {
    const now = Date.now();
    // Same contract-first order as the terminal path: the contracts row is
    // the dispatch authority; dispatch_id is the worker's Dispatch id.
    fileContract(db, {
      job, op, dispatchId, markdown: contractMarkdown, now,
      context: { packet, worktree, model: model.target, managed: { runId, taskId, dispatchId }, lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing } },
    });
    db.prepare("UPDATE jobs SET status='running', worker_id=?, payload_json=?, updated_at=? WHERE job_id=?")
      .run(dispatchId, JSON.stringify(payload), now, jobId);
    transitionQueuedToRunning(ledger, job.workflow_id, now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-dispatched',
      payload: { op, dispatch: dispatchId, model: model.target, worktree, managed: true, taskId, modelId, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
    });
  });
  const out = {
    ok: true, jobId, spawned: true, dispatchId, packet,
    managed: { runId, taskId, dispatchId, modelId, effort, assignee: shown.assigneeHandle, preamble: delivered.preamble ?? null },
  };
  emit(out, `dispatched ${jobId} — [Op] ${op} managed worker ${dispatchId} (${model.target}/${modelId}, task ${taskId}); job status=running`, args.json);
}

/* ---------------------------------------------------------------- settle */
function cmdSettle(ledger, args, repo) {
  const db = ledger.db, jobId = args.job, verdict = args.verdict;
  const reportAbs = [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p));
  if (!reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });

  let machineRefs = [], released = 0, job, reportsConsumed = false;
  ledger.transaction(() => {
    job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
    if (SETTLED.includes(job.status) && job.status !== 'effect_unknown') {
      throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
    }
    const payload = jobPayloadOf(job);
    payload.verdict = verdict;
    payload.report = reportAbs;
    payload.settledAt = Date.now();
    const status = verdict === 'pass' ? 'succeeded' : 'failed';
    const result = { verdict, report: reportAbs, at: payload.settledAt };
    machineRefs = db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(jobId).map((r) => r.machine_ref);
    released = db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
    db.prepare('UPDATE jobs SET status=?, payload_json=?, result_json=?, lease_token=NULL, deadline=NULL, updated_at=? WHERE job_id=?')
      .run(status, JSON.stringify(payload), JSON.stringify(result), payload.settledAt, jobId);
    // Integrating the verdict consumes the job's reports row — the durable
    // worker→kernel signal is spent exactly once (dispatch_id is the worker's
    // handle, falling back to the job id when none was ever bound).
    reportsConsumed = db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=? AND consumed_at IS NULL')
      .run(payload.settledAt, job.workflow_id, job.worker_id ?? jobId).changes > 0;
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-settled', payload: { verdict, status, report: reportAbs, leasesReleased: released, machineRefs, reportsConsumed },
    });
  });

  // Mirror of releaseTwoPhase's machine half: lease rows are gone; now release
  // the paired machine tokens. Best-effort — a missing machine db never fails
  // the settle (the ledger row is already the record).
  let machineReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger settle stands; machine TTLs expire on their own */ }
  }

  // The settled op's Orca terminal is released with its leases — worker_id is
  // the handle (observed defect: settled op terminals stayed alive). Runs
  // after the settled state is written; a close failure never un-settles.
  // Managed jobs hold a Dispatch id in worker_id, not a terminal handle — they
  // take the worker-stop/-release path below, never terminal close.
  const managed = jobPayloadOf(job)?.managed ?? null;
  let terminalClosed = null;
  if (job.worker_id && !managed) {
    const closed = terminalClose({ terminal: job.worker_id });
    terminalClosed = { handle: job.worker_id, ok: closed.ok === true, ...(closed.error ? { error: closed.error } : {}) };
  }

  // Managed settle — calls.yaml settle-dispatch: worker-stop then
  // worker-release the exact Dispatch. A stop that classifies unknown is
  // reconciled by a worker-show read and the residual state is recorded on
  // the settle result (worker-abandon stays out of scope here — it is only
  // legal once the attempt's own terminal is proven closed). A stop/release
  // failure never un-settles the job; the ledger row already stands.
  let managedWorker = null;
  if (managed?.dispatchId) {
    let stop = null, release = null, residual = null;
    try { stop = workerStop({ dispatch: managed.dispatchId }); }
    catch (e) { stop = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
    if (stop?.ok !== true || stop?.outcome === 'unknown') {
      try {
        const shown = workerShow({ dispatch: managed.dispatchId });
        residual = { ok: shown?.ok === true, state: shown?.state ?? null, effective: shown?.effective ?? null };
      } catch (e) { residual = { error: String(e?.message ?? e) }; }
    }
    try { release = workerRelease({ dispatch: managed.dispatchId }); }
    catch (e) { release = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
    managedWorker = {
      dispatchId: managed.dispatchId,
      stop: { ok: stop?.ok === true, outcome: stop?.outcome ?? null, state: stop?.state ?? null, ...(stop?.error ? { error: stop.error } : {}) },
      release: { ok: release?.ok === true, outcome: release?.outcome ?? null, state: release?.state ?? null, ...(release?.error ? { error: release.error } : {}) },
      ...(residual ? { residual } : {}),
    };
  }

  const status = verdict === 'pass' ? 'succeeded' : 'failed';
  const out = { ok: true, jobId, verdict, status, report: reportAbs, leasesReleased: released, machineRefsReleased: machineReleased, reportsConsumed, terminalClosed, ...(managedWorker ? { managedWorker } : {}) };
  emit(out, `settled ${jobId} verdict=${verdict} status=${status} (leases released: ${released}${reportsConsumed ? ', report consumed' : ''}${terminalClosed ? `, terminal ${terminalClosed.handle} closed=${terminalClosed.ok}` : ''}${managedWorker ? `, worker ${managedWorker.dispatchId} stop=${managedWorker.stop.ok} release=${managedWorker.release.ok}` : ''})`, args.json);
}

/* -------------------------------------------------------------- incident */
function cmdIncident(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const incidentId = `inc-${newToken().slice(0, 12)}`;
  ledger.transaction(() => {
    db.prepare(
      "INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,0,0,0,0,?,'open',?)"
    ).run(incidentId, workflowId, args.op ?? null, `[${args.kind}] ${args.detail}`, now);
    ledger.appendEvent({
      workflowId, entityType: 'incident', entityId: incidentId,
      kind: 'incident-raised', payload: { kind: args.kind, detail: args.detail, opId: args.op ?? null },
    });
  });
  const out = { ok: true, incidentId, workflowId, kind: args.kind, status: 'open' };
  emit(out, `incident ${incidentId} open on ${workflowId} — ${args.kind}: ${args.detail}`, args.json);
}

/* ---------------------------------------------------------------- retire */
function cmdRetire(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const already = wf.phase === 'finished';

  // Retire ≠ erase: goals/events/jobs history stays. Phase flag + inbox close
  // + one event are the whole mutation.
  let closed = 0;
  ledger.transaction(() => {
    db.prepare("UPDATE workflows SET phase='finished', finished_json=?, updated_at=? WHERE workflow_id=?")
      .run(JSON.stringify({ retiredAt: now, by: 'kernel-api' }), now, workflowId);
    closed = db.prepare("UPDATE inbox SET status='done', applied_at=? WHERE workflow_id=? AND status NOT IN ('done','applied')").run(now, workflowId).changes;
    ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'workflow-finished', payload: { inboxClosed: closed, alreadyFinished: already },
    });
  });
  const out = { ok: true, workflowId, phase: 'finished', inboxClosed: closed, alreadyFinished: already };
  emit(out, `workflow ${workflowId} finished${already ? ' (was already finished)' : ''} — inbox rows closed: ${closed}; history preserved`, args.json);
}

/* ------------------------------------------------------------- op IPC */
// The op-IPC durability verbs: contracts out (kernel→worker, written at
// dispatch), reports in (worker→kernel, filed by the worker), checks beside
// them. The files on disk stay the artifacts; the rows are the durable
// signal the kernel consumes.
const resolveJob = (db, jobId) => {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  return job;
};
const jobOpOf = (job) => job.op_id ?? jobPayloadOf(job).opId ?? null;
// reports.dispatch_id is the worker's handle — terminal handle or managed
// Dispatch id — falling back to the job id when the job was never bound.
const reportDispatchIdOf = (job) => job.worker_id ?? job.job_id;
const parseAttempt = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error(`--attempt must be a positive integer, got '${v}'`), { code: 'bad-attempt' });
  return n;
};

/* --------------------------------------------------------------- report */
// Worker-facing: the report.json file stays the artifact, this upsert is the
// durable signal (UNIQUE(workflow_id,dispatch_id) makes a re-file idempotent).
function cmdReport(ledger, args, repo) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const reportAbs = [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p));
  if (!reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });
  const body = fs.readFileSync(reportAbs, 'utf8');
  const parsed = parseJson(body);
  const reportJson = parsed === null ? body : JSON.stringify(parsed);
  const dispatchId = reportDispatchIdOf(job), op = jobOpOf(job);
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(job.workflow_id, dispatchId, op, job.attempt, job.generation, args.outcome, reportJson, job.worker_id ?? null, now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'report-filed', payload: { dispatchId, op, attempt: job.attempt, outcome: args.outcome, report: reportAbs },
    });
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, outcome: args.outcome, report: reportAbs };
  emit(out, `report filed for ${job.job_id} (dispatch ${dispatchId}, outcome ${args.outcome})`, args.json);
}

/* ---------------------------------------------------------- op-contract */
// The worker reads its own contract: print the markdown to stdout. --job
// resolves (workflow,op,attempt); --workflow + --op [--attempt] works too
// (latest attempt's contract when --attempt is omitted).
function cmdOpContract(ledger, args) {
  const db = ledger.db;
  let workflowId, op, attempt = parseAttempt(args.attempt);
  if (args.job) {
    const job = resolveJob(db, args.job);
    workflowId = job.workflow_id; op = args.op ?? jobOpOf(job);
    if (attempt == null) attempt = job.attempt;
  } else {
    workflowId = args.workflow; op = args.op;
    if (attempt == null) attempt = db.prepare('SELECT MAX(attempt) a FROM contracts WHERE workflow_id=? AND op_id=?').get(workflowId, op)?.a ?? null;
  }
  const row = attempt == null ? null
    : db.prepare('SELECT * FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(workflowId, op, attempt);
  if (!row) throw Object.assign(new Error(`no contract row for ${workflowId}/${op} attempt ${attempt ?? '(none filed)'}`), { code: 'contract-missing' });
  if (args.json) {
    emit({ ok: true, workflowId, op, attempt: row.attempt, dispatchId: row.dispatch_id, markdown: row.markdown, context: parseJson(row.context_json), createdAt: row.created_at }, '', true);
  } else {
    process.stdout.write(row.markdown.endsWith('\n') ? row.markdown : `${row.markdown}\n`);
  }
}

/* ---------------------------------------------------------------- check */
// The verification half: upsert the re-run check results for an op attempt
// (one row per workflow_id,op_id,attempt).
function cmdCheck(ledger, args, repo) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const op = args.op ?? jobOpOf(job);
  if (!op) throw Object.assign(new Error(`job ${job.job_id} carries no op identity — pass --op`), { code: 'job-no-op' });
  const attempt = parseAttempt(args.attempt) ?? job.attempt;
  const raw = args.checks ?? (() => {
    const file = [path.resolve(args['checks-file']), path.resolve(repo, args['checks-file'])].find((p) => fs.existsSync(p));
    if (!file) throw Object.assign(new Error(`checks file missing: ${args['checks-file']}`), { code: 'checks-file-missing' });
    return fs.readFileSync(file, 'utf8');
  })();
  const parsed = parseJson(raw);
  if (parsed === null) throw Object.assign(new Error('checks payload is not valid JSON'), { code: 'checks-invalid' });
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(job.workflow_id, op, attempt, JSON.stringify(parsed), now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'checks-recorded', payload: { op, attempt },
    });
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, op, attempt };
  emit(out, `checks recorded for ${job.job_id} (op ${op}, attempt ${attempt})`, args.json);
}

/* -------------------------------------------------------- consume-report */
// Kernel-facing: mark the job's reports row integrated so it is never read
// as a live answer again.
function cmdConsumeReport(ledger, args) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const dispatchId = reportDispatchIdOf(job);
  let consumed = false;
  ledger.transaction(() => {
    const now = Date.now();
    consumed = db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=? AND consumed_at IS NULL')
      .run(now, job.workflow_id, dispatchId).changes > 0;
    if (consumed) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
        kind: 'report-consumed', payload: { dispatchId },
      });
    }
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, consumed };
  emit(out, `consume-report ${job.job_id} (dispatch ${dispatchId}): ${consumed ? 'report consumed' : 'no unconsumed report row'}`, args.json);
}

/* ------------------------------------------------------------------ main */
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h') usage(cmd ? 0 : 2);
  const args = parseArgs(argv.slice(1));
  const repo = path.resolve(args.repo ?? process.cwd());

  const required = {
    survey: ['workflow'], status: ['workflow'], plan: ['workflow', 'file'],
    enqueue: ['workflow', 'op', 'paths'], route: ['job'], dispatch: ['job'],
    settle: ['job', 'verdict', 'report'],
    report: ['job', 'outcome', 'report'], 'op-contract': [], check: ['job'],
    'consume-report': ['job'],
    incident: ['workflow', 'kind', 'detail'],
    retire: ['workflow'],
  };
  if (!required[cmd]) usage(2);
  for (const k of required[cmd]) need(args[k], `${cmd} needs --${k}`);
  if (cmd === 'settle' && !['pass', 'fail', 'blocked'].includes(args.verdict)) need(false, `settle --verdict must be pass|fail|blocked, got '${args.verdict}'`);
  if (cmd === 'report') need(REPORT_OUTCOMES.includes(args.outcome), `report --outcome must be ${REPORT_OUTCOMES.join('|')}, got '${args.outcome}'`);
  if (cmd === 'op-contract') need(args.job || (args.workflow && args.op), 'op-contract needs --job <job_id> or --workflow <id> --op <opId> [--attempt <n>]');
  if (cmd === 'check') need(args.checks != null || args['checks-file'], 'check needs --checks <json> or --checks-file <path>');

  let ledger;
  try {
    ledger = openRepoLedger(repo);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
    process.exit(1);
  }
  try {
    switch (cmd) {
      case 'survey': return cmdSurvey(ledger, args);
      case 'status': return cmdStatus(ledger, args);
      case 'plan': return cmdPlan(ledger, args);
      case 'enqueue': return cmdEnqueue(ledger, args);
      case 'route': return await cmdRoute(ledger, args);
      case 'dispatch': return cmdDispatch(ledger, args, repo);
      case 'settle': return cmdSettle(ledger, args, repo);
      case 'report': return cmdReport(ledger, args, repo);
      case 'op-contract': return cmdOpContract(ledger, args);
      case 'check': return cmdCheck(ledger, args, repo);
      case 'consume-report': return cmdConsumeReport(ledger, args);
      case 'incident': return cmdIncident(ledger, args);
      case 'retire': return cmdRetire(ledger, args);
    }
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code }));
    process.exit(1);
  } finally {
    ledger.close();
  }
}

main();
