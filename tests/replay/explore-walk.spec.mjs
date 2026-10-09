import test from 'node:test';
import fs from 'node:fs';
import { openWalk, WALK_OPS, packetOf } from '../helpers/walk-world.mjs';
import { walkLeg, enqueueLeg } from '../helpers/walk-legs.mjs';
const UNTIL = process.env.WALK_UNTIL ?? 'scope.define';
const OPS = WALK_OPS.filter((op) => !['request.analyze'].includes(op));
test('explore', { timeout: 3_000_000 }, async (t) => {
  const walk = openWalk(t);
  const dump = [];
  for (const op of OPS) {
    const started = Date.now();
    const out = await walkLeg(walk, op, { within: ['features/identity'] });
    const line = { op, settled: out.settled, ms: Date.now() - started, steps: out.steps.map((s) => `${s.step}:${s.ok}:${s.ms}`) };
    console.log('LEG', JSON.stringify(line));
    dump.push({ ...line, detail: out.steps.filter((x) => !x.ok), why: out.jobId && !out.settled ? walk.why(out.jobId) : null, menu: !out.settled ? walk.status().menu : null,
      checks: out.jobId ? walk.world.ledger((l) => l.db.prepare("SELECT name, runner, status, summary_json FROM check_runs WHERE status != 'pass'").all()) : null });
    fs.writeFileSync('D:/starci-tmp/triage/walk-last.json', JSON.stringify(dump, null, 1));
    if (!out.settled || op === UNTIL) break;
  }
  const probe = process.env.WALK_PROBE;
  if (probe) {
    const queued = enqueueLeg(walk, probe);
    const out = { probe, via: queued.via, menu: queued.menu, enqueue: queued.result?.json ?? queued.result?.stderr };
    if (queued.ok !== false) {
      const jobId = queued.jobId ?? walk.world.ledger((l) => l.db.prepare("SELECT job_id FROM jobs WHERE op_id=? AND role='op' ORDER BY created_at DESC LIMIT 1").get(probe)?.job_id);
      const dispatched = walk.dispatch();
      out.dispatch = dispatched.json ?? dispatched.stderr;
      out.jobId = jobId;
      try { fs.copyFileSync(packetOf(walk.world, jobId), 'D:/starci-tmp/triage/packet-' + probe + '.md'); out.packet = true; } catch (error) { out.packet = String(error.message); }
      out.status = walk.status();
      out.status = { menu: out.status.menu, frontier: out.status.frontier.state, legs: out.status.legs.map((l) => [l.op, l.color]) };
    }
    fs.writeFileSync('D:/starci-tmp/triage/probe-last.json', JSON.stringify(out, null, 1));
  }
});
