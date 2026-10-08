// command-tokens.mjs — the tokens of the tail of a documented `starci` command (the lexer under doc-commands.mjs).
//
// A tail is split into shell-like atoms: a run of non-space characters in which <...>, [...], {...}, (...) and quoted parts may hold
// spaces. [..] and (..) groups are optional text (all their alternatives are named); a (..) group that opens with a plain word is
// commentary and ends the command; a token that ends a sentence ends the command.

import { trimEndWhile } from '../../lib/trim-end.mjs';

const CLOSERS = { '<': '>', '[': ']', '{': '}', '(': ')' };
const TRAILING_CHARS = '.,;:!?)\'"`]}';
const GROUP_TRAILING_CHARS = '.,;:)';
const CUT = { text: '#', optional: false };
const OPENS_VALUE = /^\s*(--|<|\[|\$)/;
const QUOTED = /^(['"]).*\1$/;
const NAME = /^[\w.]+$/;

/** The index of the character that closes the bracket group opened at `from`, or -1 when it never closes. */
function groupEnd(s, from) {
  const open = s[from];
  let depth = 0;
  for (let j = from; j < s.length; j += 1) {
    if (s[j] === open) depth += 1;
    else if (s[j] === CLOSERS[open]) {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return -1;
}

/** The end of the atom that starts at `start`. */
function readAtom(s, start) {
  let i = start;
  while (i < s.length && !/\s/.test(s[i])) {
    const c = s[i];
    if (c in CLOSERS) {
      const end = groupEnd(s, i);
      if (end < 0) return s.length;
      i = end + 1;
    } else if ((c === '"' || c === "'") && (i === start || s[i - 1] === '=')) {
      const j = s.indexOf(c, i + 1);
      i = j < 0 ? i + 1 : j + 1;
    } else i += 1;
  }
  return i;
}

const stripTrailing = (atom, chars) => trimEndWhile(atom, (c) => chars.includes(c));

/** The maximal run of sentence punctuation at the end of an atom: {index, text}, or null. */
const trailingRun = (atom) => {
  let start = atom.length;
  while (start > 0 && TRAILING_CHARS.includes(atom[start - 1])) start -= 1;
  return start < atom.length ? { index: start, text: atom.slice(start) } : null;
};

// ${NAME}, $NAME and ${NAME with an optional closing brace
const isDollarName = (t) => {
  if (!t.startsWith('$')) return false;
  let rest = t.slice(1);
  if (rest.startsWith('{')) rest = rest.slice(1);
  if (rest.endsWith('}')) rest = rest.slice(0, -1);
  return NAME.test(rest);
};

// an <...> part with at least one character inside
const hasAnglePart = (t) => {
  for (let i = t.indexOf('<'); i >= 0; i = t.indexOf('<', i + 1)) {
    if (t.indexOf('>', i + 1) > i + 1) return true;
  }
  return false;
};

const wrapped = (t, open, close) => t.startsWith(open) && t.endsWith(close) && t.length >= open.length + close.length;

/** A value written as a placeholder: <id>, $VAR, ${VAR}, {x}. */
export const isPlaceholder = (t) => wrapped(t, '<', '>') || isDollarName(t) || wrapped(t, '${', '}') || wrapped(t, '{', '}')
  || hasAnglePart(t) || t.includes('${');

/** <a|b>: alternatives written inside angle brackets. */
export const isAlternation = (t) => {
  if (!wrapped(t, '<', '>')) return false;
  const bar = t.indexOf('|', 2);
  return bar > 0 && bar <= t.length - 3;
};

const isGroup = (closed) => closed.length > 2 && ((closed.startsWith('[') && closed.endsWith(']')) || (closed.startsWith('(') && closed.endsWith(')')));
const unquote = (atom) => (atom.length > 1 && QUOTED.test(atom) ? atom.slice(1, -1) : atom);

// {tokens, stop} of a bracket group atom
function groupTokens(atom, closed) {
  const body = closed.slice(1, -1);
  if (atom.startsWith('(') && !OPENS_VALUE.test(body)) return { tokens: [CUT], stop: true };
  return {
    tokens: tokenise(body, true).filter((t) => t.text !== '|'),
    stop: closed !== atom && /[.,;:]/.test(atom.slice(closed.length)),
  };
}

// {tokens, stop} of a plain atom
function plainTokens(atom, optional) {
  const tail = /^\.{1,3}$/.test(atom) ? null : trailingRun(atom);
  const trimmed = tail !== null && !isPlaceholder(atom);
  const bare = trimmed ? atom.slice(0, tail.index) : atom;
  return { tokens: bare ? [{ text: bare, optional }] : [], stop: trimmed && /[^\]]/.test(tail.text) };
}

/** The flat tokens {text, optional} of a command tail. */
export function tokenise(text, optional = false) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i += 1;
      continue;
    }
    const end = readAtom(text, i);
    const atom = text.slice(i, end);
    i = end;
    const closed = atom.startsWith('[') ? stripTrailing(atom, GROUP_TRAILING_CHARS) : atom;
    const step = isGroup(closed) ? groupTokens(atom, closed) : plainTokens(unquote(atom), optional);
    tokens.push(...step.tokens);
    if (step.stop) break;
  }
  return tokens;
}
