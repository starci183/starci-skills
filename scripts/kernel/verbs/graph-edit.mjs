// api graph-edit — the Kernel's LIGHT, logged and reversible edits of its own units (owner 2026-09-28: "ops draw the
// graph, the Kernel only makes light edits"). The work graph itself stays the ops' (scripts/work/work-graph.mjs: draw
// scope.define, revise business/architecture/interface, cut work.author); the leg plan stays goal.revise's. A heavy
// redesign is `api redesign` (dispatch the owning op with the RCA as its brief).
//
//   graph-edit --workflow <wf> --decision <id> --edit <kind> ...
//     drop     --jobs <csv> --reason <t>               drop queued units (e.g. every owned path absent)
//     widen    --job <queued> --add-paths <csv>         widen a unit inside its repository (never another workflow's paths)
//     wire     --paths <csv> [--op <op>] [--before <queued csv>]   ONE serial unit owning shared files; --before waits on it
//     continue --job <failed> [--add-paths <csv>]       a continuation unit for a partial commit (counts toward the unit)
//     retry    --job <failed> [--add-paths <csv>] [--set '<json>'] [--after <csv>]   retry a failed unit with a CHANGED shape (the same failing shape is refused)
//     reorder  --job <queued> --after <csv>             the unit waits on other units of this workflow (no cycles)
//     split    --job <queued> --parts '[["p",...],...]' split one unit into 2..N disjoint units
//     merge    --jobs <csv>                             merge 2..N queued units of one op into one
//     params   --job <queued> --set '<json>'            per-unit override: notes, commandTimeoutMs, difficulty, model, effort
//     scan     --op <op> --cut-id <id> [--exclude <csv>] start a fresh canon-scan in the background (a canon cut's own method)
//     recut    --op <op> --cut-id <id> --from-scan <file> [--path-prefix <p>]   re-cut the cut's remaining queued units
//     undo     --undo <edit id>                         revert one edit (re-enqueue dropped units as a new try, drop created ones, restore fields)
//
// Bounds: at most runtimes.yaml allocation.progress.maxUnitsPerEdit units touched per edit (a recut from a canon-scan
// record - the goal's own cut method - is exempt); only queued, never-dispatched units change; a running unit is never
// interrupted. Every edit is a kernel-graph-edit event with its inverse and a typed decision log row.
import fs from 'node:fs';
import { RETRYABLE_JOB_STATUSES } from '../../../engine/admission.mjs';
import { kernelScratchDirOf } from '../op-prompt.mjs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { skillRoot } from '../../../engine/runtime-root.mjs';
import { ownedPathPlacements } from '../target-repo.mjs';
import {
  apiRun, checkPaths, csv, dispatchedEver, dropJob, editableJob, failedShapesOf, foreignOverlap, jobRow, newId,
  recordKernel, refuse, requireDecision, restoreJob, setPayload, settingsN, shapeOf, validateOverride,
} from '../kernel-authority.mjs';
import { GRAPH_EDIT_KIND, OPEN_JOB, opJobsOf, unitsOf } from '../progress-rca.mjs';
import { canonCutPlanOf } from '../cut-seam.mjs';
import { readCanonScan, unfixableSlicesOf } from '../canon-plan-gate.mjs';
import { putArtifact, stageBlob } from '../../machine/evidence-store.mjs';
import { latestReportOf } from './shared/rows.mjs';

const EDITS = ['drop', 'widen', 'wire', 'continue', 'retry', 'reorder', 'split', 'merge', 'params', 'scan', 'recut', 'undo'];
const COMMIT_RE = /\b(?:commit(?:ted)?|land(?:ed)?(?: commit)?|đã (?:land )?commit)\s+([0-9a-f]{7,40})\b/i;
const parseJson = (s, what) => { try { return JSON.parse(s); } catch (e) { throw refuse(`${what} is not JSON: ${e.message}`, 'edit-invalid'); } };
/** Refuse a continuation/retry of a unit that already passed its gates. */
const unitDone = (db, wf, job) => {
  const units = unitsOf(opJobsOf(db, wf));
  const u = units.find((x) => x.jobs.some((j) => j.job_id === job.job_id));
  if (u?.state === 'done') throw refuse(`${job.job_id}'s unit ${u.key} already passed (${u.jobs.find((j) => j.status === 'succeeded')?.job_id}): nothing to continue or retry`, 'unit-done');
};

/** The ids of the after-chain of `start` (to refuse a cycle). */
function afterClosure(db, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const j = jobRow(db, id);
    for (const a of j?.payload?.after ?? []) stack.push(a);
  }
  return seen;
}

// A unit a graph edit carves out of other units (split, merge, recut, wire) passes --derived-from: it inherits what is
// left of their try budgets, never a fresh one (scripts/kernel/units.mjs admitUnit, H3).
function enqueueUnit({ repo, wf, op, paths, what, extra = [], derivedFrom = [] }) {
  if (derivedFrom.length) extra = [...extra, '--derived-from', derivedFrom.join(',')];
  const r = apiRun(['enqueue', '--workflow', wf, '--op', op, '--paths', paths.join(','), '--what', what.slice(0, 60), '--title', `${op}: ${what}`.slice(0, 120), ...extra], { repo });
  if (!r.ok || !r.json?.job_id) throw refuse(`enqueue ${op} refused: ${r.json?.reason ?? ''} ${r.json?.detail ?? r.json?.error ?? r.err ?? r.out}`.trim(), r.json?.reason ?? r.json?.code ?? 'enqueue-refused');
  return r.json.job_id;
}

export default {
  verb: 'graph-edit',
  required: ['workflow', 'edit'],
  kernelOnly: true,
  usage: '  graph-edit --workflow <id> --decision <id> --edit drop|widen|wire|continue|reorder|split|merge|params|scan|recut|undo ...   the Kernel\'s light, logged, reversible unit edits (modules/kernel/api-commands/graph-edit.yaml)',
  async run({ ledger, args, repo, emit }) {
    const db = ledger.db, wf = args.workflow, edit = String(args.edit), now = Date.now();
    if (!EDITS.includes(edit)) throw refuse(`--edit must be one of ${EDITS.join('|')}`, 'edit-invalid');
    const wfRow = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(wf);
    if (!wfRow || wfRow.phase === 'finished' || wfRow.archived_at) throw refuse(`${wf} is not a running workflow`, 'workflow-not-running');
    const decision = edit === 'undo' ? null : requireDecision(db, wf, args.decision);
    const N = settingsN();
    const editId = newId('edit');
    const rec = { edit, decision: decision?.id ?? null, created: [], dropped: [], changed: [], reason: args.reason ?? null };
    const bound = (n) => { if (n > N) throw refuse(`this edit touches ${n} units; a light edit touches at most ${N} (allocation.progress.maxUnitsPerEdit) - a bigger change is a redesign: api redesign --op work.author|scope.define|goal.revise`, 'edit-too-big'); };
    const change = (job, patch) => {
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, job.payload[k] ?? null]));
      const payload = { ...job.payload, ...patch, kernelEdit: { ...(job.payload.kernelEdit ?? {}), lastEdit: editId } };
      setPayload(ledger, job, payload, now);
      rec.changed.push({ jobId: job.job_id, before, after: patch });
      return payload;
    };
    const tag = (jobId, patch) => { const j = jobRow(db, jobId); if (j) setPayload(ledger, j, { ...j.payload, kernelEdit: { ...(j.payload.kernelEdit ?? {}), edit, editId, decision: decision?.id ?? null, ...patch } }, now); };
    let human = '';

    if (edit === 'drop') {
      const ids = csv(args.jobs ?? args.job);
      if (!ids.length) throw refuse('drop needs --jobs <csv>', 'edit-invalid');
      if (!String(args.reason ?? '').trim()) throw refuse('drop needs --reason', 'edit-invalid');
      bound(ids.length);
      const jobs = ids.map((id) => editableJob(db, wf, id));
      ledger.transaction(() => { for (const j of jobs) { dropJob(ledger, j, { reason: `kernel graph-edit: ${args.reason}`, editId, now }); rec.dropped.push(j.job_id); } });
      human = `dropped ${ids.join(', ')}`;
    } else if (edit === 'widen') {
      const job = editableJob(db, wf, args.job);
      const add = checkPaths(db, { repo, workflowId: wf, op: job.op_id, payload: job.payload, current: job.payload.owned_paths ?? [], add: csv(args['add-paths']) });
      const paths = [...new Set([...(job.payload.owned_paths ?? []), ...add])];
      const next = { ...job.payload, owned_paths: paths };
      const failed = failedShapesOf(db, wf, job).get(shapeOf(job.op_id, next));
      if (failed) throw refuse(`this shape already failed in ${failed.jobId} (${failed.causes.join(', ')}): change it more`, 'shape-already-failed');
      ledger.transaction(() => change(job, { owned_paths: paths }));
      human = `widened ${job.job_id} by ${add.join(', ')}`;
    } else if (edit === 'reorder') {
      const job = editableJob(db, wf, args.job);
      const after = csv(args.after);
      if (!after.length) throw refuse('reorder needs --after <csv>', 'edit-invalid');
      for (const a of after) {
        const j = jobRow(db, a);
        if (!j || j.workflow_id !== wf) throw refuse(`${a} is not a job of ${wf}`, 'job-foreign');
        if (afterClosure(db, a).has(job.job_id)) throw refuse(`${job.job_id} after ${a} would be a cycle`, 'edit-cycle');
      }
      ledger.transaction(() => change(job, { after: [...new Set([...(job.payload.after ?? []), ...after])] }));
      human = `${job.job_id} now waits on ${after.join(', ')}`;
    } else if (edit === 'params') {
      const job = editableJob(db, wf, args.job);
      const o = validateOverride(parseJson(args.set, '--set'));
      const patch = { kernelOverride: { ...(job.payload.kernelOverride ?? {}), ...o } };
      if (o.difficulty) patch.difficulty = o.difficulty;
      if (o.model) patch.kernelModel = o.model;
      ledger.transaction(() => change(job, patch));
      human = `set ${Object.keys(o).join(', ')} on ${job.job_id}`;
    } else if (edit === 'wire') {
      const before = csv(args.before).map((id) => editableJob(db, wf, id));
      bound(1 + before.length);
      const op = args.op ?? before[0]?.op_id ?? 'code.refactor';
      const refPaths = before[0]?.payload?.owned_paths ?? [];
      const paths = checkPaths(db, { repo, workflowId: wf, op, payload: before[0]?.payload ?? {}, current: refPaths, add: csv(args.paths) });
      const created = enqueueUnit({ repo, wf, op, paths, what: `wire ${paths.slice(0, 2).map((p) => p.split('/').pop()).join(',')}`, derivedFrom: before.map((j) => j.job_id) });
      rec.created.push(created);
      tag(created, { wire: true });
      ledger.transaction(() => { for (const j of before) change(jobRow(db, j.job_id), { after: [...new Set([...(j.payload.after ?? []), created])] }); });
      human = `wire unit ${created} (${op}) owns ${paths.join(', ')}${before.length ? `; ${before.map((j) => j.job_id).join(', ')} wait on it` : ''}`;
    } else if (edit === 'continue') {
      const job = jobRow(db, args.job);
      if (!job || job.workflow_id !== wf || job.kind !== 'op') throw refuse(`${args.job} is not an op job of ${wf}`, 'job-foreign');
      if (job.status !== 'failed') throw refuse(`${job.job_id} is ${job.status}: a continuation follows a failed/blocked attempt`, 'edit-invalid');
      unitDone(db, wf, job);
      const rep = latestReportOf(db, job.job_id);
      const text = rep?.report_json ?? '';
      const commit = COMMIT_RE.exec(text)?.[1] ?? null;
      if (!commit) throw refuse(`${job.job_id}'s report names no commit: a continuation continues committed work (retry a failure with a changed shape instead)`, 'continue-no-commit');
      const open = db.prepare(`SELECT job_id FROM jobs WHERE workflow_id=? AND op_id=? AND status IN (${OPEN_JOB.map(() => '?').join(',')}) AND json_extract(payload_json,'$.kernelEdit.continuationOf')=?`).get(wf, job.op_id, ...OPEN_JOB, job.job_id);
      if (open) throw refuse(`${open.job_id} already continues ${job.job_id}`, 'continue-exists');
      const add = args['add-paths'] ? checkPaths(db, { repo, workflowId: wf, op: job.op_id, payload: job.payload, current: job.payload.owned_paths ?? [], add: csv(args['add-paths']) }) : [];
      const paths = [...new Set([...(job.payload.owned_paths ?? []), ...add])];
      const cut = job.payload.cut;
      const created = enqueueUnit({ repo, wf, op: job.op_id, paths, what: `continue ${commit.slice(0, 7)}`,
        extra: ['--retry-of', job.job_id, ...(cut ? ['--cut-id', String(cut.id), '--cut-ordinal', String(cut.ordinal), '--cut-total', String(cut.total)] : [])] });
      rec.created.push(created);
      tag(created, { continuationOf: job.job_id, commits: [commit], unitOf: job.job_id });
      const c = jobRow(db, created);
      if (c) setPayload(ledger, c, { ...c.payload, kernelOverride: { ...(c.payload.kernelOverride ?? {}), notes: [...(c.payload.kernelOverride?.notes ?? []), `Continuation of ${job.job_id}: commit ${commit} already landed its in-ceiling part. Start from that commit; finish what its report left open${add.length ? ` (you now also own ${add.join(', ')})` : ''}.`] } }, now);
      ledger.transaction(() => ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: job.job_id, kind: 'unit-partial-continued', payload: { by: created, commit, editId } }));
      human = `continuation ${created} of ${job.job_id} from ${commit}`;
    } else if (edit === 'retry') {
      const job = jobRow(db, args.job);
      if (!job || job.workflow_id !== wf || job.kind !== 'op') throw refuse(`${args.job} is not an op job of ${wf}`, 'job-foreign');
      if (!RETRYABLE_JOB_STATUSES.includes(job.status)) throw refuse(`${job.job_id} is ${job.status}: retry follows a failed or awaiting_owner attempt`, 'edit-invalid');
      unitDone(db, wf, job);
      const open = db.prepare(`SELECT job_id FROM jobs WHERE workflow_id=? AND status IN (${OPEN_JOB.map(() => '?').join(',')}) AND (json_extract(payload_json,'$.retry.retryOf')=? OR json_extract(payload_json,'$.kernelEdit.unitOf')=?)`).get(wf, ...OPEN_JOB, job.job_id, job.job_id);
      if (open) throw refuse(`${open.job_id} already retries ${job.job_id}: edit that queued unit (widen/params) instead`, 'retry-exists');
      const add = args['add-paths'] ? checkPaths(db, { repo, workflowId: wf, op: job.op_id, payload: job.payload, current: job.payload.owned_paths ?? [], add: csv(args['add-paths']) }) : [];
      const o = args.set ? validateOverride(parseJson(args.set, '--set')) : null;
      const next = { ...job.payload, owned_paths: [...new Set([...(job.payload.owned_paths ?? []), ...add])], kernelOverride: { ...(job.payload.kernelOverride ?? {}), ...(o ?? {}) }, ...(o?.model ? { kernelModel: o.model } : {}) };
      const failedShapes = failedShapesOf(db, wf, { job_id: '__new__', op_id: job.op_id, payload: next });
      const same = shapeOf(job.op_id, next) === shapeOf(job.op_id, job.payload) || failedShapes.has(shapeOf(job.op_id, next));
      if (same) throw refuse(`the retry has the same shape as a failed attempt of this unit: widen its paths (--add-paths) or change its override (--set) - never the same failing shape`, 'shape-already-failed');
      const cut = job.payload.cut;
      const after = csv(args.after);
      const created = enqueueUnit({ repo, wf, op: job.op_id, paths: next.owned_paths, what: `retry ${job.payload.displayWhat ?? ''}`.trim(),
        extra: ['--retry-of', job.job_id, ...(cut ? ['--cut-id', String(cut.id), '--cut-ordinal', String(cut.ordinal), '--cut-total', String(cut.total)] : []), ...(after.length ? ['--after', after.join(',')] : [])] });
      rec.created.push(created);
      tag(created, { retryOf: job.job_id, unitOf: job.job_id, added: add });
      const c = jobRow(db, created);
      if (c && (o || next.kernelModel)) setPayload(ledger, c, { ...c.payload, kernelOverride: next.kernelOverride, ...(next.kernelModel ? { kernelModel: next.kernelModel } : {}), ...(o?.difficulty ? { difficulty: o.difficulty } : {}) }, now);
      human = `retry ${created} of ${job.job_id} with a changed shape${add.length ? ` (+${add.join(', ')})` : ''}${o ? ` (${Object.keys(o).join(', ')})` : ''}`;
    } else if (edit === 'split') {
      const job = editableJob(db, wf, args.job);
      const parts = parseJson(args.parts, '--parts');
      if (!Array.isArray(parts) || parts.length < 2 || parts.some((p) => !Array.isArray(p) || !p.length)) throw refuse('--parts is 2..N non-empty arrays of paths', 'edit-invalid');
      bound(1 + parts.length);
      const own = new Set(job.payload.owned_paths ?? []);
      const flat = parts.flat();
      if (flat.some((p) => !own.has(p)) || new Set(flat).size !== flat.length || flat.length !== own.size) throw refuse('the parts must partition the unit\'s owned paths exactly (disjoint, nothing added or lost)', 'edit-invalid');
      for (const [i, p] of parts.entries()) { const id = enqueueUnit({ repo, wf, op: job.op_id, paths: p, what: `split ${i + 1}/${parts.length} of ${job.payload.displayWhat ?? job.job_id}`, derivedFrom: [job.job_id] }); rec.created.push(id); tag(id, { splitOf: job.job_id }); }
      ledger.transaction(() => { dropJob(ledger, jobRow(db, job.job_id), { reason: `split into ${rec.created.join(', ')}`, editId, now }); rec.dropped.push(job.job_id); });
      human = `split ${job.job_id} into ${rec.created.join(', ')}`;
    } else if (edit === 'merge') {
      const jobs = csv(args.jobs).map((id) => editableJob(db, wf, id));
      if (jobs.length < 2) throw refuse('merge needs --jobs with 2..N queued units', 'edit-invalid');
      bound(jobs.length + 1);
      if (new Set(jobs.map((j) => j.op_id)).size !== 1) throw refuse('merge joins units of one op', 'edit-invalid');
      const paths = [...new Set(jobs.flatMap((j) => j.payload.owned_paths ?? []))];
      const id = enqueueUnit({ repo, wf, op: jobs[0].op_id, paths, what: `merge of ${jobs.length} units`, derivedFrom: jobs.map((j) => j.job_id) });
      rec.created.push(id); tag(id, { mergeOf: jobs.map((j) => j.job_id) });
      ledger.transaction(() => { for (const j of jobs) { dropJob(ledger, jobRow(db, j.job_id), { reason: `merged into ${id}`, editId, now }); rec.dropped.push(j.job_id); } });
      human = `merged ${jobs.map((j) => j.job_id).join(', ')} into ${id}`;
    } else if (edit === 'scan') {
      const units = db.prepare("SELECT job_id, op_id, status, payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=?").all(wf, args.op, String(args['cut-id'] ?? ''));
      if (!units.length) throw refuse(`no ${args.op} unit of cut ${args['cut-id']} in ${wf}`, 'cut-unknown');
      const sample = units.map((u) => ({ ...u, payload: JSON.parse(u.payload_json) })).find((u) => u.payload.params?.canonFamilies);
      if (!sample) throw refuse(`cut ${args['cut-id']} is no canon cut (no params.canonFamilies): its re-cut belongs to work.author - api redesign --op work.author`, 'scan-not-canon');
      const place = ownedPathPlacements({ op: sample.op_id, payload: sample.payload, ownedPaths: sample.payload.owned_paths.slice(0, 1), repo })[0];
      if (!place || place.unresolved || !place.role) throw refuse('the cut\'s repository does not resolve (project binding)', 'scan-root-unknown');
      const root = place.base;
      // Busy paths (running units of this workflow, other workflows' open units) stay out of the fresh cut.
      const prefix = `${String(sample.payload.owned_paths[0]).split('/')[0]}/`;
      const busy = [...new Set(db.prepare(`SELECT payload_json, workflow_id, status FROM jobs WHERE kind='op' AND status IN (${OPEN_JOB.filter((s) => s !== 'queued').map(() => '?').join(',')})`).all(...OPEN_JOB.filter((s) => s !== 'queued'))
        .flatMap((r) => JSON.parse(r.payload_json).owned_paths ?? []).filter((p) => String(p).startsWith(prefix)).map((p) => String(p).slice(prefix.length)))];
      const exclude = [...new Set([...csv(args.exclude), 'design-plans', ...busy])];
      const dir = kernelScratchDirOf(repo, wf, 'scans');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${editId}.json`);
      const log = fs.openSync(`${file}.log`, 'a');
      const out = fs.openSync(file, 'w');
      const child = spawn(process.execPath, [path.join(skillRoot, 'scripts', 'gates', 'canon-scan.mjs'), '--root', root, '--families', String(sample.payload.params.canonFamilies || 'all'), '--exclude', exclude.join(','), '--json'],
        { cwd: skillRoot, detached: true, stdio: ['ignore', out, log], windowsHide: true });
      child.unref();
      rec.scan = { file, root, exclude: exclude.length, pid: child.pid, prefix };
      human = `canon-scan started in the background (pid ${child.pid}) -> ${file}; next wake: api graph-edit --workflow ${wf} --edit recut --op ${args.op} --cut-id ${args['cut-id']} --from-scan ${file} --decision ${decision.id}`;
    } else if (edit === 'recut') {
      // H6: a re-cut goes through the canon planner (scripts/kernel/cut-seam.mjs canonCutPlanOf): each slice owns its paths
      // PLUS the relocation destinations its findings need, contested moves go to one canon-wire leg per wave, and a slice
      // whose moves another slice holds (no fix target) is refused here and cut again - never enqueued to block.
      const file = String(args['from-scan'] ?? '');
      if (!file || !fs.existsSync(file)) throw refuse('recut needs --from-scan <canon-scan json file> (start one with --edit scan)', 'edit-invalid');
      let scan;
      try { scan = readCanonScan(file); } catch (error) { throw refuse(`${error.message} (the scan may still run: check ${file}.log)`, error.code === 'canon-scan-invalid' ? 'scan-invalid' : 'scan-incomplete'); }
      if (scan.status === 'unavailable') throw refuse(`the scan answered unavailable (${(scan.issues ?? []).map((i) => i.code).join(', ')}): fix the checker first (a kernel-proposal), never re-cut on a partial measurement`, 'scan-unavailable');
      const cutId = String(args['cut-id'] ?? '');
      const units = db.prepare(`SELECT job_id, op_id, status, payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND (json_extract(payload_json,'$.cut.id')=? OR json_extract(payload_json,'$.kernelEdit.recutOf')=?)`).all(wf, args.op, cutId, cutId)
        .map((j) => ({ ...j, payload: JSON.parse(j.payload_json) }));
      if (!units.length) throw refuse(`no ${args.op} unit of cut ${cutId}`, 'cut-unknown');
      const prefix = args['path-prefix'] ?? `${String(units[0].payload.owned_paths?.[0] ?? '').split('/')[0]}/`;
      const retire = units.filter((j) => j.status === 'queued' && !dispatchedEver(db, j.job_id));
      const running = units.filter((j) => OPEN_JOB.includes(j.status) && j.status !== 'queued');
      const busy = running.flatMap((j) => j.payload.owned_paths ?? []).map((p) => String(p).toLowerCase());
      const n = 1 + db.prepare("SELECT COUNT(*) n FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.edit')='recut'").get(wf, GRAPH_EDIT_KIND).n;
      const newCut = `${cutId}-r${n}`;
      const plan = canonCutPlanOf(scan, { cutId: newCut, op: args.op });
      const unfixable = unfixableSlicesOf(plan);
      const noTarget = new Set(unfixable.map((u) => u.ordinal));
      const prefixed = (list) => list.map((p) => `${prefix}${p}`);
      const clear = plan.slices.filter((sl) => !noTarget.has(sl.ordinal)).map((sl) => ({ ...sl, owned: prefixed(sl.owned) }))
        .filter((sl) => !sl.owned.some((p) => busy.some((bz) => p.toLowerCase().startsWith(bz) || bz.startsWith(p.toLowerCase()))))
        .filter((sl) => !foreignOverlap(db, { repo, workflowId: wf, op: args.op, payload: units[0].payload, paths: sl.owned }).length);
      if (!clear.length) throw refuse(`the fresh scan leaves no plannable slice outside running or foreign work${unfixable.length ? ` (${unfixable.length} slice(s) have no fix target: cut again)` : ''}`, 'recut-empty');
      // The record the cut comes from is kept as a kernel artifact; the enqueue gate re-plans each slice from it.
      const scanBlob = stageBlob(fs.readFileSync(file), { mediaType: 'application/json', repoRoots: [repo] });
      const scanArt = ledger.transaction((tx) => putArtifact(tx, { workflowId: wf, attemptId: null, role: 'scan', kind: 'file', name: `scans/${newCut}.json`, blob: scanBlob, origin: 'kernel' }));
      // The gate re-plans from a scan whose slices are exactly the kept ones, renumbered 1..total.
      const kept = new Set(clear.map((sl) => sl.ordinal));
      const cutScan = { ...scan, slices: scan.slices.filter((sl) => kept.has(Number(sl.ordinal))).map((sl, i) => ({ ...sl, ordinal: i + 1 })) };
      const cutFile = path.join(kernelScratchDirOf(repo, wf, 'scans'), `${newCut}.plan.json`);
      fs.mkdirSync(path.dirname(cutFile), { recursive: true });
      fs.writeFileSync(cutFile, JSON.stringify(cutScan));
      const cutPlan = canonCutPlanOf(cutScan, { cutId: newCut, op: args.op });
      const total = cutPlan.slices.length;
      const derivedFrom = units.map((j) => j.job_id);
      const byWave = new Map();
      const waves = [...new Set(cutPlan.slices.map((sl) => sl.wave))];
      for (const sl of cutPlan.slices) {
        const prior = waves.indexOf(sl.wave) > 0 ? byWave.get(waves[waves.indexOf(sl.wave) - 1]) ?? [] : [];
        const id = enqueueUnit({ repo, wf, op: args.op, paths: prefixed(sl.owned), what: `recut ${sl.ordinal}/${total} ${sl.wave ?? ''}`.trim(), derivedFrom,
          extra: [...(total >= 2 ? ['--cut-id', newCut, '--cut-ordinal', String(sl.ordinal), '--cut-total', String(total), '--canon-scan', cutFile] : []),
            ...(prior.length ? ['--after', prior.join(',')] : [])] });
        rec.created.push(id);
        tag(id, { recutOf: cutId, scan: { artifactId: scanArt.artifactId, sha256: scanBlob.sha } });
        if (!byWave.has(sl.wave)) byWave.set(sl.wave, []);
        byWave.get(sl.wave).push(id);
      }
      for (const wire of cutPlan.wires) {
        const id = enqueueUnit({ repo, wf, op: args.op, paths: prefixed(wire.paths), what: `canon wire ${wire.wave}`, derivedFrom,
          extra: ['--params', JSON.stringify({ canonWire: true }), ...((byWave.get(wire.wave) ?? []).length ? ['--after', byWave.get(wire.wave).join(',')] : [])] });
        rec.created.push(id);
        tag(id, { recutOf: cutId, wire: true });
      }
      ledger.transaction(() => { for (const j of retire) { dropJob(ledger, jobRow(db, j.job_id), { reason: `re-cut into ${newCut} from a fresh canon-scan`, editId, now }); rec.dropped.push(j.job_id); } });
      rec.recut = { from: cutId, to: newCut, scan: { artifactId: scanArt.artifactId, sha256: scanBlob.sha }, slices: scan.slices.length, kept: total, wires: cutPlan.wires.length,
        noFixTarget: unfixable, skipped: plan.slices.length - total - unfixable.length, running: running.map((j) => j.job_id) };
      human = `re-cut ${cutId}: ${retire.length} queued unit(s) retired, ${total} planned unit(s) in ${newCut} + ${cutPlan.wires.length} wire leg(s)${unfixable.length ? `, ${unfixable.length} slice(s) refused (no fix target: cut again)` : ''}`;
    } else if (edit === 'undo') {
      const id = String(args.undo ?? '');
      const ev = db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? AND entity_id=?').get(wf, GRAPH_EDIT_KIND, id);
      if (!ev) throw refuse(`edit ${id} is not in ${wf}`, 'edit-unknown');
      if (db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND kind='kernel-graph-edit-undone' AND entity_id=?").get(wf, id)) throw refuse(`edit ${id} is already undone`, 'edit-undone');
      const e = JSON.parse(ev.payload_json);
      const kept = [];
      ledger.transaction(() => {
        for (const jobId of e.created ?? []) {
          const j = jobRow(db, jobId);
          if (j?.status === 'queued' && !dispatchedEver(db, jobId)) { dropJob(ledger, j, { reason: `undo ${id}`, editId, now }); rec.dropped.push(jobId); }
          else if (j) kept.push(`${jobId} (${j.status})`);
        }
        // A dropped unit comes back as a NEW try of its unit (resume_of the cancelled job): cancelled is terminal.
        for (const jobId of e.dropped ?? []) { const restored = restoreJob(ledger, jobId, { editId: id, now }); if (restored) rec.created.push(restored); else kept.push(`${jobId} (not restorable)`); }
        for (const c of e.changed ?? []) {
          const j = jobRow(db, c.jobId);
          if (j?.status === 'queued' && !dispatchedEver(db, c.jobId)) { setPayload(ledger, j, { ...j.payload, ...c.before }, now); rec.changed.push({ jobId: c.jobId, restored: Object.keys(c.before) }); }
          else kept.push(`${c.jobId} (${j?.status ?? 'gone'})`);
        }
        ledger.appendEvent({ workflowId: wf, entityType: 'graph-edit', entityId: id, kind: 'kernel-graph-edit-undone', payload: { by: editId, kept } });
      });
      rec.undoOf = id;
      human = `undid ${id}${kept.length ? `; already dispatched, left alone: ${kept.join(', ')}` : ''}`;
    }

    recordKernel(ledger, { workflowId: wf, entityType: 'graph-edit', entityId: editId, kind: GRAPH_EDIT_KIND, repo, payload: rec,
      msg: `graph-edit ${editId} ${edit}: ${human}`, markdown: `Graph edit **${editId}** (${edit})${decision ? ` for decision ${decision.id}` : ''}\n\n${human}\n\nCreated: ${rec.created.join(', ') || '-'}\nDropped: ${rec.dropped.join(', ') || '-'}\nChanged: ${rec.changed.map((c) => c.jobId).join(', ') || '-'}\n\nUndo: api graph-edit --workflow ${wf} --edit undo --undo ${editId}`,
      refs: [...rec.created, ...rec.dropped].map((j) => `job:${j}`) });
    emit({ ok: true, workflowId: wf, editId, ...rec }, `${editId}: ${human}\n  undo: api graph-edit --workflow ${wf} --edit undo --undo ${editId}`, args.json);
  },
};

