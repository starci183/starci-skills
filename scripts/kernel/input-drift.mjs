// input-drift.mjs - compare recorded dispatch inputs with the current Source and Work bytes.
import fs from 'node:fs';
import path from 'node:path';
import { JOB_STATUSES } from '../../engine/db/ledger.mjs';
import { admittedContractOf } from '../machine/contract-version.mjs';
import { changeNoteOf, committedMatches, createOwnership, inside, ownedOf, ownerDeclarationFor, readRecordChanges, workflowCommittedReader } from './work-ownership.mjs';
import { parseJson } from '../lib/json.mjs';
import { byCodeUnit } from '../lib/list.mjs';

export const INPUT_DIGEST_SCHEMA = 'starci/input-digests@1';
export const WORK_PREFIX = '.starciwork/';
const INPUT_KINDS = new Set(['source', 'work']);
const SOURCE_ROOTS = ['knowledge/', 'modules/schemas/'];
const SOURCE_FILES = new Set(['modules/models/code-patterns.yaml']);
const WORK_EXCLUDED_ROOTS = ['.starciwork/kernel-evidence/', '.starciwork/kernel-strays/', '.starciwork/kernel-approvals/'];
export const special = (segment) => /[*{<]/.test(segment);
export const isSourceLaw = (rel) => typeof rel === 'string' && !rel.includes('..')
  && (SOURCE_ROOTS.some((root) => rel.startsWith(root)) || SOURCE_FILES.has(rel));
export const isWorkInput = (rel) => typeof rel === 'string' && rel.startsWith(WORK_PREFIX) && !rel.includes('..')
  && !rel.split('/').some(special) && !WORK_EXCLUDED_ROOTS.some((root) => rel.startsWith(root));
/** The kind of one recorded entry: its own `kind`, or null. */
export const inputKindOf = (entry) => (INPUT_KINDS.has(entry?.kind) ? entry.kind : null);

const cutOf = (payloadJson) => {
  try {
    const cut = JSON.parse(payloadJson ?? 'null')?.cut;
    return cut?.id != null ? { id: cut.id, ordinal: cut.ordinal, total: cut.total } : null;
  } catch { return null; }
};

const lineageStateOf = (jobs, groupOf) => {
  const newest = new Map(), seams = new Map();
  for (const row of jobs) {
    newest.set(groupOf(row), row.job_id);
    const cut = cutOf(row.payload_json);
    if (!cut) continue;
    const key = `${row.op_id}\0${cut.id}`, seam = seams.get(key);
    if (!seam || cut.ordinal < seam.ordinal) seams.set(key, { ordinal: cut.ordinal, open: null });
    const current = seams.get(key);
    if (cut.ordinal === current.ordinal && !JOB_STATUSES.settled.includes(row.status)) current.open = row.job_id;
  }
  const heldBy = (op, cut) => {
    const seam = cut ? seams.get(`${op}\0${cut.id}`) : null;
    return seam?.open && cut.ordinal > seam.ordinal ? seam.open : null;
  };
  return { newest, heldBy };
};

const writerOf = (row) => {
  const payload = parseJson(row.payload_json) ?? {};
  const settledAt = JOB_STATUSES.settled.includes(row.status) ? (Number.isFinite(payload.settledAt) ? payload.settledAt : row.updated_at) : null;
  return { jobId: row.job_id, workflowId: row.workflow_id, status: row.status, owned: ownedOf(payload), settledAt };
};

const peerWriterFinder = (db, workflowId) => {
  let peers;
  return (file, at) => {
    peers ??= db.prepare("SELECT job_id,workflow_id,status,payload_json,updated_at FROM jobs WHERE workflow_id<>? AND kind<>'kernel' AND status<>'queued'").all(workflowId).map(writerOf);
    return [...new Set(peers.filter((writer) => (writer.settledAt == null || writer.settledAt > at) && writer.owned.some((owned) => inside(file, owned))).map((writer) => writer.workflowId))].toSorted(byCodeUnit);
  };
};

const workChangeOf = (row, entry, cut, workDigest, attributed) => {
  if (inputKindOf(entry) !== 'work' || !workDigest || !isWorkInput(entry.path)) return null;
  const base = entry.settled;
  if (!base || typeof base.digest !== 'string') return null;
  const current = workDigest(entry.path);
  if (current === base.digest) return null;
  const fileMap = workDigest.files(entry.path);
  const then = base.files && typeof base.files === 'object' ? base.files : null;
  const changedFiles = then
    ? [...new Set([...Object.keys(then), ...Object.keys(fileMap)])].filter((file) => (fileMap[file]?.slice(0, 16) ?? null) !== (then[file] ?? null)).toSorted(byCodeUnit)
    : [entry.path];
  const at = Number(base.at) || 0;
  const unexplained = changedFiles.filter((file) => !attributed(file, row.job_id, at));
  if (!unexplained.length) return null;
  return { row, cut, entry, base, thenFiles: then, at, current, unexplained };
};

const measureCandidateInputs = ({ row, newest, groupOf, db, digest, workDigest, attributed }) => {
  if (!row.inputs || newest.get(groupOf(row)) !== row.job_id) return { sourceDrift: [], workChanged: [] };
  const record = parseJson(row.inputs);
  if (record?.schema !== INPUT_DIGEST_SCHEMA || !Array.isArray(record.digests)) return { sourceDrift: [], workChanged: [] };
  const cut = cutOf(row.payload_json), sourceDrift = [], workChanged = [];
  let admitted;
  const admittedOf = () => (admitted ??= admittedContractOf(db, row));
  for (const entry of record.digests) {
    if (typeof entry?.path !== 'string' || typeof entry.digest !== 'string' || entry.path.includes('..')) continue;
    if (inputKindOf(entry) === 'source' && isSourceLaw(entry.path)) {
      const current = digest(entry.path);
      if (current !== entry.digest) {
        const admitted = admittedOf();
        sourceDrift.push({ jobId: row.job_id, op: row.op_id, attempt: row.attempt, ...(cut ? { cut } : {}), path: entry.path, kind: 'source',
          recorded: entry.digest, current, admittedAt: Number.isFinite(admitted.at) ? admitted.at : null });
      }
    }
    const work = workChangeOf(row, entry, cut, workDigest, attributed);
    if (work) workChanged.push(work);
  }
  return { sourceDrift, workChanged };
};

const workFileDisposition = ({ file, then, at, base, workflowId, heads, ownerOf, peerWritersOf, textOf, declarationsOf }) => {
  if (heads && committedMatches(heads.get(file) ?? null, then[file] ?? null)) return null;
  const owner = ownerOf(file);
  const writersAfter = peerWritersOf(file, at);
  const note = changeNoteOf(textOf(file));
  const readRev = base.revs?.[file] ?? null;
  const view = { file, owner: owner.workflowId, ownerBy: owner.by, writers: writersAfter, readRev, currentRev: note?.rev ?? null };
  if (owner.workflowId && owner.workflowId !== workflowId) {
    const declared = ownerDeclarationFor(declarationsOf(), file, { owner: owner.workflowId, after: at });
    const noteBreaking = note?.kind === 'breaking' && (readRev != null ? note.rev != null && note.rev > readRev : Number.isFinite(note.at) && note.at > at);
    const byNonOwner = writersAfter.length > 0 && !writersAfter.includes(owner.workflowId);
    const alreadyRead = declared?.digests?.[file] != null && declared.digests[file] === then[file];
    const noteWaived = declared?.reach === 'advisory' && (declared.rev == null || note?.rev == null || note.rev <= declared.rev);
    if (declared?.reach === 'follow-up' && !alreadyRead)
      return { breaking: { file, owner: owner.workflowId, via: 'declaration', ...(declared.rev != null ? { rev: declared.rev } : {}), reason: declared.reason, at: declared.at } };
    if (noteBreaking && !byNonOwner && !noteWaived && !alreadyRead)
      return { breaking: { file, owner: owner.workflowId, via: 'change-note', rev: note.rev } };
    let ignored = null;
    if (noteBreaking && !alreadyRead) ignored = noteWaived ? 'owner-declared-advisory' : 'written-by-non-owner';
    return { drift: { ...view, ...(ignored ? { breakingIgnored: ignored } : {}) } };
  }
  return writersAfter.length ? { drift: { ...view, foreignWrite: true } } : { owed: file };
};

const classifyWorkChanges = ({ workChanged, db, repo, workDir, workflowId, ownership, committed, recordChanges, heldBy, peerWritersOf }) => {
  const stale = [], peerDrift = [];
  const perFile = workChanged.filter((item) => item.thenFiles);
  const ownerOf = perFile.length ? (ownership ?? createOwnership(db, { repo, workDir })) : null;
  let heads = null;
  if (perFile.length && repo) {
    const read = committed === undefined ? workflowCommittedReader({ repo, workDir, workflowId, ownerOf }) : committed;
    heads = read?.(perFile.flatMap((item) => item.unexplained)) ?? null;
  }
  let declarations;
  const declarationsOf = () => (declarations ??= recordChanges ?? readRecordChanges(db));
  const textOf = (file) => {
    if (heads) return heads.get(file)?.toString('utf8') ?? null;
    try { return fs.readFileSync(path.join(repo, workDir, file.slice(WORK_PREFIX.length)), 'utf8'); } catch { return null; }
  };
  for (const change of workChanged) {
    const { row, cut, entry, base, thenFiles: then, at, current, unexplained } = change;
    const item = { jobId: row.job_id, op: row.op_id, attempt: row.attempt, ...(cut ? { cut } : {}), path: entry.path, kind: 'work' };
    if (!then) {
      const held = heldBy(row.op_id, cut);
      stale.push({ ...item, recorded: base.digest, current, changed: unexplained.slice(0, 10), ...(held ? { heldBy: held } : {}) });
      continue;
    }
    const owed = [], breaking = [], drift = [];
    for (const file of unexplained) {
      const disposition = workFileDisposition({ file, then, at, base, workflowId, heads, ownerOf, peerWritersOf, textOf, declarationsOf });
      if (disposition?.owed) owed.push(disposition.owed);
      if (disposition?.breaking) breaking.push(disposition.breaking);
      if (disposition?.drift) drift.push(disposition.drift);
    }
    if (drift.length) peerDrift.push({ ...item, files: drift });
    const changed = [...owed, ...breaking.map((b) => b.file)].toSorted(byCodeUnit);
    if (!changed.length) continue;
    const followUp = owed.length === 0;
    const held = followUp ? null : heldBy(row.op_id, cut);
    stale.push({ ...item, recorded: base.digest, current, changed: changed.slice(0, 10), ...(breaking.length ? { breaking } : {}), ...(followUp ? { followUp: true } : {}), ...(held ? { heldBy: held } : {}) });
  }
  return { stale, peerDrift };
};

export function inputDrift(db, workflowId, { root, repo = null, workDir = '.starciwork', digest, workDigest,
  ownership = null, committed = undefined, recordChanges = null } = {}) {
  const jobs = db.prepare("SELECT job_id,op_id,try_no AS attempt,status,payload_json,created_at,updated_at FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND op_id IS NOT NULL ORDER BY created_at,job_id").all(workflowId);
  const groupOf = (row) => {
    const cut = cutOf(row.payload_json);
    const cutPart = cut ? `${cut.id}\0${cut.ordinal}` : '';
    return `${row.op_id}\0${cutPart}`;
  };
  const { newest, heldBy } = lineageStateOf(jobs, groupOf);
  const writers = jobs.map((row) => writerOf({ ...row, workflow_id: workflowId }));
  const attributed = (file, jobId, at) => writers.some((writer) => (writer.jobId === jobId || writer.settledAt == null || writer.settledAt > at)
    && writer.owned.some((owned) => inside(file, owned)));
  const peerWritersOf = peerWriterFinder(db, workflowId);
  const candidates = db.prepare(`SELECT j.job_id,j.workflow_id,j.op_id,j.try_no AS attempt,j.payload_json,
      CASE WHEN json_valid(c.context_json) THEN json_extract(c.context_json,'$.inputs') END AS inputs
    FROM jobs j JOIN contracts c ON c.attempt_id=(SELECT max(c2.attempt_id) FROM contracts c2 WHERE c2.job_id=j.job_id)
    WHERE j.workflow_id=? AND j.kind<>'kernel' AND (j.status='succeeded' OR (j.status='failed' AND EXISTS(
      SELECT 1 FROM reports r WHERE r.job_id=j.job_id AND r.outcome='partial')))
    ORDER BY j.op_id,j.created_at,j.job_id`).all(workflowId);
  const sourceDrift = [], workChanged = [];
  for (const row of candidates) {
    const measured = measureCandidateInputs({ row, newest, groupOf, db, digest, workDigest, attributed });
    sourceDrift.push(...measured.sourceDrift);
    workChanged.push(...measured.workChanged);
  }
  const { stale, peerDrift } = classifyWorkChanges({ workChanged, db, repo, workDir, workflowId, ownership, committed, recordChanges, heldBy, peerWritersOf });
  const order = (a, b) => (a.op < b.op ? -1 : a.op > b.op ? 1 : 0)
    || (a.cut?.ordinal ?? 0) - (b.cut?.ordinal ?? 0) || a.attempt - b.attempt || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { stale: stale.toSorted(order), sourceDrift: sourceDrift.toSorted(order), peerDrift: peerDrift.toSorted(order) };
}
