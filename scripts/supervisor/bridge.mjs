#!/usr/bin/env node
// starci supervisor bridge — the [Supervisor]'s cross-workflow verbs (modules/supervisor/bridging.yaml; owner mandate
// 2026-09-28: the Supervisor "adds supplementary workflows when two workflows depend on each other, and
// reorganizes workflows").
//
//   detect   [--repo <ledger-owner>]... [--json]
//            read-only: the dependency graph of each ledger (scripts/kernel/dependency-graph.mjs), its
//            findings (circular-wait, unowned-need, hub-blocker, duplicate-work) and the action the
//            Supervisor would take on each; default repos: config.yaml supervisor.repos
//   list     --repo <r> [--json]                        the bridging records of one ledger
//   bridge   --repo <r> --dependents <wf,...> --foundation <name> --goal <text> --reason <text>
//            [--blocker <wf>] [--title <t>] [--kind <k>] [--waits <inc,...>] [--paths <csv>] [--finding <key>]
//            [--start] [--no-notify] [--dry-run]
//            (a) defines a BRIDGING workflow through define-goal (--defined-by supervisor) that owns the
//            shared part as a foundation, declares the dependents on it, and - once the bridge runs
//            (--start runs start-workflow) - re-types each dependent's wait on the blocker as a peer-wait
//            --until-foundation <name> on the bridge
//   rewire   --repo <r> --bridge <id> [--no-notify]     finish the re-typing of a bridge that was not running yet
//   transfer --repo <r> (--foundation <name> [--merge-into <name> | --to <wf>] | --record <path> --to <wf>) --reason <text>
//            (b) ownership of a shared foundation or record moves to another workflow; --merge-into folds one
//            foundation spelled two ways (<product>.brand -> brand) into the other and re-types the waits on it
//   revise   --repo <r> --workflow <wf> --text <goal text> --reason <text> [--request-only]
//            (c) merge/split/park a workflow's legs when two workflows duplicate work: define-goal --revise,
//            applied provisionally (--approved-by supervisor) under autopilot, else filed as a request
//   designate --repo <r> --lead <wf> --waiter <wf> --reason <text> [--releases <inc,...>]
//            (d) break a circular wait: <lead> builds the shared part (its waits into the cycle are
//            resolved --by supervisor), <waiter> keeps waiting on it
//
// Every action is recorded with its reason: a starci/supervisor-bridge@1 record in the product ledger's
// signals (scope supervisor-bridge), a supervisor-bridge-* event on each workflow it touches, and a
// supervisor-action event in machine.sqlite sup_events (scripts/supervisor/actions.mjs reads it for the SLA).
// Under autopilot (runtimes.yaml allocation.autopilot.enabled, default on) no owner approval is asked and
// the record says provisional:true, approvedBy supervisor-autopilot; with autopilot off a write verb needs
// --owner-ok (the owner said ok in the Supervisor's channel). Writes go only through this landed CLI,
// define-goal.mjs, start-workflow.mjs and cli.mjs incident; nothing here edits a ledger by hand.
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';
import { inspectLedger, ledgerFileFor, newToken, openLedger } from '../../engine/db/ledger.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { parseJson } from '../lib/json.mjs';
import { list, splitList } from '../lib/list.mjs';
import { fail } from '../../engine/refuse.mjs';
import {
  BRIDGE_SCHEMA, dependencyGraph, findingLine, readBridge, readBridges, shortWorkflow, writeBridge, writeTransfer,
} from '../kernel/dependency-graph.mjs';
import {
  FOUNDATION_KINDS, claimFoundation, declareDependent, normalizeFoundationName, readDeclaration, readFoundation, writeDeclaration, writeFoundation,
} from '../kernel/foundation-registry.mjs';
import { TRANSFER_SCHEMA, createOwnership } from '../kernel/work-ownership.mjs';
import { normWork } from '../lib/path-key.mjs';
import { SKILL_ROOT, productRepos, supervisorEvent, supervisorSettings, withSupervisor } from '../machine/home.mjs';
import { isMain } from '../lib/is-main.mjs';
import { clipLine } from '../lib/clip.mjs';

const API = path.join(SKILL_ROOT, 'scripts', 'kernel', 'cli.mjs');
const DEFINE_GOAL = path.join(SKILL_ROOT, 'scripts', 'goal', 'define-goal.mjs');
const START_WORKFLOW = path.join(SKILL_ROOT, 'scripts', 'kernel', 'start-workflow.mjs');
export const ACTION_KIND = 'supervisor-action';
export const TAG = '[supervisor-bridge]';
const BOOLEAN_FLAGS = new Set(['json', 'start', 'dry-run', 'no-notify', 'request-only', 'owner-ok']);
const csv = (v) => splitList(v);
const clip = (s, n = 400) => clipLine(s, n);

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    if (BOOLEAN_FLAGS.has(key)) { out[key] = true; continue; }
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) fail(`--${key} needs a value`, 'arg-missing');
    if (key === 'repo') {
      out.repos ??= [];
      out.repos.push(value);
    }
    out[key] = value; i++;
  }
  return out;
}

/** Under autopilot the Supervisor acts without an owner approval and records it provisional. */
export const autopilotOn = () => { try { return allocationSettings()?.autopilot?.enabled !== false; } catch { return true; } };
export function approvalOf(args, { autopilot = autopilotOn() } = {}) {
  if (autopilot) return { approvedBy: 'supervisor-autopilot', provisional: true };
  if (args['owner-ok']) return { approvedBy: 'owner', provisional: false };
  return fail('autopilot is off (runtimes.yaml allocation.autopilot.enabled false): a bridging action needs the owner\'s ok first; re-run with --owner-ok once the owner said ok', 'autopilot-off');
}

const runRuntime = (script, argv, { env = process.env, timeout = 180_000 } = {}) => runNode([script, ...argv],
  { cwd: SKILL_ROOT, timeout, env });
const lastJson = (text) => { const t = String(text ?? '').trim(); return parseJson(t) ?? parseJson(t.split('\n').at(-1)) ?? null; };
/** One cli.mjs call: {ok, body, error, code}. */
function apiCall(repo, argv, opts) {
  const r = runRuntime(API, [...argv, '--repo', repo, '--json'], opts);
  const body = lastJson(r.stdout) ?? lastJson(r.stderr);
  if (r.status === 0 && body?.ok !== false) return { ok: true, body };
  return { ok: false, body, code: body?.code ?? body?.reason ?? `exit-${r.status}`, error: clip(body?.error ?? body?.detail ?? r.stderr ?? r.stdout, 600) };
}

const withRead = (repo, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
const withWrite = (repo, fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return l.transaction(() => fn(l)); } finally { l.close(); } };
const workflowOf = (db, id) => db.prepare('SELECT workflow_id,title,phase,archived_at,created_at FROM workflows WHERE workflow_id=?').get(id);
const isLive = (row) => Boolean(row) && row.archived_at == null && ['running', 'queued'].includes(row.phase);
const isRunning = (row) => Boolean(row) && row.archived_at == null && row.phase === 'running';
const raisedOf = (db, workflowId, incidentId) => {
  const ev = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, incidentId);
  const row = db.prepare('SELECT incident_id,op_id,status,last_progress FROM incidents WHERE incident_id=? AND workflow_id=?').get(incidentId, workflowId);
  return row ? { ...row, payload: parseJson(ev?.payload_json, {}) ?? {} } : null;
};

/** Record the action as a Supervisor audit event (best effort: the product ledger record is the durable one). */
function supervisorAction({ item, action, reason, workflowId = null, refs = [], env = process.env }) {
  try {
    withSupervisor((m) => supervisorEvent(m, { entityType: 'action', entityId: item, kind: ACTION_KIND, payload: { item, action, reason: clip(reason, 600), workflowId, refs, by: 'supervisor' } }), { env });
    return true;
  } catch { return false; }
}

async function notify(repo, workflowId, text, args) {
  if (args['no-notify']) return { workflowId, action: 'skipped' };
  try {
    const { notifyKernel } = await import('./notify.mjs');
    const r = await notifyKernel({ repo, workflowId, text, item: args.finding ?? null });
    return { workflowId, action: r.action, delivered: r.delivered === true };
  } catch (error) { return { workflowId, action: 'notify-failed', error: clip(error?.message ?? error, 200) }; }
}

const appendEvents = (ledger, workflows, kind, payload) => {
  for (const workflowId of new Set(workflows.filter(Boolean))) {
    if (!workflowOf(ledger.db, workflowId)) continue;
    ledger.appendEvent({ workflowId, entityType: 'bridge', entityId: payload.bridgeId, kind, payload });
  }
};
const updateBridge = (repo, id, patch) => withWrite(repo, (ledger) => {
  const current = readBridge(ledger.db, id);
  if (!current) fail(`no bridging record ${id}`, 'bridge-unknown');
  const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
  writeBridge(ledger.db, { ...next, updatedAt: Date.now() });
  return next;
});

/**
 * Re-type one open wait as a peer-wait --until-foundation <foundation> (on the foundation's owner):
 * the new wait holds what the old one held, then the old one is resolved --by supervisor naming the new.
 * A foundation that already landed resolves the old wait only.
 */
function retypeWait(repo, { workflowId, incidentId, foundation, bridgeId, reason, env }) {
  const raised = withRead(repo, (db) => raisedOf(db, workflowId, incidentId));
  if (!raised) return { workflowId, from: incidentId, error: 'incident-unknown' };
  if (raised.status !== 'open') return { workflowId, from: incidentId, skipped: `already ${raised.status}` };
  const holds = list(raised.payload.holds).length ? raised.payload.holds : [raised.op_id].filter(Boolean);
  const detail = `${TAG} ${bridgeId}: ${clip(reason, 240)}. Re-typed from ${incidentId}: ${clip(raised.payload.detail ?? raised.last_progress, 500)}`;
  const raise = apiCall(repo, ['incident', '--workflow', workflowId, '--kind', 'peer-wait', '--until-foundation', foundation, '--detail', detail,
    ...(holds.length ? ['--holds', holds.join(',')] : []), ...(raised.op_id ? ['--op', raised.op_id] : []), '--refs', [incidentId, ...list(raised.payload.refs)].slice(0, 8).join(',')], { env });
  const landed = !raise.ok && raise.code === 'foundation-landed';
  if (!raise.ok && !landed) return { workflowId, from: incidentId, error: `${raise.code}: ${raise.error}` };
  const to = raise.ok ? raise.body?.incidentId ?? null : null;
  const resolve = apiCall(repo, ['incident', '--workflow', workflowId, '--resolve', incidentId, '--by', 'supervisor', '--detail',
    `${TAG} ${bridgeId}: ` + (to ? 're-typed as ' + to + ', which waits on foundation ' + foundation : 'foundation ' + foundation + ' already landed') + `; ${clip(reason, 240)}`], { env });
  return { workflowId, from: incidentId, to, holds, ...(landed ? { foundationLanded: true } : {}), ...(resolve.ok ? {} : { resolveError: `${resolve.code}: ${resolve.error}` }) };
}

/* -------------------------------------------------------------------- detect / list */
export function detect(repos, { now = Date.now() } = {}) {
  return repos.map((repo) => {
    try { return { repo, ...withRead(repo, (db) => dependencyGraph(db, { repo, now })) }; }
    catch (error) { return { repo, ok: false, error: clip(error?.message ?? error, 300), findings: [], edges: [], nodes: [], bridges: [] }; }
  });
}
const q = (s) => `"${String(s).replaceAll(/"/g, '\'')}"`;
/** The command line the Supervisor would run for a clear-cut finding. */
export function commandFor(repo, f) {
  const p = f.proposal ?? {};
  const base = `starci supervisor bridge ${p.action} --repo ${repo}`;
  if (p.action === 'bridge') return base + (p.blocker ? ` --blocker ${p.blocker}` : '') + ` --dependents ${list(p.dependents).join(',')} --foundation ${p.foundation ?? '<name>'} --goal ${q(p.goalDraft ?? '<goal>')} --reason ${q(f.summary)} --finding ${q(f.key)} --start`;
  if (p.action === 'transfer') return `${base} --foundation ${p.target?.foundation ?? '<name>'}` + (p.mergeInto ? ` --merge-into ${p.mergeInto}` : ` --to ${p.to ?? '<wf>'}`) + ` --reason ${q(p.why)} --finding ${q(f.key)}`;
  if (p.action === 'designate') return `${base} --lead ${p.owner} --waiter ${p.waiter} --releases ${list(p.releases).join(',')} --reason ${q(p.why)} --finding ${q(f.key)}`;
  if (p.action === 'revise') return `${base} --workflow ${p.workflow} --text <revised goal text parking ${list(p.paths).join(', ')}> --reason ${q(p.why)} --finding ${q(f.key)}`;
  return null;
}

/* -------------------------------------------------------------------- (a) bridge */
async function cmdBridge(args, { env = process.env } = {}) {
  const repo = path.resolve(args.repo ?? fail('--repo <ledger-owner> is required', 'arg-missing'));
  const reason = String(args.reason ?? '').trim() || fail('a bridge states its --reason', 'reason-missing');
  const goal = String(args.goal ?? '').trim() || fail('a bridge states its --goal (the shared part the bridging workflow owns)', 'goal-missing');
  const foundation = normalizeFoundationName(args.foundation ?? fail('--foundation <name> names the shared part the bridge owns', 'arg-missing'));
  const kind = args.kind ?? 'other';
  if (!FOUNDATION_KINDS.includes(kind)) fail(`--kind must be ${FOUNDATION_KINDS.join('|')}`, 'foundation-kind-invalid');
  const dependents = csv(args.dependents);
  if (!dependents.length) fail('--dependents <wf,...> names the workflows that wait on the shared part', 'arg-missing');
  const blocker = args.blocker ?? null;
  const approval = approvalOf(args);
  const pre = withRead(repo, (db) => {
    for (const wf of dependents) if (!isRunning(workflowOf(db, wf))) fail(`dependent ${wf} is not a running workflow of ${repo}`, 'workflow-not-running');
    if (blocker && !workflowOf(db, blocker)) fail(`blocker ${blocker} is not a workflow of ${repo}`, 'workflow-unknown');
    const existing = readFoundation(db, foundation);
    if (existing?.owner && isLive(workflowOf(db, existing.owner.workflowId))) fail(`foundation ${foundation} is already owned by live ${existing.owner.workflowId}: make its dependents wait on it, or transfer it`, 'foundation-owned');
    // The waits to re-type: explicit --waits, else every open wait of a dependent on the blocker.
    let waits = csv(args.waits).map((incidentId) => {
      const row = db.prepare("SELECT workflow_id FROM incidents WHERE incident_id=? AND status='open'").get(incidentId);
      if (!row) fail(`--waits ${incidentId} is no open incident`, 'incident-unknown');
      if (!dependents.includes(row.workflow_id)) fail(`--waits ${incidentId} belongs to ${row.workflow_id}, not a dependent`, 'incident-not-dependent');
      return { workflowId: row.workflow_id, incidentId };
    });
    if (!waits.length && blocker) {
      const graph = dependencyGraph(db, { repo, light: true });
      waits = [...new Map(graph.edges.filter((e) => dependents.includes(e.from) && e.to === blocker && e.strength === 'hard' && String(e.ref).startsWith('inc-'))
        .map((e) => [e.ref, { workflowId: e.from, incidentId: e.ref }])).values()];
    }
    return { existing, waits };
  });
  const bridgeId = `br-${newToken().slice(0, 10)}`;
  const title = String(args.title ?? '').trim() || `bridge-${foundation}`;
  const plan = { bridgeId, foundation, kind, blocker, dependents, waits: pre.waits, title, goal, reason, ...approval, start: Boolean(args.start), paths: csv(args.paths).map(normWork) };
  if (args['dry-run']) return { ok: true, dryRun: true, action: 'bridge', plan };

  // 1. The bridging workflow, through define-goal.
  const defined = runRuntime(DEFINE_GOAL, ['--repo', repo, '--text', goal, '--title', title, '--defined-by', 'supervisor', '--bridge-id', bridgeId, '--reason', reason, '--json'], { env });
  const def = lastJson(defined.stdout);
  if (defined.status !== 0 || !def?.workflowId) fail(`define-goal refused the bridging goal: ${clip(defined.stderr || defined.stdout, 500)}`, 'define-goal-failed');
  const workflowId = def.workflowId;
  // 2. It owns the shared part as a foundation; the dependents need it; ownership of --paths moves to it.
  const now = Date.now();
  const record = withWrite(repo, (ledger) => {
    const db = ledger.db;
    const existing = readFoundation(db, foundation);
    let f = claimFoundation(existing, { name: foundation, workflowId, ownerRunning: false, kind, detail: `${TAG} ${bridgeId}: ${clip(goal, 300)}`, now }).record;
    for (const dep of dependents) f = declareDependent(f, { name: foundation, workflowId: dep, detail: `${TAG} ${bridgeId}`, now }).record;
    f = { ...f, owner: { ...f.owner, by: 'supervisor', bridgeId, provisional: approval.provisional } };
    writeFoundation(db, f, now);
    if (!readDeclaration(db, workflowId)) writeDeclaration(db, workflowId, { none: false, at: now, by: 'supervisor', bridgeId }, now);
    const ownerOf = createOwnership(db, { repo });
    for (const p of plan.paths) {
      writeTransfer(db, { schema: TRANSFER_SCHEMA, path: p, to: workflowId, from: p.startsWith('.starciwork/') ? ownerOf(p)?.workflowId ?? null : blocker, reason, at: now, by: 'supervisor', ...approval, bridgeId }, now);
    }
    const rec = { schema: BRIDGE_SCHEMA, id: bridgeId, action: 'bridge', state: 'defined', by: 'supervisor', ...approval, reason, finding: args.finding ?? null,
      workflowId, title, goal, foundation, kind, blocker, dependents, waits: pre.waits, rewired: [], paths: plan.paths, at: now, updatedAt: now };
    writeBridge(db, rec, now);
    appendEvents(ledger, [workflowId], 'supervisor-bridge-created', { bridgeId, foundation, dependents, blocker, reason, ...approval });
    appendEvents(ledger, [...dependents, blocker], 'supervisor-bridge-linked', { bridgeId, bridge: workflowId, foundation, reason, ...approval });
    return rec;
  });
  // 3. Start its Kernel (start-workflow), then re-type the dependents' waits on it.
  let started = null;
  if (args.start) {
    const r = runRuntime(START_WORKFLOW, ['--repo', repo, '--goal', workflowId, '--launched-by', 'supervisor', '--json'], { env, timeout: 600_000 });
    started = { ok: r.status === 0, status: r.status, body: lastJson(r.stdout), ...(r.status === 0 ? {} : { error: clip(r.stderr || r.stdout, 500) }) };
    updateBridge(repo, bridgeId, (b) => ({ ...b, state: started.ok ? 'started' : 'defined', start: { ok: started.ok, at: Date.now(), ...(started.error ? { error: started.error } : {}) } }));
  }
  const rewired = await rewireBridge(repo, bridgeId, { env, args, quiet: true });
  const notices = [];
  if (blocker) notices.push(await notify(repo, blocker, `${TAG} ${bridgeId}: bridging workflow ${workflowId} now owns the shared part ${foundation} that ${dependents.join(', ')} waited on you for (${clip(reason, 200)}). Its landing releases them; your own job for it is redundant once ${foundation} lands - drop or verify it then (starci kernel foundations shows the owner).`, args));
  supervisorAction({ item: args.finding ?? `bridge|${bridgeId}`, action: 'bridge', reason, workflowId, refs: [bridgeId, foundation, ...dependents], env });
  return { ok: true, action: 'bridge', bridgeId, workflowId, foundation, dependents, blocker, ...approval, record: { ...record, state: rewired.record?.state ?? record.state }, started, rewire: rewired, notices };
}

/** Finish (or redo) a bridge's re-typing: only once the bridging workflow runs can a wait name it. */
async function rewireBridge(repo, bridgeId, { env = process.env, args = {}, quiet = false } = {}) {
  const bridge = withRead(repo, (db) => readBridge(db, bridgeId)) ?? fail(`no bridging record ${bridgeId}`, 'bridge-unknown');
  if (bridge.action !== 'bridge') fail(`${bridgeId} is a ${bridge.action}, not a bridge`, 'bridge-kind');
  const running = withRead(repo, (db) => isRunning(workflowOf(db, bridge.workflowId)));
  if (!running) {
    const record = updateBridge(repo, bridgeId, (b) => ({ ...b, rewire: 'pending: the bridging workflow is not running yet (start it, then starci supervisor bridge rewire --bridge ' + bridgeId + ')' }));
    return { ok: true, pending: true, detail: record.rewire, record };
  }
  const done = new Set(list(bridge.rewired).filter((r) => r.to || r.foundationLanded).map((r) => r.from));
  const results = [];
  for (const wait of list(bridge.waits).filter((w) => !done.has(w.incidentId))) {
    results.push(retypeWait(repo, { ...wait, foundation: bridge.foundation, bridgeId, reason: `the shared part now belongs to bridging workflow ${bridge.workflowId}; ${bridge.reason}`, env }));
  }
  const record = updateBridge(repo, bridgeId, (b) => {
    const rewired = [...list(b.rewired).filter((r) => !results.some((x) => x.from === r.from)), ...results];
    const complete = list(b.waits).every((w) => rewired.some((r) => r.from === w.incidentId && (r.to || r.foundationLanded || r.skipped)));
    return { ...b, rewired, state: complete ? 'rewired' : b.state, rewire: complete ? 'done' : 'partial' };
  });
  withWrite(repo, (ledger) => appendEvents(ledger, [bridge.workflowId, ...bridge.dependents], 'supervisor-bridge-rewired', { bridgeId, foundation: bridge.foundation, rewired: results }));
  const notices = [];
  if (!quiet || results.length) for (const dep of bridge.dependents) {
    const mine = results.filter((r) => r.workflowId === dep);
    const waitText = mine.length ? ' ' + mine.map((r) => r.from + (r.to ? ' is now ' + r.to : '')).join(', ') : '';
    notices.push(await notify(repo, dep, `${TAG} ${bridgeId}: your wait${waitText} waits on foundation ${bridge.foundation}, owned by bridging workflow ${bridge.workflowId} (${clip(bridge.reason, 200)}). Its landing releases the held work; re-verify in your own preflight before dispatch.`, args));
  }
  return { ok: results.every((r) => !r.error), rewired: results, record, notices };
}

/* -------------------------------------------------------------------- (b) transfer */
async function cmdTransfer(args, { env = process.env } = {}) {
  const repo = path.resolve(args.repo ?? fail('--repo <ledger-owner> is required', 'arg-missing'));
  const reason = String(args.reason ?? '').trim() || fail('a transfer states its --reason', 'reason-missing');
  const approval = approvalOf(args);
  const bridgeId = `br-${newToken().slice(0, 10)}`;
  const now = Date.now();
  if (args.record) {
    const target = normWork(args.record);
    const to = args.to ?? fail('--record needs --to <workflow>', 'arg-missing');
    const out = withWrite(repo, (ledger) => {
      if (!isLive(workflowOf(ledger.db, to))) fail(`--to ${to} is not a live workflow`, 'workflow-not-running');
      const from = target.startsWith('.starciwork/') ? createOwnership(ledger.db, { repo })(target)?.workflowId ?? null : null;
      if (from === to) fail(`${target} is already ${to}'s`, 'transfer-noop');
      if (args['dry-run']) return { dryRun: true, from };
      writeTransfer(ledger.db, { schema: TRANSFER_SCHEMA, path: target, to, from, reason, at: now, by: 'supervisor', ...approval, bridgeId }, now);
      const rec = { schema: BRIDGE_SCHEMA, id: bridgeId, action: 'transfer', state: 'applied', by: 'supervisor', ...approval, reason, finding: args.finding ?? null, target: { record: target }, from, to, at: now, updatedAt: now };
      writeBridge(ledger.db, rec, now);
      appendEvents(ledger, [from, to], 'supervisor-ownership-transferred', { bridgeId, record: target, from, to, reason, ...approval });
      return { record: rec, from };
    });
    if (out.dryRun) return { ok: true, dryRun: true, action: 'transfer', target, from: out.from, to };
    const notices = [];
    for (const wf of [out.from, to].filter(Boolean)) notices.push(await notify(repo, wf, `${TAG} ${bridgeId}: ownership of ${target} moved from ${out.from ?? '-'} to ${to} (${clip(reason, 200)}); the new owner declares its changes (starci kernel record-change), the other reads it.`, args));
    supervisorAction({ item: args.finding ?? `transfer|${target}`, action: 'transfer', reason, workflowId: to, refs: [bridgeId, target], env });
    return { ok: true, action: 'transfer', bridgeId, target, from: out.from, to, ...approval, notices };
  }
  const name = normalizeFoundationName(args.foundation ?? fail('transfer names --foundation <name> or --record <path>', 'arg-missing'));
  const mergeInto = args['merge-into'] ? normalizeFoundationName(args['merge-into']) : null;
  if (!mergeInto && !args.to) fail('--foundation needs --to <workflow> or --merge-into <foundation>', 'arg-missing');
  // The waits typed on the foundation that move with it.
  const prior = withRead(repo, (db) => {
    const f = readFoundation(db, name) ?? fail(`no foundation ${name}`, 'foundation-unknown');
    const target = mergeInto ? readFoundation(db, mergeInto) ?? fail(`no foundation ${mergeInto} to merge into`, 'foundation-unknown') : null;
    if (!mergeInto && !isLive(workflowOf(db, args.to))) fail(`--to ${args.to} is not a live workflow`, 'workflow-not-running');
    const waits = db.prepare("SELECT incident_id,workflow_id FROM incidents WHERE status='open' AND last_progress LIKE '[peer-wait]%'").all()
      .filter((row) => raisedOf(db, row.workflow_id, row.incident_id)?.payload?.untilFoundation === name)
      .map((row) => ({ workflowId: row.workflow_id, incidentId: row.incident_id }));
    return { f, target, waits };
  });
  if (args['dry-run']) return { ok: true, dryRun: true, action: 'transfer', foundation: name, mergeInto, to: args.to ?? prior.target?.owner?.workflowId ?? null, waits: prior.waits };
  const from = prior.f.owner?.workflowId ?? null;
  const to = mergeInto ? prior.target.owner?.workflowId ?? null : args.to;
  const moved = withWrite(repo, (ledger) => {
    const db = ledger.db;
    const f = readFoundation(db, name);
    const history = (entry) => [...list(f.history), entry].slice(-20);
    let dependents = list(f.dependents).map((d) => d.workflowId);
    if (mergeInto) {
      let target = readFoundation(db, mergeInto);
      for (const dep of dependents) {
        if (target.owner?.workflowId === dep || list(target.dependents).some((d) => d.workflowId === dep)) continue;
        target = declareDependent(target, { name: mergeInto, workflowId: dep, detail: `${TAG} ${bridgeId}: merged from ${name}`, now }).record;
      }
      writeFoundation(db, target, now);
      writeFoundation(db, { ...f, mergedInto: mergeInto, dependents: [], updatedAt: now, history: history({ at: now, event: 'merged', by: 'supervisor', into: mergeInto, bridgeId, reason: clip(reason, 200) }) }, now);
    } else {
      writeFoundation(db, { ...f, state: f.state === 'unclaimed' ? 'claimed' : f.state, owner: { workflowId: to, claimedAt: now, by: 'supervisor', bridgeId, provisional: approval.provisional },
        dependents: list(f.dependents).filter((d) => d.workflowId !== to), updatedAt: now,
        history: history({ at: now, event: 'transferred', by: 'supervisor', from, to, bridgeId, reason: clip(reason, 200) }) }, now);
      dependents = dependents.filter((d) => d !== to);
    }
    const rec = { schema: BRIDGE_SCHEMA, id: bridgeId, action: 'transfer', state: 'applied', by: 'supervisor', ...approval, reason, finding: args.finding ?? null,
      target: { foundation: name }, ...(mergeInto ? { mergeInto } : {}), from, to, dependents, waits: prior.waits, rewired: [], at: now, updatedAt: now };
    writeBridge(db, rec, now);
    appendEvents(ledger, [from, to, ...dependents], 'supervisor-ownership-transferred', { bridgeId, foundation: name, mergeInto, from, to, reason, ...approval });
    return rec;
  });
  // A wait typed on the old foundation (or on its old owner) now names the merged foundation / the new owner.
  const results = prior.waits.map((w) => retypeWait(repo, { ...w, foundation: mergeInto ?? name, bridgeId, reason: mergeInto ? `foundation ${name} is ${mergeInto} under another name` : `foundation ${name} moved to ${to}; ${reason}`, env }));
  if (results.length) updateBridge(repo, bridgeId, (b) => ({ ...b, rewired: results }));
  const notices = [];
  for (const wf of new Set([from, to, ...moved.dependents].filter(Boolean))) {
    const ownership = mergeInto
      ? `foundation ${name} is merged into ${mergeInto} (owner ${to ?? '-'}); a need of ${name} is now a need of ${mergeInto}`
      : `foundation ${name} now belongs to ${to} (was ${from ?? 'unowned'})`;
    notices.push(await notify(repo, wf, `${TAG} ${bridgeId}: ${ownership} - ${clip(reason, 200)}. Read starci kernel foundations; re-check it in your own preflight.`, args));
  }
  supervisorAction({ item: args.finding ?? `transfer|foundation:${name}`, action: 'transfer', reason, workflowId: to, refs: [bridgeId, name, mergeInto].filter(Boolean), env });
  return { ok: true, action: 'transfer', bridgeId, foundation: name, ...(mergeInto ? { mergeInto } : {}), from, to, dependents: moved.dependents, rewired: results, ...approval, notices };
}

/* -------------------------------------------------------------------- (c) revise */
async function cmdRevise(args, { env = process.env } = {}) {
  const repo = path.resolve(args.repo ?? fail('--repo <ledger-owner> is required', 'arg-missing'));
  const workflowId = args.workflow ?? fail('--workflow <id> names the workflow whose legs change', 'arg-missing');
  const text = String(args.text ?? '').trim() || fail('--text <the revised goal text> says which legs are merged, split or parked', 'arg-missing');
  const reason = String(args.reason ?? '').trim() || fail('a revision states its --reason', 'reason-missing');
  const requestOnly = Boolean(args['request-only']) || !autopilotOn();
  const approval = requestOnly ? { approvedBy: null, provisional: true } : approvalOf(args);
  const bridgeId = `br-${newToken().slice(0, 10)}`;
  const tagged = `${TAG} ${bridgeId}: ${reason}`;
  const planned = runRuntime(DEFINE_GOAL, ['--repo', repo, '--revise', workflowId, '--text', text, '--reason', tagged, '--plan', '--json'], { env });
  const preview = lastJson(planned.stdout)?.revisionPreview;
  if (planned.status !== 0 || !preview?.approval?.token) fail(`define-goal --revise --plan refused: ${clip(planned.stderr || planned.stdout, 500)}`, 'revise-plan-failed');
  if (args['dry-run']) return { ok: true, dryRun: true, action: 'revise', workflowId, preview };
  let applied = null;
  if (!requestOnly) {
    const r = runRuntime(DEFINE_GOAL, ['--repo', repo, '--revise', workflowId, '--text', text, '--reason', tagged, '--approve-revision', preview.approval.token, '--approved-by', 'supervisor', '--bridge-id', bridgeId, '--json'], { env });
    applied = { ok: r.status === 0, body: lastJson(r.stdout), ...(r.status === 0 ? {} : { error: clip(r.stderr || r.stdout, 500) }) };
  }
  const now = Date.now();
  const rec = withWrite(repo, (ledger) => {
    const rec = { schema: BRIDGE_SCHEMA, id: bridgeId, action: 'revise', state: applied?.ok ? 'applied' : applied ? 'refused' : 'requested', by: 'supervisor', ...approval, reason, finding: args.finding ?? null,
      workflowId, text: clip(text, 2000), preview: { baseRevision: preview.baseRevision, nextRevision: preview.nextRevision, opChainDiff: preview.opChainDiff, token: preview.approval.token },
      ...(applied && !applied.ok ? { error: applied.error } : {}), at: now, updatedAt: now };
    writeBridge(ledger.db, rec, now);
    appendEvents(ledger, [workflowId], 'supervisor-revision-requested', { bridgeId, state: rec.state, reason, ...approval, opChainDiff: preview.opChainDiff });
    return rec;
  });
  const noticeText = rec.state === 'applied'
    ? `${TAG} ${bridgeId}: the Supervisor revised your goal to rev ${preview.nextRevision} (provisional, ${clip(reason, 200)}): run starci kernel survey and resurvey the pending goal-revision inbox; queued legs it removed were superseded.`
    : `${TAG} ${bridgeId}: the Supervisor requests a goal revision (${clip(reason, 200)}): ` + (rec.state === 'refused' ? `it could not be applied (${clip(rec.error, 160)}) - settle or reconcile the open legs it names, ` : '') + 'the owner or autopilot applies it; keep the duplicated legs parked meanwhile.';
  const notice = await notify(repo, workflowId, noticeText, args);
  supervisorAction({ item: args.finding ?? `revise|${workflowId}`, action: 'revise', reason, workflowId, refs: [bridgeId], env });
  return { ok: rec.state !== 'refused', action: 'revise', bridgeId, workflowId, state: rec.state, ...approval, preview: rec.preview, ...(applied ? { applied } : {}), notice };
}

/* -------------------------------------------------------------------- (d) designate */
async function cmdDesignate(args, { env = process.env } = {}) {
  const repo = path.resolve(args.repo ?? fail('--repo <ledger-owner> is required', 'arg-missing'));
  const lead = args.lead ?? fail('--lead <wf> names the side that builds the shared part', 'arg-missing');
  const waiter = args.waiter ?? fail('--waiter <wf> names the side that keeps waiting', 'arg-missing');
  const reason = String(args.reason ?? '').trim() || fail('a designation states its --reason', 'reason-missing');
  const approval = approvalOf(args);
  const releases = withRead(repo, (db) => {
    for (const wf of [lead, waiter]) if (!isRunning(workflowOf(db, wf))) fail(`${wf} is not a running workflow`, 'workflow-not-running');
    const explicit = csv(args.releases);
    if (explicit.length) {
      for (const id of explicit) if (!db.prepare("SELECT 1 FROM incidents WHERE incident_id=? AND workflow_id=? AND status='open'").get(id, lead)) fail(`--releases ${id} is no open incident of ${lead}`, 'incident-unknown');
      return explicit;
    }
    const graph = dependencyGraph(db, { repo, light: true });
    return [...new Set(graph.edges.filter((e) => e.from === lead && e.to === waiter && e.strength === 'hard' && String(e.ref).startsWith('inc-')).map((e) => e.ref))];
  });
  if (!releases.length) fail(`${lead} holds no open wait on ${waiter}: there is no cycle to break from its side`, 'nothing-to-release');
  const bridgeId = `br-${newToken().slice(0, 10)}`;
  if (args['dry-run']) return { ok: true, dryRun: true, action: 'designate', lead, waiter, releases };
  const resolved = releases.map((incidentId) => {
    const r = apiCall(repo, ['incident', '--workflow', lead, '--resolve', incidentId, '--by', 'supervisor', '--detail',
      `${TAG} ${bridgeId}: circular wait with ${waiter} broken - the Supervisor designated ${lead} to lead the shared part: proceed with the held work and land it; ${waiter} keeps waiting on ${lead}. ${clip(reason, 240)}`], { env });
    return { incidentId, ok: r.ok, ...(r.ok ? {} : { error: `${r.code}: ${r.error}` }) };
  });
  const now = Date.now();
  withWrite(repo, (ledger) => {
    writeBridge(ledger.db, { schema: BRIDGE_SCHEMA, id: bridgeId, action: 'designate', state: resolved.every((r) => r.ok) ? 'applied' : 'partial', by: 'supervisor', ...approval, reason,
      finding: args.finding ?? null, owner: lead, waiter, releases: resolved, at: now, updatedAt: now }, now);
    appendEvents(ledger, [lead, waiter], 'supervisor-cycle-designated', { bridgeId, lead, waiter, releases, reason, ...approval });
  });
  const notices = [
    await notify(repo, lead, `${TAG} ${bridgeId}: circular wait with ${waiter} broken - you lead the shared part (${clip(reason, 200)}). Wait(s) ${releases.join(', ')} resolved: enqueue the held work now, land it, and tell ${waiter} (starci kernel notify) when it landed.`, args),
    await notify(repo, waiter, `${TAG} ${bridgeId}: circular wait with ${lead} broken - ${lead} leads the shared part; keep your wait on it and do not build it yourself (${clip(reason, 200)}).`, args),
  ];
  supervisorAction({ item: args.finding ?? `designate|${lead}+${waiter}`, action: 'designate', reason, workflowId: lead, refs: [bridgeId, ...releases], env });
  return { ok: resolved.every((r) => r.ok), action: 'designate', bridgeId, lead, waiter, resolved, ...approval, notices };
}

/* -------------------------------------------------------------------- CLI */
const human = {
  detect: (out) => out.repos.flatMap((r) => [
    r.repo + ': ' + (r.error ? 'unreadable (' + r.error + ')' : `${r.nodes.length} live workflow(s), ${r.edges.filter((e) => e.strength === 'hard').length} hard / ${r.edges.filter((e) => e.strength !== 'hard').length} soft edge(s), ${r.findings.length} finding(s), ${r.bridges.length} bridge(s)`),
    ...r.edges.filter((e) => e.strength === 'hard').map((e) => '  WAITS ' + shortWorkflow(e.from) + ' -> ' + shortWorkflow(e.to) + ' via ' + e.via + ' ' + (e.ref ?? '-') + (e.job ? ' (' + e.job + ')' : '')),
    ...r.findings.flatMap((f) => [`  ${findingLine(f)}`, ...(f.proposal?.clearCut ? [`    run: ${commandFor(r.repo, f)}`] : [])]),
    ...r.bridges.map((b) => '  BRIDGE ' + b.id + ' ' + b.action + ' ' + (b.state ?? '-') + (b.provisional ? ' provisional' : '') + (b.workflowId ? ' ' + shortWorkflow(b.workflowId) : '') + (b.foundation ? ' owns ' + b.foundation : '') + ': ' + b.reason),
  ]).join('\n'),
  list: (out) => [`${out.repo}: ${out.bridges.length} bridging record(s)`, ...out.bridges.map((b) => `  ${b.id} ${b.action} ${b.state ?? '-'}${b.provisional ? ' provisional' : ''} ${b.workflowId ?? b.to ?? b.owner ?? ''} — ${clip(b.reason, 200)}`)].join('\n'),
};

export async function main(argv = process.argv.slice(2), { env = process.env } = {}) {
  const args = parseArgs(argv);
  const verb = args._[0];
  if (verb === 'detect') {
    const repos = args.repos?.length ? args.repos.map((r) => path.resolve(r)) : productRepos(supervisorSettings());
    return { ok: true, repos: detect(repos) };
  }
  if (verb === 'list') {
    const repo = path.resolve(args.repo ?? fail('--repo is required', 'arg-missing'));
    return { ok: true, repo, bridges: withRead(repo, (db) => readBridges(db)) };
  }
  if (verb === 'bridge') return cmdBridge(args, { env });
  if (verb === 'rewire') return rewireBridge(path.resolve(args.repo ?? fail('--repo is required', 'arg-missing')), args.bridge ?? fail('--bridge <id>', 'arg-missing'), { env, args });
  if (verb === 'transfer') return cmdTransfer(args, { env });
  if (verb === 'revise') return cmdRevise(args, { env });
  if (verb === 'designate') return cmdDesignate(args, { env });
  return fail('use: starci supervisor bridge detect|list|bridge|rewire|transfer|revise|designate ...', 'usage');
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  try {
    const out = await main(argv), verb = argv[0];
    console.log(argv.includes('--json') || !human[verb] ? JSON.stringify(out, null, argv.includes('--json') ? 0 : 2) : human[verb](out));
    if (out?.ok === false) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ ok: false, code: error.code ?? 'error', error: error.message }));
    process.exitCode = error.code === 'usage' || error.code === 'arg-missing' ? 2 : 1;
  }
}
