// failure-code-reads.mjs - the UPPER_SNAKE literals of a script that READ a value another producer made, or only describe one in a comment,
// and so are not emitted failure codes (scripts/checks/check-failure-codes.mjs adds these quote offsets to its exact-AST exclusions).
//   - a literal inside a comment (a name mentioned in prose is not emitted);
//   - an operand of ===, !==, == or != against a non-literal, or a `case` label (the code is compared, not produced);
//   - an argument of a string or collection query (endsWith, startsWith, includes, indexOf, has, get);
//   - an element of an array literal whose only use here is `.includes(x)` / `.indexOf(x)` against a non-literal (a membership test);
//   - the symbol half of a (symbol, package) argument pair such as `providersOf(root, 'APP_GUARD', '@nestjs/core')`: a name another package exports;
//   - a literal the script declares as an enum member by identity (`Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE"`), wherever it then appears: the value of an enum-like constant, not a code;
//   - the value of a property named `type` (a discriminator of someone else's API, such as a token type).
// Emission sites (code:, reason:, finding(...), thrown messages, code lists) are never matched here. Proven by the package spec
// src/failure-code-reads.spec.mjs over the bundled copy of this file.

const EQUALITY = new Set(['===', '!==', '==', '!=']);
const QUERY_METHODS = new Set(['endsWith', 'startsWith', 'includes', 'indexOf', 'has', 'get']);
const MEMBERSHIP_METHODS = new Set(['includes', 'indexOf']);

const isText = (t, node) => t.isStringLiteralLike(node);

/** Whether `node` is the operand of an equality against a value that is not itself a literal. */
function comparedValue(t, source, node) {
  const parent = node.parent;
  if (!parent || !t.isBinaryExpression(parent) || !EQUALITY.has(parent.operatorToken.getText(source))) return false;
  const other = parent.left === node ? parent.right : parent.left;
  return !isText(t, other);
}

/** Whether `node` is an argument of a string/collection query call such as `key.endsWith('X_Y')`. */
function queryArgument(t, node) {
  const call = node.parent;
  return Boolean(call && t.isCallExpression(call) && call.arguments.includes(node)
    && t.isPropertyAccessExpression(call.expression) && QUERY_METHODS.has(call.expression.name.text));
}

/** Whether `node` is an element of an array literal that is only tested with `.includes(value)` for a non-literal value. */
function membershipElement(t, node) {
  const array = node.parent;
  if (!array || !t.isArrayLiteralExpression(array)) return false;
  const access = array.parent;
  if (!access || !t.isPropertyAccessExpression(access) || access.expression !== array || !MEMBERSHIP_METHODS.has(access.name.text)) return false;
  const call = access.parent;
  return Boolean(call && t.isCallExpression(call) && call.expression === access && call.arguments.length >= 1 && !isText(t, call.arguments[0]));
}

const PACKAGE_SPECIFIER = /^(?:@[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?|\.{1,2}\/[\w./-]+)$/;

/** Whether `node` is a call argument directly followed by a package or relative module specifier: the name of a symbol that module exports. */
function importedSymbol(t, node) {
  const call = node.parent;
  if (!call || !t.isCallExpression(call)) return false;
  const next = call.arguments[call.arguments.indexOf(node) + 1];
  return Boolean(next && isText(t, next) && PACKAGE_SPECIFIER.test(next.text));
}

const caseLabel = (t, node) => Boolean(node.parent && t.isCaseClause(node.parent) && node.parent.expression === node);

const discriminator = (t, node) => Boolean(node.parent && t.isPropertyAssignment(node.parent) && node.parent.initializer === node
  && t.isIdentifier(node.parent.name) && node.parent.name.text === 'type');

/** The [pos, end) ranges of every comment of `source`. */
function commentRanges(t, source) {
  const text = source.text, ranges = [];
  const visit = (node) => {
    for (const range of t.getLeadingCommentRanges(text, node.getFullStart()) ?? []) ranges.push([range.pos, range.end]);
    for (const range of t.getTrailingCommentRanges(text, node.end) ?? []) ranges.push([range.pos, range.end]);
    t.forEachChild(node, visit);
  };
  visit(source);
  return ranges;
}

/**
 * The offsets to leave out of UPPER literal discovery for a parsed script: the opening quote of every read literal, and the start
 * of every `patterns` match (RegExp with the g flag) that lies inside a comment.
 */
export function nonEmittingOffsets(t, source, patterns = []) {
  const offsets = new Set();
  const members = new Set();
  const collect = (node) => {
    if (t.isBinaryExpression(node) && node.operatorToken.kind === t.SyntaxKind.EqualsToken && t.isPropertyAccessExpression(node.left)
      && isText(t, node.right) && node.right.text === node.left.name.text) members.add(node.right.text);
    t.forEachChild(node, collect);
  };
  collect(source);
  const visit = (node) => {
    if (isText(t, node) && (members.has(node.text) || comparedValue(t, source, node) || queryArgument(t, node) || membershipElement(t, node) || caseLabel(t, node) || importedSymbol(t, node) || discriminator(t, node))) {
      offsets.add(node.getStart(source));
    }
    t.forEachChild(node, visit);
  };
  visit(source);
  const ranges = commentRanges(t, source);
  if (ranges.length) {
    for (const pattern of patterns) {
      for (const match of source.text.matchAll(pattern)) {
        if (ranges.some(([pos, end]) => match.index >= pos && match.index < end)) offsets.add(match.index);
      }
    }
  }
  return offsets;
}
