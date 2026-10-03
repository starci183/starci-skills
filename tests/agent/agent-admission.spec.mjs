import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import { selectAdmission } from '../../scripts/lib/agent-admission.mjs';
import { selectPool, loadRuntimes, loadModelRegistry } from '../../scripts/agent/models.mjs';

const now = Date.parse('2026-10-03T08:00:00Z');
const policy = parseYaml(fs.readFileSync(new URL('../../modules/models/runtimes.yaml', import.meta.url), 'utf8')).allocation.admission;
const quota = (provider, usedPercent = 30, extra = {}) => ({ provider, account: 'default', authority: 'provider-windows',
  auth: 'ok', state: usedPercent >= 90 ? 'limited' : 'ok', fresh: true, observedAt: now,
  normalAdmission: usedPercent < 90, allowLaunchAttempt: usedPercent < 90,
  windows: [{ id: 'short', usedPercent, observedAt: now, resetsAt: now + 3_600_000 }], ...extra });
const candidate = (id, provider, model, extra = {}) => ({ id, pool: `${provider}-agent`, provider, account: 'default', model,
  modelAuthority: 'supported-model-argument',
  qualityFloor: 'frontier', eligibility: { eligible: true, mode: 'operation-policy' }, quota: quota(provider),
  capacity: { running: 0, maxParallel: 5 }, ...extra });
const sol = () => candidate('sol', 'codex', 'gpt-6.1-sol');
const opus = () => candidate('opus', 'claude', 'claude-opus-5-5');
const request = (extra = {}) => ({ role: 'op', scopeId: 'workflow/op', attemptId: 'attempt-1', kind: 'backend.implement',
  allowGroup: [{ provider: 'codex', model: 'gpt-6.1-sol' }, { provider: 'claude', model: 'claude-opus-5-5' }], ...extra });
const choose = (candidates, extra = {}, options = {}) => selectAdmission({ request: request(extra), candidates, policy, now, ...options });

test('all five roles enforce the shipped role floor without manufacturing qualification', () => {
  for (const role of ['kernel', 'op', 'supervisor', 'worker', 'critic']) {
    const candidates = [candidate('luna', 'codex', 'gpt-6-luna', { qualityFloor: 'economy' })];
    const result = choose(candidates, { role, allowGroup: [{ provider: 'codex', model: 'gpt-6-luna' }],
      ...(role === 'critic' ? { author: { provider: 'claude', model: null } } : {}) });
    assert.equal(result.ok, role === 'op', role);
    if (role !== 'op') assert.ok(result.rejected[0].codes.includes('quality-floor-not-met'));
  }
  assert.equal(choose([sol()], { qualityFloor: 'unknown' }).reason, 'quality-floor-invalid');
  assert.equal(choose([sol()], { role: 'kernel', qualityFloor: 'economy' }).reason, 'quality-floor-invalid');
  assert.ok(choose([sol()], {}, { policy: { ...policy, version: null } }).reason === 'policy-invalid');
  assert.ok(choose([candidate('unqualified', 'codex', 'gpt-6.1-sol', { eligibility: null })]).rejected[0].codes.includes('eligibility-not-proven'));
});

test('null models and preferred identities outside the concrete group never become eligible', () => {
  const result = choose([sol(), candidate('missing', 'codex', null), opus()], {
    allowGroup: [{ provider: 'codex', model: 'gpt-6.1-sol' }], prefer: [{ provider: 'claude' }] });
  assert.equal(result.selected.model, 'gpt-6.1-sol');
  assert.ok(result.rejected.find((row) => row.id === 'missing').codes.includes('candidate-invalid'));
  assert.ok(result.rejected.find((row) => row.id === 'opus').codes.includes('outside-allow-group'));
  assert.equal(choose([sol()], { allowGroup: [{ provider: 'codex', model: null }] }).reason, 'allow-group-invalid');
});

test('difficulty floors cannot be lowered by explicit input and a caller may raise the minimum', () => {
  const sonnet = candidate('sonnet', 'claude', 'claude-sonnet-5-5', { qualityFloor: 'standard' });
  const allowGroup = [{ provider: 'claude', model: sonnet.model }, { provider: 'claude', model: 'claude-opus-5-5' }];
  for (const difficulty of ['hard', 'insane']) {
    for (const qualityFloor of ['economy', 'standard']) {
      const lower = choose([sonnet, opus()], { difficulty, qualityFloor, allowGroup });
      assert.equal(lower.reason, 'quality-floor-invalid');
      assert.equal(lower.selected, null);
    }
    const minimum = choose([sonnet, opus()], { difficulty, allowGroup });
    assert.equal(minimum.selected.id, 'opus');
    assert.equal(minimum.request.qualityFloor, 'frontier');
    assert.equal(minimum.request.difficulty, difficulty);
    assert.ok(minimum.rejected[0].codes.includes('quality-floor-not-met'));
  }
  const raised = choose([sonnet], { difficulty: 'easy', qualityFloor: 'standard', allowGroup });
  assert.equal(raised.ok, true);
  assert.equal(raised.request.qualityFloor, 'standard');
  assert.equal(choose([opus()], { difficulty: 'unknown' }).reason, 'quality-floor-invalid');
  const roleMinimum = { ...policy, roles: { ...policy.roles,
    kernel: { qualityFloor: 'standard', difficultyFloors: { easy: 'economy' } } } };
  assert.equal(choose([sonnet], { role: 'kernel', difficulty: 'easy', qualityFloor: 'economy', allowGroup },
    { policy: roleMinimum }).reason, 'quality-floor-invalid');
});

test('fresh real headroom changes selection inside a group while scoped prefer remains an eligible bias', () => {
  const busy = candidate('busy', 'codex', 'gpt-6.1-sol', { quota: quota('codex', 85) });
  const free = candidate('free', 'claude', 'claude-opus-5-5', { quota: quota('claude', 10) });
  assert.equal(choose([busy, free]).selected.id, 'free');
  assert.equal(choose([busy, free], { prefer: [{ provider: 'codex' }] }).selected.id, 'busy');
  busy.capacity = { running: 5, maxParallel: 5 };
  assert.equal(choose([busy, free], { prefer: [{ provider: 'codex' }] }).selected.id, 'free');
});

test('hard require refuses rather than falling back and every specified identity field matches', () => {
  const result = choose([sol(), opus()], { require: { provider: 'claude', model: 'gpt-6.1-sol' } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'required-unavailable');
  assert.equal(result.selected, null);
  assert.equal(choose([sol(), opus()], { require: { pool: 'claude-agent', provider: 'claude' } }).selected.id, 'opus');
  assert.equal(choose([sol()], { require: {} }).reason, 'constraint-invalid');
  assert.equal(choose([sol()], { require: { provider: 'codex' }, avoid: [{ provider: 'codex' }] }).reason, 'require-avoid-conflict');
  assert.equal(choose([sol()], { prefer: [{ unsupported: 'codex' }] }).reason, 'constraint-invalid');
});

test('every short and long window blocks normal admission at the reserve boundary', () => {
  for (const usedPercent of [90, 99, 100]) {
    const snapshot = quota('codex', 5, { windows: [
      { id: 'short', usedPercent: 5, observedAt: now, resetsAt: now + 3_600_000 },
      { id: 'long', usedPercent, observedAt: now, resetsAt: now + 86_400_000 },
    ] });
    const result = choose([candidate('sol', 'codex', 'gpt-6.1-sol', { quota: snapshot }), opus()]);
    assert.equal(result.selected.id, 'opus');
    assert.ok(result.rejected[0].codes.includes(usedPercent === 100 ? 'quota-exhausted' : 'quota-reserved'));
  }
});

test('a scoped reserve override admits only its exact fresh identity below exhaustion', () => {
  const reserveOverride = { authorized: true, scopeId: 'workflow/op', role: 'op', provider: 'codex', model: 'gpt-6.1-sol', reason: 'owner recovery' };
  const reserved = candidate('sol', 'codex', 'gpt-6.1-sol', { quota: quota('codex', 95) });
  const result = choose([reserved], { reserveOverride });
  assert.equal(result.ok, true);
  assert.equal(result.overrideApplied, true);
  assert.equal(choose([reserved], { reserveOverride: { ...reserveOverride, scopeId: 'other' } }).reason, 'reserve-override-invalid');
  assert.equal(choose([reserved], { reserveOverride: { ...reserveOverride, authorized: false } }).reason, 'reserve-override-invalid');
  assert.equal(choose([reserved], { reserveOverride: { ...reserveOverride, model: 'gpt-6-luna' } }).ok, false);
  for (const snapshot of [quota('codex', 100), quota('codex', 95, { auth: 'unavailable' }), quota('codex', 95, { observedAt: now - policy.maxAgeMs - 1 }), quota('codex', 95, { state: 'unknown' })])
    assert.equal(choose([{ ...reserved, quota: snapshot }], { reserveOverride }).ok, false);
});

test('missing, stale, future, invalid and mismatched quota observations fail closed', () => {
  const cases = [null, quota('claude'), quota('codex', 20, { account: 'other' }), quota('codex', 20, { fresh: false }),
    quota('codex', 20, { observedAt: now + 1 }), quota('codex', 20, { windows: [] }),
    quota('codex', 20, { windows: [{ id: 'short', usedPercent: null, observedAt: now, resetsAt: now + 1_000 }] }),
    quota('codex', 20, { windows: [{ id: 'short', usedPercent: 20, observedAt: now - policy.maxAgeMs - 1, resetsAt: now + 1_000 }] }),
    quota('codex', 20, { windows: [{ id: 'short', usedPercent: 20, observedAt: now, resetsAt: null }] })];
  for (const snapshot of cases) assert.equal(choose([candidate('sol', 'codex', 'gpt-6.1-sol', { quota: snapshot })]).ok, false);
});

test('a scoped owner grant uses real slots without inventing provider-window percentages', () => {
  const grant = { owner: 'owner', scopeId: 'workflow/op', roles: ['op'], slots: 2, observedAt: now };
  const devin = candidate('devin', 'devin', 'swe-2-max', { modelAuthority: 'configured-logical-runtime',
    quota: quota('devin', 0, { authority: 'owner-grant', grant, windows: [] }),
    capacity: { running: 1, maxParallel: 10 } });
  const extra = { allowGroup: [{ provider: 'devin', model: 'swe-2-max' }] };
  assert.equal(choose([devin], extra).ok, true);
  assert.equal(choose([{ ...devin, capacity: { running: 2, maxParallel: 10 } }], extra).ok, false);
  assert.equal(choose([{ ...devin, quota: { ...devin.quota, grant: { ...grant, scopeId: 'other' } } }], extra).ok, false);
  assert.equal(choose([{ ...devin, quota: { ...devin.quota, grant: { ...grant, observedAt: now - policy.maxAgeMs - 1 } } }], extra).ok, false);
});

test('Critic provider independence is mandatory and stricter model independence is allowed', () => {
  const author = { provider: 'codex', model: 'gpt-6.1-sol', modelAuthority: 'supported-model-argument' };
  const result = choose([sol(), opus()], { role: 'critic', author });
  assert.equal(result.selected.id, 'opus');
  assert.ok(result.rejected[0].codes.includes('critic-provider-conflict'));
  assert.equal(choose([sol(), opus()], { role: 'critic', author, independence: 'model' }).reason, 'critic-independence-invalid');
  assert.equal(choose([opus()], { role: 'critic', author: { provider: 'codex', model: null } }).ok, true);
  assert.equal(choose([opus()], { role: 'critic', author: { provider: 'codex', model: null }, independence: 'both' }).ok, false);
  assert.equal(choose([sol()], { role: 'critic', author }).ok, false);
  assert.equal(choose([opus()], { role: 'critic', author, independence: 'both' }).ok, true);
});

test('opaque logical model identities cannot satisfy concrete requirements or model independence', () => {
  const opaque = candidate('logical', 'claude', 'claude-opus-5-5', { modelAuthority: 'configured-logical-runtime' });
  assert.equal(choose([opaque], { require: { provider: 'claude' } }).ok, true);
  const required = choose([opaque], { require: { model: opaque.model } });
  assert.equal(required.reason, 'required-unavailable');
  assert.ok(required.rejected[0].codes.includes('required-model-unverifiable'));
  const unknown = choose([{ ...opaque, modelAuthority: null }], { require: { model: opaque.model } });
  assert.ok(unknown.rejected[0].codes.includes('required-model-unverifiable'));
  const author = { provider: 'codex', model: 'gpt-6.1-sol', modelAuthority: 'supported-model-argument' };
  assert.equal(choose([opaque], { role: 'critic', author }).ok, true);
  const independent = choose([opaque], { role: 'critic', author, independence: 'both' });
  assert.ok(independent.rejected[0].codes.includes('critic-model-unverifiable'));
  assert.equal(choose([opus()], { role: 'critic', author: { ...author, modelAuthority: 'configured-logical-runtime' }, independence: 'both' }).reason, 'critic-model-unverifiable');
  assert.equal(choose([opaque]).selected.modelAuthority, 'configured-logical-runtime');
});

test('capacity zero, unknown, full, cooldown and open incidents remain hard exclusions', () => {
  for (const capacity of [null, { running: 0, maxParallel: 0 }, { running: 5, maxParallel: 5 },
    { running: -1, maxParallel: 5 }, { running: 0, maxParallel: 5, openIncident: true },
    { running: 0, maxParallel: 5, blockedUntil: now + 1_000 }]) {
    assert.equal(choose([candidate('sol', 'codex', 'gpt-6.1-sol', { capacity }), opus()], { prefer: [{ provider: 'codex' }] }).selected.id, 'opus');
  }
});

test('plans are deterministic and leave caller inputs unchanged', () => {
  const candidates = [sol(), opus()], req = request();
  const before = structuredClone({ candidates, req, policy });
  const first = selectAdmission({ request: req, candidates, policy, now });
  const second = selectAdmission({ request: req, candidates, policy, now });
  assert.deepEqual(first, second);
  assert.deepEqual({ candidates, req, policy }, before);
  assert.equal(first.schema, 'starci/agent-admission@1');
  assert.equal(first.policyVersion, policy.version);
});

test('live Op pool routing uses common headroom and concrete owner constraints without widening its kind group', () => {
  const runtimes = loadRuntimes(), modelRegistry = loadModelRegistry();
  const capacity = Object.fromEntries(Object.entries(runtimes.runtimes).map(([pool, row]) => [pool, {
    running: 0, auth: 'ok', quota: quota(row.provider, row.provider === 'codex' ? 10 : 70),
  }]));
  const route = (extra = {}) => selectPool({ kind: 'backend.implement', difficulty: 'hard', runtimes, modelRegistry,
    capacity, scopeId: 'workflow/op', attemptId: 'attempt-1', now, backoff: {}, ...extra });
  assert.equal(route().target, 'codex-agent');
  assert.equal(route().admission.ok, true);
  assert.equal(route({ qualityFloor: 'standard' }).admission.reason, 'quality-floor-invalid');
  assert.equal(route({ bias: { require: { provider: 'claude', model: 'claude-opus-5-5' } } }).target, 'claude-agent');
  assert.ok(route({ bias: { require: { provider: 'codex', model: 'gpt-6-luna' } } }).error);
  const unknown = { ...capacity, 'codex-agent': { running: 0, auth: 'ok', quota: { state: 'unknown' } } };
  const result = route({ capacity: unknown, bias: { require: { provider: 'codex' } } });
  assert.equal(result.admission.reason, 'required-unavailable');
  assert.ok(result.admission.rejected.find((row) => row.id === 'codex-agent').codes.includes('quota-unknown'));
  assert.equal(route({ kind: 'interface.asset', bias: { prefer: [{ provider: 'claude' }] } }).target, 'codex-agent');
});

test('static pool policy planning cannot claim fresh live admission or spend a concrete owner requirement', () => {
  const result = selectPool({ kind: 'backend.implement', difficulty: 'medium', backoff: {} });
  assert.equal(result.admission.ok, false);
  assert.equal(result.admission.planOnly, true);
  assert.equal(result.admission.reason, 'live-evidence-required');
  assert.ok(selectPool({ kind: 'backend.implement', difficulty: 'medium', bias: { require: { provider: 'codex' } }, backoff: {} }).error);
});
