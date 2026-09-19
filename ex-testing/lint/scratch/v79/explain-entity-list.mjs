// v7-9 diagnostic: what are the sibling runs the canon counts as "a list of repeated entities in a card"?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardClassesOf } from '../../../../checks/render.mjs';
import { parseYaml } from '../../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const workRoot = path.join(skillRoot, 'examples/todo-app-backend/.starciwork');
const brand = parseYaml(fs.readFileSync(path.join(workRoot, 'brand/index.yaml'), 'utf8')).brand;
const cards = cardClassesOf({ family: brand.identity?.family });

const targets = process.argv.slice(2);
const TAG = '<(p|li|td|tr|div|ul|ol|section|article|span|h1|h2|h3|h4|h5|h6|dd|dt)\\b';
const CLASS = /class="([^"]*)"/g;

for (const target of targets) {
  const html = fs.readFileSync(target, 'utf8');
  console.log(`\n=== ${path.basename(target)}`);
  const openTag = /<div\b[^>]*class="[^"]*starci-core-surface[^"]*"[^>]*>/g;
  let m;
  while ((m = openTag.exec(html))) {
    const from = openTag.lastIndex;
    // Walk to the matching close of this card by counting same-tag depth.
    let depth = 1, i = from;
    const tagRe = /<\/?div\b/g;
    tagRe.lastIndex = from;
    let t;
    while ((t = tagRe.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      if (depth === 0) { i = t.index; break; }
    }
    const inner = html.slice(from, i);
    const groups = new Map();
    const childRe = new RegExp(`${TAG}[^>]*class="([^"]*)"[^>]*>`, 'g');
    let c;
    while ((c = childRe.exec(inner))) {
      const classes = c[1].trim().split(/\s+/);
      for (const cls of classes) {
        if (!cls.includes('-')) continue;
        const key = `${c[1]}|${cls}`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
    }
    const flagged = [...groups.entries()].filter(([, n]) => n >= 3);
    if (!flagged.length) continue;
    console.log(`  card ${m[0].slice(0, 120)}`);
    for (const [key, n] of flagged) {
      const [tag, cls] = key.split('|');
      console.log(`    ${n}x <${tag} class~="${cls}">`);
      // Print the first three items' text so the report can say what they actually are.
      const itemRe = new RegExp(`${tag}[^>]*class="[^"]*\\b${cls.replace(/[&/\\^^$.*+?(){}[\]|]/g, x => '\\' + x)}\\b[^"]*"[^>]*>([\\s\\S]{0,160}?)<\\/${tag}>`, 'g');
      let k = 0, it;
      while ((it = itemRe.exec(inner)) && k < 3) {
        console.log(`        - ${it[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 130)}`);
        k += 1;
      }
    }
  }
}
