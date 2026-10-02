import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { starciworkGitignoreText } from '../../scripts/lib/starciwork-boundary.mjs';
import {
  BLOCK_BEGIN, BLOCK_END, appScripts, checkTargets, coverageExclusions, hashOf, loadPresets, render, renderTargets, runSync, targetsOf, validateHfs, writeTargets,
} from '../../packages/hfs/sync/index.mjs';
import { LOCK_STEP, scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { braceVariants } from '../../scripts/lib/glob.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { declaredSonarKeys, readDeclaredSonarKey } from '../../packages/hfs/sync/sonar-key.mjs';
import { hygieneFindings, runWorkHygiene } from '../../packages/hfs/sync/hygiene.mjs';
import { appCliTemplateFindings } from '../../scripts/hfs/runtime-rules/app-cli-templates.mjs';

// starci app sync renders the managed files of an app: the root's (the one package.json's scripts, prettier, Sonar, the hooks, the
// workflows, the .gitignore block and .starciwork/.gitignore) and each side's (be: tsconfig, tsconfig.build, the tests tsconfig,
// the eslint one-liner and jest; fe: tsconfig and the eslint and stylelint one-liners). `starci app scaffold` writes the first tree.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const jestPreset = require('../../packages/jest-preset/index.cjs');
const Ajv2020 = (() => { const loaded = require('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateWorkspace = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-workspace.schema.yaml'), 'utf8')));

const app = ({ be = { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }] }, fe = { apps: [{ name: 'app', kind: 'next' }, { name: 'admin', kind: 'next' }] } } = {}) => ({ hfs: 2, kind: 'app', project: 'nivo', sides: { be, fe } });
const APP = app();
const PRESETS = { sonarExclusions: jestPreset.sonarExclusions(), coverageSources: [...jestPreset.COVERAGE_SOURCES] };
const rendered = (hfs = APP) => Object.fromEntries(renderTargets(hfs, PRESETS).map(target => [target.path, target.content]));
const scriptsOf = (hfs = APP) => renderTargets(hfs, PRESETS).find(target => target.path === 'package.json').scripts;

const repo = (t, hfs = APP) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-sync-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(hfs));
  return dir;
};
const run = async (args, dir) => {
  const lines = [];
  const code = await runSync(args, { cwd: dir, out: line => lines.push(line), presets: PRESETS });
  return { code, lines };
};

describe('the template renderer', () => {
  it('RT_CLI_APP_ONLY_TEMPLATES: managed templates invoke product actions only through starci app', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [path.relative(ROOT, full).replaceAll(path.sep, '/')];
    });
    const files = walk(path.join(ROOT, 'packages', 'hfs', 'templates'));
    const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.deepEqual(appCliTemplateFindings({ files, read }), []);
    const bad = appCliTemplateFindings({ files: ['packages/hfs/templates/app/hook'], read: () => 'npx hfs work-hygiene\n' });
    assert.deepEqual(bad.map((finding) => [finding.code, finding.line]), [['RT_CLI_APP_ONLY_TEMPLATES', 1]]);
    const wrongGroup = appCliTemplateFindings({ files: ['packages/hfs/templates/app/hook'], read: () => 'starci runtime check\n' });
    assert.deepEqual(wrongGroup.map((finding) => [finding.code, finding.line]), [['RT_CLI_APP_ONLY_TEMPLATES', 1]]);
  });

  it('fills {{names}} and expands partial lines', () => {
    const read = name => ({ 'a/base': 'one {{x}}\ntwo\n' })[name];
    assert.equal(render('head\n{{> a/base}}\ntail {{x}}\n', { x: 'X' }, read), 'head\none X\ntwo\ntail X\n');
  });
  it('refuses a name sync does not provide instead of writing an empty string', () => {
    assert.throws(() => render('{{missing}}', {}), /HFS_SYNC_TEMPLATE_VARIABLE.*missing/);
  });
  it('leaves GitHub expressions alone', () => {
    assert.equal(render('token: ${{ secrets.SONAR_TOKEN }}', {}), 'token: ${{ secrets.SONAR_TOKEN }}');
  });
  it('every bundled template renders with the variables sync provides: the root and both sides', () => {
    assert.equal(renderTargets(APP, PRESETS).length, ['app', 'be', 'fe'].reduce((count, scope) => count + targetsOf(scope).length, 0));
  });
});

describe('hfs.json validation', () => {
  it('accepts an app and refuses everything else, the standalone back-end and front-end kinds included', () => {
    assert.doesNotThrow(() => validateHfs(APP));
    for (const bad of [null, { ...APP, hfs: 1 }, { ...APP, kind: 'be' }, { ...APP, project: 'Todo App Be' }, app({ fe: { apps: [] } }), app({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'core', kind: 'cli' }] } }),
      { hfs: 2, profile: 'be', project: 'nivo', apps: [{ name: 'core', kind: 'api' }] }, { ...APP, stacks: '../todo-app-be' }]) {
      assert.throws(() => validateHfs(bad), /HFS_SYNC_HFS_INVALID/);
    }
  });
  it('refuses a declaration the canons would refuse, so a pin bump never leaves eslint unable to start', () => {
    // the pre-2.0 connections shape (names only) is what broke eslint in a product repo after a pin bump
    assert.throws(() => validateHfs(app({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: ['primary', 'my-app'] } })), /HFS_SYNC_HFS_INVALID: .*connections must be a list/);
    assert.doesNotThrow(() => validateHfs(app({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' }, { name: 'my-app', envPrefix: 'MY_APP_DB', owner: 'core', isolation: 'database' }] } })));
  });
});

describe('the generated file set', () => {
  it('the root owns the package scripts, prettier, hooks, workflows, Sonar, Codecov and the .gitignore and .starciwork/.gitignore; each side owns its tool configuration', () => {
    assert.deepEqual(Object.keys(rendered()).sort(), [
      '.dockerignore', '.github/workflows/ci.yml', '.github/workflows/e2e.yml', '.github/workflows/images.yml', '.gitignore', '.husky/pre-commit', '.husky/pre-push', '.prettierignore', '.prettierrc', '.starciwork/.gitignore',
      'be/eslint.config.mjs', 'be/jest.config.js', 'be/src/tests/tsconfig.json', 'be/tsconfig.build.json', 'be/tsconfig.json',
      'codecov.yml', 'fe/eslint.config.mjs', 'fe/stylelint.config.mjs', 'fe/tsconfig.json', 'package.json', 'sonar-project.properties', 'turbo.json',
    ]);
  });
  it('the file list is the managedBy slots of the manifest, not code: each listed file is a literal path of a slot naming managedBy, the side ones under the side folder', () => {
    const manifest = loadSlotManifest();
    const listed = manifest.slots.filter(slot => slot.managedBy !== undefined).flatMap(slot => slot.profiles.flatMap(scope => braceVariants(slot.path).map(file => (scope === 'app' ? file : `${scope}/${file}`))));
    for (const file of listed) assert.ok(rendered()[file] !== undefined, `${file} is rendered`);
    assert.deepEqual(Object.keys(rendered()).filter(file => !listed.includes(file)).sort(), ['.gitignore', '.starciwork/.gitignore'], 'only the block of a shared file and the file inside the .starciwork directory slot are unlisted');
  });
  it('the fe side renders the two one-line configurations exactly, and its tsconfig is the one preset', () => {
    const files = rendered();
    assert.equal(files['fe/eslint.config.mjs'], 'import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"\n\nexport default starciFeConfig({ hfs: loadHfs(import.meta.url) })\n');
    assert.equal(files['fe/stylelint.config.mjs'], 'import { loadAppTokens, starciStylelintConfig } from "@starci/stylelint-canon"\n\nexport default starciStylelintConfig({ appTokens: loadAppTokens(import.meta.url) })\n');
    for (const gone of ['fe/vitest.config.ts', 'fe/codecov.yml', 'be/codecov.yml', 'fe/tsconfig.e2e.json', 'fe/package.json', 'be/package.json']) assert.equal(files[gone], undefined, `${gone} is not rendered`);
    assert.equal(files['.prettierrc'], '"@starci/prettier-config"\n');
    assert.deepEqual(JSON.parse(files['fe/tsconfig.json']), { extends: '@starci/tsconfig/next.json', exclude: ['node_modules'] });
  });
  it('a slot that names managedBy for a file with no template, or with a glob path, is refused', () => {
    const slot = (path, managedBy = 'tool-config') => ({ ...loadSlotManifest(), slots: [{ id: 'x', profiles: ['be'], path, managedBy }] });
    assert.throws(() => targetsOf('be', { manifest: slot('nothing.json') }), /HFS_SYNC_TEMPLATE_MISSING.*nothing\.json/);
    assert.throws(() => targetsOf('be', { manifest: slot('src/**') }), /HFS_SYNC_MANIFEST_MANAGED/);
    assert.throws(() => targetsOf('be', { manifest: slot('tsconfig.json', 'no-such-group') }), /HFS_SYNC_TEMPLATE_MISSING/);
  });
  it('every target hashes its own content', () => {
    for (const target of renderTargets(APP, PRESETS)) assert.equal(target.hash, hashOf(target.content));
  });
});

describe('.husky/pre-commit', () => {
  it('runs work hygiene, typecheck, the staged eslint of each side from its folder, stylelint over the staged fe css, prettier and the be unit specs of staged files, never integration, e2e or contract', () => {
    const hook = rendered()['.husky/pre-commit'];
    for (const step of ['npx starci app hygiene', 'npm run typecheck', '(cd be && npx eslint $be)', '(cd fe && npx eslint --max-warnings=0 --no-warn-ignored $fe)', '(cd fe && npx stylelint $styles)', 'npx prettier --check --ignore-unknown $formatted', 'npm run test:affected -- --findRelatedTests $specs']) assert.ok(hook.includes(step), step);
    assert.doesNotMatch(hook, /lint-staged|test:(e2e|integration|contract)|typecheck:tests|selectProjects (e2e|integration|contract)|playwright|vitest/);
  });
});

describe('.husky/pre-push', () => {
  it('runs typecheck, the one lint, format and the affected be unit specs, and never e2e', () => {
    const hook = rendered()['.husky/pre-push'];
    for (const step of ['npm run typecheck', 'npm run lint', 'npm run format:check', 'npm run test:affected -- --changedSince=origin/main']) assert.ok(hook.includes(step), step);
    assert.doesNotMatch(hook, /test:(e2e|integration|contract)|typecheck:tests|playwright/);
  });
  it('a hook and a workflow call only scripts the managed package.json defines', () => {
    const scripts = scriptsOf();
    for (const hook of ['.husky/pre-commit', '.husky/pre-push', '.github/workflows/ci.yml', '.github/workflows/e2e.yml']) {
      for (const [, name] of rendered()[hook].matchAll(/npm run ([\w:-]+)/g)) assert.ok(name in scripts, `${hook} runs npm run ${name}`);
    }
  });
});

describe('.github/workflows', () => {
  it('ci.yml runs the one lint, format, typecheck, unit, the coverage upload, both builds and Sonar, with no e2e', () => {
    const text = rendered()['.github/workflows/ci.yml'];
    const doc = parseYaml(text);
    assert.deepEqual(Object.keys(doc.on).sort(), ['pull_request', 'push']);
    assert.deepEqual(doc.on.push.branches, ['main']);
    const runs = doc.jobs.ci.steps.map(step => step.run).filter(Boolean);
    for (const command of ['npm ci', 'npm run lint -- --sonar reports/lint.sonar.json', 'npm run format:check', 'npm run typecheck', 'npm test -- --ci', 'npm run build:be', 'npm run build:fe']) assert.ok(runs.includes(command), command);
    assert.ok(!runs.some(command => command.includes('starci app sync')), 'starci app check is the one drift gate; there is no second sync step');
    assert.doesNotMatch(text, /starci link|STARCI_HOME|starci-runtime/);
    const uses = doc.jobs.ci.steps.map(step => step.uses).filter(Boolean);
    assert.ok(uses.some(use => use.startsWith('SonarSource/sonarqube-scan-action')));
    assert.ok(uses.some(use => use.startsWith('SonarSource/sonarqube-quality-gate-action')));
    const upload = doc.jobs.ci.steps.find(step => String(step.uses ?? '').startsWith('codecov/'));
    assert.deepEqual(upload.with, { token: '${{ env.CODECOV_TOKEN }}', files: 'be/coverage/lcov.info', disable_search: true, fail_ci_if_error: true }, 'the one upload: the be lcov, with the CODECOV_TOKEN secret');
    assert.equal(doc.jobs.ci.env.CODECOV_TOKEN, '${{ secrets.CODECOV_TOKEN }}');
    assert.ok(doc.jobs.ci.steps.findIndex(step => step === upload) > doc.jobs.ci.steps.findIndex(step => step.run === 'npm test -- --ci'), 'the upload follows the unit run');
    assert.equal(doc.permissions['id-token'], undefined);
    assert.doesNotMatch(text, /vitest|e2e/);
    assert.match(text, /node-version: 22/);
  });
  it('the e2e workflow is dispatched by hand, runs the be test:e2e and installs no browser', () => {
    const doc = parseYaml(rendered()['.github/workflows/e2e.yml']);
    assert.deepEqual(Object.keys(doc.on), ['workflow_dispatch']);
    assert.ok(doc.jobs.e2e.steps.some(step => step.run === 'npm run test:e2e'));
    assert.doesNotMatch(rendered()['.github/workflows/e2e.yml'], /playwright/);
  });
});

describe('.gitignore', () => {
  const block = () => rendered()['.gitignore'];
  it('carries the HFS never-tracked list of both sides and .starci/, inside the managed block', () => {
    const text = block();
    assert.ok(text.startsWith(`${BLOCK_BEGIN}\n`) && text.endsWith(`${BLOCK_END}\n`));
    for (const entry of ['node_modules/', 'dist/', 'coverage/', '.scannerwork/', 'test-results/', '*.tsbuildinfo', '.turbo/', '.tools/', '.env', '.env.*', '!.env.example', 'report*.json', 'nul', '.artifacts/', '.starci/', 'schema.gql', '.next/', 'next-env.d.ts']) {
      assert.ok(text.split('\n').includes(entry), entry);
    }
  });
  it('carries the .starcistacks custody rules of modules/schemas/stacks-layout.yaml in order, rooted at the app root and never under be/', () => {
    const rules = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/stacks-layout.yaml'), 'utf8')).custody.gitignoreRules;
    const lines = block().split('\n');
    const start = lines.indexOf(rules[0]);
    assert.ok(start > 0, 'the custody block is in the managed block');
    assert.deepEqual(lines.slice(start, start + rules.length), rules, 'every custody rule, in the stacks-layout order');
    assert.ok(!lines.some(line => /(^|!)be\/\.starcistacks/.test(line)), 'no rule names the side form be/.starcistacks');
  });
});

describe('sonar-project.properties', () => {
  const properties = text => Object.fromEntries(text.split('\n').filter(line => line && !line.startsWith('#')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  it('one file for the app: both sides as sources, the be specs as tests, the preset exclusions, one import path and the services\' coverage', () => {
    const app = properties(rendered()['sonar-project.properties']);
    assert.equal(app['sonar.exclusions'], `${jestPreset.sonarExclusions()},**/.next/**,**/node_modules/**,**/src/messages/**`);
    assert.deepEqual(Object.keys(app).filter(key => /coverage|lcov/i.test(key)).sort(), ['sonar.coverage.exclusions', 'sonar.javascript.lcov.reportPaths'], 'the lcov import and the complement of the services, no other coverage key (Sonar has no coverage inclusions)');
    assert.equal(app['sonar.javascript.lcov.reportPaths'], 'be/coverage/lcov.info');
    const exclusions = app['sonar.coverage.exclusions'].split(',');
    assert.deepEqual(exclusions, coverageExclusions(PRESETS));
    for (const glob of ['fe/**', 'be/**/*.resolver.ts', 'be/**/*.module.ts', 'be/**/*.mapper.ts', 'be/**/*.handler.ts', 'be/**/*.controller.ts', 'be/**/*.config.ts', 'be/**/*.error.ts', 'be/**/*.entity.ts', 'be/**/*.spec.ts', 'be/apps/*/src/main.ts', 'be/src/modules/domain/*/persistence/migrations/*-*.ts', 'be/src/tests/world/kit/*.ts'])
      assert.ok(exclusions.includes(glob), `${glob} is outside coverage`);
    assert.ok(!exclusions.some(glob => glob.endsWith('*.service.ts')), 'the services are the one thing left in scope');
    assert.equal(app['sonar.projectKey'], 'nivo');
    assert.equal(app['sonar.sources'], 'be/apps,be/src,fe/apps');
    assert.equal(app['sonar.tests'], 'be/apps,be/src');
    assert.equal(app['sonar.typescript.tsconfigPaths'], 'be/tsconfig.json,fe/apps/app/tsconfig.json,fe/apps/admin/tsconfig.json');
    // One import path for every engine (starci app lint): Sonar's own ESLint import is not used, it drops issues on files outside sonar.sources.
    assert.ok(!('sonar.eslint.reportPaths' in app));
    assert.equal(app['sonar.externalIssuesReportPaths'], 'reports/lint.sonar.json');
    assert.ok(!('sonar.host.url' in app), 'the host is SONAR_HOST_URL, never a property (R11)');
  });
  it('the sources and the tsconfig paths include fe/packages/ exactly when the fe side opts into a package slot', () => {
    const of = optionalSlots => properties(rendered(app({ fe: { apps: [{ name: 'app', kind: 'next' }, { name: 'admin', kind: 'next' }], ...(optionalSlots ? { optionalSlots } : {}) } }))['sonar-project.properties']);
    for (const slots of [['repo.packages'], ['fe.package.ui'], ['fe.package.api', 'fe.package.i18n']]) {
      assert.equal(of(slots)['sonar.sources'], 'be/apps,be/src,fe/apps,fe/packages', slots.join());
      assert.equal(of(slots)['sonar.typescript.tsconfigPaths'], 'be/tsconfig.json,fe/apps/app/tsconfig.json,fe/apps/admin/tsconfig.json,fe/packages/*/tsconfig.json');
    }
    for (const slots of [undefined, [], ['repo.docs']]) assert.equal(of(slots)['sonar.sources'], 'be/apps,be/src,fe/apps', String(slots));
  });
  it('Sonar and Codecov read ONE coverage scope: both are rendered from the preset\'s COVERAGE_SOURCES and agree', () => {
    for (const hfs of [APP, app({ fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['repo.packages'] } })]) {
      const files = rendered(hfs);
      const sonar = properties(files['sonar-project.properties'])['sonar.coverage.exclusions'].split(',');
      const codecov = parseYaml(files['codecov.yml']);
      const scope = jestPreset.COVERAGE_SOURCES.map(glob => `be/${glob}`);
      assert.deepEqual(sonar, coverageExclusions(PRESETS), 'Sonar reads the complement of the scope');
      assert.deepEqual(codecov.coverage.status.project.default.paths, scope, 'the codecov project status reads the scope');
      assert.deepEqual(codecov.coverage.status.patch.default.paths, scope, 'the codecov patch status reads the scope');
      assert.deepEqual([codecov.coverage.status.project.default.target, codecov.coverage.status.patch.default.target], ['100%', '100%']);
      assert.deepEqual(codecov.ignore, ['fe/**'], 'fe/ is outside coverage');
    }
    // A preset with another source list moves both files together: the scope is never written twice.
    const moved = Object.fromEntries(renderTargets(APP, { ...PRESETS, coverageSources: ['src/**/*.domain.ts'] }).map(target => [target.path, target.content]));
    const movedExclusions = properties(moved['sonar-project.properties'])['sonar.coverage.exclusions'].split(',');
    assert.ok(movedExclusions.includes('be/**/*.service.ts') && !movedExclusions.some(glob => glob.endsWith('*.domain.ts')), 'the complement moves with the sources');
    assert.deepEqual(parseYaml(moved['codecov.yml']).coverage.status.project.default.paths, ['be/src/**/*.domain.ts']);
    assert.throws(() => renderTargets(APP, { ...PRESETS, coverageSources: ['src/core/**'] }), /HFS_SYNC_COVERAGE_SCOPE/, 'a source whose complement Sonar globs cannot write is refused');
    assert.throws(() => renderTargets(APP, { sonarExclusions: PRESETS.sonarExclusions }), /HFS_SYNC_PRESET_MISSING/, 'no coverage sources is a refusal, never an empty scope');
  });
});

describe('the Sonar key', () => {
  const declaration = key => ({ services: { sonar: { projects: [{ repository: 'nivo', key }, { repository: 'other', key: 'other-key' }] } } });
  const declared = (t, name) => {
    const dir = repo(t);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name }));
    fs.mkdirSync(path.join(dir, '.starcistacks'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starcistacks', 'application-stacks.yaml'), 'stack');
    return dir;
  };
  const sync = (mode, dir, parseYaml, out = () => {}) => runSync([mode], { cwd: dir, out, presets: PRESETS, parseYaml });
  it('is derived from hfs.json when no stack declaration names one', () => {
    assert.match(rendered()['sonar-project.properties'], /^sonar.projectKey=nivo$/m);
  });
  it('is the key services.sonar of .starcistacks declares for this app', async t => {
    const dir = declared(t, 'nivo');
    assert.equal(await sync('--write', dir, () => declaration('gh/starci-lab/nivo')), 0);
    assert.match(fs.readFileSync(path.join(dir, 'sonar-project.properties'), 'utf8'), /^sonar.projectKey=gh\/starci-lab\/nivo$/m);
    assert.equal(await sync('--check', dir, () => declaration('gh/starci-lab/nivo')), 0);
    assert.equal(await sync('--check', dir, () => declaration('changed')), 1, 'a changed declaration is drift');
  });
  it('falls back to the derived key when the declaration lists other repositories only', async t => {
    const dir = declared(t, 'mine');
    assert.deepEqual(declaredSonarKeys(declaration('k'), 'mine'), []);
    assert.equal(await sync('--write', dir, () => declaration('k')), 0);
    assert.match(fs.readFileSync(path.join(dir, 'sonar-project.properties'), 'utf8'), /^sonar.projectKey=nivo$/m);
  });
  it('refuses two keys for one app', async t => {
    const dir = declared(t, 'mine');
    const lines = [];
    const two = { services: { sonar: { projects: [{ repository: 'mine', key: 'a' }, { repository: 'mine', key: 'b' }] } } };
    assert.equal(await sync('--check', dir, () => two, line => lines.push(line)), 1);
    assert.match(lines[0], /HFS_SYNC_SONAR_KEY.*a, b/);
  });
  it('reads the real stack declaration shape with the YAML parser bundled in the package; an app without one has no declared key', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stacks-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const fail = message => { throw new Error(message); };
    assert.equal(await readDeclaredSonarKey(dir, { fail }), null);
    fs.mkdirSync(path.join(dir, '.starcistacks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'nivo-backend' }));
    fs.copyFileSync(path.join(ROOT, 'examples', 'starcistacks-services', 'nivo-backend.services.yaml'), path.join(dir, '.starcistacks', 'application-stacks.yaml'));
    assert.equal(await readDeclaredSonarKey(dir, { fail }), 'nivo-backend');
  });
});

describe('.starciwork/.gitignore', () => {
  it('is the boundary allowlist byte for byte, with no generated-by header', () => {
    assert.equal(rendered()['.starciwork/.gitignore'], starciworkGitignoreText());
  });
});

describe('loading the presets an app installs', () => {
  it('resolves the be test preset from the app node_modules', async t => {
    const dir = repo(t);
    fs.cpSync(path.join(ROOT, 'packages', 'jest-preset'), path.join(dir, 'node_modules', '@starci', 'jest-preset'), { recursive: true });
    assert.deepEqual(await loadPresets(dir), PRESETS);
  });
  it('names the missing preset and the command that installs it', async t => {
    await assert.rejects(loadPresets(repo(t)), /HFS_SYNC_PRESET_MISSING.*@starci\/jest-preset.*canon-pins\.yaml/);
  });
});

describe('the drift check', () => {
  const count = renderTargets(APP, PRESETS).length;
  it('--write creates every file of the root and both sides and --check then passes', async t => {
    const dir = repo(t);
    assert.equal((await run(['--check'], dir)).code, 1, 'nothing is written yet');
    const written = await run(['--write'], dir);
    assert.equal(written.code, 0);
    assert.match(written.lines.at(-1), new RegExp(`${count} written, 0 already in sync`));
    for (const file of ['be/tsconfig.json', 'fe/eslint.config.mjs', '.husky/pre-push']) assert.ok(fs.existsSync(path.join(dir, file)), file);
    const checked = await run(['--check'], dir);
    assert.equal(checked.code, 0);
    assert.match(checked.lines.at(-1), new RegExp(`${count} of ${count} in sync`));
  });
  it('a hand edit fails --check with the file, the hashes and the first differing line, and --write repairs it', async t => {
    const dir = repo(t);
    await run(['--write'], dir);
    const file = path.join(dir, 'sonar-project.properties');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('sonar.sourceEncoding=UTF-8', 'sonar.sourceEncoding=UTF-16'));
    const failed = await run(['--check'], dir);
    assert.equal(failed.code, 1);
    assert.match(failed.lines[0], /^HFS_SYNC_DRIFT sonar-project\.properties: drift, expected sha256 [0-9a-f]{12}, found [0-9a-f]{12} \(line \d+: expected .*UTF-8/);
    const repaired = await run(['--write'], dir);
    assert.match(repaired.lines[0], /^wrote sonar-project\.properties$/);
    assert.equal((await run(['--check'], dir)).code, 0);
  });
  it('a deleted file of a side is reported missing under its app path', async t => {
    const dir = repo(t);
    await run(['--write'], dir);
    fs.rmSync(path.join(dir, 'fe', 'stylelint.config.mjs'));
    const failed = await run(['--check'], dir);
    assert.equal(failed.code, 1);
    assert.match(failed.lines[0], /^HFS_SYNC_DRIFT fe\/stylelint\.config\.mjs: missing/);
  });
  it('CRLF checkouts are not drift', async t => {
    const dir = repo(t);
    await run(['--write'], dir);
    const file = path.join(dir, '.github', 'workflows', 'ci.yml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    assert.equal((await run(['--check'], dir)).code, 0);
  });
  it('an app change in hfs.json is drift until --write', async t => {
    const dir = repo(t);
    await run(['--write'], dir);
    fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(app({ fe: { apps: [...APP.sides.fe.apps, { name: 'docs', kind: 'next' }] } })));
    const failed = await run(['--check'], dir);
    assert.ok(failed.lines.some(line => /^HFS_SYNC_DRIFT sonar-project\.properties/.test(line)), 'the sonar tsconfig paths name the new app');
    assert.ok(failed.lines.some(line => /^HFS_SYNC_DRIFT package\.json/.test(line)), 'the scripts gain dev and start for the new app');
  });
  it('an app .gitignore keeps its own lines; only the managed block is compared and rewritten', async t => {
    const dir = repo(t);
    const file = path.join(dir, '.gitignore');
    fs.writeFileSync(file, 'my-scratch/\n');
    await run(['--write'], dir);
    let text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith(BLOCK_BEGIN) && text.endsWith('my-scratch/\n'));
    fs.writeFileSync(file, `${text}later-line/\n`);
    assert.equal((await run(['--check'], dir)).code, 0, 'lines outside the block are the app\'s');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('dist/', 'build/'));
    assert.equal((await run(['--check'], dir)).code, 1);
    await run(['--write'], dir);
    text = fs.readFileSync(file, 'utf8');
    assert.ok(text.includes('dist/') && !text.includes('build/') && text.includes('later-line/') && text.includes('my-scratch/'));
  });
  it('exits 2 without exactly one mode, and 1 on an invalid or standalone hfs.json', async t => {
    const dir = repo(t);
    assert.equal((await run([], dir)).code, 2);
    assert.equal((await run(['--check', '--write'], dir)).code, 2);
    assert.equal((await run(['--init'], dir)).code, 2, 'starci app sync --init is gone: starci app scaffold writes the first tree');
    fs.writeFileSync(path.join(dir, 'hfs.json'), '{"hfs":1,"profile":"be"}');
    assert.equal((await run(['--check'], dir)).code, 1);
  });
  it('checkTargets and writeTargets agree with the rendered hashes', t => {
    const dir = repo(t);
    const targets = renderTargets(APP, PRESETS);
    assert.ok(checkTargets(dir, targets).every(result => result.status === 'missing'));
    writeTargets(dir, targets);
    assert.deepEqual(checkTargets(dir, targets).map(result => result.actualHash), targets.map(target => target.hash));
  });
});

describe('the be side tool configuration', () => {
  const at = file => rendered()[`be/${file}`];
  it('eslint.config.mjs is exactly the one-liner', () => {
    assert.equal(at('eslint.config.mjs'), 'import { loadHfs, starciBeConfig } from "@starci/eslint-canon-be"\n\nexport default starciBeConfig({ hfs: loadHfs(import.meta.url) })\n');
  });
  it('tsconfig.json extends the preset, adds only the three aliases and excludes the world, integration, e2e and contract trees; the build and tests configs add only what a preset cannot hold', () => {
    assert.deepEqual(JSON.parse(at('tsconfig.json')), { extends: '@starci/tsconfig/be.json', compilerOptions: { paths: { '@features/*': ['./src/features/*'], '@modules/*': ['./src/modules/*'], '@tests/*': ['./src/tests/*'] } }, exclude: ['node_modules', 'dist', 'src/tests/world', 'src/tests/integration', 'src/tests/e2e', 'src/tests/contract'] });
    assert.deepEqual(JSON.parse(at('tsconfig.build.json')), { extends: ['./tsconfig.json', '@starci/tsconfig/build.json'], compilerOptions: { outDir: './dist' }, exclude: ['node_modules', 'dist', '**/*.spec.ts', 'src/tests'] });
    assert.deepEqual(JSON.parse(at('src/tests/tsconfig.json')), { extends: ['../../tsconfig.json', '@starci/tsconfig/e2e.json'], include: ['./**/*.ts'], exclude: [] });
  });
  it('jest.config.js is the preset call, the root .prettierrc references the shared config, and neither carries a header comment', () => {
    assert.equal(at('jest.config.js'), 'module.exports = require("@starci/jest-preset").starciJestConfig()\n');
    assert.equal(rendered()['.prettierrc'], '"@starci/prettier-config"\n');
  });
  it('the root .prettierignore is the template, headed as generated', () => {
    const text = rendered()['.prettierignore'];
    assert.match(text, /^# Generated by starci app sync \(app root\)/);
    assert.deepEqual(text.split('\n').filter(line => line && !line.startsWith('#')), ['node_modules/', 'dist/', 'coverage/', 'reports/', '.next/', '.starci/', 'package-lock.json', 'contracts/', '.starcistacks/', '.starciwork/', '**/__generated__/', '**/messages/**']);
  });
  it('the presets the templates name exist and export what they call', () => {
    const ROOT_PACKAGES = path.join(ROOT, 'packages');
    for (const [name, file] of [['tsconfig', 'be.json'], ['tsconfig', 'build.json'], ['tsconfig', 'e2e.json'], ['tsconfig', 'next.json']]) assert.ok(fs.existsSync(path.join(ROOT_PACKAGES, name, file)), file);
    assert.equal(typeof jestPreset.starciJestConfig, 'function');
    assert.ok(fs.existsSync(path.join(ROOT_PACKAGES, 'prettier-config', 'index.cjs')));
    assert.ok(fs.existsSync(path.join(ROOT_PACKAGES, 'eslint', 'be', 'lib', 'config.mjs')));
  });
});

describe('the package.json scripts of the app', () => {
  it('are the fixed scripts of both sides, a be script run from be/, an fe script through its workspace, plus dev, start per app and the cli', () => {
    const scripts = scriptsOf();
    assert.deepEqual(Object.keys(scripts).sort(), ['build:be', 'build:fe', 'cli', 'codegen', 'contract:emit', 'dev:be', 'dev:fe:admin', 'dev:fe:app', 'docker:build', 'docker:build:admin', 'docker:build:app', 'docker:build:cli', 'docker:build:core', 'format', 'format:check', 'lint', 'lint:fix', 'prepare', 'start:admin', 'start:app', 'start:core', 'test', 'test:affected', 'test:contract', 'test:e2e', 'test:integration', 'test:stack', 'typecheck', 'typecheck:tests']);
    assert.equal(scripts['start:core'], 'node be/dist/apps/core/src/main.js');
    assert.equal(scripts.cli, 'node be/dist/apps/cli/src/main.js', 'the cli app runs a command: npm run cli -- <group> <command>');
    assert.equal(scripts.migrate, undefined, 'no connection, nothing to migrate');
    const withDb = scriptsOf(app({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' }] } }));
    assert.equal(withDb.migrate, 'node be/dist/apps/cli/src/main.js migrate run', 'a back end with a connection migrates through the cli migrate command');
    assert.equal(scripts['dev:be'], 'cd be && ts-node-dev --respawn -r tsconfig-paths/register apps/core/src/main.ts');
    assert.equal(scripts['dev:fe:app'], 'npm run codegen --silent && turbo run dev --filter=@nivo/app', 'turbo runs the workspace @<project>/<app> after the packages it imports');
    assert.equal(scripts['start:app'], 'npm run start -w @nivo/app');
    assert.equal(scripts.test, 'cd be && jest --selectProjects unit --coverage');
    assert.equal(scripts['test:stack'], 'starci app stack');
    for (const project of ['integration', 'e2e', 'contract']) assert.equal(scripts[`test:${project}`], `npm run typecheck:tests && cd be && jest --selectProjects ${project}`);
    assert.equal(scripts['typecheck:tests'], 'tsc -p be/src/tests/tsconfig.json');
    assert.equal(scripts.lint, 'npm run codegen --silent && starci app lint', 'one lint gate over both sides, stylelint and the app checks');
    assert.equal(scripts['lint:fix'], scripts.lint.replace('starci app lint', 'starci app lint --fix'));
    assert.equal(scripts['build:fe'], 'npm run codegen --silent && turbo run build --filter=./fe/apps/*', 'turbo builds every fe app workspace, the packages first (^build)');
    assert.doesNotMatch(Object.values(scripts).join('\n'), /--rule|--no-inline-config|--no-eslintrc|--ignore-pattern|vitest|playwright|scripts\/check-/);
  });
  it('typecheck runs the be tsc, then every fe workspace typecheck through turbo, which builds the packages an app imports first (^build in turbo.json)', () => {
    const typecheck = 'npm run codegen --silent && tsc -p be/tsconfig.json && turbo run typecheck';
    assert.equal(scriptsOf(app({ fe: { apps: [{ name: 'app', kind: 'next' }], optionalSlots: ['fe.package.ui'] } })).typecheck, typecheck);
    assert.equal(scriptsOf(app({ fe: { apps: [{ name: 'app', kind: 'next' }] } })).typecheck, typecheck, 'with or without packages: the task graph decides');
    const graph = JSON.parse(rendered()['turbo.json']);
    assert.deepEqual(graph.tasks.typecheck.dependsOn, ['^build']);
    assert.deepEqual(graph.tasks.build.dependsOn, ['^build']);
    assert.deepEqual(Object.keys(graph.tasks).sort(), ['build', 'dev', 'lint', 'typecheck']);
  });
  it('one api app and one Next app take the unsuffixed dev scripts; every api and worker app gets a start script, the cli app the cli script', () => {
    const one = scriptsOf(app({ fe: { apps: [{ name: 'web', kind: 'next' }] } }));
    assert.equal(one['dev:fe'], 'npm run codegen --silent && turbo run dev --filter=@nivo/web');
    const many = scriptsOf(app({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'order', kind: 'api' }, { name: 'jobs', kind: 'worker' }, { name: 'cli', kind: 'cli' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' }] } }));
    assert.deepEqual(Object.keys(many).filter(name => /^(start|migrate|cli)/.test(name)).sort(), ['cli', 'migrate', 'start:admin', 'start:app', 'start:core', 'start:jobs', 'start:order']);
    assert.match(appScripts(validateHfs(app({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'x', kind: 'cli' }] } }))), /"cli": "node be\/dist\/apps\/x\/src\/main\.js",/);
  });
  it('build the image of every app, one after the other and never pushing: docker:build:<app> is the command the Dockerfile header states', () => {
    const many = scriptsOf(app({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }] } }));
    assert.equal(many['docker:build:core'], 'docker build -f be/apps/core/Dockerfile -t nivo/core:dev .');
    assert.equal(many['docker:build:cli'], 'docker build -f be/apps/cli/Dockerfile -t nivo/cli:dev .');
    assert.equal(many['docker:build:app'], 'docker build -f fe/apps/app/Dockerfile -t nivo/app:dev .');
    const all = many['docker:build'].split(' && ');
    assert.deepEqual(all, ['core', 'cli', 'app', 'admin'].map(name => `npm run docker:build:${name}`));
    assert.ok(Object.values(many).every(command => !/--push|docker push/.test(command)), 'no managed script pushes an image');
  });
  it('are compared as parsed JSON: key order and the rest of package.json are not drift, an extra or changed script is', async t => {
    const dir = repo(t);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo', dependencies: { a: '1' }, scripts: { legacy: 'x' } }, null, 4));
    await run(['--write'], dir);
    const pkg = () => JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg().name, 'demo');
    assert.deepEqual(pkg().dependencies, { a: '1' });
    assert.equal(pkg().scripts.legacy, undefined, 'a script outside the managed block is dropped by --write');
    assert.equal((await run(['--check'], dir)).code, 0);
    const reordered = { ...pkg(), scripts: Object.fromEntries(Object.entries(pkg().scripts).reverse()) };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(reordered));
    assert.equal((await run(['--check'], dir)).code, 0, 'order is not drift');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ ...pkg(), scripts: { ...pkg().scripts, extra: 'eslint --rule x' } }));
    const failed = await run(['--check'], dir);
    assert.equal(failed.code, 1);
    assert.match(failed.lines[0], /^HFS_SYNC_DRIFT package\.json: drift/);
  });
});

describe('work-hygiene', () => {
  it('refuses agent output under .starciwork and plaintext secrets under a .starcistacks tree', () => {
    const ignored = new Set(['.starciwork/features/a/evidence/run.json']);
    const findings = hygieneFindings([
      '.starciwork/features/a/index.yaml', '.starciwork/features/a/evidence/run.json',
      '.starcistacks/dev/secrets/db.enc', '.starcistacks/dev/secrets/db.txt', '.starcistacks/dev/infra/.env', '.starcistacks/dev/infra/.env.example', '.starcistacks/dev/infra/tls.pem',
    ], ignored);
    assert.deepEqual(findings.map(finding => [finding.file, finding.code]), [
      ['.starciwork/features/a/evidence/run.json', 'HFS_WORK_AGENT_DATA'],
      ['.starcistacks/dev/secrets/db.txt', 'HFS_PLAINTEXT_SECRET'],
      ['.starcistacks/dev/infra/.env', 'HFS_PLAINTEXT_SECRET'],
      ['.starcistacks/dev/infra/tls.pem', 'HFS_PLAINTEXT_SECRET'],
    ]);
  });
  it('is the secrets guard of the commit: a staged file of any tree with a secret value, or an .enc that is no envelope, is refused from the index, and a clean or sealed file passes', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-guard-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    git('init', '-q');
    const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
    const awsKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
    const sealed = 'ENC[AES256_GCM,data:YWJj,iv:ZGVm,tag:Z2hp,type:str]';
    put('be/src/config.ts', `export const key = '${awsKey}';\n`);
    put('.starcistacks/dev/secrets/db.enc', 'password=hunter2\n');
    put('be/src/clean.ts', 'export const a = 1;\n');
    put('.starcistacks/dev/secrets/sealed.enc', JSON.stringify({ data: sealed, sops: { mac: sealed, age: [] } }));
    git('add', '-A');
    put('be/src/config.ts', 'export const key = 1;\n');   // the work tree is clean; the index still holds the secret
    const lines = [];
    assert.equal(await runWorkHygiene({ cwd: dir, out: line => lines.push(line) }), 1);
    const refused = lines.filter(line => line.startsWith('HFS_PLAINTEXT_SECRET')).map(line => line.split(' ')[1]).sort();
    assert.deepEqual(refused, ['.starcistacks/dev/secrets/db.enc', 'be/src/config.ts']);
    assert.ok(!lines.join('\n').includes(awsKey), 'a finding never prints the value');
    git('reset', '-q', 'be/src/config.ts', '.starcistacks/dev/secrets/db.enc');
    assert.equal(await runWorkHygiene({ cwd: dir, out: () => {} }), 0);
  });
  it('asks git which .starciwork files the generated allowlist ignores', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-hygiene-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    git('init', '-q');
    fs.mkdirSync(path.join(dir, '.starciwork', 'features', 'login', 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starciwork', '.gitignore'), starciworkGitignoreText());
    fs.writeFileSync(path.join(dir, '.starciwork', 'features', 'login', 'index.yaml'), 'schema: x\n');
    fs.writeFileSync(path.join(dir, '.starciwork', 'features', 'login', 'evidence', 'run.log'), 'log\n');
    git('add', '-f', '.starciwork');
    const lines = [];
    assert.equal(await runWorkHygiene({ cwd: dir, out: line => lines.push(line) }), 1);
    assert.match(lines[0], /^HFS_WORK_AGENT_DATA \.starciwork\/features\/login\/evidence\/run\.log/);
    git('rm', '-q', '--cached', '.starciwork/features/login/evidence/run.log');
    assert.equal(await runWorkHygiene({ cwd: dir, out: () => {} }), 0);
  });
  it('reports the state-root ledger findings when run from inside a full runtime checkout, and stays silent standalone', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-hygiene-ledger-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
    // This temp repo is no runtime checkout — its root carries no scripts/housekeeping/ledger-hygiene.mjs: the section is silently absent.
    const lines = [];
    assert.equal(await runWorkHygiene({ cwd: dir, out: line => lines.push(line) }), 0);
    assert.ok(!lines.some(line => /LEDGER_(ORPHAN_STATE_ROOT|LEGACY_WORK_SQLITE)/.test(line)));
    // Run from the real checkout (this repo IS the runtime): the section runs and never throws, whatever it finds.
    const inRepo = [];
    await runWorkHygiene({ cwd: ROOT, out: line => inRepo.push(line), files: [] });
  });
});

describe('starci app scaffold: the first tree', () => {
  const scaffold = (t, name = 'nivo') => {
    const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-'));
    t.after(() => fs.rmSync(into, { recursive: true, force: true }));
    // The skeleton specs need no registry: the lock step is the npm run hfs-scaffold-app.spec proves; here it reports success.
    return scaffoldApp({ name, into, presets: PRESETS, lock: () => ({ ok: true }) });
  };
  const filesUnder = dir => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')).sort();
  const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

  it('writes the root, the be side and the fe side, already in sync, with one package.json at the root and the lockfile left to npm', async t => {
    const { root } = scaffold(t);
    const files = filesUnder(root);
    for (const file of ['hfs.json', 'package.json', 'README.md', '.gitignore', '.husky/pre-push', '.github/workflows/ci.yml', '.starciwork/features/index.yaml', '.starcistacks/application-stacks.yaml', '.sops.yaml', 'scripts/codegen.mjs',
      'be/nest-cli.json', 'be/tsconfig.json', 'be/apps/core/src/main.ts', 'be/apps/core/src/app.module.ts', 'be/apps/core/src/core.options.ts',
      'be/apps/cli/Dockerfile', 'be/apps/cli/src/main.ts', 'be/apps/cli/src/app.module.ts', 'be/apps/cli/src/cli.options.ts',
      'be/src/features/cli/index.ts', 'be/src/features/cli/cli.module.ts',
      'be/src/features/cli/migrate/migrate.cli.ts', 'be/src/features/cli/migrate/migrate.cli.spec.ts', 'be/src/features/cli/migrate/subs/run.cli.ts', 'be/src/features/cli/migrate/subs/run.cli.spec.ts',
      'be/src/features/cli/seed/seed.cli.ts', 'be/src/features/cli/seed/seed.cli.spec.ts', 'be/src/features/cli/seed/subs/run.cli.ts', 'be/src/features/cli/seed/subs/run.cli.spec.ts',
      'be/src/modules/platform/database/primary.connection.ts', 'be/src/modules/platform/database/primary.config.ts', 'be/src/modules/platform/database/primary.decorators.ts',
      'be/src/modules/domain/note/index.ts', 'be/src/modules/domain/note/note.service.ts', 'be/src/modules/domain/note/persistence/connection.ts',
      'be/src/modules/domain/note/persistence/entities/note.entity.ts', 'be/src/modules/domain/note/persistence/migrations/1790000000000-init-note.ts', '.starcistacks/dev/seeds/primary-notes.sql',
      'fe/tsconfig.json', ...['landing', 'app'].flatMap(name => [`fe/apps/${name}/next.config.ts`, `fe/apps/${name}/tsconfig.json`, `fe/apps/${name}/src/proxy.ts`, `fe/apps/${name}/src/app/[locale]/layout.tsx`]),
      ...['ui', 'i18n'].flatMap(pkg => [`fe/packages/nivo-${pkg}/package.json`, `fe/packages/nivo-${pkg}/tsconfig.json`, `fe/packages/nivo-${pkg}/tsconfig.build.json`, `fe/packages/nivo-${pkg}/src/index.ts`])]) assert.ok(files.includes(file), file);
    assert.ok(!files.some(file => /^be\/(.*\/)?package\.json$/.test(file)), 'the back end holds no package.json');
    assert.ok(!files.some(file => /^(be|fe)\/(.*\/)?package-lock\.json$/.test(file)), 'no side and no workspace holds a lockfile');
    assert.deepEqual(filesUnder(path.join(root, 'fe', 'apps')).map(file => file.split('/')[0]).filter((name, i, all) => all.indexOf(name) === i), ['app', 'landing'], 'the fe side has exactly the landing and the product app');
    for (const name of ['landing', 'app']) {
      const manifest = JSON.parse(read(root, `fe/apps/${name}/package.json`));
      assert.deepEqual([manifest.name, manifest.private, Object.keys(manifest.scripts).sort()], [`@${path.basename(root)}/${name}`, true, ['build', 'dev', 'lint', 'start', 'typecheck']], 'each fe app is a workspace with its own package.json');
      assert.deepEqual([manifest.dependencies['@nivo/ui'], manifest.dependencies['@nivo/i18n']], ['*', '*'], `${name} declares the shared workspace packages it imports`);
    }
    for (const pkg of ['ui', 'i18n']) {
      const manifest = JSON.parse(read(root, `fe/packages/nivo-${pkg}/package.json`));
      assert.deepEqual([manifest.name, manifest.private, manifest.scripts, manifest.exports['.'], manifest.types], [`@nivo/${pkg}`, true, { build: 'tsc -p tsconfig.build.json', lint: 'starci app lint --workspace .', typecheck: 'tsc --noEmit -p tsconfig.json' }, { types: './dist/index.d.ts', default: './dist/index.js' }, './dist/index.d.ts'], `@nivo/${pkg} is a private package built to dist`);
    }
    assert.deepEqual(JSON.parse(read(root, 'hfs.json')).sides.fe.optionalSlots, ['fe.package.ui', 'fe.package.i18n'], 'the shared packages are declared slots');
    const rootManifest = JSON.parse(read(root, 'package.json'));
    assert.deepEqual([rootManifest.workspaces, typeof rootManifest.packageManager, typeof rootManifest.devDependencies.turbo], [['fe/apps/*', 'fe/packages/*'], 'string', 'string'], 'the root is the monorepo root');
    const feOnly = ['next', 'next-intl', 'react', 'react-dom', '@starci/grammar', '@heroui/react', '@heroui/styles', 'server-only', '@nivo/ui', '@nivo/i18n'];
    assert.deepEqual(Object.keys(rootManifest.dependencies).filter(name => feOnly.includes(name)), [], 'the root runtime dependencies hold nothing fe-only: each fe workspace declares its own');
    assert.ok(files.includes('turbo.json'), 'the task graph sits at the app root');
    assert.ok(!files.includes('package-lock.json'), 'the scaffold writes no lockfile by hand: npm resolves it');
    // .starcistacks and its sops rule live at the app root, beside be/, fe/ and .starciwork; no side holds either.
    assert.ok(!files.some(file => /^(be|fe)\/(\.starcistacks\/|\.sops\.yaml$)/.test(file)), 'no side holds a .starcistacks or a .sops.yaml');
    const stacks = parseYaml(read(root, '.starcistacks/application-stacks.yaml'));
    assert.deepEqual([stacks.services.sonar.stack.owner, stacks.services.sonar.stack.root], ['host', '.claude/ext/sonar'], 'a host-owned Sonar, the standard shape');
    assert.equal(JSON.parse(read(root, 'hfs.json')).kind, 'app');
    // The managed test:stack script runs through starci app, while @starci/test-world remains pinned as the implementation.
    const manifest = JSON.parse(read(root, 'package.json'));
    assert.equal(manifest.scripts['test:stack'], 'starci app stack');
    assert.equal(manifest.devDependencies['@starci/test-world'], parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge/hfs/canon-pins.yaml'), 'utf8')).pins['@starci/test-world'].version);
    assert.equal(manifest.devDependencies['@starci/cli'], '1.0.0', 'the public CLI is an exact app devDependency');
    assert.equal(manifest.devDependencies['@starci/hfs'], undefined, 'the HFS implementation remains transitive through @starci/cli');
    // The Work tree names the two sides of the app as its repositories, the form of the examples and the work-layout contract.
    const workspace = parseYaml(read(root, '.starciwork/workspace.yaml'));
    assert.deepEqual(workspace.repositories, [{ role: 'be', name: 'be' }, { role: 'fe', name: 'fe' }]);
    assert.equal(validateWorkspace(workspace), true, JSON.stringify(validateWorkspace.errors));
    assert.equal(validateWorkspace({ ...workspace, repositories: [{ role: 'be', name: 'be', apps: [{ name: 'api' }] }] }), false, 'the schema refuses apps: on a repository (hfs.json declares the apps)');
    assert.equal((await run(['--check'], root)).code, 0, 'a fresh app is in sync by construction');
    assert.throws(() => scaffoldApp({ name: 'nivo', into: path.dirname(root), presets: PRESETS }), { code: 'HFS_SCAFFOLD_EXISTS' });
    assert.throws(() => scaffoldApp({ name: 'Todo App', into: path.dirname(root), presets: PRESETS }), { code: 'HFS_SCAFFOLD_NAME_INVALID' });
  });
  it('a lock step npm cannot complete fails the scaffold with HFS_SCAFFOLD_LOCK_FAILED, names the step and leaves no app behind', t => {
    const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-'));
    t.after(() => fs.rmSync(into, { recursive: true, force: true }));
    let ran = null;
    const failing = (root) => { ran = root; fs.writeFileSync(path.join(root, 'package-lock.json'), '{}'); return { ok: false, detail: 'exit 1: npm ERR! code ENOTFOUND' }; };
    assert.throws(() => scaffoldApp({ name: 'nivo', into, presets: PRESETS, lock: failing }), (error) => error.code === 'HFS_SCAFFOLD_LOCK_FAILED' && error.message.includes(LOCK_STEP) && error.message.includes('ENOTFOUND'));
    assert.equal(ran, path.join(into, 'nivo'), 'the lock step runs in the new app root, after every file is written');
    assert.equal(fs.existsSync(path.join(into, 'nivo')), false, 'no app and no stub lock is left behind');
  });
  it('the be skeleton follows the unit standard: only the unit-tested roles (services, cli commands) have a spec, each has one, no composition spec', t => {
    const { root } = scaffold(t);
    const files = filesUnder(root).filter(file => file.startsWith('be/'));
    const specs = files.filter(file => /\.spec\.ts$/.test(file));
    const subjects = files.filter(file => file.endsWith('.service.ts') || (file.startsWith('be/src/features/cli/') && file.endsWith('.cli.ts')));
    assert.deepEqual(specs, subjects.map(file => file.replace(/\.ts$/, '.spec.ts')).sort(), 'exactly one spec per service and per cli command and no other spec');
    assert.ok(subjects.some(file => file.endsWith('.cli.ts')), 'the cli commands are unit-tested subjects');
    assert.ok(specs.length >= 3);
    for (const spec of specs) {
      const text = read(root, spec);
      assert.match(text, /Test\.createTestingModule\(\{[\s\S]*?providers: \[/, `${spec} builds its subject with the testing module`);
      assert.match(text, /moduleRef\.get\(/, spec);
      assert.doesNotMatch(text, /\bnew [A-Z]\w*Service\(| as [A-Z]\w*\b|jest\.mock|process\.env|Date\.now|imports:/, `${spec} keeps the unit law`);
    }
    assert.ok(!files.some(file => /composition\.spec|\.controller\.spec|\.handler\.spec|\.module\.spec/.test(file)));
  });
  it('the be skeleton follows HFS: one env reader, an enum-named logger port, a public door dispatching one query to a thin handler, default-deny guards, per-app options', t => {
    const { root } = scaffold(t);
    const sources = filesUnder(root).filter(file => file.startsWith('be/') && file.endsWith('.ts') && !file.endsWith('.spec.ts'));
    assert.deepEqual(sources.filter(file => /process\.env/.test(read(root, file))), ['be/src/modules/platform/config/env-source.config.ts'], 'process.env is read only by platform/config');
    assert.ok(sources.every(file => !/console\.|new Error\(|synchronize(?!: false\b)|@Cron|new Date\(\)|Date\.now/.test(read(root, file)) || file === 'be/src/modules/platform/clock/system-clock.service.ts'), 'the ambient clock is read only by platform/clock');
    // Migrations are the only schema authority (BE-PERSISTENCE-1): every data source the skeleton opens states `synchronize: false`.
    const opened = sources.filter(file => /TypeOrmModule\.forRoot\(|new DataSource\(/.test(read(root, file)));
    assert.deepEqual(opened, ['be/src/modules/platform/database/connection-source.client.ts', 'be/src/modules/platform/database/database.module.ts']);
    for (const file of opened) assert.match(read(root, file), /synchronize: false/, file);
    assert.match(read(root, 'be/src/modules/platform/logging/logging.log-events.ts'), /export enum LoggingLogEvent/);
    const door = read(root, 'be/src/features/api/system-health/transport/http/live.controller.ts');
    assert.match(door, /@Get\("live"\)\s*@Public\(\{ reason: PublicReason\.Health \}\)[\s\S]*this\.queryBus\.execute\(new CheckLivenessQuery/);
    assert.doesNotMatch(door, /EntityManager|HealthCheckService|\bif \(/, 'a door injects the bus only and branches never');
    assert.match(read(root, 'be/src/features/api/system-health/application/check-liveness.handler.ts'), /return this\.liveness\.check\(\)/);
    const module = read(root, 'be/apps/core/src/app.module.ts');
    assert.match(module, /static register\(options: CoreOptions\): DynamicModule/);
    assert.match(module, /APP_FILTER, useClass: ErrorsFilter[\s\S]*APP_GUARD, useClass: RateLimitGuard[\s\S]*APP_GUARD, useClass: OriginGuard[\s\S]*APP_GUARD, useClass: AuthGuard/, 'throttler, then the CSRF origin guard, then AuthGuard');
    assert.match(read(root, 'be/apps/core/src/main.ts'), /EnvSource\.fromProcess\(\)/);
    // The core app opens the primary connection with the note capability's arrays; the cli app migrates the same arrays.
    assert.match(module, /DatabaseModule\.register\(\{[\s\S]*connections: \[\{ \.\.\.options\.database, entities: noteEntities, migrations: noteMigrations \}\]/);
    assert.match(read(root, 'be/apps/cli/src/cli.options.ts'), /entities: noteEntities,\s*migrations: noteMigrations/);
    assert.match(read(root, 'be/apps/cli/src/main.ts'), /CommandFactory\.run\(/);
    assert.doesNotMatch(filesUnder(root).map(file => read(root, file)).join('\n'), /\{\{(project|app|appPascal|sonarGate)\}\}/i, 'no skeleton variable is left');
  });
  it('the fe skeleton writes the next-intl stack once in the i18n package (vi default, as-needed prefix, the proxy, createAppI18n), each app calling it, every route slot mounting one pages feature, the shared ui shell, the health route', t => {
    const { root } = scaffold(t);
    const files = filesUnder(root).filter(file => file.startsWith('fe/'));
    assert.ok(!files.some(file => file.endsWith('middleware.ts')), 'Next 16 uses proxy.ts');
    assert.ok(!files.some(file => /\.(spec|test)\.tsx?$/.test(file)), 'the fe side has no tests');
    // The stack is written once: the routing, the request config and the locale negotiation live in the i18n package alone.
    assert.match(read(root, 'fe/packages/nivo-i18n/src/routing.ts'), /DEFAULT_LOCALE = "vi"[\s\S]*defineRouting\(\{[\s\S]*defaultLocale: DEFAULT_LOCALE[\s\S]*localePrefix: "as-needed"/);
    assert.match(read(root, 'fe/packages/nivo-i18n/src/index.ts'), /export const createAppI18n = [\s\S]*getRequestConfig\([\s\S]*readLocaleSegment/);
    assert.match(read(root, 'fe/packages/nivo-i18n/src/proxy.ts'), /const negotiate = createMiddleware\(routing\)[\s\S]*export const proxy = /);
    const stack = /defineRouting|getRequestConfig|createMiddleware|createNavigation/;
    assert.deepEqual(files.filter(file => /\.tsx?$/.test(file) && stack.test(read(root, file))).sort(), ['fe/packages/nivo-i18n/src/index.ts', 'fe/packages/nivo-i18n/src/proxy.ts', 'fe/packages/nivo-i18n/src/routing.ts'], 'no app builds a layer of the next-intl stack');
    // The brand shell is one ui component both apps mount.
    assert.match(read(root, 'fe/packages/nivo-ui/src/composites/SiteShell/index.tsx'), /<TopBar brand=/);
    for (const [name, prefix] of [['landing', 'Landing'], ['app', 'App']]) {
      const at = `fe/apps/${name}`;
      assert.match(read(root, `${at}/src/modules/i18n/index.ts`), new RegExp(`import \\{ createAppI18n \\} from "@nivo/i18n"[\\s\\S]*createAppI18n\\(\\s*"${name}"`), `${name} calls the package factory with its name`);
      assert.match(read(root, `${at}/src/modules/i18n/request.ts`), /export default \w+I18n\.requestConfig/);
      assert.equal(read(root, `${at}/src/proxy.ts`), 'export { proxy } from "@nivo/i18n/proxy"\n', `${name} re-exports the package proxy`);
      assert.match(read(root, `${at}/src/features/layouts/${prefix}Layout/index.tsx`), /<SiteShell brand=/, `${name} mounts the shared brand shell`);
      const home = name === 'app' ? 'AppHomePage' : 'LandingPage';
      for (const [slot, page] of [['[locale]/page.tsx', home], ['[locale]/error.tsx', `${prefix}ErrorPage`], ['[locale]/not-found.tsx', `${prefix}NotFoundPage`], ['[locale]/loading.tsx', `${prefix}LoadingPage`], ['global-error.tsx', `${prefix}GlobalErrorPage`]]) {
        assert.match(read(root, `${at}/src/app/${slot}`), new RegExp(`<${page}[ />]`), `${name} ${slot} mounts ${page}`);
        assert.ok(files.includes(`${at}/src/features/pages/${page}/index.tsx`), page);
      }
      const catalog = JSON.parse(read(root, `${at}/src/modules/i18n/messages/vi.json`));
      assert.deepEqual(Object.keys(catalog), [name], `${name}'s catalog sits under its own namespace`);
      assert.deepEqual(['errors', 'home', 'loading', 'notFound', 'shell', 'title'].filter(key => !(key in catalog[name])), [], `${name}'s catalog holds every key its pages read`);
      assert.equal(catalog[name].title, 'nivo', 'the skeleton names the app');
    }
    assert.match(read(root, 'fe/apps/app/src/app/health/live/route.ts'), /\{ status: "ok", info: \{\}, error: \{\}, details: \{\} \}/);
  });
});

describe('scripts/gates/hfs-sync.mjs', () => {
  it('passes a synced app, reports drift, and judges tracked .starciwork and .starcistacks files', async t => {
    const { checkHfsSync, CODES } = await import('../../scripts/gates/hfs-sync.mjs');
    const dir = repo(t);
    await run(['--write'], dir);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    assert.deepEqual(await checkHfsSync(dir, { presets: PRESETS }), { ok: true, findings: [] });

    fs.writeFileSync(path.join(dir, '.prettierignore'), '# hand written\n');
    fs.mkdirSync(path.join(dir, '.starciwork', 'features', 'a', 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starciwork', 'features', 'a', 'evidence', 'run.log'), 'log\n');
    fs.mkdirSync(path.join(dir, '.starcistacks', 'dev', 'secrets'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starcistacks', 'dev', 'secrets', 'db.txt'), 'x\n');
    execFileSync('git', ['add', '-f', '.'], { cwd: dir });
    const result = await checkHfsSync(dir, { presets: PRESETS });
    assert.equal(result.ok, false);
    assert.deepEqual(result.findings.map(finding => [finding.code, finding.file]).sort(), [
      ['HFS_MANAGED_FILE_DRIFT', '.prettierignore'],
      ['HFS_PLAINTEXT_SECRET', '.starcistacks/dev/secrets/db.txt'],
      ['HFS_WORK_AGENT_DATA', '.starciwork/features/a/evidence/run.log'],
    ]);
    assert.ok(result.findings.every(finding => CODES.includes(finding.code)));
  });
  it('reports a missing or invalid hfs.json as HFS_SYNC_HFS_INVALID', async t => {
    const { checkHfsSync } = await import('../../scripts/gates/hfs-sync.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-check-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const result = await checkHfsSync(dir, { presets: PRESETS });
    assert.deepEqual(result.findings.map(finding => finding.code), ['HFS_SYNC_HFS_INVALID']);
  });
});
