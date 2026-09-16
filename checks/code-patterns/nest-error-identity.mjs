import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig, isInside, slash } from '../architecture/config.mjs';
import { buildTypeScriptContext } from '../architecture/typescript.mjs';

export const NEST_ERROR_IDENTITY_RULES = Object.freeze(['NEST_ERROR_DECLARATION_IDENTITY', 'NEST_THROWN_ERROR_IDENTITY']);
const CONTRACT_SCHEMA = 'starci/nest-error-identity@1';
const SOURCE = /\.(?:[cm]?ts|tsx)$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = file => path.resolve(file).replaceAll('\\', '/');

function exact(value, keys, label) {
  if (!plain(value) || Object.keys(value).some(name => !keys.includes(name))) throw Error(`${label} has an invalid shape.`);
}

function safeRelative(value, label, allowDot = false) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.isAbsolute(value) || /^[A-Za-z]:/.test(value)
    || value !== path.posix.normalize(value) || value.split('/').includes('..') || (!allowDot && value === '.')) throw Error(`${label} must be an exact repository-relative path.`);
  return value;
}

function safePath(root, relative, kind) {
  safeRelative(relative, kind, kind === 'source root');
  const absolute = path.resolve(root, relative);
  for (let cursor = absolute; cursor !== root; cursor = path.dirname(cursor)) {
    if (!isInside(root, cursor) || fs.lstatSync(cursor).isSymbolicLink()) throw Error(`${kind} cannot redirect through a link: ${relative}`);
  }
  const stat = fs.lstatSync(absolute);
  if (kind === 'source file' ? !stat.isFile() : !stat.isDirectory()) throw Error(`${kind} has the wrong filesystem kind: ${relative}`);
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
  while (symbol && symbol.flags & ts.SymbolFlags.Alias && !seen.has(symbol)) { seen.add(symbol); symbol = checker.getAliasedSymbol(symbol); }
  return symbol;
}

const symbolAt = (ts, checker, node) => unalias(ts, checker, checker.getSymbolAtLocation(node));

function moduleSpecifier(ts, declaration) {
  for (let node = declaration; node; node = node.parent) if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) return node.moduleSpecifier.text;
  return null;
}

function importedSurface(ts, checker, input) {
  const node = unwrap(ts, input);
  if (ts.isPropertyAccessExpression(node)) {
    const namespace = (checker.getSymbolAtLocation(node.expression)?.declarations ?? []).find(item => ts.isNamespaceImport(item));
    return namespace ? { module: moduleSpecifier(ts, namespace), export: node.name.text } : null;
  }
  if (!ts.isIdentifier(node)) return null;
  const declaration = (checker.getSymbolAtLocation(node)?.declarations ?? []).find(item => ts.isImportSpecifier(item));
  return declaration ? { module: moduleSpecifier(ts, declaration), export: declaration.propertyName?.text ?? declaration.name.text } : null;
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

function extendsStandardError(program, type, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  const symbol = type.getSymbol?.() ?? type.aliasSymbol;
  if (symbol?.name === 'Error' && (symbol.declarations ?? []).some(item => program.isSourceFileDefaultLibrary(item.getSourceFile()))) return true;
  return (type.getBaseTypes?.() ?? []).some(base => extendsStandardError(program, base, seen));
}

function isNestHttpException(type, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  const symbol = type.getSymbol?.() ?? type.aliasSymbol;
  if (symbol?.name === 'HttpException' && (symbol.declarations ?? []).some(item => slash(item.getSourceFile().fileName).includes('/node_modules/@nestjs/common/'))) return true;
  return (type.getBaseTypes?.() ?? []).some(base => isNestHttpException(base, seen));
}

function within(relative, root) {
  return root === '.' || relative === root || relative.startsWith(`${root}/`);
}

function readContract(root, bound) {
  const pkgPath = safePath(root, 'package.json', 'source file');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const value = pkg.starci?.codePatterns?.nest?.errorIdentity;
  exact(value, ['schema', 'profile', 'throwRoots', 'families', 'throwAllowances'], 'Nest error identity contract');
  if (value.schema !== CONTRACT_SCHEMA || !['capability', 'academy-abstract-exception'].includes(value.profile)) throw Error(`Declare ${CONTRACT_SCHEMA} with an exact supported profile.`);
  if (!Array.isArray(value.throwRoots) || !value.throwRoots.length || new Set(value.throwRoots).size !== value.throwRoots.length) throw Error('Error identity throwRoots must be a unique non-empty array.');
  const throwRoots = value.throwRoots.map(item => { safePath(root, safeRelative(item, 'source root', true), 'source root'); return item; });
  for (const file of bound) if (!throwRoots.some(item => within(file, item))) throw Error(`Selected production source is outside the complete throw-root inventory: ${file}`);
  for (const item of throwRoots) if (![...bound].some(file => within(file, item))) throw Error(`Declared throw root selects no production source: ${item}`);
  if (!Array.isArray(value.families) || !value.families.length) throw Error('Error identity needs at least one selected family.');
  const ids = new Set(), identities = new Set();
  const families = value.families.map(item => {
    exact(item, ['id', 'path', 'export', 'declarationRoots', 'codeProperty', 'causeProperties', 'academy'], 'Error family');
    if (![item.id, item.export, item.codeProperty].every(name => typeof name === 'string' && IDENTIFIER.test(name)) || ids.has(item.id)) throw Error('Error family identifiers must be unique exact identifiers.');
    ids.add(item.id);
    safeRelative(item.path, 'source file');
    if (!bound.has(item.path)) throw Error(`Selected error family is outside the bound production inventory: ${item.path}`);
    const absolute = safePath(root, item.path, 'source file');
    if (!Array.isArray(item.declarationRoots) || !item.declarationRoots.length || new Set(item.declarationRoots).size !== item.declarationRoots.length) throw Error('Each family needs unique declarationRoots.');
    const declarationRoots = item.declarationRoots.map(value => { safePath(root, safeRelative(value, 'source root', true), 'source root'); return value; });
    if (!declarationRoots.some(value => within(item.path, value))) throw Error(`Family source is outside its declaration roots: ${item.path}`);
    for (const value of declarationRoots) if (![...bound].some(file => within(file, value))) throw Error(`Family declaration root selects no production source: ${value}`);
    if (!Array.isArray(item.causeProperties) || !item.causeProperties.length || new Set(item.causeProperties).size !== item.causeProperties.length
      || item.causeProperties.some(name => typeof name !== 'string' || !IDENTIFIER.test(name))) throw Error('Family causeProperties must be unique exact identifiers.');
    if (value.profile === 'capability') {
      if (item.academy !== undefined) throw Error('Capability families cannot declare Academy constructor policy.');
    } else {
      exact(item.academy, ['classSuffix', 'codeArgument', 'metadataArgument'], 'Academy family policy');
      if (typeof item.academy.classSuffix !== 'string' || !item.academy.classSuffix || !Number.isInteger(item.academy.codeArgument)
        || item.academy.codeArgument < 0 || !Number.isInteger(item.academy.metadataArgument) || item.academy.metadataArgument < 0
        || item.academy.codeArgument === item.academy.metadataArgument) throw Error('Academy policy needs a suffix and distinct zero-based argument indices.');
    }
    const identity = `${item.path}#${item.export}`;
    if (identities.has(identity)) throw Error('Error family source identities must be unique.');
    identities.add(identity);
    return { ...item, absolute, declarationRoots };
  });
  if (value.profile === 'academy-abstract-exception' && families.length !== 1) throw Error('The Academy profile selects exactly one hierarchy base.');
  if (value.throwAllowances !== undefined && !Array.isArray(value.throwAllowances)) throw Error('throwAllowances must be an array when declared.');
  const allowanceIds = new Set();
  const throwAllowances = (value.throwAllowances ?? []).map(item => {
    exact(item, ['path', 'purpose', 'identities'], 'Throw allowance');
    safeRelative(item.path, 'source file');
    if (!bound.has(item.path) || !throwRoots.some(root => within(item.path, root))) throw Error(`Throw allowance path is outside the bound throw inventory: ${item.path}`);
    if (item.purpose !== 'health-probe' || !Array.isArray(item.identities) || !item.identities.length) throw Error('Throw allowances are explicit health-probe identities.');
    const identities = item.identities.map(identity => {
      exact(identity, ['module', 'export'], 'Throw allowance identity');
      if (identity.module !== '@nestjs/common' || typeof identity.export !== 'string' || !IDENTIFIER.test(identity.export)) throw Error('Health-probe allowances select exact @nestjs/common exports.');
      const id = `${item.path}:${identity.module}#${identity.export}`;
      if (allowanceIds.has(id)) throw Error('Throw allowance identities must be unique per source.');
      allowanceIds.add(id); return identity;
    });
    return { ...item, identities };
  });
  return { profile: value.profile, throwRoots, families, throwAllowances };
}

function containsSymbol(ts, checker, input, identity) {
  let found = false;
  const visit = node => { if (symbolAt(ts, checker, node) === identity) found = true; else if (!found) ts.forEachChild(node, visit); };
  visit(input); return found;
}

function assignedBefore(ts, checker, block, identity, before) {
  let assigned = false;
  const visit = node => {
    if (assigned || node.pos >= before) return;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && containsSymbol(ts, checker, node.left, identity)) { assigned = true; return; }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
      && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) && symbolAt(ts, checker, node.operand) === identity) { assigned = true; return; }
    ts.forEachChild(node, visit);
  };
  visit(block); return assigned;
}

function immutableCatchOrigin(ts, checker, input, catchIdentity, block, before, seen = new Set()) {
  const node = unwrap(ts, input);
  if (!node) return false;
  const identity = symbolAt(ts, checker, node);
  if (identity === catchIdentity) return !assignedBefore(ts, checker, block, catchIdentity, before);
  if (!ts.isIdentifier(node) || !identity || seen.has(identity)) return false;
  seen.add(identity);
  const declaration = identity.valueDeclaration;
  if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer
    || !(ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const)
    || assignedBefore(ts, checker, block, identity, before)) return false;
  return immutableCatchOrigin(ts, checker, declaration.initializer, catchIdentity, block, declaration.initializer.pos, seen);
}

function nearestCatch(ts, node) {
  for (let cursor = node.parent; cursor; cursor = cursor.parent) if (ts.isCatchClause(cursor)) return cursor;
  return null;
}

function selectedNewFamily(ts, checker, input, families) {
  const node = unwrap(ts, input);
  if (!ts.isNewExpression(node)) return null;
  const type = checker.getTypeAtLocation(node);
  return families.find(item => item.identity && extendsIdentity(type, item.identity)) ?? null;
}

function selectedThrownFamily(ts, checker, input, families, scope, before, seen = new Set()) {
  const node = unwrap(ts, input);
  const direct = selectedNewFamily(ts, checker, node, families);
  if (direct) return { family: direct, construction: node };
  if (!ts.isIdentifier(node)) return null;
  const identity = symbolAt(ts, checker, node);
  if (!identity || seen.has(identity)) return null;
  seen.add(identity);
  const declaration = identity.valueDeclaration;
  if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer
    || !(ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const)
    || assignedBefore(ts, checker, scope, identity, before)) return null;
  return selectedThrownFamily(ts, checker, declaration.initializer, families, scope, declaration.initializer.pos, seen);
}

function allowedHealthProbeThrow(ts, checker, input, allowance) {
  const node = unwrap(ts, input);
  if (!allowance || !ts.isNewExpression(node)) return false;
  const surface = importedSurface(ts, checker, node.expression);
  if (!surface || !allowance.identities.some(item => item.module === surface.module && item.export === surface.export)) return false;
  const identity = symbolAt(ts, checker, node.expression), type = identity && declaredType(checker, identity);
  return Boolean(identity && (identity.declarations ?? []).some(item => slash(item.getSourceFile().fileName).includes('/node_modules/@nestjs/common/'))
    && identity.name === surface.export && isNestHttpException(type));
}

function exported(ts, node) {
  return Boolean(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export);
}

function directSuperCalls(ts, constructor) {
  const calls = [];
  const visit = node => {
    if (node !== constructor.body && (ts.isFunctionLike(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node))) return;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword) calls.push(node);
    else ts.forEachChild(node, visit);
  };
  visit(constructor.body); return calls;
}

/** Verify selected error-family declarations and every escaping thrown identity in production sources. */
export function checkNestErrorIdentity({ root, files, ruleIds, architectureConfig } = {}) {
  const result = { schema: 'starci/code-pattern-script@1', repository: '', files: [], requestedRuleIds: ruleIds ?? [], checkedRuleIds: [], violations: [], errors: [], compiler: null };
  try {
    root = fs.realpathSync(path.resolve(root)); result.repository = root;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length
      || files.some(file => !SOURCE.test(file) || /\.d\.[cm]?ts$/.test(file))
      || !Array.isArray(ruleIds) || !ruleIds.length || new Set(ruleIds).size !== ruleIds.length
      || ruleIds.some(id => !NEST_ERROR_IDENTITY_RULES.includes(id))) throw Error('Explicit production sources and unique supported Nest error-identity rules are required.');
    const bound = new Set(files);
    for (const file of files) safePath(root, file, 'source file');
    const contract = readContract(root, bound), config = loadArchitectureConfig(root, architectureConfig), context = buildTypeScriptContext(config);
    result.compiler = { version: context.loaded.version, resolved: context.loaded.resolved };
    if (context.errors.length) throw Error(context.errors.map(item => item.message).join('; '));
    const { ts } = context, bindings = new Map();
    for (const relative of [...bound].sort()) bindings.set(relative, projectBinding(context, path.resolve(root, relative)));
    for (const family of contract.families) {
      const binding = bindings.get(family.path), identity = exportedIdentity(ts, binding.checker, binding.source, family.export);
      const declaration = identity?.declarations?.find(item => ts.isClassDeclaration(item));
      if (!identity || !declaration) throw Error(`Selected error family must resolve to an exported class: ${family.path}#${family.export}`);
      const type = declaredType(binding.checker, identity);
      if (!extendsStandardError(binding.program, type)) throw Error(`Selected error family does not extend the standard Error identity: ${family.path}#${family.export}`);
      if (!type?.getProperty(family.codeProperty)) throw Error(`Selected error family has no declared code property: ${family.codeProperty}`);
      family.identity = identity;
    }
    const issueKeys = new Set();
    const add = (source, ruleId, node, message, unavailable = false) => {
      const relative = slash(path.relative(root, source.fileName)), point = source.getLineAndCharacterOfPosition(node.getStart(source));
      const id = `${relative}:${node.pos}:${ruleId}:${message}`;
      if (issueKeys.has(id)) return; issueKeys.add(id);
      (unavailable ? result.errors : result.violations).push({ ruleId, path: relative, line: point.line + 1, column: point.character + 1, message });
    };
    const academyCodes = new Map();
    const usedAllowances = new Set();
    for (const [relative, binding] of bindings) {
      const { source, checker } = binding;
      const localFamilies = contract.families.map(family => ({ ...family, identity: identityInProgram(ts, binding, family) }));
      const visitDeclarations = node => {
        if (ts.isClassDeclaration(node) && node.name) {
          const classIdentity = symbolAt(ts, checker, node.name), classType = classIdentity && declaredType(checker, classIdentity);
          const family = localFamilies.find(item => item.identity && classIdentity !== item.identity && extendsIdentity(classType, item.identity));
          const familyBase = localFamilies.some(item => item.identity && classIdentity === item.identity);
          const academyNamed = contract.profile === 'academy-abstract-exception' && node.name.text.endsWith(contract.families[0].academy.classSuffix);
          if (academyNamed && !family && !familyBase) add(source, 'NEST_ERROR_DECLARATION_IDENTITY', node.name, 'Academy-named error declaration must extend the selected hierarchy base.', false);
          if (family) {
            if (!family.declarationRoots.some(item => within(relative, item))) add(source, 'NEST_ERROR_DECLARATION_IDENTITY', node.name, 'Selected error declaration is outside the declared family roots.', false);
            if (contract.profile === 'academy-abstract-exception') {
              if (!node.name.text.endsWith(family.academy.classSuffix)) add(source, 'NEST_ERROR_DECLARATION_IDENTITY', node.name, `Academy error class must end with ${family.academy.classSuffix}.`, false);
              if (node.members.some(item => item.name?.text === family.codeProperty)) add(source, 'NEST_ERROR_DECLARATION_IDENTITY', node.name, `Academy error class inherits ${family.codeProperty} from the selected base instead of overriding it.`, false);
              const constructors = node.members.filter(item => ts.isConstructorDeclaration(item));
              if (constructors.length !== 1 || !constructors[0].body || constructors[0].parameters.length !== 1) {
                add(source, 'NEST_ERROR_DECLARATION_IDENTITY', node, 'Academy error class has one explicit metadata-object constructor.', false);
              } else {
                const constructor = constructors[0], parameter = constructor.parameters[0];
                const typeNode = parameter.type, metadataSymbol = typeNode && ts.isTypeReferenceNode(typeNode) ? symbolAt(ts, checker, typeNode.typeName) : null;
                const metadataDeclaration = metadataSymbol?.declarations?.find(item => ts.isInterfaceDeclaration(item));
                const expectedName = `${node.name.text}Metadata`;
                if (!ts.isObjectBindingPattern(parameter.name) || !metadataDeclaration || metadataSymbol.name !== expectedName
                  || metadataDeclaration.getSourceFile() !== source || metadataDeclaration.pos > node.pos || !exported(ts, metadataDeclaration)) {
                  add(source, 'NEST_ERROR_DECLARATION_IDENTITY', parameter, `Academy constructor uses an earlier exported ${expectedName} interface and object binding.`, false);
                } else {
                  const metadataType = declaredType(checker, metadataSymbol);
                  for (const cause of family.causeProperties) if (!metadataType?.getProperty(cause)) add(source, 'NEST_ERROR_DECLARATION_IDENTITY', metadataDeclaration, `Academy metadata interface carries declared cause property ${cause}.`, false);
                }
                const supers = directSuperCalls(ts, constructor);
                const code = supers.length === 1 && supers[0].arguments[family.academy.codeArgument];
                const metadata = supers.length === 1 && supers[0].arguments[family.academy.metadataArgument];
                if (supers.length !== 1 || !code || !ts.isStringLiteralLike(unwrap(ts, code)) || !unwrap(ts, code).text
                  || !metadata || !ts.isObjectLiteralExpression(unwrap(ts, metadata))
                  || unwrap(ts, metadata).properties.some(item => ts.isSpreadAssignment(item) || item.name && ts.isComputedPropertyName(item.name))) {
                  add(source, 'NEST_ERROR_DECLARATION_IDENTITY', constructor, 'Academy constructor directly supplies one literal code and one static metadata object to super at the declared zero-based positions.', false);
                } else {
                  const codeValue = unwrap(ts, code).text, previous = academyCodes.get(codeValue);
                  if (previous) {
                    add(source, 'NEST_ERROR_DECLARATION_IDENTITY', code, `Academy error code is duplicated by ${previous}.`, false);
                  } else academyCodes.set(codeValue, `${relative}#${node.name.text}`);
                }
              }
            }
          }
        }
        ts.forEachChild(node, visitDeclarations);
      };
      if (ruleIds.includes('NEST_ERROR_DECLARATION_IDENTITY')) visitDeclarations(source);
      if (ruleIds.includes('NEST_THROWN_ERROR_IDENTITY')) {
        const allowance = contract.throwAllowances.find(item => item.path === relative);
        const visitThrows = node => {
          if (ts.isThrowStatement(node)) {
            if (!node.expression) return add(source, 'NEST_THROWN_ERROR_IDENTITY', node, 'Throw statement has no statically selected error identity.', true);
            const catchNode = nearestCatch(ts, node), catchIdentity = catchNode?.variableDeclaration && symbolAt(ts, checker, catchNode.variableDeclaration.name);
            if (catchIdentity && immutableCatchOrigin(ts, checker, node.expression, catchIdentity, catchNode.block, node.pos)) return;
            if (allowedHealthProbeThrow(ts, checker, node.expression, allowance)) {
              const surface = importedSurface(ts, checker, unwrap(ts, node.expression).expression);
              usedAllowances.add(`${relative}:${surface.module}#${surface.export}`); return;
            }
            const selected = selectedThrownFamily(ts, checker, node.expression, localFamilies, source, node.pos);
            if (!selected) {
              const expression = unwrap(ts, node.expression);
              const dynamic = ts.isCallExpression(expression) || ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)
                || ts.isElementAccessExpression(expression) || ts.isConditionalExpression(expression);
              return add(source, 'NEST_THROWN_ERROR_IDENTITY', expression, dynamic
                ? 'Dynamic thrown value cannot prove a selected error-family identity.'
                : 'Escaping thrown value must use a selected error family or preserve the unchanged caught identity.', dynamic);
            }
            if (contract.profile === 'academy-abstract-exception') {
              const construction = selected.construction;
              if (construction.arguments?.length !== 1 || !ts.isObjectLiteralExpression(unwrap(ts, construction.arguments[0]))) add(source, 'NEST_THROWN_ERROR_IDENTITY', construction, 'Academy error construction takes exactly one object-literal metadata argument.', false);
            }
          }
          ts.forEachChild(node, visitThrows);
        };
        visitThrows(source);
      }
      result.files.push(relative);
    }
    if (ruleIds.includes('NEST_THROWN_ERROR_IDENTITY')) for (const allowance of contract.throwAllowances) {
      const binding = bindings.get(allowance.path);
      for (const identity of allowance.identities) {
        const id = `${allowance.path}:${identity.module}#${identity.export}`;
        if (!usedAllowances.has(id)) add(binding.source, 'NEST_THROWN_ERROR_IDENTITY', binding.source, `Declared health-probe allowance is not matched by an escaping ${identity.module}#${identity.export} construction.`, true);
      }
    }
    if (!result.errors.length) result.checkedRuleIds = [...ruleIds].sort();
  } catch (error) { result.errors.push({ message: String(error.message ?? error) }); }
  return result;
}
