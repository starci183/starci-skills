import test from 'node:test';
import assert from 'node:assert/strict';
import { planAgentAdmission, admitAgent, consumeAgentAdmission, ownerReserveGrant } from '../../scripts/agent/admission.mjs';
import { startAgent, spawnAgent } from '../../scripts/agent/lib.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { inspectOwnerConfig } from '../../engine/config.mjs';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { loadModelRegistry, loadAdapter, adapterModelAuthority } from '../../scripts/agent/model-registry.mjs';
import { providerBudgetUsage } from '../../scripts/agent/provider-budget.mjs';
import { orcaRequestIdOf } from '../../scripts/api/orca/lib.mjs';
import { writeProviderCircuit } from '../../scripts/machine/provider-circuit.mjs';
import { installGuardLauncher } from '../helpers/guard-launcher.mjs';

const isolatedMachine = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-launch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') };
  openMachine({ env }).close();
  return { root, env };
};

const group = [{ provider: 'claude', model: 'claude-sonnet-5-5' }, { provider: 'codex', model: 'gpt-6.1-sol' }];
const input = (role, extra = {}) => ({ role, scopeId: `unit:${role}:attempt:1`, allowGroup: group.map((member) => ({ ...member,
  ...(role === 'op' ? { eligibility: { eligible: true, mode: 'operation-policy', reasons: [] } } : {}) })),
  ...(role === 'critic' ? { author: { provider: 'devin', model: null } } : {}), ...extra });

test('reserve authority is read from actual owner-approved goal rows', () => {
  const grant = { authorized: true, scopeId: 'scope', role: 'op', provider: 'claude', model: 'claude-opus-5-5', reason: 'repair' };
  const json = JSON.stringify({ approvedBy: 'owner', routing_bias: { reserveOverride: grant } });
  assert.equal(ownerReserveGrant({ approved_by: 'supervisor', json }), null);
  assert.equal(ownerReserveGrant({ json }), null);
  assert.deepEqual(ownerReserveGrant({ approved_by: 'owner', json }), grant);
  assert.equal(ownerReserveGrant({ approved_by: 'owner', json: JSON.stringify({ definedBy: 'supervisor', routing_bias: { reserveOverride: grant } }) }), null);
});

test('all five roles refuse reserve-window Claude and select the allowed concrete Codex model', () => {
  for (const role of ['kernel', 'op', 'supervisor', 'worker', 'critic']) {
    const io = fakeAdmission({ used: { claude: 96, codex: 20 } });
    const planned = planAgentAdmission({ ...input(role), io });
    assert.equal(planned.ok, true, JSON.stringify(planned));
    assert.equal(planned.selected.model, 'gpt-6.1-sol');
    assert.equal(io.calls.length, 0, 'a plan never reserves');
    const admitted = admitAgent(input(role), { io });
    assert.equal(admitted.ok, true, JSON.stringify(admitted));
    assert.equal(io.calls.filter(([name]) => name === 'reserve').length, 1);
    assert.equal(admitted.receipt.role, role);
  }
});

test('an only bias does not widen and a raw override cannot grant access to the reserve band', () => {
  const scopeId = 'unit:op:attempt:3';
  const grant = { authorized: true, scopeId, role: 'op', provider: 'claude', model: 'claude-sonnet-5-5', reason: 'owner-approved repair' };
  const biased = input('op', { scopeId, bias: { roles: ['op'], only: [{ provider: 'claude' }], reserveOverride: grant } });
  const noGrant = admitAgent(biased, { io: fakeAdmission({ used: { claude: 93 } }) });
  assert.equal(noGrant.ok, false);
  assert.equal(noGrant.error, 'tokens-out');
  const trusted = admitAgent({ ...biased, ownerGrant: grant }, { io: fakeAdmission({ used: { claude: 93 } }) });
  assert.equal(trusted.ok, true, JSON.stringify(trusted));
  assert.equal(trusted.selected.provider, 'claude');
  const otherRole = admitAgent(input('kernel', { scopeId, bias: biased.bias, ownerGrant: grant }), { io: fakeAdmission({ used: { claude: 93 } }) });
  assert.equal(otherRole.selected.provider, 'codex', 'Op bias and grant never leak into Kernel');
});

test('worker economy model and unknown critic author are rejected before any reservation', () => {
  const io = fakeAdmission();
  const worker = admitAgent(input('worker', { allowGroup: [{ provider: 'codex', model: 'gpt-6-luna' }] }), { io });
  assert.equal(worker.ok, false);
  assert.ok(worker.decision.rejected[0].codes.includes('quality-floor-not-met'));
  const critic = admitAgent(input('critic', { author: null }), { io });
  assert.equal(critic.ok, false);
  assert.equal(io.calls.length, 0);
});

test('capacity race can retry only admitted group members; consume rejects a different model', () => {
  const io = fakeAdmission({ onReserve: (candidate) => candidate.provider === 'claude' ? { ok: false, reason: 'capacity' } : null });
  const admitted = admitAgent(input('kernel'), { io });
  assert.equal(admitted.ok, true, JSON.stringify(admitted));
  assert.equal(admitted.selected.provider, 'codex');
  assert.equal(io.calls.filter(([name]) => name === 'reserve').length, 2);
  assert.equal(consumeAgentAdmission(admitted, { provider: 'codex', model: 'gpt-6-luna', role: 'kernel', io }).ok, false);
});

test('unknown launch effects retain the fenced slot and produce no second worker', () => {
  const admission = fakeAdmission({ used: { claude: 93 } });
  const calls = [];
  const result = startAgent({ provider: 'claude', model: 'claude-sonnet-5-5', role: 'kernel', allowGroup: group,
    worktree: 'fixture', title: '[Kernel] unit', prompt: 'fixture', objective: 'fixture', request: { attempt: 1 },
    io: { admission, runCreate: () => ({ ok: true, runId: 'unit-run' }), spawn: {
      trust: () => ({ status: 'ok' }), hostAgent: () => ({ ok: true }),
      start: (args) => { calls.push(args); return { ok: false, effectState: 'unknown', dispatchId: 'unit-dispatch' }; },
      show: () => ({ ok: false }),
    } } });
  assert.equal(result.ok, false);
  assert.equal(result.effectState, 'unknown');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'gpt-6.1-sol');
  assert.equal([...admission.reservations.values()][0].state, 'unknown');
  assert.equal(admission.calls.some(([name]) => name === 'release'), false);
});

test('current persisted Op grant provides finite Devin slots only with known fresh auth and no telemetry', t => {
  const { root, env } = isolatedMachine(t);
  const config = parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
  config.allocation.grants = ['devin-agent=1@implement'];
  fs.writeFileSync(path.join(root, 'config.yaml'), stringifyYaml(config));
  const registry = loadModelRegistry(), model = registry.pools['devin-agent'].defaultModel;
  const request = { role: 'op', scopeId: 'op-grant:attempt:1', kind: 'backend.implement', difficulty: 'medium',
    allowGroup: [{ provider: 'devin', model, pool: 'devin-agent', eligibility: { eligible: true, mode: 'operation-policy' } }] };
  const quota = (provider, { now }) => ({ provider, account: 'default', auth: 'ok', observedAt: now, windows: [], state: 'unknown' });
  const io = { quota, circuit: () => null, ownerConfig: () => inspectOwnerConfig(root) };
  const admitted = admitAgent(request, { io, env });
  assert.equal(admitted.ok, true, JSON.stringify(admitted));
  assert.equal(admitted.selected.quota.authority, 'owner-grant');
  assert.equal(admitted.receipt.quota.usedPercent, null, 'a slot grant never invents usage');
  assert.equal(admitAgent({ ...request, scopeId: 'op-grant:attempt:2' }, { io, env }).ok, false, 'finite cap is shared atomically');
  assert.equal(planAgentAdmission({ ...request, role: 'kernel', io, env }).ok, false, 'implement grant does not confer Kernel authority');
  assert.equal(planAgentAdmission({ ...request, io: { ...io, quota: (p, opts) => ({ ...quota(p, opts), auth: 'unknown' }) }, env }).ok, false);
  assert.equal(planAgentAdmission({ ...request, io: { ...io, ownerConfig: () => ({ file: path.join(root, 'missing.yaml'), config: null }) }, env }).ok, false);
});

test('actual startAgent receipt permits the same Run replay but fences a new Run before worker-start', t => {
  for (const sameRun of [true, false]) {
    const { env } = isolatedMachine(t), observations = fakeAdmission();
    let inReplay = false, replay = null, starts = 0, createdRuns = 0;
    const request = { seat: 'test-kernel', attempt: 1 }, model = 'gpt-6.1-sol';
    const args = { provider: 'codex', model, role: 'kernel', scopeId: 'kernel:attempt:1',
      worktree: 'fixture', title: '[Kernel] unit', prompt: 'fixture', objective: 'fixture', request, env };
    const io = { admission: { quota: observations.quota, circuit: () => null },
      runShow: () => ({ ok: true }), runCreate: () => ({ ok: true, runId: `run-${++createdRuns}` }), spawn: {
        trust: () => ({ status: 'ok' }), hostAgent: () => ({ ok: true }), rename: () => ({ ok: true }), recordLaunch: () => {},
        show: () => ({ ok: true, state: 'ready', effective: { agent: 'codex', model } }),
        start: () => {
          starts += 1;
          if (!inReplay) {
            inReplay = true;
            replay = startAgent({ ...args, ...(sameRun ? { priorRunId: 'run-1' } : {}), io });
          }
          return { ok: true, dispatchId: 'dispatch-one', taskId: 'task-one', agentTerminalHandle: 'term-one' };
        },
      } };
    const launched = startAgent({ ...args, io });
    assert.equal(launched.ok, true, JSON.stringify(launched));
    if (sameRun) { assert.equal(replay.ok, true, JSON.stringify(replay)); assert.equal(starts, 2, 'same host idempotency request may be replayed'); }
    else { assert.equal(replay.ok, false); assert.equal(replay.error, 'launch-identity-conflict'); assert.equal(replay.effectState, 'unknown'); assert.equal(starts, 1); }
    assert.equal(launched.receipt, undefined);
  }
});

test('before-effect input refusal releases its known reserved slot but a forged fence cannot release it', t => {
  for (const forged of [false, true]) {
    const { env } = isolatedMachine(t), fake = fakeAdmission(), io = { quota: fake.quota, circuit: () => null };
    const admission = admitAgent({ role: 'worker', scopeId: 'worker:attempt:1', allowGroup: [{ provider: 'codex', model: 'gpt-6.1-sol' }] }, { env, io });
    assert.equal(admission.ok, true);
    if (forged) admission.receipt = { ...admission.receipt, fence: admission.receipt.fence + 1 };
    const result = spawnAgent({ provider: 'codex', model: null, role: 'worker', admission, env,
      worktree: 'fixture', run: 'fixture-run', request: { attempt: 1 },
      io: { admission: io, hostAgent: () => ({ ok: true }), start: () => { throw new Error('input refusal must not launch'); } } });
    assert.equal(result.ok, false); assert.equal(result.effectState, 'none');
    assert.equal(providerBudgetUsage('codex', 'default', { env }).running, forged ? 1 : 0);
  }
});

test('only a completed matching host replay that proves no effect releases an uncertain last-slot launch', t => {
  for (const evidence of ['resolved', 'pending', 'absent', 'unreadable', 'success', 'residual', 'wrong-request']) {
    const { env } = isolatedMachine(t), fake = fakeAdmission();
    let calls = 0;
    const args = { provider: 'codex', model: 'gpt-6.1-sol', role: 'kernel', scopeId: 'reconcile:attempt:1', env,
      allowGroup: [{ provider: 'codex', model: 'gpt-6.1-sol', maxParallel: 1 }],
      worktree: 'fixture', title: '[Kernel] fixture', prompt: 'fixture', objective: 'fixture', request: { attempt: 1 } };
    const io = { admission: { quota: fake.quota, circuit: () => null },
      runCreate: () => ({ ok: true, runId: 'the-same-run' }), spawn: {
        requestState: () => ['pending', 'absent'].includes(evidence) ? evidence : evidence === 'unreadable' ? null : 'completed',
        hostAgent: () => ({ ok: true }), trust: () => ({ status: 'ok' }), show: () => ({ ok: false }),
        start: options => {
          calls += 1;
          if (calls === 1) return { ok: false, effectState: 'unknown', error: 'lost host receipt' };
          return { ok: evidence === 'success', outcome: evidence === 'success' ? 'ok' : 'failed',
            effectState: evidence === 'success' ? 'committed' : 'none',
            request: { id: evidence === 'wrong-request' ? 'unrelated-request' : orcaRequestIdOf('worker-start', options.request), replayed: true },
            errorReceipt: { code: 'worker_start_failed' }, result: { failedStage: 'setup',
              ...(evidence === 'residual' ? { residualResources: { process: 777 } } : {}) } };
        },
      } };
    assert.equal(startAgent({ ...args, io }).effectState, 'unknown');
    const repeated = startAgent({ ...args, io });
    assert.equal(repeated.effectState, evidence === 'resolved' ? 'none' : 'unknown', JSON.stringify({ evidence, repeated }));
    assert.equal(providerBudgetUsage('codex', 'default', { env }).running, evidence === 'resolved' ? 0 : 1);
    assert.equal(calls, ['pending', 'absent', 'unreadable'].includes(evidence) ? 1 : 2);
  }
});

test('a circuit opened after planning refuses consumption using the strict canonical machine observation', t => {
  const { root, env } = isolatedMachine(t), fake = fakeAdmission();
  const owner = parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
  owner.launchTrust = { profile: 'automatic', approvedBy: 'owner', approvalRef: 'private circuit fixture adoption', roots: [root] };
  fs.writeFileSync(path.join(root, 'config.yaml'), stringifyYaml(owner));
  env.STARCI_AGENT_TRUST_HOME = path.join(root, 'trust-home');
  fs.mkdirSync(env.STARCI_AGENT_TRUST_HOME);
  installGuardLauncher(env.STARCI_AGENT_TRUST_HOME);
  const request = { role: 'worker', scopeId: 'circuit:attempt:1', allowGroup: [{ provider: 'codex', model: 'gpt-6.1-sol' }] };
  const options = { env, io: { quota: fake.quota } };
  const admission = admitAgent(request, options);
  assert.equal(admission.ok, true, JSON.stringify(admission));
  const machine = openMachine({ env });
  writeProviderCircuit('codex', { machine, value: { status: 'unavailable', failureKind: 'quota' }, expiresAt: Date.now() + 60000 });
  machine.close();
  let starts = 0;
  const refused = spawnAgent({ provider: 'codex', model: 'gpt-6.1-sol', role: 'worker', admission, env,
    worktree: root, config: inspectOwnerConfig(root).config, run: 'circuit-run', request: { attempt: 1 }, spec: 'fixture', io: {
      admission: options.io, hostAgent: () => ({ ok: true }), start: () => { starts += 1; return {}; },
    } });
  assert.equal(refused.error, 'provider-circuit-open');
  assert.equal(refused.effectState, 'none');
  assert.equal(starts, 0);
  assert.equal(providerBudgetUsage('codex', 'default', { env }).reservations[0].state, 'reserved');
  const unreadable = consumeAgentAdmission(admission, { provider: 'codex', model: 'gpt-6.1-sol', role: 'worker',
    launchIdentity: 'run/request', env: { ...env, STARCI_TEST_MACHINE_FILE: path.join(root, 'missing', 'machine.sqlite') } });
  assert.equal(unreadable.reason, 'provider-circuit-unavailable');
  assert.equal(unreadable.effectState, 'unknown');
  assert.equal(providerBudgetUsage('codex', 'default', { env }).running, 1, 'failed observation never spends or frees the held slot');
  const recovered = openMachine({ env });
  writeProviderCircuit('codex', { machine: recovered, value: { status: 'unavailable', failureKind: 'quota' }, expiresAt: Date.now() - 1 });
  recovered.close();
  assert.equal(consumeAgentAdmission(admission, { provider: 'codex', model: 'gpt-6.1-sol', role: 'worker', launchIdentity: 'run/request', env }).ok, true,
    'the existing circuit predicate owns expiry');
});

test('actual SQLite cleanup binds the positively observed terminal before closure and holds mismatched or uncertain proof', t => {
  for (const custom of [false, true]) {
  for (const failure of ['missing-task', 'wrong-model', 'show-only', 'retained-exit', 'wrong-closure', 'unknown-process', 'unproven-terminal', 'contradictory-show']) {
    const { env } = isolatedMachine(t), fake = fakeAdmission();
    let cleanups = 0;
    const io = { admission: { quota: fake.quota, circuit: () => null }, runCreate: () => ({ ok: true, runId: 'cleanup-run' }), spawn: {
      hostAgent: () => ({ ok: true }), trust: () => ({ status: 'ok' }), rename: () => ({ ok: true }), stop: () => ({ ok: true }),
      start: () => ({ ok: true, effectState: 'committed', dispatchId: 'cleanup-dispatch',
        taskId: failure === 'missing-task' ? null : 'cleanup-task', ...(failure === 'show-only' ? {} : { agentTerminalHandle: 'cleanup-terminal' }) }),
      show: () => ({ ok: true, state: 'ready', dispatch: { assigneeHandle: failure === 'contradictory-show' ? 'other-terminal' : 'cleanup-terminal' },
        effective: { agent: 'codex', model: 'unrouted-model' } }),
      release: ({ handle }) => {
        cleanups += 1;
        const row = providerBudgetUsage('codex', 'default', { env }).reservations[0];
        assert.equal(row.handle, 'cleanup-terminal', 'host closure sees the original fence already bound');
        assert.equal(row.state, 'unknown', 'unattested model is never marked live');
        return { ok: failure !== 'retained-exit', handle: failure === 'wrong-closure' ? 'other-terminal' : handle,
          closed: { ok: true, proof: failure === 'unproven-terminal' ? null : 'gone' }, processes: { verdict: failure === 'unknown-process' ? 'unverifiable' : 'none' } };
      },
    } };
    if (custom) io.spawn.cleanup = () => ({ effectState: 'none', release: io.spawn.release({ handle: 'cleanup-terminal' }) });
    const result = startAgent({ provider: 'codex', model: 'gpt-6.1-sol', role: 'worker', env,
      worktree: 'fixture', title: '[Worker] fixture', prompt: 'fixture', objective: 'fixture', request: { attempt: 1 }, io });
    assert.equal(result.ok, false, JSON.stringify({ failure, result }));
    const proved = ['missing-task', 'wrong-model', 'show-only'].includes(failure) || (custom && failure === 'retained-exit');
    assert.equal(result.effectState, proved ? 'none' : custom || failure === 'contradictory-show' ? 'unknown' : 'partial', JSON.stringify({ failure, result }));
    assert.equal(providerBudgetUsage('codex', 'default', { env }).running, proved ? 0 : 1);
    assert.equal(cleanups, failure === 'contradictory-show' ? 0 : 1);
  }
  }
});

test('opaque Devin default mode reports unknown actual model and refuses concrete model requirements before Run creation', t => {
  for (const concrete of [true, false]) {
    const { env } = isolatedMachine(t), fake = fakeAdmission(), model = loadModelRegistry().pools['devin-agent'].defaultModel;
    let runs = 0, starts = 0;
    const io = { admission: { quota: fake.quota, circuit: () => null },
      runCreate: () => { runs += 1; return { ok: true, runId: 'devin-run' }; }, spawn: {
        hostAgent: () => ({ ok: true }), trust: () => ({ status: 'ok' }), rename: () => ({ ok: true }), recordLaunch: () => {},
        start: args => {
          starts += 1;
          assert.equal(args.model, undefined, 'a logical alias cannot become a concrete worker-start model flag');
          return { ok: true, dispatchId: 'devin-dispatch', taskId: 'devin-task', agentTerminalHandle: 'devin-terminal' };
        },
        show: () => ({ ok: true, state: 'ready', effective: { agent: 'devin', model: 'opaque-host-value' } }),
      } };
    const result = startAgent({ provider: 'devin', role: 'worker', env,
      bias: { roles: ['worker'], only: [{ provider: 'devin', ...(concrete ? { model } : {}) }] },
      worktree: 'fixture', title: '[Worker] Devin fixture', prompt: 'fixture', objective: 'fixture', request: { attempt: 1 }, io });
    assert.equal(result.ok, !concrete, JSON.stringify(result));
    assert.equal(runs, concrete ? 0 : 1); assert.equal(starts, concrete ? 0 : 1);
    assert.equal(providerBudgetUsage('devin', 'default', { env }).running, concrete ? 0 : 1);
    if (concrete) assert.ok(result.decision.rejected[0].codes.includes('only-model-unverifiable'));
    else {
      assert.equal(result.model, null); assert.equal(result.effective.model, null);
      assert.equal(result.modelAuthority, 'configured-logical-runtime');
      assert.equal(result.admission.selected.modelAuthority, 'configured-logical-runtime');
    }
  }
  for (const card of [null, [], {}, { start: { modelArgument: true } }]) assert.equal(adapterModelAuthority(card), null);
  assert.equal(adapterModelAuthority(loadAdapter('codex').card), 'supported-model-argument');
});
