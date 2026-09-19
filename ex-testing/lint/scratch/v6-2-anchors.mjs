/**
 * Lane v6-2: every anchored citation in the authored snapshot, re-checked against the file it points at.
 * A citation is only evidence if a reader who follows it finds the thing the snapshot says is there, so
 * this table pairs each `file:line` with the text that line must contain. It also reports any anchored
 * citation the table does not cover, so the list cannot silently grow.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../core/yaml.mjs';

const claude = 'D:/Repositories/starci-academy-backend/.claude';
const doc = parseYaml(fs.readFileSync(path.join(claude, 'knowledge/grammars/common/DNA.yaml'), 'utf8'));

const anchors = new Set();
for (const row of doc.tokens) anchors.add(row.source);

const needles = {
  'packages/grammar/src/core/primitive/GrammarRoot/index.tsx:17': 'data-grammar-theme',
  'packages/grammar/src/core/styles.css:78': 'data-grammar-family="core"][data-grammar-theme="dark"',
  'packages/grammar/src/heritage/styles.css:50': 'data-grammar-family="heritage"][data-grammar-theme="dark"',
  'packages/grammar/src/offset-pop/styles.css:61': 'data-grammar-family="offset-pop"][data-grammar-theme="dark"',
  'packages/grammar/src/common/styles.css:6': '--grammar-inline-gap',
  'packages/grammar/src/common/spacing.ts:15': 'COMMON_SPACING_TOKENS',
  'packages/grammar/src/core/styles.css:34': '--starci-core-inline-gap: var(--grammar-inline-gap)',
  'packages/grammar/src/core/primitive/PageContainer/index.tsx:17': 'MARGIN-AUTO',
  'packages/grammar/src/common/rule-catalog.generated.ts:32': '"MARGIN": 7',
  'packages/grammar/src/common/conformance.ts:32': 'unknown',
  'knowledge/ui/presentation/margin.yaml:204': 'id: MARGIN-AUTO',
  'packages/grammar/src/core/primitive/RankArtwork/index.tsx:60': 'starci-core-rank-artwork',
  'packages/grammar/src/core/branch/SurfaceCard/classNames.ts:28': 'starci-core-surface-card--fill',
  'packages/grammar/src/core/branch/SurfaceCard/index.tsx:142': 'data-grammar-surface-height',
  'packages/grammar/src/common/styles.css:573': 'data-grammar-surface-height="fill"',
  'packages/grammar/src/core/dna.ts:95': 'STARCI_CORE_TOKEN_NAMES',
  'packages/grammar/src/core/dna.ts:162': 'STARCI_CORE_TOKEN_DEFAULTS',
  'packages/grammar/src/common/spacing.ts:2': 'COMMON_SPACING_SCALE',
  'packages/grammar/src/common/styles.css:287': '--field-radius',
  'packages/grammar/src/common/styles.css:563': '--starci-core-surface-inset',
  'packages/grammar/src/common/styles.css:2219': '--radius-lg',
  'packages/grammar/src/common/styles.css:452': 'z-index',
  'packages/grammar/src/common/styles.css:1265': '--starci-core-navbar-z',
  'packages/grammar/src/common/styles.css:1445': '--starci-core-subnav-z',
  'packages/grammar/src/common/styles.css:1686': '--starci-core-workspace-floating-z',
  'checks/render.mjs:337': 'export function cardClassesOf',
};

const gapAnchors = new Set();
for (const gap of doc.gaps) for (const entry of gap.evidence ?? []) {
  const m = /^(.+):(\d+)$/.exec(String(entry));
  if (m) gapAnchors.add(`${m[1]}:${m[2]}`);
}

let bad = 0;
for (const [cite, needle] of Object.entries(needles)) {
  const [rel, line] = cite.split(':');
  if (!/:\d+$/.test(cite)) { console.log(`BAD  ${cite}: malformed citation`); bad += 1; continue; }
  const text = fs.readFileSync(path.join(claude, rel), 'utf8').split(/\r?\n/)[Number(line) - 1] ?? '';
  if (!text.includes(needle)) { console.log(`MISS ${cite} does not contain ${JSON.stringify(needle)} — line reads: ${text.trim().slice(0, 90)}`); bad += 1; }
}
const uncovered = [...gapAnchors].filter(c => !(c in needles));
const unknown = Object.keys(needles).filter(c => !gapAnchors.has(c));
console.log(`\ngap evidence with a line anchor: ${gapAnchors.size}, covered by this table: ${Object.keys(needles).length}`);
if (uncovered.length) { console.log(`UNCOVERED (anchor not checked): ${uncovered.join(', ')}`); bad += uncovered.length; }
if (unknown.length) console.log(`stale table rows (no longer cited): ${unknown.join(', ')}`);

// Token rows: each cites a line in the Common sheet — verify the name really sits on that line.
let tokenBad = 0;
for (const row of doc.tokens) {
  const m = /^(.+):(\d+)$/.exec(row.source) ?? [];
  const text = fs.readFileSync(path.join(claude, 'packages/grammar/src/common/styles.css'), 'utf8').split(/\r?\n/)[Number(m[2]) - 1] ?? '';
  if (!text.includes(row.name)) { if (tokenBad < 5) console.log(`TOKEN MISS ${row.name} not on line ${m[2]}: ${text.trim().slice(0, 80)}`); tokenBad += 1; }
}
console.log(`token rows whose cited line actually carries the name: ${doc.tokens.length - tokenBad}/${doc.tokens.length}`);
console.log(bad || tokenBad ? `\n${bad + tokenBad} citation problem(s)` : `\nall ${Object.keys(needles).length} gap citations and ${doc.tokens.length} token anchors land`);
