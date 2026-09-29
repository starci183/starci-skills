import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const config = require('./index.cjs');

test('the config is the approved dialect (HFS v2 decision 10, K22)', () => {
  assert.equal(config.printWidth, 120);
  assert.equal(config.tabWidth, 4);
  assert.equal(config.useTabs, false);
  assert.equal(config.semi, false);
  assert.equal(config.singleQuote, false);
  assert.equal(config.trailingComma, 'all');
});

test('data files keep the two-space convention of package.json and yaml', () => {
  const data = config.overrides.find((entry) => entry.files.includes('*.yaml'));
  assert.equal(data.options.tabWidth, 2);
  assert.ok(data.files.includes('*.json'));
});

test('the config sets only options prettier knows, and no plugin (a plugin is a second formatter)', () => {
  const known = new Set(['printWidth', 'tabWidth', 'useTabs', 'semi', 'singleQuote', 'trailingComma', 'bracketSpacing', 'arrowParens', 'endOfLine', 'overrides']);
  for (const key of Object.keys(config)) assert.ok(known.has(key), `unexpected option ${key}`);
  assert.equal('plugins' in config, false);
});

test('prettier itself accepts the config when it is installed', async (t) => {
  let prettier;
  try { prettier = await import('prettier'); } catch { t.skip('prettier is not installed in the runtime checkout'); return; }
  const out = await prettier.format('const a = {b:1,\n c:"x"};\nfunction f(){return a}', { ...config, parser: 'typescript' });
  assert.equal(out, 'const a = { b: 1, c: "x" }\nfunction f() {\n    return a\n}\n');
});
