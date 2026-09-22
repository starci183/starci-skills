import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOp, proof, blocker, readOf, writeOf, statesOnce, states } from './helpers/op-contract.mjs';

// Direction and implementation agree on one thing: every visible region is
// either authored imagery or code. Asserted through the artifacts and ids that
// carry that decision, so the manifests stay rewritable.
const draw = loadOp('interface.draw');
const implement = loadOp('interface.implement');

test('interface.draw decides a realization mode for every region before it generates', () => {
  assert.match(draw.goal.en, /raster asset or code-native/);
  assert.ok(writeOf(draw, 'evidence').artifacts.includes('realization-map.json'),
    'the direction writes no realization map');
  assert.ok(proof(draw, 'realization-map'), 'no realization-map proof');

  // The classification is one rule in one step: what is raster, what is code.
  const rule = statesOnce(assert, draw, ['raster-asset', 'code-native'], { section: '$.steps', label: 'the realization classification' });
  assert.match(rule.text, /illustration|photography|texture/i, 'the raster side names what makes imagery authored');
  assert.match(rule.text, /cards|controls|icons|layout/i, 'the code-native side names what belongs to the DOM');
  statesOnce(assert, draw, ['flattened image'], { section: '$.steps', label: 'a screenshot of code-native UI is direction only' });

  // The generating step must come after the step that classified.
  const classify = draw.steps.findIndex((s) => /raster-asset/.test(s.action.en));
  const generate = draw.steps.findIndex((s) => /imagegen/i.test(s.action.en) && s.writes.includes('designSource'));
  assert.ok(classify >= 0 && generate > classify, `classification (step ${classify}) must precede generation (step ${generate})`);
});

test('interface.draw argues a prominent symbol before accepting it', () => {
  assert.ok(writeOf(draw, 'evidence').artifacts.includes('symbol-review.json'), 'the direction writes no symbol review');
  assert.ok(proof(draw, 'symbolic-integrity'));
  assert.ok(blocker(draw, 'SYMBOL_INTENT_UNRESOLVED'));
  const review = statesOnce(assert, draw, ['product concept', 'label'], { section: '$.steps', label: 'the symbol self-questioning' });
  for (const question of ['metaphor', 'audience', 'siblings', 'family', 'viewport'])
    assert.match(review.text, new RegExp(question, 'i'), `the symbol review should ask about ${question}`);
});

test('interface.draw generates the number of candidates the owner chose, not a number in prose', () => {
  assert.equal(draw.params.candidatesPerScreen.setBy, 'owner');
  assert.equal(draw.params.candidatesPerScreen.default, 1);
  assert.equal(draw.params.candidatesPerScreen.max, 3);
  statesOnce(assert, draw, ['params.candidatesPerScreen'], { section: '$.steps', label: 'candidates per screen' });
  assert.equal(JSON.stringify(draw.steps).match(/\b(one|two|three|\d+)[\s-]+candidates?\b/i), null,
    'a candidate count is restated as a literal instead of citing the param');
});

test('interface.implement realizes each region the way the direction said, and proves it', () => {
  const design = readOf(implement, 'design');
  assert.ok(design, 'no design read');
  assert.match(JSON.stringify(design), /raster-asset|code-native/, 'the design read does not carry the realization decision');

  const check = writeOf(implement, 'realizationCheck');
  assert.ok(check, 'interface.implement writes no realization check');
  assert.equal(check.path, 'E/realization-check.json');
  assert.equal(check.schema, 'starci/realization-check@1');
  assert.ok(proof(implement, 'realization-fidelity'));
  assert.ok(blocker(implement, 'REALIZATION_MODE_CONFLICT'));

  states(assert, implement, ['flatten', 'code-native'], { section: '$.steps' });
  states(assert, implement, ['css', 'asset'], { section: '$.steps' });
});

test('interface.implement owes an asset inventory with a declared shape', () => {
  const manifest = writeOf(implement, 'assetManifest');
  assert.equal(manifest.path, 'E/assets.json');
  assert.equal(manifest.schema, 'starci/asset-manifest@1');
  const coverage = proof(implement, 'asset-coverage');
  assert.ok(coverage, 'no asset-coverage proof');
  assert.match(coverage.requirement.en, /asset-manifest\.schema\.yaml/,
    'the proof must name the schema the file is measured against');
  // The deferral rule belongs to the step that produces assets, not to the write.
  statesOnce(assert, implement, ['defer', 'acceptance'], { section: '$.steps', label: 'an acceptance-critical asset is never deferred' });
});

test('the audit reads exactly what the implementation writes', () => {
  const audit = loadOp('interface.audit');
  const map = readOf(audit, 'realization-map');
  assert.match(map.path, /realization-check\.json/);
  const captures = readOf(audit, 'implementation-captures');
  for (const artifact of ['screens', 'runtime.json'])
    assert.ok(captures.path.includes(artifact), `the audit should read ${artifact} from interface.implement`);
  const written = writeOf(implement, 'evidence').artifacts.join(' ');
  for (const artifact of ['screens/**/*.png', 'runtime.json', 'measurements.json'])
    assert.ok(written.includes(artifact), `interface.implement should write ${artifact} for the audit`);
});
