// Failure-code discovery follows finite values into actual public code fields and the shared operation normalizer.
// Inputs are parsed source files only; provider modules are never imported or executed.
import path from 'node:path';
import {isConstVariable, nameText} from './ts-ast.mjs';

const unwrap = (t, node) => t.isParenthesizedExpression(node) ? unwrap(t, node.expression) : node;
const topLevel = (t, node) => t.isVariableStatement(node.parent?.parent) && t.isSourceFile(node.parent.parent.parent);

/** Index unique const bindings and named relative imports without resolving or executing application modules. */
export function failureSourceIndex(t, texts, sourceFor) {
  const sources = new Map(texts);
  return {
    closedCollections: new Set(),
    get: file => sources.has(file) ? sourceInfo(t, file, sourceFor(file)) : null,
    *values() { for (const file of sources.keys()) yield sourceInfo(t, file, sourceFor(file)); },
    *importers(file, name) {
      for (const [candidate, text] of sources) {
        if (!text.includes(path.posix.basename(file))) continue;
        const info = sourceInfo(t, candidate, sourceFor(candidate));
        for (const [local, imported] of info.imports) if (imported.file === file && imported.name === name) yield {info, local};
        if (info.namespaceImports.has(file) || info.reexports.has(file) || info.unresolvedImports.length) yield {info, unresolved: true};
      }
    },
  };
}

function sourceInfo(t, file, source) {
  const info = {file, source, bindings: new Map(), imports: new Map(), namespaceImports: new Set(), reexports: new Set(),
    identifiers: [], declarations: new Map(), dynamicImports: [], unresolvedImports: []};
  const visit = node => {
    if (t.isIdentifier(node)) info.identifiers.push(node);
    if (t.isVariableDeclaration(node) && t.isIdentifier(node.name) && isConstVariable(t, node)) {
      info.bindings.set(node.name.text, info.bindings.has(node.name.text) ? null : node);
    }
    if (t.isImportDeclaration(node)) namedImports(t, node, info);
    if (t.isCallExpression(node) && node.expression.kind === t.SyntaxKind.ImportKeyword) info.dynamicImports.push(node);
    if (t.isExportDeclaration(node) && node.moduleSpecifier) {
      const target = relativeModule(t, node.moduleSpecifier, info.file);
      if (target) info.reexports.add(target);
    }
    const name = declarationName(t, node);
    if (name) info.declarations.set(name, (info.declarations.get(name) ?? 0) + 1);
    t.forEachChild(node, visit);
  };
  visit(source);
  for (const call of info.dynamicImports) {
    const specifier = importSpecifier(t, info, call.arguments[0]);
    if (specifier?.startsWith('.')) info.namespaceImports.add(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
    else if (specifier === null || /^(?:file:|[A-Za-z]:[\\/]|\/)/.test(specifier)) info.unresolvedImports.push(call);
  }
  return info;
}

function importSpecifier(t, info, raw, seen = new Set()) {
  if (!raw) return null;
  const node = unwrap(t, raw);
  if (t.isStringLiteralLike(node)) return node.text;
  if (!t.isIdentifier(node) || seen.has(node.text) || info.declarations.get(node.text) !== 1) return null;
  const declaration = info.bindings.get(node.text);
  return declaration?.initializer ? importSpecifier(t, info, declaration.initializer, new Set(seen).add(node.text)) : null;
}

const DECLARATIONS = ['VariableDeclaration', 'Parameter', 'BindingElement', 'FunctionDeclaration', 'FunctionExpression',
  'ClassDeclaration', 'ClassExpression', 'ImportSpecifier', 'NamespaceImport', 'ImportClause'];
const declarationName = (t, node) => DECLARATIONS.some(kind => node.kind === t.SyntaxKind[kind])
  && node.name && t.isIdentifier(node.name) ? node.name.text : null;

function namedImports(t, node, info) {
  const file = relativeModule(t, node.moduleSpecifier, info.file);
  const bindings = node.importClause?.namedBindings;
  if (!file || !bindings) return;
  if (t.isNamespaceImport(bindings)) { info.namespaceImports.add(file); return; }
  for (const entry of bindings.elements) info.imports.set(entry.name.text, {file, name: (entry.propertyName ?? entry.name).text});
}

const relativeModule = (t, node, file) => {
  const specifier = nameText(t, node, {identifiers: false});
  return specifier?.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : null;
};

/** Resolve a local const or a directly exported relative named import; ambiguity remains unresolved. */
function failureBinding(t, index, info, identifier, seen = new Set()) {
  if (!t.isIdentifier(identifier) || seen.has(`${info.file}:${identifier.text}`)) return null;
  seen.add(`${info.file}:${identifier.text}`);
  if ((info.declarations.get(identifier.text) ?? 0) !== 1) return null;
  const local = info.bindings.get(identifier.text);
  if (local) return {info, declaration: local};
  const imported = info.imports.get(identifier.text), target = imported && index.get(imported.file);
  const declaration = exportedConst(t, target, imported?.name);
  if (!declaration) return null;
  return failureBinding(t, index, target, declaration.name, seen);
}

const exportedConst = (t, info, name) => {
  const declaration = info?.bindings.get(name);
  return declaration && topLevel(t, declaration)
    && declaration.parent.parent.modifiers?.some(modifier => modifier.kind === t.SyntaxKind.ExportKeyword) ? declaration : null;
};

/** Literal elements of one const Set, array or frozen array/object; a dynamic element keeps the collection unknown. */
export function failureLiterals(t, binding) {
  if (!binding?.declaration.initializer) return null;
  const selected = collectionInitializer(t, binding);
  if (!selected) return null;
  const {value, kind, frozen = false} = selected;
  const nodes = t.isArrayLiteralExpression(value) ? [...value.elements] : objectValues(t, value);
  if (!nodes?.length || nodes.some(node => !t.isStringLiteralLike(node))) return null;
  return {kind: t.isObjectLiteralExpression(value) ? 'object' : kind, nodes, binding, frozen};
}

function collectionInitializer(t, binding) {
  const value = unwrap(t, binding.declaration.initializer);
  if (t.isNewExpression(value) && t.isIdentifier(value.expression) && value.expression.text === 'Set') {
    if (binding.info.declarations.has('Set') || value.arguments?.length !== 1) return null;
    return {value: unwrap(t, value.arguments[0]), kind: 'set'};
  }
  return frozenInitializer(t, binding, value);
}

const frozenInitializer = (t, binding, value) => {
  if (!t.isCallExpression(value)) return {value, kind: 'array'};
  if (value.expression.getText(binding.info.source) !== 'Object.freeze' || value.arguments.length !== 1 || binding.info.declarations.has('Object')) return null;
  return {value: unwrap(t, value.arguments[0]), kind: 'array', frozen: true};
};

const objectValues = (t, node) => t.isObjectLiteralExpression(node)
  && node.properties.every(property => t.isPropertyAssignment(property)) ? node.properties.map(property => property.initializer) : null;

function membership(t, expression) {
  if (!t.isCallExpression(expression) || !t.isPropertyAccessExpression(expression.expression)
      || expression.expression.name.text !== 'has' || expression.arguments.length !== 1) return null;
  return {set: expression.expression.expression, value: expression.arguments[0]};
}

const sameExpression = (source, left, right) => left.getText(source) === right.getText(source);

/** Collect finite values selected by a real code expression, following only direct const/helper return ownership. */
function codeValues(t, index, info, raw, add, seen = new Set()) {
  const node = unwrap(t, raw);
  const identity = `${info.file}:${node.pos}:${node.end}`;
  if (seen.has(identity)) return;
  const visited = new Set(seen).add(identity);
  if (t.isStringLiteralLike(node)) { add(info, node); return; }
  if (t.isConditionalExpression(node)) {
    selectedMembership(t, index, info, node, add);
    codeValues(t, index, info, node.whenTrue, add, visited);
    codeValues(t, index, info, node.whenFalse, add, visited);
    return;
  }
  if (t.isElementAccessExpression(node)) {
    addCollection(t, index, info, node.expression, add, 'object');
    return;
  }
  const identifier = t.isCallExpression(node) ? node.expression : node;
  const binding = failureBinding(t, index, info, identifier);
  if (!binding) return;
  const value = binding.declaration.initializer;
  const returned = t.isCallExpression(node) ? simpleReturn(t, value) : value;
  if (returned) codeValues(t, index, binding.info, returned, add, visited);
}

const simpleReturn = (t, node) => {
  if (!node || !t.isArrowFunction(node)) return null;
  if (!t.isBlock(node.body)) return node.body;
  return node.body.statements.length === 1 && t.isReturnStatement(node.body.statements[0]) ? node.body.statements[0].expression : null;
};

function selectedMembership(t, index, info, node, add) {
  const condition = unwrap(t, node.condition);
  const selected = t.isBinaryExpression(condition) && condition.operatorToken.kind === t.SyntaxKind.AmpersandAmpersandToken
    ? condition.right : condition;
  const use = membership(t, selected);
  if (use && sameExpression(info.source, use.value, node.whenTrue)) addCollection(t, index, info, use.set, add, 'set');
}

function addCollection(t, index, info, identifier, add, kind, required = false) {
  const binding = failureBinding(t, index, info, identifier);
  const values = failureLiterals(t, binding);
  if (values?.kind !== kind) {
    if (required || binding) throw new Error(`${info.file}: emitted result-code collection is not a closed literal ${kind}`);
    return;
  }
  assertClosedCollection(t, index, values);
  for (const node of values.nodes) add(values.binding.info, node);
}

const staticName = (t, node) => t.isPropertyAccessExpression(node.parent) && node.parent.name === node
  || t.isPropertyAssignment(node.parent) && node.parent.name === node;

function normalizerReference(t, info, identifier) {
  const property = identifier.parent;
  if (!(t.isPropertyAssignment(property) || t.isShorthandPropertyAssignment(property)) || nameText(t, property.name) !== 'resultCodes') return false;
  const spec = property.parent, call = spec.parent;
  return t.isCallExpression(call) && call.arguments[1] === spec && operationSpec(t, info, call) === spec;
}

const collectionRead = (t, info, identifier, kind) => {
  if (normalizerReference(t, info, identifier)) return kind === 'set';
  const parent = identifier.parent;
  if (kind === 'set') return membership(t, parent.parent)?.set === identifier;
  if (!t.isElementAccessExpression(parent) || parent.expression !== identifier) return false;
  return !writeTarget(t, parent);
};

const writeTarget = (t, node) => {
  for (let current = node; current.parent; current = current.parent) if (directWrite(t, current)) return true;
  return false;
};

const directWrite = (t, node) => {
  const parent = node.parent;
  if (t.isDeleteExpression(parent) || t.isPostfixUnaryExpression(parent)) return true;
  if (t.isPrefixUnaryExpression(parent)) return [t.SyntaxKind.PlusPlusToken, t.SyntaxKind.MinusMinusToken].includes(parent.operator);
  return t.isBinaryExpression(parent) && parent.left === node
    && parent.operatorToken.kind >= t.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= t.SyntaxKind.LastAssignment;
};

function assertCollectionUses(t, info, local, declaration, kind) {
  if (info.declarations.get(local) !== 1) throw new Error(`${info.file}: result-code binding ${local} is shadowed`);
  for (const identifier of info.identifiers) {
    if (identifier.text !== local || identifier === declaration || staticName(t, identifier)) continue;
    if (collectionRead(t, info, identifier, kind)) continue;
    const line = info.source.getLineAndCharacterOfPosition(identifier.getStart(info.source)).line + 1;
    throw new Error(`${info.file}:${line}: result-code collection ${local} mutates or escapes its closed validator`);
  }
}

/** Unknown writes or escapes cannot turn an initializer sample into evidence of a closed emitted vocabulary. */
function assertClosedCollection(t, index, values) {
  const {info, declaration} = values.binding, key = `${info.file}:${declaration.pos}`;
  if (index.closedCollections.has(key)) return;
  if (values.kind !== 'set' && values.frozen) { index.closedCollections.add(key); return; }
  assertCollectionUses(t, info, declaration.name.text, declaration.name, values.kind);
  for (const imported of index.importers(info.file, declaration.name.text)) {
    if (imported.unresolved) throw new Error(`${imported.info.file}: result-code namespace or re-export escapes its closed validator`);
    const binding = imported.info.imports.get(imported.local);
    const importName = imported.info.identifiers.find(node => t.isImportSpecifier(node.parent) && node.parent.name === node && node.text === imported.local);
    if (!binding || !importName) throw new Error(`${imported.info.file}: result-code import cannot be resolved`);
    assertCollectionUses(t, imported.info, imported.local, importName, values.kind);
  }
  index.closedCollections.add(key);
}

function operationSpec(t, info, node) {
  if (!t.isCallExpression(node) || !t.isIdentifier(node.expression)) return;
  const imported = info.imports.get(node.expression.text);
  if (imported?.file !== 'scripts/gates/provision-operation.mjs' || imported.name !== 'runProvisionOperation') return;
  if ((info.declarations.get(node.expression.text) ?? 0) !== 1) return;
  const spec = node.arguments[1];
  if (!spec || !t.isObjectLiteralExpression(spec)) throw new Error(`${info.file}: operation result-code spec is not statically owned`);
  assertSpecProperties(t, info, spec);
  return spec;
}

function assertSpecProperties(t, info, spec) {
  if (spec.properties.some(property => t.isSpreadAssignment(property) || property.name && t.isComputedPropertyName(property.name)))
    throw new Error(`${info.file}: operation result-code spec has an unknown spread or computed override`);
  const properties = spec.properties.filter(property => nameText(t, property.name) === 'resultCodes');
  if (properties.length > 1 || properties.some(property => !t.isPropertyAssignment(property) && !t.isShorthandPropertyAssignment(property)))
    throw new Error(`${info.file}: operation result-code ownership is duplicated or dynamic`);
}

function operationCodes(t, index, info, node, add) {
  const spec = operationSpec(t, info, node);
  if (!spec) return;
  for (const property of spec.properties) {
    if (nameText(t, property.name) !== 'resultCodes') continue;
    const value = t.isShorthandPropertyAssignment(property) ? property.name : property.initializer;
    if (value) addCollection(t, index, info, value, add, 'set', true);
  }
}

/** Additional actual emitted literals: code fields, finite membership guards and normalizer result-code declarations. */
export function ownedResultCodes(t, index) {
  const found = new Map();
  const add = (info, node) => {
    const entry = found.get(node.text) ?? {code: node.text, kind: /^[A-Z]/.test(node.text) ? 'upper' : 'kebab', sites: []};
    const line = info.source.getLineAndCharacterOfPosition(node.getStart(info.source)).line + 1;
    if (!entry.sites.some(site => site.file === info.file && site.line === line)) entry.sites.push({file: info.file, line});
    found.set(node.text, entry);
  };
  for (const info of index.values()) {
    const visit = node => {
      if (t.isPropertyAssignment(node) && accessCode(t, node)) codeValues(t, index, info, node.initializer, add);
      operationCodes(t, index, info, node, add);
      t.forEachChild(node, visit);
    };
    visit(info.source);
  }
  return [...found.values()];
}

const accessCode = (t, node) => nameText(t, node.name) === 'code';
