// starci app scaffold <name> - the first app tree, rendered from its canonical declaration, skeleton and managed targets.
// The selected edition owns the app root and its be/fe sides under knowledge/hfs/slots.yaml.
//
// The skeleton files are written once from templates/<app|be|fe>/skeleton ({{project}}, {{app}} and {{appPascal}} filled). Path
// variables: a `__app__` folder is written once per app of the side, named after it (on the fe side: once per product app, every
// declared Next app but the marketing landing, which calls no back end: the shared app core of both editions, modules/api, auth,
// toast, redux, the providers and the hooks); an fe `apps/<name>/` folder is the skeleton of the declared fe app <name> alone
// (landing and app differ); `__project__` in a path is the project name (packages/__project__-ui is packages/<name>-ui). The workspace manifests and every tsconfig.json are written from code, never kept as template files (a
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
import { initializeAppIdentity } from '../runtime/scripts/hfs/secret-init.mjs';
import { declaredSealedMembers, materializeDeclaredPlaceholders } from '../runtime/scripts/hfs/sealed-members.mjs';
import { revParseQuery } from '../runtime/scripts/api/git/rev-parse-query.mjs';
import { lsFiles } from '../runtime/scripts/api/git/ls-files.mjs';
import { insidePath, samePath } from '../runtime/scripts/lib/path-key.mjs';
import { byCodeUnit } from '../report/order.mjs';
import { sonarGateName } from '../sync/sonar-key.mjs';

const NAME = /^[a-z][a-z0-9-]*$/;
const APP_DIR = '__app__';
/** The path variable of the project name: `packages/__project__-ui` is written as `packages/<project>-ui`. */
const PROJECT_DIR = '__project__';
const TIMESTAMP = '__timestamp__';
const PINS_FILE = path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'hfs', 'canon-pins.yaml');
/**
 * The front-end stack catalog (knowledge/hfs/fe-stack.yaml): the bundled runtime copy, else the runtime checkout's own file (the
 * package inside the StarCi repository before the runtime copy carries it).
 */
const FE_STACK_FILES = [
  path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'hfs', 'fe-stack.yaml'),
  path.join(import.meta.dirname, '..', '..', '..', 'knowledge', 'hfs', 'fe-stack.yaml'),
];
const SONAR_GATE_FILE = path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'sonar-gate.yaml');
/** The runtime-peer catalog (knowledge/hfs/peer-integrations.yaml, R111) the package carries. */
const PEERS_FILE = path.join(import.meta.dirname, '..', 'runtime', 'knowledge', 'hfs', 'peer-integrations.yaml');
const pascal = name => name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
/** The canon pins (knowledge/hfs/canon-pins.yaml) the package carries. */
export const bundledPins = () => parseYaml(fs.readFileSync(PINS_FILE, 'utf8')).pins;

/** The parsed front-end stack catalog; a package without it cannot know what every front end installs. */
function bundledFeStack() {
  const file = FE_STACK_FILES.find(candidate => fs.existsSync(candidate));
  if (!file) throw new ScaffoldError('HFS_SCAFFOLD_STACK_MISSING', 'knowledge/hfs/fe-stack.yaml is not carried by this package; regenerate the runtime copy');
  return parseYaml(fs.readFileSync(file, 'utf8'));
}

/**
 * The marketing fe app of the full starter: it calls no back end, so the shared app core (`apps/__app__/`) is not written into
 * it and the repository keeps one transport client folder (FE_TRANSPORT_OWNER).
 */
const MARKETING_FE_APPS = Object.freeze(new Set(['landing']));
/** The fe apps that carry the shared app core: every declared Next app but the marketing one. */
export const coreFeApps = apps => apps.filter(entry => entry.kind === 'next' && !MARKETING_FE_APPS.has(entry.name));

/**
 * The tool packages of the fe stack, installed once at the app root (devDependencies) and never in an fe workspace: the
 * concerns whose packages only the root scripts run (the GraphQL codegen, lint and format), plus the compiler and the CSS engine.
 */
const FE_ROOT_TOOL_CONCERNS = Object.freeze(new Set(['codegen', 'lint']));
const FE_ROOT_TOOL_PACKAGES = Object.freeze(new Set(['typescript', 'tailwindcss']));

/**
 * The `tier: core` packages of the fe stack every scaffold installs, read from fe-stack.yaml (never listed here), split into
 * `app` (the runtime imports of each product fe app workspace) and `root` (the tools at the app root). Both editions alike.
 */
export function coreFeStackPackages(stack = bundledFeStack()) {
  const app = new Set();
  const root = new Set();
  for (const concern of stack.concerns ?? []) {
    if (concern.tier !== 'core') continue;
    for (const name of concern.packages ?? []) {
      (FE_ROOT_TOOL_CONCERNS.has(concern.id) || FE_ROOT_TOOL_PACKAGES.has(name) ? root : app).add(name);
    }
  }
  return { app: [...app].sort(byCodeUnit), root: [...root].sort(byCodeUnit) };
}

/**
 * A JSON file as prettier prints it (the app's format check judges every file the scaffold writes): an object one key per line, an
 * array of plain values on one line, any other array one item per line.
 */
export function jsonText(value) {
  const print = (item, indent) => {
    const inner = `${indent}  `;
    if (Array.isArray(item)) {
      if (item.every(entry => entry === null || typeof entry !== 'object')) return `[${item.map(entry => JSON.stringify(entry)).join(', ')}]`;
      const entries = item.map(entry => `${inner}${print(entry, inner)}`).join(',\n');
      return `[\n${entries}\n${indent}]`;
    }
    if (item !== null && typeof item === 'object') {
      const keys = Object.keys(item);
      if (!keys.length) return '{}';
      const entries = keys.map(key => `${inner}${JSON.stringify(key)}: ${print(item[key], inner)}`).join(',\n');
      return `{\n${entries}\n${indent}}`;
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
  redirectUrls: ['http://127.0.0.1:3000/'],
});

/**
 * The dependencies of the starter: what the skeleton imports and the tools the managed scripts and configs run. Every name
 * takes its canon pin (knowledge/hfs/canon-pins.yaml). The root package.json holds the back end's runtime and every tool;
 * each fe app workspace declares the packages its own source imports (HFS_MONO_WORKSPACE_DEP), FE_APP_DEPENDENCIES.
 */
const STARTER_DEPENDENCIES = Object.freeze({
  dependencies: {
    '@apollo/server': null, '@nestjs/apollo': null, '@nestjs/common': null, '@nestjs/core': null, '@nestjs/cqrs': null, '@nestjs/graphql': null,
    '@nestjs/platform-express': null, '@nestjs/typeorm': null, 'nest-commander': null, pg: null, graphql: null,
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

/**
 * Lite keeps the production stack, the canon tools and the back end's unit run (ruling:R212/case-1, amended by ruling:R212/case-4); it runs no test world of
 * its own (no @starci/test-world). Both editions serve GraphQL from the api app (@nestjs/graphql over Apollo, owner ruling
 * 2026-10-13); the fe stack's root tools are added from fe-stack.yaml by packageManifest.
 */
const LITE_STARTER_DEPENDENCIES = Object.freeze({
  dependencies: {
    '@apollo/server': null, '@nestjs/apollo': null, '@nestjs/common': null, '@nestjs/core': null, '@nestjs/cqrs': null, '@nestjs/graphql': null,
    '@nestjs/platform-express': null, '@nestjs/typeorm': null, '@supabase/supabase-js': null,
    'class-transformer': null, 'class-validator': null, graphql: null, jose: null, pg: null,
    'reflect-metadata': null, rxjs: null, tslib: null, typeorm: null,
  },
  devDependencies: {
    turbo: null, '@nestjs/testing': null, '@starci/eslint-canon-be': null, '@starci/eslint-canon-fe': null, '@starci/cli': null,
    '@starci/jest-preset': null, '@starci/prettier-config': null, '@starci/stylelint-canon': null, '@starci/tsconfig': null, '@tailwindcss/postcss': null,
    '@types/express': null, '@types/jest': null, '@types/node': null, '@types/react': null, '@types/react-dom': null,
    eslint: null, 'eslint-plugin-react-hooks': null, husky: null, jest: null, 'postcss-value-parser': null, prettier: null,
    stylelint: null, supabase: null, tailwindcss: null, 'ts-jest': null, 'ts-node-dev': null, 'tsc-alias': null,
    'tsconfig-paths': null, typescript: null,
  },
});

/**
 * The runtime dependencies of every fe app workspace of the starter beyond the fe stack's core packages (fe-stack.yaml, added by
 * feAppManifest for a product app): the two workspace packages at "*", the grammar and its required peers (@heroui/react,
 * @xyflow/react: the grammar contract), next with next-intl, react and react-dom (next's peer). `@<project>/<pkg>` names are
 * filled with the project. The marketing landing takes exactly these.
 */
const FE_APP_DEPENDENCIES = Object.freeze({
  '@<project>/i18n': '*', '@<project>/ui': '*',
  '@heroui/react': null, '@heroui/styles': null, '@starci/grammar': null, '@xyflow/react': null, next: null, 'next-intl': null, react: null, 'react-dom': null,
});

/**
 * The lite fe workspace: the same base without the shared packages, plus its infra adapter (owner ruling 2026-10-13: Supabase on
 * the front end is the Auth client of modules/auth only) and server-only for its own next-intl request config.
 */
const LITE_FE_APP_DEPENDENCIES = Object.freeze({
  '@heroicons/react': null, '@heroui/react': null, '@heroui/styles': null, '@starci/grammar': null, '@starci/heroicons': null, '@xyflow/react': null,
  '@supabase/supabase-js': null, next: null, 'next-intl': null, react: null, 'react-dom': null, 'server-only': null,
});

/**
 * The shared fe workspace packages of the starter, fe/packages/<project>-<name> named @<project>/<name>: each one's exported
 * subpaths (built to dist) and the runtime dependencies its own source imports. ui holds the drawings both apps mount; i18n the
 * next-intl stack (the entry, a server module: createAppI18n; ./proxy, the locale negotiation the apps' proxy.ts re-exports;
 * ./routing, client-safe: the default locale a client boundary reads).
 */
const FE_PACKAGES = Object.freeze({
  ui: { exports: ['.'], dependencies: { '@heroui/react': null, '@starci/grammar': null, '@starci/heroicons': null, '@xyflow/react': null, 'next-intl': null, react: null } },
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

/** Opting into a server PKCE callback also selects Supabase Auth and declares its route slot. */
function enableAuthCallback(declaration) {
  requireAuthCallbackConnection(declaration);
  declaration.sides.fe.optionalSlots = [...(declaration.sides.fe.optionalSlots ?? []), 'fe.route.callback'];
  declaration.supabase ??= structuredClone(LITE_STARTER_SUPABASE);
  declaration.supabase.redirectUrls = ['http://127.0.0.1:3000/auth/callback'];
}

/** Callback-specific source files are excluded from the browser-only starter. */
const CALLBACK_SOURCE_FILES = Object.freeze(new Set([
  'src/app/auth/callback/route.ts', 'src/modules/auth/server.ts', 'src/modules/auth/pkce-client.ts',
]));
export const hasAuthCallback = repo => (repo.sides.fe.optionalSlots ?? []).includes('fe.route.callback');

function requireAuthCallbackConnection(repo) {
  if (!(repo.sides.be?.connections ?? []).some(entry => entry.provider === 'supabase'))
    throw new ScaffoldError('HFS_ADD_CONNECTION_REQUIRED', 'the auth callback requires an existing Supabase connection; the full starter has none');
}

/** Apply the callback's cookie-backed auth owner and its config readers to product apps only. */
export function callbackSourceFiles(files, repo) {
  const enabled = hasAuthCallback(repo);
  if (enabled) requireAuthCallbackConnection(repo);
  const selected = files.filter(file => {
    const [, , app, ...parts] = file.path.split('/');
    const relative = parts.join('/');
    if (relative === 'src/modules/auth/pkce-client.ts') return false;
    return MARKETING_FE_APPS.has(app) || enabled || !CALLBACK_SOURCE_FILES.has(relative);
  });
  if (!enabled) return selected;
  const config = fs.readFileSync(path.join(TEMPLATES_DIR, 'fe/skeleton-lite/apps/web/src/modules/config/index.ts'), 'utf8');
  const client = render(fs.readFileSync(path.join(TEMPLATES_DIR, 'fe/skeleton/apps/__app__/src/modules/auth/pkce-client.ts'), 'utf8').replace(/\r\n/g, '\n'), PARTIAL_VARIABLES);
  return selected.map(file => {
    const [, , app, ...parts] = file.path.split('/');
    if (MARKETING_FE_APPS.has(app)) return file;
    const relative = parts.join('/');
    if (relative === 'src/modules/config/index.ts') return { ...file, content: config };
    return relative === 'src/modules/auth/client.ts' ? { ...file, content: client } : file;
  });
}

/** A dependency section at the canon pins (a null range takes the pin, which must exist; every pinned name is null). */
function pinnedSection(entries, pins) {
  const pinned = (dependency, range) => {
    if (range !== null) return range;
    if (!pins[dependency]) throw new ScaffoldError('HFS_SCAFFOLD_PIN_MISSING', `${dependency} has no canon pin in knowledge/hfs/canon-pins.yaml`);
    return pins[dependency].version;
  };
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)).map(([dependency, range]) => [dependency, pinned(dependency, range)]));
}

/**
 * The runtime peers (R111, knowledge/hfs/peer-integrations.yaml) a root package.json needs and does not declare in its
 * dependencies: the `requires` of every pair whose `when` packages it declares (at the named major, read from the declared
 * exact pin), each at its canon pin. Both editions alike: @nestjs/apollo on @nestjs/platform-express 11 needs
 * @as-integrations/express5.
 */
export function peerDependencies(pkg, pins, pairs = parseYaml(fs.readFileSync(PEERS_FILE, 'utf8')).pairs) {
  const runtime = pkg.dependencies ?? {};
  const declared = { ...pkg.devDependencies, ...runtime };
  const major = version => Number(/^\D*(\d+)/.exec(String(version))?.[1]);
  const needed = pairs.filter(pair => typeof runtime[pair.requires] !== 'string'
    && pair.when.every(entry => typeof declared[entry.package] === 'string' && (entry.major === undefined || major(declared[entry.package]) === entry.major)));
  return pinnedSection(Object.fromEntries(needed.map(pair => [pair.requires, null])), pins);
}

/**
 * The fe-stack core packages one version of which the whole install resolves (npm `overrides`, at their canon pins): a
 * transitive dependency otherwise brings its own (zustand 4 under @xyflow/react, dayjs under typeorm, a hoisted newer zod
 * that breaks the zodResolver types), and @xyflow/react itself stays the grammar's one version.
 */
const ROOT_OVERRIDES = Object.freeze(['@xyflow/react', 'dayjs', 'zod', 'zustand']);

/**
 * The root package.json of a new app, the monorepo root: name, workspaces, npm, its edition's dependencies with their runtime
 * peers, the fe stack's root tools and the one-version overrides, at canon pins.
 */
function packageManifest(name, pins, edition, stack = coreFeStackPackages()) {
  const dependencies = edition === 'lite' ? LITE_STARTER_DEPENDENCIES : STARTER_DEPENDENCIES;
  const devDependencies = { ...dependencies.devDependencies, ...Object.fromEntries(stack.root.map(dependency => [dependency, null])) };
  const pkg = { name, version: '0.0.0', private: true, packageManager: PACKAGE_MANAGER, workspaces: [...WORKSPACES], dependencies: pinnedSection(dependencies.dependencies, pins), devDependencies: pinnedSection(devDependencies, pins) };
  pkg.dependencies = pinnedSection({ ...pkg.dependencies, ...peerDependencies(pkg, pins) }, pins);
  pkg.overrides = pinnedSection(Object.fromEntries(ROOT_OVERRIDES.map(dependency => [dependency, null])), pins);
  return pkg;
}

/** A dependency section of an fe workspace with `@<project>/` names filled and the canon pins taken. */
const workspaceSection = (entries, project, pins) => pinnedSection(Object.fromEntries(Object.entries(entries).map(([name, range]) => [name.replace('@<project>/', `@${project}/`), range])), pins);

/**
 * The package.json of the fe app workspace `app` of the app `project`: @<project>/<app>, private, the workspace scripts, its own
 * dependencies. A product app (`core`, it carries the shared app core) also takes every core runtime package of the fe stack.
 */
function feAppManifest(project, app, pins, edition, { core = true, authCallback = false, stack = coreFeStackPackages() } = {}) {
  const base = edition === 'lite' ? LITE_FE_APP_DEPENDENCIES : FE_APP_DEPENDENCIES;
  const dependencies = { ...base, ...(core ? Object.fromEntries(stack.app.filter(name => !Object.hasOwn(base, name)).map(name => [name, null])) : {}) };
  if (core && authCallback) Object.assign(dependencies, { '@supabase/ssr': null, '@supabase/supabase-js': null, 'server-only': null });
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
  return source.replace(new RegExp(String.raw`\{\{(${SKELETON_VARIABLES.join('|')})\}\}`, 'g'), (_, key) => {
    if (!Object.hasOwn(vars, key)) throw new ScaffoldError('HFS_SCAFFOLD_TEMPLATE_VARIABLE', `${file} names {{${key}}}, which has no value outside a __app__ folder`);
    return vars[key];
  });
}

/** Let sync's renderer expand partials first while leaving every source placeholder for `fill` to validate or preserve. */
export const PARTIAL_VARIABLES = new Proxy(Object.create(null), {
  get: (_target, key) => `{{${String(key)}}}`,
  getOwnPropertyDescriptor: (_target, key) => ({ configurable: true, value: `{{${String(key)}}}` }),
});

/** The be skeleton folder of the one cli app (slot be.app.cli: always named `cli`), written only when hfs.json declares it. */
const CLI_APP_DIR = 'apps/cli/';
const declaresCliApp = app => app.sides.be.apps.some(entry => entry.kind === 'cli' && entry.name === 'cli');

const LITE_APP_REUSED = new Set(['.editorconfig', '.gitattributes', '.nvmrc']);
const LITE_DEFERRED_GENERATOR_FILES = new Set([
  'src/modules/platform/database/database.sql.ts',
  'src/modules/platform/database/migration-runner.service.ts',
  'src/modules/platform/database/seed-runner.service.ts',
]);
const liteBaseSource = (rel) => !rel.startsWith('apps/cli/')
    && !rel.startsWith('src/features/cli/')
    && !rel.startsWith('src/modules/domain/note/')
    && rel !== 'src/modules/platform/database/connection-source.client.ts'
    && rel !== 'src/modules/platform/database/migrate-connections.client.ts'
    && rel !== 'src/modules/platform/database/seed-connections.client.ts'
    && rel !== 'src/modules/platform/primitives/sequence.policy.ts'
    && !LITE_DEFERRED_GENERATOR_FILES.has(rel)
    && !rel.startsWith('src/tests/');
/** The be files the lite overlay replaces: a base unit spec of such a file tests the full variant, so lite carries its own. */
const liteOverlaid = (() => {
  let set = null;
  return () => (set ??= new Set(listFiles(path.join(TEMPLATES_DIR, 'be', 'skeleton-lite'))));
})();
/**
 * A base be file lite reuses: a source file of the shared shape, and the unit spec beside a reused source file that the lite overlay
 * does not replace (ruling:R212/case-1, amended by ruling:R212/case-4: a lite back end keeps full's unit specs).
 */
const liteBaseFile = (scope, rel) => {
  if (scope === 'app') return LITE_APP_REUSED.has(rel);
  // The shared fe app core (apps/__app__/) is one tree for both editions; the lite overlay replaces only modules/auth/client.ts.
  if (scope === 'fe') return rel.startsWith(`apps/${APP_DIR}/`);
  if (!rel.endsWith('.spec.ts')) return liteBaseSource(rel);
  const subject = rel.replace(/\.spec\.ts$/, '.ts');
  return liteBaseSource(subject) && !liteOverlaid().has(subject);
};
const liteOverlayFile = (scope, rel) => scope !== 'be' || !LITE_DEFERRED_GENERATOR_FILES.has(rel);

function skeletonOutputPath(relative, { scope, app, vars }) {
  const prefix = scope === 'app' ? '' : `${scope}/`;
  const output = relative.split(PROJECT_DIR).join(app.project).split(TIMESTAMP).join(vars.timestamp);
  return `${prefix}${output}`;
}

function fixedSkeletonFiles(context, relative, source) {
  const { scope, directory, app, vars, apps } = context;
  if (scope === 'be' && relative === 'src/tests/fixtures/builders/cli.builder.ts' && !declaresCliApp(app)) return [];
  if (scope === 'be' && relative.startsWith(CLI_APP_DIR) && !declaresCliApp(app)) return [];
  const fixedApp = apps.find(entry => relative.startsWith(`apps/${entry.name}/`));
  if (scope === 'fe' && relative.startsWith('apps/') && !fixedApp) return [];
  const appVars = fixedApp ? { app: fixedApp.name, appPascal: pascal(fixedApp.name) } : {};
  return [{
    path: skeletonOutputPath(relative, context),
    content: fill(source, { project: app.project, ...vars, ...appVars }, `${directory}/${relative}`),
  }];
}

function variableSkeletonFiles(context, relative, source) {
  const { scope, directory, app, vars, apps } = context;
  const leaves = `apps/${APP_DIR}/src/components/leaves/`;
  if (scope === 'fe' && app.edition === 'full' && relative.startsWith(leaves)) {
    return fixedSkeletonFiles(context, relative.replace(leaves, `packages/${PROJECT_DIR}-ui/src/leaves/`), source);
  }
  const selectedApps = scope === 'fe' ? coreFeApps(apps) : apps;
  return selectedApps.map(entry => ({
    path: skeletonOutputPath(relative.split(APP_DIR).join(entry.name), context),
    content: fill(source, { project: app.project, ...vars, app: entry.name, appPascal: pascal(entry.name) }, `${directory}/${relative}`),
  }));
}

/** One skeleton directory rendered to app-relative files; `include` filters source-relative paths before variables are expanded. */
function skeletonDirectory(scope, directory, app, vars, include = () => true) {
  const dir = path.join(TEMPLATES_DIR, scope, directory);
  if (!fs.existsSync(dir)) throw new ScaffoldError('HFS_SCAFFOLD_SKELETON_MISSING', `no skeleton templates in templates/${scope}/${directory}`);
  const apps = scope === 'app' ? [] : app.sides[scope].apps.filter(entry => scope === 'fe' || entry.kind === 'api');
  const context = { scope, directory, app, vars, apps };
  const files = [];
  for (const rel of listFiles(dir).filter(relative => include(relative))) {
    let source = render(fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n'), PARTIAL_VARIABLES);
    if (scope === 'fe' && app.edition === 'full') source = source.replaceAll('"@/components/leaves/Icon"', `"@${app.project}/ui"`);
    const rendered = rel.includes(APP_DIR) ? variableSkeletonFiles(context, rel, source) : fixedSkeletonFiles(context, rel, source);
    files.push(...rendered);
  }
  return files;
}

/** The canonical full Work workspace, catalog and feature nodes an edition upgrade may need. */
export function scaffoldWorkSeeds(project) {
  return skeletonDirectory('app', 'skeleton', { project }, {},
    rel => rel === '.starciwork/workspace.yaml' || rel === '.starciwork/index.yaml' || rel.startsWith('.starciwork/features/'));
}

/**
 * The skeleton files of one scope (app root, be, fe): [{ path, content }], app-relative; a `__app__` file once per api app of the
 * be side (once per product app of the fe side, coreFeApps), the be `apps/cli/` folder once when the cli app is declared, an fe `apps/<name>/` folder
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
  return scope === 'fe' ? [...new Map(callbackSourceFiles(unique, app).map(file => [file.path, file])).values()] : unique;
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

/** Generate the lite database types and translate generation errors into the scaffold failure contract. */
function emitScaffoldDatabaseTypes(root, name, writes, emitTypes) {
  try {
    const text = emitTypes({ root });
    if (typeof text !== 'string' || !text.trim()) throw new Error('the Supabase CLI returned no database types');
    writes.write(dbTypesPath, text);
  } catch (error) {
    throw new ScaffoldError('HFS_SCAFFOLD_TYPES_FAILED', `Supabase database types could not be generated for ${root} (${String(error?.message ?? error)}). Start the local Supabase stack and run starci app scaffold ${name} --edition lite again`);
  }
}

/**
 * `starci app scaffold <name>`: writes the new app under `into`, resolves its lockfile with npm (`lock`, npmLock), and returns
 * `{ root, files }` (app-relative paths, sorted). `presets` is what sync loads from the installed @starci/jest-preset (the Sonar
 * exclusions); the CLI passes the one it resolves. Failure removes only scaffold-owned entries, retaining an existing .git.
 */
/** Seal declared starter members to a fresh app recipient through the scaffold rollback owner. */
function initializeScaffoldSecrets(root, writes) {
  if (!declaredSealedMembers(root).length) return [];
  const write = (file, content) => writes.write(path.relative(root, file), content);
  const initialized = initializeAppIdentity(root, { write });
  const materialized = materializeDeclaredPlaceholders(root, { recipient: initialized.recipient, write });
  return [...initialized.files, ...materialized.members];
}

export function scaffoldApp({ name, into, presets, edition = 'full', authCallback = false, manifest = loadSlotManifest(), pins = bundledPins(), lock = npmLock, emitTypes = generateDbTypes, now = () => new Date() }) {
  if (!NAME.test(String(name))) throw new ScaffoldError('HFS_SCAFFOLD_NAME_INVALID', `the app name ${name} must be kebab-case (a project name: ${NAME})`);
  const root = path.resolve(into, name);
  const original = fs.lstatSync(root, { throwIfNoEntry: false });
  if (original && !emptyUnbornGit(root, original)) throw new ScaffoldError('HFS_SCAFFOLD_EXISTS', `${root} already exists; only a plain directory containing solely .git with unborn main and an empty index can be scaffolded`);
  if (typeof authCallback !== 'boolean') throw new ScaffoldError('HFS_SCAFFOLD_NAME_INVALID', 'authCallback must be a boolean');
  const declaration = starterDeclaration(name, manifest, edition);
  if (authCallback) enableAuthCallback(declaration);
  const app = resolveRepoDeclaration(manifest, declaration);
  const pkg = packageManifest(name, pins, app.edition);
  const timestamp = now().toISOString().replace(/\D/g, '').slice(0, 14);
  const files = [
    { path: 'hfs.json', content: jsonText(declaration) },
    { path: 'package.json', content: packageJsonText(pkg) },
    { path: 'be/nest-cli.json', content: jsonText(nestCli(app)) },
    ...app.sides.fe.apps.map(entry => ({ path: `fe/apps/${entry.name}/tsconfig.json`, content: jsonText(nextAppTsconfig()) })),
    ...app.sides.fe.apps.map(entry => ({
      path: `fe/apps/${entry.name}/src/modules/types/ambient/styles.d.ts`,
      content: '/** Declares stylesheets loaded by the Next bundler; non-CSS side-effect imports remain checked. */\ndeclare module "*.css" {}\n',
    })),
    ...app.sides.fe.apps.map(entry => ({ path: `fe/apps/${entry.name}/package.json`, content: packageJsonText(feAppManifest(name, entry.name, pins, app.edition, { core: coreFeApps([entry]).length === 1, authCallback })) })),
    ...imageFiles(app),
    ...(app.edition === 'lite' ? [] : Object.keys(FE_PACKAGES).flatMap(pkg => [
      { path: `fe/packages/${name}-${pkg}/package.json`, content: packageJsonText(fePackageManifest(name, pkg, pins)) },
      { path: `fe/packages/${name}-${pkg}/tsconfig.json`, content: jsonText(fePackageTsconfig()) },
      { path: `fe/packages/${name}-${pkg}/tsconfig.build.json`, content: jsonText(fePackageBuildTsconfig()) },
    ])),
    ...['app', 'be', 'fe'].flatMap(scope => skeletonOf(scope, app, { sonarGate: sonarGateName(parseYaml(fs.readFileSync(SONAR_GATE_FILE, 'utf8')), app.edition), timestamp, ...supabasePortVars(name) })),
  ];
  const writes = scaffoldWrites(root, original);
  try {
    for (const file of files) writes.write(file.path, file.content);
    const targets = renderTargets(declaration, presets, { manifest, source: appSource(root) });
    for (const target of targets) writes.claim(target.path);
    writeTargets(root, targets);
    if (app.edition === 'lite') emitScaffoldDatabaseTypes(root, name, writes, emitTypes);
    const secretFiles = initializeScaffoldSecrets(root, writes);
    let locked;
    try { locked = lock(root); } finally { writes.lockfile(); }
    if (!locked.ok) throw new ScaffoldError('HFS_SCAFFOLD_LOCK_FAILED', `\`${LOCK_STEP}\` could not resolve the lockfile of ${root} (${locked.detail}). Check the network and the npm registry, then run starci app scaffold ${name} again`);
    return { root, files: [...new Set([...files.map(file => file.path), ...targets.map(target => target.path), ...secretFiles, ...(app.edition === 'lite' ? [dbTypesPath] : []), 'package-lock.json'])].sort(byCodeUnit) };
  } catch (error) {
    const held = writes.rollback();
    if (held.length) error.message += `; cleanup retained replaced or occupied entries: ${held.join(', ')}`;
    throw error;
  }
}
