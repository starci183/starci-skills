// canon-digest.mjs — the one content digest of a lint canon package (modules/models/code-patterns.yaml `canon.contentDigest`).
// The policy names the algorithm, the include/exclude globs and the framing; the only framing is
// `sorted-posix-relative-path-null-raw-bytes-null`: every selected file, sorted by its posix relative path (ICU 'en' collation),
// contributes its path as UTF-8, one NUL byte, its raw bytes, one NUL byte. An unknown algorithm or framing, a malformed
// policy and a symlink in the file set are refused with a typed code, never hashed around.
//
// The file set is either the canon's PUBLISHED set (`packedFiles`: the npm pack list of its source directory, what the
// registry tarball carries) or an installed copy on disk (`installedFiles`: every regular file under the package root,
// node_modules excluded). Both feed `canonContentDigest`, so the runtime check and the product gate hash one way.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { npmPackDryRun } from '../api/npm/pack-dry-run.mjs';
import { braceVariants, globExpression } from './glob.mjs';
import { posixPath } from './path-key.mjs';

export const CANON_DIGEST_ALGORITHMS = Object.freeze(['sha256']);
export const CANON_DIGEST_FRAMINGS = Object.freeze(['sorted-posix-relative-path-null-raw-bytes-null']);

// The framing's order is the ICU collation of the 'en' locale (what String#localeCompare gives on a default Node host), fixed
// here so the order never follows the host's locale; the bound profile values are computed in it.
const ORDER = new Intl.Collator('en', { usage: 'sort', sensitivity: 'variant' });
const fail = (code, message) => Object.assign(new Error(message), { code });
const matchAny = (file, globs) => globs.flatMap(braceVariants).some((pattern) => globExpression(pattern).test(file));
const globList = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());

/** The policy itself, or a typed refusal: CANON_DIGEST_ALGORITHM_UNKNOWN, CANON_DIGEST_FRAMING_UNKNOWN, CANON_DIGEST_POLICY_INVALID. */
export function assertDigestPolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw fail('CANON_DIGEST_POLICY_INVALID', 'The canon content digest policy is not an object.');
  if (!CANON_DIGEST_ALGORITHMS.includes(policy.algorithm)) throw fail('CANON_DIGEST_ALGORITHM_UNKNOWN', `The canon digest algorithm ${JSON.stringify(policy.algorithm)} is not one of ${CANON_DIGEST_ALGORITHMS.join(', ')}.`);
  if (!CANON_DIGEST_FRAMINGS.includes(policy.framing)) throw fail('CANON_DIGEST_FRAMING_UNKNOWN', `The canon digest framing ${JSON.stringify(policy.framing)} is not one of ${CANON_DIGEST_FRAMINGS.join(', ')}.`);
  if (!globList(policy.include) || !policy.include.length || !globList(policy.exclude)) throw fail('CANON_DIGEST_POLICY_INVALID', 'The canon digest policy needs a non-empty include glob list and an exclude glob list.');
  return policy;
}

/** Whether posix relative `file` is selected by the policy's include and exclude globs. */
export const selectedByPolicy = (file, policy) => matchAny(file, policy.include) && !matchAny(file, policy.exclude);

/** The PUBLISHED file list of the package whose source is `directory`: `npm pack --dry-run --json --ignore-scripts`. */
export function packedFiles(directory) {
  const run = npmPackDryRun(directory);
  let listed;
  try { listed = JSON.parse(run.stdout)?.[0]?.files; } catch { listed = null; }
  if (run.status !== 0 || !Array.isArray(listed)) throw fail('CANON_PACK_UNAVAILABLE', `npm pack --dry-run could not list ${directory}: ${String(run.stderr ?? run.error?.message ?? '').trim().split(/\r?\n/).at(-1) ?? ''}`);
  return listed.map((entry) => posixPath(entry.path));
}

/** Every regular file of an installed package at `root` (node_modules skipped); a symlink is refused (CANON_PACKAGE_SYMLINK). */
export function installedFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const absolute = path.join(directory, entry.name), relative = posixPath(path.relative(root, absolute)), stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw fail('CANON_PACKAGE_SYMLINK', `The canon package holds the symlink ${relative}; a canon is hashed from regular files only.`);
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile()) files.push(relative);
    }
  };
  visit(root);
  return files;
}

/** {value, files} of the files of `root` the policy selects out of `files` (posix paths relative to `root`). */
export function canonContentDigest(root, policy, files) {
  assertDigestPolicy(policy);
  const selected = [...new Set(files.map(posixPath))].filter((file) => selectedByPolicy(file, policy)).sort(ORDER.compare);
  const hash = crypto.createHash(policy.algorithm), nul = Buffer.from([0]);
  for (const file of selected) {
    const absolute = path.join(root, file), segments = file.split('/');
    let stat;
    for (let depth = 1; depth <= segments.length; depth += 1) {
      try { stat = fs.lstatSync(path.join(root, ...segments.slice(0, depth))); } catch { throw fail('CANON_PACKAGE_UNREADABLE', `The canon file ${file} is missing.`); }
      if (stat.isSymbolicLink()) throw fail('CANON_PACKAGE_SYMLINK', `The canon file ${file} is reached through the symlink ${segments.slice(0, depth).join('/')}; a canon is hashed from regular files only.`);
    }
    if (!stat.isFile()) throw fail('CANON_PACKAGE_UNREADABLE', `The canon file ${file} is not a regular file.`);
    hash.update(Buffer.from(file, 'utf8')); hash.update(nul); hash.update(fs.readFileSync(absolute)); hash.update(nul);
  }
  return { value: hash.digest('hex'), files: selected.length };
}
