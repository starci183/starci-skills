import fs from 'node:fs';
import path from 'node:path';
import { treeOf } from './required-files.mjs';
import { documentLanguageHits, isDocument, isLocalizedDataFile } from '../../lib/language.mjs';

/**
 * R96 `doc-language` (HFS_DOC_NOT_ENGLISH). Every Markdown and YAML document under knowledge/, docs/, src/ and apps/ is English:
 * prose, patterns and examples alike, and a code fence inside Markdown counts because an example is read exactly like the
 * prose around it. Detection is structural on characters (scripts/lib/language.mjs), never a word list.
 *
 * The one exception is data, decided by placement: a YAML file that sits in a slot carrying localized text (a message
 * catalog slot or an i18n fixtures slot, listed in scripts/lib/language.mjs) may hold another language. Markdown is never data, so a README
 * inside a catalog slot is judged like any other document. No comment pragma, no path pattern.
 */
export const DOC_LANGUAGE_RULE_IDS = ['HFS_DOC_NOT_ENGLISH'];

const RULE = 'HFS_DOC_NOT_ENGLISH';
/** The top-level folders whose documents this check reads. */
export const DOCUMENT_ROOTS = Object.freeze(['knowledge', 'docs', 'src', 'apps']);

export function checkDocLanguage({ config, graph }) {
  const resolver = graph.resolver;
  const tree = treeOf(config.root);
  const violations = [];
  let files = 0;
  for (const file of [...tree.files].sort()) {
    if (!DOCUMENT_ROOTS.includes(file.split('/')[0]) || !isDocument(file) || file.split('/').includes('node_modules')) continue;
    const classified = resolver.classifyPath(file);
    if (isLocalizedDataFile(file, classified.status === 'owned' ? classified.slot : null)) continue;
    let text;
    try { text = fs.readFileSync(path.join(config.root, ...file.split('/')), 'utf8'); } catch { continue; }
    files += 1;
    for (const hit of documentLanguageHits(file, text)) {
      violations.push({ ruleId: RULE, path: file, line: hit.line, column: hit.column,
        message: `${file}:${hit.line} carries a Vietnamese letter. Documents are English (prose, patterns, examples and code fences); only YAML data in a message-catalog or i18n-fixtures slot may hold another language. Write the line in English.` });
    }
  }
  return { violations, coverage: { status: 'checked', files } };
}
