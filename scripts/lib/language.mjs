// language.mjs - the one home of "is this text English?" for source, comments, tests and docs (HFS_LANGUAGE_NOT_ENGLISH,
// BE_SOURCE_FORM, FE_SOURCE_FORM). Shared by the architecture machine (docs) and by both lint canons (each ships a byte
// copy in its runtime/ bundle, kept by scripts/hfs/sync-runtime.mjs).
//
// Detection is structural on characters, never a word list: the letters Vietnamese adds to the Latin alphabet (a-breve, a-circumflex,
// d-stroke, e-circumflex, o-circumflex, o-horn, u-horn) and every vowel carrying a tone mark. Text is folded to NFC first, so a
// decomposed spelling (base letter + combining mark) is caught exactly like the precomposed one, and a loanword such as
// `naive`, `facade` or `Muller` (no tone mark, no Vietnamese letter) is never a hit.
import path from 'node:path';

/** One Vietnamese letter, precomposed (NFC): the Vietnamese-specific base letters, tone-marked vowels and the Latin Extended Additional block. */
export const SECOND_LANGUAGE_LETTER = /[À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỿ]/;

/** Whether `text` holds a Vietnamese letter, in NFC or NFD spelling. */
export const hasSecondLanguage = (text) => typeof text === 'string' && SECOND_LANGUAGE_LETTER.test(text.normalize('NFC'));

/** Every line of `text` with a Vietnamese letter: `[{ line, column }]`, both 1-based. */
export function secondLanguageHits(text) {
  const hits = [];
  String(text).split(/\r?\n/).forEach((raw, index) => {
    const match = SECOND_LANGUAGE_LETTER.exec(raw.normalize('NFC'));
    if (match) hits.push({ line: index + 1, column: match.index + 1 });
  });
  return hits;
}

/**
 * The Vietnamese fields of one failure-code entry: the operator text the owner mandated for the failure-code catalog
 * (scripts/checks/check-failure-codes.mjs types the entry with exactly these). causes_vi is the list companion of the three scalar fields.
 */
export const FAILURE_CODE_VIETNAMESE_FIELDS = Object.freeze(['title_vi', 'meaning_vi', 'nextStep_vi', 'causes_vi']);

/**
 * The fields of a document that carry deliberate Vietnamese text, keyed by file: a declared field-level exception of that file's
 * typed content, never a path pattern over content. `fields` are block keys (the key's own value and its list items are exempt);
 * `flowFields` are keys inside an inline flow map (`{ vi: ..., en: ... }`), where only that key's value is exempt. A Vietnamese
 * value under any other key of the same file is still a finding.
 *  - modules/kernel/failure-codes.yaml: the operator text the owner mandated for the failure-code catalog.
 *  - modules/ops/_labels.yaml: the op-label catalogue, one `{ vi, en }` pair per op (the `vi` field is the localized label).
 *  - modules/goal/archetypes.yaml: the Vietnamese phrase lexicons matched against owner input (the signal phrase sets, and the
 *    phrase lists of the archetype recognisers).
 *  - modules/goal/source-phrases.yaml: the Vietnamese phrase lists runtime source matchers read through
 *    scripts/lib/source-phrases.mjs (owner replies, report wording, product copy) - each leaf list under `phrases`.
 * An op manifest (modules/ops/ops/<id>.yaml, the starci/op@1 documents check-op-manifest types) is declared by
 * OP_MANIFEST_VIETNAMESE_FIELDS: its text objects are {en, vi} (modules/schemas/op.schema.yaml $defs text), and `vi` is the
 * owner's reading of the same rule.
 */
export const DECLARED_VIETNAMESE_FIELDS = Object.freeze({
  'modules/kernel/failure-codes.yaml': Object.freeze({ fields: FAILURE_CODE_VIETNAMESE_FIELDS }),
  'modules/ops/_labels.yaml': Object.freeze({ flowFields: Object.freeze(['vi']) }),
  'modules/goal/archetypes.yaml': Object.freeze({
    fields: Object.freeze([
      'buildIntent', 'canonIntent', 'e2eIntent', 'uatIntent', 'proofNegation', 'integrationIntent', 'integrationNegation', 'brandIntent',
      'phrases', 'requires', 'excludes', 'backend', 'frontend', 'package',
    ]),
  }),
  'modules/goal/source-phrases.yaml': Object.freeze({
    fields: Object.freeze([
      'prefer', 'avoid', 'negation', 'refused', 'accept', 'golden',
      'missingPaths', 'grantTooNarrow', 'toolTimeout', 'testGap', 'checkerUnavailable',
      'supervisorVerbs', 'ownerWord', 'orWord', 'beyondAuthority', 'ownerOnly', 'workerDied', 'contractConflict', 'decision',
      'product', 'grammar', 'knowledge', 'sourceLabel', 'internalVocabulary', 'actor', 'success',
      'wizard', 'form', 'dashboard', 'gap', 'anatomy', 'otpLabel',
    ]),
  }),
});

/**
 * The Vietnamese catalog of owner-visible messages (scripts/lib/i18n.mjs): modules/i18n/messages/<area>.yaml, a list of
 * `{en, vi}` entries keyed from the English source. The `vi` field (block or inline flow) is the declared Vietnamese.
 */
const I18N_CATALOG_VIETNAMESE_FIELDS = Object.freeze({ fields: Object.freeze(['vi']), flowFields: Object.freeze(['vi']) });
const I18N_CATALOG_DIR = 'modules/i18n/messages/';

/** The `vi` field of an op manifest's text objects (modules/schemas/op.schema.yaml $defs text). */
const OP_MANIFEST_VIETNAMESE_FIELDS = Object.freeze({ fields: Object.freeze(['vi']) });
const OP_MANIFEST_DIR = 'modules/ops/ops/';
/** The declared Vietnamese fields of `rel`: its own entry, or the op-manifest text field for a manifest of modules/ops/ops. */
export const declaredVietnameseFieldsOf = (rel) => DECLARED_VIETNAMESE_FIELDS[rel]
  ?? (rel.startsWith(I18N_CATALOG_DIR) && !rel.slice(I18N_CATALOG_DIR.length).includes('/') && /\.ya?ml$/.test(rel) ? I18N_CATALOG_VIETNAMESE_FIELDS : null)
  ?? (rel.startsWith(OP_MANIFEST_DIR) && !rel.slice(OP_MANIFEST_DIR.length).includes('/') && /\.ya?ml$/.test(rel) ? OP_MANIFEST_VIETNAMESE_FIELDS : null);

/**
 * The slots whose files may carry another language, and why: a catalog is product copy in two languages, and an i18n
 * fixture reproduces a real localized string a parser or formatter must accept. Placement is the whole marker - there is no
 * comment pragma and no path pattern. The slots are declared in knowledge/hfs/slots.yaml.
 */
const LOCALIZED_TEXT_SLOTS = Object.freeze([
  'be.domain.messages', 'be.feature.messages', 'be.tests.fixtures.i18n',
  'fe.modules.i18n', 'fe.package.i18n',
]);

/** Whether a document (Markdown or YAML) of `slot` is exempt: only catalogue and fixture DATA (YAML) is; Markdown is prose and never is. */
export const isLocalizedDataFile = (rel, slot) => LOCALIZED_TEXT_SLOTS.includes(slot) && /\.ya?ml$/.test(rel);

/**
 * The key each line of a YAML text belongs to: a `key:` line owns itself, and every deeper-indented line after it (a list item,
 * a folded block, a wrapped scalar) belongs to the same key. A line at or above the key's indent that is not a key belongs to none.
 */
function yamlKeyOfEachLine(text) {
  let key = null;
  let keyIndent = -1;
  return String(text).split(/\r?\n/).map((raw) => {
    if (raw.trim() === '') return key;
    const indent = raw.length - raw.trimStart().length;
    const own = /^(\s*(?:-\s+)?)([A-Za-z_][\w-]*)\s*:(?:\s|$)/.exec(raw);
    if (own) { key = own[2]; keyIndent = own[1].length; return key; }
    // a list item may sit at the key's own indent (`key:` then `- item` at the same column)
    if (indent > keyIndent || (indent === keyIndent && /^\s*-\s/.test(raw))) return key;
    key = null;
    keyIndent = -1;
    return null;
  });
}

/** The Vietnamese hits of a document, minus the declared field-level exceptions of `rel` (a repository-relative POSIX path). */
export function documentLanguageHits(rel, text) {
  const declared = declaredVietnameseFieldsOf(rel);
  const hits = secondLanguageHits(text);
  if (!declared) return hits;
  const keys = yamlKeyOfEachLine(text);
  const lines = String(text).split(/\r?\n/);
  return hits.filter((hit) => {
    if (declared.fields?.includes(keys[hit.line - 1])) return false;
    if (!declared.flowFields) return true;
    // an inline flow map: drop the declared fields' values and judge what is left of the line
    const rest = declared.flowFields.reduce((line, field) => line.replace(new RegExp(String.raw`\b${field}\s*:\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,}]*)`, 'g'), ''), lines[hit.line - 1]);
    return hasSecondLanguage(rest);
  });
}

/** The file extensions of a prose document (Markdown and YAML). */
const DOCUMENT_EXTENSIONS = Object.freeze(['.md', '.yaml', '.yml']);

/** Whether `rel` is a document a language check reads. */
export const isDocument = (rel) => DOCUMENT_EXTENSIONS.includes(path.posix.extname(rel));
