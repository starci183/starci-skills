// A cut slice's TypeScript gate: compare the current program with the same program whose owned files
// are restored to the admission commit. Other in-flight edits are identical in both programs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseBlobsOf, git, tscParity } from '../reconcile/canon-parity.mjs';

const relative = (root, value) => {
  const absolute = path.resolve(root, value);
  const rel = path.relative(root, absolute).replaceAll('\\', '/');
  return rel && rel !== '..' && !rel.startsWith('../') && !path.isAbsolute(rel) ? rel : null;
};

/** The gate's JSON result. `projects` may include preexisting diagnostics; only `newErrors` fail. */
export function checkSliceTypecheck({ root, base, paths, projects = [], ts = null }) {
  const repository = path.resolve(root ?? '.');
  if (!base || !Array.isArray(paths) || !paths.length) return { status: 'unavailable', code: 'SLICE_TYPECHECK_INPUT', message: '--base and at least one owned path are required' };
  const ownedRels = paths.map((value) => relative(repository, value));
  if (ownedRels.some((value) => !value)) return { status: 'unavailable', code: 'SLICE_TYPECHECK_INPUT', message: 'owned paths must stay inside the repository' };
  const extraProjects = projects.map((value) => path.resolve(repository, value));
  if (extraProjects.some((value) => !relative(repository, value) || !fs.existsSync(value))) return { status: 'unavailable', code: 'SLICE_TYPECHECK_INPUT', message: 'each --project must name an existing tsconfig inside the repository' };
  const commit = git(repository, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  if (!commit.ok) return { status: 'unavailable', code: 'SLICE_BASE_UNKNOWN', message: `admission base ${base} is not a commit` };
  const blobs = baseBlobsOf(repository, String(commit.stdout).trim(), ownedRels);
  if (!blobs.ok) return { status: 'unavailable', code: 'SLICE_BASE_UNAVAILABLE', message: blobs.reason };
  try {
    const parity = tscParity({ root: repository, ownedRels, baseBlobs: blobs.blobs, extraProjects, ts });
    if (parity.unavailable) return { status: 'unavailable', code: 'SLICE_TYPECHECK_UNAVAILABLE', message: parity.unavailable };
    if (!parity.projects.length) return { status: 'unavailable', code: 'SLICE_TYPECHECK_UNAVAILABLE', message: 'no TypeScript project covers the owned paths; pass the declared typecheck tsconfig with --project' };
    const notes = parity.projects.filter((project) => project.baseErrors > 0).map((project) => ({
      code: 'SLICE_PREEXISTING', severity: 'note', project: project.project,
      count: project.baseErrors, message: `${project.baseErrors} TypeScript error(s) existed at the slice admission base; only newly introduced diagnostics gate this slice.`,
    }));
    return { status: parity.ok ? 'clean' : 'findings', base: String(commit.stdout).trim(), paths: ownedRels,
      projects: parity.projects, newErrors: parity.newErrors, notes };
  } catch (error) {
    return { status: 'unavailable', code: 'SLICE_TYPECHECK_UNAVAILABLE', message: String(error.message ?? error) };
  }
}

export function parseSliceTypecheckArgs(argv) {
  let root = '.', base = null;
  const projects = [], paths = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') { paths.push(...argv.slice(i + 1)); break; }
    if (arg === '--root') { root = argv[++i]; continue; }
    if (arg === '--base') { base = argv[++i]; continue; }
    if (arg === '--project') { projects.push(argv[++i]); continue; }
    throw new Error(`unknown argument ${arg}`);
  }
  if (!root || !base || !paths.length || projects.some((value) => !value) || paths.some((value) => !value))
    throw new Error('usage: slice-typecheck --root ROOT --base COMMIT [--project TSCONFIG ...] -- OWNED_PATH ...');
  return { root, base, projects, paths };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try { result = checkSliceTypecheck(parseSliceTypecheckArgs(process.argv.slice(2))); }
  catch (error) { result = { status: 'unavailable', code: 'SLICE_TYPECHECK_INPUT', message: String(error.message ?? error) }; }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === 'clean' ? 0 : result.status === 'findings' ? 1 : 2;
}
