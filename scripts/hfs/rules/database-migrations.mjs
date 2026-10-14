// database-migrations.mjs - L02 migration name, UTC ordering and base-branch immutability checks. Git reads go
// through the runtime API call files, and specs may inject the same small runner contract used by database.mjs.
import { lsTree } from '../../api/git/ls-tree.mjs';
import { mergeBase } from '../../api/git/merge-base.mjs';
import { show } from '../../api/git/show.mjs';
import { withoutGitLocalEnv } from '../../lib/git.mjs';
import { eachInOrder, findInOrder } from '../../lib/in-order.mjs';
import { sameText } from '../../lib/same-text.mjs';
import { found, readText } from './read.mjs';
import { DB_MIGRATION_DESTRUCTIVE, DB_MIGRATION_SHAPE, isActiveMigration, MIGRATIONS_ARCHIVE_DIR, MIGRATIONS_DIR } from './database-constants.mjs';
import ts from 'typescript';
const MIGRATION_NAME = /^(\d{14})_([a-z0-9]+(?:-[a-z0-9]+)*|contract_[a-z0-9]+(?:[-_][a-z0-9]+)*|[a-z0-9]+(?:-[a-z0-9]+)*_contract_[a-z0-9]+(?:[-_][a-z0-9]+)*)\.sql$/;
export const isMigrationName = (name) => MIGRATION_NAME.test(name);
const RESTAMP_HEADER = /^-- starci:restamp (\d{14}) (\d{14})(?:\r?\n|$)/;
const withoutRestampHeader = (text) => text?.replace(RESTAMP_HEADER, '') ?? null;

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

function migrationOrderingFindings(local, history, restamped = new Set()) {
  return local.flatMap((entry) => {
    const stamp = entry.match ? migrationStamp(entry.match[1]) : null;
    if (history.onHead.has(entry.name) || restamped.has(entry.name) || stamp === null || history.latest === null || stamp > history.latest) return [];
    return [found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} is stamped ${entry.match[1]}, not after every migration already in repository history (latest active ${new Date(history.latest).toISOString()}); a new migration sorts after the committed active chain`, { stamp: entry.match[1], latest: new Date(history.latest).toISOString() })];
  });
}

/** A restamp changes only the version, and its header proves the explicit old->new map against repository SQL. */
async function verifiedRestamps(local, files, repoRoot, git, sha) {
  const prefix = `${MIGRATIONS_DIR}/`;
  const active = files.filter(isActiveMigration).map((file) => file.slice(prefix.length));
  const claims = local.map((entry) => ({ ...entry, header: RESTAMP_HEADER.exec(readText(repoRoot, entry.file) ?? '') })).filter((entry) => entry.header);
  const accepted = [];
  await eachInOrder(claims, async (entry) => {
    const [, oldStamp, newStamp] = entry.header;
    if (!entry.match || entry.match[1] !== newStamp || migrationStamp(oldStamp) === null || oldStamp === newStamp) return;
    if (claims.filter((claim) => claim.header[1] === oldStamp).length !== 1) return;
    const names = active.filter((name) => name.startsWith(`${oldStamp}_`) && name.slice(14) === entry.name.slice(14));
    if (names.length !== 1 || local.some((candidate) => candidate.name === names[0])) return;
    const committed = await baseFileText(git, repoRoot, sha, `${prefix}${names[0]}`);
    if (committed === null || !sameText(withoutRestampHeader(readText(repoRoot, entry.file)), withoutRestampHeader(committed))) return;
    accepted.push({ source: names[0], destination: entry.name });
  });
  return accepted;
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
  const headFiles = await migrationFilesAt(git, repoRoot, 'HEAD');
  const baseSha = await baseShaOf(git, repoRoot, base);
  const baseFiles = baseSha ? await migrationFilesAt(git, repoRoot, baseSha.sha) : [];
  const restamps = await verifiedRestamps(local, baseSha ? baseFiles : headFiles, repoRoot, git, baseSha?.sha ?? 'HEAD');
  for (const restamp of restamps) retired.add(restamp.source);
  const history = migrationHistory(headFiles, retired, new Set(local.map((entry) => entry.name)));
  findings.push(...migrationOrderingFindings(local, history, new Set(restamps.map((entry) => entry.destination))));
  if (!baseSha) return findings;
  const baseNames = baseFiles.filter(isActiveMigration).map((file) => file.slice(prefix.length));
  const onBase = new Set(baseNames);
  await eachInOrder(local, async (entry) => {
    findings.push(...await baseMigrationEntryFindings(entry, repoRoot, git, baseSha, onBase));
  });
  findings.push(...removedMigrationFindings(local, retired, baseNames, baseSha));
  return findings;
}

const sqlName = (token) => token && ['word', 'ident'].includes(token.t) ? token.v : null;
const sqlWord = (token, value) => token?.t === 'word' && token.v === value;

function commentEnd(text, start) {
  if (text.startsWith('--', start)) {
    const end = text.indexOf('\n', start + 2);
    return end === -1 ? text.length : end;
  }
  if (!text.startsWith('/*', start)) return null;
  let depth = 1;
  let index = start + 2;
  while (index < text.length && depth > 0) {
    if (text.startsWith('/*', index)) { depth += 1; index += 2; }
    else if (text.startsWith('*/', index)) { depth -= 1; index += 2; }
    else index += 1;
  }
  return index;
}

function quotedToken(text, start, quote, escaped = false) {
  let index = start + 1;
  let value = '';
  while (index < text.length) {
    if (text[index] === quote && text[index + 1] === quote) { value += quote; index += 2; }
    else if (text[index] === quote) return { value, end: index + 1 };
    else if (escaped && text[index] === '\\') { value += text[index + 1] ?? ''; index += 2; }
    else { value += text[index]; index += 1; }
  }
  return { value, end: index };
}

function sqlTokenAt(text, index) {
  const char = text[index];
  if (char === "'" || char === '"') {
    const token = quotedToken(text, index, char);
    return { t: char === '"' ? 'ident' : 'string', v: token.value, end: token.end };
  }
  if (/[eE]/.test(char) && text[index + 1] === "'") {
    const token = quotedToken(text, index + 1, "'", true);
    return { t: 'string', v: token.value, end: token.end };
  }
  const tag = char === '$' ? /^\$(?:[A-Za-z_]\w*)?\$/.exec(text.slice(index))?.[0] : null;
  if (tag) {
    const end = text.indexOf(tag, index + tag.length);
    return { t: 'body', v: text.slice(index + tag.length, end === -1 ? text.length : end), end: end === -1 ? text.length : end + tag.length };
  }
  const word = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(text.slice(index))?.[0];
  if (word) return { t: 'word', v: word.toLowerCase(), end: index + word.length };
  const number = /^\d+(?:\.\d+)?/.exec(text.slice(index))?.[0];
  if (number) return { t: 'number', v: number, end: index + number.length };
  return { t: 'punct', v: char, end: index + 1 };
}

/** Synchronous SQL tokens; literal values stay internal and must never be copied to a finding. */
export function databaseSqlTokens(text) {
  const tokens = [];
  let index = 0;
  let line = 1;
  while (index < text.length) {
    if (/\s/.test(text[index])) { if (text[index] === '\n') line += 1; index += 1; continue; }
    const end = commentEnd(text, index);
    if (end !== null) { line += text.slice(index, end).split('\n').length - 1; index = end; continue; }
    const token = sqlTokenAt(text, index);
    tokens.push({ t: token.t, v: token.v, line, index });
    line += text.slice(index, token.end).split('\n').length - 1;
    index = token.end;
  }
  return tokens;
}

/** Split executable SQL, retaining function bodies as opaque tokens until their language is known. */
export function databaseSqlStatements(tokens) {
  const statements = [];
  let current = [];
  for (const token of tokens) {
    if (token.t === 'punct' && token.v === ';') { if (current.length) statements.push(current); current = []; }
    else current.push(token);
  }
  if (current.length) statements.push(current);
  return statements;
}

function executableStatementTokens(statement, depth) {
  const isDo = sqlWord(statement[0], 'do');
  const functionAt = statement.findIndex((token) => sqlWord(token, 'function') || sqlWord(token, 'procedure'));
  const isFunction = sqlWord(statement[0], 'create') && functionAt > 0 && functionAt < 4;
  if (!isDo && !isFunction) return statement;
  const languageAt = statement.findIndex((token) => sqlWord(token, 'language'));
  const language = statement[languageAt + 1]?.v ?? 'sql';
  if (languageAt !== -1 && !['sql', 'plpgsql'].includes(language)) return statement;
  return statement.flatMap((token, index) => {
    const body = token.t === 'body' || (token.t === 'string' && (isDo || sqlWord(statement[index - 1], 'as')));
    if (!body) return [token];
    return databaseExecutableTokens(token.v, depth + 1).map((child) => ({ ...child, line: child.line + token.line - 1 }));
  });
}

/** SQL and PL/pgSQL bodies are scanned; comments, data literals and other function languages are opaque. */
export function databaseExecutableTokens(text, depth = 0) {
  const tokens = databaseSqlTokens(text);
  if (depth > 8) return tokens;
  return databaseSqlStatements(tokens).flatMap((statement) => [...executableStatementTokens(statement, depth), { t: 'punct', v: ';' }]);
}

function nameAt(tokens, index) {
  const first = sqlName(tokens[index]);
  if (first === null) return null;
  const parts = [first];
  let next = index + 1;
  while (tokens[next]?.v === '.' && sqlName(tokens[next + 1]) !== null) { parts.push(sqlName(tokens[next + 1])); next += 2; }
  return { name: parts.join('.'), leaf: parts.at(-1), next };
}

const skipWords = (tokens, index, words) => {
  let next = index;
  while (words.some((word) => sqlWord(tokens[next], word))) next += 1;
  return next;
};

function dropObjects(tokens, start) {
  const kind = tokens[start + 1]?.v;
  if (!['table', 'role', 'user', 'schema', 'type', 'view', 'materialized', 'sequence', 'function', 'procedure', 'index', 'policy', 'trigger'].includes(kind)) return [];
  let index = skipWords(tokens, start + 2, ['view', 'if', 'exists', 'concurrently']);
  const objects = [];
  while (index < tokens.length) {
    const object = nameAt(tokens, index);
    if (!object) break;
    objects.push({ ...object, kind, line: tokens[start].line });
    if (tokens[object.next]?.v !== ',') break;
    index = object.next + 1;
  }
  return objects;
}

function columnAlterObject(tokens, index, table, line) {
  let next = index + 1;
  if (sqlWord(tokens[next], 'column')) next += 1;
  const column = nameAt(tokens, next);
  if (!column) return null;
  const tail = tokens.slice(column.next);
  const type = sqlWord(tail[0], 'type') || (sqlWord(tail[0], 'set') && sqlWord(tail[1], 'data') && sqlWord(tail[2], 'type'));
  const notNull = sqlWord(tail[0], 'set') && sqlWord(tail[1], 'not') && sqlWord(tail[2], 'null');
  const defaultSet = tokens.some((token, at) => sqlWord(token, 'alter') && sqlName(tokens[at + 1 + Number(sqlWord(tokens[at + 1], 'column'))]) === column.leaf
    && sqlWord(tokens[at + 2 + Number(sqlWord(tokens[at + 1], 'column'))], 'set') && sqlWord(tokens[at + 3 + Number(sqlWord(tokens[at + 1], 'column'))], 'default'));
  if (!type && !(notNull && !defaultSet)) return null;
  return { name: `${table.name}.${column.name}`, leaf: column.leaf, table: table.leaf, kind: 'column', line };
}

function alteredColumn(table, column, line) {
  return { name: `${table.name}.${column.name}`, leaf: column.leaf, table: table.leaf, kind: 'column', line };
}

function tableActionObject(body, index, table, line) {
  if (sqlWord(body[index], 'drop')) {
    const at = skipWords(body, index + 1, ['column', 'constraint', 'if', 'exists']);
    if (sqlWord(body[at], 'default') || sqlWord(body[at], 'not')) return null;
    const column = nameAt(body, at);
    return column ? alteredColumn(table, column, line) : null;
  }
  if (sqlWord(body[index], 'rename')) {
    const column = sqlWord(body[index + 1], 'column') ? nameAt(body, index + 2) : null;
    return column ? alteredColumn(table, column, line) : { ...table, kind: 'table', line };
  }
  return sqlWord(body[index], 'alter') ? columnAlterObject(body, index, table, line) : null;
}

function alterObjects(tokens, start) {
  const table = nameAt(tokens, skipWords(tokens, start + 2, ['if', 'exists', 'only']));
  if (!table) return [];
  const body = tokens.slice(table.next);
  return body.map((token, index) => tableActionObject(body, index, table, tokens[start].line)).filter(Boolean);
}

function truncatedObjects(tokens, start) {
  const objects = [];
  let index = skipWords(tokens, start + 1, ['table', 'only']);
  while (index < tokens.length) {
    const table = nameAt(tokens, index);
    if (!table) break;
    objects.push({ ...table, kind: 'table', line: tokens[start].line });
    if (tokens[table.next]?.v !== ',') break;
    index = skipWords(tokens, table.next + 1, ['only']);
  }
  return objects;
}

function destructiveObjects(statement) {
  const objects = [];
  for (let index = 0; index < statement.length; index += 1) {
    if (sqlWord(statement[index], 'drop')) objects.push(...dropObjects(statement, index));
    else if (sqlWord(statement[index], 'truncate')) objects.push(...truncatedObjects(statement, index));
    else if (sqlWord(statement[index], 'alter') && sqlWord(statement[index + 1], 'table')) objects.push(...alterObjects(statement, index));
    else if (sqlWord(statement[index], 'alter') && ['type', 'schema', 'view', 'sequence', 'function', 'procedure', 'index'].includes(statement[index + 1]?.v)) {
      const object = nameAt(statement, index + 2);
      if (object && statement.slice(object.next).some((token) => sqlWord(token, 'rename'))) objects.push({ ...object, kind: statement[index + 1].v, line: statement[index].line });
    }
  }
  return objects;
}

function sourceNames(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const names = new Set();
  const addSql = (sql) => { for (const token of databaseSqlTokens(sql)) if (sqlName(token) !== null) names.add(token.v); };
  const visit = (node) => {
    if (ts.isStringLiteralLike(node)) addSql(node.text);
    if (ts.isTemplateExpression(node)) { addSql(node.head.text); for (const span of node.templateSpans) addSql(span.literal.text); }
    if (/\.entity\.[cm]?tsx?$/.test(file) && ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

function destructiveObjectFinding(file, object, contract, references) {
  const reference = references.find(({ names }) => names.has(object.leaf));
  if (contract && !reference) return null;
  const reason = reference && contract ? `${reference.file} still references this object; remove the reference before the contract migration`
    : 'use a *_contract_* migration after the application stops using this object';
  return found(DB_MIGRATION_DESTRUCTIVE, file, `${file}:${object.line} destructively changes ${object.name}; ${reason}`,
    { line: object.line, object: object.name, ...(reference ? { reference: reference.file } : {}) });
}

function destructiveFileFindings(file, text, references) {
  const contract = /_contract_[a-z0-9]+(?:[-_][a-z0-9]+)*\.sql$/.test(file);
  const seen = new Set();
  const objects = databaseSqlStatements(databaseExecutableTokens(text)).flatMap(destructiveObjects);
  return objects.flatMap((object) => {
    const key = `${object.line}:${object.name}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const finding = destructiveObjectFinding(file, object, contract, references);
    return finding ? [finding] : [];
  });
}

/** Destructive changes require a contract migration and no remaining SQL/entity reference in be/src. */
export function destructiveMigrationFindings({ repoRoot, migrations, files }) {
  const references = files.filter((file) => /^be\/src\/.+\.(?:sql|entity)\.[cm]?tsx?$/.test(file))
    .map((file) => ({ file, names: sourceNames(readText(repoRoot, file) ?? '', file) }));
  return migrations.flatMap((file) => {
    const text = readText(repoRoot, file);
    return text === null ? [] : destructiveFileFindings(file, text, references);
  });
}
