import path from 'node:path';

export const keyOf = (ts, property) => (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ? property.name.text : null;
const exported = (ts, statement) => statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;

/** A variable export is callable only when each declaration is a directly defined function. */
function callableVariables(ts, statement) {
  const names = [];
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return null;
    if (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) return null;
    names.push(declaration.name.text);
  }
  return names;
}

/** Callable declarations and type-only declarations of an exported statement. */
function callableExports(ts, statement) {
  if (!exported(ts, statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) return [];
  if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) return [statement.name.text];
  return ts.isVariableStatement(statement) ? callableVariables(ts, statement) : null;
}

/** The callable exports of a function-only subject; classes and other runtime exports keep the class-provider check. */
export function functionSubjectExports(ts, sourceFile) {
  const names = [];
  for (const statement of sourceFile.statements) {
    if (ts.isClassDeclaration(statement) || ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) return null;
    const callable = callableExports(ts, statement);
    if (!callable) return null;
    names.push(...callable);
  }
  return names.length ? names : null;
}

/** The value of one literal object property. */
const propertyValue = (ts, object, key) => {
  const property = object.properties.find(item => keyOf(ts, item) === key);
  return property && ts.isPropertyAssignment(property) ? property.initializer : null;
};

/** A literal value object maps every exported function to its real sibling import. */
function realFunctions(ts, value, names, imports, rel, serviceRel) {
  if (!value || !ts.isObjectLiteralExpression(value) || value.properties.length !== names.length) return false;
  const remaining = new Set(names);
  for (const property of value.properties) {
    const key = keyOf(ts, property);
    const identifier = ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer;
    if (!remaining.delete(key) || !identifier || !ts.isIdentifier(identifier)) return false;
    const binding = imports.get(identifier.text);
    if (!binding || binding.name !== key || !binding.module.startsWith('.')) return false;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), binding.module)).replace(/\.[cm]?[jt]s$/u, '');
    if (target !== serviceRel.replace(/\.ts$/u, '')) return false;
  }
  return remaining.size === 0;
}

/** Every node satisfying a predicate, within one spec. */
function matchingNodes(ts, root, predicate) {
  const found = [];
  const visit = node => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/** The declared variable initialized by an expression, including its await and call chain. */
function initializedVariable(ts, expression) {
  let cursor = expression;
  let compiled = false;
  let awaited = false;
  while (cursor.parent && (ts.isAwaitExpression(cursor.parent) || ts.isPropertyAccessExpression(cursor.parent) || ts.isCallExpression(cursor.parent))) {
    cursor = cursor.parent;
    if (ts.isAwaitExpression(cursor)) awaited = true;
    if (ts.isCallExpression(cursor) && ts.isPropertyAccessExpression(cursor.expression) && cursor.expression.name.text === 'compile') compiled = true;
  }
  if (!compiled || !awaited) return null;
  const declaration = cursor.parent;
  return declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) ? declaration.name.text : null;
}

/** The subject variable receiving module.get, whether declared there or assigned in beforeEach. */
function retrievedVariable(ts, call) {
  let cursor = call;
  while (cursor.parent && (ts.isAwaitExpression(cursor.parent) || ts.isParenthesizedExpression(cursor.parent))) cursor = cursor.parent;
  const parent = cursor.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(parent.left)) return parent.left.text;
  return null;
}

/** A helper returning the retrieved subject is followed to the variable receiving its result. */
function retrievedSubjects(ts, read, sourceFile) {
  const direct = retrievedVariable(ts, read);
  if (direct) return [direct];
  if (!read.parent || !ts.isReturnStatement(read.parent)) return [];
  let helper = read.parent;
  while (helper.parent && !ts.isFunctionLike(helper)) helper = helper.parent;
  const name = helper.name?.text ?? helper.parent?.name?.text;
  if (!name) return [];
  return matchingNodes(ts, sourceFile, node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name)
    .map(node => retrievedVariable(ts, node)).filter(Boolean);
}

/** The same compiled module retrieves the matching token and its result actually calls a subject function. */
function retrievedSubjectUsed(ts, call, token, names) {
  const moduleName = initializedVariable(ts, call);
  if (!moduleName) return false;
  const sourceFile = call.getSourceFile();
  const reads = matchingNodes(ts, sourceFile, node => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
    const member = node.expression;
    return ts.isIdentifier(member.expression) && member.expression.text === moduleName && member.name.text === 'get'
      && node.arguments.length === 1 && ts.isIdentifier(node.arguments[0]) && node.arguments[0].text === token.text;
  });
  return reads.some(read => {
    const subjects = retrievedSubjects(ts, read, sourceFile);
    return matchingNodes(ts, sourceFile, node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression) && subjects.includes(node.expression.expression.text) && names.includes(node.expression.name.text)).length > 0;
  });
}

/** A pure function service has exactly one real subject value provider, retrieved and exercised through Nest. */
export function checkFunctionSubject({ ts, rel, serviceRel, imports, call, list, names, report }) {
  const provider = list.elements[0];
  const shape = provider && ts.isObjectLiteralExpression(provider) && provider.properties.length === 2;
  const token = shape ? propertyValue(ts, provider, 'provide') : null;
  const value = shape ? propertyValue(ts, provider, 'useValue') : null;
  if (list.elements.length !== 1 || !token || !ts.isIdentifier(token) || !realFunctions(ts, value, names, imports, rel, serviceRel)) {
    report(provider ?? list, `${rel}: a function-only subject needs exactly one { provide: TOKEN, useValue: { ...realFunctions } } provider containing every callable export imported from ./${path.posix.basename(serviceRel, '.ts')}.`);
    return;
  }
  if (!retrievedSubjectUsed(ts, call, token, names)) report(list, `${rel}: retrieve the function subject with moduleRef.get(TOKEN) from this compiled testing module and exercise a function on the returned subject.`);
}
