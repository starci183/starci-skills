// draw-rationale-ref.mjs - a rationale rules[] entry read apart: `[namespace:] token [case-N]`.
const REF_RX = /^\s*(?:([a-z]+):\s*)?([^\s,;()]+)(?:\s+(case-\d+))?/i;

/** The match of a rules[] entry: [entry, namespace|undefined, token, case|undefined], or null. */
export const parseRuleRef = (text) => REF_RX.exec(text);

const TRAILING_MARKS = new Set(['.', ':']);

/** `token` without its trailing `.` and `:` marks. */
export function bareRuleToken(token) {
  const kept = [...token];
  while (kept.length && TRAILING_MARKS.has(kept.at(-1))) kept.pop();
  return kept.join('');
}
