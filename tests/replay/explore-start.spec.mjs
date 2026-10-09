import test from 'node:test';
import fs from 'node:fs';
import { openWalk } from '../helpers/walk-world.mjs';
test('start', { timeout: 300_000 }, (t) => {
  const walk = openWalk(t);
  const out = {};
  const snap = () => { const s = walk.status(); return { frontier: s.frontier.state, actionable: s.frontier.actionable, menu: s.menu.map((m) => m.id), next: s.nextActions, jobs: walk.world.ledger((l) => l.db.prepare("SELECT job_id, op_id, status FROM jobs WHERE role='op'").all()),
    dis: walk.world.ledger((l) => l.db.prepare('SELECT di_id, kind, decider, status FROM decision_items').all()) }; };
  out.t0 = snap();
  out.engine = walk.engine({ passes: 3 });
  out.t1 = snap();
  fs.writeFileSync('D:/starci-tmp/triage/start-state.json', JSON.stringify(out, null, 1));
});
