import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { docFreshFindings } from '../runtime/scripts/hfs/rules/doc-fresh.mjs';
import { a15Findings } from '../runtime/scripts/hfs/rules/a15-findings.mjs';
import { checkRepo } from '../runtime/scripts/hfs/check.mjs';

/** A rule id no catalog has, built from parts: the fixture text is data of the test, not a citation of the catalog. */
const UNKNOWN = ['R', '9', '9', '9'].join('');

// proves: HFS_DOC_PATH_MISSING@lite HFS_DOC_PATH_MISSING@full
// proves: HFS_DOC_COMMAND_UNKNOWN@lite HFS_DOC_COMMAND_UNKNOWN@full
// proves: HFS_DOC_ENV_UNKNOWN@lite HFS_DOC_ENV_UNKNOWN@full
// proves: HFS_DOC_RULE_UNKNOWN@lite HFS_DOC_RULE_UNKNOWN@full

function fixture(t, edition, files, options = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-doc-fresh-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, file), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return { repoRoot, files: Object.keys(files), repo: { edition, profile: 'app' }, ...options };
}

const manifests = {
  'package.json': { name: 'demo', version: '1.2.3', scripts: { build: 'node build.mjs', lint: 'eslint .' } },
  'be/package.json': { scripts: { 'contract:emit': 'starci app emit', lint: 'eslint .' } },
  'be/apps/api/src/api.env.ts': 'import { parseDatabaseConfig } from "@modules/platform/database"; export const readApiEnv = (env: EnvSource) => ({ port: env.int("PORT"), database: parseDatabaseConfig(env) });',
  'be/src/modules/platform/database/index.ts': 'export { parseDatabaseConfig } from "./database.config";',
  'be/src/modules/platform/database/database.config.ts': 'export const parseDatabaseConfig = (source: EnvSource) => ({ url: source.secret("PRIMARY_DB_URL") });',
  '.starcistacks/production/KEYS.md': '| Key | Meaning |\n| --- | --- |\n| `NEXT_PUBLIC_SITE_URL` | Browser origin |',
  '.starcistacks/production/infra/swarm/stack.yaml': 'services: {}',
};

const appDeclaration = (edition) => ({ hfs: 3, kind: 'app', project: 'demo', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });

const appDocFindings = (context, edition) => checkRepo({ repoRoot: context.repoRoot, declaration: appDeclaration(edition), files: context.files, tree: false }).findings.filter((finding) => finding.code.startsWith('HFS_DOC_'));

for (const edition of ['lite', 'full']) {
  test(`HFS_DOC_PATH_MISSING@${edition}: broken code, prose, links and stack README paths fail`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'README.md': 'Read `.claude/fe/canon/retired.md` and [guide](docs/deleted.md#overview). Plain path be/src/retired.ts.',
      'docs/deploy.md': 'Load `secrets.env`.',
      '.starcistacks/production/README.md': 'Use [stack](infra/swarm/deleted.yaml).',
    });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_PATH_MISSING');
    assert.equal(hits.length, 5, JSON.stringify(hits));
    assert.deepEqual(new Set(hits.map((finding) => finding.path)), new Set(['README.md', 'docs/deploy.md', '.starcistacks/production/README.md']));
    assert.ok(hits.every((finding) => finding.level === 'error' && finding.line > 0));
  });

  test(`HFS_DOC_PATH_MISSING@${edition}: current paths, relative links, directories, URLs and placeholders pass`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'README.md': 'Use `be/`, `package.json`, `.starcistacks/production/infra/swarm/stack.yaml`. [Guide](docs/deploy.md#deploy). API `/health`, https://example.test/a/b and `apps/<app>/src/<app>.env.ts` are examples. `docs/*.md` is a family.',
      'docs/deploy.md': '[README](../README.md). Source `be/apps/api/src/api.env.ts`.',
      '.starcistacks/production/README.md': '[stack](infra/swarm/stack.yaml).',
    });
    assert.deepEqual(docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_PATH_MISSING'), []);
  });

  test(`HFS_DOC_PATH_MISSING@${edition}: environment API expressions pass while file citations remain checked`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'README.md': 'Read values through `process.env` or `import.meta.env`. Load `missing.env` and [file](process.env).',
    });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_PATH_MISSING');
    assert.deepEqual(hits.map((finding) => finding.reference), ['process.env', 'missing.env']);
  });

  test(`HFS_DOC_PATH_MISSING@${edition}: only declared reports in ignored slots need no tracked output`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'sonar-project.properties': 'sonar.javascript.lcov.reportPaths=be/coverage/lcov.info,be/src/missing.ts,unknown/lcov.info',
      'README.md': 'The test writes `be/coverage/lcov.info`. Missing `be/coverage/missing.json`, `be/src/missing.ts` and `unknown/lcov.info` remain errors.',
    });
    const hits = appDocFindings(context, edition).filter((finding) => finding.code === 'HFS_DOC_PATH_MISSING');
    assert.deepEqual(hits.map((finding) => finding.reference), ['be/coverage/missing.json', 'be/src/missing.ts', 'unknown/lcov.info']);
    const undeclared = appDocFindings({ ...context, files: context.files.filter((file) => file !== 'sonar-project.properties') }, edition);
    assert.ok(undeclared.some((finding) => finding.reference === 'be/coverage/lcov.info'));
  });

  test(`HFS_DOC_COMMAND_UNKNOWN@${edition}: deleted npm scripts and app verbs fail in prose and fences`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'README.md': 'Run `npm run env-sync`. Run starci app retired.\n```sh\nstarci app missing-verb\n```',
      'be/docs/setup.md': 'Run `npm run build`.',
    });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_COMMAND_UNKNOWN');
    assert.equal(hits.length, 4, JSON.stringify(hits));
    assert.ok(hits.some((finding) => finding.path === 'be/docs/setup.md'));
  });

  test(`HFS_DOC_COMMAND_UNKNOWN@${edition}: nearest scripts, cd, npm prefix and catalog app verbs pass`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'README.md': 'Run `npm run build`, `npm --prefix be run contract:emit`, `npx starci app check`.\n```sh\ncd be\nnpm run contract:emit\n```\nRun `starci app secret verify production`.\nThe command starci app retired is removed.',
      'be/docs/setup.md': 'Run `npm run contract:emit` or starci app lint.',
    });
    assert.deepEqual(docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_COMMAND_UNKNOWN'), []);
  });

  test(`HFS_DOC_COMMAND_UNKNOWN@${edition}: workspace commands resolve the workspace manifests`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'package.json': { workspaces: ['fe/packages/*'], scripts: {} },
      'fe/packages/ui/package.json': { scripts: { build: 'tsc' } },
      'fe/packages/core/package.json': { scripts: { build: 'tsc' } },
      'README.md': 'Run `npm run build --workspaces`.\nRun `npm run removed --workspaces` or `npm run build`.',
    });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_COMMAND_UNKNOWN');
    assert.deepEqual(hits.map((finding) => finding.reference), ['npm run removed', 'npm run build']);
    assert.ok(hits[0].message.includes('fe/packages/ui/package.json'));
    assert.ok(hits[1].message.includes('package.json'));
    fs.writeFileSync(path.join(context.repoRoot, 'fe/packages/core/package.json'), JSON.stringify({ scripts: {} }));
    const missingWorkspace = docFreshFindings(context).filter((finding) => finding.reference === 'npm run build' && finding.line === 1);
    assert.equal(missingWorkspace.length, 1);
    assert.ok(missingWorkspace[0].message.includes('fe/packages/core/package.json'));
  });

  test(`HFS_DOC_ENV_UNKNOWN@${edition}: undeclared key names fail without exposing assigned values`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'README.md': 'Environment `RETIRED_DB_URL` is required.\nRETIRED_TOKEN=example-placeholder\nprocess.env.RETIRED_PORT',
    });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_ENV_UNKNOWN');
    assert.deepEqual(hits.map((finding) => finding.reference), ['RETIRED_DB_URL', 'RETIRED_TOKEN', 'RETIRED_PORT']);
    assert.ok(hits.every((finding) => !finding.message.includes('example-placeholder')));
  });

  test(`HFS_DOC_ENV_UNKNOWN@${edition}: typed readers, delegated capability keys, KEYS.md and mounted keys pass`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'README.md': 'Environment `PORT`, `PRIMARY_DB_URL`, `PRIMARY_DB_URL_FILE`, `NEXT_PUBLIC_SITE_URL`. SQL uses RLS and CQRS. Finding `HFS_DOC_PATH_MISSING`.',
    });
    assert.deepEqual(docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_ENV_UNKNOWN'), []);
  });

  test(`HFS_DOC_ENV_UNKNOWN@${edition}: declared DI tokens pass while explicit environment references still fail`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'be/src/modules/domain/order/order.decorators.ts': 'export const ORDER_ENTITY_MANAGER: unique symbol = Symbol("order.em"); export const CART_SERVICE = Symbol.for("cart.service");\n// const COMMENT_TOKEN = Symbol("comment");\nconst text = "const STRING_TOKEN = Symbol(42);";',
      'be/src/tests/fixtures/tokens.ts': 'export const ONLY_TEST_TOKEN = Symbol("test");',
      'README.md': 'Constructor tokens `ORDER_ENTITY_MANAGER`, `CART_SERVICE`.\nEnvironment `ORDER_ENTITY_MANAGER`.\nprocess.env.CART_SERVICE\nUndeclared `MISSING_SERVICE`, `COMMENT_TOKEN`, `STRING_TOKEN`, `ONLY_TEST_TOKEN`.',
    });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_ENV_UNKNOWN');
    assert.deepEqual(hits.map((finding) => [finding.reference, finding.line]), [
      ['ORDER_ENTITY_MANAGER', 2], ['CART_SERVICE', 3], ['MISSING_SERVICE', 4], ['COMMENT_TOKEN', 4], ['STRING_TOKEN', 4], ['ONLY_TEST_TOKEN', 4],
    ]);
  });

  test(`HFS_DOC_ENV_UNKNOWN@${edition}: declared error codes and error-code prose pass while undeclared environment keys still fail`, (t) => {
    const context = fixture(t, edition, { ...manifests,
      'be/src/modules/platform/http-security/errors/http-security.error.ts': 'export enum HttpSecurityErrorCode { RequestInvalid = "HTTP_SECURITY_REQUEST_INVALID", RateLimited = "HTTP_SECURITY_RATE_LIMITED" }',
      'be/src/modules/platform/http-security/messages/http-security.messages.ts': 'export const en = { "errors.HTTP_SECURITY_ORIGIN_REJECTED": "Origin rejected" };',
      'be/src/tests/fixtures/codes.error.ts': 'export const ONLY_TEST_CODE = "TEST_ONLY_CODE";',
      'README.md': [
        'A bad body answers `HTTP_SECURITY_REQUEST_INVALID`; a flood answers `HTTP_SECURITY_RATE_LIMITED`.',
        'A foreign origin answers `HTTP_SECURITY_ORIGIN_REJECTED`.',
        'The error code `PROVIDER_TIMEOUT` is mapped by the gateway.',
        'Environment `HTTP_SECURITY_REQUEST_INVALID`.',
        'process.env.HTTP_SECURITY_RATE_LIMITED',
        'Undeclared `TEST_ONLY_CODE` and `RETIRED_DB_URL`.',
      ].join('\n'),
    });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_ENV_UNKNOWN');
    assert.deepEqual(hits.map((finding) => [finding.reference, finding.line]), [
      ['HTTP_SECURITY_REQUEST_INVALID', 4], ['HTTP_SECURITY_RATE_LIMITED', 5], ['TEST_ONLY_CODE', 6], ['RETIRED_DB_URL', 6],
    ]);
  });

  test(`HFS_DOC_RULE_UNKNOWN@${edition}: nonexistent rule references fail`, (t) => {
    const context = fixture(t, edition, { ...manifests, 'docs/policy.md': `Follow ${UNKNOWN} and \`${UNKNOWN}9\`.` });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_RULE_UNKNOWN');
    assert.deepEqual(hits.map((finding) => finding.reference), [UNKNOWN, `${UNKNOWN}9`]);
  });

  test(`HFS_DOC_RULE_UNKNOWN@${edition}: current catalog rule ids resolve`, (t) => {
    const context = fixture(t, edition, { ...manifests, 'README.md': 'Follow R06, R243 and R270-R271.' });
    assert.deepEqual(docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_RULE_UNKNOWN'), []);
  });

  test(`R270@${edition}: staged scope filters docs while all supplies the reference inventory`, (t) => {
    const context = fixture(t, edition, { ...manifests, 'README.md': '`be/apps/api/src/api.env.ts`.', 'docs/unselected.md': '`be/src/missing.ts`.' }, { inScope: (file) => file === 'README.md' });
    context.all = context.files;
    context.files = ['README.md', 'docs/unselected.md'];
    assert.deepEqual(docFreshFindings(context), []);
  });

  test(`R270@${edition}: registered finder reaches app check with Vietnamese catalog explanations`, (t) => {
    const context = fixture(t, edition, { ...manifests, 'README.md': `Read \`docs/missing.md\`. Environment \`OLD_ENV_KEY\`. Follow ${UNKNOWN}. Run \`starci app missing-verb\`.` });
    assert.equal(a15Findings(context).filter((finding) => finding.code.startsWith('HFS_DOC_')).length, 4);
    const declaration = { hfs: 3, kind: 'app', project: 'demo', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
    const result = checkRepo({ repoRoot: context.repoRoot, declaration, files: context.files, tree: false });
    const hits = result.findings.filter((finding) => finding.code.startsWith('HFS_DOC_'));
    assert.equal(hits.length, 4);
    assert.ok(hits.every((finding) => finding.titleVi && finding.whyVi && finding.nextStepVi));
  });

  test(`R270@${edition}: app-root judging resolves side docs once against the whole app`, (t) => {
    const files = { ...manifests,
      'be/jest.config.js': 'module.exports = {};',
      'be/src/tests/world/test-world.config.ts': 'export const world = {};',
      'be/docs/guides/testing.md': '[manifest](../../../package.json), [stack](../../../.starcistacks/production/infra/swarm/stack.yaml). Source `jest.config.js`, `src/tests/`, `src/tests/world/test-world.config.ts`.\nRun `npm run build`.\nMissing `be/src/retired.ts`, `src/retired` and [invalid relative](jest.config.js).',
    };
    delete files['be/package.json'];
    const context = fixture(t, edition, files);
    const hits = appDocFindings(context, edition);
    assert.deepEqual(hits.map((finding) => [finding.code, finding.path, finding.reference]), [
      ['HFS_DOC_PATH_MISSING', 'be/docs/guides/testing.md', 'jest.config.js'],
      ['HFS_DOC_PATH_MISSING', 'be/docs/guides/testing.md', 'be/src/retired.ts'],
      ['HFS_DOC_PATH_MISSING', 'be/docs/guides/testing.md', 'src/retired'],
    ]);
    const rootOnly = { ...context, files: ['package.json'], all: context.files };
    assert.equal(docFreshFindings(rootOnly).length, 3);
    assert.deepEqual(docFreshFindings({ ...rootOnly, inScope: (file) => file === 'README.md' }), []);
    const side = { repoRoot: path.join(context.repoRoot, 'be'), files: ['docs/guides/testing.md'], repo: { edition, profile: 'be' } };
    assert.deepEqual(docFreshFindings({ ...side, appSide: true }), []);
    assert.ok(docFreshFindings(side).length > 0, 'a standalone side keeps its own documentation checks');
  });
}

test('R270 leaves runtime documentation and other product files to their existing rules', (t) => {
  const context = fixture(t, 'full', { 'CONTEXT.md': `\`docs/missing.md\` ${UNKNOWN}`, 'notes.md': `\`docs/missing.md\` ${UNKNOWN}`, 'docs/reference.yaml': 'path: docs/missing.md' });
  assert.deepEqual(docFreshFindings(context), []);
  assert.deepEqual(docFreshFindings({ ...context, files: ['README.md'], repo: { edition: 'full', profile: 'runtime' } }), []);
});
