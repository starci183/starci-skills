// walk-scenarios.mjs - the unhappy paths of the walk, each on one leg of a seeded world: what the op does, then what the runtime owns next.
// Every scenario ends in exactly one owned next step (a retry, an upstream repair, a Supervisor or owner item) or the test names the silence.
import fs from 'node:fs';
import path from 'node:path';
import { scratchOf } from './walk-world.mjs';
import { enqueueLeg } from './walk-legs.mjs';
import { STANDINS, WORK } from './walk-standins.mjs';

const BASE = { schema: 'starci/op-report@1', summary: 'walk scenario', files: [], checks: [] };

/** The leg is queued and dispatched; answers its job id. */
export function startLeg(walk, op) {
  const queued = enqueueLeg(walk, op);
  const jobId = queued.jobId ?? walk.world.ledger((ledger) => ledger.db.prepare("SELECT job_id FROM jobs WHERE op_id=? AND role='op' ORDER BY created_at DESC LIMIT 1").get(op)?.job_id);
  const dispatched = walk.dispatch();
  return { jobId, queued, dispatched };
}

/** What the runtime owns after a settle: the job rows of the op, the failure route, the open decision items, the menu and the frontier. */
export function ownedNext(walk, op) {
  const status = walk.status();
  return world(walk, (ledger) => ({
    jobs: ledger.db.prepare("SELECT job_id, status, try_no, retry_of FROM jobs WHERE op_id=? AND role='op' ORDER BY created_at").all(op),
    routed: ledger.db.prepare("SELECT kind, payload_json FROM events WHERE kind IN ('failure-routed','job-settle-needs-kernel','job-rejudge-refused','dead-worker-settled','job-gate-opened') ORDER BY seq").all().map((e) => ({ kind: e.kind, ...pick(JSON.parse(e.payload_json)) })),
    incidents: ledger.db.prepare('SELECT incident_id, kind, owner, status, detail FROM incidents ORDER BY rowid').all(),
    decisions: ledger.db.prepare('SELECT di_id, kind, decider, status FROM decision_items ORDER BY rowid').all(),
    menu: status.menu.map((item) => item.id),
    frontier: { state: status.frontier.state, actionable: status.frontier.actionable },
    nextActions: status.nextActions.map((a) => ({ kind: a.kind, origin: a.origin, op: a.op })),
  }));
}
const world = (walk, fn) => walk.world.ledger(fn);
const pick = (p) => Object.fromEntries(['route', 'kind', 'reason', 'code', 'verdict', 'op', 'shape', 'limit', 'firing', 'detail'].filter((k) => p[k] !== undefined).map((k) => [k, typeof p[k] === 'string' ? p[k].slice(0, 160) : p[k]]));

/** The op files a report of the given shape from its scratch (no product): blocked with a typed blocker, or an ask. */
export const fileShape = (walk, jobId, shape) => walk.file(jobId, { ...BASE, ...shape });

export { STANDINS, WORK, fs, path, scratchOf };
