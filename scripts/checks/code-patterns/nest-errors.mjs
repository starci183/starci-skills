import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig, isInside, slash } from '../architecture/config.mjs';
import { buildTypeScriptContext } from '../architecture/typescript.mjs';

export const NEST_ERROR_RULES = Object.freeze(['NEST_FOREIGN_ERROR_CAUSE', 'NEST_TRANSPORT_ERROR_MAPPER']);
const CONTRACT_SCHEMA = 'starci/nest-transport-error-contract@1';
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const SOURCE = /\.(?:[cm]?ts|tsx)$/;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = file => path.resolve(file).replaceAll('\\', '/');

function exact(value, keys, label) {
  if (!plain(value) || Object.keys(value).some(name => !keys.includes(name))) throw Error(`${label} has an invalid shape.`);
}

function safeFile(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative !== path.posix.normalize(relative)
    || path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative) || relative === '.' || relative.split('/').includes('..')) throw Error('Expected an exact repository-relative source path.');
  const absolute = path.resolve(root, relative);
  for (let cursor = absolute; cursor !== root; cursor = path.dirname(cursor)) {
    if (!isInside(root, cursor) || fs.lstatSync(cursor).isSymbolicLink()) throw Error(`Source cannot redirect through a link: ${relative}`);
  }
  if (!fs.lstatSync(absolute).isFile()) throw Error(`Source must be a regular file: ${relative}`);
  return absolute;
}

function compilerIdentity(options) {
  const stable = value => Array.isArray(value) ? value.map(stable) : plain(value)
    ? Object.fromEntries(Object.keys(value).sort().filter(name => !['configFilePath', 'outDir', 'declarationDir', 'tsBuildInfoFile'].includes(name)).map(name => [name, stable(value[name])])) : value;
  return JSON.stringify(stable(options));
}

function projectBinding(context, absolute) {
  const owners = context.projects.filter(project => project.program.getRootFileNames().some(file => key(file) === key(absolute)));
  if (!owners.length) throw Error(`Source has no owning declared TypeScript project: ${absolute}`);
  if (new Set(owners.map(project => compilerIdentity(project.options))).size !== 1) throw Error(`Source has conflicting TypeScript project meaning: ${absolute}`);
  const project = owners[0], source = project.program.getSourceFile(absolute);
  if (!source || project.program.getSyntacticDiagnostics(source).length) throw Error(`Source is unavailable or syntactically invalid: ${absolute}`);
  return { source, checker: project.program.getTypeChecker(), program: project.program };
}

function unwrap(ts, node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
    || ts.isNonNullExpression(node) || ts.isSatisfiesExpression?.(node) || ts.isAwaitExpression(node))) node = node.expression;
  return node;
}

function unalias(ts, checker, symbol) {
  const seen = new Set();
  while (symbol && symbol.flags & ts.SymbolFlags.Alias && !seen.has(symbol)) {
    seen.add(symbol); symbol = checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

const symbolAt = (ts, checker, node) => unalias(ts, checker, checker.getSymbolAtLocation(node));

function moduleSpecifier(ts, declaration) {
  for (let node = declaration; node; node = node.parent) if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) return node.moduleSpecifier.text;
  return null;
}

function importedBinding(ts, checker, input) {
  const node = unwrap(ts, input);
  if (ts.isPropertyAccessExpression(node)) {
    const declarations = checker.getSymbolAtLocation(node.expression)?.declarations ?? [];
    const namespace = declarations.find(item => ts.isNamespaceImport(item));
    return namespace ? { module: moduleSpecifier(ts, namespace), name: node.name.text } : null;
  }
  if (!ts.isIdentifier(node)) return null;
  const declaration = (checker.getSymbolAtLocation(node)?.declarations ?? []).find(item => ts.isImportSpecifier(item));
  return declaration ? { module: moduleSpecifier(ts, declaration), name: declaration.propertyName?.text ?? declaration.name.text } : null;
}

function frameworkBinding(ts, checker, input) {
  const identity = symbolAt(ts, checker, ts.isPropertyAccessExpression(unwrap(ts, input)) ? unwrap(ts, input).name : unwrap(ts, input));
  for (const declaration of identity?.declarations ?? []) {
    const file = slash(declaration.getSourceFile().fileName);
    for (const module of ['@nestjs/common', '@nestjs/core', '@nestjs/graphql']) if (file.includes(`/node_modules/${module}/`)) return { module, name: identity.name };
  }
  return null;
}

function propertyName(ts, node) {
  return ts.isPropertyAccessExpression(node) ? node.name.text
    : ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
}

function member(ts, object, name) {
  if (!ts.isObjectLiteralExpression(object)) return null;
  for (let index = object.properties.length - 1; index >= 0; index -= 1) {
    const item = object.properties[index];
    if (ts.isSpreadAssignment(item)) return null;
    if (item.name && ts.isComputedPropertyName(item.name)) {
      if (!ts.isStringLiteralLike(item.name.expression)) return null;
      if (item.name.expression.text === name) return item;
      continue;
    }
    if ((item.name?.text ?? item.name?.escapedText) === name) return item;
  }
  return null;
}

function memberValue(ts, object, name) {
  const item = member(ts, object, name);
  if (!item) return null;
  if (ts.isPropertyAssignment(item)) return item.initializer;
  if (ts.isShorthandPropertyAssignment(item)) return item.name;
  if (ts.isMethodDeclaration(item)) return item;
  return null;
}

function readContract(root) {
  const pkg = JSON.parse(fs.readFileSync(safeFile(root, 'package.json'), 'utf8'));
  const value = pkg.starci?.codePatterns?.nest?.transportErrors;
  exact(value, ['schema', 'errorTypes', 'transports', 'mappers'], 'Nest transport error contract');
  if (value.schema !== CONTRACT_SCHEMA) throw Error(`Declare package.json#starci.codePatterns.nest.transportErrors schema ${CONTRACT_SCHEMA}.`);
  if (!Array.isArray(value.transports) || new Set(value.transports).size !== value.transports.length
    || value.transports.some(item => !['http', 'graphql'].includes(item))) throw Error('Transport inventory contains only unique http/graphql values.');
  if (!Array.isArray(value.errorTypes) || !value.errorTypes.length || !Array.isArray(value.mappers)) throw Error('Transport error contract needs errorTypes and mappers arrays.');
  const ids = new Set();
  const errorTypes = value.errorTypes.map(item => {
    exact(item, ['id', 'path', 'export', 'codeProperty', 'messageProperty', 'causeProperties'], 'Error type');
    if (![item.id, item.export, item.codeProperty, item.messageProperty].every(name => typeof name === 'string' && IDENTIFIER.test(name))
      || ids.has(item.id) || !Array.isArray(item.causeProperties) || !item.causeProperties.length || new Set(item.causeProperties).size !== item.causeProperties.length
      || item.causeProperties.some(name => typeof name !== 'string' || !IDENTIFIER.test(name))) throw Error('Error type identities and cause properties must be unique identifiers.');
    ids.add(item.id); return { ...item, absolute: safeFile(root, item.path) };
  });
  if (new Set(errorTypes.map(item => `${item.path}#${item.export}`)).size !== errorTypes.length) throw Error('Error type source identities must be unique.');
  const mapperIds = new Set();
  const mappers = value.mappers.map(item => {
    const common = ['id', 'kind', 'path', 'export', 'method', 'errorType', 'status'];
    const allowed = item.kind === 'nest-http-filter' ? [...common, 'passthroughHostTypes']
      : item.kind === 'apollo-graphql' ? [...common, 'formatProperty', 'statusPlugin', 'originalErrorProperty'] : common;
    exact(item, allowed, 'Transport mapper');
    if (!['nest-http-filter', 'apollo-graphql'].includes(item.kind) || mapperIds.has(item.id)
      || ![item.id, item.export, item.method, item.errorType].every(name => typeof name === 'string' && IDENTIFIER.test(name))
      || !ids.has(item.errorType)) throw Error('Mapper identities, kinds and error references must be explicit and unique.');
    mapperIds.add(item.id);
    exact(item.status, item.status?.kind === 'error-property' ? ['kind', 'property', 'fallback'] : ['kind', 'path', 'export', 'fallback'], 'Mapper status');
    if (!['error-property', 'code-map'].includes(item.status.kind) || !Number.isInteger(item.status.fallback) || item.status.fallback < 100 || item.status.fallback > 599) throw Error('Mapper status needs a supported strategy and HTTP fallback.');
    if (item.status.kind === 'error-property' && (typeof item.status.property !== 'string' || !IDENTIFIER.test(item.status.property))) throw Error('Error-property status needs an exact member.');
    const status = item.status.kind === 'code-map' ? { ...item.status, absolute: safeFile(root, item.status.path) } : item.status;
    if (item.status.kind === 'code-map' && (typeof item.status.export !== 'string' || !IDENTIFIER.test(item.status.export))) throw Error('Code-map status needs an exact exported map.');
    if (item.kind === 'nest-http-filter') {
      if (item.method !== 'catch') throw Error('Nest HTTP filter mapper method must be the framework catch entry.');
      if (!Array.isArray(item.passthroughHostTypes) || new Set(item.passthroughHostTypes).size !== item.passthroughHostTypes.length
        || item.passthroughHostTypes.some(host => typeof host !== 'string' || !host)) throw Error('HTTP passthrough host types must be unique strings.');
    } else if (![item.formatProperty, item.statusPlugin, item.originalErrorProperty].every(name => typeof name === 'string' && IDENTIFIER.test(name))) throw Error('Apollo mapper needs exact formatError, wrapped-error and status-plugin identities.');
    return { ...item, absolute: safeFile(root, item.path), status };
  });
  const kinds = new Set(mappers.map(item => item.kind === 'nest-http-filter' ? 'http' : 'graphql'));
  if (new Set(mappers.map(item => `${item.kind}:${item.path}#${item.export}.${item.method}`)).size !== mappers.length) throw Error('Transport mapper source identities must be unique.');
  for (const transport of value.transports) if (!kinds.has(transport)) throw Error(`Declared ${transport} transport has no mapper.`);
  for (const kind of kinds) if (!value.transports.includes(kind)) throw Error(`Mapper declares undeclared ${kind} transport.`);
  return { errorTypes, transports: new Set(value.transports), mappers };
}

function exportedIdentity(ts, checker, source, name) {
  const module = checker.getSymbolAtLocation(source);
  const exported = module && checker.getExportsOfModule(module).find(item => item.name === name);
  return exported && unalias(ts, checker, exported);
}

function identityInProgram(ts, binding, item) {
  const source = binding.program.getSourceFile(item.absolute);
  return source && exportedIdentity(ts, binding.checker, source, item.export);
}

function declaredType(checker, symbol) {
  try { return checker.getDeclaredTypeOfSymbol(symbol); } catch { return null; }
}

function extendsIdentity(type, identity, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  if (type.getSymbol?.() === identity || type.aliasSymbol === identity) return true;
  return (type.getBaseTypes?.() ?? []).some(base => extendsIdentity(base, identity, seen));
}

function exactOrigin(ts, checker, input, origin, seen = new Set()) {
  const node = unwrap(ts, input);
  if (!node) return false;
  const identity = symbolAt(ts, checker, node);
  if (identity === origin) return true;
  if (ts.isIdentifier(node) && identity && !seen.has(identity)) {
    seen.add(identity);
    const declaration = identity.valueDeclaration;
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
      && (ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const)) return exactOrigin(ts, checker, declaration.initializer, origin, seen);
  }
  return false;
}

function assignmentTargetsIdentity(ts, checker, input, identity) {
  const node = unwrap(ts, input);
  if (ts.isIdentifier(node)) return symbolAt(ts, checker, node) === identity;
  if (ts.isArrayLiteralExpression(node)) return node.elements.some(item => assignmentTargetsIdentity(ts, checker, item, identity));
  if (ts.isObjectLiteralExpression(node)) return node.properties.some(item => {
    if (ts.isShorthandPropertyAssignment(item)) return symbolAt(ts, checker, item.name) === identity;
    if (ts.isPropertyAssignment(item)) return assignmentTargetsIdentity(ts, checker, item.initializer, identity);
    if (ts.isSpreadAssignment(item)) return assignmentTargetsIdentity(ts, checker, item.expression, identity);
    return false;
  });
  return false;
}

function assignedBefore(ts, checker, scope, identity, before) {
  let assigned = false;
  const visit = node => {
    if (assigned || node.pos >= before) return;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && assignmentTargetsIdentity(ts, checker, node.left, identity)) { assigned = true; return; }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
      && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) && symbolAt(ts, checker, node.operand) === identity) { assigned = true; return; }
    ts.forEachChild(node, visit);
  };
  visit(scope); return assigned;
}

function unchangedOrigin(ts, checker, input, origin, scope, before, seen = new Set()) {
  const node = unwrap(ts, input);
  if (!node) return false;
  const identity = symbolAt(ts, checker, node);
  if (identity === origin) return !assignedBefore(ts, checker, scope, origin, before);
  if (!ts.isIdentifier(node) || !identity || seen.has(identity)) return false;
  seen.add(identity);
  const declaration = identity.valueDeclaration;
  if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer
    || !(ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const)
    || assignedBefore(ts, checker, scope, identity, before)) return false;
  return unchangedOrigin(ts, checker, declaration.initializer, origin, scope, declaration.initializer.pos, seen);
}

// true = every value path retains the caught input; false = it does not; null = dynamic/unprovable.
function preservesOrigin(ts, checker, input, origin, scope, before, seen = new Set()) {
  const node = unwrap(ts, input);
  if (!node) return false;
  if (unchangedOrigin(ts, checker, node, origin, scope, before, new Set(seen))) return true;
  if (node.kind === ts.SyntaxKind.NullKeyword || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword
    || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)
    || (ts.isIdentifier(node) && node.text === 'undefined' && (checker.getSymbolAtLocation(node)?.declarations ?? []).every(item => item.getSourceFile().isDeclarationFile))) return false;
  if (ts.isIdentifier(node)) {
    const identity = symbolAt(ts, checker, node);
    if (!identity || seen.has(identity)) return null;
    seen.add(identity);
    const declaration = identity.valueDeclaration;
    return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
      && (ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const) ? preservesOrigin(ts, checker, declaration.initializer, origin, scope, declaration.initializer.pos, seen) : null;
  }
  if (ts.isConditionalExpression(node)) {
    const left = preservesOrigin(ts, checker, node.whenTrue, origin, scope, before, new Set(seen));
    const right = preservesOrigin(ts, checker, node.whenFalse, origin, scope, before, new Set(seen));
    return left === null || right === null ? null : left && right;
  }
  return false;
}

function constantNumber(ts, checker, input) {
  const node = unwrap(ts, input);
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const value = checker.getConstantValue(node);
    return typeof value === 'number' ? value : null;
  }
  return null;
}

function expressionReferences(ts, checker, input, identity, seen = new Set()) {
  const node = unwrap(ts, input);
  if (!node) return false;
  if (symbolAt(ts, checker, node) === identity) return true;
  if (ts.isIdentifier(node)) {
    const symbol = symbolAt(ts, checker, node);
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    const declaration = symbol.valueDeclaration;
    return Boolean(declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
      && expressionReferences(ts, checker, declaration.initializer, identity, seen));
  }
  let found = false;
  ts.forEachChild(node, child => { if (!found && expressionReferences(ts, checker, child, identity, new Set(seen))) found = true; });
  return found;
}

function propertyFrom(ts, checker, input, owner, name) {
  const node = unwrap(ts, input);
  if (!(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) || propertyName(ts, node) !== name) return false;
  return exactOrigin(ts, checker, node.expression, owner);
}

function statusExpression(ts, checker, input, owner, errorType, mapper, statusMaps) {
  const node = unwrap(ts, input);
  if (!ts.isBinaryExpression(node) || ![ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)
    || constantNumber(ts, checker, node.right) !== mapper.status.fallback) return false;
  if (mapper.status.kind === 'error-property') return propertyFrom(ts, checker, node.left, owner, mapper.status.property);
  const mapIdentity = statusMaps.get(mapper.id), left = unwrap(ts, node.left);
  if (!mapIdentity) return false;
  if (ts.isElementAccessExpression(left) && symbolAt(ts, checker, unwrap(ts, left.expression)) === mapIdentity
    && left.argumentExpression && propertyFrom(ts, checker, left.argumentExpression, owner, errorType.codeProperty)) return true;
  if (ts.isCallExpression(left) && (ts.isPropertyAccessExpression(left.expression) || ts.isElementAccessExpression(left.expression))
    && propertyName(ts, left.expression) === 'get' && symbolAt(ts, checker, unwrap(ts, left.expression.expression)) === mapIdentity
    && left.arguments.length === 1 && propertyFrom(ts, checker, left.arguments[0], owner, errorType.codeProperty)) return true;
  return false;
}

function localOrInitializer(ts, checker, input) {
  const node = unwrap(ts, input);
  if (!ts.isIdentifier(node)) return node;
  const declaration = symbolAt(ts, checker, node)?.valueDeclaration;
  return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer ? unwrap(ts, declaration.initializer) : node;
}

function decoratorsOf(ts, node) {
  return ts.canHaveDecorators?.(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
}

function directIdentity(ts, checker, input, identity) {
  const node = unwrap(ts, input);
  return Boolean(node && symbolAt(ts, checker, node) === identity);
}

function providerRegistersExisting(ts, checker, providers, mapperIdentity) {
  return providers.some(input => {
    const node = unwrap(ts, input);
    if (directIdentity(ts, checker, node, mapperIdentity)) return true;
    if (!ts.isObjectLiteralExpression(node) || node.properties.some(item => ts.isSpreadAssignment(item) || item.name && ts.isComputedPropertyName(item.name))) return false;
    const provide = memberValue(ts, node, 'provide'), useClass = memberValue(ts, node, 'useClass');
    return directIdentity(ts, checker, provide, mapperIdentity) && directIdentity(ts, checker, useClass, mapperIdentity);
  });
}

function owningClass(ts, node) {
  for (let cursor = node; cursor; cursor = cursor.parent) if (ts.isClassDeclaration(cursor)) return cursor;
  return null;
}

function hasNestDecorator(ts, checker, node, name) {
  return decoratorsOf(ts, node).some(item => {
    const expression = unwrap(ts, item.expression);
    return ts.isCallExpression(expression) && frameworkBinding(ts, checker, expression.expression)?.module === '@nestjs/common'
      && frameworkBinding(ts, checker, expression.expression)?.name === name;
  });
}

// Static registration only: runtime bootstrap calls and dynamic module/provider values are unavailable.
function httpRegistration({ ts, mapper, bindings }) {
  let proven = null, uncertain = null;
  for (const binding of bindings.values()) {
    const { source, checker } = binding, mapperIdentity = identityInProgram(ts, binding, mapper);
    if (!mapperIdentity) continue;
    const visit = node => {
      if (proven) return;
      for (const decorator of decoratorsOf(ts, node)) {
        const expression = unwrap(ts, decorator.expression);
        if (!ts.isCallExpression(expression)) continue;
        const origin = frameworkBinding(ts, checker, expression.expression);
        if (origin?.module === '@nestjs/common' && origin.name === 'UseFilters') {
          const controller = owningClass(ts, node);
          if (!controller || !hasNestDecorator(ts, checker, controller, 'Controller')) continue;
          for (const argument of expression.arguments) {
            const value = unwrap(ts, argument);
            if (ts.isSpreadElement(value)) { uncertain ??= { source, node: value }; continue; }
            if (directIdentity(ts, checker, value, mapperIdentity)
              || ts.isNewExpression(value) && directIdentity(ts, checker, value.expression, mapperIdentity)) {
              proven = { source, node: value, form: '@UseFilters' }; return;
            }
            if (!(ts.isIdentifier(value) || ts.isPropertyAccessExpression(value) || ts.isNewExpression(value))) uncertain ??= { source, node: value };
          }
        }
        if (ts.isClassDeclaration(node) && origin?.module === '@nestjs/common' && origin.name === 'Module') {
            if (expression.arguments.length !== 1 || !ts.isObjectLiteralExpression(unwrap(ts, expression.arguments[0]))) {
              uncertain ??= { source, node: expression }; continue;
            }
            const config = unwrap(ts, expression.arguments[0]);
            if (config.properties.some(item => ts.isSpreadAssignment(item) || item.name && ts.isComputedPropertyName(item.name))) {
              uncertain ??= { source, node: config }; continue;
            }
            const providersNode = memberValue(ts, config, 'providers');
            if (!providersNode) continue;
            const providers = unwrap(ts, providersNode);
            if (!ts.isArrayLiteralExpression(providers)) { uncertain ??= { source, node: providers }; continue; }
            if (providers.elements.some(item => ts.isSpreadElement(item))) { uncertain ??= { source, node: providers }; continue; }
            const elements = [...providers.elements], existing = providerRegistersExisting(ts, checker, elements, mapperIdentity);
            for (const element of elements) {
              const provider = unwrap(ts, element);
              if (!ts.isObjectLiteralExpression(provider)) continue;
              if (provider.properties.some(item => ts.isSpreadAssignment(item) || item.name && ts.isComputedPropertyName(item.name))) {
                uncertain ??= { source, node: provider }; continue;
              }
              const token = memberValue(ts, provider, 'provide');
              const tokenOrigin = token && frameworkBinding(ts, checker, token);
              if (tokenOrigin?.module !== '@nestjs/core' || tokenOrigin.name !== 'APP_FILTER') continue;
              const useClass = memberValue(ts, provider, 'useClass'), useExisting = memberValue(ts, provider, 'useExisting');
              if (useClass && directIdentity(ts, checker, useClass, mapperIdentity)) {
                proven = { source, node: provider, form: 'APP_FILTER/useClass' }; return;
              }
              if (useExisting && directIdentity(ts, checker, useExisting, mapperIdentity) && existing) {
                proven = { source, node: provider, form: 'APP_FILTER/useExisting' }; return;
              }
            }
        }
      }
      if (ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
        && propertyName(ts, node.expression) === 'useGlobalFilters') uncertain ??= { source, node };
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return proven ? { state: 'registered', ...proven }
    : uncertain ? { state: 'unavailable', ...uncertain }
      : { state: 'missing' };
}

function checkHttpMapper({ ts, checker, source, mapper, errorType, errorIdentity, statusMaps, bindings, add }) {
  const identity = exportedIdentity(ts, checker, source, mapper.export), declaration = identity?.declarations?.find(item => ts.isClassDeclaration(item));
  if (!declaration) return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', source, `Declared HTTP mapper export is unavailable: ${mapper.export}`, true);
  const decorators = ts.canHaveDecorators?.(declaration) ? ts.getDecorators(declaration) ?? [] : declaration.decorators ?? [];
  const catches = decorators.filter(item => ts.isCallExpression(item.expression)
    && frameworkBinding(ts, checker, item.expression.expression)?.module === '@nestjs/common'
    && frameworkBinding(ts, checker, item.expression.expression)?.name === 'Catch');
  if (catches.length !== 1 || catches[0].expression.arguments.length !== 1
    || symbolAt(ts, checker, catches[0].expression.arguments[0]) !== errorIdentity) {
    add(source, 'NEST_TRANSPORT_ERROR_MAPPER', declaration, 'HTTP mapper has one resolved @nestjs/common Catch decorator for the selected error family.', true);
  }
  const filter = declaration.heritageClauses?.flatMap(item => item.types).some(item => {
    const imported = frameworkBinding(ts, checker, item.expression);
    return imported?.module === '@nestjs/common' && imported.name === 'ExceptionFilter';
  });
  if (!filter) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', declaration, 'HTTP mapper implements the resolved Nest ExceptionFilter contract.', true);
  const registration = httpRegistration({ ts, mapper, bindings });
  if (registration.state !== 'registered') add(registration.source ?? source, 'NEST_TRANSPORT_ERROR_MAPPER', registration.node ?? declaration,
    registration.state === 'unavailable'
      ? 'HTTP mapper registration uses a bootstrap or dynamic form and cannot prove the selected mapper is installed.'
      : 'HTTP mapper has a resolved static APP_FILTER/useClass, APP_FILTER/useExisting provider, or @UseFilters registration.',
    registration.state === 'unavailable');
  const method = declaration.members.filter(item => ts.isMethodDeclaration(item) && item.name?.text === mapper.method);
  if (method.length !== 1 || !method[0].body || !method[0].parameters.length) return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', declaration, 'HTTP mapper method is missing or ambiguous.', true);
  const handler = method[0], errorParameter = symbolAt(ts, checker, handler.parameters[0].name), hostParameter = handler.parameters[1] && symbolAt(ts, checker, handler.parameters[1].name);
  const parameterType = checker.getTypeAtLocation(handler.parameters[0]);
  if (!extendsIdentity(parameterType, errorIdentity)) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', handler.parameters[0], 'HTTP mapper parameter resolves to the selected error family.', true);
  const errorShape = declaredType(checker, errorIdentity);
  if (!errorShape?.getProperty(errorType.codeProperty) || !errorShape?.getProperty(errorType.messageProperty)
    || (mapper.status.kind === 'error-property' && !errorShape?.getProperty(mapper.status.property))) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', declaration, 'Selected error mapper properties must resolve on the declared error family.', true);
  if (!handler.parameters[1]?.type || frameworkBinding(ts, checker, handler.parameters[1].type.typeName ?? handler.parameters[1].type)?.module !== '@nestjs/common'
    || frameworkBinding(ts, checker, handler.parameters[1].type.typeName ?? handler.parameters[1].type)?.name !== 'ArgumentsHost') add(source, 'NEST_TRANSPORT_ERROR_MAPPER', handler, 'HTTP mapper resolves the Nest ArgumentsHost boundary.', true);
  const statusSymbols = new Set();
  const bodyObjects = [];
  const passthrough = new Set();
  const hostComparisons = input => {
    const values = [];
    const inspect = node => {
      if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind)) {
        const sides = [[unwrap(ts, node.left), unwrap(ts, node.right)], [unwrap(ts, node.right), unwrap(ts, node.left)]];
        for (const [call, literal] of sides) if (ts.isStringLiteralLike(literal) && ts.isCallExpression(call)
          && (ts.isPropertyAccessExpression(call.expression) || ts.isElementAccessExpression(call.expression))
          && propertyName(ts, call.expression) === 'getType' && exactOrigin(ts, checker, call.expression.expression, hostParameter)) values.push(literal.text);
      }
      ts.forEachChild(node, inspect);
    };
    inspect(input); return values;
  };
  const visit = node => {
    if (node !== handler.body && ts.isFunctionLike(node)) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && (ts.getCombinedNodeFlags(node.parent) & ts.NodeFlags.Const)
      && statusExpression(ts, checker, node.initializer, errorParameter, errorType, mapper, statusMaps)) statusSymbols.add(symbolAt(ts, checker, node.name));
    if (ts.isIfStatement(node)) {
      const throws = [];
      const collectThrows = item => { if (ts.isThrowStatement(item)) throws.push(item); else ts.forEachChild(item, collectThrows); };
      collectThrows(node.thenStatement);
      if (throws.some(item => exactOrigin(ts, checker, item.expression, errorParameter))) for (const value of hostComparisons(node.expression)) passthrough.add(value);
    }
    if (ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
      && propertyName(ts, node.expression) === 'json' && node.arguments.length === 1) {
      const statusCall = unwrap(ts, node.expression.expression);
      if (ts.isCallExpression(statusCall) && (ts.isPropertyAccessExpression(statusCall.expression) || ts.isElementAccessExpression(statusCall.expression))
        && propertyName(ts, statusCall.expression) === 'status' && statusCall.arguments.length === 1) bodyObjects.push({ status: statusCall.arguments[0], body: localOrInitializer(ts, checker, node.arguments[0]), response: statusCall.expression.expression, node });
    }
    ts.forEachChild(node, visit);
  };
  visit(handler.body);
  const httpContextOrigin = (input, seen = new Set()) => {
    const node = unwrap(ts, input);
    if (!node) return false;
    if (ts.isIdentifier(node)) {
      const identity = symbolAt(ts, checker, node);
      if (seen.has(identity)) return false; seen.add(identity);
      const declaration = identity?.valueDeclaration;
      return Boolean(declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && httpContextOrigin(declaration.initializer, seen));
    }
    return ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
      && propertyName(ts, node.expression) === 'switchToHttp' && exactOrigin(ts, checker, node.expression.expression, hostParameter);
  };
  const responseOrigin = (input, seen = new Set()) => {
    const node = unwrap(ts, input);
    if (!node) return false;
    if (ts.isIdentifier(node)) {
      const identity = symbolAt(ts, checker, node);
      if (seen.has(identity)) return false; seen.add(identity);
      const declaration = identity?.valueDeclaration;
      return Boolean(declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && responseOrigin(declaration.initializer, seen));
    }
    return ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
      && propertyName(ts, node.expression) === 'getResponse' && httpContextOrigin(node.expression.expression);
  };
  const matchesStatus = value => statusSymbols.has(symbolAt(ts, checker, unwrap(ts, value)))
    || statusExpression(ts, checker, value, errorParameter, errorType, mapper, statusMaps);
  const actualWrites = bodyObjects.filter(item => responseOrigin(item.response));
  const mapped = actualWrites.length > 0 && actualWrites.every(item => {
    if (!matchesStatus(item.status) || !ts.isObjectLiteralExpression(item.body)) return false;
    return propertyFrom(ts, checker, memberValue(ts, item.body, 'code'), errorParameter, errorType.codeProperty)
      && propertyFrom(ts, checker, memberValue(ts, item.body, 'message'), errorParameter, errorType.messageProperty)
      && matchesStatus(memberValue(ts, item.body, 'statusCode'));
  });
  if (!mapped) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', handler, 'HTTP mapper sends one derived status and maps selected code/message/status fields.', false);
  for (const host of mapper.passthroughHostTypes) if (!passthrough.has(host)) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', handler, `HTTP mapper rethrows the same error for declared passthrough host ${host}.`, false);
}

function nestedProperty(ts, object, pathParts) {
  let value = object;
  for (const name of pathParts) {
    if (!ts.isObjectLiteralExpression(value)) return null;
    value = memberValue(ts, value, name);
    if (!value) return null;
  }
  return value;
}

function checkGraphqlMapper({ ts, checker, source, mapper, errorType, errorIdentity, statusMaps, add, surface }) {
  const identity = exportedIdentity(ts, checker, source, mapper.export), declaration = identity?.declarations?.find(item => ts.isClassDeclaration(item));
  const method = declaration?.members?.find(item => ts.isMethodDeclaration(item) && item.name?.text === mapper.method);
  if (!declaration || !method?.body || !surface?.config || surface.owner !== mapper.export || surface.method !== mapper.method) {
    return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', source, 'Declared Apollo mapper must resolve the discovered GraphQLModule boundary.', true);
  }
  const formatter = memberValue(ts, surface.config, mapper.formatProperty);
  if (!(formatter && (ts.isArrowFunction(formatter) || ts.isFunctionExpression(formatter))) || formatter.parameters.length < 2 || !formatter.body) {
    return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', surface.config, 'Apollo mapper has one static format-error callback.', true);
  }
  const errorParameter = symbolAt(ts, checker, formatter.parameters[1].name);
  const errorShape = declaredType(checker, errorIdentity);
  if (!errorShape?.getProperty(errorType.codeProperty) || !errorShape?.getProperty(errorType.messageProperty)
    || (mapper.status.kind === 'error-property' && !errorShape?.getProperty(mapper.status.property))) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', declaration, 'Selected error mapper properties must resolve on the declared error family.', true);
  let selectedOwner = errorParameter, selectedBranch = null, unknownReturn = null;
  const variables = [];
  const inspectVariables = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.push(node); ts.forEachChild(node, inspectVariables); };
  inspectVariables(formatter.body);
  for (const variable of variables) {
    const init = unwrap(ts, variable.initializer);
    if (ts.isBinaryExpression(init) && init.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      && propertyFrom(ts, checker, init.left, errorParameter, mapper.originalErrorProperty) && exactOrigin(ts, checker, init.right, errorParameter)) selectedOwner = symbolAt(ts, checker, variable.name);
  }
  if (selectedOwner === errorParameter) return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', formatter, 'GraphQL formatter resolves the declared wrapped-error property before mapping.', true);
  const statements = ts.isBlock(formatter.body) ? formatter.body.statements : [];
  for (const statement of statements) {
    if (ts.isIfStatement(statement) && ts.isBinaryExpression(unwrap(ts, statement.expression))
      && unwrap(ts, statement.expression).operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
      const condition = unwrap(ts, statement.expression);
      if (exactOrigin(ts, checker, condition.left, selectedOwner) && symbolAt(ts, checker, condition.right) === errorIdentity) selectedBranch = statement;
    } else if (ts.isReturnStatement(statement)) unknownReturn = statement;
  }
  if (!selectedBranch) return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', formatter, 'GraphQL formatter has a selected error-family branch.', true);
  const mappedReturns = [];
  const findReturn = node => {
    if (node !== selectedBranch.thenStatement && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) {
      const object = localOrInitializer(ts, checker, node.expression);
      const code = ts.isObjectLiteralExpression(object) && nestedProperty(ts, object, ['extensions', 'code']);
      const status = ts.isObjectLiteralExpression(object) && nestedProperty(ts, object, ['extensions', 'http', 'status']);
      mappedReturns.push(Boolean(code && status && propertyFrom(ts, checker, code, selectedOwner, errorType.codeProperty)
        && statusExpression(ts, checker, status, selectedOwner, errorType, mapper, statusMaps)));
    } else ts.forEachChild(node, findReturn);
  };
  findReturn(selectedBranch.thenStatement);
  if (!mappedReturns.length || !mappedReturns.every(Boolean)) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', selectedBranch, 'GraphQL formatter maps every selected-family return to the selected code and transport-owned status with fallback.', false);
  const unknownObject = unknownReturn?.expression && localOrInitializer(ts, checker, unknownReturn.expression);
  const unknownStatus = unknownObject && ts.isObjectLiteralExpression(unknownObject) && nestedProperty(ts, unknownObject, ['extensions', 'http', 'status']);
  if (!unknownStatus || constantNumber(ts, checker, unknownStatus) !== mapper.status.fallback) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', formatter, 'GraphQL unknown-error branch has an explicit server fallback status.', false);
  const pluginSymbol = checker.getSymbolsInScope(source, ts.SymbolFlags.Value).find(item => item.name === mapper.statusPlugin);
  const plugin = pluginSymbol?.valueDeclaration;
  if (!plugin || !ts.isVariableDeclaration(plugin) || !plugin.initializer) return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', source, 'GraphQL status plugin identity is unavailable.', true);
  const plugins = memberValue(ts, surface.config, 'plugins');
  if (!ts.isArrayLiteralExpression(unwrap(ts, plugins)) || !unwrap(ts, plugins).elements.some(item => symbolAt(ts, checker, item) === pluginSymbol)) {
    return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', surface.config, 'GraphQL status plugin is explicitly installed on the selected boundary.', true);
  }
  const pluginObject = unwrap(ts, plugin.initializer);
  const requestDidStart = ts.isObjectLiteralExpression(pluginObject) && memberValue(ts, pluginObject, 'requestDidStart');
  const requestBody = requestDidStart && (ts.isMethodDeclaration(requestDidStart) || ts.isArrowFunction(requestDidStart) || ts.isFunctionExpression(requestDidStart))
    ? requestDidStart.body : null;
  const returnedObjects = [];
  if (requestBody) {
    if (ts.isObjectLiteralExpression(requestBody)) returnedObjects.push(requestBody);
    else {
      const collectReturns = node => {
        if (node !== requestBody && (ts.isFunctionLike(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node))) return;
        if (ts.isReturnStatement(node) && node.expression) {
          const object = localOrInitializer(ts, checker, node.expression);
          if (ts.isObjectLiteralExpression(object)) returnedObjects.push(object);
        } else ts.forEachChild(node, collectReturns);
      };
      collectReturns(requestBody);
    }
  }
  const willSendCandidates = returnedObjects.map(object => memberValue(ts, object, 'willSendResponse')).filter(Boolean);
  const willSend = willSendCandidates.length === 1 ? willSendCandidates[0] : null;
  if (!(willSend && (ts.isMethodDeclaration(willSend) || ts.isArrowFunction(willSend) || ts.isFunctionExpression(willSend))
    && willSend.parameters.length === 1 && ts.isIdentifier(willSend.parameters[0].name) && willSend.body)) {
    return add(source, 'NEST_TRANSPORT_ERROR_MAPPER', plugin, 'GraphQL status plugin has one statically resolved requestDidStart/willSendResponse boundary.', true);
  }
  const responseParameter = symbolAt(ts, checker, willSend.parameters[0].name);
  const constInitializer = (identity, seen, resolve) => {
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    const declaration = identity.valueDeclaration;
    return Boolean(declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
      && (ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const) && resolve(declaration.initializer, seen));
  };
  const responseOrigin = (input, seen = new Set()) => {
    const node = unwrap(ts, input);
    if (!node) return false;
    if (ts.isIdentifier(node)) {
      const identity = symbolAt(ts, checker, node), declaration = identity?.valueDeclaration;
      if (declaration && ts.isBindingElement(declaration) && declaration.parent && ts.isObjectBindingPattern(declaration.parent)
        && (declaration.propertyName?.text ?? declaration.name.text) === 'response') {
        const variable = declaration.parent.parent;
        return Boolean(ts.isVariableDeclaration(variable) && variable.initializer
          && (ts.getCombinedNodeFlags(variable.parent) & ts.NodeFlags.Const)
          && exactOrigin(ts, checker, variable.initializer, responseParameter));
      }
      return constInitializer(identity, seen, responseOrigin);
    }
    return (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      && propertyName(ts, node) === 'response' && exactOrigin(ts, checker, node.expression, responseParameter);
  };
  const responseDescendant = input => {
    let node = unwrap(ts, input);
    while (node && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
      if (responseOrigin(node)) return true;
      node = unwrap(ts, node.expression);
    }
    return responseOrigin(node);
  };
  const errorsOrigin = (input, seen = new Set()) => {
    const node = unwrap(ts, input);
    if (!node) return false;
    if (ts.isIdentifier(node)) return constInitializer(symbolAt(ts, checker, node), seen, errorsOrigin);
    return (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      && propertyName(ts, node) === 'errors' && responseDescendant(node.expression);
  };
  const statusCallbacks = [];
  const collectCallbacks = node => {
    if (node !== willSend && ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
      && ['map', 'flatMap'].includes(propertyName(ts, node.expression)) && errorsOrigin(node.expression.expression)) {
      const callback = node.arguments[0];
      if ((ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) && callback.parameters.length
        && ts.isIdentifier(callback.parameters[0].name)) statusCallbacks.push({ callback, identity: symbolAt(ts, checker, callback.parameters[0].name) });
    }
    ts.forEachChild(node, collectCallbacks);
  };
  collectCallbacks(willSend.body);
  const tainted = new Set();
  const readsExtensionStatus = input => {
    let found = false;
    const visit = node => {
      if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && propertyName(ts, node) === 'status') {
        const parent = unwrap(ts, node.expression);
        if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && propertyName(ts, parent) === 'http') {
          const grand = unwrap(ts, parent.expression);
          if ((ts.isPropertyAccessExpression(grand) || ts.isElementAccessExpression(grand)) && propertyName(ts, grand) === 'extensions') {
            const owner = unwrap(ts, grand.expression);
            found = statusCallbacks.some(({ callback, identity }) => symbolAt(ts, checker, owner) === identity
              && node.getStart(source) >= callback.body.getStart(source) && node.getEnd() <= callback.body.getEnd());
          }
        }
      }
      if (!found) ts.forEachChild(node, visit);
    };
    visit(input); return found;
  };
  const referencesTainted = input => {
    let found = false;
    const visit = node => { if (ts.isIdentifier(node) && tainted.has(symbolAt(ts, checker, node))) found = true; else if (!found) ts.forEachChild(node, visit); };
    visit(input); return found;
  };
  const declarations = [];
  const collectDeclarations = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.push(node); ts.forEachChild(node, collectDeclarations); };
  collectDeclarations(willSend.body);
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) if (!tainted.has(symbolAt(ts, checker, declaration.name))
      && (readsExtensionStatus(declaration.initializer) || referencesTainted(declaration.initializer))) { tainted.add(symbolAt(ts, checker, declaration.name)); changed = true; }
  }
  let readsStatus = tainted.size > 0, transportWrites = 0, validTransportWrites = 0;
  const inspectPlugin = node => {
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && propertyName(ts, node) === 'status') {
      const parent = unwrap(ts, node.expression);
      if ((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && propertyName(ts, parent) === 'http') {
        const grand = unwrap(ts, parent.expression);
        if (readsExtensionStatus(node)) readsStatus = true;
        if (ts.isBinaryExpression(node.parent) && node.parent.left === node && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && responseOrigin(grand)) {
          transportWrites += 1;
          if (readsExtensionStatus(node.parent.right) || referencesTainted(node.parent.right)) validTransportWrites += 1;
        }
      }
    }
    ts.forEachChild(node, inspectPlugin);
  };
  inspectPlugin(willSend.body);
  if (!readsStatus || !transportWrites || validTransportWrites !== transportWrites) add(source, 'NEST_TRANSPORT_ERROR_MAPPER', plugin, 'GraphQL status plugin consumes selected response error extensions and drives every transport response status write.', false);
}

/** Check cause-preserving replacement throws and explicitly selected HTTP/GraphQL mapper data flow. */
export function checkNestErrors({ root, files, ruleIds, contextFiles = [], architectureConfig } = {}) {
  const result = { schema: 'starci/code-pattern-script@1', repository: '', files: [], requestedRuleIds: ruleIds ?? [], checkedRuleIds: [], violations: [], errors: [], compiler: null };
  try {
    root = fs.realpathSync(path.resolve(root)); result.repository = root;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length || files.some(file => !SOURCE.test(file) || /\.d\.[cm]?ts$/.test(file))
      || !Array.isArray(ruleIds) || !ruleIds.length || new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEST_ERROR_RULES.includes(id))) throw Error('Explicit production sources and unique supported Nest error rules are required.');
    const selected = new Set(files), bound = new Set([...files, ...contextFiles]);
    for (const file of files) safeFile(root, file);
    const contract = readContract(root), config = loadArchitectureConfig(root, architectureConfig), context = buildTypeScriptContext(config);
    result.compiler = { version: context.loaded.version, resolved: context.loaded.resolved };
    if (context.errors.length) throw Error(context.errors.map(item => item.message).join('; '));
    const { ts } = context, bindings = new Map(), errorIdentities = new Map();
    for (const item of contract.errorTypes) {
      if (!bound.has(item.path)) throw Error(`Declared error type is outside the bound source identity: ${item.path}`);
      const binding = projectBinding(context, item.absolute), identity = exportedIdentity(ts, binding.checker, binding.source, item.export);
      if (!identity || !(identity.declarations ?? []).some(node => ts.isClassDeclaration(node))) throw Error(`Declared error type export cannot be resolved: ${item.path}#${item.export}`);
      errorIdentities.set(item.id, identity);
    }
    for (const mapper of contract.mappers) {
      if (!bound.has(mapper.path)) throw Error(`Declared mapper is outside the bound source identity: ${mapper.path}`);
      if (mapper.status.kind === 'code-map' && !bound.has(mapper.status.path)) throw Error(`Declared status map is outside the bound source identity: ${mapper.status.path}`);
      if (mapper.status.kind === 'code-map') {
        const binding = projectBinding(context, mapper.status.absolute), identity = exportedIdentity(ts, binding.checker, binding.source, mapper.status.export);
        if (!identity) throw Error(`Declared status map export cannot be resolved: ${mapper.status.path}#${mapper.status.export}`);
      }
    }
    const issueKeys = new Set();
    const add = (source, ruleId, node, message, unavailable = false) => {
      const relative = slash(path.relative(root, source.fileName)), point = source.getLineAndCharacterOfPosition(node.getStart(source));
      const id = `${relative}:${node.pos}:${ruleId}:${message}`;
      if (issueKeys.has(id)) return; issueKeys.add(id);
      (unavailable ? result.errors : result.violations).push({ ruleId, path: relative, line: point.line + 1, column: point.character + 1, message });
    };
    const discoveredHttp = [], discoveredGraphql = [], discoveryErrors = [];
    for (const relative of [...selected].sort()) {
      const binding = projectBinding(context, path.resolve(root, relative)); bindings.set(relative, binding);
      const { source, checker } = binding;
      const localErrorIdentities = new Map(contract.errorTypes.map(item => [item.id, identityInProgram(ts, binding, item)]));
      const visit = node => {
        if (ts.isClassDeclaration(node)) {
          const decorators = ts.canHaveDecorators?.(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
          const catchDecorator = decorators.find(item => ts.isCallExpression(item.expression)
            && frameworkBinding(ts, checker, item.expression.expression)?.module === '@nestjs/common'
            && frameworkBinding(ts, checker, item.expression.expression)?.name === 'Catch');
          const exceptionFilter = node.heritageClauses?.flatMap(item => item.types).some(item => {
            const origin = frameworkBinding(ts, checker, item.expression);
            return origin?.module === '@nestjs/common' && origin.name === 'ExceptionFilter';
          });
          if (catchDecorator || exceptionFilter) {
            const module = checker.getSymbolAtLocation(source), exported = module && checker.getExportsOfModule(module)
              .map(item => unalias(ts, checker, item)).find(item => item === symbolAt(ts, checker, node.name));
            if (!catchDecorator || !exceptionFilter || !node.name || !exported) discoveryErrors.push({ source, node, message: 'Nest exception-filter surface is dynamic, incomplete or not an exported identity.' });
            else discoveredHttp.push({ path: relative, export: node.name.text });
          }
        }
        if (ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
          && ['forRoot', 'forRootAsync'].includes(propertyName(ts, node.expression))) {
          const owner = unwrap(ts, node.expression.expression), origin = frameworkBinding(ts, checker, owner);
          if (origin?.module === '@nestjs/graphql' && origin.name === 'GraphQLModule') {
            let classNode = node.parent;
            while (classNode && !ts.isClassDeclaration(classNode)) classNode = classNode.parent;
            let methodNode = node.parent;
            while (methodNode && !ts.isMethodDeclaration(methodNode)) methodNode = methodNode.parent;
            const configNode = propertyName(ts, node.expression) === 'forRoot' && node.arguments.length === 1 ? unwrap(ts, node.arguments[0]) : null;
            if (!classNode?.name || !methodNode?.name || !configNode || !ts.isObjectLiteralExpression(configNode)) discoveryErrors.push({ source, node, message: 'GraphQL boundary configuration is dynamic or has no resolvable owner.' });
            else discoveredGraphql.push({ path: relative, owner: classNode.name.text, method: methodNode.name.text, config: configNode });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      if (ruleIds.includes('NEST_FOREIGN_ERROR_CAUSE')) {
        const inspectCatch = node => {
          if (!ts.isCatchClause(node)) return ts.forEachChild(node, inspectCatch);
          const origin = node.variableDeclaration && symbolAt(ts, checker, node.variableDeclaration.name);
          const inspectThrow = item => {
            if (ts.isCatchClause(item) && item !== node) return;
            if (ts.isFunctionLike(item)) {
              let nestedThrow = null;
              const findNested = child => { if (!nestedThrow && ts.isThrowStatement(child)) nestedThrow = child; else if (!nestedThrow) ts.forEachChild(child, findNested); };
              findNested(item);
              if (nestedThrow) add(source, 'NEST_FOREIGN_ERROR_CAUSE', nestedThrow, 'Nested-function replacement throws cannot prove catch-owned cause propagation.', true);
              return;
            }
            if (ts.isThrowStatement(item)) {
              let nearest = item.parent;
              while (nearest && !ts.isCatchClause(nearest)) nearest = nearest.parent;
              if (nearest !== node || !item.expression) return;
              if (origin && unchangedOrigin(ts, checker, item.expression, origin, node.block, item.pos)) return;
              const expression = unwrap(ts, item.expression);
              if (!ts.isNewExpression(expression)) return add(source, 'NEST_FOREIGN_ERROR_CAUSE', item, 'Dynamic replacement throws cannot prove caught-cause preservation.', true);
              const instance = checker.getTypeAtLocation(expression), match = contract.errorTypes.find(error => localErrorIdentities.get(error.id)
                && extendsIdentity(instance, localErrorIdentities.get(error.id)));
              if (!match) return add(source, 'NEST_FOREIGN_ERROR_CAUSE', expression, 'Replacement throws use a declared error family and preserve the caught cause.', false);
              if (!origin) return add(source, 'NEST_FOREIGN_ERROR_CAUSE', expression, 'Replacement throw cannot preserve an unnamed caught cause.', false);
              let preserved = false, unknown = false;
              for (const argument of expression.arguments ?? []) {
                let object = unwrap(ts, argument);
                if (ts.isIdentifier(object)) {
                  const declaration = symbolAt(ts, checker, object)?.valueDeclaration;
                  if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
                    && (ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const)) object = unwrap(ts, declaration.initializer);
                  else { unknown = true; continue; }
                }
                if (!ts.isObjectLiteralExpression(object)) continue;
                if (object.properties.some(property => ts.isSpreadAssignment(property) || property.name && ts.isComputedPropertyName(property.name))) unknown = true;
                for (const cause of match.causeProperties) {
                  const value = memberValue(ts, object, cause);
                  if (value) { const state = preservesOrigin(ts, checker, value, origin, node.block, item.pos); preserved ||= state === true; unknown ||= state === null; }
                }
              }
              if (!preserved) add(source, 'NEST_FOREIGN_ERROR_CAUSE', expression, unknown
                ? 'Replacement cause flow is dynamic and cannot prove preservation.' : 'Replacement error carries the caught input through a declared cause property.', unknown);
            } else ts.forEachChild(item, inspectThrow);
          };
          inspectThrow(node.block);
          ts.forEachChild(node.block, inspectCatch);
        };
        inspectCatch(source);
      }
      result.files.push(relative);
    }
    if (ruleIds.includes('NEST_TRANSPORT_ERROR_MAPPER')) {
      for (const item of discoveryErrors) add(item.source, 'NEST_TRANSPORT_ERROR_MAPPER', item.node, item.message, true);
      const discovered = new Set([...(discoveredHttp.length ? ['http'] : []), ...(discoveredGraphql.length ? ['graphql'] : [])]);
      for (const kind of discovered) if (!contract.transports.has(kind)) add(bindings.values().next().value.source, 'NEST_TRANSPORT_ERROR_MAPPER', bindings.values().next().value.source, `Discovered ${kind} transport is omitted from the declared mapper inventory.`, true);
      for (const kind of contract.transports) if (!discovered.has(kind)) add(bindings.values().next().value.source, 'NEST_TRANSPORT_ERROR_MAPPER', bindings.values().next().value.source, `Declared ${kind} transport has no discovered static framework boundary.`, true);
      const declaredHttp = contract.mappers.filter(item => item.kind === 'nest-http-filter');
      for (const surface of discoveredHttp) if (!declaredHttp.some(item => item.path === surface.path && item.export === surface.export)) add(bindings.get(surface.path).source, 'NEST_TRANSPORT_ERROR_MAPPER', bindings.get(surface.path).source, 'Discovered Nest exception filter is absent from the declared mapper inventory.', true);
      for (const mapper of declaredHttp) {
        if (!discoveredHttp.some(item => item.path === mapper.path && item.export === mapper.export)) add(bindings.get(mapper.path).source, 'NEST_TRANSPORT_ERROR_MAPPER', bindings.get(mapper.path).source, 'Declared HTTP mapper does not match a discovered Nest exception filter.', true);
        else {
          const binding = bindings.get(mapper.path), errorType = contract.errorTypes.find(item => item.id === mapper.errorType);
          const statusMaps = new Map();
          if (mapper.status.kind === 'code-map') statusMaps.set(mapper.id, identityInProgram(ts, binding, { absolute: mapper.status.absolute, export: mapper.status.export }));
          const errorIdentity = identityInProgram(ts, binding, errorType);
          if (!errorIdentity || (mapper.status.kind === 'code-map' && !statusMaps.get(mapper.id))) add(binding.source, 'NEST_TRANSPORT_ERROR_MAPPER', binding.source, 'Mapper dependencies are outside its selected TypeScript project.', true);
          else checkHttpMapper({ ts, checker: binding.checker, source: binding.source, mapper, errorType, errorIdentity, statusMaps, bindings, add });
        }
      }
      const declaredGraphql = contract.mappers.filter(item => item.kind === 'apollo-graphql');
      for (const surface of discoveredGraphql) if (!declaredGraphql.some(item => item.path === surface.path && item.export === surface.owner && item.method === surface.method)) add(bindings.get(surface.path).source, 'NEST_TRANSPORT_ERROR_MAPPER', bindings.get(surface.path).source, 'Discovered GraphQL boundary is absent from the declared mapper inventory.', true);
      for (const mapper of declaredGraphql) {
        const matching = discoveredGraphql.filter(item => item.path === mapper.path && item.owner === mapper.export && item.method === mapper.method), surface = matching[0];
        const binding = bindings.get(mapper.path), errorType = contract.errorTypes.find(item => item.id === mapper.errorType);
        const statusMaps = new Map();
        if (mapper.status.kind === 'code-map') statusMaps.set(mapper.id, identityInProgram(ts, binding, { absolute: mapper.status.absolute, export: mapper.status.export }));
        const errorIdentity = identityInProgram(ts, binding, errorType);
        if (matching.length !== 1) add(binding.source, 'NEST_TRANSPORT_ERROR_MAPPER', binding.source, 'Declared GraphQL mapper must match exactly one static framework boundary.', true);
        else if (!errorIdentity || (mapper.status.kind === 'code-map' && !statusMaps.get(mapper.id))) add(binding.source, 'NEST_TRANSPORT_ERROR_MAPPER', binding.source, 'Mapper dependencies are outside its selected TypeScript project.', true);
        else checkGraphqlMapper({ ts, checker: binding.checker, source: binding.source, mapper,
          errorType, errorIdentity, statusMaps, add, surface });
      }
    }
    if (!result.errors.length) result.checkedRuleIds = [...ruleIds].sort();
  } catch (error) { result.errors.push({ message: String(error.message ?? error) }); }
  return result;
}
