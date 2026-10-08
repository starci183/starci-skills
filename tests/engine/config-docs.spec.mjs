import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONFIG_BLOCKS, DEBUG_LOOP_DEFAULTS } from '../../engine/config.mjs';
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
  assert.ok(read('config.example.yaml').includes(`shipped default ${interval});`));
  assert.ok(read('config.example.yaml').includes(`(shipped default ${worktreeLimit})`));
  assert.ok(read('docs/config-format.md').includes(`shipped default \`${interval}\``));
  assert.ok(read('docs/config-format.md').includes(`(shipped default ${worktreeLimit})`));
});
