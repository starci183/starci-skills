import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReadmeBadges, badgeTokenNotices } from '../sync/readme-badges.mjs';
import { badgeVisibilityNotices, verifyCi } from '../ci/verify.mjs';
import { secretHits, secretHitsInFile } from '../runtime/scripts/lib/secret-patterns.mjs';
import { secretFileFindings } from '../runtime/scripts/hfs/rules/secrets.mjs';

const begin = '<!-- >>> starci app sync (managed block; do not edit) >>> -->';
const end = '<!-- <<< starci app sync <<< -->';
const manifestFile = '.starcistacks/application-stacks.yaml';
const value = ['badge', 'Public', '123456789'].join('');
const provider = ['gh', 'p_', 'a'.repeat(36)].join('');
const doc = () => ({ ci: { github: { repository: 'team/product', visibility: 'private' } }, services: {
  codecov: { mode: 'hosted' }, sonar: { mode: 'hosted', provider: 'sonarcloud', projects: [{ key: 'product' }] },
} });
const block = image => `${begin}\n\n${image}\n\n${end}\n`;
const image = (host = 'codecov.io', token = value, parameter = 'token') => `![Codecov](https://${host}/gh/team/product/branch/main/graph/badge.svg?${parameter}=${token})`;
const hits = (text, manifestText) => secretHitsInFile('README.md', text, { manifestText });

test('hygiene-style secret findings use the companion manifest for a custom Sonar host', () => {
  const text = block(`![Quality Gate](https://quality.internal/api/project_badges/measure?project=product&metric=alert_status&token=${value})`);
  const manifestText = 'services:\n  sonar:\n    provider: sonarqube\n    host:\n      public: https://quality.internal\n';
  assert.deepEqual(secretFileFindings({ file: 'app/README.md', text, manifestText }), []);
  assert.ok(secretFileFindings({ file: 'app/README.md', text }).length);
  assert.ok(secretFileFindings({ file: 'app/README.md', text: `${text}token=${value}\n`, manifestText }).length);
});

test('badge tokens appear only in encoded image queries, with and without a Codecov flag', () => {
  const declaration = doc();
  const original = renderReadmeBadges(declaration);
  assert.match(original, /graph\/badge\.svg\)/);
  assert.match(original, /metric=alert_status\)/);
  declaration.services.codecov.badgeToken = 'public badge/&';
  declaration.services.sonar.badgeToken = value;
  let rendered = renderReadmeBadges(declaration);
  assert.ok(rendered.includes('badge.svg?token=public%20badge%2F%26)'));
  assert.ok(rendered.includes(`metric=alert_status&token=${value})`));
  assert.ok(rendered.includes('](https://codecov.io/gh/team/product)'));
  assert.ok(rendered.includes('](https://sonarcloud.io/dashboard?id=product)'));
  declaration.services.codecov.flag = 'be/unit';
  rendered = renderReadmeBadges(declaration);
  assert.ok(rendered.includes('?flag=be%2Funit&token=public%20badge%2F%26'));
  delete declaration.services.codecov.badgeToken;
  assert.ok(renderReadmeBadges(declaration).includes('badge.svg?flag=be%2Funit)'));
});

test('notices require private visibility, missing tokens and actually rendered badges', () => {
  const declaration = doc();
  const notices = badgeTokenNotices(declaration, {});
  assert.equal(notices.length, 2);
  assert.equal(notices[0], 'README_BADGE_TOKEN_MISSING notice: the Codecov badge of a private repository renders "unknown" without services.codecov.badgeToken (a read-only badge token, not a CI secret)');
  assert.match(notices[1], /the Sonar badge/);
  assert.deepEqual(badgeTokenNotices(declaration, { example: true }), []);
  for (const visibility of ['public', undefined]) {
    declaration.ci.github.visibility = visibility;
    assert.deepEqual(badgeTokenNotices(declaration, {}), []);
  }
  declaration.ci.github.visibility = 'private';
  declaration.services.codecov.badgeToken = value;
  declaration.services.sonar.badgeToken = value;
  assert.deepEqual(badgeTokenNotices(declaration, {}), []);
  delete declaration.services.codecov.badgeToken;
  declaration.services.codecov.mode = 'disabled';
  assert.deepEqual(badgeTokenNotices(declaration, {}), []);
  delete declaration.ci.github.repository;
  assert.deepEqual(badgeTokenNotices(declaration, {}), []);
});

test('visibility uses the injected gh seam only when undeclared and fails silently', () => {
  const declaration = doc();
  const gh = { json: args => { assert.deepEqual(args, ['repo', 'view', '--json', 'visibility', '--repo', 'team/product']); return { visibility: 'INTERNAL' }; } };
  assert.equal(badgeVisibilityNotices({ doc: declaration, repo: 'team/product', gh: { json: () => assert.fail('declared visibility must stay offline') } }).length, 2);
  delete declaration.ci.github.visibility;
  assert.equal(badgeVisibilityNotices({ doc: declaration, repo: 'team/product', gh }).length, 2);
  assert.deepEqual(badgeVisibilityNotices({ doc: declaration, repo: 'team/product', gh: { json: () => { throw new Error('offline'); } } }), []);
  assert.deepEqual(badgeVisibilityNotices({ doc: declaration, repo: 'team/product', gh: { json: () => ({ visibility: 'PUBLIC' }) } }), []);
});

test('verification notices preserve success and are included in text and JSON', () => {
  const notices = badgeTokenNotices(doc(), {});
  for (const json of [false, true]) {
    let output = '';
    const result = verifyCi({ declaration: { secrets: [], vars: [], dependabotSecrets: [] }, sealed: [],
      gh: { repository: () => 'team/product', json: () => [] }, options: { json }, notices, stdout: text => { output += text; } });
    assert.equal(result, 0);
    if (json) { assert.equal(JSON.parse(output).ok, true); assert.deepEqual(JSON.parse(output).notices, notices); }
    else for (const notice of notices) assert.ok(output.includes(notice));
  }
});

test('manifest exemption follows the whole-file indentation path and leaves other assignments refused', () => {
  assert.ok(secretHits(manifestFile, `badgeToken: ${value}`).length);
  for (const service of ['codecov', 'sonar']) {
    const text = `services:\n  ${service}:\n    badgeToken: ${value}\n`;
    assert.deepEqual(secretHitsInFile(manifestFile, text), []);
    assert.deepEqual(secretFileFindings({ file: manifestFile, text }), []);
  }
  for (const text of [
    `services:\n  analytics:\n    badgeToken: ${value}\n`,
    `services:\n  codecov:\n    apiToken: ${value}\n`,
    `other:\n  services:\n    codecov:\n      badgeToken: ${value}\n`,
    `services: |\n  codecov:\n    badgeToken: ${value}\n`,
    `services:\n  codecov:\n    badgeToken: ${provider}\n`,
  ]) assert.ok(secretHitsInFile(manifestFile, text).length);
});

test('managed badge images exempt only the token query on approved hosts and retain provider shapes', () => {
  assert.deepEqual(hits(block(image())), []);
  assert.ok(hits(image()).length);
  assert.ok(hits(block(image('untrusted.invalid'))).length);
  assert.ok(hits(block(image('codecov.io', value, 'apiToken'))).length);
  assert.ok(hits(block(image('codecov.io', provider))).some(hit => hit.pattern === 'github-token'));
  assert.ok(hits(block(`[Codecov](https://codecov.io/gh/team/product/branch/main/graph/badge.svg?token=${value})`)).length);
  assert.ok(hits(block(`![?token=${value}](https://codecov.io/gh/team/product/branch/main/graph/badge.svg)`)).length);
  const sonar = `![Quality Gate](https://quality.internal/api/project_badges/measure?project=product&metric=alert_status&token=${value})`;
  const manifestText = 'services:\n  sonar:\n    provider: sonarqube\n    host:\n      public: https://quality.internal\n';
  assert.deepEqual(hits(block(sonar), manifestText), []);
  assert.ok(hits(block(sonar)).length);
  assert.deepEqual(hits(block(sonar.replace('quality.internal', 'sonarcloud.io'))), []);
  assert.ok(hits(block(sonar.replace('quality.internal', 'sonarcloud.io')), manifestText).length);
  assert.ok(hits(`${block(image())}token=${value}\n`).some(hit => hit.line === 6));
});
