/**
 * A small PostgreSQL text reader for the R86 machine check (sql-owner). No SQL parser is a dependency of the runtime, so
 * this is a tokenizer plus a clause scanner, written for exactly what the check needs: which tables a statement
 * writes, which it reads, and whether a SELECT is bounded. Comments and string literals never reach the scanner.
 * A substitution of the `sql` tag (a `${...}` hole, the SqlIdent form) is an opaque token: a table position that holds
 * one is counted as dynamic and judged by nobody.
 */
export const HOLE = '';

const isSpace = char => /\s/u.test(char);
const isWordStart = char => /[\p{L}_]/u.test(char);
const isWordPart = char => /[\p{L}\p{N}_$]/u.test(char);

const commentEnd = (text, index) => {
  if (text[index] === '-' && text[index + 1] === '-') {
    while (index < text.length && text[index] !== '\n') index += 1;
    return index;
  }
  if (text[index] !== '/' || text[index + 1] !== '*') return null;
  const end = text.indexOf('*/', index + 2);
  return end === -1 ? text.length : end + 2;
};

const singleQuotedEnd = (text, index, push) => {
  if (text[index] !== "'") return null;
  index += 1;
  while (index < text.length) {
    if (text[index] === "'" && text[index + 1] === "'") { index += 2; continue; }
    if (text[index] === "'") break;
    index += 1;
  }
  push('string', '');
  return index + 1;
};

const quotedIdentifierEnd = (text, index, push) => {
  if (text[index] !== '"') return null;
  let value = '';
  index += 1;
  while (index < text.length) {
    if (text[index] === '"' && text[index + 1] === '"') { value += '"'; index += 2; continue; }
    if (text[index] === '"') break;
    value += text[index];
    index += 1;
  }
  push('ident', value);
  return index + 1;
};

const dollarTokenEnd = (text, index, push) => {
  if (text[index] !== '$') return null;
  const param = /^\$(\d+)/u.exec(text.slice(index, index + 12));
  if (param) { push('param', param[0]); return index + param[0].length; }
  const tag = /^\$([\p{L}_][\p{L}\p{N}_]*)?\$/u.exec(text.slice(index));
  if (!tag) return null;
  const end = text.indexOf(tag[0], index + tag[0].length);
  push('string', '');
  return end === -1 ? text.length : end + tag[0].length;
};

const numberEnd = (text, index, push) => {
  if (!/\d/u.test(text[index])) return null;
  let end = index;
  while (end < text.length && /[\d.]/u.test(text[end])) end += 1;
  push('number', text.slice(index, end));
  return end;
};

const wordEnd = (text, index, push) => {
  if (!isWordStart(text[index])) return null;
  let end = index;
  while (end < text.length && isWordPart(text[end])) end += 1;
  const word = text.slice(index, end);
  if (text[end] !== "'" || !/^[EeBbXxNn]$/u.test(word)) { push('word', word); return end; }
  const escaped = /^[Ee]$/u.test(word);
  end += 1;
  while (end < text.length) {
    if (escaped && text[end] === '\\') { end += 2; continue; }
    if (text[end] === "'" && text[end + 1] === "'") { end += 2; continue; }
    if (text[end] === "'") break;
    end += 1;
  }
  push('string', '');
  return end + 1;
};

const punctuationEnd = (text, index, push) => {
  const two = text.slice(index, index + 2);
  if (['::', '<=', '>=', '<>', '!=', '||', '->'].includes(two)) { push('punct', two); return index + 2; }
  push('punct', text[index]);
  return index + 1;
};

function consumeToken(text, index, push) {
  const comment = commentEnd(text, index);
  if (comment !== null) return comment;
  if (text[index] === HOLE) { push('hole', HOLE); return index + 1; }
  const singleQuoted = singleQuotedEnd(text, index, push);
  if (singleQuoted !== null) return singleQuoted;
  const identifier = quotedIdentifierEnd(text, index, push);
  if (identifier !== null) return identifier;
  const dollarToken = dollarTokenEnd(text, index, push);
  if (dollarToken !== null) return dollarToken;
  const number = numberEnd(text, index, push);
  if (number !== null) return number;
  const word = wordEnd(text, index, push);
  return word ?? punctuationEnd(text, index, push);
}

/** Tokens: {t: 'word'|'ident'|'string'|'number'|'param'|'hole'|'punct', v, up?} (`up` is the uppercase word). */
export function tokenizeSql(text) {
  const tokens = [];
  let i = 0;
  const push = (t, v) => tokens.push(t === 'word' ? { t, v, up: v.toUpperCase() } : { t, v });
  while (i < text.length) {
    const char = text[i];
    if (isSpace(char)) { i += 1; continue; }
    i = consumeToken(text, i, push);
  }
  return tokens;
}

const CLAUSE_WORDS = new Set(['WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL', 'ON', 'USING', 'GROUP', 'ORDER', 'LIMIT', 'OFFSET',
  'HAVING', 'UNION', 'INTERSECT', 'EXCEPT', 'WINDOW', 'FOR', 'RETURNING', 'SET', 'VALUES', 'SELECT', 'FETCH', 'OUTER', 'TABLESAMPLE', 'WITH', 'AS']);
// PostgreSQL aggregate function names, kept as one string so they read as words, not as failure codes.
const AGGREGATES = new Set('COUNT SUM AVG MIN MAX BOOL_AND BOOL_OR EVERY ARRAY_AGG STRING_AGG JSON_AGG JSONB_AGG JSON_OBJECT_AGG JSONB_OBJECT_AGG BIT_AND BIT_OR STDDEV VARIANCE'.split(' '));
const FROM_INSIDE = new Set(['EXTRACT', 'SUBSTRING', 'TRIM', 'OVERLAY', 'POSITION']);
const NOT_A_WRITE_BEFORE_UPDATE = new Set(['FOR', 'DO', 'ON', 'KEY', 'SHARE', 'OF']);
const WHERE_END = new Set(['GROUP', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT', 'EXCEPT', 'FOR', 'WINDOW', 'RETURNING', 'FETCH']);
const SYSTEM_SCHEMAS = new Set(['pg_catalog', 'information_schema']);

const isName = token => token && (token.t === 'word' || token.t === 'ident');
const nameOf = token => (token.t === 'word' ? token.v.toLowerCase() : token.v);
const isWord = (token, up) => token?.t === 'word' && token.up === up;

/**
 * The table reference at `start`: {parts, table, alias, next}, {dynamic: true}, or null (a subquery, a function, nothing).
 * `next` is the index after the reference and its alias.
 */
function tableNameAt(tokens, start) {
  let i = start;
  while (isWord(tokens[i], 'ONLY') || isWord(tokens[i], 'LATERAL')) i += 1;
  const first = tokens[i];
  if (first?.t === 'hole') return { dynamic: true, next: i + 1 };
  if (!isName(first) || (first.t === 'word' && CLAUSE_WORDS.has(first.up) && first.up !== 'AS')) return null;
  const parts = [nameOf(first)];
  i += 1;
  while (tokens[i]?.v === '.' && isName(tokens[i + 1])) { parts.push(nameOf(tokens[i + 1])); i += 2; }
  return { parts, next: i };
}

function tableAliasAt(tokens, index) {
  if (isWord(tokens[index], 'AS') && isName(tokens[index + 1])) return { alias: nameOf(tokens[index + 1]), next: index + 2 };
  if (isName(tokens[index]) && !(tokens[index].t === 'word' && CLAUSE_WORDS.has(tokens[index].up))) return { alias: nameOf(tokens[index]), next: index + 1 };
  return { alias: null, next: index };
}

function columnListEnd(tokens, start) {
  let i = start;
  let depth = 0;
  do {
    if (tokens[i].v === '(') depth += 1;
    else if (tokens[i].v === ')') depth -= 1;
    i += 1;
  } while (i < tokens.length && depth > 0);
  return i;
}

function tableRef(tokens, start, { columns = false } = {}) {
  const reference = tableNameAt(tokens, start);
  if (!reference) return null;
  if (reference.dynamic) return reference;
  const { parts } = reference;
  let i = reference.next;
  if (tokens[i]?.v === '(' && !columns) return null;
  const { alias, next } = tableAliasAt(tokens, i);
  i = next;
  if (alias && tokens[i]?.v === '(') i = columnListEnd(tokens, i);
  return { parts, table: parts.at(-1), schema: parts.length > 1 ? parts.at(-2) : null, alias, next: i };
}

function statementsOf(tokens) {
  const statements = [];
  let current = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.t === 'punct' && token.v === '(') depth += 1;
    if (token.t === 'punct' && token.v === ')') depth -= 1;
    if (token.t === 'punct' && token.v === ';' && depth <= 0) { if (current.length) { statements.push(current); } current = []; continue; }
    current.push(token);
  }
  if (current.length) statements.push(current);
  return statements;
}

function cteNameBefore(tokens, index) {
  let afterAs = index + 1;
  if (isWord(tokens[afterAs], 'NOT')) afterAs += 1;
  if (isWord(tokens[afterAs], 'MATERIALIZED')) afterAs += 1;
  if (tokens[afterAs]?.v !== '(') return null;
  let nameIndex = index - 1;
  if (tokens[nameIndex]?.v === ')') {
    let depth = 0;
    do {
      if (tokens[nameIndex].v === ')') depth += 1;
      else if (tokens[nameIndex].v === '(') depth -= 1;
      nameIndex -= 1;
    } while (nameIndex >= 0 && depth > 0);
  }
  const before = tokens[nameIndex - 1];
  if (isName(tokens[nameIndex]) && (isWord(before, 'WITH') || isWord(before, 'RECURSIVE') || before?.v === ',')) return nameOf(tokens[nameIndex]);
  return null;
}

/** The CTE names a statement declares: `name [(cols)] AS [NOT] [MATERIALIZED] (`. */
function cteNames(tokens) {
  const names = new Set();
  for (let i = 1; i < tokens.length; i += 1) {
    if (!isWord(tokens[i], 'AS')) continue;
    const name = cteNameBefore(tokens, i);
    if (name !== null) names.add(name);
  }
  return names;
}

/** Depth of each token (the depth before it when it is `(`, after it when it is `)`). */
function depths(tokens) {
  let depth = 0;
  return tokens.map(token => {
    if (token.v === ')' && token.t === 'punct') depth -= 1;
    const here = depth;
    if (token.v === '(' && token.t === 'punct') depth += 1;
    return here;
  });
}

function matching(tokens, open) {
  let depth = 0;
  for (let i = open; i < tokens.length; i += 1) {
    if (tokens[i].t !== 'punct') continue;
    if (tokens[i].v === '(') depth += 1;
    else if (tokens[i].v === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return tokens.length - 1;
}

function isAggregateItem(item) {
  for (let i = 0; i < item.length; i += 1) {
    if (item[i].t === 'word' && AGGREGATES.has(item[i].up) && item[i + 1]?.v === '(') {
      const close = matching(item, i + 1);
      if (!isWord(item[close + 1], 'OVER')) return true;
    }
  }
  return false;
}

/** The unique-key columns `columns` (lowercase Set of `=`-constrained column names) satisfy for one of `uniqueSets`. */
const covers = (uniqueSets, columns) => uniqueSets.some(set => set.length > 0 && set.every(column => columns.has(column)));

function equalityColumns(conjunct, qualifiers) {
  const found = new Set();
  const name = (from, to) => {
    const part = conjunct.slice(from, to);
    if (part.length === 1 && isName(part[0])) return nameOf(part[0]);
    if (part.length === 3 && isName(part[0]) && part[1].v === '.' && isName(part[2]) && qualifiers.has(nameOf(part[0]))) return nameOf(part[2]);
    return null;
  };
  const equals = conjunct.findIndex(token => token.t === 'punct' && token.v === '=');
  if (equals < 0) return found;
  const left = name(0, equals);
  const rightStart = conjunct[equals + 1];
  if (left && !(rightStart?.t === 'word' && ['ANY', 'ALL', 'SOME'].includes(rightStart.up))) found.add(left);
  const right = name(equals + 1, conjunct.length);
  if (right) found.add(right);
  return found;
}

/**
 * Judge one statement that reads rows (no INSERT/UPDATE/DELETE/MERGE at its own depth): `{bounded, basis}`. Bounded is
 * a LIMIT/FETCH at the statement depth, no FROM at all (one row), only aggregates without GROUP BY, or an equality on
 * every column of the primary key or of one unique key of the first table of FROM.
 */
function aggregateSelectItems(tokens, select, from, at0) {
  const items = [];
  let item = [];
  for (let i = select + 1; i < from; i += 1) {
    if (at0(i) && tokens[i].v === ',' && tokens[i].t === 'punct') { items.push(item); item = []; continue; }
    if (!(items.length === 0 && item.length === 0 && (isWord(tokens[i], 'DISTINCT') || isWord(tokens[i], 'ALL')))) item.push(tokens[i]);
  }
  items.push(item);
  return items;
}

function whereRegion(tokens, level, where, at0) {
  const region = [];
  for (let i = where + 1; i < tokens.length; i += 1) {
    if (at0(i) && tokens[i].t === 'word' && WHERE_END.has(tokens[i].up)) break;
    region.push({ token: tokens[i], level: level[i] });
  }
  return region;
}

function uniqueWhereColumns(region, primary) {
  if (region.some(entry => entry.level === 0 && isWord(entry.token, 'OR'))) return null;
  const conjuncts = [[]];
  let between = false;
  for (const entry of region) {
    if (entry.level === 0 && isWord(entry.token, 'BETWEEN')) between = true;
    if (entry.level === 0 && isWord(entry.token, 'AND')) {
      if (between) { between = false; } else { conjuncts.push([]); continue; }
    }
    conjuncts.at(-1).push(entry.token);
  }
  const qualifiers = new Set([primary.table, primary.alias].filter(Boolean));
  const columns = new Set();
  for (const conjunct of conjuncts) for (const column of equalityColumns(conjunct, qualifiers)) columns.add(column);
  return columns;
}

function selectBound(tokens, level, uniqueSetsOf, cte) {
  const at0 = index => level[index] === 0;
  const find = (up, from = 0) => { for (let i = from; i < tokens.length; i += 1) { if (at0(i) && isWord(tokens[i], up)) return i; } return -1; };
  if (find('LIMIT') >= 0 || find('FETCH') >= 0) return { bounded: true, basis: 'limit' };
  const select = find('SELECT');
  const from = find('FROM', select);
  if (from < 0) return { bounded: true, basis: 'no from' };
  const groupBy = tokens.findIndex((token, i) => at0(i) && isWord(token, 'GROUP') && isWord(tokens[i + 1], 'BY'));
  if (groupBy < 0 && aggregateSelectItems(tokens, select, from, at0).every(isAggregateItem)) return { bounded: true, basis: 'aggregate' };
  const primary = tableRef(tokens, from + 1);
  if (!primary || primary.dynamic || cte.has(primary.table)) return { bounded: false, basis: 'unbounded', table: primary?.table ?? null };
  const uniqueSets = uniqueSetsOf(primary.table);
  const where = find('WHERE', from);
  if (uniqueSets?.length && where >= 0) {
    const region = whereRegion(tokens, level, where, at0);
    const columns = uniqueWhereColumns(region, primary);
    if (columns && covers(uniqueSets, columns)) return { bounded: true, basis: 'unique' };
  }
  return { bounded: false, basis: 'unbounded', table: primary.table };
}

function recordSqlReference(list, ref, reads, cte, state) {
  if (!ref) return;
  if (ref.dynamic) { state.dynamic += 1; return; }
  if (ref.schema && SYSTEM_SCHEMAS.has(ref.schema)) return;
  if (ref.table.startsWith('pg_')) return;
  if (list === reads && !ref.schema && cte.has(ref.table)) return;
  list.push({ table: ref.table, schema: ref.schema });
}

function recordTableList(tokens, start, list, record, commaIsPunctuation) {
  let i = start;
  for (;;) {
    const ref = tableRef(tokens, i);
    record(list, ref);
    if (ref && tokens[ref.next]?.v === ',' && (!commaIsPunctuation || tokens[ref.next].t === 'punct')) { i = ref.next + 1; continue; }
    break;
  }
}

function processWriteToken(tokens, level, index, token, record, state) {
  const next = tokens[index + 1];
  if (token.up === 'INSERT' && isWord(next, 'INTO')) {
    if (level[index] === 0) state.hasWriteVerb = true;
    record(state.writes, tableRef(tokens, index + 2, { columns: true }));
    return true;
  }
  if (token.up === 'UPDATE' && !(state.previous?.t === 'word' && NOT_A_WRITE_BEFORE_UPDATE.has(state.previous.up))) {
    if (level[index] === 0) state.hasWriteVerb = true;
    record(state.writes, tableRef(tokens, index + 1));
    return true;
  }
  if (token.up === 'DELETE' && isWord(next, 'FROM')) {
    if (level[index] === 0) state.hasWriteVerb = true;
    record(state.writes, tableRef(tokens, index + 2));
    return true;
  }
  if (token.up === 'MERGE' && isWord(next, 'INTO')) {
    if (level[index] === 0) state.hasWriteVerb = true;
    record(state.writes, tableRef(tokens, index + 2));
    return true;
  }
  if (token.up !== 'TRUNCATE') return false;
  let start = index + 1;
  if (isWord(tokens[start], 'TABLE')) start += 1;
  recordTableList(tokens, start, state.writes, record, false);
  return true;
}

function processReadToken(tokens, index, token, record, state, mergeOrDelete) {
  if (token.up === 'FROM' && !isWord(state.previous, 'DISTINCT') && !isWord(state.previous, 'DELETE') && state.parens.at(-1) !== true) {
    recordTableList(tokens, index + 1, state.reads, record, true);
    return;
  }
  if (token.up === 'JOIN') { record(state.reads, tableRef(tokens, index + 1)); return; }
  if (token.up === 'USING' && mergeOrDelete && tokens[index + 1]?.v !== '(') record(state.reads, tableRef(tokens, index + 1));
}

function statementReferences(tokens, level, cte) {
  const state = { writes: [], reads: [], parens: [], dynamic: 0, hasWriteVerb: false };
  const record = (list, ref) => recordSqlReference(list, ref, state.reads, cte, state);
  const mergeOrDelete = tokens.some(token => isWord(token, 'MERGE')) || tokens.some(token => isWord(token, 'DELETE'));
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.t === 'punct' && token.v === '(') { state.parens.push(i > 0 && tokens[i - 1].t === 'word' && FROM_INSIDE.has(tokens[i - 1].up)); continue; }
    if (token.t === 'punct' && token.v === ')') { state.parens.pop(); continue; }
    if (token.t !== 'word') continue;
    state.previous = tokens[i - 1];
    if (processWriteToken(tokens, level, i, token, record, state)) {
      if (token.up === 'DELETE') i += 1;
      continue;
    }
    processReadToken(tokens, i, token, record, state, mergeOrDelete);
  }
  return state;
}

function statementAnalysis(tokens, uniqueSetsOf) {
  const cte = cteNames(tokens);
  const level = depths(tokens);
  const references = statementReferences(tokens, level, cte);
  const selects = [];
  const hasSelect = tokens.some((candidate, i) => level[i] === 0 && isWord(candidate, 'SELECT'));
  if (hasSelect && !references.hasWriteVerb) selects.push(selectBound(tokens, level, uniqueSetsOf, cte));
  return { ...references, selects };
}

/**
 * Read one SQL text. `uniqueSetsOf(table)` returns the unique-key column sets (each a lowercase column list) of the entity
 * of `table`, or null when no entity declares it.
 * Returns {writes: [{table, schema}], reads: [{table, schema}], selects: [{bounded, basis, table}], dynamic}.
 */
export function analyzeSql(text, { uniqueSetsOf = () => null } = {}) {
  const writes = [];
  const reads = [];
  const selects = [];
  let dynamic = 0;
  for (const tokens of statementsOf(tokenizeSql(text))) {
    const statement = statementAnalysis(tokens, uniqueSetsOf);
    for (const write of statement.writes) writes.push(write);
    for (const read of statement.reads) reads.push(read);
    for (const select of statement.selects) selects.push(select);
    dynamic += statement.dynamic;
  }
  return { writes, reads, selects, dynamic };
}
