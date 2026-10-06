// hfs-slots-runtime.spec.mjs - the one HFS loader (scripts/hfs/slots.mjs) for a manifest of kind runtime: the runtime
// repository's own standard knowledge/hfs/runtime-slots.yaml and its hfs.json, held to their JSON Schemas
// (modules/schemas/hfs-slots.schema.yaml, hfs-repo.schema.yaml), and the product manifest left exactly as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { HFS_MANIFEST_FILE, HfsSlotsError, RUNTIME_MANIFEST_FILE, createSlotResolver, loadSlotManifest, readRepoDeclaration, resolveRepoDeclaration, ruleParams } from '../../scripts/hfs/slots.mjs';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { slotAllowsFindings } from '../../scripts/hfs/runtime-rules/slot-allows.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const Ajv2020 = (() => { const loaded = createRequire(import.meta.url)('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const ajv = new Ajv2020({ strict: false, allErrors: true, logger: false });
const schema = (name) => ajv.compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'schemas', name), 'utf8')));
const validateManifest = schema('hfs-slots.schema.yaml');
const validateDeclaration = schema('hfs-repo.schema.yaml');
const RUNTIME_TEXT = fs.readFileSync(path.join(ROOT, RUNTIME_MANIFEST_FILE), 'utf8');
const runtimeManifest = () => loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });
const refused = (fn, code) => assert.throws(fn, (error) => error instanceof HfsSlotsError && error.code === code);
const edited = (edit) => { const doc = parseYaml(RUNTIME_TEXT); edit(doc); return JSON.stringify(doc); };

test('the runtime manifest loads as kind runtime and its schema accepts it; the product manifest is still kind app', () => {
  const m = runtimeManifest();
  assert.equal(m.kind, 'runtime');
  assert.equal(m.major, 1);
  assert.equal(validateManifest(parseYaml(RUNTIME_TEXT)), true, JSON.stringify(validateManifest.errors));
  const product = loadSlotManifest({ root: ROOT, file: path.join(ROOT, HFS_MANIFEST_FILE) });
  assert.equal(product.kind, undefined, 'knowledge/hfs/slots.yaml carries no kind: app is the default');
  assert.equal(validateManifest(parseYaml(fs.readFileSync(path.join(ROOT, HFS_MANIFEST_FILE), 'utf8'))), true);
  assert.equal(ruleParams(m, 'runtime').fileLines.soft, 500);
  refused(() => ruleParams(m, 'be'), 'HFS_MANIFEST_INVALID');
});

test('a runtime manifest with sides, a product slot id, an unknown tier or the deleted pending key is refused', () => {
  for (const [name, edit] of [
    ['sides', (d) => { d.sides = { be: { reads: [] }, fe: { reads: [] } }; }],
    ['product slot id', (d) => { d.slots[0].id = 'app.declaration'; }],
    ['unknown tier', (d) => { d.slots.find((s) => s.id === 'runtime.lib').tier = 'feature'; }],
    ['pending key', (d) => { d.pending = []; }],
    ['generated without generator', (d) => { delete d.slots.find((s) => s.tracked === 'generated').generatedBy; }],
    ['schema major', (d) => { d.version = '2.0.0'; }],
  ]) {
    const text = edited(edit);
    refused(() => loadSlotManifest({ text }), 'HFS_MANIFEST_INVALID');
    if (name !== 'schema major' && name !== 'unknown tier') assert.equal(validateManifest(JSON.parse(text)), false, `the schema accepted: ${name}`);
  }
});

test('hfs.json of kind runtime resolves to the runtime profile; its schema accepts it and refuses sides', () => {
  const m = runtimeManifest();
  const repo = readRepoDeclaration(m, ROOT);
  assert.deepEqual([repo.kind, repo.profile, repo.project, repo.apps.length], ['runtime', 'runtime', 'starci', 0]);
  assert.equal(validateDeclaration(JSON.parse(fs.readFileSync(path.join(ROOT, 'hfs.json'), 'utf8'))), true);
  assert.equal(validateDeclaration({ hfs: 1, kind: 'runtime', project: 'starci', sides: {} }), false);
  refused(() => resolveRepoDeclaration(m, { hfs: 1, kind: 'runtime', project: 'starci', sides: {} }), 'HFS_DECLARATION_INVALID');
  refused(() => resolveRepoDeclaration(m, { hfs: 2, kind: 'runtime', project: 'starci' }), 'HFS_MANIFEST_MAJOR_MISMATCH');
  const product = loadSlotManifest({ root: ROOT });
  refused(() => resolveRepoDeclaration(product, { hfs: 2, kind: 'runtime', project: 'starci' }), 'HFS_DECLARATION_INVALID');
});

test('the runtime resolver: slots, tiers, owners, the forbidden current paths and a runtime owner imported file by file', () => {
  const m = runtimeManifest();
  const r = createSlotResolver(m, resolveRepoDeclaration(m, { hfs: 1, kind: 'runtime', project: 'starci' }));
  assert.equal(r.tierOf('scripts/api/orca/worker-start.mjs'), 'api');
  assert.equal(r.classifyPath('scripts/api/orca/worker-start.mjs').bindings.system, 'orca');
  assert.equal(r.tierOf('scripts/kernel/verbs/settle.mjs'), 'kernel', 'a verb inherits the kernel owner');
  assert.equal(r.tierOf('scripts/lib/clip.mjs'), 'base');
  assert.equal(r.classifyPath('packages/hfs/runtime/scripts/lib/glob.mjs').tracking, 'generated');
  assert.equal(r.classifyPath('stray/file.txt').status, 'no-slot');
  assert.deepEqual(r.importAllowed('scripts/kernel/a.mjs', 'scripts/agent/lib.mjs'), { allowed: true, reason: 'allowed', fromTier: 'kernel', toTier: 'domain' });
  assert.equal(r.importAllowed('scripts/lib/a.mjs', 'scripts/kernel/b.mjs').reason, 'tierDirection');
});

test('state directories and local junk named in the review log are forbidden in the tree, not only untracked', () => {
  const m = runtimeManifest();
  const r = createSlotResolver(m, resolveRepoDeclaration(m, { hfs: 1, kind: 'runtime', project: 'starci' }));
  for (const forbidden of ['runtime/x.json', 'mcp/server.json', 'worktrees/a/b.txt', '.starciwork/runtime.sqlite', '.experiments/note.md', 'config.yaml.bak-20261001065612', 'nul', 'nul.txt', 'lp-specs.txt', '3-jobs', 'LEAD.md']) {
    assert.equal(r.classifyPath(forbidden).status, 'forbidden', `${forbidden} must be forbidden`);
  }
  assert.notEqual(r.classifyPath('docs/goal.md').status, 'forbidden');
});

const SAMPLE_RUNTIME = 'examples/.runtimes/sample-project';
const SAMPLE_SHA = 'ab'.repeat(32);
const SAMPLE_CAS = `${SAMPLE_RUNTIME}/artifacts/${SAMPLE_SHA.slice(0, 2)}/${SAMPLE_SHA}`;
const SAMPLE_FILES = [`${SAMPLE_RUNTIME}/runtime.sqlite`, SAMPLE_CAS, `${SAMPLE_CAS}.json`];

test('curated sample runtimes have their own fixture boundary and require a project DB, without an app declaration', () => {
  const m = runtimeManifest();
  const declaration = { hfs: 1, kind: 'runtime', project: 'starci' };
  const r = createSlotResolver(m, resolveRepoDeclaration(m, declaration));
  for (const file of SAMPLE_FILES) {
    const classified = r.classifyPath(file);
    assert.deepEqual([classified.status, classified.slot, classified.tracking], ['owned', 'runtime.example-runtime-fixtures', 'tracked']);
    assert.equal(classified.bindings['example-project'], 'sample-project');
    assert.deepEqual(r.requiredFiles(file), [`${SAMPLE_RUNTIME}/runtime.sqlite`]);
  }
  assert.deepEqual(slotAllowsFindings({ resolver: r, files: SAMPLE_FILES }), []);
  const complete = checkRepo({ repoRoot: ROOT, root: ROOT, manifest: m, declaration, files: SAMPLE_FILES, tree: false });
  assert.equal(complete.findings.some((f) => f.code === 'HFS_SLOT_REQUIRED_MISSING' && f.path.startsWith('examples/.runtimes/')), false);
  const missing = checkRepo({ repoRoot: ROOT, root: ROOT, manifest: m, declaration, files: SAMPLE_FILES.slice(1), tree: false });
  const owed = missing.findings.filter((f) => f.code === 'HFS_SLOT_REQUIRED_MISSING' && f.path.startsWith('examples/.runtimes/'));
  assert.deepEqual(owed.map(({ slot, path: file, via }) => ({ slot, path: file, via })), [
    { slot: 'runtime.example-runtime-fixtures', path: `${SAMPLE_RUNTIME}/runtime.sqlite`, via: 'requires' },
  ]);
  const ordinary = checkRepo({ repoRoot: ROOT, root: ROOT, manifest: m, declaration, files: ['examples/sample-app/be/src/main.ts'], tree: false });
  assert.equal(ordinary.findings.some((f) => f.code === 'HFS_SLOT_REQUIRED_MISSING' && f.slot === 'runtime.example' && f.path === 'examples/sample-app/hfs.json'), true);
});

test('sample fixture ownership closes the reserved tree to unselected files and does not extend outside its prefix', () => {
  const m = runtimeManifest();
  const r = createSlotResolver(m, resolveRepoDeclaration(m, { hfs: 1, kind: 'runtime', project: 'starci' }));
  const stray = [
    'examples/.runtimes/index.yaml',
    `${SAMPLE_RUNTIME}/hfs.json`,
    `${SAMPLE_RUNTIME}/machine.sqlite`,
    `${SAMPLE_RUNTIME}/report.json`,
    `${SAMPLE_RUNTIME}/workflows/history.json`,
    `${SAMPLE_RUNTIME}/artifacts/transcript.json`,
    `${SAMPLE_RUNTIME}/artifacts/ab/extra/${SAMPLE_SHA}`,
  ];
  for (const file of stray) assert.notEqual(r.classifyPath(file).slot, 'runtime.example', `${file} is not an app example`);
  const findings = slotAllowsFindings({ resolver: r, files: stray });
  assert.deepEqual(findings.map(({ code, path: file }) => ({ code, path: file })), stray.map((file) => ({ code: 'HFS_FORBIDDEN_PRESENT', path: file })));
  assert.equal(r.classifyPath('examples/.runtimes').status, 'forbidden');
  for (const file of ['../examples/.runtimes/sample-project/runtime.sqlite', 'examples/.runtimes-other/sample-project/runtime.sqlite']) {
    assert.notEqual(r.classifyPath(file).slot, 'runtime.example-runtime-fixtures', `${file} gets no sample runtime fixture allowance`);
  }
});

test('sample runtime sidecars and materialized transients are ignored and fail when forced into the tracked tree', () => {
  const m = runtimeManifest();
  const declaration = { hfs: 1, kind: 'runtime', project: 'starci' };
  const r = createSlotResolver(m, resolveRepoDeclaration(m, declaration));
  const transient = [
    ...['wal', 'shm', 'journal'].map((suffix) => `${SAMPLE_RUNTIME}/runtime.sqlite-${suffix}`),
    ...['artifacts-views', 'cache', 'views', 'captures', 'logs', 'traces'].map((dir) => `${SAMPLE_RUNTIME}/${dir}/temporary.bin`),
  ];
  for (const file of transient) {
    const c = r.classifyPath(file);
    assert.deepEqual([c.slot, c.tracking], ['runtime.example-runtime-transients', 'ignored']);
  }
  const report = checkRepo({ repoRoot: ROOT, root: ROOT, manifest: m, declaration, files: transient, tree: false });
  assert.deepEqual(report.findings.filter((f) => f.code === 'HFS_TRACKED_MUST_BE_IGNORED').map((f) => f.path), transient);
});
