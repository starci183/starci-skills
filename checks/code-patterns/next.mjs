import fs from 'node:fs';
import path from 'node:path';
import { loadTargetTypeScript } from '../architecture/typescript.mjs';

export const NEXT_SCRIPT_RULES = Object.freeze([
  'FE_READONLY_PROPS_CONTRACT',
  'FE_SOURCE_NAME_SHAPE',
  'FE_SPEC_SUBJECT_AND_DESCRIBE',
  'FE_SPEC_NO_SNAPSHOT',
  'FE_RETURN_TYPE_PROFILE',
  'FE_CLOSED_VOCABULARY_SHAPE',
]);

const UNAVAILABLE = Object.freeze({
  FE_RETURN_TYPE_PROFILE: 'Return-form checking needs explicit component, hook, async-utility and primitive-helper symbol roles.',
  FE_CLOSED_VOCABULARY_SHAPE: 'Closed-vocabulary checking needs an explicit declaration of which state/mode types and inventories form one contract.',
});

const SOURCE_FILE = /\.(?:ts|tsx)$/i;
const DECLARATION_FILE = /\.d\.(?:ts|tsx)$/i;
const SPEC_FILE = /\.spec\.(?:ts|tsx)$/i;
const NEXT_ROUTE_FILE = /(?:^|\/)app\/(?:.*\/)?(?:default|error|global-error|layout|loading|not-found|page|route|template)\.(?:ts|tsx)$/i;
const NEXT_RESERVED_EXPORTS = new Set(['dynamic', 'dynamicParams', 'fetchCache', 'generateMetadata', 'generateStaticParams', 'generateViewport',
  'maxDuration', 'metadata', 'preferredRegion', 'revalidate', 'runtime', 'viewport']);
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

function checkReadonlyType(ts, checker, source, relative, node, violations, errors, membersAlreadyReadonly = false, rootContract = false) {
  const add = (target, message) => violations.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative,
    ...location(source, target), message });
  if (ts.isParenthesizedTypeNode(node)) return checkReadonlyType(ts, checker, source, relative, node.type, violations, errors, membersAlreadyReadonly, rootContract);
  if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return checkReadonlyType(ts, checker, source, relative, node.type, violations, errors, true, rootContract);
  }
  if (ts.isArrayTypeNode(node)) {
    add(node, 'A props collection uses ReadonlyArray<T> rather than mutable T[].');
    return checkReadonlyType(ts, checker, source, relative, node.elementType, violations, errors);
  }
  if (ts.isTupleTypeNode(node)) {
    if (!membersAlreadyReadonly) add(node, 'A props tuple is declared readonly.');
    for (const element of node.elements) checkReadonlyType(ts, checker, source, relative, element, violations, errors);
    return;
  }
  if (ts.isNamedTupleMember(node) || ts.isOptionalTypeNode(node) || ts.isRestTypeNode(node)) {
    return checkReadonlyType(ts, checker, source, relative, node.type, violations, errors);
  }
  if (ts.isTypeReferenceNode(node)) {
    if (standardType(ts, checker, node.typeName, 'Array')) {
      add(node, 'A props collection uses ReadonlyArray<T> rather than mutable Array<T>.');
      for (const argument of node.typeArguments ?? []) checkReadonlyType(ts, checker, source, relative, argument, violations, errors);
      return;
    }
    if (standardType(ts, checker, node.typeName, 'ReadonlyArray')) {
      for (const argument of node.typeArguments ?? []) checkReadonlyType(ts, checker, source, relative, argument, violations, errors);
      return;
    }
    if (standardType(ts, checker, node.typeName, 'Readonly')) {
      for (const argument of node.typeArguments ?? []) checkReadonlyType(ts, checker, source, relative, argument, violations, errors, true, rootContract);
      return;
    }
    errors.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative,
      ...location(source, node), message: `Referenced props shape ${node.getText(source)} needs an explicit resolved contract before readonly coverage is available.` });
    return;
  }
  if (ts.isTypeLiteralNode(node)) {
    for (const member of node.members) {
      if (ts.isPropertySignature(member)) {
        if (!membersAlreadyReadonly && !readonlyMember(ts, member)) add(member, 'Every props field, including an inline nested field, is readonly.');
        if (member.type) checkReadonlyType(ts, checker, source, relative, member.type, violations, errors);
      } else if (ts.isIndexSignatureDeclaration(member)) {
        if (!membersAlreadyReadonly && !readonlyMember(ts, member)) add(member, 'Every props index signature is readonly.');
        if (member.type) checkReadonlyType(ts, checker, source, relative, member.type, violations, errors);
      }
    }
    return;
  }
  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    for (const part of node.types) checkReadonlyType(ts, checker, source, relative, part, violations, errors, membersAlreadyReadonly, rootContract);
    return;
  }
  if (ts.isMappedTypeNode(node) || ts.isConditionalTypeNode(node) || ts.isIndexedAccessTypeNode(node)
    || ts.isImportTypeNode(node) || ts.isTypeQueryNode(node)) {
    errors.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative, ...location(source, node),
      message: 'This computed props shape needs an explicit resolved contract before readonly coverage is available.' });
    return;
  }
  if (rootContract) {
    errors.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative, ...location(source, node),
      message: 'This exported Props alias shape needs an explicit resolved contract before readonly coverage is available.' });
  }
}

function checkReadonlyProps(ts, checker, source, relative, violations, errors) {
  for (const statement of source.statements) {
    if (!exported(ts, statement) || !statement.name?.text?.endsWith('Props')) continue;
    if (ts.isTypeAliasDeclaration(statement)) {
      checkReadonlyType(ts, checker, source, relative, statement.type, violations, errors, false, true);
      continue;
    }
    if (!ts.isInterfaceDeclaration(statement)) continue;
    if (statement.heritageClauses?.length) errors.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative,
      ...location(source, statement.heritageClauses[0]), message: 'Inherited Props need an explicit resolved contract before readonly coverage is available.' });
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member) && !ts.isIndexSignatureDeclaration(member)) continue;
      if (!readonlyMember(ts, member)) violations.push({ ruleId: 'FE_READONLY_PROPS_CONTRACT', path: relative,
        ...location(source, member), message: ts.isIndexSignatureDeclaration(member)
          ? 'Every exported Props index signature is readonly.' : 'Every exported Props field is readonly.' });
      if (member.type) checkReadonlyType(ts, checker, source, relative, member.type, violations, errors);
    }
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
  return names;
}

function isFunctionInitializer(ts, initializer) {
  return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
}

function isFrozenSyntax(ts, initializer) {
  if (ts.isAsExpression(initializer)) return initializer.type.kind === ts.SyntaxKind.ConstKeyword || isFrozenSyntax(ts, initializer.expression);
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

function importedBinding(ts, checker, expression, exportedName) {
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    const namespace = checker.getSymbolAtLocation(expression.expression);
    const declarations = namespace?.getDeclarations?.() ?? [];
    return expression.name.text === exportedName && declarations.some(declaration => {
      const statement = importDeclaration(ts, declaration);
      return ts.isNamespaceImport(declaration) && statement?.moduleSpecifier.text === 'vitest';
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
      && statement?.moduleSpecifier.text === 'vitest';
  });
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

function stable(items) {
  return items.sort((a, b) => `${a.path ?? ''}:${a.line ?? 0}:${a.column ?? 0}:${a.ruleId ?? ''}:${a.message}`
    .localeCompare(`${b.path ?? ''}:${b.line ?? 0}:${b.column ?? 0}:${b.ruleId ?? ''}:${b.message}`));
}

/** Check only exact mechanically decidable Next syntax clauses over exact selected source files. */
export function checkNextPatterns({ root, files, ruleIds } = {}) {
  let repository = '';
  try { repository = typeof root === 'string' ? fs.realpathSync(path.resolve(root)) : ''; } catch { repository = ''; }
  const result = { schema: 'starci/code-pattern-script@1', repository, files: [], requestedRuleIds: [], checkedRuleIds: [], violations: [], errors: [], compiler: null,
    limitations: [
      'Readonly syntax covers directly exported Props shapes; inherited, referenced and computed object shapes fail unavailable until their contract is explicitly resolved.',
      'Source naming covers hook/module basenames and syntactically literal frozen inventories; it does not infer domain roles from arbitrary expressions.',
      'Spec checks cover collocated selected subjects, statically bound top-level Vitest describe forms and statically named expect snapshot matchers; unsupported dynamic forms fail coverage.',
      'Behavior-title meaning, actual network reach, translated-copy ownership and legitimate class proof remain semantic or behavioral evidence obligations.',
    ] };
  const fail = message => { result.errors.push({ message }); return result; };
  if (!repository || !Array.isArray(files) || !Array.isArray(ruleIds) || ruleIds.length === 0) return fail('Root, explicit files and at least one supported rule ID are required.');
  if (new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEXT_SCRIPT_RULES.includes(id))) return fail('Unknown or duplicate Next syntax rule ID.');
  if (new Set(files).size !== files.length) return fail('Duplicate input file.');
  result.requestedRuleIds = [...ruleIds].sort();
  let compiler;
  try { compiler = loadTargetTypeScript(repository); } catch (error) { return fail(String(error.message)); }
  result.compiler = { version: compiler.version, resolved: compiler.resolved };
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
  let program;
  if (selected.length) {
    const configFile = compiler.ts.findConfigFile(repository, compiler.ts.sys.fileExists, 'tsconfig.json');
    let options = { noEmit: true, skipLibCheck: true, jsx: compiler.ts.JsxEmit.Preserve };
    if (configFile) {
      const read = compiler.ts.readConfigFile(configFile, compiler.ts.sys.readFile);
      if (read.error) result.errors.push({ message: 'Target tsconfig is invalid; Next pattern coverage is unavailable.' });
      else {
        const parsedConfig = compiler.ts.parseJsonConfigFileContent(read.config, compiler.ts.sys, path.dirname(configFile), undefined, configFile);
        if (parsedConfig.errors.length) result.errors.push({ message: 'Target tsconfig is invalid; Next pattern coverage is unavailable.' });
        options = parsedConfig.options;
      }
    }
    program = compiler.ts.createProgram({ rootNames: selected.map(item => item.absolute), options: { ...options, noEmit: true } });
  }
  const checker = program?.getTypeChecker();
  const parsed = new Map();
  for (const item of selected) {
    const source = program?.getSourceFile(item.absolute);
    if (!source || program.getSyntacticDiagnostics(source).length) {
      result.errors.push({ path: item.relative, message: 'TypeScript syntax is invalid; code-pattern coverage is unavailable.' });
      continue;
    }
    parsed.set(item.relative, source);
    result.files.push(item.relative);
  }
  for (const ruleId of ruleIds) if (UNAVAILABLE[ruleId]) {
    result.errors.push({ ruleId, code: 'FE_PATTERN_CONTRACT_REQUIRED', message: UNAVAILABLE[ruleId] });
  }
  for (const [relative, source] of parsed) {
    if (requested.has('FE_READONLY_PROPS_CONTRACT') && !SPEC_FILE.test(relative)) checkReadonlyProps(compiler.ts, checker, source, relative, result.violations, result.errors);
    if (requested.has('FE_SOURCE_NAME_SHAPE')) checkSourceNames(compiler.ts, source, relative, result.violations);
    if (requested.has('FE_SPEC_SUBJECT_AND_DESCRIBE')) checkSpecSubject(compiler.ts, checker, parsed, source, relative, repository, result.violations, result.errors);
    if (requested.has('FE_SPEC_NO_SNAPSHOT') && SPEC_FILE.test(relative)) checkSnapshots(compiler.ts, checker, source, relative, result.violations, result.errors);
  }
  if (!result.errors.some(error => !error.ruleId || !UNAVAILABLE[error.ruleId])) {
    result.checkedRuleIds = ruleIds.filter(ruleId => !UNAVAILABLE[ruleId]).sort();
  }
  stable(result.violations);
  stable(result.errors);
  return result;
}

/** Rich-name alias retained for direct library consumers; the runner uses checkNextPatterns. */
export const checkNextCodePatterns = checkNextPatterns;
