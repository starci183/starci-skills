import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reportImages, pickGroupsOf, toOwnerImages } from '../scripts/kernel/serve-ask.mjs';

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

// Owner ruling 2026-09-24: the owner reviews the drawn PART, never the
// composite. WSPV's round-6 draws.yaml put the composite in `image:
// {path, sha256}` beside `content: {path, sha256}`; its ask served composites.
test('an ask serves each draw\'s part, not its composite; a declared pick on the composite path still binds', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-ask-parts-'));
  const put = (rel, body = 'png') => { const abs = path.join(repo, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return abs; };
  const UI = '.starciwork/features/wspv/ui/purchase-flow';
  try {
    const composite = put(`${UI}/assets/directions/offer--page--desktop--light.png`);
    const part = put(`${UI}/assets/directions/offer--page--desktop--light.content.png`);
    const mobile = put(`${UI}/assets/directions/offer--page--mobile--light.content.png`);
    const legacy = put(`${UI}/assets/checkout.png`);
    put(`${UI}/evidence/round-6/draws.yaml`, [
      'schema: starci/ui-draws@1', 'draws:',
      '  - id: offer-desktop', '    image:', '      path: assets/directions/offer--page--desktop--light.png', '      sha256: aa',
      '    content:', '      path: assets/directions/offer--page--desktop--light.content.png', '      sha256: bb',
      '  - id: offer-mobile', '    part: {path: assets/directions/offer--page--mobile--light.content.png}',
      '    composite: {path: assets/directions/offer--page--mobile--light.png}',
      '  - id: checkout', '    image: assets/checkout.png', ''].join('\n'));
    const fromDraws = toOwnerImages(reportImages([`${UI}/evidence/round-6/draws.yaml`], repo), repo);
    assert.deepEqual(fromDraws.map((i) => [i.label, i.abs]), [['offer-desktop', part], ['offer-mobile', mobile], ['checkout', legacy]]);
    // An ask that names the composite itself (question.assets, the question text or report files) is swapped.
    const named = toOwnerImages([{ label: `${UI}/assets/directions/offer--page--desktop--light.png`, abs: composite }, { label: 'part', abs: part }], repo);
    assert.equal(named.length, 1, 'a composite listed beside its own part collapses into one image');
    assert.equal(named[0].abs, part);
    const swapped = toOwnerImages([{ label: `${UI}/assets/directions/offer--page--desktop--light.png`, abs: composite }], repo);
    assert.equal(swapped[0].label, `${UI}/assets/directions/offer--page--desktop--light.content.png`, 'the caption follows the swap');
    const picks = pickGroupsOf({ picks: [{ id: 'offer', choices: [{ id: 'A', image: `${UI}/assets/directions/offer--page--desktop--light.png` }, { id: 'B' }] }] }, swapped);
    assert.equal(picks[0].choices[0].image?.idx, 0, 'a pick declared on the composite path shows the part');
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

// WSPV's interface.draw ask (ctx_885b2c88287d) listed each state's .content.png, its composite and the
// evidence bundle's direction.png copy in report files; the owner saw composites.
test('an ask built from report files shows each part once: composites collapse, evidence copies drop', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-ask-files-'));
  const put = (rel) => { const abs = path.join(repo, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, rel); return rel; };
  const UI = '.starciwork/features/wspv/ui/purchase-flow';
  try {
    const files = [
      put(`${UI}/assets/directions/offer--page--desktop--light.content.png`),
      put(`${UI}/assets/directions/offer--page--desktop--light.png`),
      put(`${UI}/checkout/assets/directions/review--page--mobile--light.png`),
      put(`${UI}/checkout/assets/directions/review--page--mobile--light.content.png`),
      put(`${UI}/evidence/round-6/direction.png`),
    ];
    const shown = toOwnerImages(reportImages(files, repo), repo);
    assert.deepEqual(shown.map((i) => path.relative(repo, i.abs).split(path.sep).join('/')).sort(), [
      `${UI}/assets/directions/offer--page--desktop--light.content.png`,
      `${UI}/checkout/assets/directions/review--page--mobile--light.content.png`,
    ]);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});
