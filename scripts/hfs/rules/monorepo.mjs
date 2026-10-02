// monorepo.mjs - every product is a monorepo, even a single app: the app root holds one package.json and lockfile whose npm
// workspaces are the fe apps and packages (turbo runs their tasks), and the back end is a Nest monorepo of be/apps/<app>.
//   HFS_MONO_WORKSPACES          the root package.json: `workspaces` exactly fe/apps/* and fe/packages/*, `packageManager` npm at an
//                                exact version, turbo a root devDependency (its version is the canon pin); turbo.json is app.task-graph
//   HFS_MONO_FE_WORKSPACE        every fe app's package.json is @<project>/<app>, private, with exactly the workspace scripts; every
//                                fe package's package.json is private with build and typecheck scripts and the workspace lint
//   HFS_MONO_NEST_PROJECTS       be/nest-cli.json is `monorepo: true`, its root an api app, and one project per declared be app
//   HFS_MONO_WORKSPACE_DEP       a package an fe workspace imports is declared in that workspace's package.json (a sibling workspace
//                                package at "*"); the root package.json never declares a workspace package
// The imports are read with TypeScript's own pre-processor (import, export-from, require and import() specifiers), and a
// workspace's path aliases come from its tsconfig.json as TypeScript resolves it: no specifier is matched by a regular expression.
import fs from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackage, requirePackage } from '../../lib/package-at.mjs';
import { found, readJson, readText } from './read.mjs';

export const MONO_WORKSPACES = 'HFS_MONO_WORKSPACES';
export const MONO_FE_WORKSPACE = 'HFS_MONO_FE_WORKSPACE';
export const MONO_NEST_PROJECTS = 'HFS_MONO_NEST_PROJECTS';
export const MONO_WORKSPACE_DEP = 'HFS_MONO_WORKSPACE_DEP';

/** The npm workspaces of every app, in this order. */
export const WORKSPACES = Object.freeze(['fe/apps/*', 'fe/packages/*']);
/** The lint script of every fe workspace: the one lint of the app, scoped to the workspace. */
export const WORKSPACE_LINT = 'starci app lint --workspace .';
/** The scripts of every fe app workspace, exactly: turbo runs build, dev, lint and typecheck; start serves a build. */
export const FE_APP_SCRIPTS = Object.freeze({ build: 'next build', dev: 'next dev', lint: WORKSPACE_LINT, start: 'next start', typecheck: 'tsc --noEmit' });
/** The scripts every fe package workspace has (its build and typecheck commands are its own; its lint is the workspace lint). */
export const FE_PACKAGE_SCRIPTS = Object.freeze(['build', 'typecheck', 'lint']);
/** The package manager every app root declares (turbo reads it to parse the lockfile); the starci app scaffold writes it. */
export const PACKAGE_MANAGER = 'npm@11.6.2';
/** The npm name of an fe app workspace. */
export const feAppPackageName = (project, app) => `@${project}/${app}`;

const MANIFEST = 'package.json';
const NEST_CLI = 'be/nest-cli.json';
const PACKAGE_MANAGER_FORM = /^npm@\d+\.\d+\.\d+$/;
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const HERE = path.dirname(fileURLToPath(import.meta.url));

const declaredIn = (pkg) => new Set(DEP_SECTIONS.flatMap((section) => Object.keys(pkg?.[section] ?? {})));
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((item, i) => item === b[i]);

/** The workspace folders the tracked tree holds: fe/apps/<x> and fe/packages/<x> that track a package.json. */
function workspacesOf(files) {
  const folders = new Set();
  for (const file of files) {
    const parts = file.split('/');
    if (parts.length === 4 && parts[0] === 'fe' && (parts[1] === 'apps' || parts[1] === 'packages') && parts[3] === MANIFEST) folders.add(parts.slice(0, 3).join('/'));
  }
  return [...folders].sort();
}

/** R143: the root package.json declares the workspaces, the package manager and turbo. */
function rootFindings(repoRoot) {
  const pkg = readJson(repoRoot, MANIFEST);
  if (!pkg) return [];
  const findings = [];
  if (!sameList(pkg.workspaces, WORKSPACES)) findings.push(found(MONO_WORKSPACES, MANIFEST, `${MANIFEST} declares workspaces ${JSON.stringify(pkg.workspaces ?? null)}; every app is a monorepo whose npm workspaces are exactly ${JSON.stringify(WORKSPACES)} (each fe app and package has its own package.json; be has none).`, { workspaces: pkg.workspaces ?? null }));
  if (!PACKAGE_MANAGER_FORM.test(String(pkg.packageManager ?? ''))) findings.push(found(MONO_WORKSPACES, MANIFEST, `${MANIFEST} declares packageManager ${JSON.stringify(pkg.packageManager ?? null)}; turbo needs \`npm@<exact version>\` there.`, { packageManager: pkg.packageManager ?? null }));
  if (typeof pkg.devDependencies?.turbo !== 'string') findings.push(found(MONO_WORKSPACES, MANIFEST, `${MANIFEST} does not declare turbo in its devDependencies; the turbo task graph (turbo.json) runs build, dev, lint and typecheck over the fe workspaces.`, { missing: 'turbo' }));
  return findings;
}

/** R144: the manifest of each fe workspace. */
function workspaceManifestFindings(repoRoot, project, workspaces) {
  const findings = [];
  for (const folder of workspaces) {
    const file = `${folder}/${MANIFEST}`;
    const pkg = readJson(repoRoot, file);
    if (!pkg) { findings.push(found(MONO_FE_WORKSPACE, file, `${file} is not readable JSON; an fe workspace has a package.json.`)); continue; }
    const name = folder.split('/')[2];
    if (pkg.private !== true) findings.push(found(MONO_FE_WORKSPACE, file, `${file} is not \`"private": true\`; a workspace of the app is never published.`));
    const scripts = pkg.scripts ?? {};
    if (folder.startsWith('fe/apps/')) {
      const expected = feAppPackageName(project, name);
      if (pkg.name !== expected) findings.push(found(MONO_FE_WORKSPACE, file, `${file} is named ${JSON.stringify(pkg.name ?? null)}; the fe app ${name} is the workspace ${expected}.`, { expected }));
      const want = Object.keys(FE_APP_SCRIPTS).sort();
      const off = [...new Set([...want, ...Object.keys(scripts)])].sort().filter((key) => scripts[key] !== FE_APP_SCRIPTS[key]);
      if (off.length) findings.push(found(MONO_FE_WORKSPACE, file, `${file} has scripts ${JSON.stringify(scripts)}; an fe app workspace has exactly ${JSON.stringify(FE_APP_SCRIPTS)} (turbo runs build, dev, lint and typecheck; differs at ${off.join(', ')}).`, { scripts: off }));
    } else {
      const missing = FE_PACKAGE_SCRIPTS.filter((key) => typeof scripts[key] !== 'string' || !scripts[key]);
      if (missing.length) findings.push(found(MONO_FE_WORKSPACE, file, `${file} has no ${missing.join(', ')} script; an fe package workspace builds, type-checks and lints (turbo builds it before the apps that import it).`, { scripts: missing }));
      else if (scripts.lint !== WORKSPACE_LINT) findings.push(found(MONO_FE_WORKSPACE, file, `${file} lints with ${JSON.stringify(scripts.lint)}; a workspace lints with ${JSON.stringify(WORKSPACE_LINT)}, the one lint of the app scoped to it.`, { scripts: ['lint'] }));
    }
  }
  return findings;
}

/** R145: be/nest-cli.json is the Nest monorepo of exactly the declared be apps. */
function nestFindings(repoRoot, files, beApps) {
  if (!files.includes(NEST_CLI)) return [];
  const cli = readJson(repoRoot, NEST_CLI);
  if (!cli) return [found(MONO_NEST_PROJECTS, NEST_CLI, `${NEST_CLI} is not readable JSON.`)];
  const findings = [];
  if (cli.monorepo !== true) findings.push(found(MONO_NEST_PROJECTS, NEST_CLI, `${NEST_CLI} is not \`"monorepo": true\`; the back end is a Nest monorepo of be/apps/<app>, even with one service.`));
  const declared = beApps.map((app) => app.name).sort();
  const projects = Object.keys(cli.projects ?? {}).sort();
  if (!sameList(projects, declared)) findings.push(found(MONO_NEST_PROJECTS, NEST_CLI, `${NEST_CLI} has projects ${JSON.stringify(projects)}, but hfs.json declares the be apps ${JSON.stringify(declared)}; one project per declared app, no other.`, { projects, declared }));
  for (const name of projects.filter((project) => declared.includes(project))) {
    const project = cli.projects[name] ?? {};
    if (project.type !== 'application' || project.root !== `apps/${name}` || project.sourceRoot !== `apps/${name}/src`) findings.push(found(MONO_NEST_PROJECTS, NEST_CLI, `${NEST_CLI} project ${name} is ${JSON.stringify({ type: project.type, root: project.root, sourceRoot: project.sourceRoot })}; it is {"type":"application","root":"apps/${name}","sourceRoot":"apps/${name}/src"}.`, { project: name }));
  }
  const apis = beApps.filter((app) => app.kind === 'api').map((app) => app.name);
  const rootApp = /^apps\/([^/]+)$/.exec(String(cli.root ?? ''))?.[1];
  if (!apis.includes(rootApp) || cli.sourceRoot !== `apps/${rootApp}/src`) findings.push(found(MONO_NEST_PROJECTS, NEST_CLI, `${NEST_CLI} has root ${JSON.stringify(cli.root ?? null)} and sourceRoot ${JSON.stringify(cli.sourceRoot ?? null)}; the default project is an api app (${apis.join(', ') || 'none declared'}): root apps/<api>, sourceRoot apps/<api>/src.`, { root: cli.root ?? null }));
  return findings;
}

/** The TypeScript compiler of the app (else of the runtime), or null. */
function typescriptFor(repoRoot) {
  const located = findPackage([repoRoot, HERE], ['typescript']);
  return located ? requirePackage(located) : null;
}

/** The path-alias patterns of a workspace (its tsconfig.json as TypeScript resolves it, `extends` included): [{ prefix, exact }]. */
function aliasesOf(ts, dir) {
  const file = path.join(dir, 'tsconfig.json');
  if (!fs.existsSync(file)) return [];
  const read = ts.readConfigFile(file, ts.sys.readFile);
  if (read.error) return [];
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dir);
  return Object.keys(parsed.options.paths ?? {}).map((key) => (key.endsWith('*') ? { prefix: key.slice(0, -1), exact: false } : { prefix: key, exact: true }));
}

/** The npm package a bare module specifier names (`next/link` is next, `@scope/name/sub` is @scope/name). */
const packageOf = (specifier) => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

/** R146: what each fe workspace imports, it declares; the root declares no workspace package. */
function workspaceDepFindings(repoRoot, files, workspaces) {
  const findings = [];
  const names = new Map(workspaces.map((folder) => [readJson(repoRoot, `${folder}/${MANIFEST}`)?.name, folder]).filter(([name]) => typeof name === 'string'));
  const root = readJson(repoRoot, MANIFEST);
  for (const name of declaredIn(root)) if (names.has(name)) findings.push(found(MONO_WORKSPACE_DEP, MANIFEST, `${MANIFEST} declares the workspace package ${name} (${names.get(name)}); the root never depends on a workspace: the fe workspace that imports it declares it.`, { dependency: name }));
  if (!workspaces.length) return findings;
  const ts = typescriptFor(repoRoot);
  if (!ts) return [...findings, found(MONO_WORKSPACE_DEP, MANIFEST, 'the fe workspaces cannot be judged: no TypeScript resolves from the app; install the app\'s dependencies.', { missing: ['typescript'] })];
  for (const folder of workspaces) {
    const manifest = `${folder}/${MANIFEST}`;
    const pkg = readJson(repoRoot, manifest);
    if (!pkg) continue;
    const declared = declaredIn(pkg);
    const aliases = aliasesOf(ts, path.join(repoRoot, folder));
    const isAlias = (specifier) => aliases.some((alias) => (alias.exact ? specifier === alias.prefix : specifier.startsWith(alias.prefix)));
    const missing = new Map();
    for (const file of files) {
      if (!file.startsWith(`${folder}/`) || !SOURCE.test(file) || file.endsWith('.d.ts')) continue;
      const text = readText(repoRoot, file);
      if (text === null) continue;
      for (const { fileName: specifier } of ts.preProcessFile(text, true, true).importedFiles) {
        if (specifier.startsWith('.') || specifier.startsWith('/') || isBuiltin(specifier) || isAlias(specifier)) continue;
        const name = packageOf(specifier);
        if (declared.has(name) || name === pkg.name) continue;
        if (!missing.has(name)) missing.set(name, file);
      }
    }
    for (const [name, file] of [...missing].sort()) {
      const sibling = names.get(name);
      findings.push(found(MONO_WORKSPACE_DEP, manifest, `${file} imports ${name}, which ${manifest} does not declare; ${sibling ? `declare the workspace package ${name} as "*"` : `declare ${name} in the dependencies of ${manifest} (one version across the workspace, R14)`}.`, { dependency: name, importedBy: file }));
    }
  }
  return findings;
}

/** The findings of the monorepo rules over the tracked paths `files` (app-relative) of the app at `repoRoot`. */
export function monorepoFindings({ repoRoot, files, repo }) {
  if (!repo?.sides) return [];
  const workspaces = workspacesOf(files);
  const beApps = repo.sides.be.apps;
  return [
    ...rootFindings(repoRoot),
    ...workspaceManifestFindings(repoRoot, repo.project, workspaces),
    ...nestFindings(repoRoot, files, beApps),
    ...workspaceDepFindings(repoRoot, files, workspaces),
  ];
}
