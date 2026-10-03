// The `files:` tree of a back-end pattern topic (knowledge/patterns/be/*.yaml) is the single source of what the pattern places and
// of the rules that judge it (and of the files `starci app add` generates). The slot of each entry is derived from its path
// (scripts/hfs/derived-fields.mjs, RT_GENERATED_BLOCK_STALE). This spec holds each tree to the manifests: every rule code is in the catalog, every scenario a tree names is in ruleParams.be.patternScenarios, and every
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
const catalog = loadRuleCatalog({ manifest }).rules;
const codes = new Set([...catalog.flatMap((rule) => rule.failureCodes ?? []), ...catalog.map((rule) => rule.id)]);
const scenarios = ruleParams(manifest, 'be').patternScenarios;
const scenarioIds = new Set(Object.entries(scenarios).flatMap(([pattern, list]) => list.map((id) => `${pattern}/${id}`)));

const topics = fs.readdirSync(PATTERNS).filter((name) => name.endsWith('.yaml')).map((name) => ({ name, doc: parse(fs.readFileSync(path.join(PATTERNS, name), 'utf8')) })).filter((topic) => Array.isArray(topic.doc?.files));

test('the topics that carry a files tree are the kind topics (api, cli, reactors, jobs, saga, webhooks, realtime) and the module-family topics (domain, event-bus, queues, projections)', () => {
  assert.deepEqual(topics.map((topic) => topic.name).sort(), ['api.yaml', 'cli.yaml', 'domain.yaml', 'event-bus.yaml', 'jobs.yaml', 'projections.yaml', 'queues.yaml', 'reactors.yaml', 'realtime.yaml', 'saga.yaml', 'webhooks.yaml']);
});

for (const { name, doc } of topics) {
  test(`${name}: every file of the tree names catalogued rule codes and known scenarios (its slot is derived: scripts/hfs/derived-fields.mjs)`, () => {
    const seen = new Set();
    for (const file of doc.files) {
      assert.ok(!seen.has(file.path), `${file.path} is listed twice`);
      seen.add(file.path);
      for (const code of file.rules ?? []) assert.ok(codes.has(code), `${file.path}: rule code ${code} is not in the rule catalog`);
      for (const id of String(file.spec ?? '').split(',').map((part) => part.trim()).filter((part) => part && !part.includes('/src/') && !part.startsWith('src/'))) {
        assert.ok(scenarioIds.has(id), `${file.path}: scenario ${id} is not in ruleParams.be.patternScenarios`);
      }
      assert.ok(!/<[^>]*[^A-Za-z0-9>-][^>]*>/.test(file.path.replace(/<epochMs13>/g, '')), `${file.path}: path variables are plain <name> placeholders`);
    }
  });

  test(`${name}: every rule of the topic cites an example that exists (its automated codes are derived from its hfsRules)`, () => {
    const examples = new Set(fs.readdirSync(path.join(ROOT, 'knowledge', 'code-examples', 'backend')));
    for (const rule of doc.rules) {
      for (const id of rule.relatedExamples ?? []) assert.ok(examples.has(id), `${rule.id}: example ${id} does not exist`);
    }
  });
}
