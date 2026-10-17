// post-cutover.mjs - `starci app db post-cutover`: applies the held-back migrations (database.heldBack) that `db migrate` skipped, e.g. the one that
// drops the old engine's tables. After it a rollback to the old app needs a database restore, so it is guarded three ways:
//   1. a READ-ONLY pg_proc preflight (also in the dry run): every function of the declared families (database.postCutover.functionPrefixes and
//      functionNames in database.postCutover.schema) that exists on the database must be covered by the DROP FUNCTION statements of the held-back
//      migration (or database.postCutover.functions); a function nobody drops is a function something may still need, so nothing is applied;
//   2. a time gate: --green-at <ISO> at least minAgeHours (48) ago, or --owner-confirms-old-app-gone;
//   3. STARCI_DB_ARMED=1.
// Idempotent: when every held-back version is already on the remote it prints `nothing to do`. The pg_proc query goes through `options.query(sql)`
// (specs inject one) or, by default, `supabase db query` of the linked project or the --url-env connection.
import fs from 'node:fs';
import path from 'node:path';
import { failure, refusal } from '../stack/errors.mjs';
import { runVerb } from '../release/index.mjs';
import { buildModel, listRemote, loadDatabase, pendingVersions, requireArmed, resolveTarget, runCli, targetArgs } from './migrate.mjs';

const DROP_FUNCTION = /^drop\s+function\s+/iu;
const IF_EXISTS = /^if\s+exists\s+/iu;
const MS_PER_HOUR = 3.6e6;
const DEFAULT_MIN_AGE_HOURS = 48;

/** Makes a DROP signature comparable with pg_proc's regprocedure text. */
function normalizeSignature(signature, schema) {
  const lowered = signature.trim().toLowerCase();
  const bare = lowered.startsWith(`${schema}.`) ? lowered.slice(schema.length + 1) : lowered;
  const words = bare
    .replace(/\bint\b/gu, 'integer')
    .replace(/\btimestamptz\b/gu, 'timestamp with time zone')
    .replace(/\s+/gu, ' ');
  return [...'(),'].reduce((out, mark) => out.replaceAll(` ${mark}`, mark).replaceAll(`${mark} `, mark), words);
}

/** The signature a `DROP FUNCTION [IF EXISTS] <signature>` statement drops, or null for any other statement. */
function droppedSignature(statement) {
  const head = DROP_FUNCTION.exec(statement);
  return head ? statement.slice(head[0].length).replace(IF_EXISTS, '') : null;
}

/** The signatures a migration drops: every `DROP FUNCTION [IF EXISTS] <signature>;` statement. */
function dropSignatures(sql, schema) {
  return sql.replace(/--[^\n]*/gu, '').split(';').flatMap((statement) => {
    const signature = droppedSignature(statement.trim());
    return signature === null ? [] : [normalizeSignature(signature, schema)];
  });
}

const settingsOf = (post) => ({
  schema: post.schema ?? 'public', prefixes: post.functionPrefixes ?? [], names: post.functionNames ?? [], extra: post.functions ?? [],
});

/** The read-only pg_proc query of the declared function families (identifiers are validated, so nothing free-form reaches the SQL). */
function preflightSql({ schema, prefixes, names }) {
  const escaped = (prefix) => prefix.replaceAll('_', String.raw`\_`);
  const clauses = [...names.map((name) => `proname = '${name}'`), ...prefixes.map((prefix) => `proname like '${escaped(prefix)}%'`)];
  return `select oid::regprocedure::text as signature from pg_proc where pronamespace = '${schema}'::regnamespace and (${clauses.join(' or ')})`;
}

const cliQuery = (session) => (sql) => JSON.parse(runCli(session, ['db', 'query', sql, '--output', 'json', '--agent', 'no', ...targetArgs(session.target, session.ctx.cwd)]).stdout);

async function queryRows(session, sql, options) {
  try {
    const rows = await (options.query ?? cliQuery(session))(sql);
    if (Array.isArray(rows) && rows.every((row) => typeof row?.signature === 'string')) return rows;
  } catch { /* the cause may hold a connection detail: it is withheld */ }
  throw failure('DB_PREFLIGHT_UNREADABLE', 'the read-only function preflight could not query the database; nothing applied');
}

/** The pg_proc preflight: refuses when a function of the declared families is not dropped by the held-back migration(s). */
async function functionPreflight(session, options) {
  const { model, decl } = session;
  const settings = settingsOf(decl.postCutover);
  if (settings.prefixes.length + settings.names.length === 0) return { count: 0, line: 'function preflight: no function family declared; nothing to check' };
  const dropped = model.held.flatMap((file) => dropSignatures(fs.readFileSync(path.join(model.root, decl.migrationsDir, file), 'utf8'), settings.schema));
  const allowed = new Set([...dropped, ...settings.extra.map((item) => normalizeSignature(item, settings.schema))]);
  const rows = await queryRows(session, preflightSql(settings), options);
  const uncovered = rows.map((row) => normalizeSignature(row.signature, settings.schema)).filter((item) => !allowed.has(item));
  if (uncovered.length > 0) throw refusal('DB_PREFLIGHT_UNCOVERED', `function signatures not covered by the held-back migration:\n${uncovered.join('\n')}`);
  return { count: rows.length, line: `read-only function preflight: ${rows.length} signature(s), all covered by the held-back migration` };
}

/** The time gate: { open, line }. Dry run only reports it; --execute refuses while it is closed. */
function timeGate(ctx, post, options) {
  if (options.ownerConfirms === true) return { open: true, line: 'gate: the owner confirms the old app is gone: OPEN' };
  if (options.greenAt === undefined) return { open: false, line: 'gate: CLOSED (needs --green-at <ISO> old enough, or --owner-confirms-old-app-gone)' };
  const at = Date.parse(options.greenAt);
  if (Number.isNaN(at)) throw refusal('DB_USAGE', '--green-at must be an ISO time');
  const hours = (ctx.now() - at) / MS_PER_HOUR;
  const need = post.minAgeHours ?? DEFAULT_MIN_AGE_HOURS;
  return { open: hours >= need, line: `gate: last green ${options.greenAt} (${hours.toFixed(1)} h ago, ${need} h needed): ${hours >= need ? 'OPEN' : 'CLOSED'}` };
}

function applyHeld(session, remote) {
  const { model, ctx } = session;
  const lacking = [...model.pushVersions].filter((version) => !remote.has(version));
  if (lacking.length > 0) throw refusal('DB_BASELINE_NOT_APPLIED', `the remote history lacks ${lacking.join(', ')}: run starci app db migrate first`);
  const args = ['db', 'push', '--include-all'];
  const pending = pendingVersions(runCli(session, [...args, '--dry-run', ...targetArgs(session.target, ctx.cwd)]).text);
  const stray = pending.filter((version) => !model.heldVersions.includes(version));
  if (stray.length > 0) throw failure('DB_PUSH_STRAY', `the dry run lists more than the held-back migrations: ${pending.join(', ')}. Stopped.`);
  if (pending.length > 0) runCli(session, [...args, '--yes', ...targetArgs(session.target, ctx.cwd)]);
  return pending;
}

/**
 * `starci app db post-cutover`. options: { execute, linked, urlEnv, greenAt, ownerConfirms, query }. Dry run: remote read plus the read-only preflight.
 * --execute: gate open and STARCI_DB_ARMED=1, then `db push --include-all` of exactly the held-back versions.
 */
async function postCutoverDatabase(ctx, decl, options = {}) {
  const model = buildModel(ctx.cwd, decl);
  if (model.held.length === 0) return { ok: true, lines: ['no held-back migration in the repository. Nothing to do.'], data: { held: [], done: true, executed: false } };
  if (decl.postCutover === null) throw refusal('DB_POSTCUTOVER_UNDECLARED', 'database.postCutover is not declared: the function preflight needs it (an empty mapping declares no family)');
  const session = { ctx, decl, model, target: resolveTarget(ctx, decl, options) };
  const remote = listRemote(session);
  const data = { held: model.heldVersions, done: false, executed: false };
  if (model.heldVersions.every((version) => remote.has(version))) return { ok: true, lines: [`held-back migrations ${model.held.join(', ')} are already applied. Nothing to do.`], data: { ...data, done: true } };
  const gate = timeGate(ctx, decl.postCutover, options);
  const preflight = await functionPreflight(session, options);
  const lines = [`held-back migrations: ${model.held.join(', ')}`, preflight.line, gate.line, 'WARNING: after this step a rollback to the old app needs a database restore.'];
  if (options.execute !== true) return { ok: true, lines: [...lines, 'dry run: only read-only calls were made; nothing applied.'], data: { ...data, gateOpen: gate.open, signatures: preflight.count } };
  if (!gate.open) throw refusal('DB_POSTCUTOVER_GATE_CLOSED', 'the time gate is closed; nothing applied');
  requireArmed(ctx);
  const pending = applyHeld(session, remote);
  if (!model.heldVersions.every((version) => listRemote(session).has(version))) throw failure('DB_HELD_MISSING', 'a held-back migration is still missing from the remote history');
  return { ok: true, lines: [...lines, pending.length > 0 ? `applied: ${pending.join(', ')}` : 'nothing pending: already applied.'], data: { ...data, done: true, executed: true, pushed: pending, signatures: preflight.count } };
}

const SPEC = { boolean: ['--execute', '--json', '--linked', '--owner-confirms-old-app-gone'], value: ['--url-env', '--green-at'] };

/** Entry of the verb: `starci app db post-cutover [--execute] [--green-at <ISO> | --owner-confirms-old-app-gone] [--linked | --url-env NAME] [--json]`. */
export function dbPostCutoverMain(argv, io = {}) {
  return runVerb({
    label: 'starci app db post-cutover', name: 'db post-cutover', code: 'DB_USAGE', io, argv, spec: SPEC,
    run: (ctx, flags) => postCutoverDatabase(ctx, loadDatabase(ctx.cwd), {
      execute: flags.execute === true, linked: flags.linked === true, urlEnv: flags['url-env'], greenAt: flags['green-at'], ownerConfirms: flags['owner-confirms-old-app-gone'] === true,
    }),
  });
}
