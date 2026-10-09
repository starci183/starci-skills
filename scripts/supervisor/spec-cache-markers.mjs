// spec-cache-markers.mjs - how wide a spec's cache key must be. A spec's inputs are its import closure plus the data its modules name (spec-cache-reads.mjs); a module that reaches files by a way the source text
// cannot enumerate widens the key instead of guessing:
//   narrow    none of the markers below: the closure, the data it names, the preloads, the lockfile, node
//   runtime   the closure starts the CLI (it loads verb handlers by catalog data), imports or requires a computed path, or scans a runtime folder: every runtime file (all but tests/, examples/, benchmark/) is an input
//   tree      the closure scans tests/, docs/, examples/ or benchmark/: every file of the checkout is an input
// A wider key is never less safe; it only reuses less. Pure over the module texts.

export const TIERS = Object.freeze({ narrow: 'narrow', runtime: 'runtime', tree: 'tree' });
const ORDER = [TIERS.narrow, TIERS.runtime, TIERS.tree];

const CLI = /starci\.mjs|['"`]packages['"`]\s*,\s*['"`]cli['"`]|packages\/cli\/bin/;
const COMPUTED_LOAD = /\b(?:import|require)\(\s*(?!['"`][^'"`$\n]*['"`]\s*[),])/;
const SCAN = /readdirSync|opendirSync|\breaddir\(|walkFiles\(|globSync|\.glob\(|ls-files|ls-tree|\bgit\b[^\n]{0,40}\bgrep\b/;
const TREE_FOLDERS = /['"`](?:tests|docs|examples|benchmark)(?:['"`/])/;
const RUNTIME_FOLDERS = /['"`](?:scripts|engine|modules|knowledge|packages|ui|skills|init|ext)(?:['"`/])|skillRoot|runtime-root/;

/** The tier one module's text asks for. */
export function tierOfText(text) {
  const source = String(text);
  if (SCAN.test(source) && TREE_FOLDERS.test(source)) return TIERS.tree;
  if (CLI.test(source) || COMPUTED_LOAD.test(source) || (SCAN.test(source) && RUNTIME_FOLDERS.test(source))) return TIERS.runtime;
  return TIERS.narrow;
}

/** The widest tier among `tiers` (an empty list is narrow). */
export const widest = (tiers) => tiers.reduce((best, tier) => (ORDER.indexOf(tier) > ORDER.indexOf(best) ? tier : best), TIERS.narrow);
