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
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.initializer) && node.initializer.text === alias) {
        if (!ts.isObjectBindingPattern(node.name)) {
          usages.push({ node: node.name, detail: 'escaped @nestjs/common namespace access' });
        } else {
          for (const element of node.name.elements) {
            const selected = element.dotDotDotToken
              ? null
              : ts.isIdentifier(element.propertyName ?? element.name)
                ? (element.propertyName ?? element.name).text
                : ts.isStringLiteralLike(element.propertyName)
                  ? element.propertyName.text
                  : null;
            if (selected === null || NEST_COMMON_TRANSPORT.has(selected)) {
              usages.push({ node: element, detail: selected ?? 'computed @nestjs/common namespace destructuring' });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return usages;
  };
  for (const statement of sourceFile.statements) {
    const importEqualsSpecifier = ts.isImportEqualsDeclaration(statement)
      && ts.isExternalModuleReference(statement.moduleReference)
      && statement.moduleReference.expression
      && ts.isStringLiteralLike(statement.moduleReference.expression)
      ? statement.moduleReference.expression
      : null;
    const importSpecifier = ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)
      ? statement.moduleSpecifier
      : importEqualsSpecifier;
    if (!importSpecifier) continue;
    const specifier = importSpecifier.text;
    if (TRANSPORT_PACKAGES.test(specifier)) {
      found.push({ node: importSpecifier, specifier, detail: specifier });
      continue;
    }
    if (specifier !== '@nestjs/common') continue;
    if (ts.isImportEqualsDeclaration(statement)) {
      found.push(...namespaceUsages(statement.name.text).map(item => ({ ...item, specifier })));
      continue;
    }
    if (!statement.importClause) continue;
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
  const visitRequire = node => {
    const requiredSpecifier = call => ts.isCallExpression(call)
      && ts.isIdentifier(call.expression) && call.expression.text === 'require'
      && call.arguments.length === 1 && ts.isStringLiteralLike(call.arguments[0])
      ? call.arguments[0].text
      : null;
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && ts.isCallExpression(node.expression)) {
      const specifier = requiredSpecifier(node.expression);
      const selected = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
      if (specifier && TRANSPORT_PACKAGES.test(specifier)) {
        found.push({ node: ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression, specifier, detail: `${selected ?? 'computed member'} from ${specifier}` });
      } else if (specifier === '@nestjs/common' && (selected === null || NEST_COMMON_TRANSPORT.has(selected))) {
        found.push({ node: ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression, specifier, detail: selected ?? 'computed @nestjs/common require access' });
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)
      && requiredSpecifier(node.initializer)) {
      const specifier = requiredSpecifier(node.initializer);
      if (TRANSPORT_PACKAGES.test(specifier)) {
        found.push({ node: node.initializer.arguments[0], specifier, detail: specifier });
      } else if (specifier === '@nestjs/common') {
        if (ts.isIdentifier(node.name)) {
          found.push(...namespaceUsages(node.name.text).map(item => ({ ...item, specifier })));
        } else if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            const selected = element.dotDotDotToken
              ? null
              : ts.isIdentifier(element.propertyName ?? element.name)
                ? (element.propertyName ?? element.name).text
                : ts.isStringLiteralLike(element.propertyName)
                  ? element.propertyName.text
                  : null;
            if (selected === null || NEST_COMMON_TRANSPORT.has(selected)) found.push({ node: element, specifier, detail: selected ?? 'computed @nestjs/common require destructuring' });
          }
        }
      }
    }
    ts.forEachChild(node, visitRequire);
  };
  visitRequire(sourceFile);
  return found;
}

function importedSurface(ts, declaration) {
  if (!ts.isImportDeclaration(declaration)) return null;
  const clause = declaration.importClause;
  if (!clause) return null;
  const names = new Set(clause.name ? ['default'] : []);
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) return null;
  if (bindings && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) names.add(element.propertyName?.text ?? element.name.text);
  }
  return names;
}

function selectedReexportSurface(ts, declaration, selected) {
  if (!ts.isExportDeclaration(declaration)) return undefined;
  if (!declaration.exportClause) return selected;
  if (ts.isNamespaceExport(declaration.exportClause)) {
    return selected === null || selected.has(declaration.exportClause.name.text) ? null : undefined;
  }
  if (!ts.isNamedExports(declaration.exportClause)) return undefined;
  const next = new Set();
  for (const element of declaration.exportClause.elements) {
    if (selected === null || selected.has(element.name.text)) next.add(element.propertyName?.text ?? element.name.text);
  }
  return next.size ? next : undefined;
}

function externalTransportReexport(ts, sourceFile, selected) {
  const imported = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier) || !statement.importClause) continue;
    const specifier = statement.moduleSpecifier.text;
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) imported.set(element.name.text, { specifier, imported: element.propertyName?.text ?? element.name.text });
    } else if (bindings && ts.isNamespaceImport(bindings)) imported.set(bindings.name.text, { specifier, imported: null });
  }
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const clause = statement.exportClause;
    const specifier = ts.isStringLiteralLike(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null;
    if (specifier && (specifier === '@nestjs/common' || TRANSPORT_PACKAGES.test(specifier))) {
      if (!clause) {
        if (specifier !== '@nestjs/common' || selected === null || [...selected].some(name => NEST_COMMON_TRANSPORT.has(name))) {
          return { node: statement.moduleSpecifier, specifier, detail: selected === null ? `unbounded ${specifier} re-export` : `re-exported ${[...selected].join(', ')}` };
        }
        continue;
      }
      if (ts.isNamespaceExport(clause)) {
        if (selected === null || selected.has(clause.name.text)) return { node: clause.name, specifier, detail: `namespace re-export from ${specifier}` };
        continue;
      }
      if (!ts.isNamedExports(clause)) continue;
      for (const element of clause.elements) {
        if (selected !== null && !selected.has(element.name.text)) continue;
        const original = element.propertyName?.text ?? element.name.text;
        if (specifier !== '@nestjs/common' || NEST_COMMON_TRANSPORT.has(original)) return { node: element, specifier, detail: `${element.name.text} re-exported from ${specifier}` };
      }
      continue;
    }
    if (specifier || !clause || !ts.isNamedExports(clause)) continue;
    for (const element of clause.elements) {
      if (selected !== null && !selected.has(element.name.text)) continue;
      const local = element.propertyName?.text ?? element.name.text;
      const binding = imported.get(local);
      if (!binding) continue;
      if (binding.specifier !== '@nestjs/common' && !TRANSPORT_PACKAGES.test(binding.specifier)) continue;
      if (binding.specifier === '@nestjs/common' && (binding.imported === null || !NEST_COMMON_TRANSPORT.has(binding.imported))) continue;
      return { node: element, specifier: binding.specifier, detail: `${element.name.text} re-exported from ${binding.specifier}` };
    }
  }
  return null;
}

function reexportedTransportEvidence(ts, context, sourceFiles, firstEdge) {
  const queue = [{ file: firstEdge.to, selected: importedSurface(ts, firstEdge.declaration), chain: [firstEdge.from, firstEdge.to] }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    const key = `${current.file}\0${current.selected === null ? '*' : [...current.selected].sort().join(',')}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const sourceFile = sourceFiles.get(path.resolve(current.file));
    if (!sourceFile) continue;
    const evidence = externalTransportReexport(ts, sourceFile, current.selected);
    if (evidence) return { evidence, chain: current.chain };
    for (const edge of context.edges.get(current.file) ?? []) {
      if (!edge.reexport) continue;
      const selected = selectedReexportSurface(ts, edge.declaration, current.selected);
      if (selected !== undefined) queue.push({ file: edge.to, selected, chain: [...current.chain, edge.to] });
    }
  }
  return null;
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
  const sourceFiles = new Map(context.files.map(file => [path.resolve(file.fileName), file]));
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
        const reexported = reexportedTransportEvidence(context.ts, context, sourceFiles, edge);
        if (reexported) violations.push(finding(config, edge, 'BE_APPLICATION_TRANSPORT_FRAMEWORK', `Feature application code imports protocol surface ${reexported.evidence.detail} through an internal re-export. Keep protocol decorators and types under transport/.`, reexported.chain));
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
