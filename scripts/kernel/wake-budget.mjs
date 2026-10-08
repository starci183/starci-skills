// wake-budget.mjs — what a wake of the Kernel or the Supervisor spent against the per-wake budget of modules/kernel/roles.yaml
// (kernel.wakeBudget, supervisor.tokenBudget with unit wake). The numbers are the usage rows the runtime already records
// (llm_usage kernel-turn and supervisor-turn rows, scripts/kernel/usage-record.mjs). The sweep cuts a seat's session at the wake
// events, so every row it writes names the wake that owns it in its turn_ref (`...@<turns>#w<wake seq>`; `#w0` is what the seat
// spent before its first wake): a short wake reads its own turns and tokens, never the sum of its neighbours. Rows land when the
// usage sweep runs, so the newest wake may still be short; a wake over budget is a departure of its seat (the digest reports it).
import { rolesContract } from '../machine/roles-contract.mjs';

const KERNEL_WAKE = 'kernel-woken';
const SUPERVISOR_WAKE = 'supervisor-wake';
const roleOf = (id) => rolesContract().roles.find((role) => role.id === id);

/** The per-wake budget {turns, tokens} of the Kernel role. */
export const wakeBudget = () => roleOf('kernel').wakeBudget.perWake;

/** The per-wake budget {tokens} of the Supervisor role (its tokenBudget, unit wake). */
export const supervisorWakeBudget = () => ({ tokens: Number(roleOf('supervisor').tokenBudget.perAttempt.default) });

/** The tag a wake's rows carry in their turn_ref. */
export const wakeTag = (seq) => `w${seq}`;

/** The wake events of a workflow's ledger as [{seq, at}] oldest first. */
export const kernelWakesOf = (db, workflowId) => db.prepare('SELECT seq, created_at AS at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, KERNEL_WAKE)
  .map((row) => ({ seq: Number(row.seq), at: Number(row.at) }));

/** The wake events of the Supervisor in machine.sqlite as [{seq, at}] oldest first. */
export const supervisorWakesOf = (db) => db.prepare('SELECT seq, created_at AS at FROM sup_events WHERE kind=? ORDER BY seq').all(SUPERVISOR_WAKE)
  .map((row) => ({ seq: Number(row.seq), at: Number(row.at) }));

const TOKENS = 'COALESCE(input_tokens,0)+COALESCE(output_tokens,0)+COALESCE(cache_read_tokens,0)+COALESCE(cache_write_tokens,0)';

/** What each wake spent, by the tag its rows carry: Map(tag -> {turns, tokens}). */
function spentByTag(db, where, args) {
  const spent = new Map();
  for (const row of db.prepare(`SELECT turn_ref, COALESCE(turns,0) AS turns, ${TOKENS} AS tokens FROM llm_usage WHERE ${where} AND instr(turn_ref,'#w')>0`).all(...args)) {
    const tag = String(row.turn_ref).slice(String(row.turn_ref).lastIndexOf('#') + 1);
    const cur = spent.get(tag) ?? { turns: 0, tokens: 0 };
    spent.set(tag, { turns: cur.turns + Number(row.turns), tokens: cur.tokens + Number(row.tokens) });
  }
  return spent;
}

const ownedBy = (wakes, spent) => wakes.map(({ seq, at }) => ({ seq, at, ...(spent.get(wakeTag(seq)) ?? { turns: 0, tokens: 0 }) }));

/** The newest `limit` wakes of a workflow with what each spent: [{seq, at, turns, tokens}] oldest first. */
export function wakeUsageOf(db, workflowId, { limit = 20 } = {}) {
  const wakes = kernelWakesOf(db, workflowId).slice(-limit);
  return wakes.length ? ownedBy(wakes, spentByTag(db, "workflow_id=? AND subject_type='kernel-turn'", [workflowId])) : [];
}

/** The newest `limit` wakes of the Supervisor with what each spent: [{seq, at, turns, tokens}] oldest first (machine.sqlite). */
export function supervisorWakeUsageOf(db, { limit = 20 } = {}) {
  const wakes = supervisorWakesOf(db).slice(-limit);
  return wakes.length ? ownedBy(wakes, spentByTag(db, "subject_type='supervisor-turn'", [])) : [];
}

/** The wakes that spent more turns or tokens than the budget. */
export const exceededWakes = (wakes, budget) => wakes.filter((wake) => (budget.turns !== undefined && wake.turns > budget.turns) || wake.tokens > budget.tokens);
