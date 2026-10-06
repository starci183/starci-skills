import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { isServerActionModule } from './server-action.mjs';
import { callName, chainParts, contextTypesClient, isDatabaseType, isSupabaseCall, isSupabaseValue, moduleNameOf, reportAt, signatureFromSupabase, supabaseClientType, SUPABASE_MODULES, unwrap } from './supabase-ast.mjs';
import { checkBackendJwt } from './supabase-be.mjs';

/**
 * L10-L16, the slot-driven Supabase machine. Supabase is one data transport with one owner on each side:
 * `fe.modules.db` / `fe.package.db` in a front end and `be.integrations.supabase` in a back end. The checks below
 * recognise provider calls and types by their imported package declarations, not by local variable or type names.
 */
export const FRONTEND_SUPABASE_RULE_IDS = Object.freeze([
  'FE_SUPABASE_CLIENT_OWNER',
  'FE_DB_RESULT_TYPED',
  'FE_DB_ERROR_HANDLED',
  'FE_SERVICE_ROLE_FORBIDDEN',
  'FE_AUTH_SESSION_TRUST',
  'FE_DB_WRITE_SHAPE',
  'FE_ROUTE_HANDLER_FORBIDDEN',
]);
export const BACKEND_SUPABASE_RULE_IDS = Object.freeze(['BE_SUPABASE_CLIENT_OWNER', 'BE_SUPABASE_JWT_VERIFIED']);

const FE_CLIENT_OWNER = 'FE_SUPABASE_CLIENT_OWNER';
const BE_CLIENT_OWNER = 'BE_SUPABASE_CLIENT_OWNER';
const FE_RESULT_TYPED = 'FE_DB_RESULT_TYPED';
const FE_ERROR_HANDLED = 'FE_DB_ERROR_HANDLED';
const FE_SERVICE_ROLE = 'FE_SERVICE_ROLE_FORBIDDEN';
const FE_SESSION_TRUST = 'FE_AUTH_SESSION_TRUST';
const FE_WRITE_SHAPE = 'FE_DB_WRITE_SHAPE';
const FE_ROUTE_HANDLER = 'FE_ROUTE_HANDLER_FORBIDDEN';
const FE_DB_SLOTS = new Set(['fe.modules.db', 'fe.package.db', 'fe.modules.db.outcome']);
const BE_SUPABASE_SLOT = 'be.integrations.supabase';
const FE_CONFIG_SLOT = 'fe.modules.config';
const SUPABASE_CALLS = new Set(['from', 'rpc']);
const QUERY_TERMINALS = new Set(['single', 'maybeSingle', 'returns']);
const QUERY_WRITES = new Set(['insert', 'update', 'upsert', 'delete']);
const LIST_BOUNDS = new Set(['gt', 'gte', 'lt', 'lte', 'range']);
const supabaseSlotEnabled = (input, slotId) => {
  const slot = input.graph.resolver.slot(slotId);
  return Boolean(slot && input.graph.resolver.slotEnabled(slot));
};

function checkClientOwnership(input, { slots, ruleId }) {
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let imports = 0;
  let clients = 0;
  let calls = 0;
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const owned = slots.has(file.slot);
    kit.walk(file.sourceFile, node => {
      const moduleName = moduleNameOf(ts, node);
      if (moduleName && SUPABASE_MODULES.has(moduleName)) {
        imports += 1;
        if (!owned) reportAt(violations, kit, ruleId, file, node, `${moduleName} is imported by ${file.rel}, whose slot is ${file.slot ?? 'unowned'}; Supabase imports belong only to ${[...slots].join(' or ')}.`, { module: moduleName, slot: file.slot ?? null });
      }
      if (ts.isTypeReferenceNode(node) && supabaseClientType(kit, checker, node)) {
        clients += 1;
        if (!isDatabaseType(ts, node.typeArguments?.[0])) reportAt(violations, kit, ruleId, file, node, 'SupabaseClient must carry the committed Database type as SupabaseClient<Database>.');
      }
      if (!ts.isCallExpression(node)) return;
      const binding = kit.importBinding(checker, node.expression);
      if (binding && SUPABASE_MODULES.has(binding.module) && /^create(?:Client|ServerClient|BrowserClient)$/u.test(binding.name)) {
        clients += 1;
        if (!isDatabaseType(ts, node.typeArguments?.[0]) && !contextTypesClient(kit, checker, node)) {
          reportAt(violations, kit, ruleId, file, node, `${binding.name} creates an untyped Supabase client; create it as ${binding.name}<Database>(...) (or give it the contextual type SupabaseClient<Database>).`);
        }
      }
      if (!isSupabaseCall(kit, checker, node)) return;
      const properties = chainParts(ts, node);
      const method = callName(ts, node);
      if (!SUPABASE_CALLS.has(method) && !properties.includes('auth') && !properties.includes('storage')) return;
      calls += 1;
      if (!owned) reportAt(violations, kit, ruleId, file, node, `A Supabase ${method ?? 'client'} call is made from ${file.slot ?? 'an unowned path'}; database, auth and storage calls belong only to ${[...slots].join(' or ')}.`, { method, slot: file.slot ?? null });
    });
  }
  return { violations, coverage: { status: 'checked', imports, clients, calls, ownerSlots: [...slots] } };
}

const symbolOf = (kit, checker, node) => kit.aliased(checker, kit.symbolAt(checker, node)) ?? kit.symbolAt(checker, node);

const sameSymbol = (kit, checker, node, symbol) => Boolean(symbol && symbolOf(kit, checker, node) === symbol);

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

const handledAwait = (kit, checker, graph, awaitNode) => {
  const direct = parentCall(kit.ts, awaitNode);
  if (direct && callIsToOutcome(kit, checker, graph, direct) && direct.arguments.some(argument => argument === awaitNode || argument === awaitNode.parent)) return true;
  let cursor = awaitNode;
  while (cursor.parent && kit.ts.isParenthesizedExpression(cursor.parent)) cursor = cursor.parent;
  const declaration = kit.ts.isVariableDeclaration(cursor.parent) ? cursor.parent : null;
  if (!declaration) return false;
  if (kit.ts.isIdentifier(declaration.name)) {
    const result = symbolOf(kit, checker, declaration.name);
    let handled = false;
    kit.walk(fileOf(awaitNode), node => {
      if (kit.ts.isPropertyAccessExpression(node) && node.name.text === 'error' && sameSymbol(kit, checker, node.expression, result)) handled = true;
      if (kit.ts.isElementAccessExpression(node) && kit.ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'error' && sameSymbol(kit, checker, node.expression, result)) handled = true;
      if (kit.ts.isCallExpression(node) && callIsToOutcome(kit, checker, graph, node) && node.arguments.some(argument => sameSymbol(kit, checker, unwrap(kit.ts, argument), result))) handled = true;
      return !handled;
    });
    return handled;
  }
  if (!kit.ts.isObjectBindingPattern(declaration.name)) return false;
  const errorBinding = declaration.name.elements.find(element => {
    const property = element.propertyName ?? element.name;
    return kit.ts.isIdentifier(property) && property.text === 'error';
  });
  if (!errorBinding || !kit.ts.isIdentifier(errorBinding.name)) return false;
  const error = symbolOf(kit, checker, errorBinding.name);
  let references = 0;
  kit.walk(fileOf(awaitNode), node => {
    if (kit.ts.isIdentifier(node) && sameSymbol(kit, checker, node, error)) references += 1;
    return true;
  });
  return references > 1;
};

const fileOf = node => node.getSourceFile();

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

function checkFrontendQueryResults(input) {
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let awaited = 0;
  let listReads = 0;
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const seen = new Set();
    const report = (ruleId, node, message) => {
      const key = `${ruleId}:${node.pos}:${message}`;
      if (seen.has(key)) return;
      seen.add(key);
      reportAt(violations, kit, ruleId, file, node, message);
    };
    kit.walk(file.sourceFile, node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && QUERY_TERMINALS.has(node.expression.name.text)
        && node.typeArguments?.length && isSupabaseValue(kit, checker, node.expression.expression)) {
        report(FE_RESULT_TYPED, node, `${node.expression.name.text}<T>() supplies a result generic; derive the row type from Database and let the Supabase chain infer it.`);
      }
      if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) && fromAwaitedSupabase(kit, checker, node.expression)) {
        report(FE_RESULT_TYPED, node, 'A Supabase query result is cast or non-null asserted; narrow its typed data/error outcome instead.');
      }
      if (ts.isAwaitExpression(node) && isSupabaseValue(kit, checker, node.expression)) {
        const expression = unwrap(ts, node.expression);
        if (!ts.isCallExpression(expression)) return true;
        awaited += 1;
        const methods = chainParts(ts, expression);
        if (methods.includes('select') && !methods.some(method => QUERY_WRITES.has(method)) && !methods.includes('single') && !methods.includes('maybeSingle')) {
          listReads += 1;
          if (!methods.includes('limit') && !methods.some(method => LIST_BOUNDS.has(method))) {
            report(FE_RESULT_TYPED, node, 'A Supabase list read has no .limit(), .range(), or keyset bound (.gt/.gte/.lt/.lte); bound every multi-row read.');
          }
        }
        if (!handledAwait(kit, checker, input.graph, node)) {
          report(FE_ERROR_HANDLED, node, 'The awaited Supabase result does not read its error and is not passed whole to toOutcome(result).');
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && ts.isArrayLiteralExpression(node.right) && node.right.elements.length === 0) {
        const left = unwrap(ts, node.left);
        const swallowed = ts.isIdentifier(left) ? Boolean(dataSymbolFromAwait(kit, checker, left))
          : ts.isPropertyAccessExpression(left) && left.name.text === 'data' && fromAwaitedSupabase(kit, checker, left.expression);
        if (swallowed) report(FE_ERROR_HANDLED, node, 'Supabase data is collapsed with ?? []; refused or unavailable is not empty data. Pass the whole result to toOutcome.');
      }
      return true;
    });
  }
  return { violations, coverage: { status: 'checked', awaited, listReads } };
}

const words = text => String(text).replace(/([a-z0-9])([A-Z])/gu, '$1_$2').toUpperCase();
const serviceRoleText = text => /(?:^|[^A-Z0-9])SERVICE[_ -]?ROLE(?:[^A-Z0-9]|$)/iu.test(words(text));
const credentialEnv = name => /(?:^|_)(?:SECRET|PRIVATE|TOKEN|PASSWORD)$/u.test(name) || /(?:^|_)SERVICE_ROLE(?:_|$)/u.test(name);
const CORE_PUBLIC_ENV = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SITE_URL']);

const envRead = (ts, node) => {
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return null;
  const object = node.expression;
  const processEnv = ts.isPropertyAccessExpression(object) && ts.isIdentifier(object.expression) && object.expression.text === 'process' && object.name.text === 'env';
  const importMetaEnv = ts.isPropertyAccessExpression(object) && object.name.text === 'env' && object.expression.kind === ts.SyntaxKind.MetaProperty;
  if (!processEnv && !importMetaEnv) return null;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
};

function checkFrontendSecretNames(input) {
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let reads = 0;
  for (const file of input.graph.files.values()) {
    const seen = new Set();
    const report = (node, message, name) => {
      const key = `${node.pos}:${name ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      reportAt(violations, kit, FE_SERVICE_ROLE, file, node, message, name ? { name } : {});
    };
    kit.walk(file.sourceFile, node => {
      if (ts.isIdentifier(node) && serviceRoleText(node.text)) report(node, 'A SERVICE_ROLE identifier appears in the front end; the browser and Next process never hold the Supabase service role.', node.text);
      if (ts.isStringLiteralLike(node) && serviceRoleText(node.text)) report(node, 'A service_role string appears in the front end; the service role belongs behind the back-end guard chain.', node.text);
      const name = envRead(ts, node);
      if (!name) return;
      reads += 1;
      if (credentialEnv(name)) report(node, `${name} is a credential-shaped environment read in the front end; no *_SECRET, *_PRIVATE, *_TOKEN, *_PASSWORD or service-role value enters fe/.`, name);
      else if (name.startsWith('NEXT_PUBLIC_') && !CORE_PUBLIC_ENV.has(name) && file.slot !== FE_CONFIG_SLOT) {
        report(node, `${name} is not a core Supabase/site public variable and is read outside ${FE_CONFIG_SLOT}; product public configuration is declared by the one config owner.`, name);
      }
    });
  }
  return { violations, coverage: { status: 'checked', envReads: reads } };
}

const isClientModule = (ts, sourceFile) => sourceFile.statements.some((statement, index) => index < 4 && ts.isExpressionStatement(statement)
  && ts.isStringLiteralLike(statement.expression) && statement.expression.text === 'use client');

const isDirectiveStatement = (ts, statement) => ts.isExpressionStatement(statement) && ts.isStringLiteralLike(statement.expression);

const exportedValues = (ts, sourceFile) => {
  const hasExport = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
  const out = [];
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && hasExport(statement) && statement.name && statement.body) {
      out.push({ name: statement.name.text, implementation: statement.body, functionNode: statement });
    }
    if (!ts.isVariableStatement(statement) || !hasExport(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const functionNode = (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        && ts.isBlock(declaration.initializer.body) ? declaration.initializer : null;
      out.push({ name: declaration.name.text, implementation: declaration.initializer, functionNode });
    }
  }
  return out;
};

const exportedActions = (ts, sourceFile) => exportedValues(ts, sourceFile).map(value => value.functionNode).filter(Boolean);
const exportedImplementations = (ts, sourceFile, name) => exportedValues(ts, sourceFile)
  .filter(value => value.name === name).map(value => value.implementation);

const contains = (kit, root, predicate) => {
  let found = false;
  kit.walk(root, node => {
    if (predicate(node)) found = true;
    return !found;
  });
  return found;
};

const principalCall = (kit, checker, graph, node) => kit.ts.isCallExpression(node) && (() => {
  const expression = node.expression;
  const name = kit.ts.isPropertyAccessExpression(expression) ? expression.name : expression;
  if (!kit.ts.isIdentifier(name) || name.text !== 'getPrincipal') return false;
  return kit.declarationsOf(checker, name).some(declaration => {
    const rel = kit.graphPath(declaration);
    return rel !== null && FE_DB_SLOTS.has(graph.files.get(rel)?.slot);
  });
})();

const firstPrincipal = (kit, checker, graph, statement) => {
  let call = null;
  kit.walk(statement, node => {
    if (kit.ts.isAwaitExpression(node) && principalCall(kit, checker, graph, unwrap(kit.ts, node.expression))) call = unwrap(kit.ts, node.expression);
    return call === null;
  });
  if (!call || !kit.ts.isVariableStatement(statement)) return { call, symbol: null };
  for (const declaration of statement.declarationList.declarations) {
    if (kit.ts.isIdentifier(declaration.name) && declaration.initializer && contains(kit, declaration.initializer, node => node === call)) {
      return { call, symbol: symbolOf(kit, checker, declaration.name) };
    }
  }
  return { call, symbol: null };
};

const typedRefusal = (kit, node) => contains(kit, node, child => (kit.ts.isStringLiteralLike(child) && child.text === 'refused')
  || (kit.ts.isIdentifier(child) && /^refused(?:Outcome)?$/iu.test(child.text)));

const parseUse = (ts, identifier) => {
  let current = identifier;
  while (current.parent && (ts.isParenthesizedExpression(current.parent) || ts.isAsExpression(current.parent))) current = current.parent;
  const call = current.parent;
  return ts.isCallExpression(call) && call.arguments.includes(current) && ts.isPropertyAccessExpression(call.expression)
    && ['parse', 'safeParse'].includes(call.expression.name.text);
};

const parameterBindings = (ts, name) => {
  if (ts.isIdentifier(name)) return [name];
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) return name.elements.flatMap(element => ts.isBindingElement(element) ? parameterBindings(ts, element.name) : []);
  return [];
};

function checkFrontendAuthAndRoutes(input) {
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let actions = 0;
  let routes = 0;
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    if (!isClientModule(ts, file.sourceFile)) {
      kit.walk(file.sourceFile, node => {
        if (ts.isCallExpression(node) && callName(ts, node) === 'getSession' && signatureFromSupabase(checker, node)) {
          reportAt(violations, kit, FE_SESSION_TRUST, file, node, 'auth.getSession() trusts cookie-backed session data in server code; call getPrincipal() (getClaims), and getUser() for sensitive mutations.');
        }
        return true;
      });
    }
    if (FE_DB_SLOTS.has(file.slot)) {
      for (const implementation of exportedImplementations(ts, file.sourceFile, 'getPrincipal')) {
        const readsClaims = contains(kit, implementation, node => ts.isCallExpression(node) && callName(ts, node) === 'getClaims'
          && signatureFromSupabase(checker, node));
        if (!readsClaims) {
          reportAt(violations, kit, FE_SESSION_TRUST, file, implementation, 'getPrincipal() must establish the server principal through Supabase auth.getClaims().');
        }
      }
    }
    if (FE_DB_SLOTS.has(file.slot) && path.posix.basename(file.rel).startsWith('write-')) {
      const classified = input.graph.resolver.classifyPath(file.rel);
      const belowSlot = classified.root && file.rel.startsWith(`${classified.root}/`) ? file.rel.slice(classified.root.length + 1) : '';
      const authenticatesAnonymous = (input.graph.resolver.slot(file.slot)?.anonymousActions ?? []).includes(belowSlot);
      const declared = exportedActions(ts, file.sourceFile);
      if (!declared.length) reportAt(violations, kit, FE_WRITE_SHAPE, file, file.sourceFile, `${file.rel} is a write module but exports no Server Action function.`);
      for (const action of declared) {
        actions += 1;
        const functionLevel = action.body.statements[0]?.expression?.text === 'use server' && isDirectiveStatement(ts, action.body.statements[0]);
        if (!isServerActionModule(ts, file.sourceFile) && !functionLevel) {
          reportAt(violations, kit, FE_WRITE_SHAPE, file, action, 'An exported write function must be a Server Action through a file-level or function-level `use server` directive.');
        }
        // Function directives are the prologue, not work: the principal is the first non-directive statement.
        const work = action.body.statements.slice(action.body.statements.findIndex(statement => !isDirectiveStatement(ts, statement)) >>> 0);
        const first = work[0];
        const principal = first ? firstPrincipal(kit, checker, input.graph, first) : { call: null, symbol: null };
        if (!principal.call || !principal.symbol) {
          reportAt(violations, kit, FE_SESSION_TRUST, file, first ?? action, 'A write Server Action must begin with `const principal = await getPrincipal()` from the db owner.');
        } else if (!authenticatesAnonymous) {
          const refuses = work.slice(1).some(statement => ts.isIfStatement(statement)
            && contains(kit, statement.expression, node => ts.isIdentifier(node) && sameSymbol(kit, checker, node, principal.symbol))
            && typedRefusal(kit, statement.thenStatement));
          if (!refuses) reportAt(violations, kit, FE_SESSION_TRUST, file, action, 'A write Server Action must refuse an anonymous principal with a typed `refused` Outcome before doing work.');
        }
        for (const parameter of action.parameters.flatMap(item => parameterBindings(ts, item.name))) {
          const symbol = symbolOf(kit, checker, parameter);
          const references = [];
          kit.walk(action.body, node => {
            if (ts.isIdentifier(node) && sameSymbol(kit, checker, node, symbol)) references.push(node);
            return true;
          });
          references.sort((a, b) => a.getStart() - b.getStart());
          const firstUse = references[0];
          if (firstUse && !parseUse(ts, firstUse)) reportAt(violations, kit, FE_WRITE_SHAPE, file, firstUse, `Server Action input ${parameter.text} is used before schema.parse(...) or schema.safeParse(...).`, { parameter: parameter.text });
        }
        const sensitive = /(?:^|\/)(?:billing|payment|payout|refund|charge|subscription|password|credential|role|permission|membership)[/.-]/iu.test(file.rel);
        if (sensitive && !contains(kit, action.body, node => ts.isCallExpression(node) && callName(ts, node) === 'getUser' && signatureFromSupabase(checker, node))) {
          reportAt(violations, kit, FE_SESSION_TRUST, file, action, 'A money, account-security or role-changing Server Action must call auth.getUser() before the mutation.');
        }
      }
    }
    if (file.rel.endsWith('/route.ts')) {
      routes += 1;
      const classified = input.graph.resolver.classifyPath(file.rel);
      const app = classified.bindings?.app;
      const live = app !== undefined && file.rel === `apps/${app}/src/app/health/live/route.ts`;
      if (!live && file.slot !== 'fe.route.callback') {
        reportAt(violations, kit, FE_ROUTE_HANDLER, file, file.sourceFile, `${file.rel} is a front-end route handler outside health/live and the fe.route.callback slot; webhooks, cron, public APIs and third-party callbacks belong to be features.`);
      }
    }
  }
  return { violations, coverage: { status: 'checked', actions, routes } };
}

export function checkFrontendSupabase(input) {
  if (!supabaseSlotEnabled(input, 'fe.modules.db')) return { violations: [], coverage: { status: 'not-applicable', reason: 'the Supabase front-end database slot is not enabled' } };
  const owner = checkClientOwnership(input, { slots: FE_DB_SLOTS, ruleId: FE_CLIENT_OWNER });
  const results = checkFrontendQueryResults(input);
  const secrets = checkFrontendSecretNames(input);
  const auth = checkFrontendAuthAndRoutes(input);
  return {
    violations: [...owner.violations, ...results.violations, ...secrets.violations, ...auth.violations],
    coverage: { status: 'checked', owner: owner.coverage, results: results.coverage, secrets: secrets.coverage, auth: auth.coverage },
  };
}

export function checkBackendSupabase(input) {
  if (!supabaseSlotEnabled(input, BE_SUPABASE_SLOT)) return { violations: [], coverage: { status: 'not-applicable', reason: 'the Supabase back-end integration slot is not enabled' } };
  const owner = checkClientOwnership(input, { slots: new Set([BE_SUPABASE_SLOT]), ruleId: BE_CLIENT_OWNER });
  const jwt = checkBackendJwt(input);
  return {
    violations: [...owner.violations, ...jwt.violations],
    coverage: { status: 'checked', owner: owner.coverage, jwt: jwt.coverage },
  };
}
