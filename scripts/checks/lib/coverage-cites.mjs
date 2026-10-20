// coverage-cites.mjs - R247's static projection of catalogued ruling amendments.
import { rulingRetirementExempt } from './ruling-cites.mjs';
import { maskSourceRange as maskSource } from '../../lib/text-mask.mjs';

const CODE = 'RT_COVERAGE_SUPERSEDED_CITE';
const list = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};
const ruleId = /^R\d{2,3}$/;
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/i;
const specPath = /(?:^|\/)[^/]*\.(?:spec|test)\.[cm]?[jt]sx?$/i;
const documentExtension = /\.(?:md|mdx|txt|rst|ya?ml|json|toml|[cm]?[jt]sx?)$/i;
const assetExtension = /\.(?:sh|ps1|html|css|scss|hbs|ejs|njk|tmpl)$/i;
const textExtension = { test: (path) => documentExtension.test(path) || assetExtension.test(path) };
const envFile = /(?:^|\/)[^/]*\.env(?:\.[^/]*)?$/i;
const secretKeyFile = /(?:^|\/)[^/]*\.(?:enc|pem|key|p12|pfx)$/i;

/** Scope predicate also usable before reading files: generated copies and secret material never enter this scan. */
function coverageCitePath(candidate) {
  const path = String(candidate).replaceAll('\\', '/');
  if (/(?:^|\/)(?:node_modules|\.git|\.claude|\.codex|\.tmp-docs|\.runtimes|dist|build|coverage|_derived|secrets|\.secrets)(?:\/|$)/i.test(path)) return false;
  if (/^packages\/(?:hfs\/runtime|eslint\/(?:be|fe)\/runtime)\//.test(path)) return false;
  if (envFile.test(path) || secretKeyFile.test(path)) return false;
  if (/(?:^|\/)CHANGELOG(?:\.[^/]*)?$/i.test(path)) return false;
  if (specPath.test(path)) return true;
  if (path.startsWith('examples/')) return /(?:^|\/)README(?:\.(?:md|mdx|txt|rst))?$/i.test(path);
  if (/^packages\/[^/]+\/src\//.test(path)) return sourceExtension.test(path);
  if (/^(?:docs|knowledge|templates|scripts\/hfs|packages\/hfs\/templates)\//.test(path)) {
    return textExtension.test(path) || /(?:^|\/)(?:README|Dockerfile)(?:\.[^/]*)?$/i.test(path);
  }
  return !path.includes('/') && /\.(?:md|mdx)$/i.test(path);
}

function referenceKey(value, currentRule) {
  if (typeof value === 'object' && value) {
    const rule = value.rule ?? value.ruleId ?? currentRule;
    const item = value.case ?? value.caseId;
    return item && rule ? `${rule}/${item}` : referenceKey(value.id, currentRule);
  }
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^ruling:/, '');
  if (/^R\d{2,3}[ /]case-[1-9]\d*$/.test(text)) return text.replace(' ', '/');
  if (/^case-[1-9]\d*$/.test(text) && currentRule) return `${currentRule}/${text}`;
  if (ruleId.test(text)) return text;
  if (!text) return null;
  return text.startsWith('owner:') ? text : `owner:${text}`;
}

function addRuleNodes(nodes, rules) {
  for (const rule of rules) {
    nodes.set(rule.id, { ...rule, key: rule.id, currentRule: rule.id });
    for (const item of rule.cases ?? []) {
      const key = `${rule.id}/${item.id}`;
      nodes.set(key, { ...item, key, currentRule: rule.id });
    }
  }
}

function addOwnerNodes(nodes, rulings) {
  for (const item of rulings) {
    const key = `owner:${item.id}`;
    nodes.set(key, { ...item, key, currentRule: item.rule ?? item.ruleId });
  }
}

function successorIndex(nodes) {
  const successors = new Map();
  const link = (older, newer) => {
    if (!older || !newer || older === newer) return;
    if (!successors.has(older)) successors.set(older, new Set());
    successors.get(older).add(newer);
  };
  for (const node of nodes.values()) {
    for (const old of list(node.supersedes)) link(referenceKey(old, node.currentRule), node.key);
    for (const newer of list(node.amendedBy)) link(node.key, referenceKey(newer, node.currentRule));
    if (['superseded', 'amended'].includes(node.status) && !successors.has(node.key)) successors.set(node.key, new Set());
  }
  return successors;
}

function dateIndex(nodes) {
  const dates = new Map();
  for (const node of nodes.values()) {
    if (typeof node.date !== 'string') continue;
    if (!dates.has(node.date)) dates.set(node.date, []);
    dates.get(node.date).push(node.key);
  }
  return dates;
}

function rulingIndex(context) {
  const nodes = new Map();
  addRuleNodes(nodes, context.catalog?.rules ?? []);
  const rulings = Array.isArray(context.rulings) ? context.rulings : context.rulings?.rulings ?? [];
  addOwnerNodes(nodes, rulings);
  return { nodes, successors: successorIndex(nodes), dates: dateIndex(nodes) };
}

const CITE_RULE = String.raw`R\d{2,3}`;
const CITE_CASE = String.raw`case-([1-9]\d*)`;
const CITE_SLUG = '[a-z][a-z0-9]*(?:[-._][a-z0-9]+)*';
const CITE_END = String.raw`(?![\w/-])`;
const CITE_GRAMMAR = new RegExp([
  String.raw`\bruling:(${CITE_RULE}(?:\/case-[1-9]\d*)?|${CITE_SLUG})${CITE_END}`,
  String.raw`\b(${CITE_RULE})\s+${CITE_CASE}${CITE_END}`,
  String.raw`\bowner:(${CITE_SLUG})${CITE_END}`,
].join('|'), 'g');

function references(text, index, includeDates = false) {
  const found = [];
  for (const match of text.matchAll(CITE_GRAMMAR)) {
    const key = match[2] ? `${match[2]}/case-${match[3]}` : referenceKey(match[1] ?? `owner:${match[4]}`);
    if (index.nodes.has(key)) found.push({ key, offset: match.index });
  }
  if (includeDates) for (const match of text.matchAll(/\b(?:owner\s+)?ruling\s+(\d{4}-\d{2}-\d{2})\b/gi)) {
    const keys = index.dates.get(match[1]) ?? [];
    // A date shared by live and retired rulings cannot identify which one this prose cites.
    if (keys.length === 1 || keys.every((key) => index.successors.has(key))) {
      for (const key of keys) found.push({ key, offset: match.index });
    }
  }
  return found;
}

/** An editionWhy needs an explicit reference that resolves to a rule, dated case or owner registry entry. */
export function hasRulingReference(text, context) {
  return typeof text === 'string' && references(text, rulingIndex(context)).length > 0;
}

const blank = (text) => text.replace(/[^\r\n]/g, ' ');
const quotedEnd = (text, start, quote) => {
  let cursor = start + 1;
  while (cursor < text.length) {
    if (text[cursor] === '\\') cursor += 2;
    else if (text[cursor++] === quote) break;
  }
  return cursor;
};

function commentEnd(text, start) {
  const block = text[start + 1] === '*';
  const end = block ? text.indexOf('*/', start + 2) : text.indexOf('\n', start + 2);
  if (end < 0) return text.length;
  return block ? end + 2 : end;
}

function regexEnd(text, start) {
  let cursor = start + 1;
  let characterClass = false;
  while (cursor < text.length && text[cursor] !== '\n') {
    const next = text[cursor++];
    if (next === '\\') cursor++;
    else if (next === '[') characterClass = true;
    else if (next === ']') characterClass = false;
    else if (next === '/' && !characterClass) break;
  }
  return cursor;
}

function scanSourceToken(state) {
  const { text, cursor: start } = state;
  const char = text[start];
  if (char === '"' || char === "'" || char === '`') {
    state.cursor = quotedEnd(text, start, char);
    state.strings.push({ start, end: state.cursor });
    maskSource(state.code, start, state.cursor);
    state.previous = 'value';
    return;
  }
  if (text.startsWith('//', start) || text.startsWith('/*', start)) {
    state.cursor = commentEnd(text, start);
    state.comments.push({ start, end: state.cursor });
    maskSource(state.code, start, state.cursor);
    return;
  }
  if (char === '/' && (!state.previous || /^(?:[({[=,:;!?&|]|return|throw|case|yield|=>)$/.test(state.previous))) {
    state.cursor = regexEnd(text, start);
    maskSource(state.code, start, state.cursor);
    state.previous = 'value';
    return;
  }
  if (/[a-zA-Z_$]/.test(char)) {
    state.cursor++;
    while (/[\w$]/.test(text[state.cursor] ?? '')) state.cursor++;
    state.previous = text.slice(start, state.cursor);
    return;
  }
  if (!/\s/.test(char)) state.previous = char;
  state.cursor++;
}

function sourceTokens(text) {
  const state = { text, cursor: 0, previous: '', code: text.split(''), comments: [], strings: [] };
  while (state.cursor < text.length) scanSourceToken(state);
  return state;
}

function commentLine(line) {
  const leading = line.length - line.trimStart().length;
  if (line[leading] === '*' && line[leading + 1] !== '/') return `${line.slice(0, leading)} ${line.slice(leading + 1)}`;
  return line;
}

function commentBody(text) {
  return text.replace(/^\/[/*]/, '  ').replace(/\*\/$/, '  ').split('\n').map(commentLine).join('\n');
}

function titleChunks(text, tokens) {
  const syntax = tokens.code.join('');
  const titles = tokens.strings.filter((token) => /\b(?:test|it|describe)(?:\s*\.\s*(?:only|skip|todo))*\s*\(\s*$/.test(syntax.slice(Math.max(0, token.start - 160), token.start)));
  return titles.map(({ start, end }) => ({ start, body: text.slice(start, end) }));
}

// Preserve offsets while extracting prose from JS/TS. String and regex bodies cannot create fake comments.
function sourceProse(text, titlesOnly) {
  const tokens = sourceTokens(text);
  if (titlesOnly) return titleChunks(text, tokens);
  const extracted = tokens.comments.map(({ start, end }) => ({ start, body: commentBody(text.slice(start, end)) }));
  const prose = blank(text).split('');
  for (const part of extracted) for (let at = 0; at < part.body.length; at++) prose[part.start + at] = part.body[at];
  return [{ start: 0, body: prose.join('') }];
}

function outsideCaseDefinitions(path, text) {
  if (path !== 'knowledge/hfs/rules.yaml') return text;
  let caseIndent = null;
  return text.split('\n').map((line) => {
    const declaration = /^(\s*)cases:\s*(?:#.*)?$/.exec(line);
    if (declaration) { caseIndent = declaration[1].length; return blank(line); }
    if (caseIndent === null) return line;
    if (line.trim() && !line.trimStart().startsWith('#') && /^\s*/.exec(line)[0].length <= caseIndent) { caseIndent = null; return line; }
    return blank(line);
  }).join('\n');
}

function proseChunks(path, text) {
  if (specPath.test(path)) return sourceProse(text, true);
  if (/^packages\/[^/]+\/src\//.test(path)) return sourceProse(text, false);
  return [{ start: 0, body: outsideCaseDefinitions(path, text) }];
}

function paragraphs(chunk) {
  const result = [];
  let start = 0;
  for (const separator of chunk.body.matchAll(/\r?\n[\t ]*\r?\n/g)) {
    result.push({ start: chunk.start + start, body: chunk.body.slice(start, separator.index) });
    start = separator.index + separator[0].length;
  }
  result.push({ start: chunk.start + start, body: chunk.body.slice(start) });
  return result;
}

function stalePatterns(index) {
  const result = [];
  for (const node of index.nodes.values()) for (const pattern of list(node.staleWhen)) {
    if (typeof pattern !== 'string') continue;
    try { result.push({ key: node.key, match: new RegExp(pattern, 'gim') }); } catch { /* Catalog validation owns malformed patterns. */ }
  }
  return result;
}

function allowedSuccessors(key, index) {
  const successors = new Set();
  const visit = (current) => {
    for (const successor of index.successors.get(current) ?? []) {
      if (successor === key || successors.has(successor)) continue;
      successors.add(successor);
      visit(successor);
    }
  };
  visit(key);
  return successors;
}

/** Synchronous static R247 findings. The caller supplies already-read safe repository texts. */
function collectFinding(path, text, findings, seen, offset, message, rules = []) {
  const line = text.slice(0, offset).split('\n').length;
  const key = `${path}:${line}:${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({ code: CODE, level: 'error', path, line, message, rules });
}

function paragraphCites(paragraph, index, add) {
  const cites = references(paragraph.body, index, true);
  const present = new Set(cites.map((cite) => cite.key));
  for (const cite of cites) {
    if (!index.successors.has(cite.key)) continue;
    const successors = allowedSuccessors(cite.key, index);
    if ([...successors].some((successor) => present.has(successor))) continue;
    const rules = [cite.key, ...successors].map((key) => index.nodes.get(key)?.currentRule).filter(Boolean);
    add(paragraph.start + cite.offset, `${cite.key} is superseded; cite ${[...successors].join(' or ') || 'its recorded successor'} in the same paragraph.`, rules);
  }
}

function chunkPatterns(path, chunk, patterns, index, add) {
  for (const pattern of patterns) {
    const record = index.nodes.get(pattern.key);
    if (rulingRetirementExempt(record, path)) continue;
    pattern.match.lastIndex = 0;
    const rule = record.currentRule;
    for (const match of chunk.body.matchAll(pattern.match)) add(chunk.start + match.index, `${pattern.key} records stale wording here; follow its current ruling.`, rule ? [rule] : []);
  }
}

function fileCites(path, text, index, patterns, findings, seen) {
  const add = (offset, message, rules) => collectFinding(path, text, findings, seen, offset, message, rules);
  for (const chunk of proseChunks(path, text)) {
    for (const paragraph of paragraphs(chunk)) paragraphCites(paragraph, index, add);
    chunkPatterns(path, chunk, patterns, index, add);
  }
}

/** Synchronous static R247 findings. The caller supplies already-read safe repository texts. */
export function coverageCiteFindings(context) {
  const index = rulingIndex(context);
  const patterns = stalePatterns(index);
  const findings = [];
  const seen = new Set();
  const files = context.files instanceof Map ? context.files : new Map(Object.entries(context.files ?? {}));
  for (const [candidate, text] of files) {
    const path = candidate.replaceAll('\\', '/');
    if (!coverageCitePath(path) || typeof text !== 'string') continue;
    fileCites(path, text, index, patterns, findings, seen);
  }
  return findings;
}
