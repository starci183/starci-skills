import { byCodeUnit } from '../../lib/list.mjs';

/**
 * HFS checks 1 and 2 (knowledge/hfs/slots.yaml `tiers`):
 *   1. the tier direction matrix: every import, re-export and type-only import between two owners must go from a tier to
 *      a tier its `mayImport` lists (BE_TIER_DIRECTION / FE_TIER_DIRECTION); a backend feature importing another feature
 *      is the one direction with its own code (BE_FEATURE_IMPORTS_FEATURE, R28), never BE_TIER_DIRECTION, and a feature of one trigger
 *      kind (slot field `trigger`: api, webhooks, realtime, saga, reactors, jobs, cli) importing a feature of another is
 *      BE_KIND_ISOLATION, whose fix is the event bus,
 *      an app never imports another app (BE_SERVICE_ISOLATION / FE_APP_ISOLATION), and a component layer imports only the layers after it;
 *   2. owner cycles: a strongly connected component of the owner graph, type-only imports included (ARCH_OWNER_CYCLE),
 *      reported with the cycle path and the import that closes each hop.
 * Importing inside one owner is always allowed; the public-entry rule stays with owners.mjs (ARCH_OWNER_EXPORT_BYPASS).
 */
export const TIER_RULE_IDS = ['BE_TIER_DIRECTION', 'BE_FEATURE_IMPORTS_FEATURE', 'BE_KIND_ISOLATION', 'BE_SERVICE_ISOLATION', 'FE_TIER_DIRECTION', 'FE_APP_ISOLATION', 'ARCH_OWNER_CYCLE'];

function tierDirectionText({ fromTier, toTier, mayImport, kindRestriction, fromKind, toKind }) {
  if (!kindRestriction) return `a ${fromTier} may import only ${mayImport.join(', ') || 'nothing'}; it imports a ${toTier}`;
  const source = fromKind ?? 'no folder kind';
  const target = toKind ?? 'no folder kind';
  return `a ${fromTier} may import ${toTier} owners only from kinds ${kindRestriction.from.join(', ')} to kinds ${kindRestriction.to.join(', ')}; it imports ${source} -> ${target}`;
}

const REASON_TEXT = {
  tierDirection: tierDirectionText,
  layerOrder: ({ fromLayer, toLayer }) => `a ${fromLayer} component may import only the layers after it; it imports a ${toLayer}`,
  crossApp: ({ from, to }) => `app ${from} imports app ${to}; apps never import each other, shared code is a packages/<pkg> slot`,
};

/** Strongly connected components (Tarjan, iterative) of `adjacency` (Map<node, Set<node>>); components of one node are dropped. */
function startTraversal(state, adjacency, node) {
  const at = state.counter;
  state.counter += 1;
  state.index.set(node, at);
  state.low.set(node, at);
  state.stack.push(node);
  state.onStack.add(node);
  state.work.push({ node, iterator: adjacency.get(node)[Symbol.iterator]() });
}

function visitTarget(state, adjacency, frame, target) {
  if (!adjacency.has(target)) return;
  if (!state.index.has(target)) {
    startTraversal(state, adjacency, target);
    return;
  }
  if (state.onStack.has(target)) state.low.set(frame.node, Math.min(state.low.get(frame.node), state.index.get(target)));
}

function closeComponent(state, frame) {
  const component = [];
  let member;
  do {
    member = state.stack.pop();
    state.onStack.delete(member);
    component.push(member);
  } while (member !== frame.node);
  if (component.length > 1) state.result.push(component);
}

function finishFrame(state, frame) {
  state.work.pop();
  if (state.work.length) {
    const parent = state.work.at(-1).node;
    state.low.set(parent, Math.min(state.low.get(parent), state.low.get(frame.node)));
  }
  if (state.low.get(frame.node) === state.index.get(frame.node)) closeComponent(state, frame);
}

function stronglyConnected(adjacency) {
  const state = { counter: 0, index: new Map(), low: new Map(), onStack: new Set(), stack: [], result: [], work: [] };
  for (const start of adjacency.keys()) {
    if (state.index.has(start)) continue;
    startTraversal(state, adjacency, start);
    for (let frame = state.work.at(-1); frame; frame = state.work.at(-1)) {
      const next = frame.iterator.next();
      if (next.done) {
        finishFrame(state, frame);
        continue;
      }
      visitTarget(state, adjacency, frame, next.value);
    }
  }
  return state.result;
}

/** A shortest cycle through `origin` inside `members`, as a node path that starts and ends at origin. */
function cycleThrough(adjacency, members, origin) {
  const queue = [[origin]];
  const seen = new Set();
  while (queue.length) {
    const trail = queue.shift();
    for (const next of adjacency.get(trail.at(-1)) ?? []) {
      if (!members.has(next)) continue;
      if (next === origin) return [...trail, origin];
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([...trail, next]);
    }
  }
  return [origin, origin];
}

/** The trigger kind (slot field `trigger`) of the owner that holds `file`, or null when its owner's slot names none. */
const triggerOf = (resolver, file) => {
  const owner = resolver.ownerOf(file);
  return owner ? (resolver.slot(owner.slot)?.trigger ?? null) : null;
};

function reportReasonedTierViolation(graph, edge, verdict, tierRule, counts, violations) {
  if (verdict.allowed || !REASON_TEXT[verdict.reason]) return;
  counts[verdict.reason] += 1;
  const featureToFeature = graph.profile === 'be' && verdict.reason === 'tierDirection' && verdict.fromTier === 'feature' && verdict.toTier === 'feature';
  const fromKind = featureToFeature ? triggerOf(graph.resolver, edge.from) : null;
  const toKind = featureToFeature ? triggerOf(graph.resolver, edge.to) : null;
  const crossKind = fromKind !== null && toKind !== null && fromKind !== toKind;
  let ruleId = tierRule;
  if (featureToFeature) ruleId = 'BE_FEATURE_IMPORTS_FEATURE';
  if (crossKind) ruleId = 'BE_KIND_ISOLATION';
  if (verdict.reason === 'crossApp') ruleId = graph.profile === 'be' ? 'BE_SERVICE_ISOLATION' : 'FE_APP_ISOLATION';
  const typeOnly = edge.runtime ? '' : ' (type-only imports count)';
  const message = crossKind
    ? `${edge.from} -> ${edge.to}: a ${fromKind} feature imports a ${toKind} feature; no kind imports another, every cross-kind call is an event published with eventBus.publish(event, tx) from a domain service${typeOnly}.`
    : `${edge.from} -> ${edge.to}: ${REASON_TEXT[verdict.reason](verdict)}${typeOnly}.`;
  violations.push({
    ruleId,
    path: edge.from, line: edge.line, column: edge.column,
    specifier: edge.specifier, resolvedPath: edge.to, typeOnly: !edge.runtime,
    fromTier: verdict.fromTier ?? null, toTier: verdict.toTier ?? null,
    message,
  });
}

function inspectTierEdge(graph, edge, tierRule, counts, violations, coverage) {
  const verdict = graph.resolver.importAllowed(edge.from, edge.to);
  if (verdict.reason === 'unowned' || verdict.reason?.startsWith('slot')) {
    coverage.unclassifiedEdges += 1;
    return;
  }
  coverage.edgesChecked += 1;
  reportReasonedTierViolation(graph, edge, verdict, tierRule, counts, violations);
}

function ownerAdjacency(graph, resolver) {
  const adjacency = new Map();
  const witness = new Map();
  for (const edge of graph.edges) {
    const a = graph.unit(edge.from);
    const b = graph.unit(edge.to);
    if (!a || !b || a === b) continue;
    if (resolver.tierOf(edge.from) === 'none' || resolver.tierOf(edge.to) === 'none') continue;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    if (!witness.has(`${a}\0${b}`)) witness.set(`${a}\0${b}`, edge);
  }
  return { adjacency, witness };
}

function addOwnerCycleViolations(graph, adjacency, witness, violations) {
  const components = stronglyConnected(adjacency);
  for (const component of components) {
    const members = new Set(component);
    const origin = [...component].sort(byCodeUnit)[0];
    const cycle = cycleThrough(adjacency, members, origin);
    const hops = cycle.slice(0, -1).map((unit, i) => witness.get(`${unit}\0${cycle[i + 1]}`));
    const label = unit => unit.slice(unit.indexOf(':') + 1) || unit;
    const first = hops[0];
    const connectedOwners = component.length > cycle.length - 1 ? ` (strongly connected with ${component.length} owners)` : '';
    violations.push({
      ruleId: 'ARCH_OWNER_CYCLE',
      path: first.from, line: first.line, column: first.column,
      cycle: cycle.map(label),
      cycleImports: hops.map(hop => ({ path: hop.from, line: hop.line, specifier: hop.specifier, typeOnly: !hop.runtime })),
      componentSize: component.length,
      message: `Owner cycle: ${cycle.map(label).join(' -> ')}${connectedOwners}; type-only imports count.`,
    });
  }
  return components.length;
}

export function checkTiers(graph) {
  const { resolver, profile } = graph;
  const violations = [];
  const tierRule = profile === 'be' ? 'BE_TIER_DIRECTION' : 'FE_TIER_DIRECTION';
  const coverage = { edgesChecked: 0, unclassifiedEdges: 0 };
  const counts = { tierDirection: 0, layerOrder: 0, crossApp: 0 };
  for (const edge of graph.edges) inspectTierEdge(graph, edge, tierRule, counts, violations, coverage);

  // Owner cycles: nodes are owner units, edges the imports between two distinct units.
  const { adjacency, witness } = ownerAdjacency(graph, resolver);
  const cycles = addOwnerCycleViolations(graph, adjacency, witness, violations);
  return {
    violations,
    coverage: { status: 'checked', ...coverage, ownerUnits: adjacency.size, cycles, ...counts },
  };
}
