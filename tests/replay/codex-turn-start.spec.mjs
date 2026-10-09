// Replay of the Nivo stall of 2026-10-09 (registry: codex-prompt-chip-never-submitted-and-launch-left-alive, worker-start-prompt-pasted-not-filed, dead-agent-terminals-of-failed-launches-uncollected,
// op-launched-critic-turn-start-unobserved): every launch of a codex worker through Orca's worker-start ended outcome_unknown / turn_start_unobserved. Codex 0.160 folded the 16.8 KB
// Task spec the runtime pasted into a "[Pasted Content N chars]" chip and the Enter that followed did not submit it; the terminal stood idle with the prompt in its input box, the
// launch answered `terminal: null`, nothing closed the worker, and the engine retried the same launch (one dead codex terminal per try; the Nivo Kernel stood unstarted for hours).
// Sequence: the ready interface op is dispatched (the same settleLaunch as a Kernel start's) while the host's worker-start answers the unobserved turn with the chip in the input box.
//   1. the Enter the host swallowed is pressed once by the runtime, which launched the terminal: the start stands (dispatched);
//   2. the chip survives that Enter: the launch is refused TURN_START_UNOBSERVED and the worker and its terminal are closed before the next try;
//   3. whatever the host does, the Task spec the runtime hands to worker-start is a short pointer to a file, never the prompt itself (content is a file, the reference travels).
// Real: dispatch-ready and its dispatch child (admission, launch, cleanup), the engine. Stubbed: the Orca binary only (tests/helpers/fake-orca.mjs mode turn-start-unobserved).
// Not replayed: the Kernel start itself (scripts/kernel/start-workflow.mjs runs the same startAgent/settleLaunch; the copy's inbox and goal are not part of the fixture).
// Fixture: tests/fixtures/replay/codex-turn-start.json (extracted from the Nivo ledger copy, neutral).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';
import { ledgerView } from '../../scripts/supervisor/gc-registry.mjs';

const fixture = loadFixture('codex-turn-start');
const draw = fixture.jobs.find((job) => job.op === 'interface.draw');
const push = (world) => world.cli('dispatch-ready', ['--workflow', world.wf, '--foreground'], { timeout: 300_000 }).json.results[0] ?? { dispatched: false, error: 'the push listed no job' };

function launched(t, { chipEnter }) {
  const world = replayWorld(t, fixture, { tree: true, launch: true });
  Object.assign(world.env, { STARCI_FAKE_ORCA_MODE: 'turn-start-unobserved', ...(chipEnter ? { STARCI_FAKE_ORCA_CHIP_ENTER: 'submits' } : {}) });
  assert.equal(world.ack([draw.op]).status, 0, 'the Kernel attests its READ of the op');
  return { world, result: push(world) };
}

test('1: the Enter the host swallowed is pressed once by the runtime and the start stands', (t) => {
  const { world, result } = launched(t, { chipEnter: true });
  assert.equal(result.dispatched, true, `the launch stands: ${JSON.stringify(result)}`);
  const orca = world.orca();
  assert.deepEqual((orca.chipEnters ?? []).map((send) => send.submits), [true], 'one Enter-only send, no second paste');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true, 'the engine restarts over the dispatched job');
});

test('2: a chip that survives the Enter is refused TURN_START_UNOBSERVED, with its worker closed before the next try', (t) => {
  const { world, result } = launched(t, { chipEnter: false });
  assert.equal(result.dispatched, false);
  assert.match(String(result.error), /TURN_START_UNOBSERVED/, `the refusal is catalogued: ${result.error}`);
  const orca = world.orca();
  assert.equal((orca.chipEnters ?? []).length, 1, 'the runtime pressed Enter once and no more');
  const states = Object.values(orca.workerStates ?? {});
  assert.ok(states.length > 0 && states.every((state) => ['stopped', 'released'].includes(state)), `no worker is left alive and unowned: ${JSON.stringify(orca.workerStates)}`);
  assert.equal(world.ledger((ledger) => ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='op-dispatched'").get().n), 0, 'no op was dispatched');
});

test('3: the Task spec handed to worker-start is a short pointer to a file that holds the prompt', (t) => {
  const { world } = launched(t, { chipEnter: true });
  const [start] = world.orca().workerStarts ?? [];
  assert.ok(start, 'worker-start was called');
  assert.ok(start.spec.length < 2000, `the spec is a pointer, not the prompt (${start.spec.length} chars)`);
  const file = /PACKET FILE[^\n]*\n\s+(\S.*)\n/.exec(start.spec)?.[1];
  assert.ok(file && fs.existsSync(file), `the pointer names a file that exists: ${file}`);
  assert.ok(fs.statSync(file).size > 2000, 'and the file holds the whole prompt');
});

test('4: the Run of a Kernel launch that failed is one the agents collector lists, so the dead agent terminal it left is collected (registry: dead-agent-terminals-of-failed-launches-uncollected)', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  world.ledger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId: world.wf, entityType: 'kernel', entityId: world.wf, kind: 'kernel-start-failed',
    payload: { step: 'worker-start', error: 'TURN_START_UNOBSERVED: x', terminal: 'term_dead', runId: 'run_failed_launch', dispatch: 'ctx_dead', effectState: 'unknown' } })));
  assert.deepEqual(ledgerView(world.repo).launchRuns, ['run_failed_launch'], 'no job names this Run: only the failed launch event does');
});
