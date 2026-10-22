// Ordered object and JSX property provenance for R280; unknown writers remain barriers.
import { nameText } from '../../lib/ts-ast.mjs';
import { unwrapCatalogExpression as unwrap } from '../../lib/ts-analysis.mjs';

const ABSENT_PROPERTY = { values: [], missing: true };

/** A definite write replaces earlier provenance; a missing branch keeps it, and an unknown branch is a barrier. */
function mergeProperty(before, after) {
  if (after === null || !after.missing) return after;
  if (before === null) return null;
  return { values: [...before.values, ...after.values], missing: before.missing };
}

/** Every possible spread owner must be known before its property provenance is admitted. */
function spreadProperty(state, expression, name, seen, resolve) {
  const choices = resolve(state, expression, seen).map(owner => ownerProperty(state, owner, name, seen, resolve));
  if (!choices.length || choices.includes(null)) return null;
  return { values: choices.flatMap(choice => choice.values), missing: choices.some(choice => choice.missing) };
}

function entryProperty(state, entry, name, seen, resolve) {
  const { ts } = state;
  if (ts.isSpreadAssignment(entry) || ts.isJsxSpreadAttribute(entry)) return spreadProperty(state, entry.expression, name, seen, resolve);
  const key = nameText(ts, entry.name, { numbers: true });
  if (key === null) return null;
  if (key !== name) return ABSENT_PROPERTY;
  if (ts.isPropertyAssignment(entry)) return { values: [entry.initializer], missing: false };
  if (ts.isShorthandPropertyAssignment(entry)) return { values: [entry.name], missing: false };
  if (ts.isJsxAttribute(entry)) {
    const value = entry.initializer && (ts.isJsxExpression(entry.initializer) ? entry.initializer.expression : entry.initializer);
    return value ? { values: [value], missing: false } : null;
  }
  // A method or accessor owns the name, but does not establish a supported translator value.
  return null;
}

/** Fold writes in source order, with branch-local cycle detection and explicit absence. */
export function ownerProperty(state, owner, name, visited, resolve) {
  if ((!state.ts.isObjectLiteralExpression(owner) && !state.ts.isJsxAttributes(owner)) || visited.has(owner)) return null;
  const seen = new Set([...visited, owner]);
  return owner.properties.reduce((before, entry) => mergeProperty(before, entryProperty(state, entry, name, seen, resolve)), ABSENT_PROPERTY);
}

/** The expression bound to name in a known object literal or a JSX attribute list. */
export function propertyValues(state, owner, name, seen, resolve) {
  const property = ownerProperty(state, owner, name, seen, resolve);
  return property && !property.missing ? property.values : [];
}

/** Unknown or missing owner branches cannot disappear beside a known property branch. */
export function propertiesOf(state, owners, name, seen, resolve) {
  const groups = owners.map(owner => propertyValues(state, owner, name, seen, resolve));
  return groups.length && groups.every(group => group.length) ? groups.flat() : [];
}

function returnsAbruptly(ts, statement) {
  const own = ts.isBlock(statement) && statement.statements.length === 1 ? statement.statements[0] : statement;
  return ts.isReturnStatement(own) || ts.isThrowStatement(own);
}

function sameReference(state, left, right) {
  const { ts, checker } = state;
  const a = unwrap(ts, left), b = unwrap(ts, right);
  if (!a || !b) return false;
  if (ts.isIdentifier(a) && ts.isIdentifier(b)) return checker.getSymbolAtLocation(a) === checker.getSymbolAtLocation(b);
  return ts.isPropertyAccessExpression(a) && ts.isPropertyAccessExpression(b)
    && a.name.text === b.name.text && sameReference(state, a.expression, b.expression);
}

function comparesNull(state, expression, reference, negative = false) {
  const { ts } = state;
  const node = unwrap(ts, expression);
  const operator = negative ? ts.SyntaxKind.ExclamationEqualsEqualsToken : ts.SyntaxKind.EqualsEqualsEqualsToken;
  if (!node || !ts.isBinaryExpression(node) || node.operatorToken.kind !== operator) return false;
  return [[node.left, node.right], [node.right, node.left]].some(([value, nil]) =>
    nil.kind === ts.SyntaxKind.NullKeyword && sameReference(state, value, reference));
}

function immutableReference(state, expression) {
  const { ts } = state;
  let root = unwrap(ts, expression);
  while (root && ts.isPropertyAccessExpression(root)) root = root.expression;
  if (!root || !ts.isIdentifier(root)) return false;
  let declaration = state.checker.getSymbolAtLocation(root)?.valueDeclaration;
  while (declaration && ts.isBindingElement(declaration)) declaration = declaration.parent.parent;
  return Boolean(declaration && ts.isVariableDeclaration(declaration) && (declaration.parent.flags & ts.NodeFlags.Const));
}

function assignmentTarget(state, expression, matches) {
  const { ts } = state;
  const node = unwrap(ts, expression);
  if (!node) return false;
  if (matches(node)) return true;
  if (ts.isArrayLiteralExpression(node)) return node.elements.some(element => assignmentTarget(state, element, matches));
  if (ts.isObjectLiteralExpression(node)) return node.properties.some(entry => assignmentTarget(state,
    ts.isShorthandPropertyAssignment(entry) ? entry.name : entry.initializer ?? entry.expression, matches));
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) return assignmentTarget(state, node.left, matches);
  return (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) && assignmentTarget(state, node.expression, matches);
}

/** All assignment forms share one target traversal; each consumer owns the reference it invalidates. */
export function writesTarget(state, node, matches) {
  const { ts } = state;
  let written = false;
  const visit = own => {
    const assignment = ts.isBinaryExpression(own) && own.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && own.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
    const unary = (ts.isPrefixUnaryExpression(own) || ts.isPostfixUnaryExpression(own)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(own.operator);
    if ((assignment && assignmentTarget(state, own.left, matches)) || (unary && assignmentTarget(state, own.operand, matches))
      || ((ts.isForOfStatement(own) || ts.isForInStatement(own)) && assignmentTarget(state, own.initializer, matches))) written = true;
    if (!written) ts.forEachChild(own, visit);
  };
  if (node) visit(node);
  return written;
}

function writesReference(state, node, reference) {
  return writesTarget(state, node, target => {
    for (let own = unwrap(state.ts, reference); own; own = state.ts.isPropertyAccessExpression(own) ? unwrap(state.ts, own.expression) : null) {
      if (sameReference(state, target, own)) return true;
    }
    return false;
  });
}

function priorReferenceWrite(state, node) {
  const { ts } = state;
  for (let child = node; child.parent; child = child.parent) {
    const parent = child.parent;
    if (ts.isClassLike(parent)) break;
    if (ts.isFunctionLike(parent)) return !ts.isBlock(child) && writesReference(state, child, node);
    if (ts.isBlock(parent) && parent.statements.slice(0, parent.statements.indexOf(child) + 1).some(statement => writesReference(state, statement, node))) return true;
  }
  return false;
}

function conditionalExcludesNull(state, node) {
  const { ts } = state;
  for (let child = node; child.parent; child = child.parent) {
    const parent = child.parent;
    if (ts.isFunctionLike(parent) || ts.isClassLike(parent)) return false;
    if (ts.isConditionalExpression(parent) && child !== parent.condition
      && comparesNull(state, parent.condition, node, child === parent.whenTrue) && !writesReference(state, parent, node)) return true;
  }
  return false;
}

/** Strict-null guards narrow only an immutable reference at its actual guarded use site. */
export function excludesNull(state, node) {
  const { ts } = state;
  if (!immutableReference(state, node) || priorReferenceWrite(state, node)) return false;
  if (conditionalExcludesNull(state, node)) return true;
  if (!ts.isIdentifier(node)) return false;
  let statement = node;
  while (statement.parent && !ts.isBlock(statement.parent)) {
    if (ts.isFunctionLike(statement.parent) || ts.isClassLike(statement.parent)) return false;
    statement = statement.parent;
  }
  if (!statement.parent || !ts.isBlock(statement.parent)) return false;
  const previous = statement.parent.statements.slice(0, statement.parent.statements.indexOf(statement));
  return previous.some(guard => ts.isIfStatement(guard) && !guard.elseStatement
    && comparesNull(state, guard.expression, node) && returnsAbruptly(ts, guard.thenStatement));
}
