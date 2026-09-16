import path from 'node:path';
import { isInside } from './config.mjs';
import { reachableViolation, relativePath, sourceLocation } from './typescript.mjs';

const FORBIDDEN_APP_ROLE = /(?:^|\.)(?:service|provider|providers|resolver|controller|handler|repository|entity|use-case|command|query|listener|consumer|processor)\.[cm]?[jt]sx?$/i;
const FORBIDDEN_DECLARATION = /(?:Service|Provider|Resolver|Controller|Handler|Repository|Entity|UseCase|Command|Query|Listener|Consumer|Processor)$/;
const FORBIDDEN_DECORATORS = new Set(['Controller', 'Resolver', 'Injectable', 'Processor', 'WebSocketGateway']);
const TRANSPORT_PACKAGES = /^(?:@nestjs\/(?:graphql|microservices|platform-[^/]+|websockets)(?:\/|$)|@apollo\/|apollo-server(?:\/|$)|express(?:\/|$)|fastify(?:\/|$)|graphql(?:\/|$)|class-validator(?:\/|$)|class-transformer(?:\/|$))/;
const NEST_COMMON_TRANSPORT = new Set(['Controller', 'Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'Body', 'Param', 'Query', 'Req', 'Request', 'Res', 'Response', 'Headers', 'Header', 'HttpCode', 'Redirect', 'Render', 'Sse', 'UploadedFile', 'UploadedFiles', 'UseGuards', 'UseInterceptors', 'UsePipes']);

function absolute(root, relative) {
  return path.resolve(root, ...relative.split('/'));
}

function roots(root, relatives) {
  return relatives.map(relative => absolute(root, relative));
}

function insideAny(candidates, fileName) {
  return candidates.some(root => isInside(root, fileName));
}

function insideFeatureLayer(featureRoots, fileName, layer) {
  return featureRoots.some(root => isInside(root, fileName)
    && relativePath(root, fileName).split('/').some(segment => segment.toLowerCase() === layer));
}

function appSource(config, fileName) {
  for (const appRoot of roots(config.root, config.backend.apps)) {
    if (!isInside(appRoot, fileName)) continue;
    const parts = relativePath(appRoot, fileName).split('/');
    const sourceIndex = parts.indexOf('src');
    if (sourceIndex >= 0) return { appRoot, relative: parts.slice(sourceIndex + 1).join('/') };
    if (path.basename(appRoot).toLowerCase() === 'src') return { appRoot, relative: parts.join('/') };
    return null;
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
    && /(?:\.adapter|\.config|config|configuration|environment|constants|types)\.[cm]?[jt]s$/i.test(basename);
}

function decoratorName(ts, decorator) {
  const expression = decorator.expression;
  const called = ts.isCallExpression(expression) ? expression.expression : expression;
  if (ts.isIdentifier(called)) return called.text;
  return ts.isPropertyAccessExpression(called) ? called.name.text : null;
}

function roleEvidence(ts, sourceFile) {
  let found = null;
  const visit = node => {
    if (found) return;
    const decorators = ts.canHaveDecorators?.(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
    const forbidden = decorators.find(item => FORBIDDEN_DECORATORS.has(decoratorName(ts, item)));
    if (forbidden) {
      found = { node: forbidden, detail: `@${decoratorName(ts, forbidden)}` };
      return;
    }
    if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && FORBIDDEN_DECLARATION.test(node.name.text)) {
      found = { node: node.name, detail: node.name.text };
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function transportFrameworkEvidence(ts, sourceFile) {
  const found = [];
  const namespaceUsages = alias => {
    const usages = [];
    const visit = node => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === alias
        && NEST_COMMON_TRANSPORT.has(node.name.text)) usages.push({ node: node.name, detail: node.name.text });
      if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === alias) {
        const selected = ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
        if (selected === null || NEST_COMMON_TRANSPORT.has(selected)) usages.push({ node: node.argumentExpression, detail: selected ?? 'computed @nestjs/common namespace access' });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return usages;
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (TRANSPORT_PACKAGES.test(specifier)) {
      found.push({ node: statement.moduleSpecifier, specifier, detail: specifier });
      continue;
    }
    if (specifier !== '@nestjs/common' || !statement.importClause) continue;
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      found.push(...namespaceUsages(bindings.name.text).map(item => ({ ...item, specifier })));
      continue;
    }
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (NEST_COMMON_TRANSPORT.has(imported)) found.push({ node: element, specifier, detail: imported });
    }
  }
  return found;
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

/** Enforce backend direction and keep executable apps as measurable composition roots. */
export function checkBackend(config, context) {
  const violations = [];
  const moduleRoots = roots(config.root, config.backend.modules);
  const featureRoots = roots(config.root, config.backend.features);
  const isApp = file => Boolean(appSource(config, file));
  for (const sourceFile of context.files) {
    const fileName = path.resolve(sourceFile.fileName);
    const fromModules = insideAny(moduleRoots, fileName);
    const fromFeatures = insideAny(featureRoots, fileName);
    const fromApplication = fromFeatures && insideFeatureLayer(featureRoots, fileName, 'application');
    const app = !fromModules && !fromFeatures ? appSource(config, fileName) : null;
    if (app) {
      const evidence = roleEvidence(context.ts, sourceFile);
      if (evidence) {
        violations.push({
          ruleId: 'BE_APP_BUSINESS_ROLE',
          path: relativePath(config.root, fileName),
          ...sourceLocation(sourceFile, evidence.node),
          message: `Application composition source contains measurable business/provider role ${evidence.detail}. Move that role under src/features or src/modules.`,
        });
      } else if (!isBootstrapConfig(app.relative)) {
        violations.push({
          ruleId: FORBIDDEN_APP_ROLE.test(path.posix.basename(app.relative)) ? 'BE_APP_BUSINESS_ROLE' : 'BE_APP_COMPOSITION_ONLY',
          path: relativePath(config.root, fileName),
          line: 1,
          column: 1,
          message: `Application source ${app.relative} is not an entry, root module, or narrowly named bootstrap/config/framework adapter.`,
        });
      }
    }
    if (!fromModules && !fromFeatures) continue;
    if (fromApplication) {
      for (const evidence of transportFrameworkEvidence(context.ts, sourceFile)) violations.push({
        ruleId: 'BE_APPLICATION_TRANSPORT_FRAMEWORK',
        path: relativePath(config.root, fileName),
        ...sourceLocation(sourceFile, evidence.node),
        specifier: evidence.specifier,
        message: `Feature application code imports transport framework surface ${evidence.detail}. Keep protocol decorators, request/response types, validation DTOs, and generated transport types under transport/.`,
      });
    }
    for (const edge of context.edges.get(fileName) ?? []) {
      if (fromApplication) {
        const transportChain = reachableViolation(context.edges, edge, target => insideFeatureLayer(featureRoots, target, 'transport'));
        if (transportChain) violations.push(finding(config, edge, 'BE_APPLICATION_IMPORTS_TRANSPORT', 'Feature application code cannot depend on transport adapters or DTOs, including through a type import or barrel.', transportChain));
      }
      if (fromModules) {
        const featureChain = reachableViolation(context.edges, edge, target => insideAny(featureRoots, target));
        if (featureChain) violations.push(finding(config, edge, 'BE_MODULE_IMPORTS_FEATURE', 'A backend module cannot depend on a feature entry surface, including through a type or barrel.', featureChain));
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
