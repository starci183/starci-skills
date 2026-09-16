import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig } from './config.mjs';
import { buildTypeScriptContext } from './typescript.mjs';
import { checkBackend } from './backend.mjs';
import { checkFrontend } from './frontend.mjs';
import { checkOwners } from './owners.mjs';

const LIMITATIONS = [
  'This is a static TypeScript dependency and source-shape check; it does not prove runtime dependency-injection bindings, global/provider scope, state lifetime, server/client behavior, feature-versus-capability ownership, route behavior, or business correctness.',
  'Dynamic module names and dependencies constructed outside analyzable string-literal imports require separate review.',
  'Protocol surfaces selected through reflection, nonliteral computed properties, or aliases constructed beyond static import/re-export bindings require separate review.',
];

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
  if (context.program) violations.push(...checkOwners(config, context));
  if (context.program && config.kinds.includes('backend')) violations.push(...checkBackend(config, context));
  if (context.program && config.kinds.includes('frontend')) violations.push(...checkFrontend(config, context));
  const errors = stable(context.errors);
  stable(violations);
  const sourceFiles = new Set(context.files.map(file => canonical(file.fileName)));
  const missingOwnerEntries = config.owners?.filter(owner => !sourceFiles.has(canonical(path.resolve(config.root, ...owner.entry.split('/'))))) ?? [];
  const coverage = {
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
