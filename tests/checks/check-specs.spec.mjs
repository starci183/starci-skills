import test from 'node:test';
import assert from 'node:assert/strict';
import { specFacts, specFindings } from '../../scripts/checks/check-specs.mjs';

// SPEC_ASSERTS_BEHAVIOUR: a spec drives the exported function; a skip says why.
const run = (text, rel = 'tests/x/a.spec.mjs') => specFindings([{ rel, text }]).map((f) => [f.code, f.line]);
const HEAD = "import fs from 'node:fs';\nimport assert from 'node:assert/strict';\nimport test from 'node:test';\n";

test('a spec that reads the text of a runtime source through import.meta is flagged', () => {
  assert.deepEqual(run(`${HEAD}test('x', () => {\n  const src = fs.readFileSync(new URL('../../scripts/kernel/cli.mjs', import.meta.url), 'utf8');\n  assert.match(src, /wakePrompt/);\n});\n`), [['RT_SPEC_ASSERTS_SOURCE_TEXT', 5]]);
});

test('a source read through a repository-root constant is flagged; a file the spec writes into its temp directory is not', () => {
  assert.deepEqual(run(`${HEAD}import path from 'node:path';\nconst ROOT = path.resolve(import.meta.dirname, '..', '..');\ntest('x', () => {\n  assert.match(fs.readFileSync(path.join(ROOT, 'scripts', 'kernel', 'verbs', 'settle.mjs'), 'utf8'), /x/);\n});\n`), [['RT_SPEC_ASSERTS_SOURCE_TEXT', 7]]);
  assert.deepEqual(run(`${HEAD}import path from 'node:path';\ntest('x', () => {\n  const root = fs.mkdtempSync('p');\n  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 1;');\n  assert.equal(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), 'export const a = 1;');\n});\n`), []);
});

test('reading a data fixture or a spec of the repository is not reading implementation text', () => {
  assert.deepEqual(run(`${HEAD}test('x', () => {\n  fs.readFileSync(new URL('./probe.fixture', import.meta.url), 'utf8');\n  fs.readFileSync(new URL('../../modules/kernel/failure-codes.yaml', import.meta.url), 'utf8');\n});\n`), []);
});

test('a skip without a reason is flagged; one that names what is missing is not', () => {
  assert.deepEqual(run(`${HEAD}test('a', { skip: process.platform !== 'win32' }, () => {});\n`), [['RT_SPEC_SKIP_UNEXPLAINED', 4]]);
  assert.deepEqual(run(`${HEAD}test('a', (t) => { t.skip(); });\n`), [['RT_SPEC_SKIP_UNEXPLAINED', 4]]);
  assert.deepEqual(run(`${HEAD}test('a', { skip: ok ? false : 'prettier is not installed: npm ci provides it' }, () => {});\ntest('b', (t) => { t.skip(\`no junction: \${e}\`); });\ntest('c', { skip: false }, () => {});\n`), []);
});

test('a skip whose value comes from a gate helper that builds a reason is explained', () => {
  assert.deepEqual(run(`${HEAD}const gateOf = () => ({ skip: 'needs a live Orca' });\nconst gate = gateOf();\ntest('a', { skip: gate.skip }, () => {});\n`), []);
  assert.equal(specFacts(`${HEAD}test('a', { skip: gate.skip }, () => {});\n`).skips[0].explained, false);
});
