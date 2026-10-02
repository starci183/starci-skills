// hfs scaffold app <name> - the first tree of a new app, the one shape every StarCi product has:
//
//   <name>/            hfs.json (kind app), package.json (the monorepo root: workspaces fe/apps/* and fe/packages/*, npm, turbo,
//                      the back end's dependencies and every tool at its canon pin, the managed scripts), turbo.json,
//                      package-lock.json, README.md, the managed root files (CI, husky, .gitignore block, Sonar, prettier),
//                      .starciwork, .starcistacks/application-stacks.yaml and .sops.yaml (the stack tree lives at the app root, never
//                      under be/); scripts/codegen.mjs, the app's own step of `npm run codegen`
//   <name>/be/         the back-end side: the managed tool configuration and the templates/be/skeleton tree (the core api app,
//                      the cli app with its image, platform config/logging/errors/clock/cqrs/database over the primary
//                      connection, the liveness and note capabilities, the health feature and the cli feature root with its
//                      migrate and seed groups); the dev seed files sit in the app root's .starcistacks/dev/seeds
//   <name>/fe/         the front-end side: the managed tool configuration and the templates/fe/skeleton tree: two Next apps,
//                      apps/landing (the public front door) and apps/app (the product), over the shared workspace packages
//                      packages/<name>-ui (@<name>/ui, the drawings both apps mount, the brand shell among them) and
//                      packages/<name>-i18n (@<name>/i18n, the next-intl stack written once: vi default, as-needed prefix, the
//                      proxy, the request config, exported as createAppI18n, which each app's modules/i18n calls)
//
// The skeleton files are written once from templates/<app|be|fe>/skeleton ({{project}}, {{app}} and {{appPascal}} filled). Path
// variables: a `__app__` folder is written once per app of the side, named after it; an fe `apps/<name>/` folder is the skeleton of
// the declared fe app <name> alone (landing and app differ); `__project__` in a path is the project name (packages/__project__-ui is
// packages/<name>-ui). The workspace manifests and every tsconfig.json are written from code, never kept as template files (a
// tsconfig.json under templates/ would be a TypeScript project of this repository); the managed files are the render of `hfs sync` (sync/index.mjs), so a fresh app
// is in sync by construction. The lockfile is never written by hand: once the files are written, npm resolves the real one
// (`npm install --package-lock-only`, no node_modules, no scripts), so `npm ci` installs the new app as it is. When npm cannot
// resolve it the scaffold fails (HFS_SCAFFOLD_LOCK_FAILED), names the step and removes the app it began, so no app without a lock
// and no stub lock is ever left. An existing directory is refused, never merged into.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadSlotManifest, resolveRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { TEMPLATES_DIR, renderTargets, writeTargets } from '../sync/index.mjs';
import { ScaffoldError } from './service.mjs';
import { FE_APP_SCRIPTS, PACKAGE_MANAGER, WORKSPACES, WORKSPACE_LINT, feAppPackageName } from '../runtime/scripts/hfs/rules/monorepo.mjs';

const NAME = /^[a-z][a-z0-9-]*$/;
const APP_DIR = '__app__';
/** The path variable of the project name: `packages/__project__-ui` is written as `packages/<project>-ui`. */
const PROJECT_DIR = '__project__';
const PINS_FILE = path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'hfs', 'canon-pins.yaml');
const SONAR_GATE_FILE = path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'sonar-gate.yaml');
const pascal = name => name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');

/**
 * A JSON file as prettier prints it (the app's format check judges every file the scaffold writes): an object one key per line, an
 * array of plain values on one line, any other array one item per line.
 */
function jsonText(value) {
  const print = (item, indent) => {
    const inner = `${indent}  `;
    if (Array.isArray(item)) {
      if (item.every(entry => entry === null || typeof entry !== 'object')) return `[${item.map(entry => JSON.stringify(entry)).join(', ')}]`;
      return `[\n${item.map(entry => `${inner}${print(entry, inner)}`).join(',\n')}\n${indent}]`;
    }
    if (item !== null && typeof item === 'object') {
      const keys = Object.keys(item);
      if (!keys.length) return '{}';
      return `{\n${keys.map(key => `${inner}${JSON.stringify(key)}: ${print(item[key], inner)}`).join(',\n')}\n${indent}}`;
    }
    return JSON.stringify(item);
  };
  return `${print(value, '')}\n`;
}

/**
 * The apps a new app starts with: on the be side the `core` api app and the `cli` app over one `primary` connection, two Next apps
 * (landing, app) on the fe side, which read the be contracts for their codegen.
 */
export const STARTER_SIDES = Object.freeze({
  be: Object.freeze({ apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB' }] }),
  // fe: the landing and the product app, over the shared ui and i18n packages (both opt-in slots, enabled here).
  fe: Object.freeze({ apps: [{ name: 'landing', kind: 'next' }, { name: 'app', kind: 'next' }], reads: ['be/contracts/'], optionalSlots: ['fe.package.ui', 'fe.package.i18n'] }),
});

/**
 * The dependencies of the starter: what the skeleton imports and the tools the managed scripts and configs run. A name with a
 * canon pin (knowledge/hfs/canon-pins.yaml) takes the pin; the others take the range the reference app (examples/ecommerce-app)
 * declare. The root package.json holds the back end's runtime and every tool; each fe app workspace declares the packages its
 * own source imports (HFS_MONO_WORKSPACE_DEP), FE_APP_DEPENDENCIES.
 */
const STARTER_DEPENDENCIES = Object.freeze({
  dependencies: {
    '@nestjs/common': null, '@nestjs/core': null, '@nestjs/cqrs': '^11.0.3',
    '@nestjs/platform-express': null, '@nestjs/typeorm': '^11.0.3', 'nest-commander': null, pg: '^8.12.0',
    'reflect-metadata': '^0.2.2', rxjs: '^7.8.1', tslib: '^2.8.1', typeorm: '^0.3.20',
  },
  devDependencies: {
    turbo: null, '@nestjs/testing': null, '@starci/eslint-canon-be': null, '@starci/eslint-canon-fe': null, '@starci/hfs': null, '@starci/jest-preset': null,
    '@starci/prettier-config': null, '@starci/stylelint-canon': null, '@starci/test-world': null, '@starci/tsconfig': null, '@tailwindcss/postcss': '^4', '@types/express': '^4.17.21',
    '@types/jest': null, '@types/node': null, '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', eslint: null, 'eslint-plugin-react-hooks': null,
    husky: '^9.1.7', jest: null, 'postcss-value-parser': null, prettier: null, stylelint: null, tailwindcss: '^4', 'ts-jest': null,
    'ts-node-dev': '^2.0.0', 'tsc-alias': '^1.8.10', 'tsconfig-paths': '^4.2.0', typescript: null,
  },
});

/**
 * The runtime dependencies of every fe app workspace of the starter: what its skeleton imports (the two workspace packages at "*",
 * next with next-intl, react, the grammar and the HeroUI styles of its globals.css), @heroui/react (the grammar's peer, which every app
 * declares: the grammar contract) and react-dom (next's peer). `@<project>/<pkg>` names are filled with the project.
 */
const FE_APP_DEPENDENCIES = Object.freeze({
  '@<project>/i18n': '*', '@<project>/ui': '*',
  '@heroui/react': null, '@heroui/styles': null, '@starci/grammar': null, next: null, 'next-intl': null, react: null, 'react-dom': null,
});

/**
 * The shared fe workspace packages of the starter, fe/packages/<project>-<name> named @<project>/<name>: each one's exported
 * subpaths (built to dist) and the runtime dependencies its own source imports. ui holds the drawings both apps mount; i18n the
 * next-intl stack (the entry, a server module: createAppI18n; ./proxy, the locale negotiation the apps' proxy.ts re-exports;
 * ./routing, client-safe: the default locale a client boundary reads).
 */
const FE_PACKAGES = Object.freeze({
  ui: { exports: ['.'], dependencies: { '@heroui/react': null, '@starci/grammar': null, 'next-intl': null, react: null } },
  i18n: { exports: ['.', './proxy', './routing'], dependencies: { next: null, 'next-intl': null, 'server-only': '^0.0.1' } },
});

/** The scripts of every fe package workspace: tsc builds it to dist and type-checks it; it lints with the workspace lint. */
const PACKAGE_WORKSPACE_SCRIPTS = Object.freeze({ build: 'tsc -p tsconfig.build.json', lint: WORKSPACE_LINT, typecheck: 'tsc --noEmit -p tsconfig.json' });

/** The app hfs.json of a new app called `name`. */
export const starterDeclaration = (name, manifest = loadSlotManifest()) => ({ hfs: manifest.major, kind: 'app', project: name, sides: structuredClone(STARTER_SIDES) });

/** A dependency section at the canon pins (a null range takes the pin, which must exist). */
function pinnedSection(entries, pins) {
  const pinned = (dependency, range) => {
    if (range !== null) return range;
    if (!pins[dependency]) throw new ScaffoldError('HFS_SCAFFOLD_PIN_MISSING', `${dependency} has no canon pin in knowledge/hfs/canon-pins.yaml`);
    return pins[dependency].version;
  };
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)).map(([dependency, range]) => [dependency, pinned(dependency, range)]));
}

/** The root package.json of a new app, the monorepo root: name, the workspaces, npm, the dependencies at their pins; the managed scripts are sync's. */
function packageManifest(name, pins) {
  return { name, version: '0.0.0', private: true, packageManager: PACKAGE_MANAGER, workspaces: [...WORKSPACES], dependencies: pinnedSection(STARTER_DEPENDENCIES.dependencies, pins), devDependencies: pinnedSection(STARTER_DEPENDENCIES.devDependencies, pins) };
}

/** A dependency section of an fe workspace with `@<project>/` names filled and the canon pins taken. */
const workspaceSection = (entries, project, pins) => pinnedSection(Object.fromEntries(Object.entries(entries).map(([name, range]) => [name.replace('@<project>/', `@${project}/`), range])), pins);

/** The package.json of the fe app workspace `app` of the app `project`: @<project>/<app>, private, the workspace scripts, its own dependencies. */
function feAppManifest(project, app, pins) {
  return { name: feAppPackageName(project, app), version: '0.0.0', private: true, scripts: { ...FE_APP_SCRIPTS }, dependencies: workspaceSection(FE_APP_DEPENDENCIES, project, pins) };
}

/** The package.json of the fe package workspace `name` (FE_PACKAGES) of the app `project`: @<project>/<name>, private, built to dist. */
function fePackageManifest(project, name, pins) {
  const { exports, dependencies } = FE_PACKAGES[name];
  const built = subpath => (subpath === '.' ? 'index' : subpath.slice(2));
  return {
    name: `@${project}/${name}`, version: '0.0.0', private: true, type: 'module',
    exports: Object.fromEntries(exports.map(subpath => [subpath, { types: `./dist/${built(subpath)}.d.ts`, default: `./dist/${built(subpath)}.js` }])),
    types: './dist/index.d.ts',
    scripts: { ...PACKAGE_WORKSPACE_SCRIPTS },
    dependencies: workspaceSection(dependencies, project, pins),
  };
}

/** The tsconfig.json of an fe package workspace (the Next preset over its src/) and its tsconfig.build.json (emits src/ to dist/ with declarations). */
const fePackageTsconfig = () => ({ extends: '@starci/tsconfig/next.json', include: ['src/**/*.ts', 'src/**/*.tsx'], exclude: ['node_modules', 'dist'] });
const fePackageBuildTsconfig = () => ({ extends: './tsconfig.json', compilerOptions: { rootDir: 'src', outDir: 'dist', noEmit: false, incremental: false, declaration: true } });

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/** The be side's nest-cli.json: one Nest project per be app, the first api app the default. */
function nestCli(app) {
  const projects = Object.fromEntries(app.sides.be.apps.map(entry => [entry.name, { type: 'application', root: `apps/${entry.name}`, entryFile: 'main', sourceRoot: `apps/${entry.name}/src` }]));
  const first = app.sides.be.apps.find(entry => entry.kind === 'api');
  return { $schema: 'https://json.schemastore.org/nest-cli', collection: '@nestjs/schematics', monorepo: true, root: `apps/${first.name}`, sourceRoot: `apps/${first.name}/src`, projects };
}

/**
 * The tsconfig.json of one Next app of the fe side: the side's managed tsconfig plus the app's `@/*` alias and the Next plugin. It is
 * written from code, not kept as a template file: a tsconfig.json inside templates/ would make every TypeScript tool of this
 * repository treat the skeleton as a project of its own.
 */
function nextAppTsconfig() {
  return {
    extends: '../../tsconfig.json',
    compilerOptions: { plugins: [{ name: 'next' }], incremental: true, paths: { '@/*': ['./src/*'] } },
    include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  };
}

/** The names a skeleton file may fill: {{project}}, {{app}}, {{appPascal}} (the side's app) and {{sonarGate}}. */
const SKELETON_VARIABLES = Object.freeze(['project', 'app', 'appPascal', 'sonarGate']);

/**
 * A skeleton file with its variables filled. Only the skeleton names are variables: every other `{{name}}` is source the app keeps
 * (a message placeholder of the i18n canon, `{{title}}` in a catalog), and a skeleton name with no value for this file is an error.
 */
function fill(source, vars, file) {
  return source.replace(new RegExp(`\\{\\{(${SKELETON_VARIABLES.join('|')})\\}\\}`, 'g'), (_, key) => {
    if (!Object.hasOwn(vars, key)) throw new ScaffoldError('HFS_SCAFFOLD_TEMPLATE_VARIABLE', `${file} names {{${key}}}, which has no value outside a __app__ folder`);
    return vars[key];
  });
}

/** The be skeleton folder of the one cli app (slot be.app.cli: always named `cli`), written only when hfs.json declares it. */
const CLI_APP_DIR = 'apps/cli/';
const declaresCliApp = app => app.sides.be.apps.some(entry => entry.kind === 'cli' && entry.name === 'cli');

/**
 * The skeleton files of one scope (app root, be, fe): [{ path, content }], app-relative; a `__app__` file once per api app of the
 * be side (once per app of the fe side), the be `apps/cli/` folder once when the cli app is declared, an fe `apps/<name>/` folder
 * once for the declared fe app <name> (none other), `__project__` in a path replaced by the project name.
 */
function skeletonOf(scope, app, vars) {
  const dir = path.join(TEMPLATES_DIR, scope, 'skeleton');
  if (!fs.existsSync(dir)) throw new ScaffoldError('HFS_SCAFFOLD_SKELETON_MISSING', `no skeleton templates in templates/${scope}/skeleton`);
  const apps = scope === 'app' ? [] : app.sides[scope].apps.filter(entry => scope === 'fe' || entry.kind === 'api');
  const prefix = scope === 'app' ? '' : `${scope}/`;
  const files = [];
  for (const rel of listFiles(dir)) {
    const source = fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n');
    const once = { project: app.project, ...vars };
    if (!rel.includes(APP_DIR)) {
      if (scope === 'be' && rel.startsWith(CLI_APP_DIR) && !declaresCliApp(app)) continue;
      // An fe apps/<name>/ folder is the skeleton of the declared fe app <name> alone.
      const feApp = scope === 'fe' ? apps.find(entry => rel.startsWith(`apps/${entry.name}/`)) : undefined;
      if (scope === 'fe' && rel.startsWith('apps/') && !feApp) continue;
      const appVars = feApp ? { app: feApp.name, appPascal: pascal(feApp.name) } : {};
      files.push({ path: `${prefix}${rel.split(PROJECT_DIR).join(app.project)}`, content: fill(source, { ...once, ...appVars }, rel) });
      continue;
    }
    for (const entry of apps) files.push({ path: `${prefix}${rel.split(APP_DIR).join(entry.name)}`, content: fill(source, { ...once, app: entry.name, appPascal: pascal(entry.name) }, rel) });
  }
  // Every declared fe app has a skeleton: its own apps/<name>/ folder or the shared __app__ one.
  for (const entry of scope === 'fe' ? apps : []) {
    if (!files.some(file => file.path.startsWith(`fe/apps/${entry.name}/`))) throw new ScaffoldError('HFS_SCAFFOLD_SKELETON_MISSING', `no skeleton templates for the fe app ${entry.name} in templates/fe/skeleton/apps/${entry.name}`);
  }
  return files;
}

/** The npm step that resolves the lockfile of a new app, exactly as the error names it. */
export const LOCK_STEP = 'npm install --package-lock-only --ignore-scripts --no-audit --no-fund';

/**
 * Resolves the real package-lock.json of the app at `root` with npm (the registry and the npm cache; no node_modules and no
 * lifecycle script). `{ ok: true }` or `{ ok: false, detail }`.
 */
export function npmLock(root) {
  // Through the shell (npm is npm.cmd on Windows, which runs only there); the command is the fixed literal LOCK_STEP.
  const run = spawnSync(LOCK_STEP, { cwd: root, encoding: 'utf8', shell: true, windowsHide: true, timeout: 600_000 });
  if (run.status === 0 && fs.existsSync(path.join(root, 'package-lock.json'))) return { ok: true };
  const said = `${run.stderr ?? ''}\n${run.stdout ?? ''}`.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  // npm's own error lines (`npm error code ETARGET`, `npm error notarget No matching version found for x@1.2.3.`), without the log pointer.
  const errors = said.filter(line => /^npm (?:error|ERR!)/i.test(line) && !/complete log/i.test(line)).map(line => line.replace(/^npm (?:error|ERR!)\s*/i, ''));
  const reason = run.error ? String(run.error.message) : errors.slice(0, 2).join('; ') || said[0] || 'no output';
  return { ok: false, detail: `exit ${run.status ?? 'none'}: ${reason}` };
}

/**
 * `hfs scaffold app <name>`: writes the new app under `into`, resolves its lockfile with npm (`lock`, npmLock), and returns
 * `{ root, files }` (app-relative paths, sorted). `presets` is what sync loads from the installed @starci/jest-preset (the Sonar
 * exclusions); the CLI passes the one it resolves. A failed lock step removes the app and throws HFS_SCAFFOLD_LOCK_FAILED.
 */
export function scaffoldApp({ name, into, presets, manifest = loadSlotManifest(), lock = npmLock }) {
  if (!NAME.test(String(name))) throw new ScaffoldError('HFS_SCAFFOLD_NAME_INVALID', `the app name ${name} must be kebab-case (a project name: ${NAME})`);
  const root = path.join(into, name);
  if (fs.existsSync(root)) throw new ScaffoldError('HFS_SCAFFOLD_EXISTS', `${root} already exists; hfs scaffold app never writes into an existing directory`);
  const declaration = starterDeclaration(name, manifest);
  const app = resolveRepoDeclaration(manifest, declaration);
  const pins = parseYaml(fs.readFileSync(PINS_FILE, 'utf8')).pins;
  const pkg = packageManifest(name, pins);
  const files = [
    { path: 'hfs.json', content: jsonText(declaration) },
    { path: 'package.json', content: jsonText(pkg) },
    { path: 'be/nest-cli.json', content: jsonText(nestCli(app)) },
    ...app.sides.fe.apps.map(entry => ({ path: `fe/apps/${entry.name}/tsconfig.json`, content: jsonText(nextAppTsconfig()) })),
    ...app.sides.fe.apps.map(entry => ({ path: `fe/apps/${entry.name}/package.json`, content: jsonText(feAppManifest(name, entry.name, pins)) })),
    ...Object.keys(FE_PACKAGES).flatMap(pkg => [
      { path: `fe/packages/${name}-${pkg}/package.json`, content: jsonText(fePackageManifest(name, pkg, pins)) },
      { path: `fe/packages/${name}-${pkg}/tsconfig.json`, content: jsonText(fePackageTsconfig()) },
      { path: `fe/packages/${name}-${pkg}/tsconfig.build.json`, content: jsonText(fePackageBuildTsconfig()) },
    ]),
    ...['app', 'be', 'fe'].flatMap(scope => skeletonOf(scope, app, { sonarGate: parseYaml(fs.readFileSync(SONAR_GATE_FILE, 'utf8')).gate.name })),
  ];
  for (const file of files) {
    const target = path.join(root, ...file.path.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  const targets = renderTargets(declaration, presets, { manifest });
  writeTargets(root, targets);
  const locked = lock(root);
  if (!locked.ok) {
    fs.rmSync(root, { recursive: true, force: true });
    throw new ScaffoldError('HFS_SCAFFOLD_LOCK_FAILED', `\`${LOCK_STEP}\` could not resolve the lockfile of ${root} (${locked.detail}); the app was removed. Check the network and the npm registry, then run hfs scaffold app ${name} again`);
  }
  return { root, files: [...new Set([...files.map(file => file.path), ...targets.map(target => target.path), 'package-lock.json'])].sort() };
}
