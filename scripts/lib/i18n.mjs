// i18n.mjs - the ONE mechanism for text the owner must read in Vietnamese. Runtime source, comments and messages are English;
// a message the owner reads (a Telegram notice, a why line, a progress report) is written once in English at its call site and
// translated through a DECLARED catalog keyed from that English source: modules/i18n/messages/<area>.yaml, a list of
// `{en, vi}` entries (the `vi` field is declared in scripts/lib/language.mjs, so it is the only Vietnamese outside the other
// declared catalogs). There is no per-module `TEXT.vi` table and no second catalog mechanism.
//
//   const tr = translator(config.language);      // 'vi' translates, anything else returns the English source
//   tr('Workflow {id} needs your decision', { id })
//
// A placeholder is `{name}`; the English and the Vietnamese of one entry carry exactly the same placeholders
// (scripts/checks/check-i18n-catalog.mjs). An English source with no entry is returned as is: a missing translation degrades
// to English, never to a blank.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadConfig } from '../../engine/config.mjs';

export const CATALOG_DIR = 'modules/i18n/messages';
export const PLACEHOLDER = /\{([A-Za-z_][\w]*)\}/g;

const cache = new Map();

/** The catalog files of a runtime root: repository-relative paths, sorted. */
export function catalogFiles(root = skillRoot) {
  const dir = path.join(root, ...CATALOG_DIR.split('/'));
  try { return fs.readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).sort().map((name) => `${CATALOG_DIR}/${name}`); } catch { return []; }
}

/** Every entry of the catalog: `[{ en, vi, file }]`. */
export function catalogEntries(root = skillRoot) {
  return catalogFiles(root).flatMap((rel) => {
    const doc = parseYaml(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'));
    return (Array.isArray(doc?.messages) ? doc.messages : []).map((entry) => ({ en: entry?.en, vi: entry?.vi, file: rel }));
  });
}

/** The catalog as a Map from the English source to the Vietnamese text (cached per root). */
export function loadCatalog(root = skillRoot) {
  if (!cache.has(root)) cache.set(root, new Map(catalogEntries(root).filter((e) => typeof e.en === 'string' && typeof e.vi === 'string').map((e) => [e.en, e.vi])));
  return cache.get(root);
}

/** Forget the cached catalogs (a spec that rewrites a catalog file). */
export const resetCatalogCache = () => cache.clear();

/** The names of the placeholders of a message. */
export const placeholdersOf = (text) => [...String(text).matchAll(PLACEHOLDER)].map((m) => m[1]).sort();

/** `text` with each `{name}` replaced by vars[name] (an unknown name is left as written). */
export const fill = (text, vars = {}) => String(text).replace(PLACEHOLDER, (whole, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : whole));

/** The message `en` in `language` (`vi` translates through the catalog; any other language is the English source). */
export function translate(en, vars = {}, { language = 'en', root = skillRoot } = {}) {
  const vi = language === 'vi' ? loadCatalog(root).get(en) : undefined;
  return fill(vi ?? en, vars);
}

/** The owner's language (config.yaml `language`); `fallback` when there is no readable config. */
export function ownerLanguage(fallback = 'vi') {
  try { return loadConfig()?.language ?? fallback; } catch { return fallback; }
}

/** A translator bound to one language: `tr(en, vars)`. */
export const translator = (language = 'en', { root = skillRoot } = {}) => (en, vars = {}) => translate(en, vars, { language, root });
