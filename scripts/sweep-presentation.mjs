// A cheap static sweep of one application checkout for the three presentation defects the knowledge
// tree already forbids and no gate used to catch.
//
//   APP_OVERRIDE           a className reaching into a Grammar object. `ui/presentation/INDEX.md`
//                          states it in prose: presentation must not "add padding, typography or
//                          paint inside `Card`, `Input`, `Button` or another Grammar object", and
//                          `radius.md` names the verdict: "Reaching into a Grammar component with a
//                          selector or a passed class to change its corner is `APP_OVERRIDE`."
//                          The closed list of objects is therefore every renderer
//                          `knowledge/grammars/starci/DNA.md` publishes, plus the three the INDEX
//                          spells out. Nothing here is typed by hand.
//   APP_REIMPLEMENTATION   a layout or alignment utility written onto a Grammar object that already
//                          owns its geometry. `INDEX.md`: the application "passes a prop and writes
//                          no class. Writing it anyway is `APP_REIMPLEMENTATION`." The geometry
//                          owners are read from DNA.md too: a renderer whose published claims name a
//                          GAP-, PADDING-, MARGIN-, MEASURE- or OVERFLOW- rule already owns the
//                          distance the class would redraw.
//   SHELL_GEOMETRY         a product shell that draws its own band instead of composing one. Owner
//                          ruling 2026-09-03, on top of `patterns/fe/imports.md` FE-IMPORTS-7 Case 7:
//                          "a local `Sidebar` or shell geometry: use the Common renderer and pass
//                          props". A unit under `product-shells/**`, or whose folder name ends in
//                          Layout, Shell, TopBar, Navbar, Nav, Sidebar or Rail, may compose a Grammar
//                          shell object and pass props or slots. Carrying layout, spacing or border
//                          utilities while composing no shell object at all means the band, its
//                          inset and its separator were rebuilt out of divs. The same code covers
//                          the band mounted in the wrong place: `WorkspaceShell` wraps its `header`
//                          slot in a `<header>` and `NavigationFeatureNav` is already one, so the
//                          application band belongs beside the page in the route layout, never in
//                          that slot.
//   OFF_SCALE              a class outside the closed scale its topic publishes. The scales are
//                          parsed out of gap.md, padding.md, margin.md, measure.md and radius.md;
//                          this file adds nothing to them. `rounded-small|medium|large` and any
//                          arbitrary `[...]` value are off the scale by the argument radius.md makes.
//
// Usage: node scripts/sweep-presentation.mjs <checkout> [--write-set <file>] [--json]
// Exit 1 on any finding, 2 on a usage error.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE = path.join(ROOT, 'knowledge');

// ---------------------------------------------------------------------------------------------
// Reading the closed lists out of the knowledge tree
// ---------------------------------------------------------------------------------------------

const rows = (text, heading) => {
  const at = text.indexOf(`\n${heading}\n`);
  if (at < 0) return [];
  const rest = text.slice(at + heading.length + 2);
  const out = [];
  for (const line of rest.split('\n')) {
    const t = line.trim();
    if (t.startsWith('##')) break;
    if (!t.startsWith('|')) { if (out.length) break; continue; }
    if (/^\|[\s|:-]+\|$/.test(t)) continue;
    // A cell may carry an escaped pipe (`system` \| `light`); only an unescaped one ends a cell.
    out.push(t.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim()));
  }
  return out.slice(1);
};

const code = (cell) => cell.replace(/`/g, '').trim();

// Every scale table in the presentation topics prints `| Rule | Class | … |`, so one reader serves
// gap, padding, margin and radius. measure.md prints its cap scale under `## Width scale`.
function scaleClasses(root, file, heading = '## Scale') {
  const text = readFileSync(path.join(root, 'knowledge', 'ui', 'presentation', file), 'utf8');
  return rows(text, heading).map((r) => code(r[1])).filter((c) => c && c !== '—');
}

// A step is the tail of a scale class: `gap-6` -> `6`, `max-w-3xl` -> `3xl`, `rounded-2xl` -> `2xl`.
const steps = (classes, prefix) => new Set(classes
  .filter((c) => c.startsWith(`${prefix}-`))
  .map((c) => c.slice(prefix.length + 1)));

export function loadScales(root = ROOT) {
  const at = (f, h) => scaleClasses(root, f, h);
  const radius = at('radius.md');
  return {
    gap: steps(at('gap.md'), 'gap'),
    padding: steps(at('padding.md'), 'p'),
    margin: steps(at('margin.md'), 'm'),
    maxWidth: steps(at('measure.md', '## Width scale'), 'max-w'),
    radius: steps(radius, 'rounded'),
  };
}

// DNA.md's `## Renderers` table is generated from the published package, so it is the closed list of
// Grammar objects and the record of which relationships each one already owns.
export function loadGrammarObjects(root = ROOT) {
  const text = readFileSync(path.join(root, 'knowledge', 'grammars', 'starci', 'DNA.md'), 'utf8');
  const objects = new Set();
  const geometryOwners = new Set();
  const shellObjects = new Set(['PageContainer', 'Rail', 'Subnav', 'DashboardShell']);
  for (const r of rows(text, '## Renderers')) {
    const name = code(r[0]).split(/\s+/)[0];
    if (!name) continue;
    objects.add(name);
    if (/\b(GAP|PADDING|MARGIN|MEASURE|OVERFLOW)-/.test(r[3] ?? '')) geometryOwners.add(name);
    if (code(r[1]) === 'composition' && name !== 'GrammarRoot') shellObjects.add(name);
  }
  // The presentation INDEX names these three in prose; `Card` is not a DNA renderer name and would
  // otherwise be missed.
  for (const n of ['Card', 'Input', 'Button']) objects.add(n);
  return { objects, geometryOwners, shellObjects };
}

// A unit whose job is the shell of a product surface, by the owner's two tests.
const SHELL_FOLDER = /(?:^|\/)product-shells\//;
const SHELL_NAME = /(Layout|Shell|TopBar|Navbar|Nav|Sidebar|Rail)$/;
export const isShellUnit = (relPath) => SHELL_FOLDER.test(relPath) || SHELL_NAME.test(path.basename(path.dirname(relPath)));

const SHELL_TOKEN = /^(flex|flex-col|flex-row|grid|grid-cols-.+|items-.+|justify-.+|self-.+|place-.+|gap(-[xy])?-.+|p[trblxyse]?-.+|w-.+|h-.+|sticky|border(-.+)?)$/;
export const isShellGeometryToken = (token) => SHELL_TOKEN.test(token.replace(VARIANT, ''));

// ---------------------------------------------------------------------------------------------
// The token vocabularies
// ---------------------------------------------------------------------------------------------

const VARIANT = /^(sm|md|lg|xl|2xl):/;
const LAYOUT = /^(flex|flex-col|flex-row|flex-col-reverse|flex-row-reverse|grid|grid-cols-.+|items-.+|justify-.+|self-.+|place-.+)$/;

export const isLayoutToken = (token) => LAYOUT.test(token.replace(VARIANT, ''));

// A Tailwind class is `variant:variant:utility`, and a variant may itself be arbitrary
// (`data-[hovered=true]:`, `[&>*]:`). Only the utility carries the value a scale can own, so the
// scale checks read the utility and the variants are left alone.
export function utilityOf(token) {
  let depth = 0;
  let last = 0;
  for (let i = 0; i < token.length; i += 1) {
    const c = token[i];
    if (c === '[' || c === '(') depth += 1;
    else if (c === ']' || c === ')') depth -= 1;
    else if (c === ':' && depth === 0) last = i + 1;
  }
  return token.slice(last);
}

// Which closed scale, if any, a token answers to. A token no scale owns is not this sweep's business.
const SCALE_OF = [
  { prefix: /^-?gap(-[xy])?-(.+)$/, scale: 'gap' },
  { prefix: /^-?p([trblxyse])?-(.+)$/, scale: 'padding' },
  { prefix: /^-?m([trblxyse])?-(.+)$/, scale: 'margin' },
  { prefix: /^max-w-(.+)$/, scale: 'maxWidth', step: 1 },
  { prefix: /^rounded(-(?:t|b|s|e|l|r|tl|tr|bl|br|ss|se|es|ee))?-(.+)$/, scale: 'radius' },
  { prefix: /^rounded$/, scale: 'radius', bare: true },
];

// margin alone may be `auto`: MARGIN-AUTO is published beside the scale and carries no scale value.
const OFF_SCALE_EXEMPT = { margin: new Set(['auto']), maxWidth: new Set([]) };

export function offScaleReason(token, scales) {
  const bare = utilityOf(token);
  if (bare === 'rounded-small' || bare === 'rounded-medium' || bare === 'rounded-large') {
    return 'not on the radius ramp; the compiled stylesheet emits no rule for it, so the corner renders square';
  }
  if (bare === 'rounded-field') {
    return 'not a step on the radius ramp; `rounded-field` is the vendor field utility and belongs to the field family, not to an application choice';
  }
  for (const entry of SCALE_OF) {
    const m = bare.match(entry.prefix);
    if (!m) continue;
    if (entry.bare) return null; // `rounded` alone is the vendor default, not a scale step
    const step = m[entry.step ?? 2];
    if (scales[entry.scale].has(step)) return null;
    if (OFF_SCALE_EXEMPT[entry.scale]?.has(step)) return null;
    if (step.startsWith('[')) return `an arbitrary value nobody can cite and nobody can move; the ${entry.scale} scale is closed`;
    return `off the closed ${entry.scale} scale`;
  }
  if (bare.includes('[')) return 'an arbitrary value; the presentation topics publish closed scales only';
  return null;
}

// ---------------------------------------------------------------------------------------------
// The cheap static reader
// ---------------------------------------------------------------------------------------------

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Every string literal inside a fragment, template literals included but without their holes.
export function literalsIn(fragment) {
  const out = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let m;
  while ((m = re.exec(fragment)) !== null) out.push({ value: m[1] ?? m[2] ?? m[3] ?? '', index: m.index });
  return out;
}

const tokensOf = (value) => value.split(/\s+/).filter(Boolean).filter((t) => !t.includes('${'));

// Grammar objects a file imported as values. `import type` never renders anything.
export function grammarImports(text, objects) {
  const local = new Map();
  const re = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["'](@starci\/grammar\/(?:core|common)[^"']*)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) continue;
    for (const raw of m[2].split(',')) {
      const part = raw.trim();
      if (!part || part.startsWith('type ')) continue;
      const [source, alias] = part.split(/\s+as\s+/).map((s) => s.trim());
      if (objects.has(source)) local.set(alias ?? source, source);
    }
  }
  return local;
}

// Balanced read of a `{ … }` expression, skipping strings.
function readBraced(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < text.length && text[i] !== q) { if (text[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return text.slice(open, i + 1); }
  }
  return text.slice(open);
}

// The attribute region of one JSX opening tag: from `<Name` to the `>` that closes it.
function readTag(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < text.length && text[i] !== q) { if (text[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return text.slice(start, i);
  }
  return text.slice(start);
}

// The tag's own attribute, never one belonging to a nested element inside a prop expression:
// `<NavigationFeatureNav navigation={<div className="…">}>` writes on the div, not on the composition.
function attrOf(tag, name) {
  let depth = 0;
  for (let i = 0; i < tag.length; i += 1) {
    const c = tag[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < tag.length && tag[i] !== q) { if (tag[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (c === '{') { depth += 1; continue; }
    if (c === '}') { depth -= 1; continue; }
    if (depth !== 0) continue;
    if (!tag.startsWith(name, i)) continue;
    const m = tag.slice(i).match(new RegExp(`^${name}\\s*=\\s*`));
    if (!m) continue;
    const offset = i + m[0].length;
    if (tag[offset] === '{') return { text: readBraced(tag, offset), offset };
    const lit = literalsIn(tag.slice(offset, offset + 4096))[0];
    if (lit && lit.index === 0) return { text: tag.slice(offset, offset + lit.value.length + 2), offset };
    return { text: '', offset };
  }
  return null;
}
const classNameOf = (tag) => attrOf(tag, 'className');

// The application band is a sibling of the page, not the page's hero. `WorkspaceShell` wraps whatever
// it is handed in its own `<header>`, and `NavigationFeatureNav` is already a `<header>`, so nesting
// one in the other publishes two banner landmarks for one band.
const BAND_NAME = /^(NavigationFeatureNav|.*(?:Nav|TopBar))$/;
export function bandInHeaderSlot(tag) {
  const header = attrOf(tag, 'header');
  if (header === null) return null;
  for (const m of header.text.matchAll(/<([A-Z][\w$]*)/g)) if (BAND_NAME.test(m[1])) return m[1];
  return null;
}

// A same-folder `classNames.ts` export, resolved one level deep: `X`, or `X.y` on an object literal.
export function classNameExports(source) {
  const out = new Map();
  const re = /export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const from = m.index + m[0].length;
    const next = source.slice(from).search(/\nexport\s+(const|function|type)\b/);
    out.set(m[1], source.slice(from, next < 0 ? source.length : from + next));
  }
  return out;
}

// `X` and `X.y` on a same-folder classNames export resolve; `getX(state)` does not, because its
// branches are not one class string and guessing which one renders would invent a value.
function resolveExpression(expression, exports) {
  const strings = literalsIn(expression).map((l) => l.value);
  const named = [];
  let computed = false;
  for (const m of expression.matchAll(/\b([A-Za-z_$][\w$]*)(?:\.([\w$]+))?/g)) {
    const body = exports.get(m[1]);
    if (body === undefined) continue;
    if (expression[m.index + m[0].length] === '(') { computed = true; continue; }
    if (m[2] === undefined) { named.push(...literalsIn(body).map((l) => l.value)); continue; }
    const keyed = body.match(new RegExp(`\\b${m[2]}\\s*:\\s*([^\\n]*)`));
    named.push(...literalsIn(keyed ? keyed[1] : body).map((l) => l.value));
  }
  return { values: [...strings, ...named], computed };
}

// ---------------------------------------------------------------------------------------------
// One file
// ---------------------------------------------------------------------------------------------

export function sweepSource({ relPath, text, siblingClassNames = '', unitGrammarImports = null, objects, geometryOwners, shellObjects, scales }) {
  const findings = [];
  const imported = grammarImports(text, objects);
  const exports = classNameExports(siblingClassNames + '\n' + (relPath.endsWith('classNames.ts') ? text : ''));

  // (a)/(b): a className on a Grammar object.
  const jsx = /<([A-Z][\w$]*)/g;
  let m;
  while ((m = jsx.exec(text)) !== null) {
    const source = imported.get(m[1]);
    if (source === undefined) continue;
    const tag = readTag(text, m.index);
    if (source === 'WorkspaceShell') {
      const band = bandInHeaderSlot(tag);
      if (band !== null) {
        findings.push({
          code: 'SHELL_GEOMETRY', file: relPath, line: lineOf(text, m.index), object: source, token: `header={<${band} …>}`,
          statement: `the application band is mounted inside WorkspaceShell's header slot; the slot is the page-level hero and wraps its content in its own <header>, so ${band} publishes a second banner. The band is a sibling above the page in the route layout`,
        });
      }
    }
    const attr = classNameOf(tag);
    if (attr === null) continue;
    const { values, computed } = resolveExpression(attr.text, exports);
    const tokens = values.flatMap(tokensOf);
    const line = lineOf(text, m.index + attr.offset);
    const layout = tokens.filter(isLayoutToken);
    if (layout.length && geometryOwners.has(source)) {
      findings.push({
        code: 'APP_REIMPLEMENTATION', file: relPath, line, object: source, token: layout.join(' '),
        statement: `<${m[1]}> is a Grammar object that already owns its geometry; ${layout.join(' ')} redraws a distance the component publishes`,
      });
    } else {
      findings.push({
        code: 'APP_OVERRIDE', file: relPath, line, object: source, token: tokens.join(' ') || (computed ? '(computed className)' : '(non-literal className)'),
        statement: `a className reaches into <${m[1]}>; presentation must not paint inside a Grammar object`,
      });
    }
  }

  // (c): every class string in the file, wherever it is written.
  const seen = new Set();
  const consider = (fragment, base) => {
    for (const lit of literalsIn(fragment)) {
      for (const token of tokensOf(lit.value)) {
        const why = offScaleReason(token, scales);
        if (why === null) continue;
        const line = lineOf(text, base + lit.index);
        const key = `${line}:${token}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ code: 'OFF_SCALE', file: relPath, line, object: '—', token, statement: why });
      }
    }
  };
  for (const call of text.matchAll(/\bcn\s*\(/g)) {
    const open = text.indexOf('(', call.index);
    consider(readParen(text, open), open);
  }
  const attrRe = /\bclassName\s*=\s*/g;
  while ((m = attrRe.exec(text)) !== null) {
    const from = m.index + m[0].length;
    const fragment = text[from] === '{' ? readBraced(text, from) : (literalsIn(text.slice(from, from + 4096))[0] ? text.slice(from, from + 4096).slice(0, literalsIn(text.slice(from, from + 4096))[0].value.length + 2) : '');
    consider(fragment, from);
  }
  if (relPath.endsWith('classNames.ts')) consider(text, 0);

  // (d): a shell unit that carries geometry while composing no Grammar shell object.
  if (isShellUnit(relPath) && shellObjects !== undefined) {
    const composed = unitGrammarImports ?? new Set(imported.values());
    const composesShell = [...composed].some((name) => shellObjects.has(name));
    if (!composesShell) {
      const shellSeen = new Set();
      const flagShell = (fragment, base) => {
        for (const lit of literalsIn(fragment)) {
          for (const token of tokensOf(lit.value)) {
            if (!isShellGeometryToken(token)) continue;
            const line = lineOf(text, base + lit.index);
            if (shellSeen.has(line)) continue;
            shellSeen.add(line);
            findings.push({
              code: 'SHELL_GEOMETRY', file: relPath, line, object: '—', token,
              statement: 'a product shell that composes no Grammar shell object; the band, its inset and its separator belong to a composed shell renderer, not to application classes',
            });
          }
        }
      };
      if (relPath.endsWith('classNames.ts')) flagShell(text, 0);
      else {
        for (const call of text.matchAll(/\bcn\s*\(/g)) { const open = text.indexOf('(', call.index); flagShell(readParen(text, open), open); }
        const re = /\bclassName\s*=\s*/g;
        let a;
        while ((a = re.exec(text)) !== null) {
          const from = a.index + a[0].length;
          if (text[from] === '{') flagShell(readBraced(text, from), from);
          else { const first = literalsIn(text.slice(from, from + 4096))[0]; if (first && first.index === 0) flagShell(text.slice(from, from + first.value.length + 2), from); }
        }
      }
    }
  }

  findings.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
  return findings;
}

function readParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < text.length && text[i] !== q) { if (text[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if (c === '(') depth += 1;
    else if (c === ')') { depth -= 1; if (depth === 0) return text.slice(open, i + 1); }
  }
  return text.slice(open);
}

// ---------------------------------------------------------------------------------------------
// The checkout
// ---------------------------------------------------------------------------------------------

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'out', '.turbo']);
const SCANNED = /\.tsx?$/;

// The Grammar package is the authority these rules are measured against, not an application that
// consumes it: its own renderers are where the owned geometry lives. A workspace package whose
// package.json names a Grammar family is read out of the sweep, by its manifest and not by its path.
export function grammarPackageRoots(checkout) {
  const roots = [];
  for (const group of ['packages', 'apps', 'libs']) {
    const dir = path.join(checkout, group);
    if (!existsSync(dir)) continue;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { entries = []; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const manifest = path.join(dir, e.name, 'package.json');
      if (!existsSync(manifest)) continue;
      try {
        const name = JSON.parse(readFileSync(manifest, 'utf8')).name ?? '';
        if (/grammar/.test(name)) roots.push(`${group}/${e.name}/`);
      } catch { /* an unreadable manifest names no package */ }
    }
  }
  return roots;
}

function walk(dir, base, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else if (SCANNED.test(e.name) && !e.name.endsWith('.d.ts')) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
}

// With no write set: `src/**` and `packages/**/src/**`, the two roots an application owns.
export function defaultWriteSet(checkout) {
  const out = [];
  const src = path.join(checkout, 'src');
  if (existsSync(src)) walk(src, checkout, out);
  for (const root of ['packages', 'apps']) {
    const dir = path.join(checkout, root);
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || SKIP.has(e.name)) continue;
      const inner = path.join(dir, e.name, 'src');
      if (existsSync(inner)) walk(inner, checkout, out);
    }
  }
  return out.sort();
}

export function sweepCheckout(checkout, writeSet, root = ROOT) {
  const { objects, geometryOwners, shellObjects } = loadGrammarObjects(root);
  const scales = loadScales(root);
  const excluded = grammarPackageRoots(checkout);
  const paths = (writeSet ?? defaultWriteSet(checkout))
    .filter((p) => SCANNED.test(p))
    .filter((p) => !excluded.some((root) => p.startsWith(root)));
  const siblings = new Map();
  const siblingFor = (relPath) => {
    const dir = path.dirname(relPath);
    if (!siblings.has(dir)) {
      const file = path.join(checkout, dir, 'classNames.ts');
      siblings.set(dir, existsSync(file) ? readFileSync(file, 'utf8') : '');
    }
    return siblings.get(dir);
  };
  // A unit composes as a whole: classNames.ts imports nothing, so the shell object its twin composes
  // is read from every file of the folder.
  const unitImports = new Map();
  const unitImportsFor = (relPath) => {
    const dir = path.dirname(relPath);
    if (!unitImports.has(dir)) {
      const names = new Set();
      let entries = [];
      try { entries = readdirSync(path.join(checkout, dir), { withFileTypes: true }); } catch { entries = []; }
      for (const e of entries) {
        if (!e.isFile() || !SCANNED.test(e.name)) continue;
        for (const n of grammarImports(readFileSync(path.join(checkout, dir, e.name), 'utf8'), objects).values()) names.add(n);
      }
      unitImports.set(dir, names);
    }
    return unitImports.get(dir);
  };
  const findings = [];
  const scanned = [];
  for (const relPath of paths) {
    const full = path.join(checkout, relPath);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    scanned.push(relPath);
    findings.push(...sweepSource({
      relPath, text: readFileSync(full, 'utf8'), siblingClassNames: siblingFor(relPath),
      unitGrammarImports: isShellUnit(relPath) ? unitImportsFor(relPath) : null,
      objects, geometryOwners, shellObjects, scales,
    }));
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code));
  return { checkout, scanned: scanned.length, findings };
}

export function formatReport(result) {
  const lines = [];
  for (const f of result.findings) lines.push(`${f.file}:${f.line}: ${f.code} ${f.token} — ${f.statement}`);
  lines.push(result.findings.length
    ? `sweep-presentation: ${result.findings.length} finding(s) in ${result.scanned} file(s)`
    : `sweep-presentation: clean, ${result.scanned} file(s)`);
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  let json = false;
  let setFile = null;
  let checkout = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') json = true;
    else if (argv[i] === '--write-set') { setFile = argv[i + 1] ?? null; i += 1; }
    else if (!argv[i].startsWith('--') && checkout === null) checkout = argv[i];
  }
  if (!checkout) {
    process.stderr.write('usage: node scripts/sweep-presentation.mjs <checkout> [--write-set <file>] [--json]\n');
    process.exit(2);
  }
  let writeSet = null;
  if (setFile !== null) {
    if (!existsSync(setFile)) { process.stderr.write(`--write-set: ${setFile} cannot be read\n`); process.exit(2); }
    writeSet = readFileSync(setFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  }
  const result = sweepCheckout(path.resolve(checkout), writeSet);
  process.stdout.write(`${json ? JSON.stringify(result, null, 2) : formatReport(result)}\n`);
  if (result.findings.length) process.exitCode = 1;
}
