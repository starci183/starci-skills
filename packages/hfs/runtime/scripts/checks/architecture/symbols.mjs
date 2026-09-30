/**
 * HFS check 5, one name one declaration (knowledge/hfs/rules.yaml R21 and R30, both profiles, errors in every gate):
 *   HFS_DUPLICATE_SYMBOL  a name an owner's public entry exports, resolved to the file that declares it, that another
 *                         production file of the repository also declares and exports (function, class, const, enum,
 *                         type, interface). Two `InjectPrimaryEntityManager` declarations were this. A re-export of one
 *                         declaration is not a second declaration. There is no allowlist of names.
 *   HFS_ALIAS_REEXPORT    `export { X as Y }`, `export { default as Y }` and `export * as ns` in production source: a
 *                         second name for one declaration. Rename the declaration, or import it by its name.
 * Specs and tests are not in the graph. The public entry of an owner is found the way dead-exports.mjs finds it.
 */
import { canonical } from './config.mjs';
import { entryOf } from './dead-exports.mjs';

export const SYMBOL_RULE_IDS = ['HFS_DUPLICATE_SYMBOL', 'HFS_ALIAS_REEXPORT'];

const lineOf = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

/** The names a source file declares at top level and exports: Map<name, line>. Re-exports from another module declare nothing. */
function declaredExports(ts, sourceFile) {
  const kind = ts.SyntaxKind;
  const declared = new Map();
  const exported = new Map();
  const localLists = [];
  const bindingNames = (name, into, node) => {
    if (name.kind === kind.Identifier) into.set(name.text, lineOf(sourceFile, node));
    else for (const element of name.elements) if (element.kind === kind.BindingElement) bindingNames(element.name, into, node);
  };
  for (const statement of sourceFile.statements) {
    if (statement.kind === kind.ExportDeclaration) {
      if (!statement.moduleSpecifier && statement.exportClause?.kind === kind.NamedExports) localLists.push(...statement.exportClause.elements);
      continue;
    }
    const modifiers = statement.modifiers ?? [];
    const publish = modifiers.some(modifier => modifier.kind === kind.ExportKeyword) && !modifiers.some(modifier => modifier.kind === kind.DefaultKeyword);
    const into = publish ? exported : declared;
    if (statement.kind === kind.VariableStatement) {
      for (const declaration of statement.declarationList.declarations) bindingNames(declaration.name, into, declaration);
    } else if (statement.name?.kind === kind.Identifier
      && [kind.FunctionDeclaration, kind.ClassDeclaration, kind.EnumDeclaration, kind.TypeAliasDeclaration, kind.InterfaceDeclaration].includes(statement.kind)) {
      into.set(statement.name.text, lineOf(sourceFile, statement));
    }
  }
  // `export { local }` of a name declared in this file makes that declaration exported.
  for (const element of localLists) {
    const local = (element.propertyName ?? element.name).text;
    if (declared.has(local)) exported.set(element.name.text, declared.get(local));
  }
  return exported;
}

/** The declaration an export of an entry resolves to: its repository-relative file and its own name, or null. */
function declaringFile(ts, checker, graph, symbol) {
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  for (const declaration of resolved?.declarations ?? []) {
    const rel = graph.abs(canonical(declaration.getSourceFile().fileName));
    if (rel) return { rel, name: resolved.getName() };
  }
  return null;
}

function duplicateSymbols({ context, graph, config }) {
  const { ts } = context;
  const declarations = new Map(); // name -> Map<rel, line>
  for (const [rel, node] of graph.files) {
    for (const [name, line] of declaredExports(ts, node.sourceFile)) {
      if (name === 'default') continue;
      if (!declarations.has(name)) declarations.set(name, new Map());
      declarations.get(name).set(rel, line);
    }
  }
  const violations = [];
  const seen = new Set();
  let surface = 0;
  for (const [key, owner] of graph.ownerRoots) {
    if (owner.tier === 'app') continue;
    const entry = entryOf(graph, config, key, owner);
    if (!entry) continue;
    const entryFile = graph.files.get(entry);
    const checker = context.checkerFor(entryFile.abs);
    const moduleSymbol = checker?.getSymbolAtLocation(entryFile.sourceFile);
    if (!moduleSymbol) continue;
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      surface += 1;
      const declaration = declaringFile(ts, checker, graph, symbol);
      if (!declaration || declaration.name === 'default') continue;
      const { rel: home, name } = declaration;
      const others = [...(declarations.get(name) ?? [])].filter(([rel]) => rel !== home);
      if (!others.length || seen.has(`${home}\0${name}`)) continue;
      seen.add(`${home}\0${name}`);
      const where = others.map(([rel, at]) => `${rel}:${at}`);
      violations.push({
        ruleId: 'HFS_DUPLICATE_SYMBOL',
        path: home, line: declarations.get(name).get(home) ?? 1, column: 1, name, owner: owner.root, entry,
        otherDeclarations: where,
        message: `${name} is exported through the public entry ${entry} (declared in ${home}) and also declared and exported in ${where.join(', ')}; one name, one declaration: rename or delete the copy.`,
      });
    }
  }
  return { violations, surface };
}

function aliasReexports({ context, graph }) {
  const kind = context.ts.SyntaxKind;
  const violations = [];
  for (const [rel, node] of graph.files) {
    const point = target => node.sourceFile.getLineAndCharacterOfPosition(target.getStart(node.sourceFile));
    for (const statement of node.sourceFile.statements) {
      if (statement.kind !== kind.ExportDeclaration || !statement.exportClause) continue;
      const clause = statement.exportClause;
      if (clause.kind === kind.NamespaceExport) {
        const at = point(statement);
        violations.push({
          ruleId: 'HFS_ALIAS_REEXPORT', path: rel, line: at.line + 1, column: at.character + 1, name: clause.name.text,
          message: `export * as ${clause.name.text} in ${rel} publishes a whole module under a second name: export the declarations it holds by their own names.`,
        });
        continue;
      }
      for (const element of clause.elements) {
        if (!element.propertyName || element.propertyName.text === element.name.text) continue;
        const at = point(element);
        violations.push({
          ruleId: 'HFS_ALIAS_REEXPORT', path: rel, line: at.line + 1, column: at.character + 1,
          name: element.name.text, aliasOf: element.propertyName.text,
          message: `export { ${element.propertyName.text} as ${element.name.text} } in ${rel} gives one declaration a second name: rename the declaration to ${element.name.text}, or import and export it as ${element.propertyName.text}.`,
        });
      }
    }
  }
  return { violations };
}

export function checkSymbols(input) {
  const duplicates = duplicateSymbols(input);
  const aliases = aliasReexports(input);
  return {
    violations: [...duplicates.violations, ...aliases.violations],
    coverage: { status: 'checked', publicNames: duplicates.surface, duplicates: duplicates.violations.length, aliases: aliases.violations.length },
  };
}
