/**
 * Lane v6-2 scratch tool #2: resolve, for every component published by the Common public entry
 * (@starci/grammar/common -> src/common/renderers.ts), the class names its own source can emit.
 * Own files = the component's own directory (index.tsx + siblings), or just the single file when the
 * barrel exports a file that lives directly in src/core. Imported modules outside that directory
 * contribute only the constants the component actually names. Comments are stripped so prose about a
 * class is not read as an emitted class. Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';

const src = 'D:/Repositories/starci-academy-backend/.claude/packages/grammar/src';
const read = file => fs.readFileSync(file, 'utf8');
const relOf = file => path.relative(src, file).replaceAll('\\', '/');

const resolve = (fromFile, specifier) => {
  const base = path.resolve(path.dirname(fromFile), specifier).replace(/\.js$/, '');
  for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}.js`, path.join(base, 'index.tsx'), path.join(base, 'index.ts'), base]) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) return candidate;
  }
  return null;
};

const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const CLASSISH = /(?:^|[^A-Za-z0-9_-])((?:starci-core|grammar)-[A-Za-z0-9-]+(?:--[A-Za-z0-9-]+)?)/g;

const classCache = new Map();
function constsOf(file) {
  if (classCache.has(file)) return classCache.get(file);
  const text = read(file);
  const out = new Map();
  for (const m of text.matchAll(/export const ([A-Za-z0-9_]+)[^=]*=([\s\S]*?)(?=\n(?:export |\/\*\*|\/\/)|$)/g)) {
    const classes = new Set();
    for (const mm of stripComments(m[2]).matchAll(CLASSISH)) classes.add(mm[1]);
    out.set(m[1], [...classes]);
  }
  const value = { consts: out, text };
  classCache.set(file, value);
  return value;
}

function ownFiles(entryFile) {
  const dir = path.dirname(entryFile);
  if (path.basename(entryFile).startsWith('index.')) {
    return fs.readdirSync(dir).filter(name => /\.(ts|tsx)$/.test(name) && !/\.(spec|test)\./.test(name))
      .map(name => path.join(dir, name));
  }
  return [entryFile];
}

function classesFor(entryFile) {
  const own = ownFiles(entryFile);
  const ownSet = new Set(own);
  const found = new Map();
  const add = (cls, where) => { if (!found.has(cls)) found.set(cls, where); };
  for (const file of own) {
    for (const mm of stripComments(read(file)).matchAll(CLASSISH)) add(mm[1], relOf(file));
  }
  const queue = [...own];
  const visited = new Set(own);
  while (queue.length) {
    const file = queue.shift();
    const { text } = constsOf(file);
    for (const m of text.matchAll(/import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*"(\.[^"]+)"/g)) {
      const target = resolve(file, m[2]);
      if (!target || !target.startsWith(src)) continue;
      if (!ownSet.has(target)) {
        const imported = constsOf(target).consts;
        for (const raw of m[1].split(',')) {
          const name = raw.replace(/^type\s+/, '').trim();
          for (const cls of imported.get(name) ?? []) add(cls, `via ${relOf(target)}:${name}`);
        }
      }
      if (!visited.has(target)) { visited.add(target); queue.push(target); }
    }
  }
  return { classes: [...found.entries()].map(([cls, where]) => ({ cls, where })), files: own.map(relOf) };
}

const barrel = read(path.join(src, 'common/renderers.ts'));
const published = [];
for (const line of barrel.split('\n')) {
  const m = /^export \{(.+)\} from "(.+)"$/.exec(line.trim());
  if (!m) continue;
  const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
  published.push({ names: parts.filter(p => !p.startsWith('type ')), types: parts.filter(p => p.startsWith('type ')).map(p => p.slice(5).trim()), specifier: m[2] });
}
const registryText = read(path.join(src, 'common/registry.tsx'));
const registryBlock = /COMMON_GRAMMAR_COMPONENTS = Object\.freeze\(\{([\s\S]*?)\} as const\)/.exec(registryText)?.[1] ?? '';
const registry = [...new Set([...registryBlock.matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)].map(m => m[1]))];

const rows = [];
for (const group of published) {
  const entryFile = resolve(path.join(src, 'common/renderers.ts'), group.specifier);
  const info = classesFor(entryFile);
  for (const name of group.names.filter(n => /^[A-Z]/.test(n))) {
    rows.push({
      component: name,
      source: relOf(entryFile),
      kind: relOf(entryFile).split('/')[1].replace(/\.[a-z]+$/, ''),
      propsType: group.types.find(t => t === `${name}Props`) ?? null,
      classes: info.classes,
    });
  }
}
console.log(`barrel components: ${rows.length}  registry names: ${registry.length}`);
for (const r of rows.sort((a, b) => a.component.localeCompare(b.component))) {
  console.log(`\n${r.component}  [${r.kind}]  ${r.source}  propsType=${r.propsType ?? '(none named <Name>Props)'}`);
  for (const c of r.classes) console.log(`    ${c.cls}${c.where.startsWith('via ') ? '   (' + c.where + ')' : ''}`);
}
console.log(`\nregistry names with no barrel export: ${registry.filter(n => !rows.some(r => r.component === n)).join(', ') || '(none)'}`);
console.log(`barrel exports absent from registry: ${rows.filter(r => !registry.includes(r.component)).map(r => r.component).join(', ') || '(none)'}`);
