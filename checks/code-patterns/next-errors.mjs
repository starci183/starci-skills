import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig, isInside, slash } from '../architecture/config.mjs';
import { buildTypeScriptContext } from '../architecture/typescript.mjs';

export const NEXT_ERROR_RULES = Object.freeze([
  'FE_ERROR_ENVELOPE_POLICY',
  'FE_WRITE_FEEDBACK_OWNER',
  'FE_NEXT_ERROR_BOUNDARY_LOCATION',
]);

const SOURCE = /\.[cm]?tsx?$/i;
const TEST_SOURCE = /(?:^|\/).*\.(?:spec|test)\.[cm]?tsx?$/i;
const key = file => slash(path.resolve(file));

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${label} must be an object.`);
  const unexpected = Object.keys(value).filter(name => !keys.includes(name));
  if (unexpected.length) throw Error(`${label} has unsupported fields: ${unexpected.join(', ')}.`);
}

function location(source, node) {
  const point = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { line: point.line + 1, column: point.character + 1 };
}

function unwrap(ts, node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
    || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression?.(node))) node = node.expression;
  return node;
}

function symbolOf(ts, checker, node) {
  if (!node) return null;
  let symbol = checker.getSymbolAtLocation(node), guard = 0;
  while (symbol && symbol.flags & ts.SymbolFlags.Alias && guard++ < 20) symbol = checker.getAliasedSymbol(symbol);
  return symbol;
}

function stableCompiler(options) {
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().filter(name => !['configFilePath', 'outDir', 'declarationDir', 'tsBuildInfoFile'].includes(name))
      .map(name => [name, stable(value[name])])) : value;
  return JSON.stringify(stable(options));
}

function exactRelative(value, label) {
  if (typeof value !== 'string' || !value || value === '.' || value.includes('\\') || value !== path.posix.normalize(value)
    || path.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.split('/').includes('..')) throw Error(`${label} must be a normalized repository-relative path.`);
  return value;
}

function regular(root, relative, label) {
  exactRelative(relative, label);
  const absolute = path.resolve(root, relative);
  if (!isInside(root, absolute)) throw Error(`${label} leaves the repository.`);
  for (let current = absolute; current !== root; current = path.dirname(current)) {
    if (!fs.existsSync(current)) throw Error(`${label} does not exist: ${relative}`);
    if (fs.lstatSync(current).isSymbolicLink()) throw Error(`${label} cannot redirect through a link: ${relative}`);
  }
  if (!fs.lstatSync(absolute).isFile()) throw Error(`${label} is not a regular file: ${relative}`);
  return absolute;
}

function array(value, label, { nonempty = true } = {}) {
  if (!Array.isArray(value) || (nonempty && !value.length)) throw Error(`${label} must be ${nonempty ? 'a nonempty' : 'an'} array.`);
  return value;
}

function identity(input, label) {
  exactKeys(input, ['path', 'export'], label);
  const relative = exactRelative(input.path, `${label}.path`);
  if (typeof input.export !== 'string' || !/^(?:default|[A-Za-z_$][\w$]*)$/.test(input.export)) throw Error(`${label}.export must be an exact export name.`);
  return { path: relative, export: input.export };
}

function parseContract(repository, bound) {
  const manifest = regular(repository, 'package.json', 'Next code-pattern manifest');
  const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const contract = parsed?.starci?.codePatterns?.next?.errorState;
  exactKeys(contract, ['sourceRoots', 'transports', 'envelopes', 'writes', 'boundaries'], 'package.json#starci.codePatterns.next.errorState');
  const sourceRoots = array(contract.sourceRoots, 'errorState.sourceRoots').map((root, index) => exactRelative(root, `errorState.sourceRoots[${index}]`));
  if (new Set(sourceRoots).size !== sourceRoots.length || sourceRoots.some((root, index) => sourceRoots.some((other, otherIndex) => index !== otherIndex && (root.startsWith(`${other}/`) || other.startsWith(`${root}/`))))) {
    throw Error('errorState.sourceRoots must be unique and nonoverlapping.');
  }
  const seenIds = new Set();
  const bind = (value, label) => {
    const item = identity(value, label);
    if (!bound.has(item.path)) throw Error(`${label} is outside the exact selected/context file set: ${item.path}`);
    return item;
  };
  const envelopes = array(contract.envelopes ?? [], 'errorState.envelopes', { nonempty: false }).map((entry, index) => {
    const label = `errorState.envelopes[${index}]`;
    exactKeys(entry, ['id', 'type', 'discriminator', 'dataField', 'errorFields', 'readers'], label);
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id ?? '') || seenIds.has(entry.id)) throw Error(`${label}.id must be a unique kebab-case ID.`);
    seenIds.add(entry.id);
    const discriminator = entry.discriminator;
    exactKeys(discriminator, ['field', 'success'], `${label}.discriminator`);
    if (!/^[A-Za-z_$][\w$]*$/.test(discriminator.field ?? '') || discriminator.success !== true) {
      throw Error(`${label}.discriminator declares a boolean field whose true branch is transport success.`);
    }
    if (!/^[A-Za-z_$][\w$]*$/.test(entry.dataField ?? '')) throw Error(`${label}.dataField must be an exact field.`);
    const errorFields = array(entry.errorFields, `${label}.errorFields`).map(field => {
      if (typeof field !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(field)) throw Error(`${label}.errorFields contains an invalid field.`);
      return field;
    });
    if (new Set(errorFields).size !== errorFields.length) throw Error(`${label}.errorFields contains duplicates.`);
    const readers = array(entry.readers, `${label}.readers`).map((reader, readerIndex) => {
      exactKeys(reader, ['path', 'export', 'emptyData'], `${label}.readers[${readerIndex}]`);
      const item = bind({ path: reader.path, export: reader.export }, `${label}.readers[${readerIndex}]`);
      if (!['valid', 'required'].includes(reader.emptyData)) throw Error(`${label}.readers[${readerIndex}].emptyData must be valid or required.`);
      return { ...item, emptyData: reader.emptyData };
    });
    return { id: entry.id, type: bind(entry.type, `${label}.type`), discriminator, dataField: entry.dataField, errorFields, readers };
  });
  const envelopeIds = new Set(envelopes.map(item => item.id));
  const writes = array(contract.writes ?? [], 'errorState.writes', { nonempty: false }).map((entry, index) => {
    const label = `errorState.writes[${index}]`;
    exactKeys(entry, ['action', 'feedback', 'sites'], label);
    const sites = array(entry.sites, `${label}.sites`).map((site, siteIndex) => bind(site, `${label}.sites[${siteIndex}]`));
    const siteKeys = sites.map(site => `${site.path}\0${site.export}`);
    if (new Set(siteKeys).size !== siteKeys.length) throw Error(`${label}.sites contains duplicates.`);
    return { action: bind(entry.action, `${label}.action`), feedback: bind(entry.feedback, `${label}.feedback`), sites };
  });
  const boundaries = array(contract.boundaries ?? [], 'errorState.boundaries', { nonempty: false }).map((entry, index) => {
    const label = `errorState.boundaries[${index}]`;
    exactKeys(entry, ['role', 'routeRoot', 'path', 'recoveryProp'], label);
    if (!['global', 'segment'].includes(entry.role)) throw Error(`${label}.role must be global or segment.`);
    const source = bind({ path: entry.path, export: 'default' }, label);
    const routeRoot = exactRelative(entry.routeRoot, `${label}.routeRoot`);
    if (!source.path.startsWith(`${routeRoot}/`)) throw Error(`${label}.path must be inside its routeRoot.`);
    const expected = entry.role === 'global' ? `${routeRoot}/global-error.tsx` : /(?:^|\/)error\.tsx$/.test(source.path) ? source.path : null;
    if (!expected || source.path !== expected) throw Error(`${label}.path does not match its declared Next boundary role.`);
    if (!['reset', 'unstable_retry'].includes(entry.recoveryProp)) throw Error(`${label}.recoveryProp must name a supported installed Next recovery callback.`);
    return { ...source, role: entry.role, routeRoot, recoveryProp: entry.recoveryProp };
  });
  {
    const transports = array(contract.transports, 'errorState.transports');
    const roots = new Set(), mappedEnvelopes = new Set();
    for (const [index, transport] of transports.entries()) {
      exactKeys(transport, ['root', 'mode', 'envelopeIds'], `errorState.transports[${index}]`);
      const root = exactRelative(transport.root, `errorState.transports[${index}].root`);
      if (roots.has(root) || !sourceRoots.some(sourceRoot => root === sourceRoot || root.startsWith(`${sourceRoot}/`))) throw Error('Each transport root is unique and belongs to a sourceRoot.');
      roots.add(root);
      if (transport.mode === 'envelope') {
        const ids = array(transport.envelopeIds, `errorState.transports[${index}].envelopeIds`);
        if (new Set(ids).size !== ids.length || ids.some(id => !envelopeIds.has(id))) throw Error('Envelope transports name unique declared envelope IDs.');
        for (const id of ids) {
          if (mappedEnvelopes.has(id)) throw Error(`Envelope ${id} is mapped by more than one transport root.`);
          mappedEnvelopes.add(id);
        }
      } else if (transport.mode !== 'throwing' || transport.envelopeIds !== undefined) throw Error('A transport mode is envelope with envelopeIds or throwing without them.');
    }
    if ([...envelopeIds].some(id => !mappedEnvelopes.has(id))) throw Error('Every declared envelope is mapped by one selected transport root.');
  }
  const uniqueBindings = (items, label) => {
    const values = items.map(item => `${item.path}\0${item.export}`);
    if (new Set(values).size !== values.length) throw Error(`${label} contains duplicate source identities.`);
  };
  uniqueBindings(envelopes.map(item => item.type), 'errorState envelope types');
  uniqueBindings(envelopes.flatMap(item => item.readers), 'errorState envelope readers');
  uniqueBindings(writes.map(item => item.action), 'errorState write actions');
  uniqueBindings(boundaries, 'errorState boundaries');
  return { sourceRoots, envelopes, writes, boundaries };
}

function projectFor(context, repository, relative) {
  const absolute = key(path.resolve(repository, relative));
  const owners = context.projects.filter(project => project.program.getRootFileNames().some(file => key(file) === absolute));
  if (!owners.length || new Set(owners.map(project => stableCompiler(project.options))).size !== 1) throw Error(`Source needs one compatible owning TypeScript project: ${relative}`);
  const source = owners[0].program.getSourceFile(path.resolve(repository, relative));
  if (!source || owners[0].program.getSyntacticDiagnostics(source).length) throw Error(`Source is not syntactically valid: ${relative}`);
  return { project: owners[0], source, checker: owners[0].program.getTypeChecker(), ts: context.ts };
}

function exportedSymbol(binding, context, repository) {
  const { source, checker, ts } = projectFor(context, repository, binding.path);
  const module = checker.getSymbolAtLocation(source);
  const exposed = module && checker.getExportsOfModule(module).find(symbol => symbol.name === binding.export);
  if (!exposed) throw Error(`Declared export ${binding.export} is missing from ${binding.path}.`);
  const symbol = symbolOf(ts, checker, exposed.declarations?.[0]?.name ?? exposed.valueDeclaration?.name) ?? exposed;
  return { binding, source, checker, ts, symbol, project: projectFor(context, repository, binding.path).project };
}

function functionNode(ts, item) {
  for (const declaration of item.symbol.declarations ?? []) {
    if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration) || ts.isGetAccessorDeclaration(declaration)) return declaration;
    if (ts.isVariableDeclaration(declaration)) {
      const value = unwrap(ts, declaration.initializer);
      if (value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))) return value;
    }
    if (ts.isExportAssignment(declaration)) {
      const value = unwrap(ts, declaration.expression);
      if (value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))) return value;
      const resolved = symbolOf(ts, item.checker, value);
      if (resolved && resolved !== item.symbol) return functionNode(ts, { ...item, symbol: resolved });
    }
  }
  return null;
}

function propertyAccess(ts, checker, node, owner, field) {
  const value = unwrap(ts, node);
  if (ts.isPropertyAccessExpression(value) && value.name.text === field) return symbolOf(ts, checker, value.expression) === owner;
  if (ts.isElementAccessExpression(value) && ts.isStringLiteralLike(value.argumentExpression) && value.argumentExpression.text === field) return symbolOf(ts, checker, value.expression) === owner;
  return false;
}

function containsThrow(ts, node) {
  let found = false;
  const visit = child => { if (ts.isThrowStatement(child)) found = true; else ts.forEachChild(child, visit); };
  visit(node); return found;
}

function failureCondition(ts, checker, node, owner, field) {
  const value = unwrap(ts, node);
  if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) return propertyAccess(ts, checker, value.operand, owner, field);
  if (!ts.isBinaryExpression(value)) return false;
  const left = propertyAccess(ts, checker, value.left, owner, field), right = propertyAccess(ts, checker, value.right, owner, field);
  const opposite = left ? unwrap(ts, value.right) : right ? unwrap(ts, value.left) : null;
  if (!opposite) return false;
  const literal = opposite.kind === ts.SyntaxKind.FalseKeyword ? false : opposite.kind === ts.SyntaxKind.TrueKeyword ? true : null;
  return (literal === false && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(value.operatorToken.kind))
    || (literal === true && [ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(value.operatorToken.kind));
}

function missingDataCondition(ts, checker, node, owner, field) {
  const value = unwrap(ts, node);
  if (!ts.isBinaryExpression(value)) return false;
  const left = propertyAccess(ts, checker, value.left, owner, field), right = propertyAccess(ts, checker, value.right, owner, field);
  const opposite = left ? unwrap(ts, value.right) : right ? unwrap(ts, value.left) : null;
  if (!opposite || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(value.operatorToken.kind)) return false;
  return opposite.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(opposite) && opposite.text === 'undefined'
    && !(checker.getSymbolAtLocation(opposite)?.declarations?.length));
}

function checkEnvelope(entry, env, result) {
  const typeItem = exportedSymbol(entry.type, env.context, env.repository), { checker, ts } = typeItem;
  const declared = checker.getDeclaredTypeOfSymbol(typeItem.symbol);
  const fields = new Map(checker.getPropertiesOfType(declared).map(symbol => [symbol.name, symbol]));
  const add = (node, message, unavailable = false, source = typeItem.source, relative = entry.type.path) => (unavailable ? result.errors : result.violations)
    .push({ ruleId: 'FE_ERROR_ENVELOPE_POLICY', path: relative, ...location(source, node), message });
  const discriminator = fields.get(entry.discriminator.field), discriminatorType = discriminator && checker.getTypeOfSymbolAtLocation(discriminator, discriminator.valueDeclaration ?? typeItem.source);
  if (!discriminator || !(discriminatorType.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral))) add(typeItem.source, `Envelope ${entry.id} needs boolean discriminator ${entry.discriminator.field}.`);
  if (!fields.has(entry.dataField)) add(typeItem.source, `Envelope ${entry.id} needs data field ${entry.dataField}.`);
  for (const field of entry.errorFields) if (!fields.has(field)) add(typeItem.source, `Envelope ${entry.id} needs declared failure field ${field}.`);
  for (const binding of entry.readers) {
    const reader = exportedSymbol(binding, env.context, env.repository), fn = functionNode(ts, reader);
    if (!fn?.body || !fn.parameters.length) { add(reader.source, 'Envelope reader must be a statically resolved function with an input parameter.', true, reader.source, binding.path); continue; }
    const parameter = fn.parameters[0];
    if (!ts.isIdentifier(parameter.name)) { add(parameter, 'Envelope reader input binding must be a statically resolved identifier.', true, reader.source, binding.path); continue; }
    const owner = symbolOf(ts, reader.checker, parameter.name), inputType = reader.checker.getTypeAtLocation(parameter);
    if (inputType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { add(parameter, `Reader ${binding.export} input type is any/unknown.`, true, reader.source, binding.path); continue; }
    if (!reader.checker.isTypeAssignableTo(inputType, declared) && !reader.checker.isTypeAssignableTo(declared, inputType)) add(parameter, `Reader ${binding.export} input is not the declared ${entry.id} envelope.`, false, reader.source, binding.path);
    let handled = false, sawFailureBranch = false, returned = false, missingHandled = binding.emptyData === 'valid', sawMissingBranch = false;
    const dataExpression = (node, seen = new Set()) => {
      const value = unwrap(ts, node);
      if (!value || seen.has(value)) return false;
      seen.add(value);
      if (propertyAccess(ts, reader.checker, value, owner, entry.dataField)) return true;
      if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return dataExpression(value.left, seen);
      if (ts.isIdentifier(value)) {
        const declaration = symbolOf(ts, reader.checker, value)?.valueDeclaration;
        return Boolean(declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && dataExpression(declaration.initializer, seen));
      }
      return false;
    };
    const visit = node => {
      if (ts.isIfStatement(node)) {
        if (failureCondition(ts, reader.checker, node.expression, owner, entry.discriminator.field)) {
          sawFailureBranch = true; if (containsThrow(ts, node.thenStatement)) handled = true;
        }
        const success = propertyAccess(ts, reader.checker, node.expression, owner, entry.discriminator.field);
        if (success && node.elseStatement) { sawFailureBranch = true; if (containsThrow(ts, node.elseStatement)) handled = true; }
      }
      if (ts.isReturnStatement(node) && node.expression) {
        if (dataExpression(node.expression)) returned = true;
      }
      if (binding.emptyData === 'required' && ts.isIfStatement(node) && missingDataCondition(ts, reader.checker, node.expression, owner, entry.dataField)) {
        sawMissingBranch = true; if (containsThrow(ts, node.thenStatement)) missingHandled = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    if (!handled) add(fn, sawFailureBranch ? `Reader ${binding.export} failure branch uses an unsupported indirect handler.`
      : `Reader ${binding.export} must handle the transport failure discriminator before returning data.`, sawFailureBranch, reader.source, binding.path);
    if (!returned) add(fn, `Reader ${binding.export} must return the declared data field; valid empty data may use ?? null after failure handling.`, false, reader.source, binding.path);
    if (!missingHandled) add(fn, sawMissingBranch ? `Reader ${binding.export} missing-data branch uses an unsupported indirect handler.`
      : `Reader ${binding.export} declares required data and must reject an absent data field.`, sawMissingBranch, reader.source, binding.path);
  }
}

function enclosingFunction(ts, node) {
  for (let current = node; current; current = current.parent) if (ts.isFunctionLike(current)) return current;
  return null;
}

function containsSymbol(ts, checker, node, target) {
  let found = false;
  const visit = child => { if (ts.isIdentifier(child) && symbolOf(ts, checker, child) === target) found = true; else ts.forEachChild(child, visit); };
  visit(node); return found;
}

function containsNode(ts, node, target) {
  let found = node === target;
  const visit = child => { if (child === target) found = true; else if (!found) ts.forEachChild(child, visit); };
  if (!found) ts.forEachChild(node, visit);
  return found;
}

function resultBindingForCall(ts, checker, call) {
  for (let node = call; node; node = node.parent) {
    if (ts.isVariableDeclaration(node) && node.initializer && containsNode(ts, node.initializer, call) && ts.isIdentifier(node.name)) return symbolOf(ts, checker, node.name);
    if (ts.isFunctionLike(node)) break;
  }
  return null;
}

function checkWrite(entry, env, result) {
  const action = exportedSymbol(entry.action, env.context, env.repository), feedback = exportedSymbol(entry.feedback, env.context, env.repository);
  if (!functionNode(action.ts, action) || !functionNode(feedback.ts, feedback)) {
    result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: entry.action.path, line: 1, column: 1,
      message: 'Declared write action and feedback owner must both resolve to callable source functions.' });
    return;
  }
  const sites = entry.sites.map(binding => ({ ...exportedSymbol(binding, env.context, env.repository), fn: null }));
  for (const site of sites) {
    site.fn = functionNode(site.ts, site);
    if (!site.fn?.body) result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: site.binding.path, line: 1, column: 1, message: `Write site ${site.binding.export} is not a statically resolved function.` });
  }
  const siteByFunction = new Map(sites.filter(site => site.fn).map(site => [site.fn, site]));
  const boundFiles = [...env.bound].filter(relative => SOURCE.test(relative) && !TEST_SOURCE.test(relative));
  const seenSites = new Set(), actionCalls = [];
  for (const relative of boundFiles) {
    const { source, checker, ts } = projectFor(env.context, env.repository, relative);
    const visit = node => {
      if (ts.isCallExpression(node)) {
        const called = symbolOf(ts, checker, unwrap(ts, node.expression));
        if (called === action.symbol) {
          actionCalls.push({ node, source, checker, ts, relative, owner: enclosingFunction(ts, node) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const call of actionCalls) {
    const site = siteByFunction.get(call.owner);
    if (!site) {
      result.violations.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: call.relative, ...location(call.source, call.node), message: `Write action ${entry.action.export} is used outside its exact declared feedback sites.` });
      continue;
    }
    seenSites.add(site);
    const resultBinding = resultBindingForCall(call.ts, call.checker, call.node);
    let bound = false;
    const visit = node => {
      if (call.ts.isCallExpression(node) && symbolOf(call.ts, call.checker, unwrap(call.ts, node.expression)) === feedback.symbol
        && (containsNode(call.ts, node, call.node) || (resultBinding && containsSymbol(call.ts, call.checker, node, resultBinding)))) bound = true;
      call.ts.forEachChild(node, visit);
    };
    visit(site.fn.body);
    if (!bound) result.violations.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: site.binding.path, ...location(site.source, site.fn), message: `Write site ${site.binding.export} does not bind ${entry.action.export} to feedback owner ${entry.feedback.export}.` });
  }
  for (const site of sites) if (site.fn && !seenSites.has(site)) result.violations.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: site.binding.path,
    ...location(site.source, site.fn), message: `Declared feedback site ${site.binding.export} does not call write action ${entry.action.export}.` });
  // Passing/re-exporting an action through an unsupported dynamic shape could hide a call from exact-site coverage.
  for (const relative of boundFiles) {
    const { source, checker, ts } = projectFor(env.context, env.repository, relative);
    const visit = node => {
      if (ts.isIdentifier(node) && symbolOf(ts, checker, node) === action.symbol) {
        const parent = node.parent, directCall = ts.isCallExpression(parent) && unwrap(ts, parent.expression) === node;
        const declaration = (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) || action.symbol.declarations?.includes(parent);
        const feedbackArgument = ts.isCallExpression(parent) && symbolOf(ts, checker, unwrap(ts, parent.expression)) === feedback.symbol;
        if (!directCall && !declaration && !feedbackArgument) result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: relative,
          ...location(source, node), message: `Dynamic reference to write action ${entry.action.export} cannot prove exact feedback-site coverage.` });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

function installedNext(repository, ts) {
  const manifest = path.join(repository, 'node_modules', 'next', 'package.json');
  if (!fs.existsSync(manifest) || !fs.statSync(manifest).isFile()) throw Error('Installed Next package is required to validate boundary recovery props.');
  const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (typeof parsed.version !== 'string') throw Error('Installed Next package has no version.');
  const directory = path.dirname(manifest), declarations = [];
  const collect = current => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) collect(target);
      else if (entry.isFile() && /error.*\.d\.ts$/i.test(entry.name)) declarations.push(target);
    }
  };
  collect(path.join(directory, 'dist', 'client', 'components'));
  if (!declarations.length) throw Error('Installed Next error-boundary declarations are unavailable.');
  const recoveryProps = new Set();
  for (const file of declarations) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = node => {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node))
        && (!ts.isInterfaceDeclaration(node) || /ErrorBoundary.*Props|ErrorBoundaryHandlerProps/.test(node.name.text))) {
        for (const member of node.members) {
          const name = member.name && (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) ? member.name.text : null;
          if (['reset', 'unstable_retry'].includes(name)) recoveryProps.add(name);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { version: parsed.version, recoveryProps, declarations: declarations.map(file => slash(path.relative(repository, file))) };
}

function errorType(ts, type, seen = new Set()) {
  if (!type || seen.has(type) || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
  seen.add(type);
  if (type.getSymbol?.()?.name === 'Error') return true;
  return (type.types ?? []).some(part => errorType(ts, part, seen)) || (type.getBaseTypes?.() ?? []).some(base => errorType(ts, base, seen));
}

function checkBoundary(entry, env, result, next) {
  const item = exportedSymbol(entry, env.context, env.repository), { ts, checker, source } = item, fn = functionNode(ts, item);
  const add = (node, message, unavailable = false) => (unavailable ? result.errors : result.violations).push({ ruleId: 'FE_NEXT_ERROR_BOUNDARY_LOCATION',
    path: entry.path, ...location(source, node), message });
  if (!next.recoveryProps.has(entry.recoveryProp)) add(source, `Installed Next ${next.version} declarations do not expose recovery prop ${entry.recoveryProp}.`, true);
  const first = source.statements[0];
  if (!first || !ts.isExpressionStatement(first) || !ts.isStringLiteral(first.expression) || first.expression.text !== 'use client') add(source, 'A declared Next error boundary starts with use client.');
  if (!fn?.body || fn.parameters.length !== 1) return add(source, 'A declared Next error boundary has one statically typed props parameter.', true);
  const parameter = fn.parameters[0], type = checker.getTypeAtLocation(parameter), properties = checker.getPropertiesOfType(type), props = new Set(properties.map(symbol => symbol.name));
  if (!props.has('error') || !props.has(entry.recoveryProp)) add(parameter, `Boundary props expose error and installed recovery callback ${entry.recoveryProp}.`);
  const error = properties.find(symbol => symbol.name === 'error'), recovery = properties.find(symbol => symbol.name === entry.recoveryProp);
  if (error && !errorType(ts, checker.getTypeOfSymbolAtLocation(error, error.valueDeclaration ?? parameter))) add(parameter, 'Boundary error prop resolves to Error (optionally intersected with framework metadata).', true);
  if (recovery && checker.getTypeOfSymbolAtLocation(recovery, recovery.valueDeclaration ?? parameter).getCallSignatures().length === 0) add(parameter, `Boundary recovery prop ${entry.recoveryProp} is callable.`, true);
  const owner = ts.isIdentifier(parameter.name) ? symbolOf(ts, checker, parameter.name) : null;
  const recoveryBinding = ts.isObjectBindingPattern(parameter.name) && parameter.name.elements.find(element => {
    const exposed = element.propertyName ?? element.name;
    return ts.isIdentifier(exposed) && exposed.text === entry.recoveryProp && ts.isIdentifier(element.name);
  });
  const recoverySymbol = recoveryBinding && symbolOf(ts, checker, recoveryBinding.name);
  let recoveryCall = false, html = false, body = false;
  const recoveryUse = node => {
    const parent = node.parent;
    if (ts.isCallExpression(parent) && unwrap(ts, parent.expression) === node) return true;
    for (let current = parent; current && current !== fn.body; current = current.parent) {
      if (ts.isJsxAttribute(current) && /^on[A-Z]/.test(current.name.getText(source))) return true;
      if (ts.isStatement(current) || ts.isFunctionLike(current)) break;
    }
    return false;
  };
  const visit = node => {
    if (ts.isCallExpression(node) && ((owner && propertyAccess(ts, checker, node.expression, owner, entry.recoveryProp))
      || (recoverySymbol && symbolOf(ts, checker, unwrap(ts, node.expression)) === recoverySymbol))) recoveryCall = true;
    if (owner && propertyAccess(ts, checker, node, owner, entry.recoveryProp) && recoveryUse(node)) recoveryCall = true;
    if (recoverySymbol && ts.isIdentifier(node) && symbolOf(ts, checker, node) === recoverySymbol
      && node !== recoveryBinding?.name && recoveryUse(node)) recoveryCall = true;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source); if (tag === 'html') html = true; if (tag === 'body') body = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  if (!recoveryCall) add(fn, `Boundary must expose a reachable ${entry.recoveryProp} recovery action.`);
  if (entry.role === 'global' && (!html || !body)) add(fn, 'A global Next error boundary renders its required html and body shell.');
}

/** Check explicitly selected Next error-state contracts without running application code. */
export function checkNextErrors({ root, files, ruleIds, contextFiles = [], architectureConfig } = {}) {
  const result = { schema: 'starci/code-pattern-script@1', repository: '', files: [], requestedRuleIds: ruleIds ?? [], checkedRuleIds: [], violations: [], errors: [], compiler: null };
  try {
    const repository = fs.realpathSync(path.resolve(root)); result.repository = repository;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length || files.some(file => !SOURCE.test(file))) throw Error('Exact unique selected Next source files are required.');
    if (!Array.isArray(contextFiles) || new Set(contextFiles).size !== contextFiles.length || contextFiles.some(file => !SOURCE.test(file))) throw Error('Exact unique Next context source files are required.');
    if (!Array.isArray(ruleIds) || !ruleIds.length || new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEXT_ERROR_RULES.includes(id))) throw Error('Unique supported Next error-state rule IDs are required.');
    const bound = new Set([...files, ...contextFiles]);
    if (bound.size !== files.length + contextFiles.length) throw Error('Selected and context files cannot overlap.');
    for (const relative of bound) regular(repository, relative, 'Next error-state source');
    const contract = parseContract(repository, bound), config = loadArchitectureConfig(repository, architectureConfig), context = buildTypeScriptContext(config);
    if (context.errors.length) throw Error(context.errors.map(error => error.message).join('; '));
    result.compiler = { version: context.loaded.version, resolved: context.loaded.resolved, architectureConfig: exactRelative(architectureConfig, 'architectureConfig') };
    const covered = new Set();
    for (const project of context.projects) for (const file of project.program.getRootFileNames()) {
      const relative = slash(path.relative(repository, file));
      if (SOURCE.test(relative) && contract.sourceRoots.some(root => relative === root || relative.startsWith(`${root}/`))) covered.add(relative);
    }
    const missing = [...covered].filter(relative => !bound.has(relative));
    if (missing.length) throw Error(`errorState.sourceRoots coverage is incomplete; bind every owning-program source (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ', …' : ''}).`);
    const env = { repository, bound, contract, context };
    if (ruleIds.includes('FE_ERROR_ENVELOPE_POLICY')) {
      if (!contract.envelopes.length) throw Error('FE_ERROR_ENVELOPE_POLICY needs at least one selected envelope contract.');
      for (const entry of contract.envelopes) checkEnvelope(entry, env, result);
    }
    if (ruleIds.includes('FE_WRITE_FEEDBACK_OWNER')) {
      if (!contract.writes.length) throw Error('FE_WRITE_FEEDBACK_OWNER needs at least one selected write contract.');
      for (const entry of contract.writes) checkWrite(entry, env, result);
    }
    if (ruleIds.includes('FE_NEXT_ERROR_BOUNDARY_LOCATION')) {
      if (!contract.boundaries.length) throw Error('FE_NEXT_ERROR_BOUNDARY_LOCATION needs at least one selected boundary contract.');
      const next = installedNext(repository, context.ts);
      for (const entry of contract.boundaries) checkBoundary(entry, env, result, next);
      result.compiler.next = { ...next, recoveryProps: [...next.recoveryProps].sort() };
    }
    result.files = [...files].sort();
    if (!result.errors.length) result.checkedRuleIds = [...ruleIds].sort();
  } catch (error) {
    result.errors.push({ ruleId: null, path: null, line: null, column: null, message: error instanceof Error ? error.message : String(error) });
  }
  result.violations.sort((a, b) => `${a.path}:${a.line}:${a.column}:${a.ruleId}`.localeCompare(`${b.path}:${b.line}:${b.column}:${b.ruleId}`));
  result.errors.sort((a, b) => `${a.path}:${a.line}:${a.column}:${a.ruleId}`.localeCompare(`${b.path}:${b.line}:${b.column}:${b.ruleId}`));
  return result;
}
