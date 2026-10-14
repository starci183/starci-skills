import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { findings } from '../helpers/hfs-arch-fixture.mjs';
import { stagedConsumersFixture } from '../helpers/repo-architecture-hfs-staged-consumers-fixture.mjs';

const cleanups = [];
let fixture;
before(() => { fixture = stagedConsumersFixture(cleanup => cleanups.push(cleanup)); });
after(() => { for (const cleanup of cleanups) cleanup(); });

const unused = entry => findings(fixture.report, 'HFS_UNUSED_EXPORT').filter(item => item.path === entry).map(item => item.name);
const isUsed = name => assert.ok(!unused(fixture.entry).includes(name), `${name} must have a tracked or staged eligible consumer`);
const isDead = name => assert.ok(unused(fixture.entry).includes(name), `${name} must remain unused`);

test('a committed unit consumer and a new unit spec staged after HEAD both use the owner export', () => {
  isUsed('tracked');
  isUsed('added');
  isUsed('sameCommit');
});

test('the index import counts when a staged eligible spec is edited or removed on disk', () => {
  isUsed('diskEdited');
  isUsed('diskMissing');
  isUsed('modified');
});

test('a staged rename uses its eligible destination even when the destination is missing on disk', () => {
  isUsed('renamed');
  isDead('wrongRole');
});

test('an untracked eligible spec and a staged deletion recreated on disk do not use the export', () => {
  isDead('untracked');
  isDead('removed');
  isDead('nobody');
});

test('staging preserves the same-owner and e2e exclusions', () => {
  isDead('insideOwner');
  isDead('onlyE2e');
});

test('a staged integration spec counts only for the integration of its provider folder', () => {
  assert.deepEqual(unused('src/modules/integrations/stripe/index.ts'), ['otherProvider']);
  assert.deepEqual(unused('src/modules/integrations/paypal/index.ts'), ['foreignProvider']);
});
