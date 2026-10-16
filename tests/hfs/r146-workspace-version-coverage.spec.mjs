// proves: HFS_MONO_WORKSPACE_DEP@lite
// proves: HFS_MONO_WORKSPACE_DEP@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { monorepoFindings, FE_APP_SCRIPTS, WORKSPACE_LINT } from '../../scripts/hfs/rules/monorepo.mjs';

function workspaceFindings(edition, section, version) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-r146-'));
  const repo = { hfs: 3, kind: 'app', edition, project: 'demo', sides: { be: { apps: [] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const dependencies = version === null ? {} : { '@demo/ui': version };
  const files = {
    'package.json': { workspaces: ['fe/apps/*', 'fe/packages/*'], packageManager: 'npm@11.6.2', devDependencies: { turbo: '2.8.20' } },
    'fe/apps/web/package.json': { name: '@demo/web', private: true, scripts: FE_APP_SCRIPTS, [section]: dependencies },
    'fe/packages/ui/package.json': { name: '@demo/ui', private: true, scripts: { build: 'tsc', typecheck: 'tsc --noEmit', lint: WORKSPACE_LINT } },
    'fe/apps/web/src/index.ts': "export { Card } from '@demo/ui/card';\n",
  };
  try {
    for (const [file, value] of Object.entries(files)) {
      const target = path.join(repoRoot, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
    }
    return monorepoFindings({ repoRoot, files: Object.keys(files), repo }).filter(item => item.code === 'HFS_MONO_WORKSPACE_DEP');
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

for (const edition of ['lite', 'full']) {
  test(`${edition} passing sibling workspace dependencies use exactly star in every dependency section`, () => {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.deepEqual(workspaceFindings(edition, section, '*'), []);
    }
  });

  test(`${edition} violating sibling workspace versions and missing declarations are refused`, () => {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const version of ['1.2.3', '^1.2.3', 'workspace:*', 'file:../../packages/ui', null]) {
        const findings = workspaceFindings(edition, section, version);
        assert.equal(findings.length, 1, `${section}: ${version}`);
        assert.equal(findings[0].code, 'HFS_MONO_WORKSPACE_DEP');
        assert.equal(findings[0].path, 'fe/apps/web/package.json');
        assert.equal(findings[0].dependency, '@demo/ui');
      }
    }
  });
}
