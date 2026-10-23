// proves: HFS_RELEASE_TAG_MISMATCH@lite
// proves: HFS_RELEASE_TAG_MISMATCH@full
// proves: HFS_DB_DEPLOY_UNGUARDED@lite
// proves: HFS_DB_DEPLOY_UNGUARDED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { stringifyYaml as stringify } from '../runtime/engine/yaml.mjs';
import { withoutGitLocalEnv } from '../runtime/scripts/lib/git.mjs';
import { releaseProvenanceFindings } from '../runtime/scripts/hfs/rules/release-provenance.mjs';

const IMAGE = '.github/workflows/images.yml';
const DB = '.github/workflows/db-deploy.yml';
const VERSION = '1.2.3';
const TAG_GUARD = "startsWith(github.ref, 'refs/tags/v')";
const CHECKOUT = { uses: 'actions/checkout@0123456789012345678901234567890123456789' };
const MIGRATE = { run: 'npm run db:push' };
const TRIGGER = { push: { tags: ['v*'] }, workflow_dispatch: {} };

function tree(t, content = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-release-provenance-'));
  const entries = { 'package.json': JSON.stringify({ name: 'demo', version: VERSION }), ...content };
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(entries)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  return { repoRoot: dir, files: Object.keys(entries) };
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, env: withoutGitLocalEnv(process.env), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
}

function tagged(t, tag, content) {
  const fixture = tree(t, content);
  git(fixture.repoRoot, 'init', '--quiet');
  git(fixture.repoRoot, 'add', '.');
  git(fixture.repoRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--no-gpg-sign', '-m', 'fixture');
  git(fixture.repoRoot, 'tag', tag);
  return fixture;
}

function check(fixture, edition, extra = {}) {
  return releaseProvenanceFindings({ ...fixture, repo: { kind: 'app', profile: 'app', edition }, isRoot: true, ...extra });
}

const dbWorkflow = (job = {}, on = TRIGGER) => stringify({ name: 'database deploy', on, jobs: { deploy: { 'runs-on': 'ubuntu-latest', steps: [CHECKOUT, MIGRATE], ...job } } });
const imageWorkflow = (tags = 'ghcr.io/demo/api:${{ github.ref_name }}', job = {}, on = TRIGGER) => stringify({
  name: 'images', on, jobs: { image: { 'runs-on': 'ubuntu-latest', if: TAG_GUARD, steps: [CHECKOUT, { uses: 'docker/build-push-action@0123456789012345678901234567890123456789', with: { context: '.', tags, push: true } }], ...job } },
});
const codes = (findings) => findings.map((finding) => finding.code);

for (const edition of ['lite', 'full']) {
  test(`HFS_RELEASE_TAG_MISMATCH@${edition}: tagged package and image refs agree, including prerelease/build semver`, (t) => {
    const version = '2.0.0-alpha.15+build.7';
    const fixture = tagged(t, `v${version}`, {
      'package.json': JSON.stringify({ version }), [IMAGE]: imageWorkflow(), [DB]: dbWorkflow({ if: TAG_GUARD }),
    });
    assert.deepEqual(check(fixture, edition), []);
  });

  test(`HFS_RELEASE_TAG_MISMATCH@${edition}: injected GitHub Actions refs are checked and deduplicated`, (t) => {
    const fixture = tagged(t, `v${VERSION}`);
    const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/tags/v9.9.9' };
    assert.deepEqual(check(fixture, edition, { env }).map((finding) => finding.tag), ['v9.9.9']);
    env.GITHUB_REF = `refs/tags/v${VERSION}`;
    assert.deepEqual(check(fixture, edition, { env }), []);
    env.GITHUB_ACTIONS = 'false';
    env.GITHUB_REF = 'refs/tags/v9.9.9';
    assert.deepEqual(check(fixture, edition, { env }), []);
  });

  test(`HFS_RELEASE_TAG_MISMATCH@${edition}: every release tag at HEAD must equal package version`, (t) => {
    const fixture = tagged(t, 'v1.2.2');
    git(fixture.repoRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'tag', '-a', `v${VERSION}`, '-m', 'release');
    const findings = check(fixture, edition);
    assert.deepEqual(codes(findings), ['HFS_RELEASE_TAG_MISMATCH']);
    assert.equal(findings[0].path, 'package.json');
    assert.equal(findings[0].tag, 'v1.2.2');
    assert.equal(findings[0].level, 'error');
    git(fixture.repoRoot, 'tag', 'vproduction');
    assert.equal(check(fixture, edition).length, 2, 'a non-semver v-tag cannot be a release');
    git(fixture.repoRoot, 'tag', 'v1.2.3-01');
    assert.equal(check(fixture, edition).length, 3, 'numeric prerelease identifiers cannot have leading zeros');
  });

  test(`HFS_RELEASE_TAG_MISMATCH@${edition}: ordinary development and tags on other commits do not invent a release`, (t) => {
    const fixture = tagged(t, `v${VERSION}`);
    git(fixture.repoRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--allow-empty', '--no-gpg-sign', '-m', 'development');
    fs.writeFileSync(path.join(fixture.repoRoot, 'package.json'), JSON.stringify({ version: '1.3.0' }));
    assert.deepEqual(check(fixture, edition), []);
    assert.deepEqual(check(tree(t), edition), [], 'an unpacked tree has no Git release ref');
  });

  test(`HFS_RELEASE_TAG_MISMATCH@${edition}: mutable, stale, missing and transformed image tags fail`, (t) => {
    for (const tags of ['ghcr.io/demo/api:ci', 'ghcr.io/demo/api:latest', 'ghcr.io/demo/api:v1.2.2', undefined,
      'ghcr.io/demo/api:v${{ github.ref_name }}', 'ghcr.io/demo/api:${{ github.ref_name }}-ci',
      'ghcr.io/demo/api:${{ github.ref_name }}\nghcr.io/demo/api:latest']) {
      const fixture = tree(t, { [IMAGE]: imageWorkflow(tags === undefined ? '' : tags) });
      assert.deepEqual(codes(check(fixture, edition)), ['HFS_RELEASE_TAG_MISMATCH'], `tags: ${String(tags)}`);
    }
    assert.deepEqual(check(tree(t, { [IMAGE]: imageWorkflow(`ghcr.io/demo/api:v${VERSION}`) }), edition), []);
    assert.deepEqual(check(tree(t, { [IMAGE]: imageWorkflow('ghcr.io/demo/api:${{github.ref_name}}', { if: undefined }, { push: { tags: ['v*'] } }) }), edition), []);
  });

  test(`HFS_RELEASE_TAG_MISMATCH@${edition}: manual image dispatch and checkout overrides require provenance`, (t) => {
    const unguarded = tree(t, { [IMAGE]: imageWorkflow(undefined, { if: undefined }) });
    assert.deepEqual(codes(check(unguarded, edition)), ['HFS_RELEASE_TAG_MISMATCH']);
    const override = tree(t, { [IMAGE]: imageWorkflow(undefined, { steps: [{ ...CHECKOUT, with: { ref: '${{ inputs.ref }}' } }, { uses: 'docker/build-push-action@0123456789012345678901234567890123456789', with: { tags: `ghcr.io/demo/api:v${VERSION}` } }] }) });
    assert.deepEqual(codes(check(override, edition)), ['HFS_RELEASE_TAG_MISMATCH']);
  });

  test(`HFS_DB_DEPLOY_UNGUARDED@${edition}: tag-only triggers and per-job release guards pass`, (t) => {
    for (const condition of [TAG_GUARD, `\${{ ${TAG_GUARD} }}`, `(${TAG_GUARD}) && success()`,
      `github.ref_type == 'tag' && startsWith(github.ref_name, 'v')`, `(${TAG_GUARD} && success()) || github.ref == 'refs/tags/v${VERSION}'`]) {
      assert.deepEqual(check(tree(t, { [DB]: dbWorkflow({ if: condition }) }), edition), [], condition);
    }
    assert.deepEqual(check(tree(t, { [DB]: dbWorkflow({}, { push: { tags: ['v*'] } }) }), edition), []);
  });

  test(`HFS_DB_DEPLOY_UNGUARDED@${edition}: non-tag dispatch and widened or unrelated guards fail`, (t) => {
    for (const condition of [undefined, `${TAG_GUARD} || true`, `!${TAG_GUARD}`, "contains(github.ref, 'refs/tags/v')",
      "github.ref_type == 'tag'", "github.ref == 'refs/tags/vproduction'", "inputs.ref_type == 'tag'"]) {
      const findings = check(tree(t, { [DB]: dbWorkflow({ if: condition }) }), edition);
      assert.deepEqual(codes(findings), ['HFS_DB_DEPLOY_UNGUARDED'], String(condition));
      assert.equal(findings[0].path, DB);
    }
    const commented = `# if: ${TAG_GUARD}\n${dbWorkflow()}`;
    assert.deepEqual(codes(check(tree(t, { [DB]: commented }), edition)), ['HFS_DB_DEPLOY_UNGUARDED']);
    assert.deepEqual(codes(check(tree(t, { [DB]: dbWorkflow({}, { push: { tags: ['v*'], branches: ['main'] } }) }), edition)), ['HFS_DB_DEPLOY_UNGUARDED']);
  });

  test(`HFS_DB_DEPLOY_UNGUARDED@${edition}: an unconditional rejecting shell guard runs before migration`, (t) => {
    for (const run of ['[[ "$GITHUB_REF" == refs/tags/v* ]] || exit 1', 'set -euo pipefail\ncase "$GITHUB_REF" in\n  refs/tags/v*) ;;\n  *) exit 1 ;;\nesac']) {
      const steps = [CHECKOUT, { run: 'npm ci --ignore-scripts' }, { run }, MIGRATE];
      assert.deepEqual(check(tree(t, { [DB]: dbWorkflow({ steps }) }), edition), [], run);
    }
    for (const guard of [{ run: '[[ "$GITHUB_REF" == refs/tags/v* ]] || exit 0' },
      { run: '[[ "$GITHUB_REF" == refs/tags/v* ]] || exit 1', if: 'false' },
      { run: '[[ "$GITHUB_REF" == refs/tags/v* ]] || exit 1', 'continue-on-error': true },
      { run: '# [[ "$GITHUB_REF" == refs/tags/v* ]] || exit 1\necho done' }]) {
      assert.deepEqual(codes(check(tree(t, { [DB]: dbWorkflow({ steps: [CHECKOUT, guard, MIGRATE] }) }), edition)), ['HFS_DB_DEPLOY_UNGUARDED']);
    }
    assert.deepEqual(codes(check(tree(t, { [DB]: dbWorkflow({ steps: [MIGRATE, { run: '[[ "$GITHUB_REF" == refs/tags/v* ]] || exit 1' }] }) }), edition)), ['HFS_DB_DEPLOY_UNGUARDED']);
    const guard = { run: '[[ "$GITHUB_REF" == refs/tags/v* ]] || exit 1' };
    for (const condition of ['always()', 'failure()', '!cancelled()']) {
      assert.deepEqual(codes(check(tree(t, { [DB]: dbWorkflow({ steps: [guard, { ...MIGRATE, if: condition }] }) }), edition)), ['HFS_DB_DEPLOY_UNGUARDED'], 'migration cannot ignore a failed shell guard');
    }
  });

  test(`HFS_DB_DEPLOY_UNGUARDED@${edition}: each deploy job and the checked-out ref are independently constrained`, (t) => {
    const doc = { on: TRIGGER, jobs: { safe: { if: TAG_GUARD, steps: [MIGRATE] }, unsafe: { steps: [MIGRATE] }, reusable: { uses: 'demo/workflows/.github/workflows/db.yml@main' } } };
    const findings = check(tree(t, { [DB]: stringify(doc) }), edition);
    assert.deepEqual(findings.map((finding) => finding.job), ['unsafe', 'reusable']);
    const steps = [{ ...CHECKOUT, with: { ref: 'main' } }, MIGRATE];
    assert.deepEqual(codes(check(tree(t, { [DB]: dbWorkflow({ if: TAG_GUARD, steps }) }), edition)), ['HFS_DB_DEPLOY_UNGUARDED']);
    steps[0].with.ref = '${{ github.ref }}';
    assert.deepEqual(check(tree(t, { [DB]: dbWorkflow({ if: TAG_GUARD, steps }) }), edition), []);
  });

  test(`release provenance@${edition}: malformed workflows fail without throwing and changed package versions recheck images`, (t) => {
    for (const text of ['jobs: [', 'jobs: {deploy: {steps: wrong}}', 'jobs: {deploy: {steps: [null]}}', 'name: images']) {
      assert.deepEqual(codes(check(tree(t, { [IMAGE]: text, [DB]: text }), edition)), ['HFS_RELEASE_TAG_MISMATCH', 'HFS_DB_DEPLOY_UNGUARDED']);
    }
    const fixture = tree(t, { [IMAGE]: imageWorkflow('demo/api:v1.2.2'), 'README.md': 'demo' });
    assert.deepEqual(check(fixture, edition, { inScope: (file) => file === 'README.md' }), []);
    assert.deepEqual(codes(check(fixture, edition, { inScope: (file) => file === 'package.json' })), ['HFS_RELEASE_TAG_MISMATCH']);
  });
}

test('release provenance: side scopes, runtime and nested products do not inherit root release tags', (t) => {
  assert.deepEqual(releaseProvenanceFindings({}), []);
  assert.deepEqual(releaseProvenanceFindings(), []);
  const fixture = tagged(t, 'v9.9.9', { [IMAGE]: imageWorkflow('demo/api:ci'), [DB]: dbWorkflow() });
  for (const repo of [{ kind: 'runtime', profile: 'app' }, { kind: 'app', profile: 'be' }, { kind: 'app', profile: 'fe' }]) assert.deepEqual(releaseProvenanceFindings({ ...fixture, repo, isRoot: repo.profile === 'app' }), []);
  assert.deepEqual(check(fixture, 'lite', { isRoot: false }), []);
  const nested = path.join(fixture.repoRoot, 'example');
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ version: VERSION }));
  assert.deepEqual(check({ repoRoot: nested, files: ['package.json'] }, 'full'), []);
});
