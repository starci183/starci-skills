import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { createSlotResolver, loadSlotManifest, readRepoDeclaration, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { configFindings, databaseConfigFindings } from '../../scripts/hfs/rules/database-config.mjs';
import { deployWorkflowFindings } from '../../scripts/hfs/rules/deploy-workflow.mjs';
import { releaseProvenanceFindings } from '../../scripts/hfs/rules/release-provenance.mjs';
import { scriptHygieneFindings } from '../../scripts/hfs/rules/script-hygiene.mjs';
import { buildFrontend } from '../fixtures/hfs-delivery-lite/scripts/build-frontend.mjs';
import { byCodeUnit } from '../../scripts/lib/list.mjs';

const fullRoot = fileURLToPath(new URL('../fixtures/hfs-callback-full/', import.meta.url));
const liteRoot = fileURLToPath(new URL('../fixtures/hfs-delivery-lite/', import.meta.url));
const manifest = loadSlotManifest();
const fullRepo = readRepoDeclaration(manifest, fullRoot);
const fullResolver = createSlotResolver(manifest, fullRepo);
const migrationDir = path.join(fullRoot, 'supabase/migrations');
const migrations = fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort(byCodeUnit);
const providerFiles = [
  ['.github/workflows/db-deploy.yml', 'app.ci-db'],
  ['supabase/', 'app.supabase'],
  ['supabase/config.toml', 'app.supabase.config'],
  ['supabase/migrations/20261014100000_baseline.sql', 'app.supabase.migrations'],
  ['supabase/types/database.types.ts', 'app.supabase.types'],
  ['be/src/modules/integrations/supabase/index.ts', 'be.integrations.supabase'],
];
const read = (file) => fs.readFileSync(path.join(fullRoot, file), 'utf8');
const fullInput = (files) => ({ repoRoot: fullRoot, files, repo: fullRepo, resolver: fullResolver, manifest, isRoot: true });

test('full declared Supabase fixture supplies real files in each provider slot', () => {
  assert.equal(fullRepo.edition, 'full');
  assert.deepEqual(fullRepo.providers, ['supabase']);
  for (const [file, slot] of providerFiles) {
    const classified = fullResolver.classifyPath(file);
    assert.equal(classified.status, 'owned', file);
    assert.equal(classified.slot, slot, file);
    if (file.endsWith('/')) assert.equal(fs.statSync(path.join(fullRoot, file)).isDirectory(), true);
    else assert.ok(read(file).trim(), file);
  }
  const integrationRoot = 'be/src/modules/integrations/supabase';
  for (const required of fullResolver.requiredFiles(`${integrationRoot}/`)) {
    assert.equal(fs.existsSync(path.join(fullRoot, required)), true, required);
  }
});

test('full Supabase surfaces require the declared provider', () => {
  const declaration = JSON.parse(read('hfs.json'));
  delete declaration.sides.be.connections[0].provider;
  const resolver = createSlotResolver(manifest, resolveRepoDeclaration(manifest, declaration));
  for (const [file, slot] of providerFiles.filter((entry) => entry[1] !== 'app.ci-db')) {
    assert.equal(resolver.classifyPath(file).status, 'not-enabled', slot);
  }
});

test('full Supabase fixture keeps safe config and a stamped generated database contract', () => {
  const file = 'supabase/config.toml';
  const text = read(file);
  assert.deepEqual(configFindings({ file, text, toml: parseToml(text) }), []);
  assert.deepEqual(databaseConfigFindings(fullInput([file, ...migrations.map((name) => `supabase/migrations/${name}`)])), []);
  const hash = createHash('sha256');
  for (const name of migrations) {
    const source = read(`supabase/migrations/${name}`).replaceAll('\r\n', '\n');
    hash.update(`${name}\0${source}\0`);
  }
  assert.equal(read('supabase/types/database.types.ts').split('\n')[0].trim(), `// migrations-sha256: ${hash.digest('hex')}`);
});

test('full Supabase database workflow passes deployment and release provenance checks', () => {
  const files = ['.github/workflows/db-deploy.yml'];
  assert.deepEqual(deployWorkflowFindings(fullInput(files)), []);
  assert.deepEqual(releaseProvenanceFindings(fullInput(files)), []);
});

test('lite delivery helper belongs to its product-owned slot and passes custody checks', () => {
  const repo = readRepoDeclaration(manifest, liteRoot);
  const resolver = createSlotResolver(manifest, repo);
  const files = ['scripts/build-frontend.mjs'];
  assert.equal(repo.edition, 'lite');
  assert.equal(resolver.classifyPath(files[0]).slot, 'app.scripts.delivery');
  assert.deepEqual(scriptHygieneFindings({ repoRoot: liteRoot, files, repo, resolver, isRoot: true }), []);
});

test('lite delivery helper runs offline generation before building the front end', () => {
  const calls = [];
  buildFrontend((command, args) => { calls.push([command, args]); return { status: 0 }; });
  assert.deepEqual(calls, [
    ['npm', ['run', 'codegen', '--silent']],
    ['npm', ['exec', '--no', '--', 'turbo', 'run', 'build', '--filter=./fe/apps/*']],
  ]);
});

test('lite delivery helper stops before a build when generation fails', () => {
  let calls = 0;
  assert.throws(() => buildFrontend(() => { calls += 1; return { status: 1 }; }), /Frontend build command failed/);
  assert.equal(calls, 1);
});
