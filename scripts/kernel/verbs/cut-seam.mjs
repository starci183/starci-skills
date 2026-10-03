// starci kernel cut-seam: split from cli.mjs.
import { OP_ROLE } from '../../guards/op-caller.mjs';
import { csvList, getWorkflow, jobOpOf, jobPayloadOf } from './shared/rows.mjs';
import { workflowWorktreeOf } from '../../machine/workflow-tree.mjs';
import { isAwaitingOwner } from '../failure-steps.mjs';
import { SEAM_INTERFACE_EVENT, SEAM_RELEASED_EVENT, SEAM_RECONCILED_EVENT, SEAM_RECONCILE_CHECK, digestInterfaceFiles, isSeamCut, seamStateOf } from '../seam-policy.mjs';

export default {
  verb: 'cut-seam',
  usageInCore: true,
  run({ ledger, args, repo, caller, emit, need, internals }) {
    const db = ledger.db;
    const modes = ['publish-interface', 'release', 'reconcile'].filter((mode) => args[mode]);
    if (modes.length !== 1) throw Object.assign(new Error('cut-seam needs exactly one of --publish-interface | --release | --reconcile'), { code: 'cut-seam-mode' });
    const mode = modes[0];
    if (caller.role === OP_ROLE && (mode !== 'publish-interface' || caller.jobId !== args.job)) {
      throw Object.assign(new Error(`an operation may only publish its own seam interface (starci kernel cut-seam --publish-interface --job ${caller.jobId ?? '<own job>'}); --release and --reconcile are the Kernel's`), { code: 'op-context-refused' });
    }
    const now = Date.now();
    if (mode === 'release') {
      for (const key of ['workflow', 'op', 'cut-id', 'reason']) need(args[key], `cut-seam --release needs --${key}`);
      if (!getWorkflow(db, args.workflow)) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
      const seam = seamStateOf(db, { workflowId: args.workflow, op: args.op, cutId: args['cut-id'], isOwnerWait: (row) => isAwaitingOwner(db, row) });
      if (!seam.head) throw Object.assign(new Error(`cut ${args['cut-id']} of ${args.op} has no seam (ordinal 1) job in ${args.workflow}`), { code: 'cut-seam-unknown' });
      if (seam.passed) throw Object.assign(new Error(`cut ${args['cut-id']} seam ${seam.passedJob} already passed: nothing waits on it`), { code: 'cut-seam-passed' });
      ledger.transaction(() => ledger.appendEvent({ workflowId: args.workflow, entityType: 'job', entityId: seam.head.job_id, kind: SEAM_RELEASED_EVENT,
        payload: { op: args.op, cutId: String(args['cut-id']), reason: String(args.reason), seamJobId: seam.head.job_id, seamStatus: seam.head.status }, createdAt: now }));
      const out = { ok: true, mode, workflowId: args.workflow, op: args.op, cutId: String(args['cut-id']), seamJobId: seam.head.job_id, seamStatus: seam.head.status };
      return emit(out, `cut-seam: released cut ${out.cutId} (${args.op}) to run on a stub while seam ${seam.head.job_id} is ${seam.head.status}; each sibling owes ${SEAM_RECONCILE_CHECK} once the seam lands`, args.json);
    }
    need(args.job, `cut-seam --${mode} needs --job`);
    const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(args.job);
    if (!job) throw Object.assign(new Error(`unknown job ${args.job}`), { code: 'job-unknown' });
    const payload = jobPayloadOf(job), cut = payload.cut, op = jobOpOf(job);
    if (mode === 'publish-interface') {
      if (!isSeamCut(cut)) throw Object.assign(new Error(`${args.job} is not the seam (ordinal 1) of a cut of more than one`), { code: 'cut-seam-not-seam' });
      if (internals.SETTLED.includes(job.status) && job.status !== 'succeeded') throw Object.assign(new Error(`${args.job} is ${job.status}: a failed seam attempt publishes nothing; its retry does`), { code: 'cut-seam-settled' });
      const files = csvList(args.files);
      if (!files.length) throw Object.assign(new Error('cut-seam --publish-interface needs --files <interface files, csv>'), { code: 'cut-seam-files-missing' });
      // The seam writes its interface in the workflow worktree (scripts/machine/workflow-tree.mjs), not the ledger checkout.
      const digests = digestInterfaceFiles({ repo: workflowWorktreeOf({ env: process.env }, job.workflow_id)?.path ?? repo, payload, files });
      ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: SEAM_INTERFACE_EVENT,
        payload: { op, cutId: String(cut.id), files: digests, summary: args.summary ?? null, by: caller.role }, createdAt: now }));
      const out = { ok: true, mode, jobId: job.job_id, workflowId: job.workflow_id, op, cutId: String(cut.id), files: digests };
      return emit(out, `cut-seam: ${job.job_id} published the interface of cut ${cut.id} (${digests.map((f) => f.path).join(', ')}); its ${Number(cut.total) - 1} sibling ordinal(s) are released to build against it`, args.json);
    }
    // reconcile
    if (!cut || !(Number(cut.ordinal) > 1)) throw Object.assign(new Error(`${args.job} is not a sibling ordinal of a cut`), { code: 'cut-seam-not-sibling' });
    if (!cut.seamStub) throw Object.assign(new Error(`${args.job} did not run on a stub: nothing to reconcile`), { code: 'cut-seam-no-stub' });
    if (job.status !== 'succeeded') throw Object.assign(new Error(`${args.job} is ${job.status}: only a passed stub sibling is reconciled`), { code: 'cut-seam-not-passed' });
    const exitCode = Number(args['exit-code']);
    if (args['exit-code'] == null || !Number.isInteger(exitCode)) throw Object.assign(new Error('cut-seam --reconcile needs --exit-code <integer> of the re-verify it ran'), { code: 'cut-seam-exit-code' });
    const seam = seamStateOf(db, { workflowId: job.workflow_id, op, cutId: cut.id, isOwnerWait: (row) => isAwaitingOwner(db, row) });
    if (!seam.passed) throw Object.assign(new Error(`cut ${cut.id} seam has not passed yet: reconcile against the real seam once it lands`), { code: 'cut-seam-not-landed' });
    ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: SEAM_RECONCILED_EVENT,
      payload: { op, cutId: String(cut.id), exitCode, via: 'reconcile', command: args.command ?? null, evidence: args.evidence ?? null, seamJobId: seam.passedJob }, createdAt: now }));
    const out = { ok: true, mode, jobId: job.job_id, workflowId: job.workflow_id, op, cutId: String(cut.id), exitCode, check: SEAM_RECONCILE_CHECK, seamJobId: seam.passedJob };
    return emit(out, `cut-seam: ${SEAM_RECONCILE_CHECK} ${exitCode === 0 ? 'green' : 'RED'} for ${job.job_id} (ordinal ${cut.ordinal} of cut ${cut.id}) against seam ${seam.passedJob}${exitCode === 0 ? '' : '; redo that ordinal as a new attempt (starci kernel status nextActions)'}`, args.json);
  },
};
