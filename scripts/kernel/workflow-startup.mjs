import { loadConfig } from '../../engine/config.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import path from 'node:path';
import { execNode } from '../api/node/exec-node.mjs';
import { npmCi } from '../machine/npm-ci.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import crypto from 'node:crypto';
import { clearSignal, updateSignal, openIncident } from '../../engine/db/ledger.mjs';
import { withMachine, readMachine } from '../../engine/db/machine.mjs';
import { shortHash } from '../lib/hash.mjs';
import { readEnv } from '../lib/env.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { runShow } from '../api/orca/run-show.mjs';
import { SKILL_ROOT, supervisedSeatHandles } from '../machine/home.mjs';
import { entryTerminalsOf, recordedSeatTerminals } from '../machine/seat-sessions.mjs';

async function workflowHost({ caller, env }, run = execNode) {
  const args = [path.join(skillRoot, 'scripts/reconciler/workflow-up.mjs'), '--json'];
  for (const name of ['agent', 'model', 'effort']) if (caller?.[name] != null)
    args.push(`--caller-${name}`, String(caller[name]));
  const made = await run(args, { cwd: skillRoot, env: { ...env, STARCI_RUNTIME: skillRoot }, maxBuffer: 256 * 1024 * 1024 });
  const data = parseJsonOr(String(made.stdout ?? ''));
  const code = made.error ? made.error.code : 0;
  const native = { exitCode: Number.isInteger(code) ? code : null, signal: made.error?.signal ?? null,
    error: made.error?.message ?? null, stderr: String(made.stderr ?? '').slice(0, 500) };
  if (!data || typeof data.hostOk !== 'boolean' || typeof data.ok !== 'boolean'
      || code !== (data.ok ? 0 : 1) || made.error?.killed || native.signal
      || data.hostOk && !data.ok && (!data.maintenance || data.maintenance.ok === true && data.maintenance.ready === true))
    return { ok: false, effectState: 'unknown', native, receipt: data, error: 'native host startup returned no verified outcome' };
  return { ...data, ok: data.hostOk, native };
}

const SENDER_MISSING = (detail) => ({ ok: false, reason: 'workflow-sender-terminal-missing',
  error: `no_active_sender_terminal: a Kernel launch needs a live Orca terminal as its sender and coordinator; ${detail}` });

/**
 * The runtime-owned sender of a Kernel launch that has no caller terminal, from one terminal listing. The Run's coordinator
 * is never a foreign terminal: first a plain terminal of the runtime's own worktree (the Run's current coordinator when it is
 * one, so the entry Run stays reusable), else the live Supervisor seat, the runtime's own maintenance authority. Pure.
 */
export function headlessSenderOf({ listing, recorded = new Set(), seats = new Set(), coordinator = null, root } = {}) {
  const entries = entryTerminalsOf({ listing, recorded, owned: seats, root });
  const entry = entries.includes(coordinator) ? coordinator : entries[0];
  if (entry) return { ok: true, handle: entry, source: 'runtime-worktree' };
  const seat = (listing?.terminals ?? []).find((t) => t?.handle && seats.has(t.handle) && t.connected !== false && t.writable !== false);
  return seat ? { ok: true, handle: seat.handle, source: 'supervisor-seat' }
    : SENDER_MISSING("no runtime-owned terminal (a plain terminal of the runtime's own worktree, or the live Supervisor seat) is open for the unattended launch; open one and the next pass proceeds");
}

/**
 * The terminal Orca takes as the sender of run-create and worker-start: the caller's own ORCA_TERMINAL_HANDLE. Only the
 * unattended watchdog launch (`launchedBy` watchdog, no caller terminal) falls back to headlessSenderOf; an owner or
 * Supervisor start is refused without a terminal. The workflow's entry Run (its Kernel job's managed.runId) names the coordinator to prefer.
 */
export function workflowSender({ env = process.env, launchedBy = 'supervisor', ledger = null, workflowId = null, root = SKILL_ROOT } = {}, { list = terminalList, show = runShow, machine = readMachine } = {}) {
  const handle = String(readEnv('ORCA_TERMINAL_HANDLE', env) ?? '').trim();
  if (handle) return { ok: true, handle, source: 'caller' };
  if (launchedBy !== 'watchdog') return SENDER_MISSING('run starci workflow start inside an Orca terminal (ORCA_TERMINAL_HANDLE is not set here)');
  const runId = parseJsonOr(ledger?.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`)?.payload_json)?.managed?.runId ?? null;
  const listing = list({});
  if (!listing?.ok) return SENDER_MISSING(`the terminal listing is unavailable (${listing?.error ?? 'host-unavailable'})`);
  const owners = machine((m) => ({ recorded: recordedSeatTerminals(m), seats: supervisedSeatHandles(m) }), { recorded: new Set(), seats: new Set() }, { env });
  return headlessSenderOf({ listing, recorded: owners.recorded, seats: owners.seats, coordinator: runId ? show({ id: runId })?.coordinator ?? null : null, root });
}

/** Why a finished or archived goal never gets a Kernel again, or null while it is open. */
export function closedGoalMessage(goal, wf) {
  if (wf?.phase === 'finished') return `goal ${goal} is finished — finished goals never re-enter the queue`;
  return wf?.archived_at != null ? `goal ${goal} is archived — archived goals never re-enter the queue` : null;
}

export function workflowStartAuthority({ workflow, goal } = {}) {
  if (!workflow || goal?.approved_by !== 'owner')
    return { ok: false, reason: 'workflow-approval-required' };
  if (!['queued', 'running'].includes(workflow.phase) || workflow.archived_at != null)
    return { ok: false, reason: 'workflow-not-startable', phase: workflow.phase };
  if (!String(goal.markdown ?? '').trim() || !String(goal.goal_identity ?? '').trim()
      || goal.goal_identity !== workflow.goal_identity || !Number.isInteger(goal.revision))
    return { ok: false, reason: 'workflow-goal-unverified' };
  if (parseJsonOr(goal.json)?.provisional === true)
    return { ok: false, reason: 'workflow-approval-required' };
  return { ok: true, workflowId: workflow.workflow_id, goalIdentity: goal.goal_identity, goalRevision: goal.revision,
    generation: workflow.generation ?? 0 };
}

/** Publish a spawned Kernel only while its accepted goal and exact starting reservation still own the ledger transaction. */
export function commitWorkflowStart(ledger, { workflowId, expected, token, holderPid, now = Date.now }, publish) {
  return ledger.transaction(() => {
    const workflow = ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
    const goal = ledger.db.prepare('SELECT revision,goal_identity,markdown,json,approved_by FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
    const authority = workflowStartAuthority({ workflow, goal });
    if (!authority.ok) return authority;
    if (expected?.ok !== true || ['workflowId', 'goalIdentity', 'goalRevision', 'generation'].some((key) => authority[key] !== expected[key]))
      return { ok: false, reason: 'workflow-goal-unverified', authority };
    const signal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
    const reservationHeld = () => signal.expires_at > now();
    if (!token || signal?.token !== token || signal?.holder_pid !== holderPid
        || parseJsonOr(signal.value_json)?.state !== 'starting' || !reservationHeld())
      return { ok: false, reason: 'kernel-start-reservation-lost', authority };
    publish({ workflow, goal, authority });
    return { ok: true, authority };
  });
}

/** A failed launch may retain only its own token; unknown worker custody survives even after a newer singleton wins. */
export function recordWorkflowStartFailure(ledger, { workflowId, token, holderPid, step, error, handle = null, extra = {}, at = Date.now(), env = process.env }, { machine = withMachine } = {}) {
  return ledger.transaction(() => {
    const workflow = ledger.db.prepare('SELECT generation,phase,archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
    const generation = workflow?.generation ?? 0;
    const unknown = ['partial', 'unknown'].includes(extra.effectState);
    // An archived ledger rejects further events; the machine owns unresolved host custody after retirement.
    if (!workflow || workflow.phase === 'archived' || workflow.archived_at != null) {
      const payload = { step, error, terminal: handle, ...extra, reservation: token, signalRetained: false };
      try {
        const custody = machine((m) => m.transaction(() => {
          const event = m.supEvent({ entityType: 'kernel', entityId: workflowId, kind: 'kernel-start-failed', at,
            payload: { ledgerId: ledger.ledgerId, ledgerFile: ledger.file, workflowId, generation, ...payload } });
          const decision = unknown ? m.openSupDecision({
            keyParts: { kind: 'kernel-start-custody', entity: shortHash(JSON.stringify([ledger.ledgerId, workflowId])),
              signature: shortHash(JSON.stringify([token, holderPid, extra.dispatch ?? handle])), head: String(generation) },
            kind: 'runtime-defect', decider: 'supervisor', openedBy: 'kernel-start', ledgerId: ledger.ledgerId,
            workflowId, entityType: 'kernel', entityId: workflowId,
            summary: 'A retired workflow has an unresolved Kernel launch; verify its exact worker closure before releasing provider capacity.',
            evidence: payload, payload: { ledgerFile: ledger.file, generation, ...payload }
          }) : null;
          return { ok: true, owner: 'machine-supervisor', event, decision };
        }), { env });
        return { ...payload, custody };
      } catch (cause) {
        return { ...payload, custody: { ok: false, owner: 'machine-supervisor', error: String(cause?.message ?? cause) } };
      }
    }
    const held = ledger.db.prepare("SELECT token,holder_pid FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
    const owns = token && held?.token === token && held?.holder_pid === holderPid;
    const signalRetained = unknown && owns ? updateSignal(ledger.db, { scope: 'kernel', key: workflowId, token, holderPid, at, expiresAt: null,
      value: { state: 'launch-unknown', terminal: handle, dispatch: extra.dispatch ?? null,
        admission: extra.admission ?? null, hostRequestId: extra.hostRequestId ?? null, effectState: extra.effectState } }) : false;
    if (!unknown && owns) clearSignal(ledger.db, { scope: 'kernel', key: workflowId, token });
    const payload = { step, error, terminal: handle, ...extra, reservation: token, signalRetained };
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation,
      kind: 'kernel-start-failed', payload, createdAt: at });
    if (unknown && !signalRetained) openIncident(ledger.db, { incidentId: `inc-${crypto.randomUUID()}`, workflowId,
      kind: 'runtime-defect', owner: 'supervisor', at, lastProgress: `[kernel-start-custody] ${JSON.stringify(payload)}` });
    return payload;
  });
}

export async function ensureWorkflowHost({ workflow, goal, caller = null, env = process.env, plan = false } = {}, deps = {}) {
  const authority = workflowStartAuthority({ workflow, goal });
  if (!authority.ok) return { ...authority, ready: false };
  if (plan) return { ...authority, planned: true, ready: false };
  let config, host;
  try { config = deps.config ?? (deps.loadConfig ?? loadConfig)(); }
  catch (error) { return { ok: false, ready: false, reason: 'workflow-host-not-ready', error: String(error?.message ?? error) }; }
  try { host = await (deps.ensureHost ?? ((input) => workflowHost(input, deps.execNode)))({ caller, env, workflowSeats: false }); }
  catch (error) { return { ok: false, ready: false, reason: 'workflow-host-not-ready', authority,
    host: { ok: false, effectState: 'unknown', error: String(error?.message ?? error) } }; }
  if (host?.ok !== true) return { ok: false, ready: false, reason: 'workflow-host-not-ready', authority, host };
  let maintenance = { ok: true, ready: true, action: 'disabled' };
  if (config?.debug === true || host.maintenance && (host.maintenance.ok !== true || host.maintenance.ready !== true)) {
    try { maintenance = deps.ensureDebug ? await deps.ensureDebug({ caller, env, plan: false })
      : host.maintenance ?? { ok: false, ready: false, effectState: 'unknown', error: 'native maintenance outcome is missing' }; }
    catch (error) { maintenance = { ok: false, ready: false, effectState: 'unknown', error: String(error?.message ?? error) }; }
    if (maintenance?.ok !== true || maintenance?.ready !== true)
      return { ok: false, ready: false, reason: 'workflow-debug-not-ready', authority, host, maintenance };
  }
  return { ok: true, ready: true, authority, host, maintenance };
}

export async function installWorkflowTree({ record, env = process.env } = {}, deps = {}) {
  if (!record?.path) return { ok: false, reason: 'workflow-worktree-missing' };
  let result;
  try { result = await (deps.npmCi ?? npmCi)({ cwd: record.path, role: 'coordinator', env, args: {} }); }
  catch (error) { return { ok: false, installed: false, reason: 'workflow-worktree-install-failed', path: record.path,
    receipt: null, error: String(error?.message ?? error) }; }
  const ok = result?.code === 0 && result?.data?.ok === true;
  return { ok, installed: ok, path: record.path, receipt: result?.data ?? null,
    ...(ok ? {} : { reason: 'workflow-worktree-install-failed', error: result?.text ?? 'npm ci did not return a successful receipt' }) };
}
