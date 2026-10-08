import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';
import { buildContext } from '../../scripts/context/pack.mjs';
import { namedCalls, missingVerbs, opVerbsBound, opVerbsLines, opVerbsOfBrief } from '../../scripts/kernel/op-prompt-verbs.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OPS_DIR = path.join(ROOT, 'modules', 'ops', 'ops');
const ops = fs.readdirSync(OPS_DIR).filter((file) => file.endsWith('.yaml')).map((file) => file.replace(/\.yaml$/, ''));
const bound = opVerbsBound();
const textOf = (op) => fs.readFileSync(path.join(OPS_DIR, `${op}.yaml`), 'utf8');
const promptOf = (op) => buildOpPrompt({
  skillRoot: ROOT, contextPack: buildContext({ op, root: ROOT }),
  packet: { op, brief: `modules/ops/ops/${op}.yaml`, context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } },
});

test('the bound of the verbs block is declared in yaml', () => {
  assert.ok(bound.maxVerbs > 0 && bound.maxChars > 0 && bound.lineChars > 0);
  assert.ok(bound.standing.includes('kernel report'));
});

test('a verb the CLI catalog lacks is a defect: no op contract names one', () => {
  assert.deepEqual(missingVerbs('run starci gate no-such-verb --root <app>'), ['gate no-such-verb']);
  assert.deepEqual(missingVerbs('run starci gate read --root <app>'), []);
  for (const op of ops) assert.deepEqual(missingVerbs(textOf(op)), [], `${op} names a starci verb the catalog lacks`);
});

for (const op of ops) {
  test(`${op}: the verbs block lists every verb its contract names, within the declared bound`, () => {
    const block = opVerbsOfBrief(path.join(OPS_DIR, `${op}.yaml`));
    const text = block.join('\n');
    assert.ok(text.length <= bound.maxChars, `${text.length} characters`);
    assert.ok(block.length - 1 <= bound.maxVerbs, `${block.length - 1} verbs`);
    assert.ok(block.every((line) => line.length <= bound.lineChars), 'every line fits its bound');
    assert.doesNotMatch(text, / more: starci/, 'no verb of the contract is cut off');
    const listed = new Set(block.slice(1).map((line) => /^ {2}starci (\S+ \S+)/.exec(line)?.[1]));
    const group = (key) => key.split(' ')[0];
    for (const key of namedCalls(textOf(op)).keys()) {
      const standing = bound.standing.includes(key) || bound.omitGroups.includes(group(key));
      if (!standing && opVerbsLines(`starci ${key}`).length) assert.ok(listed.has(key), `${key} is named by ${op} but not listed`);
    }
  });
}

test('the prompt carries the block of the op and its size effect stays within the declared bound', () => {
  const prompt = promptOf('interface.draw');
  const block = opVerbsOfBrief(path.join(OPS_DIR, 'interface.draw.yaml')).join('\n');
  assert.ok(block.length > 0 && prompt.includes(block));
  assert.match(block, /starci work draw-render .*--out <out>/);
  assert.ok(block.length <= bound.maxChars);
  assert.ok(!promptOf('business.decide').includes('starci work draw-render'), 'an op is told only the verbs of its own contract');
});
