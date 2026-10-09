// driver.mjs - the child process of world.engine(): the REAL reconciler Engine over a replay world, `passes` passes, then a JSON line on stdout.
// A fresh process per call is the "engine restarts here" step: no module state, queue or status cache survives between calls.
// The only stubs: the Orca binary (STARCI_ORCA_COMMAND, set by the world) and, for the settler script, the Critic agent launch (fake-critic-orca).
// The settler (scripts/kernel/settle/job-settle-main.mjs) is the real `reconcileJobSettle`, run in this process instead of a grandchild so that its
// Critic launch seam can be handed in; every `starci kernel ...` verb it and the controllers call is still a real child process.
import path from 'node:path';
import { Engine } from '../../scripts/reconciler/engine.mjs';
import { runOnce } from '../../scripts/reconciler/engine-once.mjs';
import { spawnJson } from '../../scripts/reconciler/ctx.mjs';
import { reconcileJobSettle } from '../../scripts/kernel/settle/job-settle.mjs';
import { fakeCriticOrca } from './fake-critic-orca.mjs';
import { criticVerdictFor } from './replay-critic-verdict.mjs';

const spec = JSON.parse(process.argv[2]);
const argAfter = (args, flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

/** The settler run in-process with the stubbed Critic launch; answers what spawnJson answers for the child. */
async function settleInProcess(args, env) {
  const critic = spec.critic ? { orca: fakeCriticOrca({ mode: spec.critic.mode ?? 'judge', verdict: (start) => criticVerdictFor(spec.critic, start) }) } : {};
  const result = await reconcileJobSettle({ repo: argAfter(args, '--repo'), jobId: argAfter(args, '--job'), env, criticSeams: critic });
  const value = { ok: result.ok !== false, results: [result] };
  return { ok: value.ok, code: value.ok ? 0 : 1, stdout: JSON.stringify(value), stderr: '', value };
}

// With spec.foregroundPush the parallelism push is the real verb run in the foreground: without --foreground it hands the push to a detached child that outlives the pass and races
// whatever the spec does next (the ack of a READ, its own push). The verb is the same; only the process model that lets a pass end before the push does is not reproduced.
const foregroundPush = (args) => (spec.foregroundPush === true && args.includes('dispatch-ready') && !args.includes('--foreground') && !args.includes('--dry-run') ? [...args, '--foreground'] : args);
// The GC controller's housekeeping key runs the real `housekeeping.mjs --apply`: on a world that lives in the temp directory it archives the world's own ledger as an orphan (its source roots are
// under the temp directory) while the other keys of the same pass read it. Housekeeping is not what a replay judges, so it answers ok without running.
const housekeepingStub = () => ({ ok: true, code: 0, stdout: '{}', stderr: '', value: { ok: true } });
const spawnChild = (cmd, args, options) => {
  if (String(args[0]).endsWith('housekeeping.mjs')) return housekeepingStub();
  return String(args[0]).endsWith('job-settle-main.mjs') ? settleInProcess(args, options.env) : spawnJson(cmd, foregroundPush(args), options);
};
const NUMBERS = { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 1, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } };
const controllers = Object.fromEntries(spec.controllers.map((name) => [name, { mode: 'active' }]));
const ledgers = [{ ledgerId: spec.ledgerId, name: path.basename(spec.repo), repo: spec.repo, file: spec.ledgerFile }];
const engine = new Engine({ env: process.env, numbers: NUMBERS, config: () => ({ enabled: true, controllers }), ledgers, claimLock: () => ({ ok: true, release() {} }), spawnChild,
  memoryQueue: true, writeLog: () => true, print: () => {} });
const passes = [];
try {
  await engine.load();
  const led = engine.acquire();
  for (let i = 0; i < spec.passes; i += 1) passes.push(await runOnce(engine));
  console.log(JSON.stringify({ ok: led.ok, epoch: led.epoch ?? null, passes: passes.map((p) => ({ ok: p.ok, loadErrors: p.loadErrors, controllers: p.controllers.map((c) => ({ name: c.name, keys: c.keys, ok: c.ok, failed: c.failed })) })) }));
} finally { engine.close({ releaseLead: true }); }
