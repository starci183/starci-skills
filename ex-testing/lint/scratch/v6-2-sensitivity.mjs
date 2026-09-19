/**
 * Lane v6-2: does the card canon's extra `starci-core-form-surface` row change any verdict? Re-runs the
 * failing captures with the 3-class canon (without it) and prints the card element the rule matched, so
 * the finding can be read against the markup rather than trusted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkEntityListInCard } from '../../../checks/render.mjs';

const withForm = ['starci-core-form-surface', 'starci-core-frameless-surface', 'starci-core-surface', 'starci-core-surface-card'];
const withoutForm = withForm.filter(c => c !== 'starci-core-form-surface');
const features = 'D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/.starciwork/features';
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const htmls = walk(features).filter(f => f.endsWith('.html')).sort();

let flips = 0, fails = 0;
for (const file of htmls) {
  const text = fs.readFileSync(file, 'utf8');
  const a = checkEntityListInCard(text, { family: 'common', cards: withForm });
  const b = checkEntityListInCard(text, { family: 'common', cards: withoutForm });
  if (a.outcome !== b.outcome) { flips += 1; console.log(`FLIP ${path.basename(file)}: with=${a.outcome} without=${b.outcome}`); }
  if (a.outcome === 'fail') {
    fails += 1;
    console.log(`FAIL ${path.relative(features, file).replaceAll('\\', '/')}\n     ${a.detail}`);
  }
}
console.log(`\ncaptures: ${htmls.length}, fail(with canon)=${fails}, outcomes changed by the form-surface row=${flips}`);

// The element the rule called a card in one failing capture, printed with its other classes.
const sample = path.join(features, 'recur/impl/todo-app-frontend/schedule/assets/running-page-active-desktop.html');
const text = fs.readFileSync(sample, 'utf8');
for (const m of text.matchAll(/class="([^"]*starci-core-[a-z0-9-]*surface[^"]*)"/g)) {
  console.log(`\nsurface-carrying element classes: ${m[1].trim()}`);
}
