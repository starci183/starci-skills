import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig } from './config.mjs';
import { buildTypeScriptContext, relativePath } from './typescript.mjs';
import { checkBackend } from './backend.mjs';
import { checkBackendContracts, PUBLIC_CONTRACT_RULE_ID, READONLY_BOUNDARY_RULE_ID } from './contracts.mjs';
import { checkFrontend } from './frontend.mjs';
import { checkOwners } from './owners.mjs';
import { checkModuleRegistration, REGISTRATION_RULE_IDS } from './registration.mjs';
import { checkFrontendDataLifecycle, SWR_DATA_RULE_IDS } from './next-data.mjs';
import { checkBackendSourceShape, SOURCE_LAYOUT_RULE_ID, SOURCE_NAME_RULE_ID } from './source-names.mjs';

const LIMITATIONS = [
  'This is a static TypeScript dependency and source-shape check; it does not prove runtime dependency-injection bindings, global/provider scope, state lifetime, server/client behavior, feature-versus-capability ownership, route behavior, or business correctness.',
  'Dependencies hidden behind constructed aliases, reflection, or calls other than direct import()/require() syntax require separate review.',
  'Protocol surfaces selected through reflection, nonliteral computed properties, or aliases constructed beyond static import/re-export bindings require separate review.',
  'Backend source-shape rules classify only resolved roots, declarations, framework symbols, and static decorator arguments; cohesive capability, error, persistence, and migration ownership still require design and runtime evidence.',
  'Backend contract rules prove selected declaration and readonly field forms only; they do not prove runtime validation, serialization compatibility, provider scope, token identity, or dependency behavior.',
  'Frontend SWR lifecycle rules prove declared key bindings and installed SWR identity only; domain identity completeness, stale-result behavior and mutation effects require target behavior evidence.',
];

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
  'BE_FEATURE_IMPORTS_APP',
  'BE_MODULE_IMPORTS_APP',
  'BE_MODULE_IMPORTS_FEATURE',
];
const FRONTEND_RULE_IDS = [
  'FE_COMPONENT_DEEP_HOOK_IMPORT',
  'FE_COMPONENT_IMPORTS_TRANSPORT',
  'FE_FETCH_OUTSIDE_TRANSPORT',
  'FE_PURE_REACHES_DATA',
  'FE_PURE_WORLD_HOOK',
  'FE_PURE_WORLD_IMPORT',
  'FE_ROUTE_CLIENT_BOUNDARY',
  'FE_ROUTE_CLIENT_HOOK',
  'FE_ROUTE_DEFAULT_EXPORT',
  'FE_ROUTE_DRAWING_DECISION',
  'FE_ROUTE_ONE_PAGE',
  'FE_TIER_IMPORTS_UPWARD',
  'FE_WORLD_OWNER_RENDER_BOUNDARY',
];
const OWNER_RULE_IDS = ['ARCH_OWNER_EXPORT_BYPASS', 'ARCH_OWNER_EXPORT_STAR'];
const GRAMMAR_RULE_IDS = ['ARCH_GRAMMAR_CONTRACT_INVALID', 'ARCH_GRAMMAR_EXPORT_BYPASS'];

function stable(items) {
  return items.sort((a, b) => `${a.path ?? ''}:${a.line ?? 0}:${a.column ?? 0}:${a.ruleId}`.localeCompare(`${b.path ?? ''}:${b.line ?? 0}:${b.column ?? 0}:${b.ruleId}`));
}

function canonical(file) {
  const absolute = path.resolve(file);
  try { return path.resolve(fs.realpathSync(absolute)); } catch { return absolute; }
}

/** Check a target repository. injectedTypeScript exists only for hermetic rule fixtures. */
export function checkArchitecture({ repositoryRoot, configFile, injectedTypeScript } = {}) {
  let config;
  try {
    config = loadArchitectureConfig(repositoryRoot, configFile);
  } catch (error) {
    return { schema: 'starci/architecture-check@1', ok: false, repository: String(repositoryRoot ?? ''), kinds: [], files: 0,
      compiler: null, violations: [], errors: [{ ruleId: 'ARCH_CONFIG_INVALID', message: String(error.message ?? error) }], limitations: LIMITATIONS };
  }
  let context;
  try {
    context = buildTypeScriptContext(config, injectedTypeScript);
  } catch (error) {
    const message = String(error.message ?? error);
    const match = /^(ARCH_[A-Z_]+):\s*/.exec(message);
    return { schema: 'starci/architecture-check@1', ok: false, repository: config.root, kinds: config.kinds, files: 0,
      compiler: null, violations: [], errors: [{ ruleId: match?.[1] ?? 'ARCH_COMPILER_FAILURE', message: message.replace(/^(ARCH_[A-Z_]+):\s*/, '') }], limitations: LIMITATIONS };
  }
  const violations = [];
  let moduleRegistration = { status: 'not-applicable' };
  let backendSourceShape = { status: 'not-applicable' };
  let backendContractTypeForm = { publicContracts: { status: 'not-applicable' }, readonlyBoundaries: { status: 'not-applicable' } };
  let frontendDataLifecycle = { status: 'not-applicable' };
  if (context.program) violations.push(...checkOwners(config, context));
  if (context.program && config.kinds.includes('backend')) {
    violations.push(...checkBackend(config, context));
    const registration = checkModuleRegistration(config, context);
    violations.push(...registration.violations);
    moduleRegistration = registration.coverage;
    const sourceShape = checkBackendSourceShape(config, context);
    violations.push(...sourceShape.violations);
    backendSourceShape = sourceShape.coverage;
    const contracts = checkBackendContracts(config, context);
    violations.push(...contracts.violations);
    backendContractTypeForm = contracts.coverage;
  }
  if (context.program && config.kinds.includes('frontend')) {
    violations.push(...checkFrontend(config, context));
    const dataLifecycle = checkFrontendDataLifecycle(config, context);
    violations.push(...dataLifecycle.violations);
    frontendDataLifecycle = dataLifecycle.coverage;
  }
  const errors = stable(context.errors);
  stable(violations);
  const sourceFiles = new Set(context.files.map(file => canonical(file.fileName)));
  const missingOwnerEntries = config.owners?.filter(owner => !sourceFiles.has(canonical(path.resolve(config.root, ...owner.entry.split('/'))))) ?? [];
  const coverage = {
    sourceFiles: context.files.map(file => relativePath(config.root, canonical(file.fileName))).sort(),
    backendContractTypeForm,
    backendSourceShape,
    frontendDataLifecycle,
    moduleRegistration,
    ownerPublicApi: config.owners === null
      ? { status: 'unavailable', reason: 'architecture.json does not declare owners and public entries' }
      : missingOwnerEntries.length
        ? { status: 'unavailable', reason: 'one or more declared owner entries are outside the checked production TypeScript or JavaScript program',
          missingEntries: missingOwnerEntries.map(owner => owner.entry).sort() }
      : { status: 'checked', declarations: config.owners.length },
    grammarContract: !config.kinds.includes('frontend')
      ? { status: 'not-applicable' }
      : config.frontend.grammar
        ? { status: 'checked', package: config.frontend.grammar.package }
        : { status: 'unavailable', reason: 'architecture.json does not declare the selected Grammar contract' },
  };
  coverage.checkedRuleIds = [...new Set([
    ...COMMON_RULE_IDS,
    ...(config.kinds.includes('backend') ? BACKEND_RULE_IDS : []),
    ...(config.kinds.includes('frontend') ? FRONTEND_RULE_IDS : []),
    ...(coverage.ownerPublicApi.status === 'checked' ? OWNER_RULE_IDS : []),
    ...(coverage.grammarContract.status === 'checked' ? GRAMMAR_RULE_IDS : []),
    ...(coverage.moduleRegistration.status === 'checked' ? REGISTRATION_RULE_IDS : []),
    ...(coverage.backendSourceShape.layout?.status === 'checked' ? [SOURCE_LAYOUT_RULE_ID] : []),
    ...(coverage.backendSourceShape.naming?.status === 'checked' ? [SOURCE_NAME_RULE_ID] : []),
    ...(coverage.backendContractTypeForm.publicContracts?.status === 'checked' ? [PUBLIC_CONTRACT_RULE_ID] : []),
    ...(coverage.backendContractTypeForm.readonlyBoundaries?.status === 'checked' ? [READONLY_BOUNDARY_RULE_ID] : []),
    ...(coverage.frontendDataLifecycle.status === 'checked' ? SWR_DATA_RULE_IDS : []),
  ])].sort();
  return {
    schema: 'starci/architecture-check@1',
    ok: errors.length === 0 && violations.length === 0,
    repository: config.root,
    kinds: config.kinds,
    files: context.files.length,
    compiler: { version: context.loaded.version, resolved: context.loaded.resolved, projects: context.projects.map(item => item.relative) },
    coverage,
    violations,
    errors,
    limitations: LIMITATIONS,
  };
}
