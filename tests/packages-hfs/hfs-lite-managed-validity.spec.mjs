import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import prettier from 'prettier';
import prettierConfig from '../../packages/prettier-config/index.cjs';
import { TYPES_STAMP, migrationsDigest } from '../../packages/hfs/emit/db-types.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { renderTargets } from '../../packages/hfs/sync/index.mjs';

const MANIFEST = loadSlotManifest();
const CONNECTION = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' };
const LITE = {
  hfs: 2,
  kind: 'app',
  edition: 'lite',
  project: 'managed-validity',
  sides: {
    be: { apps: [{ name: 'api', kind: 'api' }, { name: 'admin', kind: 'api' }], connections: [CONNECTION] },
    fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['supabase/types/'] },
  },
};

const targets = Object.fromEntries(renderTargets(LITE, undefined, { manifest: MANIFEST }).map(target => [target.path, target]));
const workflows = Object.fromEntries(Object.entries(targets)
  .filter(([file]) => file.startsWith('.github/workflows/') && file.endsWith('.yml'))
  .map(([file, target]) => [file, parseYaml(target.content)]));
const hooks = Object.fromEntries(Object.entries(targets).filter(([file]) => file.startsWith('.husky/')));
const scripts = targets['package.json'].scripts;

const asArray = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const workflowSteps = workflow => Object.values(workflow.jobs).flatMap(job => job.steps ?? []);
const npmRuns = text => [...String(text).matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g)].map(match => match[1]);

test('every lite workflow is structurally valid and pins each action version', () => {
  assert.deepEqual(Object.keys(workflows).sort(), [
    '.github/workflows/ci.yml',
    '.github/workflows/db-deploy.yml',
    '.github/workflows/images.yml',
  ]);

  for (const [file, workflow] of Object.entries(workflows)) {
    assert.ok(workflow.on && typeof workflow.on === 'object', `${file}: on`);
    assert.ok(workflow.permissions && typeof workflow.permissions === 'object', `${file}: permissions`);
    assert.ok(workflow.jobs && typeof workflow.jobs === 'object', `${file}: jobs`);
    const jobNames = new Set(Object.keys(workflow.jobs));
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      assert.ok(job['runs-on'], `${file}: ${jobName} has no runs-on`);
      for (const dependency of asArray(job.needs)) {
        assert.ok(jobNames.has(dependency), `${file}: ${jobName} needs unknown job ${dependency}`);
      }
      for (const step of job.steps ?? []) {
        if (step.uses) assert.match(step.uses, /@(?:v\d+(?:\.\d+)*|[0-9a-f]{40})$/, `${file}: ${step.uses} is not version-pinned`);
        const uploadIdentity = `${step.name ?? ''} ${step.uses ?? ''}`;
        if (/upload|codecov|sonar|artifact|scan|quality[- ]gate/i.test(uploadIdentity)) {
          assert.doesNotMatch(String(step.if ?? ''), /\bsecrets\s*\./, `${file}: an upload step reads secrets in if`);
        }
      }
    }
  }
});

test('lite workflow semantics stay inside the declared no-test CI surface', () => {
  const ci = workflows['.github/workflows/ci.yml'];
  const dbTypes = ci.jobs['db-types'];
  assert.equal(ci.jobs.changes, undefined, 'no path-filter job: the tag run checks the database types unconditionally');
  assert.deepEqual(asArray(dbTypes.needs), []);
  assert.equal(dbTypes.if, undefined);
  assert.deepEqual(Object.keys(ci.on), ['push', 'workflow_dispatch']);

  const runs = Object.values(workflows).flatMap(workflow => workflowSteps(workflow).map(step => step.run).filter(Boolean));
  for (const command of runs) {
    assert.doesNotMatch(command, /\b(?:jest|vitest|playwright|test|coverage|codecov)\b/i, command);
  }

  const deploy = workflows['.github/workflows/db-deploy.yml'];
  assert.deepEqual(Object.keys(deploy.on), ['workflow_dispatch']);

  const images = workflows['.github/workflows/images.yml'].jobs.image.strategy.matrix.include;
  assert.deepEqual(
    images.map(entry => [entry.name, entry.file]).sort(),
    LITE.sides.be.apps.map(app => [app.name, `be/apps/${app.name}/Dockerfile`]).sort(),
  );
});

test('every workflow and hook npm run target exists in the lite package scripts', () => {
  const invoked = [
    ...Object.values(workflows).flatMap(workflow => workflowSteps(workflow).flatMap(step => npmRuns(step.run))),
    ...Object.values(hooks).flatMap(target => npmRuns(target.content)),
  ];
  for (const name of invoked) assert.equal(typeof scripts[name], 'string', `npm run ${name} is not rendered`);
});

test('both lite hooks are valid sh', t => {
  assert.deepEqual(Object.keys(hooks).sort(), ['.husky/pre-commit', '.husky/pre-push']);
  const probe = spawnSync('sh', ['-n'], { input: 'true\n', encoding: 'utf8', windowsHide: true });
  if (probe.error?.code === 'ENOENT') {
    t.skip('sh is not installed; rendered hook syntax could not be checked on this host');
    return;
  }
  assert.equal(probe.status, 0, probe.stderr || probe.error?.message);
  for (const [file, target] of Object.entries(hooks)) {
    const checked = spawnSync('sh', ['-n'], { input: target.content, encoding: 'utf8', windowsHide: true });
    assert.equal(checked.status, 0, `${file}: ${checked.stderr || checked.error?.message}`);
  }
});

test('lite package scripts exclude tests and use only the approved database command surface', () => {
  assert.deepEqual(Object.keys(scripts).filter(name => /^test(?::|$)/.test(name)), []);

  const allowedSupabaseSubcommands = new Set([
    'start',
    'stop',
    'db reset',
    'migration new',
    'db push',
  ]);
  const databaseScripts = Object.fromEntries(Object.entries(scripts).filter(([name]) => name.startsWith('db:')));
  assert.deepEqual(Object.keys(databaseScripts).sort(), ['db:lint', 'db:new', 'db:push', 'db:reset', 'db:start', 'db:stop', 'db:types']);
  for (const [name, command] of Object.entries(databaseScripts)) {
    if (name === 'db:types' || name === 'db:lint') continue;
    assert.match(command, /^supabase /, `${name} is not a Supabase CLI wrapper`);
    assert.ok(allowedSupabaseSubcommands.has(command.slice('supabase '.length)), `${name}: ${command}`);
  }
  assert.equal(databaseScripts['db:types'], 'npm run contract:emit');
  assert.equal(databaseScripts['db:lint'], 'starci app check --fast');
});

test('the generated lite codegen passes the app formatter before any scaffold install', async () => {
  assert.equal(await prettier.check(targets['scripts/codegen.mjs'].content, { ...prettierConfig, parser: 'babel' }), true);
});

test('the generated codegen is offline: it spawns nothing and needs no stack, npm or Docker', () => {
  const codegen = targets['scripts/codegen.mjs'].content;
  const checked = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: codegen, encoding: 'utf8', windowsHide: true });
  assert.equal(checked.status, 0, checked.stderr || checked.error?.message);
  assert.doesNotMatch(codegen, /child_process|spawn|exec(?:File)?Sync|"npm"|"npx"|db:types|supabase (?:start|gen)/, 'codegen never starts a process: a bare npm spawn fails on Windows and a stack must not be a precondition of lint, typecheck or build');
});

test('the generated codegen accepts types stamped with the migrations digest and refuses a missing, unstamped or stale file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lite-codegen-'));
  const run = () => spawnSync(process.execPath, [path.join('scripts', 'codegen.mjs')], { cwd: dir, encoding: 'utf8', windowsHide: true });
  const types = path.join(dir, 'supabase', 'types', 'database.types.ts');
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.mkdirSync(path.join(dir, 'supabase', 'migrations'), { recursive: true });
    fs.mkdirSync(path.dirname(types), { recursive: true });
    fs.writeFileSync(path.join(dir, 'scripts', 'codegen.mjs'), targets['scripts/codegen.mjs'].content);
    fs.writeFileSync(path.join(dir, 'supabase', 'migrations', '20261002123456_baseline.sql'), 'create table public.a (id uuid primary key);\r\n');
    const missing = run();
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /database\.types\.ts is missing/);
    fs.writeFileSync(types, 'export type Database = {};\n');
    assert.match(run().stderr, /not stamped/);
    fs.writeFileSync(types, `${TYPES_STAMP}${migrationsDigest(dir)}\nexport type Database = {};\n`);
    const fresh = run();
    assert.equal(fresh.status, 0, fresh.stderr);
    fs.writeFileSync(path.join(dir, 'supabase', 'migrations', '20261002123457_more.sql'), 'create table public.b (id uuid primary key);\n');
    const stale = run();
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /older than the migrations; run `npm run contract:emit`/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('lite Sonar configuration has no coverage keys and names only implied source directories', () => {
  const sonar = targets['sonar-project.properties'].content;
  assert.doesNotMatch(sonar, /^sonar\..*(?:coverage|lcov|test(?:s|\.inclusions))/im);
  const sourceLine = /^sonar\.sources=(.+)$/m.exec(sonar);
  assert.ok(sourceLine, 'sonar.sources is missing');
  const sources = sourceLine[1].split(',');
  const implied = new Set([
    ...(LITE.sides.be.apps.length ? ['be/apps', 'be/src'] : []),
    ...(LITE.sides.fe.apps.length ? ['fe/apps'] : []),
    ...((LITE.sides.fe.optionalSlots ?? []).some(slot => slot === 'repo.packages' || slot.startsWith('fe.package.')) ? ['fe/packages'] : []),
  ]);
  assert.deepEqual(sources, [...implied]);
  assert.ok(sources.every(source => implied.has(source)));
});
