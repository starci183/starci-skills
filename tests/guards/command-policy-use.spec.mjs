// command-policy-use.spec.mjs - every R223 remedy names a real catalog verb and every public write verb has a raw-command route.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'command-policy.yaml'), 'utf8'));
const VERB = /\bstarci\s+([a-z][a-z0-9-]*)\s+([a-z][a-z0-9-]*)\b/g;
const NO_RAW_EQUIVALENT = Object.freeze([
  'worker', 'harness', 'task', 'smoke', 'machine',
  'guard', 'runtime', 'workflow', 'kernel', 'supervisor',
]);
const OWNER_ONLY_USE = new Set([
  'raw-tools.shutdown.use', 'raw-tools.reboot.use',
  'raw-tools.curl.use', 'raw-tools.wget.use', 'raw-tools.ssh.use', 'raw-tools.scp.use',
]);

const stringsOf = (value, key = '', out = []) => {
  if (typeof value === 'string') out.push({ key, text: value });
  else if (Array.isArray(value)) value.forEach((item, index) => stringsOf(item, `${key}[${index}]`, out));
  else if (value && typeof value === 'object') {
    for (const [name, item] of Object.entries(value)) stringsOf(item, key ? `${key}.${name}` : name, out);
  }
  return out;
};

const pairsOf = (text) => [...String(text).matchAll(VERB)].map((match) => `${match[1]} ${match[2]}`);
const catalogHas = (pair) => {
  const [group, verb] = pair.split(' ');
  return Boolean(CATALOG.groups?.[group]?.verbs?.[verb]);
};

test('every command-policy use points at catalog verbs, except commands that stay owner-only', () => {
  assert.deepEqual(POLICY.runtime, ['starci']);
  assert.equal(Object.hasOwn(POLICY, 'node-scripts'), false);
  const entries = stringsOf(POLICY).filter(({ key }) => key.endsWith('.use') || key === 'use');
  assert.ok(entries.length >= 40, `expected the policy remedies, got ${entries.length}`);
  for (const entry of entries) {
    const pairs = pairsOf(entry.text);
    if (!OWNER_ONLY_USE.has(entry.key)) assert.ok(pairs.length, `${entry.key} has no starci <group> <verb>: ${entry.text}`);
    for (const pair of pairs) assert.ok(catalogHas(pair), `${entry.key} names missing catalog verb ${pair}`);
  }

  // Also inspect the policy sections whose prose carries routes beside `use` values.
  const policyText = stringsOf({ release: POLICY.release, git: POLICY.git, npm: POLICY.npm, rawTools: POLICY['raw-tools'] });
  for (const entry of policyText) for (const pair of pairsOf(entry.text)) assert.ok(catalogHas(pair), `${entry.key} names missing catalog verb ${pair}`);
});

test('every non-read catalog verb with a non-owner role is reachable from policy or explicitly runtime-internal', () => {
  const named = new Set(stringsOf(POLICY).flatMap(({ text }) => pairsOf(text)));
  const missing = [];
  for (const [group, groupEntry] of Object.entries(CATALOG.groups ?? {})) {
    for (const [verb, entry] of Object.entries(groupEntry.verbs ?? {})) {
      if (!entry.effect || entry.effect === 'read') continue;
      if (!(entry.roles ?? []).some((role) => role !== 'owner')) continue;
      if (NO_RAW_EQUIVALENT.includes(group)) continue;
      if (!named.has(`${group} ${verb}`)) missing.push(`${group} ${verb}`);
    }
  }
  assert.deepEqual(missing, []);
});
