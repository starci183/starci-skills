// Owner rulings 2026-09-27 on nivo wf-nivo-modules-agentos-mujek7lg op-interface.draw-2815deda22: the module-ledger
// draw passed with ten whole-page renders of ONE layout that differ only in a status banner (installed-empty, retrying,
// operation-pending, access-unverified, no-runtime, last-known, evidence-limited ...), no controls for the FR's
// commands, internal ids and jargon in the copy ("Nguồn: hệ thống lõi", installation-1), and an untoned "installed"
// badge - green on checks alone. scripts/work/draw/draw-quality.mjs refuses each; draw-render names the content-only part.
import test from 'node:test';
import { putBundle } from '../../engine/db/blob-lookup.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha256} from '../../engine/digest.mjs';
import { blankImage, drawOver, encodePng } from '../../scripts/work/png.mjs';
import { parseArgs as drawRenderArgs, captureBase } from '../../scripts/work/draw-render.mjs';
import { assetStateOf, dataStatusOf } from '../../scripts/work/ui/ui-shapes.mjs';
import {
  DRAW_ACTION_MISSING, DRAW_BADGE_UNTONED, DRAW_COPY_INTERNAL, DRAW_NOT_OWNER_ACCEPTED, DRAW_SCOPE_FULL_PAGE, DRAW_SCORE_BELOW, SHAPE_DUPLICATE,
  badgesOf, commandsFrom, controlCountOf, drawQualityFindings, internalCopyOf, statusBandOf, visibleTextOf, DRAW_LOOP_MISSING,
} from '../../scripts/work/draw/draw-quality.mjs';
import { DRAW_OFF_GRAMMAR_COMPONENT } from '../../scripts/work/draw/draw-dna.mjs';
import { autoAcceptDecision } from '../../scripts/kernel/ask-recommendation.mjs';
import { withRationale } from '../helpers/draw-rationale-fixture.mjs';

const BG = [255, 255, 255, 255], INK = [20, 30, 60, 255], BANNER = [240, 200, 0, 255];
/** A 60x80 ledger render: a header bar, an optional status banner (pushes the list down), three list rows. */
const ledger = ({ banner = false, tabs = false } = {}) => {
  const img = blankImage(60, 80, BG);
  drawOver(img, blankImage(60, 8, INK), 0, 0);
  let y = 12;
  if (banner) { drawOver(img, blankImage(56, 8, BANNER), 2, y); y += 10; }
  if (tabs) for (let x = 0; x < 60; x += 12) drawOver(img, blankImage(10, 30, [x * 4, 100, 200, 255]), x, 12);
  else for (let k = 0; k < 3; k += 1) drawOver(img, blankImage(56, 6, INK), 2, y + k * 10);
  return img;
};
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-quality-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const codes = (list) => [...new Set(list.map((f) => f.code))].sort();

test('two states of one XBase one status band apart are one shape: SHAPE_DUPLICATE; a structural change is not', () => {
  assert.ok(statusBandOf(ledger(), ledger({ banner: true })), 'a banner that pushes the list down is one band (tail realigned)');
  assert.equal(statusBandOf(ledger(), ledger({ tabs: true })), null, 'tabs change the structure: two shapes');
  assert.deepEqual(statusBandOf(ledger(), ledger()).share, 0);
});

test('the data-status vocabulary covers the status variants the owner ruled are never drawn', () => {
  for (const [state, status] of [['installed-empty', 'empty'], ['retrying', 'error'], ['operation-pending', 'loading'], ['operation-uncertain', 'error'],
    ['access-unverified', 'forbidden'], ['no-runtime', 'empty'], ['last-known', 'error'], ['evidence-limited', 'empty']]) {
    assert.equal(dataStatusOf(state)?.status, status, state);
  }
  for (const shape of ['installed-current', 'operation-confirmed']) assert.equal(dataStatusOf(shape), null, `${shape} stays a shape`);
});

test('controls, copy and badges are read from the render source', () => {
  const html = '<main><h1>Mô-đun</h1><p>Nguồn: hệ thống lõi</p><p>installation-1</p><span class="badge">Đã cài đặt</span>'
    + '<span class="chip" data-tone="warning">Installed</span><span class="badge text-success">Đã cài đặt</span><button>Mở</button><a href="#">Cấu hình</a></main>';
  assert.equal(controlCountOf(html), 2);
  assert.deepEqual(internalCopyOf(visibleTextOf(html)).map((l) => l.id).sort(), ['internal-vocabulary', 'kebab-id', 'record-id', 'source-label']);
  assert.deepEqual(badgesOf(html).map((b) => [b.text, b.tone]), [['Đã cài đặt', null], ['Installed', 'warning'], ['Đã cài đặt', 'success']]);
  const record = { ui: { flow: { transitions: [
    { id: 'open-module', from: ['installed-current'], to: 'external-module-route', trigger: 'owner activates exact installed sibling' },
    { id: 'retry-facet', from: ['installed-current', 'evidence-limited'], to: 'retrying', trigger: 'owner activates retry by pointer or keyboard' },
    { id: 'authorize-current', from: 'loading', to: 'installed-current', trigger: 'current owner authorization and complete read' },
  ] } } };
  assert.deepEqual(commandsFrom(record, 'installed-current').map((c) => c.id), ['open-module', 'retry-facet']);
  assert.deepEqual(commandsFrom(record, 'loading'), [], 'a system trigger is no command');
});

const LOOP_REL = 'assets/directions/draw-loop/ModuleLedgerBase--installed-current/loop.json';
/** A module-ledger ui record drawn the incident's way, and the same record drawn right. */
function drawRecord(dir, { right = false } = {}) {
  const directions = path.join(dir, 'assets', 'directions');
  fs.mkdirSync(directions, { recursive: true });
  const assets = [];
  const part = (state, img, html) => {
    const name = right ? `ModuleLedgerBase#${state}--desktop--light` : `${state}--page--desktop--light.content`;
    fs.writeFileSync(path.join(directions, `${name}.png`), encodePng(img));
    fs.writeFileSync(path.join(directions, `${name}.html`), html);
    if (right) {
      // The decision evidence (draw-rationale.mjs): rationale.json, the measured draw-render record, the redline.
      fs.writeFileSync(path.join(directions, `${name}.rationale.json`), JSON.stringify(goodWhy.entries));
      fs.writeFileSync(path.join(directions, `${name}.json`), JSON.stringify({ schema: 'starci/draw-render@1', ok: true, viewport: { width: 1280, height: 800 }, rationale: goodWhy.measure({ width: 1280, height: 800 }) }));
      fs.writeFileSync(path.join(directions, `${name}.redline.png`), encodePng(img));
    }
    if (right) fs.writeFileSync(path.join(directions, `${name}.score.json`), JSON.stringify({ schema: 'starci/ui-proof-score@1', htmlSha256: sha256(Buffer.from(html)), summary: { pass: 9, fail: 0 } }));
    assets.push({ path: `assets/directions/${name}.png`, role: 'direction-content', breakpoint: 'desktop', theme: 'light', sha256: sha256(encodePng(img)),
      generation: { tool: 'draw-render', promptPath: `assets/directions/${name}.prompt.txt`, ...(right ? { mode: 'draw-loop', loop: { path: LOOP_REL, round: 1 } } : {}) } });
    if (!right) {
      const composite = `assets/directions/${state}--page--desktop--light.png`;
      fs.writeFileSync(path.join(dir, composite), encodePng(img));
      assets.push({ path: composite, role: 'direction', breakpoint: 'desktop', theme: 'light', composite: { flowState: state, breakpoint: 'desktop', theme: 'light', presentation: 'page' }, generation: { tool: 'draw-render', promptPath: 'x', mode: 'composite' } });
    }
  };
  // Drawn right: every element a DNA component (draw-dna.mjs), and the parts installed by the draw loop.
  const goodWhy = withRationale('<body><main data-grammar-component="PageContainer"><h1 data-grammar-component="Heading">Mô-đun đã cài</h1><ul data-grammar-component="SurfaceListCard"><li data-grammar-part="surface-fact">Chatbot <span class="badge" data-grammar-component="Badge" data-tone="success">Đã cài đặt</span> <button data-grammar-component="Button">Mở</button> <button data-grammar-component="Button">Thử lại</button></li></ul></main></body>');
  const good = goodWhy.html;
  const bad = '<main><h1>Mô-đun</h1><p>Nguồn: hệ thống lõi</p><p>installation-1</p><span class="badge">Đã cài đặt</span></main>';
  part('installed-current', ledger(), right ? good : bad);
  if (!right) part('operation-confirmed', ledger({ banner: true }), bad);
  else part('module-tabs', ledger({ tabs: true }), good);
  const shapes = right ? [{ base: 'ModuleLedgerBase', state: 'installed-current', viewports: ['desktop'] }, { base: 'ModuleLedgerBase', state: 'module-tabs', viewports: ['desktop'] }]
    : [{ base: 'ModuleLedgerBase', state: 'installed-current', viewports: ['desktop'] }, { base: 'ModuleLedgerBase', state: 'operation-confirmed', viewports: ['desktop'] }];
  const record = { schema: 'work/ui-screen@1', id: 'ui.instance-management.module-ledger', surface: 'page', ui: { shapes, flow: { transitions: [
    { id: 'open-module', from: ['installed-current'], to: 'external', trigger: 'owner activates exact installed sibling' },
    { id: 'retry-facet', from: ['installed-current'], to: 'retrying', trigger: 'owner activates retry by pointer or keyboard' },
  ] } }, assets };
  if (right) {
    const loop = path.join(dir, LOOP_REL);
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, JSON.stringify({ schema: 'starci/draw-loop@1', base: 'ModuleLedgerBase', state: 'installed-current', rounds: [{ n: 1 }], best: 1, outcome: 'passed', installed: assets.map((a) => ({ path: a.path, sha256: a.sha256 })) }));
    const loopSha = putBundle(path.dirname(loop));
    for (const a of assets) if (a.generation?.loop) a.generation.loop = { sha256: loopSha, round: 1 };
  }
  if (right) record.ui.review = { owner: { decision: 'accepted', answeredBy: 'owner', dispatchId: 'ctx_owner', at: '2026-09-27T09:00:00Z', parts: assets.map((a) => ({ path: a.path, sha256: a.sha256 })) } };
  return record;
}

test('the incident draw is refused on every quality code; the same surface drawn right passes', (t) => {
  const repo = tmp(t);
  const dir = path.join(repo, '.starciwork', 'features', 'instance-management', 'ui', 'module-ledger');
  const bad = drawRecord(dir);
  const found = drawQualityFindings(dir, bad, repo);
  assert.deepEqual(codes(found), [DRAW_ACTION_MISSING, DRAW_BADGE_UNTONED, DRAW_COPY_INTERNAL, DRAW_NOT_OWNER_ACCEPTED, DRAW_SCOPE_FULL_PAGE, DRAW_SCORE_BELOW, SHAPE_DUPLICATE,
    DRAW_OFF_GRAMMAR_COMPONENT, DRAW_LOOP_MISSING, 'DRAW_RATIONALE_MISSING'].sort());
  assert.match(found.find((f) => f.code === SHAPE_DUPLICATE).detail, /ModuleLedgerBase#operation-confirmed and ModuleLedgerBase#installed-current .* status band/);
  assert.match(found.find((f) => f.code === DRAW_ACTION_MISSING).detail, /open-module, retry-facet.*0 control/);

  const repo2 = tmp(t);
  const dir2 = path.join(repo2, '.starciwork', 'features', 'instance-management', 'ui', 'module-ledger');
  const good = drawRecord(dir2, { right: true });
  assert.deepEqual(drawQualityFindings(dir2, good, repo2), []);
  // A score of another version of the html, or with a failed case, is below the bar.
  const score = path.join(dir2, 'assets', 'directions', 'ModuleLedgerBase#installed-current--desktop--light.score.json');
  fs.writeFileSync(score, JSON.stringify({ schema: 'starci/ui-proof-score@1', htmlSha256: 'f'.repeat(64), summary: { pass: 9, fail: 0 } }));
  assert.match(drawQualityFindings(dir2, good, repo2).find((f) => f.code === DRAW_SCORE_BELOW).detail, /scored another version/);
  // An automatic accept is not the owner's.
  good.ui.review.owner.answeredBy = 'auto-recommended';
  assert.ok(drawQualityFindings(dir2, good, repo2).some((f) => f.code === DRAW_NOT_OWNER_ACCEPTED));
});

test('draw-render names a content-only part <XBase>#<state>; a draw-review ask is never auto-accepted', () => {
  const o = drawRenderArgs(['--component', 'x.tsx', '--export', 'ModuleLedgerBase', '--props', 'p.json', '--out', 'o', '--viewports', '390x844', '--state', 'installed-current']);
  assert.equal(captureBase(o.name, o.viewports[0], o.theme), 'ModuleLedgerBase#installed-current--390x844--light');
  assert.equal(assetStateOf({}, { path: 'assets/directions/ModuleLedgerBase#installed-current--desktop--light.png' }), 'installed-current');
  assert.throws(() => drawRenderArgs(['--html', 'a.html', '--out', 'o', '--viewports', '390x844', '--state', 'x']), /--state needs the XBase/);
  const decision = autoAcceptDecision({ question: { kind: 'draw-review', text: 'Review', options: ['Accept', 'Redraw'] }, opId: 'interface.draw', secretFields: { files: [], vars: [] }, policy: { autoAcceptRecommended: true, excludes: [] } });
  assert.deepEqual([decision.accept, decision.why], [false, 'owner-only']);
});
