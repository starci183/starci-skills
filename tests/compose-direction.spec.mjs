import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { composeImages, fitInto, panelRect, pixelSha256, recompose } from '../scripts/work/compose-direction.mjs';
import { blankImage, decodePng, encodePng, resizeImage } from '../scripts/work/png.mjs';
import { drawUi, settledProduct, uiSkeleton } from './fixtures/layout-tree.mjs';

// ImageGen never redraws chrome: it draws only the slot content (or an overlay panel), and the compositor
// places it - deterministically - into the real layout capture, or over the dimmed host for an overlay.
const px = (image, x, y) => Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
const CHROME = [30, 60, 90, 255];

test('png round-trips and resampling is deterministic', () => {
  const image = blankImage(5, 3, [10, 20, 30, 255]);
  image.data.set([250, 1, 2, 128], 4);
  const back = decodePng(encodePng(image));
  assert.deepEqual(Array.from(back.data), Array.from(image.data));
  assert.equal(pixelSha256(resizeImage(image, 11, 7)), pixelSha256(resizeImage(image, 11, 7)));
  assert.deepEqual([fitInto(blankImage(10, 5, [1, 2, 3, 255]), 4, 4).width, fitInto(blankImage(10, 5, [1, 2, 3, 255]), 4, 4).height], [4, 4], 'cover crops to the slot');
});

test('panel placement: a modal is centred, a drawer is anchored to its direction edge', () => {
  const panel = blankImage(10, 20, [0, 0, 0, 255]);
  const modal = panelRect(100, 100, panel, 'modal', null);
  assert.deepEqual(modal, { x: 45, y: 40, width: 10, height: 20 });
  assert.deepEqual(panelRect(100, 60, panel, 'drawer', 'right'), { x: 70, y: 0, width: 30, height: 60 });
  assert.deepEqual(panelRect(100, 60, panel, 'drawer', 'left'), { x: 0, y: 0, width: 30, height: 60 });
  assert.deepEqual(panelRect(40, 100, blankImage(20, 10, [0, 0, 0, 255]), 'drawer', 'bottom'), { x: 0, y: 80, width: 40, height: 20 });
  assert.deepEqual(panelRect(40, 100, blankImage(20, 10, [0, 0, 0, 255]), 'drawer', 'top'), { x: 0, y: 0, width: 40, height: 20 });
});

test('a page is composited into the captured layout slot: chrome untouched, slot replaced', async (t) => {
  const p = await settledProduct(t);
  const record = uiSkeleton('ui.reports.board', { route: '/[locale]/(console)/reports', surface: 'page', shell: { ref: 'shell', rev: p.tree.rev, layouts: [{ node: '/[locale]/(console)', rev: 1 }] } });
  const { dir, record: drawn } = await drawUi(p, 'reports/ui/board', record, [{ breakpoint: 'desktop', theme: 'light' }, { breakpoint: 'mobile', theme: 'light' }]);
  const desktop = drawn.assets.find((a) => a.composite?.breakpoint === 'desktop');
  assert.equal(desktop.path, 'assets/directions/default--page--desktop--light.png', 'the filename convention');
  assert.equal(desktop.role, 'direction');
  assert.equal(desktop.generation.mode, 'composite');
  assert.deepEqual(desktop.composite.layout, { node: '/[locale]/(console)', capture: 'shell/assets/layouts/locale-console--desktop--light.png', sha256: p.tree.nodes.find((n) => n.id === '/[locale]/(console)').layout.captures.find((c) => c.breakpoint === 'desktop').sha256 });
  assert.deepEqual(desktop.composite.rect, { x: 10, y: 5, width: 28, height: 22 });
  const image = decodePng(fs.readFileSync(path.join(dir, desktop.path)));
  assert.deepEqual(px(image, 0, 0), CHROME, 'the real chrome stays exactly as captured');
  assert.deepEqual(px(image, 9, 10), CHROME);
  assert.deepEqual(px(image, 10, 5), [200, 120, 40, 255], 'the slot holds the generated content');
  assert.deepEqual(px(image, 37, 26), [200, 120, 40, 255]);
  const again = recompose(p.work, path.join(dir, 'index.yaml'), desktop.composite);
  assert.equal(again.pixelSha256, desktop.composite.pixelSha256, 'the composite re-derives from its recorded inputs');
  assert.equal(pixelSha256(image), desktop.composite.pixelSha256);
});

test('overlays sit over the dimmed host: a modal centred on desktop, a drawer from the bottom on mobile', async (t) => {
  const p = await settledProduct(t);
  const layouts = [{ node: '/[locale]/(console)', rev: 1 }];
  const host = await drawUi(p, 'photos/ui/list', uiSkeleton('ui.photos.list', { route: '/[locale]/(console)/photos', surface: 'page', shell: { ref: 'shell', rev: p.tree.rev, layouts } }),
    [{ breakpoint: 'desktop', theme: 'light', color: [250, 250, 250, 255] }, { breakpoint: 'mobile', theme: 'light', color: [250, 250, 250, 255] }]);
  const detail = uiSkeleton('ui.photos.detail', { route: '/[locale]/(console)/photos/[id]', surface: { desktop: 'modal', mobile: 'drawer' }, direction: { mobile: 'bottom' }, routed: true, host: 'ui.photos.list', shell: { ref: 'shell', rev: p.tree.rev, layouts } });
  const { dir, record } = await drawUi(p, 'photos/ui/detail', detail, [
    { breakpoint: 'desktop', theme: 'light', presentation: 'overlay', color: [0, 200, 0, 255], size: [10, 10] },
    { breakpoint: 'mobile', theme: 'light', presentation: 'overlay', color: [0, 200, 0, 255], size: [20, 10] },
    { breakpoint: 'desktop', theme: 'light', presentation: 'page', color: [0, 200, 0, 255] },
    { breakpoint: 'mobile', theme: 'light', presentation: 'page', color: [0, 200, 0, 255] },
  ]);
  const over = (bp) => record.assets.find((a) => a.composite?.presentation === 'overlay' && a.composite.breakpoint === bp);
  assert.equal(over('desktop').composite.surface, 'modal');
  assert.deepEqual(over('desktop').composite.rect, { x: 15, y: 10, width: 10, height: 10 }, 'the modal is centred');
  assert.equal(over('mobile').composite.surface, 'drawer');
  assert.equal(over('mobile').composite.direction, 'bottom');
  assert.deepEqual(over('mobile').composite.rect, { x: 0, y: 20, width: 20, height: 10 }, 'the mobile drawer is anchored to the bottom edge');
  assert.equal(over('desktop').composite.host.asset, `ui.photos.list:${host.record.assets.find((a) => a.composite?.breakpoint === 'desktop').path}`);
  const image = decodePng(fs.readFileSync(path.join(dir, over('desktop').path)));
  assert.deepEqual(px(image, 0, 0), [15, 30, 45, 255], 'the host chrome is dimmed by the scrim');
  assert.deepEqual(px(image, 20, 15), [0, 200, 0, 255], 'the panel is not dimmed');
  const mobile = decodePng(fs.readFileSync(path.join(dir, over('mobile').path)));
  assert.deepEqual(px(mobile, 10, 25), [0, 200, 0, 255]);
  assert.deepEqual(px(mobile, 10, 2), [15, 30, 45, 255]);
});

test('a layout drawing leaves its own slot keyed, and the compositor measures the child slot', async (t) => {
  const p = await settledProduct(t);
  const tabs = blankImage(28, 22, [90, 90, 90, 255]);
  const { drawOver } = await import('../scripts/work/png.mjs');
  drawOver(tabs, blankImage(28, 16, [255, 0, 255, 255]), 0, 6);
  const record = uiSkeleton('ui.photos.frame', { route: '/[locale]/(console)/photos', surface: 'layout', shell: { ref: 'shell', rev: p.tree.rev, layouts: [{ node: '/[locale]/(console)', rev: 1 }] } });
  const dir = path.join(p.work, 'features', 'photos', 'ui', 'frame');
  fs.mkdirSync(path.join(dir, 'assets', 'directions'), { recursive: true });
  const { stringifyYaml } = await import('../engine/yaml.mjs');
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml(record));
  const content = path.join(dir, 'assets', 'directions', 'tabs.content.png');
  fs.writeFileSync(content, encodePng(tabs));
  const { composeDirection } = await import('../scripts/work/compose-direction.mjs');
  const result = composeDirection({ uiDir: dir, content, breakpoint: 'desktop', theme: 'light' });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.asset.composite.childSlot, { x: 10, y: 11, width: 28, height: 16 });
  fs.writeFileSync(content, encodePng(blankImage(28, 22, [90, 90, 90, 255])));
  assert.match(composeDirection({ uiDir: dir, content, breakpoint: 'desktop', theme: 'light' }).error, /solid #FF00FF/);
});

test('refusals: an unknown breakpoint, a non-routed overlay page, a host without a composite', async (t) => {
  const p = await settledProduct(t);
  const { composeDirection } = await import('../scripts/work/compose-direction.mjs');
  const { stringifyYaml } = await import('../engine/yaml.mjs');
  const dir = path.join(p.work, 'features', 'reports', 'ui', 'filters');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml(uiSkeleton('ui.reports.filters', { route: '/[locale]/(console)/reports', surface: 'drawer', direction: 'right', routed: false, host: '/[locale]/(console)/reports' })));
  const content = path.join(dir, 'c.png');
  fs.writeFileSync(content, encodePng(blankImage(4, 4, [1, 1, 1, 255])));
  assert.match(composeDirection({ uiDir: dir, content, breakpoint: 'tablet', theme: 'light' }).error, /not a breakpoint/);
  assert.match(composeDirection({ uiDir: dir, content, breakpoint: 'desktop', theme: 'light', presentation: 'page' }).error, /non-routed drawer/);
  assert.match(composeDirection({ uiDir: dir, content, breakpoint: 'desktop', theme: 'light' }).error, /resolves to no ui record|no page composite/);
  const base = blankImage(4, 4, [9, 9, 9, 255]);
  const out = composeImages({ base, content: blankImage(2, 2, [0, 0, 0, 0]), rect: { x: 1, y: 1, width: 2, height: 2 }, clear: [255, 255, 255, 255] });
  assert.deepEqual(px(out, 1, 1), [255, 255, 255, 255], 'a transparent content pixel shows the page canvas, never the key colour');
});

// Redundancy audit workui f16/f17: every compose failure is the {ok:false, error} contract (never an uncaught throw),
// and the render anchor is the one shell-conformance checks - the route's node, else its declared routeParent.
test('refusals: an undecodable content or host PNG, a deleted host composite, a route with no node and no routeParent', async (t) => {
  const p = await settledProduct(t);
  const { composeDirection, composeDirectionMain } = await import('../scripts/work/compose-direction.mjs');
  const { stringifyYaml } = await import('../engine/yaml.mjs');
  const layouts = [{ node: '/[locale]/(console)', rev: 1 }];
  const host = await drawUi(p, 'photos/ui/list', uiSkeleton('ui.photos.list', { route: '/[locale]/(console)/photos', surface: 'page', shell: { ref: 'shell', rev: p.tree.rev, layouts } }),
    [{ breakpoint: 'desktop', theme: 'light' }, { breakpoint: 'mobile', theme: 'light' }]);
  const dir = path.join(p.work, 'features', 'photos', 'ui', 'detail');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml(uiSkeleton('ui.photos.detail', { route: '/[locale]/(console)/photos/[id]', surface: 'modal', routed: false, host: 'ui.photos.list', shell: { ref: 'shell', rev: p.tree.rev, layouts } })));
  const content = path.join(dir, 'c.png');
  fs.writeFileSync(content, Buffer.from('not a png'));
  const bad = composeDirection({ uiDir: dir, content, breakpoint: 'desktop', theme: 'light', write: false });
  assert.deepEqual([bad.ok, /unsupported png/.test(bad.error)], [false, true]);
  const cli = composeDirectionMain(['--ui', dir, '--content', content, '--breakpoint', 'desktop', '--theme', 'light']);
  assert.equal(cli.exitCode, 1);
  assert.match(cli.text, /^compose-direction: unsupported png/);
  fs.writeFileSync(content, encodePng(blankImage(4, 4, [1, 1, 1, 255])));
  const hostComposite = host.record.assets.find((a) => a.composite?.breakpoint === 'desktop' && a.role === 'direction');
  fs.rmSync(path.join(host.dir, hostComposite.path));
  assert.match(composeDirection({ uiDir: dir, content, breakpoint: 'desktop', theme: 'light', write: false }).error, /host composite ui\.photos\.list:.* is not on disk - compose the host first/);
  // A page whose route is not a node and which declares no routeParent: refused here, as shell-conformance refuses it.
  const lost = path.join(p.work, 'features', 'photos', 'ui', 'lost');
  fs.mkdirSync(lost, { recursive: true });
  fs.writeFileSync(path.join(lost, 'index.yaml'), stringifyYaml(uiSkeleton('ui.photos.lost', { route: '/[locale]/(console)/photos/archive', surface: 'page', shell: { ref: 'shell', rev: p.tree.rev, layouts } })));
  assert.match(composeDirection({ uiDir: lost, content, breakpoint: 'desktop', theme: 'light', write: false }).error, /is not a node of the layout tree and routeParent \(none\) names no existing ancestor of it .*UI_ROUTE_UNKNOWN/);
  const declared = uiSkeleton('ui.photos.lost', { route: '/[locale]/(console)/photos/archive', routeParent: '/[locale]/(console)/photos', surface: 'page', shell: { ref: 'shell', rev: p.tree.rev, layouts } });
  fs.writeFileSync(path.join(lost, 'index.yaml'), stringifyYaml(declared));
  assert.equal(composeDirection({ uiDir: lost, content, breakpoint: 'desktop', theme: 'light', write: false }).ok, true, 'a declared routeParent anchors the render');
});
