// Evaluate profile guards conservatively: unknown values never exclude a profile.
import { nodeName, resolvedExpression } from './coverage-ast.mjs';

const UNKNOWN = Symbol('unknown profile value');

// binary and kindGuard answer a boolean, or null when undecidable; profileValue maps null to UNKNOWN.
function binary(operator, left, right) {
  if (left === UNKNOWN || right === UNKNOWN) return null;
  if (operator === '===') return left === right;
  if (operator === '!==') return left !== right;
  return null;
}

function logical(context, index, node, profile, seen) {
  if (!['&&', '||'].includes(node.operator)) return UNKNOWN;
  const left = profileValue(context, index, node.left, profile, seen);
  if (node.operator === '&&' && left !== UNKNOWN && !left) return left;
  if (node.operator === '||' && left !== UNKNOWN && left) return left;
  const right = profileValue(context, index, node.right, profile, seen);
  if (left !== UNKNOWN) return right;
  if (node.operator === '&&' && right !== UNKNOWN && !right) return right;
  return UNKNOWN;
}

function conditional(context, index, node, profile, seen) {
  const test = profileValue(context, index, node.test, profile, seen);
  if (test !== UNKNOWN) return profileValue(context, index, test ? node.consequent : node.alternate, profile, seen);
  const yes = profileValue(context, index, node.consequent, profile, seen);
  const no = profileValue(context, index, node.alternate, profile, seen);
  return yes === no ? yes : UNKNOWN;
}

function profileValue(context, index, node, profile, seen = new Set()) {
  if (!node || seen.has(node)) return UNKNOWN;
  const next = new Set(seen).add(node);
  if (node.type === 'Identifier') {
    // Mutable aliases cannot supply evidence for excluding a route.
    if (!index.constants?.has(node.name)) return UNKNOWN;
    const resolved = resolvedExpression(context, index, node);
    return profileValue(context, resolved.index, resolved.node, profile, next);
  }
  switch (node.type) {
    case 'Literal': return node.value;
    case 'MemberExpression': return profileMember(node) ? profile : UNKNOWN;
    case 'CallExpression': return kindGuard(node, profile) ?? UNKNOWN;
    case 'LogicalExpression': return logical(context, index, node, profile, next);
    case 'ConditionalExpression': return conditional(context, index, node, profile, next);
    case 'BinaryExpression': return binary(node.operator,
      profileValue(context, index, node.left, profile, next), profileValue(context, index, node.right, profile, next)) ?? UNKNOWN;
    case 'UnaryExpression': return negated(context, index, node, profile, next);
    default: return UNKNOWN;
  }
}

const profileMember = node => (!node.computed || node.property.type === 'Literal') && nodeName(node.property) === 'profile';

// Architecture config derives kinds from the HFS profile, just as the graph derives profile.
function kindGuard(node, profile) {
  if (node.callee.computed && node.callee.property.type !== 'Literal') return null;
  if (nodeName(node.callee.property) !== 'includes') return null;
  const member = node.callee.object;
  if (member?.type !== 'MemberExpression' || nodeName(member.property) !== 'kinds') return null;
  if (member.computed && member.property.type !== 'Literal') return null;
  const kind = node.arguments[0]?.value;
  if (!['backend', 'frontend'].includes(kind)) return null;
  return kind === (profile === 'be' ? 'backend' : 'frontend');
}

function negated(context, index, node, profile, seen) {
  if (node.operator !== '!') return UNKNOWN;
  const value = profileValue(context, index, node.argument, profile, seen);
  return value === UNKNOWN ? UNKNOWN : !value;
}

export function guardedProfiles(context, index, test, profiles, positive) {
  return profiles.filter(profile => {
    const value = profileValue(context, index, test, profile);
    return value === UNKNOWN || Boolean(value) === positive;
  });
}
