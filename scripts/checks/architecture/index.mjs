import path from 'node:path';
import { canonical, loadArchitectureConfig } from './config.mjs';
import { sameOrUnder } from '../../lib/path-key.mjs';
import { buildTypeScriptContext, relativePath } from './typescript.mjs';
import { checkBackend } from './backend.mjs';
import { checkBackendContracts, PUBLIC_CONTRACT_RULE_ID, READONLY_BOUNDARY_RULE_ID } from './contracts.mjs';
import { checkFrontend } from './frontend.mjs';
import { checkOwners } from './owners.mjs';
import { checkModuleRegistration, REGISTRATION_RULE_IDS } from './registration.mjs';
import { checkFrontendDataLifecycle, SWR_DATA_RULE_IDS } from './next-data.mjs';
import { checkBackendSourceShape, SOURCE_LAYOUT_RULE_ID, SOURCE_NAME_RULE_ID } from './source-names.mjs';
import { checkHfs, checkHfsWithoutConfig, HFS_RULE_IDS } from './hfs.mjs';
import { buildHfsGraph } from './hfs-graph.mjs';
import { checkTiers, TIER_RULE_IDS } from './tiers.mjs';
import { checkReachability, REACHABILITY_RULE_IDS } from './reachability.mjs';
import { checkDeadExports, DEAD_EXPORT_RULE_IDS } from './dead-exports.mjs';
import { checkRequiredFiles, REQUIRED_FILE_RULE_IDS } from './required-files.mjs';
import { checkSizeGrowth, SIZE_GROWTH_RULE_IDS } from './size-growth.mjs';
import { checkClones, CLONE_RULE_IDS } from './clones.mjs';
import { checkSymbols, SYMBOL_RULE_IDS } from './symbols.mjs';
import { checkConnectionMap, CONNECTION_RULE_IDS } from './connection-map.mjs';
import { checkSqlOwner, SQL_OWNER_RULE_IDS } from './sql-owner.mjs';
import { checkRegisterOnce, REGISTER_ONCE_RULE_IDS } from './register-once.mjs';
import { checkErrorMasked, ERROR_MASKED_RULE_IDS } from './error-masked.mjs';
import { checkDefaultDeny, DEFAULT_DENY_RULE_IDS } from './default-deny.mjs';
import { checkEntrypoints, ENTRYPOINT_RULE_IDS } from './entrypoint.mjs';
import { checkErrorCodes, ERROR_CODE_RULE_IDS } from './error-codes.mjs';

export { REGISTRATION_RULE_IDS, SWR_DATA_RULE_IDS };

const LIMITATIONS = [
  'This is a static TypeScript dependency and source-shape check; it does not prove runtime dependency-injection bindings, global/provider scope, state lifetime, server/client behavior, feature-versus-capability ownership, route behavior, or business correctness.',
  'Dependencies hidden behind constructed aliases, reflection, or calls other than direct import()/require() syntax require separate review.',
  'Protocol surfaces selected through reflection, nonliteral computed properties, or aliases constructed beyond static import/re-export bindings require separate review.',
  'Backend source-shape rules classify only resolved roots, declarations, framework symbols, and static decorator arguments; cohesive capability, error, persistence, and migration ownership still require design and runtime evidence.',
  'Backend contract rules prove selected declaration and readonly field forms only; they do not prove runtime validation, serialization compatibility, provider scope, token identity, or dependency behavior.',
  'Frontend SWR lifecycle rules prove declared key bindings and installed SWR identity only; domain identity completeness, stale-result behavior and mutation effects require target behavior evidence.',
];

// The backend composition and data machine (R33, R38, R39, R41, R45, R84, R86): name -> [check, the rule ids it makes truthful].
const BACKEND_MACHINE = {
  connectionMap: [checkConnectionMap, CONNECTION_RULE_IDS],
  sqlOwner: [checkSqlOwner, SQL_OWNER_RULE_IDS],
  registerOnce: [checkRegisterOnce, REGISTER_ONCE_RULE_IDS],
  errorMasked: [checkErrorMasked, ERROR_MASKED_RULE_IDS],
  defaultDeny: [checkDefaultDeny, DEFAULT_DENY_RULE_IDS],
  entrypoints: [checkEntrypoints, ENTRYPOINT_RULE_IDS],
  errorCodes: [checkErrorCodes, ERROR_CODE_RULE_IDS],
};

const COMMON_RULE_IDS = [
  'ARCH_DYNAMIC_DEPENDENCY_UNPROVEN',
  'ARCH_INTERNAL_IMPORT_OUTSIDE',
  'ARCH_INTERNAL_IMPORT_UNRESOLVED',
  'ARCH_NO_SOURCE',
  'ARCH_PACKAGE_EXPORT_BYPASS',
  'ARCH_PACKAGE_IMPORTS_APP',
  'ARCH_SYNTAX_INVALID',
  'ARCH_TSCONFIG_INVALID',
  'ARCH_TSCONFIG_MISSING',
  'ARCH_TSCONFIG_REFERENCE_OUTSIDE',
];
const BACKEND_RULE_IDS = [
  'BE_APP_BUSINESS_ROLE',
  'BE_APP_COMPOSITION_ONLY',
  'BE_APPLICATION_IMPORTS_TRANSPORT',
  'BE_APPLICATION_TRANSPORT_FRAMEWORK',
];
const FRONTEND_RULE_IDS = [
  'FE_BLOCK_PRODUCT_HOOK_DEFINITION',
  'FE_COMPONENT_WORLD_OWNERSHIP',
  'FE_COMPONENT_DEEP_HOOK_IMPORT',
  'FE_CONNECTED_BLOCK_RENDER_PAIR',
  'FE_CUSTOM_HOOK_LOCATION',
  'FE_FETCH_OUTSIDE_TRANSPORT',
  'FE_PURE_REACHES_DATA',
  'FE_PURE_WORLD_HOOK',
  'FE_PURE_WORLD_IMPORT',
  'FE_ROUTE_CLIENT_BOUNDARY',
  'FE_ROUTE_CLIENT_HOOK',
  'FE_ROUTE_DEFAULT_EXPORT',
  'FE_ROUTE_DRAWING_DECISION',
  'FE_ROUTE_ONE_PAGE',
  'FE_SOURCE_LAYOUT_INVALID',
  'FE_WORLD_OWNER_RENDER_BOUNDARY',
];
export const OWNER_RULE_IDS = ['ARCH_OWNER_EXPORT_BYPASS', 'ARCH_OWNER_EXPORT_STAR'];
export const GRAMMAR_RULE_IDS = ['ARCH_GRAMMAR_CONTRACT_INVALID', 'ARCH_GRAMMAR_EXPORT_BYPASS'];

/** Errors the machine reports when it cannot judge (a check that cannot run is an error, never a pass). */
const ERROR_RULE_IDS = ['ARCH_COMPILER_FAILURE', 'ARCH_CONFIG_INVALID', 'ARCH_EXECUTION_UNAVAILABLE', 'ARCH_KNOWLEDGE_UNAVAILABLE', 'ARCH_TYPESCRIPT_INVALID', 'ARCH_TYPESCRIPT_MISSING'];

/** Every code the machine can emit, derived from the rule id lists of its checks (`hfs check` ships exactly these why entries). */
export const ARCHITECTURE_RULE_IDS = Object.freeze([...new Set([
  ...COMMON_RULE_IDS, ...BACKEND_RULE_IDS, ...FRONTEND_RULE_IDS, ...HFS_RULE_IDS, ...TIER_RULE_IDS, ...REACHABILITY_RULE_IDS,
  ...DEAD_EXPORT_RULE_IDS, ...REQUIRED_FILE_RULE_IDS, ...SIZE_GROWTH_RULE_IDS, ...CLONE_RULE_IDS, ...OWNER_RULE_IDS, ...GRAMMAR_RULE_IDS,
  ...REGISTRATION_RULE_IDS, ...SWR_DATA_RULE_IDS, ...SYMBOL_RULE_IDS, SOURCE_LAYOUT_RULE_ID, SOURCE_NAME_RULE_ID, PUBLIC_CONTRACT_RULE_ID,
  READONLY_BOUNDARY_RULE_ID, ...ERROR_RULE_IDS, ...Object.values(BACKEND_MACHINE).flatMap(([, ids]) => ids),
])].sort());

function stable(items) {
  return items.sort((a, b) => `${a.path ?? ''}:${a.line ?? 0}:${a.column ?? 0}:${a.ruleId}`.localeCompare(`${b.path ?? ''}:${b.line ?? 0}:${b.column ?? 0}:${b.ruleId}`));
}

/**
 * Check a target repository. injectedTypeScript exists only for hermetic rule fixtures. `fast` leaves out the checks
 * that read the whole repository to answer (clones, dead exports, repository-wide symbols); the pre-push check of the changed owners uses it.
 */
export function checkArchitecture({ repositoryRoot, injectedTypeScript, paths = [], base, fast = false, hfs: openedHfs } = {}) {
  let config;
  try {
    config = loadArchitectureConfig(repositoryRoot, { hfs: openedHfs });
  } catch (error) {
    const hfs = checkHfsWithoutConfig(repositoryRoot);
    return { schema: 'starci/architecture-check@1', ok: false, repository: String(repositoryRoot ?? ''), kinds: [], files: 0,
      compiler: null, violations: stable(hfs.violations), coverage: { hfs: hfs.coverage },
      errors: [{ ruleId: /^(HFS_[A-Z_]+):/.exec(String(error.message))?.[1] ?? 'ARCH_CONFIG_INVALID', message: String(error.message ?? error).replace(/^HFS_[A-Z_]+:\s*/, '') }], limitations: LIMITATIONS };
  }
  const hfs = checkHfs(config);
  let context;
  try {
    context = buildTypeScriptContext(config, injectedTypeScript, paths);
  } catch (error) {
    const message = String(error.message ?? error);
    const match = /^(ARCH_[A-Z_]+):\s*/.exec(message);
    return { schema: 'starci/architecture-check@1', ok: false, repository: config.root, kinds: config.kinds, files: 0,
      compiler: null, violations: hfs.violations, coverage: { hfs: hfs.coverage },
      errors: [{ ruleId: match?.[1] ?? 'ARCH_COMPILER_FAILURE', message: message.replace(/^(ARCH_[A-Z_]+):\s*/, '') }], limitations: LIMITATIONS };
  }
  const violations = [...hfs.violations];
  let moduleRegistration = { status: 'not-applicable' };
  let backendSourceShape = { status: 'not-applicable' };
  let backendContractTypeForm = { publicContracts: { status: 'not-applicable' }, readonlyBoundaries: { status: 'not-applicable' } };
  let frontendDataLifecycle = { status: 'not-applicable' };
  if (context.program) violations.push(...checkOwners(config, context));
  if (context.program && config.kinds.includes('backend')) {
    violations.push(...checkBackend(config, context));
    // A slice may omit every app root. Registration ownership needs the complete
    // composition graph even when the caller asks for findings in only one path.
    const registrationContext = paths.length && config.backend.moduleRegistration
      ? buildTypeScriptContext(config, injectedTypeScript) : context;
    const registration = checkModuleRegistration(config, registrationContext);
    violations.push(...registration.violations);
    moduleRegistration = registration.coverage;
    const sourceShape = checkBackendSourceShape(config, context);
    violations.push(...sourceShape.violations);
    backendSourceShape = sourceShape.coverage;
    const contracts = checkBackendContracts(config, context);
    violations.push(...contracts.violations);
    backendContractTypeForm = contracts.coverage;
  }
  let frontendChecked = config.kinds.includes('frontend');
  if (context.program && config.kinds.includes('frontend')) {
    // A broken authored input (the framework-pinned root list in knowledge) is an error, never a
    // silently different contract: the frontend rules are then not reported as checked.
    try {
      violations.push(...checkFrontend(config, context));
    } catch (error) {
      const message = String(error.message ?? error);
      const match = /^(ARCH_[A-Z_]+):\s*/.exec(message);
      if (!match) throw error;
      context.errors.push({ ruleId: match[1], message: message.slice(match[0].length) });
      frontendChecked = false;
    }
    const dataLifecycle = checkFrontendDataLifecycle(config, context);
    violations.push(...dataLifecycle.violations);
    frontendDataLifecycle = dataLifecycle.coverage;
  }
  // HFS machine: the slot-driven graph checks read the whole program, also when the caller asked for one path.
  const hfsContext = paths.length ? buildTypeScriptContext(config, injectedTypeScript) : context;
  const hfsChecks = { tiers: null, reachability: null, deadExports: null, requiredFiles: null, sizeGrowth: null, clones: null, symbols: null };
  if (hfsContext.program) {
    const graph = buildHfsGraph(config, hfsContext);
    const input = { config, context: hfsContext, graph, base };
    const runs = { tiers: () => checkTiers(graph), reachability: () => checkReachability(input), deadExports: () => checkDeadExports(input),
      requiredFiles: () => checkRequiredFiles(input), sizeGrowth: () => checkSizeGrowth(input), clones: () => checkClones(input), symbols: () => checkSymbols(input) };
    if (graph.profile === 'be') for (const [name, [check]] of Object.entries(BACKEND_MACHINE)) runs[name] = () => check(input);
    if (fast) { delete runs.deadExports; delete runs.clones; delete runs.symbols; }
    for (const [name, run] of Object.entries(runs)) {
      const result = run();
      violations.push(...result.violations);
      hfsChecks[name] = result.coverage;
    }
  }
  const inScope = item => !paths.length || (item.path && paths.some(prefix => sameOrUnder(item.path, prefix.replace(/\/$/, ''))));
  const errors = stable(context.errors.filter(item => item.ruleId.startsWith('ARCH_TSCONFIG_') || !item.path || inScope(item)));
  const scopedViolations = stable(violations.filter(inScope));
  const sourceFiles = new Set(context.files.map(file => canonical(file.fileName)));
  const missingOwnerEntries = config.owners?.filter(owner => !sourceFiles.has(canonical(path.resolve(config.root, ...owner.entry.split('/'))))) ?? [];
  const coverage = {
    sourceFiles: context.files.map(file => relativePath(config.root, canonical(file.fileName))).sort(),
    hfs: hfs.coverage,
    backendContractTypeForm,
    backendSourceShape,
    frontendDataLifecycle,
    moduleRegistration,
    hfsMachine: hfsChecks,
    ownerPublicApi: !config.owners.length
      ? { status: 'unavailable', reason: 'no slot owner instance with an entry file exists in the repository' }
      : missingOwnerEntries.length
        ? { status: 'unavailable', reason: 'one or more declared owner entries are outside the checked production TypeScript or JavaScript program',
          missingEntries: missingOwnerEntries.map(owner => owner.entry).sort() }
      : { status: 'checked', declarations: config.owners.length },
    grammarContract: !config.kinds.includes('frontend')
      ? { status: 'not-applicable' }
      : config.frontend.grammar
        ? { status: 'checked', package: config.frontend.grammar.package }
        : { status: 'unavailable', reason: 'no app has a src/app/globals.css to judge against the Grammar style entry' },
  };
  coverage.checkedRuleIds = [...new Set([
    ...COMMON_RULE_IDS,
    ...(hfs.coverage.status === 'checked' ? HFS_RULE_IDS : []),
    ...(config.kinds.includes('backend') ? BACKEND_RULE_IDS : []),
    ...(hfsChecks.tiers ? TIER_RULE_IDS : []),
    ...(hfsChecks.reachability?.status === 'checked' ? REACHABILITY_RULE_IDS : []),
    ...(hfsChecks.deadExports?.status === 'checked' ? DEAD_EXPORT_RULE_IDS : []),
    ...(hfsChecks.requiredFiles?.status === 'checked' ? REQUIRED_FILE_RULE_IDS : []),
    ...(hfsChecks.sizeGrowth?.status === 'checked' ? SIZE_GROWTH_RULE_IDS : []),
    ...(hfsChecks.clones?.status === 'checked' ? CLONE_RULE_IDS : []),
    ...(hfsChecks.symbols?.status === 'checked' ? SYMBOL_RULE_IDS : []),
    ...Object.entries(BACKEND_MACHINE).flatMap(([name, [, ids]]) => (hfsChecks[name]?.status === 'checked' ? ids : [])),
    ...(frontendChecked ? FRONTEND_RULE_IDS : []),
    ...(coverage.ownerPublicApi.status === 'checked' ? OWNER_RULE_IDS : []),
    ...(coverage.grammarContract.status === 'checked' ? GRAMMAR_RULE_IDS : []),
    ...(coverage.moduleRegistration.status === 'checked' ? REGISTRATION_RULE_IDS : []),
    ...(coverage.backendSourceShape.layout?.status === 'checked' ? [SOURCE_LAYOUT_RULE_ID] : []),
    ...(coverage.backendSourceShape.naming?.status === 'checked' ? [SOURCE_NAME_RULE_ID] : []),
    ...(coverage.backendContractTypeForm.publicContracts?.status === 'checked' ? [PUBLIC_CONTRACT_RULE_ID] : []),
    ...(coverage.backendContractTypeForm.readonlyBoundaries?.status === 'checked' ? [READONLY_BOUNDARY_RULE_ID] : []),
    ...(config.kinds.includes('frontend') && ['checked', 'not-applicable'].includes(coverage.frontendDataLifecycle.status) ? SWR_DATA_RULE_IDS : []),
  ])].sort();
  return {
    schema: 'starci/architecture-check@1',
    ok: errors.length === 0 && scopedViolations.length === 0,
    repository: config.root,
    kinds: config.kinds,
    files: context.files.length,
    compiler: { version: context.loaded.version, resolved: context.loaded.resolved, projects: context.projects.map(item => item.relative) },
    coverage,
    violations: scopedViolations,
    errors,
    limitations: LIMITATIONS,
  };
}
