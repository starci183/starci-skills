import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { deadExportsFixture } from '../helpers/repo-architecture-hfs-dead-exports-fixture.mjs';
import { findings } from '../helpers/hfs-arch-fixture.mjs';

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
