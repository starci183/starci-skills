/**
 * Lane v6-2 scratch tool #9: every `file:line` the snapshot cites, re-checked against the file — the
 * evidence list is only worth having if a reader who follows it finds the thing it names.
 */
import fs from 'node:fs';
import path from 'node:path';

const claude = 'D:/Repositories/starci-academy-backend/.claude';
const checks = [
  ['packages/grammar/src/core/primitive/GrammarRoot/index.tsx', 11, 'data-grammar-family'],
  ['packages/grammar/src/core/primitive/GrammarRoot/index.tsx', 15, 'grammar-common-root'],
  ['packages/grammar/src/core/primitive/GrammarRoot/index.tsx', 17, 'data-grammar-theme'],
  ['packages/grammar/src/common/styles.css', 6, '--grammar-inline-gap'],
  ['packages/grammar/src/common/styles.css', 452, 'z-index'],
  ['packages/grammar/src/common/styles.css', 563, '--starci-core-surface-inset'],
  ['packages/grammar/src/common/styles.css', 807, '--starci-core-row-inset'],
  ['packages/grammar/src/common/styles.css', 2219, '--radius-lg'],
  ['packages/grammar/src/common/styles.css', 1265, '--starci-core-navbar-z'],
  ['packages/grammar/src/common/styles.css', 1445, '--starci-core-subnav-z'],
  ['packages/grammar/src/common/styles.css', 1686, '--starci-core-workspace-floating-z'],
  ['packages/grammar/src/common/spacing.ts', 1, 'COMMON_SPACING_SCALE'],
  ['packages/grammar/src/common/spacing.ts', 15, 'COMMON_SPACING_TOKENS'],
  ['packages/grammar/src/core/styles.css', 1, '@import "../common/styles.css"'],
  ['packages/grammar/src/core/styles.css', 34, '--starci-core-inline-gap: var(--grammar-inline-gap)'],
  ['packages/grammar/src/core/styles.css', 78, 'data-grammar-theme="dark"'],
  ['packages/grammar/src/core/styles.css', 11, '--starci-core-accent: #7547ff'],
  ['packages/grammar/src/heritage/styles.css', 50, 'data-grammar-theme="dark"'],
  ['packages/grammar/src/offset-pop/styles.css', 61, 'data-grammar-theme="dark"'],
  ['packages/grammar/src/core/primitive/PageContainer/index.tsx', 17, 'MARGIN-AUTO'],
  ['packages/grammar/src/core/primitive/RankArtwork/index.tsx', 60, 'starci-core-rank-artwork'],
  ['packages/grammar/src/common/rule-catalog.generated.ts', 32, '"MARGIN": 7'],
  ['packages/grammar/src/common/conformance.ts', 26, 'unknown'],
  ['packages/grammar/src/core/dna.ts', 116, 'STARCI_CORE_TOKEN_NAMES'],
  ['packages/grammar/src/core/dna.ts', 158, 'STARCI_CORE_TOKEN_DEFAULTS'],
  ['packages/grammar/src/common/index.ts', 1, 'PRESENTATION_STATES'],
  ['knowledge/ui/presentation/margin.yaml', 204, 'id: MARGIN-AUTO'],
  ['checks/render.mjs', 337, 'export function cardClassesOf'],
  ['packages/grammar/src/core/branch/SurfaceCard/classNames.ts', 31, 'framelessSurfaceClassName'],
  ['packages/grammar/src/core/composite/VerticalScrollRegion/index.tsx', 1, 'import'],
];
let bad = 0;
for (const [rel, line, needle] of checks) {
  const text = fs.readFileSync(path.join(claude, rel), 'utf8').split(/\r?\n/);
  const at = text[line - 1] ?? '';
  const ok = at.includes(needle);
  if (!ok) {
    bad += 1;
    const found = text.findIndex(l => l.includes(needle)) + 1;
    console.log(`MISS  ${rel}:${line} does not contain ${JSON.stringify(needle)}${found ? ` (found at :${found})` : ' (absent from file)'}`);
  }
}
console.log(bad ? `\n${bad} citation(s) to fix of ${checks.length}` : `\nall ${checks.length} citations land`);

// Every emitted class the snapshot lists must have a rule somewhere in the package's sheets.
const blocks = fs.readFileSync(path.join(claude, 'ex-testing/lint/scratch/v6-2-renderers-final.txt'), 'utf8').split(/\r?\n/);
const emitted = new Set();
for (const line of blocks) {
  const cls = /^      - "([^"]+)"$/.exec(line);
  if (cls) emitted.add(cls[1]);
}
const allSheets = ['common', 'core', 'heritage', 'offset-pop']
  .map(dir => fs.readFileSync(path.join(claude, `packages/grammar/src/${dir}/styles.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' '))
  .join('\n');
const defined = new Set([...allSheets.matchAll(/\.((?:starci-core|grammar)-[A-Za-z0-9-]+)/g)].map(m => m[1]));
const unpainted = [...emitted].filter(c => !defined.has(c)).sort();
console.log(`emitted classes: ${emitted.size}; with no rule in any shipped sheet: ${unpainted.join(' ') || '(none)'}`);
