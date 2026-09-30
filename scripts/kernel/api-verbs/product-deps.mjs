// api product-deps — the workflow's serial deps unit (DESIGN §16.7, mitigation 1; scripts/kernel/product-worktree.mjs
// applyDepsUnit). An op's settle refuses deps-unit-required when it changes package.json or a lockfile; this applies
// exactly those manifests as one commit in the workflow's _wf worktree (brought to main first), installs for real there
// (npm ci / pnpm / yarn per its lockfile), lands that commit into main (fast-forward, push), makes the install the
// node_modules overlay source of the workflow's ops and rebuilds their overlays. Then the refused job settles again.
// Serial: the per-repository main lock.
//
//   product-deps --workflow <wf> --from-job <job> [--json]
import { applyDepsUnit, jobWorktreeOf, EVENTS } from '../product-worktree.mjs';

const refuse = (message, code) => Object.assign(new Error(message), { code });

export default {
  verb: 'product-deps',
  required: ['workflow', 'from-job'],
  kernelOnly: true,
  usage: '  product-deps --workflow <id> --from-job <job>   the serial deps unit: apply that job\'s package.json/lockfile changes in its _wf, install there, land them into main, rebuild the op overlays',
  run({ ledger, args, emit }) {
    const db = ledger.db, workflowId = String(args.workflow), jobId = String(args['from-job']);
    const row = db.prepare('SELECT job_id, workflow_id, payload_json FROM jobs WHERE job_id=?').get(jobId);
    if (!row || row.workflow_id !== workflowId) throw refuse(`${jobId} is not a job of ${workflowId}`, 'job-foreign');
    const record = jobWorktreeOf(row);
    if (!record || (record.jobId && record.jobId !== jobId)) throw refuse(`${jobId} never ran in a product worktree: its manifests go through its own land`, 'not-isolated');
    const r = applyDepsUnit({ record });
    ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: r.ok ? 'product-deps-applied' : 'product-deps-failed',
      payload: { fromJob: jobId, branch: 'main', files: r.files ?? [], commit: r.commit ?? null, reason: r.reason ?? null, pushed: r.push?.pushed ?? null,
        install: r.install ? { lock: r.install.lock, ok: r.install.ok, exitCode: r.install.exitCode ?? null, tail: r.install.ok ? null : r.install.tail } : null, rebuilt: (r.rebuilt ?? []).length } }));
    emit({ ok: r.ok, workflowId, fromJob: jobId, ...r, events: EVENTS },
      r.ok ? (r.nothing ? `product-deps ${jobId}: main already carries its manifests; settle it again`
        : `product-deps ${jobId}: ${r.files.join(', ')} landed on main (${String(r.commit).slice(0, 9)}${r.push?.pushed ? ', pushed' : ''})${r.install ? `, installed with ${r.install.argv.join(' ')}` : ', no lockfile to install'}, ${r.rebuilt.length} op overlay(s) rebuilt; now settle ${jobId} again`)
        : `product-deps ${jobId}: REFUSED ${r.reason}${r.install?.tail ? ` - ${r.install.tail}` : ''}${r.rolledBack ? `; ${record.workflow.branch} rolled back, main untouched` : ''}`, args.json);
    if (!r.ok) process.exitCode = 1;
  },
};
