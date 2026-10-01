import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import {
  addCapture, addPlanned, captureFileOf, chainOf, layoutChainOf, layoutTreeMain, mergeScan, nodeById, resolveNavRoute,
  scanAppDir, segmentKindOf, treeOf,
} from '../scripts/work/layout-tree.mjs';
import { blankImage, decodePng, drawOver, encodePng, keyRect } from '../scripts/work/png.mjs';
import { buildProduct, layoutCapture } from './fixtures/layout-tree.mjs';

// The layout tree is scanned out of the frontend's Next.js app/ directory - never hand-listed - so the
// layouts a drawing is composited into and the routes a build lands at are the ones the product has.
const ROOT = path.resolve(import.meta.dirname, '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateTree = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-layout-tree.schema.yaml'), 'utf8')));
const scanOf = (p) => scanAppDir(p.appDir, { repoRoot: p.app });

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
  assert.deepEqual(scan.productLocale, { default: 'vi', fallback: 'vi', locales: ['vi', 'en'], source: 'fe/apps/app/src/i18n/config.ts (defaultLocale / locales)' });
  assert.deepEqual(scan.i18n.catalogs.map((c) => [c.locale, c.path]), [['en', 'fe/apps/app/src/messages/en.json'], ['vi', 'fe/apps/app/src/messages/vi.json']]);
  assert.match(scan.source.digest, /^[a-f0-9]{64}$/);
});

test('navigation labels come from the route tree plus the catalogs, and every mismatch is reported', (t) => {
  const p = buildProduct(t);
  const scan = scanOf(p);
  const nav = scan.nodes.find((n) => n.id === '/[locale]/(console)').layout.nav;
  assert.equal(nav.source, 'fe/apps/app/src/shell/Sidebar.tsx');
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
  const first = mergeScan(null, [scanOf(p)], { at: '2026-09-24T00:00:00Z' }).record;
  assert.equal(validateTree(first), true, JSON.stringify(validateTree.errors));
  const consoleNode = nodeById(treeOf(first, 'app'), '/[locale]/(console)');
  consoleNode.layout.chrome = 'visible';
  consoleNode.layout.state = 'done';
  // A recorded capture is a blob citation: the schema field is `name` (assets/layouts/...png), never `path`.
  consoleNode.layout.captures = [{ breakpoint: 'desktop', theme: 'light', name: 'assets/layouts/x.png', sha256: 'a'.repeat(64), width: 40, height: 30, slot: { x: 1, y: 1, width: 5, height: 5 }, kind: 'render' }];
  addPlanned(treeOf(first, 'app'), { node: '/[locale]/(console)/settings', files: ['page'] });
  const again = mergeScan(first, [scanOf(p)], { at: '2026-09-24T00:00:01Z' });
  assert.equal(again.changed, false, 'nothing moved under app/');
  assert.equal(nodeById(treeOf(again.record, 'app'), '/[locale]/(console)').layout.chrome, 'visible');
  assert.equal(nodeById(treeOf(again.record, 'app'), '/[locale]/(console)/settings').origin, 'planned', 'a planned node survives a re-scan');
  fs.appendFileSync(path.join(p.appDir, '[locale]', '(console)', 'layout.tsx'), '// edited\n');
  const moved = mergeScan(again.record, [scanOf(p)], { at: '2026-09-24T00:00:02Z' });
  assert.equal(moved.changed, true);
  const layout = nodeById(treeOf(moved.record, 'app'), '/[locale]/(console)').layout;
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
  const record = mergeScan(null, [scan], { at: '2026-09-24T00:00:00Z' }).record;
  assert.equal(record.origin, 'repository');
  assert.equal('i18n' in record.apps[0], false);
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));
  assert.equal(validateTree({ ...record, apps: [{ ...record.apps[0], i18n: { catalogs: [] } }] }), false, 'an i18n block, when present, still names at least one real catalog');
  assert.equal(validateTree({ ...record, apps: [{ ...record.apps[0], source: undefined }] }), false, 'a scanned tree still names what each app scanned');
});

test('capture measures the #FF00FF slot, stores the bytes and bumps the layout rev on a changed capture', (t) => {
  const p = buildProduct(t);
  const tree = mergeScan(null, [scanOf(p)]).record;
  const record = treeOf(tree, 'app');
  record.breakpoints = [{ name: 'desktop', width: 40, height: 30 }];
  record.themes = ['light'];
  const shellDir = path.join(p.work, 'shell');
  const file = p.put('shot.png', encodePng(layoutCapture(40, 30, { x: 10, y: 5, width: 28, height: 22 })));
  const capture = addCapture(record, shellDir, { node: '/[locale]/(console)', breakpoint: 'desktop', theme: 'light', file, url: '/vi/reports' });
  assert.deepEqual(capture.slot, { x: 10, y: 5, width: 28, height: 22 });
  // The capture names the bytes by their blob-store name; the PNG itself is a blob the sha256 cites,
  // not a file under shell/assets (captureFileOf resolves the citation).
  assert.equal(capture.name, 'assets/layouts/app--locale-console--desktop--light.png');
  const stored = captureFileOf(shellDir, capture);
  assert.ok(stored && fs.existsSync(stored), 'the capture bytes are readable out of the blob store');
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
  const record = treeOf({ schema: 'work/layout-tree@1', apps: [{ name: 'app', root: '.', appDir: 'src/app', framework: 'next-app-router', nodes: [] }] }, 'app');
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
  assert.equal('repository' in written.apps[0], false, 'an app is the one repository: no fe repository is recorded');
  assert.equal(layoutTreeMain(['slot', p.put('s.png', encodePng(layoutCapture(20, 20, { x: 2, y: 3, width: 4, height: 5 })))]).text.trim(), JSON.stringify({ ok: true, slot: { x: 2, y: 3, width: 4, height: 5 }, fill: 1 }));
  fs.writeFileSync(path.join(p.work, 'shell', 'index.yaml'), stringifyYaml({ schema: 'work/other-shell@1', id: 'shell', productLocale: { default: 'vi', fallback: 'vi', locales: ['vi'] } }));
  const refused = layoutTreeMain(['scan', '--work', p.work, '--write']);
  assert.equal(refused.exitCode, 1, 'a shell record that is not a layout tree is refused');
  assert.match(refused.text, /SHELL_RECORD_NOT_TREE/);
  assert.equal(layoutTreeMain(['convert', '--work', p.work, '--write']).exitCode, 2, 'convert is gone');
  assert.equal(layoutTreeMain(['bogus']).exitCode, 2);
});

test('the todo example carries an honestly unsettled layout tree', () => {
  const example = parseYaml(fs.readFileSync(path.join(ROOT, 'examples/todo-app/.starciwork/shell/index.yaml'), 'utf8'));
  assert.equal(validateTree(example), true, JSON.stringify(validateTree.errors));
  assert.equal(example.state, 'todo');
  // appDir names the App Router directory relative to the app root: the example's fe app web lives in fe/apps/web.
  assert.equal(example.apps[0].appDir, 'fe/apps/web/src/app');
  assert.ok(nodeById(treeOf(example, 'web'), '/[lang]/tasks'), 'the scan holds the example frontend routes');
});
