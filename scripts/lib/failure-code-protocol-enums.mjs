// A protocol value is not an emitted failure merely because its spelling is UPPER_SNAKE.
// Exclusions name exact AST quote offsets: validated CLI-owned membership declarations and boolean recognition guards.
import {accessName, isConstVariable} from './ts-ast.mjs';
import {failureLiterals} from './failure-code-owned-results.mjs';
import {envFacts} from './env-source-facts.mjs';

const sameValues = (left, right) => left.length === right.length && new Set(left).size === left.length
  && left.every(value => right.includes(value));

const privateTopLevel = (t, declaration) => isConstVariable(t, declaration)
  && t.isVariableStatement(declaration.parent.parent) && t.isSourceFile(declaration.parent.parent.parent)
  && !declaration.parent.parent.modifiers?.some(modifier => modifier.kind === t.SyntaxKind.ExportKeyword);

function membershipField(t, identifier) {
  const access = identifier.parent, call = access?.parent;
  if (!access || !t.isPropertyAccessExpression(access) || access.expression !== identifier || access.name.text !== 'has'
      || !call || !t.isCallExpression(call) || call.expression !== access || call.arguments.length !== 1) return null;
  return accessName(t, call.arguments[0]);
}

function enumDeclaration(t, info, declaration, enums) {
  if (!privateTopLevel(t, declaration) || /(?:codes|reasons|kinds|classes)$/i.test(declaration.name.text)
      || info.declarations.get(declaration.name.text) !== 1) return null;
  const literals = failureLiterals(t, {info, declaration});
  if (literals?.kind !== 'set') return null;
  const values = literals.nodes.map(node => node.text);
  const owners = enums.filter(owner => owner.module === info.file && sameValues(values, owner.values));
  const references = info.identifiers.filter(node => node.text === declaration.name.text && node !== declaration.name);
  if (!references.length) return null;
  return owners.some(owner => references.every(reference => membershipField(t, reference) === owner.name)) ? literals.nodes : null;
}

const functionNode = (t, node) => t.isArrowFunction(node) || t.isFunctionExpression(node) || t.isFunctionDeclaration(node);
const assignment = (t, node) => t.isBinaryExpression(node)
  && node.operatorToken.kind >= t.SyntaxKind.FirstAssignment && node.operatorToken.kind <= t.SyntaxKind.LastAssignment;

function booleanExpression(t, node, info) {
  if (!node) return false;
  if (t.isParenthesizedExpression(node)) return booleanExpression(t, node.expression, info);
  if (booleanAtom(t, node, info)) return true;
  if (!t.isBinaryExpression(node)) return false;
  if (['===', '!==', '==', '!=', '<', '>', '<=', '>=', 'in', 'instanceof'].includes(node.operatorToken.getText(info.source))) return true;
  return [t.SyntaxKind.AmpersandAmpersandToken, t.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)
    && booleanExpression(t, node.left, info) && booleanExpression(t, node.right, info);
}

const booleanAtom = (t, node, info) => {
  if (node.kind === t.SyntaxKind.TrueKeyword || node.kind === t.SyntaxKind.FalseKeyword) return true;
  if (t.isPrefixUnaryExpression(node) && node.operator === t.SyntaxKind.ExclamationToken) return true;
  return t.isCallExpression(node) && t.isIdentifier(node.expression) && node.expression.text === 'Boolean' && !info.declarations.has('Boolean');
};

/** A block predicate has only boolean returns and no assignment/update/delete; nested functions are separate owners. */
function booleanPredicate(t, info, node) {
  const last = node.body && t.isBlock(node.body) ? node.body.statements.at(-1) : null;
  if (!last || !t.isReturnStatement(last)) return false;
  let returns = 0, valid = true;
  const visit = child => {
    if (child !== node && functionNode(t, child)) return;
    if (assignment(t, child) || t.isDeleteExpression(child) || t.isPostfixUnaryExpression(child)) valid = false;
    if (t.isPrefixUnaryExpression(child) && [t.SyntaxKind.PlusPlusToken, t.SyntaxKind.MinusMinusToken].includes(child.operator)) valid = false;
    if (t.isReturnStatement(child)) { returns += 1; valid &&= booleanExpression(t, child.expression, info); }
    t.forEachChild(child, visit);
  };
  visit(node.body);
  return valid && returns > 0;
}

const returnsFalse = (t, node) => t.isReturnStatement(node) && node.expression?.kind === t.SyntaxKind.FalseKeyword
  || t.isBlock(node) && node.statements.length === 1 && returnsFalse(t, node.statements[0]);

function guardQuotes(t, source, expression, offsets) {
  const visit = node => {
    if (t.isBinaryExpression(node) && [t.SyntaxKind.EqualsEqualsEqualsToken, t.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.operatorToken.kind)) {
      for (const operand of [node.left, node.right]) if (t.isStringLiteralLike(operand)) offsets.add(operand.getStart(source));
    }
    // A literal inside another call or a nested function is not the guard's direct recognition operand.
    if (t.isCallExpression(node) || functionNode(t, node)) return;
    t.forEachChild(node, visit);
  };
  visit(expression);
}

function predicateQuotes(t, info, predicate, offsets) {
  if (!booleanPredicate(t, info, predicate)) return;
  const visit = node => {
    if (node !== predicate && functionNode(t, node)) return;
    if (t.isIfStatement(node) && returnsFalse(t, node.thenStatement)) guardQuotes(t, info.source, node.expression, offsets);
    t.forEachChild(node, visit);
  };
  visit(predicate.body);
}

/** Offsets excluded from UPPER literal discovery only; code/reason/throw/list/bracket sites are never value-exempt. */
export function protocolEnumOffsets(t, index, enums) {
  const found = new Map();
  for (const info of index.values()) {
    const offsets = new Set();
    for (const declaration of info.bindings.values()) {
      if (declaration) for (const node of enumDeclaration(t, info, declaration, enums) ?? []) offsets.add(node.getStart(info.source));
    }
    const visit = node => {
      if (functionNode(t, node)) predicateQuotes(t, info, node, offsets);
      t.forEachChild(node, visit);
    };
    visit(info.source);
    found.set(info.file, offsets);
  }
  return found;
}

function envObject(t, node, aliases) {
  const parent = node.parent;
  if (t.isVariableDeclaration(parent)) return t.isIdentifier(parent.name) && aliases.has(parent.name.text) && isConstVariable(t, parent);
  return t.isPropertyAssignment(parent) && aliases.has(accessName(t, parent.name) ?? parent.name.text);
}

function envInput(t, node, aliases) {
  if (t.isIdentifier(node)) return aliases.has(node.text);
  return t.isBinaryExpression(node) && node.operatorToken.kind === t.SyntaxKind.QuestionQuestionToken
    && t.isIdentifier(node.left) && aliases.has(node.left.text) && t.isObjectLiteralExpression(node.right) && node.right.properties.length === 0;
}

function entriesFilter(t, node, aliases) {
  if (!t.isCallExpression(node) || !t.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'filter') return null;
  const entries = node.expression.expression;
  if (!t.isCallExpression(entries) || entries.expression.getText() !== 'Object.entries' || !entries.arguments[0] || !envInput(t, entries.arguments[0], aliases)) return null;
  const callback = node.arguments[0];
  if (!callback || !t.isArrowFunction(callback) || t.isBlock(callback.body)) return null;
  const parameter = callback.parameters[0]?.name;
  const key = parameter && t.isArrayBindingPattern(parameter) ? parameter.elements[0]?.name : null;
  return key && t.isIdentifier(key) ? {callback, key: key.text} : null;
}

function projectionUses(t, source, aliases) {
  const uses = new Map();
  const visit = node => {
    const filter = entriesFilter(t, node, aliases);
    if (filter) {
      const membership = child => {
        if (functionNode(t, child)) return;
        if (t.isCallExpression(child) && t.isPropertyAccessExpression(child.expression) && child.expression.name.text === 'has'
            && t.isIdentifier(child.expression.expression) && child.arguments.length === 1
            && t.isIdentifier(child.arguments[0]) && child.arguments[0].text === filter.key) {
          const identifier = child.expression.expression, refs = uses.get(identifier.text) ?? new Set();
          refs.add(identifier); uses.set(identifier.text, refs);
        }
        t.forEachChild(child, membership);
      };
      membership(filter.callback.body);
    }
    t.forEachChild(node, visit);
  };
  visit(source);
  return uses;
}

function arrayQuotes(t, source, node, offsets) {
  if (t.isStringLiteralLike(node)) { offsets.add(node.getStart(source)); return; }
  if (t.isArrayLiteralExpression(node)) {
    for (const element of node.elements) if (t.isStringLiteralLike(element) || t.isArrayLiteralExpression(element)) arrayQuotes(t, source, element, offsets);
    return;
  }
  if (!t.isCallExpression(node) || !t.isPropertyAccessExpression(node.expression)) return;
  if (!['filter', 'concat'].includes(node.expression.name.text)) return;
  arrayQuotes(t, source, node.expression.expression, offsets);
  if (node.expression.name.text === 'concat') for (const argument of node.arguments) arrayQuotes(t, source, argument, offsets);
}

function projectedQuotes(t, info, uses, offsets) {
  for (const [name, references] of uses) {
    if (!/_ENV(?:_|$)/.test(name)) continue;
    const declaration = info.bindings.get(name);
    if (!declaration || !privateTopLevel(t, declaration) || info.declarations.get(name) !== 1) continue;
    const others = info.identifiers.filter(node => node.text === name && node !== declaration.name);
    if (!others.every(node => references.has(node))) continue;
    const value = declaration.initializer;
    if (!value || !t.isNewExpression(value) || !t.isIdentifier(value.expression) || value.expression.text !== 'Set' || value.arguments?.length !== 1) continue;
    arrayQuotes(t, info.source, value.arguments[0], offsets);
  }
}

/** Only literal key positions of an environment object or a private Set selecting Object.entries(env) are excluded. */
export function environmentOffsets(t, index) {
  const found = new Map();
  for (const info of index.values()) {
    const offsets = new Set(), {aliases} = envFacts(info.source.text, info.file);
    const visit = node => {
      if (t.isObjectLiteralExpression(node) && envObject(t, node, aliases)) {
        for (const property of node.properties) if (t.isPropertyAssignment(property) && t.isStringLiteralLike(property.name)) offsets.add(property.name.getStart(info.source));
      }
      t.forEachChild(node, visit);
    };
    visit(info.source);
    if (!info.declarations.has('Object') && !info.declarations.has('Set')) projectedQuotes(t, info, projectionUses(t, info.source, aliases), offsets);
    found.set(info.file, offsets);
  }
  return found;
}

const loopNode = (t, node) => t.isForStatement(node) || t.isForInStatement(node) || t.isForOfStatement(node)
  || t.isWhileStatement(node) || t.isDoStatement(node);

function loopCatch(t, statement) {
  let caught = null, loop = false;
  for (let node = statement.parent; node; node = node.parent) {
    if (functionNode(t, node)) return null;
    if (!caught && t.isCatchClause(node)) caught = node;
    if (loopNode(t, node)) loop = true;
    if (caught && loop) return caught;
  }
  return null;
}

function stableCatch(t, caught, name) {
  let valid = true;
  const declarations = ['VariableDeclaration', 'Parameter', 'BindingElement', 'FunctionDeclaration', 'FunctionExpression', 'ClassDeclaration', 'ClassExpression'];
  const visit = node => {
    if (declarations.some(kind => node.kind === t.SyntaxKind[kind]) && node.name && t.isIdentifier(node.name) && node.name.text === name) valid = false;
    if (assignment(t, node) || t.isDeleteExpression(node) || t.isPostfixUnaryExpression(node)) valid = false;
    if (t.isPrefixUnaryExpression(node) && [t.SyntaxKind.PlusPlusToken, t.SyntaxKind.MinusMinusToken].includes(node.operator)) valid = false;
    t.forEachChild(node, visit);
  };
  visit(caught.block);
  return valid;
}

/** A catch's own error-code comparison may only select a bare continue of a containing loop. */
export function catchRecognitionOffsets(t, index) {
  const found = new Map();
  for (const info of index.values()) {
    const offsets = new Set();
    const visit = node => {
      if (t.isIfStatement(node) && !node.elseStatement && t.isContinueStatement(node.thenStatement) && !node.thenStatement.label
          && t.isBinaryExpression(node.expression)
          && [t.SyntaxKind.EqualsEqualsEqualsToken, t.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.expression.operatorToken.kind)) {
        const caught = loopCatch(t, node), binding = caught?.variableDeclaration?.name;
        if (binding && t.isIdentifier(binding) && stableCatch(t, caught, binding.text)) {
          for (const [access, literal] of [[node.expression.left, node.expression.right], [node.expression.right, node.expression.left]]) {
            if (t.isPropertyAccessExpression(access) && t.isIdentifier(access.expression) && access.expression.text === binding.text
                && access.name.text === 'code' && t.isStringLiteralLike(literal)) offsets.add(literal.getStart(info.source));
          }
        }
      }
      t.forEachChild(node, visit);
    };
    visit(info.source);
    found.set(info.file, offsets);
  }
  return found;
}
