// Phrase matching per archetypes.yaml signalMatching: NFC + lower-case +
// collapsed whitespace on both sides, diacritics kept, Unicode word
// boundaries (JS \b is ASCII-only and never fires beside a Vietnamese letter).
import { normalizeText } from '../lib/normalize.mjs';
const WORD_CHAR = /[\p{L}\p{M}\p{N}_]/u;
const isWordChar = ch => !!ch && WORD_CHAR.test(ch);

export function phraseHits(text, phrase) {
  let p = normalizeText(phrase);
  const prefix = p.endsWith('*');
  if (prefix) p = p.slice(0, -1).trimEnd();
  if (!p) return false;
  const chars = [...p];
  const needStart = isWordChar(chars[0]);
  const needEnd = !prefix && isWordChar(chars.at(-1));
  for (let i = text.indexOf(p); i >= 0; i = text.indexOf(p, i + 1)) {
    const before = Array.from(text.slice(Math.max(0, i - 2), i)).at(-1);
    const after = Array.from(text.slice(i + p.length, i + p.length + 2))[0];
    if ((!needStart || !isWordChar(before)) && (!needEnd || !isWordChar(after))) return true;
  }
  return false;
}
