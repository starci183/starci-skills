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

test('a runtime manifest with sides, a product slot id, an unknown tier or a pending entry without its chunk is refused', () => {
  for (const [name, edit] of [
    ['sides', (d) => { d.sides = { be: { reads: [] }, fe: { reads: [] } }; }],
    ['product slot id', (d) => { d.slots[0].id = 'app.declaration'; }],
    ['unknown tier', (d) => { d.slots.find((s) => s.id === 'runtime.lib').tier = 'feature'; }],
    ['pending lane', (d) => { d.pending[0].lane = 'LAYER-2'; }],
    ['pending date', (d) => { delete d.pending[0].since; }],
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
  assert.equal(r.classifyPath('scripts/lib/hk-claude.mjs').status, 'forbidden', 'a retired lib name is spelled out, so it beats <name>.mjs');
  assert.equal(r.classifyPath('scripts/reconcile/job-settle.mjs').status, 'forbidden');
  assert.equal(r.classifyPath('packages/hfs/runtime/scripts/lib/glob.mjs').tracking, 'generated');
  assert.equal(r.classifyPath('stray/file.txt').status, 'no-slot');
  assert.deepEqual(r.importAllowed('scripts/kernel/a.mjs', 'scripts/agent/lib.mjs'), { allowed: true, reason: 'allowed', fromTier: 'kernel', toTier: 'domain' });
  assert.equal(r.importAllowed('scripts/lib/a.mjs', 'scripts/kernel/b.mjs').reason, 'tierDirection');
});
