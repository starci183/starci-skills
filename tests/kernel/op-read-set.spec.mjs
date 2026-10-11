import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { buildContext } from '../../scripts/context/pack.mjs';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';
import { loadOpGate } from '../../scripts/gates/read-digest.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const gate = loadOpGate({ base: ROOT });
const decidingOps = Object.entries(gate.opProofs)
  .filter(([, proofs]) => proofs.some((entry) => (entry?.proof ?? entry) === 'read-knowledge'))
  .map(([op]) => op);
const boundOps = [...new Set([...decidingOps, ...gate.readSet.alsoBound])];
const briefOf = (op) => parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'));
// The example catalog an authoring op files on purpose (docs.author) expands to its source files; they are the catalog, not the op's own READ.
const isCatalogRow = (row) => row.path.startsWith('examples/');
const isCatalogLine = (line) => line.includes(`${path.sep}examples${path.sep}`);
const promptOf = (op, contextPack) => buildOpPrompt({
  skillRoot: ROOT, contextPack,
  packet: { op, brief: `modules/ops/ops/${op}.yaml`, context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } },
});



for (const op of boundOps) {
  test(`${op}: its filed READ is its own knowledge, not a glob over all of knowledge/`, () => {
    const context = buildContext({ op, root: ROOT });
    assert.equal(context.error, undefined);
    const filed = context.mandatory.filter((row) => !isCatalogRow(row));
    assert.ok(filed.length <= gate.readSet.maxMandatoryFiles, `${filed.length} mandatory files`);
    const standard = (context.declaredReads.find((read) => read.id === 'standard')?.path ?? '');
    assert.doesNotMatch(standard, /\*/, 'the standard read names files, never a glob that pulls the whole tree into the prompt');
    assert.ok(context.mandatory.some((row) => row.path === 'knowledge/op-gate.yaml'));
    const schemas = filed.filter((row) => row.path.startsWith('modules/schemas/'));
    const cap = gate.readSet.maxSchemaFiles[op];
    if (cap !== undefined) assert.ok(schemas.length <= cap, `${schemas.length} schema files: ${schemas.map((row) => row.path).join(' ')}`);
  });

  test(`${op}: every knowledge file its READ step names is filed for it`, () => {
    const brief = briefOf(op);
    const step = brief.steps.find((entry) => String(entry.action?.en ?? '').includes('starci gate read'));
    if (!step) {
      assert.ok(!decidingOps.includes(op), 'a deciding op has a READ step that runs starci gate read');
      const globs = brief.reads.filter((read) => /(scripts|knowledge)\/[^ ]*\*/.test(String(read.path)));
      assert.deepEqual(globs.map((read) => read.id), [], 'an op without a READ step names its files, never a glob over scripts or knowledge');
      return;
    }
    const listed = step.action.en.includes('--knowledge')
      ? step.action.en.split('--knowledge')[1].split('--out')[0].replaceAll(/<[^>]*>/g, '') : '';
    const named = [...listed.matchAll(/knowledge\/[A-Za-z0-9_./-]+\.yaml/g)].map((hit) => hit[0]);
    const filed = new Set(buildContext({ op, root: ROOT }).mandatory.map((row) => row.path));
    for (const file of named) assert.ok(filed.has(file), `${file} is named by the READ step of ${op} but not filed`);
  });

  test(`${op}: the prompt that carries the read list stays within the declared budget`, () => {
    const prompt = promptOf(op, buildContext({ op, root: ROOT }));
    const own = prompt.split(String.fromCharCode(10)).filter((line) => !isCatalogLine(line)).join(String.fromCharCode(10));
    assert.ok(own.length <= gate.readSet.maxPromptBytes, `${own.length} bytes`);
  });
}
