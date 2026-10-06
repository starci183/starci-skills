// starci kernel usage — measured token usage (llm_usage, written by scripts/kernel/usage-record.mjs): by op, by model and for the
// Kernel of one workflow (--workflow <id> [--legs]), or per workflow and by model over the whole ledger (no --workflow).
// Read-only. Its contract is modules/cli/commands/kernel/usage.yaml.
import { getWorkflow } from './shared/rows.mjs';
import { tokenLine, usageOfLedger, usageOfWorkflow } from '../usage-report.mjs';

export const usageLines = (u) => {
  const cov = u.coverage;
  const unavailable = cov.unavailable ? `, ${cov.unavailable} unavailable` : '';
  const pending = cov.pending ? `, ${cov.pending} pending` : '';
  const open = cov.open ? `, ${cov.open} open` : '';
  const lines = [`usage ${u.workflowId}: ${tokenLine(u.total)}; ${cov.measured}/${cov.attempts} attempts measured${unavailable}${pending}${open}`];
  for (const o of u.byOp.slice(0, 20)) lines.push(`  op ${o.opId}: ${tokenLine(o)} (${o.attempts} attempt(s); ${o.models.map((m) => m.model).join(', ')})`);
  for (const m of u.byModel.slice(0, 10)) lines.push(`  model ${m.model}: ${tokenLine(m)}`);
  if (u.kernel.sessions) lines.push(`  kernel (${u.kernel.sessions} session(s)): ${tokenLine(u.kernel)} [${u.kernel.models.map((m) => m.model).join(', ')}]`);
  for (const a of cov.unavailableAttempts.slice(0, 5)) lines.push(`  unavailable attempt ${a.attemptId} ${a.opId}: ${a.reason}`);
  for (const l of u.legs ?? []) lines.push(`  leg #${l.attemptId} ${l.opId} try ${l.tryNo} ${l.agent ?? '-'}/${l.model ?? '-'} [${l.state}]${legTokens(l)}`);
  return lines.join('\n');
};

const legTokens = (l) => (l.tokens != null ? ` ${tokenLine(l)}` : '');

export default {
  verb: 'usage',
  required: [],
  flags: ['legs'],
  usage: '  usage [--workflow <id> [--legs]]   measured tokens by op, model and Kernel of one workflow (--legs: per attempt), or per workflow over the ledger',
  run({ ledger, args, emit }) {
    const db = ledger.db;
    if (args.workflow) {
      if (!getWorkflow(db, args.workflow)) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
      const out = { ok: true, ...usageOfWorkflow(db, args.workflow, { legs: Boolean(args.legs) }) };
      emit(out, usageLines(out), args.json);
      return;
    }
    const workflows = db.prepare('SELECT workflow_id AS workflowId, phase FROM workflows WHERE archived_at IS NULL ORDER BY workflow_id').all()
      .map((w) => { const u = usageOfWorkflow(db, w.workflowId); return { workflowId: w.workflowId, phase: w.phase, total: u.total, kernel: u.kernel, coverage: u.coverage }; });
    const ledgerUsage = usageOfLedger(db);
    const out = { ok: true, ...ledgerUsage, workflows };
    emit(out, [`usage (ledger): ${tokenLine(ledgerUsage.total)}`,
      ...ledgerUsage.byModel.slice(0, 10).map((m) => `  model ${m.model}: ${tokenLine(m)}`),
      ...workflows.map((w) => `  ${w.workflowId} [${w.phase}]: ${tokenLine(w.total)}; kernel ${w.kernel.tokens.toLocaleString('en-US')}; ${w.coverage.measured}/${w.coverage.attempts} attempts measured`)].join('\n'), args.json);
  },
};
