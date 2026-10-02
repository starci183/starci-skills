// hfs-scaffold-app.spec.mjs - `hfs scaffold app demo` makes the one shape of a StarCi product, and `hfs lint` at its root judges it
// with both canons: ESLint with the BE canon over be/ only and with the FE canon over fe/ only, stylelint over fe/, the app check.
// A fresh scaffold has 0 findings and 0 tool errors; a violation planted on each side is reported by its own side's canon alone, and
// every path a finding names, in its path and in its message, is app-relative. The scaffold also type-checks with its own root
// `typecheck` script (after `codegen`), so every import of the skeleton is proven to resolve; an unresolvable import planted on each
// side is reported. The be core api also builds with its own build:be script and boots with start:core over a stand-in of its primary
// database at the network edge (GET /health/live answers 200), then stops.
// The scaffold resolves its real lockfile with npm (network or the npm cache), the @starci scope from this checkout's own packages
// (tests/helpers/source-canon-registry.mjs: the canon versions are raised in the source before they are published, so the spec never
// depends on publish state). Nothing is installed: the dependencies are linked from existing installs (tests/helpers/hfs-app-install.mjs;
// STARCI_APP_INSTALLS may add a product app's node_modules when the runtime holds no copy of a framework the skeleton imports).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { main } from '../../packages/hfs/bin/hfs.mjs';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { coverageExclusions } from '../../packages/hfs/sync/index.mjs';
import { dockerFindings } from '../../scripts/hfs/rules/docker.mjs';
import { nextBuildEnv } from '../../scripts/gates/build-env.mjs';
import { loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { LINT_DEPENDENCIES, RUNTIME, installInto, missingFrom, runtimeInstalls, uninstall } from '../helpers/hfs-app-install.mjs';
import { startSourceCanonRegistry } from '../helpers/source-canon-registry.mjs';

const jestPreset = createRequire(import.meta.url)('../../packages/jest-preset/index.cjs');
/** What sync loads from the installed jest preset: the Sonar exclusions and the coverage sources (the one coverage scope). */
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions(), coverageSources: [...jestPreset.COVERAGE_SOURCES] };
/** The one coverage scope of an app: the unit-tested roles of ruleParams.be.unitRoles (the services and the cli commands), from the preset. */
const COVERAGE_SCOPE = jestPreset.COVERAGE_SOURCES.map((glob) => `be/${glob}`);
const LCOV = 'be/coverage/lcov.info';
const installs = runtimeInstalls();
const missing = missingFrom(installs);
const skipReason = missing.length ? `no install holds ${missing.join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false;
// A skip must never pass silently. Locally it prints one SKIPPED line. The release verification and CI set
// STARCI_REQUIRE_APP_INSTALLS=1 (scripts/gates/release-app-installs.mjs provides fresh registry installs), and then a
// missing install fails the test instead of skipping it.
export const REQUIRE_APP_INSTALLS = process.env.STARCI_REQUIRE_APP_INSTALLS === '1';
function gate(name, reason) {
  if (!reason) return { skip: false, required: null };
  if (REQUIRE_APP_INSTALLS) return { skip: false, required: `REQUIRED (STARCI_REQUIRE_APP_INSTALLS=1) but ${reason}` };
  console.log(`SKIPPED: no installs - ${name}: ${reason}`);
  return { skip: reason, required: null };
}
const lintGate = gate('scaffold lint', skipReason);

/** The checkout's @starci packages as a registry, started once by the first test that scaffolds and stopped after the file. */
let registry = null;
after(async () => { if (registry) await (await registry).close(); });
/** `hfs scaffold app demo --into <into>` with the real lock step, the @starci scope resolved from this checkout. */
async function scaffold(into) {
  registry ??= startSourceCanonRegistry();
  return scaffoldApp({ name: 'demo', into, presets: PRESETS, lock: (await registry).lock });
}

async function run(argv) {
  let out = '';
  const code = await main(argv, { stdout: (s) => { out += s; }, stderr: (s) => { out += s; }, presets: PRESETS });
  return { code, out };
}

async function lint(app) {
  execFileSync('git', ['-c', 'core.autocrlf=false', 'add', '-A'], { cwd: app });
  const { code, out } = await run(['lint', '--repo', app, '--format', 'json']);
  return { code, report: JSON.parse(out) };
}

/** The fe workspaces of the app (the root package.json workspaces fe/apps/* and fe/packages/*) that hold a package.json, app-relative. */
function workspacesOf(app) {
  const patterns = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).workspaces ?? [];
  return patterns.flatMap((pattern) => {
    const base = path.join(app, ...pattern.replace(/\/\*$/, '').split('/'));
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'package.json')))
      .map((entry) => `${pattern.replace(/\/\*$/, '')}/${entry.name}`);
  }).sort();
}

/**
 * The scaffold's own root `typecheck` script, step by step: `npm run <script>` runs that root script's command, `tsc <args>` the app's
 * TypeScript (always --noEmit: a spec writes no build output), and `turbo run typecheck` the `typecheck` script of every fe workspace
 * from its own folder (the task graph runs exactly those; the linked install holds no turbo binary). Returns the compiler's error lines.
 */
function typecheck(app) {
  const scripts = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts;
  const tsc = path.join(app, 'node_modules', 'typescript', 'bin', 'tsc');
  const errors = [];
  const step = (command, cwd = app) => {
    const [tool, ...args] = command.trim().split(/\s+/);
    if (tool === 'npm' && args[0] === 'run') return step(scripts[args[1]]);
    if (tool === 'node') { execFileSync(process.execPath, args, { cwd, stdio: 'pipe' }); return; }
    if (tool === 'turbo') {
      assert.deepEqual(args, ['run', 'typecheck'], `the typecheck script runs the typecheck task of every workspace, not ${command}`);
      for (const workspace of workspacesOf(app)) {
        const own = JSON.parse(fs.readFileSync(path.join(app, workspace, 'package.json'), 'utf8')).scripts?.typecheck;
        assert.equal(typeof own, 'string', `${workspace} has a typecheck script`);
        step(own, path.join(app, workspace));
      }
      return;
    }
    assert.equal(tool, 'tsc', `the typecheck script runs only codegen, tsc and the workspaces' typecheck, not ${command}`);
    const run = spawnSync(process.execPath, [tsc, ...args.filter((arg) => arg !== '--noEmit'), '--noEmit', '--pretty', 'false'], { cwd, encoding: 'utf8' });
    // A workspace's compiler names its files from the workspace folder: the line is made app-relative like the root's.
    const prefix = cwd === app ? '' : `${path.relative(app, cwd).split(path.sep).join('/')}/`;
    errors.push(...`${run.stdout}${run.stderr}`.split(/\r?\n/).filter((line) => /error TS\d+/.test(line)).map((line) => `${prefix}${line}`));
  };
  for (const command of scripts.typecheck.split('&&')) step(command);
  return errors;
}

/**
 * The `^build` of the task graph (turbo.json: build, lint and typecheck depend on it): the `build` script of every fe package workspace,
 * run from its folder with the app's TypeScript, so the apps resolve each package's built dist (its exports and types) as they do
 * under turbo. Each build must succeed.
 */
function buildPackages(app) {
  const tsc = path.join(app, 'node_modules', 'typescript', 'bin', 'tsc');
  const packages = workspacesOf(app).filter((workspace) => workspace.startsWith('fe/packages/'));
  assert.ok(packages.length > 0, 'the scaffold has fe package workspaces');
  for (const workspace of packages) {
    const [tool, ...args] = JSON.parse(fs.readFileSync(path.join(app, workspace, 'package.json'), 'utf8')).scripts.build.split(/\s+/);
    assert.equal(tool, 'tsc', `${workspace} builds with tsc`);
    const run = spawnSync(process.execPath, [tsc, ...args, '--pretty', 'false'], { cwd: path.join(app, workspace), encoding: 'utf8' });
    assert.equal(run.status, 0, `(cd ${workspace} && ${tool} ${args.join(' ')}) must build: ${run.stdout}${run.stderr}`);
  }
}

/** What the boot smoke runs besides the lint set: the be build (`build:be`: tsc, tsc-alias) and the HTTP platform the api serves on. */
const BOOT_DEPENDENCIES = Object.freeze(['tsc-alias', '@nestjs/platform-express', 'express', 'rxjs', 'reflect-metadata', 'pg']);
const bootGate = gate('scaffold api boot', skipReason || (missingFrom(installs, BOOT_DEPENDENCIES).length ? `no install holds ${missingFrom(installs, BOOT_DEPENDENCIES).join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false));

/** The bin script of an installed package (`tsc` of typescript, `tsc-alias`), read from its package.json. */
function binOf(app, pkg, name) {
  const dir = path.join(app, 'node_modules', ...pkg.split('/'));
  const { bin } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  return path.join(dir, typeof bin === 'string' ? bin : bin[name]);
}

/** Runs a root script of the app the way npm would, step by step: `cd <dir>`, `npm run <script>`, `tsc`, `tsc-alias`. */
function runScript(app, name) {
  const scripts = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts;
  let cwd = app;
  for (const command of scripts[name].split('&&')) {
    const [tool, ...args] = command.trim().split(/\s+/);
    if (tool === 'cd') { cwd = path.resolve(cwd, args[0]); continue; }
    if (tool === 'npm' && args[0] === 'run') { runScript(app, args[1]); continue; }
    const bins = { tsc: binOf(app, 'typescript', 'tsc'), 'tsc-alias': binOf(app, 'tsc-alias', 'tsc-alias') };
    assert.ok(bins[tool], `${name} runs only cd, npm run, tsc and tsc-alias, not ${command}`);
    const run = spawnSync(process.execPath, [bins[tool], ...args], { cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, `${command}: ${run.stdout}${run.stderr}`);
  }
}

/** A free TCP port on the loopback interface. */
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

/** A .properties text as a map (key=value lines; comments and blank lines left out). */
const propertiesOf = (text) => Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));

/**
 * The coverage contract of a scaffolded app: sonar-project.properties imports the be lcov with exactly the services as its coverage
 * scope (no other coverage key), codecov.yml holds the same scope at 100 on the project and the patch with fe/ ignored, and the
 * managed CI uploads the same lcov with the CODECOV_TOKEN secret after the unit run.
 */
function assertCoverageContract(app) {
  const sonar = propertiesOf(fs.readFileSync(path.join(app, 'sonar-project.properties'), 'utf8'));
  const coverageKeys = Object.keys(sonar).filter((key) => /coverage|lcov/i.test(key)).sort();
  assert.deepEqual(coverageKeys, ['sonar.coverage.exclusions', 'sonar.javascript.lcov.reportPaths'], 'exactly the lcov import and the complement of the services: no other coverage key');
  assert.equal(sonar['sonar.javascript.lcov.reportPaths'], LCOV);
  assert.deepEqual(sonar['sonar.coverage.exclusions'].split(','), coverageExclusions(PRESETS));
  assert.ok(sonar['sonar.coverage.exclusions'].split(',').includes('fe/**') && !/\.service\.ts/.test(sonar['sonar.coverage.exclusions']), 'fe/ is out, the services are in');
  const codecov = parseYaml(fs.readFileSync(path.join(app, 'codecov.yml'), 'utf8'));
  for (const kind of ['project', 'patch']) {
    assert.deepEqual(codecov.coverage.status[kind].default, { target: '100%', threshold: '0%', paths: COVERAGE_SCOPE }, `codecov ${kind} status: the unit-tested roles at 100`);
  }
  assert.deepEqual(codecov.ignore, ['fe/**'], 'fe/ is outside coverage');
  assert.deepEqual(Object.keys(codecov.coverage.status).sort(), ['patch', 'project']);
  const workflow = parseYaml(fs.readFileSync(path.join(app, '.github', 'workflows', 'ci.yml'), 'utf8'));
  const steps = workflow.jobs.ci.steps;
  const unit = steps.findIndex((step) => step.name === 'unit');
  const upload = steps.findIndex((step) => String(step.uses ?? '').startsWith('codecov/codecov-action@'));
  assert.ok(unit >= 0 && upload > unit, 'the coverage upload follows the unit run');
  assert.equal(steps[upload].with.files, LCOV, 'the upload sends the lcov Sonar imports');
  assert.equal(steps[upload].with.use_oidc, true);
  assert.equal(workflow.jobs.ci.env.CODECOV_TOKEN, undefined);
}

const edit = (app, file, from, to) => {
  const target = path.join(app, ...file.split('/'));
  const text = fs.readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `${file} holds ${from}`);
  fs.writeFileSync(target, text.replace(from, to));
};

test('a scaffolded app imports the be lcov into Sonar and Codecov with exactly the services as the coverage scope', (t) => {
  // No install and no registry: the lockfile step is the only part that needs npm, and it is not what this proves.
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-coverage-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const { root, files } = scaffoldApp({ name: 'demo', into, presets: PRESETS, lock: () => ({ ok: true }) });
  for (const file of ['sonar-project.properties', 'codecov.yml', '.github/workflows/ci.yml']) assert.ok(files.includes(file), `${file} is scaffolded`);
  assertCoverageContract(root);
  // The be unit run is the preset's: it writes lcov into be/coverage, the path both imports read.
  assert.match(fs.readFileSync(path.join(root, 'be', 'jest.config.js'), 'utf8'), /require\("@starci\/jest-preset"\)\.starciJestConfig\(\)/);
  const config = jestPreset.starciJestConfig();
  assert.ok(config.coverageReporters.includes('lcov'));
  assert.equal(`be/${config.coverageDirectory}/lcov.info`, LCOV);
});

test('a scaffolded app has one Dockerfile per app, the managed .dockerignore and images workflow, and its Dockerfiles satisfy the docker rules', (t) => {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-images-'));
  t.after(() => fs.rmSync(into, { recursive: true, force: true }));
  const { root, files } = scaffoldApp({ name: 'demo', into, presets: PRESETS, lock: () => ({ ok: true }) });
  const declaration = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8'));
  const dockerfiles = [...declaration.sides.be.apps.map((app) => `be/apps/${app.name}/Dockerfile`), ...declaration.sides.fe.apps.map((app) => `fe/apps/${app.name}/Dockerfile`)];
  for (const file of [...dockerfiles, '.dockerignore', '.github/workflows/images.yml']) assert.ok(files.includes(file), `${file} is scaffolded`);
  const repo = resolveRepoDeclaration(loadSlotManifest(), declaration);
  assert.deepEqual(dockerFindings({ repoRoot: root, files, repo }), [], 'the scaffolded images satisfy the docker rules');
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'images.yml'), 'utf8');
  assert.match(workflow, /push: false/);
  for (const file of dockerfiles) assert.ok(workflow.includes(file), `${file} is built by the images workflow`);
  const ignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8').split('\n');
  for (const secret of ['.starcistacks', '**/.env', '.secrets', 'node_modules']) assert.ok(ignore.includes(secret), `.dockerignore excludes ${secret}`);
});

test('hfs scaffold app writes the app shape and hfs lint at its root finds nothing, each side judged by its own canon', { skip: lintGate.skip, timeout: 600_000 }, async (t) => {
  if (lintGate.required) assert.fail(lintGate.required);
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-app-'));
  const app = path.join(into, 'demo');
  let links = [];
  t.after(() => { uninstall(app, links); fs.rmSync(into, { recursive: true, force: true }); });

  const scaffolded = await scaffold(into);
  assert.equal(scaffolded.root, app);
  const declaration = JSON.parse(fs.readFileSync(path.join(app, 'hfs.json'), 'utf8'));
  assert.equal(declaration.kind, 'app');
  assert.deepEqual(Object.keys(declaration.sides).sort(), ['be', 'fe']);
  for (const file of ['package.json', 'package-lock.json', 'be/eslint.config.mjs', 'fe/eslint.config.mjs', 'be/tsconfig.json', 'fe/tsconfig.json']) {
    assert.ok(fs.existsSync(path.join(app, ...file.split('/'))), `${file} is scaffolded`);
  }
  for (const side of ['be', 'fe']) {
    for (const file of ['package.json', 'package-lock.json']) assert.ok(!fs.existsSync(path.join(app, side, file)), `${side}/ holds no ${file}: the app root holds the one`);
  }
  assertCoverageContract(app);
  const scripts = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts;
  for (const name of ['dev:be', 'dev:fe:landing', 'dev:fe:app', 'build:be', 'build:fe', 'start:core', 'start:landing', 'start:app', 'cli', 'migrate', 'lint', 'lint:fix', 'test', 'test:integration', 'test:e2e', 'test:contract', 'test:stack', 'codegen', 'contract:emit', 'typecheck']) {
    assert.ok(scripts[name], `the root package.json has the ${name} script`);
  }

  // The lockfile is npm's own (the scaffold runs `npm install --package-lock-only`): it resolves every dependency of the root and
  // of every workspace, and `npm ci` accepts it. Checked before any node_modules exists, so the dry run touches no link.
  const manifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(app, 'package-lock.json'), 'utf8'));
  assert.equal(lock.lockfileVersion, 3);
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies, 'the lock root holds the package.json dependencies');
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies, 'the lock root holds the package.json devDependencies');
  const workspaces = (manifest.workspaces ?? []).flatMap((pattern) => {
    const [base, star] = pattern.split('/*');
    return star === undefined ? [pattern] : (fs.existsSync(path.join(app, base)) ? fs.readdirSync(path.join(app, base)).map((name) => `${base}/${name}`) : []);
  });
  const declared = [manifest, ...workspaces.map((dir) => JSON.parse(fs.readFileSync(path.join(app, dir, 'package.json'), 'utf8')))];
  for (const pkg of declared) {
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) assert.ok(lock.packages[`node_modules/${name}`], `the lock resolves ${name}`);
  }
  for (const dir of workspaces) assert.ok(lock.packages[dir], `the lock holds the workspace ${dir}`);
  const ci = spawnSync('npm ci --dry-run --ignore-scripts --no-audit --no-fund', { cwd: app, encoding: 'utf8', shell: true, windowsHide: true });
  assert.equal(ci.status, 0, `npm ci accepts the lock: ${ci.stderr}`);
  assert.ok(!fs.existsSync(path.join(app, 'node_modules')), 'the dry run installed nothing');

  links = installInto(app, installs);
  // The fe packages are built first, as the task graph builds them before the lint and the typecheck of the apps (^build).
  buildPackages(app);
  execFileSync('git', ['init', '-q'], { cwd: app });

  const fresh = await lint(app);
  assert.deepEqual(fresh.report.errors, [], 'every tool ran');
  assert.deepEqual(fresh.report.findings.map((f) => `${f.path}:${f.line ?? ''} ${f.engine}/${f.rule} ${f.message}`), [], 'a fresh scaffold has no finding');
  assert.equal(fresh.code, 0);
  assert.ok(fresh.report.engines.eslint.sides.be.files > 0, 'ESLint linted the be side');
  assert.ok(fresh.report.engines.eslint.sides.fe.files > 0, 'ESLint linted the fe side');
  assert.ok(fresh.report.engines.stylelint.files > 0, 'stylelint linted the fe stylesheets');

  // The scaffold type-checks with its own script: every skeleton import resolves.
  assert.deepEqual(typecheck(app), [], 'a fresh scaffold type-checks');
  // An unresolvable import planted on each side is reported by the same script.
  const unresolvable = { 'be/src/modules/domain/liveness/liveness.service.ts': '@modules/platform/nowhere', 'fe/apps/app/src/features/pages/AppHomePage/component.tsx': '@/modules/nowhere' };
  const originals = {};
  for (const [file, specifier] of Object.entries(unresolvable)) {
    const target = path.join(app, ...file.split('/'));
    originals[file] = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, `import { gone } from "${specifier}"\nvoid gone\n${originals[file]}`);
  }
  const broken = typecheck(app);
  for (const [file, specifier] of Object.entries(unresolvable)) {
    assert.ok(broken.some((line) => line.replace(/\\/g, '/').includes(file) && line.includes('TS2307') && line.includes(specifier)), `${file}: the unresolvable ${specifier} is reported (${broken.join(' | ')})`);
    fs.writeFileSync(path.join(app, ...file.split('/')), originals[file]);
  }

  // One violation per side: a public door with no closed-list reason (BE canon), a raw heading (FE canon), and an alias of a
  // declaration whose message names its file.
  edit(app, 'be/src/features/api/system-health/transport/http/live.controller.ts', '@Public({ reason: PublicReason.Health })', '@Public({ reason: "health" })');
  edit(app, 'fe/apps/app/src/features/pages/AppHomePage/component.tsx', '<Heading level={1}>{props.props.title}</Heading>', '<h1>{props.props.title}</h1>');
  fs.writeFileSync(path.join(app, 'fe', 'apps', 'app', 'src', 'modules', 'config', 'alias.ts'), 'import { siteUrl } from "./index"\n\nexport const origin = siteUrl\n');
  const planted = await lint(app);
  assert.equal(planted.code, 1);
  const eslint = planted.report.findings.filter((f) => f.engine === 'eslint');
  assert.ok(eslint.some((f) => f.rule === 'starci-be/public-needs-reason' && f.path === 'be/src/features/api/system-health/transport/http/live.controller.ts'), 'the BE canon judged be/');
  assert.ok(eslint.some((f) => f.rule.startsWith('starci-fe/') && f.path === 'fe/apps/app/src/features/pages/AppHomePage/component.tsx'), 'the FE canon judged fe/');
  const alias = eslint.find((f) => f.rule === 'starci-fe/alias-reexport' && f.path === 'fe/apps/app/src/modules/config/alias.ts');
  assert.ok(alias, 'the alias is reported on its app-relative path');
  assert.match(alias.message, / in fe\/apps\/app\/src\/modules\/config\/alias\.ts /, 'its message names the same app-relative path');
  // Every path a finding message names is app-relative, like the finding's own path.
  for (const finding of planted.report.findings) {
    assert.doesNotMatch(finding.message ?? '', /(^|[\s'"`(])(apps|src|packages)\//, `${finding.path}: ${finding.message} names a side-relative path`);
  }
  for (const finding of eslint) {
    const side = finding.path.split('/')[0];
    assert.ok(!finding.rule.startsWith('starci-') || finding.rule.startsWith(`starci-${side}/`), `${finding.rule} on ${finding.path}: a canon judges only its own side`);
  }
});

/** One PostgreSQL backend message: its type byte, its length (itself included) and its body. */
const pgMessage = (type, ...parts) => {
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(5);
  head.write(type, 0, 'latin1');
  head.writeInt32BE(body.length + 4, 1);
  return Buffer.concat([head, body]);
};
const pgInt32 = (value) => { const buffer = Buffer.alloc(4); buffer.writeInt32BE(value); return buffer; };
const pgInt16 = (value) => { const buffer = Buffer.alloc(2); buffer.writeInt16BE(value); return buffer; };
const pgText = (value) => Buffer.from(`${value}\0`, 'utf8');
/** The one-row answer of a simple query: the column TypeORM reads from the statement it sent (its boot reads only these). */
const pgAnswer = (query) => {
  const [column, value] = /version\(\)/.test(query) ? ['version', 'PostgreSQL 16.0 on stand-in'] : /server_version/.test(query) ? ['server_version', '16.0']
    : /current_database/.test(query) ? ['current_database', 'demo'] : /current_schema/.test(query) ? ['current_schema', 'public'] : ['?column?', '1'];
  const field = Buffer.concat([pgText(column), pgInt32(0), pgInt16(0), pgInt32(25), pgInt16(-1), pgInt32(-1), pgInt16(0)]);
  const cell = Buffer.from(value, 'utf8');
  return Buffer.concat([pgMessage('T', pgInt16(1), field), pgMessage('D', pgInt16(1), pgInt32(cell.length), cell), pgMessage('C', pgText('SELECT 1')), pgMessage('Z', Buffer.from('I'))]);
};

/**
 * A stand-in for the primary database at the network edge (third parties are faked at the edge, own code runs real): it speaks
 * just enough of the PostgreSQL wire protocol for the pool TypeORM opens at boot - no TLS, trust authentication, every simple
 * query answered with one row - so the core api boots with its database capability composed and no database server. Resolves
 * `{ url, statements, close }`; `statements` records every query text the app sent.
 */
function fakePostgres() {
  const statements = [];
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let pending = Buffer.alloc(0);
    let started = false;
    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        const offset = started ? 1 : 0;
        if (pending.length < offset + 4) return;
        const length = pending.readInt32BE(offset);
        if (pending.length < offset + length) return;
        const message = pending.subarray(0, offset + length);
        pending = pending.subarray(offset + length);
        if (!started) {
          // An SSLRequest (80877103) is refused with N; the StartupMessage is accepted with trust authentication.
          if (message.readInt32BE(4) === 80877103) { socket.write('N'); continue; }
          started = true;
          socket.write(Buffer.concat([pgMessage('R', pgInt32(0)), pgMessage('S', pgText('server_version'), pgText('16.0')), pgMessage('K', pgInt32(1), pgInt32(1)), pgMessage('Z', Buffer.from('I'))]));
          continue;
        }
        const type = String.fromCharCode(message[0]);
        if (type === 'X') { socket.end(); return; }
        if (type !== 'Q') { socket.destroy(new Error(`the stand-in answers simple queries only, not ${type}`)); return; }
        const query = message.subarray(5, message.length - 1).toString('utf8');
        statements.push(query);
        socket.write(pgAnswer(query));
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      url: `postgres://demo@127.0.0.1:${server.address().port}/demo`,
      statements,
      close: () => new Promise((done) => { for (const socket of sockets) socket.destroy(); server.close(() => done()); }),
    }));
  });
}

test('the scaffolded be core api builds with build:be and boots with start:core from the linked installs, then stops', { skip: bootGate.skip, timeout: 600_000 }, async (t) => {
  if (bootGate.required) assert.fail(bootGate.required);
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-boot-'));
  const app = path.join(into, 'demo');
  let links = [];
  let child = null;
  let database = null;
  t.after(async () => { if (child && child.exitCode === null) child.kill(); await database?.close(); uninstall(app, links); fs.rmSync(into, { recursive: true, force: true }); });

  assert.equal((await scaffold(into)).root, app);
  // The scaffold declares the runtime peer of every driver integration pair it depends on (R111): nothing to add.
  const { peerIntegrationFindings } = await import('../../scripts/hfs/rules/peer-integrations.mjs');
  assert.deepEqual(peerIntegrationFindings({ repoRoot: app, files: ['package.json'] }), []);
  links = installInto(app, installs);

  runScript(app, 'build:be');
  const start = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts['start:core'];
  const [tool, entry] = start.split(/\s+/);
  assert.equal(tool, 'node', `start:core runs the built api with node: ${start}`);
  const port = await freePort();
  const origin = 'http://localhost:3000';
  database = await fakePostgres();
  const { spawn } = await import('node:child_process');
  child = spawn(process.execPath, [entry], { cwd: app, env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('STARCI_'))), PORT: String(port), HTTP_SECURITY_ALLOWED_ORIGINS: origin, PRIMARY_DB_URL: database.url }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));

  let live = null;
  for (let attempt = 0; attempt < 120 && live === null && child.exitCode === null; attempt += 1) {
    try { live = await fetch(`http://127.0.0.1:${port}/health/live`, { headers: { origin } }); } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  assert.ok(live, `the api answered on port ${port}: ${output}`);
  assert.equal(live.status, 200, `GET /health/live: ${live.status} ${await live.text()} ${output}`);
  assert.match(output, /"event":"server\.started"/, 'the api logged its start');
  assert.ok(database.statements.some((statement) => /version\(\)|server_version/.test(statement)), `the api opened its primary connection at boot: ${database.statements.join(' | ')}`);
  assert.ok(!database.statements.some((statement) => /\b(CREATE|ALTER|DROP) TABLE\b/i.test(statement)), 'the api never changes the schema: migrations run only in the cli');
  child.kill();
  await exited;
});

/** What the be unit run loads besides the lint set: the runner, its TypeScript transform and the decorator helpers. */
const UNIT_DEPENDENCIES = Object.freeze(['jest', 'ts-jest', 'tslib']);
const unitGate = gate('scaffold be unit run', missingFrom(installs, [...LINT_DEPENDENCIES, ...UNIT_DEPENDENCIES]).length ? `no install holds ${missingFrom(installs, [...LINT_DEPENDENCIES, ...UNIT_DEPENDENCIES]).join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false);

test('the scaffolded be unit run (the test script) writes the lcov Sonar and Codecov import, naming the unit-tested roles only', { skip: unitGate.skip, timeout: 600_000 }, async (t) => {
  if (unitGate.required) assert.fail(unitGate.required);
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-unit-'));
  const app = path.join(into, 'demo');
  let links = [];
  t.after(() => { uninstall(app, links); fs.rmSync(into, { recursive: true, force: true }); });
  assert.equal((await scaffold(into)).root, app);
  assertCoverageContract(app);
  links = installInto(app, installs);
  // The root `test` script, as npm runs it: `cd be && jest --selectProjects unit --coverage` (plus --ci, like the managed CI).
  const script = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts.test;
  assert.equal(script, 'cd be && jest --selectProjects unit --coverage');
  const jest = path.join(app, 'node_modules', 'jest', 'bin', 'jest.js');
  const unit = spawnSync(process.execPath, [jest, '--selectProjects', 'unit', '--coverage', '--ci', '--cacheDirectory', path.join(into, 'jest-cache')], { cwd: path.join(app, 'be'), encoding: 'utf8', timeout: 540_000 });
  assert.equal(unit.status, 0, `the scaffold's unit run passes at per-file 100 on its services: ${unit.stdout}${unit.stderr}`);
  const lcov = path.join(app, ...LCOV.split('/'));
  assert.ok(fs.existsSync(lcov), `${LCOV} is written by the unit run`);
  const files = fs.readFileSync(lcov, 'utf8').split(/\r?\n/).filter((line) => line.startsWith('SF:')).map((line) => line.slice(3).replace(/\\/g, '/'));
  assert.ok(files.length > 0, 'the lcov names the services it measured');
  for (const file of files) assert.match(file, /(^|\/)src\/(.*\.service\.ts|features\/cli\/.*\.cli\.ts)$/, `${file}: only services and cli commands are measured (jest names the file relative to be/ or absolute)`);
  assert.ok(files.some((file) => file.endsWith('.service.ts')) && files.some((file) => file.endsWith('.cli.ts')), 'the lcov measures both unit-tested roles');
});

/** What the fe build loads besides the lint set: the server-only marker the i18n package's server modules import. */
const FE_BUILD_DEPENDENCIES = Object.freeze(['server-only']);
const feBuildGate = gate('scaffold fe build', missingFrom(installs, [...LINT_DEPENDENCIES, ...FE_BUILD_DEPENDENCIES]).length ? `no install holds ${missingFrom(installs, [...LINT_DEPENDENCIES, ...FE_BUILD_DEPENDENCIES]).join(', ')}; set STARCI_APP_INSTALLS to an app's node_modules` : false);

/** The environment `next build` runs in: the one managed build env (scripts/gates/build-env.mjs). */
const buildEnv = () => nextBuildEnv();

test('the scaffolded fe builds with the root build:fe script: next-intl finds its request config from the directory the build runs in', { skip: feBuildGate.skip, timeout: 900_000 }, async (t) => {
  if (feBuildGate.required) assert.fail(feBuildGate.required);
  // The app sits inside the runtime checkout: the borrowed install links packages from the runtime and its examples, and Turbopack
  // compiles only what lies under its workspace root, so the spec widens that root (below) to the checkout that holds every link target.
  const into = fs.mkdtempSync(path.join(RUNTIME, '.tmp-hfs-fe-build-'));
  const app = path.join(into, 'demo');
  let links = [];
  t.after(() => { uninstall(app, links); fs.rmSync(into, { recursive: true, force: true }); });
  assert.equal((await scaffold(into)).root, app);
  links = installInto(app, installs);
  for (const name of ['landing', 'app']) {
    const toRuntime = path.relative(path.join(app, 'fe', 'apps', name), RUNTIME).split(path.sep).join('/');
    edit(app, `fe/apps/${name}/next.config.ts`, '"..", "..", "..")', `${JSON.stringify(toRuntime)})`);
  }
  // turbo builds the fe packages before the apps that import them (^build).
  buildPackages(app);

  // The root `build:fe` script as npm runs it, step by step: the codegen script, then the turbo build of every fe app workspace,
  // which runs that workspace's `build` script (`next build`) from its folder (the linked install holds no turbo binary).
  const script = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).scripts['build:fe'];
  const next = path.join(app, 'node_modules', 'next', 'dist', 'bin', 'next');
  assert.equal(script, 'npm run codegen --silent && turbo run build --filter=./fe/apps/*', `build:fe runs codegen and the turbo build of the fe app workspaces: ${script}`);
  const dirs = workspacesOf(app).filter((workspace) => workspace.startsWith('fe/apps/'));
  assert.deepEqual(dirs, ['fe/apps/app', 'fe/apps/landing'], 'build:fe builds the landing and the product app');
  for (const dir of dirs) assert.equal(JSON.parse(fs.readFileSync(path.join(app, dir, 'package.json'), 'utf8')).scripts.build, 'next build', `${dir} builds with next build`);
  execFileSync(process.execPath, ['scripts/codegen.mjs'], { cwd: app, stdio: 'pipe' });
  let built = 0;
  for (const dir of dirs) {
    const build = spawnSync(process.execPath, [next, 'build'], { cwd: path.join(app, dir), encoding: 'utf8', env: buildEnv(), timeout: 840_000 });
    assert.equal(build.status, 0, `(cd ${dir} && next build) must build: ${build.stdout}${build.stderr}`);
    assert.ok(fs.existsSync(path.join(app, dir, '.next', 'BUILD_ID')), `${dir} wrote its build output`);
    built += 1;
  }
  assert.ok(built >= 1, 'build:fe built at least one app');
});
