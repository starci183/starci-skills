import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadTargetTypeScript } from '../architecture/typescript.mjs';

export const NEXT_SCRIPT_RULES = Object.freeze([
  'FE_READONLY_PROPS_CONTRACT',
  'FE_SOURCE_NAME_SHAPE',
  'FE_SPEC_SUBJECT_AND_DESCRIBE',
  'FE_SPEC_NO_SNAPSHOT',
  'FE_RETURN_TYPE_PROFILE',
  'FE_CLOSED_VOCABULARY_SHAPE',
  'FE_CONTRACT_NAME_SHAPE',
]);

const SOURCE_FILE = /\.(?:ts|tsx)$/i;
const DECLARATION_FILE = /\.d\.(?:ts|tsx)$/i;
const SPEC_FILE = /\.spec\.(?:ts|tsx)$/i;
const NEXT_ROUTE_FILE = /(?:^|\/)app\/(?:.*\/)?(?:default|error|global-error|layout|loading|not-found|page|route|template)\.(?:ts|tsx)$/i;
const NEXT_RESERVED_EXPORTS = new Set(['dynamic', 'dynamicParams', 'fetchCache', 'generateMetadata', 'generateStaticParams', 'generateViewport',
  'maxDuration', 'metadata', 'preferredRegion', 'revalidate', 'runtime', 'viewport']);
const NEXT_HANDLER_EXPORTS = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']);
const CONTRACT_SUFFIXES = Object.freeze(['Actions', 'Data', 'Labels', 'Mode', 'Props', 'State']);
const slash = value => value.replaceAll('\\', '/');

function inside(root, file) {
  const relative = path.relative(root, file);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function location(source, node) {
  const point = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { line: point.line + 1, column: point.character + 1 };
}

function exported(ts, node) {
  return Boolean(ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function readonlyMember(ts, member) {
  return Boolean(ts.getModifiers(member)?.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword));
}

function typeSymbol(ts, checker, node) {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return null;
  return (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
}

function standardType(ts, checker, node, expected) {
  if (!ts.isIdentifier(node) || node.text !== expected) return false;
  const symbol = typeSymbol(ts, checker, node);
  return Boolean(symbol?.getDeclarations()?.some(declaration => declaration.getSourceFile().hasNoDefaultLib));
}

function readonlyError(context, source, relative, node, message) {
  context.errors.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative, ...location(source, node), message });
}

function checkReadonlyMembers(context, source, relative, members, membersAlreadyReadonly = false) {
  const { ts } = context;
  for (const member of members) {
    if (ts.isPropertySignature(member)) {
      if (!membersAlreadyReadonly && !readonlyMember(ts, member)) context.violations.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative,
        ...location(source, member), message: 'Every props field, including a resolved nested field, is readonly.' });
      if (member.type) checkReadonlyType(context, source, relative, member.type);
    } else if (ts.isIndexSignatureDeclaration(member)) {
      if (!membersAlreadyReadonly && !readonlyMember(ts, member)) context.violations.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative,
        ...location(source, member), message: 'Every props index signature is readonly.' });
      if (member.type) checkReadonlyType(context, source, relative, member.type);
    }
  }
}

/** Every declaration is an installed library's .d.ts (under node_modules): an opaque type for readonly props. */
function libraryDeclarations(declarations) {
  return declarations.length > 0 && declarations.every(declaration => declaration.getSourceFile().isDeclarationFile
    && /\/node_modules\//.test(canonicalFile(declaration.getSourceFile().fileName).replaceAll('\\', '/')));
}

function checkReadonlyDeclarations(context, originSource, originRelative, node, declarations, membersAlreadyReadonly, rootContract = false, heritage = false) {
  const { ts } = context;
  // A field typed by an installed library's declaration (React's ReactNode or ComponentType<P>, a
  // grammar type) is an opaque leaf: the product cannot make a library type readonly, and the field that
  // holds it is already checked above. Only the product's own shapes are walked; an inherited (extends) library
  // base stays unavailable, since its fields become the props' own (nivo inc-ffe60c49f502:
  // every `readonly x?: ReactNode` made readonly coverage unavailable).
  if (!rootContract && !heritage && libraryDeclarations(declarations)) return;
  if (declarations.length === 0 || declarations.some(declaration => !ts.isTypeAliasDeclaration(declaration) && !ts.isInterfaceDeclaration(declaration))) {
    readonlyError(context, originSource, originRelative, node,
      `Referenced props shape ${node.getText(originSource)} has no resolvable type/interface contract.`);
    return;
  }
  if (declarations.some(declaration => declaration.typeParameters?.length)) {
    readonlyError(context, originSource, originRelative, node,
      `Generic referenced props shape ${node.getText(originSource)} needs an explicit instantiated contract.`);
    return;
  }
  for (const declaration of declarations) {
    const targetSource = declaration.getSourceFile();
    const targetRelative = context.selectedByFile.get(canonicalFile(targetSource.fileName));
    if (!targetRelative) {
      readonlyError(context, originSource, originRelative, node,
        `Referenced props shape ${node.getText(originSource)} resolves outside the exact selected file set.`);
      continue;
    }
    const key = `${declarationIdentity(declaration)}\0${membersAlreadyReadonly ? 'readonly' : 'direct'}`;
    if (context.active.has(key) || context.complete.has(key)) continue;
    context.active.add(key);
    if (ts.isTypeAliasDeclaration(declaration)) {
      checkReadonlyType(context, targetSource, targetRelative, declaration.type, membersAlreadyReadonly, rootContract);
    } else {
      for (const heritage of declaration.heritageClauses ?? []) for (const inherited of heritage.types) {
        const symbol = targetSymbol(ts, context.checker, context.checker.getSymbolAtLocation(inherited.expression));
        checkReadonlyDeclarations(context, targetSource, targetRelative, inherited, symbol?.getDeclarations?.() ?? [], membersAlreadyReadonly, false, true);
      }
      checkReadonlyMembers(context, targetSource, targetRelative, declaration.members, membersAlreadyReadonly);
    }
    context.active.delete(key);
    context.complete.add(key);
  }
}

function checkReadonlyType(context, source, relative, node, membersAlreadyReadonly = false, rootContract = false) {
  const { ts, checker } = context;
  const add = (target, message) => context.violations.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative,
    ...location(source, target), message });
  if (ts.isParenthesizedTypeNode(node)) return checkReadonlyType(context, source, relative, node.type, membersAlreadyReadonly, rootContract);
  if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return checkReadonlyType(context, source, relative, node.type, true, rootContract);
  }
  if (ts.isArrayTypeNode(node)) {
    add(node, 'A props collection uses ReadonlyArray<T> rather than mutable T[].');
    return checkReadonlyType(context, source, relative, node.elementType);
  }
  if (ts.isTupleTypeNode(node)) {
    if (!membersAlreadyReadonly) add(node, 'A props tuple is declared readonly.');
    for (const element of node.elements) checkReadonlyType(context, source, relative, element);
    return;
  }
  if (ts.isNamedTupleMember(node) || ts.isOptionalTypeNode(node) || ts.isRestTypeNode(node)) {
    return checkReadonlyType(context, source, relative, node.type);
  }
  if (ts.isTypeReferenceNode(node)) {
    if (standardType(ts, checker, node.typeName, 'Array')) {
      add(node, 'A props collection uses ReadonlyArray<T> rather than mutable Array<T>.');
      for (const argument of node.typeArguments ?? []) checkReadonlyType(context, source, relative, argument);
      return;
    }
    if (standardType(ts, checker, node.typeName, 'ReadonlyArray')) {
      for (const argument of node.typeArguments ?? []) checkReadonlyType(context, source, relative, argument);
      return;
    }
    if (standardType(ts, checker, node.typeName, 'Readonly')) {
      if (node.typeArguments?.length !== 1) return readonlyError(context, source, relative, node, 'Built-in Readonly needs one resolved shape argument.');
      return checkReadonlyType(context, source, relative, node.typeArguments[0], true, rootContract);
    }
    const resolved = checker.getTypeFromTypeNode(node);
    if (dynamicReturn(ts, resolved)) return readonlyError(context, source, relative, node,
      `Referenced props shape ${node.getText(source)} resolves to any/unknown.`);
    const symbol = targetSymbol(ts, checker, checker.getSymbolAtLocation(node.typeName));
    if (!rootContract && node.typeArguments?.length && libraryDeclarations(symbol?.getDeclarations?.() ?? [])) {
      // An installed library generic (ComponentType<P>) is opaque; the product shapes passed to it are not.
      for (const argument of node.typeArguments) checkReadonlyType(context, source, relative, argument);
      return;
    }
    if (node.typeArguments?.length) return readonlyError(context, source, relative, node,
      `Generic referenced props shape ${node.getText(source)} needs an explicit instantiated contract.`);
    checkReadonlyDeclarations(context, source, relative, node, symbol?.getDeclarations?.() ?? [], membersAlreadyReadonly, rootContract);
    return;
  }
  if (ts.isTypeLiteralNode(node)) {
    checkReadonlyMembers(context, source, relative, node.members, membersAlreadyReadonly);
    return;
  }
  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    for (const part of node.types) checkReadonlyType(context, source, relative, part, membersAlreadyReadonly, rootContract);
    return;
  }
  if (node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.UnknownKeyword) {
    readonlyError(context, source, relative, node, 'A props shape containing any/unknown has unavailable readonly coverage.');
    return;
  }
  if (ts.isMappedTypeNode(node) || ts.isConditionalTypeNode(node) || ts.isIndexedAccessTypeNode(node)
    || ts.isImportTypeNode(node) || ts.isTypeQueryNode(node)) {
    readonlyError(context, source, relative, node, 'This computed props shape needs an explicit resolved contract before readonly coverage is available.');
    return;
  }
  if (rootContract) readonlyError(context, source, relative, node,
    'This exported Props alias shape needs an explicit resolved contract before readonly coverage is available.');
}

function checkReadonlyProps(ts, checker, source, relative, selectedByFile, violations, errors) {
  const context = { ts, checker, selectedByFile, violations, errors, active: new Set(), complete: new Set() };
  for (const statement of source.statements) {
    if (!exported(ts, statement) || !statement.name?.text?.endsWith('Props')) continue;
    if (ts.isTypeAliasDeclaration(statement)) {
      checkReadonlyType(context, source, relative, statement.type, false, true);
      continue;
    }
    if (!ts.isInterfaceDeclaration(statement)) continue;
    for (const heritage of statement.heritageClauses ?? []) for (const inherited of heritage.types) {
      const symbol = targetSymbol(ts, checker, checker.getSymbolAtLocation(inherited.expression));
      checkReadonlyDeclarations(context, source, relative, inherited, symbol?.getDeclarations?.() ?? [], false, false, true);
    }
    checkReadonlyMembers(context, source, relative, statement.members);
  }
}

function declarationNames(ts, statement) {
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) {
    return [statement.name.text];
  }
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations
    .filter(declaration => ts.isIdentifier(declaration.name)).map(declaration => declaration.name.text);
  if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
    return statement.exportClause.elements.map(element => element.name.text);
  }
  return [];
}

function sourceExports(ts, source) {
  const names = new Set();
  for (const statement of source.statements) if (exported(ts, statement) || ts.isExportDeclaration(statement)) {
    for (const name of declarationNames(ts, statement)) names.add(name);
  }
  // `const X = ...; export default X` is how a Next convention file (layout, page) names its one subject.
  for (const statement of source.statements) if (ts.isExportAssignment(statement) && !statement.isExportEquals && ts.isIdentifier(statement.expression)) {
    names.add(statement.expression.text);
  }
  return names;
}

function isFunctionInitializer(ts, initializer) {
  return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
}

function isFrozenSyntax(ts, initializer) {
  if (ts.isAsExpression(initializer)) return (ts.isTypeReferenceNode(initializer.type) && ts.isIdentifier(initializer.type.typeName)
    && initializer.type.typeName.text === 'const') || isFrozenSyntax(ts, initializer.expression);
  return ts.isArrayLiteralExpression(initializer) || ts.isObjectLiteralExpression(initializer)
    || (ts.isNewExpression(initializer) && ts.isIdentifier(initializer.expression) && ['Map', 'Set', 'WeakMap', 'WeakSet'].includes(initializer.expression.text));
}

function upperSnake(value) {
  return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(value);
}

function checkSourceNames(ts, source, relative, violations) {
  if (SPEC_FILE.test(relative)) return;
  const basename = path.posix.basename(relative).replace(/\.(?:ts|tsx)$/i, '');
  const names = source.statements.flatMap(statement => exported(ts, statement) ? declarationNames(ts, statement) : []);
  const hooks = names.filter(name => /^use[A-Z]/.test(name));
  const moduleFile = relative.split('/').includes('modules') && basename !== 'index' && hooks.length === 0;
  if (moduleFile && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(basename)) {
    violations.push({ ruleId: 'FE_SOURCE_NAME_SHAPE', path: relative, line: 1, column: 1,
      message: 'A non-index file under modules uses a kebab-case basename.' });
  }
  for (const statement of source.statements) {
    if (exported(ts, statement)) for (const name of declarationNames(ts, statement)) {
      if (/^use[A-Z]/.test(name) && basename !== 'index' && basename !== name) {
        violations.push({ ruleId: 'FE_SOURCE_NAME_SHAPE', path: relative, ...location(source, statement),
          message: `Hook source basename ${basename} must equal its exported hook ${name}.` });
      }
    }
    if (!ts.isVariableStatement(statement) || (statement.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || isFunctionInitializer(ts, declaration.initializer)) continue;
      const name = declaration.name.text;
      const nextFrameworkName = (path.posix.basename(relative) === 'next.config.ts' && name === 'nextConfig')
        || (NEXT_ROUTE_FILE.test(relative) && NEXT_RESERVED_EXPORTS.has(name));
      if (!isFrozenSyntax(ts, declaration.initializer) || upperSnake(name) || /ClassNames?$/.test(name) || nextFrameworkName) continue;
      violations.push({ ruleId: 'FE_SOURCE_NAME_SHAPE', path: relative, ...location(source, declaration.name),
        message: `Frozen module value ${name} uses UPPER_SNAKE; class-name role exports remain …ClassName/…ClassNames.` });
    }
  }
}

function siblingSubject(repository, relative) {
  const stem = relative.replace(/\.spec\.(ts|tsx)$/i, '');
  for (const extension of ['.ts', '.tsx']) {
    const candidate = `${stem}${extension}`;
    if (fs.existsSync(path.join(repository, ...candidate.split('/')))) return candidate;
  }
  return null;
}

function importDeclaration(ts, node) {
  for (let current = node; current; current = current.parent) if (ts.isImportDeclaration(current)) return current;
  return null;
}

function importedBinding(ts, checker, expression, exportedName, moduleName = 'vitest') {
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    const namespace = checker.getSymbolAtLocation(expression.expression);
    const declarations = namespace?.getDeclarations?.() ?? [];
    return expression.name.text === exportedName && declarations.some(declaration => {
      const statement = importDeclaration(ts, declaration);
      return (ts.isNamespaceImport(declaration) || (ts.isImportClause(declaration) && declaration.name === expression.expression))
        && statement?.moduleSpecifier.text === moduleName;
    });
  }
  if (!ts.isIdentifier(expression)) return false;
  const symbol = checker.getSymbolAtLocation(expression);
  if (!symbol) return expression.text === exportedName;
  const declarations = symbol.getDeclarations?.() ?? [];
  if (declarations.length > 0 && declarations.every(declaration => declaration.getSourceFile().isDeclarationFile)) return expression.text === exportedName;
  return declarations.some(declaration => {
    const statement = importDeclaration(ts, declaration);
    return ts.isImportSpecifier(declaration) && (declaration.propertyName?.text ?? declaration.name.text) === exportedName
      && statement?.moduleSpecifier.text === moduleName;
  });
}

function reactComponentWrapper(ts, checker, node) {
  if (!(ts.isArrowFunction(node) || ts.isFunctionExpression(node)) || !ts.isCallExpression(node.parent)) return false;
  return ['forwardRef', 'memo'].some(name => importedBinding(ts, checker, node.parent.expression, name, 'react'));
}

function describeInvocation(ts, checker, call) {
  if (importedBinding(ts, checker, call.expression, 'describe')) return call.arguments[0] ?? null;
  if (ts.isPropertyAccessExpression(call.expression) && ['only', 'skip', 'todo'].includes(call.expression.name.text)
    && importedBinding(ts, checker, call.expression.expression, 'describe')) return call.arguments[0] ?? null;
  if (ts.isCallExpression(call.expression) && ts.isPropertyAccessExpression(call.expression.expression)
    && call.expression.expression.name.text === 'each'
    && importedBinding(ts, checker, call.expression.expression.expression, 'describe')) return call.arguments[0] ?? null;
  return undefined;
}

function describeCalls(ts, checker, source) {
  const calls = [];
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
    const call = statement.expression;
    const title = describeInvocation(ts, checker, call);
    if (title !== undefined) calls.push({ call, title });
  }
  return calls;
}

function describeName(ts, node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'name' && ts.isIdentifier(node.expression)) return node.expression.text;
  return null;
}

function checkSpecSubject(ts, checker, parsed, source, relative, repository, violations, errors) {
  if (!SPEC_FILE.test(relative)) return;
  const subjectPath = siblingSubject(repository, relative);
  if (!subjectPath || !parsed.has(subjectPath)) {
    errors.push({ ruleId: 'FE_SPEC_SUBJECT_AND_DESCRIBE', path: relative,
      message: 'The collocated subject source is missing from the exact checked file set.' });
    return;
  }
  const exports = sourceExports(ts, parsed.get(subjectPath));
  if (exports.size === 0) {
    errors.push({ ruleId: 'FE_SPEC_SUBJECT_AND_DESCRIBE', path: relative,
      message: `The subject ${subjectPath} has no statically named export for describe coverage.` });
    return;
  }
  const calls = describeCalls(ts, checker, source);
  if (calls.length === 0) {
    violations.push({ ruleId: 'FE_SPEC_SUBJECT_AND_DESCRIBE', path: relative, line: 1, column: 1,
      message: 'A behavior spec has a top-level describe for its exported subject.' });
  }
  for (const { call, title } of calls) {
    const name = title ? describeName(ts, title) : null;
    if (name !== null && exports.has(name)) continue;
    violations.push({ ruleId: 'FE_SPEC_SUBJECT_AND_DESCRIBE', path: relative, ...location(source, call),
      message: `Top-level describe names one subject export (${[...exports].sort().join(', ')}).` });
  }
}

function expectRoot(ts, checker, expression) {
  let current = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) current = current.expression;
  return ts.isCallExpression(current) && importedBinding(ts, checker, current.expression, 'expect');
}

function matcherName(ts, expression) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression && ts.isStringLiteralLike(expression.argumentExpression)) return expression.argumentExpression.text;
  return null;
}

function checkSnapshots(ts, checker, source, relative, violations, errors) {
  const snapshotMatchers = new Set(['toMatchSnapshot', 'toMatchInlineSnapshot', 'toThrowErrorMatchingSnapshot', 'toThrowErrorMatchingInlineSnapshot']);
  const visit = node => {
    if (ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
      && expectRoot(ts, checker, node.expression.expression)) {
      const matcher = matcherName(ts, node.expression);
      if (matcher === null) errors.push({ ruleId: 'FE_SPEC_NO_SNAPSHOT', path: relative, ...location(source, node.expression),
        message: 'A computed expect matcher prevents complete snapshot-rule coverage.' });
      else if (snapshotMatchers.has(matcher)) violations.push({ ruleId: 'FE_SPEC_NO_SNAPSHOT', path: relative, ...location(source, node),
        message: 'Behavior specs do not use snapshot matchers.' });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function declarationIdentifier(ts, node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name;
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isVariableDeclaration(node.parent)
    && ts.isIdentifier(node.parent.name)) return node.parent.name;
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isCallExpression(node.parent)
    && ts.isVariableDeclaration(node.parent.parent) && ts.isIdentifier(node.parent.parent.name)) return node.parent.parent.name;
  return null;
}

function functionName(ts, node) {
  return declarationIdentifier(ts, node)?.text ?? null;
}

function exportedFunction(ts, node) {
  if (ts.isFunctionDeclaration(node)) return exported(ts, node);
  const declaration = ts.isVariableDeclaration(node.parent) ? node.parent
    : ts.isCallExpression(node.parent) && ts.isVariableDeclaration(node.parent.parent) ? node.parent.parent : null;
  const statement = declaration?.parent?.parent;
  return Boolean(statement && ts.isVariableStatement(statement) && exported(ts, statement));
}

function defaultFunction(ts, node) {
  return ts.isFunctionDeclaration(node) && Boolean(ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword));
}

function containsOwnJsx(ts, node) {
  let found = false;
  const visit = current => {
    if (found) return;
    if (current !== node && (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) || ts.isArrowFunction(current))) return;
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) || ts.isJsxFragment(current)) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  if (node.body) visit(node.body);
  return found;
}

function defaultExportTargets(ts, checker, source) {
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exportedDefault = moduleSymbol ? checker.getExportsOfModule(moduleSymbol).find(symbol => symbol.name === 'default') : null;
  return exportedDefault ? new Set([targetSymbol(ts, checker, exportedDefault)]) : new Set();
}

function functionIsDefaultExport(ts, checker, node, targets) {
  if (defaultFunction(ts, node)) return true;
  const identifier = declarationIdentifier(ts, node);
  return Boolean(identifier && targets.has(targetSymbol(ts, checker, checker.getSymbolAtLocation(identifier))));
}

function routeFrameworkFunction(ts, checker, node, relative, defaultTargets) {
  const selectedDefault = functionIsDefaultExport(ts, checker, node, defaultTargets);
  if (!NEXT_ROUTE_FILE.test(relative) || (!exportedFunction(ts, node) && !selectedDefault)) return false;
  const basename = path.posix.basename(relative);
  const name = functionName(ts, node);
  if (basename === 'route.ts' || basename === 'route.tsx') return Boolean(name && NEXT_HANDLER_EXPORTS.has(name));
  return selectedDefault || Boolean(name && ['generateMetadata', 'generateStaticParams', 'generateViewport'].includes(name));
}

function selectedOwner(relative, owners) {
  const matches = owners.filter(owner => relative === owner.root || relative.startsWith(`${owner.root}/`))
    .sort((a, b) => b.root.length - a.root.length);
  return matches[0] ?? null;
}

function selectedOwnerName(relative, owners) {
  return selectedOwner(relative, owners)?.name ?? null;
}

const VISUAL_TIERS = new Set(['leaves', 'composites', 'branches', 'blocks']);

function inferredVisualOwner(relative) {
  const parts = relative.split('/');
  // The canon's monorepo layout (@starci/eslint-canon-fe layout "monorepo") keeps the shared package's tiers
  // directly under packages/<pkg>/src - packages/ui/src/leaves/Checkbox - so that src is the components root
  // there, exactly as src/components is in one app (nivo inc-ffe60c49f502: 62 owner-less contracts).
  const packageSrc = parts[0] === 'packages' && parts[2] === 'src' && VISUAL_TIERS.has(parts[3]) ? 2 : -1;
  const components = packageSrc >= 0 ? packageSrc : parts.lastIndexOf('components');
  if (components >= 0) {
    const tail = parts.slice(components + 1, -1);
    if (tail.length === 0) return path.posix.basename(relative).replace(/\.(?:ts|tsx)$/i, '');
    if (tail[0] === 'blocks' && tail.length >= 3) return tail[2];
    if (['leaves', 'pages'].includes(tail[0]) && tail.length >= 2) return tail[1];
    return tail.at(-1);
  }
  return null;
}

function componentOwnerNames(ts, parsed, owners) {
  const byDirectory = new Map();
  for (const [relative, source] of parsed) {
    const names = new Set();
    const selected = selectedOwnerName(relative, owners) ?? inferredVisualOwner(relative);
    if (selected) names.add(selected);
    const visit = node => {
      if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && exportedFunction(ts, node)) {
        const name = functionName(ts, node);
        if (name && containsOwnJsx(ts, node)) names.add(name.replace(/(?:Base|Route)$/, ''));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    const directory = path.posix.dirname(relative);
    const current = byDirectory.get(directory) ?? new Set();
    for (const name of names) current.add(name);
    byDirectory.set(directory, current);
  }
  return byDirectory;
}

function primitiveReturn(ts, type) {
  const parts = type.isUnion() ? type.types.filter(part => (part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Never)) === 0) : [type];
  if (parts.length === 0) return false;
  const primitive = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.ESSymbolLike;
  return parts.every(part => (part.flags & primitive) !== 0);
}

function dynamicReturn(ts, type) {
  return (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0
    || (type.isUnion() && type.types.some(part => (part.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0));
}

function checkReturnProfile(ts, checker, source, relative, ownerNames, violations, errors) {
  const defaultTargets = defaultExportTargets(ts, checker, source);
  const check = node => {
    const identifier = declarationIdentifier(ts, node);
    const name = identifier?.text ?? null;
    if (!identifier && !defaultFunction(ts, node)) return;
    const signature = checker.getSignatureFromDeclaration(node);
    if (!signature) {
      errors.push({ ruleId: 'FE_RETURN_TYPE_PROFILE', path: relative, ...location(source, node),
        message: 'The named function return signature could not be resolved.' });
      return;
    }
    if (identifier) {
      const symbol = checker.getSymbolAtLocation(identifier);
      const overloads = symbol?.getDeclarations()?.filter(declaration => ts.isFunctionDeclaration(declaration)) ?? [];
      if (overloads.length > 1) {
        errors.push({ ruleId: 'FE_RETURN_TYPE_PROFILE', path: relative, ...location(source, identifier),
          message: `Overloaded function ${name} needs an explicit return-role contract before return-form coverage is available.` });
        return;
      }
    }
    if (routeFrameworkFunction(ts, checker, node, relative, defaultTargets)) return;
    const explicit = node.type ?? null;
    const component = containsOwnJsx(ts, node) || reactComponentWrapper(ts, checker, node)
      || Boolean(name && ownerNames.has(name.replace(/(?:Base|Route)$/, '')))
      || (functionIsDefaultExport(ts, checker, node, defaultTargets) && NEXT_ROUTE_FILE.test(relative) && path.posix.basename(relative) !== 'route.ts');
    const hook = Boolean(name && /^use[A-Z]/.test(name));
    if (component || hook) {
      if (explicit) violations.push({ ruleId: 'FE_RETURN_TYPE_PROFILE', path: relative, ...location(source, explicit),
        message: `${component ? 'Component' : 'Hook'} ${name ?? 'default export'} infers its return type.` });
      return;
    }
    if (!name) return;
    const returnType = checker.getReturnTypeOfSignature(signature);
    if (dynamicReturn(ts, returnType)) {
      errors.push({ ruleId: 'FE_RETURN_TYPE_PROFILE', path: relative, ...location(source, identifier ?? node),
        message: `Function ${name} has an unresolved any/unknown return; return-form coverage is unavailable.` });
      return;
    }
    if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
      if (!explicit) violations.push({ ruleId: 'FE_RETURN_TYPE_PROFILE', path: relative, ...location(source, identifier ?? node),
        message: `Async utility ${name} declares its Promise return type.` });
      else if (!checker.getPromisedTypeOfPromise(checker.getTypeFromTypeNode(explicit))) {
        violations.push({ ruleId: 'FE_RETURN_TYPE_PROFILE', path: relative, ...location(source, explicit),
          message: `Async utility ${name} declares a resolved Promise return type.` });
      }
      return;
    }
    if (primitiveReturn(ts, returnType) && !explicit) violations.push({ ruleId: 'FE_RETURN_TYPE_PROFILE', path: relative,
      ...location(source, identifier), message: `Primitive helper ${name} declares its return type.` });
  };
  const visit = node => {
    if ((ts.isFunctionDeclaration(node) && node.body) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) check(node);
    ts.forEachChild(node, visit);
  };
  for (const statement of source.statements) visit(statement);
}

function unwrapExpression(ts, expression) {
  let current = expression;
  while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function hasConstAssertion(ts, expression) {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isSatisfiesExpression(current)) current = current.expression;
  return ts.isAsExpression(current) && ts.isTypeReferenceNode(current.type) && ts.isIdentifier(current.type.typeName)
    && current.type.typeName.text === 'const';
}

function stringInventory(ts, declaration) {
  if (!declaration.initializer || !hasConstAssertion(ts, declaration.initializer)) return null;
  const initializer = unwrapExpression(ts, declaration.initializer);
  const values = [];
  if (ts.isArrayLiteralExpression(initializer)) {
    for (const element of initializer.elements) {
      if (!ts.isStringLiteralLike(element)) return null;
      values.push(element.text);
    }
  } else if (ts.isObjectLiteralExpression(initializer)) {
    for (const property of initializer.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) return null;
      values.push(property.initializer.text);
    }
  } else return null;
  return values;
}

function literalStrings(ts, type) {
  const parts = type.isUnion() ? type.types : [type];
  if (parts.length < 2 || parts.some(part => (part.flags & ts.TypeFlags.StringLiteral) === 0)) return null;
  return parts.map(part => part.value);
}

function exportedVariable(ts, declaration) {
  const statement = declaration.parent?.parent;
  return Boolean(statement && ts.isVariableStatement(statement) && exported(ts, statement));
}

function sourceInventories(ts, source) {
  const inventories = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || (statement.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const values = stringInventory(ts, declaration);
      if (values) inventories.push({ declaration, name: declaration.name.text, values, exported: exportedVariable(ts, declaration) });
    }
  }
  return inventories;
}

function typedReadonlyInventory(ts, checker, declaration, values) {
  if (!declaration.type || !ts.isTypeReferenceNode(declaration.type)
    || !standardType(ts, checker, declaration.type.typeName, 'ReadonlyArray') || declaration.type.typeArguments?.length !== 1) return false;
  return sameValues(literalStrings(ts, checker.getTypeFromTypeNode(declaration.type.typeArguments[0])) ?? [], values);
}

function booleanContractType(ts, type) {
  const parts = type.isUnion() ? type.types.filter(part => (part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) === 0) : [type];
  return parts.length > 0 && parts.every(part => (part.flags & ts.TypeFlags.BooleanLike) !== 0);
}

function checkBooleanProps(ts, checker, source, relative, selectedFiles, violations, errors) {
  for (const statement of source.statements) {
    if (!exported(ts, statement) || !statement.name?.text?.endsWith('Props')
      || !(ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement))) continue;
    const type = checker.getTypeAtLocation(statement.name);
    if (dynamicReturn(ts, type)) {
      errors.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, statement.name),
        message: `Props contract ${statement.name.text} could not be resolved for boolean-name coverage.` });
      continue;
    }
    for (const property of checker.getPropertiesOfType(type)) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      if (!declaration) {
        errors.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, statement.name),
          message: `Props field ${property.name} has no resolvable declaration.` });
        continue;
      }
      if (!selectedFiles.has(canonicalFile(declaration.getSourceFile().fileName))) {
        errors.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, statement.name),
          message: `Props field ${property.name} resolves outside the exact selected file set.` });
        continue;
      }
      const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);
      if (booleanContractType(ts, propertyType) && !/^(?:is|has)[A-Z]/.test(property.name)) {
        violations.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(declaration.getSourceFile(), declaration),
          message: `Boolean prop ${property.name} uses an is/has prefix.` });
      }
    }
  }
}

function transportBoundary(relative) {
  return /(?:^|\/)(?:generated|transport)(?:\/|$)/.test(relative)
    || /(?:^|\/)modules\/api(?:\/|$)/.test(relative)
    || /(?:^|\/)features\/[^/]+\/data(?:\/|$)/.test(relative);
}

function sameValues(left, right) {
  return left.length === right.length && new Set(left).size === left.length && new Set(right).size === right.length
    && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function closedRole(name, relative, explicit, values) {
  if (explicit) return explicit;
  if (/(?:State|Mode)$/.test(name) && /(?:^|\/)components(?:\/|$)/.test(relative) && !transportBoundary(relative)) {
    return name.endsWith('State') ? 'state' : 'mode';
  }
  if (values && /(?:^|\/)packages\/grammar\/src(?:\/|$)/.test(relative)) return 'grammar';
  return null;
}

function checkClosedVocabularies(ts, checker, source, relative, declared, selectedFiles, exportedTypes, seenDeclared, violations, errors) {
  const inventories = sourceInventories(ts, source);
  const byType = new Map(declared.filter(item => item.path === relative).map(item => [item.type, item]));
  const claimedInventories = new Set(declared.filter(item => item.path === relative).map(item => item.inventory));
  for (const statement of source.statements) {
    if (ts.isEnumDeclaration(statement) && !transportBoundary(relative)) {
      violations.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, statement.name),
        message: `Feature/presentation vocabulary ${statement.name.text} uses a string-literal union or discriminated object instead of enum.` });
      continue;
    }
    if (!ts.isTypeAliasDeclaration(statement) || (!exported(ts, statement) && !exportedTypes.has(declarationIdentity(statement)))) continue;
    const explicit = byType.get(statement.name.text);
    if (explicit) seenDeclared.add(`${relative}\0${statement.name.text}`);
    const type = checker.getTypeFromTypeNode(statement.type);
    const values = literalStrings(ts, type);
    const role = closedRole(statement.name.text, relative, explicit?.role, values);
    if (!role) {
      if (values && /(?:State|Mode)$/.test(statement.name.text) && !transportBoundary(relative)) errors.push({
        ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, statement.name),
        message: `Closed-vocabulary role for ${statement.name.text} must be declared in package.json#starci.codePatterns.next.`,
      });
      continue;
    }
    if (!values) {
      violations.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, statement.name),
        message: `${role} vocabulary ${statement.name.text} is a finite string-literal union.` });
      continue;
    }
    const matches = explicit
      ? inventories.filter(item => item.name === explicit.inventory)
      : inventories.filter(item => sameValues(item.values, values));
    if (matches.length !== 1) {
      violations.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, statement.name),
        message: `${role} vocabulary ${statement.name.text} has exactly one beside-it as-const inventory with the same members.` });
      continue;
    }
    const inventory = matches[0];
    claimedInventories.add(inventory.name);
    if (!sameValues(inventory.values, values)) violations.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative,
      ...location(source, inventory.declaration.name), message: `Closed-vocabulary inventory ${inventory.name} contains every member exactly once and no extra member.` });
    if ((role === 'state' || role === 'mode') && !inventory.exported) violations.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE',
      path: relative, ...location(source, inventory.declaration.name), message: `The ${role} inventory ${inventory.name} is exported.` });
    if ((role === 'state' || role === 'mode') && !typedReadonlyInventory(ts, checker, inventory.declaration, values)) violations.push({
      ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, inventory.declaration.name),
      message: `The ${role} inventory ${inventory.name} declares ReadonlyArray<${statement.name.text}> using the resolved built-in type.`,
    });
    if (!upperSnake(inventory.name)) violations.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative,
      ...location(source, inventory.declaration.name), message: `Closed-vocabulary inventory ${inventory.name} uses UPPER_SNAKE.` });
    const suffix = role === 'state' ? '_STATES' : role === 'mode' ? '_MODES' : null;
    if (suffix && !inventory.name.endsWith(suffix)) violations.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative,
      ...location(source, inventory.declaration.name), message: `The ${role} inventory name ends in ${suffix}.` });
  }
  if (/(?:^|\/)packages\/grammar\/src(?:\/|$)/.test(relative)) for (const inventory of inventories) {
    if (claimedInventories.has(inventory.name) || /CLASS_NAMES?$/.test(inventory.name)) continue;
    if (/(?:^|_)(?:MODES|ROLES|SIZES|STATES|TONES|VARIANTS)$/.test(inventory.name)) errors.push({
      ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative, ...location(source, inventory.declaration.name),
      message: `Grammar closed-vocabulary inventory ${inventory.name} needs an exact union binding.`,
    });
  }
  checkBooleanProps(ts, checker, source, relative, selectedFiles, violations, errors);
}

function contractSuffix(name) {
  return CONTRACT_SUFFIXES.find(suffix => name.endsWith(suffix) && name.length > suffix.length) ?? null;
}

function targetSymbol(ts, checker, symbol) {
  if (!symbol) return null;
  const seen = new Set();
  let current = symbol;
  while (current && (current.flags & ts.SymbolFlags.Alias) !== 0 && !seen.has(current)) {
    seen.add(current);
    const target = checker.getAliasedSymbol(current);
    if (!target || target === current) break;
    current = target;
  }
  return current;
}

function declarationIdentity(declaration) {
  return `${canonicalFile(declaration.getSourceFile().fileName)}\0${declaration.pos}\0${declaration.end}`;
}

function collectExportedTypeDeclarations(ts, checkerByRelative, parsed, selectedFiles, errors) {
  const declarations = new Map();
  for (const [relative, source] of parsed) {
    const checker = checkerByRelative.get(relative);
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (!moduleSymbol) continue;
    for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
      const target = targetSymbol(ts, checker, exportedSymbol);
      const projectDeclarations = (target?.getDeclarations?.() ?? []).filter(declaration => !declaration.getSourceFile().isDeclarationFile);
      const selectedDeclarations = projectDeclarations.filter(declaration => selectedFiles.has(canonicalFile(declaration.getSourceFile().fileName)));
      const typeAliases = selectedDeclarations.filter(declaration => ts.isTypeAliasDeclaration(declaration));
      const closedName = /(?:State|Mode)$/.test(exportedSymbol.name);
      if (closedName && (projectDeclarations.length === 0 || selectedDeclarations.length !== projectDeclarations.length)) {
        errors.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative,
          message: `Closed-vocabulary export ${exportedSymbol.name} resolves outside the exact selected file set.` });
        continue;
      }
      if (closedName && typeAliases.length !== 1) {
        errors.push({ ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative,
          message: `Closed-vocabulary export ${exportedSymbol.name} resolves to one checked type alias.` });
        continue;
      }
      for (const declaration of typeAliases) {
        const key = declarationIdentity(declaration);
        const names = declarations.get(key) ?? new Set();
        names.add(exportedSymbol.name);
        declarations.set(key, names);
        if (closedName && declaration.name.text !== exportedSymbol.name) errors.push({
          ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: relative,
          message: `Aliased closed-vocabulary export ${exportedSymbol.name} needs an exact declared type identity.`,
        });
      }
    }
  }
  return declarations;
}

function sourceContractExports(ts, checker, source) {
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (!moduleSymbol) return [];
  return checker.getExportsOfModule(moduleSymbol).map(symbol => {
    const target = targetSymbol(ts, checker, symbol);
    return { name: symbol.name, symbol: target, declarations: target.getDeclarations?.() ?? [] };
  }).filter(item => contractSuffix(item.name)
    && item.declarations.some(declaration => ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)));
}

function checkContractNames(ts, checkerByRelative, parsed, owners, violations, errors) {
  const visualOwners = componentOwnerNames(ts, parsed, owners);
  const contracts = new Map();
  const processed = new Map();
  const selectedByFile = new Map([...parsed].map(([relative, source]) => [canonicalFile(source.fileName), relative]));
  for (const [relative, source] of parsed) {
    const checker = checkerByRelative.get(relative);
    const directory = path.posix.dirname(relative);
    const candidates = visualOwners.get(directory) ?? new Set();
    const configuredOwner = selectedOwner(relative, owners);
    const configured = configuredOwner?.name ?? null;
    if (configured) candidates.add(configured);
    if (/(?:^|\/)packages\/grammar\/src(?:\/|$)/.test(relative)) for (const statement of source.statements) {
      if (ts.isInterfaceDeclaration(statement) && exported(ts, statement)) violations.push({ ruleId: 'FE_CONTRACT_NAME_SHAPE',
        path: relative, ...location(source, statement), message: `Grammar contract ${statement.name.text} uses an exported type alias.` });
    }
    for (const item of sourceContractExports(ts, checker, source)) {
      const suffix = contractSuffix(item.name);
      const prefix = item.name.slice(0, -suffix.length);
      const declarations = item.declarations.filter(declaration => !declaration.getSourceFile().isDeclarationFile);
      if (declarations.length === 0) {
        errors.push({ ruleId: 'FE_CONTRACT_NAME_SHAPE', path: relative,
          message: `Exported contract ${item.name} has no resolved project declaration.` });
        continue;
      }
      const sourceDeclaration = declarations[0];
      const declarationRelative = selectedByFile.get(canonicalFile(sourceDeclaration.getSourceFile().fileName));
      if (!declarationRelative) {
        errors.push({ ruleId: 'FE_CONTRACT_NAME_SHAPE', path: relative,
          message: `Exported contract ${item.name} resolves outside the exact selected file set.` });
        continue;
      }
      const key = `${configuredOwner?.root ?? directory}\0${item.name}`;
      const symbolIdentity = declarationIdentity(sourceDeclaration);
      const group = contracts.get(key) ?? new Map();
      if (!group.has(symbolIdentity)) group.set(symbolIdentity, { path: declarationRelative, ...location(sourceDeclaration.getSourceFile(), sourceDeclaration) });
      contracts.set(key, group);
      const seen = processed.get(key) ?? new Set();
      if (seen.has(symbolIdentity)) continue;
      seen.add(symbolIdentity);
      processed.set(key, seen);
      if ((suffix === 'Props' || suffix === 'Data') && declarations.some(declaration => ts.isInterfaceDeclaration(declaration))) {
        violations.push({ ruleId: 'FE_CONTRACT_NAME_SHAPE', path: declarationRelative,
          ...location(sourceDeclaration.getSourceFile(), sourceDeclaration), message: `${item.name} uses export type for a Props/Data shape.` });
      }
      const matching = [...candidates].filter(owner => owner === prefix
        || (prefix.startsWith(owner) && /^[A-Z][A-Za-z0-9]*$/.test(prefix.slice(owner.length))));
      if (matching.length === 0) {
        if (candidates.size === 0) errors.push({ ruleId: 'FE_CONTRACT_NAME_SHAPE', path: declarationRelative,
          ...location(sourceDeclaration.getSourceFile(), sourceDeclaration),
          message: `Owner for exported contract ${item.name} must be declared in package.json#starci.codePatterns.next.` });
        else violations.push({ ruleId: 'FE_CONTRACT_NAME_SHAPE', path: declarationRelative,
          ...location(sourceDeclaration.getSourceFile(), sourceDeclaration),
          message: `Exported contract ${item.name} follows its owning unit (${[...candidates].sort().join(', ')}).` });
      }
    }
  }
  // Two distinct declarations of one exported contract name inside one owner (a connected block's index.tsx
  // and its component.tsx each exporting XProps) is decidable: a finding at every declaration after the
  // first, not an unavailable result (nivo inc-ffe60c49f502: 49 such pairs made the gate unavailable).
  for (const [key, symbols] of contracts) if (symbols.size > 1) {
    const name = key.split('\0')[1];
    const [first, ...others] = [...symbols.values()].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
    for (const other of others) violations.push({ ruleId: 'FE_CONTRACT_NAME_SHAPE', ...other,
      message: `One owner exports two distinct ${name} contracts (${first.path}:${first.line} and here); the unit has one public ${name}, and the render half names its own contract after its export (${name.replace(/(Props|Data|Actions)$/, 'Base$1')}).` });
  }
}

function normalizedContractPath(value) {
  return typeof value === 'string' && value !== '' && !value.includes('\\') && !path.posix.isAbsolute(value)
    && path.posix.normalize(value) === value && value !== '..' && !value.startsWith('../');
}

function exactRegularRepositoryFile(repository, relative, label) {
  if (!normalizedContractPath(relative)) throw Error(`${label} must be a normalized repository-relative path.`);
  const absolute = path.resolve(repository, ...relative.split('/'));
  if (!inside(repository, absolute)) throw Error(`${label} leaves the repository.`);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`${label} must be a regular non-symlink file.`);
  for (let cursor = path.dirname(absolute); cursor !== repository; cursor = path.dirname(cursor)) {
    if (!inside(repository, cursor) || fs.lstatSync(cursor).isSymbolicLink()) throw Error(`${label} cannot cross a symlink.`);
  }
  return absolute;
}

function normalizedProjectList(repository, values, label, errors) {
  if (!Array.isArray(values) || values.length === 0 || new Set(values).size !== values.length) {
    errors.push({ message: `${label} must declare at least one unique TypeScript project path.` });
    return [];
  }
  const result = [];
  for (const relative of values) {
    try {
      if (!normalizedContractPath(relative) || !/(?:^|\/)tsconfig(?:\.[a-z0-9-]+)?\.json$/i.test(relative)) {
        throw Error('project path must be a normalized tsconfig*.json path');
      }
      exactRegularRepositoryFile(repository, relative, `${label} project ${relative}`);
      result.push(relative);
    } catch (error) { errors.push({ path: typeof relative === 'string' ? relative : undefined, message: `${label}: ${error.message}` }); }
  }
  return result.sort();
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function resolveProjectAuthority(repository, contractProjects, architectureProjects, contextFiles, errors) {
  let bound = null;
  const context = contextFiles === undefined ? null : new Set(Array.isArray(contextFiles) ? contextFiles : []);
  if (contextFiles !== undefined && (!Array.isArray(contextFiles) || context.size !== contextFiles.length
    || [...context].some(item => !normalizedContractPath(item)))) {
    errors.push({ message: 'contextFiles must contain unique normalized repository-relative paths.' });
  }
  if (architectureProjects !== undefined) {
    if (!architectureProjects || architectureProjects.schema !== 'starci/typescript-project-selection@1'
      || !normalizedContractPath(architectureProjects.configPath) || !/^[a-f0-9]{64}$/.test(architectureProjects.configDigest ?? '')) {
      errors.push({ message: 'architectureProjects must use starci/typescript-project-selection@1 with a normalized configPath and lowercase raw-byte SHA-256 digest.' });
    } else {
      let declaredProjects = null;
      try {
        const absolute = exactRegularRepositoryFile(repository, architectureProjects.configPath, 'Architecture config');
        const bytes = fs.readFileSync(absolute);
        const actual = crypto.createHash('sha256').update(bytes).digest('hex');
        if (actual !== architectureProjects.configDigest) throw Error('architecture config digest does not match its exact bytes');
        if (context && !context.has(architectureProjects.configPath)) throw Error('architecture config is absent from exact contextFiles');
        const parsed = JSON.parse(bytes.toString('utf8'));
        if (parsed?.schema !== 'starci/architecture-config@1'
          || (parsed.projects !== undefined && parsed.tsconfig !== undefined)) {
          throw Error('architecture config does not expose one starci/architecture-config@1 project selection');
        }
        const authoredProjects = parsed.projects ?? parsed.tsconfig;
        declaredProjects = (Array.isArray(authoredProjects) ? authoredProjects : [authoredProjects]).sort();
      } catch (error) { errors.push({ path: architectureProjects.configPath, message: `Invalid architecture project authority: ${error.message}` }); }
      bound = normalizedProjectList(repository, architectureProjects.projects, 'architectureProjects', errors);
      if (declaredProjects && !sameStrings(bound, declaredProjects)) {
        errors.push({ path: architectureProjects.configPath, message: 'architectureProjects list disagrees with the bound architecture config.' });
      }
    }
  }
  const fallback = contractProjects === null ? null : normalizedProjectList(repository, contractProjects, 'package.json#starci.codePatterns.next.projects', errors);
  if (bound && fallback && !sameStrings(bound, fallback)) {
    errors.push({ message: 'Architecture project authority and package.json Next project fallback disagree.' });
  }
  const projects = bound ?? fallback ?? [];
  if (projects.length === 0 && bound === null && fallback === null) {
    errors.push({ message: 'Next project coverage needs canonical architectureProjects or package.json#starci.codePatterns.next.projects.' });
  }
  return { projects, source: bound ? 'architecture' : fallback ? 'package' : null,
    architectureConfig: bound ? { path: architectureProjects.configPath, digest: architectureProjects.configDigest } : null };
}

function loadNextContract(repository, selected, errors) {
  const empty = { owners: [], closedVocabularies: [], projects: null };
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(repository, 'package.json'), 'utf8')); } catch (error) {
    errors.push({ message: `Cannot read target package.json for Next role contracts: ${error.message}` });
    return empty;
  }
  const contract = manifest.starci?.codePatterns?.next;
  if (contract === undefined) return empty;
  if (!contract || contract.schema !== 'starci/next-code-pattern-contract@1' || !Array.isArray(contract.owners)
    || !Array.isArray(contract.closedVocabularies)) {
    errors.push({ message: 'package.json#starci.codePatterns.next must use starci/next-code-pattern-contract@1 with owners and closedVocabularies arrays.' });
    return empty;
  }
  const selectedPaths = new Set(selected.map(item => item.relative));
  const owners = [];
  const ownerRoots = new Set();
  for (const owner of contract.owners) {
    if (!owner || !normalizedContractPath(owner.root) || typeof owner.name !== 'string' || !/^[A-Z][A-Za-z0-9]*$/.test(owner.name)
      || ownerRoots.has(owner.root)) {
      errors.push({ message: 'Every Next owner contract needs a unique normalized root and one PascalCase name.' });
      continue;
    }
    const covered = [...selectedPaths].some(relative => relative.startsWith(`${owner.root}/`));
    const absolute = path.resolve(repository, ...owner.root.split('/'));
    try {
      if (!inside(repository, absolute) || !fs.lstatSync(absolute).isDirectory() || fs.lstatSync(absolute).isSymbolicLink() || !covered) {
        throw Error('owner root must be a regular in-repository directory covering at least one exact selected file');
      }
      for (let cursor = absolute; cursor !== repository; cursor = path.dirname(cursor)) if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('owner root cannot cross a symlink');
      ownerRoots.add(owner.root);
      owners.push({ root: owner.root, name: owner.name });
    } catch (error) { errors.push({ message: `Invalid Next owner ${owner.root}: ${error.message}` }); }
  }
  const closedVocabularies = [];
  const typeIds = new Set();
  const inventoryIds = new Set();
  for (const item of contract.closedVocabularies) {
    const typeId = `${item?.path}\0${item?.type}`;
    const inventoryId = `${item?.path}\0${item?.inventory}`;
    if (!item || !normalizedContractPath(item.path) || !selectedPaths.has(item.path)
      || typeof item.type !== 'string' || !/^[A-Z][A-Za-z0-9]*$/.test(item.type)
      || typeof item.inventory !== 'string' || !upperSnake(item.inventory)
      || !['grammar', 'mode', 'state'].includes(item.role) || typeIds.has(typeId) || inventoryIds.has(inventoryId)) {
      errors.push({ message: 'Every closed vocabulary needs a unique selected path/type/inventory identity and role state|mode|grammar.' });
      continue;
    }
    typeIds.add(typeId);
    inventoryIds.add(inventoryId);
    closedVocabularies.push({ path: item.path, type: item.type, inventory: item.inventory, role: item.role });
  }
  let projects = null;
  if (contract.projects !== undefined) {
    projects = Array.isArray(contract.projects) ? [...contract.projects] : [];
    if (!Array.isArray(contract.projects)) errors.push({ message: 'package.json#starci.codePatterns.next.projects must be an array when provided.' });
  }
  return { owners, closedVocabularies, projects };
}

function stable(items) {
  items.sort((a, b) => `${a.path ?? ''}:${a.line ?? 0}:${a.column ?? 0}:${a.ruleId ?? ''}:${a.message}`
    .localeCompare(`${b.path ?? ''}:${b.line ?? 0}:${b.column ?? 0}:${b.ruleId ?? ''}:${b.message}`));
  const seen = new Set();
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const key = `${item.path ?? ''}\0${item.line ?? 0}\0${item.column ?? 0}\0${item.ruleId ?? ''}\0${item.message}`;
    if (seen.has(key)) items.splice(index, 1);
    else seen.add(key);
  }
  return items;
}

function canonicalFile(file) {
  try { return path.resolve(fs.realpathSync(file)); } catch { return path.resolve(file); }
}

function stableCompilerValue(value) {
  if (Array.isArray(value)) return value.map(stableCompilerValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableCompilerValue(value[key])]));
  return value;
}

function compilerOptionsIdentity(options) {
  const ignored = new Set(['configFilePath', 'outDir', 'declarationDir', 'tsBuildInfoFile']);
  return JSON.stringify(Object.fromEntries(Object.keys(options).filter(key => !ignored.has(key)).sort()
    .map(key => [key, stableCompilerValue(options[key])])));
}

function projectReferencePath(ts, reference) {
  if (typeof ts.resolveProjectReferencePath === 'function') return ts.resolveProjectReferencePath(reference);
  return path.extname(reference.path) ? reference.path : path.join(reference.path, 'tsconfig.json');
}

function buildProjectAssignments(repository, compiler, authority, selected, errors) {
  const projects = [];
  const queue = [...authority.projects];
  const seen = new Set();
  while (queue.length) {
    const relative = queue.shift();
    if (seen.has(relative)) continue;
    seen.add(relative);
    let absolute;
    try { absolute = exactRegularRepositoryFile(repository, relative, `TypeScript project ${relative}`); }
    catch (error) { errors.push({ path: relative, message: error.message }); continue; }
    const read = compiler.ts.readConfigFile(absolute, compiler.ts.sys.readFile);
    if (read.error) {
      errors.push({ path: relative, message: 'TypeScript project config cannot be read; Next pattern coverage is unavailable.' });
      continue;
    }
    const parsed = compiler.ts.parseJsonConfigFileContent(read.config, compiler.ts.sys, path.dirname(absolute), undefined, absolute);
    if (parsed.errors.length) {
      errors.push({ path: relative, message: 'TypeScript project config is invalid; Next pattern coverage is unavailable.' });
      continue;
    }
    for (const reference of parsed.projectReferences ?? []) {
      const target = path.resolve(projectReferencePath(compiler.ts, reference));
      if (!inside(repository, target)) {
        errors.push({ path: relative, message: 'TypeScript project reference leaves the repository.' });
        continue;
      }
      queue.push(slash(path.relative(repository, target)));
    }
    const program = compiler.ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true },
      projectReferences: parsed.projectReferences });
    const rootNames = new Set(parsed.fileNames.map(canonicalFile));
    projects.push({ relative, program, checker: program.getTypeChecker(), rootNames,
      identity: compilerOptionsIdentity(parsed.options), selectedCount: 0 });
  }
  const assignments = new Map();
  // No project authority at all is one missing contract, already reported once by the selection; repeating
  // it as "belongs to no declared project" for every selected file buried it under thousands of copies
  // (nivo inc-ffe60c49f502: 3535 of 3547 script errors).
  if (!authority.projects.length && errors.length) return { assignments, projects: [] };
  for (const item of selected) {
    const target = canonicalFile(item.absolute);
    const owners = projects.filter(project => project.rootNames.has(target));
    if (owners.length === 0) {
      errors.push({ path: item.relative, message: 'Selected source belongs to no declared TypeScript project.' });
      continue;
    }
    if (new Set(owners.map(project => project.identity)).size !== 1) {
      errors.push({ path: item.relative, message: 'Selected source belongs to overlapping TypeScript projects with conflicting compiler meaning.' });
      continue;
    }
    const owner = owners[0];
    const source = owner.program.getSourceFile(item.absolute) ?? owner.program.getSourceFile(target);
    if (!source || owner.program.getSyntacticDiagnostics(source).length) {
      errors.push({ path: item.relative, message: 'TypeScript syntax is invalid; code-pattern coverage is unavailable.' });
      continue;
    }
    owner.selectedCount += 1;
    assignments.set(item.relative, { ...item, source, checker: owner.checker, project: owner.relative });
  }
  return { assignments, projects: projects.map(project => ({ path: project.relative, selectedSourceCount: project.selectedCount })) };
}

/** Check only exact mechanically decidable Next syntax clauses over exact selected source files. */
export function checkNextPatterns({ root, files, ruleIds, contextFiles, architectureProjects } = {}) {
  let repository = '';
  try { repository = typeof root === 'string' ? fs.realpathSync(path.resolve(root)) : ''; } catch { repository = ''; }
  const result = { schema: 'starci/code-pattern-script@1', repository, files: [], requestedRuleIds: [], checkedRuleIds: [], violations: [], errors: [], compiler: null,
    limitations: [
      'Readonly coverage resolves selected imported aliases, interfaces, inheritance, cycles and the built-in Readonly/ReadonlyArray types; generic, computed, any/unknown and unselected shapes fail unavailable.',
      'Every selected source is bound to a canonical architecture TypeScript project or an explicit package fallback; uncovered and compiler-conflicting overlaps fail unavailable.',
      'Source naming covers hook/module basenames and syntactically literal frozen inventories; it does not infer domain roles from arbitrary expressions.',
      'Spec checks cover collocated selected subjects, statically bound top-level Vitest describe forms and statically named expect snapshot matchers; unsupported dynamic forms fail coverage.',
      'Return roles cover resolved named components, hooks, async utilities and primitive helpers; overloads and any/unknown returns fail unavailable.',
      'Owner and nonconventional closed-vocabulary roles come only from package.json#starci.codePatterns.next; invalid or uncovered declarations fail unavailable.',
      'Behavior-title meaning, actual network reach, translated-copy ownership and legitimate class proof remain semantic or behavioral evidence obligations.',
    ] };
  const fail = message => { result.errors.push({ message }); return result; };
  if (!repository || !Array.isArray(files) || !Array.isArray(ruleIds) || ruleIds.length === 0) return fail('Root, explicit files and at least one supported rule ID are required.');
  if (new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEXT_SCRIPT_RULES.includes(id))) return fail('Unknown or duplicate Next syntax rule ID.');
  if (new Set(files).size !== files.length) return fail('Duplicate input file.');
  result.requestedRuleIds = [...ruleIds].sort();
  let compiler;
  try { compiler = loadTargetTypeScript(repository); } catch (error) { return fail(String(error.message)); }
  result.compiler = { version: compiler.version, resolved: compiler.resolved, projectAuthority: null, projects: [] };
  const requested = new Set(ruleIds);
  const selected = [];
  for (const relative of [...files].sort()) {
    if (typeof relative !== 'string' || relative.includes('\\') || path.posix.normalize(relative) !== relative || path.isAbsolute(relative)
      || !SOURCE_FILE.test(relative) || DECLARATION_FILE.test(relative)) {
      result.errors.push({ path: typeof relative === 'string' ? relative : undefined,
        message: 'Expected a normalized relative .ts/.tsx source path, excluding declarations.' });
      continue;
    }
    const absolute = path.resolve(repository, ...relative.split('/'));
    try {
      if (!inside(repository, absolute) || !fs.lstatSync(absolute).isFile() || fs.lstatSync(absolute).isSymbolicLink()) throw Error('Input must be a regular repository source file.');
      for (let cursor = path.dirname(absolute); cursor !== repository; cursor = path.dirname(cursor)) {
        if (!inside(repository, cursor) || fs.lstatSync(cursor).isSymbolicLink()) throw Error('Source parent cannot redirect outside its declared tree.');
      }
      selected.push({ relative, absolute });
    } catch (error) { result.errors.push({ path: relative, message: String(error.message) }); }
  }
  const contract = loadNextContract(repository, selected, result.errors);
  const authority = resolveProjectAuthority(repository, contract.projects, architectureProjects, contextFiles, result.errors);
  result.compiler.projectAuthority = { source: authority.source, ...(authority.architectureConfig ?? {}) };
  const projectContext = buildProjectAssignments(repository, compiler, authority, selected, result.errors);
  result.compiler.projects = projectContext.projects;
  const parsed = new Map();
  const checkerByRelative = new Map();
  for (const [relative, item] of projectContext.assignments) {
    parsed.set(relative, item.source);
    checkerByRelative.set(relative, item.checker);
    result.files.push(relative);
  }
  const ownerNames = componentOwnerNames(compiler.ts, parsed, contract.owners);
  const selectedByFile = new Map([...parsed].map(([relative, source]) => [canonicalFile(source.fileName), relative]));
  const selectedFiles = new Set(selectedByFile.keys());
  const exportedTypes = requested.has('FE_CLOSED_VOCABULARY_SHAPE')
    ? collectExportedTypeDeclarations(compiler.ts, checkerByRelative, parsed, selectedFiles, result.errors) : new Map();
  const seenClosedDeclarations = new Set();
  for (const [relative, source] of parsed) {
    const checker = checkerByRelative.get(relative);
    if (requested.has('FE_READONLY_PROPS_CONTRACT') && !SPEC_FILE.test(relative)) checkReadonlyProps(compiler.ts, checker, source, relative,
      selectedByFile, result.violations, result.errors);
    if (requested.has('FE_SOURCE_NAME_SHAPE')) checkSourceNames(compiler.ts, source, relative, result.violations);
    if (requested.has('FE_SPEC_SUBJECT_AND_DESCRIBE')) checkSpecSubject(compiler.ts, checker, parsed, source, relative, repository, result.violations, result.errors);
    if (requested.has('FE_SPEC_NO_SNAPSHOT') && SPEC_FILE.test(relative)) checkSnapshots(compiler.ts, checker, source, relative, result.violations, result.errors);
    if (requested.has('FE_RETURN_TYPE_PROFILE') && !SPEC_FILE.test(relative)) checkReturnProfile(compiler.ts, checker, source, relative,
      ownerNames.get(path.posix.dirname(relative)) ?? new Set(), result.violations, result.errors);
    if (requested.has('FE_CLOSED_VOCABULARY_SHAPE') && !SPEC_FILE.test(relative)) {
      checkClosedVocabularies(compiler.ts, checker, source, relative,
        contract.closedVocabularies, selectedFiles, exportedTypes, seenClosedDeclarations, result.violations, result.errors);
    }
  }
  if (requested.has('FE_CLOSED_VOCABULARY_SHAPE')) for (const declaration of contract.closedVocabularies) {
    if (!seenClosedDeclarations.has(`${declaration.path}\0${declaration.type}`)) result.errors.push({
      ruleId: 'FE_CLOSED_VOCABULARY_SHAPE', path: declaration.path,
      message: `Declared closed vocabulary ${declaration.type} is not one exported type alias in its exact selected source.`,
    });
  }
  if (requested.has('FE_CONTRACT_NAME_SHAPE')) checkContractNames(compiler.ts, checkerByRelative, parsed, contract.owners, result.violations, result.errors);
  if (result.errors.length === 0) result.checkedRuleIds = [...ruleIds].sort();
  stable(result.violations);
  stable(result.errors);
  return result;
}

/** Rich-name alias retained for direct library consumers; the runner uses checkNextPatterns. */
export const checkNextCodePatterns = checkNextPatterns;
