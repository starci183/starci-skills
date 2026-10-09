import test from 'node:test';
import fs from 'node:fs';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { walkLeg } from '../helpers/walk-legs.mjs';
const OP = process.env.WALK_OP;
test('leg ' + OP, { timeout: 900_000 }, async (t) => {
  const walk = await seededWalk(t, OP);
  const started = Date.now();
  const out = await walkLeg(walk, OP, { within: ['features/identity'] });
  const line = { op: OP, settled: out.settled, ms: Date.now() - started, steps: out.steps.map((s) => `${s.step}:${s.ok}:${s.ms}`) };
  console.log('LEG', JSON.stringify(line));
  const after = () => { const s = walk.status(); return { frontier: s.frontier, nextActions: s.nextActions, menu: s.menu.map((m) => [m.id, m.options.map((o) => o.choice)]), failures: s.failures, stuck: s.stuck, awaitingOwner: s.awaitingOwner, progress: s.progress,
    dis: walk.world.ledger((l) => l.db.prepare('SELECT di_id, kind, decider, status, summary FROM decision_items').all()) }; };
  const state1 = after();
  walk.engine({ passes: 2 });
  const state2 = after();
  fs.writeFileSync(`D:/starci-tmp/triage/after-${OP}.json`, JSON.stringify({ state1, state2 }, null, 1));
  fs.writeFileSync(`D:/starci-tmp/triage/leg-${OP}.json`, JSON.stringify({ ...line, detail: out.steps.filter((x) => !x.ok), why: out.jobId && !out.settled ? walk.why(out.jobId) : null, menu: !out.settled ? walk.status().menu : null,
    checks: out.jobId ? walk.world.ledger((l) => l.db.prepare("SELECT name, runner, status, summary_json FROM check_runs WHERE status != 'pass'").all()) : null }, null, 1));
});
