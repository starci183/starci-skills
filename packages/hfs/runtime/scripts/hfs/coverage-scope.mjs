// coverage-scope.mjs - THE derivation of what a back end measures (R204 HFS_COVERAGE_SCOPE_DRIFT).
//
// One input: the slot manifest. Every tracked slot of the be profile declares `coverage: required | none`, and
// `ruleParams.be.logicRoles` names the roles that carry logic. A file `<name>.<role>.ts` of a logic role inside a required slot is
// measured at 100 per file; every other file of the back end is not. Three consumers read this module and nothing else:
//   - the jest preset: `jestCoverage` (roots x roles, and the none subtrees inside a root) becomes the per-file thresholds and
//     collectCoverageFrom of the rendered be/jest.config.js;
//   - Sonar: `sonarCoverageExclusions` are the complement (SonarQube has no inclusions and no negation), rendered into
//     sonar.coverage.exclusions;
//   - Codecov: `codecovPaths` are the measured roots, and `coverageComponents` one component per service app plus platform,
//     each 100% and red below it, rendered into codecov.yml.
// hfs sync renders the three for an app, scripts/checks/check-examples-ci.mjs for the example apps of the runtime repository,
// and `hfs check` compares the files with this derivation. Nothing here lists a path of a product: it all comes from slots.yaml.
import { braceVariants, globExpression } from '../lib/glob.mjs';
import { logicRolesOf } from './manifest-shape.mjs';

/** The component that holds the shared infrastructure: the platform tier and every capability more than one service app composes. */
export const PLATFORM_COMPONENT = 'platform';
const SERVICE_APP_KINDS = new Set(['api', 'worker']);
const star = (text) => String(text).replace(/<[^>]+>/g, '*');
const segments = (dir) => dir.replace(/\/+$/, '').split('/').filter(Boolean);
const isDir = (path) => path.endsWith('/');

/** True when directory pattern `inner` lies inside `outer` (an outer `*` segment matches any one inner segment) or is the same. */
function nested(inner, outer) {
  const a = segments(inner);
  const b = segments(outer);
  return a.length >= b.length && b.every((segment, index) => segment === '*' ? true : segment === a[index]);
}

/** The directory patterns (be-relative, placeholders as `*`, trailing slash) of a slot's path variants; a file pattern keeps its name. */
const variantsOf = (slot) => braceVariants(slot.path).map(star);

/**
 * The tracked slots of the be profile, in manifest order. A slot gated by a connection provider (be.integrations.supabase) holds files only in an
 * app whose connection declares that provider (`providers`), so it takes no part in the scope of any other app.
 */
const beSlots = (manifest, providers) => manifest.slots.filter((slot) => slot.profiles.includes('be') && slot.tracked === 'tracked' && (slot.provider === undefined || providers.includes(slot.provider)));

/** The directory a path pattern lives in (itself when it is one). */
const dirOf = (path) => (isDir(path) ? path : path.slice(0, path.lastIndexOf('/') + 1));

/** The unique directory patterns not nested inside another one. */
const minimal = (patterns) => {
  const unique = [...new Set(patterns)];
  return unique.filter((pattern) => !unique.some((other) => other !== pattern && nested(pattern, other)));
};

/**
 * The scope of an app's back end, derived from the manifest: { roles, roots, excludes, none, sonar, codecovPaths }.
 *   roles     ruleParams.be.logicRoles;
 *   roots     the minimal required directories (be-relative, `*` for a placeholder, trailing slash), sorted;
 *   excludes  the none directories inside a root (never measured though their root is);
 *   none      the minimal none paths of the whole back end (a directory ends in a slash), sorted;
 *   sonar     sonar.coverage.exclusions, repository-relative from the app root, sorted;
 *   codecovPaths  the measured roots as `be/<root>**`.
 */
export function coverageScope(manifest, providers = []) {
  const roles = [...logicRolesOf(manifest)];
  const slots = beSlots(manifest, providers);
  const required = slots.filter((slot) => slot.coverage === 'required');
  const none = slots.filter((slot) => slot.coverage === 'none');
  const requiredDirs = required.flatMap((slot) => variantsOf(slot).map((dir) => {
    if (!isDir(dir)) throw new Error(`slot ${slot.id} is coverage: required but its path ${slot.path} is not a directory`);
    return dir;
  }));
  const roots = minimal(requiredDirs).sort();
  const nonePaths = none.flatMap((slot) => variantsOf(slot));
  for (const dir of nonePaths.filter(isDir)) if (requiredDirs.some((other) => nested(other, dir))) throw new Error(`a coverage: none directory ${dir} contains a coverage: required slot`);
  const noneUnique = [...new Set(nonePaths)];
  const noneMinimal = noneUnique.filter((path) => !noneUnique.some((other) => other !== path && isDir(other) && nested(dirOf(path), other)));
  const excludes = noneMinimal.filter((path) => isDir(path) && roots.some((root) => nested(path, root))).sort();
  const suffixes = manifest.ruleParams.be.suffixes;
  const isRole = new RegExp(`\\.(?:${suffixes.map((s) => s.replace(/-/g, '\\-')).join('|')})\\.ts$`);
  const sonar = new Set(noneMinimal.map((path) => `be/${path}${isDir(path) ? '**' : ''}`));
  for (const role of suffixes.filter((suffix) => !roles.includes(suffix))) sonar.add(`be/**/*.${role}.ts`);
  for (const slot of required) {
    for (const entry of [...(slot.requires ?? []), ...(slot.allows ?? [])]) {
      if (!/\.ts$/.test(entry) || entry.includes('<role>')) continue;
      for (const name of braceVariants(entry)) {
        if (isRole.test(star(name).replace(/\*/g, 'x'))) continue;
        for (const dir of variantsOf(slot)) sonar.add(`be/${dir}${star(name)}`.replace(/\/\/+/g, '/'));
      }
    }
  }
  sonar.add('fe/**');
  return { roles, roots, excludes, none: noneMinimal.sort(), sonar: [...sonar].sort(), codecovPaths: roots.map((root) => `be/${root}**`) };
}

/** The glob a root measures: every file of a logic role below it (`src/modules/domain/*\/**\/*.{service,policy}.ts`). */
export const rootGlob = (root, roles) => `${root}**/*.${roles.length === 1 ? roles[0] : `{${roles.join(',')}}`}.ts`;

/** The jest coverage options of the rendered be/jest.config.js: { roots, roles, excludes }. */
export function jestCoverage(manifest, providers = []) {
  const { roots, roles, excludes } = coverageScope(manifest, providers);
  return { roots, roles, excludes: excludes.map((dir) => `${dir}**`) };
}

/** Sonar's sonar.coverage.exclusions of an app: the complement of the measured files, repository-relative from the app root. */
export const sonarCoverageExclusions = (manifest, providers = []) => coverageScope(manifest, providers).sonar;

/** The Codecov paths of an app: the measured roots, repository-relative from the app root. */
export const codecovPaths = (manifest, providers = []) => coverageScope(manifest, providers).codecovPaths;

/**
 * The capability a be-relative file belongs to inside a root, or null: the folder the root's last `*` stands for
 * (`src/modules/domain/*\/` and `src/modules/domain/order/order.service.ts` give `order`).
 */
function capabilityOf(root, file) {
  const parts = segments(root);
  const at = parts.length - 1;
  if (parts[at] !== '*') return null;
  const own = file.split('/');
  return parts.slice(0, at).every((part, index) => part === own[index]) && own.length > at + 1 ? own[at] : null;
}

/**
 * The Codecov components of an app, [{ id, name, paths }] (paths repository-relative from the app root): one per service app (api or worker)
 * that composes the capabilities nothing else composes, then `platform`. A capability of a root whose last segment is a placeholder
 * (`src/modules/domain/<capability>/`, projections, integrations) belongs to the one service app whose composition root
 * (`apps/<app>/`) imports `@modules/<tier>/<capability>`; when several import it, the service app named like the capability (the
 * `identity` service and the `identity` capability) owns it; one that nothing singles out belongs to platform, as does the whole platform tier. The measured roots of the tier `platform` are never split.
 *
 * @param {object} manifest the slot manifest
 * @param {{ files: string[], read: (file: string) => string, apps: Array<{name: string, kind: string}> }} source be-relative source files, a reader, the declared be apps
 */
export function coverageComponents(manifest, { files, read, apps, providers = [] }) {
  const { roots } = coverageScope(manifest, providers);
  const services = apps.filter((app) => SERVICE_APP_KINDS.has(app.kind));
  const imports = new Map(services.map((app) => [app.name, files.filter((file) => file.startsWith(`apps/${app.name}/`) && /\.[cm]?ts$/.test(file)).map((file) => read(file)).join('\n')]));
  const platformPaths = [];
  const ownedBy = new Map(services.map((app) => [app.name, []]));
  for (const root of roots) {
    const module = /^src\/modules\/(.+)\/\*\/$/.exec(root)?.[1] ?? null;
    const capabilities = [...new Set(files.map((file) => capabilityOf(root, file)).filter(Boolean))].sort();
    const base = root.slice(0, -2);
    if (module === null || module === 'platform' || !capabilities.length) {
      platformPaths.push(`be/${root}**`);
      continue;
    }
    for (const capability of capabilities) {
      const spec = new RegExp(`from\\s+["']@modules/${module.replace(/[/.]/g, '\\$&')}/${capability.replace(/[/.]/g, '\\$&')}["']`);
      const importers = services.filter((app) => spec.test(imports.get(app.name)));
      const owners = importers.length === 1 ? importers : importers.filter((app) => app.name === capability);
      if (owners.length === 1) ownedBy.get(owners[0].name).push(`be/${base}${capability}/**`);
      else platformPaths.push(`be/${base}${capability}/**`);
    }
  }
  return [
    ...services.filter((app) => ownedBy.get(app.name).length).map((app) => ({ id: app.name, name: app.name, paths: ownedBy.get(app.name).sort() })),
    ...(platformPaths.length ? [{ id: PLATFORM_COMPONENT, name: PLATFORM_COMPONENT, paths: platformPaths.sort() }] : []),
  ];
}

/** True when the be-relative `file` is measured: it is `<name>.<role>.ts` of a logic role below a measured root and inside no none directory of it. */
export function isMeasured(manifest, file) {
  const { roots, roles, excludes } = coverageScope(manifest);
  const role = /\.([a-z][a-z0-9-]*)\.ts$/.exec(file)?.[1];
  if (!role || !roles.includes(role)) return false;
  const inside = (dir) => globExpression(`${dir}**`).test(file);
  return roots.some(inside) && !excludes.some(inside);
}
