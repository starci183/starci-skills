import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { findings } from '../helpers/hfs-arch-fixture.mjs';
import { reachabilityFixture } from '../helpers/repo-architecture-hfs-reachability-fixture.mjs';

// HFS check 3: reachability. BE features and capability modules must be composed into an app root; FE page features must be
// mounted by a route; FE string-literal hrefs must resolve to a route.

const reach = report => report.coverage.hfsMachine.reachability;
let fixture;
before(() => { fixture = reachabilityFixture(); });
after(() => fixture?.close());

test('BE: a feature the app module imports at runtime is composed', () => {
  const { report, paths } = fixture.be;
  assert.deepEqual(findings(report, 'BE_FEATURE_NOT_COMPOSED').filter(item => item.owner === paths.composedOwner), []);
  assert.equal(reach(report).status, 'checked');
  assert.equal(reach(report).features, 4);
  assert.equal(reach(report).appRoots, 4);
  assert.equal(reach(report).notComposed, 3);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_FEATURE_NOT_COMPOSED'));
});

test('BE: a feature no app root imports is reported with the roots examined', () => {
  const { report, paths } = fixture.be;
  const hits = findings(report, 'BE_FEATURE_NOT_COMPOSED').filter(item => item.owner === paths.orphanOwner);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, paths.orphanFeature);
  assert.equal(hits[0].owner, paths.orphanOwner);
  assert.deepEqual(hits[0].appRoots, ['apps/capability/src', 'apps/composed/src', 'apps/orphan/src', 'apps/type-only/src']);
  assert.match(hits[0].message, /orphan/);
  assert.equal(reach(report).notComposed, 3);
});

test('BE: a type-only import from the app module does not compose a feature', () => {
  const { report, paths } = fixture.be;
  const hits = findings(report, 'BE_FEATURE_NOT_COMPOSED').filter(item => item.owner === paths.typeOnlyOwner);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].owner, paths.typeOnlyOwner);
});

test('BE: a capability module reached through a composed feature is composed; an unreached one is BE_FEATURE_NOT_COMPOSED', () => {
  const { report, paths } = fixture.be;
  const hits = findings(report, 'BE_FEATURE_NOT_COMPOSED').filter(item => item.owner === paths.unusedOwner);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].owner, paths.unusedOwner);
  assert.equal(hits[0].slot, 'be.integrations');
  assert.equal(reach(report).features, 4);
  assert.equal(reach(report).modules, 3);
  assert.equal(reach(report).notComposed, 3);
});

test('FE: a page feature imported by an app route is mounted', () => {
  const { report, apps } = fixture.fe;
  assert.deepEqual(findings(report, 'FE_OWNER_REACHABLE').filter(item => item.app === apps.mounted), []);
  assert.equal(reach(report).status, 'checked');
  assert.equal(reach(report).pages, 5);
  assert.equal(reach(report).mounted, 3);
  assert.equal(reach(report).routes, 13);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_OWNER_REACHABLE'));
});

test('FE: a page feature no route imports (or only imports as a type) is not mounted', () => {
  const { report, apps } = fixture.fe;
  const hits = findings(report, 'FE_OWNER_REACHABLE').filter(item => item.app === apps.typeOnly);
  assert.deepEqual(hits.map(hit => hit.path).sort(), ['apps/type-only/src/features/pages/home/index.tsx', 'apps/type-only/src/features/pages/orphan/index.tsx']);
  assert.equal(hits[0].app, apps.typeOnly);
});

test('FE: hrefs that match a route resolve; locale, route groups, dynamic segments and template literals are transparent', () => {
  const { report, apps } = fixture.fe;
  assert.deepEqual(findings(report, 'FE_HREF_RESOLVES').filter(item => item.app === apps.hrefOk), []);
  assert.equal(reach(report).hrefs, 13);
  assert.equal(reach(report).hrefsResolved, 7);
  assert.equal(reach(report).hrefsSkipped, 3);
});

test('FE: an href, redirect or router.push target no route serves is FE_HREF_RESOLVES with the href and location', () => {
  const { report, apps } = fixture.fe;
  const hits = findings(report, 'FE_HREF_RESOLVES').filter(item => item.app === apps.hrefBad);
  assert.deepEqual(hits.map(hit => hit.href).sort(), ['/courses/${…}/lessons', '/missing', '/nowhere']);
  const missing = hits.find(hit => hit.href === '/missing');
  assert.equal(missing.path, 'apps/href-bad/src/features/pages/home/index.tsx');
  assert.equal(missing.line, 7);
  assert.equal(missing.app, apps.hrefBad);
  assert.match(missing.message, /\/missing/);
  assert.equal(reach(report).hrefs, 13);
  assert.equal(reach(report).hrefsResolved, 7);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_HREF_RESOLVES'));
});
