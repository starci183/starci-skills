// proves: BE_APP_ENV_REQUIRED@lite BE_APP_ENV_REQUIRED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appEnvRequiredFindings } from '../runtime/scripts/hfs/rules/app-env-required.mjs';
import { checkRepo } from '../runtime/scripts/hfs/check.mjs';

const ENV = 'apps/api/src/api.env.ts';
const WORKER_ENV = 'apps/worker/src/worker.env.ts';
const MAIN = 'apps/api/src/main.ts';
const BE = { profile: 'be', apps: [{ name: 'api', kind: 'api' }, { name: 'worker', kind: 'worker' }] };
const SOURCE = `import { EnvSource } from '@modules/platform/config';
export interface ApiEnv { readonly port: number }
export const readApiEnv = (env: EnvSource): ApiEnv => ({ port: env.int('PORT') });
`;

/** Each fixture uses a real tree, including the untracked-file and unreadable-path cases. */
function tree(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-app-env-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

for (const edition of ['lite', 'full']) {
  test(`BE_APP_ENV_REQUIRED reports every missing declared app boundary in ${edition}`, (t) => {
    const repoRoot = tree(t, { [MAIN]: 'export const main = true;' });
    const findings = appEnvRequiredFindings({ repoRoot, files: [MAIN], repo: { ...BE, edition } });
    assert.deepEqual(findings.map(({ code, level, path: file }) => ({ code, level, file })), [
      { code: 'BE_APP_ENV_REQUIRED', level: 'error', file: ENV },
      { code: 'BE_APP_ENV_REQUIRED', level: 'error', file: WORKER_ENV },
    ]);
  });

  test(`BE_APP_ENV_REQUIRED accepts tracked typed app boundaries in ${edition}`, (t) => {
    const repoRoot = tree(t, { [ENV]: SOURCE, [WORKER_ENV]: SOURCE.replaceAll('Api', 'Worker') });
    assert.deepEqual(appEnvRequiredFindings({ repoRoot, files: [ENV, WORKER_ENV], repo: { ...BE, edition } }), []);
  });
}

test('BE_APP_ENV_REQUIRED uses the whole tracked tree when checking a scoped change', (t) => {
  const repoRoot = tree(t, { [ENV]: SOURCE, [WORKER_ENV]: SOURCE });
  assert.deepEqual(appEnvRequiredFindings({ repoRoot, files: [MAIN], all: [MAIN, ENV, WORKER_ENV], repo: BE }), []);
  assert.deepEqual(appEnvRequiredFindings({ repoRoot, files: [], repo: BE, inScope: () => false }), []);
});

test('BE_APP_ENV_REQUIRED refuses an untracked or missing-on-disk boundary', (t) => {
  const repoRoot = tree(t, { [ENV]: SOURCE });
  assert.equal(appEnvRequiredFindings({ repoRoot, files: [], repo: BE }).length, 2);
  assert.deepEqual(appEnvRequiredFindings({ repoRoot, files: [ENV, WORKER_ENV], repo: BE }).map((finding) => finding.path), [WORKER_ENV]);
});

test('BE_APP_ENV_REQUIRED ignores the front end and app-root scope', (t) => {
  const repoRoot = tree(t, {});
  for (const profile of ['app', 'fe']) {
    assert.deepEqual(appEnvRequiredFindings({ repoRoot, files: [], repo: { ...BE, profile, edition: 'lite' } }), []);
  }
});

test('BE_APP_ENV_REQUIRED is wired through the app check with side-relative paths', (t) => {
  const repoRoot = tree(t, {});
  const declaration = { hfs: 3, kind: 'app', project: 'demo', edition: 'lite', sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const result = checkRepo({ repoRoot, declaration, files: ['be/apps/api/src/main.ts'], tree: false });
  assert.deepEqual(result.findings.filter((finding) => finding.code === 'BE_APP_ENV_REQUIRED').map((finding) => finding.path), ['be/apps/api/src/api.env.ts']);
});
