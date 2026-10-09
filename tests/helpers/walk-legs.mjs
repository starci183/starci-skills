// walk-legs.mjs - one leg of the walk: the Kernel's menu is read and answered, the leg is enqueued, dispatched, worked by the stand-in, reported, settled by the real engine.
import assert from 'node:assert/strict';
import { LEG_PATHS, STANDINS } from './walk-standins.mjs';

const FIRST_LEG = 'scope.define';

/** The leg the Kernel takes: the menu item of the leg when the runtime offers one (answered through `decide`), else the Kernel's own enqueue (the first leg has no item). */
export function enqueueLeg(walk, op) {
  walk.ack(op);
  const paths = LEG_PATHS[op].join(',');
  const item = walk.menuItem(op);
  if (!item) {
    const direct = walk.enqueue(op, paths);
    return { via: 'enqueue', menu: null, ...direct };
  }
  const choices = (item.options ?? item.choices ?? []).map((o) => o.choice ?? o.id);
  const proposed = choices.includes('enqueue-proposed');
  const answered = walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', item.id, '--choice', proposed ? 'enqueue-proposed' : 'enqueue-leg', ...(proposed ? [] : ['--text', paths]), '--reason', 'walk']);
  const jobId = answered.json?.steps?.flatMap?.((s) => s.result?.job_id ?? []).at?.(0) ?? answered.json?.result?.job_id ?? null;
  return { via: 'decide', menu: { id: item.id, choices }, ok: answered.status === 0, result: answered, jobId };
}

/** Walks one leg to its settlement. Answers {op, jobId, steps: [{step, ok, note}], settled}. */
export function walkLeg(walk, op, { within = null } = {}) {
  const steps = [];
  let mark = Date.now();
  const note = (step, ok, detail) => { steps.push({ step, ok, detail, ms: Date.now() - mark }); mark = Date.now(); return ok; };
  const queued = enqueueLeg(walk, op);
  if (!note(`enqueue(${queued.via})`, queued.ok !== false, queued.result)) return { op, steps, settled: false };
  const jobId = queued.jobId ?? walk.world.ledger((ledger) => ledger.db.prepare("SELECT job_id FROM jobs WHERE op_id=? AND role='op' ORDER BY created_at DESC LIMIT 1").get(op)?.job_id);
  assert.ok(jobId, `${op}: the enqueue left no job`);
  const dispatched = walk.dispatch();
  if (!note('dispatch', dispatched.json?.results?.[0]?.dispatched === true, dispatched)) return { op, jobId, steps, settled: false };
  const work = STANDINS[op]({ walk, jobId });
  note('work', Object.values(work.steps).every((r) => r.status === 0), Object.fromEntries(Object.entries(work.steps).map(([k, r]) => [k, { status: r.status, out: r.status === 0 ? undefined : (r.json?.refused ?? r.json ?? r.stdout), err: String(r.stderr ?? '').slice(0, 600) }])));
  const filed = walk.file(jobId, work.report, work.attach);
  if (!note('report', filed.status === 0, filed)) return { op, jobId, steps, settled: false };
  const engine = walk.engine({ op, within });
  note('engine', engine.ok === true, engine);
  const job = walk.job(jobId);
  return { op, jobId, steps, settled: job.status === 'succeeded', status: job.status };
}

export { FIRST_LEG };
