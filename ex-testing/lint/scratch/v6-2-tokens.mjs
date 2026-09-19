/**
 * Lane v6-2 scratch tool #4: produce the YAML `tokens:` block of knowledge/grammars/common/DNA.yaml
 * straight from the Common layer's own stylesheet. Every entry is a name that file actually writes
 * (`assignedBy: common`) or actually reads inside a `var()` (`assignedBy: family|host`), with the
 * first line it appears on and the default Common itself spells. Comments are stripped first, so
 * prose about a name is never read as a use of it.
 */
import fs from 'node:fs';

const cssFile = 'D:/Repositories/starci-academy-backend/.claude/packages/grammar/src/common/styles.css';
const raw = fs.readFileSync(cssFile, 'utf8');
const lineAt = index => raw.slice(0, index).split('\n').length;
const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

const NAME = /(?<![\w.-])(--[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)(?![\w-])/g;

const assigned = new Map();
for (const m of stripped.matchAll(/(?<![\w-])(--[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\s*:\s*([^;]+);/g)) {
  const name = m[1];
  const line = lineAt(m.index);
  const selector = (() => {
    const open = stripped.lastIndexOf('{', m.index);
    const start = Math.max(stripped.lastIndexOf('}', open), stripped.lastIndexOf('{', open - 1) + 1);
    return stripped.slice(start, open).trim().replace(/\s+/g, ' ').slice(-70);
  })();
  const entry = assigned.get(name) ?? { uses: 0, values: [], line, selector };
  entry.uses += 1;
  const value = m[2].trim();
  if (!entry.values.includes(value)) entry.values.push(value);
  assigned.set(name, entry);
}

const read = new Map();
for (const m of stripped.matchAll(/var\(\s*(--[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/g)) {
  const name = m[1];
  const entry = read.get(name) ?? { uses: 0, line: lineAt(m.index), defaults: new Set() };
  entry.uses += 1;
  // The text up to the matching close paren, so a nested fallback chain is visible.
  let depth = 1, at = m.index + m[0].length;
  for (; at < stripped.length; at += 1) {
    if (stripped[at] === '(') depth += 1;
    else if (stripped[at] === ')') { depth -= 1; if (depth === 0) break; }
    else if (stripped[at] === '\n') break;
  }
  const whole = stripped.slice(m.index + m[0].length, at).trim();
  if (whole) entry.defaults.add(whole);
  read.set(name, entry);
}

const names = new Set([...assigned.keys(), ...read.keys()]);
const rows = [];
for (const name of [...names].sort()) {
  const a = assigned.get(name);
  const r = read.get(name);
  rows.push({ name, assigned: a ?? null, read: r ? { uses: r.uses, line: r.line, defaults: [...r.defaults].slice(0, 2) } : null });
}
const isCore = n => n.startsWith('--starci-core-');
const isGrammar = n => n.startsWith('--grammar-');
const groupOf = (row) => (row.assigned ? 'assigned-by-common' : isCore(row.name) ? 'family-supplied' : 'host-supplied');
const groups = { 'assigned-by-common': [], 'family-supplied': [], 'host-supplied': [] };
for (const row of rows) groups[groupOf(row)].push(row);
for (const [group, list] of Object.entries(groups)) {
  console.log(`\n# ${group} (${list.length})`);
  for (const row of list) {
    if (row.assigned) {
      const value = row.assigned.values.length === 1 ? row.assigned.values[0] : row.assigned.values[0];
      console.log(`- name: "${row.name}"\n  value: "${value}"\n  assignedBy: common\n  selector: "${row.assigned.selector}"\n  sourceLine: ${row.assigned.line}${row.read ? `\n  alsoReadBy: ${row.read.uses}` : ''}`);
    } else {
      const def = row.read.defaults.find(d => !d.includes('var(')) ?? row.read.defaults[0] ?? null;
      console.log(`- name: "${row.name}"\n  assignedBy: ${isCore(row.name) ? 'family layer (Core/Heritage/Offset-pop)' : 'host or system colour'}\n  readBy: common\n  uses: ${row.read.uses}\n  sourceLine: ${row.read.line}${def ? `\n  commonDefault: "${def}"` : ''}`);
    }
  }
}
console.log(`\n# totals: ${rows.length} names, assigned=${Object.keys(assigned).length}, read=${Object.keys(read).length}`);
