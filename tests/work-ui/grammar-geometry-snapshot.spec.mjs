import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadChromium, snapshotFiles } from '../../scripts/work/ui/grammar-geometry.mjs';
import { chromiumGap } from '../helpers/chromium-gap.mjs';

// snapshotFiles runs collectPage in a real page: the data-* hooks it reports (data-component, data-draw-layout,
// data-width) and the data-gg-i index the keyboard focus pass maps back to an element.
test('a snapshot reports the data hooks of each element and the focus stops by element index', async (t) => {
  const pw = await loadChromium(process.env.STARCI_PLAYWRIGHT_DIR ?? null);
  if (!pw) { t.skip('no Playwright resolvable from this runtime (STARCI_PLAYWRIGHT_DIR)'); return; }
  const gap = chromiumGap(pw.chromium);
  if (gap) { t.skip(`no browser to drive: ${gap}`); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-geometry-snapshot-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'page.html');
  fs.writeFileSync(file, `<!doctype html><html><body><main data-component="Page" data-width="wide"><section data-draw-layout="stack" data-width=""><span>plain</span></section>
<button data-component="Button">go</button><a href="#x">link</a><input aria-label="field"></main></body></html>`);
  const result = await snapshotFiles([file], { viewport: { width: 640, height: 480 } });
  assert.equal(result.ok, true, JSON.stringify(result));
  const [snap] = result.snapshots;
  const byTag = (tag) => snap.elements.find((e) => e.tag === tag);
  assert.deepEqual([byTag('main').comp, byTag('main').drawLayout, byTag('main').dataWidth], ['Page', false, 'wide']);
  assert.deepEqual([byTag('section').comp, byTag('section').drawLayout, byTag('section').dataWidth], [null, true, '']);
  assert.deepEqual([byTag('span').comp, byTag('span').drawLayout, byTag('span').dataWidth], [null, false, null]);
  assert.equal(byTag('button').comp, 'Button');
  const stops = snap.focus.filter(Boolean).map((stop) => snap.elements[stop.i].tag);
  assert.deepEqual(stops.slice(0, 3), ['button', 'a', 'input']);
});
