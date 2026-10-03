// starci kernel unit — the work units of a workflow and their try budgets (H3, Q13; DBTREE work_units.try_budget).
//
//   unit --workflow <wf> [--unit <id>]                                                show units: state, tries, budget
//   unit --workflow <wf> --unit <id> --raise-budget <n> --by owner|supervisor --ref <di|incident>
//
// Only the owner or the Supervisor raises a budget, always with who and why (work_units.budget_raised_by/ref); a Kernel
// never does - a spent budget is exactly the moment it must stop and ask.
import { getUnit, raiseTryBudget } from '../../../engine/db/ledger.mjs';
import { getWorkflow } from './shared/rows.mjs';
import { spentTriesOf } from '../units.mjs';

const RAISERS = ['owner', 'supervisor'];
const refuse = (message, code) => Object.assign(new Error(message), { code });

export default {
  verb: 'unit',
  required: ['workflow'],
  usage: '  unit --workflow <id> [--unit <id>] [--raise-budget <n> --by owner|supervisor --ref <di|incident>]   the work units and their try budgets; only the owner or Supervisor raises one',
  run({ ledger, args, emit }) {
    const db = ledger.db, workflowId = args.workflow;
    if (!getWorkflow(db, workflowId)) throw refuse(`unknown workflow ${workflowId}`, 'workflow-unknown');
    if (args['raise-budget'] != null) {
      const unitId = String(args.unit ?? '').trim();
      const unit = unitId ? getUnit(db, workflowId, unitId) : null;
      if (!unit) throw refuse(`--unit ${unitId || '(missing)'} is no work unit of ${workflowId}`, 'unit-unknown');
      if (!RAISERS.includes(args.by)) throw refuse(`--by must be ${RAISERS.join('|')}: only the owner or the Supervisor raises a try budget (Q13)`, 'unit-budget-raiser');
      const ref = String(args.ref ?? '').trim();
      if (!ref) throw refuse('--raise-budget needs --ref <decision item or incident>: who asked and why', 'unit-budget-unexplained');
      const tryBudget = Number(args['raise-budget']);
      if (!Number.isInteger(tryBudget) || tryBudget <= Number(unit.try_budget)) throw refuse(`--raise-budget ${args['raise-budget']} must be an integer above the current budget ${unit.try_budget}`, 'unit-budget-invalid');
      ledger.transaction((tx) => raiseTryBudget(tx, { workflowId, unitId, tryBudget, by: args.by, ref }));
      return emit({ ok: true, workflowId, unitId, from: Number(unit.try_budget), tryBudget, by: args.by, ref, tries: Number(unit.tries) },
        `unit ${unitId}: try budget ${unit.try_budget} -> ${tryBudget} (by ${args.by}, ref ${ref}); ${unit.tries} tried`, args.json);
    }
    const rows = args.unit ? [getUnit(db, workflowId, String(args.unit))].filter(Boolean)
      : db.prepare('SELECT * FROM work_units WHERE workflow_id=? ORDER BY created_at').all(workflowId);
    const units = rows.map((u) => ({ unitId: u.unit_id, op: u.op_id, subjectKey: u.subject_key, state: u.state, tries: spentTriesOf(db, u), budget: Number(u.try_budget),
      exhausted: spentTriesOf(db, u) >= Number(u.try_budget), currentJobId: u.current_job_id, ...(u.reopen_reason ? { reopen: { reason: u.reopen_reason, by: u.reopened_by } } : {}) }));
    emit({ ok: true, workflowId, units },
      units.map((u) => `${u.unitId} ${u.op} ${u.state} tries ${u.tries}/${u.budget}${u.exhausted ? ' EXHAUSTED' : ''} current ${u.currentJobId ?? '-'}`).join('\n') || 'no work unit', args.json);
  },
};
