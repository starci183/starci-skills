// Smokes E3 and E1 of orca-deep-map REPLACE #9 and #10 (lane SETTLED), against the LIVE Orca. They guard deleting the
// hand-closers (closeOperationTask, staleTasks, quit-agent, close-op-terminal, reap-agent-process), so they run only on
// an explicit opt-in, STARCI_ORCA_LIVE=1, and only from a real Orca terminal (ORCA_TERMINAL_HANDLE set): the no-op
// agents they start are children of that terminal's Run. Without both the spec prints one SKIPPED line and makes no
// Orca call. Every agent the spec starts is stopped and released in its own teardown; it never resets or touches
// another Run.
//   E3  the no-op agent runs scripts/api/orca/send.mjs with its own ids - the exact path `api report` uses to send
//       worker_done - then: does the Dispatch settle (worker-show state succeeded), and is a later task-update of its Task
//       refused (it is, only when Orca settled the Task)?
//   E1  worker-release on a settled Claude, Codex and Devin worker: does any agent process remain afterwards?
// The result of a run is printed as one JSON line per smoke (SMOKE-E3 / SMOKE-E1) for the lane report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { status as orcaStatus } from '../../scripts/api/orca/status.mjs';
import { startAgent } from '../../scripts/agent/lib.mjs';
import { workerOutput } from '../../scripts/machine/worker-output.mjs';
import { workerShow } from '../../scripts/api/orca/worker-show.mjs';
import { workerStop } from '../../scripts/api/orca/worker-stop.mjs';
import { workerRelease } from '../../scripts/api/orca/worker-release.mjs';
import { taskUpdate } from '../../scripts/api/orca/task-update.mjs';
import { processList as listHostProcesses } from '../../scripts/api/process/process-list.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const AGENTS = ['claude', 'codex', 'devin'];
const AGENT_PROCESS_WHERE = "Name='claude.exe' OR Name='codex.exe' OR Name='devin.exe'";
const NOOP_SPEC = `This is a smoke test. Do not read, edit, create or delete anything. Run exactly one shell command, with your own ids from your Orca worker preamble (your task id, your dispatch id, and your terminal handle as --from): node ${ROOT}scripts/api/orca/send.mjs --task-id <your task id> --dispatch-id <your dispatch id> --from <your terminal handle> --dispatch-capability <the dcap_ value of the --dispatch-capability flag in your Orca preamble> --outcome succeeded --report-path smoke . Do not send worker_done any other way. Then stay idle and never exit.`;
const SETTLED = ['succeeded', 'failed'];

const unavailable = () => {
  if (process.env.STARCI_ORCA_LIVE !== '1' && process.env.STARCI_REQUIRE_ORCA_LIVE !== '1') return 'a live Orca smoke runs only with STARCI_ORCA_LIVE=1';
  if (!process.env.ORCA_TERMINAL_HANDLE) return 'no ORCA_TERMINAL_HANDLE: the smoke needs a real Orca terminal to own its Run';
  if (process.platform !== 'win32') return 'the process census is Windows-only';
  const st = orcaStatus();
  return st.ok && st.reachable ? null : `orca runtime not reachable (${String(st.error ?? 'no answer').slice(0, 120)})`;
};
const reason = unavailable();
if (reason) console.log(`SKIPPED: orca settle smokes E3/E1: ${reason}`);
const skip = reason ?? false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const agentPids = () => new Map((listHostProcesses({ where: AGENT_PROCESS_WHERE, timeoutMs: 30000 }) ?? []).map((p) => [p.pid, p]));

// The runtime's one launch path (startAgent -> spawnAgent): pre-trusts the directory, so the first-run trust prompt
// cannot hold the agent, creates the Run from this terminal, starts with --spec and attests the agent.
async function startNoop(agent, label) {
  const started = startAgent({ provider: agent, worktree: ROOT, title: `smoke settled ${label}`, prompt: NOOP_SPEC, objective: `smoke settled ${label}`,
    entry: process.env.ORCA_TERMINAL_HANDLE, request: { smoke: 'settled', label, at: Date.now() } });
  console.log(`SMOKE-START ${JSON.stringify({ label, ok: started.ok, dispatchId: started.dispatchId ?? null, runId: started.runId ?? null, step: started.step ?? null, error: started.error ?? null })}`);
  assert.ok(started.ok, `start ${agent}: ${started.error ?? started.step}`);
  return started;
}
// Before any teardown: the dispatch id and the pane tail, so a stall (a trust prompt, a login) is diagnosable.
const diagnose = (label, a) => {
  const out = workerOutput({ dispatch: a.dispatchId, source: 'terminal', maxPages: 1 });
  const lines = String(out?.text ?? out?.error ?? '').trimEnd().split(String.fromCharCode(10)).slice(-25);
  console.log(`SMOKE-TAIL ${JSON.stringify({ label, dispatchId: a.dispatchId, tail: lines.join(String.fromCharCode(10)) })}`);
};
async function until(read, done, ms = 240_000) {
  const end = Date.now() + ms;
  let last = null;
  while (Date.now() < end) { last = read(); if (done(last)) return last; await sleep(5000); }
  return last;
}
const teardown = (dispatchId) => { workerStop({ dispatch: dispatchId }); return workerRelease({ dispatch: dispatchId }); };

test('E3: worker_done settles the Task; a later task-update is refused', { skip, timeout: 600_000 }, async () => {
  const a = await startNoop('claude', 'e3');
  try {
    const shown = await until(() => workerShow({ dispatch: a.dispatchId }), (r) => SETTLED.includes(r.state));
    diagnose('e3', a);
    const afterUpdate = taskUpdate({ id: a.taskId, status: 'completed', run: a.runId });
    const out = { dispatchStateAfterOrchSend: shown?.state ?? null, laterTaskUpdateOk: afterUpdate.ok, laterTaskUpdateError: afterUpdate.error ?? null };
    console.log(`SMOKE-E3 ${JSON.stringify(out)}`);
    assert.equal(out.dispatchStateAfterOrchSend, 'succeeded', 'send.mjs worker_done did not settle the Dispatch');
    assert.equal(out.laterTaskUpdateOk, false, 'task-update after worker_done was accepted: Orca did not settle the Task');
  } finally { teardown(a.dispatchId); }
});

test('E1: worker-release leaves no agent process (Claude, Codex, Devin)', { skip, timeout: 900_000 }, async () => {
  const results = {};
  for (const agent of AGENTS) {
    const before = agentPids();
    const a = await startNoop(agent, `e1-${agent}`);
    await until(() => workerShow({ dispatch: a.dispatchId }), (r) => SETTLED.includes(r.state), 240_000);
    diagnose(`e1-${agent}`, a);
    const during = agentPids();
    const started = [...during.keys()].filter((pid) => !before.has(pid));
    const released = teardown(a.dispatchId);
    await sleep(10_000);
    const after = agentPids();
    const left = started.filter((pid) => after.has(pid));
    results[agent] = { released: released.ok, startedPids: started, leftAfterRelease: left };
  }
  console.log(`SMOKE-E1 ${JSON.stringify(results)}`);
  for (const [agent, r] of Object.entries(results)) assert.deepEqual(r.leftAfterRelease, [], `${agent}: agent process left after worker-release`);
});
