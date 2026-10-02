// t.ts - the UI's one text mechanism. Source strings are English; the owner reads them in Vietnamese through the declared
// catalog files of ui/src/i18n/messages/*.ts (each default-exports a Record from the English source to the Vietnamese text).
// A string with no catalog entry renders as its English source, never blank. A placeholder is `{name}`.
const files = import.meta.glob<{ default: Record<string, string> }>('./messages/*.ts', { eager: true });

const catalog: Record<string, string> = Object.assign({}, ...Object.values(files).map((file) => file.default));

/** `text` with each `{name}` replaced by vars[name] (an unknown name is left as written). */
export const fill = (text: string, vars: Record<string, string | number> = {}): string =>
  text.replace(/\{([A-Za-z_]\w*)\}/g, (whole, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : whole));

/** The Vietnamese text of an English source (or the source itself when the catalog has no entry), placeholders filled. */
export const t = (en: string, vars: Record<string, string | number> = {}): string => fill(catalog[en] ?? en, vars);
