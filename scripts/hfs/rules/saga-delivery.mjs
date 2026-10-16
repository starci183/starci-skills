// Trace the delivery parameter into command constructor arguments, rather than arbitrary reads.
import { accessName, isConstVariable } from '../../lib/ts-ast.mjs';
import { sourceValue } from './database-queue-sources.mjs';

function unwrap(ts, node) {
  const value = sourceValue(ts, node);
  return value && ts.isNonNullExpression(value) ? unwrap(ts, value.expression) : value;
}

function resolve(ts, node, aliases, seen = new Set()) {
  const value = unwrap(ts, node);
  if (!value || !ts.isIdentifier(value) || !aliases.has(value.text) || seen.has(value.text)) return value;
  return resolve(ts, aliases.get(value.text), aliases, new Set(seen).add(value.text));
}

function carriesKey(ts, node, delivery, aliases, seen = new Set()) {
  const value = resolve(ts, node, aliases);
  if (!value || seen.has(value)) return false;
  const next = new Set(seen).add(value);
  if (accessName(ts, value) === 'eventId') {
    const receiver = resolve(ts, value.expression, aliases);
    return ts.isIdentifier(receiver) && receiver.text === delivery;
  }
  if (ts.isObjectLiteralExpression(value)) return value.properties.some((property) => carriesKey(ts, property, delivery, aliases, next));
  if (ts.isPropertyAssignment(value)) return carriesKey(ts, value.initializer, delivery, aliases, next);
  if (ts.isShorthandPropertyAssignment(value)) return carriesKey(ts, value.name, delivery, aliases, next);
  if (ts.isArrayLiteralExpression(value)) return value.elements.some((element) => carriesKey(ts, element, delivery, aliases, next));
  return false;
}

function localAliases(ts, method) {
  const aliases = new Map();
  for (const statement of method.body?.statements ?? []) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer && isConstVariable(ts, declaration)) aliases.set(declaration.name.text, declaration.initializer);
    }
  }
  return aliases;
}

function methodForwards(ts, method) {
  const parameter = method.parameters[0]?.name;
  if (!parameter || !ts.isIdentifier(parameter)) return false;
  const aliases = localAliases(ts, method);
  const commands = [];
  const visit = (node) => {
    // A read in a nested function does not forward the handler's delivery.
    if (ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node) && accessName(ts, node.expression) === 'execute') commands.push(resolve(ts, node.arguments[0], aliases));
    ts.forEachChild(node, visit);
  };
  if (method.body) visit(method.body);
  return commands.length > 0 && commands.every((command) => command && ts.isNewExpression(command)
    && (command.arguments ?? []).some((argument) => carriesKey(ts, argument, parameter.text, aliases)));
}

export function forwardsDeliveryKey(ts, source) {
  const handlers = [];
  const visit = (node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'handle') handlers.push(node);
    else ts.forEachChild(node, visit);
  };
  visit(source);
  return handlers.length > 0 && handlers.every((method) => methodForwards(ts, method));
}
