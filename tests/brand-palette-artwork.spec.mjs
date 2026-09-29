// A registered brand artwork master shown in a token-rendered drawing is the brand's own bytes, not a palette
// (starci-next wf-sn-foundation-mujek8g5 inc-2c34ae792249): the Academy learning-journey master
// (brand.artworkSlots academy-learning-journey, brand rev 6) embedded as an <img> in a subscription direction made
// every render fail PALETTE_OFF_BRAND on its own purple-magenta shading. draw-render.mjs now measures each <img>'s
// painted box and the sha256 of the bytes it shows (layout.artwork); brand-palette.mjs skips exactly the box of an
// image whose bytes are a registered master - never a colour allowlist, never an unregistered or altered image.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {sha256} from '../engine/digest.mjs';
import { artworkExclusions, brandPalette, mapIntoComposite, paletteFindings, registeredArtwork } from '../scripts/checks/brand-palette.mjs';
import { artworkDigests } from '../scripts/work/draw-render.mjs';
import { blankImage, drawOver, encodePng } from '../scripts/work/png.mjs';
import { NIVO_BRAND, redAccentPart } from './fixtures/brand-palette.mjs';

const tmp = (t) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-palette-art-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const refused = (findings) => findings.filter((f) => f.level === 'refuse').map((f) => f.code).sort();
const MASTER = Buffer.from('academy learning-journey master bytes');
const MASTER_SHA = sha256(MASTER);

/** The red-accent part with a violet illustration block (x 130..226, y 76..114) the brand does not declare. */
const partWithArtwork = () => {
  const image = redAccentPart();
  drawOver(image, blankImage(96, 38, [124, 58, 237, 255]), 130, 76);
  return image;
};

/** A part PNG and its draw-render record (deviceScaleFactor 1) naming one <img> box and the sha256 its bytes carry. */
const capture = (dir, { box = { x: 130, y: 76, width: 96, height: 38 }, bytes = MASTER_SHA, name = 'SubscriptionBase#active--desktop--light' } = {}) => {
  const png = encodePng(partWithArtwork());
  const file = path.join(dir, `${name}.png`);
  fs.writeFileSync(file, png);
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ schema: 'starci/draw-render@1', ok: true, viewport: { width: 240, height: 160, deviceScaleFactor: 1 },
    image: { path: file, sha256: sha256(png) }, layout: { artwork: [{ src: 'file:///academy/pro-learning-journey-v1.png', slot: null, sha256: bytes, ...box }] } }));
  return file;
};

const brandWith = (slots) => ({ ...NIVO_BRAND, artworkSlots: slots });
const findingsOf = (file, brand, brandDir = null, extra = {}) => paletteFindings({ file, shownAs: path.basename(file), brand, palette: brandPalette(brand, { brandDir }), subject: 'drawn part', at: 'index.yaml', ...extra });

test('the box of an <img> showing a registered artwork master is not palette; without the registration it is refused', (t) => {
  const dir = tmp(t);
  const file = capture(dir);
  assert.deepEqual(refused(findingsOf(file, NIVO_BRAND)), ['PALETTE_OFF_BRAND'], 'no artworkSlots: the violet illustration is an off-brand colour');
  assert.deepEqual(findingsOf(file, brandWith([{ id: 'academy-learning-journey', master: 'assets/pro-learning-journey-v1.png', sha256: MASTER_SHA }])), [], 'the declared sha256 of the slot');
  // The master's own bytes register it too (a slot with no declared digest).
  fs.mkdirSync(path.join(dir, 'brand', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'brand', 'assets', 'pro-learning-journey-v1.png'), MASTER);
  const bySlotFile = brandWith([{ id: 'academy-learning-journey', master: 'assets/pro-learning-journey-v1.png' }]);
  assert.equal(registeredArtwork(bySlotFile, path.join(dir, 'brand')).get(MASTER_SHA), 'academy-learning-journey');
  assert.deepEqual(findingsOf(file, bySlotFile, path.join(dir, 'brand')), []);
});

test('only the registered bytes and only their box: an altered image, or paint outside the box, is still refused', (t) => {
  const dir = tmp(t);
  const brand = brandWith([{ id: 'academy-learning-journey', master: 'assets/pro-learning-journey-v1.png', sha256: MASTER_SHA }]);
  const altered = capture(dir, { bytes: sha256(Buffer.from('a recoloured copy')), name: 'altered' });
  assert.deepEqual(refused(findingsOf(altered, brand)), ['PALETTE_OFF_BRAND'], 'an image whose bytes are not the master is judged like any paint');
  const half = capture(dir, { box: { x: 130, y: 76, width: 40, height: 38 }, name: 'half' });
  assert.deepEqual(refused(findingsOf(half, brand)), ['PALETTE_OFF_BRAND'], 'violet outside the measured box is still an off-brand colour');
  // A stale record (its image sha256 is not this file's) exempts nothing.
  const stale = capture(dir, { name: 'stale' });
  fs.writeFileSync(stale, encodePng(partWithArtwork()).subarray(0));
  const rec = JSON.parse(fs.readFileSync(stale.replace(/\.png$/, '.json'), 'utf8'));
  rec.image.sha256 = sha256(Buffer.from('another capture'));
  fs.writeFileSync(stale.replace(/\.png$/, '.json'), JSON.stringify(rec));
  assert.deepEqual(artworkExclusions({ file: stale, palette: brandPalette(brand) }), []);
});

test('a composite maps its content part\'s artwork box through the recorded rect and fit', (t) => {
  const dir = tmp(t);
  const brand = brandWith([{ id: 'academy-learning-journey', master: 'assets/pro-learning-journey-v1.png', sha256: MASTER_SHA }]);
  const content = capture(dir, { name: 'active--page--desktop--light.content' });
  // The part placed 1:1 at (40, 20) of a 320 x 200 page composite.
  const page = blankImage(320, 200, [251, 249, 247, 255]);
  drawOver(page, partWithArtwork(), 40, 20);
  const compositeFile = path.join(dir, 'active--page--desktop--light.png');
  fs.writeFileSync(compositeFile, encodePng(page));
  const composite = { content: { path: path.basename(content), sha256: sha256(fs.readFileSync(content)) }, rect: { x: 40, y: 20, width: 240, height: 160 }, fit: 'cover' };
  assert.deepEqual(refused(findingsOf(compositeFile, NIVO_BRAND)), ['PALETTE_OFF_BRAND']);
  assert.deepEqual(findingsOf(compositeFile, brand, null, { composite, uiDir: dir }), []);
  // A composite of a content part that has changed since compose exempts nothing.
  assert.deepEqual(refused(findingsOf(compositeFile, brand, null, { composite: { ...composite, content: { ...composite.content, sha256: 'f'.repeat(64) } }, uiDir: dir })), ['PALETTE_OFF_BRAND']);
  // cover scale: a 100x50 content into a 200x80 rect scales by 2 and crops 10px off the top.
  assert.deepEqual(mapIntoComposite({ x: 10, y: 10, width: 20, height: 20 }, { width: 100, height: 50 }, { x: 0, y: 0, width: 200, height: 80 }, 'cover'), { x: 20, y: 10, width: 40, height: 40, slot: undefined });
});

test('draw-render digests the bytes each <img> shows: file:, data: and an unreadable source', async (t) => {
  const dir = tmp(t);
  const master = path.join(dir, 'master.png');
  fs.writeFileSync(master, MASTER);
  const [fileImg, dataImg, missing] = await artworkDigests([
    { src: pathToFileURL(master).href, x: 0, y: 0, width: 1, height: 1 },
    { src: `data:image/png;base64,${MASTER.toString('base64')}`, x: 0, y: 0, width: 1, height: 1 },
    { src: 'file:///no/such/file.png', x: 0, y: 0, width: 1, height: 1 },
  ]);
  assert.equal(fileImg.sha256, MASTER_SHA);
  assert.equal(dataImg.sha256, MASTER_SHA);
  assert.equal(dataImg.src, 'data:');
  assert.equal(missing.sha256, null);
});
