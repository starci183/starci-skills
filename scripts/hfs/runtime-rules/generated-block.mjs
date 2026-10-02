// generated-block.mjs - RT_GENERATED_BLOCK_STALE (knowledge/hfs/rules.yaml, gate runtime): the generated blocks of
// knowledge/hfs/README.md (the app map of section 4, the back-end source tree of 5.1, the tier matrix of 5.2 and the rule
// catalog of 12) equal what scripts/hfs/readme-blocks.mjs renders from knowledge/hfs/slots.yaml and rules.yaml, byte for byte.
// Prose never restates them. Pure apart from ctx.read.
import { README, staleBlocks } from '../readme-blocks.mjs';
import { loadRuleCatalog, loadSlotManifest } from '../slots.mjs';

export const CODE = 'RT_GENERATED_BLOCK_STALE';

/** RT_GENERATED_BLOCK_STALE over the README of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function generatedBlockFindings(ctx) {
  const readme = ctx.read(README);
  if (readme === null || readme === undefined) return [];
  return staleBlocks(readme, loadSlotManifest({ root: ctx.root }), loadRuleCatalog({ root: ctx.root })).map((name) => ({
    code: CODE, level: 'error', path: README,
    message: `${CODE} ${README}: the generated block ${name} is missing or differs from slots.yaml / rules.yaml; run "node scripts/hfs/readme-blocks.mjs --write" (never edit a block by hand)`,
  }));
}
