import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { APP_KIND, slotProblems } from '../../scripts/hfs/manifest-shape.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { appSource, checkTargets, renderRepo, renderTargets, writeTargets } from '../../packages/hfs/sync/index.mjs';
import { managedFindings } from '../../packages/hfs/sync/managed.mjs';
import { sonarGateName } from '../../packages/hfs/sync/sonar-key.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const Ajv2020 = (() => { const loaded = require('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const validateSlotsSchema = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/hfs-slots.schema.yaml'), 'utf8')));
const jestPreset = require('../../packages/jest-preset/index.cjs');
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions() };
const RAW_MANIFEST = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge/hfs/slots.yaml'), 'utf8'));
const MANIFEST = loadSlotManifest();
const CONNECTION = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' };
const LITE = {
  hfs: 2,
  kind: 'app',
  edition: 'lite',
  project: 'demo',
  sides: {
    be: { apps: [{ name: 'api', kind: 'api' }], connections: [CONNECTION] },
    fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['supabase/types/'] },
  },
};

const targetMap = (hfs = LITE) => Object.fromEntries(renderTargets(hfs, undefined, { manifest: MANIFEST }).map(target => [target.path, target]));
const aggregateHash = (targets) => createHash('sha256').update(JSON.stringify(targets.map(({ path: file, content }) => [file, content]))).digest('hex');

test('liteManagedBy is a template id field of app slots', () => {
  const slot = MANIFEST.slots.find(candidate => candidate.id === 'app.ci');
  assert.equal(slot.liteManagedBy, 'ci-workflows-lite');
  assert.equal(validateSlotsSchema(RAW_MANIFEST), true, JSON.stringify(validateSlotsSchema.errors));
  assert.deepEqual(slotProblems(slot, 0, APP_KIND, { appScope: 'app', scopes: ['app', 'be', 'fe'] }), []);
  const invalid = { ...slot, liteManagedBy: 'Not/A/Template' };
  assert.match(slotProblems(invalid, 0, APP_KIND, { appScope: 'app', scopes: ['app', 'be', 'fe'] }).join('\n'), /liteManagedBy must be a template id/);
  const invalidManifest = structuredClone(RAW_MANIFEST);
  Object.assign(invalidManifest.slots.find(candidate => candidate.id === slot.id), invalid);
  assert.equal(validateSlotsSchema(invalidManifest), false);
});

test('the lite managed set has no test or coverage world and carries the database wrappers and workflows', () => {
  const targets = targetMap();
  assert.deepEqual(Object.keys(targets).sort(), [
    '.dockerignore', '.github/workflows/ci.yml', '.github/workflows/db-deploy.yml', '.github/workflows/images.yml', '.gitignore',
    '.husky/pre-commit', '.husky/pre-push', '.prettierignore', '.prettierrc', '.starciwork/.gitignore',
    'be/eslint.config.mjs', 'be/tsconfig.build.json', 'be/tsconfig.json',
    'fe/eslint.config.mjs', 'fe/stylelint.config.mjs', 'fe/tsconfig.json',
    'package.json', 'scripts/codegen.mjs', 'sonar-project.properties', 'turbo.json',
  ]);

  const scripts = targets['package.json'].scripts;
  assert.deepEqual(['db:start', 'db:stop', 'db:reset', 'db:new', 'db:push', 'db:types', 'db:lint'].filter(name => !(name in scripts)), []);
  assert.equal(scripts['db:types'], 'npm run contract:emit');
  assert.equal(scripts['db:lint'], 'starci app check --fast');
  assert.equal(scripts.lint, 'starci app lint');
  assert.equal(scripts.typecheck, 'tsc -p be/tsconfig.json && turbo run typecheck');
  assert.equal(scripts['build:fe'], 'turbo run build --filter=./fe/apps/*');
  assert.equal(scripts['dev:fe'], 'turbo run dev --filter=@demo/web');
  assert.equal('typecheck:tests' in scripts, false);
  assert.deepEqual(Object.keys(scripts).filter(name => name === 'test' || name.startsWith('test:')), []);

  const hookText = `${targets['.husky/pre-commit'].content}\n${targets['.husky/pre-push'].content}`;
  assert.doesNotMatch(hookText, /test:affected|jest|playwright|vitest/);
  assert.match(targets['.gitignore'].content, /^supabase\/\.temp\/$/m);
  assert.match(targets['.gitignore'].content, /^supabase\/\.branches\/$/m);
  const ci = parseYaml(targets['.github/workflows/ci.yml'].content);
  assert.ok(ci.jobs['db-types']);
  assert.deepEqual(ci.on.push.tags, ['v*'], 'CI runs on release tags and manual dispatch only');
  assert.deepEqual(Object.keys(ci.on), ['push', 'workflow_dispatch']);
  assert.equal(ci.jobs['db-types'].if, undefined, 'the tag run regenerates and checks the database types unconditionally');
  assert.doesNotMatch(targets['.github/workflows/ci.yml'].content, /codecov|npm test|jest|lcov|coverage upload/i);
  const ciRuns = ci.jobs.ci.steps.map(step => step.run).filter(Boolean);
  for (const command of ['npm ci', 'npm run lint', 'npm run lint -- --sonar reports/lint.sonar.json', 'npm run format:check', 'npm run typecheck', 'npm run build:be', 'npm run build:fe', 'npm run db:lint']) assert.ok(ciRuns.includes(command), command);

  const images = parseYaml(targets['.github/workflows/images.yml'].content).jobs.image.strategy.matrix.include;
  assert.deepEqual(images.map(entry => [entry.name, entry.file]), [['api', 'be/apps/api/Dockerfile']]);
  const deploy = parseYaml(targets['.github/workflows/db-deploy.yml'].content);
  assert.deepEqual(Object.keys(deploy.on), ['workflow_dispatch']);
  assert.equal(deploy.jobs.deploy.environment, '${{ inputs.environment }}');
  assert.ok(deploy.jobs.deploy.steps.some(step => step.run === 'npm run db:push'));

  const sonar = targets['sonar-project.properties'].content;
  assert.match(sonar, /^sonar\.exclusions=\*\*\/\.next\/\*\*,\*\*\/node_modules\/\*\*,\*\*\/src\/messages\/\*\*,supabase\/types\/\*\*$/m);
  assert.doesNotMatch(sonar, /coverage|lcov|sonar\.tests|test\.inclusions/i);
  const codegen = targets['scripts/codegen.mjs'].content;
  assert.equal((codegen.match(/execFileSync\(/g) ?? []).length, 1);
  assert.match(codegen, /["']db:types["']/);
});

test('lite render needs no Jest preset, writeTargets reaches a no-op, and managed drift uses the same render', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lite-render-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'hfs.json'), `${JSON.stringify(LITE, null, 2)}\n`);
  const { targets } = await renderRepo(dir, { manifest: MANIFEST });
  assert.equal(targets.length, 20, 'renderRepo did not require @starci/jest-preset from the empty fixture');
  assert.equal(writeTargets(dir, targets).length, targets.length);
  assert.deepEqual(checkTargets(dir, targets).map(result => result.status), Array(targets.length).fill('ok'));
  assert.deepEqual(writeTargets(dir, targets), [], 'a second sync write is a no-op');

  const tracked = ['hfs.json', ...targets.map(target => target.path)];
  assert.deepEqual(await managedFindings({ repoRoot: dir, tracked, manifest: MANIFEST }), []);
  fs.appendFileSync(path.join(dir, '.husky', 'pre-push'), 'npm test\n');
  assert.deepEqual((await managedFindings({ repoRoot: dir, tracked, manifest: MANIFEST })).map(finding => [finding.code, finding.path]), [['HFS_MANAGED_FILE_DRIFT', '.husky/pre-push']]);
});

test('the full managed render of both examples is the committed one (every managed file in sync, edition full explicit or not)', () => {
  for (const folder of ['examples/ecommerce-app', 'examples/shape-slot']) {
    const hfs = JSON.parse(fs.readFileSync(path.join(ROOT, folder, 'hfs.json'), 'utf8'));
    const sonarKey = /^sonar.projectKey=(.+)$/m.exec(fs.readFileSync(path.join(ROOT, folder, 'sonar-project.properties'), 'utf8'))[1];
    const targets = renderTargets(hfs, PRESETS, { manifest: MANIFEST, sonarKey, source: appSource(path.join(ROOT, folder)) });
    assert.deepEqual(checkTargets(path.join(ROOT, folder), targets).filter(result => result.status !== 'ok'), [], folder);
    assert.equal(aggregateHash(renderTargets({ ...hfs, edition: 'full' }, PRESETS, { manifest: MANIFEST, sonarKey, source: appSource(path.join(ROOT, folder)) })), aggregateHash(targets), `${folder} explicit full`);
  }
});

test('the committed lite example is the lite managed render with no coverage target', () => {
  const folder = 'examples/lite-app';
  const hfs = JSON.parse(fs.readFileSync(path.join(ROOT, folder, 'hfs.json'), 'utf8'));
  assert.equal(hfs.edition, 'lite');
  const sonarKey = /^sonar.projectKey=(.+)$/m.exec(fs.readFileSync(path.join(ROOT, folder, 'sonar-project.properties'), 'utf8'))[1];
  const targets = renderTargets(hfs, PRESETS, { manifest: MANIFEST, sonarKey });
  assert.equal(targets.some(target => target.path === 'codecov.yml'), false);
  assert.deepEqual(checkTargets(path.join(ROOT, folder), targets).filter(result => result.status !== 'ok'), [], folder);
});

test('the one Sonar gate document carries a readable lite gate with no coverage conditions', () => {
  const document = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge/sonar-gate.yaml'), 'utf8'));
  assert.equal(sonarGateName(document), 'starci-quality');
  assert.equal(sonarGateName(document, 'lite'), 'starci-quality-lite');
  assert.ok(document.newCode.coverage && document.overall.coverage, 'the full gate keeps coverage');
  assert.equal('coverage' in document.lite.newCode, false);
  assert.equal('coverage' in document.lite.overall, false);
});
