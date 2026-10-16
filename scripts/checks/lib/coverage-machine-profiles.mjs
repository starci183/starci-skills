// Follow invoked machine functions so caller guards also constrain delegated emitters.
import { expressionReach, resolvedExpression, sourceIndex } from './coverage-ast.mjs';
import { guardedProfiles } from './coverage-profiles.mjs';

export function invokedMachineProfiles(context, machine, file, code) {
  const index = sourceIndex(context, machine);
  const entry = index.exports.get('checkArchitecture');
  if (!entry) return null;
  const reached = new Set();
  const visited = new Set();

  function invoke(scope, expression, profiles) {
    const target = resolvedExpression(context, scope, expression);
    if (!['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(target.node?.type)) return;
    const key = `${target.index.file}:${target.node.start}:${profiles.join(',')}`;
    if (visited.has(key)) return;
    visited.add(key);
    if (target.index.file === file && reachesCode(context, target, code)) profiles.forEach(profile => reached.add(profile));
    walk(target.index, target.node.body, profiles);
  }

  function walk(scope, node, profiles) {
    if (!node || !profiles.length || node.type === 'FunctionDeclaration') return;
    if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
      walk(scope, node.test, profiles);
      walk(scope, node.consequent, guardedProfiles(context, scope, node.test, profiles, true));
      walk(scope, node.alternate, guardedProfiles(context, scope, node.test, profiles, false));
      return;
    }
    if (node.type === 'CallExpression') invoke(scope, node.callee, profiles);
    for (const child of Object.values(node).flat().filter(value => value?.type)) walk(scope, child, profiles);
  }

  invoke(index, entry, ['be', 'fe']);
  return reached.size ? [...reached] : null;
}

function reachesCode(context, target, code) {
  return [...expressionReach(context, target.index, target.node).values()].some(nodes =>
    nodes.some(node => node.type === 'Literal' && node.value === code));
}
