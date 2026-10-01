// tier-direction.mjs - RT_TIER_DIRECTION and ARCH_OWNER_CYCLE over the runtime (knowledge/hfs/rules.yaml, gate runtime): every
// relative import between two runtime owners goes from a tier to a tier its mayImport lists (tiers.runtime of
// knowledge/hfs/runtime-slots.yaml), and the owner graph has no cycle. The judge is the product one,
// scripts/checks/architecture/tiers.mjs checkTiers, fed the runtime's import graph: the relative specifiers of every
// production source (read with the TypeScript AST), resolved to tracked files. Pure.
import path from 'node:path';
import { checkTiers } from '../../checks/architecture/tiers.mjs';
import { relativeImports } from './source-ast.mjs';

export const CODES = Object.freeze({ direction: 'RT_TIER_DIRECTION', cycle: 'ARCH_OWNER_CYCLE' });

/** The import graph of the runtime sources: {resolver, profile, edges, unit} in the shape checkTiers reads. */
export function runtimeImportGraph(ctx) {
  const edges = [];
  for (const { path: from } of ctx.sources) {
    for (const ref of relativeImports(ctx.parsed(from))) {
      const to = path.posix.normalize(path.posix.join(path.posix.dirname(from), ref.specifier));
      if (!ctx.fileSet.has(to)) continue;
      edges.push({ from, to, line: ref.line, column: ref.column, specifier: ref.specifier, runtime: true });
    }
  }
  const unit = (file) => {
    const owner = ctx.resolver.ownerOf(file);
    if (owner) return `${owner.slot}:${owner.root}`;
    const c = ctx.resolver.classifyPath(file);
    return c.slot ? `${c.slot}:${c.root}` : null;
  };
  return { resolver: ctx.resolver, profile: 'runtime', edges, unit };
}

/** RT_TIER_DIRECTION and ARCH_OWNER_CYCLE findings of the runtime import graph. */
export function tierFindings(ctx) {
  const { violations } = checkTiers(runtimeImportGraph(ctx));
  return violations.map((v) => {
    const code = v.ruleId === 'ARCH_OWNER_CYCLE' ? CODES.cycle : CODES.direction;
    return { code, level: 'error', path: v.path, line: v.line, message: code === CODES.direction ? `${v.path}:${v.line} ${v.message}` : `${v.path}:${v.line} ${v.message}`, ...(v.cycle ? { cycle: v.cycle } : {}) };
  });
}
