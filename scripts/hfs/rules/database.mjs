// database.mjs - the Supabase rules of the lite edition (design 4.2, provisional ids L02-L09), judged on the real
// PostgreSQL AST of each file (scripts/hfs/sql/pg-parse.mjs over the WASM build of libpg-query), never on a regex
// over the SQL text. Judged paths, app-relative at the app root:
//   supabase/migrations/<ts14>_<kebab>.sql   L02-L07
//   supabase/config.toml                     L08 (TOML through smol-toml, lazy)
//   supabase/types/database.types.ts         L09 (the emitted text is injected; this module starts no Docker)
//   DB_MIGRATION_SHAPE  (L02) a migration file is named <ts14>_<kebab>.sql, the stamp a valid UTC instant not in
//                           the future; a migration new against the merge-base sorts after every migration on the
//                           base; a migration on the base is byte-identical to it (diff is a finding, removal too).
//                           No merge-base with origin/main or main: ordering and immutability are not judged.
//   DB_RLS_REQUIRED     (L03) every create table (or create table as) in an exposed schema (public plus the
//                           config.toml [api] schemas) is followed in the same migration by
//                           `alter table <t> enable row level security`; a table named in the hfs.json
//                           supabase.forceRls list also gets `force row level security`. Partition children and
//                           temp tables are exempt.
//   DB_DYNAMIC_DDL      (L04) no dynamic SQL builds DDL: every plpgsql EXECUTE, dynamic FOR and dynamic OPEN (in a
//                           DO block or a function body) whose source literals contain create/alter/drop
//                           table|policy|function or grant|revoke, and every dynamic statement the parser cannot
//                           read at all, is a finding - the AST must see every statement a migration runs.
//   DB_POLICY_SHAPE     (L05) a write or FOR ALL policy never uses using (true) / with check (true); to anon or
//                           to public is legal only on FOR SELECT with a name ending _public_read, and a SELECT
//                           policy with using (true) must carry that suffix; every policy is named
//                           <table>_<role>_<action>; no grant to anon/public on a table without a _public_read
//                           select policy; a grant to service_role is never written.
//   DB_DEFINER_SAFE     (L06) a security definer function pins its search_path (a `set search_path = ...` option
//                           of literals, on the create or a same-migration alter function), lives outside the
//                           exposed schemas or is `revoke execute ... from public` in the same migration, declares
//                           a return type, and builds no dynamic SQL but format() templates interpolating only
//                           through %I/%L.
//   DB_STORAGE_POLICY   (L07) a bucket inserted into storage.buckets declares public (true only for an id ending
//                           _public), file_size_limit and allowed_mime_types, and a storage.objects policy naming
//                           its bucket_id lives in the same migration.
//   DB_CONFIG_POLICY    (L08) config.toml carries no literal value under a credential key (any leaf key named or
//                           ending secret|password|token|client_id, or ending _key that is not anon/publishable/
//                           public): the value is env(NAME). auth.jwt_expiry is <= 3600; auth.enable_signup,
//                           auth.email.enable_signup, auth.site_url and auth.additional_redirect_urls equal the
//                           hfs.json `supabase` block ({enableSignup, jwtExpiry, siteUrl, redirectUrls}) when the
//                           block declares them - the config states nothing the app did not declare.
//   DB_TYPES_DRIFT      (L09) the committed database.types.ts equals the text `emitTypes()` regenerates now; the
//                           emit is injected (chunk E wires it to contract:emit) and the rule is silent without it.
import { lsTree } from '../../api/git/ls-tree.mjs';
import { mergeBase } from '../../api/git/merge-base.mjs';
import { show } from '../../api/git/show.mjs';
import { withoutGitLocalEnv } from '../../lib/git.mjs';
import { found, readJson, readText } from './read.mjs';
import { parsePlpgsqlBody, parseSql } from '../sql/pg-parse.mjs';

export const DB_MIGRATION_SHAPE = 'DB_MIGRATION_SHAPE';
export const DB_RLS_REQUIRED = 'DB_RLS_REQUIRED';
export const DB_DYNAMIC_DDL = 'DB_DYNAMIC_DDL';
export const DB_POLICY_SHAPE = 'DB_POLICY_SHAPE';
export const DB_DEFINER_SAFE = 'DB_DEFINER_SAFE';
export const DB_STORAGE_POLICY = 'DB_STORAGE_POLICY';
export const DB_CONFIG_POLICY = 'DB_CONFIG_POLICY';
export const DB_TYPES_DRIFT = 'DB_TYPES_DRIFT';

export const MIGRATIONS_DIR = 'supabase/migrations';
export const CONFIG_FILE = 'supabase/config.toml';
export const TYPES_FILE = 'supabase/types/database.types.ts';

const MIGRATION_NAME = /^(\d{14})_([a-z0-9]+(?:-[a-z0-9]+)*)\.sql$/;
const POLICY_ACTIONS = ['select', 'insert', 'update', 'delete', 'all'];
const WRITE_COMMANDS = new Set(['all', 'insert', 'update', 'delete']);
const PUBLIC_READ_SUFFIX = '_public_read';
const ENV_REF = /^env\([A-Za-z_][A-Za-z0-9_]*\)$/;
const PUBLIC_KEYS = new Set(['anon_key', 'publishable_key', 'public_key']);

// Dynamic SQL source literals building a create|alter|drop of a table, policy or function, or a grant/revoke.
const DYNAMIC_DDL = [
  /\b(?:create|alter|drop)\s+(?:or\s+replace\s+|temp(?:orary)?\s+|unlogged\s+|foreign\s+|unique\s+|if\s+(?:not\s+)?exists\s+|concurrently\s+|materialized\s+)*(?:table|policy|function)\b/i,
  /\b(?:grant|revoke)\s+(?:select|insert|update|delete|truncate|references|trigger|execute|usage|all)\b/i,
];

/** The string literals of a plpgsql expression source ('' is the escaped quote), unescaped. */
const stringLiterals = (text) => [...String(text).matchAll(/'(?:[^']|'')*'/g)].map((m) => m[0].slice(1, -1).replace(/''/g, "'"));

/** A dynamic-SQL expression text builds DDL when one of its literals writes it out. */
const dynamicBuildsDdl = (text) => stringLiterals(text).some((literal) => DYNAMIC_DDL.some((rx) => rx.test(literal)));

/** node.String.sval of a parser name node. */
const sval = (node) => node?.String?.sval;
/** The dotted name of a RangeVar/ObjectWithArgs/funcname list, e.g. ['public','t'] -> 'public.t'. */
const nameOf = (list) => (list ?? []).map(sval).filter((part) => part !== undefined).join('.');
/** The schema of a RangeVar, unqualified read as the public default. */
const schemaOf = (rel) => rel?.schemaname ?? 'public';
/** The role a RoleSpec names; `to public` is the ROLESPEC_PUBLIC pseudo-role. */
const roleOf = (roleSpec) => (roleSpec?.RoleSpec?.roletype === 'ROLESPEC_PUBLIC' ? 'public' : roleSpec?.RoleSpec?.rolename ?? null);
/** The expression is the literal `true`. */
const isTrue = (expr) => expr?.A_Const?.boolval?.boolval === true;
/** The expression is a bool literal; `.value` tells true from false (a false literal is `boolval: {}`). */
const asBool = (expr) => (expr?.A_Const?.boolval === undefined ? null : expr.A_Const.boolval.boolval === true);
/** The expression is a string literal. */
const asString = (expr) => expr?.A_Const?.sval?.sval;
/** The expression is the literal NULL. */
const isNull = (expr) => expr?.A_Const?.isnull === true;

/** {line} of byte `offset` in `text`: pg's locations are byte offsets, so the line starts are counted in bytes. */
function lineIndexOf(text) {
  const bytes = Buffer.from(text, 'utf8');
  const starts = [0];
  for (let i = 0; i < bytes.length; i += 1) if (bytes[i] === 0x0a) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** The statement list of one parsed migration as {type, node, index, line}. */
function statementList(stmts, lineAt) {
  return (stmts ?? []).map((entry, index) => {
    const type = Object.keys(entry.stmt ?? {})[0] ?? '';
    const node = entry.stmt?.[type] ?? {};
    const offset = entry.stmt_location >= 0 ? entry.stmt_location : (node.location >= 0 ? node.location : 0);
    return { type, node, index, line: lineAt(offset) };
  });
}

/**
 * Every plpgsql dynamic statement source (`EXECUTE <expr>`, `FOR ... IN EXECUTE <expr>`, `OPEN ... FOR EXECUTE
 * <expr>`) of a parsed PLpgSQL_function node: [{ text, lineno }].
 */
function plpgsqlDynamicQueries(root) {
  const out = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'PLpgSQL_stmt_dynexecute' || key === 'PLpgSQL_stmt_dynfors') {
        const text = child?.query?.PLpgSQL_expr?.query;
        if (text !== undefined) out.push({ text, lineno: child.lineno });
      } else if (key === 'PLpgSQL_stmt_open') {
        const text = child?.dynquery?.PLpgSQL_expr?.query;
        if (text !== undefined) out.push({ text, lineno: child.lineno });
      }
      visit(child);
    }
  };
  visit(root);
  return out;
}

/** The plpgsql AST of a body string, or null when it cannot be read (the caller reports it opaque). */
async function plpgsqlOf(body) {
  try { return await parsePlpgsqlBody(body); } catch { return null; }
}

// ------------------------------------------------------------------------------------------------ L02

/** `<ts14>` -> the UTC instant it names, or null when the digits are no real time (month 13, day 32, ...). */
export function migrationStamp(text) {
  const [year, month, day, hour, minute, second] = [Number(text.slice(0, 4)), ...[4, 6, 8, 10, 12].map((at) => Number(text.slice(at, at + 2)))];
  const stamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(stamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second ? stamp : null;
}

/** The three git reads L02 makes, through the api/git call files: (args, {cwd}) -> {ok, stdout}; a spec injects a fake of the same shape. */
function defaultGit(args, { cwd }) {
  const [verb, ...rest] = args;
  const env = withoutGitLocalEnv(process.env);
  if (verb === 'merge-base') { const sha = mergeBase(cwd, rest[0], rest[1]); return { ok: sha !== null, stdout: sha ?? '' }; }
  const call = verb === 'ls-tree' ? lsTree : show;
  const r = call(rest, { cwd, env, maxBuffer: 64 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, stdout: r.stdout };
}

/** run one git verb through the injected runner; answers {ok, stdout}. */
const runGit = (git, repoRoot, args) => Promise.resolve(git(args, { cwd: repoRoot })).then((r) => ({ ok: r?.ok === true, stdout: String(r?.stdout ?? '') }));

/** The merge-base of HEAD with `base` (else origin/main, else main), or null when none resolves - the clean fallback. */
async function baseShaOf(git, repoRoot, base) {
  for (const ref of base ? [base] : ['origin/main', 'main']) {
    const r = await runGit(git, repoRoot, ['merge-base', 'HEAD', ref]);
    if (r.ok && r.stdout.trim()) return { ref, sha: r.stdout.trim() };
  }
  return null;
}

/** The file names under supabase/migrations/ of the tree `sha` names (empty when the tree has none). */
async function baseMigrationNames(git, repoRoot, sha) {
  const r = await runGit(git, repoRoot, ['ls-tree', '-r', '--name-only', '-z', sha, '--', MIGRATIONS_DIR]);
  if (!r.ok) return [];
  return r.stdout.split('\0').map((p) => p.split('/').pop()).filter(Boolean);
}

/** The committed text of `file` at `sha`, or null when the blob does not exist there. */
async function baseFileText(git, repoRoot, sha, file) {
  const r = await runGit(git, repoRoot, ['show', `${sha}:${file}`]);
  return r.ok ? r.stdout : null;
}

/** Byte-compare folded on line endings and a trailing blank tail (a runner may trim stdout). */
const sameText = (a, b) => a !== null && b !== null && a.replace(/\r\n/g, '\n').trimEnd() === b.replace(/\r\n/g, '\n').trimEnd();

/** L02: name, stamp, ordering and immutability of supabase/migrations/*.sql. */
async function migrationShapeFindings({ repoRoot, migrations, git, base, now }) {
  const findings = [];
  const local = migrations.map((file) => ({ file, name: file.split('/').pop(), match: MIGRATION_NAME.exec(file.split('/').pop()) }));
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
    if (stamp > now()) findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} is stamped ${entry.match[1]}, in the future; a migration stamp is the real UTC creation time so ordering is the CLI's, not a hand-picked date`, { stamp: entry.match[1] }));
    if (stamps.has(stamp)) findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} shares stamp ${entry.match[1]} with ${stamps.get(stamp)}; stamps are strictly increasing`, { stamp: entry.match[1], other: stamps.get(stamp) }));
    stamps.set(stamp, entry.file);
  }
  const baseSha = await baseShaOf(git, repoRoot, base);
  if (!baseSha) return findings;
  const baseNames = await baseMigrationNames(git, repoRoot, baseSha.sha);
  const onBase = new Set(baseNames);
  const baseStamps = baseNames.map((name) => MIGRATION_NAME.exec(name)?.[1]).filter(Boolean).map(migrationStamp).filter((s) => s !== null);
  const baseMax = baseStamps.length ? Math.max(...baseStamps) : null;
  for (const entry of local) {
    if (!entry.match) continue;
    const stamp = migrationStamp(entry.match[1]);
    if (onBase.has(entry.name)) {
      const committed = await baseFileText(git, repoRoot, baseSha.sha, entry.file);
      const current = readText(repoRoot, entry.file);
      if (!sameText(current, committed)) findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} differs from its content on ${baseSha.ref}; a migration on the base branch is immutable - write a new migration`, { base: baseSha.ref }));
    } else if (baseMax !== null && stamp !== null && stamp <= baseMax) {
      findings.push(found(DB_MIGRATION_SHAPE, entry.file, `${entry.file} is stamped ${entry.match[1]}, not after every migration on ${baseSha.ref} (latest ${String(new Date(baseMax).toISOString())}); a new migration sorts after the base ones`, { stamp: entry.match[1], base: baseSha.ref }));
    }
  }
  for (const name of baseNames) {
    if (!local.some((entry) => entry.name === name)) findings.push(found(DB_MIGRATION_SHAPE, `${MIGRATIONS_DIR}/${name}`, `${MIGRATIONS_DIR}/${name} exists on ${baseSha.ref} but is gone here; a migration on the base branch is immutable - restore it`, { base: baseSha.ref }));
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ shared extraction

/** Every statement of one migration folded to the facts the rules read. */
function factsOf(statements) {
  const tables = [];       // {schema, name, index, line}
  const enables = [];      // {schema, name, index}            alter table enable row level security
  const forces = [];       // {schema, name, index}            alter table force row level security
  const policies = [];     // {name, schema, table, cmd, roles, qual, withCheck, index, line}
  const grants = [];       // {grant, objtype, objects, privileges, grantees, index, line}
  const functions = [];    // {node, name, schema, index, line}
  const alterFunctions = [];// {name, setsPath, index, line}
  const doBlocks = [];     // {body, language, index, line}
  const buckets = [];      // {insert, index, line}
  for (const s of statements) {
    const { node } = s;
    if (s.type === 'CreateStmt' || s.type === 'CreateTableAsStmt') {
      const rel = s.type === 'CreateStmt' ? node.relation : node.into?.rel;
      if (!rel || node.partbound || rel.relpersistence === 't') continue;
      tables.push({ schema: schemaOf(rel), name: rel.relname, index: s.index, line: s.line });
    } else if (s.type === 'AlterTableStmt') {
      for (const cmd of node.cmds ?? []) {
        const subtype = cmd?.AlterTableCmd?.subtype;
        if (subtype === 'AT_EnableRowSecurity') enables.push({ schema: schemaOf(node.relation), name: node.relation?.relname, index: s.index });
        else if (subtype === 'AT_ForceRowSecurity') forces.push({ schema: schemaOf(node.relation), name: node.relation?.relname, index: s.index });
      }
    } else if (s.type === 'CreatePolicyStmt') {
      policies.push({
        name: node.policy_name, schema: schemaOf(node.table), table: node.table?.relname,
        cmd: String(node.cmd_name ?? 'all').toLowerCase(), roles: node.roles?.length ? node.roles.map(roleOf) : ['public'],
        qual: node.qual, withCheck: node.with_check, index: s.index, line: s.line,
      });
    } else if (s.type === 'GrantStmt') {
      grants.push({
        grant: node.is_grant === true, objtype: node.objtype,
        objects: node.objects ?? [], privileges: (node.privileges ?? []).map((p) => String(p?.AccessPriv?.priv_name ?? '').toLowerCase()),
        grantees: (node.grantees ?? []).map(roleOf), index: s.index, line: s.line,
      });
    } else if (s.type === 'CreateFunctionStmt') {
      const parts = (node.funcname ?? []).map(sval).filter(Boolean);
      functions.push({ node, name: parts.join('.'), schema: parts.length > 1 ? parts[0] : 'public', index: s.index, line: s.line });
    } else if (s.type === 'AlterFunctionStmt') {
      const name = nameOf(node.func?.objname);
      const setsPath = (node.actions ?? []).some((action) => isSearchPathSet(action?.DefElem));
      alterFunctions.push({ name, setsPath, index: s.index, line: s.line });
    } else if (s.type === 'DoStmt') {
      const option = (key) => (node.args ?? []).find((a) => a?.DefElem?.defname === key)?.DefElem?.arg;
      doBlocks.push({ body: option('as')?.String?.sval, language: option('language')?.String?.sval ?? 'plpgsql', index: s.index, line: s.line });
    } else if (s.type === 'InsertStmt' && node.relation?.schemaname === 'storage' && node.relation?.relname === 'buckets') {
      buckets.push({ node, index: s.index, line: s.line });
    }
  }
  return { tables, enables, forces, policies, grants, functions, alterFunctions, doBlocks, buckets };
}

/** The DefElem is `set search_path = <literal...>` (a pinned value, never `from current`). */
function isSearchPathSet(elem) {
  const v = elem?.arg?.VariableSetStmt;
  return elem?.defname === 'set' && v?.name === 'search_path' && v?.kind === 'VAR_SET_VALUE'
    && (v.args ?? []).length > 0 && v.args.every((arg) => arg?.A_Const?.sval !== undefined || arg?.A_Const?.isnull === true);
}

const functionOption = (node, key) => (node.options ?? []).filter((o) => o?.DefElem?.defname === key).map((o) => o.DefElem);
const securityDefiner = (node) => functionOption(node, 'security').some((o) => o.arg?.Boolean?.boolval === true || o.arg?.Integer?.ival === 1);
const functionLanguage = (node) => functionOption(node, 'language').map((o) => o.arg?.String?.sval).filter(Boolean).at(-1) ?? 'sql';
const functionBody = (node) => functionOption(node, 'as').flatMap((o) => (o.arg?.List?.items ?? []).map((item) => item?.String?.sval ?? '')).join('') || null;

// ------------------------------------------------------------------------------------------------ L03

function rlsFindings(file, facts, exposed, forceRls) {
  const findings = [];
  for (const table of facts.tables) {
    if (!exposed.has(table.schema)) continue;
    const qualified = `${table.schema}.${table.name}`;
    if (!facts.enables.some((e) => e.schema === table.schema && e.name === table.name && e.index > table.index)) {
      findings.push(found(DB_RLS_REQUIRED, file, `${file}:${table.line} creates ${qualified} in the exposed schema ${table.schema} without a later \`alter table ${qualified} enable row level security\` in the same migration; the enable ships next to the create so a static pass can see it`, { line: table.line, table: qualified }));
    }
    if (forceRls.has(qualified) && !facts.forces.some((e) => e.schema === table.schema && e.name === table.name && e.index > table.index)) {
      findings.push(found(DB_RLS_REQUIRED, file, `${file}:${table.line} creates ${qualified}, which hfs.json supabase.forceRls declares definer-owned, without \`alter table ${qualified} force row level security\` in the same migration`, { line: table.line, table: qualified }));
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ L04

/**
 * The dynamic-SQL findings of one plpgsql source list (`queries` from plpgsqlDynamicQueries) under `file`:
 * a statement whose literals write DDL, or one the pass cannot read at all. `baseLine` is the file line the
 * plpgsql source block starts near (lineno counts inside the body).
 */
function dynamicDdlFindings(file, queries, where, baseLine) {
  const findings = [];
  for (const { text, lineno } of queries) {
    const literals = stringLiterals(text);
    const line = lineno ? baseLine + lineno - 1 : undefined;
    if (dynamicBuildsDdl(text)) {
      findings.push(found(DB_DYNAMIC_DDL, file, `${file}${line ? `:${line}` : ''} ${where} builds DDL dynamically (\`${String(text).slice(0, 120)}\`); write the create/alter/drop or grant/revoke out as statements so the parser sees every one`, { ...(line ? { line } : {}), query: text }));
    } else if (!literals.length) {
      findings.push(found(DB_DYNAMIC_DDL, file, `${file}${line ? `:${line}` : ''} ${where} runs dynamic SQL the pass cannot read (\`${String(text).slice(0, 120)}\`); dynamic DDL is refused and a query built from a variable cannot be judged`, { ...(line ? { line } : {}), query: text }));
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ L05

function policyFindings(file, facts) {
  const findings = [];
  for (const p of facts.policies) {
    const qualified = `${p.schema}.${p.table}`;
    if (p.name === undefined || !p.name.startsWith(`${p.table}_`)) {
      findings.push(found(DB_POLICY_SHAPE, file, `${file}:${p.line} policy ${JSON.stringify(p.name)} on ${qualified} is not named <table>_<role>_<action>; the name is the declaration`, { line: p.line, policy: p.name }));
    } else {
      const tail = p.name.slice(p.table.length + 1);
      if (tail !== 'public_read' && !new RegExp(`^[a-z][a-z0-9_]*_(${POLICY_ACTIONS.join('|')})$`).test(tail)) {
        findings.push(found(DB_POLICY_SHAPE, file, `${file}:${p.line} policy ${p.name} on ${qualified} is not named <table>_<role>_<action> (action one of ${POLICY_ACTIONS.join(', ')}; a world-readable select ends _public_read)`, { line: p.line, policy: p.name }));
      }
    }
    const publicRead = typeof p.name === 'string' && p.name.endsWith(PUBLIC_READ_SUFFIX);
    if (WRITE_COMMANDS.has(p.cmd) && isTrue(p.qual)) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${p.line} policy ${p.name} on ${qualified} is FOR ${p.cmd.toUpperCase()} with USING (true); a write policy never admits every row`, { line: p.line, policy: p.name }));
    if (WRITE_COMMANDS.has(p.cmd) && isTrue(p.withCheck)) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${p.line} policy ${p.name} on ${qualified} is FOR ${p.cmd.toUpperCase()} with WITH CHECK (true); a write policy never admits every row`, { line: p.line, policy: p.name }));
    if (p.cmd === 'select' && isTrue(p.qual) && !publicRead) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${p.line} policy ${p.name} on ${qualified} is FOR SELECT with USING (true); a world-readable table declares it in the name: <table>_<role>_public_read or <table>_public_read`, { line: p.line, policy: p.name }));
    if ((p.roles.includes('anon') || p.roles.includes('public')) && !(p.cmd === 'select' && publicRead)) {
      findings.push(found(DB_POLICY_SHAPE, file, `${file}:${p.line} policy ${p.name} on ${qualified} is granted to ${p.roles.includes('anon') ? 'anon' : 'public'}; the anonymous role reaches only FOR SELECT policies named *_public_read`, { line: p.line, policy: p.name }));
    }
  }
  for (const g of facts.grants) {
    if (!g.grant) continue;
    if (g.grantees.includes('service_role')) {
      findings.push(found(DB_POLICY_SHAPE, file, `${file}:${g.line} grants to service_role; the service role bypasses RLS and is never an application path, so it is never granted`, { line: g.line }));
    }
    if (!g.grantees.includes('anon') && !g.grantees.includes('public')) continue;
    for (const object of g.objects) {
      const rel = object?.RangeVar;
      if (!rel) continue;
      const schema = schemaOf(rel);
      const table = rel.relname;
      const covered = facts.policies.some((p) => p.schema === schema && p.table === table && p.cmd === 'select' && typeof p.name === 'string' && p.name.endsWith(PUBLIC_READ_SUFFIX));
      if (!covered) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${g.line} grants ${g.grantees.includes('anon') ? 'anon' : 'public'} on ${schema}.${table} but no *_public_read FOR SELECT policy exists on it in this migration; the grant is legal only beside its declared public-read policy`, { line: g.line, table: `${schema}.${table}` }));
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ L06

/**
 * A security-definer body's dynamic SQL: an EXECUTE is safe only when it runs one literal or a format() template
 * interpolating solely through %I/%L (%% escapes a percent).
 */
function definerDynamicFindings(file, fn, queries, baseLine) {
  const findings = [];
  for (const { text, lineno } of queries) {
    const source = String(text).trim();
    const line = lineno ? baseLine + lineno - 1 : undefined;
    const detail = { ...(line ? { line } : {}), function: fn.name, query: text };
    if (/^'(?:[^']|'')*'$/.test(source)) continue;
    const format = /^format\s*\(\s*'((?:[^']|'')*)'/i.exec(source);
    if (format) {
      const template = format[1].replace(/''/g, "'");
      if (/%(?!I\b|L\b|%)/.test(template.replace(/%%/g, ''))) {
        findings.push(found(DB_DEFINER_SAFE, file, `${file}${line ? `:${line}` : ''} security definer function ${fn.name} interpolates through a format() specifier that is not %I or %L (\`${source.slice(0, 120)}\`); parameters enter dynamic SQL only quoted`, detail));
      }
      continue;
    }
    findings.push(found(DB_DEFINER_SAFE, file, `${file}${line ? `:${line}` : ''} security definer function ${fn.name} builds dynamic SQL without format('%I/%L') (\`${source.slice(0, 120)}\`)`, detail));
  }
  return findings;
}

async function definerFindings(file, facts, exposed) {
  const findings = [];
  for (const fn of facts.functions) {
    const node = fn.node;
    if (!securityDefiner(node)) continue;
    const pathSet = functionOption(node, 'set').some((o) => isSearchPathSet(o))
      || facts.alterFunctions.some((a) => a.name === fn.name && a.setsPath && a.index > fn.index);
    if (!pathSet) findings.push(found(DB_DEFINER_SAFE, file, `${file}:${fn.line} security definer function ${fn.name} sets no search_path; add \`set search_path = ''\` (or a pinned schema list) on the create, or an alter function in the same migration - an unset search_path is a privilege-escalation vector`, { line: fn.line, function: fn.name }));
    if (exposed.has(fn.schema)) {
      const revoked = facts.grants.some((g) => !g.grant && g.objtype === 'OBJECT_FUNCTION'
        && g.objects.some((o) => nameOf(o?.ObjectWithArgs?.objname) === fn.name)
        && (g.privileges.includes('execute') || g.privileges.includes('all'))
        && g.grantees.includes('public'));
      if (!revoked) findings.push(found(DB_DEFINER_SAFE, file, `${file}:${fn.line} security definer function ${fn.name} lives in the exposed schema ${fn.schema}; keep it in a non-exposed schema (private) or \`revoke execute on function ${fn.name}(...) from public\` in the same migration`, { line: fn.line, function: fn.name }));
    }
    if (!node.is_procedure && !node.returnType) findings.push(found(DB_DEFINER_SAFE, file, `${file}:${fn.line} security definer function ${fn.name} declares no return type`, { line: fn.line, function: fn.name }));
    if (functionLanguage(node) === 'plpgsql') {
      const body = functionBody(node);
      if (body === null) continue;
      const ast = await plpgsqlOf(body);
      if (ast === null) {
        findings.push(found(DB_DEFINER_SAFE, file, `${file}:${fn.line} security definer function ${fn.name} has a body the pass cannot read; a definer body must be plain plpgsql`, { line: fn.line, function: fn.name }));
        continue;
      }
      findings.push(...definerDynamicFindings(file, fn, plpgsqlDynamicQueries(ast), fn.line));
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ L04 (migration level)

async function dynamicFindings(file, facts) {
  const findings = [];
  for (const block of facts.doBlocks) {
    if (block.body === undefined || block.language !== 'plpgsql') {
      findings.push(found(DB_DYNAMIC_DDL, file, `${file}:${block.line} DO block in ${block.language} cannot be inspected; a DO block is plpgsql so a static pass sees its statements`, { line: block.line }));
      continue;
    }
    const ast = await plpgsqlOf(block.body);
    if (ast === null) {
      findings.push(found(DB_DYNAMIC_DDL, file, `${file}:${block.line} DO block body is not valid plpgsql; the pass must see every statement a migration runs`, { line: block.line }));
      continue;
    }
    findings.push(...dynamicDdlFindings(file, plpgsqlDynamicQueries(ast), 'DO block', block.line));
  }
  for (const fn of facts.functions) {
    if (functionLanguage(fn.node) !== 'plpgsql') continue;
    const body = functionBody(fn.node);
    if (body === null) continue;
    const ast = await plpgsqlOf(body);
    if (ast === null) continue; // an unreadable definer body is reported by L06 when security definer
    findings.push(...dynamicDdlFindings(file, plpgsqlDynamicQueries(ast), `function ${fn.name}`, fn.line));
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ L07

/** The values rows of an `insert ... values (...)`: [[expr per column]] or null for a non-VALUES insert. */
const valueRows = (node) => (node.selectStmt?.SelectStmt?.valuesLists ?? []).map((list) => list?.List?.items ?? []);

function storageFindings(file, facts) {
  const findings = [];
  for (const { node, line } of facts.buckets) {
    const cols = (node.cols ?? []).map((c) => c?.ResTarget?.name);
    const rows = valueRows(node);
    if (!cols.length || !rows.length) {
      findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} inserts into storage.buckets without a literal column list and VALUES; a bucket is declared by name so its policy can be checked`, { line }));
      continue;
    }
    for (const row of rows) {
      const cell = (name) => row[cols.indexOf(name)];
      const id = asString(cell('id'));
      if (id === undefined) {
        findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} storage.buckets row has no literal id`, { line }));
        continue;
      }
      const isPublicName = id.endsWith('_public');
      const publicValue = asBool(cell('public'));
      if (publicValue !== isPublicName) {
        findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} bucket ${JSON.stringify(id)} declares public = ${publicValue === null ? 'absent' : publicValue}; a bucket is private (public = false) unless its id ends _public`, { line, bucket: id }));
      }
      for (const column of ['file_size_limit', 'allowed_mime_types']) {
        const value = cell(column);
        if (value === undefined || isNull(value)) findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} bucket ${JSON.stringify(id)} declares no ${column}; a bucket's size and mime bounds are set where it is created`, { line, bucket: id, column }));
      }
      const covered = facts.policies.some((p) => p.schema === 'storage' && p.table === 'objects'
        && JSON.stringify([p.qual, p.withCheck]).includes('"sval":"bucket_id"')
        && JSON.stringify([p.qual, p.withCheck]).includes(`"sval":${JSON.stringify(id)}`));
      if (!covered) findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} bucket ${JSON.stringify(id)} has no storage.objects policy naming bucket_id '${id}' in this migration; a bucket ships with the policies that scope it`, { line, bucket: id }));
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ L08

/** Every [path, leafKey, value] of a TOML document, tables walked depth first (arrays of tables flattened). */
function tomlEntries(value, path = []) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item) => tomlEntries(item, path));
  return Object.entries(value).flatMap(([key, child]) => {
    const at = [...path, key];
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) {
        if (child.every((item) => item && typeof item === 'object' && !Array.isArray(item))) return child.flatMap((item) => tomlEntries(item, at));
      } else return tomlEntries(child, at);
    }
    return [[at.join('.'), key, child]];
  });
}

const isCredentialKey = (key) => {
  const leaf = key.toLowerCase();
  return ['secret', 'client_id', 'key', 'password', 'token'].includes(leaf)
    || /_(secret|password|token|client_id|api_key)$/.test(leaf)
    || (leaf.endsWith('_key') && !PUBLIC_KEYS.has(leaf));
};

/** The 1-based line the leaf key is assigned at, best effort for a finding. */
const tomlLine = (text, key) => {
  const rx = new RegExp(`^\\s*["']?${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*=`, 'm');
  const match = rx.exec(text);
  return match ? text.slice(0, match.index).split('\n').length : undefined;
};

/** The parsed TOML of `text`, or null when it does not parse (the caller reports it once). */
async function parseToml(text) {
  try {
    const module = await import('smol-toml');
    return (module.default?.parse ?? module.parse)(text);
  } catch {
    return null;
  }
}

function configFindings({ file, text, toml, supabase }) {
  const findings = [];
  for (const [at, key, value] of tomlEntries(toml)) {
    if (!isCredentialKey(key)) continue;
    const line = tomlLine(text, key);
    if (typeof value !== 'string' || !ENV_REF.test(value)) {
      findings.push(found(DB_CONFIG_POLICY, file, `${file}${line ? `:${line}` : ''} ${at} holds a literal credential; a secret in config.toml is written env(NAME), never a value`, { ...(line ? { line } : {}), key: at }));
    }
  }
  const auth = toml?.auth ?? {};
  if (auth.jwt_expiry !== undefined && (typeof auth.jwt_expiry !== 'number' || auth.jwt_expiry > 3600)) {
    findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.jwt_expiry is ${JSON.stringify(auth.jwt_expiry)}; the access token lives at most 3600 seconds`, { key: 'auth.jwt_expiry' }));
  }
  if (!supabase) return findings;
  const declared = {
    enableSignup: supabase.enableSignup, jwtExpiry: supabase.jwtExpiry, siteUrl: supabase.siteUrl,
    redirectUrls: Array.isArray(supabase.redirectUrls) ? supabase.redirectUrls : undefined,
  };
  if (declared.jwtExpiry !== undefined && auth.jwt_expiry !== declared.jwtExpiry) {
    findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.jwt_expiry is ${JSON.stringify(auth.jwt_expiry ?? 'absent')}; hfs.json supabase.jwtExpiry declares ${declared.jwtExpiry}`, { key: 'auth.jwt_expiry', declared: declared.jwtExpiry }));
  }
  if (declared.enableSignup !== undefined) {
    if (auth.enable_signup !== declared.enableSignup) findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.enable_signup is ${JSON.stringify(auth.enable_signup ?? 'absent')}; hfs.json supabase.enableSignup declares ${declared.enableSignup} - the invite posture is a checked fact, not a doc claim`, { key: 'auth.enable_signup', declared: declared.enableSignup }));
    if (auth.email?.enable_signup !== undefined && auth.email.enable_signup !== declared.enableSignup) {
      findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.email.enable_signup is ${JSON.stringify(auth.email.enable_signup)}; hfs.json supabase.enableSignup declares ${declared.enableSignup}`, { key: 'auth.email.enable_signup', declared: declared.enableSignup }));
    }
  }
  if (declared.siteUrl !== undefined && auth.site_url !== declared.siteUrl) {
    findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.site_url is ${JSON.stringify(auth.site_url ?? 'absent')}; hfs.json supabase.siteUrl declares ${declared.siteUrl}`, { key: 'auth.site_url', declared: declared.siteUrl }));
  }
  if (declared.redirectUrls !== undefined) {
    for (const url of Array.isArray(auth.additional_redirect_urls) ? auth.additional_redirect_urls : []) {
      if (!declared.redirectUrls.includes(url)) findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.additional_redirect_urls holds ${url}, which hfs.json supabase.redirectUrls does not declare; the config states nothing the app did not declare`, { key: 'auth.additional_redirect_urls', url }));
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ L09

async function typesFindings({ repoRoot, files, emitTypes, declaration }) {
  if (typeof emitTypes !== 'function') return [];
  const tracked = new Set(files);
  let emitted;
  try { emitted = await emitTypes({ repoRoot, declaration }); } catch (error) {
    return [found(DB_TYPES_DRIFT, TYPES_FILE, `${TYPES_FILE} cannot be verified: the types emit failed (${String(error?.message ?? error).split('\n').filter(Boolean).slice(0, 3).join(' | ')})`, { drift: 'emit-failed' })];
  }
  const committed = tracked.has(TYPES_FILE) ? readText(repoRoot, TYPES_FILE) : null;
  if (committed === null) return [found(DB_TYPES_DRIFT, TYPES_FILE, `${TYPES_FILE} is not committed; run \`npm run contract:emit\` and commit the generated types`, { drift: 'not-committed' })];
  if (!sameText(committed, String(emitted))) return [found(DB_TYPES_DRIFT, TYPES_FILE, `${TYPES_FILE} differs from what \`contract:emit\` generates from the migrations now; run \`npm run contract:emit\` and commit the result`, { drift: 'stale' })];
  return [];
}

// ------------------------------------------------------------------------------------------------ the rule entry

/**
 * The findings of L02-L09 over the tracked paths `files` (app-relative) of the app at `repoRoot`. Runs only when
 * the app holds a supabase/ tree or declares a `supabase` block in hfs.json; the SQL is parsed by libpg-query's
 * WASM build, loaded lazily, so a full-edition app without Supabase never pays for it. `git` is a gitRunner-shaped
 * runner ((args, {cwd}) -> {ok, stdout}), injectable for specs; `base` names the ref migrations are judged
 * against (else origin/main, else main - no base means ordering and immutability are not judged). `emitTypes` is
 * the injected types generator of chunk E (async ({repoRoot, declaration}) -> text); without it L09 is silent.
 * `now` (epoch ms) is injectable for specs.
 */
export async function checkDatabase({ repoRoot, files, base, git, edition, supabase, emitTypes, now = () => Date.now() } = {}) {
  const findings = [];
  const migrations = files.filter((f) => f.startsWith(`${MIGRATIONS_DIR}/`) && f.endsWith('.sql'));
  const declaration = readJson(repoRoot, 'hfs.json');
  const declared = supabase === undefined ? declaration?.supabase : supabase;
  const hasConfig = files.includes(CONFIG_FILE);
  // The rules also judge a full-edition app the moment a connection declares provider: supabase (design 3.8 note).
  const supabaseConnection = ['be', 'fe'].some((side) => (declaration?.sides?.[side]?.connections ?? []).some((c) => c?.provider === 'supabase'));
  if (!migrations.length && !hasConfig && !files.includes(TYPES_FILE) && !declared && !supabaseConnection && (edition ?? declaration?.edition) !== 'lite') return findings;
  const run = git ?? defaultGit;

  // L08: the config is read first - its [api] schemas decide the exposed schemas L03 and L06 judge against.
  let config = null;
  if (hasConfig) {
    const configText = readText(repoRoot, CONFIG_FILE);
    config = configText === null ? null : await parseToml(configText);
    if (config === null) {
      findings.push(found(DB_CONFIG_POLICY, CONFIG_FILE, `${CONFIG_FILE} is not readable valid TOML; the config is policy, so it must parse`, {}));
    } else {
      findings.push(...configFindings({ file: CONFIG_FILE, text: configText, toml: config, supabase: declared ?? null }));
    }
  }
  const apiSchemas = (config?.api?.schemas ?? []).filter((s) => typeof s === 'string');
  const exposed = new Set(['public', ...apiSchemas]);
  const forceRls = new Set((declared?.forceRls ?? []).map((name) => (name.includes('.') ? name : `public.${name}`)));

  findings.push(...await migrationShapeFindings({ repoRoot, migrations, git: run, base, now }));

  for (const file of migrations) {
    const text = readText(repoRoot, file);
    if (text === null) { findings.push(found(DB_MIGRATION_SHAPE, file, `${file} is not a readable SQL file`, {})); continue; }
    const lineAt = lineIndexOf(text);
    let parsed;
    try {
      parsed = await parseSql(text);
    } catch (error) {
      const position = error?.sqlDetails?.cursorPosition;
      const line = position ? lineAt(position - 1) : undefined;
      findings.push(found(DB_MIGRATION_SHAPE, file, `${file}${line ? `:${line}` : ''} is not valid PostgreSQL (${String(error?.message ?? error).split('\n')[0]}); a migration is written out SQL the real parser reads`, { ...(line ? { line } : {}) }));
      continue;
    }
    const facts = factsOf(statementList(parsed.stmts, lineAt));
    findings.push(...rlsFindings(file, facts, exposed, forceRls));
    findings.push(...await dynamicFindings(file, facts));
    findings.push(...policyFindings(file, facts));
    findings.push(...await definerFindings(file, facts, exposed));
    findings.push(...storageFindings(file, facts));
  }

  findings.push(...await typesFindings({ repoRoot, files, emitTypes, declaration: declared }));
  return findings;
}
