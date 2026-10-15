// Symbol reads shared by declared and inferred SWR lifecycle checks.
import { unwrapExpression } from './typescript.mjs';
import { normalizedSymbol, normalizedSymbolValue } from './ast-walks.mjs';
import { isConstVariable } from '../../lib/ts-ast.mjs';

export function functionNode(ts, declaration) {
  if (ts.isFunctionDeclaration(declaration) && declaration.body) return declaration;
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    const value = unwrapExpression(ts, declaration.initializer);
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return value;
  }
  return null;
}

export function constInitializer(ts, symbol) {
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer
    || !isConstVariable(ts, declarations[0])) return null;
  return declarations[0].initializer;
}

export function inferredSymbol(ts, checker, node) {
  return ts.isIdentifier(node) && ts.isShorthandPropertyAssignment(node.parent)
    ? normalizedSymbolValue(ts, checker, checker.getShorthandAssignmentValueSymbol(node.parent))
    : normalizedSymbol(ts, checker, node);
}
