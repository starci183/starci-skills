// layout-imports.mjs - the import statements of a layout source, read in one linear pass: the specifier of every
// `import|export [type] [clause from] '<spec>'` and the clause of every `import [type] <clause> from '<spec>'`.
// A statement never crosses a quote, so the text between its keyword and its opening quote (the stem) is judged from
// the whitespace and the word right before that quote; a stem and a quote are looked at once however many keywords
// share them.

const IMPORT_OR_EXPORT_RX = /(?:import|export)\s/g;
const IMPORT_RX = /import\s/g;
const SPECIFIER_STOPS = new Set(["'", '"', '`', ';']);
const QUOTE_STOPS = new Set(["'", '"']);
const isQuote = (ch) => ch === "'" || ch === '"';

const isSpace = (text, at) => at >= 0 && at < text.length && /\s/.test(text[at]);
/** Where the whitespace run that ends right before `end` starts. */
function spaceRunStart(text, end) {
  let at = end;
  while (isSpace(text, at - 1)) at -= 1;
  return at;
}
/** Where the whitespace run that starts at `from` ends. */
function spaceRunEnd(text, from) {
  let at = from;
  while (isSpace(text, at)) at += 1;
  return at;
}

/** What precedes an opening quote at `quote`: its whitespace run and the four-letter word before that run. */
function tailBefore(text, quote) {
  const spaceFrom = spaceRunStart(text, quote);
  const wordAt = spaceFrom < quote ? spaceFrom - 4 : -1;
  return {
    word: wordAt >= 0 ? text.slice(wordAt, spaceFrom) : '',
    wordAt,
    spaceFrom,
    before: wordAt >= 0 ? spaceRunStart(text, wordAt) : -1,
  };
}

/** The first stop character at or after `from`, as {at, tail}: the text length when none; tail only for a quote. */
function stopFinder(text, stops) {
  let known = null;
  return (from) => {
    if (known?.from <= from && from <= known.at) return known.found;
    let at = from;
    while (at < text.length && !stops.has(text[at])) at += 1;
    const found = { at, tail: isQuote(text[at]) ? tailBefore(text, at) : null };
    known = { from, at, found };
    return found;
  };
}

/** The first quote at or after `from`, or -1. Once none is left from some index, none is left from any later one. */
function quoteFinder(text) {
  let noneFrom = Infinity;
  return (from) => {
    if (from >= noneFrom) return -1;
    let at = from;
    while (at < text.length && !isQuote(text[at])) at += 1;
    if (at < text.length) return at;
    noneFrom = from;
    return -1;
  };
}

/** Whether the stem [s0, quote) of an import or export statement is `ws [type ws] [clause ws from ws]`. */
function isSpecifierStem(s0, tail) {
  if (tail.spaceFrom <= s0) return true;
  if (tail.word === 'type' && tail.before <= s0 && s0 < tail.wordAt) return true;
  return tail.word === 'from' && tail.wordAt >= s0 + 2 && tail.before < tail.wordAt;
}

/** The clause of the stem [s0, quote) of `import [type] <clause> from`: the first reading a backtracking match takes, or null. */
function importClause(text, s0, tail) {
  const fromAt = tail.wordAt;
  if (tail.word !== 'from' || tail.before >= fromAt || fromAt < s0 + 2) return null;
  const room = fromAt - 1;
  const leadEnd = spaceRunEnd(text, s0);
  const clauseFrom = (start) => text.slice(start, Math.max(start, tail.before));
  if (text.startsWith('type', leadEnd)) {
    const afterType = leadEnd + 4;
    const taken = Math.min(spaceRunEnd(text, afterType) - afterType, room - afterType);
    if (taken >= 1) return clauseFrom(afterType + taken);
  }
  return clauseFrom(Math.min(leadEnd, room));
}

/**
 * Walk the statements that start at `keywordRx` matches; `read(s0, tail)` returns the value of a statement whose stem
 * starts at `s0` and whose opening quote follows `tail`, or undefined when the stem is no statement's. A statement
 * ends at the first quote after its opening one (a string of at least one character).
 */
function readStatements(text, keywordRx, stops, read) {
  const found = [];
  const stopAfter = stopFinder(text, stops);
  const quoteAfter = quoteFinder(text);
  const keyword = new RegExp(keywordRx.source, 'g');
  for (let m = keyword.exec(text); m; m = keyword.exec(text)) {
    const s0 = m.index + m[0].length - 1;
    const stop = stopAfter(s0);
    if (!stop.tail) continue;
    const value = read(s0, stop.tail);
    if (value === undefined) continue;
    const close = quoteAfter(stop.at + 1);
    if (close <= stop.at + 1) continue;
    found.push(value === null ? text.slice(stop.at + 1, close) : value);
    keyword.lastIndex = close + 1;
  }
  return found;
}

/** Every specifier a source imports or re-exports with `from` or as a side effect, in order. */
export function importSpecifiersOf(text) {
  return readStatements(text, IMPORT_OR_EXPORT_RX, SPECIFIER_STOPS, (s0, tail) => (isSpecifierStem(s0, tail) ? null : undefined));
}

/** The clause (`Name`, `{ a as b }`, `* as ns`, `type Name`) of every `import ... from '<spec>'`, in order. */
export function importClausesOf(text) {
  return readStatements(text, IMPORT_RX, QUOTE_STOPS, (s0, tail) => importClause(text, s0, tail) ?? undefined);
}
