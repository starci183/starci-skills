import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import { selectAdmission } from '../../scripts/lib/agent-admission.mjs';
import { loadRuntimes, loadModelRegistry } from '../../scripts/agent/models.mjs';
import { shippedTiers } from '../../engine/model-config.mjs';
import { fakePoolSelection as selectPool } from '../helpers/fake-admission.mjs';

const now = Date.parse('2026-10-03T08:00:00Z');
const policy = { ...parseYaml(fs.readFileSync(new URL('../../modules/models/runtimes.yaml', import.meta.url), 'utf8')).allocation.admission, ...shippedTiers().usage };
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

test('a request cannot lower the role floor and a caller may raise the minimum', () => {
  const sonnet = candidate('sonnet', 'claude', 'claude-sonnet-5-5', { qualityFloor: 'standard' });
  const luna = candidate('luna', 'codex', 'gpt-6-luna', { qualityFloor: 'economy' });
  const allowGroup = [{ provider: 'claude', model: sonnet.model }, { provider: 'codex', model: luna.model }];
  const kernel = (extra) => choose([sonnet, luna], { role: 'kernel', allowGroup, ...extra });
  assert.equal(kernel({ qualityFloor: 'economy' }).reason, 'quality-floor-invalid');
  assert.equal(kernel({}).selected.id, 'sonnet');
  assert.ok(kernel({}).rejected.find((row) => row.id === 'luna').codes.includes('quality-floor-not-met'));
  const raised = choose([sonnet, luna], { difficulty: 'easy', qualityFloor: 'standard', allowGroup });
  assert.equal(raised.selected.id, 'sonnet');
  assert.equal(raised.request.qualityFloor, 'standard');
  assert.equal(choose([luna], { difficulty: 'easy', allowGroup }).ok, true);
  assert.equal(choose([sonnet], { qualityFloor: 'unknown', allowGroup }).reason, 'quality-floor-invalid');
});

test('tokens decide inside a chain: chain order below 90 percent, the next member at or above it', () => {
  const head = (used, extra = {}) => candidate('head', 'codex', 'gpt-6.1-sol', { quota: quota('codex', used), ...extra });
  const next = candidate('next', 'claude', 'claude-opus-5-5', { quota: quota('claude', 10) });
  assert.equal(choose([head(85), next]).selected.id, 'head');
  const skipped = choose([head(92), next]);
  assert.equal(skipped.selected.id, 'next');
  assert.deepEqual(skipped.pick.dropped.map((row) => [row.id, row.step]), [['head', 'tokens']]);
  assert.equal(choose([head(92), next], { prefer: [{ provider: 'codex' }] }).selected.id, 'next', 'an untrusted bias never widens the band');
  assert.equal(choose([head(92), next], { prefer: [{ provider: 'codex' }], biasTrusted: true }).selected.id, 'head');
  assert.equal(choose([head(96), next], { prefer: [{ provider: 'codex' }], biasTrusted: true }).selected.id, 'next');
  assert.equal(choose([head(5, { capacity: { running: 5, maxParallel: 5 } }), next], { prefer: [{ provider: 'codex' }], biasTrusted: true }).selected.id, 'next');
});

test('only keeps the named members, refuses an emptied chain and every specified identity field matches', () => {
  const result = choose([sol(), opus()], { only: [{ provider: 'claude', model: 'gpt-6.1-sol' }] });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bias-empties-chain');
  assert.equal(result.selected, null);
  assert.equal(choose([sol(), opus()], { only: [{ pool: 'claude-agent', provider: 'claude' }] }).selected.id, 'opus');
  assert.equal(choose([sol(), opus()], { only: [{ provider: 'codex' }, { provider: 'claude' }] }).selected.id, 'sol');
  assert.equal(choose([sol()], { only: [{}] }).reason, 'constraint-invalid');
  assert.equal(choose([sol()], { only: [{ provider: 'codex' }], avoid: [{ provider: 'codex' }] }).reason, 'only-avoid-conflict');
  assert.equal(choose([sol()], { prefer: [{ unsupported: 'codex' }] }).reason, 'constraint-invalid');
});

test('every short and long window is a token step at the reserve boundary', () => {
  for (const usedPercent of [90, 99, 100]) {
    const snapshot = quota('codex', 5, { windows: [
      { id: 'short', usedPercent: 5, observedAt: now, resetsAt: now + 3_600_000 },
      { id: 'long', usedPercent, observedAt: now, resetsAt: now + 86_400_000 },
    ] });
    const result = choose([candidate('sol', 'codex', 'gpt-6.1-sol', { quota: snapshot }), opus()]);
    assert.equal(result.selected.id, 'opus');
    assert.match(result.pick.dropped[0].reason, usedPercent === 100 ? /exhausted/ : /% or more of its tokens/);
  }
});

test('a scoped reserve override admits only its exact fresh identity inside the 90 to 95 band', () => {
  const reserveOverride = { authorized: true, scopeId: 'workflow/op', role: 'op', provider: 'codex', model: 'gpt-6.1-sol', reason: 'owner recovery' };
  const reserved = candidate('sol', 'codex', 'gpt-6.1-sol', { quota: quota('codex', 92) });
  const result = choose([reserved], { reserveOverride });
  assert.equal(result.ok, true);
  assert.equal(result.overrideApplied, true);
  assert.equal(choose([{ ...reserved, quota: quota('codex', 95) }], { reserveOverride }).ok, false, '95 percent is refused even with an override');
  assert.equal(choose([reserved], { reserveOverride: { ...reserveOverride, scopeId: 'other' } }).reason, 'reserve-override-invalid');
  assert.equal(choose([reserved], { reserveOverride: { ...reserveOverride, authorized: false } }).reason, 'reserve-override-invalid');
  assert.equal(choose([reserved], { reserveOverride: { ...reserveOverride, model: 'gpt-6-luna' } }).ok, false);
  for (const snapshot of [quota('codex', 100), quota('codex', 92, { auth: 'unavailable' }), quota('codex', 92, { observedAt: now - policy.maxAgeMs - 1 }), quota('codex', 92, { state: 'unknown' })])
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

test('opaque logical model identities cannot satisfy concrete only-models or model independence', () => {
  const opaque = candidate('logical', 'claude', 'claude-opus-5-5', { modelAuthority: 'configured-logical-runtime' });
  assert.equal(choose([opaque], { only: [{ provider: 'claude' }] }).ok, true);
  const required = choose([opaque], { only: [{ model: opaque.model }] });
  assert.equal(required.reason, 'no-eligible-candidate');
  assert.ok(required.rejected[0].codes.includes('only-model-unverifiable'));
  const unknown = choose([{ ...opaque, modelAuthority: null }], { only: [{ model: opaque.model }] });
  assert.ok(unknown.rejected[0].codes.includes('only-model-unverifiable'));
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

test('live Op routing walks the tier chain by tokens and keeps the concrete owner only inside it', () => {
  const runtimes = loadRuntimes(), modelRegistry = loadModelRegistry();
  const capacity = (claude, codex) => ({ 'claude-agent': { running: 0, auth: 'ok', quota: quota('claude', claude) }, 'codex-agent': { running: 0, auth: 'ok', quota: quota('codex', codex) } });
  const route = (extra = {}) => selectPool({ kind: 'backend.implement', difficulty: 'hard', runtimes, modelRegistry,
    capacity: capacity(70, 10), scopeId: 'workflow/op', attemptId: 'attempt-1', now, ...extra });
  const head = route();
  assert.equal(head.tier, 'high');
  assert.equal(head.target, 'claude-agent');
  assert.equal(head.modelId, 'claude-sonnet-5-5');
  assert.equal(head.admission.ok, true);
  assert.equal(route({ capacity: capacity(92, 10) }).modelId, 'gpt-6.1-sol');
  assert.equal(route({ qualityFloor: 'frontier' }).modelId, 'gpt-6.1-sol', 'a raised minimum drops the member below it');
  assert.equal(route({ bias: { only: [{ provider: 'codex', model: 'gpt-6.1-sol' }] } }).target, 'codex-agent');
  assert.match(route({ bias: { only: [{ provider: 'codex', model: 'gpt-6-luna' }] } }).error, /refused/);
  const unknown = { ...capacity(70, 10), 'codex-agent': { running: 0, auth: 'ok', quota: { state: 'unknown' } } };
  const result = route({ capacity: unknown, bias: { only: [{ provider: 'codex' }] } });
  assert.equal(result.admission.reason, 'bias-empties-chain');
  assert.ok(result.admission.rejected.find((row) => row.id.startsWith('codex/')).codes.includes('quota-unknown'));
  assert.equal(route({ kind: 'interface.asset', bias: { prefer: [{ provider: 'codex' }] } }).target, 'codex-agent');
  assert.equal(route({ kind: 'interface.asset' }).tier, 'high', 'a drawing op takes the tier of its difficulty, not the image call tier');
});

test('static pool policy planning cannot claim fresh live admission or spend a concrete owner only-model', () => {
  const result = selectPool({ kind: 'backend.implement', difficulty: 'medium' });
  assert.equal(result.admission.ok, false);
  assert.equal(result.admission.planOnly, true);
  assert.equal(result.admission.reason, 'live-evidence-required');
  assert.ok(selectPool({ kind: 'backend.implement', difficulty: 'medium', bias: { only: [{ provider: 'claude' }] } }).error, 'medium has no Claude member');
  assert.equal(result.pick.tier, 'medium');
});
