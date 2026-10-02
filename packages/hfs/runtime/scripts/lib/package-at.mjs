// scripts/lib/package-at.mjs — a package the runtime does not ship (playwright, esbuild, tailwindcss) comes from the
// project that owns it: node resolution from that project's directory, walking up its node_modules.
import path from 'node:path';
import { createRequire } from 'node:module';

/** The package.json of `name` as resolved from `dir`, or null. */
export const packageAt = (dir, name) => {
  try { return createRequire(path.join(dir, 'package.json')).resolve(`${name}/package.json`); } catch { return null; }
};

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
