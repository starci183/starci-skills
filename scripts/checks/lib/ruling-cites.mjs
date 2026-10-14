// R274: live prose cites current rulings; historical case bodies retain their original words.
import { parseYaml } from '../../../engine/yaml.mjs';
import { ts } from '../../hfs/runtime-rules/source-ast.mjs';
import { lineOf } from '../../lib/check-scan.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

export const CODE = 'RT_RULING_STALE_CITE';
export const RULES_FILE = 'knowledge/hfs/rules.yaml';
export const OWNER_RULINGS_FILE = 'modules/kernel/owner-rulings.yaml';

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)(?:\.tpl)?$/i;
const PROSE = /\.(?:md|ya?ml)(?:\.tpl)?$/i;
const SPEC = /\.spec\.(?:[cm]?[jt]s|[jt]sx)(?:\.tpl)?$/i;
const OUT = /(?:^|\/)(?:node_modules|\.git|\.runtimes|\.runtime|\.starciwork|dist|coverage|secrets|\.secrets)(?:\/|$)/;
const CHANGELOG = /(?:^|\/)CHANGELOG[^/]*\.md$/i;
const ROOT_DOC = /^[^/]+\.md$/i;
const SURFACE = /^(?:docs|knowledge|templates|skills|init|scripts\/hfs|packages)\//;
const EXAMPLE_README = /^examples\/.*(?:^|\/)README[^/]*\.md$/i;

/** Filter before reading: ciphertext, environment files, generated copies and runtime records are never opened. */
export const rulingCiteInScope = (rel) =>
  !OUT.test(rel) &&
  !CHANGELOG.test(rel) &&
  (SOURCE.test(rel) || PROSE.test(rel)) &&
  (rel === OWNER_RULINGS_FILE ||
    ROOT_DOC.test(rel) ||
    SURFACE.test(rel) ||
    EXAMPLE_README.test(rel) ||
    (rel.startsWith('tests/') && SPEC.test(rel)));

const list = (value) => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

/** A retired term may remain only in the ruling's explicitly declared retirement files. */
export const rulingRetirementExempt = (record, rel) =>
  list(record.retires).length > 0 && list(record.retiredIn).includes(rel);

/** A link uses a canonical rule/case, an owner id, or a local case id inside a rule. */
function linkKey(value, rule) {
  if (value && typeof value === 'object') {
    if (value.rule && value.case) return `${value.rule}/${value.case}`;
    return linkKey(value.id, rule);
  }
  const raw = String(value ?? '').replace(/^ruling:/, '');
  const caseMatch = /^(R\d+)[/\s]+(case-\d+)$/.exec(raw);
  if (caseMatch) return `${caseMatch[1]}/${caseMatch[2]}`;
  if (/^case-\d+$/.test(raw) && rule) return `${rule}/${raw}`;
  if (/^R\d+$/.test(raw)) return raw;
  if (raw.startsWith('owner:')) return raw;
  return raw ? `owner:${raw}` : '';
}

function addRecord(records, entry, key, rule) {
  records.set(key, { ...entry, key, rule, successors: new Set() });
}

function catalogRecords(rules, ownerRulings) {
  const records = new Map();
  for (const rule of rules.rules ?? []) {
    addRecord(records, rule, rule.id, rule.id);
    for (const entry of rule.cases ?? []) addRecord(records, entry, `${rule.id}/${entry.id}`, rule.id);
  }
  for (const entry of ownerRulings.rulings ?? []) addRecord(records, entry, `owner:${entry.id}`);
  return records;
}

const isOwnerAmendment = (entry) =>
  entry &&
  typeof entry === 'object' &&
  typeof entry.clause === 'string' &&
  entry.clause.trim() &&
  Number.isInteger(entry.ownerRuling) &&
  entry.ownerRuling > 0 &&
  /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? '');

function addExternalRules(records, supersedes) {
  for (const [successor, old] of Object.entries(supersedes)) {
    const key = linkKey(successor);
    // An evidenced owner amendment can precede the batch that publishes its rule catalog entry.
    // This index record is relationship evidence only; the actual rule takes precedence after merge.
    const evidence = list(old).find(isOwnerAmendment);
    if (!records.has(key) && /^R\d+$/.test(key) && evidence) {
      addRecord(records, { source: 'owner', date: evidence.date, ownerRuling: evidence.ownerRuling, external: true }, key, key);
    }
  }
}

function addEdge(records, predecessor, successor) {
  if (!records.has(predecessor) || !records.has(successor)) {
    throw new Error(`ruling supersession link has no catalog entry: ${predecessor} -> ${successor}`);
  }
  records.get(predecessor).successors.add(successor);
}

function addSupersessionEdges(records, supersedes) {
  for (const record of records.values()) {
    for (const old of list(record.supersedes)) addEdge(records, linkKey(old, record.rule), record.key);
    for (const next of list(record.amendedBy)) addEdge(records, record.key, linkKey(next, record.rule));
  }
  for (const [successor, old] of Object.entries(supersedes)) {
    const key = linkKey(successor);
    for (const predecessor of list(old)) addEdge(records, linkKey(predecessor, records.get(key)?.rule), key);
  }
}

const retiredStatus = (record) => /^(?:superseded|amended)$/.test(record.status ?? '');

function liveSuccessors(records, key, visiting = new Set()) {
  if (visiting.has(key)) throw new Error(`cyclic ruling supersession: ${key}`);
  const record = records.get(key);
  if (!record.successors.size) return retiredStatus(record) ? [] : [key];
  const next = new Set(visiting).add(key);
  return [...new Set([...record.successors].flatMap((successor) => liveSuccessors(records, successor, next)))];
}

/** Build successor edges from both catalogs, including owner-registry cross-catalog supersedes links. */
export function buildRulingIndex({ rules = {}, ownerRulings = {} } = {}) {
  const records = catalogRecords(rules, ownerRulings);
  const supersedes = ownerRulings.supersedes ?? {};
  addExternalRules(records, supersedes);
  addSupersessionEdges(records, supersedes);
  for (const record of records.values()) {
    record.stale = record.successors.size > 0 || retiredStatus(record);
    record.liveSuccessors = record.stale ? liveSuccessors(records, record.key) : [];
  }
  return records;
}

const blank = (text) => text.replace(/[^\r\n]/g, ' ');
const maskedRanges = (text, ranges, keep) => {
  const chars = (keep ? blank(text) : text).split('');
  for (const [start, end] of ranges) {
    for (let at = start; at < end; at += 1) chars[at] = keep || /[\r\n]/.test(text[at]) ? text[at] : ' ';
  }
  return chars.join('');
};

/** Comments and static spec titles alone are prose; fixture strings and application data never make citations. */
function sourceProse(rel, text) {
  const t = ts();
  const kind = /\.[jt]sx(?:\.tpl)?$/i.test(rel) ? t.ScriptKind.TSX : t.ScriptKind.TS;
  // A template placeholder stands for an identifier; equal-width replacement keeps every original prose offset.
  const parseText = rel.endsWith('.tpl') ? text.replace(/@@\w+@@/g, (token) => '_'.repeat(token.length)) : text;
  const source = t.createSourceFile(rel, parseText, t.ScriptTarget.Latest, true, kind);
  const ranges = new Map();
  const titles = [];
  const keep = (start, end) => ranges.set(start, [start, end]);
  const visit = (node) => {
    // Unrendered templates may contain missing/synthetic syntax nodes; their negative offsets own no prose.
    if (node.pos >= 0) for (const range of t.getLeadingCommentRanges(text, node.pos) ?? []) keep(range.pos, range.end);
    if (node.end >= 0) for (const range of t.getTrailingCommentRanges(text, node.end) ?? []) keep(range.pos, range.end);
    if (SPEC.test(rel) && t.isCallExpression(node)) {
      let callee = node.expression;
      while (t.isPropertyAccessExpression(callee)) callee = callee.expression;
      const title = node.arguments[0];
      if (
        t.isIdentifier(callee) &&
        /^(?:test|it|describe)$/.test(callee.text) &&
        title &&
        t.isStringLiteralLike(title)
      ) {
        const start = title.getStart(source) + 1;
        titles.push({ start, text: text.slice(start, title.getEnd() - 1) });
      }
    }
    t.forEachChild(node, visit);
  };
  visit(source);
  // Each title is its own statement: a successor in another test never repairs an old title.
  return [{ start: 0, text: maskedRanges(text, ranges.values(), true) }, ...titles];
}

function jsonCatalogRanges(rel, text, fields) {
  const ranges = [];
  const t = ts();
  const source = t.parseJsonText(rel, text);
  const visit = (node) => {
    if (t.isPropertyAssignment(node) && fields.has(node.name.text)) {
      ranges.push([node.initializer.getStart(source), node.initializer.getEnd()]);
    } else t.forEachChild(node, visit);
  };
  visit(source);
  return ranges;
}

function endsCatalogField(line, fieldIndent) {
  if (fieldIndent === null || !line.trim() || /^\s*#/.test(line)) return false;
  const indent = line.length - line.trimStart().length;
  return indent < fieldIndent || (indent === fieldIndent && !/^\s*-\s/.test(line));
}

function blockCatalogRanges(text, fields) {
  const ranges = [];
  let offset = 0;
  let fieldIndent = null;
  for (const line of text.split('\n')) {
    if (endsCatalogField(line, fieldIndent)) {
      ranges[ranges.length - 1][1] = offset;
      fieldIndent = null;
    }
    const fieldMatch = /^([ \t]*(?:-\s*)?)([\w]+)\s*:/.exec(line);
    if (fieldIndent === null && fields.has(fieldMatch?.[2])) {
      // A mapping key following '- ' starts after that prefix, not at the list item's indent.
      fieldIndent = fieldMatch[1].length;
      ranges.push([offset, text.length]);
    }
    offset += line.length + 1;
  }
  if (fieldIndent !== null) ranges[ranges.length - 1][1] = Math.min(offset, text.length);
  return ranges;
}

/** Exempt historical case nodes and relationship declarations, preserving live rule laws and line offsets. */
function catalogProse(rel, text) {
  if (rel !== RULES_FILE && rel !== OWNER_RULINGS_FILE) return text;
  try {
    parseYaml(text);
  } catch {
    throw new Error(`${rel}: malformed ruling catalog`);
  }
  const fields = new Set(
    rel === OWNER_RULINGS_FILE ? ['rulings', 'supersedes'] : ['cases', 'supersedes', 'amendedBy', 'staleWhen']
  );
  // Both JSON catalogs and authored block YAML mask individual historical fields, never the whole rule.
  const ranges = text.trimStart().startsWith('{')
    ? jsonCatalogRanges(rel, text, fields)
    : blockCatalogRanges(text, fields);
  return maskedRanges(text, ranges, false);
}

/** Inspect each line once: overlapping whitespace repetitions must not backtrack across long blank lines. */
function blankLineBoundaries(text) {
  const boundaries = [];
  for (const match of text.matchAll(/\n([^\n]*)/g)) {
    const end = match.index + match[0].length;
    if (end === text.length) continue;
    const line = match[1].replace(/\r$/, '').replace(/^[ \t]*/, '');
    if (line && !/^(?:\/\/|\*|#|>|<!--\s*-->)\s*$/.test(line)) continue;
    const offset = text[match.index - 1] === '\r' ? match.index - 1 : match.index;
    boundaries.push({ offset, end: end + 1 });
  }
  return boundaries;
}

function precedingBlankLine(text, at) {
  let start = at;
  while (start > 0 && /[ \t]/.test(text[start - 1])) start -= 1;
  if (text[start - 1] !== '\n') return null;
  const offset = start - 1;
  return text[offset - 1] === '\r' ? offset - 1 : offset;
}

function trailingBlankLines(text, at) {
  let end = at;
  let boundary = null;
  while (end < text.length && /\s/.test(text[end])) {
    if (text[end] === '\n') boundary = end + 1;
    end += 1;
  }
  return boundary;
}

function emptyHtmlCommentBoundaries(text) {
  const boundaries = [];
  for (const match of text.matchAll(/<!--\s*-->/g)) {
    const offset = precedingBlankLine(text, match.index);
    if (offset === null) continue;
    const end = trailingBlankLines(text, match.index + match[0].length);
    if (end !== null) boundaries.push({ offset, end });
  }
  return boundaries;
}

function markdownBoundaries(text) {
  const boundaries = [];
  for (const match of text.matchAll(/^.*$/gm)) {
    const content = match[0].replace(/^[ \t]*/, '');
    if (!/^(?:#{1,6}[ \t]|(?:[-+*]|\d+[.)])[ \t]|\||`{3}|~{3})/.test(content)) continue;
    boundaries.push({ offset: match.index, end: match.index });
    if (/^(?:#{1,6}[ \t]|\||`{3}|~{3})/.test(content)) {
      const end = match.index + match[0].length;
      boundaries.push({ offset: end, end });
    }
  }
  return boundaries;
}

/** Paragraph offsets keep citations on adjacent wrapped lines together and split at actual blank/comment-only lines. */
function paragraphsOf(text, rel) {
  const paragraphs = [];
  let start = 0;
  const boundaries = [...blankLineBoundaries(text), ...emptyHtmlCommentBoundaries(text)];
  // Separate YAML values never repair one another's citations when records have no blank separator.
  if (/\.ya?ml(?:\.tpl)?$/i.test(rel)) {
    for (const match of text.matchAll(/\n(?=[ \t]*(?:-[ \t]+)?[A-Za-z_][\w.-]*[ \t]*:(?:[ \t]|\r?\n|$))/g)) {
      boundaries.push({ offset: match.index, end: match.index + 1 });
    }
  }
  // Markdown list items, headings and table rows are separate blocks even without blank lines.
  if (/\.md(?:\.tpl)?$/i.test(rel)) boundaries.push(...markdownBoundaries(text));
  for (const boundary of boundaries.sort((left, right) => left.offset - right.offset)) {
    if (boundary.offset < start) continue;
    paragraphs.push({ start, text: text.slice(start, boundary.offset) });
    start = boundary.end;
  }
  paragraphs.push({ start, text: text.slice(start) });
  return paragraphs;
}

const CASE_CITE = /\bruling:(R\d+(?:\/[A-Za-z\d-]+)?)(?![\w/-])|\b(R\d+)(?:\s+|\/)(case-\d+)\b/g;
const OWNER_CITE = /\b(?:owner:|ruling:)(?!R\d+\b)([a-z][a-z\d-]*)\b/g;
const DATE_CITE = /\b(?:owner\s+)?ruling\s+(\d{4}-\d{2}-\d{2})\b/gi;
const displayKey = (key) => (key.startsWith('owner:') ? key : `ruling:${key}`);

function stalePatterns(records) {
  return [...records.values()].flatMap((record) =>
    list(record.staleWhen).map((pattern) => {
      try {
        return { record, pattern: new RegExp(pattern, 'gm') };
      } catch {
        throw new Error(`invalid staleWhen regex for ${displayKey(record.key)}`);
      }
    })
  );
}

function findingCollector() {
  const findings = [];
  const seen = new Set();
  const add = (rel, text, offset, kind, ruling, message) => {
    const line = lineOf(text, offset);
    const key = `${rel}:${line}:${kind}:${ruling}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ code: CODE, level: 'error', path: rel, line, kind, ruling, message: `${rel}:${line} ${message}` });
  };
  return { findings, add };
}

function proseChunks(rel, text) {
  try {
    return SOURCE.test(rel) ? sourceProse(rel, text) : [{ start: 0, text: catalogProse(rel, text) }];
  } catch (error) {
    throw new Error(`${rel}: ${error.message}`, { cause: error });
  }
}

function paragraphCitations(paragraph) {
  const citations = [...paragraph.text.matchAll(CASE_CITE)].map((match) => ({
    key: match[1] ?? `${match[2]}/${match[3]}`,
    offset: paragraph.start + match.index,
  }));
  for (const match of paragraph.text.matchAll(OWNER_CITE))
    citations.push({ key: `owner:${match[1]}`, offset: paragraph.start + match.index });
  return citations;
}

function addDateCitations(context, paragraph, citations, cited) {
  const { records, rel, text, add } = context;
  for (const match of paragraph.text.matchAll(DATE_CITE)) {
    const matching = [...records.values()].filter((record) => record.date === match[1]);
    if (!matching.length) {
      add(
        rel,
        text,
        paragraph.start + match.index,
        'unmatched-date',
        match[1],
        `owner ruling ${match[1]} has no matching catalog case or owner ruling; cite a stable ruling id`
      );
      continue;
    }
    // A date may identify several rulings: only an entirely superseded date is unambiguously stale.
    if (matching.every((record) => record.stale)) {
      for (const record of matching) citations.push({ key: record.key, offset: paragraph.start + match.index });
    } else for (const record of matching.filter((entry) => !entry.stale)) cited.add(record.key);
  }
}

function checkCitation(context, { key, offset }, cited) {
  const { records, rel, text, add } = context;
  const record = records.get(key);
  if (!record) {
    add(rel, text, offset, 'unknown-ruling', key, `${displayKey(key)} has no matching catalog ruling`);
    return;
  }
  if (!record.stale || record.liveSuccessors.some((successor) => cited.has(successor))) return;
  const successors = record.liveSuccessors.map(displayKey).join(' or ');
  const nextStep = successors ? `cite ${successors} in the same paragraph` : 'record and cite its live successor';
  add(rel, text, offset, 'superseded', key, `${displayKey(key)} is superseded; ${nextStep}`);
}

function checkParagraphs(context, chunks) {
  for (const chunk of chunks) {
    for (const part of paragraphsOf(chunk.text, context.rel)) {
      const paragraph = { start: chunk.start + part.start, text: part.text };
      const citations = paragraphCitations(paragraph);
      const cited = new Set(citations.map((cite) => cite.key));
      addDateCitations(context, paragraph, citations, cited);
      for (const cite of citations) checkCitation(context, cite, cited);
    }
  }
}

function checkStaleStatements({ rel, text, add }, chunks, patterns) {
  // Retired syntax can occur in executable source, such as a literal header name. Spec fixtures
  // remain data: only their comments and test titles are live statements, as with citations.
  const staleChunks = SOURCE.test(rel) && !SPEC.test(rel) ? [{ start: 0, text }] : chunks;
  for (const chunk of staleChunks) {
    for (const { record, pattern } of patterns) {
      // A ruling that retires a term declares `retiredIn`: the enforcer that implements the retirement and the ledger entry that records it
      // may name the retired term. Every other file naming it is still a stale statement.
      if (rulingRetirementExempt(record, rel)) continue;
      for (const match of chunk.text.matchAll(pattern))
        add(
          rel,
          text,
          chunk.start + match.index,
          'staleWhen',
          record.key,
          `staleWhen for ${displayKey(record.key)} matches; update the statement to the current ruling`
        );
    }
  }
}

/** RT_RULING_STALE_CITE findings, with stable paths and source lines, in both editions. */
export function rulingCiteFindings(files, catalogs = {}) {
  const records = buildRulingIndex(catalogs);
  const patterns = stalePatterns(records);
  const { findings, add } = findingCollector();
  for (const rel of Object.keys(files).sort(byCodeUnit)) {
    if (!rulingCiteInScope(rel)) continue;
    const text = files[rel];
    const chunks = proseChunks(rel, text);
    const context = { records, rel, text, add };
    checkParagraphs(context, chunks);
    checkStaleStatements(context, chunks, patterns);
  }
  return findings.sort(
    (left, right) =>
      byCodeUnit(left.path, right.path) ||
      left.line - right.line ||
      byCodeUnit(left.kind, right.kind) ||
      byCodeUnit(left.ruling, right.ruling)
  );
}
