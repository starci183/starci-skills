#!/usr/bin/env node
// check-doc-language.mjs - the runtime repository's own documents are English (HFS_DOC_NOT_ENGLISH, rule R96), part of
// `npm run check`. It is the same law and the same detection (scripts/lib/language.mjs) the architecture machine applies to a
// product repository's knowledge/, docs/, src/ and apps/; the runtime is not a slot repository, so its own scope is spelled here:
// every Markdown and YAML document of knowledge/, docs/, modules/, packages/, examples/, skills/, ui/ and the repository root.
//   node scripts/checks/check-doc-language.mjs [--json]
//
// The only exceptions are the declared field-level ones of scripts/lib/language.mjs (DECLARED_VIETNAMESE_FIELDS): the Vietnamese
// operator fields of the failure-code catalog (modules/kernel/failure-codes.yaml), the `vi` field of the op-label catalogue
// (modules/ops/_labels.yaml) and the phrase-list keys of the Vietnamese lexicons (modules/goal/archetypes.yaml). The byte copies under a bundle's runtime/ directory (packages/*/runtime) are checked against
// their sources by `sync-runtime.mjs --check`, so they are skipped here. A product repository's message catalogs are JSON or
// TypeScript, which this check does not read.
// Exit 0 clean, 1 findings.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { documentLanguageHits, isDocument } from '../lib/language.mjs';
import { BUNDLES } from '../../packages/hfs/scripts/sync-runtime.mjs';
import { isMain } from './common.mjs';
import { gitResult } from '../api/git/lib.mjs';

/** The runtime folders whose documents are read; the repository root's own Markdown is read too. */
export const RUNTIME_DOCUMENT_ROOTS = Object.freeze(['knowledge', 'docs', 'modules', 'packages', 'examples', 'skills', 'ui']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.next', 'coverage']);

/** The document files of a runtime checkout (repository-relative POSIX paths). */
export function runtimeDocuments(root = skillRoot) {
  const bundles = new Set(Object.keys(BUNDLES));
  const out = [];
  // A git-ignored file is not a document of the repository (the owner's local config.yaml, scratch files): only tracked
  // and untracked-but-not-ignored files are judged. Outside a git work tree (an installed copy) every file is judged.
  const listed = gitResult(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root });
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

/** Every Vietnamese hit of the runtime's documents: `[{ path, line, column }]`. */
export function docLanguageFindings(root = skillRoot) {
  return runtimeDocuments(root).flatMap((rel) => documentLanguageHits(rel, fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8')).map((hit) => ({ code: 'HFS_DOC_NOT_ENGLISH', path: rel, ...hit })));
}

if (isMain(import.meta.url)) {
  const findings = docLanguageFindings();
  if (process.argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.path}:${f.line}:${f.column} carries a Vietnamese letter; documents are English (only the declared fields of scripts/lib/language.mjs are exempt)`);
    console.log(`doc-language: ${runtimeDocuments().length} documents, ${findings.length} findings`);
  }
  process.exit(findings.length ? 1 : 0);
}
