import test from 'node:test';
import fs from 'node:fs';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { packetOf } from '../helpers/walk-world.mjs';
import { enqueueLeg } from '../helpers/walk-legs.mjs';
import { LEG_PATHS, WORK } from '../helpers/walk-standins.mjs';
const PROBE = process.env.WALK_PROBE ?? 'interface.draw';
test('probe', { timeout: 600_000 }, async (t) => {
  const walk = await seededWalk(t, PROBE);
  const st = walk.status();
  const out = { probe: PROBE, prefix: walk.prefix, menuBefore: st.menu, frontier: st.frontier.state, legs: st.legs.map((l) => [l.op, l.color]) };
  LEG_PATHS[PROBE] ??= JSON.parse(process.env.WALK_PATHS ?? '[]');
  const queued = enqueueLeg(walk, PROBE);
  out.via = queued.via; out.enqueue = queued.result?.json ?? queued.result?.stderr;
  if (queued.ok !== false) {
    const jobId = queued.jobId ?? walk.world.ledger((l) => l.db.prepare("SELECT job_id FROM jobs WHERE op_id=? AND role='op' ORDER BY created_at DESC LIMIT 1").get(PROBE)?.job_id);
    const d = walk.dispatch(); out.dispatch = d.json ?? d.stderr; out.jobId = jobId;
    try { fs.copyFileSync(packetOf(walk.world, jobId), 'D:/starci-tmp/triage/packet-' + PROBE + '.md'); out.packet = true; } catch (error) { out.packet = String(error.message); }
    if (process.env.WALK_REPORT) {
      const env = JSON.parse(process.env.WALK_REPORT);
      const filed = walk.file(jobId, { schema: 'starci/op-report@1', outcome: 'done', summary: 'probe', files: [], checks: [], ...env });
      out.filed = { status: filed.status, json: filed.json ?? filed.stderr };
      out.engine = walk.engine({ op: PROBE, within: ['features/identity'] });
      out.why = walk.why(jobId);
      out.checks = walk.world.ledger((l) => l.db.prepare("SELECT name, runner, status, summary_json FROM check_runs WHERE status != 'pass'").all());
    }
    const s2 = walk.status(); out.after = { menu: s2.menu, frontier: s2.frontier.state, jobs: s2.jobs };
  }
  fs.writeFileSync('D:/starci-tmp/triage/probe-' + PROBE + '.json', JSON.stringify(out, null, 1));
});
