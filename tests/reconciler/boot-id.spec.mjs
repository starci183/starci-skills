import test from 'node:test';
import assert from 'node:assert/strict';
import { bootIdentity } from '../../scripts/reconciler/boot-id.mjs';

const T0 = 1_800_000_000_000;

test('the boot instant is now minus the uptime and two reads inside one boot name the same boot', () => {
  const first = bootIdentity({ now: T0, uptimeSec: 3600 });
  assert.deepEqual([first.bootAt, first.uptimeMs], [T0 - 3_600_000, 3_600_000]);
  const later = bootIdentity({ now: T0 + 7_200_000, uptimeSec: 3600 + 7200 });
  assert.equal(later.bootAt, first.bootAt);
  assert.equal(later.bootId, first.bootId);
});

test('a host that booted again names a later instant and another boot id', () => {
  const before = bootIdentity({ now: T0, uptimeSec: 3600 });
  const after = bootIdentity({ now: T0 + 10_800_000, uptimeSec: 60 });
  assert.ok(after.bootAt > before.bootAt + 3_000_000);
  assert.notEqual(after.bootId, before.bootId);
  assert.match(after.bootId, /^[0-9a-f]{12}$/);
});

test('the live clocks give a boot instant in the past', () => {
  const now = Date.now();
  const live = bootIdentity({ now });
  assert.ok(live.bootAt < now && live.uptimeMs > 0);
});
