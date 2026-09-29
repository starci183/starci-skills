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
  BLOCK_BEGIN, BLOCK_END, TARGETS, checkTargets, hashOf, loadPresets, render, renderTargets, runSync, validateHfs, writeTargets,
} from '../packages/hfs/sync/index.mjs';
import { hygieneFindings, runWorkHygiene } from '../packages/hfs/sync/hygiene.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const jestPreset = require('../packages/jest-preset/index.cjs');
const vitestPreset = await import('../packages/vitest-preset/index.mjs');

const BE = { hfs: 2, profile: 'be', project: 'nivo', apps: [{ name: 'core', kind: 'api' }, { name: 'migrate', kind: 'migrate' }] };
const FE = { hfs: 2, profile: 'fe', project: 'nivo', apps: [{ name: 'app', kind: 'web' }, { name: 'admin', kind: 'web' }] };
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
    for (const bad of [null, { ...BE, hfs: 1 }, { ...BE, profile: 'mobile' }, { ...BE, project: 'Nivo Backend' }, { ...BE, apps: [] }, { ...BE, apps: [{ name: 'core' }, { name: 'core' }] }]) {
      assert.throws(() => validateHfs(bad), /HFS_SYNC_HFS_INVALID/);
    }
  });
});

describe('the generated file set', () => {
  it('a back end owns seven files including .starciwork/.gitignore and a front end owns the other six', () => {
    assert.deepEqual(Object.keys(rendered(BE)).sort(), ['.github/workflows/ci.yml', '.github/workflows/e2e.yml', '.gitignore', '.husky/pre-commit', '.starciwork/.gitignore', 'codecov.yml', 'sonar-project.properties']);
    assert.deepEqual(Object.keys(rendered(FE)).sort(), ['.github/workflows/ci.yml', '.github/workflows/e2e.yml', '.gitignore', '.husky/pre-commit', 'codecov.yml', 'sonar-project.properties']);
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

describe('.github/workflows', () => {
  for (const hfs of [BE, FE]) {
    it(`${hfs.profile} ci.yml runs lint, typecheck, unit, hfs check and sonar, with no e2e`, () => {
      const text = rendered(hfs)['.github/workflows/ci.yml'];
      const doc = parseYaml(text);
      assert.deepEqual(Object.keys(doc.on).sort(), ['pull_request', 'push']);
      assert.deepEqual(doc.on.push.branches, ['main']);
      const runs = doc.jobs.ci.steps.map(step => step.run).filter(Boolean);
      for (const command of ['npm run lint:check', 'npm run typecheck', 'npm run test:ci', 'npx hfs check', 'npx hfs sync --check', 'npm ci']) assert.ok(runs.includes(command), command);
      assert.ok(runs.includes(`node "$STARCI_HOME/bin/starci.mjs" link --side ${hfs.profile}`));
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
    await assert.rejects(loadPresets(repo(t, BE), 'be'), /HFS_SYNC_PRESET_MISSING.*@starci\/jest-preset.*starci link --side be/);
  });
});

describe('the drift check', () => {
  it('--write creates every file and --check then passes', async t => {
    const dir = repo(t, BE);
    assert.equal((await run(['--check'], dir)).code, 1, 'nothing is written yet');
    const written = await run(['--write'], dir);
    assert.equal(written.code, 0);
    assert.match(written.lines.at(-1), /7 written, 0 already in sync/);
    const checked = await run(['--check'], dir);
    assert.equal(checked.code, 0);
    assert.match(checked.lines.at(-1), /7 of 7 in sync/);
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
    fs.writeFileSync(path.join(dir, 'hfs.json'), '{"hfs":2,"profile":"be"}');
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
    const ignored = file => file.includes('/evidence/');
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
  it('asks git which .starciwork files the generated allowlist ignores', t => {
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
    assert.equal(runWorkHygiene({ cwd: dir, out: line => lines.push(line) }), 1);
    assert.match(lines[0], /^HFS_WORK_AGENT_DATA \.starciwork\/features\/login\/evidence\/run\.log/);
    git('rm', '-q', '--cached', '.starciwork/features/login/evidence/run.log');
    assert.equal(runWorkHygiene({ cwd: dir, out: () => {} }), 0);
  });
});
