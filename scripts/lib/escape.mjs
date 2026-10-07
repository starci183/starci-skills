// escape.mjs — the escapes for text embedded in another syntax: HTML entities for markup (Telegram HTML, report blocks), one-line JSON for logs.

/** `s` with &, < and > entity-escaped. */
export const escapeHtml = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** `value` as JSON on ONE log line: CR, LF, every other C0 control character and U+2028/2029 written as \uXXXX (JSON.stringify already does so for C0 inside strings, so well-formed data prints byte-identically). */
export const logLine = (value) => Array.from(String(JSON.stringify(value)), (c) => {
  const n = c.codePointAt(0);
  return n < 0x20 || n === 0x2028 || n === 0x2029 ? String.raw`\u${n.toString(16).padStart(4, '0')}` : c;
}).join('');
