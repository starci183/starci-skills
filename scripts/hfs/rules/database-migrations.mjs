// database-migrations.mjs - L02 migration name, UTC ordering and base-branch immutability checks. Git reads go
// through the runtime API call files, and specs may inject the same small runner contract used by database.mjs.
import { lsTree } from '../../api/git/ls-tree.mjs';
import { mergeBase } from '../../api/git/merge-base.mjs';
import { show } from '../../api/git/show.mjs';
import { withoutGitLocalEnv } from '../../lib/git.mjs';
import { eachInOrder, findInOrder } from '../../lib/in-order.mjs';
import { sameText } from '../../lib/same-text.mjs';
import { found, readText } from './read.mjs';
import { DB_MIGRATION_SHAPE, isActiveMigration, MIGRATIONS_ARCHIVE_DIR, MIGRATIONS_DIR } from './database-constants.mjs';
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
  const result = call(rest, { cwd, env, maxBuffer: 64 * 1024 * 1024 });
  return { ok: !result.error && result.status === 0, stdout: result.stdout };
}

const runGit = (git, repoRoot, args) => Promise.resolve(git(args, { cwd: repoRoot }))
  .then((result) => ({ ok: result?.ok === true, stdout: String(result?.stdout ?? '') }));

async function baseShaOf(git, repoRoot, base) {
  let found = null;
  await findInOrder(base ? [base] : ['origin/main', 'main'], async (ref) => {
    const result = await runGit(git, repoRoot, ['merge-base', 'HEAD', ref]);
    if (result.ok && result.stdout.trim()) found = { ref, sha: result.stdout.trim() };
    return found !== null;
  });
  return found;
}

async function migrationFilesAt(git, repoRoot, sha) {
  const result = await runGit(git, repoRoot, ['ls-tree', '-r', '--name-only', '-z', sha, '--', MIGRATIONS_DIR]);
  if (!result.ok) return [];
  const prefix = `${MIGRATIONS_DIR}/`;
  return result.stdout.split('\0').filter((entry) => entry.startsWith(prefix));
}

async function baseFileText(git, repoRoot, sha, file) {
  // `./` reads the path from the app root, which is a folder of a larger repository when the app is nested in one (an example of the runtime).
  const result = await runGit(git, repoRoot, ['show', `${sha}:./${file}`]);
  return result.ok ? result.stdout : null;
}

function localMigrationFindings(local) {
  const findings = [];
  const stamps = new Map();
  for (const entry of local) {
    if (!entry.match) {
      findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} is not named <ts14>_<kebab>.sql; a migration is created by \`npm run db:new\` (supabase migration new), never renamed by hand`, { expected: '<ts14>_<kebab>.sql' }));
      continue;
    }
    const stamp = migrationStamp(entry.match[1]);
    if (stamp === null) {
      findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} carries ${entry.match[1]}, which is no valid UTC time; a migration stamp must name a valid UTC instant`, { stamp: entry.match[1] }));
      continue;
    }
    if (stamps.has(stamp)) findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} shares stamp ${entry.match[1]} with ${stamps.get(stamp)}; stamps are strictly increasing`, { stamp: entry.match[1], other: stamps.get(stamp) }));
    stamps.set(stamp, entry.file);
  }
  return findings;
}

/** HEAD owns the append boundary. Archived names retire the old chain, so a replacement baseline starts afresh. */
function migrationHistory(files, retired, localNames) {
  const prefix = `${MIGRATIONS_DIR}/`;
  const onHead = new Set(files.filter(isActiveMigration).map((file) => file.slice(prefix.length)));
  const retiredNames = new Set([...retired, ...files.filter((file) => file.startsWith(`${MIGRATIONS_ARCHIVE_DIR}/`)).map((file) => file.slice(MIGRATIONS_ARCHIVE_DIR.length + 1))].filter((name) => !localNames.has(name)));
  const stamps = [...onHead].filter((name) => !retiredNames.has(name)).map((name) => MIGRATION_NAME.exec(name)?.[1]).filter(Boolean).map(migrationStamp).filter((stamp) => stamp !== null);
  return { onHead, latest: stamps.length ? Math.max(...stamps) : null };
}

function migrationOrderingFindings(local, history) {
  return local.flatMap((entry) => {
    const stamp = entry.match ? migrationStamp(entry.match[1]) : null;
    if (history.onHead.has(entry.name) || stamp === null || history.latest === null || stamp > history.latest) return [];
    return [found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} is stamped ${entry.match[1]}, not after every migration already in repository history (latest active ${new Date(history.latest).toISOString()}); a new migration sorts after the committed active chain`, { stamp: entry.match[1], latest: new Date(history.latest).toISOString() })];
  });
}

async function baseMigrationEntryFindings(entry, repoRoot, git, baseSha, onBase) {
  if (!entry.match) return [];
  if (onBase.has(entry.name)) {
    const committed = await baseFileText(git, repoRoot, baseSha.sha, entry.file);
    const current = readText(repoRoot, entry.file);
    if (!sameText(current, committed)) return [found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} differs from its content on ${baseSha.ref}; a migration on the base branch is immutable - write a new migration`, { base: baseSha.ref })];
  }
  return [];
}

function removedMigrationFindings(local, retired, baseNames, baseSha) {
  const findings = [];
  for (const name of baseNames) {
    if (!local.some((entry) => entry.name === name) && !retired.has(name)) findings.push(found(DB_MIGRATION_SHAPE, `${MIGRATIONS_DIR}/${name}`, `${MIGRATIONS_DIR}/${name} exists on ${baseSha.ref} but is gone here; a migration on the base branch is immutable - restore it`, { base: baseSha.ref }));
  }
  return findings;
}

/**
 * L02 findings for names, stamps, ordering and immutability of supabase/migrations/*.sql. `archived` are the files of
 * supabase/migrations/_archive/ (app.supabase.migrations.archive): never judged, and a migration moved there at a baseline
 * cutover is retired from the ordering chain, not removed. New files append after HEAD's active migrations; timestamps
 * on archived migrations, remote branches and the wall clock do not constrain a replacement baseline.
 */
export async function migrationShapeFindings({ repoRoot, migrations, archived = [], git, base }) {
  const prefix = `${MIGRATIONS_DIR}/`;
  const local = migrations.map((file) => {
    const name = file.startsWith(prefix) ? file.slice(prefix.length) : file;
    return { file, name, match: MIGRATION_NAME.exec(name) };
  });
  const findings = localMigrationFindings(local);
  const retired = new Set(archived.map((file) => file.slice(MIGRATIONS_ARCHIVE_DIR.length + 1)));
  const history = migrationHistory(await migrationFilesAt(git, repoRoot, 'HEAD'), retired, new Set(local.map((entry) => entry.name)));
  findings.push(...migrationOrderingFindings(local, history));
  const baseSha = await baseShaOf(git, repoRoot, base);
  if (!baseSha) return findings;
  const baseNames = (await migrationFilesAt(git, repoRoot, baseSha.sha)).filter(isActiveMigration).map((file) => file.slice(prefix.length));
  const onBase = new Set(baseNames);
  await eachInOrder(local, async (entry) => {
    findings.push(...await baseMigrationEntryFindings(entry, repoRoot, git, baseSha, onBase));
  });
  findings.push(...removedMigrationFindings(local, retired, baseNames, baseSha));
  return findings;
}
