import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';

const root=path.resolve(import.meta.dirname,'..');
const readOp=name=>parseYaml(fs.readFileSync(path.join(root,'modules/ops/ops',`${name}.yaml`),'utf8'));
const draw=readOp('interface.draw');
const implement=readOp('interface.implement');
const prose=value=>JSON.stringify(value);

test('interface.draw classifies every visible region before generation',()=>{
  assert.match(draw.goal.en,/raster asset or code-native/);
  const evidence=draw.writes.find(write=>write.id==='evidence');
  assert.match(evidence.path,/E\/realization-map\.json/);
  assert.match(prose(draw.steps),/rich texture, illustration, photography/);
  assert.match(prose(draw.steps),/panels, cards,\s+controls, text, system icons, borders, shadows, glows/);
  assert.match(prose(draw.steps),/never authorizes shipping that UI as a flattened image/);
  assert.ok(draw.proofs.some(proof=>proof.id==='realization-map'));
});

test('interface.draw self-questions symbolic meaning before accepting artwork',()=>{
  const evidence=draw.writes.find(write=>write.id==='evidence');
  assert.match(evidence.path,/E\/symbol-review\.json/);
  assert.match(prose(draw.steps),/what exact product concept does it encode/);
  assert.match(prose(draw.steps),/what would a viewer infer if the label disappeared/);
  assert.match(prose(draw.steps),/audience\/category/);
  assert.match(prose(draw.steps),/camera, base, material, light, scale and density/);
  assert.match(prose(draw.steps),/installed Grammar or repository-native SVG/);
  assert.ok(draw.proofs.some(proof=>proof.id==='symbolic-integrity'));
  assert.ok(draw.blockers.some(blocker=>blocker.code==='SYMBOL_INTENT_UNRESOLVED'));
});

test('interface.implement preserves region realization instead of substituting media and UI',()=>{
  const design=implement.reads.find(read=>read.id==='design');
  assert.match(prose(design),/preserve each `raster-asset` versus `code-native` decision/);
  const assets=implement.writes.find(write=>write.id==='assetManifest');
  assert.match(assets.path,/E\/realization-check\.json/);
  assert.match(prose(implement.steps),/Never flatten code-native cards, panels, controls/);
  assert.match(prose(implement.steps),/Never replace a required mascot, illustration, photo or textured\s+media asset with an improvised CSS drawing/);
  assert.ok(implement.proofs.some(proof=>proof.id==='realization-fidelity'));
  assert.ok(implement.blockers.some(blocker=>blocker.code==='REALIZATION_MODE_CONFLICT'));
});
