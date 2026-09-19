/**
 * Lane v6-2 scratch tool: census the real Common grammar source so knowledge/grammars/common/DNA.yaml
 * is an observation, not an invention. Read-only; prints JSON to stdout.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const claude = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const src = path.join(claude, 'packages', 'grammar', 'src');
const commonCss = fs.readFileSync(path.join(src, 'common', 'styles.css'), 'utf8');
const coreCss = fs.readFileSync(path.join(src, 'core', 'styles.css'), 'utf8');

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Split a css text into {selector, body} rule blocks (naive but adequate: no nested at-rules here). */
function rules(css) {
  const out = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(pattern)) {
    out.push({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2], at: lineOf(css, m.index) });
  }
  return out;
}

/** custom property -> {assignments:[{file,line,selector,value}], fallbacks:Set, consumedLines} */
function props(css, file) {
  const found = { assign: new Map(), consume: new Map() };
  for (const rule of rules(css)) {
    for (const m of rule.body.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const name = m[1];
      const list = found.assign.get(name) ?? [];
      list.push({ file, line: rule.at, selector: rule.selector, value: m[2].trim() });
      found.assign.set(name, list);
    }
  }
  for (const m of css.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*(,\s*([^;]*?))?\)/g)) {
    const name = m[1];
    const fallback = m[3] === undefined ? null : m[3].trim();
    const entry = found.consume.get(name) ?? { uses: 0, fallbacks: new Set(), firstLine: lineOf(css, m.index) };
    entry.uses += 1;
    if (fallback) entry.fallbacks.add(fallback);
    found.consume.set(name, entry);
  }
  // var() with nested parens in the fallback: re-scan greedily for the assignment-level text.
  for (const m of css.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*,\s*(var\([^)]*\)(?:,[^)]*)?)\)/g)) {
    const name = m[1];
    const entry = found.consume.get(name) ?? { uses: 0, fallbacks: new Set(), firstLine: lineOf(css, m.index) };
    entry.fallbacks.add(m[2].trim());
    found.consume.set(name, entry);
  }
  return found;
}

const cc = props(commonCss, 'src/common/styles.css');
const kc = props(coreCss, 'src/core/styles.css');

const classSet = (css, file) => {
  const set = new Map();
  for (const rule of rules(css)) {
    for (const sel of rule.selector.split(',')) {
      for (const m of sel.matchAll(/\.((?:starci-core|grammar)-[A-Za-z0-9-]+)/g)) {
        if (!set.has(m[1])) set.set(m[1], `${file}:${rule.at}`);
      }
    }
  }
  return set;
};

const commonClasses = classSet(commonCss, 'src/common/styles.css');
const coreClasses = classSet(coreCss, 'src/core/styles.css');

/** Per-component emitted class literals under src/core (and src/common). */
function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(file) : [file];
  });
}
const emitted = new Map();
for (const file of walkFiles(src)) {
  if (!/\.(ts|tsx)$/.test(file) || /\.(spec|test)\./.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of text.matchAll(/["'`]((?:starci-core|grammar)-[A-Za-z0-9-]+)(?:\s+[^"'`]*)?["'`]/g)) names.add(m[1]);
  for (const m of text.matchAll(/`((?:starci-core|grammar)-[A-Za-z0-9-]+)/g)) names.add(m[1]);
  if (!names.size) continue;
  const rel = path.relative(src, file).replaceAll('\\', '/');
  emitted.set(rel, [...names].sort());
}

const report = {
  commonCss: {
    assigned: Object.fromEntries([...cc.assign].map(([k, v]) => [k, v])),
    consumed: Object.fromEntries([...cc.consume].map(([k, v]) => [k, { uses: v.uses, firstLine: v.firstLine, fallbacks: [...v.fallbacks] }])),
    classes: [...commonClasses.entries()],
  },
  coreCss: {
    assignedCount: kc.assign.size,
    assigned: Object.fromEntries([...kc.assign].map(([k, v]) => [k, v.map((a) => ({ line: a.line, selector: a.selector, value: a.value }))])),
    classes: [...coreClasses.entries()].length,
  },
  emitted: Object.fromEntries(emitted),
};
console.log(JSON.stringify(report, null, 1));
