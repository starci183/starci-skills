// A list flag takes the values the way the op contracts write them: `--knowledge a b c` (every following token that is no option), as well as the repeated `--knowledge a --knowledge b`.
// Registry: contract-teaches-a-form-the-cli-refuses (gate read: "too many positional arguments").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateArgs } from '../../packages/cli/src/validate-args.mjs';
import { loadCatalog } from '../../scripts/cli/catalog.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const verbOf = (group, name) => loadCatalog(skillRoot).groups.find((g) => g.group === group).verbs.find((v) => v.verb === name);
const gateRead = verbOf('gate', 'read');

test('a list flag takes every following non-option token as one more value', () => {
  const parsed = validateArgs(['--root', 'app', '--touch', 'a.yaml', 'b.yaml', '--knowledge', 'k1.yaml', 'k2.yaml', 'k3.yaml', '--out', 'x.json'], gateRead);
  assert.equal(parsed.ok, true, parsed.error);
  assert.deepEqual(parsed.values.knowledge, ['k1.yaml', 'k2.yaml', 'k3.yaml']);
  assert.deepEqual(parsed.values.touch, ['a.yaml', 'b.yaml']);
  assert.deepEqual(parsed.localArgs, ['--root', 'app', '--touch', 'a.yaml', '--touch', 'b.yaml', '--knowledge', 'k1.yaml', '--knowledge', 'k2.yaml', '--knowledge', 'k3.yaml', '--out', 'x.json'],
    'the handler receives the repeated form');
});

test('the repeated form and the = form are unchanged', () => {
  const parsed = validateArgs(['--knowledge', 'k1.yaml', '--knowledge=k2.yaml', 'k3.yaml'], gateRead);
  assert.equal(parsed.ok, false, 'a bare token after an =-form value is still a positional of a verb with none');
  const repeated = validateArgs(['--knowledge', 'k1.yaml', '--knowledge', 'k2.yaml'], gateRead);
  assert.deepEqual(repeated.values.knowledge, ['k1.yaml', 'k2.yaml']);
});

test('every `starci gate read` command an op contract teaches parses', () => {
  const dir = path.join(skillRoot, 'modules', 'ops', 'ops');
  const taught = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).flatMap((f) => [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/starci gate read ((?:--(?:root|touch|read|knowledge|out)\s+\S+\s*)+)/g)].map((m) => m[1]));
  assert.ok(taught.length > 10, 'the contracts teach the command');
  for (const text of taught) {
    const tokens = text.trim().split(/\s+/).map((t) => t.replace(/^\$STARCI_JOB_SCRATCH/, 'scratch'));
    const parsed = validateArgs(tokens, gateRead);
    assert.equal(parsed.ok, true, `${text}: ${parsed.error}`);
  }
});
