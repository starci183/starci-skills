import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { isServerActionModule } from './server-action.mjs';
import { callName, chainParts, contextTypesClient, isDatabaseType, isSupabaseCall, moduleNameOf, reportAt, signatureFromSupabase, supabaseClientType, SUPABASE_MODULES, unwrap } from './supabase-ast.mjs';
import { checkBackendJwt } from './supabase-be.mjs';
import { checkFrontendQueryResults, FE_DB_SLOTS, sameSymbol, symbolOf } from './supabase-results.mjs';

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
const FE_SERVICE_ROLE = 'FE_SERVICE_ROLE_FORBIDDEN';
const FE_SESSION_TRUST = 'FE_AUTH_SESSION_TRUST';
const FE_WRITE_SHAPE = 'FE_DB_WRITE_SHAPE';
const FE_ROUTE_HANDLER = 'FE_ROUTE_HANDLER_FORBIDDEN';
const BE_SUPABASE_SLOT = 'be.integrations.supabase';
const FE_CONFIG_SLOT = 'fe.modules.config';
const SUPABASE_CALLS = new Set(['from', 'rpc']);
const supabaseSlotEnabled = (input, slotId) => {
  const slot = input.graph.resolver.slot(slotId);
  return Boolean(slot && input.graph.resolver.slotEnabled(slot));
};

const CLIENT_FACTORY = /^create(?:Client|ServerClient|BrowserClient)$/u;

function inspectSupabaseImport(scope, node) {
  const { kit, file, slots, ruleId, violations, counters } = scope;
  const moduleName = moduleNameOf(kit.ts, node);
  if (!moduleName || !SUPABASE_MODULES.has(moduleName)) return;
  counters.imports += 1;
  if (!slots.has(file.slot)) reportAt(violations, kit, ruleId, file, node, `${moduleName} is imported by ${file.rel}, whose slot is ${file.slot ?? 'unowned'}; Supabase imports belong only to ${[...slots].join(' or ')}.`, { module: moduleName, slot: file.slot ?? null });
}

function inspectClientTypeReference(scope, node) {
  const { kit, checker, file, ruleId, violations, counters } = scope;
  if (!kit.ts.isTypeReferenceNode(node) || !supabaseClientType(kit, checker, node)) return;
  counters.clients += 1;
  if (!isDatabaseType(kit.ts, node.typeArguments?.[0])) reportAt(violations, kit, ruleId, file, node, 'SupabaseClient must carry the committed Database type as SupabaseClient<Database>.');
}

function inspectClientFactoryCall(scope, node) {
  const { kit, checker, file, ruleId, violations, counters } = scope;
  const binding = kit.importBinding(checker, node.expression);
  if (!binding || !SUPABASE_MODULES.has(binding.module) || !CLIENT_FACTORY.test(binding.name)) return;
  counters.clients += 1;
  if (!isDatabaseType(kit.ts, node.typeArguments?.[0]) && !contextTypesClient(kit, checker, node)) {
    reportAt(violations, kit, ruleId, file, node, `${binding.name} creates an untyped Supabase client; create it as ${binding.name}<Database>(...) (or give it the contextual type SupabaseClient<Database>).`);
  }
}

function inspectProviderCall(scope, node) {
  const { kit, checker, file, slots, ruleId, violations, counters } = scope;
  const { ts } = kit;
  if (!isSupabaseCall(kit, checker, node)) return;
  const properties = chainParts(ts, node);
  const method = callName(ts, node);
  if (!SUPABASE_CALLS.has(method) && !properties.includes('auth') && !properties.includes('storage')) return;
  counters.calls += 1;
  if (!slots.has(file.slot)) reportAt(violations, kit, ruleId, file, node, `A Supabase ${method ?? 'client'} call is made from ${file.slot ?? 'an unowned path'}; database, auth and storage calls belong only to ${[...slots].join(' or ')}.`, { method, slot: file.slot ?? null });
}

function inspectOwnershipNode(scope, node) {
  inspectSupabaseImport(scope, node);
  inspectClientTypeReference(scope, node);
  if (!scope.kit.ts.isCallExpression(node)) return;
  inspectClientFactoryCall(scope, node);
  inspectProviderCall(scope, node);
}

function checkClientOwnership(input, { slots, ruleId }) {
  const kit = machineKit(input);
  const violations = [];
  const counters = { imports: 0, clients: 0, calls: 0 };
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const scope = { kit, checker, file, slots, ruleId, violations, counters };
    kit.walk(file.sourceFile, node => inspectOwnershipNode(scope, node));
  }
  return { violations, coverage: { status: 'checked', ...counters, ownerSlots: [...slots] } };
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

/** Reports a SERVICE_ROLE identifier or string literal: the browser and Next process never hold the service role. */
function inspectServiceRoleText(ts, node, report) {
  if (ts.isIdentifier(node) && serviceRoleText(node.text)) report(node, 'A SERVICE_ROLE identifier appears in the front end; the browser and Next process never hold the Supabase service role.', node.text);
  if (ts.isStringLiteralLike(node) && serviceRoleText(node.text)) report(node, 'A service_role string appears in the front end; the service role belongs behind the back-end guard chain.', node.text);
}

/** Counts an environment read and reports a credential-shaped or product-specific public variable. */
function inspectEnvironmentRead(state, file, node, name) {
  state.reads += 1;
  if (credentialEnv(name)) state.report(node, `${name} is a credential-shaped environment read in the front end; no *_SECRET, *_PRIVATE, *_TOKEN, *_PASSWORD or service-role value enters fe/.`, name);
  else if (name.startsWith('NEXT_PUBLIC_') && !CORE_PUBLIC_ENV.has(name) && file.slot !== FE_CONFIG_SLOT) {
    state.report(node, `${name} is not a core Supabase/site public variable and is read outside ${FE_CONFIG_SLOT}; product public configuration is declared by the one config owner.`, name);
  }
}

function checkFrontendSecretNames(input) {
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  const state = { reads: 0, report: null };
  for (const file of input.graph.files.values()) {
    const seen = new Set();
    state.report = (node, message, name) => {
      const key = `${node.pos}:${name ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      reportAt(violations, kit, FE_SERVICE_ROLE, file, node, message, name ? { name } : {});
    };
    kit.walk(file.sourceFile, node => {
      inspectServiceRoleText(ts, node, state.report);
      const name = envRead(ts, node);
      if (name) inspectEnvironmentRead(state, file, node, name);
    });
  }
  return { violations, coverage: { status: 'checked', envReads: state.reads } };
}

const isClientModule = (ts, sourceFile) => sourceFile.statements.some((statement, index) => index < 4 && ts.isExpressionStatement(statement)
  && ts.isStringLiteralLike(statement.expression) && statement.expression.text === 'use client');

const isDirectiveStatement = (ts, statement) => ts.isExpressionStatement(statement) && ts.isStringLiteralLike(statement.expression);

const hasExportModifier = (ts, node) => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);

const exportedValuesOf = (ts, statement) => {
  if (ts.isFunctionDeclaration(statement)) {
    return hasExportModifier(ts, statement) && statement.name && statement.body
      ? [{ name: statement.name.text, implementation: statement.body, functionNode: statement }] : [];
  }
  if (!ts.isVariableStatement(statement) || !hasExportModifier(ts, statement)) return [];
  return statement.declarationList.declarations
    .filter(declaration => ts.isIdentifier(declaration.name) && declaration.initializer)
    .map(declaration => {
      const functionNode = (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        && ts.isBlock(declaration.initializer.body) ? declaration.initializer : null;
      return { name: declaration.name.text, implementation: declaration.initializer, functionNode };
    });
};

const exportedValues = (ts, sourceFile) => sourceFile.statements.flatMap(statement => exportedValuesOf(ts, statement));

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

function inspectServerSessionCalls(kit, file, checker, violations) {
  const { ts } = kit;
  if (isClientModule(ts, file.sourceFile)) return;
  kit.walk(file.sourceFile, node => {
    if (ts.isCallExpression(node) && callName(ts, node) === 'getSession' && signatureFromSupabase(checker, node)) {
      reportAt(violations, kit, FE_SESSION_TRUST, file, node, 'auth.getSession() trusts cookie-backed session data in server code; call getPrincipal() (getClaims), and getUser() for sensitive mutations.');
    }
    return true;
  });
}

function inspectPrincipalProvider(kit, file, checker, violations) {
  const { ts } = kit;
  if (!FE_DB_SLOTS.has(file.slot)) return;
  for (const implementation of exportedImplementations(ts, file.sourceFile, 'getPrincipal')) {
    const readsClaims = contains(kit, implementation, node => ts.isCallExpression(node) && callName(ts, node) === 'getClaims'
      && signatureFromSupabase(checker, node));
    if (!readsClaims) reportAt(violations, kit, FE_SESSION_TRUST, file, implementation,
      'getPrincipal() must establish the server principal through Supabase auth.getClaims().');
  }
}

function inspectActionDirective(kit, file, action, violations) {
  const { ts } = kit;
  const first = action.body.statements[0];
  const functionLevel = first?.expression?.text === 'use server' && isDirectiveStatement(ts, first);
  if (!isServerActionModule(ts, file.sourceFile) && !functionLevel) {
    reportAt(violations, kit, FE_WRITE_SHAPE, file, action, 'An exported write function must be a Server Action through a file-level or function-level `use server` directive.');
  }
}

function inspectActionPrincipal(input, kit, file, checker, action, authenticatesAnonymous, violations) {
  const { ts } = kit;
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
}

function inspectActionInputs(kit, file, action, checker, violations) {
  const { ts } = kit;
  for (const parameter of action.parameters.flatMap(item => parameterBindings(ts, item.name))) {
    const symbol = symbolOf(kit, checker, parameter);
    const references = [];
    kit.walk(action.body, node => {
      if (ts.isIdentifier(node) && sameSymbol(kit, checker, node, symbol)) references.push(node);
      return true;
    });
    references.sort((a, b) => a.getStart() - b.getStart());
    const firstUse = references[0];
    if (firstUse && !parseUse(ts, firstUse)) reportAt(violations, kit, FE_WRITE_SHAPE, file, firstUse,
      `Server Action input ${parameter.text} is used before schema.parse(...) or schema.safeParse(...).`, { parameter: parameter.text });
  }
}

function inspectSensitiveAction(kit, file, checker, action, violations) {
  const { ts } = kit;
  const sensitive = /(?:^|\/)(?:billing|payment|payout|refund|charge|subscription|password|credential|role|permission|membership)[/.-]/iu.test(file.rel);
  if (sensitive && !contains(kit, action.body, node => ts.isCallExpression(node) && callName(ts, node) === 'getUser' && signatureFromSupabase(checker, node))) {
    reportAt(violations, kit, FE_SESSION_TRUST, file, action, 'A money, account-security or role-changing Server Action must call auth.getUser() before the mutation.');
  }
}

function inspectWriteAction(input, kit, file, checker, action, authenticatesAnonymous, violations) {
  inspectActionDirective(kit, file, action, violations);
  inspectActionPrincipal(input, kit, file, checker, action, authenticatesAnonymous, violations);
  inspectActionInputs(kit, file, action, checker, violations);
  inspectSensitiveAction(kit, file, checker, action, violations);
}

function inspectWriteModule(input, kit, file, checker, state) {
  const { ts } = kit;
  if (!FE_DB_SLOTS.has(file.slot) || !path.posix.basename(file.rel).startsWith('write-')) return;
  const classified = input.graph.resolver.classifyPath(file.rel);
  const belowSlot = classified.root && file.rel.startsWith(`${classified.root}/`) ? file.rel.slice(classified.root.length + 1) : '';
  const authenticatesAnonymous = (input.graph.resolver.slot(file.slot)?.anonymousActions ?? []).includes(belowSlot);
  const declared = exportedActions(ts, file.sourceFile);
  if (!declared.length) reportAt(state.violations, kit, FE_WRITE_SHAPE, file, file.sourceFile, `${file.rel} is a write module but exports no Server Action function.`);
  for (const action of declared) {
    state.actions += 1;
    inspectWriteAction(input, kit, file, checker, action, authenticatesAnonymous, state.violations);
  }
}

function inspectRouteHandler(input, kit, file, state) {
  if (!file.rel.endsWith('/route.ts')) return;
  state.routes += 1;
  const classified = input.graph.resolver.classifyPath(file.rel);
  const app = classified.bindings?.app;
  const live = app !== undefined && file.rel === `apps/${app}/src/app/health/live/route.ts`;
  if (!live && file.slot !== 'fe.route.callback') reportAt(state.violations, kit, FE_ROUTE_HANDLER, file, file.sourceFile,
    `${file.rel} is a front-end route handler outside health/live and the fe.route.callback slot; webhooks, cron, public APIs and third-party callbacks belong to be features.`);
}

function checkFrontendAuthAndRoutes(input) {
  const kit = machineKit(input);
  const state = { violations: [], actions: 0, routes: 0 };
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    inspectServerSessionCalls(kit, file, checker, state.violations);
    inspectPrincipalProvider(kit, file, checker, state.violations);
    inspectWriteModule(input, kit, file, checker, state);
    inspectRouteHandler(input, kit, file, state);
  }
  return { violations: state.violations, coverage: { status: 'checked', actions: state.actions, routes: state.routes } };
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
