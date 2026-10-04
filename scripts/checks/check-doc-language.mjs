#!/usr/bin/env node
// check-doc-language.mjs - the runtime repository's own documents are English (HFS_DOC_NOT_ENGLISH, rule R96), part of
// `npm run check`. It is the same law and the same detection (scripts/lib/language.mjs) the architecture machine applies to a
// product repository's knowledge/, docs/, src/ and apps/; the runtime is not a slot repository, so its own scope is spelled here:
// every Markdown and YAML document of knowledge/, docs/, modules/, packages/, examples/, skills/, ui/ and the repository root.
//   starci runtime check --only doc-language -- [--json]
//
// The only exceptions are the declared field-level ones of scripts/lib/language.mjs (DECLARED_VIETNAMESE_FIELDS): the Vietnamese
// operator fields of the failure-code catalog (modules/kernel/failure-codes.yaml), the `vi` field of the op-label catalogue
// (modules/ops/_labels.yaml) and the phrase-list keys of the Vietnamese lexicons (modules/goal/archetypes.yaml and
// modules/goal/source-phrases.yaml). The byte copies under a bundle's runtime/ directory (packages/*/runtime) are checked against
// their sources by `sync-runtime.mjs --check`, so they are skipped here. A product repository's message catalogs are JSON or
// TypeScript, which this check does not read.
//
// Source is English too (HFS_SOURCE_NOT_ENGLISH): every comment, string and SQL comment of scripts/, engine/, bin/, ui/,
// packages/ and tests/ (`.mjs .cjs .js .ts .tsx .sql .ps1 .sh .html .css`). Text the owner must read in Vietnamese lives in a
// DECLARED catalog instead, keyed from its English source: scripts/lib/i18n.mjs reads modules/i18n/messages/*.yaml and generates
// the UI's ignored browser map. Phrase data a matcher applies to owner or product text lives in
// modules/goal/source-phrases.yaml (source-phrases.mjs). A new undeclared Vietnamese line fails.
// Exit 0 clean, 1 findings.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { documentLanguageHits, isDocument, secondLanguageHits } from '../lib/language.mjs';
import { BUNDLES } from '../hfs/sync-runtime.mjs';
import { isMain } from '../lib/is-main.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitResultOf } from '../lib/git.mjs';

/** The runtime folders whose documents are read; the repository root's own Markdown is read too. */
export const RUNTIME_DOCUMENT_ROOTS = Object.freeze(['knowledge', 'docs', 'modules', 'packages', 'examples', 'skills', '.starci', 'ui']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.next', 'coverage']);

/** The document files of a runtime checkout (repository-relative POSIX paths). */
function runtimeDocuments(root = skillRoot) {
  const bundles = new Set(Object.keys(BUNDLES));
  const out = [];
  // A git-ignored file is not a document of the repository (the owner's local config.yaml, scratch files): only tracked
  // and untracked-but-not-ignored files are judged. Outside a git work tree (an installed copy) every file is judged.
  const listed = gitResultOf(lsFiles(['--cached', '--others', '--exclude-standard', '-z'], { cwd: root }));
  const inRepository = listed.ok ? new Set(listed.stdout.split('\0').filter(Boolean)) : null;
  const walk = (rel) => {
    const abs = path.join(root, ...rel.split('/'));
    if (!fs.existsSync(abs) || bundles.has(rel)) return;
    if (fs.statSync(abs).isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) if (!SKIPPED_DIRECTORIES.has(name)) walk(rel === '' ? name : `${rel}/${name}`);
    } else if (isDocument(rel) && (!inRepository || inRepository.has(rel))) out.push(rel);
  };
  for (const name of fs.readdirSync(root).sort()) {
    const abs = path.join(root, name);
    if (fs.statSync(abs).isFile() ? isDocument(name) : RUNTIME_DOCUMENT_ROOTS.includes(name)) walk(name);
  }
  return out;
}

/** The source folders whose code files are read, and the file kinds. */
const RUNTIME_SOURCE_ROOTS = Object.freeze(['scripts', 'engine', 'bin', 'ui', 'packages', 'tests']);
export const SOURCE_EXTENSIONS = Object.freeze(['.mjs', '.cjs', '.js', '.ts', '.tsx', '.sql', '.ps1', '.sh', '.html', '.css']);
/** Source that IS declared Vietnamese: the Vietnamese-letter detector itself. UI source is English; its generated map is ignored. */
export const DECLARED_SOURCE_CATALOGS = Object.freeze(['scripts/lib/language.mjs']);
/**
 * Functional Vietnamese: source that MATCHES owner text (a phrase or mark the owner types) and so cannot be translated. One
 * entry per file with the reason; the file is exempt from HFS_SOURCE_NOT_ENGLISH, nothing else is.
 */
const FUNCTIONAL_VIETNAMESE = Object.freeze({
  'scripts/machine/ask-recommendation.mjs': 'matches the recommendation mark the owner types in a question option (khuyen nghi, de xuat)',
});
/** A bundle's own runtime/ copy directory (a byte copy of a runtime source, kept by sync-runtime). */
const BUNDLE_RUNTIME = /^packages\/(?:[^/]+|eslint\/[^/]+)\/runtime(?:\/|$)/;

/** The tracked source files of a runtime checkout (repository-relative POSIX paths). */
function runtimeSourceFiles(root = skillRoot) {
  const bundles = new Set(Object.keys(BUNDLES));
  const listed = gitResultOf(lsFiles(['--cached', '--others', '--exclude-standard', '-z'], { cwd: root }));
  const inRepository = listed.ok ? new Set(listed.stdout.split('\0').filter(Boolean)) : null;
  const out = [];
  const walk = (rel) => {
    const abs = path.join(root, ...rel.split('/'));
    if (!fs.existsSync(abs) || bundles.has(rel) || BUNDLE_RUNTIME.test(rel)) return;
    if (fs.statSync(abs).isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) if (!SKIPPED_DIRECTORIES.has(name)) walk(`${rel}/${name}`);
    } else if (SOURCE_EXTENSIONS.includes(path.posix.extname(rel)) && (!inRepository || inRepository.has(rel))) out.push(rel);
  };
  for (const name of RUNTIME_SOURCE_ROOTS) walk(name);
  return out;
}

/**
 * The source-language findings: HFS_SOURCE_NOT_ENGLISH for a file with a Vietnamese letter that is not a declared catalog.
 */
export function sourceLanguageFindings(root = skillRoot) {
  const findings = [];
  for (const rel of runtimeSourceFiles(root)) {
    if (DECLARED_SOURCE_CATALOGS.some((prefix) => rel.startsWith(prefix)) || Object.hasOwn(FUNCTIONAL_VIETNAMESE, rel)) continue;
    const hits = secondLanguageHits(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'));
    if (hits.length) findings.push({ code: 'HFS_SOURCE_NOT_ENGLISH', path: rel, line: hits[0].line, column: hits[0].column, count: hits.length });
  }
  return findings;
}

/** Every Vietnamese hit of the runtime's documents: `[{ path, line, column }]`. */
export function docLanguageFindings(root = skillRoot) {
  return runtimeDocuments(root).flatMap((rel) => documentLanguageHits(rel, fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8')).map((hit) => ({ code: 'HFS_DOC_NOT_ENGLISH', path: rel, ...hit })));
}

if (isMain(import.meta.url)) {
  const findings = [...docLanguageFindings(), ...sourceLanguageFindings()];
  if (process.argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.path}:${f.line}:${f.column} carries a Vietnamese letter; documents are English (only the declared fields of scripts/lib/language.mjs are exempt)`);
    console.log(`doc-language: ${runtimeDocuments().length} documents, ${findings.length} findings`);
  }
  process.exit(findings.length ? 1 : 0);
}
