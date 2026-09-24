import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import {
  addCapture, addPlanned, chainOf, convertAppShell, layoutChainOf, layoutTreeMain, mergeScan, nodeById, resolveNavRoute,
  scanAppDir, segmentKindOf,
} from '../scripts/work/layout-tree.mjs';
import { blankImage, decodePng, drawOver, encodePng, keyRect } from '../scripts/work/png.mjs';
import { buildProduct, layoutCapture } from './fixtures/layout-tree.mjs';

// The layout tree is scanned out of the frontend's Next.js app/ directory - never hand-listed - so the
// layouts a drawing is composited into and the routes a build lands at are the ones the product has.
const ROOT = path.resolve(import.meta.dirname, '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateTree = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-layout-tree.schema.yaml'), 'utf8')));
const scanOf = (p) => scanAppDir(p.appDir, { repoRoot: p.web, repository: 'web' });

test('segment kinds follow the App Router file convention', () => {
  assert.equal(segmentKindOf('(console)'), 'group');
  assert.equal(segmentKindOf('@modal'), 'slot');
  assert.equal(segmentKindOf('(.)photos'), 'intercept');
  assert.equal(segmentKindOf('(..)photos'), 'intercept');
  assert.equal(segmentKindOf('(..)(..)photos'), 'intercept');
  assert.equal(segmentKindOf('(...)photos'), 'intercept');
  assert.equal(segmentKindOf('[id]'), 'dynamic');
  assert.equal(segmentKindOf('[...slug]'), 'catch-all');
  assert.equal(segmentKindOf('[[...slug]]'), 'optional-catch-all');
  assert.equal(segmentKindOf('photos'), 'static');
});

test('the scanner reads groups, nested layouts, a @modal slot with a (.) intercept, loading and error', (t) => {
  const p = buildProduct(t);
  const scan = scanOf(p);
  const ids = scan.nodes.map((n) => n.id);
  assert.deepEqual(ids, [
    '/', '/[locale]', '/[locale]/(auth)', '/[locale]/(auth)/sign-in', '/[locale]/(console)',
    '/[locale]/(console)/@modal', '/[locale]/(console)/@modal/(.)photos', '/[locale]/(console)/@modal/(.)photos/[id]',
    '/[locale]/(console)/photos', '/[locale]/(console)/photos/[id]', '/[locale]/(console)/reports',
  ], 'parents first; the private _components folder is not a route');
  const node = (id) => scan.nodes.find((n) => n.id === id);
  assert.equal(node('/[locale]/(auth)').segmentKind, 'group');
  assert.equal(node('/[locale]/(auth)').files, undefined, 'a route group without a layout of its own');
  assert.equal(node('/[locale]/(auth)/sign-in').url, '/[locale]/sign-in', 'a group adds nothing to the URL');
  assert.equal(node('/[locale]/(console)/@modal').segmentKind, 'slot');
  assert.ok(node('/[locale]/(console)/@modal').files.default, 'the slot default.tsx is read');
  assert.equal(node('/[locale]/(console)/@modal/(.)photos').url, '/[locale]/photos');
  assert.equal(node('/[locale]/(console)/@modal/(.)photos/[id]').intercepts, '/[locale]/(console)/photos/[id]', 'the intercept names the full page it presents');
  assert.deepEqual(Object.keys(node('/[locale]/(console)/photos').files).sort(), ['error', 'layout', 'loading', 'page']);
  assert.equal(node('/[locale]').layout.chrome, 'passthrough', 'a document + providers layout is a passthrough');
  assert.equal(node('/[locale]').layout.state, 'done');
  assert.equal(node('/[locale]/(console)').layout.component, 'ConsoleLayout');
  assert.equal(node('/[locale]/(console)').layout.chrome, 'unknown', 'a layout with chrome is decided by its owner, not guessed');
  assert.equal(node('/[locale]/(console)/photos').layout.component, 'PhotoTabs', 'nested layouts are nodes of their own');
  assert.equal(scan.app.localeParam, 'locale');
  assert.deepEqual(scan.productLocale, { default: 'vi', fallback: 'vi', locales: ['vi', 'en'], source: 'apps/app/src/i18n/config.ts (defaultLocale / locales)' });
  assert.deepEqual(scan.i18n.catalogs.map((c) => [c.locale, c.path]), [['en', 'apps/app/src/messages/en.json'], ['vi', 'apps/app/src/messages/vi.json']]);
  assert.match(scan.source.digest, /^[a-f0-9]{64}$/);
});

test('navigation labels come from the route tree plus the catalogs, and every mismatch is reported', (t) => {
  const p = buildProduct(t);
  const scan = scanOf(p);
  const nav = scan.nodes.find((n) => n.id === '/[locale]/(console)').layout.nav;
  assert.equal(nav.source, 'apps/app/src/shell/Sidebar.tsx');
  assert.deepEqual(nav.items.map((i) => [i.key, i.route, i.target, i.i18nKey]), [
    ['photos', '/photos', '/[locale]/(console)/photos', 'console.nav.photos'],
    ['billing', '/billing', null, 'console.nav.billing'],
    ['help', null, null, 'console.nav.help'],
  ]);
  assert.deepEqual(nav.items[0].labels, { en: 'Photos', vi: 'Ảnh' });
  assert.deepEqual(nav.items[1].labels, { en: 'Billing' }, 'a label is never typed in for a catalog that lacks it');
  assert.deepEqual(nav.findings.map((f) => f.code).sort(), ['NAV_LABEL_MISSING', 'NAV_ROUTE_MISSING', 'NAV_ROUTE_NULL', 'ROUTE_NOT_IN_NAV']);
  assert.match(nav.findings.find((f) => f.code === 'ROUTE_NOT_IN_NAV').detail, /^\/reports /);
  assert.equal(resolveNavRoute(scan.nodes, '/photos/42', 'locale'), '/[locale]/(console)/photos/[id]', 'a dynamic segment matches, the intercept does not');
});

test('a scanned record compiles, and a re-scan keeps decisions but re-opens a layout whose file changed', (t) => {
  const p = buildProduct(t);
  const first = mergeScan(null, scanOf(p), { at: '2026-09-24T00:00:00Z' }).record;
  assert.equal(validateTree(first), true, JSON.stringify(validateTree.errors));
  const consoleNode = nodeById(first, '/[locale]/(console)');
  consoleNode.layout.chrome = 'visible';
  consoleNode.layout.state = 'done';
  consoleNode.layout.captures = [{ breakpoint: 'desktop', theme: 'light', path: 'assets/layouts/x.png', sha256: 'a'.repeat(64), width: 40, height: 30, slot: { x: 1, y: 1, width: 5, height: 5 }, kind: 'render' }];
  addPlanned(first, { node: '/[locale]/(console)/settings', files: ['page'] });
  const again = mergeScan(first, scanOf(p), { at: '2026-09-24T00:00:01Z' });
  assert.equal(again.changed, false, 'nothing moved under app/');
  assert.equal(nodeById(again.record, '/[locale]/(console)').layout.chrome, 'visible');
  assert.equal(nodeById(again.record, '/[locale]/(console)/settings').origin, 'planned', 'a planned node survives a re-scan');
  fs.appendFileSync(path.join(p.appDir, '[locale]', '(console)', 'layout.tsx'), '// edited\n');
  const moved = mergeScan(again.record, scanOf(p), { at: '2026-09-24T00:00:02Z' });
  assert.equal(moved.changed, true);
  const layout = nodeById(moved.record, '/[locale]/(console)').layout;
  assert.equal(layout.rev, 2, 'the layout rev is bumped, staling every screen composited into it');
  assert.equal(layout.state, 'todo', 'a changed visible layout needs a re-capture');
  assert.equal(moved.record.rev, first.rev + 1);
  assert.equal(validateTree(moved.record), true, JSON.stringify(validateTree.errors));
});

test('a fresh app with no message catalogs scans to a record that compiles without i18n (starci-next inc-21d50d640e22)', (t) => {
  const files = {
    'apps/app/tsconfig.json': JSON.stringify({ compilerOptions: {} }),
    'apps/app/src/app/layout.tsx': 'export default function RootLayout({ children }) { return <html><body>{children}</body></html> }\n',
    'apps/app/src/app/page.tsx': 'import { notFound } from "next/navigation"\nexport default function Page() { notFound() }\n',
  };
  const p = buildProduct(t, { files });
  const scan = scanOf(p);
  assert.equal(scan.i18n, undefined, 'no catalog exists, so none is invented');
  const record = mergeScan(null, scan, { at: '2026-09-24T00:00:00Z' }).record;
  assert.equal(record.origin, 'repository');
  assert.equal('i18n' in record, false);
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));
  assert.equal(validateTree({ ...record, i18n: { catalogs: [] } }), false, 'an i18n block, when present, still names at least one real catalog');
  assert.equal(validateTree({ ...record, source: undefined }), false, 'a scanned tree still names what it scanned');
});

test('convert turns a work/app-shell@1 record into the layout tree, carrying locale, persona and lockup', (t) => {
  const p = buildProduct(t);
  const legacy = {
    schema: 'work/app-shell@1', id: 'shell', kind: 'shell', state: 'done', rev: 1, origin: 'repository', app: { repository: 'web', root: 'apps/app' },
    source: { layout: { component: 'ConsoleLayout', path: 'apps/app/src/shell/ConsoleLayout.tsx', sha256: 'b'.repeat(64) }, files: [{ path: 'apps/app/src/app/[locale]/(console)/layout.tsx', role: 'route-layout', sha256: 'c'.repeat(64) }] },
    topBar: { component: 'ConsoleTopBar', brand: { component: 'NivoBrand', path: 'packages/ui/NivoBrand.tsx', asset: 'assets/lockup-light.png' }, slots: [] },
    nav: { component: 'Sidebar', items: [{ key: 'chat', route: '/chat', labels: { vi: 'Trò chuyện' } }] },
    productLocale: { default: 'vi', fallback: 'vi', locales: ['vi', 'en'] },
    persona: { workspace: 'Support', user: 'An Nguyen', currency: 'VND', dateFormat: 'd MMM y' },
    assets: [
      { path: 'assets/shell-desktop-light.png', role: 'shell-capture', sha256: 'd'.repeat(64), viewport: 'desktop 1440x900', theme: 'light' },
      { path: 'assets/shell-mobile-dark.png', role: 'shell-capture', sha256: 'e'.repeat(64), viewport: 'mobile 390x844', theme: 'dark' },
      { path: 'assets/lockup-light.png', role: 'brand-lockup', sha256: 'f'.repeat(64), theme: 'light', width: 115, height: 40 },
    ],
  };
  const { record, notes } = convertAppShell(legacy, scanOf(p), { at: '2026-09-24T00:00:00Z' });
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));
  assert.equal(record.schema, 'work/layout-tree@1');
  assert.equal(record.state, 'todo', 'a converted tree has no slot-measured captures yet');
  assert.equal(record.rev, 2);
  assert.deepEqual(record.personas, [{ role: 'primary', default: true, workspace: 'Support', user: 'An Nguyen', currency: 'VND', dateFormat: 'd MMM y' }]);
  assert.deepEqual(record.brand.lockups.map((l) => l.path), ['assets/lockup-light.png']);
  assert.deepEqual(record.breakpoints, [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]);
  assert.deepEqual(record.themes, ['light', 'dark']);
  const consoleLayout = nodeById(record, '/[locale]/(console)').layout;
  assert.equal(consoleLayout.chrome, 'visible', 'the legacy shell layout is the visible chrome');
  assert.equal(consoleLayout.state, 'todo');
  assert.match(consoleLayout.blockers[0], /no measured page slot/);
  assert.ok(notes.some((n) => /legacy nav \[chat\] differs from the derived nav \[photos,billing,help\]/.test(n)), 'a hand-written nav that disagrees with the source is reported');
});

test('capture measures the #FF00FF slot, stores the bytes and bumps the layout rev on a changed capture', (t) => {
  const p = buildProduct(t);
  const record = mergeScan(null, scanOf(p)).record;
  record.breakpoints = [{ name: 'desktop', width: 40, height: 30 }];
  record.themes = ['light'];
  const shellDir = path.join(p.work, 'shell');
  const file = p.put('shot.png', encodePng(layoutCapture(40, 30, { x: 10, y: 5, width: 28, height: 22 })));
  const capture = addCapture(record, shellDir, { node: '/[locale]/(console)', breakpoint: 'desktop', theme: 'light', file, url: '/vi/reports' });
  assert.deepEqual(capture.slot, { x: 10, y: 5, width: 28, height: 22 });
  assert.equal(capture.path, 'assets/layouts/locale-console--desktop--light.png');
  assert.ok(fs.existsSync(path.join(shellDir, capture.path)));
  assert.equal(nodeById(record, '/[locale]/(console)').layout.chrome, 'visible');
  const second = p.put('shot2.png', encodePng(layoutCapture(40, 30, { x: 12, y: 5, width: 26, height: 22 })));
  addCapture(record, shellDir, { node: '/[locale]/(console)', breakpoint: 'desktop', theme: 'light', file: second });
  assert.equal(nodeById(record, '/[locale]/(console)').layout.rev, 2);
  const scattered = layoutCapture(40, 30, { x: 0, y: 0, width: 1, height: 1 });
  drawOver(scattered, blankImage(1, 1, [255, 0, 255, 255]), 39, 29);
  const noSlot = p.put('noslot.png', encodePng(scattered));
  assert.throws(() => addCapture(record, shellDir, { node: '/[locale]', breakpoint: 'desktop', theme: 'light', file: noSlot }));
  assert.deepEqual(keyRect(decodePng(fs.readFileSync(file))).rect, { x: 10, y: 5, width: 28, height: 22 });
});

test('a planned tree adds the missing ancestors, and chains resolve outermost first', () => {
  const record = { schema: 'work/layout-tree@1', app: { appDir: 'src/app' }, nodes: [] };
  addPlanned(record, { node: '/[locale]/(shop)/cart', files: ['page'] });
  addPlanned(record, { node: '/[locale]/(shop)', files: ['layout'], design: 'ui.shop.frame' });
  assert.deepEqual(chainOf(record, '/[locale]/(shop)/cart').map((n) => n.id), ['/', '/[locale]', '/[locale]/(shop)', '/[locale]/(shop)/cart']);
  assert.deepEqual(layoutChainOf(record, '/[locale]/(shop)/cart').map((n) => n.id), ['/[locale]/(shop)']);
  assert.equal(nodeById(record, '/[locale]/(shop)').layout.design, 'ui.shop.frame');
  assert.equal(nodeById(record, '/[locale]/(shop)/cart').files.page.path, 'src/app/[locale]/(shop)/cart/page.tsx');
  assert.equal(nodeById(record, '/[locale]/(shop)/cart').url, '/[locale]/cart');
});

test('the CLI scans read-only by default and writes the record only with --write', (t) => {
  const p = buildProduct(t);
  const dry = layoutTreeMain(['scan', '--work', p.work]);
  assert.equal(dry.exitCode, 0, dry.text);
  assert.match(dry.text, /ConsoleLayout chrome=unknown/);
  assert.equal(fs.existsSync(path.join(p.work, 'shell', 'index.yaml')), false);
  assert.equal(layoutTreeMain(['scan', '--work', p.work, '--write']).exitCode, 0);
  const written = parseYaml(fs.readFileSync(path.join(p.work, 'shell', 'index.yaml'), 'utf8'));
  assert.equal(written.schema, 'work/layout-tree@1');
  assert.equal(written.app.repository, 'web');
  assert.equal(layoutTreeMain(['slot', p.put('s.png', encodePng(layoutCapture(20, 20, { x: 2, y: 3, width: 4, height: 5 })))]).text.trim(), JSON.stringify({ ok: true, slot: { x: 2, y: 3, width: 4, height: 5 }, fill: 1 }));
  fs.writeFileSync(path.join(p.work, 'shell', 'index.yaml'), stringifyYaml({ schema: 'work/app-shell@1', id: 'shell', productLocale: { default: 'vi', fallback: 'vi', locales: ['vi'] } }));
  assert.equal(layoutTreeMain(['convert', '--work', p.work, '--write']).exitCode, 0);
  assert.equal(parseYaml(fs.readFileSync(path.join(p.work, 'shell', 'index.yaml'), 'utf8')).schema, 'work/layout-tree@1');
  assert.equal(layoutTreeMain(['bogus']).exitCode, 2);
});

test('the todo example carries an honestly unsettled, converted layout tree', () => {
  const example = parseYaml(fs.readFileSync(path.join(ROOT, 'examples/todo-app-backend/.starciwork/shell/index.yaml'), 'utf8'));
  assert.equal(validateTree(example), true, JSON.stringify(validateTree.errors));
  assert.equal(example.state, 'todo');
  assert.equal(example.app.appDir, 'src/app');
  assert.ok(nodeById(example, '/[lang]/tasks'), 'the scan holds the example frontend routes');
});
