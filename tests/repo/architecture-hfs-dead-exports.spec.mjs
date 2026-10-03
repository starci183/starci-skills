import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { deadExportsFixture } from '../helpers/repo-architecture-hfs-dead-exports-fixture.mjs';
import { appDeclaration, archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// HFS check 4: an export of an owner's public entry that no production file outside the owner imports is dead
// (HFS_UNUSED_EXPORT). Specs are not part of the graph, so an export used only by a spec is dead on purpose.

const dead = (report, entry) => findings(report, 'HFS_UNUSED_EXPORT').filter(item => item.path === entry).map(item => item.name).sort();
const cleanups = [];
let fixture;
before(() => { fixture = deadExportsFixture(cleanup => cleanups.push(cleanup)); });
after(() => { for (const cleanup of cleanups) cleanup(); });

test('a dead export is flagged with its line and owner, a used export is not', () => {
  const { report, scenarios } = fixture;
  const { x } = scenarios.lineAndOwner;
  assert.deepEqual(dead(report, x), ['alsoUnused', 'unused']);
  const hit = findings(report, 'HFS_UNUSED_EXPORT').find(item => item.name === 'unused' && item.path === x);
  assert.equal(hit.line, 2);
  assert.equal(hit.owner, 'src/modules/domain/dead-line');
  assert.equal(report.coverage.hfsMachine.deadExports.status, 'checked');
  assert.ok(report.coverage.hfsMachine.deadExports.dead >= 2);
  assert.ok(report.coverage.checkedRuleIds.includes('HFS_UNUSED_EXPORT'));
});

test('an aliased import uses the exported name, and a same-owner import does not count', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.aliasAndOwner.x), ['local']);
});

test('a namespace import uses every export', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.namespace.x), []);
});

test('a dynamic import uses every export', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.dynamic.x), []);
});

test('a type-only import uses the export', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.typeOnly.x), ['Other']);
});

test('default export: used by a default import, otherwise dead', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.defaultExport.x), []);
  assert.deepEqual(dead(report, scenarios.defaultExport.deadX), ['default']);
});

test('a re-export by another owner counts only when the re-exported name is used', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.reexportUsed.x), ['other']);
  assert.deepEqual(dead(report, scenarios.reexportUsed.y), ['other']);
});

test('a re-export nobody imports leaves the source export dead', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.reexportDead.x), ['helper']);
  assert.deepEqual(dead(report, scenarios.reexportDead.y), ['helper']);
});

test('an app owner is never checked', () => {
  const { report } = fixture;
  assert.deepEqual(findings(report, 'HFS_UNUSED_EXPORT').filter(item => item.path.startsWith('apps/')), []);
});

test('an export used only by a spec is dead', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.specOnly.x), ['onlySpec']);
});

// Exception: a service unit spec and a fixture builder count as consumers (a spec can only provide a token the entry exports).
test('HFS_UNUSED_EXPORT: an export used only by a service spec or a fixture builder passes; one used by nobody, or only by an e2e spec, still fails', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.roleConsumers.x), ['nobody', 'onlyE2e']);
});

test('HFS_UNUSED_EXPORT: a spec of another kind does not count as a consumer', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.otherSpec.x), ['nobody', 'onlyE2e']);
});

// Every unit role counts (ruleParams.be.unitRoles: the cli spec beside its command), and so does the test world, which opens and
// migrates the real databases of the e2e run.
test('HFS_UNUSED_EXPORT: an export used only by a cli unit spec or a test world file passes; an e2e spec still does not count', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.cliAndWorld.x), ['nobody', 'onlyE2e']);
});

test('HFS_UNUSED_EXPORT: the unit spec of a webhook, gateway or subscription door counts as a consumer: a door has no service of its own', () => {
  const { report, scenarios } = fixture;
  assert.deepEqual(dead(report, scenarios.doorSpec.x), ['onlyE2e']);
});

// A slot-declared entry (slot field `entries`, fe.modules.db browser.ts under lite) is a public entry of its owner: a hook importing
// it uses its exports, and an export of it that nothing outside the owner imports is dead like one of index.ts.
const liteDb = (extra = {}) => {
  const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
  declaration.edition = 'lite';
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  return {
    '../hfs.json': `${JSON.stringify(declaration, null, 2)}\n`,
    'apps/web/src/modules/db/index.ts': "export { readSession } from './principal';\n",
    'apps/web/src/modules/db/principal.ts': 'export const readSession = async () => 1;\n',
    'apps/web/src/modules/db/browser.ts': 'export const createBrowserDbClient = () => 1;\nexport const spareBrowserHelper = () => 2;\n',
    'apps/web/src/hooks/orders/useOrders.ts': "import { readSession } from '../../modules/db';\nimport { createBrowserDbClient } from '../../modules/db/browser';\nexport const useOrders = () => [readSession, createBrowserDbClient];\n",
    ...extra,
  };
};
const DB_BROWSER = 'apps/web/src/modules/db/browser.ts';

test('an export of a slot-declared entry that a hook imports is used, one nothing imports is HFS_UNUSED_EXPORT', t => {
  const report = runArch(archFixture(t, { profile: 'fe', files: liteDb() }));
  assert.deepEqual(dead(report, DB_BROWSER), ['spareBrowserHelper']);
  assert.deepEqual(dead(report, 'apps/web/src/modules/db/index.ts'), []);
  const hit = findings(report, 'HFS_UNUSED_EXPORT').find(item => item.path === DB_BROWSER);
  assert.equal(hit.line, 2);
  assert.equal(hit.owner, 'apps/web/src/modules/db');
});

test('a slot-declared entry nobody imports has every export dead; a namespace import of it uses them all', t => {
  const unused = runArch(archFixture(t, { profile: 'fe', files: liteDb({ 'apps/web/src/hooks/orders/useOrders.ts': "import { readSession } from '../../modules/db';\nexport const useOrders = readSession;\n" }) }));
  assert.deepEqual(dead(unused, DB_BROWSER), ['createBrowserDbClient', 'spareBrowserHelper']);
  const all = runArch(archFixture(t, { profile: 'fe', files: liteDb({ 'apps/web/src/hooks/orders/useOrders.ts': "import { readSession } from '../../modules/db';\nimport * as browser from '../../modules/db/browser';\nexport const useOrders = () => [readSession, browser];\n" }) }));
  assert.deepEqual(dead(all, DB_BROWSER), []);
});

test('a file the slot does not declare as an entry is not judged as one: modules/config/browser.ts exports are not HFS_UNUSED_EXPORT', t => {
  const report = runArch(archFixture(t, {
    profile: 'fe',
    files: liteDb({
      'apps/web/src/modules/config/index.ts': 'export const config = 1;\n',
      'apps/web/src/modules/config/browser.ts': 'export const browserConfig = 1;\n',
      'apps/web/src/hooks/orders/useConfig.ts': "import { config } from '../../modules/config';\nexport const useConfig = config;\n",
    }),
  }));
  assert.deepEqual(dead(report, 'apps/web/src/modules/config/browser.ts'), []);
});
