import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const manifest = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/ops/ops/provision.ask.yaml'), 'utf8'));
const prose = JSON.stringify(manifest);

// A live Modules provision.ask sent its question as an Orca orchestration
// message, waited ten minutes for a reply nobody could give, and reported
// blocked. The contract said "wait as long as the contract lets you" and never
// said the ask is the op's own report with outcome ask.
test('provision.ask delivers its question as an ask outcome and never waits in-turn', () => {
  assert.match(prose, /report with outcome ask/, 'the ask is the report, served by serve-ask');
  assert.match(prose, /Never ask through an Orca\s+orchestration message/);
  assert.doesNotMatch(prose, /Wait as long as the/, 'no in-turn wait');
  assert.doesNotMatch(prose, /If the wait ends with no answer, report blocked/, 'an unanswered ask is the kernel wait, not a blocked report');
});
