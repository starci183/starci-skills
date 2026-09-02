// Generate the StarCi Core Grammar DNA: a compact, injectable summary of what the live package
// actually publishes, so a direction agent can be primed without reading the anatomy prose.
//
// Everything except the gap list is read mechanically out of `@grammar` source: package.json, the
// checkout head, `src/core/index.ts`, `src/core/styles.css`, `src/common/styles.css`,
// `src/common/renderers.ts`, and each renderer folder's own `.ts`/`.tsx`. Nothing here is inferred:
// a value that the regexes cannot resolve is printed as the type name, never guessed.
//
// The one knowledge input is the gap inventory: every table row in the six anatomy topics
// (surface, boundary, icon, media, control-state, field) whose Common-owner or Core-realization
// cell opens with `gap`. The topics' own preamble says "the last column", but the live rows put
// `gap` in whichever of the two owner cells is missing, so both are scanned; scanning only the last
// cell would publish 2 of the 13 recorded gaps.
//
// Usage:
//   node scripts/generate-grammar-dna.mjs [--grammar <path to packages/grammar>]
//   node scripts/generate-grammar-dna.mjs --check      exits 1 when the committed files differ
//
// NOT part of `npm test`: it needs the routed FE checkout on disk, which CI and a fresh clone do
// not have. Run it by hand after a Grammar change. `--check` ignores the generation date in the
// header line (only that token), so a re-run on a later day is not a false failure.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const claudeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(claudeRoot, '..');
const knowledgeDir = path.join(claudeRoot, 'knowledge');
const outDir = path.join(knowledgeDir, 'grammars', 'starci');

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const grammarFlag = argv.indexOf('--grammar');

function resolveGrammarRoot() {
  if (grammarFlag !== -1) {
    const given = argv[grammarFlag + 1];
    if (!given) throw new Error('--grammar needs a path');
    return path.resolve(given);
  }
  const route = path.join(sourceRoot, '.workspaces', 'local', 'routes', 'starci-academy', 'fe', 'config.json');
  if (!existsSync(route)) throw new Error(`no routed FE checkout: ${route} is missing (pass --grammar <path>)`);
  const diskPath = JSON.parse(readFileSync(route, 'utf8')).repository?.diskPath;
  if (!diskPath) throw new Error(`${route}: repository.diskPath is absent`);
  return path.join(diskPath, 'packages', 'grammar');
}

const grammarRoot = resolveGrammarRoot();
const srcDir = path.join(grammarRoot, 'src');
if (!existsSync(srcDir)) throw new Error(`${srcDir} is not a Grammar checkout`);

const read = (p) => readFileSync(p, 'utf8');
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// ---------------------------------------------------------------- identity
const pkg = JSON.parse(read(path.join(grammarRoot, 'package.json')));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: grammarRoot, encoding: 'utf8' }).trim();
const coreIndex = read(path.join(srcDir, 'core', 'index.ts'));
const familyId = /defineGrammarFamily\(\{\s*id:\s*"([^"]+)"/.exec(coreIndex)?.[1] ?? '—';
const rootExport = /export const (\w*GrammarRoot)\s*=/.exec(coreIndex)?.[1] ?? '—';
const styleEntrypoint = /entrypoint:\s*"([^"]+)"/.exec(coreIndex)?.[1] ?? '—';
const scopeAttribute = /scope:\s*\{\s*attribute:\s*"([^"]+)",\s*value:\s*"([^"]+)"/.exec(coreIndex);
const scope = scopeAttribute ? `${scopeAttribute[1]}="${scopeAttribute[2]}"` : '—';

// ---------------------------------------------------------------- tokens
// A token's default is its family-scope declaration where one exists, otherwise the fallback it is
// always read with. Balanced parentheses matter: `calc(100dvh - 3rem)` is one value, not a prefix.
function readValueAt(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      if (depth === 0) return text.slice(start, i).trim();
      depth -= 1;
    } else if ((ch === ';' || ch === '\n') && depth === 0) return text.slice(start, i).trim();
  }
  return text.slice(start).trim();
}

const TOKEN = /--starci-core-[a-z0-9-]+/g;
const cssFiles = [path.join(srcDir, 'core', 'styles.css'), path.join(srcDir, 'common', 'styles.css')];
const tokens = new Map();
for (const file of cssFiles) {
  const css = read(file);
  for (const name of new Set(css.match(TOKEN) ?? [])) if (!tokens.has(name)) tokens.set(name, null);
  // Declarations win over fallbacks; the first declaration in core/styles.css is the light default.
  for (const m of css.matchAll(new RegExp(`(^|[;{\\s])(${TOKEN.source})\\s*:`, 'g'))) {
    const name = m[2];
    if (tokens.get(name) == null) tokens.set(name, readValueAt(css, m.index + m[0].length));
  }
}
for (const file of cssFiles) {
  const css = read(file);
  for (const m of css.matchAll(new RegExp(`var\\(\\s*(${TOKEN.source})\\s*,`, 'g'))) {
    const name = m[1];
    if (tokens.get(name) == null) tokens.set(name, readValueAt(css, m.index + m[0].length));
  }
}
const tokenRows = [...tokens.entries()].sort(([a], [b]) => a.localeCompare(b));

// ---------------------------------------------------------------- published rule ids
const HEADING = /^## ([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-(?:\d+|AUTO))\b/;
function walkMd(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMd(full));
    else if (entry.name.endsWith('.md') && !entry.name.endsWith('.vi.md')) out.push(full);
  }
  return out;
}
const publishedIds = new Set();
for (const file of walkMd(knowledgeDir)) {
  for (const line of read(file).split(/\r?\n/)) {
    const m = HEADING.exec(line);
    if (m) publishedIds.add(m[1]);
  }
}
const ID_RE = new RegExp(`\\b(?:${[...publishedIds].sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');

// ---------------------------------------------------------------- renderers
const renderersFile = read(path.join(srcDir, 'common', 'renderers.ts'));
const exports = [];
for (const m of renderersFile.matchAll(/export \{([^}]*)\} from "([^"]+)"/g)) {
  const modulePath = m[2].replace(/^\.\.\//, '').replace(/\.js$/, '');
  const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  const components = names.filter((n) => !n.startsWith('type ') && /^[A-Z]/.test(n));
  const types = new Set(names.filter((n) => n.startsWith('type ')).map((n) => n.slice(5).trim()));
  for (const component of components) exports.push({ component, types, modulePath });
}

const KINDS = new Set(['primitive', 'composite', 'branch', 'composition']);
function kindOf(modulePath) {
  const segments = modulePath.split('/');
  const kind = segments[1];
  return KINDS.has(kind) ? kind : segments[0];
}

const SKIP_TYPES = new Set([
  'ReactNode', 'ReactElement', 'SlotContent', 'string', 'number', 'boolean', 'never', 'undefined',
  'Key', 'CSSProperties', 'RefObject', 'unknown', 'void',
]);
const LITERAL_UNION = /^(?:"[^"]*"|\d+)(?:\s*\|\s*(?:"[^"]*"|\d+))+$/;
const SINGLE_NAME = /^[A-Z][A-Za-z0-9]*$/;

function folderSource(folder) {
  let text = '';
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name.includes('.spec.') || entry.name.includes('.test.')) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    text += `${read(path.join(folder, entry.name))}\n`;
  }
  return text;
}

const unresolved = [];
const rendererRows = [];
const seen = new Set();
for (const { component, types, modulePath } of exports) {
  if (seen.has(component)) continue;
  seen.add(component);
  // A renderer folder is `<kind>/<Name>/index`; the three renderers that are a bare file in
  // `core/` have no folder of their own, so only that file is read.
  const isFolder = modulePath.endsWith('/index');
  const abs = path.join(srcDir, modulePath);
  const raw = isFolder
    ? folderSource(path.dirname(abs))
    : read(existsSync(`${abs}.tsx`) ? `${abs}.tsx` : `${abs}.ts`);
  const source = stripComments(raw);

  // Type aliases declared in this folder, so `tone?: BadgeTone` can resolve to its own values.
  const aliases = new Map();
  for (const m of source.matchAll(/^\s*(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*=\s*([^\n;]+)/gm)) {
    aliases.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  }
  // A generic parameter (`SurfaceAccordionCardItem<Summary, Body>`) is a caller's type, not a
  // published value set; it is never printed as a prop type.
  const generics = new Set();
  for (const m of source.matchAll(/\b(?:type|interface)\s+[A-Za-z0-9_]+\s*<([^>]*)>/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+/)[0];
      if (name) generics.add(name);
    }
  }
  const resolve = (text, depth = 0) => {
    const clean = text.trim().replace(/\s+/g, ' ');
    if (LITERAL_UNION.test(clean)) return { values: clean.split('|').map((v) => v.trim().replace(/"/g, '')) };
    if (depth < 3 && SINGLE_NAME.test(clean) && aliases.has(clean)) return resolve(aliases.get(clean), depth + 1);
    return { name: clean };
  };

  // Props: every `readonly name?: <type>` in the folder, so intersection members count too.
  const props = new Map();
  for (const m of source.matchAll(/readonly\s+([A-Za-z0-9_]+)\??\s*:\s*([^;\n},]+(?:\|[^;\n},]+)*)/g)) {
    const [, name, typeText] = m;
    const resolved = resolve(typeText);
    if (resolved.values) {
      const prior = props.get(name);
      if (!prior || prior.startsWith('`')) props.set(name, resolved.values.map((v) => `\`${v}\``).join(' \\| '));
      continue;
    }
    if (props.has(name)) continue;
    if (SKIP_TYPES.has(resolved.name) || generics.has(resolved.name) || !SINGLE_NAME.test(resolved.name)) continue;
    props.set(name, resolved.name);
    unresolved.push(`${component}.${name}: ${resolved.name}`);
  }

  // Claims: ids inside a literal `data-contract` attribute are static; every other published id in
  // the folder reaches the DOM only through a map or helper, so it is reported as computed.
  const staticIds = new Set();
  for (const m of source.matchAll(/data-contract"?\s*[:=]\s*(?:\{\s*)?"([^"]*)"/g)) {
    for (const id of m[1].match(ID_RE) ?? []) staticIds.add(id);
  }
  const allIds = new Set(source.match(ID_RE) ?? []);
  const computed = [...allIds].filter((id) => !staticIds.has(id)).sort();
  const claims = [
    ...[...staticIds].sort(),
    ...(computed.length > 0 ? [`computed: ${computed.join(' ')}`] : []),
  ];

  const classes = [...new Set(source.match(/(?<![-\w])starci-core-[a-z0-9-]+/g) ?? [])].sort();
  const propsType = [...types].find((t) => t === `${component}Props`) ?? '—';

  rendererRows.push({
    component,
    kind: kindOf(modulePath),
    propsType,
    props: [...props.entries()].map(([n, v]) => `${n}: ${v}`),
    claims,
    classes,
  });
}

// ---------------------------------------------------------------- gaps
const GAP_TOPICS = ['surface', 'boundary', 'icon', 'media', 'control-state', 'field'];
function splitCells(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cur = '';
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === '\\') { cur += ch + (trimmed[i + 1] ?? ''); i += 1; continue; }
    if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}
function readGaps(suffix) {
  const rows = [];
  for (const topic of GAP_TOPICS) {
    const file = path.join(outDir, `${topic}${suffix}`);
    if (!existsSync(file)) continue;
    let rule = '';
    for (const line of read(file).split(/\r?\n/)) {
      const h = HEADING.exec(line);
      if (h) rule = h[1];
      if (!line.trim().startsWith('|')) continue;
      const cell = splitCells(line).find((c) => /^`?gap`?\b/i.test(c));
      if (!cell) continue;
      rows.push({ rule, clause: cell.replace(/^`?gap`?\s*(?:—|-|:)?\s*/i, '').trim() });
    }
  }
  return rows;
}
const gapRows = readGaps('.md');
// The Vietnamese mirror carries the same rows in the house voice; pair by rule and ordinal so a
// row the mirror has not caught up with still prints its English clause rather than nothing.
const viGaps = readGaps('.vi.md');
const ordinal = new Map();
for (const row of gapRows) {
  const n = (ordinal.get(row.rule) ?? 0) + 1;
  ordinal.set(row.rule, n);
  row.vi = viGaps.filter((g) => g.rule === row.rule)[n - 1]?.clause ?? row.clause;
}

// ---------------------------------------------------------------- render
const today = new Date().toISOString().slice(0, 10);
const headerLine = (en) => en
  ? `\`${pkg.name}@${pkg.version}\` · checkout \`${head}\` · generated ${today}`
  : `\`${pkg.name}@${pkg.version}\` · checkout \`${head}\` · sinh ngày ${today}`;

function renderers(en) {
  const header = en
    ? '| Renderer | Kind | Props with closed values | Claims | Classes |'
    : '| Renderer | Loại | Prop có tập giá trị đóng | Claim | Class |';
  const rows = rendererRows.map((r) => `| \`${r.component}\` \`${r.propsType}\` | ${r.kind} | ${r.props.length > 0 ? r.props.join('; ') : '—'} | ${r.claims.length > 0 ? r.claims.join(' ') : '—'} | ${r.classes.length > 0 ? r.classes.map((c) => `\`${c}\``).join(' ') : '—'} |`);
  return [header, '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}

function document(en) {
  const t = en
    ? {
      title: '# StarCi Core — DNA',
      intro: `This file is generated from the live \`@starci/grammar\` package, never written by hand: identity, tokens, renderers, published props, \`data-contract\` claims, and emitted classes are read out of \`src/\`, and the gap list is read out of the six anatomy topics in this folder. Prime a direction agent with this file; open the topic a row belongs to only when that row raises a question. Regenerate with \`node scripts/generate-grammar-dna.mjs\`, and verify with \`--check\`; it needs the routed FE checkout, so it is not part of \`npm test\`.`,
      identity: '## Identity',
      identityHeader: '| Fact | Value |',
      tokens: '## Tokens',
      tokensHeader: '| Token | Default |',
      renderersHead: '## Renderers',
      gaps: '## Gaps',
      gapsHeader: '| Rule | Missing capability |',
      facts: [
        ['Package', `\`${pkg.name}\``],
        ['Version', `\`${pkg.version}\``],
        ['Checkout head', `\`${head}\``],
        ['Family id', `\`${familyId}\``],
        ['Root component', `\`${rootExport}\``],
        ['Family scope', `\`${scope}\``],
        ['Style entrypoint', `\`${styleEntrypoint}\``],
        ['Counts', `${rendererRows.length} renderers · ${tokenRows.length} tokens · ${rendererRows.reduce((n, r) => n + r.claims.length, 0)} claim entries · ${gapRows.length} gaps`],
      ],
    }
    : {
      title: '# StarCi Core — DNA',
      intro: `File này được sinh ra từ package \`@starci/grammar\` đang chạy, không viết tay: danh tính, token, renderer, prop công bố, claim \`data-contract\` và class phát ra đều đọc thẳng từ \`src/\`, còn danh sách gap đọc từ sáu topic giải phẫu trong thư mục này. Hãy mồi cho agent định hướng bằng đúng file này, và chỉ mở topic tương ứng khi một dòng làm nảy ra câu hỏi. Sinh lại bằng \`node scripts/generate-grammar-dna.mjs\`, kiểm bằng \`--check\`; lệnh này cần checkout FE đã định tuyến nên không nằm trong \`npm test\`.`,
      identity: '## Danh tính',
      identityHeader: '| Dữ kiện | Giá trị |',
      tokens: '## Token',
      tokensHeader: '| Token | Mặc định |',
      renderersHead: '## Renderer',
      gaps: '## Gap',
      gapsHeader: '| Luật | Năng lực còn thiếu |',
      facts: [
        ['Package', `\`${pkg.name}\``],
        ['Phiên bản', `\`${pkg.version}\``],
        ['Head của checkout', `\`${head}\``],
        ['Family id', `\`${familyId}\``],
        ['Component gốc', `\`${rootExport}\``],
        ['Phạm vi family', `\`${scope}\``],
        ['Điểm vào CSS', `\`${styleEntrypoint}\``],
        ['Số đếm', `${rendererRows.length} renderer · ${tokenRows.length} token · ${rendererRows.reduce((n, r) => n + r.claims.length, 0)} mục claim · ${gapRows.length} gap`],
      ],
    };

  return [
    t.title,
    '',
    headerLine(en),
    '',
    t.intro,
    '',
    t.identity,
    '',
    t.identityHeader,
    '| --- | --- |',
    ...t.facts.map(([k, v]) => `| ${k} | ${v} |`),
    '',
    t.tokens,
    '',
    t.tokensHeader,
    '| --- | --- |',
    ...tokenRows.map(([name, value]) => `| \`${name}\` | \`${value ?? '—'}\` |`),
    '',
    t.renderersHead,
    '',
    renderers(en),
    '',
    t.gaps,
    '',
    t.gapsHeader,
    '| --- | --- |',
    ...gapRows.map((g) => `| \`${g.rule}\` | ${en ? g.clause : g.vi} |`),
    '',
  ].join('\n');
}

const outputs = [
  [path.join(outDir, 'DNA.md'), document(true)],
  [path.join(outDir, 'DNA.vi.md'), document(false)],
];

// The generation date is the one token allowed to drift, so --check stays honest across days.
const normalise = (text) => text.replace(/(generated|sinh ngày) \d{4}-\d{2}-\d{2}/, '$1 <date>');

if (checkOnly) {
  const drifted = outputs.filter(([file, text]) => !existsSync(file) || normalise(read(file)) !== normalise(text));
  if (drifted.length > 0) {
    process.stderr.write(`grammar DNA is stale: ${drifted.map(([f]) => path.relative(claudeRoot, f)).join(', ')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`grammar DNA current: ${rendererRows.length} renderers, ${tokenRows.length} tokens, ${gapRows.length} gaps\n`);
  }
} else {
  for (const [file, text] of outputs) writeFileSync(file, text, 'utf8');
  const claimCount = rendererRows.reduce((n, r) => n + r.claims.length, 0);
  process.stdout.write(`wrote DNA.md and DNA.vi.md: ${tokenRows.length} tokens, ${rendererRows.length} renderers, ${claimCount} claim entries, ${gapRows.length} gaps\n`);
  if (unresolved.length > 0) process.stdout.write(`props printed as a type name (no literal union in the renderer's own folder): ${unresolved.join(', ')}\n`);
}
