/**
 * HFS v2 check 4 (knowledge/hfs/slots.yaml rules HFS_UNUSED_EXPORT on repo.packages and fe.package.ui): an export of an
 * owner's public entry that no production file outside the owner imports is dead.
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
export const DEAD_EXPORT_RULE_IDS = ['HFS_UNUSED_EXPORT'];

const PACKAGE_ENTRIES = ['src/index.ts', 'src/index.tsx', 'index.ts', 'index.tsx'];
const OWNER_ENTRIES = ['index.ts', 'index.tsx'];
const CHAIN_DEPTH = 6;

/** The public entry file (repository-relative) of an owner unit, or null when the owner has none in the graph. */
function entryOf(graph, config, key, owner) {
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
function exportedNames(ts, sourceFile) {
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
  return { violations, coverage: { status: 'checked', owners, exports, dead: violations.length } };
}
