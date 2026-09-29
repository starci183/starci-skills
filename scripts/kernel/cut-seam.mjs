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
import { fileURLToPath } from 'node:url';
import { allocationMs, allocationSettings } from '../../engine/config.mjs';
import { retiredBeforeDispatch } from '../../engine/admission.mjs';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { parseJson } from '../lib/json.mjs';
import { jobResultSql } from './api-lib/rows.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';

export const SEAM_INTERFACE_EVENT = 'seam-interface-published';
export const SEAM_RELEASED_EVENT = 'seam-released';
export const SEAM_RECONCILED_EVENT = 'seam-reconciled';
export const SEAM_RECONCILE_CHECK = 'cut-seam-reconcile';
export const SEAM_PRIORITY_CLASS = 'cut-seam';
/** Why a sibling runs on a stub: the order a release is judged in. */
export const SEAM_STUB_MODES = ['interface', 'released', 'seam-failed', 'seam-slipped', 'timeout', 'kernel-override'];

const FINAL = SETTLED_JOB_LIST;
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
  const rows = db.prepare(`SELECT job_id,workflow_id,op_id,status,try_no AS attempt,worker_id,payload_json,${jobResultSql('jobs')} AS result_json,created_at,updated_at FROM jobs
    WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')=1 ORDER BY created_at,job_id`)
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
  const rows = db.prepare(`SELECT job_id,status,try_no AS attempt,payload_json,${jobResultSql('jobs')} AS result_json,updated_at,json_extract(payload_json,'$.cut.ordinal') AS ordinal FROM jobs
    WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')>1 ORDER BY created_at,job_id`)
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

// Canon-conformance cut (code.refactor params.canonFamilies; nivo wf-nivo-fe-canon-mujek980, 22 of 56 slices
// failed blocked:shared-change): canon-scan's slices own only the files that hold findings, but a finding
// such as FE_SOURCE_LAYOUT_INVALID is fixed by MOVING its owner into a canon home (features/layouts/<Owner>)
// and registering it in the package's architecture config - paths no slice owned. op-code.refactor-7e9f7e20c1
// (slice 7/34) committed 9 -> 7 findings and blocked on the rest. canonCutPlanOf grants each slice the exact
// relocation destinations its findings need (modules/ops/ops/code.refactor.yaml policy.canonConformance
// relocations) unless a sibling or an earlier grant already holds them, and routes the shared-root files
// (sharedRoots) plus every contested relocation to ONE serial canon-wire leg per wave, enqueued --after every
// ordinal of that wave - the recutPlanOf wire pattern. A blocked slice is redone from its committed state
// (canonRedispatchOf), never from scratch.

const CANON_OP = 'code.refactor';
const overlaps = (a, b) => within(a, b) || within(b, a);
const srcRootOf = (file) => {
  const segments = String(file).split('/');
  const src = segments.lastIndexOf('src', segments.length - 2);
  return src < 0 ? null : segments.slice(0, src + 1).join('/');
};

/** policy.canonConformance of the code.refactor brief: {relocations: {<ruleId>: {moves, into: {<role>|'*': [dest]}}}, sharedRoots}. */
export function canonConformancePolicy(brief = readModuleJson('modules', 'ops', 'ops', `${CANON_OP}.yaml`)) {
  const policy = brief?.policy?.canonConformance ?? {};
  if (!policy.relocations || typeof policy.relocations !== 'object' || !Array.isArray(policy.sharedRoots)) {
    throw Error('modules/ops/ops/code.refactor.yaml policy.canonConformance must declare relocations {<ruleId>: {moves, into}} and sharedRoots []');
  }
  return { relocations: policy.relocations, sharedRoots: policy.sharedRoots.map(String) };
}

/**
 * The relocation one finding needs, or null: the file that moves (the finding's file, or its related import
 * target), the owner folder it moves from (`home`) and the destinations it may land in - `<src>/<dest>/<Owner>`,
 * the owner being the folder (or file stem) one level below the role's misplaced tier.
 */
export function relocationOf(finding, relocations) {
  const rule = relocations?.[finding?.ruleId];
  if (!rule) return null;
  const moving = String((rule.moves === 'related' ? finding.related : finding.file) ?? '');
  const src = srcRootOf(moving);
  if (!moving || !src) return null;
  const rest = moving.slice(src.length + 1).split('/');
  if (rest.length < 3) return null;
  const into = rule.into?.[rest[0]] ?? rule.into?.['*'];
  if (!Array.isArray(into) || !into.length) return null;
  const owner = rest[2].replace(/\.[^.]+$/, '');
  const home = rest.length > 3 ? `${src}/${rest.slice(0, 3).join('/')}` : moving;
  const destinations = into.map((dest) => `${src}/${String(dest).replace(/\/+$/, '')}/${owner}`).filter((dest) => !overlaps(dest, home));
  return { ruleId: finding.ruleId, file: finding.file, moving, home, owner, destinations };
}

/**
 * The canon cut: canon-scan's `slices`, each with its relocation `grants` and `owned` = paths + grants, and
 * one `wires` leg per wave holding the shared-root files and the contested relocations, with the api
 * commands a Kernel runs. `scan` is canon-scan's --json record. A grant never overlaps a sibling slice's
 * paths or another slice's grant: such a destination - and the home it moves from - goes to the wave's wire.
 *
 * Repoint (DESIGN §16.7, FMEA #20): with `importersOf(movedPaths) -> [file]` (import-scan.mjs importersOf over the
 * repository's main, tsconfig aliases such as `@/i18n` included), the wave's ONE wire leg also owns EVERY importer of
 * the paths the wave moves (each relocation's moving file and the owner folder it leaves), so a move never leaves an
 * importer nobody owns: `repoint` {moved, importers} on the wire, whose brief is "repoint imports to the new
 * locations; no other change", enqueued --after every slice of the wave. A wave that moves code gets the wire even
 * without a shared-root file.
 */
export const REPOINT_BRIEF = 'repoint imports to the new locations; no other change';
export function canonCutPlanOf(scan, { cutId, op = CANON_OP, policy = null, importersOf = null, scanFile = null } = {}) {
  const { relocations, sharedRoots } = policy ?? canonConformancePolicy();
  const findings = scan?.findings ?? [];
  const slices = (scan?.slices ?? []).map((slice) => ({ ordinal: Number(slice.ordinal), wave: String(slice.wave), paths: [...slice.paths], grants: [] }));
  const holderOf = (file) => slices.find((slice) => slice.paths.some((root) => within(file, root))) ?? null;
  const wireByWave = new Map();
  const wireOf = (wave) => {
    if (!wireByWave.has(wave)) wireByWave.set(wave, { paths: new Set(), reasons: [] });
    return wireByWave.get(wave);
  };
  for (const finding of findings) {
    const move = relocationOf(finding, relocations);
    const slice = move && (holderOf(move.moving) ?? holderOf(move.file));
    if (!slice) continue;
    for (const dest of move.destinations) {
      if (slice.grants.includes(dest)) continue;
      const holder = slices.find((other) => other !== slice && [...other.paths, ...other.grants].some((root) => overlaps(dest, root)));
      if (!holder) { slice.grants.push(dest); continue; }
      const wire = wireOf(slice.wave);
      wire.paths.add(dest);
      wire.paths.add(move.home);
      wire.reasons.push(`${move.ruleId} ${move.moving} -> ${dest}: held by ordinal ${holder.ordinal}`);
    }
  }
  // Shared-root registrations (a package's architecture config): the wire's, never a slice's.
  for (const slice of slices) {
    const packages = new Set(findings.filter((finding) => slice.paths.some((root) => within(finding.file, root)))
      .map((finding) => srcRootOf(finding.file)).filter(Boolean).map((src) => src.split('/').slice(0, -1).join('/')));
    for (const pkg of packages) {
      for (const shared of sharedRoots) {
        const file = pkg ? `${pkg}/${shared}` : shared;
        if (!slices.some((other) => other.paths.some((root) => overlaps(file, root)))) wireOf(slice.wave).paths.add(file);
      }
    }
  }
  // Every importer of what the wave moves: the wave's wire repoints them after its slices land.
  const repointByWave = new Map();
  if (typeof importersOf === 'function') {
    const movedByWave = new Map();
    for (const finding of findings) {
      const move = relocationOf(finding, relocations);
      const slice = move && (holderOf(move.moving) ?? holderOf(move.file));
      if (!slice) continue;
      if (!movedByWave.has(slice.wave)) movedByWave.set(slice.wave, new Set());
      for (const moved of [move.moving, move.home]) movedByWave.get(slice.wave).add(moved);
    }
    for (const [wave, movedSet] of movedByWave) {
      const moved = [...movedSet].sort();
      let importers = [];
      try { importers = [...new Set(importersOf(moved) ?? [])].sort(); } catch (error) { importers = []; wireOf(wave).reasons.push(`repoint importers unavailable: ${String(error?.message ?? error).slice(0, 120)}`); }
      const wire = wireOf(wave);
      for (const file of importers) wire.paths.add(file);
      wire.reasons.push(`repoint: ${importers.length} importer(s) of ${moved.length} moved path(s)`);
      repointByWave.set(wave, { moved, importers });
    }
  }
  const total = slices.length;
  const out = slices.map((slice) => ({ ...slice, owned: [...slice.paths, ...slice.grants] }));
  const waves = [...new Set(out.map((slice) => slice.wave))];
  const wires = waves.filter((wave) => wireByWave.get(wave)?.paths.size || repointByWave.has(wave)).map((wave) => ({
    wave, paths: [...(wireByWave.get(wave)?.paths ?? [])].sort(), reasons: wireByWave.get(wave)?.reasons ?? [],
    after: out.filter((slice) => slice.wave === wave).map((slice) => slice.ordinal),
    ...(repointByWave.has(wave) ? { repoint: repointByWave.get(wave), brief: REPOINT_BRIEF } : {}),
  })).filter((wire) => wire.paths.length);
  const commands = [];
  for (const [index, wave] of waves.entries()) {
    for (const slice of out.filter((item) => item.wave === wave)) {
      commands.push(`api enqueue --op ${op} --paths ${slice.owned.join(',')} --cut-id ${cutId} --cut-ordinal ${slice.ordinal} --cut-total ${total} --canon-scan ${scanFile ?? '<this scan file>'}`
        + (index ? ` --after <every job of wave ${waves[index - 1]} and its canon-wire leg>` : ''));
    }
    const wire = wires.find((item) => item.wave === wave);
    if (wire) commands.push(`api enqueue --op ${op} --paths ${wire.paths.join(',')} --params '{"canonWire":true}' --after <every job of wave ${wave}: ordinals ${wire.after.join(',')}> (ONE canon-wire leg${wire.repoint ? `; ${REPOINT_BRIEF}` : ''})`);
  }
  return { cutId: cutId == null ? null : String(cutId), op, total, slices: out, wires, commands };
}

/**
 * The redo of a slice that settled blocked or failed after committing: the same op, cut ordinal and owned
 * paths as a new attempt --retry-of it, with params.resumeFrom = the head its indexed patch recorded (the
 * committed work it keeps) and params.admissionBase = the first attempt's admission base (the scoped-lint
 * --base, so the kept commit is still measured). Null when the job indexed no committed patch.
 */
export function canonRedispatchOf(db, jobId, { extraPaths = [] } = {}) {
  const row = db.prepare('SELECT job_id,workflow_id,op_id,status,payload_json FROM jobs WHERE job_id=?').get(jobId);
  if (!row) return null;
  const payload = payloadOf(row);
  const indexed = db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='artifacts-indexed' ORDER BY seq DESC LIMIT 1").get(jobId);
  const patch = parseJson(indexed?.payload_json ?? '', {})?.patch ?? null;
  if (!patch?.head) return null;
  const params = { resumeFrom: String(patch.head), admissionBase: String(payload.params?.admissionBase || patch.base || patch.head) };
  const owned = [...new Set([...(payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean), ...extraPaths])];
  const cut = payload.cut;
  const command = `api enqueue --workflow ${row.workflow_id} --op ${row.op_id} --paths ${owned.join(',')}`
    + (cut?.id != null ? ` --cut-id ${cut.id} --cut-ordinal ${cut.ordinal} --cut-total ${cut.total}` : '')
    + ` --retry-of ${row.job_id} --params '${JSON.stringify(params)}'`;
  return { jobId: row.job_id, status: row.status, ...params, patch: patch.path ?? null, owned, command };
}

/**
 * The cut manifest a slice binds before its first edit (code.refactor step 1, "the stable cut id/ordinal/total,
 * complete path-union manifest and passed-ordinal state"), read from the ledger's cut set at dispatch so the
 * packet carries it: every ordinal's latest live job with its owned paths and status, the path union, the
 * passed and open ordinals, ordinals no job holds yet (`absent`), any overlap between two ordinals' paths, and
 * the cut's canon-wire legs. Before this the packet held only {id, ordinal, total} and slices blocked
 * authority on the missing manifest (wf-nivo-fe-canon-mujek980 op-code.refactor-cae0499f4a, -da9ab10e32).
 */
export function cutManifestOf(db, { workflowId, op, cut, ownJobId = null }) {
  if (!cut || cut.id == null) return null;
  const rows = db.prepare(`SELECT job_id,status,try_no AS attempt,worker_id,payload_json,json_extract(payload_json,'$.cut.ordinal') AS ordinal FROM jobs
    WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? ORDER BY created_at,job_id`).all(workflowId, op, String(cut.id))
    .filter((row) => row.job_id === ownJobId || (row.status !== 'cancelled' && !retiredBeforeDispatch(row)));
  const latest = new Map();
  for (const row of rows) latest.set(Number(row.ordinal), row);
  const total = Math.max(0, Number(cut.total) || 0);
  const ordinals = [];
  for (let n = 1; n <= total; n += 1) {
    const row = latest.get(n);
    ordinals.push(row ? { ordinal: n, jobId: row.job_id, status: row.status, paths: ownedOf(payloadOf(row)) } : { ordinal: n, jobId: null, status: 'absent', paths: [] });
  }
  // Only open ordinals can collide: a passed ordinal's paths are history (its leases are released).
  const live = ordinals.filter((o) => o.status !== 'succeeded' && o.paths.length);
  const overlapsOut = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const hit = live[i].paths.find((a) => live[j].paths.some((b) => overlaps(a, b)));
      if (hit) overlapsOut.push({ ordinals: [live[i].ordinal, live[j].ordinal], path: hit });
    }
  }
  const wires = db.prepare(`SELECT job_id,status,payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.params.canonWire')=1
    AND status<>'cancelled' ORDER BY created_at,job_id`).all(workflowId, op).map((row) => ({ jobId: row.job_id, status: row.status, paths: ownedOf(payloadOf(row)) }));
  return {
    source: 'ledger cut set at dispatch', cutId: String(cut.id), total, self: Number(cut.ordinal),
    passed: ordinals.filter((o) => o.status === 'succeeded').map((o) => o.ordinal),
    open: ordinals.filter((o) => o.status !== 'succeeded').map((o) => o.ordinal),
    absent: ordinals.filter((o) => o.status === 'absent').map((o) => o.ordinal),
    pathUnion: [...new Set(ordinals.flatMap((o) => o.paths))].sort(),
    disjoint: overlapsOut.length === 0, overlaps: overlapsOut.slice(0, 20),
    ordinals, wires,
  };
}

/** The prompt lines of a bound cut manifest (op-prompt.mjs). */
export function cutManifestPromptLines(manifest) {
  if (!manifest) return [];
  return [
    `cut_manifest: bound at dispatch from the ledger (packet context.cut.manifest, api op-contract --json): ${manifest.total} ordinal(s), path union ${manifest.pathUnion.length} path(s), ${manifest.disjoint ? 'pairwise-disjoint' : `OVERLAPS ${manifest.overlaps.map((o) => `${o.ordinals.join('/')}@${o.path}`).slice(0, 3).join(', ')}`}`,
    `  passed ordinals: ${manifest.passed.join(',') || '(none)'}; open: ${manifest.open.join(',') || '(none)'}${manifest.absent.length ? `; no job yet: ${manifest.absent.join(',')}` : ''}; canon-wire legs: ${manifest.wires.map((w) => `${w.jobId} ${w.status}`).join(', ') || '(none)'}`,
    `  this IS the complete path-union manifest and passed-ordinal state the brief requires: bind it, never block for it; a sibling path is never yours to edit`,
  ];
}

const CONFIG_FILE_RE = /(?:^|\/)(?:architecture\.json|tsconfig[^/]*\.json|package\.json|\.eslintrc[^/]*|[^/]+\.config\.[cm]?[jt]s)$/;
const PUBLIC_ENTRY_RE = /\/index\.[cm]?[jt]sx?$/;
/**
 * What settle does with a canon slice (params.canonFamilies, not the canon-wire leg) that settled blocked or
 * failed WITH a filed report, so a partial or scope-bound slice is never a dead end (wf-nivo-fe-canon-mujek980
 * 06:01-06:03Z: 14 slices blocked on shared-change after committing in-ceiling work, nothing requeued them):
 *   - `resumeFrom`: the commit it left (its report head, else a commit its report names) - the follow-up is a
 *     continuation from it, never a redo;
 *   - `grants`: relocation destinations its report names outside its paths that no sibling ordinal holds -
 *     the follow-up owns them;
 *   - `wire`: shared-root/config/public-entry files and destinations a sibling holds - the canon-wire leg's.
 * Pure over its inputs; null when the slice is no canon slice or there is nothing to follow up.
 */
export function canonSettleFollowUpOf({ payload, report, manifest = null, destinations = [], commit = null, sharedRoots = ['architecture.json'] }) {
  const params = payload?.params ?? {};
  if (!payload?.cut || !String(params.canonFamilies ?? '').trim() || params.canonWire === true) return null;
  if (!report || !['blocked', 'failed'].includes(String(report.outcome))) return null;
  const owned = ownedOf(payload);
  const prefix = (owned.find((p) => /^[^/]+\/(?:apps|packages)\//.test(p)) ?? '').replace(/^([^/]+\/)(?:apps|packages)\/.*$/, '$1');
  const norm = (p) => { const clean = String(p).replace(/\\/g, '/').replace(/\/+$/, ''); return prefix && !clean.startsWith(prefix) ? `${prefix}${clean}` : clean; };
  const siblings = (manifest?.ordinals ?? []).filter((o) => o.ordinal !== Number(payload.cut.ordinal) && o.status !== 'succeeded').flatMap((o) => o.paths);
  const grants = [], wire = [];
  const text = [report.summary, report.blocker?.detail, ...(report.checks ?? []).map((c) => c?.evidence)].join(' ');
  // A page surface under components/pages moves to its feature tier (pages is a FEATURE tier, FE_SOURCE_LAYOUT_INVALID,
  // FE_ROUTE_ONE_PAGE): the destination is known from the owned path itself, not only from the report's prose.
  const derived = owned.map((p) => /^(.*\/src)\/components\/pages\/([^/]+)$/.exec(p)).filter(Boolean).map((m) => `${m[1]}/features/pages/${m[2]}`);
  // A new or moved feature owner is registered in its package's shared root (architecture.json): the wire's.
  const packages = [...new Set(owned.map((p) => /^(.*)\/src\//.exec(p)?.[1]).filter(Boolean))];
  const sharedNamed = sharedRoots.filter((root) => text.includes(root));
  const sharedWire = (derived.length || sharedNamed.length) ? packages.flatMap((pkg) => (sharedNamed.length ? sharedNamed : sharedRoots).map((root) => `${pkg}/${root}`)) : [];
  for (const dest of [...destinations.map(norm), ...derived, ...sharedWire]) {
    if (owned.some((o) => within(dest, o))) continue;
    if (CONFIG_FILE_RE.test(dest) || sharedRoots.some((root) => dest === root || dest.endsWith(`/${root}`))) { wire.push(dest); continue; }
    // A public entry (index.*) is its folder's: the slice gets the folder unless a sibling holds it.
    const target = PUBLIC_ENTRY_RE.test(dest) ? dest.replace(PUBLIC_ENTRY_RE, '') : dest;
    if (!target || owned.some((o) => overlaps(target, o) && target.length <= o.length)) { wire.push(dest); continue; }
    if (siblings.some((p) => overlaps(target, p))) wire.push(dest);
    else grants.push(target);
  }
  const head = /^[0-9a-f]{7,40}$/i.test(String(report.head ?? '')) ? String(report.head) : (commit ?? null);
  const blocker = String(report.blocker?.kind ?? '');
  // Every blocked canon slice gets its bounded follow-up (settle caps it per ordinal): a block on a brief or
  // binding misreading is retried on the fixed runtime, never left a dead end (fe-canon a77 ordinal 15).
  return { resumeFrom: head, grants: [...new Set(grants)], wire: [...new Set(wire)], blocker: blocker || null };
}

// The Kernel's two canon-cut commands (modules/kernel/driver-loop.yaml enqueue.cutExecution):
//   node scripts/kernel/cut-seam.mjs canon-plan --scan <canon-scan --json file> --cut-id <id> [--root <scanned repo>]
//   node scripts/kernel/cut-seam.mjs canon-redispatch --repo <ledger repo> --job <blocked slice job> [--paths <extra csv>]
// Each prints JSON whose `commands` / `command` are the api enqueue lines to run. Ledger reads only.
async function main(argv) {
  const [verb, ...rest] = argv;
  const flag = (name) => { const at = rest.indexOf(`--${name}`); return at >= 0 ? rest[at + 1] : undefined; };
  if (verb === 'canon-plan' && flag('scan')) {
    const scan = JSON.parse(fs.readFileSync(path.resolve(flag('scan')), 'utf8'));
    // The repoint unit's importers are read from the scanned repository (--root, else the scan's own repository).
    const root = flag('root') ?? scan.repository ?? null;
    const { importersOf } = await import('./import-scan.mjs');
    const scanImporters = root && fs.existsSync(path.join(root, '.git')) ? (moved) => importersOf(root, moved) : null;
    console.log(JSON.stringify(canonCutPlanOf(scan, { cutId: flag('cut-id') ?? 'canon', importersOf: scanImporters, scanFile: path.resolve(flag('scan')) }), null, 2));
    return 0;
  }
  if (verb === 'canon-redispatch' && flag('repo') && flag('job')) {
    const { inspectLedger, ledgerFileFor } = await import('../../engine/ledger-db.mjs');
    const ledger = inspectLedger({ file: ledgerFileFor(path.resolve(flag('repo'))) });
    try {
      const extraPaths = String(flag('paths') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
      const plan = canonRedispatchOf(ledger.db, flag('job'), { extraPaths });
      console.log(JSON.stringify(plan ?? { jobId: flag('job'), command: null, reason: 'no committed patch indexed for this job: redo it as a plain --retry-of' }, null, 2));
      return 0;
    } finally { ledger.close(); }
  }
  console.error('use: cut-seam.mjs canon-plan --scan <file> --cut-id <id> | canon-redispatch --repo <repo> --job <id> [--paths <csv>]');
  return 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
