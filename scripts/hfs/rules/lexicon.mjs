// R283: the product's removed vocabulary is declared once in hfs.json lexicon.removed.
// Source, identifiers, comments and docs obey it in both editions; the declaration itself is not a use.
import path from 'node:path';
import { escapeRegExp } from '../../lib/regex.mjs';
import { found, readJson, readText } from './read.mjs';

export const HFS_APP_LEXICON = 'HFS_APP_LEXICON';
const SOURCE_OR_DOC = /\.(?:[cm]?[jt]sx?|css|scss|sass|vue|svelte|gql|graphql|sql|sh|md|mdx|rst|adoc|txt)$/i;
const SOURCE_JSON = /(?:^|\/)(?:src|messages|locales)\/.*\.json$/i;
const OUTSIDE = /(?:^|\/)(?:node_modules|\.git|dist|build|secrets)\/|(?:^|\/)(?:secrets?|secret\.env)(?:\.|$)/i;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const LOWER = /\p{Ll}/u;
const UPPER = /\p{Lu}/u;

// A whole word also forms one segment of camelCase/PascalCase, a kebab name or a SCREAMING_SNAKE identifier.
function boundary(text, at) {
  const left = text[at - 1];
  const right = text[at];
  return !left || !right || !LETTER_OR_NUMBER.test(left) || !LETTER_OR_NUMBER.test(right)
    || (LOWER.test(left) && UPPER.test(right))
    || (UPPER.test(left) && UPPER.test(right) && LOWER.test(text[at + 1] ?? ''));
}

function removedWords(repoRoot, repo) {
  if (typeof repoRoot !== 'string') return [];
  // Resolved side declarations contain the edition and slots, so read product metadata from the root declaration.
  const root = repo.profile === 'be' || repo.profile === 'fe' ? path.dirname(repoRoot) : repoRoot;
  const lexicon = repo.lexicon ?? readJson(root, 'hfs.json')?.lexicon;
  return Array.isArray(lexicon?.removed) ? [...new Set(lexicon.removed.filter((word) => typeof word === 'string' && word.trim()).map((word) => word.trim()))] : [];
}

function wordFindings(file, text, word) {
  const matches = text.matchAll(new RegExp(escapeRegExp(word), 'giu'));
  const findings = [];
  const reported = new Set();
  for (const match of matches) {
    const start = match.index;
    const end = start + match[0].length;
    if (!boundary(text, start) || !boundary(text, end)) continue;
    const line = text.slice(0, start).split('\n').length;
    if (reported.has(line)) continue;
    reported.add(line);
    const column = start - text.lastIndexOf('\n', start - 1);
    findings.push(found(HFS_APP_LEXICON, file, `${file}:${line} uses removed product word ${JSON.stringify(word)}; replace it with the current product vocabulary`, { line, column, word }));
  }
  return findings;
}

/** Removed product words in the tracked source and docs of this root/side scope, once per word and line. */
export function lexiconFindings({ repoRoot, files, repo, inScope = () => true }) {
  if (repo.kind === 'runtime' || !['lite', 'full'].includes(repo.edition ?? 'full')) return [];
  const words = removedWords(repoRoot, repo);
  if (!words.length) return [];
  const findings = [];
  for (const file of files) {
    if (!inScope(file) || OUTSIDE.test(file) || !(SOURCE_OR_DOC.test(file) || SOURCE_JSON.test(file))) continue;
    const text = readText(repoRoot, file);
    if (text === null) continue;
    for (const word of words) findings.push(...wordFindings(file, text, word));
  }
  return findings;
}
