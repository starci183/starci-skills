/**
 * HFS checks 1 and 2 (knowledge/hfs/slots.yaml `tiers`):
 *   1. the tier direction matrix: every import, re-export and type-only import between two owners must go from a tier to
 *      a tier its `mayImport` lists (BE_TIER_DIRECTION / FE_TIER_DIRECTION); a backend feature importing another feature
 *      is the one direction with its own code (BE_FEATURE_IMPORTS_FEATURE, R28), never BE_TIER_DIRECTION, and a feature of one trigger
 *      kind (slot field `trigger`: api, webhooks, realtime, saga, reactors, jobs, cli) importing a feature of another is
 *      BE_KIND_ISOLATION, whose fix is the event bus,
 *      an app never imports another app (FE_APP_ISOLATION), and a component layer imports only the layers after it;
 *   2. owner cycles: a strongly connected component of the owner graph, type-only imports included (ARCH_OWNER_CYCLE),
 *      reported with the cycle path and the import that closes each hop.
 * Importing inside one owner is always allowed; the public-entry rule stays with owners.mjs (ARCH_OWNER_EXPORT_BYPASS).
 */
export const TIER_RULE_IDS = ['BE_TIER_DIRECTION', 'BE_FEATURE_IMPORTS_FEATURE', 'BE_KIND_ISOLATION', 'FE_TIER_DIRECTION', 'FE_APP_ISOLATION', 'ARCH_OWNER_CYCLE'];

const REASON_TEXT = {
  tierDirection: ({ fromTier, toTier, mayImport }) => `a ${fromTier} may import only ${mayImport.join(', ') || 'nothing'}; it imports a ${toTier}`,
  layerOrder: ({ fromLayer, toLayer }) => `a ${fromLayer} component may import only the layers after it; it imports a ${toLayer}`,
  crossApp: ({ from, to }) => `app ${from} imports app ${to}; apps never import each other, shared code is a packages/<pkg> slot`,
};

/** Strongly connected components (Tarjan, iterative) of `adjacency` (Map<node, Set<node>>); components of one node are dropped. */
export function stronglyConnected(adjacency) {
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const result = [];
  for (const start of adjacency.keys()) {
    if (index.has(start)) continue;
    const work = [{ node: start, iterator: adjacency.get(start)[Symbol.iterator]() }];
    index.set(start, counter); low.set(start, counter); counter += 1; stack.push(start); onStack.add(start);
    while (work.length) {
      const frame = work.at(-1);
      const next = frame.iterator.next();
      if (!next.done) {
        const target = next.value;
        if (!adjacency.has(target)) continue;
        if (!index.has(target)) {
          index.set(target, counter); low.set(target, counter); counter += 1; stack.push(target); onStack.add(target);
          work.push({ node: target, iterator: adjacency.get(target)[Symbol.iterator]() });
        } else if (onStack.has(target)) low.set(frame.node, Math.min(low.get(frame.node), index.get(target)));
        continue;
      }
      work.pop();
      if (work.length) { const parent = work.at(-1).node; low.set(parent, Math.min(low.get(parent), low.get(frame.node))); }
      if (low.get(frame.node) === index.get(frame.node)) {
        const component = [];
        let member;
        do { member = stack.pop(); onStack.delete(member); component.push(member); } while (member !== frame.node);
        if (component.length > 1) result.push(component);
      }
    }
  }
  return result;
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

export function checkTiers(graph) {
  const { resolver, profile } = graph;
  const violations = [];
  const tierRule = profile === 'be' ? 'BE_TIER_DIRECTION' : 'FE_TIER_DIRECTION';
  let edgesChecked = 0;
  let unclassified = 0;
  const counts = { tierDirection: 0, layerOrder: 0, crossApp: 0 };
  for (const edge of graph.edges) {
    const verdict = resolver.importAllowed(edge.from, edge.to);
    if (verdict.reason === 'unowned' || verdict.reason?.startsWith('slot')) { unclassified += 1; continue; }
    edgesChecked += 1;
    if (verdict.allowed || !REASON_TEXT[verdict.reason]) continue;
    counts[verdict.reason] += 1;
    const featureToFeature = profile === 'be' && verdict.reason === 'tierDirection' && verdict.fromTier === 'feature' && verdict.toTier === 'feature';
    const fromKind = featureToFeature ? triggerOf(resolver, edge.from) : null;
    const toKind = featureToFeature ? triggerOf(resolver, edge.to) : null;
    const crossKind = fromKind !== null && toKind !== null && fromKind !== toKind;
    violations.push({
      ruleId: verdict.reason === 'crossApp' ? 'FE_APP_ISOLATION' : crossKind ? 'BE_KIND_ISOLATION' : featureToFeature ? 'BE_FEATURE_IMPORTS_FEATURE' : tierRule,
      path: edge.from, line: edge.line, column: edge.column,
      specifier: edge.specifier, resolvedPath: edge.to, typeOnly: !edge.runtime,
      fromTier: verdict.fromTier ?? null, toTier: verdict.toTier ?? null,
      message: crossKind
        ? `${edge.from} -> ${edge.to}: a ${fromKind} feature imports a ${toKind} feature; no kind imports another, every cross-kind call is an event published with eventBus.publish(event, tx) from a domain service${edge.runtime ? '' : ' (type-only imports count)'}.`
        : `${edge.from} -> ${edge.to}: ${REASON_TEXT[verdict.reason](verdict)}${edge.runtime ? '' : ' (type-only imports count)'}.`,
    });
  }

  // Owner cycles: nodes are owner units, edges the imports between two distinct units.
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
  const components = stronglyConnected(adjacency);
  for (const component of components) {
    const members = new Set(component);
    const origin = [...component].sort()[0];
    const cycle = cycleThrough(adjacency, members, origin);
    const hops = cycle.slice(0, -1).map((unit, i) => witness.get(`${unit}\0${cycle[i + 1]}`));
    const label = unit => unit.slice(unit.indexOf(':') + 1) || unit;
    const first = hops[0];
    violations.push({
      ruleId: 'ARCH_OWNER_CYCLE',
      path: first.from, line: first.line, column: first.column,
      cycle: cycle.map(label),
      cycleImports: hops.map(hop => ({ path: hop.from, line: hop.line, specifier: hop.specifier, typeOnly: !hop.runtime })),
      componentSize: component.length,
      message: `Owner cycle: ${cycle.map(label).join(' -> ')}${component.length > cycle.length - 1 ? ` (strongly connected with ${component.length} owners)` : ''}; type-only imports count.`,
    });
  }
  return {
    violations,
    coverage: { status: 'checked', edgesChecked, unclassifiedEdges: unclassified, ownerUnits: adjacency.size, cycles: components.length, ...counts },
  };
}
