// slug.mjs — a machine-safe slug for a label (cluster ids, worker names).

/**
 * `v` slugged: lowercased, non-alphanumeric runs to '-', edge dashes dropped, at most `max`
 * characters; `fallback` when nothing is left.
 */
export const slugify = (v, { max = 32, fallback = '' } = {}) => {
  const normalized = String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const withoutLeading = normalized.startsWith('-') ? normalized.slice(1) : normalized;
  const trimmed = withoutLeading.endsWith('-') ? withoutLeading.slice(0, -1) : withoutLeading;
  return trimmed.slice(0, max) || fallback;
};
