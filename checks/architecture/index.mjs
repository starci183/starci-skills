import { loadArchitectureConfig } from './config.mjs';
import { buildTypeScriptContext } from './typescript.mjs';
import { checkBackend } from './backend.mjs';
import { checkFrontend } from './frontend.mjs';

const LIMITATIONS = [
  'This is a static TypeScript dependency and source-shape check; it does not prove runtime dependency-injection bindings, global/provider scope, state lifetime, server/client behavior, feature-versus-capability ownership, route behavior, or business correctness.',
  'Dynamic module names and dependencies constructed outside analyzable string-literal imports require separate review.',
];

function stable(items) {
  return items.sort((a, b) => `${a.path ?? ''}:${a.line ?? 0}:${a.column ?? 0}:${a.ruleId}`.localeCompare(`${b.path ?? ''}:${b.line ?? 0}:${b.column ?? 0}:${b.ruleId}`));
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
  if (context.program && config.kinds.includes('backend')) violations.push(...checkBackend(config, context));
  if (context.program && config.kinds.includes('frontend')) violations.push(...checkFrontend(config, context));
  const errors = stable(context.errors);
  stable(violations);
  return {
    schema: 'starci/architecture-check@1',
    ok: errors.length === 0 && violations.length === 0,
    repository: config.root,
    kinds: config.kinds,
    files: context.files.length,
    compiler: { version: context.loaded.version, resolved: context.loaded.resolved, projects: context.projects.map(item => item.relative) },
    violations,
    errors,
    limitations: LIMITATIONS,
  };
}
