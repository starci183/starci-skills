import path from 'node:path';
import { canonical } from './config.mjs';
import { sourceLocation } from './typescript.mjs';

/**
 * The small TypeScript reading kit the R33/R38/R39/R41/R45/R84/R86 machine checks share (connection-map, sql-owner,
 * register-once, error-masked, default-deny-app-guard, entrypoint-only-in-apps, error-home). Everything is decided by
 * the checker and by where a declaration lives (the HFS graph), never by a variable name: a framework symbol is
 * recognised by the package it is imported from, a capability class by the file that declares it.
 */
export function machineKit({ config, context, graph }) {
  const ts = context.ts;
  const resolver = graph.resolver;

  const checkerOf = sourceFile => context.checkerFor(sourceFile.fileName);

  const aliased = (checker, symbol) => {
    const seen = new Set();
    let current = symbol;
    while (current && (current.flags & ts.SymbolFlags.Alias) && !seen.has(current)) {
      seen.add(current);
      let target;
      try { target = checker.getAliasedSymbol(current); } catch { break; }
      if (!target || target === current || !(target.declarations?.length)) break;
      current = target;
    }
    return current;
  };

  const symbolAt = (checker, node) => {
    if (!node) return null;
    if (ts.isShorthandPropertyAssignment(node.parent ?? {}) && node.parent.name === node) return checker.getShorthandAssignmentValueSymbol(node.parent) ?? null;
    return checker.getSymbolAtLocation(node) ?? null;
  };

  /** {name, module} when `node` (identifier, or namespace.member) is bound by an import from a module specifier, else null. */
  const importBinding = (checker, node) => {
    const own = target => {
      const symbol = symbolAt(checker, target);
      const declaration = symbol?.declarations?.[0];
      if (!declaration) return null;
      if (ts.isImportSpecifier(declaration)) return { name: (declaration.propertyName ?? declaration.name).text, module: declaration.parent.parent.parent.moduleSpecifier.text };
      if (ts.isImportClause(declaration)) return { name: 'default', module: declaration.parent.moduleSpecifier.text };
      if (ts.isNamespaceImport(declaration)) return { name: '*', module: declaration.parent.parent.moduleSpecifier.text };
      return null;
    };
    if (ts.isIdentifier(node)) return own(node);
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const namespace = own(node.expression);
      return namespace?.name === '*' ? { name: node.name.text, module: namespace.module } : null;
    }
    return null;
  };

  const isImportOf = (checker, node, name, moduleName) => {
    const binding = importBinding(checker, node);
    return Boolean(binding) && binding.name === name && binding.module === moduleName;
  };

  /** The declarations `node` resolves to through aliases. */
  const declarationsOf = (checker, node) => aliased(checker, symbolAt(checker, node))?.declarations ?? [];

  /** The repository-relative graph path of the file declaring `declaration`, or null when it is outside the program. */
  const graphPath = declaration => graph.abs(canonical(declaration.getSourceFile().fileName));

  const graphFile = rel => graph.files.get(rel) ?? null;

  /** The capability (owner) root, slot and tier of a declaration, or null. */
  const ownerOfDeclaration = declaration => {
    const rel = graphPath(declaration);
    const file = rel ? graphFile(rel) : null;
    return file?.owner ? { rel, root: file.owner.root, slot: file.owner.slot, tier: file.tier, name: path.posix.basename(file.owner.root) } : null;
  };

  /** The string a node evaluates to: a literal, or a const whose type is a string literal. */
  const stringValue = (checker, node) => {
    if (!node) return null;
    if (ts.isStringLiteralLike(node)) return node.text;
    let type;
    try { type = checker.getTypeAtLocation(node); } catch { return null; }
    if (type?.isStringLiteral?.()) return type.value;
    const declaration = declarationsOf(checker, ts.isPropertyAccessExpression(node) ? node.name : node)[0];
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return stringValue(checker, declaration.initializer);
    return null;
  };

  const walk = (node, visit) => {
    const step = child => {
      if (visit(child) === false) return;
      ts.forEachChild(child, step);
    };
    step(node);
  };

  const decorators = node => (ts.canHaveDecorators?.(node) ? ts.getDecorators(node) ?? [] : []);
  const isExported = node => Boolean(ts.getCombinedModifierFlags?.(node) & ts.ModifierFlags.Export);

  const propertyNameText = name => {
    if (!name) return null;
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
    return null;
  };

  /** The object literal properties of `literal` by static name. */
  const propertyOf = (literal, key) => literal.properties.find(property => (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && propertyNameText(property.name) === key);

  const valueOfProperty = property => (ts.isPropertyAssignment(property) ? property.initializer : property.name);

  const at = (rel, sourceFile, node, extra = {}) => ({ path: rel, ...sourceLocation(sourceFile, node), ...extra });

  /** The app root file of an app (apps/<name>/src/app.module.ts), or null when the program does not hold it. */
  const appRoot = name => {
    const rel = `apps/${name}/src/app.module.ts`;
    return graphFile(rel);
  };

  /** The `{ provide: <token>, ... }` provider literals of `file` whose token is `name` imported from `moduleName`, in source order. */
  const HELPER_DEPTH = 4;

  /** The body a call or a spread identifier resolves to when it is a function or a const declared in a file of the program (not a package), else null. */
  const helperBodyOf = (checker, node) => {
    const target = ts.isCallExpression(node) ? node.expression : node;
    for (const declaration of declarationsOf(checker, ts.isPropertyAccessExpression(target) ? target.name : target)) {
      if (!graphPath(declaration)) continue;
      if (ts.isFunctionDeclaration(declaration) && declaration.body) return { declaration, body: declaration.body };
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) return { declaration, body: declaration.initializer };
    }
    return null;
  };

  /**
   * The `{ provide: <token>, ... }` provider literals of `file` whose token is `name` imported from `moduleName`, in source order.
   * A call or a spread of a function or a const declared in another file of the program is followed (to a depth of four), so a
   * helper that builds the `APP_GUARD` or `APP_FILTER` entries outside the app root file is read too: the entry's `node` is then the
   * call or spread inside the app root (where the entry is provided), its `useClass` and `checker` those of the helper's file.
   */
  const providersOf = (file, name, moduleName) => {
    const found = [];
    const seen = new Set();
    const scan = (root, anchor, depth) => {
      const checker = checkerOf(root.getSourceFile());
      walk(root, node => {
        if (ts.isObjectLiteralExpression(node)) {
          const provide = propertyOf(node, 'provide');
          if (provide && isImportOf(checker, valueOfProperty(provide), name, moduleName)) {
            const use = propertyOf(node, 'useClass');
            found.push({ node: anchor ?? node, useClass: use ? valueOfProperty(use) : null, checker });
          }
          return true;
        }
        const reference = ts.isSpreadElement(node) ? node.expression : (ts.isCallExpression(node) ? node : null);
        if (reference && depth < HELPER_DEPTH) {
          const helper = helperBodyOf(checker, reference);
          if (helper && !seen.has(helper.declaration)) {
            seen.add(helper.declaration);
            scan(helper.body, anchor ?? node, depth + 1);
          }
        }
        return true;
      });
    };
    scan(file.sourceFile, null, 0);
    return found.sort((a, b) => a.node.getStart() - b.node.getStart());
  };

  return { ts, resolver, providersOf, checkerOf, aliased, symbolAt, importBinding, isImportOf, declarationsOf, graphPath, graphFile, ownerOfDeclaration,
    stringValue, walk, decorators, isExported, propertyNameText, propertyOf, valueOfProperty, at, appRoot };
}

export const upperSnake = name => name.replace(/-/g, '_').toUpperCase();
export const pascal = name => name.split('-').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join('');
