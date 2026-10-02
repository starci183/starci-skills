// supabase-ast.mjs - shared TypeScript-symbol and expression helpers for the front-end and back-end Supabase
// architecture checks. Recognition follows imported declarations and inferred types, never local spelling alone.
export const SUPABASE_MODULES = new Set(['@supabase/ssr', '@supabase/supabase-js']);

export const moduleNameOf = (ts, node) => {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) return node.moduleSpecifier.text;
  if (!ts.isCallExpression(node)) return null;
  const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const required = ts.isIdentifier(node.expression) && node.expression.text === 'require';
  return (dynamic || required) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : null;
};

export const importedFrom = (kit, checker, node, modules, names = null) => {
  const binding = kit.importBinding(checker, node);
  return Boolean(binding && modules.has(binding.module) && (names === null || names.has(binding.name)));
};

const declarationFromSupabase = (declaration) => /(?:^|\/)node_modules\/@supabase\/(?:ssr|supabase-js)(?:\/|$)/u
  .test(String(declaration?.getSourceFile?.().fileName ?? '').replace(/\\/gu, '/'));

const typeFromSupabase = (checker, node) => {
  let type;
  try { type = checker.getTypeAtLocation(node); } catch { return false; }
  const queue = [type];
  const seen = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    if ([item.symbol, item.aliasSymbol].some((symbol) => symbol?.declarations?.some(declarationFromSupabase))) return true;
    if (item.types) queue.push(...item.types);
    if (item.target && item.target !== item) queue.push(item.target);
  }
  return false;
};

export const signatureFromSupabase = (checker, call) => {
  try { return declarationFromSupabase(checker.getResolvedSignature(call)?.declaration); } catch { return false; }
};

export const unwrap = (ts, node) => {
  let current = node;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAwaitExpression(current) || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current))) current = current.expression;
  return current;
};

export const isSupabaseValue = (kit, checker, node) => {
  const current = unwrap(kit.ts, node);
  if (!current) return false;
  if (importedFrom(kit, checker, current, SUPABASE_MODULES)) return true;
  if (kit.ts.isCallExpression(current) && signatureFromSupabase(checker, current)) return true;
  return typeFromSupabase(checker, current);
};

export const callName = (ts, call) => ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : null;

export const chainParts = (ts, expression) => {
  const names = [];
  let current = unwrap(ts, expression);
  while (current) {
    if (ts.isCallExpression(current)) {
      if (ts.isPropertyAccessExpression(current.expression)) {
        names.unshift(current.expression.name.text);
        current = unwrap(ts, current.expression.expression);
        continue;
      }
      current = unwrap(ts, current.expression);
      continue;
    }
    if (ts.isPropertyAccessExpression(current)) {
      names.unshift(current.name.text);
      current = unwrap(ts, current.expression);
      continue;
    }
    break;
  }
  return names;
};

export const isSupabaseCall = (kit, checker, node) => kit.ts.isCallExpression(node)
  && (signatureFromSupabase(checker, node) || isSupabaseValue(kit, checker, kit.ts.isPropertyAccessExpression(node.expression) ? node.expression.expression : node.expression));

export const isDatabaseType = (ts, node) => {
  if (!node) return false;
  if (ts.isTypeReferenceNode(node)) {
    const name = ts.isIdentifier(node.typeName) ? node.typeName.text : node.typeName.right.text;
    return name === 'Database';
  }
  return false;
};

export const supabaseClientType = (kit, checker, node) => {
  if (!node || !kit.ts.isTypeReferenceNode(node)) return false;
  const name = kit.ts.isIdentifier(node.typeName) ? node.typeName : null;
  return Boolean(name && importedFrom(kit, checker, name, SUPABASE_MODULES, new Set(['SupabaseClient'])));
};

export const contextTypesClient = (kit, checker, call) => {
  let parent = call.parent;
  while (parent && (kit.ts.isParenthesizedExpression(parent) || kit.ts.isAsExpression(parent))) {
    if (kit.ts.isAsExpression(parent) && supabaseClientType(kit, checker, parent.type) && isDatabaseType(kit.ts, parent.type.typeArguments?.[0])) return true;
    parent = parent.parent;
  }
  return kit.ts.isVariableDeclaration(parent) && supabaseClientType(kit, checker, parent.type)
    && isDatabaseType(kit.ts, parent.type.typeArguments?.[0]);
};

export const reportAt = (violations, kit, ruleId, file, node, message, extra = {}) => {
  violations.push({ ruleId, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
};
