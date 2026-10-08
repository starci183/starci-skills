// seat-cost.mjs — what each long-lived seat costs against the decisions it made, for `starci reconciler status` and `starci debug digest`.
//
// Per seat (the Supervisor, each workflow's Kernel): its wakes, the wakes after which it decided nothing, the wakes the runtime withheld
// because the menu held no item, the tokens a wake spent (p50, p90, over the wakes whose usage rows carry the wake's tag) and the seat's share
// of every token the machine recorded. A seat whose empty-wake share passes the declared bound is a departure of the RUNTIME, which woke it
// with nothing on its menu (digest problem seat-empty-wakes); the seat did nothing wrong by answering an empty wake with a yield.
import fs from 'node:fs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { seatCostConfig, kernelWakeLog, kernelWorkAts, kernelSkippedLog, supervisorWakeLog, supervisorWorkAts, withWorked } from '../kernel/seat-wakes.mjs';
import { supervisorWakeUsageOf, wakeUsageOf } from '../kernel/wake-budget.mjs';

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null);

/** The wakes of a seat joined with the tokens of the usage rows they own: [{seq, at, cause, worked, turns, tokens}]. Pure. */
export function wakesWithUsage(judged, usage) {
  const byAt = new Map(usage.map((row) => [row.seq, row]));
  return judged.map((wake) => ({ ...wake, turns: byAt.get(wake.seq)?.turns ?? 0, tokens: byAt.get(wake.seq)?.tokens ?? 0 }));
}

/** The by-cause table of a seat's wakes: {cause: {wakes, empty, tokens}}. */
function byCause(wakes, skipped) {
  const table = new Map();
  const rowOf = (cause) => {
    if (!table.has(cause)) table.set(cause, { wakes: 0, empty: 0, tokens: 0, skipped: 0 });
    return table.get(cause);
  };
  for (const wake of wakes) {
    const row = rowOf(wake.cause);
    row.wakes += 1; row.empty += wake.worked ? 0 : 1; row.tokens += wake.tokens;
  }
  for (const item of skipped) rowOf(item.cause).skipped += 1;
  return Object.fromEntries(table);
}

/** One seat's row: wakes, empty wakes and their share, withheld wakes, tokens per wake and the cause table. Pure over the joined wakes. */
export function seatRow({ seat, name, wakes, skipped = [], tokens = null }) {
  const spent = wakes.filter((wake) => wake.tokens > 0).map((wake) => wake.tokens).sort((a, b) => a - b);
  const empty = wakes.filter((wake) => !wake.worked).length;
  const own = tokens ?? wakes.reduce((sum, wake) => sum + wake.tokens, 0);
  return { seat, name, wakes: wakes.length, emptyWakes: empty, emptySharePercent: wakes.length ? Math.round((100 * empty) / wakes.length) : 0,
    withheld: skipped.length, tokens: own, tokensP50: percentile(spent, 0.5), tokensP90: percentile(spent, 0.9), measuredWakes: spent.length,
    byCause: byCause(wakes, skipped) };
}

/** The Kernel row of one workflow from its ledger. */
export function kernelSeatOf(db, { workflowId, name = workflowId, now = Date.now() }) {
  const wakes = wakesWithUsage(withWorked(kernelWakeLog(db, workflowId), kernelWorkAts(db, workflowId), { now }), wakeUsageOf(db, workflowId, { limit: 100000 }));
  const kernelTokens = db.prepare("SELECT COALESCE(SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)+COALESCE(cache_read_tokens,0)+COALESCE(cache_write_tokens,0)),0) AS tokens FROM llm_usage WHERE workflow_id=? AND subject_type='kernel-turn'").get(workflowId).tokens;
  return seatRow({ seat: 'kernel', name, wakes, skipped: kernelSkippedLog(db, workflowId), tokens: Number(kernelTokens) });
}

/** The Supervisor row from machine.sqlite. */
export function supervisorSeatOf(db, { now = Date.now() } = {}) {
  const wakes = wakesWithUsage(withWorked(supervisorWakeLog(db), supervisorWorkAts(db), { now }), supervisorWakeUsageOf(db, { limit: 100000 }));
  const tokens = db.prepare("SELECT COALESCE(SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)+COALESCE(cache_read_tokens,0)+COALESCE(cache_write_tokens,0)),0) AS tokens FROM llm_usage WHERE subject_type='supervisor-turn'").get().tokens;
  return seatRow({ seat: 'supervisor', name: 'Supervisor', wakes, tokens: Number(tokens) });
}

/** The rows with `sharePercent` of the total the machine recorded (`total` = seats + attempts). Pure. */
export function withShares(rows, total) {
  return rows.map((row) => ({ ...row, sharePercent: total > 0 ? Math.round((1000 * row.tokens) / total) / 10 : 0 }));
}

/** The seats whose empty-wake share passes the declared bound (a seat with fewer wakes than minWakes is not judged). */
export function seatsOverEmptyBound(rows, config = seatCostConfig()) {
  return rows.filter((row) => row.wakes >= config.minWakes && row.emptySharePercent > config.emptyWakeSharePercent);
}

/** The seat cost of the whole machine: {seats: [...], totalTokens, bound}. `machine` and `ledgers` are open readers; nothing is written. */
export function collectSeatCost({ machineDb, ledgers, now = Date.now() }) {
  const rows = [];
  let attemptTokens = 0;
  for (const ledger of ledgers) {
    const db = openLedgerReader(ledger.file);
    try {
      for (const wf of db.prepare("SELECT workflow_id, COALESCE(display_name, title, workflow_id) AS name FROM workflows").all()) rows.push(kernelSeatOf(db, { workflowId: wf.workflow_id, name: `${ledger.name ?? ledger.ledgerId}: ${wf.name}`, now }));
      attemptTokens += Number(db.prepare("SELECT COALESCE(SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)+COALESCE(cache_read_tokens,0)+COALESCE(cache_write_tokens,0)),0) AS tokens FROM llm_usage WHERE subject_type='attempt'").get().tokens);
    } finally { db.close(); }
  }
  if (machineDb) rows.push(supervisorSeatOf(machineDb, { now }));
  const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0) + attemptTokens;
  const config = seatCostConfig();
  return { seats: withShares(rows, totalTokens), totalTokens, attemptTokens, bound: { emptyWakeSharePercent: config.emptyWakeSharePercent, minWakes: config.minWakes } };
}

/** The seat cost of this machine (every registered ledger and the Supervisor seat), or null with the reason when a store cannot be read. Never throws. */
export function machineSeatCost({ env = process.env, now = Date.now() } = {}) {
  try {
    let cost = null;
    readMachine((m) => { cost = collectSeatCost({ machineDb: m.db, ledgers: m.listLedgers().filter((l) => l.file && fs.existsSync(l.file)), now }); }, null, { env });
    return cost;
  } catch (error) { return { seats: [], error: String(error?.message ?? error).slice(0, 200) }; }
}

const million = (n) => (n == null ? '-' : `${(n / 1e6).toFixed(1)}M`);

/** The `reconciler status` lines of the seat cost: one per seat with wakes or tokens. */
export function seatCostLines(cost) {
  if (!cost?.seats?.length) return [];
  const lines = cost.seats.filter((row) => row.wakes || row.tokens).map((row) => {
    const over = seatsOverEmptyBound([row]).length ? ' OVER-BOUND' : '';
    return `    ${row.name}: ${row.wakes} wakes, ${row.emptyWakes} empty (${row.emptySharePercent}%)${over}, ${row.withheld} withheld; per wake p50 ${million(row.tokensP50)} p90 ${million(row.tokensP90)}; ${million(row.tokens)} tokens, ${row.sharePercent}% of the machine`;
  });
  return lines.length ? [`  seat cost (empty-wake bound ${cost.bound.emptyWakeSharePercent}%):`, ...lines] : [];
}
