// What draw-acceptance attributes and judges when a pass binds whole owned directories.
//  - nivo wf-nivo-modules-agentos-mujek7lg inc-c4337a7874da (op-interface.draw-b7500b11bb): an image under the child
//    record owned-shell/module-ledger was attributed to the parent record owned-shell (the shorter directory prefix
//    matched first), so its asset.retired and its draw-render receipt were never read - 46 false findings. The owner
//    of a file is the LONGEST path-segment prefix record.
//  - nivo wf-nivo-workspace-provision-mujek7cb inc-59f939a53469 (op-interface.draw-3cd517a152): every draws.yaml,
//    selectedMatrix and baseline under the owned ui dirs was judged, kept historical image-gen evidence (earlier
//    rounds, kept-never-deleted and artifact-indexed so it cannot move) included - 40 findings over the two dirs vs
//    20 over their index.yaml. A document reached only by walking an owned directory is judged when the live record
//    binds it; a document the pass names itself is always judged; an entry marked retired is kept proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '../engine/index.mjs';
import { DATA_STATUS_DRAWN, DRAW_ASSET_NOT_TOKEN_RENDERED, DRAW_NOT_SHAPES, RENDER_RECORD_SCHEMA, drawAcceptanceFindings, ownerOf } from '../scripts/checks/draw-acceptance.mjs';

const PNG_A = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const PNG_B = Buffer.concat([PNG_A, Buffer.from('b')]);
const tmp = (t) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-scope-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const put = (repo, rel, body) => { const abs = path.join(repo, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return rel; };
const yaml = (o) => JSON.stringify(o, null, 2);
const record = (id, assets = [], extra = {}) => yaml({ schema: 'work/ui-screen@1', id, state: 'todo', surface: 'page', ui: { shapes: [{ base: 'LedgerBase', state: 'installed-current', viewports: ['desktop'] }], ...extra }, assets });
const at = (verdict, code) => verdict.findings.filter((f) => f.code === code).map((f) => f.path);

const PARENT = '.starciwork/features/instance-management/ui/owned-shell';
const CHILD = `${PARENT}/module-ledger`;

test('an image under a nested child record belongs to the child (longest path-segment prefix), so its retired flag and receipt are read', (t) => {
  const repo = tmp(t);
  put(repo, `${PARENT}/index.yaml`, record('ui.owned-shell'));
  put(repo, `${CHILD}/index.yaml`, record('ui.owned-shell.module-ledger', [
    { path: 'assets/directions/installed-current--page--desktop--light.png', role: 'direction', retired: 'image-gen', generation: { tool: 'image_gen.imagegen' } },
  ]));
  put(repo, `${CHILD}/assets/directions/installed-current--page--desktop--light.png`, PNG_A);
  // A loose capture of the child with its draw-render receipt beside it.
  put(repo, `${CHILD}/assets/directions/LedgerBase#installed-current--1280x800--light.png`, PNG_B);
  put(repo, `${CHILD}/assets/directions/LedgerBase#installed-current--1280x800--light.json`, JSON.stringify({ schema: RENDER_RECORD_SCHEMA, ok: true, image: { sha256: sha256(PNG_B) } }));
  // A sibling directory whose name starts with the child's is not inside it.
  put(repo, `${PARENT}/module-ledger-old/assets/x.png`, PNG_A);
  const verdict = drawAcceptanceFindings({ repo, files: [PARENT] });
  const paths = verdict.findings.map((f) => f.path ?? '');
  assert.ok(!paths.some((p) => p.includes('installed-current--page--desktop--light.png')), 'the retired image-gen file of the child is kept proof');
  assert.ok(!paths.some((p) => p.includes('1280x800')), 'the child capture carries its draw-render receipt');
  assert.equal(verdict.drawn, true);
  const judged = [{ dir: path.join(repo, PARENT), id: 'parent' }, { dir: path.join(repo, CHILD), id: 'child' }];
  assert.equal(ownerOf(judged, path.join(repo, CHILD, 'assets', 'a.png')).id, 'child');
  assert.equal(ownerOf(judged, path.join(repo, `${PARENT}/module-ledger-old/assets/x.png`)).id, 'parent');
  assert.equal(ownerOf(judged.slice().reverse(), path.join(repo, CHILD, 'assets', 'a.png')).id, 'child', 'order-independent');
});

test('kept historical draw evidence under an owned dir is not re-judged unless the live record binds it; named evidence always is', (t) => {
  const repo = tmp(t);
  const UI = '.starciwork/features/workspace-provision/ui/purchase-flow/payment-status';
  put(repo, `${UI}/index.yaml`, record('ui.payment-status'));
  put(repo, `${UI}/assets/directions/LedgerBase#installed-current--1280x800--light.png`, PNG_B);
  put(repo, `${UI}/assets/directions/LedgerBase#installed-current--1280x800--light.json`, JSON.stringify({ schema: RENDER_RECORD_SCHEMA, ok: true, image: { sha256: sha256(PNG_B) } }));
  const oldRound = put(repo, `${UI}/evidence/round-7/draws.yaml`, yaml({ schema: 'starci/ui-draws@1', draws: [{ id: 'payment-pending-desktop-light', screen: 'payment-status', state: 'payment-pending', provenance: { tool: 'image_gen.imagegen' } }] }));
  put(repo, `${UI}/evidence/attempt-3/baseline-draw-acceptance.json`, JSON.stringify({ ok: false, findings: [], records: [], drawn: false, assertions: [{ id: 'imagegen-provenance' }] }));

  const walked = drawAcceptanceFindings({ repo, files: [UI] });
  assert.deepEqual(walked.findings.filter((f) => /evidence\//.test(f.path ?? '')), [], 'earlier rounds and baselines are kept proof, not this pass');

  const named = drawAcceptanceFindings({ repo, files: [UI, oldRound] });
  assert.ok(at(named, DRAW_ASSET_NOT_TOKEN_RENDERED).includes(oldRound), 'a draws.yaml the pass names is judged');
  assert.ok(at(named, DRAW_NOT_SHAPES).includes(oldRound));

  // The live record binding the document makes it live evidence again.
  put(repo, `${UI}/index.yaml`, record('ui.payment-status', [], { drawEvidence: 'evidence/round-7/draws.yaml' }));
  const bound = drawAcceptanceFindings({ repo, files: [UI] });
  assert.ok(at(bound, DRAW_ASSET_NOT_TOKEN_RENDERED).includes(oldRound), 'bound by the live record, walked or not');
  // ...but not through a retired entry of the record.
  put(repo, `${UI}/index.yaml`, record('ui.payment-status', [{ path: 'evidence/round-7/draws.yaml', role: 'evidence', retired: 'image-gen' }]));
  assert.deepEqual(drawAcceptanceFindings({ repo, files: [UI] }).findings.filter((f) => /evidence\//.test(f.path ?? '')), []);
});

test('a walked historical redline image is kept proof; named and live-bound unreceipted images are judged', (t) => {
  const repo = tmp(t);
  const UI = '.starciwork/features/workspace-provision/ui/purchase-flow/payment-status';
  const redline = put(repo, `${UI}/assets/directions/round-7.redline.png`, PNG_A);
  put(repo, `${UI}/index.yaml`, record('ui.payment-status'));
  put(repo, `${UI}/assets/directions/LedgerBase#installed-current--1280x800--light.png`, PNG_B);
  put(repo, `${UI}/assets/directions/LedgerBase#installed-current--1280x800--light.json`, JSON.stringify({ schema: RENDER_RECORD_SCHEMA, ok: true, image: { sha256: sha256(PNG_B) } }));

  const walked = drawAcceptanceFindings({ repo, files: [UI] });
  assert.ok(!at(walked, DRAW_ASSET_NOT_TOKEN_RENDERED).includes(redline), 'wrongly blocked: an unlisted historical redline found only by walking is kept evidence');

  const named = drawAcceptanceFindings({ repo, files: [UI, redline] });
  assert.ok(at(named, DRAW_ASSET_NOT_TOKEN_RENDERED).includes(redline), 'a named unreceipted image remains bound by this pass');

  put(repo, `${UI}/index.yaml`, record('ui.payment-status', [], { drawEvidence: 'assets/directions/round-7.redline.png' }));
  const referenced = drawAcceptanceFindings({ repo, files: [UI] });
  assert.ok(at(referenced, DRAW_ASSET_NOT_TOKEN_RENDERED).includes(redline), 'an image referenced by the live record is judged when reached by walking');

  put(repo, `${UI}/index.yaml`, record('ui.payment-status', [{ path: 'assets/directions/round-7.redline.png', role: 'direction' }]));
  const live = drawAcceptanceFindings({ repo, files: [UI] });
  assert.ok(at(live, DRAW_ASSET_NOT_TOKEN_RENDERED).includes(redline), 'a live record asset remains judged when reached by walking');
});

test('an entry marked retired is kept proof even in a named document; its live entries are still judged', (t) => {
  const repo = tmp(t);
  const doc = put(repo, '.starciwork/evidence/wf-x.interface-draw/draws.yaml', yaml({ schema: 'starci/ui-draws@1', draws: [
    { id: 'old', screen: 'payment-status', state: 'loading', retired: 'image-gen', provenance: { tool: 'image_gen.imagegen' } },
    { id: 'live', shape: 'LedgerBase#loading', state: 'loading', provenance: { tool: 'draw-render' } },
  ] }));
  const verdict = drawAcceptanceFindings({ repo, files: [doc] });
  assert.ok(!verdict.findings.some((f) => /old/.test(f.detail) && f.path === doc), 'the retired entry is not judged');
  assert.ok(at(verdict, DATA_STATUS_DRAWN).includes(doc), 'the live entry naming a data status is still refused');
});
