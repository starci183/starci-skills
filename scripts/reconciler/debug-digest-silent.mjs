// debug-digest-silent.mjs - the stops a reconciler pass makes without telling any role, read from the machine store for `starci debug digest`.
//
// A controller that runs a verb for a key records the run in engine_actions; a run that ends `failed` without throwing leaves no queue retry, no Decision Item and no clock, so the
// same run failing on every pass for hours (a Kernel seat watchdog 490 times in a day, a tunnel, a ledger check) was visible only to someone reading the table. A Decision Item that
// the runtime refuses to open (it names no repository) leaves one log row per pass and no item, so the role it was for is never told. Both are departures of the runtime: it owes
// the role a line. The numbers are modules/reconciler/debug-digest.yaml (actionFailMin, actionFailMinMs, silentFreshMs, silentRows).
import { parseJsonOr } from '../lib/json.mjs';

const MIN = 60_000;
const RUN_KEY = (row) => `${row.controller}|${row.verb}|${row.key}`;
const KEY_LIMIT = 80;
const REFUSED = '%reconciler.decision-refused%';

const problem = (key, code, params, evidence, blocks = 1) => ({ area: 'reconciler', blocks, key, code, params, evidence });

/** The unbroken runs of failure that end now: one per (controller, verb, key), {streak, firstAt, lastAt, signature}, newest rows first in `rows`. Pure. */
export function failureRuns(rows) {
  const runs = new Map();
  const closed = new Set();
  for (const row of rows) {
    const id = RUN_KEY(row);
    if (closed.has(id)) continue;
    if (row.state === 'done') { closed.add(id); continue; }
    const run = runs.get(id) ?? { controller: row.controller, verb: row.verb, key: row.key, streak: 0, lastAt: Number(row.at), firstAt: Number(row.at), signature: row.error_signature ?? null };
    run.streak += 1;
    run.firstAt = Number(row.at);
    runs.set(id, run);
  }
  return [...runs.values()].filter((run) => run.streak > 1);
}

/** The refused Decision Items on record, one per item key: {key, kind, code, count, firstAt, lastAt}. Pure. */
export function refusedItems(rows) {
  const items = new Map();
  for (const row of rows) {
    const data = parseJsonOr(row.data_json, {}) ?? {};
    const key = data.decision?.idempotencyKey ?? data.decision?.kind ?? 'unknown';
    const item = items.get(key) ?? { key, kind: data.decision?.kind ?? null, code: data.code ?? null, count: 0, firstAt: Number(row.at), lastAt: Number(row.at) };
    item.count += 1;
    item.firstAt = Math.min(item.firstAt, Number(row.at));
    item.lastAt = Math.max(item.lastAt, Number(row.at));
    items.set(key, item);
  }
  return [...items.values()];
}

/** The facts of one digest: the failing runs and the refused items of the machine store. `ask(sql, args)` is the reader that answers rows or []. */
export function silentFacts(ask, numbers) {
  const rows = ask("SELECT controller, verb, key, state, finished_at AS at, error_signature FROM engine_actions WHERE state IN ('done','failed') AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT ?", [numbers.silentRows]);
  const refused = ask("SELECT at, data_json FROM machine_logs WHERE kind='reconciler.error' AND data_json LIKE ? ORDER BY seq DESC LIMIT ?", [REFUSED, numbers.silentRows]);
  return { actions: failureRuns(rows), refused: refusedItems(refused) };
}

/** Whether a run of the same failure is long, spans enough time and is still happening. */
const standing = (run, now, n) => run.count >= n.actionFailMin && run.lastAt - run.firstAt >= n.actionFailMinMs && now - run.lastAt <= n.silentFreshMs;

/** The problem lines of the silent stops: a reconciler action that fails on every pass, a Decision Item that is refused on every pass. Pure over the facts. */
export function silentProblems(silent, n, now) {
  const actions = (silent?.actions ?? []).map((run) => ({ ...run, count: run.streak })).filter((run) => standing(run, now, n))
    .map((run) => problem(`action-failing-${run.controller}-${run.key}-${run.verb}`, 'action-failing',
      { controller: run.controller, verb: run.verb, key: String(run.key).slice(0, KEY_LIMIT), count: run.streak, min: Math.round((run.lastAt - run.firstAt) / MIN), error: run.signature ?? 'no signature recorded' }, run));
  const refused = (silent?.refused ?? []).filter((item) => standing(item, now, n))
    .map((item) => problem(`decision-refused-${item.key}`, 'decision-refused',
      { key: String(item.key).slice(0, KEY_LIMIT), kind: item.kind ?? 'unknown', code: item.code ?? 'unknown', count: item.count, min: Math.round((item.lastAt - item.firstAt) / MIN) }, item));
  return [...actions, ...refused];
}
