import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { checkShellConformance } from '../../scripts/work/ui/shell-conformance.mjs';
import {
  appNamesOf, appOfUi, frontendOf, layoutTreeMain, locateApps, nodeById, nodesOf, treeOf,
} from '../../scripts/work/layout-tree.mjs';
import { APP_FILES, appDeclarationText, buildProduct, uiSkeleton } from '../fixtures/layout-tree.mjs';

// The fe side of an app may hold several apps (fe/apps/app, the console, and fe/apps/landing, the public
// website). The layout tree holds one tree per fe app hfs.json declares; a ui record binds its route in an
// app, named by `app`, or derived when the tree holds one app or only one app holds the route.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateTree = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-layout-tree.schema.yaml'), 'utf8')));
const validateUi = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-ui-screen.schema.yaml'), 'utf8')));

const LANDING_FILES = {
  'apps/landing/tsconfig.json': JSON.stringify({ compilerOptions: {} }),
  'apps/landing/src/app/layout.tsx': 'export default function RootLayout({ children }) { return <html><body>{children}</body></html> }\n',
  'apps/landing/src/app/page.tsx': 'export default () => <main>Home</main>\n',
  'apps/landing/src/app/pricing/page.tsx': 'export default () => <main>Pricing</main>\n',
};
const DECLARED = ['app', 'landing'];
const twoApps = (t, { apps = DECLARED } = {}) => buildProduct(t, { files: { ...APP_FILES, ...LANDING_FILES }, apps });
const scanAll = (p) => {
  const result = layoutTreeMain(['scan', '--work', p.work, '--write']);
  assert.equal(result.exitCode, 0, result.text);
  return parseYaml(fs.readFileSync(path.join(p.work, 'shell', 'index.yaml'), 'utf8'));
};

/** A ui record for a public page, outside the console chrome, checked against the written tree. */
const check = (p, over) => {
  const record = uiSkeleton('ui.site.pricing', { surface: 'page', shell: { chromeless: true, because: 'A public page outside the console shell.' }, ...over });
  const dir = path.join(p.work, 'features', 'site', 'ui', 'pricing');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml(record));
  const result = checkShellConformance(dir);
  return { record, codes: [...new Set(result.findings.filter((f) => f.level === 'refuse').map((f) => f.code))], findings: result.findings };
};

test('the scan covers every fe app hfs.json declares, keyed by app, and the record compiles', (t) => {
  const p = twoApps(t);
  const located = locateApps(p.work);
  assert.deepEqual(located.apps.map((a) => [a.name, a.root]), [['app', 'fe/apps/app'], ['landing', 'fe/apps/landing']]);
  assert.equal(located.error, undefined);
  const record = scanAll(p);
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));
  assert.deepEqual(appNamesOf(record), ['app', 'landing']);
  assert.equal('nodes' in record || 'app' in record || 'source' in record, false, 'the single-app fields are gone');
  const [app, landing] = record.apps;
  assert.equal(app.appDir, 'fe/apps/app/src/app');
  assert.equal(landing.appDir, 'fe/apps/landing/src/app');
  assert.equal('repository' in landing, false, 'the app is the one repository');
  assert.deepEqual(landing.nodes.map((n) => n.id), ['/', '/pricing']);
  assert.ok(app.nodes.some((n) => n.id === '/[locale]/(console)'), 'the console routes stay in their own app');
  assert.match(landing.source.digest, /^[a-f0-9]{64}$/);
  assert.notEqual(landing.source.digest, app.source.digest, 'each app has its own source digest');
  // A re-scan is stable, and dropping an app from the declaration drops its tree.
  const again = layoutTreeMain(['scan', '--work', p.work, '--json']);
  assert.equal(JSON.parse(again.text).record.rev, record.rev, 'nothing moved, so the rev holds');
  fs.writeFileSync(path.join(p.app, 'hfs.json'), appDeclarationText([DECLARED[0]]));
  const dropped = JSON.parse(layoutTreeMain(['scan', '--work', p.work, '--json']).text);
  assert.deepEqual(appNamesOf(dropped.record), ['app']);
  assert.ok(dropped.notes.some((n) => /app landing: no longer declared/.test(n)));
});

test('the workspace schema no longer declares apps: hfs.json sides.fe.apps is the one declaration', () => {
  const schema = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-workspace.schema.yaml'), 'utf8'));
  assert.equal('apps' in schema.properties.repositories.items.properties, false);
});

test('the fe apps resolve through the app sides: hfs.json names them, an app without a readable hfs.json is refused', (t) => {
  const single = buildProduct(t);
  const found = locateApps(single.work);
  assert.deepEqual(found.apps.map((a) => [a.name, a.root]), [['app', 'fe/apps/app']]);
  const located = frontendOf(single.work);
  assert.deepEqual([located.repoRoot, located.feRoot], [single.app, single.fe]);
  const record = scanAll(single);
  assert.deepEqual(appNamesOf(record), ['app'], 'a single-app product keeps working');
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));

  const undeclared = buildProduct(t);
  fs.rmSync(path.join(undeclared.app, 'hfs.json'));
  assert.match(locateApps(undeclared.work).error, /no readable app declaration/);
  const refused = layoutTreeMain(['scan', '--work', undeclared.work, '--write']);
  assert.equal(refused.exitCode, 1);
  assert.match(refused.text, /no readable app declaration/);
  assert.equal(fs.existsSync(path.join(undeclared.work, 'shell', 'index.yaml')), false, 'nothing is written');
});

test('a declared app without an app/ directory is refused by the scan', (t) => {
  const p = twoApps(t, { apps: [...DECLARED, 'expert'] });
  const refused = layoutTreeMain(['scan', '--work', p.work, '--write']);
  assert.equal(refused.exitCode, 1);
  assert.match(refused.text, /app expert \(fe\/apps\/expert\) has no app\/ or src\/app\/ directory/);
});

test('a route resolves in the app the ui record names; the same route in the wrong app is refused', (t) => {
  const p = twoApps(t);
  const record = scanAll(p);
  assert.equal(nodeById(treeOf(record, 'landing'), '/pricing')?.id, '/pricing');
  assert.equal(nodeById(treeOf(record, 'app'), '/pricing'), null, '/pricing is no route of the console');
  assert.equal(nodesOf(treeOf(record, 'landing')).length, 2);

  const right = check(p, { app: 'landing', route: '/pricing' });
  assert.deepEqual(right.codes.filter((c) => /^UI_(ROUTE|APP)_/.test(c)), [], JSON.stringify(right.findings.filter((f) => f.level === 'refuse')));
  validateUi(right.record);
  assert.deepEqual(validateUi.errors.filter((e) => e.instancePath === '/app' || e.params?.additionalProperty === 'app'), [], 'the ui-screen schema carries app');
  validateUi({ ...right.record, app: 'Landing App' });
  assert.ok(validateUi.errors.some((e) => e.instancePath === '/app'), 'an app is a slug');

  const wrong = check(p, { app: 'app', route: '/pricing' });
  assert.ok(wrong.codes.includes('UI_ROUTE_UNKNOWN'), wrong.codes.join(','));
  assert.match(wrong.findings.find((f) => f.code === 'UI_ROUTE_UNKNOWN').message, /in app app/);

  const ghost = check(p, { app: 'ghost', route: '/pricing' });
  assert.deepEqual(ghost.codes.filter((c) => /^UI_(ROUTE|APP)_/.test(c)), ['UI_APP_UNKNOWN']);
  assert.match(ghost.findings.find((f) => f.code === 'UI_APP_UNKNOWN').message, /"ghost" is not an app of the layout tree \(app, landing\)/);
});

test('without app: derived when only one app holds the route, refused with the reason when it does not decide', (t) => {
  const p = twoApps(t);
  const record = scanAll(p);
  assert.equal(appOfUi(record, { route: '/pricing' }).app, 'landing', 'only the landing app has /pricing');
  assert.equal(appOfUi(record, { route: '/[locale]/(console)/photos' }).app, 'app');
  assert.equal(appOfUi(record, { route: '/pricing/plans', routeParent: '/pricing' }).app, 'landing', 'a new route is placed by its routeParent');

  const derived = check(p, { route: '/pricing' });
  assert.deepEqual(derived.codes.filter((c) => /^UI_(ROUTE|APP)_/.test(c)), []);

  const both = check(p, { route: '/' });
  assert.deepEqual(both.codes.filter((c) => /^UI_(ROUTE|APP)_/.test(c)), ['UI_APP_MISSING']);
  assert.match(both.findings.find((f) => f.code === 'UI_APP_MISSING').message, /declares 2 apps \(app, landing\) and the route \/ exists in app and landing - name the app with `app:`/);

  const none = check(p, { route: '/nowhere' });
  assert.match(none.findings.find((f) => f.code === 'UI_APP_MISSING').message, /no app holds the route \/nowhere/);
});

test('a single-app tree needs no app: on the record, and the default app is the only one', (t) => {
  const p = buildProduct(t);
  const record = scanAll(p);
  assert.equal(appOfUi(record, { route: '/[locale]/(console)/photos' }).app, 'app');
  assert.equal(appOfUi(record, { route: '/nowhere' }).app, 'app', 'the only app is the default, whatever the route');
  assert.equal(appOfUi(record, { app: 'app', route: '/' }).app, 'app');
  assert.equal(appOfUi(record, { app: 'landing', route: '/' }).error.code, 'UI_APP_UNKNOWN');
  const bare = check(p, { route: '/[locale]/(auth)/sign-in' });
  assert.deepEqual(bare.codes.filter((c) => /^UI_(ROUTE|APP)_/.test(c)), []);
});

test('capture, plan and destinations name the app when the tree holds several', (t) => {
  const p = twoApps(t);
  scanAll(p);
  const planned = layoutTreeMain(['plan', '--work', p.work, '--node', '/(site)', '--files', 'layout,page', '--design', 'ui.site.frame', '--write']);
  assert.equal(planned.exitCode, 2);
  assert.match(planned.text, /declares 2 apps \(app, landing\) - name one with --app/);
  const ok = layoutTreeMain(['plan', '--work', p.work, '--app', 'landing', '--node', '/(site)', '--files', 'layout,page', '--design', 'ui.site.frame', '--write']);
  assert.equal(ok.exitCode, 0, ok.text);
  const written = parseYaml(fs.readFileSync(path.join(p.work, 'shell', 'index.yaml'), 'utf8'));
  assert.ok(nodeById(treeOf(written, 'landing'), '/(site)'), 'planned into landing');
  assert.equal(nodeById(treeOf(written, 'app'), '/(site)'), null, 'and not into the console');
  assert.equal(nodeById(treeOf(written, 'landing'), '/(site)').files.layout.path, 'fe/apps/landing/src/app/(site)/layout.tsx');
  const bogus = layoutTreeMain(['destinations', '--work', p.work, '--route', '/', '--app', 'ghost']);
  assert.equal(bogus.exitCode, 2);
  assert.match(bogus.text, /--app ghost is not an app of the layout tree \(app, landing\)/);
});
