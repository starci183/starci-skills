// api settle-tail — the settle's async tail for one settled job (owner ruling settle-runtime-service, 2026-09-28):
// session retention, the Telegram media sender, the input re-baseline and artifact indexing with its evidence copy and
// typed logs. `api settle` queues it (<ledger dir>/settle-tail/<jobId>.json) and starts this verb detached, so the tail
// can neither block nor fail the settle. A run that fails is logged (event settle-tail-failed) and left queued; the
// settler (scripts/reconcile/job-settle.mjs retryDueTails) starts it again after allocation.settler.tail.retryMs, up
// to maxAttempts. A run that succeeds removes the queue file (event settle-tail-done). Idempotent per job.
//
//   settle-tail --job <id> [--json]
import fs from 'node:fs';
import path from 'node:path';
import { claimManager } from '../../connectors/lib.mjs';
import { readJsonFile } from '../../lib/json.mjs';
import { tailDir, tailLockName } from '../../reconcile/job-settle.mjs';
import { SETTLED_JOB_LIST } from '../../../engine/admission.mjs';

const slug = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);

export default {
  verb: 'settle-tail',
  required: ['job'],
  kernelOnly: true,
  usage: '  settle-tail --job <id> [--json]   run the async tail of a settled job (artifact index, evidence copy, session retention, input baseline); api settle queues it',
  async run({ ledger, args, repo, emit, internals }) {
    const db = ledger.db, jobId = String(args.job);
    const file = path.join(tailDir(repo), `${slug(jobId)}.json`);
    const held = claimManager(tailLockName(repo, jobId));
    if (!held.ok) return emit({ ok: true, jobId, action: 'already-running' }, `settle-tail ${jobId}: already running`, args.json);
    try {
      const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
      if (!job) { try { fs.rmSync(file, { force: true }); } catch { /* gone */ } return emit({ ok: false, jobId, code: 'job-unknown' }, `settle-tail ${jobId}: unknown job`, args.json); }
      if (!SETTLED_JOB_LIST.includes(job.status)) return emit({ ok: false, jobId, code: 'job-not-settled', status: job.status }, `settle-tail ${jobId}: not settled (${job.status})`, args.json);
      const rec = readJsonFile(file) ?? { jobId, repo, queuedAt: Date.now(), attempts: 0 };
      const at = Date.now();
      let r;
      try { r = await internals.runSettleTail(ledger, job, repo, {}); } catch (error) { r = { ok: false, errors: [String(error?.message ?? error).slice(0, 300)] }; }
      const ms = Date.now() - at;
      ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: r.ok ? 'settle-tail-done' : 'settle-tail-failed',
        payload: { attempt: (rec.attempts ?? 0) + 1, ms, indexed: r.artifacts?.indexed ?? null, sessionReleased: r.sessionReleased?.released ?? null, ...(r.ok ? {} : { errors: r.errors }) } }));
      if (r.ok) { try { fs.rmSync(file, { force: true }); } catch { /* gone */ } }
      else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ ...rec, attempts: (rec.attempts ?? 0) + 1, lastAt: Date.now(), lastError: (r.errors ?? []).join(' | ').slice(0, 600) })); }
      emit({ ok: r.ok, jobId, ms, artifacts: r.artifacts ?? null, sessionReleased: r.sessionReleased ?? null, errors: r.errors ?? [] },
        `settle-tail ${jobId}: ${r.ok ? 'done' : `FAILED (${(r.errors ?? []).join('; ')}) - queued for retry`} in ${ms}ms`, args.json);
      if (!r.ok) process.exitCode = 1;
    } finally { held.release(); }
  },
};
