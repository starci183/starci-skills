// Import and namespace consumption analysis shared by dead-export edges.
import path from 'node:path';

/** Disk/staged test consumers have no production checker; bind their local names without resolving dependencies. */
const namespaceChecker = (context, sourceFile, namespace) => {
  if (context.namespaceCheckers.has(sourceFile)) return context.namespaceCheckers.get(sourceFile);
  const { ts } = context;
  let checker = context.checkerFor?.(sourceFile.fileName);
  if (!checker?.getSymbolAtLocation(namespace.name)) {
    const options = { noResolve: true, noLib: true, types: [], allowJs: true, target: ts.ScriptTarget.Latest };
    const host = ts.createCompilerHost(options);
    const filename = path.resolve(sourceFile.fileName);
    host.getSourceFile = file => path.resolve(file) === filename ? sourceFile : undefined;
    host.fileExists = file => path.resolve(file) === filename;
    host.readFile = file => path.resolve(file) === filename ? sourceFile.text : undefined;
    checker = ts.createProgram([filename], options, host).getTypeChecker();
  }
  context.namespaceCheckers.set(sourceFile, checker);
  return checker;
};

const transparentExpression = (ts, node) => node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
  || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node));

const literalMember = (ts, node) => {
  while (transparentExpression(ts, node)) node = node.expression;
  return node && (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) ? node.text : null;
};

const destructuredMember = (ts, name) => {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isComputedPropertyName(name)) return literalMember(ts, name.expression);
  return literalMember(ts, name);
};

/** A destructuring alias consumes the property's name, while a rest/computed binding may consume every export. */
const destructuredBindings = (ts, pattern) => {
  const names = [];
  const elements = ts.isObjectBindingPattern(pattern) ? pattern.elements : pattern.properties;
  for (const element of elements) {
    if (element.dotDotDotToken || ts.isSpreadAssignment(element)) return { all: true, pairs: [] };
    const name = destructuredMember(ts, element.propertyName ?? element.name);
    if (name === null) return { all: true, pairs: [] };
    names.push(name);
  }
  return { all: false, pairs: names.map(imported => ({ imported, exported: null })) };
};

const namespaceReference = (ts, checker, symbol, node) => {
  if (checker.getSymbolAtLocation(node) === symbol) return true;
  const parent = node.parent;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return checker.getShorthandAssignmentValueSymbol(parent) === symbol;
  return ts.isExportSpecifier(parent) && node === (parent.propertyName ?? parent.name)
    && checker.getExportSpecifierLocalTargetSymbol(parent) === symbol;
};

const unwrappedNamespace = (ts, node) => {
  while (transparentExpression(ts, node.parent)) node = node.parent;
  return node;
};

const indexedNamespaceMember = (ts, node) => {
  if (!ts.isTypeQueryNode(node.parent) || node.parent.exprName !== node) return null;
  let query = node.parent;
  while (ts.isParenthesizedTypeNode(query.parent)) query = query.parent;
  const indexed = query.parent;
  return ts.isIndexedAccessTypeNode(indexed) && indexed.objectType === query && ts.isLiteralTypeNode(indexed.indexType)
    ? literalMember(ts, indexed.indexType.literal) : null;
};

/** The first member is the entry export even in a chain such as namespace.Enum.Member or namespace.Type.Inner. */
const namespaceUse = (ts, reference) => {
  const node = unwrappedNamespace(ts, reference);
  const parent = node.parent;
  let name = null;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) name = parent.name.text;
  else if (ts.isQualifiedName(parent) && parent.left === node) name = parent.right.text;
  else if (ts.isElementAccessExpression(parent) && parent.expression === node) name = literalMember(ts, parent.argumentExpression);
  else if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isObjectBindingPattern(parent.name)) return destructuredBindings(ts, parent.name);
  else if (ts.isBinaryExpression(parent) && parent.right === node && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
    && ts.isObjectLiteralExpression(parent.left)) return destructuredBindings(ts, parent.left);
  else name = indexedNamespaceMember(ts, node);
  return name === null ? { all: true, pairs: [] } : { all: false, pairs: [{ imported: name, exported: null }] };
};

const namespaceBindings = (context, declaration, namespace) => {
  if (context.namespaceUses.has(namespace)) return context.namespaceUses.get(namespace);
  const { ts } = context;
  const sourceFile = declaration.getSourceFile();
  const checker = namespaceChecker(context, sourceFile, namespace);
  const symbol = checker.getSymbolAtLocation(namespace.name);
  const result = { all: false, pairs: [] };
  const visit = node => {
    if (ts.isJSDocSeeTag(node) || ts.isJSDocLink(node) || ts.isJSDocLinkCode(node) || ts.isJSDocLinkPlain(node)) return;
    if (ts.isIdentifier(node) && node !== namespace.name && namespaceReference(ts, checker, symbol, node)) {
      const used = namespaceUse(ts, node);
      result.all ||= used.all;
      result.pairs.push(...used.pairs);
    }
    if (!result.all) {
      ts.forEachChild(node, visit);
      for (const doc of node.jsDoc ?? []) visit(doc);
    }
  };
  // An unavailable binding must never turn an unknown consumer into a false unused-export finding.
  if (symbol) visit(sourceFile);
  else result.all = true;
  context.namespaceUses.set(namespace, result);
  return result;
};

const importBindings = (context, declaration) => {
  const { ts } = context;
  const clause = declaration.importClause;
  if (!clause) return { all: false, pairs: [] }; // side-effect import: uses nothing
  const pairs = [];
  if (clause.name) pairs.push({ imported: 'default', exported: null });
  const named = clause.namedBindings;
  if (named && named.kind === ts.SyntaxKind.NamespaceImport) {
    const namespace = namespaceBindings(context, declaration, named);
    return { all: namespace.all, pairs: [...pairs, ...namespace.pairs] };
  }
  if (named) for (const element of named.elements) pairs.push({ imported: (element.propertyName ?? element.name).text, exported: null });
  return { all: false, pairs };
};

const exportBindings = (ts, declaration) => {
  const clause = declaration.exportClause;
  if (!clause || clause.kind === ts.SyntaxKind.NamespaceExport) return { all: true, pairs: [] };
  return { all: false, pairs: clause.elements.map(element => ({ imported: (element.propertyName ?? element.name).text, exported: element.name.text })) };
};

const importTypeBindings = (ts, declaration) => {
  let qualifier = declaration.qualifier;
  if (!qualifier) return { all: true, pairs: [] };
  while (qualifier.kind === ts.SyntaxKind.QualifiedName) qualifier = qualifier.left;
  return { all: false, pairs: [{ imported: qualifier.text, exported: null }] };
};

/** Names an import/export declaration takes from its target: {all} or {pairs: [{imported, exported}]}. */
export function bindingsOf(context, declaration) {
  const { ts } = context;
  if (!declaration) return { all: true, pairs: [] };
  if (declaration.kind === ts.SyntaxKind.ImportDeclaration) return importBindings(context, declaration);
  if (declaration.kind === ts.SyntaxKind.ExportDeclaration) return exportBindings(ts, declaration);
  if (declaration.kind === ts.SyntaxKind.ImportTypeNode) return importTypeBindings(ts, declaration);
  // ImportEqualsDeclaration, dynamic import(), require(): the whole module is taken.
  return { all: true, pairs: [] };
}
