import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { checkShellConformance, isPlannedLayoutDrawing } from '../scripts/checks/shell-conformance.mjs';
import { composeDirection } from '../scripts/work/compose-direction.mjs';
import { layoutTreeMain, lockupSourceOf } from '../scripts/work/layout-tree.mjs';
import { blankImage, cropImage, decodePng, drawOver, encodePng } from '../scripts/work/png.mjs';
import { buildProduct, layoutCapture, settledProduct, uiSkeleton } from './fixtures/layout-tree.mjs';

// mia inc-1649b9490cb5: on a greenfield product nothing renders a brand lockup, yet interface.draw refused to
// draw while the tree had none and brand.decide could only crop one from a real render - a deadlock. The
// planned layout's own drawing is exempt, and brand.decide crops the lockup from its accepted composite.
const ROOT = path.resolve(import.meta.dirname, '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateTree = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-layout-tree.schema.yaml'), 'utf8')));
const APP = '/(app)';
const DESIGN = 'ui.home.app-layout';
const CHROME = [20, 40, 160, 255];
const MARK = [250, 200, 0, 255];
const codes = (result, level) => [...new Set(result.findings.filter((f) => f.level === level).map((f) => f.code))].sort();
const readTree = (p) => parseYaml(fs.readFileSync(path.join(p.work, 'shell', 'index.yaml'), 'utf8'));
const writeTree = (p, tree) => fs.writeFileSync(path.join(p.work, 'shell', 'index.yaml'), stringifyYaml(tree));

/** A greenfield product: no frontend, a planned tree whose visible layout /(app) is drawn by DESIGN. */
function greenfield(t) {
  const p = buildProduct(t, { files: {} });
  const planned = layoutTreeMain(['plan', '--work', p.work, '--node', APP, '--files', 'layout,page', '--design', DESIGN, '--write']);
  assert.equal(planned.exitCode, 0, planned.text);
  const tree = readTree(p);
  tree.breakpoints = [{ name: 'desktop', width: 40, height: 30 }, { name: 'mobile', width: 20, height: 30 }];
  tree.personas = [{ role: 'owner', default: true, workspace: 'Mia', user: 'An Nguyen', currency: 'VND', dateFormat: 'dd/MM/yyyy' }];
  writeTree(p, tree);
  return p;
}

/** Draw the planned layout (chrome with a mark top-left and its slot keyed) at desktop and mobile light. */
function drawLayout(p, { id = DESIGN, state = 'todo', mark = MARK } = {}) {
  const dir = path.join(p.work, 'features', 'home', 'ui', 'app-layout');
  fs.mkdirSync(path.join(dir, 'assets', 'directions'), { recursive: true });
  const record = uiSkeleton(id, { state, route: APP, surface: 'layout', shell: { ref: 'shell', rev: readTree(p).rev, layouts: [] } });
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml(record));
  const assets = [];
  for (const [bp, w, h, slot] of [['desktop', 40, 30, { x: 10, y: 6, width: 30, height: 24 }], ['mobile', 20, 30, { x: 0, y: 6, width: 20, height: 24 }]]) {
    const drawing = layoutCapture(w, h, slot, CHROME);
    drawOver(drawing, blankImage(6, 4, mark), 1, 1);
    const content = path.join(dir, 'assets', 'directions', `default--page--${bp}--light.content.png`);
    fs.writeFileSync(content, encodePng(drawing));
    fs.writeFileSync(content.replace(/\.png$/, '.prompt.txt'), 'App layout chrome. Product locale: en.');
    const result = composeDirection({ uiDir: dir, content, breakpoint: bp, theme: 'light' });
    assert.equal(result.ok, true, result.error);
    assets.push(result.contentAsset, { ...result.asset, selected: true });
  }
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ ...record, assets }));
  return { dir, composite: assets[1].path };
}

test('the planned layout drawing is exempt from the lockup; nothing else is', (t) => {
  const p = greenfield(t);
  const { dir } = drawLayout(p);
  const tree = readTree(p);
  assert.equal(tree.brand, undefined, 'a greenfield tree has no lockup');
  assert.equal(isPlannedLayoutDrawing(tree, parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8'))), true);
  const drawing = checkShellConformance(dir);
  assert.equal(codes(drawing, 'refuse').includes('SHELL_LOCKUP_MISSING'), false, drawing.refused.join('\n'));
  assert.ok(codes(drawing, 'info').includes('SHELL_LOCKUP_DEFERRED'));
  assert.deepEqual(drawing.refused, [], 'the planned layout draw passes on a tree with no lockup');
  // Another record at the same place is not the design the layout names: no exemption.
  const other = drawLayout(p, { id: 'ui.home.other-layout' });
  assert.ok(codes(checkShellConformance(other.dir), 'refuse').includes('SHELL_LOCKUP_MISSING'));
  // A page under the planned layout still needs the lockup (and the layout settled) before it is drawn.
  const pageDir = path.join(p.work, 'features', 'home', 'ui', 'dashboard');
  fs.mkdirSync(pageDir, { recursive: true });
  fs.writeFileSync(path.join(pageDir, 'index.yaml'), stringifyYaml(uiSkeleton('ui.home.dashboard', { route: `${APP}/dashboard`, routeParent: APP, surface: 'page', shell: { ref: 'shell', rev: readTree(p).rev, layouts: [{ node: APP, rev: 1 }] } })));
  assert.ok(codes(checkShellConformance(pageDir), 'refuse').includes('SHELL_LOCKUP_MISSING'));
});

test('brand.decide crops the lockup from the accepted layout composite, recording its source', (t) => {
  const p = greenfield(t);
  const { dir, composite } = drawLayout(p);
  const from = `${DESIGN}:${composite}`;
  const early = layoutTreeMain(['lockup', '--work', p.work, '--from', from, '--rect', '1,1,6,4', '--write']);
  assert.equal(early.exitCode, 1);
  assert.match(early.text, /is todo, not done - the layout drawing is accepted before its lockup is taken/);
  const record = parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ ...record, state: 'done' }));
  const before = readTree(p).rev;
  const dry = layoutTreeMain(['lockup', '--work', p.work, '--from', from, '--rect', '1,1,6,4']);
  assert.match(dry.text, /would crop 1,1,6,4 of ui\.home\.app-layout:assets\/directions\/default--page--desktop--light\.png \(layout-drawing\)/);
  assert.equal(readTree(p).brand, undefined, 'a dry run writes nothing');
  const wet = layoutTreeMain(['lockup', '--work', p.work, '--from', from, '--rect', '1,1,6,4', '--write']);
  assert.equal(wet.exitCode, 0, wet.text);
  const tree = readTree(p);
  assert.equal(tree.rev, before + 1);
  const [lockup] = tree.brand.lockups;
  assert.equal(lockup.path, 'assets/lockups/lockup--light.png');
  assert.deepEqual(lockup.source, { ref: from, kind: 'layout-drawing', sha256: lockup.source.sha256, rect: { x: 1, y: 1, width: 6, height: 4 } });
  const cropped = decodePng(fs.readFileSync(path.join(p.work, 'shell', lockup.path)));
  const expected = cropImage(decodePng(fs.readFileSync(path.join(dir, composite))), { x: 1, y: 1, width: 6, height: 4 });
  assert.deepEqual(Array.from(cropped.data), Array.from(expected.data), 'the lockup is exactly those pixels of the accepted drawing');
  assert.deepEqual(Array.from(cropped.data.subarray(0, 4)), MARK);
  assert.equal(validateTree(tree), true, JSON.stringify(validateTree.errors));
  // With the lockup, the page under the layout is no longer refused for it; the drawing check stays clean.
  assert.equal(codes(checkShellConformance(dir), 'info').includes('SHELL_LOCKUP_DEFERRED'), false);
  assert.deepEqual(checkShellConformance(dir).refused, []);
  // Redrawn since: the lockup is flagged for a re-crop, never refused.
  drawLayout(p, { state: 'done', mark: [0, 250, 0, 255] });
  assert.ok(codes(checkShellConformance(dir), 'suspect').includes('SHELL_LOCKUP_SOURCE_STALE'));
  // Once the frontend exists the tree is scanned (origin repository): re-crop from a real render.
  const scanned = readTree(p);
  scanned.origin = 'repository';
  writeTree(p, scanned);
  assert.ok(codes(checkShellConformance(dir), 'suspect').includes('SHELL_LOCKUP_FROM_DRAWING'));
});

test('lockup sources: only a recorded real render or an accepted planned-layout composite', async (t) => {
  const p = greenfield(t);
  const tree = readTree(p);
  assert.match(lockupSourceOf(tree, p.work, 'ui.home.dashboard:assets/x.png').error, /not the design record of a planned visible layout/);
  assert.match(lockupSourceOf(tree, p.work, `${DESIGN}:assets/x.png`).error, /does not exist - interface.draw draws the planned layout first/);
  assert.match(lockupSourceOf(tree, p.work, 'shell/assets/layouts/nope.png').error, /not a recorded capture/);
  assert.match(lockupSourceOf(tree, p.work, 'brand/assets/logo.png').error, /--from names shell\/<capture path> or <ui-id>:<layout composite path>/);
  const { composite } = drawLayout(p, { state: 'done' });
  assert.match(lockupSourceOf(tree, p.work, `${DESIGN}:${composite.replace('.png', '.content.png')}`).error, /not an accepted layout composite/);
  // A real render: the settled product's recorded console capture.
  const s = await settledProduct(t);
  const bad = layoutTreeMain(['lockup', '--work', s.work, '--from', 'shell/assets/layouts/locale-console--desktop--light.png', '--rect', '35,25,10,10', '--write']);
  assert.match(bad.text, /leaves the 40x30 source/);
  const ok = layoutTreeMain(['lockup', '--work', s.work, '--from', 'shell/assets/layouts/locale-console--desktop--light.png', '--rect', '0,0,4,2', '--write', '--json']);
  assert.equal(ok.exitCode, 0, ok.text);
  const written = readTree(s);
  assert.equal(written.brand.lockups.length, 1, 'the light lockup is replaced, not duplicated');
  assert.equal(written.brand.lockups[0].source.kind, 'render');
  assert.equal(written.brand.component, 'PhotoBrand', 'the brand block is kept');
  assert.deepEqual(checkShellConformance(path.join(s.work, 'shell')).findings.filter((f) => /LOCKUP/.test(f.code)), []);
});
