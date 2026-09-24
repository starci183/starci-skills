import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { brandPalette, measurePalette, paletteFindings, promptPaletteBlock, readImage } from '../scripts/checks/brand-palette.mjs';
import { checkShellConformance } from '../scripts/checks/shell-conformance.mjs';
import { advisoryCodesFor, loadContractChanges } from '../scripts/kernel/contract-version.mjs';
import { blankImage, drawOver, encodePng } from '../scripts/work/png.mjs';
import { NIVO_BRAND, drawnPart, redAccentPart, bluePrimaryPart } from './fixtures/brand-palette.mjs';
import { drawUi, settledProduct, uiSkeleton } from './fixtures/layout-tree.mjs';

// Owner, 2026-09-24 ("sao lúc đỏ lúc xanh??"): nivo's brand is ONE accent, Unicorn red, and one drawn part
// painted its primary button, links and selection in the image model's default blue. The palette rule already
// existed in scripts/checks/render.mjs but no gate ran it; scripts/checks/brand-palette.mjs is its drawn-image
// form and scripts/checks/shell-conformance.mjs runs it for every part, composite and capture.
const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'brand-palette');
const palette = brandPalette(NIVO_BRAND);
const codes = (findings) => findings.filter((f) => f.level === 'refuse').map((f) => f.code).sort();
const findingsOf = (file) => paletteFindings({ file, shownAs: path.basename(file), brand: NIVO_BRAND, palette, subject: 'drawn part', at: 'index.yaml' });

test('a red-accent part passes: the primary, its tints, the navy ink and a green status dot are all the brand', () => {
  const file = path.join(FIXTURES, 'red-accent-part.content.png');
  assert.deepEqual(findingsOf(file), []);
  const m = measurePalette(readImage(file), palette);
  assert.equal(m.primary.present, true);
  assert.deepEqual(m.refused, []);
  assert.ok(m.tokens['--nivo-success'] > 0, 'a mint success dot drawn green is still the success token');
});

test('a blue-primary part fails: PALETTE_OFF_BRAND names the colour, its share and the nearest token; PRIMARY_ABSENT names the primary', () => {
  const file = path.join(FIXTURES, 'blue-primary-part.content.png');
  const findings = findingsOf(file);
  assert.deepEqual(codes(findings), ['PALETTE_OFF_BRAND', 'PRIMARY_ABSENT']);
  const off = findings.find((f) => f.code === 'PALETTE_OFF_BRAND').message;
  assert.match(off, /blue #0[0-9a-f]{5} on \d+(\.\d+)?% of the coloured area \(\d+(\.\d+)?% of the image\), nearest brand token --nivo-info #40a9ff \(info\) at deltaE \d/);
  assert.match(off, /--nivo-accent #e3001f/);
  assert.match(findings.find((f) => f.code === 'PRIMARY_ABSENT').message, /--nivo-accent #e3001f appears nowhere/);
});

test('the committed fixtures are the generator\'s bytes, so the specs read what the fixture module documents', () => {
  assert.deepEqual(fs.readFileSync(path.join(FIXTURES, 'red-accent-part.content.png')), encodePng(redAccentPart()));
  assert.deepEqual(fs.readFileSync(path.join(FIXTURES, 'blue-primary-part.content.png')), encodePng(bluePrimaryPart()));
});

test('a declared info blue does not license a primary-strength blue; a thin blue link on a red part is still refused', () => {
  const link = measurePalette(drawnPart({ accent: '#e3001f', tint: '#fbd7da', link: '#1f63d8' }), palette);
  assert.deepEqual(link.refused.map((o) => o.name), ['blue']);
  assert.equal(link.primary.present, true);
  const infoTint = measurePalette(drawnPart({ accent: '#e3001f', tint: '#fbd7da', dot: '#40a9ff' }), palette);
  assert.deepEqual(infoTint.refused, [], 'the info token itself, as a status dot, is on brand');
});

test('an undeclared hue is refused; a status colour drawn at its own strength with a small hue drift is not', () => {
  assert.deepEqual(measurePalette(drawnPart({ accent: '#e3001f', tint: '#fbd7da', dot: '#7c3aed' }), palette).refused.map((o) => o.name), ['violet']);
  assert.deepEqual(measurePalette(drawnPart({ accent: '#e3001f', tint: '#fbd7da', dot: '#f59e0b' }), palette).refused, [], 'an amber warning dot');
  assert.deepEqual(measurePalette(drawnPart({ accent: '#e3001f', tint: '#fbd7da', dot: '#22b040' }), palette).refused, [], 'a green success dot');
});

test('one-pixel subpixel text fringes and the keyed #FF00FF slot are never a palette', () => {
  assert.deepEqual(measurePalette(drawnPart({ accent: '#e3001f', tint: '#fbd7da', fringe: true }), palette).refused, []);
  const keyed = redAccentPart();
  drawOver(keyed, blankImage(100, 60, [255, 0, 255, 255]), 120, 70);
  assert.deepEqual(measurePalette(keyed, palette).refused, []);
});

test('the draw prompt block hands the worker every brand colour by role and hex, and the refusal rule', () => {
  const block = promptPaletteBlock(NIVO_BRAND, { name: 'Nivo' });
  for (const line of ['- primary: --nivo-accent #e3001f', '- success: --nivo-success #00cc84', '- info: --nivo-info #40a9ff', '- danger: --nivo-danger #e3001f (the primary colour)']) assert.ok(block.includes(line), line);
  assert.match(block, /PALETTE_OFF_BRAND/);
  assert.match(block, /call to action are #e3001f/);
});

/** The layout-tree fixture product with a nivo brand record written beside its shell. */
async function brandedProduct(t) {
  const p = await settledProduct(t);
  fs.mkdirSync(path.join(p.work, 'brand'), { recursive: true });
  fs.writeFileSync(path.join(p.work, 'brand', 'index.yaml'), stringifyYaml({ schema: 'work/brand@1', id: 'brand', kind: 'brand', state: 'done', rev: 1, brand: NIVO_BRAND }));
  return p;
}
const both = [{ breakpoint: 'desktop', theme: 'light' }, { breakpoint: 'mobile', theme: 'light' }];
const bound = (p) => ({ ref: 'shell', rev: p.tree.rev, layouts: [{ node: '/[locale]/(console)', rev: 1 }] });

test('shell-conformance runs the palette on every drawn part and composite of a ui record', async (t) => {
  const p = await brandedProduct(t);
  const red = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: '/[locale]/(console)/reports', surface: 'page', shell: bound(p) }), both.map((d) => ({ ...d, color: [227, 0, 31, 255] })));
  assert.deepEqual(checkShellConformance(red.dir).refused, []);
  const blue = await drawUi(p, 'photos/ui/list', uiSkeleton('ui.photos.list', { route: '/[locale]/(console)/photos', surface: 'page', shell: bound(p) }), both.map((d) => ({ ...d, color: [6, 92, 220, 255] })));
  const result = checkShellConformance(blue.dir);
  const refused = result.findings.filter((f) => f.level === 'refuse');
  assert.deepEqual([...new Set(refused.map((f) => f.code))].sort(), ['PALETTE_OFF_BRAND', 'PRIMARY_ABSENT']);
  const subjects = refused.filter((f) => f.code === 'PALETTE_OFF_BRAND').map((f) => /the (drawn part|composite) is painted/.exec(f.message)?.[1]).sort();
  assert.deepEqual(subjects, ['composite', 'composite', 'drawn part', 'drawn part'], 'desktop and mobile, part and composite');
  // A leg admitted before the change meets the new codes as advisory suspects, never refusals.
  const advisory = checkShellConformance(blue.dir, { advisoryCodes: ['PALETTE_OFF_BRAND', 'PRIMARY_ABSENT'] });
  assert.deepEqual(advisory.refused, []);
  assert.ok(advisory.suspect.some((s) => s.includes('[PALETTE_OFF_BRAND]') && s.includes('added after this leg was admitted')));
});

test('shell-conformance runs it on brand.decide layout captures and interface.implement running-page captures', async (t) => {
  const p = await brandedProduct(t);
  assert.deepEqual(checkShellConformance(path.join(p.work, 'shell')).refused, [], 'the fixture chrome is navy ink');
  const impl = path.join(p.work, 'features', 'photos', 'impl', 'web', 'list');
  fs.mkdirSync(path.join(impl, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(impl, 'index.yaml'), stringifyYaml({ schema: 'work/implementation@1', id: 'impl.photos.web.list', proves: [] }));
  fs.writeFileSync(path.join(impl, 'assets', 'running-page.png'), encodePng(bluePrimaryPart()));
  const result = checkShellConformance(impl);
  assert.equal(result.mode, 'implementation');
  assert.ok(result.refused.some((s) => s.includes('running-page capture') && s.includes('[PALETTE_OFF_BRAND]')));
  fs.writeFileSync(path.join(impl, 'assets', 'running-page.png'), encodePng(redAccentPart()));
  assert.ok(!checkShellConformance(impl).refused.some((s) => /PALETTE_OFF_BRAND|PRIMARY_ABSENT/.test(s)));
});

test('a tree without a brand record is told so, never refused', async (t) => {
  const p = await settledProduct(t);
  const board = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: '/[locale]/(console)/reports', surface: 'page', shell: bound(p) }), both.map((d) => ({ ...d, color: [6, 92, 220, 255] })));
  const result = checkShellConformance(board.dir);
  assert.deepEqual(result.refused, []);
  assert.ok(result.info.some((s) => s.includes('[BRAND_PALETTE_UNAVAILABLE]')));
});

test('the contracts wire it: registered for new legs, the draw prompt carries the brand colours, the gates name the codes', () => {
  const changes = loadContractChanges(ROOT);
  const change = changes.changes.find((c) => c.id === 'brand-palette-gate');
  assert.ok(change, 'modules/kernel/contract-changes.yaml registers brand-palette-gate');
  assert.equal(change.reach ?? 'new-legs', 'new-legs');
  for (const op of ['interface.draw', 'brand.decide', 'interface.implement']) {
    assert.ok(change.ops.includes(op), op);
    const { codes: advisory } = advisoryCodesFor(changes, { admittedAt: change.effectiveAt - 1000, op });
    assert.ok(advisory.includes('PALETTE_OFF_BRAND') && advisory.includes('PRIMARY_ABSENT'), `${op}: an older leg meets the codes as advisory`);
  }
  const draw = fs.readFileSync(path.join(ROOT, 'modules/ops/ops/interface.draw.yaml'), 'utf8');
  assert.match(draw, /brand-palette\.mjs --prompt/);
  assert.match(draw, /PALETTE_OFF_BRAND/);
  const drawOp = parseYaml(draw);
  assert.ok(drawOp.proofs.some((proof) => proof.id === 'brand-palette' && proof.check === 'scripts/checks/shell-conformance.mjs'));
  for (const op of ['brand.decide', 'interface.implement']) assert.match(fs.readFileSync(path.join(ROOT, `modules/ops/ops/${op}.yaml`), 'utf8'), /PALETTE_OFF_BRAND/, op);
});
