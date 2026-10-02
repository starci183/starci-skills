import test from 'node:test';
import assert from 'node:assert/strict';
import { envFacts, envFindings, parseCatalog } from '../../scripts/checks/check-env.mjs';

// ENV_CATALOGUED: every environment variable is catalogued and read through one owner.
const catalog = (names) => ({ reader: 'scripts/lib/env.mjs', variables: Object.fromEntries(names.map((n) => [n, { purpose: 'a variable', kind: 'config' }])) });
const run = (files, names) => envFindings(files, catalog(names)).map((f) => [f.code, f.path]);

test('a name absent from the catalog is flagged wherever it is read or named', () => {
  assert.deepEqual(run([
    { rel: 'scripts/a.mjs', text: "export const a = (env = process.env) => env.STARCI_NEW;\n" },
    { rel: 'scripts/b.mjs', text: "export const b = { STARCI_OTHER: '1' };\nexport const c = 'STARCI_THIRD';\n" },
  ], ['STARCI_NEW']), [['RT_ENV_UNCATALOGUED', 'scripts/b.mjs'], ['RT_ENV_UNCATALOGUED', 'scripts/b.mjs']]);
});

test('a catalogued name read from an injected env passes; the same name from process.env outside the owner is flagged', () => {
  assert.deepEqual(run([{ rel: 'scripts/a.mjs', text: "export const a = (env) => env.STARCI_ROOT;\n" }], ['STARCI_ROOT']), []);
  assert.deepEqual(run([{ rel: 'scripts/a.mjs', text: "export const a = () => process.env.STARCI_ROOT;\nexport const b = (name) => process.env[name];\n" }], ['STARCI_ROOT']),
    [['RT_ENV_READ_OUTSIDE_OWNER', 'scripts/a.mjs'], ['RT_ENV_READ_OUTSIDE_OWNER', 'scripts/a.mjs']]);
});

test('the owner module reads process.env by name; process.env as a whole and writes are not reads', () => {
  assert.deepEqual(run([
    { rel: 'scripts/lib/env.mjs', text: "export const readEnv = (name, env = process.env) => env[name];\nexport const root = () => process.env.STARCI_ROOT;\n" },
    { rel: 'scripts/a.mjs', text: "import { spawnSync } from 'node:child_process';\nexport const run = () => spawnSync('x', [], { env: { ...process.env, STARCI_ROOT: '1' } });\nprocess.env.STARCI_ROOT = '2';\ndelete process.env.STARCI_ROOT;\n" },
  ], ['STARCI_ROOT']), []);
});

test('production code branching on the test runner is flagged outside the owner', () => {
  assert.deepEqual(run([
    { rel: 'scripts/a.mjs', text: "export const a = (env) => Boolean(env.NODE_TEST_CONTEXT);\n" },
    { rel: 'scripts/lib/env.mjs', text: "export const isSpecRun = (env = process.env) => Boolean(env.NODE_TEST_CONTEXT);\n" },
  ], ['NODE_TEST_CONTEXT']), [['RT_TEST_ENV_IN_PRODUCTION', 'scripts/a.mjs']]);
});

test('a catalog entry no source reads is stale; an entry without a purpose or kind is refused; specs are not judged', () => {
  assert.deepEqual(run([{ rel: 'scripts/a.mjs', text: 'export const a = 1;\n' }], ['STARCI_GONE']), [['RT_ENV_STALE_ENTRY', 'modules/schemas/env.yaml']]);
  const bad = { reader: 'scripts/lib/env.mjs', variables: { STARCI_X: { purpose: '', kind: 'nope' } } };
  assert.equal(envFindings([{ rel: 'scripts/a.mjs', text: "export const a = (env) => env.STARCI_X;\n" }], bad).length, 1);
  assert.deepEqual(run([{ rel: 'tests/a.spec.mjs', text: "process.env.STARCI_UNKNOWN = '1';\nexport const x = process.env.STARCI_UNKNOWN;\n" }], []), []);
});

test('lowercase properties of an env object are not variables; parseCatalog reads variables and reader', () => {
  assert.deepEqual(envFacts("export const f = (env) => env.width + env.cache + env.STARCI_A;\n").reads.map((r) => r.name), ['STARCI_A']);
  assert.deepEqual(parseCatalog('reader: scripts/lib/env.mjs\nvariables:\n  STARCI_A: {purpose: p, kind: config}\n'), { reader: 'scripts/lib/env.mjs', variables: { STARCI_A: { purpose: 'p', kind: 'config' } } });
});
