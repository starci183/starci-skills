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

/** Tokens: {t: 'word'|'ident'|'string'|'number'|'param'|'hole'|'punct', v, up?} (`up` is the uppercase word). */
export function tokenizeSql(text) {
  const tokens = [];
  let i = 0;
  const push = (t, v) => tokens.push(t === 'word' ? { t, v, up: v.toUpperCase() } : { t, v });
  while (i < text.length) {
    const char = text[i];
    if (isSpace(char)) { i += 1; continue; }
    if (char === '-' && text[i + 1] === '-') { while (i < text.length && text[i] !== '\n') i += 1; continue; }
    if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    if (char === HOLE) { push('hole', HOLE); i += 1; continue; }
    if (char === "'") {
      i += 1;
      while (i < text.length) {
        if (text[i] === "'" && text[i + 1] === "'") { i += 2; continue; }
        if (text[i] === "'") break;
        i += 1;
      }
      i += 1;
      push('string', '');
      continue;
    }
    if (char === '"') {
      let value = '';
      i += 1;
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') { value += '"'; i += 2; continue; }
        if (text[i] === '"') break;
        value += text[i];
        i += 1;
      }
      i += 1;
      push('ident', value);
      continue;
    }
    if (char === '$') {
      const param = /^\$(\d+)/u.exec(text.slice(i, i + 12));
      if (param) { push('param', param[0]); i += param[0].length; continue; }
      const tag = /^\$([\p{L}_][\p{L}\p{N}_]*)?\$/u.exec(text.slice(i));
      if (tag) {
        const end = text.indexOf(tag[0], i + tag[0].length);
        i = end === -1 ? text.length : end + tag[0].length;
        push('string', '');
        continue;
      }
    }
    if (/\d/u.test(char)) {
      let j = i;
      while (j < text.length && /[\d.]/u.test(text[j])) j += 1;
      push('number', text.slice(i, j));
      i = j;
      continue;
    }
    if (isWordStart(char)) {
      let j = i;
      while (j < text.length && isWordPart(text[j])) j += 1;
      const word = text.slice(i, j);
      if (text[j] === "'" && /^[EeBbXxNn]$/u.test(word)) {
        const escaped = /^[Ee]$/u.test(word);
        j += 1;
        while (j < text.length) {
          if (escaped && text[j] === '\\') { j += 2; continue; }
          if (text[j] === "'" && text[j + 1] === "'") { j += 2; continue; }
          if (text[j] === "'") break;
          j += 1;
        }
        i = j + 1;
        push('string', '');
        continue;
      }
      push('word', word);
      i = j;
      continue;
    }
    const two = text.slice(i, i + 2);
    if (['::', '<=', '>=', '<>', '!=', '||', '->'].includes(two)) { push('punct', two); i += 2; continue; }
    push('punct', char);
    i += 1;
  }
  return tokens;
}

const CLAUSE_WORDS = new Set(['WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL', 'ON', 'USING', 'GROUP', 'ORDER', 'LIMIT', 'OFFSET',
  'HAVING', 'UNION', 'INTERSECT', 'EXCEPT', 'WINDOW', 'FOR', 'RETURNING', 'SET', 'VALUES', 'SELECT', 'FETCH', 'OUTER', 'TABLESAMPLE', 'WITH', 'AS']);
const AGGREGATES = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'BOOL_AND', 'BOOL_OR', 'EVERY', 'ARRAY_AGG', 'STRING_AGG', 'JSON_AGG', 'JSONB_AGG',
  'JSON_OBJECT_AGG', 'JSONB_OBJECT_AGG', 'BIT_AND', 'BIT_OR', 'STDDEV', 'VARIANCE']);
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
function tableRef(tokens, start, { columns = false } = {}) {
  let i = start;
  while (isWord(tokens[i], 'ONLY') || isWord(tokens[i], 'LATERAL')) i += 1;
  const first = tokens[i];
  if (first?.t === 'hole') return { dynamic: true, next: i + 1 };
  if (!isName(first) || (first.t === 'word' && CLAUSE_WORDS.has(first.up) && first.up !== 'AS')) return null;
  const parts = [nameOf(first)];
  i += 1;
  while (tokens[i]?.v === '.' && isName(tokens[i + 1])) { parts.push(nameOf(tokens[i + 1])); i += 2; }
  if (tokens[i]?.v === '(' && !columns) return null;
  let alias = null;
  if (isWord(tokens[i], 'AS') && isName(tokens[i + 1])) { alias = nameOf(tokens[i + 1]); i += 2; }
  else if (isName(tokens[i]) && !(tokens[i].t === 'word' && CLAUSE_WORDS.has(tokens[i].up))) { alias = nameOf(tokens[i]); i += 1; }
  if (alias && tokens[i]?.v === '(') { let depth = 0; do { if (tokens[i].v === '(') depth += 1; else if (tokens[i].v === ')') depth -= 1; i += 1; } while (i < tokens.length && depth > 0); }
  return { parts, table: parts.at(-1), schema: parts.length > 1 ? parts.at(-2) : null, alias, next: i };
}

function statementsOf(tokens) {
  const statements = [];
  let current = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.t === 'punct' && token.v === '(') depth += 1;
    if (token.t === 'punct' && token.v === ')') depth -= 1;
    if (token.t === 'punct' && token.v === ';' && depth <= 0) { if (current.length) statements.push(current); current = []; continue; }
    current.push(token);
  }
  if (current.length) statements.push(current);
  return statements;
}

/** The CTE names a statement declares: `name [(cols)] AS [NOT] [MATERIALIZED] (`. */
function cteNames(tokens) {
  const names = new Set();
  for (let i = 1; i < tokens.length; i += 1) {
    if (!isWord(tokens[i], 'AS')) continue;
    let j = i + 1;
    if (isWord(tokens[j], 'NOT')) j += 1;
    if (isWord(tokens[j], 'MATERIALIZED')) j += 1;
    if (tokens[j]?.v !== '(') continue;
    let k = i - 1;
    if (tokens[k]?.v === ')') { let depth = 0; do { if (tokens[k].v === ')') depth += 1; else if (tokens[k].v === '(') depth -= 1; k -= 1; } while (k >= 0 && depth > 0); }
    const before = tokens[k - 1];
    if (isName(tokens[k]) && (isWord(before, 'WITH') || isWord(before, 'RECURSIVE') || before?.v === ',')) names.add(nameOf(tokens[k]));
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
 * Judge one statement that reads rows (no INSERT/UPDATE/DELETE/MERGE at its own depth): `{bounded, reason}`. Bounded is
 * a LIMIT/FETCH at the statement depth, no FROM at all (one row), only aggregates without GROUP BY, or an equality on
 * every column of the primary key or of one unique key of the first table of FROM.
 */
function selectBound(tokens, level, uniqueSetsOf, cte) {
  const at0 = index => level[index] === 0;
  const find = (up, from = 0) => { for (let i = from; i < tokens.length; i += 1) if (at0(i) && isWord(tokens[i], up)) return i; return -1; };
  if (find('LIMIT') >= 0 || find('FETCH') >= 0) return { bounded: true, reason: 'limit' };
  const select = find('SELECT');
  const from = find('FROM', select);
  if (from < 0) return { bounded: true, reason: 'no-from' };
  const groupBy = tokens.findIndex((token, i) => at0(i) && isWord(token, 'GROUP') && isWord(tokens[i + 1], 'BY'));
  if (groupBy < 0) {
    const items = [];
    let item = [];
    for (let i = select + 1; i < from; i += 1) {
      if (at0(i) && tokens[i].v === ',' && tokens[i].t === 'punct') { items.push(item); item = []; continue; }
      if (!(items.length === 0 && item.length === 0 && (isWord(tokens[i], 'DISTINCT') || isWord(tokens[i], 'ALL')))) item.push(tokens[i]);
    }
    items.push(item);
    if (items.length && items.every(isAggregateItem)) return { bounded: true, reason: 'aggregate' };
  }
  const primary = tableRef(tokens, from + 1);
  if (!primary || primary.dynamic || cte.has(primary.table)) return { bounded: false, reason: 'unbounded', table: primary?.table ?? null };
  const uniqueSets = uniqueSetsOf(primary.table);
  const where = find('WHERE', from);
  if (uniqueSets?.length && where >= 0) {
    const region = [];
    for (let i = where + 1; i < tokens.length; i += 1) {
      if (at0(i) && tokens[i].t === 'word' && WHERE_END.has(tokens[i].up)) break;
      region.push({ token: tokens[i], level: level[i] });
    }
    if (!region.some(entry => entry.level === 0 && isWord(entry.token, 'OR'))) {
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
      if (covers(uniqueSets, columns)) return { bounded: true, reason: 'unique' };
    }
  }
  return { bounded: false, reason: 'unbounded', table: primary.table };
}

/**
 * Read one SQL text. `uniqueSetsOf(table)` returns the unique-key column sets (each a lowercase column list) of the entity
 * of `table`, or null when no entity declares it.
 * Returns {writes: [{table, schema}], reads: [{table, schema}], selects: [{bounded, reason, table}], dynamic}.
 */
export function analyzeSql(text, { uniqueSetsOf = () => null } = {}) {
  const writes = [];
  const reads = [];
  const selects = [];
  let dynamic = 0;
  for (const tokens of statementsOf(tokenizeSql(text))) {
    const cte = cteNames(tokens);
    const level = depths(tokens);
    const parens = [];
    const record = (list, ref) => {
      if (!ref) return;
      if (ref.dynamic) { dynamic += 1; return; }
      if (ref.schema && SYSTEM_SCHEMAS.has(ref.schema)) return;
      if (ref.table.startsWith('pg_')) return;
      if (list === reads && !ref.schema && cte.has(ref.table)) return;
      list.push({ table: ref.table, schema: ref.schema });
    };
    const mergeOrDelete = tokens.some(token => isWord(token, 'MERGE')) || tokens.some(token => isWord(token, 'DELETE'));
    let hasWriteVerb = false;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token.t === 'punct' && token.v === '(') { parens.push(i > 0 && tokens[i - 1].t === 'word' && FROM_INSIDE.has(tokens[i - 1].up)); continue; }
      if (token.t === 'punct' && token.v === ')') { parens.pop(); continue; }
      if (token.t !== 'word') continue;
      const previous = tokens[i - 1];
      if (token.up === 'INSERT' && isWord(tokens[i + 1], 'INTO')) { if (level[i] === 0) hasWriteVerb = true; record(writes, tableRef(tokens, i + 2, { columns: true })); }
      else if (token.up === 'UPDATE' && !(previous?.t === 'word' && NOT_A_WRITE_BEFORE_UPDATE.has(previous.up))) { if (level[i] === 0) hasWriteVerb = true; record(writes, tableRef(tokens, i + 1)); }
      else if (token.up === 'DELETE' && isWord(tokens[i + 1], 'FROM')) { if (level[i] === 0) hasWriteVerb = true; record(writes, tableRef(tokens, i + 2)); i += 1; }
      else if (token.up === 'MERGE' && isWord(tokens[i + 1], 'INTO')) { if (level[i] === 0) hasWriteVerb = true; record(writes, tableRef(tokens, i + 2)); }
      else if (token.up === 'TRUNCATE') {
        let j = i + 1;
        if (isWord(tokens[j], 'TABLE')) j += 1;
        for (;;) {
          const ref = tableRef(tokens, j);
          record(writes, ref);
          if (ref && tokens[ref.next]?.v === ',') { j = ref.next + 1; continue; }
          break;
        }
      } else if (token.up === 'FROM' && !isWord(previous, 'DISTINCT') && !isWord(previous, 'DELETE') && parens.at(-1) !== true) {
        let j = i + 1;
        for (;;) {
          const ref = tableRef(tokens, j);
          record(reads, ref);
          if (ref && tokens[ref.next]?.v === ',' && tokens[ref.next].t === 'punct') { j = ref.next + 1; continue; }
          break;
        }
      } else if (token.up === 'JOIN') record(reads, tableRef(tokens, i + 1));
      else if (token.up === 'USING' && mergeOrDelete && tokens[i + 1]?.v !== '(') record(reads, tableRef(tokens, i + 1));
    }
    const hasSelect = tokens.some((candidate, i) => level[i] === 0 && isWord(candidate, 'SELECT'));
    if (hasSelect && !hasWriteVerb) selects.push(selectBound(tokens, level, uniqueSetsOf, cte));
  }
  return { writes, reads, selects, dynamic };
}
