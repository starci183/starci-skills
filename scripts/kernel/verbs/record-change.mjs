// starci kernel record-change: split from cli.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { getWorkflow, workDirOf, workflowRunning } from './shared/rows.mjs';
import { createWorkDigester, inputDrift, isWorkInput } from '../input-digests.mjs';
import { RECORD_CHANGE_REACHES, changeNoteOf, committedMatches, committedReader, createOwnership, readRecordChange, writeRecordChange } from '../work-ownership.mjs';
import { normWork } from '../../lib/path-key.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { RECORD_CHANGE_REFUSED } from '../dependency-graph.mjs';
import { workflowWorktreeOf } from '../../machine/workflow-tree.mjs';

const recordRevs = (tree, workDir, keys) => keys.map((file) => { try { return changeNoteOf(fs.readFileSync(path.join(tree, workDir, file.slice('.starciwork/'.length)), 'utf8'))?.rev ?? null; } catch { return null; } }).filter((rev) => rev != null);

function recordChangeReachOf(args) {
  const reach = String(args.reach ?? '').trim();
  if (!RECORD_CHANGE_REACHES.includes(reach)) throw Object.assign(new Error(`--reach must be ${RECORD_CHANGE_REACHES.join('|')}, got '${reach}'`), { code: 'record-change-reach-invalid' });
  return reach;
}

function recordChangeReasonOf(args) {
  const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
  if (!reason) throw Object.assign(new Error('record-change needs --reason <what the change withdraws or replaces, and why>'), { code: 'record-change-reason-missing' });
  return reason;
}

function recordChangeRecordOf(args) {
  const record = normWork(args.record);
  if (!isWorkInput(record)) throw Object.assign(new Error(`--record must name a .starciwork record (a record directory or file, no glob), got '${args.record}'`), { code: 'record-change-record-invalid' });
  return record;
}

// The refusal is a cross-workflow dependency the Supervisor reads (dependency-graph.mjs record-owner edges).
const refuseForeignOwners = (ledger, { workflowId, record, reach, foreign }) => {
  try { ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: RECORD_CHANGE_REFUSED,
    payload: { record, reach, owners: foreign.slice(0, 20).map((o) => ({ file: o.file, workflowId: o.workflowId ?? null, by: o.by })) } })); } catch { /* the refusal stands either way */ }
  const detail = foreign.slice(0, 5).map((owner) => {
    const note = owner.detail ? `: ${owner.detail}` : '';
    return `${owner.file} is owned by ${owner.workflowId ?? '-'} (${owner.by}${note})`;
  }).join('; ');
  throw Object.assign(new Error(`${workflowId} does not own ${foreign.length} record file(s) of ${record}: ${detail}; only a record's owner declares its change (tell the owner with starci kernel notify --kind request)`), { code: 'record-change-not-owner', owners: foreign });
};

// Who now owes a follow-up: the settled jobs of every other live workflow that read an older revision.
const followUpOwed = (db, { workflowId, skillRoot, repo, workDir, ownerOf, keys }) => {
  const owes = [];
  for (const peer of db.prepare('SELECT * FROM workflows ORDER BY created_at').all().filter((row) => row.workflow_id !== workflowId && workflowRunning(row))) {
    try {
      for (const item of inputDrift(db, peer.workflow_id, { root: skillRoot, repo, workDir, ownership: ownerOf }).stale) {
        if ((item.breaking ?? []).some((b) => b.via === 'declaration' && keys.includes(b.file))) owes.push({ workflowId: peer.workflow_id, jobId: item.jobId, op: item.op, attempt: item.attempt, ...(item.cut ? { cut: item.cut } : {}) });
      }
    } catch { /* a peer's projection failure never refuses the declaration */ }
  }
  return owes;
};

export default {
  verb: 'record-change',
  required: ['workflow', 'record', 'reach', 'reason'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const workflowId = args.workflow;
    const db = ledger.db;
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    if (!workflowRunning(wf)) {
      const state = wf.archived_at != null ? 'archived' : `phase ${wf.phase ?? 'unset'}`;
      throw Object.assign(new Error(`workflow ${workflowId} is ${state}; only a running workflow declares a change to a record it owns`), { code: 'workflow-not-running' });
    }
    const reach = recordChangeReachOf(args);
    const reason = recordChangeReasonOf(args);
    const record = recordChangeRecordOf(args);
    // The owner's records live in its workflow worktree (WFWT2 2.8): read and judge them there, committed at its branch.
    const workDir = workDirOf(repo), tree = workflowWorktreeOf({ env: process.env }, workflowId)?.path ?? repo;
    const files = createWorkDigester(tree, { workDir }).files(record);
    const keys = Object.keys(files).sort(byCodeUnit);
    if (!keys.length) throw Object.assign(new Error(`${record} holds no record file (index.yaml/resource.yaml) in ${tree}`), { code: 'record-change-record-missing' });
    const ownerOf = createOwnership(db, { repo, workDir });
    const foreign = keys.map((file) => ({ file, ...ownerOf(file) })).filter((o) => o.workflowId !== workflowId);
    if (foreign.length) refuseForeignOwners(ledger, { workflowId, record, reach, foreign });
    const heads = committedReader(tree, { workDir })(keys);
    const inFlight = heads ? keys.filter((file) => !committedMatches(heads.get(file) ?? null, files[file].slice(0, 16))) : [];
    if (inFlight.length) {
      throw Object.assign(new Error(`${inFlight.length} record file(s) of ${record} differ from their committed revision (${inFlight.slice(0, 5).join(', ')}): the runtime commits a record when the op that wrote it settles green (its checkpoint); declare after that - only a committed revision is declared`), { code: 'record-change-uncommitted', files: inFlight });
    }
    const revs = recordRevs(tree, workDir, keys);
    const now = Date.now();
    const owner = ownerOf(keys[0]);
    const entry = { reach, reason, at: now, by: workflowId, ownerBy: owner.by, ...(revs.length ? { rev: Math.max(...revs) } : {}),
      digests: Object.fromEntries(keys.map((file) => [file, files[file].slice(0, 16)])) };
    ledger.transaction(() => {
      writeRecordChange(db, { record, entry, now });
      ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'record-change-declared',
        payload: { record, reach, reason, rev: entry.rev ?? null, files: keys.length } });
    });
    const owes = reach === 'follow-up' ? followUpOwed(db, { workflowId, skillRoot: internals.skillRoot, repo, workDir, ownerOf, keys }) : [];
    const history = readRecordChange(db, record)?.history ?? [];
    const out = { ok: true, workflowId, record, reach, reason, rev: entry.rev ?? null, files: keys, owner: { workflowId, by: owner.by, detail: owner.detail ?? null }, declarations: history.length, owes };
    const revNote = entry.rev != null ? `, rev ${entry.rev}` : '';
    const owesList = owes.map((o) => `${o.jobId} (${o.workflowId})`).join(', ') || 'no settled peer job';
    const owesNote = reach === 'follow-up' ? `; owes ONE follow-up leg to ${owesList}` : '; peers read it as advisory peerDrift';
    emit(out, `record-change ${record} (${keys.length} file(s)${revNote}) reach ${reach} by owner ${workflowId} (${owner.by})${owesNote}`, args.json);
  },
};
