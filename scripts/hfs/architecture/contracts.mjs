import path from 'node:path';
import { isInside } from './config.mjs';
import { referencedExports, relativePath, unwrapExpression } from './typescript.mjs';
import { anyDescendant, commonJsRequireReasons, constructedDecoratorKind as sharedConstructedDecoratorKind, decoratorCallee, moduleExportsOf, nodeDecorators, normalizedSymbol, normalizedSymbolValue, programSourcesOf, selectedNode, valueSymbol, violation } from './ast-walks.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { canonical, checkInjectedClass, checkMessageReadonly, hasModifier, isPublicMember, messageClass, modifiers, READONLY_BOUNDARY_RULE_ID } from './contracts-readonly.mjs';
export const PUBLIC_CONTRACT_RULE_ID = 'BE_PUBLIC_CONTRACT_FORM';
export { READONLY_BOUNDARY_RULE_ID };

const FRAMEWORK_EXPORTS = new Map([
  ['@nestjs/common', new Set(['Controller', 'Inject', 'Injectable', 'Module'])],
  ['@nestjs/cqrs', new Set(['CommandHandler', 'QueryHandler'])],
  ['@nestjs/graphql', new Set(['Resolver'])],
]);
const NEST_CREATED = new Set(['CommandHandler', 'Controller', 'Injectable', 'QueryHandler', 'Resolver']);
const MESSAGE_HANDLERS = new Set(['CommandHandler', 'QueryHandler']);
const NON_API_SOURCE_ROLES = new Set(['config', 'configuration', 'constants', 'main', 'module', 'module-definition', 'providers']);
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/i;

function frameworkKindForSymbol(symbol, targets) {
  const selected = targets.get(symbol);
  if (selected) return selected;
  const name = symbol?.getName?.();
  if (!name) return null;
  for (const [packageName, exports] of FRAMEWORK_EXPORTS) {
    if (!exports.has(name)) continue;
    const marker = `/node_modules/${packageName}/`;
    if ((symbol.getDeclarations?.() ?? []).some(declaration => declaration.getSourceFile().fileName.replaceAll('\\', '/').includes(marker))) return name;
  }
  return null;
}

/* This module's trace through frameworkKindForSymbol (name lookup and node_modules marker) instead of the
 * default symbol->kind map, plus the shorthand/property-assignment descent. */
const FRAMEWORK_TRACE = {
  directOf: (ts, checker, { selected, targets }) => frameworkKindForSymbol(valueSymbol(ts, checker, selected), targets),
  shorthandOf: (ts, checker, target, targets) => frameworkKindForSymbol(target, targets),
};

function addFrameworkTargets(config, context, checker, sourceFile, statement, bySymbol, reasons) {
  const bound = moduleExportsOf(context.ts, checker, statement);
  if (!bound || !FRAMEWORK_EXPORTS.has(bound.specifier)) return;
  if (!bound.symbol) {
    reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${bound.specifier}`);
    return;
  }
  for (const name of referencedExports(context.ts, statement, FRAMEWORK_EXPORTS.get(bound.specifier))) {
    const target = bound.exports.get(name);
    if (target) bySymbol.set(target, name);
    else reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${name} from ${bound.specifier}`);
  }
}

function frameworkTargets(config, context, checker, localFiles) {
  const bySymbol = new Map();
  const reasons = [];
  const files = programSourcesOf(context, checker, localFiles, { root: config.root });
  if (!files) return { bySymbol, reasons: ['a TypeScript program checker could not be associated with its source'] };
  for (const sourceFile of files) {
    for (const statement of sourceFile.statements) addFrameworkTargets(config, context, checker, sourceFile, statement, bySymbol, reasons);
    commonJsRequireReasons(context.ts, checker, sourceFile, specifier => FRAMEWORK_EXPORTS.has(specifier),
      reasons, relativePath(config.root, sourceFile.fileName), 'binding whose contract role cannot be proved');
  }
  return { bySymbol, reasons };
}

function decoratorKind(ts, checker, decorator, targets) {
  const selected = selectedNode(ts, decoratorCallee(ts, decorator));
  return selected ? frameworkKindForSymbol(valueSymbol(ts, checker, selected), targets) : null;
}

const constructedDecoratorKind = (ts, checker, decorator, targets) =>
  sharedConstructedDecoratorKind(ts, checker, decorator, targets, FRAMEWORK_TRACE);

function sourceRole(sourceFile) {
  const normalized = sourceFile.fileName.replaceAll('\\', '/');
  const base = path.basename(sourceFile.fileName).replace(SOURCE_EXTENSION, '').toLowerCase();
  const segments = base.split('.');
  const role = segments.length > 1 ? segments.at(-1) : ((base === 'use-case' || base.endsWith('-use-case')) && 'use-case') || null;
  return { base, role, transport: normalized.includes('/transport/') };
}

function isFrameworkHelper(sourceFile, declaration, framework) {
  const role = sourceRole(sourceFile);
  if (role.transport || NON_API_SOURCE_ROLES.has(role.role) || NON_API_SOURCE_ROLES.has(role.base)) return true;
  if (declaration?.name && (declaration.name.text ?? '').endsWith('Module')) {
    return nodeDecorators(framework.ts, declaration).some(decorator => decoratorKind(framework.ts, framework.checker, decorator, framework.targets) === 'Module');
  }
  return false;
}

function builtinSymbol(ts, symbol, name) {
  if (!symbol || symbol.getName?.() !== name) return false;
  const declarations = symbol.getDeclarations?.() ?? [];
  return declarations.length > 0 && declarations.every(declaration => declaration.getSourceFile().isDeclarationFile
    && /(?:^|[/\\])lib\.[^/\\]+\.d\.ts$/i.test(declaration.getSourceFile().fileName));
}

function typeReferenceStatus(ts, checker, node, seen, depth) {
  const symbol = normalizedSymbol(ts, checker, node.typeName);
  if (!symbol) return 'unavailable';
  if (builtinSymbol(ts, symbol, 'Promise') || builtinSymbol(ts, symbol, 'Readonly') || builtinSymbol(ts, symbol, 'Awaited')
    || builtinSymbol(ts, symbol, 'Array') || builtinSymbol(ts, symbol, 'ReadonlyArray')) {
    return node.typeArguments?.length === 1 ? contractTypeStatus(ts, checker, node.typeArguments[0], seen, depth + 1) : 'unavailable';
  }
  if (builtinSymbol(ts, symbol, 'Record') || builtinSymbol(ts, symbol, 'Partial') || builtinSymbol(ts, symbol, 'Pick')
    || builtinSymbol(ts, symbol, 'Omit') || builtinSymbol(ts, symbol, 'Required')) return 'inline';
  const declarations = symbol.getDeclarations?.() ?? [];
  if (!declarations.length) return 'unavailable';
  return declarations.every(declaration => ts.isTypeParameterDeclaration(declaration)
    || ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)
    || ts.isClassDeclaration(declaration) || ts.isEnumDeclaration(declaration)) ? 'named' : 'unavailable';
}

function isInlineContractType(ts, node) {
  return ts.isTypeLiteralNode(node) || ts.isMappedTypeNode(node) || ts.isUnionTypeNode(node)
    || ts.isIntersectionTypeNode(node) || ts.isTupleTypeNode(node) || ts.isFunctionTypeNode(node);
}

function isUnavailableContractType(ts, node) {
  return ts.isConditionalTypeNode(node) || ts.isIndexedAccessTypeNode(node) || ts.isInferTypeNode(node)
    || ts.isTypeQueryNode(node) || ts.isImportTypeNode(node);
}

function contractTypeStatus(ts, checker, node, seen = new Set(), depth = 0) {
  if (!node || depth > 12) return 'unavailable';
  if (ts.isParenthesizedTypeNode(node)) return contractTypeStatus(ts, checker, node.type, seen, depth + 1);
  if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return contractTypeStatus(ts, checker, node.type, seen, depth + 1);
  }
  if (ts.isTypeReferenceNode(node)) return typeReferenceStatus(ts, checker, node, seen, depth);
  if (ts.isArrayTypeNode(node)) return contractTypeStatus(ts, checker, node.elementType, seen, depth + 1);
  if (isInlineContractType(ts, node)) return 'inline';
  if (isUnavailableContractType(ts, node)) return 'unavailable';
  return 'scalar';
}

function wrappedTypeStatus(ts, checker, type, named, nextSeen, depth) {
  for (const wrapper of ['Promise', 'Readonly', 'Awaited', 'Array', 'ReadonlyArray']) if (builtinSymbol(ts, named, wrapper)) {
    const argumentsList = type.aliasTypeArguments ?? (checker.getTypeArguments && (type.objectFlags & ts.ObjectFlags.Reference)
      ? checker.getTypeArguments(type) : type.typeArguments) ?? [];
    return argumentsList.length === 1 ? contractTypeStatusFromType(ts, checker, argumentsList[0], nextSeen, depth + 1) : 'unavailable';
  }
  for (const anonymous of ['Record', 'Partial', 'Pick', 'Omit', 'Required']) if (builtinSymbol(ts, named, anonymous)) return 'inline';
  return null;
}

function objectContractTypeStatus(ts, checker, type, nextSeen, depth) {
  if (checker.isTupleType?.(type)) return 'inline';
  if (checker.isArrayType?.(type)) {
    const argumentsList = checker.getTypeArguments?.(type) ?? [];
    return argumentsList.length === 1 ? contractTypeStatusFromType(ts, checker, argumentsList[0], nextSeen, depth + 1) : 'unavailable';
  }
  const declarations = type.symbol?.getDeclarations?.() ?? [];
  if (type.symbol && !type.symbol.getName().startsWith('__') && declarations.some(declaration => ts.isInterfaceDeclaration(declaration)
    || ts.isClassDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration) || ts.isEnumDeclaration(declaration))) return 'named';
  return 'inline';
}

function contractTypeStatusFromType(ts, checker, type, seen = new Set(), depth = 0) {
  if (!type || depth > 12 || seen.has(type)) return 'unavailable';
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return 'unavailable';
  const nextSeen = new Set(seen).add(type);
  const named = type.aliasSymbol ?? type.symbol ?? null;
  const wrapperStatus = wrappedTypeStatus(ts, checker, type, named, nextSeen, depth);
  if (wrapperStatus !== null) return wrapperStatus;
  if (type.aliasSymbol) return 'named';
  if ((type.symbol?.getDeclarations?.() ?? []).some(declaration => ts.isEnumDeclaration(declaration))) return 'named';
  if (type.flags & ts.TypeFlags.TypeParameter) return 'named';
  if (type.flags & ts.TypeFlags.Boolean) return 'scalar';
  if (type.flags & (ts.TypeFlags.Union | ts.TypeFlags.Intersection)) return 'inline';
  if (type.flags & ts.TypeFlags.Object) return objectContractTypeStatus(ts, checker, type, nextSeen, depth);
  if (type.flags & (ts.TypeFlags.Conditional | ts.TypeFlags.IndexedAccess | ts.TypeFlags.Substitution)) return 'unavailable';
  return 'scalar';
}

function callableSignatures(ts, symbol, checker, location) {
  const type = checker.getTypeOfSymbolAtLocation(symbol, location);
  const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
  const bodyless = signatures.filter(signature => signature.getDeclaration() && !signature.getDeclaration().body);
  return bodyless.length ? bodyless : signatures.filter(signature => signature.getDeclaration());
}

function signatureParameterStatus(ts, checker, signature, location, parameter, signatureIndex) {
  const parameterSymbol = signature.getParameters()[signatureIndex];
  const actual = parameterSymbol ? checker.getTypeOfSymbolAtLocation(parameterSymbol, location) : null;
  if (actual && parameter.questionToken && !ts.isUnionTypeNode(parameter.type) && (actual.flags & ts.TypeFlags.Union)) {
    const selected = actual.types.filter(type => !(type.flags & ts.TypeFlags.Undefined));
    return selected.length === 1 ? contractTypeStatusFromType(ts, checker, selected[0]) : 'inline';
  }
  return actual ? contractTypeStatusFromType(ts, checker, actual) : contractTypeStatus(ts, checker, parameter.type);
}

function checkSignatureInputs(state, declaration) {
  const { config, context, checker, signature, location, reportSource, reportNode, displayName, violations, reasons } = state;
  const ts = context.ts;
  let signatureIndex = 0;
  for (let index = 0; index < (declaration.parameters?.length ?? 0); index += 1) {
    const parameter = declaration.parameters[index];
    if (parameter.name && ts.isIdentifier(parameter.name) && parameter.name.text === 'this') continue;
    if (!parameter.type) {
      violations.push(violation(config, reportSource, reportNode ?? parameter, PUBLIC_CONTRACT_RULE_ID,
        `${displayName} must declare the type of each public input.`));
      signatureIndex += 1;
      continue;
    }
    const status = signatureParameterStatus(ts, checker, signature, location, parameter, signatureIndex);
    signatureIndex += 1;
    if (status === 'inline') violations.push(violation(config, reportSource, reportNode ?? parameter.type, PUBLIC_CONTRACT_RULE_ID,
      `${displayName} uses an inline object/union input; expose a named contract or a positional primitive.`));
    else if (status === 'unavailable') reasons.push(`${relativePath(config.root, reportSource.fileName)} cannot prove the public input type of ${displayName}`);
  }
}

function checkSignatureOutput(state, declaration) {
  const { config, context, checker, signature, reportSource, reportNode, displayName, violations, reasons } = state;
  const ts = context.ts;
  if (!declaration.type) {
    violations.push(violation(config, reportSource, reportNode ?? declaration, PUBLIC_CONTRACT_RULE_ID,
      `${displayName} must declare an explicit public output type.`));
    return;
  }
  const actual = checker.getReturnTypeOfSignature(signature);
  const status = actual ? contractTypeStatusFromType(ts, checker, actual) : contractTypeStatus(ts, checker, declaration.type);
  if (status === 'inline') violations.push(violation(config, reportSource, reportNode ?? declaration.type, PUBLIC_CONTRACT_RULE_ID,
    `${displayName} uses an inline object/union output; expose a named result contract or a primitive.`));
  else if (status === 'unavailable') reasons.push(`${relativePath(config.root, reportSource.fileName)} cannot prove the public output type of ${displayName}`);
}

function checkSignature(state) {
  const declaration = state.signature.getDeclaration();
  checkSignatureInputs(state, declaration);
  checkSignatureOutput(state, declaration);
}

function symbolName(symbol) {
  const name = symbol.getName?.() ?? '(anonymous)';
  return name === '__call' ? '(callable)' : name;
}

function isRepositoryDeclaration(declaration, localFiles) {
  return localFiles.has(canonical(declaration.getSourceFile().fileName));
}

function callableMembers(ts, checker, symbol, location, localFiles) {
  const declarations = symbol.getDeclarations?.() ?? [];
  const classExpressions = declarations.flatMap(declaration => ts.isVariableDeclaration(declaration)
    && declaration.initializer && ts.isClassExpression(unwrapExpression(ts, declaration.initializer))
    ? [unwrapExpression(ts, declaration.initializer)] : []);
  const valueType = checker.getTypeOfSymbolAtLocation(symbol, location);
  const declaredClassLike = declarations.some(declaration => ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration));
  const primary = declaredClassLike ? checker.getDeclaredTypeOfSymbol(symbol) : valueType;
  const types = [primary];
  if (declaredClassLike || classExpressions.length) types.push(valueType);
  for (const signature of checker.getSignaturesOfType(valueType, ts.SignatureKind.Construct)) types.push(checker.getReturnTypeOfSignature(signature));
  const direct = checker.getSignaturesOfType(primary, ts.SignatureKind.Call).length ? [symbol] : [];
  const members = types.flatMap(type => checker.getPropertiesOfType(type)).filter(member => {
    if (member.getName() === 'prototype') return false;
    const selected = member.getDeclarations?.() ?? [];
    return selected.some(declaration => (ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration)
      || ts.isPropertyDeclaration(declaration) || ts.isPropertySignature(declaration) || ts.isGetAccessorDeclaration(declaration))
      && isPublicMember(ts, declaration) && isRepositoryDeclaration(declaration, localFiles))
      && checker.getSignaturesOfType(checker.getTypeOfSymbolAtLocation(member, location), ts.SignatureKind.Call).length;
  });
  return [...new Set([...direct, ...members])];
}

function exportedSymbols(ts, checker, sourceFile) {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  return moduleSymbol ? checker.getExportsOfModule(moduleSymbol).map(symbol => normalizedSymbolValue(ts, checker, symbol)).filter(Boolean) : [];
}

function checkCallableSymbol({ config, context, checker, symbol, location, reportSource, reportNode, violations, reasons, seen, localFiles }) {
  if (seen.has(symbol)) return 0;
  seen.add(symbol);
  let checked = 0;
  for (const callable of callableMembers(context.ts, checker, symbol, location, localFiles)) {
    if (callable !== symbol && seen.has(callable)) continue;
    seen.add(callable);
    const signatures = callableSignatures(context.ts, callable, checker, location);
    if (!signatures.length) {
      reasons.push(`${relativePath(config.root, reportSource.fileName)} cannot resolve the callable signature of ${symbolName(callable)}`);
      continue;
    }
    for (const signature of signatures) {
      checked += 1;
      checkSignature({ config, context, checker, signature, location, reportSource, reportNode,
        displayName: callable === symbol ? symbolName(symbol) : `${symbolName(symbol)}.${symbolName(callable)}`,
        violations, reasons });
    }
  }
  return checked;
}

function frameworkFor(state, checker) {
  if (!state.frameworkByChecker.has(checker)) {
    const selected = frameworkTargets(state.config, state.context, checker, state.localFiles);
    state.frameworkByChecker.set(checker, { ...selected, ts: state.ts, checker, targets: selected.bySymbol });
    state.readonlyReasons.push(...selected.reasons);
  }
  return state.frameworkByChecker.get(checker);
}

function checkOwnerCoverage(state) {
  const { config, context, publicReasons } = state;
  if (!config.owners?.length) publicReasons.push('no slot owner with an entry file exists, so capability API discovery has no owners to list');
  const ownerRoots = (config.owners ?? []).map(owner => path.resolve(config.root, ...owner.root.split('/')));
  const publicSourceRoots = [...config.backend.features, ...config.backend.modules].map(root => path.resolve(config.root, ...root.split('/')));
  for (const sourceFile of context.files) if (publicSourceRoots.some(root => isInside(root, sourceFile.fileName))
    && !ownerRoots.some(root => isInside(root, sourceFile.fileName))) {
    publicReasons.push(`${relativePath(config.root, sourceFile.fileName)} is outside every declared owner root`);
  }
}

function checkPublicOwners(state) {
  const { config, context, ts, sourceFiles, localFiles, publicReasons, violations, publicSeen } = state;
  if (config.owners) for (const owner of config.owners) {
    const entry = sourceFiles.get(canonical(path.resolve(config.root, ...owner.entry.split('/'))));
    if (!entry) {
      publicReasons.push(`${owner.entry} is outside the checked production program`);
      continue;
    }
    const checker = context.checkerFor(entry.fileName);
    const framework = frameworkFor(state, checker);
    if (entry.statements.some(statement => ts.isExportAssignment(statement) && statement.isExportEquals)) {
      publicReasons.push(`${owner.entry} uses export =, so named capability API discovery is unavailable`);
    }
    for (const symbol of exportedSymbols(ts, checker, entry)) {
      const declarations = (symbol.getDeclarations?.() ?? []).filter(declaration => localFiles.has(canonical(declaration.getSourceFile().fileName))) ?? [];
      if (!declarations.length) continue;
      const representative = declarations[0];
      if (isFrameworkHelper(representative.getSourceFile(), representative, framework)) continue;
      state.callableSignatures += checkCallableSymbol({ config, context, checker, symbol, location: representative,
        reportSource: representative.getSourceFile(), reportNode: representative.name ?? representative,
        violations, reasons: publicReasons, seen: publicSeen, localFiles });
    }
  }
}

function classesInSource(ts, sourceFile) {
  const classes = [];
  const collect = node => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) classes.push(node);
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);
  return classes;
}

function checkConstructedClassDecorators(state, sourceFile, checker, decorators, kinds, targets) {
  for (const [index, decorator] of decorators.entries()) if (!kinds[index]) {
    const constructed = constructedDecoratorKind(state.ts, checker, decorator, targets);
    if (constructed && (NEST_CREATED.has(constructed) || MESSAGE_HANDLERS.has(constructed) || constructed.includes('framework'))) {
      state.readonlyReasons.push(`${relativePath(state.config.root, sourceFile.fileName)} has a constructed ${constructed} decorator identity`);
    }
  }
}

function checkConstructedMemberDecorators(state, sourceFile, declaration, checker, targets) {
  const { ts, config, readonlyReasons } = state;
  for (const member of declaration.members) for (const decorated of [member, ...(ts.isConstructorDeclaration(member) ? member.parameters : [])]) {
    for (const decorator of nodeDecorators(ts, decorated)) if (!decoratorKind(ts, checker, decorator, targets)) {
      const constructed = constructedDecoratorKind(ts, checker, decorator, targets);
      if (constructed === 'Inject' || constructed === 'unproven framework') {
        readonlyReasons.push(`${relativePath(config.root, sourceFile.fileName)} has a constructed ${constructed} injection decorator identity`);
      }
    }
  }
}

function hasInjectedMember(ts, checker, declaration, targets) {
  return declaration.members.some(member => nodeDecorators(ts, member).some(decorator => decoratorKind(ts, checker, decorator, targets) === 'Inject')
    || (ts.isConstructorDeclaration(member) && member.parameters.some(parameter => nodeDecorators(ts, parameter)
      .some(decorator => decoratorKind(ts, checker, decorator, targets) === 'Inject'))));
}

function checkMessageHandlers(state, sourceFile, checker, decorators, kinds) {
  for (let index = 0; index < decorators.length; index += 1) {
    const kind = kinds[index];
    if (!MESSAGE_HANDLERS.has(kind)) continue;
    const message = messageClass(state.config, state.context, checker, decorators[index], state.localFiles, state.readonlyReasons);
    if (!message) continue;
    const key = `${message.getSourceFile().fileName}:${message.pos}`;
    if (state.messageSeen.has(key)) continue;
    state.messageSeen.add(key);
    state.messages += 1;
    checkMessageReadonly(state.config, state.context, state.context.checkerFor(message.getSourceFile().fileName), message,
      state.localFiles, state.violations, state.readonlyReasons);
  }
}

function checkUseCase(state, role, sourceFile, checker, declaration) {
  const { ts, config, context, publicReasons, publicSeen, localFiles, violations } = state;
  if (!(role.role === 'use-case' && !role.transport && ts.isClassDeclaration(declaration) && declaration.name)) return;
  const exported = exportedSymbols(ts, checker, sourceFile).some(symbol => (symbol.getDeclarations?.() ?? []).includes(declaration));
  if (!exported) return;
  const classSymbol = normalizedSymbol(ts, checker, declaration.name);
  const instanceType = classSymbol ? checker.getDeclaredTypeOfSymbol(classSymbol) : null;
  const execute = instanceType ? checker.getPropertyOfType(instanceType, 'execute') : null;
  if (!execute) publicReasons.push(`${relativePath(config.root, sourceFile.fileName)} exports a use-case class without a statically resolved execute contract`);
  else state.callableSignatures += checkCallableSymbol({ config, context, checker, symbol: execute, location: declaration,
    reportSource: sourceFile, reportNode: declaration.name, violations, reasons: publicReasons, seen: publicSeen, localFiles });
}

function checkClassContracts(state, sourceFile, checker, role, declaration, framework) {
  const { ts, config, context, violations, readonlyReasons, localFiles } = state;
  const decorators = nodeDecorators(ts, declaration);
  const kinds = decorators.map(decorator => decoratorKind(ts, checker, decorator, framework.targets));
  const directKinds = kinds.filter(Boolean);
  checkConstructedClassDecorators(state, sourceFile, checker, decorators, kinds, framework.targets);
  const classKind = directKinds.find(kind => NEST_CREATED.has(kind)) ?? null;
  const targets = framework.targets;
  checkConstructedMemberDecorators(state, sourceFile, declaration, checker, targets);
  if (classKind || hasInjectedMember(ts, checker, declaration, targets)) {
    state.injectedClasses += 1;
    checkInjectedClass({ config, context, checker, declaration, classKind, targets, decoratorKind,
      localFiles, violations, reasons: readonlyReasons });
  }
  checkMessageHandlers(state, sourceFile, checker, decorators, kinds);
  checkUseCase(state, role, sourceFile, checker, declaration);
}

function checkSourceFile(state, sourceFile) {
  const checker = state.context.checkerFor(sourceFile.fileName);
  const framework = frameworkFor(state, checker);
  const role = sourceRole(sourceFile);
  for (const declaration of classesInSource(state.ts, sourceFile)) checkClassContracts(state, sourceFile, checker, role, declaration, framework);
}

function contractCoverage(state) {
  const publicDetails = [...new Set(state.publicReasons)].sort(byCodeUnit);
  const readonlyDetails = [...new Set(state.readonlyReasons)].sort(byCodeUnit);
  return {
    violations: state.violations,
    coverage: {
      publicContracts: publicDetails.length ? { status: 'unavailable', callableSignatures: state.callableSignatures, details: publicDetails }
        : { status: 'checked', callableSignatures: state.callableSignatures },
      readonlyBoundaries: readonlyDetails.length ? { status: 'unavailable', injectedClasses: state.injectedClasses, messages: state.messages, details: readonlyDetails }
        : { status: 'checked', injectedClasses: state.injectedClasses, messages: state.messages },
    },
  };
}

/** Enforce mechanically selected public contract and readonly boundaries without treating DTOs or arbitrary interfaces as APIs. */
export function checkBackendContracts(config, context) {
  const state = {
    config, context, ts: context.ts,
    localFiles: new Set(context.files.map(file => canonical(file.fileName))),
    sourceFiles: new Map(context.files.map(file => [canonical(file.fileName), file])),
    frameworkByChecker: new Map(), violations: [], publicReasons: [], readonlyReasons: [],
    publicSeen: new Set(), messageSeen: new Set(), callableSignatures: 0, injectedClasses: 0, messages: 0,
  };
  checkOwnerCoverage(state);
  checkPublicOwners(state);
  for (const sourceFile of context.files) checkSourceFile(state, sourceFile);
  return contractCoverage(state);
}
