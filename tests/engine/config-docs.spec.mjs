import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONFIG_BLOCKS, CONFIG_KEY_TREE, DEBUG_LOOP_DEFAULTS } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const read = (file) => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const shape = () => read('docs/config-format.md').split(/^## /m).find((section) => section.startsWith('Shape'));
const documented = () => new Set([...shape().matchAll(/^- `([A-Za-z]+)(?:[.`])/gm)].map((match) => match[1]));

test('every block config.example.yaml sets is a block the validator accepts', () => {
  const example = Object.keys(parseYaml(read('config.example.yaml')));
  assert.deepEqual(example.filter((key) => !CONFIG_BLOCKS.includes(key)), []);
});

test('every block docs/config-format.md documents is accepted and every accepted block is documented', () => {
  const docs = documented();
  assert.deepEqual([...docs].filter((key) => !CONFIG_BLOCKS.includes(key)), [], 'documented but refused');
  assert.deepEqual(CONFIG_BLOCKS.filter((key) => !docs.has(key) && !new RegExp(String.raw`^#+ .*\b${key}\b|^\| \`${key}\``, 'm').test(read('docs/config-format.md'))), [], 'accepted but undocumented');
});

test('the debugLoop defaults the docs and the example state are the values the validator reads', () => {
  const { interval, worktreeLimit } = DEBUG_LOOP_DEFAULTS;
  const example = parseYaml(read('config.example.yaml')).debugLoop;
  assert.deepEqual(example, { interval, worktreeLimit });
});

const bulletOf = (block) => {
  const text = shape();
  const start = text.search(new RegExp(String.raw`^- \`${block}\``, 'm'));
  const rest = text.slice(start + 1);
  const next = rest.search(/^- `/m);
  return start < 0 ? '' : text.slice(start, next < 0 ? undefined : start + 1 + next);
};

test('every key a block accepts is named in docs/config-format.md and every key its example sets or its docs brace is accepted', () => {
  const doc = read('docs/config-format.md');
  const example = parseYaml(read('config.example.yaml'));
  for (const [block, keys] of Object.entries(CONFIG_KEY_TREE)) {
    const where = bulletOf(block) || doc;
    assert.deepEqual(keys.filter((key) => !new RegExp(String.raw`\b${key}\b`).test(where)), [], `${block}: accepted but undocumented`);
    const set = example[block] && typeof example[block] === 'object' && !Array.isArray(example[block]) ? Object.keys(example[block]) : [];
    assert.deepEqual(set.filter((key) => !keys.includes(key)), [], `${block}: set in the example but refused`);
    const braces = [...bulletOf(block).matchAll(/\{([^{}`]*)\}/g)].flatMap((match) => match[1].split(',').map((part) => part.trim().replace(/\?$/, '').split(':')[0]));
    assert.deepEqual(braces.filter((key) => /^[a-zA-Z]+$/.test(key) && !keys.includes(key) && !['pool', 'role', 'tier'].includes(key)), [], `${block}: documented in braces but refused`);
  }
});
