// i18n.mjs - the ONE mechanism for text the owner must read in Vietnamese. Runtime source, comments and messages are English;
// a message the owner reads (a Telegram notice, a why line, a progress report) is written once in English at its call site and
// translated through a DECLARED catalog keyed from that English source: modules/i18n/messages/<area>.yaml, a list of
// `{en, vi}` entries. Each area belongs to a scope: `runtime` for Node callers or `ui` for the generated browser catalog.
// The `vi` field is declared in scripts/lib/language.mjs, so it is the only Vietnamese source. There is no per-module
// `TEXT.vi` table and no second catalog mechanism.
//
//   const tr = translator(config.language);      // 'vi' translates, anything else returns the English source
//   tr('Workflow {id} needs your decision', { id })
//
// A placeholder is `{name}`; the English and the Vietnamese of one entry carry exactly the same placeholders
// (scripts/checks/check-i18n-catalog.mjs). An English source with no entry is returned as is: a missing translation degrades
// to English, never to a blank.
import { byCodeUnit } from './list.mjs';
import { escapeRegExp } from './regex.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { DEFAULT_OWNER_LANGUAGE, loadConfig } from '../../engine/config.mjs';

export const CATALOG_DIR = 'modules/i18n/messages';
export const PLACEHOLDER = /\{([A-Za-z_]\w*)\}/g;

const cache = new Map();

/** The catalog files of a runtime root: repository-relative paths, sorted. */
export function catalogFiles(root = skillRoot) {
  const dir = path.join(root, ...CATALOG_DIR.split('/'));
  try { return fs.readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).sort().map((name) => `${CATALOG_DIR}/${name}`); } catch { return []; }
}

/** Every entry in one catalog scope: `[{ en, vi, area, scope, file }]`. */
export function catalogEntries(root = skillRoot, { scope = 'runtime' } = {}) {
  return catalogFiles(root).flatMap((rel) => {
    const doc = parseYaml(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'));
    const documentScope = typeof doc?.scope === 'string' ? doc.scope : 'runtime';
    if (documentScope !== scope) return [];
    return (Array.isArray(doc?.messages) ? doc.messages : []).map((entry) => ({
      en: entry?.en, vi: entry?.vi, area: doc?.area, scope: documentScope, file: rel,
    }));
  });
}

/** One scoped catalog as a Map from the English source to the Vietnamese text (cached per root and scope). */
export function loadCatalog(root = skillRoot, { scope = 'runtime' } = {}) {
  const key = `${root}\0${scope}`;
  if (!cache.has(key)) cache.set(key, new Map(catalogEntries(root, { scope }).filter((e) => typeof e.en === 'string' && typeof e.vi === 'string').map((e) => [e.en, e.vi])));
  return cache.get(key);
}

/** Forget the cached catalogs (a spec that rewrites a catalog file). */
export const resetCatalogCache = () => cache.clear();

/** The names each `pattern` match captures (group 1) in `text`, in match order (`sort` sorts them). */
export const captureNames = (text, pattern, { sort = false } = {}) => {
  const names = [...String(text).matchAll(pattern)].map((m) => m[1]);
  return sort ? names.sort(byCodeUnit) : names;
};

/** The names of the placeholders of a message. */
export const placeholdersOf = (text) => captureNames(text, PLACEHOLDER, { sort: true });

/** `text` with each `{name}` replaced by vars[name] (an unknown name is left as written). */
export const fill = (text, vars = {}) => String(text).replace(PLACEHOLDER, (whole, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : whole));

/** The message `en` in `language` (`vi` translates through the catalog; any other language is the English source). */
export function translate(en, vars = {}, { language = DEFAULT_OWNER_LANGUAGE, root = skillRoot, scope = 'runtime' } = {}) {
  const vi = language === 'vi' ? loadCatalog(root, { scope }).get(en) : undefined;
  return fill(vi ?? en, vars);
}

/** The owner's language (config.yaml `language`); `fallback` when there is no readable config (DEFAULT_OWNER_LANGUAGE of engine/config.mjs). */
export function ownerLanguage(fallback = DEFAULT_OWNER_LANGUAGE) {
  try { return loadConfig()?.language ?? fallback; } catch { return fallback; }
}

/** A translator bound to one language: `tr(en, vars)`. */
export const translator = (language = DEFAULT_OWNER_LANGUAGE, { root = skillRoot, scope = 'runtime' } = {}) =>
  (en, vars = {}) => translate(en, vars, { language, root, scope });

/**
 * A pattern source matching `en` in the owner's language or in English: each language's rendering of the English source,
 * escaped, with the placeholder `slot` (a placeholder name of `en`) replaced by `slotPattern`. Never hardcodes a spelling.
 */
export const translatedPattern = (en, slot, slotPattern, languages = ['en', 'vi']) =>
  `(?:${languages.map((language) => escapeRegExp(translate(en, { [slot]: '@@' }, { language })).replace('@@', slotPattern)).join('|')})`;
