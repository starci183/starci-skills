// slug.mjs — a machine-safe slug for a label (cluster ids, worker names).

/**
 * `v` slugged: lowercased, non-alphanumeric runs to '-', edge dashes dropped, at most `max`
 * characters; `fallback` when nothing is left.
 */
export const slugify = (v, { max = 32, fallback = '' } = {}) =>
  String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || fallback;
