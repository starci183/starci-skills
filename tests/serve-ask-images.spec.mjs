import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reportImages, pickGroupsOf } from '../scripts/kernel/serve-ask.mjs';

// A live AUTH login ask listed only its own draws.yaml; serve-ask fell back to
// the newest draws.yaml anywhere under .starciwork and served another
// workflow's purchase-flow candidates, with four unrelated required radio groups.
const tree = () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-ask-images-'));
  const put = (rel, body) => { const abs = path.join(repo, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); };
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  put('.starciwork/features/login/ui/assets/sign-in-desktop-candidate-a.png', png);
  put('.starciwork/features/login/ui/assets/sign-in-desktop-candidate-b.png', png);
  put('.starciwork/features/login/ui/evidence/redraw/draws.yaml',
    'draws:\n  - id: desktop-a\n    image: assets/sign-in-desktop-candidate-a.png\n  - id: desktop-b\n    image: assets/sign-in-desktop-candidate-b.png\n');
  put('.starciwork/features/workspace-provision/ui/purchase-flow/assets/offer-selection-a-round-3.png', png);
  put('.starciwork/features/workspace-provision/ui/purchase-flow/evidence/r3/draws.yaml',
    'draws:\n  - id: offer-selection-a-round-3\n    image: assets/offer-selection-a-round-3.png\n');
  // the other workflow's draws.yaml is the newest file in the tree
  const later = new Date(Date.now() + 60000);
  fs.utimesSync(path.join(repo, '.starciwork/features/workspace-provision/ui/purchase-flow/evidence/r3/draws.yaml'), later, later);
  return repo;
};

test('an ask serves the images of the draws.yaml its own report lists, never the newest one in the tree', () => {
  const repo = tree();
  try {
    const images = reportImages(['.starciwork/features/login/ui/evidence/redraw/draws.yaml'], repo);
    assert.deepEqual(images.map((i) => i.label), ['desktop-a', 'desktop-b']);
    assert.equal(images.some((i) => /offer-selection/.test(i.abs)), false, 'another workflow never leaks into this ask');
    assert.deepEqual(reportImages(['.starciwork/features/login/ui/index.yaml'], repo), [], 'no image and no draws.yaml in the report means no image, not a guess');
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('a question that lists options gets no pick groups derived from image names', () => {
  const images = [{ label: 'offer-selection-a-round-3', abs: 'x/offer-selection-a-round-3.png' }, { label: 'offer-selection-b-round-3', abs: 'x/offer-selection-b-round-3.png' }];
  assert.deepEqual(pickGroupsOf({ options: ['Desktop A + Mobile A', 'Desktop B + Mobile B'] }, images), []);
  assert.equal(pickGroupsOf({}, images).length, 1, 'without options the naming convention still derives a group');
});
