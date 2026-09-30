/**
 * HFS check 4, dead code (knowledge/hfs/rules.yaml R25, both profiles, errors in every gate):
 *   HFS_UNUSED_EXPORT  an export of an owner's public entry that no production file outside the owner imports is dead.
 *   HFS_UNUSED_FILE    a production source file that no root reaches is dead. Roots: the files an app slot requires
 *                      (main.ts, app.module.ts), every route file (slot tier `route`), the public entry of every package,
 *                      and a source file a framework config of the app names by a relative string literal
 *                      (next.config.ts pointing next-intl at its request config). Specs and tests are not in the graph,
 *                      so a file only a spec imports is dead, on purpose. Type-only imports reach a file.
 *
 * Owner = every graph.ownerRoots unit whose tier is not `app` and whose public entry file is in the graph (index.ts or
 * index.tsx, a package's src/index.ts). The exported names of the entry are its named exports, `export { a as b }`,
 * `export { x } from`, declarations with `export`, and `default` for `export default`. `export *` is refused by owners.mjs
 * and contributes no name here.
 *
 * A name is used when a production file outside the owner imports it from the entry (type-only imports count). A
 * namespace import, `import x = require`, a dynamic import()/require(), an `export *` or `export * as` of the entry make
 * every name used. A file outside the owner that re-exports the name (`export { n as m } from`) uses it when `m` is itself
 * used by the importers of that file; a re-exporting file nobody imports is a framework entry (a route file) and uses it.
 * Specs and tests are not in the graph, so an export used only by a spec is dead, on purpose.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DEAD_EXPORT_RULE_IDS = ['HFS_UNUSED_EXPORT', 'HFS_UNUSED_FILE'];

const PACKAGE_ENTRIES = ['src/index.ts', 'src/index.tsx', 'index.ts', 'index.tsx'];
const OWNER_ENTRIES = ['index.ts', 'index.tsx'];
const CHAIN_DEPTH = 6;
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

/** Names an import/export declaration takes from its target: {all} or {pairs: [{imported, exported}]}. */
function bindingsOf(ts, declaration) {
  const kind = ts.SyntaxKind;
  if (!declaration) return { all: true, pairs: [] };
  if (declaration.kind === kind.ImportDeclaration) {
    const clause = declaration.importClause;
    if (!clause) return { all: false, pairs: [] }; // side-effect import: uses nothing
    const pairs = [];
    if (clause.name) pairs.push({ imported: 'default', exported: null });
    const named = clause.namedBindings;
    if (named && named.kind === kind.NamespaceImport) return { all: true, pairs: [] };
    if (named) for (const element of named.elements) pairs.push({ imported: (element.propertyName ?? element.name).text, exported: null });
    return { all: false, pairs };
  }
  if (declaration.kind === kind.ExportDeclaration) {
    const clause = declaration.exportClause;
    if (!clause || clause.kind === kind.NamespaceExport) return { all: true, pairs: [] };
    return { all: false, pairs: clause.elements.map(element => ({ imported: (element.propertyName ?? element.name).text, exported: element.name.text })) };
  }
  if (declaration.kind === kind.ImportTypeNode) {
    let qualifier = declaration.qualifier;
    if (!qualifier) return { all: true, pairs: [] };
    while (qualifier.kind === kind.QualifiedName) qualifier = qualifier.left;
    return { all: false, pairs: [{ imported: qualifier.text, exported: null }] };
  }
  // ImportEqualsDeclaration, dynamic import(), require(): the whole module is taken.
  return { all: true, pairs: [] };
}

/** The exported names of an entry source file, each with the line of its declaration. */
export function exportedNames(ts, sourceFile) {
  const kind = ts.SyntaxKind;
  const found = new Map();
  const add = (name, node) => {
    if (found.has(name)) return;
    found.set(name, sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1);
  };
  const bindingNames = (name, node) => {
    if (name.kind === kind.Identifier) add(name.text, node);
    else for (const element of name.elements) if (element.kind === kind.BindingElement) bindingNames(element.name, node);
  };
  for (const statement of sourceFile.statements) {
    if (statement.kind === kind.ExportDeclaration) {
      if (statement.exportClause?.kind === kind.NamedExports) for (const element of statement.exportClause.elements) add(element.name.text, element);
      else if (statement.exportClause?.kind === kind.NamespaceExport) add(statement.exportClause.name.text, statement);
      continue;
    }
    if (statement.kind === kind.ExportAssignment) { add('default', statement); continue; }
    const modifiers = statement.modifiers ?? [];
    if (!modifiers.some(modifier => modifier.kind === kind.ExportKeyword)) continue;
    if (modifiers.some(modifier => modifier.kind === kind.DefaultKeyword)) { add('default', statement); continue; }
    if (statement.kind === kind.VariableStatement) for (const declaration of statement.declarationList.declarations) bindingNames(declaration.name, declaration);
    else if (statement.name && statement.name.kind === kind.Identifier) add(statement.name.text, statement);
  }
  return found;
}

const withoutSlash = value => value.replace(/\/$/, '');

/** The files the graph serves from: what an app slot requires, every route file, every package entry, every config-named file. */
function rootFiles(graph, config) {
  const roots = new Set();
  for (const [rel, node] of graph.files) {
    if (node.tier === 'route') { roots.add(rel); continue; }
    if (!node.owner || node.tier !== 'app') continue;
    const slot = graph.resolver.slot(node.owner.slot);
    const inside = rel.slice(withoutSlash(node.owner.root).length + 1);
    if ((slot?.requires ?? []).some(name => name === inside)) roots.add(rel);
  }
  for (const [key, owner] of graph.ownerRoots) {
    if (owner.tier !== 'package') continue;
    const entry = entryOf(graph, config, key, owner);
    if (entry) roots.add(entry);
  }
  // A framework config of an app (slot fe.app.next) names sources by string, never by import.
  for (const app of config.apps ?? []) {
    const directory = `apps/${app.name}`;
    let names = [];
    try { names = fs.readdirSync(path.join(config.root, ...directory.split('/'))); } catch { continue; }
    for (const name of names) {
      if (graph.resolver.classifyPath(`${directory}/${name}`).slot !== 'fe.app.next' || !/\.[cm]?[jt]sx?$/.test(name)) continue;
      let text = '';
      try { text = fs.readFileSync(path.join(config.root, ...directory.split('/'), name), 'utf8'); } catch { continue; }
      for (const match of text.matchAll(CONFIG_STRING)) {
        const target = path.posix.join(directory, match[1]);
        const hit = CONFIG_EXTENSIONS.map(extension => `${target}${extension}`).find(candidate => graph.files.has(candidate));
        if (hit) roots.add(hit);
      }
    }
  }
  return roots;
}

/** HFS_UNUSED_FILE: production files no root reaches through runtime or type-only imports and re-exports. */
function deadFiles(graph, config) {
  const roots = rootFiles(graph, config);
  const forward = new Map();
  for (const edge of graph.edges) {
    if (!forward.has(edge.from)) forward.set(edge.from, []);
    forward.get(edge.from).push(edge.to);
  }
  const reached = new Set(roots);
  const queue = [...roots];
  while (queue.length) for (const next of forward.get(queue.shift()) ?? []) if (!reached.has(next)) { reached.add(next); queue.push(next); }
  const violations = [];
  let judged = 0;
  for (const [rel, node] of [...graph.files].sort(([a], [b]) => a.localeCompare(b))) {
    if (node.tier === null || UNJUDGED_TIERS.has(node.tier) || node.tier === 'route') continue;
    judged += 1;
    if (reached.has(rel)) continue;
    violations.push({
      ruleId: 'HFS_UNUSED_FILE',
      path: rel, line: 1, column: 1,
      slot: node.slot, owner: node.owner?.root ?? null,
      message: `${rel} is not reached from any root (an app main.ts or app.module.ts, a route file, a package entry): nothing imports it, so no process runs it. Delete the file, or import it where it is used (a spec alone does not count).`,
    });
  }
  return { violations, judged, roots: roots.size };
}

export function checkDeadExports({ context, graph, config }) {
  const { ts } = context;
  const violations = [];
  const edgesTo = new Map();
  for (const edge of graph.edges) {
    if (!edgesTo.has(edge.to)) edgesTo.set(edge.to, []);
    edgesTo.get(edge.to).push(edge);
  }

  /** What the importers of `file` take from it; edges from inside `ownerKey` are skipped when given. */
  const consumed = (file, ownerKey, depth, visiting) => {
    const result = { all: false, names: new Set() };
    for (const edge of edgesTo.get(file) ?? []) {
      if (ownerKey && graph.unit(edge.from) === ownerKey) continue;
      const bindings = bindingsOf(ts, edge.edge.declaration);
      if (bindings.all) { result.all = true; continue; }
      for (const pair of bindings.pairs) {
        if (pair.exported === null) { result.names.add(pair.imported); continue; }
        // A re-export by name: the name is used when the re-exporting file's own export is used further on.
        const reexporter = edge.from;
        if (visiting.has(reexporter) || depth >= CHAIN_DEPTH) { result.names.add(pair.imported); continue; }
        if (!(edgesTo.get(reexporter)?.length)) {
          // nobody imports the re-exporting file: a framework entry (route file) uses it, an unused owner entry does not
          const holder = graph.files.get(reexporter);
          if (!holder?.owner || graph.resolver.slot(holder.owner.slot)?.tier === 'app') result.names.add(pair.imported);
          continue;
        }
        const next = consumed(reexporter, null, depth + 1, new Set([...visiting, reexporter]));
        if (next.all || next.names.has(pair.exported)) result.names.add(pair.imported);
      }
    }
    return result;
  };

  let owners = 0;
  let exports = 0;
  for (const [key, owner] of graph.ownerRoots) {
    if (owner.tier === 'app') continue;
    const entry = entryOf(graph, config, key, owner);
    if (!entry) continue;
    owners += 1;
    const names = exportedNames(ts, graph.files.get(entry).sourceFile);
    const used = consumed(entry, key, 0, new Set([entry]));
    // A consumer outside the owner that imports a file the entry re-exports by name reaches the entry's export of that name.
    for (const edge of graph.edges) {
      if (edge.from !== entry || !edge.reexport || graph.unit(edge.to) !== key) continue;
      const reexport = bindingsOf(ts, edge.edge.declaration);
      const inner = consumed(edge.to, key, 0, new Set([entry, edge.to]));
      if (reexport.all) continue;
      for (const pair of reexport.pairs) if (inner.all || inner.names.has(pair.imported)) used.names.add(pair.exported);
    }
    for (const [name, line] of names) {
      exports += 1;
      if (used.all || used.names.has(name)) continue;
      violations.push({
        ruleId: 'HFS_UNUSED_EXPORT',
        path: entry, line, column: 1,
        name, owner: owner.root, slot: owner.slot,
        message: `${entry} exports ${name}, but no production file outside ${owner.root || 'the repository root'} imports it; remove the export (a spec alone does not count as a use).`,
      });
    }
  }
  const files = deadFiles(graph, config);
  const deadExports = violations.length;
  violations.push(...files.violations);
  return { violations, coverage: { status: 'checked', owners, exports, dead: deadExports, files: files.judged, roots: files.roots, unusedFiles: files.violations.length } };
}
