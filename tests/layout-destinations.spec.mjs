import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { checkShellConformance } from '../scripts/checks/shell-conformance.mjs';
import {
  addCapture, baseLayoutFor, destinationFor, destinationsOf, layoutTreeMain, mergeScan, nodeById, promoteDestinations, scanAppDir,
} from '../scripts/work/layout-tree.mjs';
import { decodePng, encodePng } from '../scripts/work/png.mjs';
import { drawUi, layoutCapture, settledProduct, uiSkeleton } from './fixtures/layout-tree.mjs';

// A layout that marks where the user is renders differently under each destination (nivo inc-8b2e1cb6fbbf:
// the chat page drawn into a capture with AgentOS active; inc-41db3976f275: the Module tab drawn into the
// Overview tab). layout.destinations records one render per active state, the compositor takes the one the ui
// record's route (or bound destination, or activeNav) makes active, and shell-conformance expects exactly it.
const ROOT = path.resolve(import.meta.dirname, '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateTree = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-layout-tree.schema.yaml'), 'utf8')));
const validateUi = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-ui-screen.schema.yaml'), 'utf8')));
const CONSOLE = '/[locale]/(console)';
const REPORTS = `${CONSOLE}/reports`;
const PHOTOS = `${CONSOLE}/photos`;
const both = [{ breakpoint: 'desktop', theme: 'light' }, { breakpoint: 'mobile', theme: 'light' }];
const px = (image, x, y) => Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
const refused = (result) => [...new Set(result.findings.filter((f) => f.level === 'refuse').map((f) => f.code))].sort();
const suspects = (result) => [...new Set(result.findings.filter((f) => f.level === 'suspect').map((f) => f.code))].sort();
const bound = (p, extra = {}) => ({ ref: 'shell', rev: p.tree.rev, layouts: [{ node: CONSOLE, rev: nodeById(p.tree, CONSOLE).layout.rev, ...extra }] });

// Each destination's render is the console chrome in its own colour, slot at the same place as the default.
const PHOTOS_CHROME = [10, 150, 10, 255];
const REPORTS_CHROME = [150, 10, 10, 255];
const DESKTOP_SLOT = { x: 10, y: 5, width: 28, height: 22 };
const MOBILE_SLOT = { x: 0, y: 6, width: 20, height: 24 };
const capturePng = (p, name, bp, chrome) => p.put(`caps/${name}-${bp}.png`, encodePng(bp === 'desktop' ? layoutCapture(40, 30, DESKTOP_SLOT, chrome) : layoutCapture(20, 30, MOBILE_SLOT, chrome)));

/** The settled product with destinations on the console layout: photos (a nav key) and reports (a tab-like key). */
async function withDestinations(t, { cells = ['desktop', 'mobile'] } = {}) {
  const p = await settledProduct(t);
  for (const bp of cells) {
    addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'photos', breakpoint: bp, theme: 'light', file: capturePng(p, 'photos', bp, PHOTOS_CHROME) });
    addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'reports', routes: [REPORTS], breakpoint: bp, theme: 'light', file: capturePng(p, 'reports', bp, REPORTS_CHROME) });
  }
  p.save(p.tree);
  return p;
}

test('destination captures are recorded per key, with the nav target as the default route and a schema-valid tree', async (t) => {
  const p = await withDestinations(t);
  const node = nodeById(p.tree, CONSOLE);
  assert.deepEqual(node.layout.destinations.map((d) => [d.key, d.routes]), [['photos', [PHOTOS]], ['reports', [REPORTS]]]);
  const photosDesktop = node.layout.destinations[0].captures.find((c) => c.breakpoint === 'desktop');
  assert.equal(photosDesktop.path, 'assets/layouts/locale-console--photos--desktop--light.png');
  assert.deepEqual(photosDesktop.slot, DESKTOP_SLOT, 'the slot is measured from the key colour');
  assert.ok(fs.existsSync(path.join(p.shellDir, photosDesktop.path)));
  assert.equal(node.layout.rev, 1, 'a first destination capture does not move the layout rev');
  assert.equal(validateTree(p.tree), true, JSON.stringify(validateTree.errors));
  addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'photos', breakpoint: 'desktop', theme: 'light', file: capturePng(p, 'photos2', 'desktop', [11, 151, 11, 255]) });
  assert.equal(node.layout.rev, 2, 'a changed destination render re-opens what was drawn under the layout');
  assert.throws(() => addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'settings', breakpoint: 'desktop', theme: 'light', file: capturePng(p, 's', 'desktop', PHOTOS_CHROME) }), /name the node ids it is active for/);
  assert.throws(() => addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'settings', routes: ['/[locale]/(auth)/sign-in'], breakpoint: 'desktop', theme: 'light', file: capturePng(p, 's', 'desktop', PHOTOS_CHROME) }), /not a node at or below/);
  // A re-scan keeps the destinations the owner captured.
  const rescanned = mergeScan(p.tree, scanAppDir(p.appDir, { repoRoot: p.web, repository: 'web' }), { at: '2026-09-24T01:00:00Z' }).record;
  assert.deepEqual(nodeById(rescanned, CONSOLE).layout.destinations, node.layout.destinations);
});

test('the active destination: a bound key, else the longest route at or above the page, else activeNav, else the default', async (t) => {
  const p = await withDestinations(t);
  const node = nodeById(p.tree, CONSOLE);
  assert.equal(destinationFor(p.tree, node, { route: PHOTOS }).destination.key, 'photos');
  assert.equal(destinationFor(p.tree, node, { route: `${PHOTOS}/[id]` }).destination.key, 'photos', 'a page below a destination route');
  assert.equal(destinationFor(p.tree, node, { route: `${CONSOLE}/photos-archive` }), null, 'a sibling that only shares a prefix is not below it');
  assert.deepEqual(destinationFor(p.tree, node, { route: CONSOLE, activeNav: 'reports' }).by, 'activeNav');
  assert.equal(destinationFor(p.tree, node, { route: PHOTOS, key: 'reports' }).destination.key, 'reports', 'an explicit binding wins');
  assert.deepEqual(destinationFor(p.tree, node, { route: PHOTOS, key: 'nope' }), { unknown: 'nope' });
  const base = baseLayoutFor(p.tree, REPORTS, 'desktop', 'light', { shellDir: p.shellDir, ui: { route: REPORTS } });
  assert.equal(base.rel, 'shell/assets/layouts/locale-console--reports--desktop--light.png');
  assert.equal(base.destination, 'reports');
  assert.equal(baseLayoutFor(p.tree, CONSOLE, 'desktop', 'light', { shellDir: p.shellDir, ui: { route: CONSOLE } }).rel, 'shell/assets/layouts/locale-console--desktop--light.png', 'no destination active: the default render');
  const cli = layoutTreeMain(['destinations', '--work', p.work, '--route', REPORTS]);
  assert.equal(cli.exitCode, 0);
  assert.match(cli.text, /desktop\/light: shell\/assets\/layouts\/locale-console--reports--desktop--light\.png \(\/\[locale\]\/\(console\) destination reports by route\)/);
});

test('compose-direction places a page into its destination render, and records which one', async (t) => {
  const p = await withDestinations(t);
  const { dir, record } = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: REPORTS, surface: 'page', shell: bound(p) }), both);
  const desktop = record.assets.find((a) => a.composite?.breakpoint === 'desktop');
  assert.equal(desktop.composite.layout.capture, 'shell/assets/layouts/locale-console--reports--desktop--light.png');
  assert.equal(desktop.composite.layout.destination, 'reports');
  validateUi(record);
  assert.deepEqual((validateUi.errors ?? []).filter((e) => e.instancePath.includes('/composite/')), [], 'composite.layout.destination is a schema field, so a composed record passes --strict');
  const image = decodePng(fs.readFileSync(path.join(dir, desktop.path)));
  assert.deepEqual(px(image, 0, 0), REPORTS_CHROME, 'the chrome is the reports render, not the default');
  assert.deepEqual(px(image, 10, 5), [200, 120, 40, 255]);
  assert.deepEqual(checkShellConformance(dir).refused, [], 'the composite is exactly the expected destination render');
  // shell.activeNav picks the render for a page no destination route covers.
  const host = await drawUi(p, 'console/ui/home', uiSkeleton('ui.console.home', { route: CONSOLE, surface: 'page', shell: { ...bound(p), activeNav: 'photos' } }), both);
  assert.equal(host.record.assets.find((a) => a.composite?.breakpoint === 'mobile').composite.layout.destination, 'photos');
});

test('a destination missing a required cell refuses to compose rather than falling back to another tab', async (t) => {
  const p = await withDestinations(t, { cells: ['desktop'] });
  const record = uiSkeleton('ui.reports.board', { route: REPORTS, surface: 'page', shell: bound(p) });
  await assert.rejects(drawUi(p, 'reports/ui/board', record, both), /destination reports \(active for \/\[locale\]\/\(console\)\/reports\) has no capture at mobile\/light/);
  const dir = path.join(p.work, 'features', 'reports', 'ui', 'board');
  assert.ok(refused(checkShellConformance(dir)).includes('LAYOUT_ANCESTOR_UNSETTLED'), 'the layout is not settled until every destination has the required matrix');
});

test('shell-conformance: a page drawn into another render of the layout is a destination mismatch until recomposed', async (t) => {
  const p = await settledProduct(t);
  const board = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: REPORTS, surface: 'page', shell: bound(p) }), both);
  assert.deepEqual(checkShellConformance(board.dir).refused, [], 'drawn into the default render before destinations existed');
  for (const bp of ['desktop', 'mobile']) addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'reports', routes: [REPORTS], breakpoint: bp, theme: 'light', file: capturePng(p, 'reports', bp, REPORTS_CHROME) });
  p.save(p.tree);
  const stale = checkShellConformance(board.dir);
  assert.deepEqual(refused(stale), ['COMPOSITE_DESTINATION_MISMATCH']);
  assert.match(stale.refused[0], /shows destination reports active \(by route\) - recompose into shell\/assets\/layouts\/locale-console--reports--desktop--light\.png/);
  const advisory = checkShellConformance(board.dir, { advisoryCodes: ['COMPOSITE_DESTINATION_MISMATCH'] });
  assert.equal(advisory.ok, true, 'a leg admitted before the change sees it as an advisory suspect');
  const again = await drawUi(p, 'reports/ui/board', { ...board.record, assets: [] }, both);
  assert.deepEqual(checkShellConformance(again.dir).refused, [], 'recomposed into the destination render');
});

test('the same bytes under the default and a destination path are one base; activeNav and bindings are held to the route', async (t) => {
  const p = await settledProduct(t);
  const list = await drawUi(p, 'photos/ui/list', uiSkeleton('ui.photos.list', { route: PHOTOS, surface: 'page', shell: bound(p) }), both);
  // The photos render is the default render (the capture was taken at /photos): identical bytes.
  for (const [bp, file] of [['desktop', 'cap-d.png'], ['mobile', 'cap-m.png']]) addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'photos', breakpoint: bp, theme: 'light', file: path.join(p.base, file) });
  addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'reports', routes: [REPORTS], breakpoint: 'desktop', theme: 'light', file: capturePng(p, 'reports', 'desktop', REPORTS_CHROME) });
  addCapture(p.tree, p.shellDir, { node: CONSOLE, destination: 'reports', breakpoint: 'mobile', theme: 'light', file: capturePng(p, 'reports', 'mobile', REPORTS_CHROME) });
  p.save(p.tree);
  assert.deepEqual(checkShellConformance(list.dir).refused, [], 'a composite in the default path with the destination bytes needs no recompose');
  const conflict = structuredClone(list.record);
  conflict.shell.activeNav = 'reports';
  fs.writeFileSync(list.file, stringifyYaml(conflict));
  assert.deepEqual(refused(checkShellConformance(list.dir)), ['ACTIVE_NAV_CONFLICT', 'SHELL_BINDING_INVALID'], 'activeNav reports is no nav key and contradicts the photos route');
  const badBinding = structuredClone(list.record);
  badBinding.shell.layouts[0].destination = 'wallet';
  fs.writeFileSync(list.file, stringifyYaml(badBinding));
  assert.ok(checkShellConformance(list.dir).refused.some((l) => /binds \/\[locale\]\/\(console\) destination wallet, which is not a destination/.test(l)));
  validateUi(badBinding);
  assert.deepEqual((validateUi.errors ?? []).filter((e) => e.instancePath.startsWith('/shell')), [], 'shell.layouts[].destination is a schema field');
  // A bound destination overrides the route - and the photos-route composite is then the wrong render.
  const boundReports = structuredClone(list.record);
  boundReports.shell.layouts[0].destination = 'reports';
  fs.writeFileSync(list.file, stringifyYaml(boundReports));
  assert.deepEqual(refused(checkShellConformance(list.dir)), ['COMPOSITE_DESTINATION_MISMATCH']);
});

test('shell-conformance holds destinations to the layout: known nodes below it, one entry per key', async (t) => {
  const p = await withDestinations(t);
  const node = nodeById(p.tree, CONSOLE);
  node.layout.destinations.push({ ...structuredClone(node.layout.destinations[0]) });
  node.layout.destinations[1].routes = ['/[locale]/(auth)/sign-in'];
  p.save(p.tree);
  const result = checkShellConformance(path.join(p.work, 'shell'));
  assert.ok(result.refused.some((l) => /records destination photos twice \[LAYOUT_DESTINATION_INVALID\]/.test(l)));
  assert.ok(result.refused.some((l) => /is active for \/\[locale\]\/\(auth\)\/sign-in, which is not a node at or below the layout/.test(l)));
});

test('a legacy extensions.destinationCaptures block is read (nav keys and targetLayouts tabRoutes), then promoted', async (t) => {
  const p = await settledProduct(t);
  const items = [];
  for (const bp of ['desktop', 'mobile']) {
    for (const [key, chrome] of [['photos', PHOTOS_CHROME], ['console-reports', REPORTS_CHROME]]) {
      const rel = `assets/layouts/${key}--${bp}--light.png`;
      const bytes = fs.readFileSync(capturePng(p, key, bp, chrome));
      fs.writeFileSync(path.join(p.shellDir, rel), bytes);
      const { createHash } = await import('node:crypto');
      items.push({ key, breakpoint: bp, path: rel, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  items.push({ key: 'unclaimed', breakpoint: 'desktop', path: 'assets/layouts/photos--desktop--light.png', sha256: items[0].sha256 });
  p.tree.extensions = {
    targetLayouts: { console: { node: CONSOLE, tabRoutes: ['/[locale]/reports'] } },
    destinationCaptures: { note: 'one capture per destination, light theme', items },
  };
  p.save(p.tree);
  assert.equal(validateTree(p.tree), true, JSON.stringify(validateTree.errors));
  assert.deepEqual(destinationsOf(p.tree, nodeById(p.tree, CONSOLE)).map((d) => [d.key, d.routes, d.legacy]), [['photos', [PHOTOS], true], ['console-reports', [REPORTS], true]]);
  const board = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: REPORTS, surface: 'page', shell: bound(p) }), both);
  const desktop = board.record.assets.find((a) => a.composite?.breakpoint === 'desktop');
  assert.equal(desktop.composite.layout.capture, 'shell/assets/layouts/console-reports--desktop--light.png');
  assert.deepEqual(desktop.composite.rect, DESKTOP_SLOT, 'the legacy capture slot is measured from its PNG');
  const legacy = checkShellConformance(board.dir);
  assert.deepEqual(legacy.refused, []);
  assert.ok(suspects(legacy).includes('LAYOUT_DESTINATIONS_LEGACY'), 'read, and reported as still to promote');
  // Promote: dry run first, then written; the composite stays valid (same paths, same bytes).
  const dry = layoutTreeMain(['destinations', '--work', p.work, '--promote']);
  assert.match(dry.text, /promoted \/\[locale\]\/\(console\): console-reports, photos[\s\S]*UNMAPPED unclaimed desktop[\s\S]*dry run/);
  assert.ok(parseYaml(fs.readFileSync(path.join(p.shellDir, 'index.yaml'), 'utf8')).extensions.destinationCaptures.items.length === 5, 'a dry run writes nothing');
  const wet = layoutTreeMain(['destinations', '--work', p.work, '--promote', '--write']);
  assert.equal(wet.exitCode, 0, wet.text);
  const promoted = parseYaml(fs.readFileSync(path.join(p.shellDir, 'index.yaml'), 'utf8'));
  assert.equal(validateTree(promoted), true, JSON.stringify(validateTree.errors));
  assert.equal(promoted.rev, p.tree.rev + 1);
  assert.deepEqual(promoted.extensions.destinationCaptures.items.map((i) => i.key), ['unclaimed'], 'what no layout claims stays where it was');
  assert.deepEqual(promoted.extensions.targetLayouts, p.tree.extensions.targetLayouts);
  const dests = nodeById(promoted, CONSOLE).layout.destinations;
  assert.deepEqual(dests.map((d) => d.key), ['console-reports', 'photos']);
  assert.deepEqual(dests[0].captures.find((c) => c.breakpoint === 'desktop').slot, DESKTOP_SLOT);
  const after = checkShellConformance(board.dir);
  assert.deepEqual(after.refused, []);
  assert.equal(suspects(after).includes('LAYOUT_DESTINATIONS_LEGACY'), false, 'promoted: no legacy suspect');
  assert.equal(promoteDestinations(promoted, p.shellDir).promoted.length, 0, 'promotion is idempotent');
});
