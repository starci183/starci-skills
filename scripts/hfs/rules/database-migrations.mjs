// database-migrations.mjs - L02 migration name, UTC ordering and base-branch immutability checks. Git reads go
// through the runtime API call files, and specs may inject the same small runner contract used by database.mjs.
import { lsTree } from '../../api/git/ls-tree.mjs';
import { log } from '../../api/git/log.mjs';
import { mergeBase } from '../../api/git/merge-base.mjs';
import { show } from '../../api/git/show.mjs';
import { withoutGitLocalEnv } from '../../lib/git.mjs';
import { sameText } from '../../lib/same-text.mjs';
import { found, readText } from './read.mjs';
import { DB_MIGRATION_SHAPE, MIGRATIONS_DIR } from './database-constants.mjs';
const MIGRATION_NAME = /^(\d{14})_([a-z0-9]+(?:-[a-z0-9]+)*)\.sql$/;

/** `<ts14>` -> the UTC instant it names, or null when the digits are no real time (month 13, day 32, ...). */
export function migrationStamp(text) {
  const [year, month, day, hour, minute, second] = [Number(text.slice(0, 4)), ...[4, 6, 8, 10, 12].map((at) => Number(text.slice(at, at + 2)))];
  const stamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(stamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second ? stamp : null;
}

/** The three git reads L02 makes: (args, {cwd}) -> {ok, stdout}. */
export function defaultGit(args, { cwd }) {
  const [verb, ...rest] = args;
  const env = withoutGitLocalEnv(process.env);
  if (verb === 'merge-base') { const sha = mergeBase(cwd, rest[0], rest[1]); return { ok: sha !== null, stdout: sha ?? '' }; }
  let call = show;
  if (verb === 'ls-tree') call = lsTree;
  else if (verb === 'log') call = log;
  const result = call(rest, { cwd, env, maxBuffer: 64 * 1024 * 1024 });
  return { ok: !result.error && result.status === 0, stdout: result.stdout };
}

const runGit = (git, repoRoot, args) => Promise.resolve(git(args, { cwd: repoRoot }))
  .then((result) => ({ ok: result?.ok === true, stdout: String(result?.stdout ?? '') }));

async function baseShaOf(git, repoRoot, base) {
  for (const ref of base ? [base] : ['origin/main', 'main']) {
    const result = await runGit(git, repoRoot, ['merge-base', 'HEAD', ref]);
    if (result.ok && result.stdout.trim()) return { ref, sha: result.stdout.trim() };
  }
  return null;
}

async function baseMigrationNames(git, repoRoot, sha) {
  const result = await runGit(git, repoRoot, ['ls-tree', '-r', '--name-only', '-z', sha, '--', MIGRATIONS_DIR]);
  if (!result.ok) return [];
  const prefix = `${MIGRATIONS_DIR}/`;
  return result.stdout.split('\0').filter(Boolean).map((entry) => (entry.startsWith(prefix) ? entry.slice(prefix.length) : entry));
}

async function baseFileText(git, repoRoot, sha, file) {
  const result = await runGit(git, repoRoot, ['show', `${sha}:${file}`]);
  return result.ok ? result.stdout : null;
}

async function migrationTimeLimit(git, repoRoot, file, now) {
  const result = await runGit(git, repoRoot, ['log', '-1', '--format=%ct', '--', file]);
  const seconds = Number(result.stdout.trim());
  if (result.ok && Number.isFinite(seconds) && seconds > 0) return { at: seconds * 1000, tracked: true };
  return { at: now(), tracked: false };
}

async function localMigrationFindings(local, repoRoot, git, now) {
  const findings = [];
  const stamps = new Map();
  for (const entry of local) {
    if (!entry.match) {
      findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} is not named <ts14>_<kebab>.sql; a migration is created by \`npm run db:new\` (supabase migration new), never renamed by hand`, { expected: '<ts14>_<kebab>.sql' }));
      continue;
    }
    const stamp = migrationStamp(entry.match[1]);
    if (stamp === null) {
      findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} carries ${entry.match[1]}, which is no valid UTC time; the stamp is the real creation time`, { stamp: entry.match[1] }));
      continue;
    }
    const limit = await migrationTimeLimit(git, repoRoot, entry.file, now);
    if (stamp > limit.at) {
      const boundary = limit.tracked ? `the file's commit time ${new Date(limit.at).toISOString()}` : `the current time ${new Date(limit.at).toISOString()}`;
      findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} is stamped ${entry.match[1]}, in the future relative to ${boundary}; a migration stamp is its real creation time, never a hand-picked date`, { stamp: entry.match[1], tracked: limit.tracked }));
    }
    if (stamps.has(stamp)) findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} shares stamp ${entry.match[1]} with ${stamps.get(stamp)}; stamps are strictly increasing`, { stamp: entry.match[1], other: stamps.get(stamp) }));
    stamps.set(stamp, entry.file);
  }
  return findings;
}

async function baseMigrationEntryFindings(entry, repoRoot, git, baseSha, onBase, baseMax) {
  if (!entry.match) return [];
  const stamp = migrationStamp(entry.match[1]);
  if (onBase.has(entry.name)) {
    const committed = await baseFileText(git, repoRoot, baseSha.sha, entry.file);
    const current = readText(repoRoot, entry.file);
    if (!sameText(current, committed)) return [found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} differs from its content on ${baseSha.ref}; a migration on the base branch is immutable - write a new migration`, { base: baseSha.ref })];
  } else if (baseMax !== null && stamp !== null && stamp <= baseMax) {
    return [found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} is stamped ${entry.match[1]}, not after every migration on ${baseSha.ref} (latest ${String(new Date(baseMax).toISOString())}); a new migration sorts after the base ones`, { stamp: entry.match[1], base: baseSha.ref })];
  }
  return [];
}

function removedMigrationFindings(local, baseNames, baseSha) {
  const findings = [];
  for (const name of baseNames) {
    if (!local.some((entry) => entry.name === name)) findings.push(found(DB_MIGRATION_SHAPE, `${MIGRATIONS_DIR}/${name}`, `${MIGRATIONS_DIR}/${name} exists on ${baseSha.ref} but is gone here; a migration on the base branch is immutable - restore it`, { base: baseSha.ref }));
  }
  return findings;
}

/** L02 findings for names, stamps, ordering and immutability of supabase/migrations/*.sql. */
export async function migrationShapeFindings({ repoRoot, migrations, git, base, now }) {
  const prefix = `${MIGRATIONS_DIR}/`;
  const local = migrations.map((file) => {
    const name = file.startsWith(prefix) ? file.slice(prefix.length) : file;
    return { file, name, match: MIGRATION_NAME.exec(name) };
  });
  const findings = await localMigrationFindings(local, repoRoot, git, now);
  const baseSha = await baseShaOf(git, repoRoot, base);
  if (!baseSha) return findings;
  const baseNames = await baseMigrationNames(git, repoRoot, baseSha.sha);
  const onBase = new Set(baseNames);
  const baseStamps = baseNames.map((name) => MIGRATION_NAME.exec(name)?.[1]).filter(Boolean).map(migrationStamp).filter((stamp) => stamp !== null);
  const baseMax = baseStamps.length ? Math.max(...baseStamps) : null;
  for (const entry of local) findings.push(...await baseMigrationEntryFindings(entry, repoRoot, git, baseSha, onBase, baseMax));
  findings.push(...removedMigrationFindings(local, baseNames, baseSha));
  return findings;
}
