// knowledge/ui topics are well-formed knowledge sources: schema keys, unique rule ids across the tree, every case
// carrying its observable cell, and each family index naming exactly the rule range its topic file publishes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const UI = path.join(ROOT, 'knowledge', 'ui');
const LAYERS = ['composition', 'presentation', 'proof'];
const read = (file) => parseYaml(fs.readFileSync(file, 'utf8'));
const topics = () => LAYERS.flatMap((layer) => fs.readdirSync(path.join(UI, layer)).filter((n) => n.endsWith('.yaml') && n !== 'index.yaml').map((n) => ({ layer, name: n, doc: read(path.join(UI, layer, n)) })));

test('every knowledge/ui topic is a well-formed knowledge source with unique rule ids and observable cases', () => {
  const schema = read(path.join(ROOT, 'modules', 'schemas', 'knowledge-source.schema.yaml'));
  const allowed = new Set(Object.keys(schema.properties));
  const ids = new Map();
  for (const { layer, name, doc } of topics()) {
    const label = `${layer}/${name}`;
    for (const key of schema.required) assert.ok(doc[key] !== undefined, `${label} has ${key}`);
    for (const key of Object.keys(doc)) assert.ok(allowed.has(key), `${label}: ${key} is not a knowledge-source property`);
    assert.equal(doc.family, layer, `${label} family`);
    for (const rule of doc.rules ?? []) {
      assert.ok(!ids.has(rule.id), `${label}: ${rule.id} is also in ${ids.get(rule.id)}`);
      ids.set(rule.id, label);
      assert.ok(rule.title && (rule.governs || rule.requirement), `${label} ${rule.id} has a title and governs`);
      const caseIds = new Set();
      for (const c of rule.cases ?? []) {
        assert.ok(!caseIds.has(c.id), `${label} ${rule.id} ${c.id} is duplicated`);
        caseIds.add(c.id);
        const cell = layer === 'proof' ? c.observe : layer === 'composition' ? c.assert : (c.render ?? c.assert ?? c.write);
        assert.ok(typeof cell === 'string' && cell.trim(), `${label} ${rule.id} ${c.id} carries its ${layer === 'proof' ? 'observe' : 'assert'} cell`);
      }
    }
  }
});

test('each family index lists every topic file and the rule range it publishes', () => {
  for (const layer of LAYERS) {
    const index = read(path.join(UI, layer, 'index.yaml'));
    const listed = new Set((index.topics ?? []).map((t) => t.path));
    for (const { name, doc } of topics().filter((t) => t.layer === layer)) {
      assert.ok(listed.has(name), `${layer}/index.yaml lists ${name}`);
      const entry = index.topics.find((t) => t.path === name);
      const range = typeof entry.rules === 'string' ? entry.rules.match(/^([A-Z0-9]+)-(\d+) to \1-(\d+)$/) : null;
      if (!range) continue;
      const published = (doc.rules ?? []).map((r) => r.id).filter((id) => id.startsWith(`${range[1]}-`));
      assert.ok(published.includes(`${range[1]}-${range[3]}`), `${layer}/${name} publishes ${range[1]}-${range[3]}`);
      assert.ok(!published.some((id) => Number(id.split('-').pop()) > Number(range[3])), `${layer}/index.yaml range for ${name} names its last rule`);
    }
  }
});

test('the owner UX/UI discipline rules exist and cite each other both ways', () => {
  const byId = new Map(topics().flatMap(({ layer, name, doc }) => (doc.rules ?? []).map((r) => [r.id, { rule: r, file: `${layer}/${name}` }])));
  for (const id of ['DISCIPLINE-1', 'DISCIPLINE-2', 'DISCIPLINE-3']) assert.equal(byId.get(id)?.file, 'composition/taste.yaml', id);
  assert.equal(byId.get('HIERARCHY-6')?.file, 'composition/hierarchy.yaml');
  assert.equal(byId.get('ACCENT-6')?.file, 'composition/accent.yaml');
  const text = (id) => (byId.get(id).rule.cases ?? []).map((c) => `${c.when} ${c.assert ?? c.observe ?? ''}`).join(' ');
  assert.match(text('TASTE-1'), /HIERARCHY-6/);
  assert.match(text('TASTE-5'), /ACCENT-6/);
  assert.match(text('TASTE-6'), /DISCIPLINE-2/);
  assert.match(text('TASTE-8'), /DISCIPLINE-3/);
  assert.match(text('ACCENT-2'), /tone="neutral"/, 'identity tiles are neutral (owner ruling 2026-09-27)');
  assert.match(text('ACCENT-6'), /--background/, 'the HeroUI default canvas');
  assert.match(text('DISCIPLINE-1'), /Alert/);
  assert.match(text('DISCIPLINE-1'), /Meter/);
  const index = read(path.join(ROOT, 'knowledge', 'index.yaml'));
  assert.match(index.branches.find((b) => b.id === 'ui').use, /DISCIPLINE-1\.\.3/);
});
