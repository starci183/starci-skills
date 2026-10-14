import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { docFreshFindings } from '../../scripts/hfs/rules/doc-fresh.mjs';
import { a15Findings } from '../../scripts/hfs/rules/a15-findings.mjs';
import { checkRepo } from '../../scripts/hfs/check.mjs';

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

  test(`HFS_DOC_RULE_UNKNOWN@${edition}: nonexistent rule references fail`, (t) => {
    const context = fixture(t, edition, { ...manifests, 'docs/policy.md': 'Follow R999 and `R9999`.' });
    const hits = docFreshFindings(context).filter((finding) => finding.code === 'HFS_DOC_RULE_UNKNOWN');
    assert.deepEqual(hits.map((finding) => finding.reference), ['R999', 'R9999']);
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
    const context = fixture(t, edition, { ...manifests, 'README.md': 'Read `docs/missing.md`. Environment `OLD_ENV_KEY`. Follow R999. Run `starci app missing-verb`.' });
    assert.equal(a15Findings(context).filter((finding) => finding.code.startsWith('HFS_DOC_')).length, 4);
    const declaration = { hfs: 3, kind: 'app', project: 'demo', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
    const result = checkRepo({ repoRoot: context.repoRoot, declaration, files: context.files, tree: false });
    const hits = result.findings.filter((finding) => finding.code.startsWith('HFS_DOC_'));
    assert.equal(hits.length, 4);
    assert.ok(hits.every((finding) => finding.titleVi && finding.whyVi && finding.nextStepVi));
  });
}

test('R270 leaves runtime documentation and other product files to their existing rules', (t) => {
  const context = fixture(t, 'full', { 'CONTEXT.md': '`docs/missing.md` R999', 'notes.md': '`docs/missing.md` R999', 'docs/reference.yaml': 'path: docs/missing.md' });
  assert.deepEqual(docFreshFindings(context), []);
  assert.deepEqual(docFreshFindings({ ...context, files: ['README.md'], repo: { edition: 'full', profile: 'runtime' } }), []);
});
