import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';
import { loadOp, proof, blocker, root, sentences, statesOnce } from './helpers/op-contract.mjs';

// interface.draw draws shapes by token-render (owner decisions 2026-09-27, lane draw-manifest).
const draw = loadOp('interface.draw');
const steps = draw.steps.map((s) => s.action.en).join('\n');

test('interface.draw draws only shapes, never a data status', () => {
  statesOnce(assert, draw, ['`ui.shapes`', 'XBase#state', 'data status'], { section: '$.steps', label: 'the shape list' });
  statesOnce(assert, draw, ['data status', 'never drawn', 'SlotView'], { section: '$.steps', label: 'data status is never drawn' });
  const prose = sentences(draw).map((s) => s.text).join('\n');
  assert.doesNotMatch(prose, /reachable loading\/empty\/error\/success states/, 'no data status is enumerated as a state to draw');
  assert.doesNotMatch(prose, /\(page, loading, error, not-found\)/, 'the drawn part list holds no data-status surface');
  assert.doesNotMatch(prose, /directed loading state/, 'a loading state is never a directed drawing');
});

test('interface.draw renders parts with draw-render and keeps ImageGen for raster regions', () => {
  assert.match(steps, /node scripts\/work\/draw-render\.mjs/);
  assert.match(steps, /--html <file> --out <dir> --viewports <w>x<h>/);
  assert.match(steps, /--component <module> --export <XBase> --props\s+<fixture\.json>/);
  assert.match(steps, /@2x/);
  assert.match(steps, /--tool draw-render/);
  assert.doesNotMatch(steps, /a browser\s+capture, hand-painted boxes, mockup export or prose-only substitute does not satisfy/);
  statesOnce(assert, draw, ['image_gen.imagegen', 'only raster regions'], { section: '$.steps', label: 'ImageGen for raster only' });
  assert.ok(proof(draw, 'render-provenance'));
  assert.equal(proof(draw, 'imagegen-provenance'), undefined);
  assert.ok(blocker(draw, 'RENDER_TOOL_UNAVAILABLE'));
  assert.match(blocker(draw, 'IMAGEGEN_TOOL_UNAVAILABLE').condition.en, /raster region/);
  assert.equal((draw.route.riskHints ?? []).some((h) => h === 'host-tool-required:image_gen.imagegen'), false,
    'a code-native drawing needs no image tool');
});

test('the brief carries the geometry, proof and grammar inputs verbatim', () => {
  assert.match(steps, /node scripts\/checks\/grammar-geometry\.mjs --prompt --repo\s+<repo>/);
  assert.match(steps, /node scripts\/checks\/ui-proof-brief\.mjs --surface <ui-record-dir> --repo <repo>/);
  assert.match(steps, /brand-palette\.mjs --prompt/);
  assert.match(steps, /no number it does not\s+carry is invented/);
  assert.equal(draw.grammarContext, 'required');
  statesOnce(assert, draw, ['status line', 'grey band', 'field label'], { section: '$.steps', label: 'status-line placement' });
});

test('the self-check cites a rule id for every value and marks every proof case', () => {
  statesOnce(assert, draw, ['rule id', 'inset', 'gap', 'radius', 'type size'], { section: '$.steps', label: 'the cited self-check' });
  statesOnce(assert, draw, ['satisfied', 'not satisfied', 'not observable'], { section: '$.steps', label: 'proof case marks' });
  assert.match(proof(draw, 'self-check').requirement.en, /rule id/);
});

test('draw routes to Devin first, Codex (GPT-6 Sol at effort high) the fallback', () => {
  const rt = parseYaml(fs.readFileSync(path.join(root, 'modules/models/runtimes.yaml'), 'utf8'));
  const kind = rt.roleOfKind['interface.draw'];
  assert.equal(kind.order, 'draw');
  assert.equal(kind.floor, 'hard');
  assert.deepEqual(rt.allocation.preference.draw, ['devin-agent', 'codex-agent']);
  assert.deepEqual(rt.allocation.tiers.hard.draw, ['devin-agent', 'codex-agent']);
  assert.equal(rt.runtimes['codex-agent'].models.hard, 'gpt-6-sol');
  assert.equal(rt.runtimes['codex-agent'].effort.hard, 'high');
});

test('the render source is a declared .html asset and full-width controls take the fill geometry', () => {
  statesOnce(assert, draw, ['declare that .html', 'shell-conformance'], { section: '$.steps', label: 'declared html asset' });
  statesOnce(assert, draw, ['full-width control', 'fill-variant geometry'], { section: '$.steps', label: 'fill geometry from the block' });
  assert.match(proof(draw, 'shell-conformance').requirement.en, /GEOMETRY_OFF_GRAMMAR/);
});

test('the owner reviews shapes only; an owner request comes from ledger lineage', () => {
  const prose = JSON.stringify(draw);
  assert.match(prose, /draw-review\.mjs question --ui <ui-record-dir> --job\s+<id>/);
  assert.match(prose, /drawOwnerRulingOf/);
  assert.doesNotMatch(prose, /--owner-requested|a prior owner redraw or feedback/);
  assert.match(proof(draw, 'owner-sees-parts').requirement.en, /retired data-status image is never shown/);
});
