/**
 * Lane v6-2 scratch tool #6: emit the machine-derived blocks of knowledge/grammars/common/DNA.yaml
 * straight from the Common public entry's own source, so every table in the snapshot is a measurement
 * with a recorded line anchor and digest. Prose (purpose, provenance limitations, gaps) is authored by
 * hand around these blocks.
 *
 *   node ex-testing/lint/scratch/v6-2-dna.mjs            # print the blocks
 *   node ex-testing/lint/scratch/v6-2-dna.mjs --shas     # print source digests only
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const claude = 'D:/Repositories/starci-academy-backend/.claude';
const src = path.join(claude, 'packages/grammar/src');
const read = file => fs.readFileSync(file, 'utf8');
const relOf = file => path.relative(claude, file).replaceAll('\\', '/');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, m => ' '.repeat(m.length));
const q = value => `"${String(value).replaceAll('"', '\\"')}"`;

const resolve = (fromFile, specifier) => {
  const base = path.resolve(path.dirname(fromFile), specifier).replace(/\.js$/, '');
  for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}.js`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) return candidate;
  }
  return null;
};

const commonCssFile = path.join(src, 'common/styles.css');
const commonCssText = read(commonCssFile);
const commonCss = stripComments(commonCssText);
const NAME = /(?<![\w.-])(--[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)(?![\w-])/g;
const RULE_ID = /\b([A-Z][A-Z0-9]*-[A-Z0-9]+)\b/g;
const CLASSISH = /(?:^|[^A-Za-z0-9_-])((?:starci-core|grammar)-[A-Za-z0-9-]+(?:--[A-Za-z0-9-]+)?)/g;

// ---------------------------------------------------------------- tokens ----
const assigned = new Map();
for (const m of commonCss.matchAll(/(?<![\w-])(--[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\s*:\s*([^;]+);/g)) {
  const name = m[1];
  const value = m[2].trim();
  const entry = assigned.get(name) ?? { values: [], line: lineAt(commonCssText, m.index), uses: 0 };
  entry.uses += 1;
  if (!entry.values.includes(value)) entry.values.push(value);
  assigned.set(name, entry);
}
const reads = new Map();
for (const m of commonCss.matchAll(/var\(\s*(--[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/g)) {
  const name = m[1];
  let depth = 1, at = m.index + m[0].length;
  for (; at < commonCss.length; at += 1) {
    if (commonCss[at] === '(') depth += 1;
    else if (commonCss[at] === ')') { depth -= 1; if (depth === 0) break; }
    else if (commonCss[at] === '\n') break;
  }
  const fallback = commonCss.slice(m.index + m[0].length, at).trim().replace(/^,\s*/, '');
  const entry = reads.get(name) ?? { uses: 0, line: lineAt(commonCssText, m.index), first: fallback, chains: new Set() };
  entry.uses += 1;
  if (fallback) entry.chains.add(fallback);
  reads.set(name, entry);
}

const tokenNames = [...new Set([...assigned.keys(), ...reads.keys()])].sort();
const tokensOf = name => {
  const a = assigned.get(name);
  const r = reads.get(name);
  const core = name.startsWith('--starci-core-');
  const grammar = name.startsWith('--grammar-');
  const entry = { name };
  if (a && !r) {
    entry.assignedBy = 'common';
    entry.value = a.values[0];
    entry.valueRules = a.values.length;
    entry.sourceLine = a.line;
  } else if (a && r) {
    entry.assignedBy = 'common';
    entry.value = a.values[0];
    entry.valueRules = a.values.length;
    entry.sourceLine = a.line;
    entry.alsoReadBy = r.uses;
  } else {
    entry.assignedBy = core ? 'family' : grammar ? 'common' : 'host';
    entry.sourceLine = r.line;
    entry.readBy = 'common';
    entry.uses = r.uses;
    if (r.first) entry.commonFallback = r.first;
  }
  return entry;
};

const tokenLines = tokenNames.map(name => {
  const entry = tokensOf(name);
  const out = [`  - name: ${q(entry.name)}`];
  if (entry.value !== undefined) out.push(`    value: ${q(entry.value)}`);
  if (entry.valueRules > 1) out.push(`    valueRules: ${entry.valueRules}`);
  out.push(`    assignedBy: ${entry.assignedBy}`);
  if (entry.readBy) out.push(`    readBy: common`);
  if (entry.commonFallback) out.push(`    commonFallback: ${q(entry.commonFallback)}`);
  if (entry.uses !== undefined) out.push(`    uses: ${entry.uses}`);
  if (entry.alsoReadBy !== undefined) out.push(`    alsoReadBy: ${entry.alsoReadBy}`);
  out.push(`    source: ${q(`packages/grammar/src/common/styles.css:${entry.sourceLine}`)}`);
  return out.join('\n');
});

// ------------------------------------------------------------- renderers ----
const barrel = read(path.join(src, 'common/renderers.ts'));
const registryText = read(path.join(src, 'common/registry.tsx'));
const registryBlock = /COMMON_GRAMMAR_COMPONENTS = Object\.freeze\(\{([\s\S]*?)\} as const\)/.exec(registryText)?.[1] ?? '';
const registry = [...new Set([...registryBlock.matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)].map(m => m[1]))];

const groups = [];
for (const line of barrel.split('\n')) {
  const m = /^export \{(.+)\} from "(.+)"$/.exec(line.trim());
  if (m) groups.push({ names: m[1].split(',').map(s => s.trim()).filter(p => p && !p.startsWith('type ')), types: m[1].split(',').map(s => s.trim()).filter(p => p.startsWith('type ')).map(p => p.slice(5).trim()), specifier: m[2] });
}

const ownFiles = entryFile => {
  const dir = path.dirname(entryFile);
  if (!path.basename(entryFile).startsWith('index.')) return [entryFile];
  return fs.readdirSync(dir).filter(name => /\.(ts|tsx)$/.test(name) && !/\.(spec|test)\./.test(name)).map(name => path.join(dir, name));
};

/** Class literals written by the shared `classNames.ts` exports a component names in its imports. */
const importedClasses = (file, own) => {
  const out = new Map();
  const text = stripComments(read(file));
  for (const m of text.matchAll(/import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*"(\.[^"]+)"/g)) {
    const target = resolve(file, m[2]);
    if (!target || own.includes(target) || !target.startsWith(src)) continue;
    const targetText = stripComments(read(target));
    for (const raw of m[1].split(',')) {
      const name = raw.replace(/^type\s+/, '').trim();
      if (!name) continue;
      const decl = new RegExp(`export const ${name}[^=]*=([\\s\\S]*?)(?=\\n(?:export |\\/\\*\\*|\\/\\/)|$)`).exec(targetText);
      if (!decl) continue;
      const classes = [...decl[1].matchAll(CLASSISH)].map(c => c[1]);
      if (classes.length) out.set(name, { classes, target: relOf(target) });
    }
  }
  return out;
};

const rendererRows = [];
for (const group of groups) {
  const entryFile = resolve(path.join(src, 'common/renderers.ts'), group.specifier);
  const own = ownFiles(entryFile);
  const classes = new Map();
  const statics = new Set();
  const computed = new Set();
  const viaImports = new Map();
  for (const file of own) {
    const text = stripComments(read(file));
    const rest = text.replace(/data-contract="([^"]*)"/g, (all, ids) => {
      for (const m of ids.matchAll(RULE_ID)) statics.add(m[1]);
      return ' ';
    });
    for (const m of rest.matchAll(RULE_ID)) computed.add(m[1]);
    for (const m of text.matchAll(CLASSISH)) if (!classes.has(m[1])) classes.set(m[1], relOf(file));
    for (const [name, info] of importedClasses(file, own)) {
      viaImports.set(name, info);
      for (const cls of info.classes) if (!classes.has(cls)) classes.set(cls, `via ${info.target}:${name}`);
    }
  }
  const rel = relOf(entryFile);
  const fromSrc = path.relative(src, entryFile).split(path.sep).filter(Boolean);
  const kind = fromSrc.length >= 3 ? fromSrc[1] : 'core';
  for (const name of group.names.filter(n => /^[A-Z]/.test(n))) {
    rendererRows.push({
      component: name,
      kind: kind.replace(/\.[a-z]+$/, ''),
      propsType: group.types.includes(`${name}Props`) ? `${name}Props` : null,
      source: rel,
      classes: [...classes.keys()].sort(),
      classSites: Object.fromEntries(classes),
      claims: [...statics].sort(),
      computedClaims: [...computed].filter(id => !statics.has(id)).sort(),
    });
  }
}
rendererRows.sort((a, b) => a.component.localeCompare(b.component));

const rendererLines = rendererRows.map(row => {
  const out = [`  - component: ${q(row.component)}`];
  out.push(`    propsType: ${q(row.propsType ?? 'unstated')}`);
  out.push(`    kind: ${q(row.kind)}`);
  out.push(`    source: ${q(row.source)}`);
  out.push(`    claims: [${row.claims.map(c => q(c)).join(', ')}]`);
  out.push(`    computedClaims: [${row.computedClaims.map(c => q(c)).join(', ')}]`);
  out.push('    classes:');
  if (!row.classes.length) out[out.length - 1] = '    classes: []';
  for (const cls of row.classes) out.push(`      - ${q(cls)}`);
  return out.join('\n');
});

// -------------------------------------------------------------- digests ----
const digestFiles = [
  path.join(src, 'common/index.ts'), path.join(src, 'common/renderers.ts'), path.join(src, 'common/registry.tsx'),
  path.join(src, 'common/styles.css'), path.join(src, 'common/spacing.ts'), path.join(src, 'common/state.ts'),
  path.join(src, 'common/conformance.ts'), path.join(src, 'common/rule-catalog.generated.ts'),
  path.join(src, 'core/styles.css'), path.join(src, 'core/dna.ts'), path.join(src, 'core/classNames.ts'),
];
const digestLines = digestFiles.map(file => `  - path: ${q(relOf(file))}\n    sha256: ${q(sha256(file))}`);

if (process.argv.includes('--shas')) {
  console.log(digestFiles.map((file, i) => `${sha256(file)}  ${relOf(file)}`).join('\n'));
  console.log(`\ncommon/styles.css rules: ${(commonCss.match(/\{/g) ?? []).length}, lines: ${commonCssText.split('\n').length}`);
  console.log(`installed dist/common/styles.css matches src: ${sha256(path.join(claude, 'examples/todo-app-frontend/node_modules/@starci/grammar/dist/common/styles.css')) === sha256(commonCssFile)}`);
  process.exit(0);
}

const allClasses = [...new Set(rendererRows.flatMap(r => r.classes))].sort();
const cardSurface = [...new Set(rendererRows.filter(r => /card$/i.test(r.component)).flatMap(r => r.classes)
  .map(c => c.split('--')[0]).filter(c => /-surface(-card)?$/.test(c)))].sort();

// Cross-check the census against the sibling StarCi Core snapshot: same package version, same physical
// renderers, so a disagreement is either a drift in the snapshot or a hole in this census. Both are worth
// reporting; neither is a reason to copy the table.
const dna = (await import('../../../core/yaml.mjs')).parseYaml(read(path.join(claude, 'knowledge/grammars/starci/DNA.yaml')));
const dnaBy = new Map(dna.renderers.map(r => [r.component, {
  claims: [...new Set([...(r.claims ?? []), ...(r.computedClaims ?? [])])].sort(),
  classes: (r.classes ?? []).slice().sort(),
}]));
const drift = [];
for (const row of rendererRows) {
  const mine = { claims: [...new Set([...row.claims, ...row.computedClaims])].sort(), classes: row.classes };
  const theirs = dnaBy.get(row.component);
  if (!theirs) { drift.push(`${row.component}: absent from the starci snapshot`); continue; }
  const claimDiff = [...theirs.claims.filter(c => !mine.claims.includes(c)).map(c => `snapshot-only ${c}`),
    ...mine.claims.filter(c => !theirs.claims.includes(c)).map(c => `census-only ${c}`)];
  const classDiff = [...theirs.classes.filter(c => !mine.classes.includes(c)).map(c => `snapshot-only ${c}`),
    ...mine.classes.filter(c => !theirs.classes.includes(c)).map(c => `census-only ${c}`)];
  if (claimDiff.length) drift.push(`${row.component} claims: ${claimDiff.join(', ')}`);
  if (classDiff.length) drift.push(`${row.component} classes: ${classDiff.join(', ')}`);
}
console.log(`# cross-check vs knowledge/grammars/starci/DNA.yaml: ${drift.length} difference(s)`);
for (const line of drift) console.log(`#   ${line}`);

console.log(`# identity: renderers=${rendererRows.length} tokens=${tokenNames.length} classes=${allClasses.length} cardSurfaceClasses=${cardSurface.join(' ')}`);
console.log(`# assigned=${[...assigned.keys()].length} read=${[...reads.keys()].length} claimsTotal=${rendererRows.reduce((n, r) => n + r.claims.length + r.computedClaims.length, 0)}`);
console.log(`# registry names == barrel components: ${registry.length === rendererRows.length && registry.every(n => rendererRows.some(r => r.component === n))}`);
console.log('\n# ---- tokens ----\ntokens:\n' + tokenLines.join('\n'));
console.log('\n# ---- renderers ----\nrenderers:\n' + rendererLines.join('\n'));
console.log('\n# ---- source digests ----\nsourceDigests:\n' + digestLines.join('\n'));
console.log(`\n# ---- every class the Common entry can emit ----\nclassUniverse: ${allClasses.join(' ')}`);
