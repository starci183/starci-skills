// The `files:` tree of a back-end pattern topic (knowledge/patterns/be/*.yaml) is the single source of what the pattern places and
// of the slots and rules that judge it (and of the files `hfs add` generates). This spec holds each tree to the manifests: every
// slot id exists, every rule code is in the catalog, every scenario a tree names is in ruleParams.be.patternScenarios, and every
// path variable is a plain `<name>` placeholder.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { loadRuleCatalog, loadSlotManifest, ruleParams } from '../../scripts/hfs/slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PATTERNS = path.join(ROOT, 'knowledge', 'patterns', 'be');
const manifest = loadSlotManifest();
const slotIds = new Set(manifest.slots.map((slot) => slot.id));
const codes = new Set(loadRuleCatalog({ manifest }).rules.flatMap((rule) => rule.failureCodes ?? []));
const scenarios = ruleParams(manifest, 'be').patternScenarios;
const scenarioIds = new Set(Object.entries(scenarios).flatMap(([pattern, list]) => list.map((id) => `${pattern}/${id}`)));

const topics = fs.readdirSync(PATTERNS).filter((name) => name.endsWith('.yaml')).map((name) => ({ name, doc: parse(fs.readFileSync(path.join(PATTERNS, name), 'utf8')) })).filter((topic) => Array.isArray(topic.doc?.files));

test('the pattern topics that carry a files tree are the five event, queue, job, projection and reactor topics', () => {
  assert.deepEqual(topics.map((topic) => topic.name).sort(), ['event-bus.yaml', 'jobs.yaml', 'projections.yaml', 'queues.yaml', 'reactors.yaml']);
});

for (const { name, doc } of topics) {
  test(`${name}: every file of the tree names an existing slot, catalogued rule codes and known scenarios`, () => {
    const seen = new Set();
    for (const file of doc.files) {
      assert.ok(slotIds.has(file.slot), `${file.path}: slot ${file.slot} is not in knowledge/hfs/slots.yaml`);
      assert.ok(!seen.has(file.path), `${file.path} is listed twice`);
      seen.add(file.path);
      for (const code of file.rules ?? []) assert.ok(codes.has(code), `${file.path}: rule code ${code} is not in the rule catalog`);
      for (const id of String(file.spec ?? '').split(',').map((part) => part.trim()).filter((part) => part && !part.includes('/src/') && !part.startsWith('src/'))) {
        assert.ok(scenarioIds.has(id), `${file.path}: scenario ${id} is not in ruleParams.be.patternScenarios`);
      }
      assert.ok(!/<[^>]*[^A-Za-z0-9>-][^>]*>/.test(file.path.replace(/<epochMs13>/g, '')), `${file.path}: path variables are plain <name> placeholders`);
    }
  });

  test(`${name}: every rule of the topic cites catalogued failure codes and an example that exists`, () => {
    const examples = new Set(fs.readdirSync(path.join(ROOT, 'knowledge', 'code-examples', 'backend')));
    for (const rule of doc.rules) {
      for (const code of rule.verification?.automated ?? []) assert.ok(codes.has(code), `${rule.id}: ${code} is not in the rule catalog`);
      for (const id of rule.relatedExamples ?? []) assert.ok(examples.has(id), `${rule.id}: example ${id} does not exist`);
    }
  });
}
