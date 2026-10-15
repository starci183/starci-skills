// ts-ast.mjs — the small reads the hfs checks share over TypeScript's own AST: a node's name or
// literal text, a node's 1-based position, a named property's initializer text. `ts` is the caller's
// already-resolved compiler (see package-at.mjs loadTypescript); nothing here resolves a package.

/** Whether the single-bit `flag` (a ts.NodeFlags member) is set in `flags`: the bit read as arithmetic, no bitwise operator in the condition. */
export const hasFlag = (flags, flag) => Math.floor(flags / flag) % 2 === 1;

/** Whether any bit of `mask` (a ts flag or an OR of flags) is set in `flags` (absent flags read as none): an explicit comparison of the masked value. */
export const hasAnyFlag = (flags, mask) => ((flags ?? 0) & mask) !== 0;

/** Whether the variable `declaration` belongs to a `const` list: the TypeScript node-flag test, an explicit comparison of the masked flags. */
export const isConstVariable = (ts, declaration) => (ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const) !== 0;

/** Text of a string-literal-like node or an enabled identifier/numeric name; null for other expressions. */
export function nameText(ts, node, { identifiers = true, numbers = false } = {}) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node) || (identifiers && ts.isIdentifier(node)) || (numbers && ts.isNumericLiteral(node))) return node.text;
  return null;
}

/** A statically selected property name, including string-literal element access; null for computed selections. */
export function accessName(ts, node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return ts.isElementAccessExpression(node) ? literalText(ts, node.argumentExpression) : null;
}

/** The text of a string-literal-like `node` (a string literal or a no-substitution template), or null. */
export const literalText = (ts, node) => (node && ts.isStringLiteralLike(node) ? node.text : null);

/** The 1-based {line, column} of `node` in `sourceFile`. */
export const sourceLocation = (sourceFile, node) => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: position.line + 1, column: position.character + 1 };
};

/**
 * The `.text` of `key`'s property initializer in `text` (parsed as `file`): a property assignment
 * inside an object literal, or — `declaration: true` — a class property declaration. `kind` is
 * 'string' (a string-literal-like initializer) or 'identifier'. The last match wins; null when none.
 */
export function propertyText(ts, text, { file = 'source.ts', key, declaration = false, kind = 'string' } = {}) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let value = null;
  const visit = (node) => {
    const isProp = declaration ? ts.isPropertyDeclaration(node) : ts.isPropertyAssignment(node);
    if (isProp && node.name && ts.isIdentifier(node.name) && node.name.text === key && node.initializer) {
      const ok = kind === 'identifier' ? ts.isIdentifier(node.initializer) : ts.isStringLiteralLike(node.initializer);
      if (ok) value = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return value;
}

/** Initializers of every identifier-named variable, grouped in traversal order across the source's scopes. */
export function variableInitializerGroups(ts, source) {
  const groups = new Map();
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializers = groups.get(node.name.text) ?? [];
      initializers.push(node.initializer);
      groups.set(node.name.text, initializers);
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  return groups;
}
