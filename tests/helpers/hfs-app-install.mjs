// _hfs-app-install.mjs - an app's node_modules for a spec that lints it, without installing anything: every package an existing
// install holds is linked into <app>/node_modules (a junction per package, the first install that has it wins), and the runtime's
// own @starci packages are copied there (a copy, not a link, so each resolves its own dependencies from the app, exactly as the
// installed package would). tests/repo/canon-packed-load.spec.mjs links the same way. `uninstall` removes every link before the tree,
// so no delete ever walks through a junction into the install it points at.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export const RUNTIME = path.resolve(import.meta.dirname, '..', '..');

/** Is `dir` inside `root` (a strict descendant)? */
const isUnder = (root, dir) => { const rel = path.relative(root, dir); return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel); };

/**
 * The installs a spec may borrow packages from: first the node_modules folders STARCI_APP_INSTALLS lists (path-delimiter separated:
 * a product app's install, one coherent set of versions where the runtime holds no copy of a framework the skeleton imports), then
 * the runtime's own, the packages', every example's. Automatic candidates prefer physical resolution of the spec's required peers,
 * then the number of required packages held. Explicit entries retain their order. A spec that finds a package in none skips and names it.
 * `root` and `env` let the helper's behavior be proved with small isolated package layouts.
 */
export function runtimeInstalls({ root = RUNTIME, env = process.env, required = LINT_DEPENDENCIES } = {}) {
  const examples = path.join(root, 'examples');
  const nested = fs.existsSync(examples) ? fs.readdirSync(examples, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(examples, entry.name, 'node_modules')) : [];
  const extra = (env.STARCI_APP_INSTALLS ?? '').split(path.delimiter).filter(Boolean).map((dir) => path.resolve(dir));
  const outside = extra.filter((dir) => !isUnder(root, dir));
  if (outside.length) {
    throw new Error(`STARCI_APP_INSTALLS must name installs under the checkout ${root}: ${outside.join(', ')} lies outside it. The scaffold build widens Turbopack's root to the checkout, and an install elsewhere panics the fe build `
      + '("Expected to inject all imports ... incrementalCacheHandler"): install the app under the checkout (`starci release app-installs` does) or leave the variable unset.');
  }
  const own = [path.join(root, 'node_modules'), path.join(root, 'packages', 'node_modules'), ...nested].filter((dir) => fs.existsSync(dir));
  // Frameworks resolve peers from their physical package directory, not from the fixture's adjacent package junctions. Optional
  // peers still matter when the scaffold explicitly requires them (Nest's validation pipe), while undeclared optional peers do not.
  const needed = new Set(required);
  const scores = new Map(own.map((dir) => {
    let held = 0;
    let unresolved = 0;
    for (const name of needed) {
      if (!has(dir, name)) continue;
      held += 1;
      const file = fs.realpathSync(path.join(dir, ...name.split('/'), 'package.json'));
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
      const require = createRequire(file);
      for (const peer of Object.keys(manifest.peerDependencies ?? {}).filter((peer) => needed.has(peer))) {
        try { require.resolve(peer); } catch { unresolved += 1; }
      }
    }
    return [dir, { held, unresolved }];
  }));
  return [...extra.filter((dir) => fs.existsSync(dir)), ...own.sort((a, b) => scores.get(a).unresolved - scores.get(b).unresolved || scores.get(b).held - scores.get(a).held)];
}

/** The @starci packages an app installs, from the runtime's own source: package name -> folder under packages/. */
export const STARCI_PACKAGES = Object.freeze({
  '@starci/eslint-canon-be': 'eslint/be',
  '@starci/eslint-canon-fe': 'eslint/fe',
  '@starci/jest-preset': 'jest-preset',
  '@starci/prettier-config': 'prettier-config',
  '@starci/stylelint-canon': 'stylelint',
  '@starci/tsconfig': 'tsconfig',
});

/** What the lint of a scaffolded app loads: the linters, the formatter, the compilers and the frameworks its skeleton imports. */
export const LINT_DEPENDENCIES = Object.freeze([
  'eslint', '@typescript-eslint/eslint-plugin', '@typescript-eslint/parser', 'eslint-plugin-react-hooks', 'globals', 'typescript',
  'prettier', 'stylelint', 'postcss-value-parser',
  '@nestjs/common', '@nestjs/core', '@nestjs/cqrs', '@nestjs/testing', '@nestjs/typeorm', 'typeorm', 'nest-commander', '@types/express', '@types/jest', '@types/node',
  'next', 'next-intl', 'react', 'react-dom', '@types/react', '@starci/grammar', '@heroui/react', '@heroui/styles',
  'tailwindcss', '@tailwindcss/postcss',
]);

const has = (dir, name) => fs.existsSync(path.join(dir, ...name.split('/'), 'package.json'));

/** The names of `needed` no install in `installs` holds. */
export const missingFrom = (installs, needed = LINT_DEPENDENCIES) => needed.filter((name) => !installs.some((dir) => has(dir, name)));

/** Every package name an install holds (scoped ones as @scope/name), .bin and dot entries left out. */
function packagesOf(install) {
  const names = [];
  for (const entry of fs.readdirSync(install, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      for (const scoped of fs.readdirSync(path.join(install, entry.name), { withFileTypes: true })) names.push(`${entry.name}/${scoped.name}`);
    } else names.push(entry.name);
  }
  return names;
}

/** The npm workspaces of the app (its root package.json `workspaces`, `<dir>/*` patterns): [{ name, dir }] of each folder with a package.json. */
function workspacesOf(app) {
  let patterns = [];
  try { patterns = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).workspaces ?? []; } catch { return []; }
  return patterns.flatMap((pattern) => {
    const base = path.join(app, ...pattern.replace(/\/\*$/, '').split('/'));
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'package.json')))
      .map((entry) => ({ name: JSON.parse(fs.readFileSync(path.join(base, entry.name, 'package.json'), 'utf8')).name, dir: path.join(base, entry.name) }));
  });
}

/**
 * Links the app's own workspaces by their package names (as npm install does: @<project>/ui is fe/packages/<project>-ui), links the
 * packages of `installs` and copies the runtime's @starci packages into `<app>/node_modules`. Returns the links made, for `uninstall`.
 */
export function installInto(app, installs) {
  const modules = path.join(app, 'node_modules');
  const links = [];
  for (const { name, dir } of workspacesOf(app)) {
    const link = path.join(modules, ...name.split('/'));
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(dir, link, 'junction');
    links.push(link);
  }
  for (const [name, folder] of Object.entries(STARCI_PACKAGES)) {
    const source = path.join(RUNTIME, 'packages', ...folder.split('/'));
    fs.cpSync(source, path.join(modules, ...name.split('/')), { recursive: true, filter: (file) => !/[\\/](node_modules|fixtures)([\\/]|$)|\.test\.mjs$/.test(path.relative(source, file)) });
  }
  for (const install of installs) {
    for (const name of packagesOf(install)) {
      const link = path.join(modules, ...name.split('/'));
      if (fs.existsSync(link) || !has(install, name)) continue;
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(path.join(install, ...name.split('/')), link, 'junction');
      links.push(link);
    }
  }
  return links;
}

/** Removes every link `installInto` made (the link, never what it points at), then the app. */
export function uninstall(app, links) {
  for (const link of links) if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(link);
  fs.rmSync(app, { recursive: true, force: true });
}
