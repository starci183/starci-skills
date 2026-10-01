// hfs scaffold app <name> - the first tree of a new app, the one shape every StarCi product has:
//
//   <name>/            hfs.json (kind app), package.json (every dependency of both sides at its canon pin, the managed scripts),
//                      package-lock.json, README.md, the managed root files (CI, husky, .gitignore block, Sonar, prettier) and
//                      .starciwork; scripts/codegen.mjs, the app's own step of `npm run codegen`
//   <name>/be/         the back-end side: the managed tool configuration and the templates/be/skeleton tree (the api app's
//                      entrypoint, platform config/logging/errors/clock/cqrs, the liveness capability and the health feature)
//   <name>/fe/         the front-end side: the managed tool configuration and the templates/fe/skeleton tree (the next-intl
//                      [locale] shell with vi default, as-needed prefix and proxy.ts; each route slot mounts one pages feature
//                      drawn with @starci/grammar)
//
// The skeleton files are written once from templates/<app|be|fe>/skeleton ({{project}}, {{app}} and {{appPascal}} filled, a
// `__app__` folder named after the side's app); the managed files are the render of `hfs sync` (sync/index.mjs), so a fresh app
// is in sync by construction. The lockfile is never written by hand: once the files are written, npm resolves the real one
// (`npm install --package-lock-only`, no node_modules, no scripts), so `npm ci` installs the new app as it is. When npm cannot
// resolve it the scaffold fails (HFS_SCAFFOLD_LOCK_FAILED), names the step and removes the app it began, so no app without a lock
// and no stub lock is ever left. An existing directory is refused, never merged into.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadSlotManifest, resolveRepoDeclaration } from '../runtime/scripts/lib/hfs-slots.mjs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { TEMPLATES_DIR, renderTargets, writeTargets } from '../sync/index.mjs';
import { ScaffoldError } from './service.mjs';

const NAME = /^[a-z][a-z0-9-]*$/;
const APP_DIR = '__app__';
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

/** The apps a new app starts with: one api app on the be side, one Next app on the fe side, which reads the be contracts for its codegen. */
export const STARTER_SIDES = Object.freeze({
  be: Object.freeze({ apps: [{ name: 'api', kind: 'api' }] }),
  fe: Object.freeze({ apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] }),
});

/**
 * The dependencies of the starter: what the skeleton imports and the tools the managed scripts and configs run. A name with a
 * canon pin (knowledge/hfs/canon-pins.yaml) takes the pin; the others take the range the reference apps (examples/todo-app)
 * declare.
 */
const STARTER_DEPENDENCIES = Object.freeze({
  dependencies: {
    '@heroui/react': null, '@heroui/styles': null, '@nestjs/common': null, '@nestjs/core': null, '@nestjs/cqrs': '^11.0.3',
    '@nestjs/platform-express': null, '@starci/grammar': null, next: null, 'next-intl': null, react: null, 'react-dom': null,
    'reflect-metadata': '^0.2.2', rxjs: '^7.8.1', 'server-only': '^0.0.1', tslib: '^2.8.1',
  },
  devDependencies: {
    '@nestjs/testing': null, '@starci/eslint-canon-be': null, '@starci/eslint-canon-fe': null, '@starci/hfs': null, '@starci/jest-preset': null,
    '@starci/prettier-config': null, '@starci/stylelint-canon': null, '@starci/test-world': null, '@starci/tsconfig': null, '@tailwindcss/postcss': '^4', '@types/express': '^4.17.21',
    '@types/jest': null, '@types/node': null, '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', eslint: null, 'eslint-plugin-react-hooks': null,
    husky: '^9.1.7', jest: null, 'postcss-value-parser': null, prettier: null, stylelint: null, tailwindcss: '^4', 'ts-jest': null,
    'ts-node-dev': '^2.0.0', 'tsc-alias': '^1.8.10', 'tsconfig-paths': '^4.2.0', typescript: null,
  },
});

/** The app hfs.json of a new app called `name`. */
export const starterDeclaration = (name, manifest = loadSlotManifest()) => ({ hfs: manifest.major, kind: 'app', project: name, sides: structuredClone(STARTER_SIDES) });

/** The root package.json of a new app: name, the dependencies at their pins; the managed scripts are sync's. */
function packageManifest(name, pins) {
  const pinned = (dependency, range) => {
    if (range !== null) return range;
    if (!pins[dependency]) throw new ScaffoldError('HFS_SCAFFOLD_PIN_MISSING', `${dependency} has no canon pin in knowledge/hfs/canon-pins.yaml`);
    return pins[dependency].version;
  };
  const section = entries => Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)).map(([dependency, range]) => [dependency, pinned(dependency, range)]));
  return { name, version: '0.0.0', private: true, dependencies: section(STARTER_DEPENDENCIES.dependencies), devDependencies: section(STARTER_DEPENDENCIES.devDependencies) };
}

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

/** The skeleton files of one scope (app root, be, fe): [{ path, content }], app-relative; a `__app__` file once per app of the side. */
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
      files.push({ path: `${prefix}${rel}`, content: fill(source, once, rel) });
      continue;
    }
    for (const entry of apps) files.push({ path: `${prefix}${rel.split(APP_DIR).join(entry.name)}`, content: fill(source, { ...once, app: entry.name, appPascal: pascal(entry.name) }, rel) });
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
