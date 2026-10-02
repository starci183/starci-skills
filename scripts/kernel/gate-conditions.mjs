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
//                                              --land; scripts/kernel/foundation-registry.mjs)
//   --until-landed <workflowId>@<repository>   that workflow's product work reached <repository> main: it
//                                              landed there at its finish (workflow-landed: a workflow lands
//                                              into main once, at api finish, workflow-checkpoint.mjs) (a
//                                              cross-workflow hold on a restructure, e.g. a product's frontend
//                                              legs held until its canon workflow lands into the frontend repo)
//
// Owner-only conditions (an ask answered, a consent given) have no typed form: the owner drives them.

import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { lsTree } from '../api/git/ls-tree.mjs';
import { log as gitLog } from '../api/git/log.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { normalizeFoundationName, readFoundation } from './foundation-registry.mjs';
import { parseJson } from '../lib/json.mjs';
import { isoOr } from '../lib/time.mjs';
import { RETRYABLE_JOB_STATUSES, retiredBeforeDispatch } from '../../engine/admission.mjs';
import { resolveIncident } from '../../engine/db/ledger.mjs';
import { jobResultSql } from '../machine/job-row.mjs';

const UNTIL_TYPES = Object.freeze(['record', 'job', 'message', 'commit', 'incident', 'foundation', 'landed']);
const repoMatches = (repoRoot, want) => {
  if (!repoRoot || !want) return false;
  const norm = (p) => path.resolve(String(p)).replace(/[\\/]+$/, '').toLowerCase();
  return path.isAbsolute(want) ? norm(repoRoot) === norm(want) : path.basename(norm(repoRoot)) === String(want).toLowerCase();
};
export const UNTIL_FLAGS = Object.freeze(UNTIL_TYPES.map((type) => `until-${type}`));
const AUTO_RESOLVED_EVENT = 'incident-auto-resolved';
export const CONDITIONS_ATTACHED_EVENT = 'incident-conditions-attached';
const JOB_WANTS = ['settled', 'succeeded'];
// A settled pass or fail meets `settled`; a cancelled job is followed to its replacement.
const SETTLED = ['succeeded', 'failed'];
const MAX_LINEAGE_HOPS = 32;
// A job row: `attempt` = its try number (per unit), `result_json` = its settle result (machine/job-row.mjs jobResultSql).
const JOB_COLS = `job_id,workflow_id,op_id,unit_id,try_no,try_no AS attempt,retry_of,resume_of,status,payload_json,${jobResultSql('jobs')} AS result_json,worker_id,created_at,updated_at`;
const cutOfRow = (row) => parseJson(row?.payload_json, {})?.cut ?? null;
/** `row` with the lineage columns (retry_of, resume_of, unit_id, created_at): itself, or re-read by id. */
const withLineage = (db, row) => (row && 'retry_of' in row && 'resume_of' in row && 'unit_id' in row && row.created_at != null ? row
  : db.prepare(`SELECT ${JOB_COLS} FROM jobs WHERE job_id=?`).get(row?.job_id) ?? row);
/**
 * The job that took a cancelled job's place: the earliest later job (created after it) of the same workflow and op
 * that resumes or retries it (jobs.resume_of / retry_of - graph-edit undo re-enqueues a dropped unit resume_of it),
 * is the next try of the same unit, holds the same cut ordinal, or (uncut) retries the same predecessor. Null while
 * no such job exists.
 */
function replacementOf(db, cancelledRow) {
  const cancelled = withLineage(db, cancelledRow);
  const cut = cutOfRow(cancelled), before = cancelled.retry_of ?? null;
  const later = db.prepare(`SELECT ${JOB_COLS} FROM jobs WHERE workflow_id=? AND op_id IS ? AND job_id<>? AND created_at>=? ORDER BY created_at,job_id`)
    .all(cancelled.workflow_id, cancelled.op_id ?? null, cancelled.job_id, Number(cancelled.created_at) || 0);
  return later.find((row) => row.resume_of === cancelled.job_id || row.retry_of === cancelled.job_id)
    ?? later.find((row) => cancelled.unit_id && row.unit_id === cancelled.unit_id && Number(row.try_no) > Number(cancelled.try_no))
    ?? later.find((row) => {
      const c = cutOfRow(row);
      if (cut) return c && c.id === cut.id && Number(c.ordinal) === Number(cut.ordinal);
      return !c && before && row.retry_of === before;
    })
    ?? null;
}
/**
 * The retry that took a failed job's place: the earliest job whose lineage names it (jobs.retry_of, or resume_of for
 * a resumed try). A retry retired before it dispatched (engine/admission.mjs retiredBeforeDispatch) ran nothing and
 * is no successor. Null while the Kernel has not retried it.
 */
export function retryAttemptOf(db, failed) {
  return db.prepare(`SELECT ${JOB_COLS} FROM jobs WHERE workflow_id=? AND (retry_of=? OR resume_of=?) ORDER BY created_at,job_id`)
    .all(failed.workflow_id, failed.job_id, failed.job_id)
    .find((row) => !retiredBeforeDispatch(row)) ?? null;
}
/**
 * The live head of a job's retry lineage - the newest attempt of the same unit of work. A cancelled
 * job is followed to its replacement and a failed one to its retry, hop by hop. A wait on a job
 * (--until-job, --after) is a wait on that unit, so it follows the head: sn-subscription
 * inc-da9c2be0115a waited 2h on learn-content fa50f7be16, which had settled failed while its retry
 * 77798b1b10 was queued, and --after dependants were dropped and re-enqueued by hand after every
 * failed attempt they named. Returns {row, via: [{jobId, status}]}; `row` is the job itself when it
 * has no successor (still open, succeeded, or failed/cancelled with no retry yet).
 */
export function lineageHeadOf(db, start) {
  let row = start;
  const via = [];
  while (via.length < MAX_LINEAGE_HOPS && (row.status === 'cancelled' || RETRYABLE_JOB_STATUSES.includes(row.status))) {
    const next = row.status === 'cancelled' ? replacementOf(db, row) : retryAttemptOf(db, row);
    if (!next) break;
    via.push({ jobId: row.job_id, status: row.status });
    row = next;
  }
  return { row, via };
}
/** lineageHeadOf by id: null when no such job exists. */
export function lineageHeadById(db, jobId) {
  const row = db.prepare(`SELECT ${JOB_COLS} FROM jobs WHERE job_id=?`).get(jobId);
  return row ? lineageHeadOf(db, row) : null;
}
const PEER_MESSAGE = 'peer-message';
const GIT_TIMEOUT_MS = 10_000;

const invalid = (detail) => Object.assign(new Error(detail), { code: 'until-invalid' });
const iso = (ms) => isoOr(ms, '?');

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
  if (type === 'landed') {
    const at = spec.lastIndexOf('@');
    if (at <= 0 || at === spec.length - 1) throw invalid(`--until-landed ${spec}: the form is <workflowId>@<repository> (a repository name like my-app, or its path)`);
    return { type, workflowId: spec.slice(0, at).trim(), repository: spec.slice(at + 1).trim() };
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
    if (cond.type === 'landed' && (cond.workflowId === workflowId || !db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(cond.workflowId))) {
      throw Object.assign(new Error(`--until-landed names no other workflow ${cond.workflowId} in this ledger`), { code: 'until-landed-workflow-unknown' });
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
    case 'landed': return `${cond.workflowId} landed into ${cond.repository} main`;
    default: return JSON.stringify(cond);
  }
};

const git = (call, repo, args) => {
  const r = call(args, { dir: repo, timeout: GIT_TIMEOUT_MS });
  return { ok: r.status === 0, out: String(r.stdout ?? '').trim(), err: String(r.stderr ?? r.error?.message ?? '').trim() };
};
/**
 * A record's OWN revision, the way the work-record schemas define it: the top-level `rev` where the
 * family declares one (work/brand@1, work/layout-tree@1), otherwise the latest change
 * entry's `change.rev` (every work record: ui-screen, contract, feature, ...). A nested object's `rev`
 * is a BINDING to another record, never this record's revision - ui-screen `brand.rev` / `shell.rev` /
 * `shell.layouts[].rev`, layout-tree `nodes[].rev`, contract `blockedBy[].rev` / `conflictsWith[].rev`
 * - so nothing below the top level is read except `change` (an app-layout record at
 * change rev 6 never met `>=6`, its evidence read rev=-).
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
      // The wait follows the job's retry lineage (lineageHeadOf): a cancelled job was dropped or
      // re-planned, never settled (nivo auth inc-7c46a61faba1 released on a cancel of
      // op-backend.implement-3156a882e8), and a failed job with a retry is not the unit's last word.
      const head = lineageHeadById(db, cond.jobId);
      if (!head) return { met: false, unmeetable: `job ${cond.jobId} is gone`, evidence: `${cond.jobId} absent` };
      const { row, via } = head;
      const chain = via.map((hop) => `${hop.jobId} ${hop.status}`).join(' -> ');
      if (row.status === 'cancelled') return { met: false, evidence: `${chain ? `${chain} -> ` : ''}${row.job_id} cancelled; no replacement job in its lineage yet` };
      const evidence = `${chain ? `${chain}, replaced by ` : ''}${row.job_id} (${row.workflow_id}) ${row.status} at ${iso(row.updated_at)}`;
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
      const ref = git(revParseQuery, repoAbs, ['--verify', '--quiet', `${cond.target}^{commit}`]);
      if (ref.ok && ref.out) return { met: true, evidence: `${cond.repo} ${cond.target} = ${ref.out.slice(0, 12)}` };
      const tree = git(lsTree, repoAbs, ['--name-only', 'HEAD', '--', cond.target]);
      if (tree.ok && tree.out) {
        const head = git(gitLog, repoAbs, ['-1', '--format=%H', 'HEAD', '--', cond.target]);
        return { met: true, evidence: `${cond.repo}:${cond.target} committed at HEAD (last touched ${head.out.slice(0, 12) || '?'})` };
      }
      return { met: false, evidence: `${cond.repo}: ${cond.target} is neither a commit nor committed at HEAD` };
    }
    if (cond.type === 'incident') {
      const row = db.prepare('SELECT status,updated_at FROM incidents WHERE incident_id=?').get(cond.incidentId);
      if (!row) return { met: false, unmeetable: `incident ${cond.incidentId} is gone`, evidence: `${cond.incidentId} absent` };
      return { met: row.status !== 'open', evidence: `${cond.incidentId} ${row.status} at ${iso(row.updated_at)}` };
    }
    if (cond.type === 'landed') {
      const wf = db.prepare('SELECT phase,archived_at FROM workflows WHERE workflow_id=?').get(cond.workflowId);
      if (!wf) return { met: false, unmeetable: `workflow ${cond.workflowId} is gone`, evidence: `${cond.workflowId} absent` };
      if (wf.phase === 'finished') return { met: true, evidence: `${cond.workflowId} finished` };
      const land = db.prepare("SELECT payload_json,created_at FROM events WHERE workflow_id=? AND kind='workflow-landed' ORDER BY seq DESC").all(cond.workflowId)
        .find((row) => repoMatches(parseJson(row.payload_json, {})?.repoRoot, cond.repository));
      if (!land) return { met: false, evidence: `${cond.workflowId} has not landed into ${cond.repository} yet (phase ${wf.phase ?? '-'})` };
      return { met: true, evidence: `${cond.workflowId} landed into ${cond.repository} main at ${iso(land.created_at)} (${String(parseJson(land.payload_json, {})?.head ?? '').slice(0, 12) || '-'})` };
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

const SHARED_BLOCKER_ROUTED = 'shared-blocker-routed';
// Job ids are op-<op>-<10 hex> (api enqueue).
const JOB_ID_RE = /\bop-[a-z][a-z0-9.-]*?-[0-9a-f]{10}\b/gi;
/**
 * The typed release of a shared blocker routed to workflow `to`: the reporter waits on the job of `to`
 * that owns the repair - succeeded, through its retry lineage. Candidates are the jobs of `to` that the
 * blocker text names plus `ownerJobs` (routing adds the open jobs of `to` owning a file the introducing
 * commit changed); each is taken at its lineage head, and a head that had already succeeded before the
 * blocker was raised (`since`) is the introducer, not the repair. With no such job the release is the
 * introducer's reply (the follow-up asks it to notify the reporter). One blocker
 * was routed to its peer workflow, named that peer's queued owner job, and still sat
 * untyped on the supervisor as OWED.
 */
export function sharedBlockerUntil(db, { to, text = '', since = 0, ownerJobs = [] }) {
  if (!to) return [];
  const heads = new Map();
  for (const jobId of new Set([...(String(text).match(JOB_ID_RE) ?? []), ...ownerJobs])) {
    const head = lineageHeadById(db, jobId)?.row;
    if (!head || head.workflow_id !== to) continue;
    if (head.status === 'succeeded' && Number(head.updated_at) <= Number(since)) continue;
    if (head.status === 'cancelled') continue;
    heads.set(head.job_id, head);
  }
  return heads.size
    ? [...heads.keys()].map((jobId) => ({ type: 'job', jobId, want: 'succeeded' }))
    : [{ type: 'message', peer: to, kind: 'reply' }];
}

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
        AND kind IN ('incident-raised',?,?) ORDER BY seq DESC`).all(row.workflow_id, row.incident_id, CONDITIONS_ATTACHED_EVENT, SHARED_BLOCKER_ROUTED);
    const raised = events.find((event) => event.kind === 'incident-raised');
    const withUntil = events.find((event) => Array.isArray(parseJson(event.payload_json, {})?.until));
    let until = withUntil ? parseJson(withUntil.payload_json, {}).until : null;
    // A shared blocker routed before its routing typed the wait: derive the same release now.
    if (!until && kindOf(row.last_progress) === 'shared-blocker') {
      const routed = events.find((event) => event.kind === SHARED_BLOCKER_ROUTED && parseJson(event.payload_json, {})?.routed === true);
      if (routed) {
        until = sharedBlockerUntil(db, { to: parseJson(routed.payload_json, {}).to, text: String(row.last_progress ?? ''),
          since: raised?.created_at ?? row.updated_at });
      }
    }
    until = (until ?? []).filter((cond) => cond && UNTIL_TYPES.includes(cond.type));
    if (!until.length) continue;
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
        changed = resolveIncident(ledger.db, { incidentId: incident.incidentId, reason: 'fixed', at: now });
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
