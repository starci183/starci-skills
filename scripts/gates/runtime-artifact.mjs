// runtime-artifact.mjs - the metadata and the hard exclusion check of the downloadable runtime archive that
// .github/workflows/runtime-artifact.yml uploads. The archive is the `npm pack` tarball of the root package, so its `files` list
// stays the one release inventory; this script adds no second inventory, it only describes what npm packed and refuses what must
// never ship. Node builtins only and no child process: the workflow runs `npm pack --json` and hands the result in.
//   node scripts/gates/runtime-artifact.mjs --pack <npm-pack.json> --dir <tarball dir> --out <dir> [--root <runtime root>]
// Writes release-metadata.json, inventory.txt and SHA256SUMS into --out. Exit 0 clean, 1 forbidden material in the tarball,
// 2 bad usage or an unreadable input.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_NAMES = new Set(['secret.env', 'settings.local.json', 'machine.sqlite']);
// The host-local owner config sits at the package root; knowledge/patterns/be/config.yaml and the like are shipped documents.
const FORBIDDEN_ROOT_NAMES = new Set(['config.yaml', 'config.json']);
const EXAMPLES_ROOT = 'examples/';
const FORBIDDEN_SEGMENTS = new Set(['node_modules', '.git', '.secrets', 'secrets', '.runtime']);
const FORBIDDEN_SUFFIX = /\.sqlite-(?:wal|shm|journal)$|\.log$/;
// A dotenv file or a private key; `.env.example` and the like are templates, like secret.env.example.
const FORBIDDEN_SECRET = /^\.env(?:\.(?!example$|sample$|template$).*)?$|\.(?:pem|key)$/;
const WORK_SEGMENT = '.starciwork';

/**
 * The forbidden entries of a packed file list: [{path, reason}]. `allowedWork` is the set of `.starciwork` paths the package
 * `files` list names explicitly. Tracked example fixtures under `examples/<app>/.starciwork/` ship today (npm does not apply the
 * negation of the `files` list after the broad `examples/` entry), so they are allowed and counted by the caller; a
 * `.starciwork` anywhere else is host-local work state. `secret.env.example` is allowed because only `secret.env` is private.
 * Matching ignores letter case and reads a backslash as `/`, so a renamed copy from a case-insensitive host is still refused.
 */
export function forbiddenEntries(paths, allowedWork = new Set()) {
  const found = [];
  for (const entry of paths) {
    const lowered = entry.replaceAll('\\', '/').toLowerCase();
    const segments = lowered.split('/');
    const name = segments.at(-1);
    const directory = segments.slice(0, -1).find((segment) => FORBIDDEN_SEGMENTS.has(segment));
    let reason = null;
    if (FORBIDDEN_NAMES.has(name) || (segments.length === 1 && FORBIDDEN_ROOT_NAMES.has(name))) reason = `host-local or secret file ${name}`;
    else if (FORBIDDEN_SUFFIX.test(name)) reason = `database journal or log ${name}`;
    else if (FORBIDDEN_SECRET.test(name)) reason = `dotenv file or private key ${name}`;
    else if (directory) reason = `forbidden directory ${directory}/`;
    else if (segments.includes(WORK_SEGMENT) && !allowedWork.has(entry) && !lowered.startsWith(EXAMPLES_ROOT)) reason = `${WORK_SEGMENT}/ entry outside the curated examples/ fixtures`;
    if (reason) found.push({ path: entry, reason });
  }
  return found;
}

/** The `.starciwork` paths the package `files` list names explicitly (a glob or a negation is not an explicit name). */
export function explicitWorkPaths(files) {
  return new Set(files.filter((file) => typeof file === 'string' && !/[*?!]/.test(file) && file.split('/').includes(WORK_SEGMENT)));
}

/** The inventory.txt text: every packed file sorted by path with its byte size, one `<size>\t<path>` line each. */
export function inventoryText(packedFiles) {
  const sorted = [...packedFiles].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return `${sorted.map((file) => `${file.size}\t${file.path}`).join('\n')}\n`;
}

/**
 * The release-metadata.json document. Identity comes from the packed package.json and the CI environment, never from a constant,
 * so the metadata cannot drift from the archive it sits beside.
 */
export function releaseMetadata({ manifest, packed, tarball, sha256, bytes, env, nodeVersion }) {
  return {
    schema: 'starci/runtime-artifact@1',
    name: manifest.name,
    version: manifest.version,
    sha: env.GITHUB_SHA ?? null,
    ref: env.GITHUB_REF ?? null,
    runId: env.GITHUB_RUN_ID ?? null,
    runAttempt: env.GITHUB_RUN_ATTEMPT ?? null,
    tarball,
    bytes,
    sha256,
    npmShasum: packed.shasum ?? null,
    fileCount: packed.files.length,
    node: nodeVersion,
  };
}

function option(argv, name) {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : undefined;
}

/** Run the script; returns the exit code and prints one line per finding. */
export function main(argv = process.argv.slice(2), env = process.env) {
  const [packFile, dir, out] = ['pack', 'dir', 'out'].map((name) => option(argv, name));
  const root = path.resolve(option(argv, 'root') ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
  if (!packFile || !dir || !out) {
    process.stderr.write('usage: runtime-artifact.mjs --pack <npm-pack.json> --dir <tarball dir> --out <dir> [--root <root>]\n');
    return 2;
  }
  let packed;
  let manifest;
  let bytes;
  try {
    packed = JSON.parse(fs.readFileSync(packFile, 'utf8'))[0];
    manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    bytes = fs.readFileSync(path.join(dir, packed.filename));
  } catch (error) {
    process.stderr.write(`runtime-artifact: cannot read the pack result or tarball: ${error.message}\n`);
    return 2;
  }
  if (packed.name !== manifest.name || packed.version !== manifest.version) {
    process.stderr.write(`runtime-artifact: packed ${packed.name}@${packed.version} differs from package.json ${manifest.name}@${manifest.version}\n`);
    return 2;
  }
  if (!Array.isArray(packed.files) || packed.files.length === 0) {
    process.stderr.write('runtime-artifact: the pack result lists no files\n');
    return 2;
  }
  const sha1 = createHash('sha1').update(bytes).digest('hex');
  if (packed.shasum !== sha1) {
    process.stderr.write(`runtime-artifact: the tarball sha1 ${sha1} differs from the pack result ${packed.shasum}: the list does not describe this tarball\n`);
    return 2;
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  fs.mkdirSync(out, { recursive: true });
  const metadata = releaseMetadata({ manifest, packed, tarball: packed.filename, sha256, bytes: bytes.length, env, nodeVersion: process.version });
  fs.writeFileSync(path.join(out, 'release-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'inventory.txt'), inventoryText(packed.files));
  fs.writeFileSync(path.join(out, 'SHA256SUMS'), `${sha256}  ${packed.filename}\n`);
  const work = packed.files.filter((file) => file.path.split('/').includes(WORK_SEGMENT)).length;
  const bad = forbiddenEntries(packed.files.map((file) => file.path), explicitWorkPaths(manifest.files ?? []));
  for (const finding of bad) process.stderr.write(`RUNTIME_ARTIFACT_FORBIDDEN ${finding.path}: ${finding.reason}\n`);
  process.stdout.write(`${packed.filename} ${bytes.length} bytes, ${packed.files.length} files, sha256 ${sha256}, ${work} .starciwork files, forbidden ${bad.length}\n`);
  return bad.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
