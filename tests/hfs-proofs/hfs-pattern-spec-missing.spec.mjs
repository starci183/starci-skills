// proves: BE_PATTERN_SPEC_MISSING@lite
// proves: BE_PATTERN_SPEC_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { patternSpecFindings } from '../../scripts/hfs/rules/event-bus.mjs';
import { liteProofLaneFindings } from '../../scripts/hfs/rules/lite-proof-lane.mjs';

const SPEC = 'be/src/tests/integration/projection/proofs.integration-spec.ts';
const FIRST = "test('projection/recompute-is-idempotent: repeated input preserves the result', () => {});\n";
const SECOND = "it('projection/replay-rebuilds: replay restores the view', () => {});\n";
const repo = (edition) => ({ edition, sides: { be: { patterns: ['projection'] } } });

function fixture(t, files) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-pattern-spec-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { repoRoot, files: Object.keys(files) };
}

test('full rejects a declared pattern with a missing scenario in its integration spec', (t) => {
  const input = { ...fixture(t, { [SPEC]: FIRST }), repo: repo('full') };
  assert.deepEqual(patternSpecFindings(input).map((finding) => [finding.code, finding.scenario]), [
    ['BE_PATTERN_SPEC_MISSING', 'projection/replay-rebuilds'],
  ]);
});

test('full accepts all declared pattern scenarios in an integration spec', (t) => {
  const input = { ...fixture(t, { [SPEC]: FIRST + SECOND }), repo: repo('full') };
  assert.deepEqual(patternSpecFindings(input), []);
});

test('full accepts declared pattern scenarios in its e2e proof lane', (t) => {
  const files = { 'be/src/tests/e2e/projection/proofs.e2e-spec.ts': FIRST + SECOND };
  const input = { ...fixture(t, files), repo: repo('full') };
  assert.deepEqual(patternSpecFindings(input), []);
});

test('lite rejects a declared pattern with a missing scenario in its integration spec', (t) => {
  const input = { ...fixture(t, { [SPEC]: FIRST }), repo: repo('lite') };
  assert.deepEqual(liteProofLaneFindings(input).map((finding) => [finding.code, finding.scenario]), [
    ['BE_PATTERN_SPEC_MISSING', 'projection/replay-rebuilds'],
  ]);
});

test('lite accepts all declared pattern scenarios in its integration spec', (t) => {
  const input = { ...fixture(t, { [SPEC]: FIRST + SECOND }), repo: repo('lite') };
  assert.deepEqual(liteProofLaneFindings(input), []);
});

test('lite rejects e2e specs as evidence of declared pattern scenarios', (t) => {
  const files = { 'be/src/tests/e2e/projection/proofs.e2e-spec.ts': FIRST + SECOND };
  const input = { ...fixture(t, files), repo: repo('lite') };
  assert.deepEqual(liteProofLaneFindings(input).filter((finding) => finding.code === 'BE_PATTERN_SPEC_MISSING')
    .map((finding) => finding.scenario), ['projection/recompute-is-idempotent', 'projection/replay-rebuilds']);
});
