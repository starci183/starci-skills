import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { treeOf } from './required-files.mjs';

/**
 * R30 `index-export-count` (BE_PUBLIC_SURFACE), the shape of an owner's one public entry. For every back-end owner of the
 * feature, domain, platform and integrations tiers:
 *
 *   - the owner has no `index.ts` (or `index.tsx`, `index.js`) below its root: one entry per owner, nested barrels
 *     (`persistence/index.ts`, `errors/index.ts`) are a second surface;
 *   - its `index.ts` holds only `export { ... }` and `export type { ... }` lines, with or without a `from`; an import, a
 *     declaration, a default export or a statement of any other kind is a body in a file that is only a list (`export *`
 *     and `export * as` are ARCH_OWNER_EXPORT_STAR and HFS_ALIAS_REEXPORT, judged where they already are);
 *   - it exports at most the `indexExports` budget of the owner's slot, counted in exported names.
 */
export const PUBLIC_SURFACE_RULE_IDS = ['BE_PUBLIC_SURFACE'];

const RULE = 'BE_PUBLIC_SURFACE';
const OWNER_TIERS = new Set(['feature', 'domain', 'platform', 'integrations']);
const INDEX_FILE = /^index\.[cm]?[jt]sx?$/u;

export function checkPublicSurface(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const violations = [];
  let entries = 0;
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });

  const ownerOfIndex = rel => {
    const owner = resolver.ownerOf(rel);
    return owner && OWNER_TIERS.has(resolver.slot(owner.slot)?.tier) ? owner : null;
  };

  for (const file of [...treeOf(config.root).files].sort()) {
    if (!INDEX_FILE.test(path.posix.basename(file))) continue;
    const owner = ownerOfIndex(file);
    if (!owner || path.posix.dirname(file) === owner.root) continue;
    violations.push({ ruleId: RULE, path: file, line: 1, column: 1, owner: owner.root,
      message: `${file} is a nested index inside owner ${owner.root}; an owner has exactly one public entry, ${owner.root}/index.ts. Delete ${file} and import the files it lists directly from inside the owner.` });
  }

  for (const file of graph.files.values()) {
    const owner = ownerOfIndex(file.rel);
    if (!owner || file.rel !== `${owner.root}/index.ts`) continue;
    entries += 1;
    const budget = resolver.slot(owner.slot)?.budget?.indexExports;
    let names = 0;
    for (const statement of file.sourceFile.statements) {
      if (ts.isExportDeclaration(statement)) {
        if (statement.exportClause && ts.isNamedExports(statement.exportClause)) names += statement.exportClause.elements.length;
        continue;
      }
      report(file, statement, `${file.rel} holds a statement that is not an export line; the public entry of an owner is only named \`export { Name }\` and \`export type { Name }\` lines that re-export from a file of the owner. Move the code into a file of the owner and export its names from here.`, { owner: owner.root });
    }
    if (budget !== undefined && names > budget) {
      report(file, file.sourceFile, `${file.rel} exports ${names} names, above the budget of ${budget} names for a ${resolver.slot(owner.slot).tier}; an entry that wide is the inside of the owner. Export fewer, narrower contracts or split the owner.`, { owner: owner.root, exports: names, budget });
    }
  }
  return { violations, coverage: { status: 'checked', entries } };
}
