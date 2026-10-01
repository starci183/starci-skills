// api contract-release: split from api.mjs.
import { JOB_ROW, getWorkflow, jobPayloadOf } from '../api-lib/rows.mjs';
import { recordJobResult, setJobStatus, updateJob } from '../../../engine/ledger-db.mjs';
import { dispatchEvidenceOf } from '../api-lib/dispatch-state.mjs';
import { CONTRACT_RELEASE_EVENT, contractFollowUpsOf, frozenChangesFor, loadContractChanges, releasedChangesOf } from '../contract-version.mjs';
import { currentRuntimeRev, revRootOf } from '../runtime-rev.mjs';

export default {
  verb: 'contract-release',
  required: ['family'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const db = ledger.db, family = String(args.family).trim(), batchFilter = typeof args.batch === 'string' && args.batch.trim() ? args.batch.trim() : null;
    const registry = loadContractChanges(internals.skillRoot);
    if (!registry.changes.some((c) => c.families.includes(family)) && !(registry.freeze ?? []).some((f) => f.family === family)) {
      throw Object.assign(new Error(`contract-family-unknown: no registered contract change or freeze governs ${family}`), { code: 'contract-family-unknown' });
    }
    const workflows = args.workflow
      ? [getWorkflow(db, args.workflow)].filter(Boolean)
      : db.prepare("SELECT * FROM workflows WHERE phase NOT IN ('finished','archived') ORDER BY created_at").all();
    if (args.workflow && !workflows.length) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
    const dryRun = Boolean(args['dry-run']), now = Date.now(), by = typeof args.by === 'string' ? args.by : 'supervisor';
    const reason = typeof args.reason === 'string' && args.reason.trim() ? args.reason.trim() : null;
    const results = [];
    for (const wf of workflows) {
      const workflowId = wf.workflow_id;
      const released = releasedChangesOf(db, workflowId);
      const covered = frozenChangesFor(db, registry, { workflowId, family, now, released }).filter((c) => !batchFilter || c.batch === batchFilter);
      const owedBefore = contractFollowUpsOf(db, workflowId, registry, { released }).owed;
      const after = new Map([...released, ...covered.map((c) => [c.id, now])]);
      const owedAfter = contractFollowUpsOf(db, workflowId, registry, { released: after }).owed;
      const queued = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND op_id=? AND kind='op' AND status='queued' ORDER BY created_at,job_id`).all(workflowId, family);
      // Never-dispatched duplicates: same cut group and owned paths; the newest stays, an older one nothing waits on goes.
      const keyOf = (job) => { const p = jobPayloadOf(job); return JSON.stringify([p.cut ? [p.cut.id, p.cut.ordinal] : null, [...(p.owned_paths ?? [])].sort()]); };
      const newestByKey = new Map(queued.map((job) => [keyOf(job), job]));
      const waitedOn = (job) => Boolean(db.prepare("SELECT 1 FROM jobs WHERE workflow_id=? AND job_id<>? AND status NOT IN ('succeeded','failed','awaiting_owner','cancelled') AND EXISTS (SELECT 1 FROM json_each(json_extract(payload_json,'$.after')) WHERE value=?)").get(workflowId, job.job_id, job.job_id));
      const drop = covered.length ? queued.filter((job) => newestByKey.get(keyOf(job)).job_id !== job.job_id && !dispatchEvidenceOf(db, job, jobPayloadOf(job)).length && !waitedOn(job)) : [];
      const restamp = covered.length ? queued.filter((job) => !drop.includes(job)) : [];
      const running = db.prepare("SELECT job_id,try_no AS attempt FROM jobs WHERE workflow_id=? AND op_id=? AND kind='op' AND status IN ('running','answering')").all(workflowId, family);
      const entry = { workflowId, changes: covered.map((c) => c.id), alreadyReleased: [...released.keys()].filter((id) => registry.changes.some((c) => c.id === id && c.families.includes(family))),
        owedBefore: owedBefore.length, owedAfter: owedAfter.length, owed: owedAfter.map(({ jobId, op, attempt, status, followUpOp, change, alsoCovers }) => ({ jobId, op, attempt, status, followUpOp, change, alsoCovers: alsoCovers ?? [] })),
        restamped: restamp.map((j) => j.job_id), dropped: drop.map((j) => j.job_id), running: running.map((j) => j.job_id), released: false };
      if (covered.length && !dryRun) {
        ledger.transaction(() => {
          const event = ledger.appendEvent({ workflowId, entityType: 'contract', entityId: family, generation: wf.generation ?? 0, kind: CONTRACT_RELEASE_EVENT, createdAt: now,
            payload: { family, batch: batchFilter ?? [...new Set(covered.map((c) => c.batch))].join(','), changes: entry.changes, by, reason, runtimeSha: currentRuntimeRev(revRootOf()),
              owedBefore: entry.owedBefore, owedAfter: entry.owedAfter, restamped: entry.restamped, dropped: entry.dropped } });
          const stamp = { family, changes: entry.changes, at: now, event: event?.eventId ?? event?.event_id ?? null };
          for (const job of restamp) {
            const payload = jobPayloadOf(job);
            if (db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job.job_id)?.status === 'queued')
              updateJob(db, { jobId: job.job_id, payload: { ...payload, contractRelease: stamp }, at: now });
          }
          for (const job of drop) {
            const by = newestByKey.get(keyOf(job)).job_id;
            if (db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job.job_id)?.status === 'queued') {
              setJobStatus(db, { jobId: job.job_id, to: 'cancelled', reason: 'superseded-by-contract-release', at: now });
              recordJobResult(db, { jobId: job.job_id, result: { verdict: 'dropped', reason: 'superseded-by-contract-release', by, at: now }, at: now });
            }
            ledger.appendEvent({ workflowId, entityType: 'job', entityId: job.job_id, kind: 'job-dropped', payload: { reason: 'superseded-by-contract-release', by, family, auto: true } });
          }
        });
        entry.released = true;
      }
      results.push(entry);
    }
    const out = { ok: true, family, batch: batchFilter, dryRun, workflows: results };
    emit(out, [`contract-release ${family}${batchFilter ? ` batch ${batchFilter}` : ''}${dryRun ? ' (dry run)' : ''}:`,
      ...results.map((r) => `  ${r.workflowId}: ${r.changes.length ? `${r.released ? 'released' : 'would release'} ${r.changes.join(', ')}` : 'nothing frozen'}; owed follow-ups ${r.owedBefore} -> ${r.owedAfter}${r.restamped.length ? `; re-stamped queued ${r.restamped.join(', ')}` : ''}${r.dropped.length ? `; dropped duplicate queued ${r.dropped.join(', ')}` : ''}${r.running.length ? `; running ${r.running.join(', ')} keep their admission` : ''}`)].join('\n'), args.json);
  },
};
