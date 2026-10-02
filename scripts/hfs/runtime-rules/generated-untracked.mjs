// generated-untracked.mjs - GENERATED_UNTRACKED (knowledge/hfs/rules.yaml, gate runtime): no git-tracked path lies
// under a generated root of ruleParams.runtime.generated. A generated root holds only what its generatedBy writes
// (scripts/hfs/sync-runtime.mjs for the packages' runtime/ copies); it is git-ignored so a checkout regenerates it
// and the index can never pin a stale copy. Pure: the generated roots and the tracked files come in through ctx.
export const GENERATED_UNTRACKED = 'GENERATED_UNTRACKED';

/** GENERATED_UNTRACKED findings: one per tracked file inside a generated root. */
export function generatedUntrackedFindings(ctx) {
  const roots = (ctx.params.generated ?? []).map((g) => ({ root: `${String(g.root).replace(/\/+$/, '')}/`, by: g.generatedBy }));
  const found = [];
  for (const file of ctx.files) {
    const root = roots.find((r) => file.startsWith(r.root));
    if (root) found.push({ code: GENERATED_UNTRACKED, level: 'error', path: file, message: `${file} is tracked inside the generated root ${root.root.slice(0, -1)} (ruleParams.runtime.generated): only ${root.by} writes it - remove it from the index (git rm --cached); the .gitignore entry keeps it out` });
  }
  return found;
}
