import path from 'node:path';
import { isInside } from './config.mjs';
import { reachableViolation, relativePath } from './typescript.mjs';

const FORBIDDEN_APP_ROLE = /(?:^|\.)(?:service|provider|providers|resolver|controller|handler|repository|entity|use-case|command|query|listener|consumer|processor)\.[cm]?[jt]sx?$/i;

function absolute(root, relative) {
  return path.resolve(root, ...relative.split('/'));
}

function appSource(config, fileName) {
  for (const appRoot of config.backend.apps) {
    const root = absolute(config.root, appRoot);
    if (!isInside(root, fileName)) continue;
    const parts = relativePath(root, fileName).split('/');
    const sourceIndex = parts.indexOf('src');
    if (sourceIndex < 1) return null;
    return { appRoot: root, relative: parts.slice(sourceIndex + 1).join('/') };
  }
  return null;
}

function isBootstrapConfig(relative) {
  const basename = path.posix.basename(relative);
  if (/^main\.[cm]?[jt]sx?$/i.test(relative) || /^app\.module\.[cm]?[jt]sx?$/i.test(relative)) return true;
  if (FORBIDDEN_APP_ROLE.test(basename)) return false;
  if (/^(?:config|configuration|environment)\.[cm]?[jt]s$/i.test(basename)) return true;
  const first = relative.split('/')[0];
  return ['bootstrap', 'config', 'env'].includes(first)
    && /(?:\.config|config|configuration|environment|constants|types)\.[cm]?[jt]s$/i.test(basename);
}

function finding(config, edge, ruleId, message, chain) {
  return {
    ruleId,
    path: relativePath(config.root, edge.from),
    line: edge.line,
    column: edge.column,
    specifier: edge.specifier,
    resolvedPath: relativePath(config.root, chain.at(-1)),
    dependencyChain: chain.map(file => relativePath(config.root, file)),
    message,
  };
}

/** Enforce backend direction and keep executable apps as composition roots. */
export function checkBackend(config, context) {
  const violations = [];
  const moduleRoot = absolute(config.root, config.backend.modules);
  const featureRoot = absolute(config.root, config.backend.features);
  const isApp = file => Boolean(appSource(config, file));
  for (const sourceFile of context.files) {
    const fileName = path.resolve(sourceFile.fileName);
    const app = appSource(config, fileName);
    if (app && !isBootstrapConfig(app.relative)) {
      violations.push({
        ruleId: FORBIDDEN_APP_ROLE.test(path.posix.basename(app.relative)) ? 'BE_APP_BUSINESS_ROLE' : 'BE_APP_COMPOSITION_ONLY',
        path: relativePath(config.root, fileName),
        line: 1,
        column: 1,
        message: `Application source ${app.relative} is not a composition entry or narrowly scoped bootstrap configuration. Move business, provider, resolver, and controller code under src/features or src/modules.`,
      });
    }
    const fromModules = isInside(moduleRoot, fileName);
    const fromFeatures = isInside(featureRoot, fileName);
    if (!fromModules && !fromFeatures) continue;
    for (const edge of context.edges.get(fileName) ?? []) {
      if (!edge.runtime) continue;
      if (fromModules) {
        const featureChain = reachableViolation(context.edges, edge, target => isInside(featureRoot, target));
        if (featureChain) violations.push(finding(config, edge, 'BE_MODULE_IMPORTS_FEATURE', 'A backend module cannot depend on a feature entry surface.', featureChain));
        const appChain = reachableViolation(context.edges, edge, isApp);
        if (appChain) violations.push(finding(config, edge, 'BE_MODULE_IMPORTS_APP', 'A backend module cannot depend on an application composition root.', appChain));
      }
      if (fromFeatures) {
        const appChain = reachableViolation(context.edges, edge, isApp);
        if (appChain) violations.push(finding(config, edge, 'BE_FEATURE_IMPORTS_APP', 'A backend feature cannot depend on an application composition root.', appChain));
      }
    }
  }
  return violations;
}
