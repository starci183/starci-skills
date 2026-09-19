/**
 * Lane v6-2 scratch tool #5: per-component rule ids as the Common entry's own source writes them.
 * A static claim is a `data-contract="ID..."` attribute literal; a computed claim is the same id
 * written inside an expression the component assembles (an array or a conditional). Comments are
 * stripped first. Cross-checked against the StarCi Core snapshot so any disagreement is read in
 * source before it is authored. Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../core/yaml.mjs';

const src = 'D:/Repositories/starci-academy-backend/.claude/packages/grammar/src';
const read = file => fs.readFileSync(file, 'utf8');
const relOf = file => path.relative(src, file).replaceAll('\\', '/');
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const resolve = (fromFile, specifier) => {
  const base = path.resolve(path.dirname(fromFile), specifier).replace(/\.js$/, '');
  for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}.js`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) return candidate;
  }
  return null;
};

const RULE_ID = /\b([A-Z][A-Z0-9]*-[A-Z0-9]+)\b/g;
const CLASSISH = /(?:^|[^A-Za-z0-9_-])((?:starci-core|grammar)-[A-Za-z0-9-]+(?:--[A-Za-z0-9-]+)?)/g;

function ownFiles(entryFile) {
  const dir = path.dirname(entryFile);
  if (path.basename(entryFile).startsWith('index.')) {
    return fs.readdirSync(dir).filter(name => /\.(ts|tsx)$/.test(name) && !/\.(spec|test)\./.test(name)).map(name => path.join(dir, name));
  }
  return [entryFile];
}

function claimsFor(entryFile) {
  const own = ownFiles(entryFile);
  const statics = new Set();
  const computed = new Set();
  const classes = new Set();
  for (const file of own) {
    const text = stripComments(read(file));
    const withoutAttributes = text.replace(/data-contract="([^"]*)"/g, (all, ids) => {
      for (const m of ids.matchAll(RULE_ID)) statics.add(m[1]);
      return ' ';
    });
    for (const m of withoutAttributes.matchAll(RULE_ID)) computed.add(m[1]);
    for (const m of text.matchAll(CLASSISH)) classes.add(m[1]);
  }
  // Ids that a shared helper stamps are not this component's promise; drop any id that only ever
  // appears in another component's own files by keeping the literal sites as the record.
  return { statics: [...statics].sort(), computed: [...computed].sort(), classes: [...classes].sort(), files: own.map(relOf) };
}

const barrel = read(path.join(src, 'common/renderers.ts'));
const groups = [];
for (const line of barrel.split('\n')) {
  const m = /^export \{(.+)\} from "(.+)"$/.exec(line.trim());
  if (m) groups.push({ names: m[1].split(',').map(s => s.trim()).filter(p => p && !p.startsWith('type ')), specifier: m[2] });
}

const dna = parseYaml(fs.readFileSync('D:/Repositories/starci-academy-backend/.claude/knowledge/grammars/starci/DNA.yaml', 'utf8'));
const dnaBy = new Map(dna.renderers.map(r => [r.component, { claims: (r.claims ?? []).slice().sort(), computed: (r.computedClaims ?? []).slice().sort() }]));

const rows = [];
for (const group of groups) {
  const entryFile = resolve(path.join(src, 'common/renderers.ts'), group.specifier);
  const info = claimsFor(entryFile);
  for (const name of group.names.filter(n => /^[A-Z]/.test(n))) rows.push({ component: name, ...info });
}

let drift = 0;
for (const row of rows.sort((a, b) => a.component.localeCompare(b.component))) {
  const mine = [...new Set([...row.statics, ...row.computed])].sort();
  const theirs = dnaBy.get(row.component);
  const snapshot = theirs ? [...new Set([...theirs.claims, ...theirs.computed])].sort() : [];
  const missing = snapshot.filter(c => !mine.includes(c));
  const extra = mine.filter(c => !snapshot.includes(c));
  const tag = missing.length || extra.length ? 'DIFFER' : 'same  ';
  if (missing.length || extra.length) drift += 1;
  console.log(`${tag} ${row.component}: mine(${mine.length})=[${mine.join(' ')}]`);
  if (missing.length) console.log(`       snapshot-only=[${missing.join(' ')}]`);
  if (extra.length) console.log(`       census-only=[${extra.join(' ')}]`);
}
console.log(`\ncomponents: ${rows.length}, differing from the starci claim table: ${drift}`);
