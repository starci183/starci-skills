import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { parseYaml } from '../engine/yaml.mjs';
import { starciworkGitignoreText } from '../scripts/lib/starciwork-boundary.mjs';
import {
  BLOCK_BEGIN, BLOCK_END, appScripts, checkTargets, hashOf, loadPresets, render, renderTargets, runSync, targetsOf, validateHfs, writeTargets,
} from '../packages/hfs/sync/index.mjs';
import { braceVariants } from '../scripts/lib/glob.mjs';
import { loadSlotManifest } from '../scripts/lib/hfs-slots.mjs';
import { declaredPushGateLint } from '../scripts/kernel/push-gate.mjs';
import { declaredSonarKeys, readDeclaredSonarKey } from '../packages/hfs/sync/sonar-key.mjs';
import { hygieneFindings, runWorkHygiene } from '../packages/hfs/sync/hygiene.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const jestPreset = require('../packages/jest-preset/index.cjs');
const vitestPreset = await import('../packages/vitest-preset/index.mjs');

const BE = { hfs: 1, profile: 'be', project: 'nivo', apps: [{ name: 'core', kind: 'api' }, { name: 'migrate', kind: 'migrate' }] };
const FE = { hfs: 1, profile: 'fe', project: 'nivo', apps: [{ name: 'app', kind: 'web' }, { name: 'admin', kind: 'web' }] };
const PRESETS = {
  be: { sonarExclusions: jestPreset.sonarExclusions() },
  fe: { sonarExclusions: vitestPreset.sonarExclusions() },
};
const rendered = hfs => Object.fromEntries(renderTargets(hfs, PRESETS[hfs.profile]).map(target => [target.path, target.content]));

const repo = (t, hfs) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-sync-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(hfs));
  return dir;
};
const run = async (args, dir) => {
  const lines = [];
  const code = await runSync(args, { cwd: dir, out: line => lines.push(line), presets: PRESETS[JSON.parse(fs.readFileSync(path.join(dir, 'hfs.json'), 'utf8')).profile] });
  return { code, lines };
};

describe('the template renderer', () => {
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
  it('every bundled template renders with the variables sync provides', () => {
    for (const hfs of [BE, FE]) assert.equal(renderTargets(hfs, PRESETS[hfs.profile]).length, targetsOf(hfs.profile).length);
  });
});

describe('hfs.json validation', () => {
  it('accepts the two profiles and refuses everything else', () => {
    assert.doesNotThrow(() => validateHfs(BE));
    assert.doesNotThrow(() => validateHfs(FE));
    for (const bad of [null, { ...BE, hfs: 0 }, { ...BE, profile: 'mobile' }, { ...BE, project: 'Nivo Backend' }, { ...BE, apps: [] }, { ...BE, apps: [{ name: 'core' }, { name: 'core' }] }, { ...BE, stacks: '../nivo-backend' }, { ...FE, stacks: '/srv/nivo-backend' }, { ...FE, stacks: '' }]) {
      assert.throws(() => validateHfs(bad), /HFS_SYNC_HFS_INVALID/);
    }
    assert.doesNotThrow(() => validateHfs({ ...FE, stacks: '../nivo-backend' }));
  });
});

describe('the generated file set', () => {
  it('a back end owns its tool configuration, package scripts, hooks, workflows, quality files and .starciwork/.gitignore; a front end owns its tool configuration, package scripts, hooks, workflows and quality files', () => {
    assert.deepEqual(Object.keys(rendered(BE)).sort(), ['.github/workflows/ci.yml', '.github/workflows/e2e.yml', '.gitignore', '.husky/pre-commit', '.husky/pre-push', '.prettierignore', '.prettierrc', '.starciwork/.gitignore', 'eslint.config.mjs', 'jest.config.js', 'package.json', 'sonar-project.properties', 'src/tests/tsconfig.json', 'tsconfig.build.json', 'tsconfig.json']);
    assert.deepEqual(Object.keys(rendered(FE)).sort(), ['.github/workflows/ci.yml', '.github/workflows/e2e.yml', '.gitignore', '.husky/pre-commit', '.husky/pre-push', '.prettierignore', '.prettierrc', 'eslint.config.mjs', 'package.json', 'sonar-project.properties', 'stylelint.config.mjs', 'tsconfig.e2e.json', 'tsconfig.json', 'vitest.config.ts']);
  });
  it('the file list is the managedBy slots of the manifest, not code: each listed file is a literal path of a slot naming managedBy', () => {
    const manifest = loadSlotManifest();
    for (const hfs of [BE, FE]) {
      const listed = manifest.slots.filter(slot => slot.managedBy !== undefined && slot.profiles.includes(hfs.profile)).flatMap(slot => braceVariants(slot.path));
      for (const file of listed) assert.ok(rendered(hfs)[file] !== undefined, `${file} is rendered`);
      assert.deepEqual(Object.keys(rendered(hfs)).filter(file => !listed.includes(file)).sort(), hfs.profile === 'be' ? ['.gitignore', '.starciwork/.gitignore'] : ['.gitignore'], 'only the block of a shared file and the file inside the .starciwork directory slot are unlisted');
    }
  });
  it('a front end renders the three one-line configurations exactly, and its tsconfigs are the two presets', () => {
    const files = rendered(FE);
    assert.equal(files['eslint.config.mjs'], 'import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"\n\nexport default starciFeConfig({ hfs: loadHfs(import.meta.url) })\n');
    assert.equal(files['stylelint.config.mjs'], 'import { loadAppTokens, starciStylelintConfig } from "@starci/stylelint-canon"\n\nexport default starciStylelintConfig({ appTokens: loadAppTokens(import.meta.url) })\n');
    assert.match(files['vitest.config.ts'], /export default defineConfig\(starciVitestWorkspace\(\{ rootDir: import\.meta\.dirname \}\)\)/);
    assert.equal(files['.prettierrc'], '"@starci/prettier-config"\n');
    assert.deepEqual(JSON.parse(files['tsconfig.json']), { extends: '@starci/tsconfig/next.json', exclude: ['node_modules', 'e2e', 'playwright.config.ts'] });
    assert.deepEqual(JSON.parse(files['tsconfig.e2e.json']), { extends: '@starci/tsconfig/e2e.json', include: ['e2e/**/*.ts', 'playwright.config.ts'], exclude: ['node_modules'] });
  });
  it('a slot that names managedBy for a file with no template, or with a glob path, is refused', () => {
    const slot = (path, managedBy = 'tool-config') => ({ ...loadSlotManifest(), slots: [{ id: 'x', profiles: ['be'], path, managedBy }] });
    assert.throws(() => targetsOf('be', { manifest: slot('nothing.json') }), /HFS_SYNC_TEMPLATE_MISSING.*nothing\.json/);
    assert.throws(() => targetsOf('be', { manifest: slot('src/**') }), /HFS_SYNC_MANIFEST_MANAGED/);
    assert.throws(() => targetsOf('be', { manifest: slot('tsconfig.json', 'no-such-group') }), /HFS_SYNC_TEMPLATE_MISSING/);
  });
  it('every target hashes its own content', () => {
    for (const target of renderTargets(BE, PRESETS.be)) assert.equal(target.hash, hashOf(target.content));
  });
});

describe('.husky/pre-commit', () => {
  it('back end runs staged lint, typecheck, unit specs of staged files and work hygiene, and never integration, e2e or contract', () => {
    const hook = rendered(BE)['.husky/pre-commit'];
    for (const step of ['npm run typecheck', 'npx eslint $sources', 'npx prettier --check $sources', 'npm test -- --passWithNoTests --findRelatedTests $specs', 'npx hfs work-hygiene']) assert.ok(hook.includes(step), step);
    assert.doesNotMatch(hook, /lint-staged|test:(e2e|integration|contract)|typecheck:tests|selectProjects (e2e|integration|contract)|playwright/);
  });
  it('front end runs staged eslint, stylelint and prettier (no lint-staged), vitest related, has no work hygiene, and never e2e', () => {
    const hook = rendered(FE)['.husky/pre-commit'];
    for (const step of ['npm run typecheck', 'npx eslint --max-warnings=0 --no-warn-ignored $sources', 'npx stylelint $styles', 'npx prettier --check --ignore-unknown $formatted', 'npx vitest related --run']) assert.ok(hook.includes(step), step);
    assert.doesNotMatch(hook, /lint-staged|work-hygiene|test:e2e|playwright/);
  });
});

describe('.husky/pre-push', () => {
  const PUSH_STEPS = {
    be: ['npm run typecheck', 'npm run lint:check', 'npm run format:check', 'npm run hfs:check -- --fast', 'npm test -- --passWithNoTests --changedSince=origin/main'],
    fe: ['npm run typecheck', 'npm run lint:check', 'npm run format:check', 'npm run hfs:check -- --fast', 'npm run test:affected'],
  };
  for (const hfs of [BE, FE]) {
    it(`${hfs.profile} runs typecheck, lint, hfs check --fast and the affected unit specs, and never e2e`, () => {
      const hook = rendered(hfs)['.husky/pre-push'];
      for (const step of PUSH_STEPS[hfs.profile]) assert.ok(hook.includes(step), step);
      assert.doesNotMatch(hook, /test:(e2e|integration|contract)|typecheck:tests|playwright/);
    });
  }
  for (const hfs of [BE, FE]) {
    it(`a ${hfs.profile} hook and workflow call only scripts the managed package.json defines`, () => {
      const scripts = ['', rendered(hfs)['package.json']].join('\n');
      for (const hook of ['.husky/pre-commit', '.husky/pre-push', '.github/workflows/ci.yml', '.github/workflows/e2e.yml']) {
        for (const [, name] of rendered(hfs)[hook].matchAll(/npm run ([\w:-]+)/g)) assert.ok(scripts.includes(`\n${name}: `), `${hook} runs npm run ${name}`);
      }
    });
  }
  it('lets the settle push gate follow the hook to the repository lint script', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-pushgate-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, '.husky'));
    fs.writeFileSync(path.join(dir, '.husky', 'pre-push'), rendered(BE)['.husky/pre-push']);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { 'lint:check': 'eslint . --max-warnings=0', typecheck: 'tsc --noEmit' } }));
    const declared = declaredPushGateLint(dir);
    assert.equal(declared.source, '.husky/pre-push');
    assert.deepEqual(declared.commands.map(command => command.script), ['lint:check']);
  });
});

describe('.github/workflows', () => {
  const CI_STEPS = {
    be: ['npm run lint:check', 'npm run format:check', 'npm run typecheck', 'npm test -- --ci', 'npm run hfs:report', 'npm run lint:report', 'npx hfs report eslint reports/eslint.json reports/eslint.sonar.json', 'npm run build', 'npm ci'],
    fe: ['npm run lint:check', 'npm run format:check', 'npm run typecheck', 'npm run test:ci', 'npm run hfs:report', 'npm run lint:report', 'npx hfs report eslint reports/eslint.json reports/eslint.sonar.json', 'npm run lint:report:css', 'npx hfs report stylelint reports/stylelint.json reports/stylelint.sonar.json', 'npm run build', 'npm ci'],
  };
  for (const hfs of [BE, FE]) {
    it(`${hfs.profile} ci.yml runs lint, typecheck, unit, hfs check and sonar, with no e2e`, () => {
      const text = rendered(hfs)['.github/workflows/ci.yml'];
      const doc = parseYaml(text);
      assert.deepEqual(Object.keys(doc.on).sort(), ['pull_request', 'push']);
      assert.deepEqual(doc.on.push.branches, ['main']);
      const runs = doc.jobs.ci.steps.map(step => step.run).filter(Boolean);
      for (const command of CI_STEPS[hfs.profile]) assert.ok(runs.includes(command), command);
      assert.ok(!runs.some(command => command.includes('hfs sync')), 'hfs check is the one drift gate; there is no second sync step');
      assert.doesNotMatch(text, /starci link|STARCI_HOME|starci-runtime/);
      const uses = doc.jobs.ci.steps.map(step => step.uses).filter(Boolean);
      assert.ok(uses.some(use => use.startsWith('SonarSource/sonarqube-scan-action')));
      assert.ok(uses.some(use => use.startsWith('SonarSource/sonarqube-quality-gate-action')));
      assert.ok(!uses.some(use => use.startsWith('codecov/')), 'no coverage upload: Sonar and CI hold no coverage');
      assert.equal(doc.permissions['id-token'], undefined);
      assert.doesNotMatch(text, /lcov|codecov|--coverage/);
      assert.doesNotMatch(text, /e2e/);
      assert.match(text, /node-version: 22/);
    });
    it(`${hfs.profile} e2e.yml is dispatched by hand only`, () => {
      const doc = parseYaml(rendered(hfs)['.github/workflows/e2e.yml']);
      assert.deepEqual(Object.keys(doc.on), ['workflow_dispatch']);
      assert.ok(doc.jobs.e2e.steps.some(step => step.run === 'npm run test:e2e'));
    });
  }
  it('only the front end installs a browser for e2e', () => {
    assert.match(rendered(FE)['.github/workflows/e2e.yml'], /playwright install/);
    assert.doesNotMatch(rendered(BE)['.github/workflows/e2e.yml'], /playwright/);
  });
});

describe('.gitignore', () => {
  const block = hfs => rendered(hfs)['.gitignore'];
  it('carries the HFS never-tracked list and .starci/, inside the managed block', () => {
    const text = block(BE);
    assert.ok(text.startsWith(`${BLOCK_BEGIN}\n`) && text.endsWith(`${BLOCK_END}\n`));
    for (const entry of ['node_modules/', 'dist/', 'coverage/', '.scannerwork/', 'test-results/', '*.tsbuildinfo', '.turbo/', '.tools/', '.env', '.env.*', '!.env.example', 'report*.json', 'nul', '.qwen*/', '.artifacts/', '.starci/']) {
      assert.ok(text.split('\n').includes(entry), entry);
    }
  });
  it('a front end also ignores .next/ and next-env.d.ts, a back end does not', () => {
    for (const entry of ['.next/', 'next-env.d.ts']) {
      assert.ok(block(FE).split('\n').includes(entry));
      assert.ok(!block(BE).split('\n').includes(entry));
    }
  });
});

describe('sonar-project.properties', () => {
  const properties = text => Object.fromEntries(text.split('\n').filter(line => line && !line.startsWith('#')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  it('takes its exclusions from the profile preset and imports no coverage', () => {
    const be = properties(rendered(BE)['sonar-project.properties']);
    assert.equal(be['sonar.exclusions'], jestPreset.sonarExclusions());
    assert.deepEqual(Object.keys(be).filter(key => /coverage|lcov/i.test(key)), []);
    assert.equal(be['sonar.projectKey'], 'nivo-backend');
    assert.equal(be['sonar.sources'], 'apps,src');
    const fe = properties(rendered(FE)['sonar-project.properties']);
    assert.equal(fe['sonar.exclusions'], vitestPreset.sonarExclusions());
    assert.deepEqual(Object.keys(fe).filter(key => /coverage|lcov/i.test(key)), []);
    assert.equal(fe['sonar.projectKey'], 'nivo-fe');
    assert.equal(fe['sonar.typescript.tsconfigPaths'], 'apps/app/tsconfig.json,apps/admin/tsconfig.json');
    assert.equal(fe['sonar.sources'], 'apps', 'no package slot: the sources are the apps');
    assert.equal(fe['sonar.tests'], 'apps');
    // One import path for every linter (hfs report): Sonar's own ESLint import is not used, it drops issues on files outside sonar.sources.
    assert.ok(!('sonar.eslint.reportPaths' in fe) && !('sonar.eslint.reportPaths' in be));
    assert.equal(fe['sonar.externalIssuesReportPaths'], 'reports/hfs.sonar.json,reports/eslint.sonar.json,reports/stylelint.sonar.json');
    assert.equal(be['sonar.externalIssuesReportPaths'], 'reports/hfs.sonar.json,reports/eslint.sonar.json');
    assert.ok(!('sonar.host.url' in be) && !('sonar.host.url' in fe), 'the host is SONAR_HOST_URL, never a property (R11)');
  });
  it('has no codecov file and no coverage upload: codecov.yml is not a managed file', () => {
    assert.equal('codecov.yml' in rendered(BE), false);
    assert.equal('codecov.yml' in rendered(FE), false);
  });
});

describe('the Sonar key', () => {
  const declaration = key => ({ services: { sonar: { projects: [{ repository: 'nivo-backend', key }, { repository: 'other', key: 'other-key' }] } } });
  const declared = (t, name) => {
    const dir = repo(t, BE);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name }));
    fs.mkdirSync(path.join(dir, '.starcistacks'));
    fs.writeFileSync(path.join(dir, '.starcistacks', 'application-stacks.yaml'), 'stack');
    return dir;
  };
  const sync = (mode, dir, parseYaml, out = () => {}) => runSync([mode], { cwd: dir, out, presets: PRESETS.be, parseYaml });
  it('is derived from hfs.json when no stack declaration names one', () => {
    assert.match(rendered(BE)['sonar-project.properties'], /^sonar.projectKey=nivo-backend$/m);
    assert.match(rendered(FE)['sonar-project.properties'], /^sonar.projectKey=nivo-fe$/m);
  });
  it('is the key services.sonar declares for this repository, read from .starcistacks', async t => {
    const dir = declared(t, 'nivo-backend');
    assert.equal(await sync('--write', dir, () => declaration('gh/starci-lab/nivo-backend')), 0);
    assert.match(fs.readFileSync(path.join(dir, 'sonar-project.properties'), 'utf8'), /^sonar.projectKey=gh\/starci-lab\/nivo-backend$/m);
    assert.equal(await sync('--check', dir, () => declaration('gh/starci-lab/nivo-backend')), 0);
    assert.equal(await sync('--check', dir, () => declaration('changed')), 1, 'a changed declaration is drift');
  });
  it('falls back to the derived key when the declaration lists other repositories only', async t => {
    const dir = declared(t, 'mine');
    assert.deepEqual(declaredSonarKeys(declaration('k'), 'mine'), []);
    assert.equal(await sync('--write', dir, () => declaration('k')), 0);
    assert.match(fs.readFileSync(path.join(dir, 'sonar-project.properties'), 'utf8'), /^sonar.projectKey=nivo-backend$/m);
  });
  it('refuses two keys for one repository', async t => {
    const dir = declared(t, 'mine');
    const lines = [];
    const two = { services: { sonar: { projects: [{ repository: 'mine', key: 'a' }, { repository: 'mine', key: 'b' }] } } };
    assert.equal(await sync('--check', dir, () => two, line => lines.push(line)), 1);
    assert.match(lines[0], /HFS_SYNC_SONAR_KEY.*a, b/);
  });
  it('a front end reads its key from the sibling back end that hfs.json stacks names, under its own repository name', async t => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stacks-fe-'));
    t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    const fe = path.join(parent, 'nivo-fe'), be = path.join(parent, 'nivo-backend');
    fs.mkdirSync(fe);
    fs.mkdirSync(path.join(be, '.starcistacks'), { recursive: true });
    fs.writeFileSync(path.join(fe, 'package.json'), JSON.stringify({ name: 'nivo-fe' }));
    fs.writeFileSync(path.join(be, '.starcistacks', 'application-stacks.yaml'), 'stack');
    const sonar = { services: { sonar: { projects: [{ repository: 'nivo-backend', key: 'be-key' }, { repository: 'nivo-fe', key: 'fe-key' }] } } };
    const fail = message => { throw new Error(message); };
    assert.equal(await readDeclaredSonarKey(fe, { parseYaml: () => sonar, fail, stacks: '../nivo-backend' }), 'fe-key');
    assert.equal(await readDeclaredSonarKey(fe, { parseYaml: () => sonar, fail }), null, 'without stacks the front end has no declaration of its own');
    await assert.rejects(readDeclaredSonarKey(fe, { parseYaml: () => sonar, fail, stacks: '../missing' }), /stacks points at \.\.\/missing/);
  });
  it('reads the real stack declaration shape with the YAML parser bundled in the package', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stacks-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, '.starcistacks'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'nivo-backend' }));
    fs.copyFileSync(path.join(ROOT, 'examples', 'starcistacks-services', 'nivo-backend.services.yaml'), path.join(dir, '.starcistacks', 'application-stacks.yaml'));
    return readDeclaredSonarKey(dir, { fail: message => { throw new Error(message); } }).then(key => assert.equal(key, 'nivo-backend'));
  });
});

describe('.starciwork/.gitignore', () => {
  it('is the boundary allowlist byte for byte, with no generated-by header', () => {
    assert.equal(rendered(BE)['.starciwork/.gitignore'], starciworkGitignoreText());
  });
});

describe('loading the presets a repository installs', () => {
  it('resolves both presets from the repository node_modules', async t => {
    const dir = repo(t, BE);
    for (const name of ['jest-preset', 'vitest-preset']) fs.cpSync(path.join(ROOT, 'packages', name), path.join(dir, 'node_modules', '@starci', name), { recursive: true });
    assert.deepEqual(await loadPresets(dir, 'be'), PRESETS.be);
    assert.deepEqual(await loadPresets(dir, 'fe'), PRESETS.fe);
  });
  it('names the missing preset and the command that installs it', async t => {
    await assert.rejects(loadPresets(repo(t, BE), 'be'), /HFS_SYNC_PRESET_MISSING.*@starci\/jest-preset.*canon-pins\.yaml/);
  });
});

describe('the drift check', () => {
  it('--write creates every file and --check then passes', async t => {
    const dir = repo(t, BE);
    assert.equal((await run(['--check'], dir)).code, 1, 'nothing is written yet');
    const written = await run(['--write'], dir);
    assert.equal(written.code, 0);
    assert.match(written.lines.at(-1), /15 written, 0 already in sync/);
    const checked = await run(['--check'], dir);
    assert.equal(checked.code, 0);
    assert.match(checked.lines.at(-1), /15 of 15 in sync/);
  });
  it('a hand edit fails --check with the file, the hashes and the first differing line, and --write repairs it', async t => {
    const dir = repo(t, BE);
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
  it('a deleted file is reported missing', async t => {
    const dir = repo(t, FE);
    await run(['--write'], dir);
    fs.rmSync(path.join(dir, '.husky', 'pre-commit'));
    const failed = await run(['--check'], dir);
    assert.equal(failed.code, 1);
    assert.match(failed.lines[0], /^HFS_SYNC_DRIFT \.husky\/pre-commit: missing/);
  });
  it('CRLF checkouts are not drift', async t => {
    const dir = repo(t, BE);
    await run(['--write'], dir);
    const file = path.join(dir, '.github', 'workflows', 'ci.yml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    assert.equal((await run(['--check'], dir)).code, 0);
  });
  it('an app or profile change in hfs.json is drift until --write', async t => {
    const dir = repo(t, FE);
    await run(['--write'], dir);
    fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify({ ...FE, apps: [...FE.apps, { name: 'docs', kind: 'web' }] }));
    const failed = await run(['--check'], dir);
    assert.ok(failed.lines.some(line => /^HFS_SYNC_DRIFT sonar-project\.properties/.test(line)), 'the sonar tsconfig paths name the new app');
    assert.ok(failed.lines.some(line => /^HFS_SYNC_DRIFT package\.json/.test(line)), 'the scripts gain dev and start for the new app');
  });
  it('a repository .gitignore keeps its own lines; only the managed block is compared and rewritten', async t => {
    const dir = repo(t, BE);
    const file = path.join(dir, '.gitignore');
    fs.writeFileSync(file, 'my-scratch/\n');
    await run(['--write'], dir);
    let text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith(BLOCK_BEGIN) && text.endsWith('my-scratch/\n'));
    fs.writeFileSync(file, `${text}later-line/\n`);
    assert.equal((await run(['--check'], dir)).code, 0, 'lines outside the block are the repository\'s');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('dist/', 'build/'));
    assert.equal((await run(['--check'], dir)).code, 1);
    await run(['--write'], dir);
    text = fs.readFileSync(file, 'utf8');
    assert.ok(text.includes('dist/') && !text.includes('build/') && text.includes('later-line/') && text.includes('my-scratch/'));
  });
  it('exits 2 without exactly one mode and 1 on an invalid hfs.json', async t => {
    const dir = repo(t, BE);
    assert.equal((await run([], dir)).code, 2);
    assert.equal((await run(['--check', '--write'], dir)).code, 2);
    fs.writeFileSync(path.join(dir, 'hfs.json'), '{"hfs":1,"profile":"be"}');
    const bad = await runSync(['--check'], { cwd: dir, out: () => {}, presets: PRESETS.be });
    assert.equal(bad, 1);
  });
  it('checkTargets and writeTargets agree with the rendered hashes', t => {
    const dir = repo(t, BE);
    const targets = renderTargets(BE, PRESETS.be);
    assert.ok(checkTargets(dir, targets).every(result => result.status === 'missing'));
    writeTargets(dir, targets);
    assert.deepEqual(checkTargets(dir, targets).map(result => result.actualHash), targets.map(target => target.hash));
  });
});

describe('the back-end tool configuration', () => {
  const at = file => rendered(BE)[file];
  it('eslint.config.mjs is exactly the one-liner', () => {
    assert.equal(at('eslint.config.mjs'), 'import { loadHfs, starciBeConfig } from "@starci/eslint-canon-be"\n\nexport default starciBeConfig({ hfs: loadHfs(import.meta.url) })\n');
  });
  it('tsconfig.json extends the preset, adds only the three aliases and excludes the world, integration, e2e and contract trees; the build and tests configs add only what a preset cannot hold', () => {
    assert.deepEqual(JSON.parse(at('tsconfig.json')), { extends: '@starci/tsconfig/be.json', compilerOptions: { paths: { '@features/*': ['./src/features/*'], '@modules/*': ['./src/modules/*'], '@tests/*': ['./src/tests/*'] } }, exclude: ['node_modules', 'dist', 'src/tests/world', 'src/tests/integration', 'src/tests/e2e', 'src/tests/contract'] });
    assert.deepEqual(JSON.parse(at('tsconfig.build.json')), { extends: ['./tsconfig.json', '@starci/tsconfig/build.json'], compilerOptions: { outDir: './dist' }, exclude: ['node_modules', 'dist', '**/*.spec.ts', 'src/tests'] });
    assert.deepEqual(JSON.parse(at('src/tests/tsconfig.json')), { extends: ['../../tsconfig.json', '@starci/tsconfig/e2e.json'], include: ['./**/*.ts'], exclude: [] });
  });
  it('jest.config.js is the preset call, .prettierrc references the shared config, and neither carries a header comment', () => {
    assert.equal(at('jest.config.js'), 'module.exports = require("@starci/jest-preset").starciJestConfig()\n');
    assert.equal(at('.prettierrc'), '"@starci/prettier-config"\n');
  });
  it('.prettierignore is the template, headed as generated', () => {
    assert.match(at('.prettierignore'), /^# Generated by hfs sync \(profile be\)/);
    assert.deepEqual(at('.prettierignore').split('\n').filter(line => line && !line.startsWith('#')), ['dist/', 'coverage/', 'node_modules/', 'package-lock.json', 'contracts/', '.starcistacks/', '.starciwork/']);
  });
  it('the preset the templates name exist and export what they call', () => {
    const ROOT_PACKAGES = path.join(ROOT, 'packages');
    for (const [name, file] of [['tsconfig', 'be.json'], ['tsconfig', 'build.json'], ['tsconfig', 'e2e.json']]) assert.ok(fs.existsSync(path.join(ROOT_PACKAGES, name, file)), file);
    assert.equal(typeof jestPreset.starciJestConfig, 'function');
    assert.ok(fs.existsSync(path.join(ROOT_PACKAGES, 'prettier-config', 'index.cjs')));
    assert.ok(fs.existsSync(path.join(ROOT_PACKAGES, 'eslint', 'be', 'lib', 'config.mjs')));
  });
});

describe('the package.json scripts of a back end', () => {
  const scripts = hfs => Object.fromEntries(renderTargets(hfs, PRESETS.be).find(target => target.path === 'package.json').content.trim().split('\n').map(line => [line.slice(0, line.indexOf(': ')), line.slice(line.indexOf(': ') + 2)]));
  it('are the fixed scripts, plus build and one start script per runnable app and migrate', () => {
    assert.deepEqual(Object.keys(scripts(BE)).sort(), ['build', 'contract:emit', 'format', 'format:check', 'hfs:check', 'hfs:report', 'lint', 'lint:check', 'lint:report', 'migrate', 'start:core', 'test', 'test:contract', 'test:e2e', 'test:integration', 'typecheck', 'typecheck:tests']);
    assert.equal(scripts(BE)['start:core'], 'node dist/apps/core/src/main.js');
    assert.equal(scripts(BE).migrate, 'node dist/apps/migrate/src/main.js');
    assert.equal(scripts(BE).test, 'jest --selectProjects unit --coverage');
    for (const project of ['integration', 'e2e', 'contract']) assert.equal(scripts(BE)[`test:${project}`], `npm run typecheck:tests && jest --selectProjects ${project}`);
    assert.equal(scripts(BE)['typecheck:tests'], 'tsc -p src/tests/tsconfig.json');
    assert.doesNotMatch(Object.values(scripts(BE)).join('\n'), /--rule|--no-inline-config|--no-eslintrc/);
  });
  it('gain a start script per app kind and name a second migrate app by its name', () => {
    const many = { ...BE, apps: [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }, { name: 'a', kind: 'migrate' }, { name: 'b', kind: 'migrate' }] };
    assert.deepEqual(Object.keys(scripts(many)).filter(name => /^(start|migrate)/.test(name)).sort(), ['migrate:a', 'migrate:b', 'start:core', 'start:jobs']);
    assert.equal(appScripts('be', [{ name: 'x', kind: 'cli' }]), '"start:x": "node dist/apps/x/src/main.js",');
  });
  it('are compared as parsed JSON: key order and the rest of package.json are not drift, an extra or changed script is', async t => {
    const dir = repo(t, BE);
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

describe('the package.json scripts of a front end', () => {
  const scripts = hfs => renderTargets(hfs, PRESETS.fe).find(target => target.path === 'package.json').scripts;
  it('are one lint gate over eslint (apps, packages and e2e in one run) and stylelint, plus the fixed scripts and dev/start per app', () => {
    assert.deepEqual(Object.keys(scripts(FE)).sort(), ['build', 'codegen', 'dev:admin', 'dev:app', 'format', 'format:check', 'hfs:check', 'hfs:report', 'lint', 'lint:check', 'lint:report', 'lint:report:css', 'prepare', 'start:admin', 'start:app', 'test', 'test:affected', 'test:ci', 'test:e2e', 'typecheck', 'typecheck:e2e']);
    const lint = scripts(FE)['lint:check'];
    assert.match(lint, /eslint \. --max-warnings=0/);
    assert.match(lint, /stylelint "\{apps,packages\}\/\*\/src\/\*\*\/\*\.css"/);
    assert.doesNotMatch(lint, /--ignore-pattern/, 'no path is hidden from the lint run');
    assert.ok(!('lint:e2e' in scripts(FE)), 'e2e/ is linted by the same eslint run: there is no second lint script');
    assert.equal(scripts(FE)['dev:app'], 'npm run dev --workspace apps/app');
  });
  it('run e2e only through test:e2e, never through a gate script, and call no repository-local checker', () => {
    const all = scripts(FE);
    for (const [name, command] of Object.entries(all)) {
      if (name !== 'test:e2e') assert.doesNotMatch(command, /playwright|test:e2e/, name);
      assert.doesNotMatch(command, /scripts\/|contract-check|check-i18n-catalog|check-fe-architecture/, `${name} calls a repository-local checker`);
    }
    assert.equal(all['test:e2e'], 'npm run typecheck:e2e && playwright test');
  });
  it('lint, test and the report scripts are one command each for the two linters', () => {
    const all = scripts(FE);
    assert.equal(all['lint:report'], 'eslint . --format json --output-file reports/eslint.json');
    assert.equal(all['lint:report:css'], 'stylelint "{apps,packages}/*/src/**/*.css" --formatter json --output-file reports/stylelint.json');
    assert.equal(all.test, 'npm run codegen --silent && vitest run');
    assert.equal(all['test:ci'], 'npm run codegen --silent && vitest run');
  });
  it('the sources and the tsconfig paths include packages/ exactly when hfs.json opts into a package slot', () => {
    const properties = hfs => Object.fromEntries(rendered(hfs)['sonar-project.properties'].split('\n').filter(line => line && !line.startsWith('#')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
    for (const slots of [['repo.packages'], ['fe.package.ui'], ['fe.package.api', 'fe.package.i18n']]) {
      const fe = properties({ ...FE, optionalSlots: slots });
      assert.equal(fe['sonar.sources'], 'apps,packages', slots.join());
      assert.equal(fe['sonar.tests'], 'apps,packages');
      assert.equal(fe['sonar.typescript.tsconfigPaths'], 'apps/app/tsconfig.json,apps/admin/tsconfig.json,packages/*/tsconfig.json');
    }
    for (const slots of [undefined, [], ['fe.route']]) {
      const fe = properties({ ...FE, ...(slots ? { optionalSlots: slots } : {}) });
      assert.equal(fe['sonar.sources'], 'apps', String(slots));
      assert.equal(fe['sonar.typescript.tsconfigPaths'], 'apps/app/tsconfig.json,apps/admin/tsconfig.json');
    }
    assert.equal(properties(BE)['sonar.sources'], 'apps,src', 'a back end is unaffected');
  });
});

describe('work-hygiene', () => {
  it('refuses agent output under .starciwork and plaintext secrets under .starcistacks', () => {
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
    // This temp repo is no runtime checkout — its root carries no scripts/checks/ledger-hygiene.mjs: the section is silently absent.
    const lines = [];
    assert.equal(await runWorkHygiene({ cwd: dir, out: line => lines.push(line) }), 0);
    assert.ok(!lines.some(line => /LEDGER_(ORPHAN_STATE_ROOT|LEGACY_WORK_SQLITE)/.test(line)));
    // Run from the real checkout (this repo IS the runtime): the section runs and never throws, whatever it finds.
    const inRepo = [];
    await runWorkHygiene({ cwd: ROOT, out: line => inRepo.push(line), files: [] });
  });
});

describe('hfs sync --init', () => {
  const skeleton = async (t, hfs) => {
    const dir = repo(t, hfs);
    const code = await runSync(['--init'], { cwd: dir, out: () => {}, presets: PRESETS[hfs.profile] });
    return { dir, code };
  };
  const filesUnder = dir => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')).sort();
  const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

  it('a back end gets platform config, clock, cqrs, logging and errors, the liveness capability, the health feature and one entrypoint per api app', async t => {
    const { dir, code } = await skeleton(t, BE);
    assert.equal(code, 0);
    const files = filesUnder(dir);
    for (const file of [
      'apps/core/src/main.ts', 'apps/core/src/app.module.ts', 'apps/core/src/core.options.ts',
      'src/modules/platform/config/env-source.config.ts', 'src/modules/platform/config/server.config.ts', 'src/modules/platform/config/index.ts',
      'src/modules/platform/logging/logging.port.ts', 'src/modules/platform/logging/logging.log-events.ts', 'src/modules/platform/logging/logging.module.ts', 'src/modules/platform/logging/json-logger.service.ts',
      'src/modules/platform/clock/clock.port.ts', 'src/modules/platform/clock/system-clock.service.ts',
      'src/modules/platform/cqrs/cqrs.handler.ts', 'src/modules/platform/cqrs/cqrs.decorators.ts', 'src/modules/platform/composition/composition.decorators.ts',
      'src/modules/platform/errors/domain.error.ts', 'src/modules/platform/errors/error.filter.ts',
      'src/modules/domain/liveness/liveness.service.ts', 'src/modules/domain/liveness/index.ts',
      'src/features/system-health/index.ts', 'src/features/system-health/application/check-liveness.handler.ts', 'src/features/system-health/transport/http/live.controller.ts',
    ]) assert.ok(files.includes(file), file);
    assert.ok(!files.some(file => file.startsWith('apps/migrate/')), 'only api apps get an entrypoint');
  });
  it('the back-end skeleton follows the unit standard: only services have a spec, each service has one, no composition spec', async t => {
    const { dir } = await skeleton(t, BE);
    const files = filesUnder(dir);
    const specs = files.filter(file => /\.spec\.ts$/.test(file));
    assert.deepEqual(specs, files.filter(file => file.endsWith('.service.ts')).map(file => file.replace(/\.ts$/, '.spec.ts')).sort(), 'exactly one spec per service and no other spec');
    assert.ok(specs.length >= 3);
    for (const spec of specs) {
      const text = read(dir, spec);
      assert.match(text, /Test\.createTestingModule\(\{[\s\S]*?providers: \[/, `${spec} builds its subject with the testing module`);
      assert.match(text, /moduleRef\.get\(/, spec);
      assert.doesNotMatch(text, /\bnew [A-Z]\w*Service\(| as |jest\.mock|process\.env|Date\.now|imports:/, `${spec} keeps the unit law`);
    }
    assert.ok(!files.some(file => /composition\.spec|\.controller\.spec|\.handler\.spec|\.module\.spec/.test(file)));
  });
  it('the back-end skeleton follows HFS: one env reader, an enum-named logger port, a thin door dispatching one query to a thin handler that calls one service, per-app options, no coverage upload', async t => {
    const { dir } = await skeleton(t, BE);
    const sources = filesUnder(dir).filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
    assert.deepEqual(sources.filter(file => /process\.env/.test(read(dir, file))), ['src/modules/platform/config/env-source.config.ts'], 'process.env is read only by platform/config');
    assert.ok(sources.every(file => !/console\.|new Error\(|synchronize|@Cron|new Date\(\)|Date\.now/.test(read(dir, file)) || file === 'src/modules/platform/clock/system-clock.service.ts'), 'the ambient clock is read only by platform/clock');
    assert.match(read(dir, 'src/modules/platform/logging/logging.log-events.ts'), /export enum LoggingLogEvent/);
    assert.match(read(dir, 'src/modules/platform/logging/logging.port.ts'), /error\(event: string, cause: unknown/);
    const door = read(dir, 'src/features/system-health/transport/http/live.controller.ts');
    assert.match(door, /@Get\("live"\)[\s\S]*this\.queryBus\.execute\(new CheckLivenessQuery/);
    assert.doesNotMatch(door, /EntityManager|HealthCheckService|\bif \(/, 'a door injects the bus only and branches never');
    assert.match(read(dir, 'src/features/system-health/application/check-liveness.handler.ts'), /return this\.liveness\.check\(\)/);
    assert.match(read(dir, 'apps/core/src/app.module.ts'), /static register\(options: CoreOptions\): DynamicModule/);
    assert.match(read(dir, 'apps/core/src/app.module.ts'), /APP_FILTER/);
    assert.match(read(dir, 'apps/core/src/main.ts'), /EnvSource\.fromProcess\(\)/);
    assert.doesNotMatch(filesUnder(dir).map(file => read(dir, file)).join('\n'), /\{\{[a-zA-Z]|lcov|codecov/i, 'no template placeholder and no coverage upload is left');
  });
  const SHARED = ['fe.package.i18n', 'fe.package.api'];
  const APP_SHELL = ['next.config.ts', 'src/proxy.ts', 'vitest.config.ts', 'src/app/global-error.tsx', 'src/app/globals.css', 'src/app/health/live/route.ts',
    'src/app/[locale]/layout.tsx', 'src/app/[locale]/page.tsx', 'src/app/[locale]/error.tsx', 'src/app/[locale]/not-found.tsx',
    'src/modules/i18n/index.ts', 'src/modules/i18n/request.ts', 'src/modules/i18n/messages/vi.json', 'src/modules/api/index.ts'];
  it('a one-app front end keeps the next-intl stack and the one API client in the app: vi default, as-needed prefix, proxy.ts, error boundaries and the health route', async t => {
    const one = { ...FE, apps: [{ name: 'app', kind: 'web' }] };
    const { dir } = await skeleton(t, one);
    const files = filesUnder(dir);
    for (const file of [...APP_SHELL, 'src/modules/i18n/config.ts', 'src/modules/i18n/routing.ts', 'src/modules/i18n/navigation.ts', 'src/modules/api/client.ts', 'src/modules/api/outcome.ts', 'src/modules/api/client.spec.ts']) {
      assert.ok(files.includes(`apps/app/${file}`), `apps/app/${file}`);
    }
    assert.ok(!files.some(file => file.startsWith('packages/')), 'no shared package for one app');
    assert.ok(!files.some(file => file.endsWith('middleware.ts')), 'Next 16 uses proxy.ts');
    assert.match(read(dir, 'apps/app/src/modules/i18n/routing.ts'), /defaultLocale: DEFAULT_LOCALE[\s\S]*localePrefix: "as-needed"/);
    assert.match(read(dir, 'apps/app/src/modules/i18n/config.ts'), /DEFAULT_LOCALE: Locale = "vi"/);
    assert.match(read(dir, 'apps/app/src/proxy.ts'), /export default createMiddleware\(routing\)/);
    assert.match(read(dir, 'apps/app/src/app/[locale]/layout.tsx'), /import \{ routing \} from "\.\.\/\.\.\/modules\/i18n"/, 'the shell reads the module through its index, so both layouts of the repository compile');
    assert.match(read(dir, 'apps/app/src/app/[locale]/layout.tsx'), /<html lang=\{locale\}>/);
    assert.match(read(dir, 'apps/app/src/app/health/live/route.ts'), /\{ status: "ok", info: \{\}, error: \{\}, details: \{\} \}/);
    assert.deepEqual(Object.keys(JSON.parse(read(dir, 'apps/app/src/modules/i18n/messages/vi.json'))).sort(), ['errors', 'home', 'notFound']);
    const client = read(dir, 'apps/app/src/modules/api/client.ts');
    assert.match(client, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/, 'the one fetch carries a timeout signal');
    assert.match(client, /response\.status === 401 \|\| response\.status === 403\) return \{ kind: "refused" \}/, '401 and 403 are refused');
    assert.equal(client.match(/\bfetch\(/g).length, 1, 'exactly one fetch');
    assert.doesNotMatch(filesUnder(dir).map(file => read(dir, file)).join('\n'), /\{\{[a-zA-Z]/, 'no template placeholder is left');
  });
  it('a front end with two apps writes the i18n stack and the API client once, as packages/<project>-i18n and -api, and keeps a thin adapter in each app', async t => {
    const two = { ...FE, optionalSlots: ['repo.packages', ...SHARED] };
    const { dir, code } = await skeleton(t, two);
    assert.equal(code, 0);
    const files = filesUnder(dir);
    for (const app of ['app', 'admin']) {
      for (const file of APP_SHELL) assert.ok(files.includes(`apps/${app}/${file}`), `apps/${app}/${file}`);
      for (const file of ['src/modules/i18n/config.ts', 'src/modules/i18n/routing.ts', 'src/modules/i18n/navigation.ts', 'src/modules/api/client.ts', 'src/modules/api/outcome.ts']) assert.ok(!files.includes(`apps/${app}/${file}`), `apps/${app}/${file} lives in the package`);
      assert.match(read(dir, `apps/${app}/src/modules/i18n/index.ts`), /createAppI18n\(\{ locales: \["vi"\], defaultLocale: "vi" \}\)/);
      assert.match(read(dir, `apps/${app}/src/modules/i18n/index.ts`), /from "@nivo\/i18n"/);
      assert.match(read(dir, `apps/${app}/src/modules/api/index.ts`), /from "@nivo\/api"/);
      assert.match(read(dir, `apps/${app}/src/proxy.ts`), /createProxy\(routing\)/);
      assert.match(read(dir, `apps/${app}/next.config.ts`), /transpilePackages: \["@nivo\/i18n", "@nivo\/api"\]/);
    }
    for (const file of ['package.json', 'tsconfig.json', 'vitest.config.ts', 'src/index.ts', 'src/app.ts', 'src/app.spec.ts', 'src/proxy.ts', 'src/proxy.spec.ts', 'src/request.ts', 'src/request.spec.ts']) assert.ok(files.includes(`packages/nivo-i18n/${file}`), `packages/nivo-i18n/${file}`);
    for (const file of ['package.json', 'tsconfig.json', 'vitest.config.ts', 'src/index.ts', 'src/client.ts', 'src/client.spec.ts', 'src/outcome.ts']) assert.ok(files.includes(`packages/nivo-api/${file}`), `packages/nivo-api/${file}`);
    assert.equal(JSON.parse(read(dir, 'packages/nivo-i18n/package.json')).name, '@nivo/i18n');
    assert.equal(JSON.parse(read(dir, 'packages/nivo-api/package.json')).name, '@nivo/api');
    const single = await skeleton(t, { ...FE, apps: [{ name: 'app', kind: 'web' }] });
    assert.equal(read(dir, 'packages/nivo-api/src/client.ts'), read(single.dir, 'apps/app/src/modules/api/client.ts'), 'one client text, whichever tree holds it');
    assert.ok(!files.some(file => file.startsWith('apps/') && /\/modules\/api\/(client|outcome)\.ts$/.test(file)), 'no app keeps a client of its own');
    assert.doesNotMatch(files.map(file => read(dir, file)).join('\n'), /\{\{[a-zA-Z]/, 'no template placeholder is left');
  });
  it('refuses a shared skeleton when hfs.json does not opt into both package slots, and writes nothing', async t => {
    for (const declaration of [FE, { ...FE, optionalSlots: ['fe.package.i18n'] }]) {
      const dir = repo(t, declaration);
      const lines = [];
      assert.equal(await runSync(['--init'], { cwd: dir, out: line => lines.push(line), presets: PRESETS.fe }), 1);
      assert.match(lines[0], /HFS_SYNC_HFS_INVALID.*fe\.package\.(i18n and fe\.package\.api|api)/);
      assert.deepEqual(filesUnder(dir), ['hfs.json']);
    }
  });
  it('never overwrites: a second --init leaves an edited file alone and reports it skipped', async t => {
    const { dir } = await skeleton(t, BE);
    const file = path.join(dir, 'apps', 'core', 'src', 'main.ts');
    fs.writeFileSync(file, '// mine\n');
    const lines = [];
    assert.equal(await runSync(['--init'], { cwd: dir, out: line => lines.push(line), presets: PRESETS.be }), 0);
    assert.equal(fs.readFileSync(file, 'utf8'), '// mine\n');
    assert.match(lines.at(-1), /^hfs sync --init: 0 created, \d+ already exist and were left alone$/);
  });
  it('is exclusive with --check and --write', async t => {
    assert.equal((await run(['--init', '--check'], repo(t, BE))).code, 2);
  });
});

describe('scripts/checks/check-hfs-sync.mjs', () => {
  it('passes a synced repository, reports drift, and judges tracked .starciwork and .starcistacks files', async t => {
    const { checkHfsSync, CODES } = await import('../scripts/checks/check-hfs-sync.mjs');
    const dir = repo(t, BE);
    await run(['--write'], dir);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    assert.deepEqual(await checkHfsSync(dir, { presets: PRESETS.be }), { ok: true, findings: [] });

    fs.writeFileSync(path.join(dir, 'sonar-project.properties'), '# hand written\n');
    fs.mkdirSync(path.join(dir, '.starciwork', 'features', 'a', 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starciwork', 'features', 'a', 'evidence', 'run.log'), 'log\n');
    fs.mkdirSync(path.join(dir, '.starcistacks', 'dev', 'secrets'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starcistacks', 'dev', 'secrets', 'db.txt'), 'x\n');
    execFileSync('git', ['add', '-f', '.'], { cwd: dir });
    const result = await checkHfsSync(dir, { presets: PRESETS.be });
    assert.equal(result.ok, false);
    assert.deepEqual(result.findings.map(finding => [finding.code, finding.file]).sort(), [
      ['HFS_PLAINTEXT_SECRET', '.starcistacks/dev/secrets/db.txt'],
      ['HFS_SONAR_CONFIG', 'sonar-project.properties'],
      ['HFS_WORK_AGENT_DATA', '.starciwork/features/a/evidence/run.log'],
    ]);
    assert.ok(result.findings.every(finding => CODES.includes(finding.code)));
  });
  it('reports a missing or invalid hfs.json as HFS_SYNC_HFS_INVALID', async t => {
    const { checkHfsSync } = await import('../scripts/checks/check-hfs-sync.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-check-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const result = await checkHfsSync(dir, { presets: PRESETS.be });
    assert.deepEqual(result.findings.map(finding => finding.code), ['HFS_SYNC_HFS_INVALID']);
  });
});
