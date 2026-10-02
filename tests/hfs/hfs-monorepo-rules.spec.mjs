// The always-monorepo shape of an app (scripts/hfs/rules/monorepo.mjs): R128 HFS_MONO_WORKSPACES, R129 HFS_MONO_FE_WORKSPACE,
// R130 HFS_MONO_NEST_PROJECTS and R131 HFS_MONO_WORKSPACE_DEP. The clean app of tests/helpers/hfs-cli-fixture.mjs is the
// passing base (a monorepo root, fe app workspaces, the Nest projects of the declared be apps); each violating case changes one fact.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { FE_APP_SCRIPTS, WORKSPACE_LINT } from '../../scripts/hfs/rules/monorepo.mjs';
import { APP, appOf, cleanup, gitAdd, installTypeScript, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

const made = [];
test.after(() => cleanup(made));
const repoOf = (declaration, mutate) => {
  const dir = installTypeScript(writeCleanRepo(declaration));
  made.push(dir);
  if (mutate) mutate(dir);
  return gitAdd(dir);
};
const put = (dir, relative, text) => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const readJsonAt = (dir, relative) => JSON.parse(fs.readFileSync(path.join(dir, ...relative.split('/')), 'utf8'));
const editJson = (relative, change) => (dir) => put(dir, relative, `${JSON.stringify(change(readJsonAt(dir, relative)), null, 2)}\n`);
const only = (result, code) => result.findings.filter((f) => f.code === code);
const codes = ['HFS_MONO_WORKSPACES', 'HFS_MONO_FE_WORKSPACE', 'HFS_MONO_NEST_PROJECTS', 'HFS_MONO_WORKSPACE_DEP'];
const UI_PACKAGE = { name: '@demo/ui', private: true, scripts: { build: 'tsc -p tsconfig.build.json', typecheck: 'tsc --noEmit', lint: WORKSPACE_LINT } };
const WITH_UI = appOf({ fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.package.ui'] } });
/** The fe package demo-ui with its required files; `pkg` is its manifest. */
const uiPackage = (pkg = UI_PACKAGE) => (dir) => {
  put(dir, 'fe/packages/demo-ui/package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  put(dir, 'fe/packages/demo-ui/tsconfig.json', '{}\n');
  put(dir, 'fe/packages/demo-ui/src/index.ts', 'export {};\n');
};

test('the clean monorepo is clean to every monorepo rule: root workspaces and turbo, the fe app workspace, the Nest projects', () => {
  const result = checkRepo({ repoRoot: repoOf(APP) });
  for (const code of codes) assert.deepEqual(only(result, code), [], code);
});

// ------------------------------------------------------------------------------------------------ R128 HFS_MONO_WORKSPACES

test('HFS_MONO_WORKSPACES: workspaces of fe/packages only, no packageManager and no turbo devDependency are each refused on package.json', () => {
  const partial = only(checkRepo({ repoRoot: repoOf(APP, editJson('package.json', (pkg) => ({ ...pkg, workspaces: ['fe/packages/*'] }))) }), 'HFS_MONO_WORKSPACES');
  assert.deepEqual(partial.map((f) => f.path), ['package.json']);
  assert.match(partial[0].message, /exactly \["fe\/apps\/\*","fe\/packages\/\*"\]/);
  const bare = only(checkRepo({ repoRoot: repoOf(APP, editJson('package.json', ({ workspaces, packageManager, devDependencies, ...rest }) => rest)) }), 'HFS_MONO_WORKSPACES');
  assert.equal(bare.length, 3);
  assert.ok(bare.some((f) => /packageManager/.test(f.message)) && bare.some((f) => /turbo/.test(f.message)));
  const ranged = only(checkRepo({ repoRoot: repoOf(APP, editJson('package.json', (pkg) => ({ ...pkg, packageManager: 'npm@^11' }))) }), 'HFS_MONO_WORKSPACES');
  assert.equal(ranged.length, 1);
});

test('HFS_MONO_WORKSPACES: the turbo task graph is required at the app root and a front end keeps none of its own', () => {
  const dir = repoOf(APP, (d) => { fs.rmSync(path.join(d, 'turbo.json')); put(d, 'fe/turbo.json', '{}\n'); });
  const result = checkRepo({ repoRoot: dir });
  assert.ok(result.findings.some((f) => f.code === 'HFS_SLOT_REQUIRED_MISSING' && f.path === 'turbo.json'));
  assert.ok(result.findings.some((f) => f.path === 'fe/turbo.json' && ['HFS_FORBIDDEN_PRESENT', 'HFS_TOOL_CONFIG_LOCAL'].includes(f.code)));
});

// ------------------------------------------------------------------------------------------------ R129 HFS_MONO_FE_WORKSPACE

test('HFS_MONO_FE_WORKSPACE: an fe app workspace with another name, not private, or other scripts is refused on its package.json', () => {
  const file = 'fe/apps/web/package.json';
  const renamed = only(checkRepo({ repoRoot: repoOf(APP, editJson(file, (pkg) => ({ ...pkg, name: 'web' }))) }), 'HFS_MONO_FE_WORKSPACE');
  assert.deepEqual(renamed.map((f) => [f.path, f.expected]), [[file, '@demo/web']]);
  const shared = only(checkRepo({ repoRoot: repoOf(APP, editJson(file, ({ private: _p, ...pkg }) => pkg)) }), 'HFS_MONO_FE_WORKSPACE');
  assert.match(shared[0].message, /private/);
  const scripts = only(checkRepo({ repoRoot: repoOf(APP, editJson(file, (pkg) => ({ ...pkg, scripts: { ...FE_APP_SCRIPTS, lint: 'eslint .', test: 'jest' } }))) }), 'HFS_MONO_FE_WORKSPACE');
  assert.deepEqual(scripts.map((f) => f.scripts), [['lint', 'test']]);
});

test('HFS_MONO_FE_WORKSPACE: an fe package with its build, typecheck and the workspace lint is clean; without them, or with another lint, it is refused', () => {
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(WITH_UI, uiPackage()) }), 'HFS_MONO_FE_WORKSPACE'), []);
  const missing = only(checkRepo({ repoRoot: repoOf(WITH_UI, uiPackage({ ...UI_PACKAGE, scripts: { build: 'tsc' } })) }), 'HFS_MONO_FE_WORKSPACE');
  assert.deepEqual(missing.map((f) => f.scripts), [['typecheck', 'lint']]);
  const ownLint = only(checkRepo({ repoRoot: repoOf(WITH_UI, uiPackage({ ...UI_PACKAGE, scripts: { ...UI_PACKAGE.scripts, lint: 'eslint src' } })) }), 'HFS_MONO_FE_WORKSPACE');
  assert.deepEqual(ownLint.map((f) => f.path), ['fe/packages/demo-ui/package.json']);
});

// ------------------------------------------------------------------------------------------------ R130 HFS_MONO_NEST_PROJECTS

test('HFS_MONO_NEST_PROJECTS: a non-monorepo nest-cli, a project hfs.json does not declare, a missing one and a misplaced root are refused', () => {
  const two = appOf({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'worker', kind: 'worker' }] } });
  const flat = only(checkRepo({ repoRoot: repoOf(two, editJson('be/nest-cli.json', (cli) => ({ ...cli, monorepo: false }))) }), 'HFS_MONO_NEST_PROJECTS');
  assert.ok(flat.some((f) => /monorepo/.test(f.message)));
  const extra = only(checkRepo({ repoRoot: repoOf(two, editJson('be/nest-cli.json', (cli) => ({ ...cli, projects: { ...cli.projects, billing: { type: 'application', root: 'apps/billing', sourceRoot: 'apps/billing/src' } } }))) }), 'HFS_MONO_NEST_PROJECTS');
  assert.deepEqual(extra.map((f) => f.declared), [['core', 'worker']]);
  const missing = only(checkRepo({ repoRoot: repoOf(two, editJson('be/nest-cli.json', (cli) => ({ ...cli, projects: { core: cli.projects.core } }))) }), 'HFS_MONO_NEST_PROJECTS');
  assert.deepEqual(missing.map((f) => f.projects), [['core']]);
  const misplaced = only(checkRepo({ repoRoot: repoOf(two, editJson('be/nest-cli.json', (cli) => ({ ...cli, root: 'apps/worker', sourceRoot: 'apps/worker/src', projects: { ...cli.projects, core: { ...cli.projects.core, root: 'src' } } }))) }), 'HFS_MONO_NEST_PROJECTS');
  assert.equal(misplaced.length, 2);
});

test('HFS_MONO_NEST_PROJECTS: one project per declared app, the default an api app, is clean, also for a single service', () => {
  const two = appOf({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'worker', kind: 'worker' }] } });
  for (const declaration of [APP, two]) assert.deepEqual(only(checkRepo({ repoRoot: repoOf(declaration) }), 'HFS_MONO_NEST_PROJECTS'), [], JSON.stringify(declaration.sides.be));
});

// ------------------------------------------------------------------------------------------------ R131 HFS_MONO_WORKSPACE_DEP

test('HFS_MONO_WORKSPACE_DEP: a package an fe app imports but does not declare is refused, a sibling workspace package named for "*"', () => {
  const dir = repoOf(WITH_UI, (d) => {
    uiPackage()(d);
    put(d, 'fe/apps/web/src/app/[locale]/page.tsx', 'import { useTranslations } from "next-intl";\nimport Link from "next/link";\nimport { Card } from "@demo/ui";\nexport default function Page() { return [useTranslations, Link, Card]; }\n');
  });
  const found = only(checkRepo({ repoRoot: dir }), 'HFS_MONO_WORKSPACE_DEP');
  assert.deepEqual(found.map((f) => f.dependency).sort(), ['@demo/ui', 'next']);
  assert.match(found.find((f) => f.dependency === '@demo/ui').message, /as "\*"/);
});

test('HFS_MONO_WORKSPACE_DEP: declared packages, relative and node: imports and the workspace tsconfig aliases are clean; the root declaring a workspace package is refused', () => {
  const clean = repoOf(WITH_UI, (d) => {
    uiPackage()(d);
    editJson('fe/apps/web/package.json', (pkg) => ({ ...pkg, dependencies: { ...pkg.dependencies, next: '16.1.6', '@demo/ui': '*' } }))(d);
    put(d, 'fe/apps/web/tsconfig.json', `${JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } })}\n`);
    put(d, 'fe/apps/web/src/app/[locale]/page.tsx', 'import path from "node:path";\nimport Link from "next/link";\nimport { Card } from "@demo/ui";\nimport { brand } from "@/modules/brand";\nimport { local } from "./local";\nexport default function Page() { return [path, Link, Card, brand, local]; }\n');
  });
  assert.deepEqual(only(checkRepo({ repoRoot: clean }), 'HFS_MONO_WORKSPACE_DEP'), []);
  const rooted = repoOf(WITH_UI, (d) => { uiPackage()(d); editJson('package.json', (pkg) => ({ ...pkg, dependencies: { '@demo/ui': '*' } }))(d); });
  assert.deepEqual(only(checkRepo({ repoRoot: rooted }), 'HFS_MONO_WORKSPACE_DEP').map((f) => [f.path, f.dependency]), [['package.json', '@demo/ui']]);
});
