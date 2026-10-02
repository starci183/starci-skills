#!/usr/bin/env node
// check-i18n-catalog.mjs - the Vietnamese message catalog (modules/i18n/messages/*.yaml, read by scripts/lib/i18n.mjs) is well
// formed (part of `npm run check`). The catalog is the one declared home of owner-visible Vietnamese:
//   - every file declares the schema, an area named by its file, a `runtime` or `ui` scope, and a non-empty messages list;
//   - `en` is an English string (no Vietnamese letter), `vi` a non-empty string, both carrying exactly the same `{placeholder}`s;
//   - an English source appears once within a scope (RT_I18N_DUPLICATE); the runtime and UI may intentionally word it differently.
//   node scripts/checks/check-i18n-catalog.mjs [--json]
// Exit 0 clean, 1 findings.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { isMain } from '../lib/is-main.mjs';
import { CATALOG_DIR, catalogFiles, placeholdersOf } from '../lib/i18n.mjs';
import { hasSecondLanguage } from '../lib/language.mjs';

const CATALOG_SCHEMA = 'starci/i18n-catalog@1';
const CATALOG_SCOPES = Object.freeze(['runtime', 'ui']);

/** The findings of the catalog under `root`: [{code, path, message}]. */
export function catalogFindings(root = skillRoot) {
  const findings = [];
  const seen = new Map();
  for (const rel of catalogFiles(root)) {
    const add = (code, message) => findings.push({ code, path: rel, message });
    let doc;
    try { doc = parseYaml(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8')); } catch (error) { add('RT_I18N_UNREADABLE', `${rel} is not valid YAML: ${error.message}`); continue; }
    if (doc?.schema !== CATALOG_SCHEMA) add('RT_I18N_SCHEMA', `${rel} must declare schema: ${CATALOG_SCHEMA}`);
    const area = path.posix.basename(rel).replace(/\.ya?ml$/, '');
    if (doc?.area !== area) add('RT_I18N_AREA', `${rel} must declare area: ${area}`);
    const scope = doc?.scope;
    if (!CATALOG_SCOPES.includes(scope)) add('RT_I18N_SCOPE', `${rel} must declare scope as runtime or ui`);
    if (!Array.isArray(doc?.messages) || !doc.messages.length) { add('RT_I18N_EMPTY', `${rel} needs a non-empty messages list`); continue; }
    doc.messages.forEach((entry, index) => {
      const where = `${rel} messages[${index}]`;
      if (typeof entry?.en !== 'string' || !entry.en.trim() || typeof entry?.vi !== 'string' || !entry.vi.trim()) { add('RT_I18N_ENTRY', `${where} needs a non-empty string en and vi`); return; }
      if (hasSecondLanguage(entry.en)) add('RT_I18N_EN_NOT_ENGLISH', `${where}: the en source carries a Vietnamese letter`);
      if (placeholdersOf(entry.en).join(',') !== placeholdersOf(entry.vi).join(',')) add('RT_I18N_PLACEHOLDERS', `${where}: en and vi must carry the same {placeholders}`);
      const key = `${scope}\0${entry.en}`;
      if (seen.has(key)) add('RT_I18N_DUPLICATE', `${where}: the en source is already translated in ${seen.get(key)} for scope ${scope}`);
      else seen.set(key, rel);
    });
  }
  return findings;
}

if (isMain(import.meta.url)) {
  const findings = catalogFindings();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.message}`);
    if (!findings.length) console.log(`OK: ${catalogFiles().length} i18n catalog file(s) under ${CATALOG_DIR} are well formed.`);
  }
  process.exit(findings.length ? 1 : 0);
}
