// gate-conditions.mjs — machine-checkable release conditions on an open wait incident.
//
// An owner-gate or peer-wait used to describe its release only in free text ("resolve when
// .starciwork/shell/index.yaml exists", "wait for job X to settle + sha"). Nobody re-checked it and
// workflows sat for hours after the condition held (nivo wf-nivo-app-auth-mudqjob3 inc-9f2e1e7ff1f6
// waited on op-backend.implement-82b3110067; Collab inc-28187662c4fe on the Modules shell rev).
// `api incident ... --until-<type> <spec>` stores TYPED conditions on the incident; the runtime
// evaluates them read-only on every `api status` (every watchdog tick), before route/dispatch, after
// a settle and after a peer message, and resolves the incident itself once every condition holds
// (events 'incident-resolved' {by:'until-conditions'} + 'incident-auto-resolved' {evidence}).
// An incident without typed conditions keeps its free-text behaviour exactly: nothing here reads it.
//
//   --until-record <path>[@<state>|>=<rev>]   the record (a file, or a directory's index.yaml) exists,
//                                              and its top-level state equals / its own revision is at
//                                              least (recordRevision: top-level rev, else change.rev)
//   --until-job <jobId>[:settled|succeeded]    the job settled (any verdict; default) or succeeded
//   --until-message <peer>[:<kind>]            a peer message from <peer> (of <kind>) reached this
//                                              workflow after the wait was raised
//   --until-commit <repo>:<ref-or-path>        <ref> resolves to a commit, or <path> is committed at HEAD
//   --until-incident <incidentId>[:resolved]   that incident is no longer open
//   --until-foundation <name>                  the ledger's shared foundation <name> landed (api foundation
//                                              --land; scripts/kernel/foundations.mjs)
//
// Owner-only conditions (an ask answered, a consent given) have no typed form: the owner drives them.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { normalizeFoundationName, readFoundation } from './foundations.mjs';
import { parseJson } from '../lib/json.mjs';

export const UNTIL_TYPES = Object.freeze(['record', 'job', 'message', 'commit', 'incident', 'foundation']);
export const UNTIL_FLAGS = Object.freeze(UNTIL_TYPES.map((type) => `until-${type}`));
export const AUTO_RESOLVED_EVENT = 'incident-auto-resolved';
export const CONDITIONS_ATTACHED_EVENT = 'incident-conditions-attached';
const JOB_WANTS = ['settled', 'succeeded'];
// A settled pass or fail meets `settled`; a cancelled job is followed to its replacement.
const SETTLED = ['succeeded', 'failed'];
const MAX_REPLACEMENT_HOPS = 8;
const retryOfRow = (row) => parseJson(row?.payload_json, {})?.retry?.retryOf ?? null;
const cutOfRow = (row) => parseJson(row?.payload_json, {})?.cut ?? null;
/**
 * The job that took a cancelled job's place: the earliest later attempt of the same
 * workflow and op that retries it, holds the same cut ordinal, or (uncut) retries
 * the same predecessor. Null while no such job exists.
 */
export function replacementOf(db, cancelled) {
  const cut = cutOfRow(cancelled), before = retryOfRow(cancelled);
  const later = db.prepare('SELECT job_id,workflow_id,op_id,attempt,status,payload_json,updated_at FROM jobs WHERE workflow_id=? AND op_id IS ? AND attempt>? ORDER BY attempt')
    .all(cancelled.workflow_id, cancelled.op_id ?? null, Number(cancelled.attempt) || 0);
  return later.find((row) => retryOfRow(row) === cancelled.job_id)
    ?? later.find((row) => {
      const c = cutOfRow(row);
      if (cut) return c && c.id === cut.id && Number(c.ordinal) === Number(cut.ordinal);
      return !c && before && retryOfRow(row) === before;
    })
    ?? null;
}
const PEER_MESSAGE = 'peer-message';
const GIT_TIMEOUT_MS = 10_000;

const invalid = (detail) => Object.assign(new Error(detail), { code: 'until-invalid' });
const iso = (ms) => (Number.isFinite(Number(ms)) ? new Date(Number(ms)).toISOString() : '?');

/** One raw `--until-<type> <spec>` into its stored shape, or a thrown until-invalid. */
export function parseCondition(type, raw) {
  const spec = String(raw ?? '').trim();
  if (!spec) throw invalid(`--until-${type} needs a value`);
  if (type === 'record') {
    const rev = /^(.*?)>=(\d+)$/.exec(spec);
    if (rev) return { type, path: rev[1].trim(), minRev: Number(rev[2]) };
    const at = spec.lastIndexOf('@');
    if (at > 0 && at > spec.lastIndexOf('/') && at > spec.lastIndexOf('\\')) {
      return { type, path: spec.slice(0, at).trim(), state: spec.slice(at + 1).trim() };
    }
    return { type, path: spec };
  }
  if (type === 'job') {
    const [jobId, want = 'settled'] = spec.split(':');
    if (!JOB_WANTS.includes(want)) throw invalid(`--until-job ${spec}: the state is ${JOB_WANTS.join('|')}, got '${want}'`);
    return { type, jobId: jobId.trim(), want };
  }
  if (type === 'message') {
    const [peer, kind = null] = spec.split(':');
    return { type, peer: peer.trim(), ...(kind ? { kind: kind.trim() } : {}) };
  }
  if (type === 'commit') {
    // A Windows repo path carries its drive colon: the separator is the last colon past it.
    const at = spec.lastIndexOf(':');
    if (at <= 1) throw invalid(`--until-commit ${spec}: the form is <repo>:<ref-or-path>`);
    return { type, repo: spec.slice(0, at).trim(), target: spec.slice(at + 1).trim() };
  }
  if (type === 'incident') {
    const [incidentId, want = 'resolved'] = spec.split(':');
    if (want !== 'resolved') throw invalid(`--until-incident ${spec}: the only state is resolved`);
    return { type, incidentId: incidentId.trim(), want };
  }
  if (type === 'foundation') {
    try { return { type, name: normalizeFoundationName(spec) }; } catch (error) { throw invalid(`--until-foundation ${spec}: ${error.message}`); }
  }
  throw invalid(`unknown condition type ${type}`);
}

/**
 * Every condition a raise (or --attach) names, checked against the ledger where it can be: a job, an
 * incident and a message peer must exist, so a typo is refused now instead of waiting forever.
 * `raw` is [[type, spec], ...] as parseArgs collected them.
 */
export function parseConditions(db, raw, { workflowId }) {
  const out = [];
  for (const [type, spec] of raw ?? []) {
    const cond = parseCondition(type, spec);
    if (cond.type === 'job' && !db.prepare('SELECT 1 FROM jobs WHERE job_id=?').get(cond.jobId)) {
      throw Object.assign(new Error(`--until-job names no job ${cond.jobId} in this ledger`), { code: 'until-job-unknown' });
    }
    if (cond.type === 'incident') {
      if (!db.prepare('SELECT 1 FROM incidents WHERE incident_id=?').get(cond.incidentId)) {
        throw Object.assign(new Error(`--until-incident names no incident ${cond.incidentId} in this ledger`), { code: 'until-incident-unknown' });
      }
    }
    if (cond.type === 'message') {
      if (cond.peer === workflowId || !db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(cond.peer)) {
        throw Object.assign(new Error(`--until-message names no peer workflow ${cond.peer}`), { code: 'until-message-peer-unknown' });
      }
    }
    if (cond.type === 'foundation' && !readFoundation(db, cond.name)) {
      throw Object.assign(new Error(`--until-foundation names no registered shared foundation ${cond.name}; its owner claims it (api foundation --claim ${cond.name}) or you declare the need (api foundation --declare-dependent ${cond.name}) first`), { code: 'foundation-unknown' });
    }
    if (cond.type === 'record' && !cond.path) throw invalid('--until-record needs a path');
    if (cond.type === 'commit' && (!cond.repo || !cond.target)) throw invalid('--until-commit needs <repo>:<ref-or-path>');
    out.push(cond);
  }
  return out;
}

export const conditionLabel = (cond) => {
  switch (cond.type) {
    case 'record': return `record ${cond.path}${cond.state ? `@${cond.state}` : ''}${cond.minRev != null ? `>=${cond.minRev}` : ''}`;
    case 'job': return `job ${cond.jobId}:${cond.want}`;
    case 'message': return `message from ${cond.peer}${cond.kind ? `:${cond.kind}` : ''}`;
    case 'commit': return `commit ${cond.repo}:${cond.target}`;
    case 'incident': return `incident ${cond.incidentId}:resolved`;
    case 'foundation': return `foundation ${cond.name} landed`;
    default: return JSON.stringify(cond);
  }
};

const git = (repo, args) => {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true, timeout: GIT_TIMEOUT_MS });
  return { ok: r.status === 0, out: String(r.stdout ?? '').trim(), err: String(r.stderr ?? r.error?.message ?? '').trim() };
};
/**
 * A record's OWN revision, the way the work-record schemas define it: the top-level `rev` where the
 * family declares one (work/brand@1, work/layout-tree@1, work/app-shell@1), otherwise the latest change
 * entry's `change.rev` (every work record: ui-screen, contract, feature, ...). A nested object's `rev`
 * is a BINDING to another record, never this record's revision - ui-screen `brand.rev` / `shell.rev` /
 * `shell.layouts[].rev`, layout-tree `nodes[].rev`, contract `blockedBy[].rev` / `conflictsWith[].rev`
 * - so nothing below the top level is read except `change` (starci-next wf-sn-subscription
 * inc-13eb86851909: app-layout at change rev 6 never met `>=6`, its evidence read rev=-).
 * Returns {rev, source} with rev null when the record states no revision of its own.
 */
const positiveRev = (value) => {
  const n = typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value;
  return Number.isInteger(n) && n > 0 ? n : null;
};
export function recordRevision(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { rev: null, source: null };
  const top = positiveRev(doc.rev) ?? positiveRev(doc.revision);
  const changes = Array.isArray(doc.change) ? doc.change : doc.change && typeof doc.change === 'object' ? [doc.change] : [];
  const changeRevs = changes.map((entry) => positiveRev(entry?.rev)).filter((rev) => rev != null);
  const change = changeRevs.length ? Math.max(...changeRevs) : null;
  if (top != null) return { rev: top, source: 'rev', ...(change != null && change !== top ? { changeRev: change } : {}) };
  if (change != null) return { rev: change, source: 'change.rev' };
  return { rev: null, source: null };
}

const readRecord = (abs) => {
  let file = abs;
  try { if (fs.statSync(abs).isDirectory()) file = path.join(abs, 'index.yaml'); } catch { return null; }
  try { return parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch { return null; }
};

/**
 * One condition, read-only: {met, evidence, unmeetable?}. `unmeetable` names a condition that can no
 * longer hold on its own (the awaited job settled failed under :succeeded, a named job or incident is
 * gone): the Kernel re-points the wait.
 */
export function evaluateCondition(db, cond, { repo, workflowId, since = 0 }) {
  try {
    if (cond.type === 'record') {
      const abs = path.isAbsolute(cond.path) ? cond.path : path.join(repo, cond.path);
      if (!fs.existsSync(abs)) return { met: false, evidence: `${cond.path} absent` };
      if (cond.state == null && cond.minRev == null) return { met: true, evidence: `${cond.path} exists` };
      const doc = readRecord(abs);
      if (!doc || typeof doc !== 'object') return { met: false, evidence: `${cond.path} unreadable as a record` };
      const state = doc.state ?? doc.status ?? null, { rev, source, changeRev } = recordRevision(doc);
      const stateOk = cond.state == null || String(state) === cond.state;
      const revOk = cond.minRev == null || (rev != null && rev >= cond.minRev);
      const revShown = rev == null ? '-' : source === 'change.rev' ? `${rev} (change.rev)` : changeRev != null ? `${rev} (change.rev ${changeRev})` : String(rev);
      return { met: stateOk && revOk, evidence: `${cond.path} state=${state ?? '-'} rev=${revShown}` };
    }
    if (cond.type === 'job') {
      let row = db.prepare('SELECT job_id,workflow_id,op_id,attempt,status,payload_json,updated_at FROM jobs WHERE job_id=?').get(cond.jobId);
      if (!row) return { met: false, unmeetable: `job ${cond.jobId} is gone`, evidence: `${cond.jobId} absent` };
      // A cancelled job was dropped or re-planned, never settled: the wait follows
      // the job that replaced it, and stays unmet while there is none (nivo auth
      // inc-7c46a61faba1 released on a cancel of op-backend.implement-3156a882e8).
      const via = [];
      while (row.status === 'cancelled' && via.length < MAX_REPLACEMENT_HOPS) {
        via.push(row.job_id);
        const next = replacementOf(db, row);
        if (!next) return { met: false, evidence: `${via.join(' -> ')} cancelled; no replacement job in its lineage yet` };
        row = next;
      }
      if (row.status === 'cancelled') return { met: false, evidence: `${via.join(' -> ')} cancelled` };
      const evidence = `${via.length ? `${via.join(' -> ')} cancelled, replaced by ` : ''}${row.job_id} (${row.workflow_id}) ${row.status} at ${iso(row.updated_at)}`;
      if (cond.want === 'succeeded') {
        if (row.status === 'succeeded') return { met: true, evidence };
        if (SETTLED.includes(row.status)) return { met: false, unmeetable: `job ${row.job_id} settled ${row.status}, not succeeded`, evidence };
        return { met: false, evidence };
      }
      return { met: SETTLED.includes(row.status), evidence };
    }
    if (cond.type === 'message') {
      const hit = db.prepare('SELECT key,payload_json,created_at FROM inbox WHERE workflow_id=? AND kind=? AND created_at>=? ORDER BY inbox_id')
        .all(workflowId, PEER_MESSAGE, Number(since) || 0)
        .find((row) => {
          const payload = parseJson(row.payload_json, {}) ?? {};
          return payload.from === cond.peer && (!cond.kind || payload.kind === cond.kind);
        });
      return hit ? { met: true, evidence: `peer message ${hit.key} from ${cond.peer} at ${iso(hit.created_at)}` }
        : { met: false, evidence: `no message from ${cond.peer}${cond.kind ? ` of kind ${cond.kind}` : ''} since ${iso(since)}` };
    }
    if (cond.type === 'commit') {
      const repoAbs = path.isAbsolute(cond.repo) ? cond.repo : path.join(repo, cond.repo);
      if (!fs.existsSync(repoAbs)) return { met: false, evidence: `${cond.repo} absent` };
      const ref = git(repoAbs, ['rev-parse', '--verify', '--quiet', `${cond.target}^{commit}`]);
      if (ref.ok && ref.out) return { met: true, evidence: `${cond.repo} ${cond.target} = ${ref.out.slice(0, 12)}` };
      const tree = git(repoAbs, ['ls-tree', '--name-only', 'HEAD', '--', cond.target]);
      if (tree.ok && tree.out) {
        const head = git(repoAbs, ['log', '-1', '--format=%H', 'HEAD', '--', cond.target]);
        return { met: true, evidence: `${cond.repo}:${cond.target} committed at HEAD (last touched ${head.out.slice(0, 12) || '?'})` };
      }
      return { met: false, evidence: `${cond.repo}: ${cond.target} is neither a commit nor committed at HEAD` };
    }
    if (cond.type === 'incident') {
      const row = db.prepare('SELECT status,updated_at FROM incidents WHERE incident_id=?').get(cond.incidentId);
      if (!row) return { met: false, unmeetable: `incident ${cond.incidentId} is gone`, evidence: `${cond.incidentId} absent` };
      return { met: row.status !== 'open', evidence: `${cond.incidentId} ${row.status} at ${iso(row.updated_at)}` };
    }
    if (cond.type === 'foundation') {
      const foundation = readFoundation(db, cond.name);
      if (!foundation) return { met: false, unmeetable: `foundation ${cond.name} is not registered`, evidence: `${cond.name} absent` };
      const evidence = `foundation ${cond.name} ${foundation.state}${foundation.version ? ` ${foundation.version}` : ''}${foundation.owner ? ` (owner ${foundation.owner.workflowId})` : ''}${foundation.landed ? ` landed ${iso(foundation.landed.at)}: ${foundation.landed.proof}` : ''}`;
      return { met: foundation.state === 'landed', evidence };
    }
  } catch (error) {
    return { met: false, evidence: `${conditionLabel(cond)} unreadable: ${String(error?.message ?? error).slice(0, 160)}` };
  }
  return { met: false, evidence: `unknown condition ${JSON.stringify(cond)}` };
}

const kindOf = (lastProgress) => /^\[([^\]]+)\]/.exec(lastProgress ?? '')?.[1] ?? null;

/**
 * The open incidents that carry typed conditions: the latest 'incident-conditions-attached' (api
 * incident --attach) wins over the 'incident-raised' payload. Incidents of finished or archived
 * workflows are left alone. [{incidentId, workflowId, kind, opId, until, since, holds}]
 */
export function typedIncidents(db, { workflowId = null } = {}) {
  const rows = db.prepare(`SELECT i.incident_id,i.workflow_id,i.op_id,i.last_progress,i.updated_at FROM incidents i
      JOIN workflows w ON w.workflow_id=i.workflow_id
     WHERE i.status='open' AND w.phase<>'finished' AND w.archived_at IS NULL ${workflowId ? 'AND i.workflow_id=?' : ''}
     ORDER BY i.updated_at,i.incident_id`).all(...(workflowId ? [workflowId] : []));
  const out = [];
  for (const row of rows) {
    const events = db.prepare(`SELECT kind,payload_json,created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=?
        AND kind IN ('incident-raised',?) ORDER BY seq DESC`).all(row.workflow_id, row.incident_id, CONDITIONS_ATTACHED_EVENT);
    const withUntil = events.find((event) => Array.isArray(parseJson(event.payload_json, {})?.until));
    if (!withUntil) continue;
    const until = parseJson(withUntil.payload_json, {}).until.filter((cond) => cond && UNTIL_TYPES.includes(cond.type));
    if (!until.length) continue;
    const raised = events.find((event) => event.kind === 'incident-raised');
    const raisedPayload = parseJson(raised?.payload_json, {}) ?? {};
    out.push({
      incidentId: row.incident_id, workflowId: row.workflow_id, kind: kindOf(row.last_progress), opId: row.op_id ?? null, until,
      since: raised?.created_at ?? row.updated_at,
      holds: Array.isArray(raisedPayload.holds) && raisedPayload.holds.length ? raisedPayload.holds : [row.op_id].filter(Boolean),
    });
  }
  return out;
}

/** Evaluate every typed incident (optionally of one workflow): [{...incident, results, met, unmeetable}]. */
export function evaluateTypedIncidents(db, { repo, workflowId = null } = {}) {
  return typedIncidents(db, { workflowId }).map((incident) => {
    const results = incident.until.map((cond) => ({ condition: conditionLabel(cond), ...evaluateCondition(db, cond, { repo, workflowId: incident.workflowId, since: incident.since }) }));
    return { ...incident, results, met: results.every((r) => r.met), unmeetable: results.filter((r) => r.unmeetable).map((r) => r.unmeetable) };
  });
}

/**
 * Resolve every typed incident whose conditions all hold. One transaction per incident, guarded on
 * status='open' so two callers never resolve it twice. Returns {resolved, open}: the incidents this
 * call resolved (with evidence) and the evaluations of those still open (for status to project).
 * Never throws: a busy ledger or unreadable condition leaves the incident open for the next tick.
 */
export function autoResolveTypedIncidents(ledger, { repo, workflowId = null, now = Date.now() } = {}) {
  const resolved = [], open = [];
  let evaluated = [];
  try { evaluated = evaluateTypedIncidents(ledger.db, { repo, workflowId }); } catch { return { resolved, open }; }
  for (const incident of evaluated) {
    if (!incident.met) { open.push(incident); continue; }
    const evidence = incident.results.map((r) => `${r.condition}: ${r.evidence}`);
    try {
      let changed = false;
      ledger.transaction(() => {
        changed = ledger.db.prepare("UPDATE incidents SET status='resolved',updated_at=? WHERE incident_id=? AND status='open'")
          .run(now, incident.incidentId).changes > 0;
        if (!changed) return;
        ledger.appendEvent({ workflowId: incident.workflowId, entityType: 'incident', entityId: incident.incidentId, kind: 'incident-resolved',
          payload: { detail: `every typed condition holds: ${evidence.join('; ')}`, by: 'until-conditions', evidence } });
        ledger.appendEvent({ workflowId: incident.workflowId, entityType: 'incident', entityId: incident.incidentId, kind: AUTO_RESOLVED_EVENT,
          payload: { kind: incident.kind, until: incident.until, holds: incident.holds, evidence } });
      });
      if (changed) resolved.push({ incidentId: incident.incidentId, workflowId: incident.workflowId, kind: incident.kind, holds: incident.holds, evidence });
    } catch {
      open.push(incident);
    }
  }
  return { resolved, open };
}

/** The status projection of one still-open typed incident. */
export const gateConditionView = (incident) => ({
  incidentId: incident.incidentId, kind: incident.kind, holds: incident.holds, since: incident.since,
  until: incident.until, conditions: incident.results.map(({ condition, met, evidence, unmeetable }) => ({ condition, met, evidence, ...(unmeetable ? { unmeetable } : {}) })),
  met: incident.met, unmeetable: incident.unmeetable,
});
