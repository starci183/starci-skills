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

const settledAtOf = (row, payload) => {
  if (!JOB_STATUSES.settled.includes(row.status)) return null;
  return Number.isFinite(payload.settledAt) ? payload.settledAt : row.updated_at;
};

const writerOf = (row) => {
  const payload = parseJson(row.payload_json) ?? {};
  const settledAt = settledAtOf(row, payload);
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
  const recordedFiles = base.files && typeof base.files === 'object' ? base.files : null;
  const changedFiles = recordedFiles
    ? [...new Set([...Object.keys(recordedFiles), ...Object.keys(fileMap)])].filter((file) => (fileMap[file]?.slice(0, 16) ?? null) !== (recordedFiles[file] ?? null)).toSorted(byCodeUnit)
    : [entry.path];
  const at = Number(base.at) || 0;
  const unexplained = changedFiles.filter((file) => !attributed(file, row.job_id, at));
  if (!unexplained.length) return null;
  return { row, cut, entry, base, thenFiles: recordedFiles, at, current, unexplained };
};

/** The source-law drift of one recorded entry (its current digest differs from the recorded one), or null. */
const sourceDriftOf = ({ row, entry, cut, digest, admittedOf }) => {
  if (inputKindOf(entry) !== 'source' || !isSourceLaw(entry.path)) return null;
  const current = digest(entry.path);
  if (current === entry.digest) return null;
  const admitted = admittedOf();
  return { jobId: row.job_id, op: row.op_id, attempt: row.attempt, ...(cut ? { cut } : {}), path: entry.path, kind: 'source',
    recorded: entry.digest, current, admittedAt: Number.isFinite(admitted.at) ? admitted.at : null };
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
    const source = sourceDriftOf({ row, entry, cut, digest, admittedOf });
    if (source) sourceDrift.push(source);
    const work = workChangeOf(row, entry, cut, workDigest, attributed);
    if (work) workChanged.push(work);
  }
  return { sourceDrift, workChanged };
};

/** Whether the change note is breaking for a reader of `readRev` (or, unversioned, written after `at`). */
const noteBreaksReader = (note, readRev, at) => note?.kind === 'breaking'
  && (readRev != null ? note.rev != null && note.rev > readRev : Number.isFinite(note.at) && note.at > at);

/** Whether the owner's advisory declaration waives the change note. */
const declarationWaivesNote = (declared, note) => declared?.reach === 'advisory'
  && (declared.rev == null || note?.rev == null || note.rev <= declared.rev);

/** The disposition of a file another workflow owns: a breaking declaration or note, or peer drift. */
const foreignOwnedDisposition = ({ file, owner, note, readRev, view, writersAfter, recordedFiles, at, declarationsOf }) => {
  const declared = ownerDeclarationFor(declarationsOf(), file, { owner: owner.workflowId, after: at });
  const noteBreaking = noteBreaksReader(note, readRev, at);
  const byNonOwner = writersAfter.length > 0 && !writersAfter.includes(owner.workflowId);
  const alreadyRead = declared?.digests?.[file] != null && declared.digests[file] === recordedFiles[file];
  const noteWaived = declarationWaivesNote(declared, note);
  if (declared?.reach === 'follow-up' && !alreadyRead)
    return { breaking: { file, owner: owner.workflowId, via: 'declaration', ...(declared.rev != null ? { rev: declared.rev } : {}), reason: declared.reason, at: declared.at } };
  if (noteBreaking && !byNonOwner && !noteWaived && !alreadyRead)
    return { breaking: { file, owner: owner.workflowId, via: 'change-note', rev: note.rev } };
  let ignored = null;
  if (noteBreaking && !alreadyRead) ignored = noteWaived ? 'owner-declared-advisory' : 'written-by-non-owner';
  return { drift: { ...view, ...(ignored ? { breakingIgnored: ignored } : {}) } };
};

const workFileDisposition = ({ file, recordedFiles, at, base, workflowId, heads, ownerOf, peerWritersOf, textOf, declarationsOf }) => {
  if (heads && committedMatches(heads.get(file) ?? null, recordedFiles[file] ?? null)) return null;
  const owner = ownerOf(file);
  const writersAfter = peerWritersOf(file, at);
  const note = changeNoteOf(textOf(file));
  const readRev = base.revs?.[file] ?? null;
  const view = { file, owner: owner.workflowId, ownerBy: owner.by, writers: writersAfter, readRev, currentRev: note?.rev ?? null };
  if (owner.workflowId && owner.workflowId !== workflowId)
    return foreignOwnedDisposition({ file, owner, note, readRev, view, writersAfter, recordedFiles, at, declarationsOf });
  return writersAfter.length ? { drift: { ...view, foreignWrite: true } } : { owed: file };
};

/** The files' dispositions split into the owed files, the breaking entries and the peer-drift entries. */
const partitionDispositions = (files, dispositionOf) => {
  const owed = [], breaking = [], drift = [];
  for (const file of files) {
    const disposition = dispositionOf(file);
    if (disposition?.owed) owed.push(disposition.owed);
    if (disposition?.breaking) breaking.push(disposition.breaking);
    if (disposition?.drift) drift.push(disposition.drift);
  }
  return { owed, breaking, drift };
};

/** The stale entry and peer-drift entry (each or null) one changed Work input yields. */
const classifyWorkChange = (change, { heldBy, dispositionOf }) => {
  const { row, cut, entry, base, thenFiles: recordedFiles, at, current, unexplained } = change;
  const item = { jobId: row.job_id, op: row.op_id, attempt: row.attempt, ...(cut ? { cut } : {}), path: entry.path, kind: 'work' };
  if (!recordedFiles) {
    const held = heldBy(row.op_id, cut);
    return { stale: { ...item, recorded: base.digest, current, changed: unexplained.slice(0, 10), ...(held ? { heldBy: held } : {}) }, peerDrift: null };
  }
  const { owed, breaking, drift } = partitionDispositions(unexplained, (file) => dispositionOf({ file, recordedFiles, at, base }));
  const peerDrift = drift.length ? { ...item, files: drift } : null;
  const changed = [...owed, ...breaking.map((b) => b.file)].toSorted(byCodeUnit);
  if (!changed.length) return { stale: null, peerDrift };
  const followUp = owed.length === 0;
  const held = followUp ? null : heldBy(row.op_id, cut);
  return { stale: { ...item, recorded: base.digest, current, changed: changed.slice(0, 10), ...(breaking.length ? { breaking } : {}), ...(followUp ? { followUp: true } : {}), ...(held ? { heldBy: held } : {}) }, peerDrift };
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
  const dispositionOf = (args) => workFileDisposition({ ...args, workflowId, heads, ownerOf, peerWritersOf, textOf, declarationsOf });
  for (const change of workChanged) {
    const classified = classifyWorkChange(change, { heldBy, dispositionOf });
    if (classified.peerDrift) peerDrift.push(classified.peerDrift);
    if (classified.stale) stale.push(classified.stale);
  }
  return { stale, peerDrift };
};

/** -1, 1 or 0 by `<` and `>` (0 when the values are equal or unordered). */
const compareValues = (a, b) => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

// The `inputs` of a contract's context, as the JSON text json_extract gave: read in JS because the context column may hold a reference to its content (engine/db/ref-value.mjs).
const inputsOf = (context) => {
  let inputs = null;
  try { inputs = JSON.parse(context ?? 'null')?.inputs ?? null; } catch { inputs = null; }
  return inputs !== null && typeof inputs === 'object' ? JSON.stringify(inputs) : inputs;
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
      c.context_json
    FROM jobs j JOIN contracts c ON c.attempt_id=(SELECT max(c2.attempt_id) FROM contracts c2 WHERE c2.job_id=j.job_id)
    WHERE j.workflow_id=? AND j.kind<>'kernel' AND (j.status='succeeded' OR (j.status='failed' AND EXISTS(
      SELECT 1 FROM reports r WHERE r.job_id=j.job_id AND r.outcome='partial')))
    ORDER BY j.op_id,j.created_at,j.job_id`).all(workflowId).map(({ context_json: context, ...row }) => ({ ...row, inputs: inputsOf(context) }));
  const sourceDrift = [], workChanged = [];
  for (const row of candidates) {
    const measured = measureCandidateInputs({ row, newest, groupOf, db, digest, workDigest, attributed });
    sourceDrift.push(...measured.sourceDrift);
    workChanged.push(...measured.workChanged);
  }
  const { stale, peerDrift } = classifyWorkChanges({ workChanged, db, repo, workDir, workflowId, ownership, committed, recordChanges, heldBy, peerWritersOf });
  const order = (a, b) => compareValues(a.op, b.op)
    || (a.cut?.ordinal ?? 0) - (b.cut?.ordinal ?? 0) || a.attempt - b.attempt || compareValues(a.path, b.path);
  return { stale: stale.toSorted(order), sourceDrift: sourceDrift.toSorted(order), peerDrift: peerDrift.toSorted(order) };
}
