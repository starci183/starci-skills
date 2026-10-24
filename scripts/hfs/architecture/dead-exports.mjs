/**
 * HFS check 4, dead code (knowledge/hfs/rules.yaml R25, both profiles, errors in every gate):
 *   HFS_UNUSED_EXPORT  an export of an owner's public entry that no production file outside the owner imports is dead.
 *   HFS_UNUSED_FILE    a production source file that no root reaches is dead. Roots: the files an app slot requires
 *                      (main.ts, app.module.ts), every route file (slot tier `route`), the public entry of every package,
 *                      and an api app operation table `operations.ts` (the contract emit reads it by path),
 *                      and a source file a framework config of the app names by a relative string literal
 *                      (next.config.ts pointing next-intl at its request config). Specs and tests are not in the graph,
 *                      so a file only a spec imports is dead, on purpose. Type-only imports reach a file.
 *
 * Owner = every graph.ownerRoots unit whose tier is not `app` and whose public entry file is in the graph (index.ts or
 * index.tsx, a package's src/index.ts). The `entries` its slot declares (slot data: a second public entry file of the owner) are further
 * public entries of the same owner, judged like the entry, with one addition: a name another declared entry of the owner
 * imports (not re-exports) is used, because it is part of that entry's public signature (an operation file
 * `graphql/queries/query-<x>.ts` typing its request and answer with `graphql/queries/types/<x>.ts`). A barrel or any other
 * non-entry file of the owner still does not count. The exported names of an entry are its named exports, `export { a as b }`,
 * `export { x } from`, declarations with `export`, and `default` for `export default`. `export *` is refused by owners.mjs
 * and contributes no name here.
 *
 * A name is used when a production file outside the owner imports it from the entry (type-only imports count). A
 * namespace import uses its statically accessed members; a computed read or an escape of the namespace uses every name.
 * `import x = require`, a dynamic import()/require(), an `export *` or `export * as` of the entry make every name used.
 * A file outside the owner that re-exports the name (`export { n as m } from`) uses it when `m` is itself
 * used by the importers of that file; a re-exporting file nobody imports is a framework entry (a route file) and uses it.
 * Specs and tests are not in the graph, so an export used only by a spec is dead, on purpose, with these exceptions (unit test
 * standard): the unit spec of every unit role (ruleParams.be.unitRoles: `<name>.service.spec.ts`, `<name>.cli.spec.ts`) and of every logic role
 * (ruleParams.be.logicRoles: `<name>.policy.spec.ts`, `<name>.client.spec.ts`, ...), a
 * unit spec of a webhook, gateway, subscription or SSE controller door (`.webhook.spec.ts`, `.gateway.spec.ts`, `.subscription.spec.ts`, `.controller.spec.ts`: a door has no service of its own), a
 * `*.builder.ts` under src/tests/fixtures/builders, and a file of the test world (slots be.tests.world and be.tests.world.kit, which
 * open and migrate the real databases of the e2e run) read from disk or staged in the git index count as consumers, because a spec can only provide an
 * Inject*() token or a param type the entry exports, and the world wires the same capabilities the apps do. An integration
 * spec (slot be.tests.integration, `src/tests/integration/<capability>/*.integration-spec.ts`) counts as a consumer of exactly one
 * owner: the integration (slot be.integrations, `src/modules/integrations/<provider>/`) whose provider folder is its capability
 * folder, because R112 makes that spec register the integration module and reference its ErrorCode enum. Specs of any other kind,
 * an integration spec importing another owner, and e2e specs still do not count. A consumer inside the owner is
 * skipped like any inside consumer.
 */
import fs from 'node:fs';
import { canonical } from './config.mjs';
import path from 'node:path';
import { treeOf } from './required-files.mjs';
import { globExpression } from '../../lib/glob.mjs';
import { stagedConsumerSources } from './staged-consumers.mjs';
import { bindingsOf } from './dead-exports-bindings.mjs';

export const DEAD_EXPORT_RULE_IDS = ['HFS_UNUSED_EXPORT', 'HFS_UNUSED_FILE'];

const PACKAGE_ENTRIES = ['src/index.ts', 'src/index.tsx', 'index.ts', 'index.tsx'];
const OWNER_ENTRIES = ['index.ts', 'index.tsx'];
const CHAIN_DEPTH = 6;
/** The file of an api app that the contract emit reads by path for the typed operation table (BE-OPERATIONS-1): no import reaches it, the emit does. */
const OPERATION_TABLE_FILE = "operations.ts";
/** Tiers whose files are not production source that an app serves: judged by no dead-file rule. */
const UNJUDGED_TIERS = new Set(['none', 'e2e', 'fixtures']);
const CONFIG_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js'];
const CONFIG_STRING = /['"`](\.{1,2}\/[^'"`\s]+)['"`]/g;

/** The public entry file (repository-relative) of an owner unit, or null when the owner has none in the graph. */
export function entryOf(graph, config, key, owner) {
  const declared = config.owners?.find(item => item.id === key)?.entry;
  if (declared && graph.files.has(declared)) return declared;
  for (const candidate of owner.tier === 'package' ? PACKAGE_ENTRIES : OWNER_ENTRIES) {
    const rel = owner.root ? `${owner.root}/${candidate}` : candidate;
    if (graph.files.has(rel)) return rel;
  }
  return null;
}

/** The additional public entry files (repository-relative, in the graph) the slot manifest declares for the owner (slot field `entries`, on the slot that holds its entry file). */
function extraEntries(graph, entry) {
  const found = graph.resolver.classifyPath(entry);
  const names = found.slot ? graph.resolver.slot(found.slot)?.entries ?? [] : [];
  // an entry holding `*` (one file per operation) names every graph file it matches
  const matches = name => [...graph.files.keys()].filter(rel => globExpression(`${found.root}/${name}`).test(rel));
  return names.flatMap(name => (name.includes('*') ? matches(name) : [`${found.root}/${name}`].filter(rel => graph.files.has(rel))));
}

const addExportName = (found, sourceFile, name, node) => {
  if (found.has(name)) return;
  found.set(name, sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1);
};

const addBindingNames = (ts, found, sourceFile, name, node) => {
  if (name.kind === ts.SyntaxKind.Identifier) addExportName(found, sourceFile, name.text, node);
  else for (const element of name.elements) if (element.kind === ts.SyntaxKind.BindingElement) addBindingNames(ts, found, sourceFile, element.name, node);
};

const addExportDeclarationNames = (ts, statement, add) => {
  if (statement.exportClause?.kind === ts.SyntaxKind.NamedExports) {
    for (const element of statement.exportClause.elements) add(element.name.text, element);
  } else if (statement.exportClause?.kind === ts.SyntaxKind.NamespaceExport) add(statement.exportClause.name.text, statement);
};

const addStatementNames = (ts, found, sourceFile, statement) => {
  const kind = ts.SyntaxKind;
  const add = (name, node) => addExportName(found, sourceFile, name, node);
  if (statement.kind === kind.ExportDeclaration) return addExportDeclarationNames(ts, statement, add);
  if (statement.kind === kind.ExportAssignment) return add('default', statement);
  const modifiers = statement.modifiers ?? [];
  if (!modifiers.some(modifier => modifier.kind === kind.ExportKeyword)) return undefined;
  if (modifiers.some(modifier => modifier.kind === kind.DefaultKeyword)) return add('default', statement);
  if (statement.kind === kind.VariableStatement) {
    for (const declaration of statement.declarationList.declarations) addBindingNames(ts, found, sourceFile, declaration.name, declaration);
    return undefined;
  }
  return statement.name && statement.name.kind === kind.Identifier ? add(statement.name.text, statement) : undefined;
};

/** The exported names of an entry source file, each with the line of its declaration. */
export function exportedNames(ts, sourceFile) {
  const found = new Map();
  for (const statement of sourceFile.statements) addStatementNames(ts, found, sourceFile, statement);
  return found;
}

const withoutSlash = value => value.replace(/\/$/, '');

const addConfigTextRoots = (graph, directory, text, roots) => {
  for (const match of text.matchAll(CONFIG_STRING)) {
    const target = path.posix.join(directory, match[1]);
    const hit = CONFIG_EXTENSIONS.map(extension => `${target}${extension}`).find(candidate => graph.files.has(candidate));
    if (hit) roots.add(hit);
  }
};

const addAppConfigRoots = (graph, config, app, roots) => {
  const directory = `apps/${app.name}`;
  let names = [];
  try { names = fs.readdirSync(path.join(config.root, ...directory.split('/'))); } catch { return; }
  for (const name of names) {
    if (graph.resolver.classifyPath(`${directory}/${name}`).slot !== 'fe.app.next' || !/\.[cm]?[jt]sx?$/.test(name)) continue;
    let text = '';
    try { text = fs.readFileSync(path.join(config.root, ...directory.split('/'), name), 'utf8'); } catch { continue; }
    addConfigTextRoots(graph, directory, text, roots);
  }
};

const addFrameworkConfigRoots = (graph, config, roots) => {
  for (const app of config.apps ?? []) addAppConfigRoots(graph, config, app, roots);
};

/** The files the graph serves from: what an app slot requires, every route file, every package entry, every config-named file. */
function rootFiles(graph, config) {
  const roots = new Set();
  for (const [rel, node] of graph.files) {
    if (node.tier === 'route') { roots.add(rel); continue; }
    if (!node.owner || node.tier !== 'app') continue;
    const slot = graph.resolver.slot(node.owner.slot);
    const inside = rel.slice(withoutSlash(node.owner.root).length + 1);
    if ((slot?.requires ?? []).includes(inside) || inside === OPERATION_TABLE_FILE) roots.add(rel);
  }
  for (const [key, owner] of graph.ownerRoots) {
    if (owner.tier !== 'package') continue;
    const entry = entryOf(graph, config, key, owner);
    if (entry) roots.add(entry);
  }
  // A framework config of an app (slot fe.app.next) names sources by string, never by import.
  addFrameworkConfigRoots(graph, config, roots);
  return roots;
}

const unusedFileViolation = (rel, node) => ({
  ruleId: 'HFS_UNUSED_FILE',
  path: rel, line: 1, column: 1,
  slot: node.slot, owner: node.owner?.root ?? null,
  message: `${rel} is not reached from any root (an app main.ts or app.module.ts, a route file, a package entry): nothing imports it, so no process runs it. Delete the file, or import it where it is used (a spec alone does not count).`,
});

/** HFS_UNUSED_FILE: production files no root reaches through runtime or type-only imports and re-exports. */
function deadFiles(graph, config) {
  const roots = rootFiles(graph, config);
  const forward = Map.groupBy(graph.edges, edge => edge.from);
  const reached = new Set(roots);
  const queue = [...roots];
  while (queue.length) for (const { to } of forward.get(queue.shift()) ?? []) if (!reached.has(to)) { reached.add(to); queue.push(to); }
  const judgedFiles = [...graph.files]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, node]) => !(node.tier === null || UNJUDGED_TIERS.has(node.tier) || node.tier === 'route'));
  const violations = judgedFiles.filter(([rel]) => !reached.has(rel)).map(([rel, node]) => unusedFileViolation(rel, node));
  return { violations, judged: judgedFiles.length, roots: roots.size };
}

/** The unit spec of a webhook, gateway, subscription or SSE controller door: a door has no service of its own, so its spec is the only unit spec of its kind. */
const DOOR_SPEC = /^src\/features\/(?:webhooks|realtime)\/.+\.(?:webhook|gateway|subscription|controller)\.spec\.ts$/u;
const BUILDER_CONSUMER = /^src\/tests\/fixtures\/builders\/.+\.builder\.ts$/u;
/** The test world slots (knowledge/hfs/slots.yaml): their files wire the real capabilities of the e2e run. */
const WORLD_SLOTS = new Set(['be.tests.world', 'be.tests.world.kit']);

/** Whether `rel` is a test file that counts as a consumer of any owner: a unit role spec, a fixture builder, a world file. */
function testConsumer(graph, rel) {
  const params = graph.resolver.ruleParams();
  const specs = [...(params.unitRoles ?? []).map(role => role.spec), ...(params.logicRoles ?? []).map(role => `${role}.spec`)];
  if (/^(?:src|apps)\//u.test(rel) && specs.some(spec => rel.endsWith(`.${spec}.ts`))) return true;
  if (DOOR_SPEC.test(rel)) return true;
  if (BUILDER_CONSUMER.test(rel)) return true;
  const classified = graph.resolver.classifyPath(rel);
  return WORLD_SLOTS.has(classified.slot) && classified.status !== 'forbidden' && /\.tsx?$/u.test(rel);
}
/** The slot of integration specs and the slot of the integrations they pair with by folder (knowledge/hfs/slots.yaml). */
const INTEGRATION_SPEC_SLOT = 'be.tests.integration';
const INTEGRATION_SLOT = 'be.integrations';

/** The provider an integration spec pairs with (its `<capability>` folder), or null when `rel` is no integration spec. */
function integrationSpecProvider(graph, rel) {
  const classified = graph.resolver.classifyPath(rel);
  return classified.slot === INTEGRATION_SPEC_SLOT && classified.status !== 'forbidden' ? classified.bindings?.capability ?? null : null;
}

/** Whether `to` belongs to the integration of `provider` (slot be.integrations, its `<provider>` binding). */
function inIntegrationOf(graph, to, provider) {
  const owner = graph.resolver.ownerOf(to);
  return owner?.slot === INTEGRATION_SLOT && owner.bindings?.provider === provider;
}

/** The pseudo edges of one test consumer file: its import/export declarations that resolve to graph files it may reach. */
function consumerFileEdges({ ts, options, graph, config }, rel, provider, indexedText) {
  const abs = path.join(config.root, ...rel.split('/'));
  let text = indexedText;
  if (text === undefined) {
    try { text = fs.readFileSync(abs, 'utf8'); } catch { return []; }
  }
  const sourceFile = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true);
  const edges = [];
  for (const statement of sourceFile.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
    const resolved = ts.resolveModuleName(statement.moduleSpecifier.text, abs, options, ts.sys).resolvedModule?.resolvedFileName;
    const to = resolved ? graph.abs(canonical(resolved)) : null;
    if (to && (provider === null || inIntegrationOf(graph, to, provider))) edges.push({ from: rel, to, edge: { declaration: statement }, reexport: false });
  }
  return edges;
}

/**
 * Pseudo edges (read from disk and staged index sources, outside the production program) to graph files: from the unit role specs, the fixture builders and
 * the test world files to anything, and from an integration spec only to the integration of its own provider folder.
 */
function testConsumerEdges({ context, graph, config }) {
  const resolution = { ts: context.ts, options: context.projects?.[0]?.options ?? {}, graph, config };
  // Live lint keeps tracked disk consumers; staged snapshots add the consumers present in the same commit.
  const staged = stagedConsumerSources(config.root, file => testConsumer(graph, file) || integrationSpecProvider(graph, file) !== null);
  const consumers = [...[...treeOf(config.root).files].map(file => ({ file })), ...staged]
    .map(source => ({ ...source, any: testConsumer(graph, source.file) }))
    .map(({ file, text, any }) => ({ file, text, provider: any ? null : integrationSpecProvider(graph, file), any }))
    .filter(({ any, provider }) => any || provider !== null)
    .sort((a, b) => a.file.localeCompare(b.file));
  return consumers.flatMap(({ file: rel, text, provider }) => consumerFileEdges(resolution, rel, provider, text));
}

const edgeIndex = edges => {
  const edgesTo = new Map();
  for (const edge of edges) {
    if (!edgesTo.has(edge.to)) edgesTo.set(edge.to, []);
    edgesTo.get(edge.to).push(edge);
  }
  return edgesTo;
};

const unitOfFile = (graph, rel) => {
  const known = graph.unit(rel);
  if (known) return known;
  const classified = graph.resolver.classifyPath(rel);
  const owner = classified.slot ? graph.resolver.ownerOf(rel) : null;
  return owner ? `${owner.slot}:${owner.root}` : null;
};

const consumeReexportedName = (context, result, edge, pair, depth, visiting) => {
  if (pair.exported === null) { result.names.add(pair.imported); return; }
  // A re-export by name: the name is used when the re-exporting file's own export is used further on.
  const reexporter = edge.from;
  if (visiting.has(reexporter) || depth >= CHAIN_DEPTH) { result.names.add(pair.imported); return; }
  if (!(context.edgesTo.get(reexporter)?.length)) {
    // nobody imports the re-exporting file: a framework entry (route file) uses it, an unused owner entry does not
    const holder = context.graph.files.get(reexporter);
    if (!holder?.owner || context.graph.resolver.slot(holder.owner.slot)?.tier === 'app') result.names.add(pair.imported);
    return;
  }
  const next = consumedNames(context, reexporter, null, depth + 1, new Set([...visiting, reexporter]));
  if (next.all || next.names.has(pair.exported)) result.names.add(pair.imported);
};

/** What the importers of `file` take from it; edges from inside `ownerKey` are skipped when given. */
const consumedNames = (context, file, ownerKey, depth, visiting) => {
  const result = { all: false, names: new Set() };
  for (const edge of context.edgesTo.get(file) ?? []) {
    if (ownerKey && unitOfFile(context.graph, edge.from) === ownerKey) continue;
    const bindings = bindingsOf(context, edge.edge.declaration);
    if (bindings.all) { result.all = true; continue; }
    for (const pair of bindings.pairs) consumeReexportedName(context, result, edge, pair, depth, visiting);
  }
  return result;
};

/** Adds to `used` the entry exports reached by a consumer outside the owner that imports a file the entry re-exports by name. */
const addReexportedUses = (context, key, publicEntry, used) => {
  const { graph } = context;
  for (const edge of graph.edges) {
    if (edge.from !== publicEntry || !edge.reexport || graph.unit(edge.to) !== key) continue;
    const reexport = bindingsOf(context, edge.edge.declaration);
    const inner = consumedNames(context, edge.to, key, 0, new Set([publicEntry, edge.to]));
    if (reexport.all) continue;
    for (const pair of reexport.pairs) if (inner.all || inner.names.has(pair.imported)) used.names.add(pair.exported);
  }
};

const unusedExportViolation = (publicEntry, name, line, owner) => ({
  ruleId: 'HFS_UNUSED_EXPORT',
  path: publicEntry, line, column: 1,
  name, owner: owner.root, slot: owner.slot,
  message: `${publicEntry} exports ${name}, but no production file outside ${owner.root || 'the repository root'} imports it; remove the export (only a unit role spec, a fixture builder, a test world file, or an integration spec of this integration's own provider folder counts besides production files).`,
});

/** Adds to `used` what another declared entry of the same owner imports from `publicEntry`: that entry's signature makes it public. */
const addSiblingEntryUses = (context, publicEntry, declared, used) => {
  for (const edge of context.edgesTo.get(publicEntry) ?? []) {
    if (edge.reexport || edge.from === publicEntry || !declared.has(edge.from)) continue;
    const bindings = bindingsOf(context, edge.edge.declaration);
    if (bindings.all) used.all = true;
    for (const pair of bindings.pairs) used.names.add(pair.imported);
  }
};

/** The unused-export violations and the export count of one public entry of an owner (`declared`: its slot's extra entries). */
const publicEntryExports = (context, key, owner, publicEntry, declared) => {
  const names = exportedNames(context.ts, context.graph.files.get(publicEntry).sourceFile);
  const used = consumedNames(context, publicEntry, key, 0, new Set([publicEntry]));
  addReexportedUses(context, key, publicEntry, used);
  if (declared.has(publicEntry)) addSiblingEntryUses(context, publicEntry, declared, used);
  const violations = [...names]
    .filter(([name]) => !(used.all || used.names.has(name)))
    .map(([name, line]) => unusedExportViolation(publicEntry, name, line, owner));
  return { violations, exports: names.size };
};

const ownerExportFindings = (context, config) => {
  const { graph } = context;
  const violations = [];
  let owners = 0;
  let exports = 0;
  for (const [key, owner] of graph.ownerRoots) {
    if (owner.tier === 'app') continue;
    const entry = entryOf(graph, config, key, owner);
    if (!entry) continue;
    owners += 1;
    const declared = new Set(extraEntries(graph, entry));
    for (const publicEntry of [entry, ...declared]) {
      const found = publicEntryExports(context, key, owner, publicEntry, declared);
      exports += found.exports;
      violations.push(...found.violations);
    }
  }
  return { violations, owners, exports };
};

export function checkDeadExports({ context, graph, config }) {
  const edgesTo = edgeIndex([...graph.edges, ...testConsumerEdges({ context, graph, config })]);
  const analysis = { ...context, graph, edgesTo, namespaceCheckers: new WeakMap(), namespaceUses: new WeakMap() };
  const exports = ownerExportFindings(analysis, config);
  const files = deadFiles(graph, config);
  const dead = exports.violations.length;
  exports.violations.push(...files.violations);
  return { violations: exports.violations, coverage: { status: 'checked', owners: exports.owners, exports: exports.exports, dead, files: files.judged, roots: files.roots, unusedFiles: files.violations.length } };
}
