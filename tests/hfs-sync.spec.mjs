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
  BLOCK_BEGIN, TARGETS, checkTargets, hashOf, loadPresets, render, renderTargets, runSync, validateHfs, writeTargets,
} from '../packages/hfs/sync/index.mjs';
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
  be: { sonarExclusions: jestPreset.sonarExclusions(), sonarCoverageExclusions: jestPreset.sonarCoverageExclusions() },
  fe: { sonarExclusions: vitestPreset.sonarExclusions(), sonarCoverageExclusions: vitestPreset.sonarCoverageExclusions() },
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
    for (const hfs of [BE, FE]) assert.equal(renderTargets(hfs, PRESETS[hfs.profile]).length, TARGETS.filter(target => target.template[hfs.profile]).length);
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
  it('a back end owns eight files including .starciwork/.gitignore and a front end owns the other seven', () => {
    assert.deepEqual(Object.keys(rendered(BE)).sort(), ['.github/workflows/ci.yml', '.github/workflows/e2e.yml', '.gitignore', '.husky/pre-commit', '.husky/pre-push', '.starciwork/.gitignore', 'codecov.yml', 'sonar-project.properties']);
    assert.deepEqual(Object.keys(rendered(FE)).sort(), ['.github/workflows/ci.yml', '.github/workflows/e2e.yml', '.gitignore', '.husky/pre-commit', '.husky/pre-push', 'codecov.yml', 'sonar-project.properties']);
  });
  it('every target hashes its own content', () => {
    for (const target of renderTargets(BE, PRESETS.be)) assert.equal(target.hash, hashOf(target.content));
  });
});

describe('.husky/pre-commit', () => {
  it('back end runs staged lint, typecheck, unit specs of staged files and work hygiene, and never e2e', () => {
    const hook = rendered(BE)['.husky/pre-commit'];
    for (const step of ['npx lint-staged', 'npm run typecheck', 'jest --selectProjects unit', '--findRelatedTests $staged', 'npx hfs work-hygiene']) assert.ok(hook.includes(step), step);
    assert.doesNotMatch(hook, /test:e2e|typecheck:e2e|selectProjects e2e|playwright/);
  });
  it('front end runs vitest related, has no work hygiene, and never e2e', () => {
    const hook = rendered(FE)['.husky/pre-commit'];
    for (const step of ['npx lint-staged', 'npm run typecheck', 'npx vitest related --run']) assert.ok(hook.includes(step), step);
    assert.doesNotMatch(hook, /work-hygiene|test:e2e|playwright/);
  });
});

describe('.husky/pre-push', () => {
  for (const hfs of [BE, FE]) {
    it(`${hfs.profile} runs typecheck, lint, hfs check --fast and the affected unit specs, and never e2e`, () => {
      const hook = rendered(hfs)['.husky/pre-push'];
      for (const step of ['npm run typecheck', 'npm run lint:check', 'npx hfs check --fast', 'npm run test:affected']) assert.ok(hook.includes(step), step);
      assert.doesNotMatch(hook, /test:e2e|typecheck:e2e|playwright/);
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
  for (const hfs of [BE, FE]) {
    it(`${hfs.profile} ci.yml runs lint, typecheck, unit, hfs check and sonar, with no e2e`, () => {
      const text = rendered(hfs)['.github/workflows/ci.yml'];
      const doc = parseYaml(text);
      assert.deepEqual(Object.keys(doc.on).sort(), ['pull_request', 'push']);
      assert.deepEqual(doc.on.push.branches, ['main']);
      const runs = doc.jobs.ci.steps.map(step => step.run).filter(Boolean);
      for (const command of ['npm run lint:check', 'npm run typecheck', 'npm run test:ci', 'npx hfs check', 'npx hfs sync --check', 'npm ci']) assert.ok(runs.includes(command), command);
      assert.doesNotMatch(text, /starci link|STARCI_HOME|starci-runtime/);
      const uses = doc.jobs.ci.steps.map(step => step.uses).filter(Boolean);
      assert.ok(uses.some(use => use.startsWith('SonarSource/sonarqube-scan-action')));
      assert.ok(uses.some(use => use.startsWith('SonarSource/sonarqube-quality-gate-action')));
      assert.ok(uses.some(use => use.startsWith('codecov/codecov-action')));
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

describe('sonar-project.properties and codecov.yml', () => {
  const properties = text => Object.fromEntries(text.split('\n').filter(line => line && !line.startsWith('#')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  it('take the coverage exclusions from the profile preset, so the denominators cannot drift', () => {
    const be = properties(rendered(BE)['sonar-project.properties']);
    assert.equal(be['sonar.exclusions'], jestPreset.sonarExclusions());
    assert.equal(be['sonar.coverage.exclusions'], jestPreset.sonarCoverageExclusions());
    assert.equal(be['sonar.projectKey'], 'nivo-backend');
    assert.equal(be['sonar.sources'], 'apps,src');
    const fe = properties(rendered(FE)['sonar-project.properties']);
    assert.equal(fe['sonar.exclusions'], vitestPreset.sonarExclusions());
    assert.equal(fe['sonar.coverage.exclusions'], vitestPreset.sonarCoverageExclusions());
    assert.equal(fe['sonar.projectKey'], 'nivo-fe');
    assert.equal(fe['sonar.typescript.tsconfigPaths'], 'apps/app/tsconfig.json,apps/admin/tsconfig.json');
    assert.equal(fe['sonar.javascript.lcov.reportPaths'], 'coverage/lcov.info');
  });
  it('codecov ignores exactly the union of both preset lists and keeps the 80/90 gates', () => {
    const doc = parseYaml(rendered(BE)['codecov.yml']);
    assert.deepEqual(doc.ignore, [...jestPreset.sonarExclusions().split(','), ...jestPreset.sonarCoverageExclusions().split(',')]);
    assert.equal(doc.coverage.status.project.default.target, '80%');
    assert.equal(doc.coverage.status.patch.default.target, '90%');
    assert.equal(doc.coverage.status.project.default.informational, false);
    assert.equal(doc.comment, false);
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
    assert.match(written.lines.at(-1), /8 written, 0 already in sync/);
    const checked = await run(['--check'], dir);
    assert.equal(checked.code, 0);
    assert.match(checked.lines.at(-1), /8 of 8 in sync/);
  });
  it('a hand edit fails --check with the file, the hashes and the first differing line, and --write repairs it', async t => {
    const dir = repo(t, BE);
    await run(['--write'], dir);
    const file = path.join(dir, 'codecov.yml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('80%', '50%'));
    const failed = await run(['--check'], dir);
    assert.equal(failed.code, 1);
    assert.match(failed.lines[0], /^HFS_SYNC_DRIFT codecov\.yml: drift, expected sha256 [0-9a-f]{12}, found [0-9a-f]{12} \(line \d+: expected .*80%/);
    const repaired = await run(['--write'], dir);
    assert.match(repaired.lines[0], /^wrote codecov\.yml$/);
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
    assert.match(failed.lines[0], /sonar-project\.properties/);
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

describe('work-hygiene', () => {
  it('refuses agent output under .starciwork and plaintext secrets under .starcistacks', () => {
    const ignored = new Set(['.starciwork/features/a/evidence/run.json']);
    const findings = hygieneFindings([
      '.starciwork/features/a/index.yaml', '.starciwork/features/a/evidence/run.json',
      '.starcistacks/dev/secrets/db.enc', '.starcistacks/dev/secrets/db.txt', '.starcistacks/dev/infra/.env', '.starcistacks/dev/infra/.env.example', '.starcistacks/dev/infra/tls.pem',
    ], ignored);
    assert.deepEqual(findings.map(finding => [finding.file, finding.code]), [
      ['.starciwork/features/a/evidence/run.json', 'HFS_WORK_AGENT_DATA'],
      ['.starcistacks/dev/secrets/db.txt', 'HFS_STACKS_PLAINTEXT'],
      ['.starcistacks/dev/infra/.env', 'HFS_STACKS_PLAINTEXT'],
      ['.starcistacks/dev/infra/tls.pem', 'HFS_STACKS_PLAINTEXT'],
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
    // No sibling scripts/checks/ledger-hygiene.mjs three levels up from this temp dir: the section is silently absent.
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

  it('a back end gets platform config, logging and errors, the health feature and one entrypoint per api app', async t => {
    const { dir, code } = await skeleton(t, BE);
    assert.equal(code, 0);
    const files = filesUnder(dir);
    for (const file of [
      'apps/core/src/main.ts', 'apps/core/src/app.module.ts', 'apps/core/src/core.options.ts', 'apps/core/src/core.composition.spec.ts',
      'src/modules/platform/config/env-source.ts', 'src/modules/platform/config/server.config.ts', 'src/modules/platform/config/index.ts',
      'src/modules/platform/logging/logger.port.ts', 'src/modules/platform/logging/log-id.ts', 'src/modules/platform/logging/logging.module.ts',
      'src/modules/platform/errors/domain-error.ts', 'src/modules/platform/errors/error.filter.ts',
      'src/features/system-health/index.ts', 'src/features/system-health/transport/http/live.controller.ts',
    ]) assert.ok(files.includes(file), file);
    assert.ok(!files.some(file => file.startsWith('apps/migrate/')), 'only api apps get an entrypoint');
  });
  it('every behaviour file of the back-end skeleton has a spec beside it', async t => {
    const { dir } = await skeleton(t, BE);
    const files = new Set(filesUnder(dir));
    for (const file of ['env-source', 'server.config', 'json-logger', 'domain-error', 'error.filter'].flatMap(name => [...files].filter(candidate => candidate.endsWith(`/${name}.ts`)))) {
      assert.ok(files.has(file.replace(/\.ts$/, '.spec.ts')), `${file} has a spec`);
    }
    assert.ok(files.has('src/features/system-health/transport/http/live.controller.spec.ts'));
  });
  it('the back-end skeleton follows HFS: one env reader, an enum-named logger port, the Terminus health shape, per-app options', async t => {
    const { dir } = await skeleton(t, BE);
    const sources = filesUnder(dir).filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
    assert.deepEqual(sources.filter(file => /process\.env/.test(read(dir, file))), ['src/modules/platform/config/env-source.ts'], 'process.env is read only by platform/config');
    assert.ok(sources.every(file => !/console\.|new Error\(|synchronize|@Cron/.test(read(dir, file))));
    assert.match(read(dir, 'src/modules/platform/logging/log-id.ts'), /export enum LogId/);
    assert.match(read(dir, 'src/modules/platform/logging/logger.port.ts'), /abstract error\(id: LogId/);
    assert.match(read(dir, 'src/features/system-health/transport/http/live.controller.ts'), /@Get\("live"\)[\s\S]*health\.check\(\[\]\)/);
    assert.match(read(dir, 'apps/core/src/core.composition.spec.ts'), /toEqual\(\{ status: "ok", info: \{\}, error: \{\}, details: \{\} \}\)/);
    assert.match(read(dir, 'apps/core/src/app.module.ts'), /static register\(options: CoreOptions\): DynamicModule/);
    assert.match(read(dir, 'apps/core/src/app.module.ts'), /APP_FILTER/);
    assert.match(read(dir, 'apps/core/src/main.ts'), /EnvSource\.fromProcess\(\)/);
    assert.doesNotMatch(filesUnder(dir).map(file => read(dir, file)).join('\n'), /\{\{[a-zA-Z]/, 'no template placeholder is left');
  });
  it('a front end gets the next-intl [locale] shell: vi default, as-needed prefix, proxy.ts, error boundaries and the health route', async t => {
    const { dir } = await skeleton(t, FE);
    const files = filesUnder(dir);
    for (const app of ['app', 'admin']) {
      for (const file of ['next.config.ts', 'src/proxy.ts', 'src/app/global-error.tsx', 'src/app/globals.css', 'src/app/health/live/route.ts',
        'src/app/[locale]/layout.tsx', 'src/app/[locale]/page.tsx', 'src/app/[locale]/error.tsx', 'src/app/[locale]/not-found.tsx',
        'src/modules/i18n/config.ts', 'src/modules/i18n/routing.ts', 'src/modules/i18n/navigation.ts', 'src/modules/i18n/request.ts', 'src/modules/i18n/messages/vi.json']) {
        assert.ok(files.includes(`apps/${app}/${file}`), `apps/${app}/${file}`);
      }
    }
    assert.ok(!files.some(file => file.endsWith('middleware.ts')), 'Next 16 uses proxy.ts');
    assert.match(read(dir, 'apps/app/src/modules/i18n/routing.ts'), /defaultLocale: DEFAULT_LOCALE[\s\S]*localePrefix: "as-needed"/);
    assert.match(read(dir, 'apps/app/src/modules/i18n/config.ts'), /DEFAULT_LOCALE: Locale = "vi"/);
    assert.match(read(dir, 'apps/app/src/proxy.ts'), /export default createMiddleware\(routing\)/);
    assert.match(read(dir, 'apps/app/src/app/[locale]/layout.tsx'), /<html lang=\{locale\}>/);
    assert.match(read(dir, 'apps/app/src/app/health/live/route.ts'), /\{ status: "ok", info: \{\}, error: \{\}, details: \{\} \}/);
    assert.deepEqual(Object.keys(JSON.parse(read(dir, 'apps/app/src/modules/i18n/messages/vi.json'))).sort(), ['errors', 'home', 'notFound']);
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

    fs.writeFileSync(path.join(dir, 'codecov.yml'), '# hand written\n');
    fs.mkdirSync(path.join(dir, '.starciwork', 'features', 'a', 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starciwork', 'features', 'a', 'evidence', 'run.log'), 'log\n');
    fs.mkdirSync(path.join(dir, '.starcistacks', 'dev', 'secrets'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.starcistacks', 'dev', 'secrets', 'db.txt'), 'x\n');
    execFileSync('git', ['add', '-f', '.'], { cwd: dir });
    const result = await checkHfsSync(dir, { presets: PRESETS.be });
    assert.equal(result.ok, false);
    assert.deepEqual(result.findings.map(finding => [finding.code, finding.file]).sort(), [
      ['HFS_STACKS_PLAINTEXT', '.starcistacks/dev/secrets/db.txt'],
      ['HFS_SYNC_DRIFT', 'codecov.yml'],
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
