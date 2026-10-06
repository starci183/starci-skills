// generated-block.mjs - RT_GENERATED_BLOCK_STALE (knowledge/hfs/rules.yaml, gate runtime): what the knowledge derives from its one
// home equals the derivation, byte for byte. Two generators feed it:
//   - scripts/hfs/readme-blocks.mjs: the generated blocks of knowledge/hfs/README.md (the app map of section 4, the back-end tree of
//     5.1, the tier matrix of 5.2, the front-end tree of 6.1 and the rule catalog of 12) from slots.yaml and rules.yaml;
//   - scripts/hfs/derived-fields.mjs: the `verification.automated` list and the `files:` slot ids of the pattern topics and the `code`
//     of the why maps, from rules.yaml and slots.yaml.
// Prose never restates them. Pure apart from ctx.read.
import { derivedFiles } from '../derived-fields.mjs';
import { README, staleBlocks } from '../readme-blocks.mjs';
import { loadRuleCatalog, loadSlotManifest } from '../slots.mjs';
import { createProseResolver } from './prose-path.mjs';

export const CODE = 'RT_GENERATED_BLOCK_STALE';

/** RT_GENERATED_BLOCK_STALE over the README and the derived fields of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function generatedBlockFindings(ctx) {
  const manifest = loadSlotManifest({ root: ctx.root });
  const catalog = loadRuleCatalog({ root: ctx.root });
  const found = [];
  const add = (file, what) => found.push({ code: CODE, level: 'error', path: file, message: `${CODE} ${file}: ${what}; run "starci runtime readme-blocks --write" or "starci runtime derived-fields --write" (never edit a generated value by hand)` });
  const readme = ctx.read(README);
  if (readme !== null && readme !== undefined) for (const name of staleBlocks(readme, manifest, catalog)) add(README, `the generated block ${name} is missing or differs from slots.yaml / rules.yaml`);
  const resolver = createProseResolver(ctx, manifest);
  const classify = resolver ? (p) => resolver.classify(`be/${resolver.sample(p.replaceAll('<kind>', 'api'))}`).slot ?? null : null;
  for (const item of derivedFiles({ files: ctx.files, read: ctx.read, catalog, classify })) {
    if (item.after !== item.before) add(item.file, 'a derived field (verification.automated, a files: slot id, a why code) differs from its derivation');
    for (const problem of item.problems) add(item.file, problem);
  }
  return found;
}
