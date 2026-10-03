// scripts/lib/package-at.mjs — a package the runtime does not ship (playwright, esbuild, tailwindcss) comes from the
// project that owns it: node resolution from that project's directory, walking up its node_modules.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { skillRoot } from '../../engine/runtime-root.mjs';

/** The package.json of `name` as resolved from `dir`, or null. */
export const packageAt = (dir, name) => {
  try { return createRequire(path.join(dir, 'package.json')).resolve(`${name}/package.json`); } catch { return null; }
};

/** This runtime's own `starci` bin (packages/cli is the only package that declares one). */
const RUNTIME_STARCI_BIN = path.join(skillRoot, 'packages', 'cli', 'bin', 'starci.mjs');

/** The `starci` bin of the @starci/cli that `dir` installs (a product runs its own pinned CLI), else this runtime's own. */
export function starciBin(dir) {
  const packageFile = packageAt(dir, '@starci/cli');
  if (packageFile) {
    try {
      const { bin } = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      const rel = typeof bin === 'string' ? bin : bin?.starci;
      const file = rel ? path.join(path.dirname(packageFile), rel) : null;
      if (file && fs.existsSync(file)) return file;
    } catch { /* an unreadable install falls back to the runtime's own CLI */ }
  }
  return RUNTIME_STARCI_BIN;
}

/** The first of `names` resolvable from the first of `dirs` that has one: {name, root, packageFile, version} or null. */
export function findPackage(dirs, names) {
  for (const dir of dirs.filter(Boolean)) {
    for (const name of names) {
      const packageFile = packageAt(dir, name);
      if (!packageFile) continue;
      const require = createRequire(packageFile);
      return { name, root: path.dirname(packageFile), packageFile, version: require(packageFile).version };
    }
  }
  return null;
}

/** The CommonJS entry of a package found by findPackage. */
export const requirePackage = (found) => createRequire(found.packageFile)(found.name);

/** The TypeScript compiler resolvable from the first of `dirs` (an app root, then the caller's own), or null. */
export const loadTypescript = (...dirs) => {
  const located = findPackage(dirs, ['typescript']);
  return located ? requirePackage(located) : null;
};

/**
 * The app's command line and the app implementation behind it: `bin` the `starci` bin of the app's installed @starci/cli, else
 * this runtime's packages/cli/bin/starci.mjs (starciBin); `dir` the @starci/hfs that answers
 * `starci app` - the app's own install, else the one beside its @starci/cli, else this runtime's packages/hfs - whose runtime
 * slice the gate's base lint (scripts/gates/gate.mjs) and the READ digest (scripts/gates/read-digest.mjs) load in-process.
 */
export function hfsEntry(root) {
  const cli = packageAt(root, '@starci/cli');
  const manifest = packageAt(root, '@starci/hfs') ?? (cli && packageAt(path.dirname(cli), '@starci/hfs'));
  return { dir: manifest ? path.dirname(manifest) : path.join(skillRoot, 'packages', 'hfs'), bin: starciBin(root) };
}
