// catalog.spec.mjs — the unified CLI catalog: loader/validator
// (scripts/cli/catalog.mjs) and generator (scripts/cli/gen-catalog.mjs,
// RT_CLI_CATALOG_DRIFT R198).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadCatalog, CATALOG_DIR } from '../../scripts/cli/catalog.mjs';
import { generateAll } from '../../scripts/cli/gen-catalog.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GEN = path.join(repoRoot, 'scripts', 'cli', 'gen-catalog.mjs');
const DRIFT = 'RT_CLI_CATALOG_DRIFT';

const GLOBAL_YAML = `flags:
  - {name: json, type: boolean}
  - {name: cwd, type: string}
  - {name: quiet, type: boolean}
  - {name: help, type: boolean}
  - {name: edition, type: enum, enum: [full]}
`;
const GROUP_YAML = `group: kernel\nsummary: kernel verbs\nowner: runtime\nsince: 1.0.0-alpha.4\n`;
const VERB = `group: kernel
verb: settle
owner: runtime
summary: settle a job
impl: {script: scripts/kernel/cli.mjs, args: [settle]}
flags: [{name: job, type: string, required: true}]
exit: {0: ok, 1: refused, 2: bad usage}
json: flag
examples: ['starci kernel settle --repo <p> --job <id>']
editions: [full]
since: 1.0.0-alpha.4
removed: ['starci api settle']
`;

const fixture = (edit) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-catalog-'));
  const put = (rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  put(`${CATALOG_DIR}/_global.yaml`, GLOBAL_YAML);
  put(`${CATALOG_DIR}/kernel/_group.yaml`, GROUP_YAML);
  put(`${CATALOG_DIR}/kernel/settle.yaml`, VERB);
  try { edit?.(put); return root; }
  catch (e) { fs.rmSync(root, { recursive: true, force: true }); throw e; }
};

const catalogErrors = (root) => {
  try { loadCatalog(root); return []; }
  catch (e) { assert.equal(e.code, 'catalog-invalid'); return e.errors; }
};

test('the real catalog loads: six groups planned or present, kernel verbs sorted', () => {
  const cat = loadCatalog(repoRoot);
  assert.equal(cat.schema, 'starci/cli-catalog@1');
  assert.deepEqual(cat.global.flags.map((f) => f.name), ['json', 'cwd', 'quiet', 'help', 'edition']);
  const kernel = cat.groups.find((g) => g.group === 'kernel');
  assert.ok(kernel, 'kernel group');
  assert.ok(kernel.verbs.length >= 55, 'every kernel verb catalogued');
  assert.deepEqual(kernel.verbs.map((v) => v.verb), [...kernel.verbs.map((v) => v.verb)].sort((a, b) => a.localeCompare(b)));
  assert.ok(kernel.verbs.every((v) => v.impl?.script === 'scripts/kernel/cli.mjs'), 'kernel impls go through cli.mjs');
});

test('a verb missing a required key is a catalog-invalid error', () => {
  const root = fixture((put) => put(`${CATALOG_DIR}/kernel/settle.yaml`, 'group: kernel\nverb: settle\n'));
  try {
    const errors = catalogErrors(root);
    assert.ok(errors.some((e) => /missing required key "impl"/.test(e)), JSON.stringify(errors));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a flag named profile is rejected', () => {
  const root = fixture((put) => put(`${CATALOG_DIR}/kernel/settle.yaml`, VERB.replace('{name: job, type: string, required: true}', '{name: profile, type: string}')));
  try {
    assert.ok(catalogErrors(root).some((e) => /flag named "profile" is rejected/.test(e)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('--edition must be exactly [full], in _global.yaml or anywhere', () => {
  const root = fixture((put) => put(`${CATALOG_DIR}/_global.yaml`, GLOBAL_YAML.replace('enum: [full]', 'enum: [full, lite]')));
  try {
    assert.ok(catalogErrors(root).some((e) => /--edition enum is exactly \[full\]/.test(e)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a duplicate verb name across files is rejected', () => {
  const root = fixture((put) => put(`${CATALOG_DIR}/kernel/settle-dup.yaml`, VERB.replace('removed:', 'removed:')));
  try {
    assert.ok(catalogErrors(root).some((e) => /duplicate verb "settle"/.test(e)), JSON.stringify(catalogErrors(root)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('an empty group directory is an error', () => {
  const root = fixture((put) => put(`${CATALOG_DIR}/debug/_group.yaml`, 'group: debug\nsummary: debug\nowner: runtime\nsince: 1.0.0-alpha.4\n'));
  try {
    assert.ok(catalogErrors(root).some((e) => /an empty group is an error/.test(e)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('an unknown global or flag key is rejected', () => {
  const root = fixture((put) => {
    put(`${CATALOG_DIR}/_global.yaml`, `${GLOBAL_YAML}bogus: true\n`);
    put(`${CATALOG_DIR}/kernel/settle.yaml`, VERB.replace('required: true}', 'required: true, alias: s}'));
  });
  try {
    const errors = catalogErrors(root);
    assert.ok(errors.some((e) => /unknown global key "bogus"/.test(e)), JSON.stringify(errors));
    assert.ok(errors.some((e) => /unknown flag key "alias"/.test(e)), JSON.stringify(errors));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the generator is deterministic and its outputs are in sync in the real tree', async () => {
  const a = await generateAll(repoRoot);
  const b = await generateAll(repoRoot);
  assert.deepEqual(a, b);
  assert.ok(a['packages/cli/src/catalog.generated.mjs'].startsWith('// GENERATED by scripts/cli/gen-catalog.mjs'));
  for (const [rel, text] of Object.entries(a)) {
    assert.equal(fs.readFileSync(path.join(repoRoot, rel), 'utf8'), text, `${rel} is drifted (run gen-catalog --write)`);
  }
  const run = spawnSync(process.execPath, [GEN, '--check'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(!run.stderr.includes(DRIFT), 'a synced tree reports no drift code');
});

test('--check on a temp copy flags a drifted output and passes a synced one', () => {
  const root = fixture();
  const run = (mode) => spawnSync(process.execPath, [GEN, mode, '--root', root], { encoding: 'utf8' });
  try {
    assert.equal(run('--check').status, 1, 'outputs absent → drift');
    assert.equal(run('--write').status, 0);
    assert.ok(fs.existsSync(path.join(root, 'packages/cli/src/catalog.generated.mjs')));
    assert.ok(fs.existsSync(path.join(root, 'docs/cli.md')));
    assert.equal(run('--check').status, 0, 'freshly written → in sync');
    const doc = path.join(root, 'docs/cli.md');
    fs.writeFileSync(doc, `${fs.readFileSync(doc, 'utf8')}\nhand edit\n`);
    const drift = run('--check');
    assert.equal(drift.status, 1);
    assert.ok(drift.stderr.includes(DRIFT), 'a drifted output names the code');
    assert.match(drift.stderr, /docs\/cli\.md/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
