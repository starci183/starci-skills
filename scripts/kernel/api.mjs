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
//   dispatch --repo <path> --job <job_id> [--model <target>] [--worktree <sel>] [--spawn]
//   settle   --repo <path> --job <job_id> --verdict <pass|fail|blocked> --report <path>
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
  newToken, SETTLED_JOB_STATUSES,
} from '../../kernel/ledger-db.mjs';
import { parseYaml } from '../../core/yaml.mjs';
import { spawnAgent } from '../agent/lib.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml';

// The kernel-agent status vocabulary. enqueue writes 'pending' (the spec's word
// for awaiting dispatch; the durable engine's equivalent is 'queued' — both are
// accepted as dispatchable). settle writes the engine's own settled vocabulary:
// 'succeeded'|'failed' — so liveRow/retireWorkflow see settled jobs correctly.
const SETTLED = [...new Set([...SETTLED_JOB_STATUSES, 'effect_unknown'])];
const DISPATCHABLE = ['pending', 'queued', 'leased', 'running', 'answering'];

const usage = (code) => {
  console.error(`use: node scripts/kernel/api.mjs <cmd> --repo <path> [...] [--json]
  survey   --workflow <id>
  status   --workflow <id>
  plan     --workflow <id> --file <plan.json>
  enqueue  --workflow <id> --op <opId> --paths <csv> [--title <t>] [--risk <r>]
  dispatch --job <job_id> [--model <target>] [--worktree <sel>] [--spawn]
  settle   --job <job_id> --verdict <pass|fail|blocked> --report <path>
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
      "INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at) VALUES(?,?,?,?,?, 'op','op',?, 'pending',?,?)"
    ).run(jobId, workflowId, args.op, attempt, wf.generation ?? 0, JSON.stringify(payload), now, now);
    ledger.appendEvent({
      workflowId, entityType: 'job', entityId: jobId,
      kind: 'job-enqueued', payload: { opId: args.op, attempt, ownedPaths: ownedPaths.length, risk: payload.risk },
    });
    job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  });

  const out = { ok: true, job_id: jobId, workflowId, op: args.op, status: job.status, attempt: job.attempt };
  emit(out, `enqueued ${jobId} (op ${args.op}, attempt ${job.attempt}, status pending)`, args.json);
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

const buildPrompt = (packet, jobId) => [
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
  `returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string} — contract: ${VERDICT_CONTRACT}`,
  `Return verdict + evidence paths. Cite suspicion instead of fixing out of scope — a wrong spec is a blocker, not a guess.`,
].join('\n');

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
  const prompt = buildPrompt(packet, jobId);
  const worktree = args.worktree ?? repo;
  const title = `[Op] ${op}`;
  const orcaCommands = model.kind === 'command-terminal'
    ? [
      { step: 'create', argv: ['terminal', 'create', '--worktree', worktree, '--title', title, '--command', model.command, '--json'] },
      { step: 'read', argv: ['terminal', 'read', '--terminal', '<handle>', '--screen', '--json'], note: 'readiness — verify the prompt landed before sending' },
      { step: 'send', argv: ['terminal', 'send', '--terminal', '<handle>', '--text', '<prompt>', '--enter', '--json'] },
    ]
    : [{ step: 'worker-start', argv: ['orchestration', 'worker-start', '--task', '<task-id>', '--worktree', worktree, '--agent', model.provider ?? '<agent>', '--json'], note: `${model.target} is a managed agent (launch.orca.kind=${model.kind}) — needs an orchestration Task id, not terminal create` }];

  if (!args.spawn) {
    const out = {
      ok: true, spawned: false, jobId, packet, prompt,
      orca: { worktree, title, launchKind: model.kind, profile: model.profile, commands: orcaCommands.map((c) => ({ step: c.step, cli: `orca ${c.argv.join(' ')}`, note: c.note })) },
      ...(briefExists ? {} : { briefMissing: `modules/ops/ops/${op}.yaml not present — spawn will refuse` }),
    };
    emit(out, [
      `PACKET job=${jobId} op=${op} model=${model.target} (${model.kind})`,
      `  brief: ${packet.brief}${briefExists ? '' : ' — MISSING ON DISK'}`,
      `  owned_paths: ${packet.context.owned_paths.map((p) => p.path).join(', ') || '(none)'}`,
      '  orca commands:', ...out.orca.commands.map((c) => `    $ ${c.cli}`),
      '  (dry run — pass --spawn to launch)',
    ].join('\n'), args.json);
    return;
  }

  if (!briefExists) throw Object.assign(new Error(`spawn refused — no brief at modules/ops/ops/${op}.yaml`), { code: 'brief-missing' });
  if (model.kind !== 'command-terminal') {
    throw Object.assign(new Error(`spawn refused: ${model.target} is launch kind '${model.kind}' — use 'orca orchestration worker-start' with a Task id (managed-agent path)`), { code: 'managed-agent' });
  }
  // spawnAgent assembles the command: the profile's launch.orca.command carries
  // model+tuning flags; the provider adapter card injects its credential/env
  // prefix (devin ACP strip, qwen key unset) and requirements automatically.
  const spawned = spawnAgent({
    provider: model.provider, worktree, title, prompt,
    command: model.command, dispatchId: jobId,
  });
  const handle = spawned.terminal ?? null;
  const spawn = { step: spawned.step, error: spawned.error, command: spawned.command, handle };
  spawn.ok = spawned.ok === true;
  if (!spawn.ok) {
    const out = { ok: false, jobId, packet, spawn: { ...spawn, reason: spawned.error ?? `spawn failed at ${spawned.step}` } };
    emit(out, `spawn FAILED for ${jobId}: ${out.spawn.reason}`, args.json);
    process.exit(1);
  }

  if (spawn.ok) {
    ledger.transaction(() => {
      db.prepare("UPDATE jobs SET status='running', worker_id=?, updated_at=? WHERE job_id=?").run(handle, Date.now(), jobId);
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: 'op-dispatched', payload: { op, terminal: handle, model: model.target, worktree },
      });
    });
  }
  const out = { ok: spawn.ok, jobId, spawned: spawn.ok, handle, packet, spawn };
  emit(out, spawn.ok
    ? `dispatched ${jobId} — [Op] ${op} on ${handle} (${model.target}); job status=running`
    : `spawn FAILED for ${jobId}: ${spawned.error ?? 'unknown'}`, args.json);
  if (!spawn.ok) process.exit(1);
}

/* ---------------------------------------------------------------- settle */
function cmdSettle(ledger, args, repo) {
  const db = ledger.db, jobId = args.job, verdict = args.verdict;
  const reportAbs = [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p));
  if (!reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });

  let machineRefs = [], released = 0, job;
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
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-settled', payload: { verdict, status, report: reportAbs, leasesReleased: released, machineRefs },
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

  const status = verdict === 'pass' ? 'succeeded' : 'failed';
  const out = { ok: true, jobId, verdict, status, report: reportAbs, leasesReleased: released, machineRefsReleased: machineReleased };
  emit(out, `settled ${jobId} verdict=${verdict} status=${status} (leases released: ${released})`, args.json);
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

/* ------------------------------------------------------------------ main */
function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h') usage(cmd ? 0 : 2);
  const args = parseArgs(argv.slice(1));
  const repo = path.resolve(args.repo ?? process.cwd());

  const required = {
    survey: ['workflow'], status: ['workflow'], plan: ['workflow', 'file'],
    enqueue: ['workflow', 'op', 'paths'], dispatch: ['job'],
    settle: ['job', 'verdict', 'report'], incident: ['workflow', 'kind', 'detail'],
    retire: ['workflow'],
  };
  if (!required[cmd]) usage(2);
  for (const k of required[cmd]) need(args[k], `${cmd} needs --${k}`);
  if (cmd === 'settle' && !['pass', 'fail', 'blocked'].includes(args.verdict)) need(false, `settle --verdict must be pass|fail|blocked, got '${args.verdict}'`);

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
      case 'dispatch': return cmdDispatch(ledger, args, repo);
      case 'settle': return cmdSettle(ledger, args, repo);
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
