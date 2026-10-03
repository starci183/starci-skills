import test from 'node:test';
import assert from 'node:assert/strict';
import {
  declarationEdition,
  editionRuleParams,
  effectiveSlot,
  enforcerJudgedInEdition,
  judgedInEdition,
  litePresenceOf,
  managedGroupOf,
  slotInEdition,
} from '../../scripts/hfs/edition-slots.mjs';
import { EditionRefusal, refuseInEdition } from '../../packages/hfs/scaffold/edition-gate.mjs';
import { createSlotResolver, HfsSlotsError, loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';

// Edition behavior is data-driven. An unknown slot is refused by the scaffold gate in both editions because neither
// resolver view can prove where it belongs; known full-only slots are available only to the full resolver.

const SIDES = {
  be: { apps: [{ name: 'core', kind: 'api' }] },
  fe: { apps: [{ name: 'web', kind: 'next' }] },
};
const declaration = (edition) => ({
  hfs: 2,
  kind: 'app',
  project: 'demo',
  ...(edition === undefined ? {} : { edition }),
  sides: SIDES,
});

test('slotInEdition uses a slot override, then manifest editions, then the edition vocabulary', () => {
  assert.equal(slotInEdition({ editions: ['full'] }, {}, 'lite'), false);
  assert.equal(slotInEdition({ editions: ['full'] }, { editions: ['lite'] }, 'lite'), true);
  assert.equal(slotInEdition({}, {}, 'full'), true);
  assert.equal(slotInEdition({}, {}, 'lite'), true);
});

test('litePresenceOf accepts a bare value and a per-side map with presence fallback', () => {
  assert.equal(litePresenceOf({ presence: 'required' }, 'be'), 'required');
  assert.equal(litePresenceOf({ presence: 'optional', litePresence: 'forbidden' }, 'be'), 'forbidden');
  const slot = { presence: 'required', litePresence: { be: 'optional', fe: 'forbidden' } };
  assert.equal(litePresenceOf(slot, 'be'), 'optional');
  assert.equal(litePresenceOf(slot, 'fe'), 'forbidden');
  assert.equal(litePresenceOf(slot, 'app'), 'required');
});

test('effectiveSlot applies every legal lite overlay field and forces tests to none', () => {
  const slot = {
    id: 'be.probe',
    path: 'before/',
    presence: 'required',
    tracked: 'tracked',
    tests: 'unit-beside',
    requires: ['before.ts'],
    allows: ['before.ts'],
    forbids: ['after.ts'],
    minInstances: 1,
    requiredInstances: { feature: ['before'] },
    litePresence: 'optional',
    lite: {
      path: 'after/',
      requires: ['after.ts'],
      allows: ['after.ts'],
      forbids: ['before.ts'],
      minInstances: 2,
      requiredInstances: { feature: ['after'] },
    },
  };

  assert.strictEqual(effectiveSlot(slot, 'be', 'full'), slot);
  assert.deepEqual(effectiveSlot(slot, 'be', 'lite'), {
    id: 'be.probe',
    path: 'after/',
    presence: 'optional',
    tracked: 'tracked',
    tests: 'none',
    requires: ['after.ts'],
    allows: ['after.ts'],
    forbids: ['before.ts'],
    minInstances: 2,
    requiredInstances: { feature: ['after'] },
  });
});

test('effectiveSlot makes a lite-forbidden slot external and keeps its destination', () => {
  const effective = effectiveSlot({
    id: 'be.probe',
    path: 'probe/',
    presence: 'optional',
    litePresence: 'forbidden',
    tracked: 'tracked',
    tests: 'unit-beside',
    goesTo: 'the full edition',
  }, 'be', 'lite');
  assert.deepEqual(
    { presence: effective.presence, tracked: effective.tracked, tests: effective.tests, goesTo: effective.goesTo },
    { presence: 'forbidden', tracked: 'external', tests: 'none', goesTo: 'the full edition' },
  );
});

test('editionRuleParams merges the lite override, removes its source key and deeply freezes a copy', () => {
  const params = {
    fileLines: { soft: 500, hardGrowth: true },
    schemaAuthority: 'typeorm',
    roles: ['service'],
    lite: { schemaAuthority: 'supabase', roles: [] },
  };
  const lite = editionRuleParams(params, 'lite');
  assert.deepEqual(lite, { fileLines: { soft: 500, hardGrowth: true }, schemaAuthority: 'supabase', roles: [] });
  assert.equal('lite' in lite, false);
  assert.notStrictEqual(lite.fileLines, params.fileLines);
  assert.throws(() => { lite.fileLines.soft = 1; }, TypeError);
  assert.deepEqual(editionRuleParams(params, 'full'), {
    fileLines: { soft: 500, hardGrowth: true },
    schemaAuthority: 'typeorm',
    roles: ['service'],
  });
});

test('judgedInEdition keeps uncatalogued and unqualified rules and filters an explicit edition list', () => {
  assert.equal(judgedInEdition(undefined, 'lite'), true);
  assert.equal(judgedInEdition({ id: 'R01' }, 'lite'), true);
  assert.equal(judgedInEdition({ id: 'R01', editions: ['full'] }, 'lite'), false);
  assert.equal(judgedInEdition({ id: 'R01', editions: ['full'] }, 'full'), true);
});

test('enforcerJudgedInEdition filters only the qualified enforcer and combines shared owners', () => {
  const several = [{
    id: 'R01',
    enforcers: [
      { kind: 'eslint-be', id: 'kept' },
      { kind: 'eslint-be', id: 'full-only', editions: ['full'] },
    ],
  }];
  assert.equal(enforcerJudgedInEdition(several, 'eslint-be', 'kept', 'lite'), true);
  assert.equal(enforcerJudgedInEdition(several, 'eslint-be', 'full-only', 'lite'), false);
  assert.equal(enforcerJudgedInEdition(several, 'eslint-be', 'full-only', 'full'), true);

  const shared = [
    { id: 'R01', enforcers: [{ kind: 'eslint-fe', id: 'shared' }] },
    { id: 'R02', enforcers: [{ kind: 'eslint-fe', id: 'shared' }] },
  ];
  assert.equal(enforcerJudgedInEdition(shared, 'eslint-fe', 'shared', 'lite'), true);
  shared[1].editions = ['full'];
  assert.equal(enforcerJudgedInEdition(shared, 'eslint-fe', 'shared', 'lite'), false);
  assert.equal(enforcerJudgedInEdition(shared, 'eslint-fe', 'shared', 'full'), true);
  assert.equal(enforcerJudgedInEdition(shared, 'eslint-fe', 'not-catalogued', 'lite'), true);
});

test('managedGroupOf selects the lite template group and otherwise falls back to the full group', () => {
  assert.equal(managedGroupOf({ managedBy: 'full', liteManagedBy: 'lite' }, 'lite'), 'lite');
  assert.equal(managedGroupOf({ managedBy: 'full', liteManagedBy: 'lite' }, 'full'), 'full');
  assert.equal(managedGroupOf({ managedBy: 'full' }, 'lite'), 'full');
  assert.equal(managedGroupOf({ liteManagedBy: 'lite' }, 'full'), undefined);
});

test('declarationEdition defaults to full and resolveRepoDeclaration preserves HFS_EDITION_INVALID', () => {
  assert.deepEqual(declarationEdition({}, {}), { edition: 'full', known: ['full', 'lite'], valid: true });
  assert.deepEqual(declarationEdition({ editions: ['full'] }, { edition: 'lite' }), {
    edition: 'lite',
    known: ['full'],
    valid: false,
  });
  const manifest = loadSlotManifest();
  assert.throws(
    () => resolveRepoDeclaration(manifest, declaration('compact')),
    (error) => error instanceof HfsSlotsError && error.code === 'HFS_EDITION_INVALID',
  );
});

test('the edition gate refuses an unknown slot in both full and lite resolver views', () => {
  const manifest = loadSlotManifest();
  for (const edition of [undefined, 'lite']) {
    const repo = resolveRepoDeclaration(manifest, declaration(edition));
    const resolver = createSlotResolver(manifest, repo);
    assert.equal(resolver.slot('be.not-a-slot'), null);
    assert.throws(
      () => refuseInEdition({ resolver, slotIds: ['be.not-a-slot'], command: 'add probe' }),
      (error) => error instanceof EditionRefusal
        && error.message === 'add probe: full edition only; run starci app upgrade --edition full',
      edition ?? 'full',
    );
  }
});
