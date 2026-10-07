// A call tier (modules/models/tiers.yaml tierUse) is taken by one headless call only: no seat and no op is seated on it, the
// config validator refuses a reference to it, and the shipped drawing ops take the tier of their difficulty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveTiers } from '../../engine/model-config.mjs';
import { runtimeProfile } from '../../engine/config.mjs';
import { callSpec, callTierRefusal, isCallTier, tierMembers, tierOfOp, tierSettings } from '../../scripts/agent/tiers.mjs';
import { pickOpModel } from '../../scripts/agent/op-pick.mjs';
import { loadRuntimes } from '../../scripts/agent/models.mjs';

const settings = tierSettings();

test('the shipped data declares imagegen a call tier with its call spec, and no kind, seat or difficulty names it', () => {
  assert.equal(isCallTier('imagegen', settings), true);
  assert.equal(isCallTier('high', settings), false);
  assert.deepEqual(callSpec('imagegen', settings), { tier: 'imagegen', timeoutMs: 600000, maxImages: 8, maxReferences: 6 });
  assert.equal(callSpec('nothing', settings), null);
  assert.deepEqual(settings.kindTiers, {});
  const named = [...Object.values(settings.seats), ...Object.values(settings.difficulty), ...Object.values(settings.kindTiers), ...settings.tierOrder];
  assert.equal(named.includes('imagegen'), false);
});

test('a drawing op takes the tier of its difficulty: high from its hard floor, never imagegen', () => {
  for (const kind of ['interface.draw', 'interface.asset', 'brand.decide']) {
    assert.equal(tierOfOp({ kind, difficulty: 'hard' }, settings), 'high', kind);
    assert.equal(tierOfOp({ kind, difficulty: 'insane' }, settings), 'frontier', kind);
  }
});

test('a call tier is read as a call and refused as a seat; a seat tier is refused as a call', () => {
  assert.deepEqual(tierMembers('imagegen', { settings, use: 'call' }).map((member) => member.id), ['codex/gpt-6.1-sol']);
  assert.throws(() => tierMembers('imagegen', { settings }), (error) => error.message === callTierRefusal('imagegen'));
  assert.throws(() => tierMembers('high', { settings, use: 'call' }), /is a seat tier/);
  assert.deepEqual(tierMembers('high', { settings }).map((member) => member.id), ['claude/claude-sonnet-5-5', 'codex/gpt-6.1-sol']);
});

test('the picker refuses to seat an op on a call tier', () => {
  const runtimes = loadRuntimes();
  const seated = { ...settings, kindTiers: { 'interface.draw': 'imagegen' } };
  const refused = pickOpModel({ kind: 'interface.draw', difficulty: 'hard', runtimes, settings: seated });
  assert.equal(refused.error, callTierRefusal('imagegen'));
  assert.equal(refused.callTier, 'imagegen');
  assert.equal(refused.target, undefined);
  assert.equal(pickOpModel({ kind: 'interface.draw', difficulty: 'hard', runtimes, settings }).error, undefined, 'the shipped data seats the draw op on high');
});

test('the config validator refuses a seat that names a call tier and accepts a seat tier', () => {
  const profile = runtimeProfile();
  const owner = (models) => effectiveTiers({ models }, profile);
  assert.throws(() => owner({ seats: { worker: 'imagegen' } }), /\.seats\.worker names tier imagegen, a call tier/);
  assert.doesNotThrow(() => owner({ seats: { worker: 'frontier' } }));
});
