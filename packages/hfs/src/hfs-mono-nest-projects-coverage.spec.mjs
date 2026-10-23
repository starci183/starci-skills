// proves: HFS_MONO_NEST_PROJECTS@lite
// proves: HFS_MONO_NEST_PROJECTS@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { monorepoFindings } from '../runtime/scripts/hfs/rules/monorepo.mjs';

const NEST_CLI = 'be/nest-cli.json';
const SINGLE_APP = [{ name: 'api', kind: 'api' }];
const MULTIPLE_APPS = [{ name: 'core', kind: 'api' }, { name: 'worker', kind: 'worker' }];

function nestConfiguration(apps) {
  const api = apps.find(({ kind }) => kind === 'api');
  return {
    monorepo: true, root: `apps/${api.name}`, sourceRoot: `apps/${api.name}/src`,
    projects: Object.fromEntries(apps.map(({ name }) => [name, {
      type: 'application', root: `apps/${name}`, sourceRoot: `apps/${name}/src`,
    }])),
  };
}

function fixture(t, edition, apps = MULTIPLE_APPS, mutate) {
  const repo = {
    hfs: 3, kind: 'app', edition, project: 'demo',
    sides: { be: { apps }, fe: { apps: [] } },
  };
  const configuration = nestConfiguration(apps);
  if (mutate) mutate(configuration);
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-nest-projects-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repoRoot, 'be'));
  fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify(repo));
  fs.writeFileSync(path.join(repoRoot, NEST_CLI), JSON.stringify(configuration));
  return { repoRoot, files: ['hfs.json', NEST_CLI], repo };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} accepts valid single-service and multiple-service Nest monorepos`, (t) => {
    assert.deepEqual(monorepoFindings(fixture(t, edition, SINGLE_APP)), []);
    assert.deepEqual(monorepoFindings(fixture(t, edition)), []);
  });

  test(`${edition} rejects invalid Nest CLI JSON`, (t) => {
    const input = fixture(t, edition);
    fs.writeFileSync(path.join(input.repoRoot, NEST_CLI), '{');
    assert.deepEqual(monorepoFindings(input).map(({ code }) => code), ['HFS_MONO_NEST_PROJECTS']);
  });

  test(`${edition} rejects a missing or false Nest monorepo flag`, (t) => {
    for (const monorepo of [undefined, false]) {
      const input = fixture(t, edition, SINGLE_APP, (cli) => { cli.monorepo = monorepo; });
      assert.deepEqual(monorepoFindings(input).map(({ code }) => code), ['HFS_MONO_NEST_PROJECTS']);
    }
  });

  test(`${edition} rejects projects missing from or added beyond the declared back-end apps`, (t) => {
    const missing = fixture(t, edition, MULTIPLE_APPS, (cli) => { delete cli.projects.worker; });
    assert.deepEqual(monorepoFindings(missing).map(({ code }) => code), ['HFS_MONO_NEST_PROJECTS']);
    const extra = fixture(t, edition, MULTIPLE_APPS, (cli) => {
      cli.projects.billing = { type: 'application', root: 'apps/billing', sourceRoot: 'apps/billing/src' };
    });
    assert.deepEqual(monorepoFindings(extra).map(({ code }) => code), ['HFS_MONO_NEST_PROJECTS']);
  });

  test(`${edition} rejects invalid Nest project type, root and sourceRoot independently`, (t) => {
    for (const [field, value] of [['type', 'library'], ['root', 'src'], ['sourceRoot', 'src/core']]) {
      const input = fixture(t, edition, MULTIPLE_APPS, (cli) => { cli.projects.core[field] = value; });
      assert.deepEqual(monorepoFindings(input).map(({ code }) => code), ['HFS_MONO_NEST_PROJECTS']);
    }
  });

  test(`${edition} rejects a default Nest project that is a worker or undeclared app`, (t) => {
    for (const name of ['worker', 'billing']) {
      const input = fixture(t, edition, MULTIPLE_APPS, (cli) => {
        cli.root = `apps/${name}`;
        cli.sourceRoot = `apps/${name}/src`;
      });
      assert.deepEqual(monorepoFindings(input).map(({ code }) => code), ['HFS_MONO_NEST_PROJECTS']);
    }
  });

  test(`${edition} rejects a default Nest sourceRoot outside its declared API app`, (t) => {
    const input = fixture(t, edition, MULTIPLE_APPS, (cli) => { cli.sourceRoot = 'apps/worker/src'; });
    const findings = monorepoFindings(input);
    assert.deepEqual(findings.map(({ code }) => code), ['HFS_MONO_NEST_PROJECTS']);
    assert.deepEqual(findings.map(({ path: file }) => file), [NEST_CLI]);
  });
}
