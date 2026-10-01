#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseYaml} from '../../../engine/yaml.mjs';
import {walk} from './check-example-work.mjs';
import {appRootOf, readWorkspace, resolveOwnedDirs, loadRecords} from '../record-ownership.mjs';
import {slash, sameOrUnder} from '../../lib/path-key.mjs';
import { runGit } from '../../api/git/lib.mjs';
import {isDir} from '../../lib/fs-kind.mjs';
import {list} from '../../lib/list.mjs';
import {sha256File} from '../../../engine/digest.mjs';

/**
 * QUALITY-BAR §5 asks for proof rather than assertion. This script is the executable form of two of its
 * bullets: a `state: done` leaf's proof must still bind to the source it claims to prove, and it must be
 * younger than that source. It walks from the done record outward - record -> sibling evidence.yaml ->
 * the source bytes the evidence names - and refuses the four ways that chain comes apart.
 *
 * Fields read, and where each is declared:
 *   `state`, `repository`, `owners[].path`, `verificationSource`
 *                              modules/schemas/work-implementation.schema.yaml (state/repository/
 *                              verificationSource) and modules/schemas/work-layout.yaml (the `impl` shape
 *                              entry, which is what carries `owners[].path` as module roots).
 *   `outcome`, `provenance.capturedAt`, `stale`
 *                              modules/schemas/work-evidence.schema.yaml.
 *   `codeDigest.{algorithm,files[].path,files[].sha256,digest}`
 *                              declared by no schema under modules/schemas/ - it exists in the example
 *                              trees only, written by scripts/example/example-evidence.mjs and read by
 *                              scripts/work/validate/check-example-work.mjs (CODE_DIGEST_STALE) and
 *                              scripts/example/example-derive.mjs. That is a schema gap, not a licence to
 *                              invent: the shape below is the one on disk. The nearest declared shape is
 *                              modules/schemas/work-evidence.schema.yaml's `assets[]` items ({path, sha256}).
 *   The authored-by-nature exemption (work/data@1, work/brand@1, work/policy-decision@1)
 *                              modules/schemas/work-layout.yaml, rule "Done means proven or says so".
 *
 * Boundaries with its neighbours, so no fact is measured twice:
 *   scripts/work/validate/check-work-artifacts.mjs owns every declared ARTIFACT's bytes - record `assets[]`,
 *     `ui.assets[]`, evidence `assets[]`, receipts and run manifests (ASSET_MISSING, ASSET_DIGEST,
 *     EVIDENCE_ARTIFACT_GHOST). This script opens none of them, and it is that script's own
 *     CODE_DIGEST_NOT_MINE note that leaves `codeDigest` to somebody else.
 *   scripts/work/validate/check-example-work.mjs owns `recordDigest` staleness and the AGGREGATE
 *     `codeDigest.digest` recomputed over the record's owner directories (CODE_DIGEST_STALE). This script
 *     owns the per-file rows underneath that aggregate, which nothing else opens, and the time edge
 *     between a capture and the source it covers, which nothing else measures.
 *   Exit convention: 0 clean, 1 findings, 2 invalid argument or unreadable input.
 *
 * Read-only: it opens files, asks git for commit times and writes nothing.
 */

const CODES = ['EVIDENCE_PATH_MISSING', 'EVIDENCE_DIGEST_MISMATCH', 'EVIDENCE_OLDER_THAN_SOURCE', 'EVIDENCE_ASSERTED_NOT_OBSERVED'];

const HELP = `Usage: node scripts/work/validate/check-evidence-binding.mjs --work <.starciwork root> [--json]

Proves that every \`state: done\` leaf's evidence still binds to the source it claims to prove.
Findings: ${CODES.join(', ')}.
Exit 0 is clean, 1 reports findings, 2 means invalid arguments or an unreadable declared input.`;

/** Schemas the layout declares true because they were written down and agreed, never because a run
 * observed them - an authored claim on one of these is the contract, not a gap in it. */
const AUTHORED_BY_NATURE = new Set(['work/data@1', 'work/brand@1', 'work/policy-decision@1']);

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git', '.starciwork']);
const GIT_PATHSPEC_CHUNK = 100;

export class EvidenceBindingInputError extends Error {
  constructor(message) { super(message); this.name = 'EvidenceBindingInputError'; }
}

// ---------- arguments ----------

export function parseArgs(argv) {
  const out = {workRoot: null, json: false, help: false};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return {...out, help: true};
    if (key === '--json') { out.json = true; continue; }
    if (key !== '--work') throw new EvidenceBindingInputError(`Unknown argument ${key}`);
    const value = argv[++i];
    if (value === undefined) throw new EvidenceBindingInputError(`Missing value for ${key}`);
    if (out.workRoot !== null) throw new EvidenceBindingInputError('Use --work exactly once');
    out.workRoot = path.resolve(value);
  }
  if (out.workRoot === null) throw new EvidenceBindingInputError('--work is required');
  if (!isDir(out.workRoot)) throw new EvidenceBindingInputError(`--work ${slash(out.workRoot)} is not a readable directory`);
  if (!fs.existsSync(path.join(out.workRoot, 'index.yaml')) && !fs.existsSync(path.join(out.workRoot, 'workspace.yaml'))) {
    throw new EvidenceBindingInputError(`--work ${slash(out.workRoot)} is not a .starciwork root (no index.yaml or workspace.yaml)`);
  }
  return out;
}

// ---------- source-change time, and which clock answered ----------

/** Whether `root` is inside a Git working tree at all; asked once per repository root. */
function gitRootOf(root, cache) {
  if (cache.has(root)) return cache.get(root);
  const probe = runGit(['rev-parse', '--show-toplevel'], {cwd: root});
  const answer = !probe.error && probe.status === 0 ? root : null;
  cache.set(root, answer);
  return answer;
}

/** The newest commit touching any of `relPaths`, optionally only those after `since`. */
function newestCommit(gitRoot, relPaths, since) {
  let best = null;
  const range = since ? [`${since}..HEAD`] : [];
  for (let i = 0; i < relPaths.length; i += GIT_PATHSPEC_CHUNK) {
    const chunk = relPaths.slice(i, i + GIT_PATHSPEC_CHUNK);
    const run = runGit(['log', '-1', '--format=%ct', '--name-only', ...range, '--', ...chunk], {cwd: gitRoot, maxBuffer: 16 * 1024 * 1024});
    if (run.error || run.status !== 0) continue;
    const lines = String(run.stdout ?? '').split('\n').map(line => line.trim()).filter(Boolean);
    const seconds = Number(lines[0]);
    if (!lines.length || !Number.isFinite(seconds)) continue;
    const at = seconds * 1000, file = lines[1] ?? chunk[0];
    if (!best || at > best.at) best = {at, path: slash(file)};
  }
  return best;
}

/**
 * When the source this record claims last moved, and by which clock - the answer says which, because the
 * three differ in what they can prove. A recorded `revision` is the record's own declared binding
 * (work-implementation.schema.yaml: "the commit the rest of this record is true at"), so commits after it
 * are drift by the tree's own definition. Failing that, a commit time is still the moment the code moved,
 * where a checkout's mtime is only the moment somebody cloned - so mtime answers last, and only where git
 * cannot.
 */
function newestSourceChange(repoRoot, relPaths, gitCache, revision) {
  if (!relPaths.length) return null;
  const gitRoot = gitRootOf(repoRoot, gitCache);
  if (gitRoot && revision) {
    const known = runGit(['cat-file', '-e', `${revision}^{commit}`], {cwd: gitRoot});
    if (!known.error && known.status === 0) {
      const after = newestCommit(gitRoot, relPaths, revision);
      // A commit after the revision the record pins IS the drift, whatever the capture clock says: the
      // revision is what the rest of the record was true at.
      return after ? {...after, afterRevision: true, method: `git commit time, after the record's own revision ${revision.slice(0, 12)}`} : null;
    }
  }
  const committed = gitRoot ? newestCommit(gitRoot, relPaths, null) : null;
  if (committed) return {...committed, method: 'git commit time'};
  let best = null;
  for (const rel of relPaths) {
    let stat;
    try { stat = fs.statSync(path.join(repoRoot, rel)); } catch { continue; }
    if (!best || stat.mtimeMs > best.at) best = {at: stat.mtimeMs, path: rel, method: 'file mtime'};
  }
  return best;
}

/**
 * Every file under the record's owner directories, keyed the way `codeDigest.files[].path` is keyed:
 * `<owner dir's declared rel>/<path inside it>`, which is what scripts/work/record-ownership.mjs's
 * `hashOwnedDirs` writes. A codeDigest path is therefore owner-relative, not repository-relative, and a
 * record whose owners span two repositories (a ui-screen proven by a frontend and a backend module) has
 * rows from both in one flat list with nothing but that key to tell them apart.
 */
function ownedIndex(dirs) {
  const index = new Map();
  for (const dir of dirs) {
    const repoRoot = repoRootBehind(dir);
    if (!isDir(dir.abs)) continue;
    for (const file of walk(dir.abs)) {
      const inside = slash(path.relative(dir.abs, file));
      if (inside.startsWith('..') || inside.split('/').some(segment => SKIP_DIRS.has(segment))) continue;
      index.set(`${slash(dir.rel)}/${inside}`, {abs: file, repoRoot, repoRel: slash(path.relative(repoRoot, file))});
    }
  }
  return index;
}

/** The root an owner directory sits in (the app root): its absolute path with its app-relative `rel` removed. */
function repoRootBehind(dir) {
  const tail = slash(dir.rel);
  const abs = slash(dir.abs);
  return abs.endsWith(`/${tail}`) ? abs.slice(0, abs.length - tail.length - 1) : abs;
}

/** Where a `codeDigest.files[].path` lands on disk: through the owner directory whose key prefixes it,
 * falling back to the app root for a row no owner claims. */
function resolveCodeDigestPath(rel, dirs, appRoot) {
  for (const dir of dirs) {
    const key = slash(dir.rel);
    if (sameOrUnder(rel, key)) {
      const inside = rel === key ? '' : rel.slice(key.length + 1);
      return {abs: inside ? path.join(dir.abs, inside) : dir.abs, repoRoot: repoRootBehind(dir)};
    }
  }
  return {abs: path.join(fallbackRoot, rel), repoRoot: fallbackRoot};
}

// ---------- the four bindings ----------

export function checkEvidenceBinding({workRoot}) {
  const findings = [];
  const add = (code, node, file, detail) => findings.push({code, node, path: slash(file), detail});
  const workspaceDoc = readWorkspace(workRoot);
  const records = loadRecords(workRoot, walk);
  const gitCache = new Map();
  // Every codeDigest path and owner path is app-relative (be/..., fe/...), so a row no owner claims resolves under the app root.
  const appRoot = appRootOf(workRoot);

  for (const [id, record] of [...records].sort((a, b) => a[0].localeCompare(b[0]))) {
    const data = record.data;
    if (data?.state !== 'done') continue;
    const shown = slash(path.relative(workRoot, path.join(record.dir, 'index.yaml')));

    // Bullet: proof, not assertion. The implementation schema's own vocabulary - kernel-observed against
    // authored-claim - is the only place the tree distinguishes a run from a sentence, so it is what is
    // read here, on every family that carries it.
    if (data.verificationSource === 'authored-claim' && !AUTHORED_BY_NATURE.has(record.schema)) {
      add('EVIDENCE_ASSERTED_NOT_OBSERVED', id, shown,
        `state: done rests on verificationSource: authored-claim, so nothing observed this record; ${record.schema} is not one of the authored-by-nature schemas (work/data@1, work/brand@1, work/policy-decision@1)`);
    }

    const evidenceFile = path.join(record.dir, 'evidence.yaml');
    if (!fs.existsSync(evidenceFile)) continue;
    let evidence;
    try { evidence = parseYaml(fs.readFileSync(evidenceFile, 'utf8')); }
    catch { throw new EvidenceBindingInputError(`Cannot parse ${slash(path.relative(workRoot, evidenceFile))}`); }
    if (!evidence || typeof evidence !== 'object') continue;
    // Evidence marked stale has already said it no longer describes the current product
    // (work-evidence.schema.yaml: expiry is a one-way door, and the manifest stays as history). Refusing
    // it for pointing at the past would punish the tree for being honest about it.
    if (evidence.stale === true) continue;

    const evidenceShown = slash(path.relative(workRoot, evidenceFile));
    const dirs = resolveOwnedDirs(id, record, records, workspaceDoc, workRoot);
    const owned = ownedIndex(dirs);
    const rows = list(evidence.codeDigest?.files).filter(row => row && typeof row.path === 'string');
    const proven = new Set();

    for (const row of rows) {
      const rel = slash(row.path);
      proven.add(rel);
      const found = owned.get(rel) ?? resolveCodeDigestPath(rel, dirs, appRoot);
      let stat;
      try { stat = fs.statSync(found.abs); } catch { stat = null; }
      if (!stat?.isFile()) {
        add('EVIDENCE_PATH_MISSING', id, `${evidenceShown}#codeDigest.files`,
          `the proof hashes ${rel}, and nothing is at ${slash(found.abs)} now`);
        continue;
      }
      if (typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256)) continue;
      const current = sha256File(found.abs);
      if (current !== row.sha256) {
        add('EVIDENCE_DIGEST_MISMATCH', id, `${evidenceShown}#codeDigest.files`,
          `${rel} was hashed ${row.sha256} when this was proven and hashes ${current} now`);
      }
    }

    // Freshness. A file the evidence pinned by digest and that still matches has not moved since the
    // capture, whatever its timestamps say; the question is only open for source this record claims and
    // the proof never hashed.
    if (record.schema !== 'work/implementation@1') continue;
    const capturedAt = Date.parse(evidence.provenance?.capturedAt ?? '');
    if (!Number.isFinite(capturedAt)) continue;
    const byRepo = new Map();
    for (const [key, entry] of owned) {
      if (proven.has(key)) continue;
      if (!byRepo.has(entry.repoRoot)) byRepo.set(entry.repoRoot, []);
      byRepo.get(entry.repoRoot).push(entry.repoRel);
    }
    let newest = null, unproven = 0;
    for (const [repoRoot, relPaths] of byRepo) {
      unproven += relPaths.length;
      const candidate = newestSourceChange(repoRoot, relPaths.sort(), gitCache, typeof data.revision === 'string' ? data.revision : null);
      if (candidate && (!newest || candidate.at > newest.at)) newest = candidate;
    }
    if (newest && (newest.afterRevision || newest.at > capturedAt)) {
      add('EVIDENCE_OLDER_THAN_SOURCE', id, `${evidenceShown}#provenance.capturedAt`,
        `captured ${new Date(capturedAt).toISOString()}, but ${newest.path} - one of ${unproven} owned file(s) this proof never hashed - last changed ${new Date(newest.at).toISOString()} by ${newest.method}`);
    }
  }

  findings.sort((a, b) => a.code.localeCompare(b.code) || a.node.localeCompare(b.node) || a.path.localeCompare(b.path));
  return findings;
}

// ---------- CLI ----------

/** Stable programmatic entry used by the public CLI. It never writes and never calls process.exit. */
export function checkEvidenceBindingMain(argv) {
  let input;
  try { input = parseArgs([...argv]); }
  catch (error) {
    if (error instanceof EvidenceBindingInputError) return {exitCode: 2, lines: [], error: error.message};
    throw error;
  }
  if (input.help) return {exitCode: 0, lines: [], help: HELP};
  try {
    const findings = checkEvidenceBinding(input);
    return {exitCode: findings.length ? 1 : 0, findings, json: input.json};
  } catch (error) {
    if (error instanceof EvidenceBindingInputError) return {exitCode: 2, lines: [], error: error.message};
    return {exitCode: 2, lines: [], error: `Cannot read the declared inputs: ${error.message}`};
  }
}

function print(result) {
  if (result.help) { process.stdout.write(`${result.help}\n`); process.exitCode = result.exitCode; return; }
  if (result.error) { process.stderr.write(`${result.error}\n${HELP}\n`); process.exitCode = result.exitCode; return; }
  const findings = result.findings ?? [];
  if (result.json) {
    process.stdout.write(`${JSON.stringify({findings}, null, 2)}\n`);
  } else {
    for (const finding of findings) process.stdout.write(`${finding.code}  ${finding.node}  ${finding.detail}\n`);
    const byCode = CODES.map(code => `${code}=${findings.filter(f => f.code === code).length}`).join(' ');
    process.stderr.write(`${findings.length} finding(s): ${byCode}\n`);
  }
  process.exitCode = result.exitCode;
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href) print(checkEvidenceBindingMain(process.argv.slice(2)));
