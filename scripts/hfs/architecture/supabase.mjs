import { machineKit } from './machine-ast.mjs';
import { callName, chainParts, contextTypesClient, isDatabaseType, isSupabaseCall, jwtPolicyProblems, moduleNameOf, reportAt, supabaseClientType, supabaseDataAccess, SUPABASE_MODULES } from './supabase-ast.mjs';
import { checkBackendJwt } from './supabase-be.mjs';

/**
 * L10-L16, the slot-driven Supabase machine. On the back end Supabase provides Auth/Storage with one owner,
 * `be.integrations.supabase`. On the front end Supabase is auth only (owner ruling 2026-10-13): `fe.modules.auth` is the one
 * importer of `@supabase/*` and calls only the auth API; data, storage, rpc and realtime go through the back end (modules/api).
 * The checks below recognise provider calls and types by their imported package declarations, not by local variable or type names.
 */
export const FRONTEND_SUPABASE_RULE_IDS = Object.freeze(['FE_SUPABASE_CLIENT_OWNER', 'FE_SERVICE_ROLE_FORBIDDEN']);
export const BACKEND_SUPABASE_RULE_IDS = Object.freeze(['BE_SUPABASE_CLIENT_OWNER', 'BE_SUPABASE_JWT_VERIFIED', 'BE_JWT_ALG_PINNED']);

const FE_CLIENT_OWNER = 'FE_SUPABASE_CLIENT_OWNER';
const BE_CLIENT_OWNER = 'BE_SUPABASE_CLIENT_OWNER';
const FE_SERVICE_ROLE = 'FE_SERVICE_ROLE_FORBIDDEN';
const BE_SUPABASE_SLOT = 'be.integrations.supabase';
const FE_AUTH_SLOT = 'fe.modules.auth';
/** The front-end provider slot: enabled exactly when a connection declares provider supabase. */
const FE_SUPABASE_PROVIDER_SLOT = 'fe.route.callback';
const FE_CONFIG_SLOT = 'fe.modules.config';
const BE_DATA_MEMBERS = new Set(['from', 'rpc', 'schema', 'functions', 'channel', 'realtime', 'getChannels', 'removeChannel', 'removeAllChannels']);
/** The members of a Supabase client that read or write data, files or channels: never called from the front end. */
const FE_DATA_MEMBERS = new Set(['from', 'rpc', 'schema', 'storage', 'functions', 'realtime', 'channel', 'getChannels', 'removeChannel', 'removeAllChannels']);
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
  const { kit, checker, file, slots, ruleId, violations, counters, reportedData } = scope;
  const { ts } = kit;
  const data = supabaseDataAccess(kit, checker, node, BE_DATA_MEMBERS, { storageAllowed: true });
  if (data) {
    if (!reportedData.has(data.node.pos)) {
      reportedData.add(data.node.pos);
      reportAt(violations, kit, ruleId, file, data.node, `A Supabase .${data.name} data call is made from ${file.slot ?? 'an unowned path'}; the back-end SDK is Auth/Storage only, including inside ${BE_SUPABASE_SLOT}. Data uses EntityManager as app_be.`, { member: data.name, slot: file.slot ?? null });
    }
    if (ts.isCallExpression(node)) counters.calls += 1;
    return;
  }
  if (!isSupabaseCall(kit, checker, node)) return;
  const properties = chainParts(ts, node);
  const method = callName(ts, node);
  if (!properties.includes('auth') && !properties.includes('storage')) return;
  counters.calls += 1;
  if (!slots.has(file.slot)) reportAt(violations, kit, ruleId, file, node, `A Supabase ${method ?? 'client'} call is made from ${file.slot ?? 'an unowned path'}; database, auth and storage calls belong only to ${[...slots].join(' or ')}.`, { method, slot: file.slot ?? null });
}

function inspectOwnershipNode(scope, node) {
  inspectSupabaseImport(scope, node);
  inspectClientTypeReference(scope, node);
  const { ts } = scope.kit;
  if (!ts.isCallExpression(node) && !ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return;
  if (ts.isCallExpression(node)) inspectClientFactoryCall(scope, node);
  inspectProviderCall(scope, node);
}

function checkClientOwnership(input, { slots, ruleId }) {
  const kit = machineKit(input);
  const violations = [];
  const counters = { imports: 0, clients: 0, calls: 0 };
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const scope = { kit, checker, file, slots, ruleId, violations, counters, reportedData: new Set() };
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

function inspectFrontendNode(scope, node) {
  const { kit, checker, file, violations, counters, reportedData } = scope;
  const { ts } = kit;
  const moduleName = moduleNameOf(ts, node);
  if (moduleName?.startsWith('@supabase/')) {
    counters.imports += 1;
    if (file.slot !== FE_AUTH_SLOT) reportAt(violations, kit, FE_CLIENT_OWNER, file, node, `${moduleName} is imported by ${file.rel}, whose slot is ${file.slot ?? 'unowned'}; on the front end Supabase is auth only and ${FE_AUTH_SLOT} (modules/auth) is its one importer.`, { module: moduleName, slot: file.slot ?? null });
    return;
  }
  if (!ts.isCallExpression(node) && !ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return;
  const data = supabaseDataAccess(kit, checker, node, FE_DATA_MEMBERS);
  if (data) {
    if (!reportedData.has(data.node.pos)) {
      reportedData.add(data.node.pos);
      reportAt(violations, kit, FE_CLIENT_OWNER, file, data.node, `A Supabase .${data.name} call is made from the front end; Supabase on the front end is auth only - read and write data, files and realtime through the back end (a modules/api GraphQL operation, an SWR hook, hooks/socketio).`, { member: data.name, slot: file.slot ?? null });
    }
    return;
  }
  if (!isSupabaseCall(kit, checker, node)) return;
  counters.calls += 1;
  const parts = chainParts(ts, node);
  if (file.slot !== FE_AUTH_SLOT && parts.includes('auth')) reportAt(violations, kit, FE_CLIENT_OWNER, file, node, `A Supabase auth call is made from ${file.slot ?? 'an unowned path'}; the auth client is called only inside ${FE_AUTH_SLOT}, which exports the session and the access token.`, { slot: file.slot ?? null });
}

function checkFrontendClientOwner(input) {
  const kit = machineKit(input);
  const violations = [];
  const counters = { imports: 0, calls: 0 };
  for (const file of input.graph.files.values()) {
    const scope = { kit, checker: kit.checkerOf(file.sourceFile), file, violations, counters, reportedData: new Set() };
    kit.walk(file.sourceFile, node => inspectFrontendNode(scope, node));
  }
  return { violations, coverage: { status: 'checked', ...counters, ownerSlots: [FE_AUTH_SLOT] } };
}

export function checkFrontendSupabase(input) {
  const owner = checkFrontendClientOwner(input);
  if (!supabaseSlotEnabled(input, FE_SUPABASE_PROVIDER_SLOT)) return {
    violations: owner.violations,
    coverage: { status: owner.coverage.imports || owner.coverage.calls || owner.violations.length ? 'checked' : 'not-applicable', owner: owner.coverage, reason: 'no connection declares provider supabase; SDK ownership is still checked' },
  };
  const secrets = checkFrontendSecretNames(input);
  return {
    violations: [...owner.violations, ...secrets.violations],
    coverage: { status: 'checked', owner: owner.coverage, secrets: secrets.coverage },
  };
}

export function checkBackendSupabase(input) {
  const owner = checkClientOwnership(input, { slots: new Set([BE_SUPABASE_SLOT]), ruleId: BE_CLIENT_OWNER });
  if (!supabaseSlotEnabled(input, BE_SUPABASE_SLOT)) return {
    violations: owner.violations,
    coverage: { status: owner.coverage.imports || owner.coverage.calls || owner.violations.length ? 'checked' : 'not-applicable', owner: owner.coverage, reason: 'the Supabase integration slot is disabled; SDK ownership is still checked' },
  };
  const jwt = checkBackendJwt(input);
  const policy = checkJwtPolicy(input);
  return {
    violations: [...owner.violations, ...jwt.violations, ...policy.violations],
    coverage: { status: 'checked', owner: owner.coverage, jwt: jwt.coverage, jwtPolicy: policy.coverage },
  };
}

function checkJwtPolicy(input) {
  const kit = machineKit(input);
  const violations = [];
  let verifyCalls = 0;
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, node => {
      if (!kit.ts.isCallExpression(node) || !kit.isImportOf(checker, node.expression, 'jwtVerify', 'jose')) return;
      verifyCalls += 1;
      const problems = jwtPolicyProblems(kit.ts, checker, node);
      if (problems.length) reportAt(violations, kit, 'BE_JWT_ALG_PINNED', file, node, problems.join(' '));
    });
  }
  return { violations, coverage: { status: 'checked', verifyCalls } };
}
