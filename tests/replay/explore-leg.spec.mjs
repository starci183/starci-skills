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
  fs.writeFileSync(`D:/starci-tmp/triage/leg-${OP}.json`, JSON.stringify({ ...line, detail: out.steps.filter((x) => !x.ok), why: out.jobId && !out.settled ? walk.why(out.jobId) : null, menu: !out.settled ? walk.status().menu : null,
    checks: out.jobId ? walk.world.ledger((l) => l.db.prepare("SELECT name, runner, status, summary_json FROM check_runs WHERE status != 'pass'").all()) : null }, null, 1));
});
