/** The expression under the wrappers selected by an AST check's contract. */
export function unwrapExpression(ts, expression, { awaitExpressions = false, typeAssertions = true, nonNullExpressions = true, satisfiesExpressions = true } = {}) {
  while (expression && (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
    || (typeAssertions && ts.isTypeAssertionExpression(expression)) || (nonNullExpressions && ts.isNonNullExpression(expression))
    || (satisfiesExpressions && (ts.isSatisfiesExpression?.(expression) ?? false))
    || (awaitExpressions && ts.isAwaitExpression(expression)))) expression = expression.expression;
  return expression;
}

/** Local name -> imported name and module; callers select their existing module key and literal policy. */
export function importsOf(ts, sourceFile, { moduleKey = 'module', stringLiteralsOnly = false } = {}) {
  const imports = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || (stringLiteralsOnly && !ts.isStringLiteralLike(statement.moduleSpecifier))) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements) imports.set(binding.name.text, { name: (binding.propertyName ?? binding.name).text, [moduleKey]: statement.moduleSpecifier.text });
  }
  return imports;
}

/** Catalog values unwrap parentheses, `as`, and `satisfies`, preserving assertions and non-null nodes. */
export const unwrapCatalogExpression = (ts, node) => unwrapExpression(ts, node, { typeAssertions: false, nonNullExpressions: false });
