// example-refs.mjs — the ONE runtime source file that may spell a path into the runtime's own examples/
// tree or a product name the runtime legitimately knows (R206, NO_EXAMPLE_COUPLING): every other source
// file reaches these through the constants below, and scripts/checks/check-example-coupling.mjs exempts
// this file's name only - a declared read, never a path allowlist. A constant belongs here only when the
// runtime genuinely reads that tree or names that product at run time; a pointer that can be generic must
// be generic in the file that holds it.

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { validateAgainstSchema } from './json-schema.mjs';
import { insidePath, samePath, slash } from './path-key.mjs';

/** The runtime's example tree root. */
export const EXAMPLES_ROOT = 'examples';

/** Curated basic sample source; operational artifact writers remain external. */
export const EXAMPLE_RUNTIMES_ROOT = `${EXAMPLES_ROOT}/.runtimes`;

/** Every examples/<name>/hfs.json declaration of kind app, sorted by name. */
export function discoverExampleApps(root) {
  const directory = path.join(root, EXAMPLES_ROOT);
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return []; }
  return entries.filter((entry) => entry.isDirectory()).filter((entry) => {
    try { return JSON.parse(fs.readFileSync(path.join(directory, entry.name, 'hfs.json'), 'utf8'))?.kind === 'app'; }
    catch { return false; }
  }).map((entry) => entry.name).sort();
}

/** The generic services-block template a starcistacks follow-up leg is pointed at (S11-02: one template
 *  for every repository - the per-repository blocks it replaced are spec fixtures under
 *  tests/fixtures/starcistacks-services/, never a run-time read). */
export const STACK_DECLARATION_TEMPLATE = `${EXAMPLES_ROOT}/starcistacks-services/template.services.yaml`;

/** The reference app declaration scripts/hfs/derived-fields.mjs samples for per-field slot ownership. */
export const REFERENCE_APP_MANIFEST = `${EXAMPLES_ROOT}/ecommerce-app/hfs.json`;

/** The example app whose installed tree an fe-kit peer link points at by default. */
export const REFERENCE_EXAMPLE_APP = 'ecommerce-app';

/** The grammar css families a product repository may declare (`[data-grammar-family="<id>"]`); the
 *  runtime's own product maps to the core sheet. */
export const GRAMMAR_FAMILIES = Object.freeze({ starci: 'core', nivo: 'nivo' });

/** Display aliases of legacy workflow slugs that predate workflows.display_name (the progress report's
 *  English fallback; the i18n catalog carries the owner's wording for each value). */
export const WORKFLOW_ALIASES = Object.freeze({
  'nivo-app-auth': 'AUTH (sign-in)', 'nivo-workspace-provision': 'WSPV (buy & provision workspace)',
  'nivo-modules-agentos': 'Modules (AgentOS)', 'nivo-collab-group-chat': 'Collab (group chat)',
  'starci-next-work-and-stacks': 'StarCi Next – work & stacks', 'starci-next-base-repos': 'StarCi Next – base repos',
  'miamia-work-and-stacks': 'Mia Mia – work & stacks', 'miamia-base-repos': 'Mia Mia – base repos',
});

/** A feature-folder segment that is only the product's own name - no useful leaf (display-names pathLabel). */
export const PRODUCT_NAME_SEGMENT = /^(nivo|starci|mia)[-\w]*$/i;

/** The closed list of product names this runtime shipped against - the names R206
 *  (check-example-coupling.mjs) refuses anywhere in runtime source outside this file (a retired
 *  name is judged by RT_RETIRED_NAME_LIVE, R207, from modules/kernel/retired-paths.yaml). */
export const PRODUCT_NAMES = Object.freeze(['mia-mia', 'miamia', 'nivo', 'starci-academy', 'ecommerce-app', 'shape-slot']);

/** The catalog of stable pattern IDs pointing at actual executable example source. */
export const EXAMPLE_CATALOG_FILE = `${EXAMPLES_ROOT}/index.yaml`;

function referenceFile(root, relative, { directory = false, exact = false } = {}) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || path.isAbsolute(relative)
    || relative.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`invalid example input: ${relative}`);
  const file = path.resolve(root, relative);
  if (!insidePath(root, file)) throw new Error(`example input is outside its declared root: ${relative}`);
  const realRoot = fs.realpathSync.native(root), base = path.resolve(root);
  let at = base, expected = realRoot; // the root's own spelling (8.3 short name, symlinked prefix) is not a link inside the tree
  for (const segment of path.relative(base, file).split(path.sep).filter(Boolean)) {
    at = path.join(at, segment); expected = path.join(expected, segment);
    if (fs.lstatSync(at).isSymbolicLink() || !samePath(fs.realpathSync.native(at), expected)
      || (exact && !fs.readdirSync(path.dirname(at)).includes(path.basename(at))))
      throw new Error(`linked example input: ${relative}`);
  }
  if (!(directory ? fs.lstatSync(file).isDirectory() : fs.lstatSync(file).isFile())
    || !insidePath(realRoot, fs.realpathSync.native(file)))
    throw new Error(`example input is not a contained regular file: ${relative}`);
  return file;
}

/** Read and validate complete source references. Duplicate IDs refuse before
 * lookup; source, compiler and test pointers stay within one declared HFS app. */
export function loadExampleCatalog(root, { file = EXAMPLE_CATALOG_FILE } = {}) {
  const catalog = parseYaml(fs.readFileSync(referenceFile(root, file), 'utf8'));
  const schema = parseYaml(fs.readFileSync(referenceFile(root, 'modules/schemas/code-example-catalog.schema.yaml'), 'utf8'));
  const errors = validateAgainstSchema(catalog, schema);
  if (errors.length) throw new Error(`invalid example catalog: ${errors.join('; ')}`);
  const ids = new Set();
  for (const row of catalog.examples) {
    if (ids.has(row.id)) throw new Error(`duplicate example id: ${row.id}`);
    ids.add(row.id);
  }
  for (const row of catalog.examples) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.path)) throw new Error(`invalid example app: ${row.path}`);
    const app = path.join(root, EXAMPLES_ROOT, row.path);
    const declaration = JSON.parse(fs.readFileSync(referenceFile(root, `${EXAMPLES_ROOT}/${row.path}/hfs.json`), 'utf8'));
    if (declaration.kind !== 'app') throw new Error(`example has no HFS app declaration: ${row.id}`);
    if (!row.files.includes(row.entrypoint) || !/\.tsx?$/.test(row.entrypoint)) throw new Error(`example entrypoint is not a listed source: ${row.id}`);
    if (new Set(row.relatedRules).size !== row.relatedRules.length) throw new Error(`duplicate example relatedRules: ${row.id}`);
    for (const key of ['files', 'projects', 'tests']) {
      if (new Set(row[key]).size !== row[key].length) throw new Error(`duplicate example ${key}: ${row.id}`);
      for (const relative of row[key]) {
        if (relative.split('/').some((part) => ['node_modules', 'dist', '.next', '_derived', '.git'].includes(part)))
          throw new Error(`derived or installed example input: ${relative}`);
        referenceFile(app, relative);
      }
    }
    if (row.files.some((relative) => !/\.(?:tsx?|json)$/.test(relative))) throw new Error(`unsupported example source: ${row.id}`);
  }
  return catalog;
}

/** Source, compiler and test inputs of selected stable IDs, relative to the runtime.
 * A null selection requests the declared whole catalog; unknown IDs refuse. */
export function exampleSourcePaths(root, ids = null, options = {}) {
  const catalog = loadExampleCatalog(root, options), selected = new Set(ids ?? catalog.examples.map((row) => row.id));
  const known = new Set(catalog.examples.map((row) => row.id));
  for (const id of selected) if (!known.has(id)) throw new Error(`unknown example id: ${id}`);
  return [...new Set(catalog.examples.filter((row) => selected.has(row.id))
    .flatMap((row) => [...row.files, ...row.projects, ...row.tests].map((relative) => `${EXAMPLES_ROOT}/${row.path}/${relative}`)))];
}

/** Actual example apps' own Work trees in app-name order. Dependency/template
 * trees are not app Work; an absent own tree contributes no checker input. */
export function exampleWorkRoots(root) {
  return discoverExampleApps(root).flatMap((app) => {
    const relative = `${EXAMPLES_ROOT}/${app}/.starciwork/index.yaml`;
    const directory = path.dirname(path.join(root, relative)), stat = fs.lstatSync(directory, { throwIfNoEntry: false });
    if (!stat) return [];
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`invalid example Work directory: ${app}`);
    return [path.dirname(referenceFile(root, relative))];
  });
}

/** Per-call READ options for an actual HFS app's own Work tree. A real project
 * uses the default external store; an example never falls back to that store.
 * The fixture CAS is curated source, not a destination for operational writers. */
export function exampleArtifactReadOptions(runtimeRoot, workRoot, { resolveRoot = workRoot } = {}) {
  if (typeof runtimeRoot !== 'string' || typeof workRoot !== 'string') throw new TypeError('example artifact context needs runtime and Work paths');
  const base = path.resolve(runtimeRoot), target = path.resolve(workRoot);
  const relative = slash(path.relative(base, target)), parts = relative.split('/');
  if (parts[0]?.toLowerCase() !== EXAMPLES_ROOT) return Object.freeze({});
  const app = parts[1];
  if (parts[0] !== EXAMPLES_ROOT || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app ?? '')
    || !discoverExampleApps(base).includes(app) || parts[2] !== '.starciwork')
    throw new Error(`invalid example Work artifact context: ${relative}`);
  referenceFile(base, `${EXAMPLES_ROOT}/${app}/hfs.json`, { exact: true });
  referenceFile(base, `${EXAMPLES_ROOT}/${app}/.starciwork/index.yaml`, { exact: true });
  referenceFile(base, relative, { directory: true, exact: true });
  const resolution = path.resolve(resolveRoot), ownWork = path.join(base, EXAMPLES_ROOT, app, '.starciwork');
  if (!insidePath(resolution, target, { includeSelf: true }) || !insidePath(ownWork, resolution, { includeSelf: true }))
    throw new Error('selected example validation and resolution must share its own Work root');
  referenceFile(base, slash(path.relative(base, resolution)), { directory: true, exact: true });
  return Object.freeze({ root: path.join(base, EXAMPLE_RUNTIMES_ROOT, app, 'artifacts') });
}
