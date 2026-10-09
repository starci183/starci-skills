// neutral.mjs - the placeholders a replay fixture is made of. A real ledger holds product names, paths, prose and ids; a fixture holds none of them.
// Ids become `<kind>-<n>` by order of first appearance (deterministic for one input); a node name keeps only the words the redaction filter reacts to
// (the behaviour under replay), a code or a kind is kept only when it is a runtime vocabulary word (enum-like: lower-case words joined by - . : or _).

/** The words of an identifier that the ledger's redaction filter reacts to when a colon follows (scripts/lib/redact.mjs keyed-secret): kept, they are the behaviour. */
export const REDACTION_WORDS = Object.freeze(['password', 'passwd', 'secret', 'token', 'cookie']);

/** A runtime vocabulary word: a code, a kind, an op id, an outcome. Free text and anything with a path separator is not. */
export const isVocabulary = (value) => typeof value === 'string' && value.length <= 64 && /^[a-z][a-z0-9]*(?:[-._:][a-z0-9]+)*$/.test(value);

/** Ids by kind, numbered by first appearance. */
export class Pseudonyms {
  #maps = new Map();
  id(kind, real) {
    if (real == null) return null;
    const map = this.#maps.get(kind) ?? this.#maps.set(kind, new Map()).get(kind);
    if (!map.has(String(real))) map.set(String(real), `${kind}-${map.size + 1}`);
    return map.get(String(real));
  }

  /** A work-graph node name (`<domain>.<slice>`): numbered domain and slice, plus the redaction words the real slice name carried. */
  node(real) {
    const [domain, ...rest] = String(real).split('.');
    const kept = rest.join('.').split(/[^a-z0-9]+/i).map((word) => word.toLowerCase()).filter((word) => REDACTION_WORDS.includes(word));
    const slice = `${this.id('s', rest.join('.'))}${kept.length ? `-${kept.join('-')}` : ''}`;
    return `${this.id('d', domain)}.${slice}`;
  }
}

/** `value` when it is a vocabulary word, else `fallback`. */
export const wordOr = (value, fallback = null) => (isVocabulary(value) ? value : fallback);

/** A list of vocabulary words (the others dropped). */
export const wordsOf = (list) => (Array.isArray(list) ? list.filter(isVocabulary) : []);
