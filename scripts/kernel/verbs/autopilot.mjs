// starci kernel autopilot: workflow autonomy controls.
import { createHash } from 'node:crypto';
import { csvList, verbWorkflow, workflowVerb } from './shared/rows.mjs';
import { AUTOPILOT_BY, AUTOPILOT_EVENTS, autopilotBundle, autopilotOf, autopilotProjection, autopilotSweep, credentialChecklist, deferredToHandoverOf, reopenProvisional } from '../autopilot-run.mjs';
import { wakeKernelForTransition } from '../wake-delivery.mjs';
import { ownerLanguage } from '../../lib/i18n.mjs';

export default workflowVerb('autopilot', ({ ledger, args, repo, emit }) => {
    const { db, workflowId, workflow: wf } = verbWorkflow(ledger, args);
    const reason = typeof args.reason === 'string' && args.reason.trim() ? args.reason.trim() : null;
    const by = typeof args.by === 'string' && ['supervisor', 'kernel', AUTOPILOT_BY].includes(args.by.trim()) ? args.by.trim() : 'supervisor';
    const needReason = (flag) => { if (!reason) throw Object.assign(new Error(`autopilot ${flag} needs --reason <text>`), { code: 'reason-missing' }); };
    const append = (kind, payload, entityType = 'workflow', entityId = workflowId) => ledger.transaction(() => ledger.appendEvent({ workflowId, entityType, entityId, kind, payload }));
    const wake = (l, o) => wakeKernelForTransition(l, { workflowId: o.workflowId, transition: 'ask-answered', ids: { dispatchId: o.dispatchId }, lines: [
      `autopilot answered ask ${o.dispatchId} (answeredBy autopilot); receipt ${o.receiptPath}.`, 'Re-read starci kernel status and run nextActions.'] });
    if (args.set != null) {
      const on = String(args.set).trim().toLowerCase();
      if (!['on', 'off'].includes(on)) throw Object.assign(new Error('autopilot --set takes on|off'), { code: 'set-invalid' });
      needReason('--set');
      append(AUTOPILOT_EVENTS.configured, { on: on === 'on', by, reason });
      const out = { ok: true, workflowId, autopilot: autopilotOf(db, workflowId) };
      emit(out, `autopilot ${on} for ${workflowId} (${reason})`, args.json);
      return;
    }
    if (args.sweep) {
      const out = { ok: true, workflowId, ...autopilotSweep({ ledger, repo, workflowId, wake }) };
      emit(out, `autopilot sweep ${workflowId}: answered ${out.answered.length}, deferred ${out.deferred.length}, rerouted ${out.rerouted.length}, timed out ${out.timedOut.length}, supplied ${out.supplied.length}${out.errors.length ? `, errors ${out.errors.length}` : ''}`, args.json);
      return;
    }
    if (args.bundle) { const out = { ok: true, ...autopilotBundle(db, workflowId) }; emit(out, `${out.title} ${workflowId}: ${JSON.stringify(out.counts)}`, args.json); return; }
    if (args.checklist) { const out = { ok: true, workflowId, ...credentialChecklist(db, workflowId, { lang: args.lang ?? ownerLanguage() }) }; emit(out, out.question.text, args.json); return; }
    if (args['defer-to-handover']) {
      const cls = String(args.class ?? '').trim();
      if (!['credential', 'real-money', 'shared-system', 'owner-decision'].includes(cls)) throw Object.assign(new Error('--defer-to-handover needs --class credential|real-money|shared-system|owner-decision'), { code: 'class-invalid' });
      if (!args.op || !args.detail) throw Object.assign(new Error('--defer-to-handover needs --op <asking op> and --detail <what is owed>'), { code: 'defer-incomplete' });
      const fields = csvList(args.fields);
      const isFile = (f) => /\.[a-z0-9]+$/i.test(f);
      const payload = { key: `need:${args.op}:${createHash('sha256').update(`${cls}|${args.detail}`).digest('hex').slice(0, 10)}`, opId: args.op, jobId: args.job ?? null, by, deferClass: cls, classes: [cls],
        fields: { files: fields.filter(isFile), vars: fields.filter((f) => !isFile(f)) },
        stubPath: typeof args.stub === 'string' && args.stub.trim() ? args.stub.trim() : null, owed: String(args.detail), question: String(args.detail).slice(0, 600) };
      append(AUTOPILOT_EVENTS.deferredToHandover, payload);
      emit({ ok: true, workflowId, ...payload }, `deferred to handover: ${cls} for ${args.op} (${payload.key})`, args.json);
      return;
    }
    if (args.release != null) {
      needReason('--release');
      const key = String(args.release).trim();
      const item = deferredToHandoverOf(db, workflowId).find((i) => i.dispatchId === key || i.key === key);
      if (!item) throw Object.assign(new Error(`${key} is no open deferred-to-handover item of ${workflowId}`), { code: 'deferral-unknown' });
      append(AUTOPILOT_EVENTS.released, { dispatchId: item.dispatchId, key: item.key, by, reason }, 'report', item.dispatchId ?? item.key);
      emit({ ok: true, workflowId, released: item.key, dispatchId: item.dispatchId }, `released ${item.key}: it waits on the owner again${item.dispatchId ? ` - park it with starci kernel serve-ask --dispatch ${item.dispatchId}` : ''}`, args.json);
      return;
    }
    if (args['defer-leg'] != null) {
      needReason('--defer-leg');
      const job = db.prepare('SELECT job_id,op_id,workflow_id FROM jobs WHERE job_id=?').get(String(args['defer-leg']));
      if (!job || job.workflow_id !== workflowId) throw Object.assign(new Error(`${args['defer-leg']} is no job of ${workflowId}`), { code: 'job-unknown' });
      append(AUTOPILOT_EVENTS.deferred, { jobId: job.job_id, jobIds: [job.job_id], opId: job.op_id, by, reason }, 'job', job.job_id);
      emit({ ok: true, workflowId, deferred: job.job_id }, `deferred ${job.job_id} (${job.op_id}) to the final review: ${reason}`, args.json);
      return;
    }
    if (args.reopen != null) {
      if (!args['handover-answer']) throw Object.assign(new Error('--reopen needs --handover-answer <the owner-answered handover dispatch>'), { code: 'handover-answer-missing' });
      const payload = reopenProvisional(ledger, { workflowId, dispatchId: String(args.reopen), handoverDispatchId: String(args['handover-answer']), note: args.note ?? null });
      emit({ ok: true, workflowId, ...payload }, `re-opened provisional ${payload.record ?? payload.dispatchId} from the owner's handover answer ${payload.handoverDispatchId}: ${payload.opId} re-runs`, args.json);
      return;
    }
    if (args['extend-budget'] != null) {
      needReason('--extend-budget');
      const add = Object.fromEntries(csvList(args['extend-budget']).map((pair) => pair.split('=')).filter(([k, v]) => ['attempts', 'tokens', 'wallMs'].includes(k) && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));
      if (!Object.keys(add).length) throw Object.assign(new Error('--extend-budget takes attempts=<n>,tokens=<n>,wallMs=<n>'), { code: 'budget-invalid' });
      append(AUTOPILOT_EVENTS.budgetExtended, { ...add, by, reason });
      emit({ ok: true, workflowId, extended: add }, `autopilot budget of ${workflowId} extended by ${JSON.stringify(add)} (${reason}); resolve the budget supervisor-gate --by supervisor`, args.json);
      return;
    }
    const out = { ok: true, workflowId, ...autopilotProjection(db, workflowId) };
    emit(out, `autopilot ${out.on ? 'ON' : 'off'} (${out.source}) ${workflowId}: provisional ${out.provisional.length}, deferred ${out.deferred.length}, deferred-to-handover ${out.deferredToHandover.length}`, args.json);
});
