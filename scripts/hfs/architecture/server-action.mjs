/** The value of a directive-prologue statement, or null once the prologue has ended. */
function directiveValue(ts, sourceFile, statement) {
  const expressionStatement = ts?.isExpressionStatement
    ? ts.isExpressionStatement(statement)
    : Boolean(statement?.expression);
  if (!expressionStatement) return null;
  const expression = statement.expression;
  if (ts?.isStringLiteral) return ts.isStringLiteral(expression) ? expression.text : null;
  const raw = expression?.getText?.(sourceFile);
  const quote = raw?.[0];
  return typeof expression?.text === 'string' && (quote === "'" || quote === '"') && raw.at(-1) === quote
    ? expression.text
    : null;
}

/** True when a TypeScript source file declares `"use server"` in its directive prologue. */
export function isServerActionModule(ts, sourceFile) {
  for (const statement of sourceFile?.statements ?? []) {
    const value = directiveValue(ts, sourceFile, statement);
    if (value === null) return false;
    if (value === 'use server') return true;
  }
  return false;
}
