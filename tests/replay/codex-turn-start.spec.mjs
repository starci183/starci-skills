// Replay of the Nivo stall of 2026-10-09 (registry: codex-prompt-chip-never-submitted-and-launch-left-alive, worker-start-prompt-pasted-not-filed, dead-agent-terminals-of-failed-launches-uncollected,
// op-launched-critic-turn-start-unobserved): every launch of a codex worker through Orca's worker-start ended outcome_unknown / turn_start_unobserved. Codex 0.160 folded the 16.8 KB
// Task spec the runtime pasted into a "[Pasted Content N chars]" chip and the Enter that followed did not submit it; the terminal stood idle with the prompt in its input box, the
// launch answered `terminal: null`, nothing closed the worker, and the engine retried the same launch (one dead codex terminal per try; the Nivo Kernel stood unstarted for hours).
// Sequence: the ready interface op is dispatched (the same settleLaunch as a Kernel start's) while the host's worker-start answers the unobserved turn with the chip in the input box.
//   1. the Enter the host swallowed is pressed once by the runtime, which launched the terminal: the start stands (dispatched);
//   2. the chip survives that Enter: the launch is refused TURN_START_UNOBSERVED and the worker and its terminal are closed before the next try;
//   3. whatever the host does, the Task spec the runtime hands to worker-start is a short pointer to a file, never the prompt itself (content is a file, the reference travels).
// Real: dispatch-ready and its dispatch child (admission, launch, cleanup), the engine. Stubbed: Orca (tests/helpers/fake-orca.mjs mode turn-start-unobserved).
// The Kernel-start cases also record engine/service observations; native launcher and database checks run, and host startup actuators are refused.
// Tests 5 and 6 replay the Kernel start itself (`starci workflow start`, the same startAgent/settleLaunch) through the prompt-file delivery: the Kernel's 10.8 KB prompt was pasted whole under the old 16000-character
// bound and is a pointer to its file under the 2000-character one. Test 3 does NOT tell the two revisions apart: the op packet of this fixture is 28 KB and spilled to a file before the fix too (it pins the pointer shape only);
// the claim 'content is a file, the reference travels' is carried by tests 5 and 6, which fail on b4c6fcd44.
// Fixture: tests/fixtures/replay/codex-turn-start.json (extracted from the Nivo ledger copy, neutral).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadFixture, replayWorld, ROOT } from '../helpers/replay-world.mjs';
import { postInbox } from '../../engine/db/ledger.mjs';
import { writeInstallMarker } from '../../scripts/machine/npm-install-state.mjs';
import { ledgerView } from '../../scripts/supervisor/gc-registry.mjs';
import { writeRuntimeShim } from '../../packages/cli/src/shim.mjs';

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

/** A world whose Kernel is not yet started: a pending goal in the inbox, a linked workflow worktree with a finished install, the Orca stub answering the chip of a pasted prompt. */
function kernelStart(t, { chipEnter }) {
  const world = replayWorld(t, loadFixture('leg-ready'), { tree: true, launch: true, bindKernel: false, linkedTree: true });
  Object.assign(world.env, { STARCI_FAKE_ORCA_MODE: 'turn-start-unobserved', ...(chipEnter ? { STARCI_FAKE_ORCA_CHIP_ENTER: 'submits' } : {}) });
  const linked = writeRuntimeShim({ root: ROOT, home: world.env.USERPROFILE });
  assert.ok(fs.existsSync(linked.shim), 'the native launcher writer bootstrapped the isolated home');
  const hostLoader = `data:text/javascript,${encodeURIComponent(`import{register}from'node:module';register(${JSON.stringify(new URL('../helpers/replay-kernel-host-loader.mjs', import.meta.url).href)});`)}`;
  world.env.NODE_OPTIONS = `${world.env.NODE_OPTIONS ?? ''} --import=${hostLoader}`.trim();
  const dir = world.tree.dir;
  world.tree.write('package.json', '{"name":"app","version":"0.0.0"}\n');
  world.tree.write('package-lock.json', '{"name":"app","lockfileVersion":3,"packages":{}}\n');
  world.tree.commit('manifests');
  fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules', '.package-lock.json'), '{"packages":{}}');
  assert.equal(writeInstallMarker(dir), true, 'the tree holds a finished install: the start does not run npm');
  world.ledger((ledger) => postInbox(ledger.db, { workflowId: world.wf, kind: 'goal', payload: { goalRevision: 0 } }));
  const run = world.starci(['workflow', 'start', '--repo', world.repo, '--goal', world.wf], { timeout: 250_000, extraEnv: { STARCI_RUNTIME: ROOT, ORCA_TERMINAL_HANDLE: 'term-runtime-shell' } });
  return { world, run, orca: world.orca() };
}

test('5: the Kernel start hands worker-start a pointer to the file that holds its whole prompt, and the start stands', (t) => {
  const { world, run, orca } = kernelStart(t, { chipEnter: true });
  assert.equal(run.status, 0, `the Kernel starts: ${JSON.stringify({ status: run.status, json: run.json, stderr: run.stderr })}`);
  const [start] = orca.workerStarts ?? [];
  assert.ok(start, 'worker-start was called for the Kernel');
  assert.ok(start.spec.length < 2000, `the Task spec is a pointer, not the 10 KB prompt (${start.spec.length} chars)`);
  const file = /PACKET FILE[^\n]*\n\s+(\S.*)\n/.exec(start.spec)?.[1];
  assert.ok(file && fs.existsSync(file), `it names a file that exists: ${file}`);
  const prompt = fs.readFileSync(file, 'utf8');
  assert.ok(prompt.length > 2000 && prompt.includes(world.wf) && !prompt.includes('{workflowId}'), 'and the file holds the whole rendered prompt');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true, 'the engine restarts over the started Kernel');
});

test('6: a Kernel start whose turn never begins is refused TURN_START_UNOBSERVED, journalled with its Run, and its worker is closed', (t) => {
  const { world, run, orca } = kernelStart(t, { chipEnter: false });
  assert.notEqual(run.status, 0);
  const [failed] = world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='kernel-start-failed' ORDER BY seq").all().map((row) => JSON.parse(row.payload_json)));
  assert.ok(failed, `the refusal is journalled: ${JSON.stringify({ status: run.status, json: run.json, stderr: run.stderr })}`);
  assert.match(String(failed.error ?? failed.reason), /TURN_START_UNOBSERVED/i);
  assert.ok(failed.runId, 'with the Run the launch created, which the agents collector lists');
  const states = Object.values(orca.workerStates ?? {});
  assert.ok(states.length > 0 && states.every((state) => ['stopped', 'released'].includes(state)), `no worker is left alive: ${JSON.stringify(orca.workerStates)}`);
});
