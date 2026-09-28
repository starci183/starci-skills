// list.mjs — the array-or-empty coercion half the scripts re-declared by hand.
// `v` when it already is an array, else []. Scalars are NOT wrapped: a caller that wants
// `[v]` for a lone value writes its own coercion (see contract-version's list).
export const list = (v) => (Array.isArray(v) ? v : []);
