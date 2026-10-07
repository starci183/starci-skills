import { chainParts, isSupabaseCall, isSupabaseValue, reportAt, unwrap } from './supabase-ast.mjs';
import { machineKit } from './machine-ast.mjs';

/**
 * The front-end Supabase result checks (FE_DB_RESULT_TYPED, FE_DB_ERROR_HANDLED): a query result keeps its inferred row type, a list read is
 * bounded, and the awaited result is either passed whole to `toOutcome` or has its error read.
 */
const FE_RESULT_TYPED = 'FE_DB_RESULT_TYPED';
const FE_ERROR_HANDLED = 'FE_DB_ERROR_HANDLED';
export const FE_DB_SLOTS = new Set(['fe.modules.db', 'fe.package.db', 'fe.modules.db.outcome']);
const QUERY_TERMINALS = new Set(['single', 'maybeSingle', 'returns']);
const QUERY_WRITES = new Set(['insert', 'update', 'upsert', 'delete']);
const LIST_BOUNDS = new Set(['gt', 'gte', 'lt', 'lte', 'range']);

export const symbolOf = (kit, checker, node) => kit.aliased(checker, kit.symbolAt(checker, node)) ?? kit.symbolAt(checker, node);

export const sameSymbol = (kit, checker, node, symbol) => Boolean(symbol && symbolOf(kit, checker, node) === symbol);

const fromAwaitedSupabase = (kit, checker, node, seen = new Set()) => {
  const current = unwrap(kit.ts, node);
  if (!current || seen.has(current)) return false;
  seen.add(current);
  if (kit.ts.isCallExpression(current)) return isSupabaseCall(kit, checker, current);
  if (!kit.ts.isIdentifier(current)) return false;
  for (const declaration of kit.declarationsOf(checker, current)) {
    if (kit.ts.isVariableDeclaration(declaration) && declaration.initializer && fromAwaitedSupabase(kit, checker, declaration.initializer, seen)) return true;
  }
  return false;
};

const callIsToOutcome = (kit, checker, graph, call) => {
  if (!kit.ts.isCallExpression(call)) return false;
  const expression = call.expression;
  let name = null;
  if (kit.ts.isIdentifier(expression)) name = expression.text;
  else if (kit.ts.isPropertyAccessExpression(expression)) name = expression.name.text;
  if (name !== 'toOutcome') return false;
  return kit.declarationsOf(checker, kit.ts.isPropertyAccessExpression(expression) ? expression.name : expression)
    .some(declaration => {
      const rel = kit.graphPath(declaration);
      return rel !== null && FE_DB_SLOTS.has(graph.files.get(rel)?.slot);
    });
};

const parentCall = (ts, node) => {
  let current = node;
  while (current.parent && ts.isParenthesizedExpression(current.parent)) current = current.parent;
  return ts.isCallExpression(current.parent) ? current.parent : null;
};

/** True when `node` reads `.error` / `['error']` of the result symbol, or passes the result whole to toOutcome. */
const readsResultError = (kit, checker, graph, node, result) => {
  const { ts } = kit;
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'error' && sameSymbol(kit, checker, node.expression, result)) return true;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'error' && sameSymbol(kit, checker, node.expression, result)) return true;
  return ts.isCallExpression(node) && callIsToOutcome(kit, checker, graph, node)
    && node.arguments.some(argument => sameSymbol(kit, checker, unwrap(ts, argument), result));
};

/** A result bound to one identifier is handled when the file reads its error or hands it whole to toOutcome. */
const identifierResultHandled = (kit, checker, graph, awaitNode, declaration) => {
  const result = symbolOf(kit, checker, declaration.name);
  let handled = false;
  kit.walk(awaitNode.getSourceFile(), node => {
    if (readsResultError(kit, checker, graph, node, result)) handled = true;
    return !handled;
  });
  return handled;
};

/** A result destructured into `{ error }` is handled when the bound error is referenced beyond its binding. */
const destructuredResultHandled = (kit, checker, awaitNode, declaration) => {
  const errorBinding = declaration.name.elements.find(element => {
    const property = element.propertyName ?? element.name;
    return kit.ts.isIdentifier(property) && property.text === 'error';
  });
  if (!errorBinding || !kit.ts.isIdentifier(errorBinding.name)) return false;
  const error = symbolOf(kit, checker, errorBinding.name);
  let references = 0;
  kit.walk(awaitNode.getSourceFile(), node => {
    if (kit.ts.isIdentifier(node) && sameSymbol(kit, checker, node, error)) references += 1;
    return true;
  });
  return references > 1;
};

const handledAwait = (kit, checker, graph, awaitNode) => {
  const direct = parentCall(kit.ts, awaitNode);
  if (direct && callIsToOutcome(kit, checker, graph, direct) && direct.arguments.some(argument => argument === awaitNode || argument === awaitNode.parent)) return true;
  let cursor = awaitNode;
  while (cursor.parent && kit.ts.isParenthesizedExpression(cursor.parent)) cursor = cursor.parent;
  const declaration = kit.ts.isVariableDeclaration(cursor.parent) ? cursor.parent : null;
  if (!declaration) return false;
  if (kit.ts.isIdentifier(declaration.name)) return identifierResultHandled(kit, checker, graph, awaitNode, declaration);
  if (!kit.ts.isObjectBindingPattern(declaration.name)) return false;
  return destructuredResultHandled(kit, checker, awaitNode, declaration);
};

const dataSymbolFromAwait = (kit, checker, identifier) => {
  const symbol = symbolOf(kit, checker, identifier);
  for (const declaration of symbol?.declarations ?? []) {
    if (!kit.ts.isBindingElement(declaration) || !kit.ts.isObjectBindingPattern(declaration.parent)) continue;
    const property = declaration.propertyName ?? declaration.name;
    if (!kit.ts.isIdentifier(property) || property.text !== 'data') continue;
    const variable = declaration.parent.parent;
    if (kit.ts.isVariableDeclaration(variable) && variable.initializer && fromAwaitedSupabase(kit, checker, variable.initializer)) return symbol;
  }
  return null;
};

function inspectResultGeneric(scope, node) {
  const { ts, kit, checker, report } = scope;
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && QUERY_TERMINALS.has(node.expression.name.text)
    && node.typeArguments?.length && isSupabaseValue(kit, checker, node.expression.expression)) {
    report(FE_RESULT_TYPED, node, `${node.expression.name.text}<T>() supplies a result generic; derive the row type from Database and let the Supabase chain infer it.`);
  }
}

function inspectResultCast(scope, node) {
  const { ts, kit, checker, report } = scope;
  if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) && fromAwaitedSupabase(kit, checker, node.expression)) {
    report(FE_RESULT_TYPED, node, 'A Supabase query result is cast or non-null asserted; narrow its typed data/error outcome instead.');
  }
}

/** Counts a multi-row read and reports it when no limit, range or keyset bound applies. */
function inspectListRead(scope, node, methods) {
  const isListRead = methods.includes('select') && !methods.some(method => QUERY_WRITES.has(method)) && !methods.includes('single') && !methods.includes('maybeSingle');
  if (!isListRead) return;
  scope.counters.listReads += 1;
  if (!methods.includes('limit') && !methods.some(method => LIST_BOUNDS.has(method))) {
    scope.report(FE_RESULT_TYPED, node, 'A Supabase list read has no .limit(), .range(), or keyset bound (.gt/.gte/.lt/.lte); bound every multi-row read.');
  }
}

function inspectAwaitedResult(scope, node) {
  const { ts, kit, checker, report, graph, counters } = scope;
  if (!ts.isAwaitExpression(node) || !isSupabaseValue(kit, checker, node.expression)) return;
  const expression = unwrap(ts, node.expression);
  if (!ts.isCallExpression(expression)) return;
  counters.awaited += 1;
  inspectListRead(scope, node, chainParts(ts, expression));
  if (!handledAwait(kit, checker, graph, node)) {
    report(FE_ERROR_HANDLED, node, 'The awaited Supabase result does not read its error and is not passed whole to toOutcome(result).');
  }
}

function inspectSwallowedData(scope, node) {
  const { ts, kit, checker, report } = scope;
  if (!(ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && ts.isArrayLiteralExpression(node.right) && node.right.elements.length === 0)) return;
  const left = unwrap(ts, node.left);
  const swallowed = ts.isIdentifier(left) ? Boolean(dataSymbolFromAwait(kit, checker, left))
    : ts.isPropertyAccessExpression(left) && left.name.text === 'data' && fromAwaitedSupabase(kit, checker, left.expression);
  if (swallowed) report(FE_ERROR_HANDLED, node, 'Supabase data is collapsed with ?? []; refused or unavailable is not empty data. Pass the whole result to toOutcome.');
}

function inspectQueryResultNode(scope, node) {
  inspectResultGeneric(scope, node);
  inspectResultCast(scope, node);
  inspectAwaitedResult(scope, node);
  inspectSwallowedData(scope, node);
  return true;
}

export function checkFrontendQueryResults(input) {
  const kit = machineKit(input);
  const violations = [];
  const counters = { awaited: 0, listReads: 0 };
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const seen = new Set();
    const report = (ruleId, node, message) => {
      const key = `${ruleId}:${node.pos}:${message}`;
      if (seen.has(key)) return;
      seen.add(key);
      reportAt(violations, kit, ruleId, file, node, message);
    };
    const scope = { ts: kit.ts, kit, checker, report, graph: input.graph, counters };
    kit.walk(file.sourceFile, node => inspectQueryResultNode(scope, node));
  }
  return { violations, coverage: { status: 'checked', awaited: counters.awaited, listReads: counters.listReads } };
}
