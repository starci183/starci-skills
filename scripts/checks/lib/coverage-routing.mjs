// A source finding removed from app check must reach its profile's actual lint plugin.
import { enforcerJudgedInEdition } from '../../hfs/edition-slots.mjs';
import { guardedProfiles } from './coverage-profiles.mjs';
import { invokedMachineProfiles } from './coverage-machine-profiles.mjs';
import { astNodes, expressionReach, nodeName, objectProperties, resolvedExpression, sourceIndex, staticValues } from './coverage-ast.mjs';

const SURFACE = 'scripts/hfs/architecture/surface.mjs';
const MACHINE = 'scripts/hfs/architecture/index.mjs';
const routeBinding = ['LINT', 'ENFORCERS'].join('_');
const profiles = ['be', 'fe'];
const planned = (entry) => entry.planned || entry.status === 'planned';

function surfaceEntry(context, index, node) {
  if (node.type !== 'CallExpression' || node.callee.name !== 'enforcer') return null;
  const [id, pluginNames, codes] = node.arguments;
  if (typeof id?.value !== 'string') return null;
  return { id: id.value, plugins: staticValues(context, index, pluginNames), codes: staticValues(context, index, codes) };
}

function lintRoutes(context) {
  const index = sourceIndex(context, SURFACE);
  return astNodes(index.tree).map((node) => surfaceEntry(context, index, node)).filter(Boolean);
}

function contributionBindings(index) {
  const roots = [index.bindings.get('CONTRIBUTIONS')];
  for (const node of astNodes(index.tree)) {
    if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') continue;
    if (node.callee.object.name === 'CONTRIBUTIONS' && nodeName(node.callee.property) === 'push') roots.push(...node.arguments);
  }
  return roots.flatMap((root) => astNodes(root)).filter((node) => node.type === 'Property' && nodeName(node.key) === 'rules').map((node) => node.value);
}

function generatedGraphRules(context, index, routes, profile) {
  const imported = [...index.imports.values()].some((entry) => entry.name === routeBinding && entry.source.endsWith('/architecture/surface.mjs'));
  const generated = astNodes(index.exports.get('rules')).some((node) => node.type === 'CallExpression'
    && node.callee.type === 'MemberExpression' && node.callee.object.name === 'Object' && nodeName(node.callee.property) === 'fromEntries');
  const filtered = astNodes(index.tree).some((node) => node.type === 'CallExpression'
    && node.callee.type === 'MemberExpression' && nodeName(node.callee.property) === 'includes' && node.arguments[0]?.value === profile);
  if (!imported || !generated || !filtered) return [];
  return routes.filter((route) => route.plugins.includes(profile)).map((route) => ({ id: route.id, file: index.file, codes: route.codes }));
}

function whyAssignments(context, index, why) {
  const target = resolvedExpression(context, why, why.exports.get('why'));
  const entries = [];
  for (const statement of index.tree?.body ?? []) {
    const call = statement.type === 'ExpressionStatement' ? statement.expression : null;
    if (call?.type !== 'CallExpression' || call.callee.type !== 'MemberExpression'
      || call.callee.object.name !== 'Object' || nodeName(call.callee.property) !== 'assign') continue;
    if (resolvedExpression(context, index, call.callee.object).node !== call.callee.object) continue;
    const assigned = resolvedExpression(context, index, call.arguments[0]);
    if (assigned.index.file !== target.index.file || assigned.node !== target.node) continue;
    for (const source of call.arguments.slice(1)) entries.push(...objectProperties(context, index, source));
  }
  return entries;
}

function applyWhyCodes(context, registered, why) {
  const entries = objectProperties(context, why, why.exports.get('why'));
  const sources = new Set([why.file, ...[...registered.values()].map(entry => entry.file)]);
  for (const file of sources) entries.push(...whyAssignments(context, sourceIndex(context, file), why));
  for (const entry of entries) {
    const value = objectProperties(context, entry.index, entry.node).find(property => property.name === 'code')?.node.value;
    if (registered.has(entry.name) && typeof value === 'string') registered.get(entry.name).code = value;
  }
}

/** Only contributions gathered by index.mjs count as shipped plugin rules. */
export function registeredLintRules(context, kind) {
  const profile = kind.slice(7);
  const index = sourceIndex(context, `packages/eslint/${profile}/index.mjs`);
  const routes = lintRoutes(context);
  const entries = contributionBindings(index).map((node) => resolvedExpression(context, index, node));
  if (!entries.length) entries.push({ index, node: index.exports.get('rules') });
  const out = new Map();
  for (const entry of entries) {
    for (const property of objectProperties(context, entry.index, entry.node)) out.set(property.name, {
      id: property.name, file: property.index.file, index: property.index, expression: property.node,
    });
    for (const rule of generatedGraphRules(context, entry.index, routes, profile)) out.set(rule.id, rule);
  }
  const why = sourceIndex(context, `packages/eslint/${profile}/lib/why.mjs`);
  applyWhyCodes(context, out, why);
  return out;
}

function registeredCode(rule, entry, shipped, code, routes) {
  if (shipped.code) return shipped.code === code;
  if (shipped.codes) return shipped.codes.includes(code);
  const routed = routes.filter((route) => route.id === entry.id && route.plugins.includes(entry.kind.slice(7)));
  if (routed.length) return routed.some((route) => route.codes.includes(code));
  return rule.code === code;
}

export function lintEnforcersForCode(context, rule, code, edition) {
  const routes = lintRoutes(context);
  return (rule.enforcers ?? []).filter((entry) => {
    if (planned(entry) || !['eslint-be', 'eslint-fe'].includes(entry.kind)) return false;
    if (!enforcerJudgedInEdition(context.catalog.rules, entry.kind, entry.id, edition)) return false;
    const shipped = registeredLintRules(context, entry.kind).get(entry.id);
    return shipped && registeredCode(rule, entry, shipped, code, routes);
  });
}

function emittedProfiles(context, index, code, initial) {
  const out = new Set();
  const pending = index.tree ? [{ node: index.tree, active: initial, parent: null }] : [];
  while (pending.length) {
    const { node, active, parent } = pending.pop();
    if (node.type === 'Literal' && node.value === code && parent?.type !== 'ArrayExpression') active.forEach((profile) => out.add(profile));
    if (node.type === 'ConditionalExpression' || node.type === 'IfStatement') {
      pending.push({ node: node.consequent, active: guardedProfiles(context, index, node.test, active, true), parent: node });
      if (node.alternate) pending.push({ node: node.alternate, active: guardedProfiles(context, index, node.test, active, false), parent: node });
      continue;
    }
    for (const child of Object.values(node).flat().filter((value) => value?.type)) pending.push({ node: child, active, parent: node });
  }
  return out;
}

function tableEntryEmits(context, index, entry, file, code) {
  const names = astNodes(entry.node).filter((node) => node.type === 'Identifier' && index.imports.get(node.name)?.file === file);
  return names.some((node) => {
    const resolved = resolvedExpression(context, index, node);
    if (!['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(resolved.node?.type)) return false;
    return [...expressionReach(context, resolved.index, resolved.node).values()].some((nodes) =>
      nodes.some((item) => item.type === 'Literal' && typeof item.value === 'string' && item.value.includes(code)));
  });
}

function machineTableProfiles(context, file, code) {
  const index = sourceIndex(context, MACHINE);
  const selected = profiles.filter((profile) => objectProperties(context, index, index.bindings.get([profile === 'be' ? 'BACKEND' : 'FRONTEND', 'MACHINE'].join('_')))
    .some((entry) => tableEntryEmits(context, index, entry, file, code)));
  return selected.length ? selected : invokedMachineProfiles(context, MACHINE, file, code) ?? profiles;
}

function machineProfiles(context, rule, code, edition) {
  const out = new Set();
  for (const entry of rule.enforcers ?? []) {
    if (entry.kind !== 'machine' || planned(entry) || !entry.at) continue;
    if (!enforcerJudgedInEdition(context.catalog.rules, entry.kind, entry.id, edition)) continue;
    const index = sourceIndex(context, entry.at);
    emittedProfiles(context, index, code, machineTableProfiles(context, entry.at, code)).forEach((profile) => out.add(profile));
  }
  return out;
}

export function coverageRoutingFindings(context, rule, code, edition) {
  const routes = lintRoutes(context).filter((entry) => entry.codes.includes(code));
  if (!routes.length) return [];
  const relevant = machineProfiles(context, rule, code, edition);
  if (!relevant.size) routes.flatMap((route) => route.plugins).forEach((profile) => relevant.add(profile));
  const built = lintEnforcersForCode(context, rule, code, edition);
  return [...relevant].filter((profile) => !built.some((entry) => entry.kind === `eslint-${profile}` && routes.some((route) => route.id === entry.id && route.plugins.includes(profile))))
    .map((profile) => ({ code: 'RT_COVERAGE_CODE_UNROUTED', level: 'error', rule: rule.id, edition, path: SURFACE,
      message: `${rule.id} ${edition}: ${code} is removed from app check but has no applicable registered enforcer in the ${profile} lint plugin` }));
}
