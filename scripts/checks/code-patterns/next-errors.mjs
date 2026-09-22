import fs from 'node:fs';
import path from 'node:path';
import { loadArchitectureConfig, isInside, slash } from '../architecture/config.mjs';
import { buildTypeScriptContext } from '../architecture/typescript.mjs';

export const NEXT_ERROR_RULES = Object.freeze([
  'FE_ERROR_WORLD_STATE_MAPPING',
  'FE_ERROR_ENVELOPE_POLICY',
  'FE_WRITE_FEEDBACK_OWNER',
  'FE_NEXT_ERROR_BOUNDARY_LOCATION',
  'FE_REQUIRED_VALUE_FAILURE',
]);

const SOURCE = /\.[cm]?tsx?$/i;
const TEST_SOURCE = /(?:^|\/).*\.(?:spec|test)\.[cm]?tsx?$/i;
const DECLARATION_SOURCE = /\.d\.[cm]?tsx?$/i;
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

function symbolIdentity(symbol) {
  const declarations = symbol?.declarations ?? symbol?.getDeclarations?.() ?? [];
  if (!declarations.length) return null;
  return declarations.map(declaration => `${key(declaration.getSourceFile().fileName)}:${declaration.pos}:${declaration.end}:${declaration.kind}`).sort().join('|');
}

function sameSymbol(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftIdentity = symbolIdentity(left), rightIdentity = symbolIdentity(right);
  return Boolean(leftIdentity && rightIdentity && leftIdentity === rightIdentity);
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

function readContract(repository) {
  const manifest = regular(repository, 'package.json', 'Next code-pattern manifest');
  const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const contract = parsed?.starci?.codePatterns?.next?.errorState;
  exactKeys(contract, ['schema', 'sourceRoots', 'transports', 'worldMappings', 'envelopes', 'writes', 'boundaries', 'requiredValues'], 'package.json#starci.codePatterns.next.errorState');
  if (contract.schema !== 'starci/next-error-state@1') throw Error('errorState.schema must be starci/next-error-state@1.');
  const sourceRoots = array(contract.sourceRoots, 'errorState.sourceRoots').map((root, index) => exactRelative(root, `errorState.sourceRoots[${index}]`));
  if (new Set(sourceRoots).size !== sourceRoots.length || sourceRoots.some((root, index) => sourceRoots.some((other, otherIndex) => index !== otherIndex && (root.startsWith(`${other}/`) || other.startsWith(`${root}/`))))) {
    throw Error('errorState.sourceRoots must be unique and nonoverlapping.');
  }
  return { contract, sourceRoots };
}

function parseContract(repository, bound, document = readContract(repository)) {
  const { contract, sourceRoots } = document;
  const seenIds = new Set();
  const bind = (value, label) => {
    const item = identity(value, label);
    if (!bound.has(item.path)) throw Error(`${label} is outside the exact selected/context file set: ${item.path}`);
    return item;
  };
  const worldMappings = array(contract.worldMappings ?? [], 'errorState.worldMappings', { nonempty: false }).map((entry, index) => {
    const label = `errorState.worldMappings[${index}]`;
    exactKeys(entry, ['id', 'owner', 'source', 'failurePath', 'state', 'failureState', 'render'], label);
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id ?? '')) throw Error(`${label}.id must be kebab-case.`);
    if (typeof entry.failurePath !== 'string' || !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(entry.failurePath)) throw Error(`${label}.failurePath must be a static binding path.`);
    if (typeof entry.failureState !== 'string' || !entry.failureState) throw Error(`${label}.failureState must be a nonempty literal member.`);
    exactKeys(entry.state, ['path', 'export'], `${label}.state`);
    exactKeys(entry.render, ['path', 'symbol', 'stateProp'], `${label}.render`);
    if (typeof entry.render.symbol !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(entry.render.symbol)
      || typeof entry.render.stateProp !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(entry.render.stateProp)) throw Error(`${label}.render needs exact symbol and stateProp names.`);
    if (!bound.has(entry.render.path)) throw Error(`${label}.render is outside the exact selected/context file set: ${entry.render.path}`);
    return { id: entry.id, owner: bind(entry.owner, `${label}.owner`), source: bind(entry.source, `${label}.source`), failurePath: entry.failurePath,
      state: bind(entry.state, `${label}.state`), failureState: entry.failureState,
      render: { path: exactRelative(entry.render.path, `${label}.render.path`), symbol: entry.render.symbol, stateProp: entry.render.stateProp } };
  });
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
    exactKeys(entry, ['action', 'feedback', 'binding', 'sites'], label);
    if (!['promise', 'callback'].includes(entry.binding)) throw Error(`${label}.binding must be promise or callback.`);
    const sites = array(entry.sites, `${label}.sites`).map((site, siteIndex) => bind(site, `${label}.sites[${siteIndex}]`));
    const siteKeys = sites.map(site => `${site.path}\0${site.export}`);
    if (new Set(siteKeys).size !== siteKeys.length) throw Error(`${label}.sites contains duplicates.`);
    return { action: bind(entry.action, `${label}.action`), feedback: bind(entry.feedback, `${label}.feedback`), binding: entry.binding, sites };
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
  const requiredValues = array(contract.requiredValues ?? [], 'errorState.requiredValues', { nonempty: false }).map((entry, index) => {
    const label = `errorState.requiredValues[${index}]`;
    exactKeys(entry, ['id', 'owner', 'binding', 'absence'], label);
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id ?? '')) throw Error(`${label}.id must be kebab-case.`);
    if (typeof entry.binding !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(entry.binding)) throw Error(`${label}.binding must be an exact identifier.`);
    if (!['undefined', 'null', 'nullish'].includes(entry.absence)) throw Error(`${label}.absence must be undefined, null or nullish.`);
    return { id: entry.id, owner: bind(entry.owner, `${label}.owner`), binding: entry.binding, absence: entry.absence };
  });
  // A transport-free app declares no roots; architecture frontend.transport roots stay inventoried regardless.
  const transports = array(contract.transports, 'errorState.transports', { nonempty: false }).map((transport, index) => {
    const label = `errorState.transports[${index}]`;
    exactKeys(transport, ['root', 'mode', 'envelopeIds'], label);
    const root = exactRelative(transport.root, `${label}.root`);
    if (!sourceRoots.some(sourceRoot => root === sourceRoot || root.startsWith(`${sourceRoot}/`))) throw Error('Each transport root belongs to a sourceRoot.');
    if (transport.mode === 'envelope') {
      const ids = array(transport.envelopeIds, `${label}.envelopeIds`);
      if (new Set(ids).size !== ids.length || ids.some(id => !envelopeIds.has(id))) throw Error('Envelope transports name unique declared envelope IDs.');
      return { root, mode: transport.mode, envelopeIds: ids };
    }
    if (transport.mode !== 'throwing' || transport.envelopeIds !== undefined) throw Error('A transport mode is envelope with envelopeIds or throwing without them.');
    return { root, mode: transport.mode };
  });
  {
    const roots = new Set(), mappedEnvelopes = new Set();
    for (const transport of transports) {
      if (roots.has(transport.root)) throw Error('Each transport root is unique and belongs to a sourceRoot.');
      roots.add(transport.root);
      if (transport.mode === 'envelope') {
        for (const id of transport.envelopeIds) {
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
  if (new Set(requiredValues.map(item => item.id)).size !== requiredValues.length) throw Error('errorState.requiredValues IDs must be unique.');
  const requiredKeys = requiredValues.map(item => `${item.owner.path}\0${item.owner.export}\0${item.binding}`);
  if (new Set(requiredKeys).size !== requiredKeys.length) throw Error('errorState.requiredValues contains a duplicate owner binding.');
  if (new Set(worldMappings.map(item => item.id)).size !== worldMappings.length) throw Error('errorState.worldMappings IDs must be unique.');
  const worldKeys = worldMappings.map(item => `${item.owner.path}\0${item.owner.export}\0${item.source.path}\0${item.source.export}\0${item.failurePath}`);
  if (new Set(worldKeys).size !== worldKeys.length) throw Error('errorState.worldMappings contains a duplicate owner/source/failure path.');
  return { sourceRoots, transports, worldMappings, envelopes, writes, boundaries, requiredValues };
}

function projectFor(context, repository, relative) {
  const absolute = key(path.resolve(repository, relative));
  const sourceFor = project => project.program.getSourceFiles().find(file => key(file.fileName) === absolute);
  const owners = context.projects.filter(project => sourceFor(project));
  if (!owners.length || new Set(owners.map(project => stableCompiler(project.options))).size !== 1) throw Error(`Source needs one compatible owning TypeScript project: ${relative}`);
  const source = sourceFor(owners[0]);
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

function namedSourceSymbol(relative, name, env) {
  const item = projectFor(env.context, env.repository, relative), { ts, checker, source } = item;
  const module = checker.getSymbolAtLocation(source);
  const exposed = module && checker.getExportsOfModule(module).find(symbol => symbol.name === name);
  if (exposed) {
    const symbol = symbolOf(ts, checker, exposed.declarations?.[0]?.name ?? exposed.valueDeclaration?.name) ?? exposed;
    if ((symbol.declarations ?? []).some(declaration => key(declaration.getSourceFile().fileName) === key(source.fileName))) return { ...item, symbol };
  }
  const found = [];
  for (const statement of source.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name) found.push(symbolOf(ts, checker, statement.name));
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) found.push(symbolOf(ts, checker, declaration.name));
    }
  }
  const symbols = [...new Set(found.filter(Boolean))];
  if (symbols.length !== 1) throw Error(`Declared source symbol ${name} is not unique in ${relative}.`);
  return { ...item, symbol: symbols[0] };
}

function stringMembers(ts, type, seen = new Set()) {
  if (!type || seen.has(type)) return null;
  seen.add(type);
  if (type.flags & ts.TypeFlags.StringLiteral) return new Set([type.value]);
  if (!(type.flags & ts.TypeFlags.Union) || !type.types?.length) return null;
  const result = new Set();
  for (const part of type.types) {
    const members = stringMembers(ts, part, seen);
    if (!members) return null;
    for (const member of members) result.add(member);
  }
  return result;
}

function callResultBindings(ts, checker, call) {
  for (let node = call; node && !ts.isFunctionLike(node.parent); node = node.parent) {
    if (!ts.isVariableDeclaration(node) || !node.initializer || !containsNode(ts, node.initializer, call)) continue;
    if (ts.isIdentifier(node.name)) return new Map([[node.name.text, symbolOf(ts, checker, node.name)]]);
    if (ts.isObjectBindingPattern(node.name)) {
      const result = new Map();
      for (const element of node.name.elements) if (ts.isIdentifier(element.name) && !element.dotDotDotToken) result.set(element.name.text, symbolOf(ts, checker, element.name));
      return result;
    }
    return new Map();
  }
  return new Map();
}

function accessIdentity(ts, checker, node) {
  const parts = [];
  let value = unwrap(ts, node);
  while (ts.isPropertyAccessExpression(value) || (ts.isElementAccessExpression(value) && ts.isStringLiteralLike(value.argumentExpression))) {
    parts.unshift(ts.isPropertyAccessExpression(value) ? value.name.text : value.argumentExpression.text);
    value = unwrap(ts, value.expression);
  }
  return ts.isIdentifier(value) ? { symbol: symbolOf(ts, checker, value), parts } : null;
}

function referencesFailure(ts, checker, node, base, fields) {
  let found = false;
  const visit = child => {
    const access = accessIdentity(ts, checker, child);
    if (access?.symbol === base && access.parts.length >= fields.length && fields.every((field, index) => access.parts[index] === field)) found = true;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node); return found;
}

function failurePolarity(ts, checker, node, base, fields) {
  const value = unwrap(ts, node);
  if (referencesFailure(ts, checker, value, base, fields)
    && (ts.isIdentifier(value) || ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value))) return true;
  if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
    const nested = failurePolarity(ts, checker, value.operand, base, fields); return nested === null ? null : !nested;
  }
  if (ts.isCallExpression(value) && ts.isIdentifier(value.expression) && value.expression.text === 'Boolean' && value.arguments.length === 1
    && !checker.getSymbolAtLocation(value.expression)?.declarations?.some(declaration => !declaration.getSourceFile().hasNoDefaultLib)) {
    return referencesFailure(ts, checker, value.arguments[0], base, fields) ? true : null;
  }
  if (ts.isBinaryExpression(value)) {
    const left = referencesFailure(ts, checker, value.left, base, fields), right = referencesFailure(ts, checker, value.right, base, fields);
    const other = left ? unwrap(ts, value.right) : right ? unwrap(ts, value.left) : null;
    const absent = other && (other.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(other) && other.text === 'undefined'
      && !(checker.getSymbolAtLocation(other)?.declarations?.length)));
    if (!absent) return null;
    if ([ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(value.operatorToken.kind)) return true;
    if ([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(value.operatorToken.kind)) return false;
  }
  return null;
}

function literalState(ts, node, expected) {
  const value = unwrap(ts, node);
  return (ts.isStringLiteralLike(value) && value.text === expected)
    || (ts.isAsExpression(node) && ts.isStringLiteralLike(node.expression) && node.expression.text === expected);
}

function staticBoolean(ts, node) {
  const value = unwrap(ts, node);
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (value.kind === ts.SyntaxKind.NullKeyword) return false;
  if (ts.isNumericLiteral(value)) return Number(value.text) !== 0 && !Number.isNaN(Number(value.text));
  if (ts.isBigIntLiteral(value)) return value.text !== '0n';
  if (ts.isStringLiteralLike(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text.length > 0;
  if (ts.isVoidExpression(value)) return false;
  if (ts.isPrefixUnaryExpression(value) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(value.operator)
    && ts.isNumericLiteral(unwrap(ts, value.operand))) {
    const numeric = Number(unwrap(ts, value.operand).text) * (value.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
    return numeric !== 0 && !Number.isNaN(numeric);
  }
  if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
    const nested = staticBoolean(ts, value.operand);
    return nested === null ? null : !nested;
  }
  return null;
}

function statementTerminates(ts, statement) {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  if (ts.isBlock(statement)) return Boolean(statement.statements.length && statementTerminates(ts, statement.statements.at(-1)));
  if (ts.isIfStatement(statement)) {
    const selected = staticBoolean(ts, statement.expression);
    if (selected === true) return statementTerminates(ts, statement.thenStatement);
    if (selected === false) return Boolean(statement.elseStatement && statementTerminates(ts, statement.elseStatement));
    return Boolean(statement.elseStatement && statementTerminates(ts, statement.thenStatement) && statementTerminates(ts, statement.elseStatement));
  }
  return false;
}

function staticallyUnreachable(ts, node, stop) {
  for (let current = node; current?.parent && current !== stop; current = current.parent) {
    const parent = current.parent;
    if (ts.isBlock(parent)) {
      const containing = parent.statements.find(statement => statement.pos <= current.pos && current.end <= statement.end);
      const index = containing ? parent.statements.indexOf(containing) : -1;
      if (index > 0 && parent.statements.slice(0, index).some(statement => statementTerminates(ts, statement))) return true;
    }
    if (ts.isIfStatement(parent)) {
      const value = staticBoolean(ts, parent.expression);
      if (value === false && parent.thenStatement.pos <= node.pos && node.end <= parent.thenStatement.end) return true;
      if (value === true && parent.elseStatement && parent.elseStatement.pos <= node.pos && node.end <= parent.elseStatement.end) return true;
    }
    if (ts.isConditionalExpression(parent)) {
      const value = staticBoolean(ts, parent.condition);
      if (value === false && parent.whenTrue.pos <= node.pos && node.end <= parent.whenTrue.end) return true;
      if (value === true && parent.whenFalse.pos <= node.pos && node.end <= parent.whenFalse.end) return true;
    }
    if (ts.isWhileStatement(parent) && staticBoolean(ts, parent.expression) === false
      && parent.statement.pos <= node.pos && node.end <= parent.statement.end) return true;
    if (ts.isForStatement(parent) && parent.condition && staticBoolean(ts, parent.condition) === false
      && parent.statement.pos <= node.pos && node.end <= parent.statement.end) return true;
    if (ts.isBinaryExpression(parent) && parent.right.pos <= node.pos && node.end <= parent.right.end) {
      const left = staticBoolean(ts, parent.left);
      if (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && left === false) return true;
      if (parent.operatorToken.kind === ts.SyntaxKind.BarBarToken && left === true) return true;
    }
  }
  return false;
}

function isConstVariable(ts, declaration) {
  return ts.isVariableDeclaration(declaration) && Boolean(ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const);
}

function renderConsumesState(ts, checker, render, prop) {
  const fn = functionNode(ts, render);
  if (!fn?.body || !fn.parameters.length) return false;
  const parameter = fn.parameters[0];
  let owner = null, local = null;
  if (ts.isIdentifier(parameter.name)) owner = symbolOf(ts, checker, parameter.name);
  if (ts.isObjectBindingPattern(parameter.name)) {
    const element = parameter.name.elements.find(item => {
      const exposed = item.propertyName ?? item.name;
      return ts.isIdentifier(exposed) && exposed.text === prop && ts.isIdentifier(item.name);
    });
    if (element) local = symbolOf(ts, checker, element.name);
  }
  let used = false;
  const visit = node => {
    if (node !== fn.body && ts.isFunctionLike(node)) return;
    if (owner && propertyAccess(ts, checker, node, owner, prop)) used = true;
    if (local && ts.isIdentifier(node) && symbolOf(ts, checker, node) === local
      && !(ts.isBindingElement(node.parent) && node.parent.name === node)) used = true;
    if (!used) ts.forEachChild(node, visit);
  };
  visit(fn.body); return used;
}

function renderStateType(ts, checker, render, prop) {
  const fn = functionNode(ts, render);
  if (!fn?.parameters.length) return null;
  const parameterType = checker.getTypeAtLocation(fn.parameters[0]);
  const property = checker.getPropertiesOfType(parameterType).find(symbol => symbol.name === prop);
  return property ? checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration ?? fn.parameters[0]) : null;
}

function checkWorldMapping(entry, env, result) {
  const owner = exportedSymbol(entry.owner, env.context, env.repository), sourceOwner = exportedSymbol(entry.source, env.context, env.repository);
  const stateOwner = exportedSymbol(entry.state, env.context, env.repository), render = namedSourceSymbol(entry.render.path, entry.render.symbol, env);
  const { ts, checker } = owner, fn = functionNode(ts, owner), renderFn = functionNode(render.ts, render);
  const add = (node, message, unavailable = false, relative = entry.owner.path, source = owner.source) => (unavailable ? result.errors : result.violations)
    .push({ ruleId: 'FE_ERROR_WORLD_STATE_MAPPING', path: relative, ...location(source, node), message });
  if (!fn?.body || !renderFn?.body) return add(owner.source, `World owner ${entry.owner.export} and render symbol ${entry.render.symbol} must resolve to source functions.`, true);
  const members = stringMembers(stateOwner.ts, stateOwner.checker.getDeclaredTypeOfSymbol(stateOwner.symbol));
  if (!members) add(stateOwner.source, `State ${entry.state.export} must resolve to a closed string-literal union.`, true, entry.state.path, stateOwner.source);
  else if (!members.has(entry.failureState)) add(stateOwner.source, `Failure state ${entry.failureState} is not a member of ${entry.state.export}.`, false, entry.state.path, stateOwner.source);
  if (!renderConsumesState(render.ts, render.checker, render, entry.render.stateProp)) add(render.source, `Render symbol ${entry.render.symbol} does not consume state prop ${entry.render.stateProp}.`, false, entry.render.path, render.source);
  const renderType = renderStateType(render.ts, render.checker, render, entry.render.stateProp);
  const renderAlias = renderType?.aliasSymbol ?? renderType?.getSymbol?.();
  if (!renderType || !sameSymbol(renderAlias, stateOwner.symbol)) add(render.source,
    `Render state prop ${entry.render.stateProp} does not resolve to declared state contract ${entry.state.export}.`, true, entry.render.path, render.source);
  const calls = [];
  let unsupportedSource = false;
  const collect = node => {
    if (node !== fn.body && ts.isFunctionLike(node)) {
      if (containsSymbol(ts, checker, node, sourceOwner.symbol)) unsupportedSource = true;
      return;
    }
    if (ts.isCallExpression(node) && sameSymbol(symbolOf(ts, checker, unwrap(ts, node.expression)), sourceOwner.symbol)) calls.push(node);
    ts.forEachChild(node, collect);
  };
  collect(fn.body);
  if (calls.length !== 1) return add(fn, unsupportedSource ? `World source ${entry.source.export} appears only in unsupported indirect control flow.`
    : `World mapping ${entry.id} must resolve exactly one call to ${entry.source.export} inside ${entry.owner.export}.`, unsupportedSource || calls.length > 1);
  if (staticallyUnreachable(ts, calls[0], fn.body)) return add(calls[0], `World source ${entry.source.export} is called only in statically unreachable control flow.`, true);
  const bindings = callResultBindings(ts, checker, calls[0]), [baseName, ...fields] = entry.failurePath.split('.'), base = bindings.get(baseName);
  if (!base) return add(calls[0], `failurePath ${entry.failurePath} does not start at the declared source call result.`, true);
  const mappedStates = new Map();
  let unstableState = false;
  const recordState = node => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    const value = unwrap(ts, node.initializer);
    if (!ts.isConditionalExpression(value)) return;
    const polarity = failurePolarity(ts, checker, value.condition, base, fields);
    if (polarity === true && literalState(ts, value.whenTrue, entry.failureState)
      || polarity === false && literalState(ts, value.whenFalse, entry.failureState)) {
      if (isConstVariable(ts, node)) mappedStates.set(symbolOf(ts, checker, node.name), true);
      else unstableState = true;
    }
  };
  const stateValueProof = node => {
    const value = unwrap(ts, node);
    if (literalState(ts, value, entry.failureState)) return 'literal';
    if (ts.isIdentifier(value) && mappedStates.has(symbolOf(ts, checker, value))) return 'mapped';
    if (ts.isConditionalExpression(value)) {
      const polarity = failurePolarity(ts, checker, value.condition, base, fields);
      return polarity === true && literalState(ts, value.whenTrue, entry.failureState)
        || polarity === false && literalState(ts, value.whenFalse, entry.failureState) ? 'conditional' : null;
    }
    return null;
  };
  const renderedState = node => {
    if (!(ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) || !sameSymbol(symbolOf(ts, checker, node.tagName), render.symbol)) return null;
    const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(owner.source) === entry.render.stateProp);
    if (!attribute?.initializer) return null;
    if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text === entry.failureState ? 'literal' : null;
    return ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression ? stateValueProof(attribute.initializer.expression) : null;
  };
  const insideFailureBranch = node => {
    for (let current = node; current && current !== fn.body; current = current.parent) if (ts.isIfStatement(current)) {
      const polarity = failurePolarity(ts, checker, current.expression, base, fields);
      if (polarity === true && current.thenStatement.pos <= node.pos && node.end <= current.thenStatement.end) return true;
      if (polarity === false && current.elseStatement && current.elseStatement.pos <= node.pos && node.end <= current.elseStatement.end) return true;
    }
    return false;
  };
  let proven = false, sawRender = false, unsupportedRender = false, unprovenRender = false;
  const inspect = node => {
    if (node !== fn.body && ts.isFunctionLike(node)) {
      if (containsSymbol(ts, checker, node, render.symbol) || referencesFailure(ts, checker, node, base, fields)) unsupportedRender = true;
      return;
    }
    recordState(node);
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && sameSymbol(symbolOf(ts, checker, node.tagName), render.symbol)) {
      if (staticallyUnreachable(ts, node, fn.body)) { unsupportedRender = true; return; }
      sawRender = true;
      const proof = renderedState(node);
      if (proof === 'mapped' || proof === 'conditional' || proof === 'literal' && insideFailureBranch(node)) proven = true;
      else unprovenRender = true;
    }
    ts.forEachChild(node, inspect);
  };
  inspect(fn.body);
  if (unstableState) add(fn, `World mapping ${entry.id} stores failure-state provenance in a mutable binding.`, true);
  if (!sawRender) add(fn, unsupportedRender ? `World render mapping appears only in unsupported indirect control flow.`
    : `World owner ${entry.owner.export} does not render declared symbol ${entry.render.symbol}.`, unsupportedRender);
  else if (!proven || unprovenRender) add(fn, `Every reachable ${entry.render.symbol} render in ${entry.owner.export} must map ${entry.failurePath} to ${entry.failureState} on prop ${entry.render.stateProp}.`);
}

function checkWorldCoverage(entries, env, result) {
  const rows = entries.map(entry => ({ entry, source: exportedSymbol(entry.source, env.context, env.repository), owner: exportedSymbol(entry.owner, env.context, env.repository) }));
  for (const relative of [...env.bound].filter(file => SOURCE.test(file) && !TEST_SOURCE.test(file))) {
    const { source, checker, ts } = projectFor(env.context, env.repository, relative);
    const visit = node => {
      if (ts.isCallExpression(node)) {
        const called = symbolOf(ts, checker, unwrap(ts, node.expression)), matches = rows.filter(row => sameSymbol(called, row.source.symbol));
        if (matches.length) {
          const owner = enclosingFunction(ts, node);
          if (!matches.some(row => sameSymbol(functionSymbol(ts, checker, owner), row.owner.symbol))) result.violations.push({ ruleId: 'FE_ERROR_WORLD_STATE_MAPPING', path: relative,
            ...location(source, node), message: `World source ${matches[0].entry.source.export} is called outside every declared state-mapping owner.` });
        }
      }
      if (ts.isIdentifier(node)) for (const row of rows) if (sameSymbol(symbolOf(ts, checker, node), row.source.symbol)) {
        const parent = node.parent, directCall = ts.isCallExpression(parent) && unwrap(ts, parent.expression) === node;
        const declaration = ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || row.source.symbol.declarations?.includes(parent);
        if (!directCall && !declaration) result.errors.push({ ruleId: 'FE_ERROR_WORLD_STATE_MAPPING', path: relative, ...location(source, node),
          message: `Dynamic reference to world source ${row.entry.source.export} cannot prove an exact owner/state call path.` });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

function propertyAccess(ts, checker, node, owner, field) {
  const value = unwrap(ts, node);
  if (ts.isPropertyAccessExpression(value) && value.name.text === field) return symbolOf(ts, checker, value.expression) === owner;
  if (ts.isElementAccessExpression(value) && ts.isStringLiteralLike(value.argumentExpression) && value.argumentExpression.text === field) return symbolOf(ts, checker, value.expression) === owner;
  return false;
}

function containsThrow(ts, node) {
  let found = false;
  const visit = child => {
    if (ts.isThrowStatement(child) && !staticallyUnreachable(ts, child, node)) found = true;
    else if (child !== node && ts.isFunctionLike(child)) return;
    else ts.forEachChild(child, visit);
  };
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

function typeUsesContractIdentity(ts, checker, type, node, target, seen = new Set()) {
    if (!type || seen.has(type) || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
    seen.add(type);
    const symbol = type.aliasSymbol ?? type.getSymbol?.();
    if (sameSymbol(symbol, target)) return true;
    if ((type.types ?? []).some(part => typeUsesContractIdentity(ts, checker, part, node, target, seen))) return true;
    const constraint = checker.getBaseConstraintOfType?.(type);
    if (constraint && constraint !== type && typeUsesContractIdentity(ts, checker, constraint, node, target, seen)) return true;
    const aliasDeclarations = symbol?.declarations?.filter(declaration => ts.isTypeAliasDeclaration(declaration)) ?? [];
    for (const declaration of aliasDeclarations) {
      const nested = checker.getTypeAtLocation(declaration.type);
      if (nested !== type && typeUsesContractIdentity(ts, checker, nested, declaration, target, seen)) return true;
      let found = false;
      const inspect = child => {
        if ((ts.isTypeReferenceNode(child) || ts.isExpressionWithTypeArguments(child))
          && sameSymbol(symbolOf(ts, checker, child.typeName ?? child.expression), target)) found = true;
        if (!found) ts.forEachChild(child, inspect);
      };
      inspect(declaration.type);
      if (found) return true;
    }
    if (node?.type) {
      let found = false;
      const inspect = child => {
        if ((ts.isTypeReferenceNode(child) || ts.isExpressionWithTypeArguments(child))
          && sameSymbol(symbolOf(ts, checker, child.typeName ?? child.expression), target)) found = true;
        if (!found) ts.forEachChild(child, inspect);
      };
      inspect(node.type);
      if (found) return true;
    }
    return false;
}

function checkEnvelopeConsumerCoverage(entry, typeItem, env, result) {
  const declaredReaders = entry.readers.map(binding => exportedSymbol(binding, env.context, env.repository));
  const knownFields = new Set([entry.discriminator.field, entry.dataField, ...entry.errorFields]);
  const add = (relative, source, node, message, unavailable = false) => (unavailable ? result.errors : result.violations)
    .push({ ruleId: 'FE_ERROR_ENVELOPE_POLICY', path: relative, ...location(source, node), message });
  for (const relative of [...env.bound].filter(file => SOURCE.test(file) && !TEST_SOURCE.test(file))) {
    const { source, checker, ts } = projectFor(env.context, env.repository, relative);
    const visit = node => {
      if (ts.isFunctionLike(node)) for (const parameter of node.parameters) {
        if (!typeUsesContractIdentity(ts, checker, checker.getTypeAtLocation(parameter), parameter, typeItem.symbol)) continue;
        if (!node.body) {
          add(relative, source, parameter, `Envelope ${entry.id} appears in a declaration without an inspectable reader body.`, true);
          continue;
        }
        if (!ts.isIdentifier(parameter.name)) {
          add(relative, source, parameter, `Envelope ${entry.id} is consumed through an unsupported destructured parameter.`, true);
          continue;
        }
        const owner = symbolOf(ts, checker, parameter.name), symbol = functionSymbol(ts, checker, node);
        let knownUse = false, opaqueUse = Boolean(ts.isConstructorDeclaration(node) && parameter.modifiers?.length);
        const inspect = child => {
          if (child !== node.body && ts.isFunctionLike(child)) {
            if (containsSymbol(ts, checker, child, owner)) opaqueUse = true;
            return;
          }
          if (ts.isIdentifier(child) && sameSymbol(symbolOf(ts, checker, child), owner) && child !== parameter.name) {
            const parent = child.parent;
            if (ts.isPropertyAccessExpression(parent) && parent.expression === child) {
              if (knownFields.has(parent.name.text)) knownUse = true; else opaqueUse = true;
            } else if (ts.isElementAccessExpression(parent) && parent.expression === child && ts.isStringLiteralLike(parent.argumentExpression)) {
              if (knownFields.has(parent.argumentExpression.text)) knownUse = true; else opaqueUse = true;
            } else opaqueUse = true;
          }
          ts.forEachChild(child, inspect);
        };
        inspect(node.body);
        const declared = declaredReaders.some(reader => sameSymbol(reader.symbol, symbol));
        if (knownUse && !declared) add(relative, source, node, `Envelope ${entry.id} is consumed by an undeclared reader; every reader must be an exact exported contract entry.`);
        if (opaqueUse) add(relative, source, node, `Envelope ${entry.id} has opaque consumer flow that prevents complete reader inventory.`, true);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
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
    if (!typeUsesContractIdentity(ts, reader.checker, inputType, parameter, typeItem.symbol)) {
      add(parameter, `Reader ${binding.export} input is not the declared ${entry.id} envelope.`, false, reader.source, binding.path);
    }
    let handled = false, handledAt = Number.POSITIVE_INFINITY, sawFailureBranch = false, returned = false,
      returnedAt = Number.POSITIVE_INFINITY, missingHandled = binding.emptyData === 'valid', sawMissingBranch = false,
      unstableDataAlias = false;
    const dataExpression = (node, seen = new Set()) => {
      const value = unwrap(ts, node);
      if (!value || seen.has(value)) return false;
      seen.add(value);
      if (propertyAccess(ts, reader.checker, value, owner, entry.dataField)) return true;
      if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return dataExpression(value.left, seen);
      if (ts.isIdentifier(value)) {
        const declaration = symbolOf(ts, reader.checker, value)?.valueDeclaration;
        if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) return false;
        if (!isConstVariable(ts, declaration)) { unstableDataAlias = true; return false; }
        return dataExpression(declaration.initializer, seen);
      }
      return false;
    };
    const visit = node => {
      if (ts.isIfStatement(node)) {
        if (failureCondition(ts, reader.checker, node.expression, owner, entry.discriminator.field)) {
          sawFailureBranch = true; if (node.parent === fn.body && containsThrow(ts, node.thenStatement)) { handled = true; handledAt = Math.min(handledAt, node.pos); }
        }
        const success = propertyAccess(ts, reader.checker, node.expression, owner, entry.discriminator.field);
        if (success && node.elseStatement) { sawFailureBranch = true; if (node.parent === fn.body && containsThrow(ts, node.elseStatement)) { handled = true; handledAt = Math.min(handledAt, node.pos); } }
      }
      if (ts.isReturnStatement(node) && node.expression && !staticallyUnreachable(ts, node, fn.body)) {
        if (dataExpression(node.expression)) { returned = true; returnedAt = Math.min(returnedAt, node.pos); }
      }
      if (binding.emptyData === 'required' && ts.isIfStatement(node) && missingDataCondition(ts, reader.checker, node.expression, owner, entry.dataField)) {
        sawMissingBranch = true;
        let supported = node.parent === fn.body;
        for (let current = node.parent; !supported && current && current !== fn.body; current = current.parent) {
          if (ts.isIfStatement(current) && current.parent === fn.body
            && propertyAccess(ts, reader.checker, current.expression, owner, entry.discriminator.field)
            && current.thenStatement.pos <= node.pos && node.end <= current.thenStatement.end) supported = true;
        }
        if (supported && containsThrow(ts, node.thenStatement)) missingHandled = true;
      }
      if (node !== fn.body && ts.isFunctionLike(node)) return;
      ts.forEachChild(node, visit);
    };
    visit(fn.body);
    if (unstableDataAlias) add(fn, `Reader ${binding.export} uses a mutable data alias whose envelope provenance cannot be proved.`, true, reader.source, binding.path);
    if (!handled) add(fn, sawFailureBranch ? `Reader ${binding.export} failure branch uses an unsupported indirect handler.`
      : `Reader ${binding.export} must handle the transport failure discriminator before returning data.`, sawFailureBranch, reader.source, binding.path);
    if (!returned) add(fn, `Reader ${binding.export} must return the declared data field; valid empty data may use ?? null after failure handling.`, false, reader.source, binding.path);
    else if (handled && returnedAt < handledAt) add(fn, `Reader ${binding.export} returns data before its transport failure guard.` , false, reader.source, binding.path);
    if (!missingHandled) add(fn, sawMissingBranch ? `Reader ${binding.export} missing-data branch uses an unsupported indirect handler.`
      : `Reader ${binding.export} declares required data and must reject an absent data field.`, sawMissingBranch, reader.source, binding.path);
  }
  checkEnvelopeConsumerCoverage(entry, typeItem, env, result);
}

function requiredConditionTruth(ts, checker, node, binding) {
  const value = unwrap(ts, node);
  if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
    const nested = requiredConditionTruth(ts, checker, value.operand, binding);
    return nested && Object.fromEntries(Object.entries(nested).map(([name, truth]) => [name, !truth]));
  }
  if (ts.isBinaryExpression(value) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(value.operatorToken.kind)) {
    const left = requiredConditionTruth(ts, checker, value.left, binding), right = requiredConditionTruth(ts, checker, value.right, binding);
    if (!left || !right) return null;
    const and = value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken;
    return Object.fromEntries(['null', 'undefined', 'present'].map(name => [name, and ? left[name] && right[name] : left[name] || right[name]]));
  }
  if (!ts.isBinaryExpression(value) || ![ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(value.operatorToken.kind)) return null;
  const strict = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(value.operatorToken.kind);
  const negative = [ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(value.operatorToken.kind);
  const isBinding = candidate => ts.isIdentifier(unwrap(ts, candidate)) && sameSymbol(symbolOf(ts, checker, unwrap(ts, candidate)), binding);
  const absentKind = candidate => {
    const selected = unwrap(ts, candidate);
    if (selected.kind === ts.SyntaxKind.NullKeyword) return 'null';
    if (ts.isIdentifier(selected) && selected.text === 'undefined' && !(checker.getSymbolAtLocation(selected)?.declarations?.length)) return 'undefined';
    if (ts.isStringLiteralLike(selected) && selected.text === 'undefined') return 'typeof';
    return null;
  };
  let kind = null;
  if (isBinding(value.left)) kind = absentKind(value.right);
  else if (isBinding(value.right)) kind = absentKind(value.left);
  else {
    const typeofBinding = candidate => ts.isTypeOfExpression(unwrap(ts, candidate)) && isBinding(unwrap(ts, candidate).expression);
    if (typeofBinding(value.left)) kind = absentKind(value.right);
    else if (typeofBinding(value.right)) kind = absentKind(value.left);
    if (kind !== 'typeof') return null;
    kind = 'undefined';
  }
  if (!kind || kind === 'typeof') return null;
  const equal = {
    null: kind === 'null' || !strict,
    undefined: kind === 'undefined' || !strict,
    present: false,
  };
  return negative ? Object.fromEntries(Object.entries(equal).map(([name, truth]) => [name, !truth])) : equal;
}

function requiredAbsentBranch(entry, truth) {
  if (!truth) return null;
  const branch = entry.absence === 'nullish'
    ? truth.null === truth.undefined && truth.null !== truth.present ? truth.null : null
    : truth[entry.absence] !== truth.present ? truth[entry.absence] : null;
  return typeof branch === 'boolean' ? branch : null;
}

function errorConstructorSymbol(ts, checker, expression, seen = new Set()) {
  let selected = expression;
  while (selected && (ts.isParenthesizedExpression(selected) || ts.isNonNullExpression(selected))) selected = selected.expression;
  if (!selected || ts.isAsExpression(selected) || ts.isTypeAssertionExpression(selected) || ts.isSatisfiesExpression?.(selected)) return null;
  const symbol = symbolOf(ts, checker, selected);
  if (!symbol || seen.has(symbol)) return null;
  seen.add(symbol);
  const variable = (symbol.declarations ?? []).find(declaration => ts.isVariableDeclaration(declaration) && declaration.initializer);
  if (variable) {
    if (!isConstVariable(ts, variable)) return null;
    return errorConstructorSymbol(ts, checker, variable.initializer, seen);
  }
  return symbol;
}

function standardErrorConstructor(ts, checker, symbol, seen = new Set()) {
  if (!symbol || seen.has(symbol)) return false;
  seen.add(symbol);
  if (symbol.name === 'Error' && (symbol.declarations ?? []).some(declaration => declaration.getSourceFile().hasNoDefaultLib)) return true;
  for (const declaration of symbol.declarations ?? []) if (ts.isClassDeclaration(declaration) || ts.isClassExpression(declaration)) {
    const extension = declaration.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)?.types;
    if (!extension || extension.length !== 1) continue;
    const parent = errorConstructorSymbol(ts, checker, extension[0].expression);
    if (standardErrorConstructor(ts, checker, parent, seen)) return true;
  }
  return false;
}

function failureTerminal(ts, checker, statement) {
  if (!statement) return { terminal: false, valid: false, unavailable: false };
  const selected = unwrap(ts, statement);
  if (ts.isBlock(selected)) {
    for (const child of selected.statements) {
      const outcome = failureTerminal(ts, checker, child);
      if (outcome.terminal || outcome.unavailable) return outcome;
    }
    return { terminal: false, valid: false, unavailable: false };
  }
  if (ts.isThrowStatement(selected)) {
    const expression = selected.expression;
    let constructor = expression;
    while (constructor && (ts.isParenthesizedExpression(constructor) || ts.isNonNullExpression(constructor))) constructor = constructor.expression;
    if (!constructor || !ts.isNewExpression(constructor)) return { terminal: true, valid: false, unavailable: true };
    const symbol = errorConstructorSymbol(ts, checker, constructor.expression);
    if (!symbol) return { terminal: true, valid: false, unavailable: true };
    return { terminal: true, valid: standardErrorConstructor(ts, checker, symbol), unavailable: false };
  }
  if (ts.isReturnStatement(selected)) return { terminal: true, valid: false, unavailable: false };
  if (ts.isIfStatement(selected)) {
    const fixed = staticBoolean(ts, selected.expression);
    if (fixed !== null) return failureTerminal(ts, checker, fixed ? selected.thenStatement : selected.elseStatement);
    const left = failureTerminal(ts, checker, selected.thenStatement);
    if (!selected.elseStatement) {
      if (left.unavailable) return left;
      return left.terminal && !left.valid ? left : { terminal: false, valid: false, unavailable: false };
    }
    const right = failureTerminal(ts, checker, selected.elseStatement);
    if (left.unavailable || right.unavailable) return { terminal: true, valid: false, unavailable: true };
    if (left.terminal && !left.valid || right.terminal && !right.valid) return { terminal: true, valid: false, unavailable: false };
    return { terminal: left.terminal && right.terminal, valid: left.valid && right.valid, unavailable: false };
  }
  if (ts.isTryStatement(selected) || ts.isSwitchStatement(selected) || ts.isLoop?.(selected)
    || ts.isWhileStatement(selected) || ts.isDoStatement(selected) || ts.isForStatement(selected) || ts.isForInStatement(selected) || ts.isForOfStatement(selected)) {
    return { terminal: false, valid: false, unavailable: true };
  }
  return { terminal: false, valid: false, unavailable: false };
}

function checkRequiredValue(entry, env, result) {
  const owner = exportedSymbol(entry.owner, env.context, env.repository), { ts, checker, source } = owner, fn = functionNode(ts, owner);
  const add = (node, message, unavailable = false) => (unavailable ? result.errors : result.violations)
    .push({ ruleId: 'FE_REQUIRED_VALUE_FAILURE', path: entry.owner.path, ...location(source, node), message });
  if (!fn?.body || !ts.isBlock(fn.body)) return add(source, `Required-value owner ${entry.owner.export} must resolve to a block-bodied source function.`, true);
  const candidates = [];
  for (const parameter of fn.parameters) if (ts.isIdentifier(parameter.name) && parameter.name.text === entry.binding) {
    candidates.push({ node: parameter.name, declaration: parameter, symbol: symbolOf(ts, checker, parameter.name), stable: true });
  }
  const collect = node => {
    if (node !== fn.body && ts.isFunctionLike(node)) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === entry.binding) {
      candidates.push({ node: node.name, declaration: node, symbol: symbolOf(ts, checker, node.name), stable: isConstVariable(ts, node) });
    }
    ts.forEachChild(node, collect);
  };
  collect(fn.body);
  if (candidates.length !== 1 || !candidates[0].symbol) return add(fn, `Required binding ${entry.binding} must resolve exactly once in ${entry.owner.export}.`, true);
  const binding = candidates[0];
  if (!binding.stable) add(binding.node, `Required binding ${entry.binding} must be immutable so its guard remains valid.`, true);
  const bindingType = checker.getTypeAtLocation(binding.node);
  if (bindingType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) add(binding.node, `Required binding ${entry.binding} has an any/unknown type.`, true);
  const parts = bindingType.types ?? [bindingType], hasNull = parts.some(type => Boolean(type.flags & ts.TypeFlags.Null)),
    hasUndefined = parts.some(type => Boolean(type.flags & ts.TypeFlags.Undefined));
  if (entry.absence === 'null' && !hasNull || entry.absence === 'undefined' && !hasUndefined
    || entry.absence === 'nullish' && (!hasNull || !hasUndefined)) {
    add(binding.node, `Required binding ${entry.binding} type does not expose selected ${entry.absence} absence.`);
  }
  let mutated = false;
  const mutation = node => {
    if (ts.isIdentifier(node) && sameSymbol(symbolOf(ts, checker, node), binding.symbol)) {
      for (let current = node; current?.parent && !ts.isFunctionLike(current.parent); current = current.parent) {
        const parent = current.parent;
        if (ts.isBinaryExpression(parent) && containsNode(ts, parent.left, node) && parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
          && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) mutated = true;
        if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent))
          && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(parent.operator)) mutated = true;
        if ((ts.isForInStatement(parent) || ts.isForOfStatement(parent)) && containsNode(ts, parent.initializer, node)) mutated = true;
        if (ts.isStatement(parent)) break;
      }
    }
    ts.forEachChild(node, mutation);
  };
  mutation(fn.body);
  if (mutated) add(binding.node, `Required binding ${entry.binding} is reassigned, so the selected guard cannot dominate later use.`, true);
  const guards = [];
  for (const statement of fn.body.statements) if (ts.isIfStatement(statement)) {
    const absent = requiredAbsentBranch(entry, requiredConditionTruth(ts, checker, statement.expression, binding.symbol));
    if (absent !== null) guards.push({ statement, absent, failure: absent ? statement.thenStatement : statement.elseStatement });
  }
  if (!guards.length) return add(fn, `Required binding ${entry.binding} needs an explicit ${entry.absence} failure guard before continuation.`);
  if (guards.length > 1) return add(fn, `Required binding ${entry.binding} has multiple candidate guards whose dominance is ambiguous.`, true);
  const guard = guards[0];
  if (ts.isVariableDeclaration(binding.declaration) && binding.declaration.pos > guard.statement.pos) {
    return add(guard.statement, `Required binding ${entry.binding} is declared after its selected failure guard.`, true);
  }
  if (staticallyUnreachable(ts, guard.statement, fn.body)) return add(guard.statement, `Required binding ${entry.binding} guard is statically unreachable.`, true);
  if (!guard.failure) return add(guard.statement, `Required binding ${entry.binding} guard has no statically selected failure branch.`);
  const terminal = failureTerminal(ts, checker, guard.failure);
  if (terminal.unavailable) add(guard.failure, `Required binding ${entry.binding} failure branch uses an unsupported or opaque thrown value.`, true);
  else if (!terminal.terminal || !terminal.valid) add(guard.failure, `Required binding ${entry.binding} failure branch must terminate with standard Error or a resolved Error subclass.`);
  let useBefore = false;
  const uses = node => {
    if (ts.isIdentifier(node) && sameSymbol(symbolOf(ts, checker, node), binding.symbol) && node !== binding.node) {
      const inside = container => container && container.pos <= node.pos && node.end <= container.end;
      if (!inside(guard.statement.expression) && !inside(guard.failure) && node.pos < guard.statement.pos) useBefore = true;
    }
    ts.forEachChild(node, uses);
  };
  for (const parameter of fn.parameters) if (parameter.initializer) uses(parameter.initializer);
  uses(fn.body);
  if (useBefore) add(guard.statement, `Required binding ${entry.binding} is used before its selected failure guard.`);
}

function enclosingFunction(ts, node) {
  for (let current = node; current; current = current.parent) if (ts.isFunctionLike(current)) return current;
  return null;
}

function functionSymbol(ts, checker, node) {
  if (!node) return null;
  if (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name))) return symbolOf(ts, checker, node.name);
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return symbolOf(ts, checker, parent.name);
  if (ts.isPropertyAssignment(parent) && (ts.isIdentifier(parent.name) || ts.isStringLiteralLike(parent.name))) return symbolOf(ts, checker, parent.name);
  return null;
}

function containsSymbol(ts, checker, node, target) {
  let found = false;
  const visit = child => { if (ts.isIdentifier(child) && sameSymbol(symbolOf(ts, checker, child), target)) found = true; else ts.forEachChild(child, visit); };
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
    if (ts.isVariableDeclaration(node) && node.initializer && containsNode(ts, node.initializer, call) && ts.isIdentifier(node.name)) {
      const isConst = Boolean(ts.getCombinedNodeFlags(node.parent) & ts.NodeFlags.Const);
      const awaited = (() => { for (let item = call.parent; item && item !== node; item = item.parent) if (ts.isAwaitExpression(item)) return true; return false; })();
      let direct = unwrap(ts, node.initializer);
      if (ts.isAwaitExpression(direct)) direct = unwrap(ts, direct.expression);
      return { symbol: symbolOf(ts, checker, node.name), isConst, awaited, indirect: direct !== call };
    }
    if (ts.isFunctionLike(node)) break;
  }
  return null;
}


function visitOwnFunction(ts, fn, callback) {
  const visit = node => {
    if (node !== fn && ts.isFunctionLike(node)) return;
    callback(node);
    ts.forEachChild(node, visit);
  };
  visit(fn.body ?? fn);
}

function checkWrite(entry, env, result) {
  const action = exportedSymbol(entry.action, env.context, env.repository), feedback = exportedSymbol(entry.feedback, env.context, env.repository);
  const feedbackFunction = functionNode(feedback.ts, feedback);
  if (!functionNode(action.ts, action) || !feedbackFunction) {
    result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: entry.action.path, line: 1, column: 1,
      message: 'Declared write action and feedback owner must both resolve to callable source functions.' });
    return;
  }
  if (entry.binding === 'callback') {
    const parameter = feedbackFunction.parameters[0], binding = parameter && feedback.ts.isIdentifier(parameter.name) && symbolOf(feedback.ts, feedback.checker, parameter.name);
    let invoked = false, unreachableInvocation = false;
    if (binding) visitOwnFunction(feedback.ts, feedbackFunction, node => {
      if (feedback.ts.isCallExpression(node) && sameSymbol(symbolOf(feedback.ts, feedback.checker, unwrap(feedback.ts, node.expression)), binding)) {
        if (staticallyUnreachable(feedback.ts, node, feedbackFunction.body)) unreachableInvocation = true;
        else invoked = true;
      }
    });
    if (!invoked) result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: entry.feedback.path, line: 1, column: 1,
      message: unreachableInvocation ? `Callback feedback owner ${entry.feedback.export} invokes its operation only in statically unreachable control flow.`
        : `Callback feedback owner ${entry.feedback.export} does not invoke its bound operation parameter.` });
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
        if (sameSymbol(called, action.symbol)) {
          actionCalls.push({ node, source, checker, ts, relative, owner: enclosingFunction(ts, node) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const call of actionCalls) {
    if (staticallyUnreachable(call.ts, call.node, call.owner?.body)) {
      result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: call.relative, ...location(call.source, call.node),
        message: `Write action ${entry.action.export} appears only in statically unreachable control flow and cannot prove feedback ownership.` });
      continue;
    }
    let site = siteByFunction.get(call.owner);
    if (!site) site = sites.find(candidate => candidate.fn && candidate.fn.pos <= call.node.pos && call.node.end <= candidate.fn.end && (() => {
      for (let node = call.node.parent; node && node !== candidate.fn; node = node.parent) if (call.ts.isFunctionLike(node)) {
        const registration = node.parent;
        if (!call.ts.isCallExpression(registration) || !registration.arguments.includes(node)
          || !sameSymbol(symbolOf(call.ts, call.checker, unwrap(call.ts, registration.expression)), feedback.symbol)) return false;
      }
      return true;
    })());
    if (!site) {
      result.violations.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: call.relative, ...location(call.source, call.node), message: `Write action ${entry.action.export} is used outside its exact declared feedback sites.` });
      continue;
    }
    seenSites.add(site);
    const resultBinding = resultBindingForCall(call.ts, call.checker, call.node);
    if (resultBinding && (!resultBinding.isConst || resultBinding.awaited || resultBinding.indirect)) result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: call.relative,
      ...location(call.source, call.node), message: !resultBinding.isConst
        ? `Write action ${entry.action.export} result uses a mutable binding; feedback provenance is unavailable.`
        : resultBinding.awaited ? `Write action ${entry.action.export} is awaited before feedback ownership; rejected transport failure bypasses the feedback owner.`
          : `Write action ${entry.action.export} result uses an unsupported indirect binding before feedback ownership.` });
    let bound = false;
    const visit = node => {
      if (call.ts.isCallExpression(node) && sameSymbol(symbolOf(call.ts, call.checker, unwrap(call.ts, node.expression)), feedback.symbol)) {
        const direct = containsNode(call.ts, node, call.node);
        let awaited = false, callback = false, indirect = false;
        if (direct) for (let current = call.node.parent; current && current !== node; current = current.parent) {
          if (call.ts.isAwaitExpression(current)) awaited = true;
          if (call.ts.isFunctionLike(current)) callback = true;
          if (call.ts.isCallExpression(current)) indirect = true;
        }
        if (awaited) result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: call.relative, ...location(call.source, call.node),
          message: `Write action ${entry.action.export} is awaited while evaluating feedback arguments; rejected transport failure bypasses the feedback owner.` });
        const mode = callback ? 'callback' : 'promise';
        if (!awaited && direct && mode !== entry.binding) result.violations.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: call.relative,
          ...location(call.source, call.node), message: `Write action ${entry.action.export} uses ${mode} feedback binding but contract selects ${entry.binding}.` });
        if (indirect) result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: call.relative, ...location(call.source, call.node),
          message: `Write action ${entry.action.export} passes through an unsupported call before feedback ownership.` });
        if (!awaited && !indirect && mode === entry.binding && (direct || (entry.binding === 'promise' && resultBinding?.isConst && !resultBinding.awaited && !resultBinding.indirect
          && containsSymbol(call.ts, call.checker, node, resultBinding.symbol)))) bound = true;
      }
    };
    visitOwnFunction(call.ts, site.fn, visit);
    if (!bound) result.violations.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: site.binding.path, ...location(site.source, site.fn), message: `Write site ${site.binding.export} does not bind ${entry.action.export} to feedback owner ${entry.feedback.export}.` });
  }
  for (const site of sites) if (site.fn && !seenSites.has(site)) result.violations.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: site.binding.path,
    ...location(site.source, site.fn), message: `Declared feedback site ${site.binding.export} does not call write action ${entry.action.export}.` });
  // Passing/re-exporting an action through an unsupported dynamic shape could hide a call from exact-site coverage.
  for (const relative of boundFiles) {
    const { source, checker, ts } = projectFor(env.context, env.repository, relative);
    const visit = node => {
      if (ts.isIdentifier(node) && sameSymbol(symbolOf(ts, checker, node), action.symbol)) {
        const parent = node.parent, directCall = ts.isCallExpression(parent) && unwrap(ts, parent.expression) === node;
        const declaration = (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) || action.symbol.declarations?.includes(parent);
        const feedbackArgument = ts.isCallExpression(parent) && sameSymbol(symbolOf(ts, checker, unwrap(ts, parent.expression)), feedback.symbol);
        if (!directCall && !declaration && !feedbackArgument) result.errors.push({ ruleId: 'FE_WRITE_FEEDBACK_OWNER', path: relative,
          ...location(source, node), message: `Dynamic reference to write action ${entry.action.export} cannot prove exact feedback-site coverage.` });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

function declarationInside(repository, roots, declaration) {
  const file = path.resolve(declaration.getSourceFile().fileName);
  return roots.some(root => isInside(path.resolve(repository, root), file));
}

function importedCallIdentity(ts, checker, expression, seen = new Set()) {
  const selected = unwrap(ts, expression);
  if (ts.isIdentifier(selected)) {
    const local = checker.getSymbolAtLocation(selected);
    if (local && !seen.has(local)) {
      seen.add(local);
      const declaration = local.declarations?.find(item => ts.isVariableDeclaration(item) && item.initializer);
      if (declaration) {
        const traced = importedCallIdentity(ts, checker, declaration.initializer, seen);
        if (traced) return traced;
      }
    }
    const resolved = symbolOf(ts, checker, selected);
    const packageDeclaration = resolved?.declarations?.find(declaration => /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?swr(?:\/|$)/
      .test(slash(declaration.getSourceFile().fileName)));
    if (packageDeclaration) return { specifier: 'swr', imported: resolved.name === 'default' ? 'default' : resolved.name };
  }
  const declarationFor = node => checker.getSymbolAtLocation(node)?.declarations?.find(declaration =>
    ts.isImportSpecifier(declaration) || ts.isImportClause(declaration) || ts.isNamespaceImport(declaration));
  let declaration = null, imported = null;
  if (ts.isIdentifier(selected)) {
    declaration = declarationFor(selected);
    imported = declaration && ts.isImportSpecifier(declaration) ? declaration.propertyName?.text ?? declaration.name.text
      : declaration && ts.isImportClause(declaration) ? 'default' : null;
  } else if (ts.isPropertyAccessExpression(selected) && ts.isIdentifier(selected.expression)) {
    declaration = declarationFor(selected.expression);
    imported = selected.name.text;
  }
  if (!declaration || !imported) return null;
  let statement = declaration;
  while (statement && !ts.isImportDeclaration(statement)) statement = statement.parent;
  return statement?.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier)
    ? { specifier: statement.moduleSpecifier.text, imported } : null;
}

function knownFailureLifecycleCall(identity) {
  if (!identity) return false;
  if (['swr', 'swr/immutable', 'swr/mutation'].includes(identity.specifier)) {
    return ['default', 'useSWR', 'useSWRConfig', 'useSWRImmutable', 'useSWRMutation'].includes(identity.imported);
  }
  return false;
}

function sourceSurfaceInventory(env) {
  const configuredWorldRoots = [...new Set([
    ...env.config.frontend.transport,
    ...env.contract.transports.map(item => item.root),
  ])];
  const configuredTransportRoots = [...new Set([
    ...env.config.frontend.transport,
    ...env.contract.transports.map(item => item.root),
  ])];
  const world = [], transport = [];
  for (const relative of [...env.bound].filter(file => SOURCE.test(file) && !TEST_SOURCE.test(file))) {
    const { source, checker, ts } = projectFor(env.context, env.repository, relative);
    const sourceInTransport = configuredTransportRoots.some(root => isInside(path.resolve(env.repository, root), path.resolve(source.fileName)));
    const visit = node => {
      if (ts.isCallExpression(node)) {
        const target = symbolOf(ts, checker, unwrap(ts, node.expression));
        const declarations = target?.declarations ?? target?.getDeclarations?.() ?? [];
        const worldRoot = declarations.some(declaration => declarationInside(env.repository, configuredWorldRoots, declaration));
        const transportRoot = declarations.some(declaration => declarationInside(env.repository, configuredTransportRoots, declaration));
        const externalWorld = knownFailureLifecycleCall(importedCallIdentity(ts, checker, node.expression));
        const item = { path: relative, ...location(source, node) };
        if (worldRoot || externalWorld || sourceInTransport) world.push(item);
        if (transportRoot || sourceInTransport) transport.push(item);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { world, transport };
}

function reservedBoundaryFiles(env) {
  return [...env.bound].filter(relative => SOURCE.test(relative) && !TEST_SOURCE.test(relative)
    && /(?:^|\/)(?:global-error|error)\.tsx$/.test(relative)
    && env.config.frontend.routes.some(root => relative === root || relative.startsWith(`${root}/`)));
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
  let recoveryCall = false, unsupportedRecovery = false, html = false, body = false;
  const eventCallback = node => {
    for (let current = node.parent; current && current !== fn.body; current = current.parent) {
      if (ts.isJsxAttribute(current) && /^on[A-Z]/.test(current.name.getText(source))) return true;
      if (ts.isStatement(current) && !ts.isExpressionStatement(current)) return false;
    }
    return false;
  };
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
    if (node !== fn && ts.isFunctionLike(node) && !eventCallback(node)) {
      let referenced = false;
      const probe = child => {
        if (owner && propertyAccess(ts, checker, child, owner, entry.recoveryProp)) referenced = true;
        if (recoverySymbol && ts.isIdentifier(child) && sameSymbol(symbolOf(ts, checker, child), recoverySymbol)) referenced = true;
        if (!referenced) ts.forEachChild(child, probe);
      };
      probe(node); if (referenced) unsupportedRecovery = true;
      return;
    }
    const unreachable = staticallyUnreachable(ts, node, fn.body);
    if (ts.isCallExpression(node) && ((owner && propertyAccess(ts, checker, node.expression, owner, entry.recoveryProp))
      || (recoverySymbol && symbolOf(ts, checker, unwrap(ts, node.expression)) === recoverySymbol))) {
      if (unreachable) unsupportedRecovery = true; else recoveryCall = true;
    }
    if (owner && propertyAccess(ts, checker, node, owner, entry.recoveryProp) && recoveryUse(node)) {
      if (unreachable) unsupportedRecovery = true; else recoveryCall = true;
    }
    if (recoverySymbol && ts.isIdentifier(node) && symbolOf(ts, checker, node) === recoverySymbol
      && node !== recoveryBinding?.name && recoveryUse(node)) {
      if (unreachable) unsupportedRecovery = true; else recoveryCall = true;
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source); if (tag === 'html') html = true; if (tag === 'body') body = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  if (!recoveryCall) add(fn, unsupportedRecovery ? `Boundary recovery ${entry.recoveryProp} appears only in unsupported indirect control flow.`
    : `Boundary must expose a reachable ${entry.recoveryProp} recovery action.`, unsupportedRecovery);
  if (entry.role === 'global' && (!html || !body)) add(fn, 'A global Next error boundary renders its required html and body shell.');
}

function programSourceFiles(context, repository) {
  const files = new Set();
  for (const project of context.projects) for (const source of project.program.getSourceFiles()) {
    if (source.isDeclarationFile) continue;
    const absolute = path.resolve(source.fileName);
    if (!isInside(repository, absolute)) continue;
    const relative = slash(path.relative(repository, absolute));
    if (SOURCE.test(relative) && !TEST_SOURCE.test(relative)) files.add(relative);
  }
  return files;
}

function insideSourceRoots(relative, roots) {
  return roots.some(root => relative === root || relative.startsWith(`${root}/`));
}

/** Check explicitly selected Next error-state contracts without running application code. */
export function checkNextErrors({ root, files, ruleIds, contextFiles = [], sourceContextFiles, architectureConfig } = {}) {
  const result = { schema: 'starci/code-pattern-script@1', repository: '', files: [], requestedRuleIds: ruleIds ?? [], checkedRuleIds: [], violations: [], errors: [], compiler: null };
  try {
    const repository = fs.realpathSync(path.resolve(root)); result.repository = repository;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length
      || files.some(file => !SOURCE.test(file) || TEST_SOURCE.test(file) || DECLARATION_SOURCE.test(file))) throw Error('Exact unique selected Next production source files are required.');
    if (!Array.isArray(contextFiles) || new Set(contextFiles).size !== contextFiles.length) throw Error('Next context files must be an exact unique array.');
    if (sourceContextFiles !== undefined && (!Array.isArray(sourceContextFiles) || new Set(sourceContextFiles).size !== sourceContextFiles.length
      || sourceContextFiles.some(file => typeof file !== 'string' || !SOURCE.test(file)))) throw Error('Next sourceContextFiles must be an exact unique source-path array when supplied.');
    if (!Array.isArray(ruleIds) || !ruleIds.length || new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEXT_ERROR_RULES.includes(id))) throw Error('Unique supported Next error-state rule IDs are required.');
    for (const relative of files) regular(repository, relative, 'Selected Next error-state source');
    for (const relative of contextFiles) regular(repository, relative, 'Next error-state context');
    const available = new Set([...files, ...contextFiles]);
    if (sourceContextFiles !== undefined && sourceContextFiles.some(file => !available.has(file))) throw Error('Every Next sourceContextFiles path must also be selected or present in contextFiles.');
    const document = readContract(repository), config = loadArchitectureConfig(repository, architectureConfig), context = buildTypeScriptContext(config);
    if (context.errors.length) throw Error(context.errors.map(error => error.message).join('; '));
    const coverageRoots = [...new Set([
      ...document.sourceRoots,
      ...(ruleIds.includes('FE_NEXT_ERROR_BOUNDARY_LOCATION') ? config.frontend.routes : []),
    ])];
    const programSources = programSourceFiles(context, repository);
    const ownedSources = new Set([...programSources].filter(relative => insideSourceRoots(relative, coverageRoots)));
    const sourceContext = (sourceContextFiles === undefined
      ? contextFiles.filter(relative => ownedSources.has(relative))
      : sourceContextFiles).filter(relative => !TEST_SOURCE.test(relative) && !DECLARATION_SOURCE.test(relative));
    const bound = new Set([...files, ...sourceContext]);
    const contract = parseContract(repository, bound, document);
    const missing = [...ownedSources].filter(relative => !bound.has(relative));
    if (missing.length) throw Error(`errorState.sourceRoots coverage is incomplete; bind every owning-program source (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ', …' : ''}).`);
    const explicitArchitectureConfig = architectureConfig === undefined || architectureConfig === null ? null : exactRelative(architectureConfig, 'architectureConfig');
    if (explicitArchitectureConfig) regular(repository, explicitArchitectureConfig, 'Architecture config authority');
    result.compiler = {
      version: context.loaded.version,
      resolved: context.loaded.resolved,
      architectureConfig: explicitArchitectureConfig,
      projects: [...config.projects].sort(),
      metadataFiles: contextFiles.filter(file => !bound.has(file)).sort(),
    };
    const env = { repository, bound, contract, config, context };
    const surfaceInventory = sourceSurfaceInventory(env);
    const unavailable = (ruleId, message) => result.errors.push({ ruleId, path: null, line: null, column: null, message });
    if (ruleIds.includes('FE_ERROR_WORLD_STATE_MAPPING')) {
      if (!contract.worldMappings.length && surfaceInventory.world.length) unavailable('FE_ERROR_WORLD_STATE_MAPPING',
        `Cannot prove an absent world-state surface; resolved world calls exist at ${surfaceInventory.world.slice(0, 3).map(item => `${item.path}:${item.line}`).join(', ')}.`);
      if (contract.worldMappings.length) {
        for (const entry of contract.worldMappings) checkWorldMapping(entry, env, result);
        checkWorldCoverage(contract.worldMappings, env, result);
      }
    }
    if (ruleIds.includes('FE_ERROR_ENVELOPE_POLICY')) {
      if (!contract.envelopes.length && contract.transports.some(item => item.mode !== 'throwing')) unavailable('FE_ERROR_ENVELOPE_POLICY',
        'Declared envelopes are required for every selected envelope transport.');
      for (const entry of contract.envelopes) checkEnvelope(entry, env, result);
    }
    if (ruleIds.includes('FE_WRITE_FEEDBACK_OWNER')) {
      if (!contract.writes.length && surfaceInventory.transport.length) unavailable('FE_WRITE_FEEDBACK_OWNER',
        `Cannot prove an absent write-feedback surface while resolved transport calls exist at ${surfaceInventory.transport.slice(0, 3).map(item => `${item.path}:${item.line}`).join(', ')}.`);
      for (const entry of contract.writes) checkWrite(entry, env, result);
    }
    if (ruleIds.includes('FE_NEXT_ERROR_BOUNDARY_LOCATION')) {
      const undeclaredBoundaries = reservedBoundaryFiles(env).filter(relative => !contract.boundaries.some(entry => entry.path === relative));
      if (undeclaredBoundaries.length) unavailable('FE_NEXT_ERROR_BOUNDARY_LOCATION',
        `Undeclared reserved boundaries exist: ${undeclaredBoundaries.slice(0, 4).join(', ')}.`);
      if (contract.boundaries.length) {
        const next = installedNext(repository, context.ts);
        for (const entry of contract.boundaries) checkBoundary(entry, env, result, next);
        result.compiler.next = { ...next, recoveryProps: [...next.recoveryProps].sort() };
      }
    }
    if (ruleIds.includes('FE_REQUIRED_VALUE_FAILURE')) {
      for (const entry of contract.requiredValues) checkRequiredValue(entry, env, result);
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
