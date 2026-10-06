// tier-direction.mjs - RT_TIER_DIRECTION and ARCH_OWNER_CYCLE over the runtime (knowledge/hfs/rules.yaml, gate runtime): every
// relative import between two runtime owners goes from a tier to a tier its mayImport lists (tiers.runtime of
// knowledge/hfs/runtime-slots.yaml), and the owner graph has no cycle. The judge is the product one,
// scripts/hfs/architecture/tiers.mjs checkTiers, fed the runtime's import graph: the relative specifiers of every
// production source (read with the TypeScript AST), resolved to tracked files. Pure.
import { checkTiers } from '../architecture/tiers.mjs';
import { relativeImportTargets } from './source-ast.mjs';

export const CODES = Object.freeze({ direction: 'RT_TIER_DIRECTION', cycle: 'ARCH_OWNER_CYCLE' });

/** The import graph of the runtime sources: {resolver, profile, edges, unit} in the shape checkTiers reads. */
function runtimeImportGraph(ctx) {
  const edges = [], missing = [];
  for (const { path: from } of ctx.sources) {
    for (const ref of relativeImportTargets(ctx, from)) {
      const { to } = ref;
      if (ref.missing) missing.push({ code: CODES.direction, level: 'error', path: from, line: ref.line, column: ref.column, message: `${from}:${ref.line} imports missing internal target ${to} (${ref.specifier}): its runtime owner direction cannot be judged` });
      if (!ref.tracked) continue;
      edges.push({ from, to, line: ref.line, column: ref.column, specifier: ref.specifier, runtime: true });
    }
  }
  const unit = (file) => {
    const owner = ctx.resolver.ownerOf(file);
    if (owner) return `${owner.slot}:${owner.root}`;
    const c = ctx.resolver.classifyPath(file);
    return c.slot ? `${c.slot}:${c.root}` : null;
  };
  return { resolver: ctx.resolver, profile: 'runtime', edges, unit, missing };
}

/** RT_TIER_DIRECTION and ARCH_OWNER_CYCLE findings of the runtime import graph. */
export function tierFindings(ctx) {
  const graph = runtimeImportGraph(ctx);
  const { violations } = checkTiers(graph);
  return [...graph.missing, ...violations.map((v) => {
    const code = v.ruleId === 'ARCH_OWNER_CYCLE' ? CODES.cycle : CODES.direction;
    return { code, level: 'error', path: v.path, line: v.line, message: `${v.path}:${v.line} ${v.message}`, ...(v.cycle ? { cycle: v.cycle } : {}) };
  })];
}
