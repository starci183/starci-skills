// canon-copy-drift.mjs - HFS_CANON_COPY_DRIFT (R253): a handful of scaffolded files are hash-sensitive canon,
// not files to edit. The drift judgement is one sha256 against the bytes of the be/skeleton template the file was
// scaffolded from - the file equals canon, or it has drifted. A finding carries the path and both hashes, never
// file content.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { found } from './read.mjs';

const CANON_COPY = 'HFS_CANON_COPY_DRIFT';
const TEMPLATE_ROOTS = [
  path.resolve(import.meta.dirname, '../../../packages/hfs/templates'),
  path.resolve(import.meta.dirname, '../../../../templates'),
];
const TEMPLATE_DIR = 'be/skeleton/';

// The three managed files the standard's secret-custody law pins byte-for-byte.
const CANON_PATHS = [
  'src/modules/platform/config/env-source.config.ts',
  'src/modules/platform/http-security/origin.guard.ts',
  'src/modules/platform/http-security/webhook-signature.service.ts',
];
const REGEX_ESCAPE = String.raw`\$&`;
const CANON_SUFFIX = new RegExp(`(?:^|/)(${CANON_PATHS.map((rel) => rel.replace(/[.*+?^${}()|[\]\\]/g, REGEX_ESCAPE)).join('|')})$`);

const templateBytes = (rel) => {
  for (const root of TEMPLATE_ROOTS) {
    const file = path.join(root, TEMPLATE_DIR, rel);
    try {
      const bytes = fs.readFileSync(file);
      if (bytes.length) return bytes;
    } catch { /* next root */ }
  }
  return null;
};
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function canonCopyDriftFindings({ repoRoot, files, inScope }) {
  const findings = [];
  for (const file of files.filter((f) => !inScope || inScope(f))) {
    const hit = CANON_SUFFIX.exec(file.replaceAll('\\', '/'));
    if (!hit) continue;
    const expected = templateBytes(hit[1]);
    if (!expected) continue;
    let actual;
    try {
      actual = fs.readFileSync(path.join(repoRoot, file));
    } catch {
      continue;
    }
    const expectedHash = sha256(expected);
    const actualHash = sha256(actual);
    if (actualHash === expectedHash) continue;
    findings.push(found(CANON_COPY, file,
      `${file} differs from the canon copy it was scaffolded from (sha256 ${actualHash.slice(0, 12)} vs ${expectedHash.slice(0, 12)}); restore the managed file's bytes - it is hash-sensitive canon, not a file to edit`,
      { expectedHash, actualHash }));
  }
  return findings;
}
