import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPortBlock } from '../../scripts/machine/supabase-policy.mjs';

const VALID = Object.freeze({
  api: 44830,
  db: 44831,
  shadow: 44832,
  studio: 44833,
  inbucket: 44834,
  analytics: 44835,
  pooler: 44836,
});

test('checkPortBlock accepts one unique block wholly inside 41000-44999', () => {
  assert.deepEqual(checkPortBlock(VALID), { ok: true, refusals: [] });
});

test('checkPortBlock names every reserved, duplicate and outside rule', async (t) => {
  const cases = [
    { name: 'port 3100', ports: { ...VALID, api: 3100 }, match: /api port 3100.*3100 is never ours/u },
    { name: 'port 3000', ports: { ...VALID, api: 3000 }, match: /api port 3000.*3000 is never ours/u },
    { name: 'default Supabase block', ports: { ...VALID, db: 54325 }, match: /db port 54325.*54320-54329 are never ours/u },
    { name: 'nivo-lite block', ports: { ...VALID, studio: 55322 }, match: /studio port 55322.*55321-55327 are never ours/u },
    { name: 'duplicate', ports: { ...VALID, db: VALID.api }, match: /port 44830.*api, db.*unique/u },
    { name: 'outside owned block', ports: { ...VALID, api: 45000 }, match: /api port 45000.*inside 41000-44999/u },
  ];
  for (const item of cases) {
    await t.test(item.name, () => {
      const verdict = checkPortBlock(item.ports);
      assert.equal(verdict.ok, false);
      assert.match(verdict.refusals.join('\n'), item.match);
    });
  }
});

test('checkPortBlock refuses a missing configured port instead of silently shrinking the stack', () => {
  const ports = { ...VALID };
  delete ports.pooler;
  const verdict = checkPortBlock(ports);
  assert.equal(verdict.ok, false);
  assert.match(verdict.refusals.join('\n'), /pooler port is missing.*41000-44999/u);
});
