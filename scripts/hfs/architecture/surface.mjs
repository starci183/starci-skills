/**
 * The lint surface: which architecture-machine findings an ESLint rule judges instead of `starci app check`.
 * Single source of truth. Each enforcer id is the rules.yaml enforcer; `codes` are the exact violation.ruleId strings its
 * check file emits on source files. plugins: 'be' = back-end profile repos, 'fe' = front-end profile, graph checks run for both.
 */
import fs from 'node:fs';
import path from 'node:path';

const BE = ['be'];
const FE = ['fe'];
const BOTH = ['be', 'fe'];

// `via` names the machine check (the key of its run in index.mjs) when two enforcers share a code; `origin: 'repo'` marks a finding of the
// slot manifest's per-path judgement (hfs-path-findings.mjs) instead of the machine. A finding reaches exactly one rule.
const enforcer = (id, plugins, codes, description, extra = {}) => Object.freeze({ id, plugins: Object.freeze(plugins), codes: Object.freeze(codes), description, ...extra });

export const LINT_ENFORCERS = Object.freeze([
  enforcer('duplicate-code', BOTH, ['HFS_DUPLICATE_CODE'], 'A block of production code never repeats elsewhere in the owner graph.'),
  enforcer('duplicate-symbol', BOTH, ['HFS_DUPLICATE_SYMBOL'], 'A symbol name is declared once across the production source.'),
  enforcer('alias-reexport', BOTH, ['HFS_ALIAS_REEXPORT'], 'An owner entry re-exports a symbol under its own name, never through a const alias.'),
  // cross-app-duplicate emits only FE_CROSS_APP_DUPLICATE today; HFS_DUPLICATE_CODE is named in its comment only.
  enforcer('cross-app-duplicate', FE, ['FE_CROSS_APP_DUPLICATE'], 'A file is never copied between apps; shared code lives in a package.'),
  enforcer('dead-exports', BOTH, ['HFS_UNUSED_EXPORT', 'HFS_UNUSED_FILE'], 'Every owner export and every production file is reached by a root.'),
  enforcer('tier-direction', BOTH, ['BE_TIER_DIRECTION', 'FE_TIER_DIRECTION'], 'An import goes only to a tier the slot matrix allows.'),
  enforcer('owner-cycle', BOTH, ['ARCH_OWNER_CYCLE'], 'Owners never import each other in a cycle.'),
  enforcer('feature-imports-feature', BE, ['BE_FEATURE_IMPORTS_FEATURE'], 'A feature never imports another feature.'),
  enforcer('kind-isolation', BE, ['BE_KIND_ISOLATION'], 'A feature of one trigger kind never imports a feature of another kind; the kinds meet through the event bus.'),
  enforcer('app-isolation', FE, ['FE_APP_ISOLATION'], 'An app never imports another app.'),
  enforcer('feature-layout', BE, ['BE_FEATURE_LAYOUT_INVALID'], 'A feature file sits in the folder its role names.'),
  enforcer('application-never-imports-transport', BE, ['BE_APPLICATION_IMPORTS_TRANSPORT', 'BE_APPLICATION_TRANSPORT_FRAMEWORK'], 'Application code never imports transport code, directly or through a chain.'),
  enforcer('owner-export-bypass', BOTH, ['ARCH_OWNER_EXPORT_BYPASS', 'ARCH_OWNER_EXPORT_STAR'], 'Another owner is imported only through its index entry, and an entry never uses export star.'),
  enforcer('feature-not-composed', BE, ['BE_FEATURE_NOT_COMPOSED'], 'Every feature owner is composed into an app.'),
  enforcer('owner-reachable', FE, ['FE_OWNER_REACHABLE', 'FE_HREF_RESOLVES'], 'Every owner is mounted by a route and every href resolves to a route.'),
  enforcer('app-composition-only', BE, ['BE_APP_COMPOSITION_ONLY', 'BE_APP_BUSINESS_ROLE'], 'An app only composes modules and holds no business role.'),
  enforcer('entrypoint-only-in-apps', BE, ['BE_ENTRYPOINT_ONLY_IN_APPS'], 'NestFactory and bootstrap live only in an app main file.'),
  enforcer('schema-owner', BE, ['BE_SCHEMA_OWNER'], 'Each entity array is registered by one owner across all apps.'),
  enforcer('sql-returning', BE, ['BE_SQL_RETURNING_SHAPE'], 'An UPDATE or DELETE with RETURNING is wrapped in a CTE SELECT, because EntityManager.query returns it as [rows, count].'),
  enforcer('context-owner', BE, ['BE_CONTEXT_OWNER'], 'An app composes only the contexts (connections) it owns; the migration apps compose all of them.'),
  enforcer('context-coupling', BE, ['BE_CONTEXT_COUPLING'], 'Contexts are never coupled by a relation, a foreign key or an import; only by events.'),
  enforcer('context-transaction', BE, ['BE_CONTEXT_TRANSACTION'], 'One transaction touches one context connection.'),
  enforcer('context-platform-tables', BE, ['BE_CONTEXT_PLATFORM_TABLES'], 'A per-connection platform capability registers its tables on every connection that uses it.'),
  enforcer('error-code-unique', BE, ['BE_ERROR_HOME'], 'An error code is declared once in the repository.'),
  enforcer('error-masked', BE, ['BE_ERROR_MASKED'], 'Every app wires the error filter that masks internal errors.'),
  enforcer('default-deny-app-guard', BE, ['BE_DEFAULT_DENY'], 'Every app registers the default-deny guard before any other guard.'),
  // BE_MODULE_SHAPE is emitted by both register-once and module-per-transport.
  enforcer('register-once', BE, ['BE_MODULE_SHAPE'], 'A module is registered once and imported by one module.', { via: 'registerOnce' }),
  enforcer('module-per-transport', BE, ['BE_MODULE_SHAPE'], 'An app imports transport modules only.', { via: 'modulePerTransport' }),
  enforcer('module-registration', BE, ['BE_MODULE_HANDLER_REGISTRATION', 'BE_MODULE_PROVIDER_REREGISTRATION'], 'Every handler is registered by a module and no provider is registered twice.'),
  enforcer('background-unowned', BE, ['BE_BACKGROUND_UNOWNED'], 'Every background job is reachable from a worker app.'),
  enforcer('test-world-files', BE, ['BE_TEST_TOPOLOGY'], 'The test world files match the stack declaration.'),
  enforcer('unit-spec-providers', BE, ['BE_SPEC_QUALITY'], 'A unit spec provides exactly the dependencies its service constructor takes.'),
  enforcer('transport-owner', FE, ['FE_TRANSPORT_OWNER'], 'One client and one outcome type own the transport of the repository.'),
  enforcer('swr-data-lifecycle', FE, ['FE_SWR_KEY_IDENTITY', 'FE_SWR_MUTATION_RESOURCE_IDENTITY'], 'SWR keys and mutations share one resource identity.'),
  enforcer('route-files-thin', FE, ['FE_ROUTE_FILES_THIN'], 'A route file only mounts one feature owner.'),
  enforcer('route-adapter', FE, ['FE_ROUTE_ONE_PAGE', 'FE_ROUTE_DRAWING_DECISION', 'FE_ROUTE_CLIENT_BOUNDARY', 'FE_ROUTE_CLIENT_HOOK', 'FE_ROUTE_DEFAULT_EXPORT'], 'A page route is a server adapter that mounts one pages-tier component.'),
  enforcer('client-reaches-server', FE, ['FE_CLIENT_REACHES_SERVER'], 'Client code never reaches server-only code through any import chain.'),
  enforcer('hooks-are-hooks', FE, ['FE_HOOKS_ARE_HOOKS'], 'A hooks folder holds hooks only, one shared file per domain.'),
  enforcer('hook-location', FE, ['FE_CUSTOM_HOOK_LOCATION', 'FE_BLOCK_PRODUCT_HOOK_DEFINITION', 'FE_COMPONENT_DEEP_HOOK_IMPORT'], 'A custom hook is defined in the hooks folder and imported through its entry.'),
  enforcer('connection-map', BE, ['BE_CONNECTION_DUPLICATE'], 'Each database connection is declared once and matches the connection map.'),
  enforcer('injection-token-exported', BE, ['BE_RAW_INJECT'], 'An injection token is exported by its owner and never injected raw.'),
  enforcer('sql-owner', BE, ['BE_SQL_TABLE_OWNER'], 'A SQL table is touched only by the owner of its entity.'),
  enforcer('readonly-boundary', BE, ['BE_READONLY_BOUNDARY'], 'Messages and injected classes crossing a boundary are readonly.'),
  enforcer('source-names', BE, ['BE_SOURCE_FORM'], 'Names and forms inside a source file follow its role.'),
  enforcer('public-contract-form', BE, ['BE_PUBLIC_CONTRACT_FORM'], 'A public signature is typed by a named contract, never inline or untyped.'),
  enforcer('frontend-source-layout', FE, ['FE_SOURCE_LAYOUT_INVALID'], 'A front-end source file sits in a tier folder.'),
  enforcer('component-purity', FE, ['FE_COMPONENT_WORLD_OWNERSHIP', 'FE_WORLD_OWNER_RENDER_BOUNDARY', 'FE_CONNECTED_BLOCK_RENDER_PAIR', 'FE_PURE_REACHES_DATA', 'FE_PURE_WORLD_HOOK', 'FE_PURE_WORLD_IMPORT'], 'A pure component reaches no data or world state; its connected entry owns them.'),
  enforcer('grammar-entry', FE, ['ARCH_GRAMMAR_CONTRACT_INVALID', 'ARCH_GRAMMAR_EXPORT_BYPASS'], 'Vendor grammar is reached only through its owner entry.'),
  enforcer('i18n-keys', FE, ['FE_I18N_KEYS'], 'Translation keys read by source and keys held by catalogs agree both ways.'),
  // The per-path judgements of the slot manifest (scripts/hfs/path-findings.mjs), on a tracked TypeScript file.
  enforcer('slot-undeclared', BOTH, ['HFS_SLOT_UNDECLARED', 'HFS_SLOT_AMBIGUOUS', 'HFS_SLOT_NOT_ENABLED'], 'A TypeScript file is owned by exactly one slot of the repository.', { origin: 'repo' }),
  enforcer('source-suffix', BE, ['BE_SOURCE_FORM'], 'A source file name is index.ts, main.ts, a migration or <kebab-name>.<suffix>.ts with a suffix of the closed list.', { origin: 'repo' }),
  enforcer('spec-placement', BE, ['BE_SPEC_PLACEMENT'], 'A spec file lives in one of the four test layers and nowhere else.', { origin: 'repo' }),
  // The two below are emitted into context.errors today, not into violations.
  enforcer('package-imports-app', BOTH, ['ARCH_PACKAGE_IMPORTS_APP'], 'A package never imports an app.'),
  enforcer('package-export-bypass', BOTH, ['ARCH_PACKAGE_EXPORT_BYPASS'], 'A package is imported only through its declared exports.'),
]);

export const LINT_CODES = new Set(LINT_ENFORCERS.flatMap(e => e.codes));

export const TS_SOURCE = /\.(?:[cm]?tsx?)$/;

/** True when a finding sits on an existing TypeScript file of the repository: the only findings an editor can show on a line. */
export function attachesToSource(repositoryRoot, violation) {
  const file = violation?.path;
  if (typeof file !== 'string' || !TS_SOURCE.test(file)) return false;
  return fs.existsSync(path.join(repositoryRoot, ...file.split('/')));
}

/** The finding's code: a machine violation spells it `ruleId`, a repository finding `code`. */
export const codeOf = (finding) => finding?.ruleId ?? finding?.code;

/** Whether `finding` (with its origin and check tags) belongs to `enforcer`. */
export const belongsTo = (enforcer, finding) => enforcer.codes.includes(codeOf(finding))
  && (finding.origin ?? 'machine') === (enforcer.origin ?? 'machine') && (enforcer.via === undefined || finding.check === enforcer.via);

/** True when some lint rule owns the finding and it sits on an existing TypeScript file: it is an ESLint report, not a `starci app check` finding. */
export const onLintSurface = (repositoryRoot, finding) => LINT_ENFORCERS.some(enforcer => belongsTo(enforcer, finding)) && attachesToSource(repositoryRoot, finding);
