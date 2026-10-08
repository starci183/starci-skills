// starci app scaffold <name> - the first app tree, rendered from its canonical declaration, skeleton and managed targets.
// The selected edition owns the app root and its be/fe sides under knowledge/hfs/slots.yaml.
//
// The skeleton files are written once from templates/<app|be|fe>/skeleton ({{project}}, {{app}} and {{appPascal}} filled). Path
// variables: a `__app__` folder is written once per app of the side, named after it; an fe `apps/<name>/` folder is the skeleton of
// the declared fe app <name> alone (landing and app differ); `__project__` in a path is the project name (packages/__project__-ui is
// packages/<name>-ui). The workspace manifests and every tsconfig.json are written from code, never kept as template files (a
// tsconfig.json under templates/ would be a TypeScript project of this repository); the managed files are the render of `starci app sync` (sync/index.mjs), so a fresh app
// is in sync by construction. The lockfile is never written by hand: once the files are written, npm resolves the real one
// (`npm install --package-lock-only`, no node_modules, no scripts), so `npm ci` installs the new app as it is. When npm cannot
// resolve it the scaffold fails (HFS_SCAFFOLD_LOCK_FAILED), names the step and unlinks its own generated entries. Replaced or
// occupied entries are retained with a cleanup message. The only existing root accepted is an empty unborn main Git repository.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadSlotManifest, resolveRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { dbTypesPath, generateDbTypes } from '../emit/db-types.mjs';
import { TEMPLATES_DIR, appSource, imageFiles, render, renderTargets, writeTargets } from '../sync/index.mjs';
import { ScaffoldError } from './service.mjs';
import { SUPABASE_PORT_VARIABLES, supabasePortVars } from './supabase-ports.mjs';
import { FE_APP_SCRIPTS, PACKAGE_MANAGER, WORKSPACES, WORKSPACE_LINT, feAppPackageName } from '../runtime/scripts/hfs/rules/monorepo.mjs';
import { isLinkLike } from '../runtime/scripts/api/fs/is-link-like.mjs';
import { unlinkOnly } from '../runtime/scripts/api/fs/lib.mjs';
import { revParseQuery } from '../runtime/scripts/api/git/rev-parse-query.mjs';
import { lsFiles } from '../runtime/scripts/api/git/ls-files.mjs';
import { insidePath, samePath } from '../runtime/scripts/lib/path-key.mjs';
import { byCodeUnit } from '../report/order.mjs';

const NAME = /^[a-z][a-z0-9-]*$/;
const APP_DIR = '__app__';
/** The path variable of the project name: `packages/__project__-ui` is written as `packages/<project>-ui`. */
const PROJECT_DIR = '__project__';
const TIMESTAMP = '__timestamp__';
const PINS_FILE = path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'hfs', 'canon-pins.yaml');
const SONAR_GATE_FILE = path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'sonar-gate.yaml');
const pascal = name => name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
const bundledPins = () => parseYaml(fs.readFileSync(PINS_FILE, 'utf8')).pins;

/**
 * A JSON file as prettier prints it (the app's format check judges every file the scaffold writes): an object one key per line, an
 * array of plain values on one line, any other array one item per line.
 */
export function jsonText(value) {
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

/** A package.json as Prettier prints it (notably, package workspaces stay one entry per line). */
export const packageJsonText = value => `${JSON.stringify(value, null, 2)}\n`;

/**
 * The apps a new app starts with: on the be side the `core` api app and the `cli` app over one `primary` connection, two Next apps
 * (landing, app) on the fe side, which read the be contracts for their codegen.
 */
const STARTER_SIDES = Object.freeze({
  be: Object.freeze({ apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], kinds: ['api', 'cli'], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' }] }),
  // fe: the landing and the product app, over the shared ui and i18n packages (both opt-in slots, enabled here).
  fe: Object.freeze({ apps: [{ name: 'landing', kind: 'next' }, { name: 'app', kind: 'next' }], reads: ['be/contracts/'], optionalSlots: ['fe.package.ui', 'fe.package.i18n'] }),
});

/** The lite starter is the upgrade-safe subset: one API, one web app and one Supabase schema authority. */
const LITE_STARTER_SIDES = Object.freeze({
  be: Object.freeze({
    apps: [{ name: 'api', kind: 'api' }],
    kinds: ['api'],
    connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' }],
    reads: ['supabase/types/'],
  }),
  fe: Object.freeze({ apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/', 'supabase/types/'] }),
});

/** The checked local Supabase auth posture of every newly scaffolded lite app. */
const LITE_STARTER_SUPABASE = Object.freeze({
  enableSignup: false,
  jwtExpiry: 3600,
  siteUrl: 'http://127.0.0.1:3000',
  redirectUrls: ['http://127.0.0.1:3000/auth/callback'],
});

/**
 * The dependencies of the starter: what the skeleton imports and the tools the managed scripts and configs run. Every name
 * takes its canon pin (knowledge/hfs/canon-pins.yaml). The root package.json holds the back end's runtime and every tool;
 * each fe app workspace declares the packages its own source imports (HFS_MONO_WORKSPACE_DEP), FE_APP_DEPENDENCIES.
 */
const STARTER_DEPENDENCIES = Object.freeze({
  dependencies: {
    '@nestjs/common': null, '@nestjs/core': null, '@nestjs/cqrs': null,
    '@nestjs/platform-express': null, '@nestjs/typeorm': null, 'nest-commander': null, pg: null,
    'class-transformer': null, 'class-validator': null, 'reflect-metadata': null, rxjs: null, tslib: null, typeorm: null,
  },
  devDependencies: {
    turbo: null, '@nestjs/testing': null, '@starci/cli': null, '@starci/eslint-canon-be': null, '@starci/eslint-canon-fe': null, '@starci/jest-preset': null,
    '@starci/prettier-config': null, '@starci/stylelint-canon': null, '@starci/test-world': null, '@starci/tsconfig': null, '@tailwindcss/postcss': null, '@types/express': null,
    '@types/jest': null, '@types/node': null, '@types/react': null, '@types/react-dom': null, eslint: null, 'eslint-plugin-react-hooks': null,
    husky: null, jest: null, 'postcss-value-parser': null, prettier: null, stylelint: null, tailwindcss: null, 'ts-jest': null,
    'ts-node-dev': null, 'tsc-alias': null, 'tsconfig-paths': null, typescript: null,
  },
});

/** Lite keeps the production stack and canon tools, but has no test runtime or test types. */
const LITE_STARTER_DEPENDENCIES = Object.freeze({
  dependencies: {
    '@nestjs/common': null, '@nestjs/core': null, '@nestjs/cqrs': null,
    '@nestjs/platform-express': null, '@nestjs/typeorm': null, '@supabase/supabase-js': null,
    'class-transformer': null, 'class-validator': null, jose: null, pg: null,
    'reflect-metadata': null, rxjs: null, tslib: null, typeorm: null,
  },
  devDependencies: {
    turbo: null, '@starci/eslint-canon-be': null, '@starci/eslint-canon-fe': null, '@starci/cli': null,
    '@starci/prettier-config': null, '@starci/stylelint-canon': null, '@starci/tsconfig': null, '@tailwindcss/postcss': null,
    '@types/express': null, '@types/node': null, '@types/react': null, '@types/react-dom': null,
    eslint: null, 'eslint-plugin-react-hooks': null, husky: null, 'postcss-value-parser': null, prettier: null,
    stylelint: null, supabase: null, tailwindcss: null, 'ts-node-dev': null, 'tsc-alias': null,
    'tsconfig-paths': null, typescript: null,
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

/** The sole lite FE workspace owns its Supabase clients directly; no shared FE package is emitted. */
const LITE_FE_APP_DEPENDENCIES = Object.freeze({
  '@heroui/react': null, '@heroui/styles': null, '@starci/grammar': null, '@supabase/ssr': null,
  '@supabase/supabase-js': null, next: null, 'next-intl': null, react: null, 'react-dom': null, 'server-only': null,
});

/**
 * The shared fe workspace packages of the starter, fe/packages/<project>-<name> named @<project>/<name>: each one's exported
 * subpaths (built to dist) and the runtime dependencies its own source imports. ui holds the drawings both apps mount; i18n the
 * next-intl stack (the entry, a server module: createAppI18n; ./proxy, the locale negotiation the apps' proxy.ts re-exports;
 * ./routing, client-safe: the default locale a client boundary reads).
 */
const FE_PACKAGES = Object.freeze({
  ui: { exports: ['.'], dependencies: { '@heroui/react': null, '@starci/grammar': null, 'next-intl': null, react: null } },
  i18n: { exports: ['.', './proxy', './routing'], dependencies: { next: null, 'next-intl': null, 'server-only': null } },
});

/** The scripts of every fe package workspace: tsc builds it to dist and type-checks it; it lints with the workspace lint. */
const PACKAGE_WORKSPACE_SCRIPTS = Object.freeze({ build: 'tsc -p tsconfig.build.json', lint: WORKSPACE_LINT, typecheck: 'tsc --noEmit -p tsconfig.json' });

/** The app hfs.json of a new app called `name`; full remains the byte-for-byte default declaration. */
const starterDeclaration = (name, manifest = loadSlotManifest(), edition = 'full') => ({
  hfs: manifest.major,
  kind: 'app',
  ...(edition === 'full' ? {} : { edition }),
  project: name,
  ...(edition === 'lite' ? { supabase: structuredClone(LITE_STARTER_SUPABASE) } : {}),
  sides: structuredClone(edition === 'lite' ? LITE_STARTER_SIDES : STARTER_SIDES),
});

/** A dependency section at the canon pins (a null range takes the pin, which must exist; every pinned name is null). */
function pinnedSection(entries, pins) {
  const pinned = (dependency, range) => {
    if (range !== null) return range;
    if (!pins[dependency]) throw new ScaffoldError('HFS_SCAFFOLD_PIN_MISSING', `${dependency} has no canon pin in knowledge/hfs/canon-pins.yaml`);
    return pins[dependency].version;
  };
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)).map(([dependency, range]) => [dependency, pinned(dependency, range)]));
}

/** The root package.json of a new app, the monorepo root: name, workspaces, npm and its edition's dependencies at canon pins. */
function packageManifest(name, pins, edition) {
  const dependencies = edition === 'lite' ? LITE_STARTER_DEPENDENCIES : STARTER_DEPENDENCIES;
  return { name, version: '0.0.0', private: true, packageManager: PACKAGE_MANAGER, workspaces: [...WORKSPACES], dependencies: pinnedSection(dependencies.dependencies, pins), devDependencies: pinnedSection(dependencies.devDependencies, pins) };
}

/** A dependency section of an fe workspace with `@<project>/` names filled and the canon pins taken. */
const workspaceSection = (entries, project, pins) => pinnedSection(Object.fromEntries(Object.entries(entries).map(([name, range]) => [name.replace('@<project>/', `@${project}/`), range])), pins);

/** The package.json of the fe app workspace `app` of the app `project`: @<project>/<app>, private, the workspace scripts, its own dependencies. */
function feAppManifest(project, app, pins, edition) {
  const dependencies = edition === 'lite' ? LITE_FE_APP_DEPENDENCIES : FE_APP_DEPENDENCIES;
  return { name: feAppPackageName(project, app), version: '0.0.0', private: true, scripts: { ...FE_APP_SCRIPTS }, dependencies: workspaceSection(dependencies, project, pins) };
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

/** The names a skeleton file may fill: {{project}}, {{app}}, {{appPascal}} (the side's app), {{sonarGate}} and the lite Supabase port block ({{supabasePort<Section>}}, supabase-ports.mjs). */
const SKELETON_VARIABLES = Object.freeze(['project', 'app', 'appPascal', 'sonarGate', ...SUPABASE_PORT_VARIABLES]);

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

/** Let sync's renderer expand partials first while leaving every source placeholder for `fill` to validate or preserve. */
const PARTIAL_VARIABLES = new Proxy(Object.create(null), {
  get: (_target, key) => `{{${String(key)}}}`,
  getOwnPropertyDescriptor: (_target, key) => ({ configurable: true, value: `{{${String(key)}}}` }),
});

/** The be skeleton folder of the one cli app (slot be.app.cli: always named `cli`), written only when hfs.json declares it. */
const CLI_APP_DIR = 'apps/cli/';
const declaresCliApp = app => app.sides.be.apps.some(entry => entry.kind === 'cli' && entry.name === 'cli');

const LITE_APP_REUSED = new Set(['.editorconfig', '.gitattributes', '.nvmrc', '.starciwork/workspace.yaml',
  '.starciwork/index.yaml', '.starciwork/features/system-health/index.yaml']);
const LITE_DEFERRED_GENERATOR_FILES = new Set([
  'src/modules/platform/database/database.sql.ts',
  'src/modules/platform/database/migration-runner.service.ts',
  'src/modules/platform/database/seed-runner.service.ts',
]);
const liteBaseFile = (scope, rel) => {
  if (scope === 'app') return LITE_APP_REUSED.has(rel);
  if (scope === 'fe') return false;
  return !rel.startsWith('apps/cli/')
    && !rel.startsWith('src/features/cli/')
    && !rel.startsWith('src/modules/domain/note/')
    && rel !== 'src/modules/platform/database/connection-source.client.ts'
    && rel !== 'src/modules/platform/database/migrate-connections.client.ts'
    && rel !== 'src/modules/platform/database/seed-connections.client.ts'
    && rel !== 'src/modules/platform/primitives/sequence.policy.ts'
    && !LITE_DEFERRED_GENERATOR_FILES.has(rel)
    && !rel.startsWith('src/tests/')
    && !rel.endsWith('.spec.ts');
};
const liteOverlayFile = (scope, rel) => scope !== 'be' || !LITE_DEFERRED_GENERATOR_FILES.has(rel);

/** One skeleton directory rendered to app-relative files; `include` filters source-relative paths before variables are expanded. */
function skeletonDirectory(scope, directory, app, vars, include = () => true) {
  const dir = path.join(TEMPLATES_DIR, scope, directory);
  if (!fs.existsSync(dir)) throw new ScaffoldError('HFS_SCAFFOLD_SKELETON_MISSING', `no skeleton templates in templates/${scope}/${directory}`);
  const apps = scope === 'app' ? [] : app.sides[scope].apps.filter(entry => scope === 'fe' || entry.kind === 'api');
  const prefix = scope === 'app' ? '' : `${scope}/`;
  const files = [];
  for (const rel of listFiles(dir).filter(include)) {
    const source = render(fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n'), PARTIAL_VARIABLES);
    const once = { project: app.project, ...vars };
    const output = candidate => candidate.split(PROJECT_DIR).join(app.project).split(TIMESTAMP).join(vars.timestamp);
    if (!rel.includes(APP_DIR)) {
      if (scope === 'be' && rel.startsWith(CLI_APP_DIR) && !declaresCliApp(app)) continue;
      const fixedApp = apps.find(entry => rel.startsWith(`apps/${entry.name}/`));
      if (scope === 'fe' && rel.startsWith('apps/') && !fixedApp) continue;
      const appVars = fixedApp ? { app: fixedApp.name, appPascal: pascal(fixedApp.name) } : {};
      files.push({ path: `${prefix}${output(rel)}`, content: fill(source, { ...once, ...appVars }, `${directory}/${rel}`) });
      continue;
    }
    for (const entry of apps) files.push({ path: `${prefix}${output(rel.split(APP_DIR).join(entry.name))}`, content: fill(source, { ...once, app: entry.name, appPascal: pascal(entry.name) }, `${directory}/${rel}`) });
  }
  return files;
}

/** The canonical product catalog and feature nodes shared by scaffold and upgrades of older lite apps. */
export function scaffoldWorkSeeds(project) {
  return skeletonDirectory('app', 'skeleton', { project }, {},
    rel => rel === '.starciwork/index.yaml' || rel.startsWith('.starciwork/features/'));
}

/**
 * The skeleton files of one scope (app root, be, fe): [{ path, content }], app-relative; a `__app__` file once per api app of the
 * be side (once per app of the fe side), the be `apps/cli/` folder once when the cli app is declared, an fe `apps/<name>/` folder
 * once for the declared fe app <name> (none other), `__project__` in a path replaced by the project name.
 */
function skeletonOf(scope, app, vars) {
  const files = app.edition === 'lite'
    ? [...skeletonDirectory(scope, 'skeleton', app, vars, rel => liteBaseFile(scope, rel)), ...skeletonDirectory(scope, 'skeleton-lite', app, vars, rel => liteOverlayFile(scope, rel))]
    : skeletonDirectory(scope, 'skeleton', app, vars);
  const unique = [...new Map(files.map(file => [file.path, file])).values()];
  // Every declared fe app has a skeleton: its own apps/<name>/ folder or the shared __app__ one.
  for (const entry of scope === 'fe' ? app.sides.fe.apps : []) {
    if (!unique.some(file => file.path.startsWith(`fe/apps/${entry.name}/`))) throw new ScaffoldError('HFS_SCAFFOLD_SKELETON_MISSING', `no skeleton templates for the fe app ${entry.name}`);
  }
  return unique;
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

/** Read-only admission of the one existing-root case; a failed Git query cannot prove an empty repository. */
function emptyUnbornGit(root, stat) {
  try {
    if (!stat.isDirectory() || isLinkLike(root, { stat })) return false;
    const entries = fs.readdirSync(root);
    if (entries.length !== 1 || entries[0] !== '.git') return false;
    const git = path.join(root, '.git');
    const metadata = fs.lstatSync(git);
    if (!metadata.isDirectory() || isLinkLike(git, { stat: metadata })) return false;
    const head = path.join(git, 'HEAD');
    if (!fs.lstatSync(head).isFile() || isLinkLike(head) || fs.readFileSync(head, 'utf8').trim() !== 'ref: refs/heads/main') return false;
    const top = revParseQuery(['--show-toplevel'], { cwd: root });
    const unborn = revParseQuery(['--verify', '--quiet', 'HEAD'], { cwd: root });
    const refs = revParseQuery(['--all'], { cwd: root });
    const index = lsFiles(['--cached', '-z'], { cwd: root });
    return !top.error && top.status === 0 && samePath(path.resolve(top.stdout.trim()), path.resolve(root))
      && !unborn.error && unborn.status === 1 && !refs.error && refs.status === 0 && !refs.stdout.trim()
      && !index.error && index.status === 0 && !index.stdout;
  } catch { return false; }
}

/** Own only created entries. Rollback unlinks them individually, never a tree or a path reached through a replacement link. */
function scaffoldWrites(root, original) {
  const files = new Map();
  const directories = new Map();
  const unexpected = new Set();
  let rootStat = original;
  const identity = (a, b) => a && b && a.dev === b.dev && a.ino === b.ino;
  const stat = file => fs.lstatSync(file, { throwIfNoEntry: false });
  const directory = dir => {
    if (!samePath(dir, root)) directory(path.dirname(dir));
    let current = stat(dir);
    if (!current) {
      fs.mkdirSync(dir, { recursive: samePath(dir, root) });
      current = stat(dir);
      directories.set(dir, current);
      if (samePath(dir, root)) rootStat = current;
    }
    const owned = samePath(dir, root) ? rootStat : directories.get(dir);
    if (!current.isDirectory() || isLinkLike(dir, { stat: current }) || !identity(current, owned)) throw new ScaffoldError('HFS_SCAFFOLD_EXISTS', `${dir} is not a plain scaffold-owned directory`);
  };
  const reachable = file => {
    const parent = path.dirname(file);
    if (!samePath(parent, root) && !insidePath(root, parent)) return false;
    let dir = root;
    for (const part of ['', ...path.relative(root, parent).split(path.sep).filter(Boolean)]) {
      if (part) dir = path.join(dir, part);
      const current = stat(dir);
      if (!current?.isDirectory() || isLinkLike(dir, { stat: current })) return false;
      if (samePath(dir, root) && !identity(current, rootStat)) return false;
    }
    return true;
  };
  const claim = relative => {
    const target = path.resolve(root, relative);
    if (!insidePath(root, target) || relative.split(/[\\/]/)[0] === '.git') throw new ScaffoldError('HFS_SCAFFOLD_EXISTS', `${relative} is outside the scaffold file scope`);
    directory(path.dirname(target));
    if (files.has(target)) {
      const current = stat(target);
      if (!current?.isFile() || !identity(current, files.get(target))) throw new ScaffoldError('HFS_SCAFFOLD_EXISTS', `${target} replaced a scaffold file`);
    } else {
      const fd = fs.openSync(target, 'wx');
      try { files.set(target, fs.fstatSync(fd)); } finally { fs.closeSync(fd); }
    }
    return target;
  };
  return {
    claim,
    write(relative, content) { fs.writeFileSync(claim(relative), content); },
    lockfile() {
      const target = path.join(root, 'package-lock.json');
      if (reachable(target)) {
        const current = stat(target);
        if (current?.isFile() && !isLinkLike(target, { stat: current })) files.set(target, current);
        else if (current) unexpected.add(target);
      }
    },
    rollback() {
      const held = [...unexpected];
      for (const [target, owned] of [...files, ...[...directories].reverse()]) {
        try {
          if (!samePath(target, root) && !reachable(target)) { held.push(target); continue; }
          const current = stat(target);
          if (!current) continue;
          if (!identity(current, owned) || isLinkLike(target, { stat: current }) || !unlinkOnly(target)) held.push(target);
        } catch (error) { held.push(`${target}: ${error.message}`); }
      }
      return held;
    },
  };
}

/**
 * `starci app scaffold <name>`: writes the new app under `into`, resolves its lockfile with npm (`lock`, npmLock), and returns
 * `{ root, files }` (app-relative paths, sorted). `presets` is what sync loads from the installed @starci/jest-preset (the Sonar
 * exclusions); the CLI passes the one it resolves. Failure removes only scaffold-owned entries, retaining an existing .git.
 */
export function scaffoldApp({ name, into, presets, edition = 'full', manifest = loadSlotManifest(), pins = bundledPins(), lock = npmLock, emitTypes = generateDbTypes, now = () => new Date() }) {
  if (!NAME.test(String(name))) throw new ScaffoldError('HFS_SCAFFOLD_NAME_INVALID', `the app name ${name} must be kebab-case (a project name: ${NAME})`);
  const root = path.resolve(into, name);
  const original = fs.lstatSync(root, { throwIfNoEntry: false });
  if (original && !emptyUnbornGit(root, original)) throw new ScaffoldError('HFS_SCAFFOLD_EXISTS', `${root} already exists; only a plain directory containing solely .git with unborn main and an empty index can be scaffolded`);
  const declaration = starterDeclaration(name, manifest, edition);
  const app = resolveRepoDeclaration(manifest, declaration);
  const pkg = packageManifest(name, pins, app.edition);
  const timestamp = now().toISOString().replace(/\D/g, '').slice(0, 14);
  const files = [
    { path: 'hfs.json', content: jsonText(declaration) },
    { path: 'package.json', content: packageJsonText(pkg) },
    { path: 'be/nest-cli.json', content: jsonText(nestCli(app)) },
    ...app.sides.fe.apps.map(entry => ({ path: `fe/apps/${entry.name}/tsconfig.json`, content: jsonText(nextAppTsconfig()) })),
    ...app.sides.fe.apps.map(entry => ({ path: `fe/apps/${entry.name}/package.json`, content: packageJsonText(feAppManifest(name, entry.name, pins, app.edition)) })),
    ...imageFiles(app),
    ...(app.edition === 'lite' ? [] : Object.keys(FE_PACKAGES).flatMap(pkg => [
      { path: `fe/packages/${name}-${pkg}/package.json`, content: packageJsonText(fePackageManifest(name, pkg, pins)) },
      { path: `fe/packages/${name}-${pkg}/tsconfig.json`, content: jsonText(fePackageTsconfig()) },
      { path: `fe/packages/${name}-${pkg}/tsconfig.build.json`, content: jsonText(fePackageBuildTsconfig()) },
    ])),
    ...['app', 'be', 'fe'].flatMap(scope => skeletonOf(scope, app, { sonarGate: parseYaml(fs.readFileSync(SONAR_GATE_FILE, 'utf8')).gate.name, timestamp, ...supabasePortVars(name) })),
  ];
  const writes = scaffoldWrites(root, original);
  try {
    for (const file of files) writes.write(file.path, file.content);
    const targets = renderTargets(declaration, presets, { manifest, source: appSource(root) });
    for (const target of targets) writes.claim(target.path);
    writeTargets(root, targets);
    if (app.edition === 'lite') {
      try {
        const text = emitTypes({ root });
        if (typeof text !== 'string' || !text.trim()) throw new Error('the Supabase CLI returned no database types');
        writes.write(dbTypesPath, text);
      } catch (error) {
        throw new ScaffoldError('HFS_SCAFFOLD_TYPES_FAILED', `Supabase database types could not be generated for ${root} (${String(error?.message ?? error)}). Start the local Supabase stack and run starci app scaffold ${name} --edition lite again`);
      }
    }
    let locked;
    try { locked = lock(root); } finally { writes.lockfile(); }
    if (!locked.ok) throw new ScaffoldError('HFS_SCAFFOLD_LOCK_FAILED', `\`${LOCK_STEP}\` could not resolve the lockfile of ${root} (${locked.detail}). Check the network and the npm registry, then run starci app scaffold ${name} again`);
    return { root, files: [...new Set([...files.map(file => file.path), ...targets.map(target => target.path), ...(app.edition === 'lite' ? [dbTypesPath] : []), 'package-lock.json'])].sort(byCodeUnit) };
  } catch (error) {
    const held = writes.rollback();
    if (held.length) error.message += `; cleanup retained replaced or occupied entries: ${held.join(', ')}`;
    throw error;
  }
}
