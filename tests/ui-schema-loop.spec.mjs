import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseYaml } from '../engine/yaml.mjs';
import { sha256 } from '../engine/digest.mjs';
import { putBundle } from '../scripts/lib/blob-lookup.mjs';
import { DRAW_LOOP_MISSING, LOOP_SCHEMA, loopCoverageFindings } from '../scripts/checks/draw-loop-coverage.mjs';

/**
 * The draw loop is a blob bundle (7ac4e610f): draw-loop.mjs finishLoop writes generation.loop = {round, sha256}
 * plus grammarSource / grammarUpgradeOwed beside it on a draw-loop-component part, and draw-loop-coverage.mjs
 * (DRAW_LOOP_MISSING) requires exactly that. work-ui-screen still allowed only loop = {path, round} with
 * additionalProperties:false, so no record could pass both `validate --strict` and the loop gate. This spec
 * validates the block finish emits under the schema (Ajv strict, as work-record-schemas.spec.mjs compiles it)
 * and runs the loop coverage check on the same record.
 */
const ROOT = path.resolve(import.meta.dirname, '..');
const SCHEMA = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'schemas', 'work-ui-screen.schema.yaml'), 'utf8'));
const EXAMPLE = path.join(ROOT, 'examples', 'todo-app-backend', '.starciwork', 'features', 'login', 'ui', 'sign-in', 'index.yaml');
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(SCHEMA);
const errorText = () => (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');

const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ui-schema-loop-')); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };

/** A ui record dir holding one drawn part, and a loop bundle (starci/draw-loop@1) that installed its bytes. */
function fixture(t) {
  const repo = tmp(t);
  const recordDir = path.join(repo, '.starciwork', 'features', 'login', 'ui', 'sign-in');
  const directions = path.join(recordDir, 'assets', 'directions');
  fs.mkdirSync(directions, { recursive: true });
  const part = 'assets/directions/SignInBase#sign-in-ready--1440x900--light.png';
  const bytes = Buffer.from(`ui-schema-loop part ${Date.now()} ${Math.random()}`);
  fs.writeFileSync(path.join(recordDir, part), bytes);
  const sha = sha256(bytes);
  const loopDir = path.join(repo, 'loop');
  fs.mkdirSync(loopDir);
  fs.writeFileSync(path.join(loopDir, 'loop.json'), JSON.stringify({ schema: LOOP_SCHEMA, rounds: [{ n: 1 }], outcome: 'passed', installed: [{ path: part, sha256: sha }] }));
  const bundle = putBundle(loopDir);
  const record = parseYaml(fs.readFileSync(EXAMPLE, 'utf8'));
  return { repo, recordDir, record, part, sha, bundle };
}

/** The asset entries draw-loop.mjs finishLoop pushes for a real-component part (draw-loop-component). */
const componentAssets = ({ part, sha, bundle }) => [
  { path: part, role: 'direction-content', breakpoint: 'desktop', theme: 'light', sha256: sha,
    generation: { tool: 'draw-render', mode: 'draw-loop-component', promptPath: 'assets/directions/SignInBase.prompt.txt', loop: { round: 2, sha256: bundle },
      grammarSource: 'claude-dist@0.4.1',
      grammarUpgradeOwed: { status: 'owed', package: '@starci/grammar', from: '0.3.0', to: '0.4.1', range: '^0.3.0', inRange: false,
        why: "the product's installed @starci/grammar@0.3.0 does not satisfy the drawing (it fails to type-check); 0.4.1 does" } } },
];

const withAssets = (record, assets) => ({ ...record, assets: [...record.assets, ...assets], ui: { ...record.ui, assets: [...record.ui.assets, ...assets] } });

test('the block finishLoop emits (loop {round, sha256} + grammarSource/grammarUpgradeOwed) validates and satisfies DRAW_LOOP_MISSING', (t) => {
  const f = fixture(t);
  const record = withAssets(f.record, componentAssets(f));
  assert.ok(validate(record), `the schema refuses the runtime's own loop block: ${errorText()}`);
  assert.deepEqual(loopCoverageFindings(f.recordDir, record, f.repo), []);
});

test('the html draw-loop part and a null grammarSource / no upgrade also validate', (t) => {
  const f = fixture(t);
  const html = { path: f.part, role: 'direction-content', breakpoint: 'desktop', theme: 'light', sha256: f.sha,
    generation: { tool: 'draw-render', promptPath: 'assets/directions/SignInBase.prompt.txt', mode: 'draw-loop', loop: { round: 1, sha256: f.bundle } } };
  assert.ok(validate(withAssets(f.record, [html])), errorText());
  assert.deepEqual(loopCoverageFindings(f.recordDir, withAssets(f.record, [html]), f.repo), []);
  const [c] = componentAssets(f);
  const bare = { ...c, generation: { ...c.generation, grammarSource: null } };
  delete bare.generation.grammarUpgradeOwed;
  assert.ok(validate(withAssets(f.record, [bare])), errorText());
  const nullRange = { ...c, generation: { ...c.generation, grammarUpgradeOwed: { ...c.generation.grammarUpgradeOwed, from: null, range: null, inRange: null } } };
  assert.ok(validate(withAssets(f.record, [nullRange])), errorText());
});

test('the pre-bundle {path, round} citation stays valid; anything else in loop is still refused', (t) => {
  const f = fixture(t);
  const [c] = componentAssets(f);
  const at = (loop) => withAssets(f.record, [{ ...c, generation: { ...c.generation, loop } }]);
  assert.ok(validate(at({ path: 'loop/loop.json', round: 1 })), errorText());
  assert.equal(validate(at({ round: 1 })), false, 'a loop citing neither a bundle nor a path');
  assert.equal(validate(at({ sha256: f.bundle })), false, 'a loop without its round');
  assert.equal(validate(at({ sha256: f.bundle, path: 'loop/loop.json', round: 1 })), false, 'both citation forms at once');
  assert.equal(validate(at({ sha256: f.bundle, round: 1, dir: 'round-1' })), false, 'additionalProperties stays closed');
  assert.equal(validate(at({ sha256: 'NOT-A-DIGEST', round: 1 })), false);
  const badOwed = withAssets(f.record, [{ ...c, generation: { ...c.generation, grammarUpgradeOwed: { ...c.generation.grammarUpgradeOwed, extra: 1 } } }]);
  assert.equal(validate(badOwed), false, 'grammarUpgradeOwed is closed too');
  // The loop gate still refuses the path form: only the bundle is proof the loop installed the bytes.
  assert.deepEqual([...new Set(loopCoverageFindings(f.recordDir, at({ path: 'loop/loop.json', round: 1 }), f.repo).map((x) => x.code))], [DRAW_LOOP_MISSING]);
});
