// cut-seam.mjs — a cut's seam never stalls the whole chain (owner ruling 2026-09-28: "Seam không làm nghẽn
// cả chuỗi: seam trượt thì tách lại hoặc cho các lát sau chạy song song với stub, không để chờ 3 tiếng").
//
// A cut (driver-loop.yaml enqueue.cutExecution) runs seam-first: ordinal 1 owns the shared seam and the
// other ordinals waited for it to settle succeeded. When the seam failed, queued or sat behind a wait the
// whole cut stalled - nivo wf-nivo-collab-group-chat-mujek7ue held seven backend.implement ordinals for
// more than a day behind seam op-backend.implement-9a2c4c2f03 (attempt 11, queued under a peer-wait).
//
// The contract here is contract-first:
//   - the seam publishes its interface early (`api cut-seam --publish-interface`: the types/contract/stub
//     files it committed, each with its sha256) and every sibling is released at once to build against it;
//   - a sibling is also released - with a stub of its own inside its owned paths - when the seam's latest
//     attempt settled failed/blocked, when the seam slipped `recutAfterFailures` times, when the Kernel
//     released the cut (`api cut-seam --release`), or when it has waited allocation.cutSeam.maxSiblingWaitMs
//     (modules/models/runtimes.yaml) - never longer;
//   - a sibling dispatched before the seam passed carries payload.cut.seamStub and owes ONE light
//     re-verify against the real seam once it lands (`cut-seam-reconcile`, `api cut-seam --reconcile`), not
//     a redo. A stub sibling that settles after the seam passed is reconciled by its own settle checks.
//   - a seam that slipped is re-cut: status names a plan that keeps the feature-local interface paths as
//     the seam and moves the shared-root paths into one wire leg after every ordinal.
// Everything here reads the ledger; the three writers are the api cut-seam CLI's events.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { allocationMs, allocationSettings } from '../../engine/config.mjs';
import { retiredBeforeDispatch } from '../../engine/admission.mjs';
import { parseJson } from '../lib/json.mjs';

export const SEAM_INTERFACE_EVENT = 'seam-interface-published';
export const SEAM_RELEASED_EVENT = 'seam-released';
export const SEAM_RECONCILED_EVENT = 'seam-reconciled';
export const SEAM_RECONCILE_CHECK = 'cut-seam-reconcile';
export const SEAM_PRIORITY_CLASS = 'cut-seam';
/** Why a sibling runs on a stub: the order a release is judged in. */
export const SEAM_STUB_MODES = ['interface', 'released', 'seam-failed', 'seam-slipped', 'timeout', 'kernel-override'];

const FINAL = ['succeeded', 'failed', 'cancelled'];
const payloadOf = (row) => parseJson(row?.payload_json ?? '', {}) ?? {};
const ownedOf = (payload) => (Array.isArray(payload?.owned_paths) ? payload.owned_paths : [])
  .map((p) => (typeof p === 'string' ? p : p?.path)).filter((p) => typeof p === 'string' && p.trim())
  .map((p) => p.replace(/\\/g, '/').replace(/\/\*\*$/, '').replace(/\/+$/, ''));
const within = (file, root) => file === root || file.startsWith(`${root}/`);

/**
 * modules/models/runtimes.yaml allocation.cutSeam: maxSiblingWaitMs (the longest a sibling ordinal waits on
 * its seam before it runs on a stub) and recutAfterFailures (settled failed/blocked seam attempts after
 * which the seam counts as slipped: siblings released, re-cut plan owed).
 */
export function cutSeamSettings() {
  const maxSiblingWaitMs = allocationMs('cutSeam.maxSiblingWaitMs');
  const raw = Number(allocationSettings()?.cutSeam?.recutAfterFailures);
  if (!Number.isInteger(raw) || raw < 1) throw Error('modules/models/runtimes.yaml allocation.cutSeam.recutAfterFailures must declare a positive integer');
  return { maxSiblingWaitMs, recutAfterFailures: raw };
}

/** The priority_json a cut job carries: the seam (ordinal 1 of a cut of more than one) outranks non-seam work. */
export const seamPriorityOf = (cut) => (cut && Number(cut.ordinal) === 1 && Number(cut.total) > 1
  ? { class: SEAM_PRIORITY_CLASS, cutId: String(cut.id), siblings: Number(cut.total) - 1 }
  : null);
export const isSeamCut = (cut) => Boolean(seamPriorityOf(cut));

const cutEvents = (db, { workflowId, op, cutId, kind }) => db.prepare('SELECT seq,entity_id,payload_json,created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq')
  .all(workflowId, kind)
  .map((row) => ({ seq: row.seq, entityId: row.entity_id, at: row.created_at, ...(parseJson(row.payload_json, {}) ?? {}) }))
  .filter((event) => event.op === op && String(event.cutId) === String(cutId));

/**
 * The seam of one cut as the ledger holds it: every ordinal-1 attempt that ran or is still open (a row
 * retired before dispatch is no attempt), the live head (the latest of them), how many settled failed or
 * blocked without an owner wait, the latest published interface and the latest Kernel release.
 */
export function seamStateOf(db, { workflowId, op, cutId, isOwnerWait = () => false }) {
  const rows = db.prepare(`SELECT job_id,workflow_id,op_id,status,attempt,worker_id,payload_json,result_json,created_at,updated_at FROM jobs
    WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')=1 ORDER BY attempt`)
    .all(workflowId, op, String(cutId)).filter((row) => !retiredBeforeDispatch(row));
  const head = rows.at(-1) ?? null;
  const failures = rows.filter((row) => row.status === 'failed' && !isOwnerWait(row)).length;
  const interfaces = cutEvents(db, { workflowId, op, cutId, kind: SEAM_INTERFACE_EVENT });
  const releases = cutEvents(db, { workflowId, op, cutId, kind: SEAM_RELEASED_EVENT });
  const passed = rows.find((row) => row.status === 'succeeded') ?? null;
  return {
    head, rows, failures, passed: Boolean(passed), passedJob: passed?.job_id ?? null, passedAt: passed?.updated_at ?? null,
    dead: Boolean(head && FINAL.includes(head.status) && head.status !== 'succeeded' && !isOwnerWait(head)),
    interface: interfaces.at(-1) ?? null, released: releases.at(-1) ?? null,
  };
}

/**
 * Whether a cut sibling (ordinal > 1) still waits on its seam. Null when it is no sibling, its cut has no
 * seam attempt, or the seam passed (nothing to wait on, nothing stubbed). Otherwise either
 *   {hold: true, seamJobId, seamStatus, releaseAt, detail}   - it waits, at most until releaseAt, or
 *   {hold: false, stub: {mode, seamJobId, seamStatus, since, interface?, reason}} - it runs now on a stub.
 */
export function siblingSeamHold(db, job, { now = Date.now(), settings = null, isOwnerWait = () => false } = {}) {
  const payload = payloadOf(job), cut = payload.cut;
  if (!cut || cut.id == null || !(Number(cut.ordinal) > 1)) return null;
  const op = job.op_id ?? payload.opId;
  const workflowId = job.workflow_id ?? payload.hierarchy?.workflowId;
  const seam = seamStateOf(db, { workflowId, op, cutId: cut.id, isOwnerWait });
  if (!seam.head || seam.passed) return null;
  const { maxSiblingWaitMs, recutAfterFailures } = settings ?? cutSeamSettings();
  const since = Number(job.created_at) || now;
  const base = { seamJobId: seam.head.job_id, seamStatus: seam.head.status, cutId: String(cut.id), op };
  const release = (mode, reason) => ({ hold: false, stub: { mode, ...base, since, reason,
    ...(seam.interface ? { interface: { files: seam.interface.files ?? [], publishedBy: seam.interface.entityId, at: seam.interface.at, summary: seam.interface.summary ?? null } } : {}) } });
  if (seam.interface) return release('interface', `seam ${seam.interface.entityId} published its interface (${(seam.interface.files ?? []).map((f) => f.path).join(', ')}): build against it now`);
  if (seam.released) return release('released', `the Kernel released cut ${cut.id} to run on a stub: ${seam.released.reason ?? ''}`.trim());
  if (seam.dead) return release('seam-failed', `seam ${seam.head.job_id} settled ${seam.head.status} and will not pass on its own: run on a stub while the seam is retried or re-cut`);
  if (seam.failures >= recutAfterFailures) return release('seam-slipped', `seam of cut ${cut.id} failed ${seam.failures} time(s) (allocation.cutSeam.recutAfterFailures ${recutAfterFailures}): run on a stub while the seam is re-cut`);
  const waited = now - since;
  if (waited >= maxSiblingWaitMs) return release('timeout', `waited ${Math.floor(waited / 60_000)} min on seam ${seam.head.job_id} (${seam.head.status}), past allocation.cutSeam.maxSiblingWaitMs ${Math.round(maxSiblingWaitMs / 60_000)} min: run on a stub`);
  return { hold: true, ...base, releaseAt: since + maxSiblingWaitMs,
    detail: `cut ${cut.id} seam ${seam.head.job_id} is ${seam.head.status}; this ordinal waits for it or its published interface at most until ${new Date(since + maxSiblingWaitMs).toISOString()} (allocation.cutSeam.maxSiblingWaitMs), then runs on a stub` };
}

/**
 * The stub stamp a sibling dispatch records on payload.cut.seamStub, or null when its seam passed. A
 * sibling the Kernel dispatches while it is still held runs on a stub too (mode kernel-override).
 */
export function seamStubForDispatch(db, job, options = {}) {
  const hold = siblingSeamHold(db, job, options);
  if (!hold) return null;
  const at = options.now ?? Date.now();
  if (hold.hold) return { mode: 'kernel-override', seamJobId: hold.seamJobId, seamStatus: hold.seamStatus, cutId: hold.cutId, at, reason: 'dispatched while its seam was still open' };
  return { ...hold.stub, at };
}

/**
 * The reconcile duty of one cut: every ordinal > 1 whose latest job succeeded having run on a stub
 * (payload.cut.seamStub). Before the seam passed they are `pending`; after it they are `owed` until a
 * `cut-seam-reconcile` result names them - `green` (exit 0) or `red` (the ordinal is redone). A stub
 * sibling that settled after the seam passed was reconciled by its own settle checks (`bySettle`).
 */
export function seamReconcileOf(db, { workflowId, op, cutId, isOwnerWait = () => false }) {
  const seam = seamStateOf(db, { workflowId, op, cutId, isOwnerWait });
  const rows = db.prepare(`SELECT job_id,status,attempt,payload_json,result_json,updated_at,json_extract(payload_json,'$.cut.ordinal') AS ordinal FROM jobs
    WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')>1 ORDER BY attempt`)
    .all(workflowId, op, String(cutId)).filter((row) => !retiredBeforeDispatch(row));
  const latest = new Map();
  for (const row of rows) latest.set(Number(row.ordinal), row);
  const results = new Map();
  for (const event of cutEvents(db, { workflowId, op, cutId, kind: SEAM_RECONCILED_EVENT })) results.set(event.entityId, event);
  const out = { seamPassed: seam.passed, seamJobId: seam.passedJob ?? seam.head?.job_id ?? null, pending: [], owed: [], green: [], red: [] };
  for (const [ordinal, row] of [...latest.entries()].sort((a, b) => a[0] - b[0])) {
    const stub = payloadOf(row).cut?.seamStub;
    if (!stub || row.status !== 'succeeded') continue;
    const item = { ordinal, jobId: row.job_id, mode: stub.mode };
    const result = results.get(row.job_id);
    if (result) { (Number(result.exitCode) === 0 ? out.green : out.red).push({ ...item, via: result.via ?? 'reconcile', command: result.command ?? null }); continue; }
    if (!seam.passed) { out.pending.push(item); continue; }
    out.owed.push(item);
  }
  return out;
}

/**
 * The re-cut plan of a seam that slipped: keep the seam paths inside the siblings' common feature root
 * (and its .starciwork records) as the smaller seam, move the shared-root paths into ONE wire leg of the
 * same op enqueued --after every ordinal. With nothing to move, the seam is split one path per job.
 */
export function recutPlanOf(db, { workflowId, op, cutId, isOwnerWait = () => false }) {
  const seam = seamStateOf(db, { workflowId, op, cutId, isOwnerWait });
  if (!seam.head || seam.passed) return null;
  const seamPaths = ownedOf(payloadOf(seam.head));
  const siblings = db.prepare(`SELECT payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')>1`)
    .all(workflowId, op, String(cutId)).map((row) => ownedOf(payloadOf(row)).filter((p) => !p.startsWith('.starciwork/'))).filter((list) => list.length);
  const segs = siblings.flat().map((p) => p.split('/'));
  let common = segs.length ? segs[0].slice(0, -1) : [];
  for (const parts of segs) { let i = 0; while (i < common.length && i < parts.length - 1 && common[i] === parts[i]) i += 1; common = common.slice(0, i); }
  const root = common.join('/');
  const keep = seamPaths.filter((p) => p.startsWith('.starciwork/') || (root && within(p, root)));
  const wire = seamPaths.filter((p) => !keep.includes(p));
  const cut = payloadOf(seam.head).cut ?? {};
  const split = wire.length && keep.length
    ? { seam: keep, wire, steps: [
      `api reconcile --job ${seam.head.job_id} --drop --reason "re-cut: seam slipped ${seam.failures}x"` + (seam.head.status === 'queued' ? '' : ' (only while it is queued; a settled seam needs no drop)'),
      `api enqueue --op ${op} --paths ${keep.join(',')} --cut-id ${cutId} --cut-ordinal 1 --cut-total ${cut.total} (the smaller seam: its interface first)`,
      `api enqueue --op ${op} --paths ${wire.join(',')} --after <every ordinal of cut ${cutId}> (ONE wire leg: the shared-root registration once the slices land)`,
    ] }
    : { seam: seamPaths.slice(0, 1), wire: seamPaths.slice(1), steps: [`split the seam one path per job: ${seamPaths.join(', ')} - publish the interface file first (api cut-seam --publish-interface)`] };
  return { cutId: String(cutId), op, seamJobId: seam.head.job_id, failures: seam.failures, featureRoot: root || null, ...split };
}

/**
 * Validate and digest the interface files a seam publishes: each must sit inside the seam job's owned
 * paths and exist in the repository (or the checkout a qualified owned path names). [{path, sha256, bytes}].
 */
export function digestInterfaceFiles({ repo, payload, files }) {
  const owned = ownedOf(payload);
  const out = [];
  for (const raw of files) {
    const file = String(raw).replace(/\\/g, '/').replace(/^\.\//, '');
    if (!file || path.isAbsolute(file) || file.split('/').includes('..')) throw Object.assign(new Error(`seam interface file ${raw} is not a workspace-relative path`), { code: 'seam-interface-path-invalid' });
    if (!owned.some((root) => within(file, root))) throw Object.assign(new Error(`seam interface file ${file} is outside the seam's owned paths (${owned.join(', ')})`), { code: 'seam-interface-outside-seam' });
    const abs = path.resolve(repo, file);
    let bytes;
    try { bytes = fs.readFileSync(abs); } catch { throw Object.assign(new Error(`seam interface file ${file} is missing in ${repo}: commit it before publishing`), { code: 'seam-interface-file-missing' }); }
    out.push({ path: file, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
  }
  return out;
}

/** The op-prompt lines for a cut job: the seam's contract-first duty, or a sibling's stub-first duty. */
export function seamPromptLines({ cut, jobLabel, api = 'scripts/kernel/api.mjs', repoLabel = '<target-repo>' }) {
  if (!cut) return [];
  if (isSeamCut(cut)) {
    return [
      `seam: you are ordinal 1 of cut ${cut.id} - ${Number(cut.total) - 1} sibling ordinal(s) build on you. CONTRACT FIRST: author and commit the seam's interface (types, DTOs, ports/contracts, a stub implementation) before anything else, then publish it:`,
      `  node ${api} cut-seam --repo ${repoLabel} --publish-interface --job ${jobLabel} --files <committed interface files, csv> --summary "<one line>"`,
      `  every sibling is released to build against it at once; then finish the seam. Keep the published signatures stable - a change after publishing owes the siblings a reconcile.`,
    ];
  }
  const stub = cut.seamStub;
  if (!stub) return [];
  const files = stub.interface?.files?.map((f) => f.path).join(', ');
  return [
    `seam: STUB-FIRST - cut ${cut.id}'s seam ${stub.seamJobId} (ordinal 1) has not landed (${stub.seamStatus}; release ${stub.mode}). Do not wait for it and never edit its paths:`,
    files
      ? `  build against its published interface (${files}); read it, do not change it.`
      : `  no interface is published: write the minimal stub of what you need from the seam INSIDE your owned paths (a local port/type/fake), named so the real seam replaces it.`,
    `  list every seam assumption in your report as seamAssumptions [{symbol, file, assumption}]. When the seam lands the Kernel re-verifies this slice against it (${SEAM_RECONCILE_CHECK}) - a light re-check, not a redo.`,
  ];
}
