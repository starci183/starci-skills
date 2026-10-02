// t.ts - the UI's browser adapter for the one YAML catalog source. Build and dev generate this disposable map through
// scripts/lib/i18n.mjs; source strings remain English and a missing entry renders as that source, never blank.
import catalog from './generated/catalog';

/** `text` with each `{name}` replaced by vars[name] (an unknown name is left as written). */
export const fill = (text: string, vars: Record<string, string | number> = {}): string =>
  text.replace(/\{([A-Za-z_]\w*)\}/g, (whole, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : whole));

/** The Vietnamese text of an English source (or the source itself when the catalog has no entry), placeholders filled. */
export const t = (en: string, vars: Record<string, string | number> = {}): string => fill(catalog[en] ?? en, vars);
