/** True when a TypeScript source file begins with the file-level `"use server"` directive. */
export function isServerActionModule(ts, sourceFile) {
  const first = sourceFile?.statements?.[0];
  return Boolean(first)
    && (ts?.isExpressionStatement ? ts.isExpressionStatement(first) : Boolean(first.expression))
    && (ts?.isStringLiteral ? ts.isStringLiteral(first.expression) : typeof first.expression?.text === 'string')
    && first.expression.text === 'use server';
}
