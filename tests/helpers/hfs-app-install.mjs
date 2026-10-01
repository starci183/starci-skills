// _hfs-app-install.mjs - an app's node_modules for a spec that lints it, without installing anything: every package an existing
// install holds is linked into <app>/node_modules (a junction per package, the first install that has it wins), and the runtime's
// own @starci packages are copied there (a copy, not a link, so each resolves its own dependencies from the app, exactly as the
// installed package would). tests/repo/canon-packed-load.spec.mjs links the same way. `uninstall` removes every link before the tree,
// so no delete ever walks through a junction into the install it points at.
import fs from 'node:fs';
import path from 'node:path';

export const RUNTIME = path.resolve(import.meta.dirname, '..', '..');

/**
 * The installs a spec may borrow packages from: first the node_modules folders STARCI_APP_INSTALLS lists (path-delimiter separated:
 * a product app's install, one coherent set of versions where the runtime holds no copy of a framework the skeleton imports), then
 * the runtime's own, the packages', every example's. The first install that holds a package wins. A spec that finds a package in
 * none of them skips and names it.
 */
export function runtimeInstalls() {
  const examples = path.join(RUNTIME, 'examples');
  const nested = fs.existsSync(examples) ? fs.readdirSync(examples, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(examples, entry.name, 'node_modules')) : [];
  const extra = (process.env.STARCI_APP_INSTALLS ?? '').split(path.delimiter).filter(Boolean).map((dir) => path.resolve(dir));
  const own = [path.join(RUNTIME, 'node_modules'), path.join(RUNTIME, 'packages', 'node_modules'), ...nested].filter((dir) => fs.existsSync(dir));
  // The first install that holds a package wins, so the install that holds the most of what a scaffold imports goes first: a framework
  // package is then linked from the one install that also holds its adapters (@nestjs/core resolves @nestjs/platform-express from its own
  // folder, never from the app), not from the runtime's partial copy.
  const held = (dir) => LINT_DEPENDENCIES.filter((name) => has(dir, name)).length;
  return [...extra.filter((dir) => fs.existsSync(dir)), ...own.sort((a, b) => held(b) - held(a))];
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
  '@nestjs/common', '@nestjs/core', '@nestjs/cqrs', '@nestjs/testing', '@types/express', '@types/jest', '@types/node',
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

/**
 * Links the packages of `installs` and copies the runtime's @starci packages into `<app>/node_modules`. Returns the links made, for
 * `uninstall`.
 */
export function installInto(app, installs) {
  const modules = path.join(app, 'node_modules');
  const links = [];
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
