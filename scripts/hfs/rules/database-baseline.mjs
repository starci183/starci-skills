// R257: an archive is immutable history retired by one explicit active baseline.
import { lsTree } from '../../api/git/ls-tree.mjs';
import { show } from '../../api/git/show.mjs';
import { mergeBase } from '../../api/git/merge-base.mjs';
import { withoutGitLocalEnv } from '../../lib/git.mjs';
import { sameText } from '../../lib/same-text.mjs';
import { found, readText } from './read.mjs';
import { migrationStamp } from './database-migrations.mjs';
import { DB_BASELINE_SHAPE, DB_ARCHIVE_MUTATED, MIGRATIONS_DIR, MIGRATIONS_ARCHIVE_DIR } from './database-constants.mjs';

const ACTIVE = /^supabase\/migrations\/\d{14}_[^/]+\.sql$/;
const ARCHIVED = /^supabase\/migrations\/_archive\/\d{14}_[^/]+\.sql$/;
const stampOf = (file) => /(?:^|\/)(\d{14})_/.exec(file)?.[1] ?? null;

/** Header comments only: SQL literals and later comments cannot impersonate a baseline marker. */
export function baselineMarkers(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = [];
  for (const line of lines) {
    if (line.trim() && !/^\s*--/.test(line)) break;
    header.push(line);
  }
  return header.flatMap((line) => {
    const marker = /^\s*--\s*starci:baseline\s+(\d{14})\s*$/.exec(line);
    return marker ? [marker[1]] : [];
  });
}

function explicitRestamp(text, archiveBoundary, newStamp) {
  const header = String(text ?? '').split(/\r?\n/).findIndex((line) => line.trim() && !/^\s*--/.test(line));
  const lines = String(text ?? '').split(/\r?\n/).slice(0, header < 0 ? undefined : header);
  return lines.some((line) => {
    const marker = /^\s*--\s*starci:restamp\s+(\d{14})\s+(\d{14})\s*$/.exec(line);
    return marker && migrationStamp(marker[1]) !== null && marker[1] >= archiveBoundary && marker[2] === newStamp;
  });
}

/** Synchronous git seam: (args, {cwd}) -> {ok, stdout}; no diff or blob containing SQL is printed. */
function baselineGit(args, { cwd }) {
  const [verb, ...rest] = args;
  if (verb === 'merge-base') {
    const sha = mergeBase(cwd, rest[0], rest[1]);
    return { ok: sha !== null, stdout: sha ?? '' };
  }
  const result = (verb === 'ls-tree' ? lsTree : show)(rest, { cwd, env: withoutGitLocalEnv(process.env), maxBuffer: 64 * 1024 * 1024 });
  return { ok: !result.error && result.status === 0, stdout: String(result.stdout ?? '') };
}

function snapshot(repoRoot, git, base) {
  let revision = null;
  for (const ref of base ? [base] : ['origin/main', 'main']) {
    const result = git(['merge-base', 'HEAD', ref], { cwd: repoRoot });
    if (result?.ok && result.stdout.trim()) { revision = result.stdout.trim(); break; }
  }
  // An unconfigured repository still has a committed archive that must remain immutable.
  revision ??= 'HEAD';
  const result = git(['ls-tree', '-r', '--name-only', '-z', revision, '--', MIGRATIONS_DIR], { cwd: repoRoot });
  return result?.ok ? { revision, files: result.stdout.split('\0').filter(Boolean) } : null;
}

const oldText = (repoRoot, git, revision, file) => {
  const result = git(['show', `${revision}:./${file}`], { cwd: repoRoot });
  return result?.ok ? String(result.stdout) : null;
};

function shapeFindings(repoRoot, active, archived) {
  const marked = active.flatMap((file) => baselineMarkers(readText(repoRoot, file)).map((stamp) => ({ file, stamp })));
  if (!archived.length) return { findings: [], marked };
  const findings = [];
  if (marked.length !== 1) {
    findings.push(found(DB_BASELINE_SHAPE, MIGRATIONS_DIR, 'a nonempty _archive requires exactly one active -- starci:baseline <archived-last-stamp> header marker'));
    return { findings, marked };
  }
  const latest = archived.map(stampOf).filter(Boolean).sort((left, right) => left.localeCompare(right)).at(-1);
  const marker = marked[0];
  const current = stampOf(marker.file);
  if (!latest || marker.stamp !== latest || migrationStamp(marker.stamp) === null) {
    findings.push(found(DB_BASELINE_SHAPE, marker.file, 'the baseline header must identify the last valid archived migration stamp'));
  }
  if (!current || migrationStamp(current) === null || (latest && current <= latest && !explicitRestamp(readText(repoRoot, marker.file), latest, current))) {
    findings.push(found(DB_BASELINE_SHAPE, marker.file, 'the baseline stamp must follow the archive boundary, or document the exact boundary and replacement in a -- starci:restamp <old> <new> header'));
  }
  for (const file of archived) {
    if (!ARCHIVED.test(file) || migrationStamp(stampOf(file) ?? '') === null) findings.push(found(DB_BASELINE_SHAPE, file, 'archived migrations retain their original timestamped SQL filename'));
  }
  return { findings, marked };
}

function archiveFindings(repoRoot, current, archived, marked, prior, git) {
  if (!prior) return [];
  const findings = [];
  const oldFiles = new Set(prior.files);
  const newBaseline = marked.length === 1 && !oldFiles.has(marked[0].file);
  for (const file of prior.files.filter((entry) => entry.startsWith(`${MIGRATIONS_ARCHIVE_DIR}/`))) {
    if (!current.has(file) || !sameText(readText(repoRoot, file), oldText(repoRoot, git, prior.revision, file))) {
      findings.push(found(DB_ARCHIVE_MUTATED, file, 'an archived migration is immutable: restore its committed path and content'));
    }
  }
  for (const file of archived.filter((entry) => !oldFiles.has(entry))) {
    const source = `${MIGRATIONS_DIR}/${file.slice(MIGRATIONS_ARCHIVE_DIR.length + 1)}`;
    const moved = oldFiles.has(source) && !current.has(source);
    const unchanged = moved && sameText(readText(repoRoot, file), oldText(repoRoot, git, prior.revision, source));
    if (!newBaseline || !unchanged) {
      findings.push(found(DB_ARCHIVE_MUTATED, file, 'a new archive entry must move an existing active migration unchanged in the same diff that adds the marked baseline'));
    }
  }
  return findings;
}

/** A cutover may archive only unchanged, committed source files from the same history the finder judges. */
export function baselineSourceFindings({ repoRoot, files = [], all = files, git = baselineGit, base }) {
  const active = all.filter((file) => ACTIVE.test(file));
  const archived = all.filter((file) => file.startsWith(`${MIGRATIONS_ARCHIVE_DIR}/`));
  const prior = snapshot(repoRoot, git, base);
  if (!prior) return [found(DB_BASELINE_SHAPE, MIGRATIONS_DIR, 'a baseline cutover requires readable committed migration history')];
  const { findings, marked } = shapeFindings(repoRoot, active, archived);
  const current = new Set(all);
  findings.push(...archiveFindings(repoRoot, current, archived, marked, prior, git));
  const oldFiles = new Set(prior.files);
  for (const file of active) {
    if (!oldFiles.has(file) || !sameText(readText(repoRoot, file), oldText(repoRoot, git, prior.revision, file))) {
      findings.push(found(DB_ARCHIVE_MUTATED, file, 'baseline sources must be committed unchanged before they enter the archive'));
    }
  }
  for (const file of prior.files.filter((entry) => ACTIVE.test(entry))) {
    const retired = `${MIGRATIONS_ARCHIVE_DIR}/${file.slice(MIGRATIONS_DIR.length + 1)}`;
    if (!current.has(file) && !current.has(retired)) findings.push(found(DB_ARCHIVE_MUTATED, file, 'restore removed migration history before creating a baseline'));
  }
  return findings;
}

/** R257 content finder, synchronous in both editions; all paths judge cross-file cutovers even under --fast. */
export function databaseBaselineFindings({ repoRoot, files = [], all, repo, isRoot, inScope, base, git = baselineGit }) {
  if (isRoot === false || (repo?.edition && !['lite', 'full'].includes(repo.edition))) return [];
  const inventory = Array.isArray(all) ? all : files;
  const active = inventory.filter((file) => ACTIVE.test(file));
  const archived = inventory.filter((file) => file.startsWith(`${MIGRATIONS_ARCHIVE_DIR}/`));
  const { findings, marked } = shapeFindings(repoRoot, active, archived);
  findings.push(...archiveFindings(repoRoot, new Set(inventory), archived, marked, snapshot(repoRoot, git, base), git));
  return typeof inScope === 'function' ? findings.filter((finding) => inScope(finding.path) || finding.path === MIGRATIONS_DIR || inventory.some((file) => file.startsWith(`${MIGRATIONS_DIR}/`) && inScope(file))) : findings;
}
