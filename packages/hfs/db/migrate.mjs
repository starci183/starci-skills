// migrate.mjs - `starci app db migrate`: puts a database's migration history in the state the app's repository declares, idempotently.
// The optional `database:` block of .starcistacks/application-stacks.yaml names the baseline migration, the optional second baseline (standard),
// the held-back migrations (applied later by `db post-cutover`), the restamp pairs and the archive directory. The plan, from the remote history:
//   repair    revert each restamped old version still on the remote and mark its new version applied
//   baseline  revert the archived rows, mark the baseline applied (it is NOT run)
//   forward   push every other migration, EXCEPT the held-back ones (they are never copied into the push project)
// When the remote already is baseline + forward (held-back ones may or may not be applied) it prints `nothing to do` and makes no mutating call.
// The Supabase CLI runs through ctx.spawn with scratch workdirs; a password travels only in the child environment (SUPABASE_DB_PASSWORD from the
// environment or the sealed custody, PGPASSWORD split off a --url-env connection string), never in argv, a file, a line or an error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isPlainObject as plain } from '../runtime/engine/plain-object.mjs';
import { byCodeUnit } from '../runtime/engine/by-code-unit.mjs';
import { readMap } from '../runtime/scripts/hfs/secret-store.mjs';
import { STACKS_DIR } from '../stack/config.mjs';
import { firstLine, tool } from '../stack/context.mjs';
import { approvalMissing, failure, refusal } from '../stack/errors.mjs';
import { readDeclaration, runVerb } from '../release/index.mjs';

const DATABASE_CODE = 'DB_CONFIG_INVALID';

const SEGMENT = /^[A-Za-z0-9._-]+$/u;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;
const IDENT = /^[a-z][a-z0-9_]*$/u;
const SLUG = /^[a-z][a-z0-9-]*$/u;
const KEY = /^[A-Z][A-Z0-9_]*$/u;
const STAMP = /^\d{14}$/u;
const PROJECT_REF = /^[a-z0-9]{10,40}$/u;
const SIGNATURE = /^[A-Za-z0-9_."(), ]+$/u;
const MIGRATION = /^(\d{14})_([A-Za-z0-9_-]+)\.sql$/u;
const PENDING = /(\d{14})_[^\s"]+?\.sql/gu;

const matches = (pattern) => (value) => typeof value === 'string' && pattern.test(value);
const listOf = (item) => (value) => Array.isArray(value) && value.every((entry) => item(entry));
const dirOk = (value) => typeof value === 'string' && value.split('/').every((part) => SEGMENT.test(part) && part !== '..');
const pairOk = (value) => plain(value) && Object.keys(value).length === 2 && matches(STAMP)(value.from) && matches(STAMP)(value.to);
const passwordOk = (value) => plain(value) && Object.keys(value).length === 3 && matches(SLUG)(value.env) && matches(SLUG)(value.member) && matches(KEY)(value.key);
const POST_FIELDS = ['schema', 'functionPrefixes', 'functionNames', 'functions', 'minAgeHours'];
const POST_CHECKS = {
  schema: matches(IDENT), functionPrefixes: listOf(matches(IDENT)), functionNames: listOf(matches(IDENT)),
  functions: listOf(matches(SIGNATURE)), minAgeHours: (value) => Number.isFinite(value) && value >= 0,
};
const postOk = (value) => plain(value) && Object.keys(value).every((key) => POST_FIELDS.includes(key) && POST_CHECKS[key](value[key]));

const CHECKS = {
  migrationsDir: [dirOk, 'must be a relative directory inside the app'],
  archiveDir: [dirOk, 'must be a relative directory inside the app'],
  baseline: [matches(NAME), `must match ${NAME} (the name after the stamp)`],
  standard: [matches(NAME), `must match ${NAME} (the name after the stamp)`],
  heldBack: [listOf(matches(NAME)), 'must be a list of migration names'],
  projectRef: [matches(PROJECT_REF), `must match ${PROJECT_REF}`],
  restamp: [listOf(pairOk), 'must be a list of { from, to } fourteen-digit stamps'],
  password: [passwordOk, 'must be { env, member, key } naming a sealed value'],
  postCutover: [postOk, `must use only ${POST_FIELDS.join(', ')} with valid values`],
};

/** Judges the `database:` block. Returns { config } or { problems }; `baseline` is the one required field. */
function normalizeDatabase(block) {
  if (!plain(block)) return { problems: ['database: must be a mapping'] };
  const problems = [];
  for (const [key, value] of Object.entries(block)) {
    if (!Object.hasOwn(CHECKS, key)) problems.push(`database.${key}: is not a field of the database block`);
    else if (!CHECKS[key][0](value)) problems.push(`database.${key}: ${CHECKS[key][1]}`);
  }
  if (block.baseline === undefined) problems.push('database.baseline: is required');
  if (problems.length > 0) return { problems };
  const config = {
    migrationsDir: 'supabase/migrations', archiveDir: null, standard: null, heldBack: [], projectRef: null, restamp: [], password: null, postCutover: null, ...block,
  };
  return { config };
}

/** The normalised `database:` block of the app at `root`; absent or invalid is a refusal (these verbs need the declaration). */
export function loadDatabase(root) {
  const block = readDeclaration(root).database;
  if (block === undefined) throw refusal('DB_UNDECLARED', 'the app declares no database: block in .starcistacks/application-stacks.yaml');
  const { config, problems } = normalizeDatabase(block);
  if (!config) throw refusal(DATABASE_CODE, `${problems.length} problem(s) in database: ${problems.slice(0, 6).join('; ')}`);
  return config;
}

/* ---- the repository model */

const sqlNames = (dir, what) => {
  try { return fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort(byCodeUnit); } catch { throw refusal('DB_MIGRATIONS_MISSING', `${what} (${dir}) is not readable`); }
};

const stampOf = (file) => file.split('_')[0];

function archiveOf(root, decl) {
  if (decl.archiveDir === null || !fs.existsSync(path.join(root, decl.archiveDir))) return [];
  const moved = new Map(decl.restamp.map((pair) => [pair.from, pair.to]));
  return sqlNames(path.join(root, decl.archiveDir), 'the archive directory').map((file) => {
    const version = moved.get(stampOf(file)) ?? stampOf(file);
    return { from: path.join(root, decl.archiveDir, file), name: `${version}_${file.slice(file.indexOf('_') + 1)}`, version };
  });
}

function stampProblems(model, decl) {
  const { files, baselineFile, standardFile, baseline, standard } = model;
  for (const file of files) {
    const version = stampOf(file);
    if (file !== baselineFile && version <= baseline) throw refusal('DB_STAMP_ORDER', `${file} sorts at or before the baseline: it would run before the baseline on a fresh database`);
    if (standardFile && file !== baselineFile && file !== standardFile && version <= standard) throw refusal('DB_STAMP_ORDER', `${file} sorts before the second baseline`);
    if (decl.restamp.some((pair) => pair.to === version)) throw refusal('DB_STAMP_COLLISION', `${file} collides with a restamp target`);
  }
}

/** The migration files of the app and its baseline pair; refuses badly named, duplicate-stamped or missing files. */
function checkedFiles(root, decl) {
  const files = sqlNames(path.join(root, decl.migrationsDir), 'the migrations directory');
  const bad = files.filter((file) => !MIGRATION.test(file));
  if (bad.length > 0) throw refusal('DB_MIGRATION_NAME', `migration files must be <14-digit stamp>_<name>.sql (got ${bad[0]})`);
  if (new Set(files.map(stampOf)).size !== files.length) throw refusal('DB_STAMP_DUPLICATE', 'two migrations share one stamp');
  const baselineFile = files.find((file) => file.endsWith(`_${decl.baseline}.sql`));
  const standardFile = decl.standard === null ? undefined : files.find((file) => file.endsWith(`_${decl.standard}.sql`));
  if (!baselineFile) throw refusal('DB_BASELINE_MISSING', `no migration named ${decl.baseline} in ${decl.migrationsDir}`);
  if (decl.standard !== null && !standardFile) throw refusal('DB_BASELINE_MISSING', `no migration named ${decl.standard} in ${decl.migrationsDir}`);
  return { files, baselineFile, standardFile };
}

/** Classifies the migration files of the app: baseline pair, held-back, forward, restamp pairs and archive. Refuses an inconsistent repository. */
export function buildModel(root, decl) {
  const { files, baselineFile, standardFile } = checkedFiles(root, decl);
  const held = files.filter((file) => decl.heldBack.some((name) => file.endsWith(`_${name}.sql`)));
  const push = files.filter((file) => !held.includes(file));
  const baseline = stampOf(baselineFile);
  const model = {
    root, decl, files, baselineFile, standardFile, baseline, standard: standardFile ? stampOf(standardFile) : null, held, push,
    heldVersions: held.map(stampOf), pushPending: push.filter((file) => file !== baselineFile).map(stampOf), archive: archiveOf(root, decl),
  };
  stampProblems(model, decl);
  return { ...model, pushVersions: new Set([baseline, ...model.pushPending]), allowed: new Set([baseline, ...model.pushPending, ...model.heldVersions]) };
}

/* ---- reading the CLI */

/** Versions from the JSON form of `supabase migration list`, or null when the text holds no readable JSON. */
function jsonVersions(text) {
  const start = text.indexOf('{"migrations"');
  if (start < 0) return null;
  const end = text.indexOf('\n', start);
  try {
    const items = JSON.parse(text.slice(start, end > 0 ? end : undefined)).migrations;
    return { remote: new Set(items.filter((item) => item.remote).map((item) => item.remote)), local: new Set(items.filter((item) => item.local).map((item) => item.local)) };
  } catch { return null; }
}

/** Versions from the older table form: rows of `local | remote | time`. */
function tableVersions(text) {
  const remote = new Set();
  const local = new Set();
  for (const cells of text.split('\n').map((line) => line.split('|').map((cell) => cell.trim())).filter((row) => row.length >= 3)) {
    if (STAMP.test(cells[0])) local.add(cells[0]);
    if (STAMP.test(cells[1])) remote.add(cells[1]);
  }
  return { remote, local };
}

/** Remote (and local) versions from `supabase migration list`: the JSON form, or the older table. */
const parseMigrationList = (text) => jsonVersions(text) ?? tableVersions(text);

/** The versions a `db push --dry-run` would apply. */
export const pendingVersions = (text) => [...new Set([...text.matchAll(PENDING)].map((match) => match[1]))];

/* ---- the target */

const scrub = (text, secrets) => secrets.reduce((out, secret) => out.replaceAll(secret, '[value]'), String(text));

function parseConnection(value) {
  try {
    const url = new URL(value);
    if (!/^postgres(?:ql)?:$/u.test(url.protocol)) return null;
    const password = decodeURIComponent(url.password);
    url.password = '';
    return { url: url.toString(), password };
  } catch { return null; }
}

function urlTarget(ctx, name) {
  if (!KEY.test(name)) throw refusal('DB_USAGE', '--url-env must name an UPPER_CASE environment variable');
  const value = ctx.env[name];
  if (typeof value !== 'string' || value === '') throw refusal('DB_URL_ENV_MISSING', `${name} is not set`);
  const parsed = parseConnection(value);
  if (!parsed) throw refusal('DB_URL_INVALID', `${name} is not a postgres connection URL`);
  const secrets = [value, parsed.password].filter(Boolean);
  return { kind: 'url', how: `connection string from ${name}`, url: parsed.url, env: parsed.password ? { PGPASSWORD: parsed.password } : {}, secrets };
}

function sealedPassword(ctx, spec) {
  let map;
  try { map = readMap(path.join(ctx.cwd, STACKS_DIR, spec.env, 'secrets', `${spec.member}.enc`), ctx.sops); } catch { throw refusal('DB_PASSWORD_UNREADABLE', `the sealed member ${spec.member} cannot be opened`); }
  if (typeof map[spec.key] !== 'string' || map[spec.key] === '') throw refusal('DB_PASSWORD_UNREADABLE', `the sealed member ${spec.member} has no value for ${spec.key}`);
  return map[spec.key];
}

/** The database password for the linked CLI: SUPABASE_DB_PASSWORD from the environment, else the declared sealed value, else none (the CLI mints a login). */
function linkedPassword(ctx, decl) {
  const given = ctx.env.SUPABASE_DB_PASSWORD;
  if (typeof given === 'string' && given !== '') return given;
  return decl.password === null ? null : sealedPassword(ctx, decl.password);
}

function linkedTarget(ctx, decl) {
  let ref;
  try { ref = fs.readFileSync(path.join(ctx.cwd, 'supabase', '.temp', 'project-ref'), 'utf8').trim(); } catch { throw refusal('DB_NOT_LINKED', 'no linked project (supabase/.temp/project-ref): run supabase link first'); }
  if (decl.projectRef !== null && ref !== decl.projectRef) throw refusal('DB_WRONG_PROJECT', `the app is linked to ${ref}, not the declared project ${decl.projectRef}`);
  const password = linkedPassword(ctx, decl);
  return { kind: 'linked', how: `linked project ${ref}`, ref, url: null, env: password ? { SUPABASE_DB_PASSWORD: password } : {}, secrets: password ? [password] : [] };
}

/** { kind, how, env, secrets, url }: the linked project of the app (default) or the connection string in the named environment variable. */
export function resolveTarget(ctx, decl, options) {
  if (options.linked === true && options.urlEnv !== undefined) throw refusal('DB_USAGE', '--linked and --url-env exclude each other');
  return options.urlEnv === undefined ? linkedTarget(ctx, decl) : urlTarget(ctx, options.urlEnv);
}

/** CLI arguments that select the database and the local supabase folder. */
export const targetArgs = (target, dir) => (target.kind === 'url' ? ['--db-url', target.url, '--workdir', dir] : ['--linked', '--workdir', dir]);

/** Refuses a mutation unless the operator armed it with STARCI_DB_ARMED=1. */
export function requireArmed(ctx) {
  if (ctx.env.STARCI_DB_ARMED !== '1') throw approvalMissing('DB_NOT_ARMED', 'set STARCI_DB_ARMED=1 to apply database changes');
}

const supabaseCommand = (root) => {
  const script = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
  return fs.existsSync(script) ? [process.execPath, script] : ['supabase'];
};

/** Runs the Supabase CLI through the seam; a failure names the first stderr line with every secret scrubbed. Returns { stdout, text } (text = stdout plus stderr). */
export function runCli(session, args) {
  const { ctx, target } = session;
  const [command, ...lead] = supabaseCommand(ctx.cwd);
  const run = tool(ctx, command, [...lead, ...args], { cwd: ctx.cwd, env: { ...ctx.env, ...target.env } });
  if (run.error) throw failure('DB_CLI_MISSING', `cannot run the Supabase CLI (${scrub(run.error.message, target.secrets)})`);
  if (run.status !== 0) throw failure('DB_CLI_FAILED', `supabase ${args.slice(0, 2).join(' ')} failed: ${scrub(firstLine(run.stderr), target.secrets)}`);
  return { stdout: run.stdout ?? '', text: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

/** The remote history as a Set of versions (read-only). */
export const listRemote = (session) => parseMigrationList(runCli(session, ['migration', 'list', ...targetArgs(session.target, session.ctx.cwd)]).text).remote;

/* ---- the plan */

/** Pure: what to do given the remote history. `done` means baseline + forward are present and nothing else is. */
function planMigration(model, remote) {
  const done = [...model.pushVersions].every((version) => remote.has(version)) && [...remote].every((version) => model.allowed.has(version));
  const sim = new Set(remote);
  const repairs = model.decl.restamp.filter((pair) => sim.has(pair.from));
  for (const pair of repairs) {
    sim.delete(pair.from);
    sim.add(pair.to);
  }
  const reverts = sim.has(model.baseline) ? [] : model.archive.map((item) => item.version).filter((version) => sim.has(version));
  for (const version of reverts) sim.delete(version);
  const mark = !sim.has(model.baseline);
  sim.add(model.baseline);
  const push = model.pushPending.filter((version) => !sim.has(version));
  for (const version of push) sim.add(version);
  const archived = new Set(model.archive.map((item) => item.version));
  const missingFiles = repairs.map((pair) => pair.to).filter((version) => !archived.has(version));
  return { done, repairs, reverts, mark, push, missingFiles, unexpected: [...sim].filter((version) => !model.allowed.has(version)), final: sim.size };
}

function planLines(model, session, remote, plan) {
  const nameOf = (version) => model.files.find((file) => file.startsWith(`${version}_`));
  return [
    `target         ${session.target.how}`,
    `remote history ${remote.size} version(s)`,
    [`repairs        ${plan.repairs.length} restamped version(s) to move`, ...plan.repairs.map((pair) => `  ${pair.from} -> ${pair.to}`)].join('\n'),
    `archive revert ${plan.reverts.length} archived version(s) present on the remote`,
    `baseline       ${model.baseline} ${plan.mark ? 'will be marked applied (not run)' : 'already applied'}`,
    `forward push   ${plan.push.length} migration(s): ${plan.push.map(nameOf).join(', ') || 'none'}`,
    `held back      ${model.held.join(', ') || 'none'} (never applied here; starci app db post-cutover)`,
  ];
}

const dataOf = (model, plan, remote, extra) => ({
  remoteCount: remote.size, repairs: plan.repairs.length, reverts: plan.reverts, baseline: model.baseline, markBaseline: plan.mark, push: plan.push,
  heldBack: model.heldVersions, done: plan.done, ...extra,
});

/* ---- applying */

/** A scratch supabase project holding exactly the given migration files; the link state of the app is copied so --linked works from it. */
function buildScratch(session, dir, copies) {
  fs.mkdirSync(path.join(dir, 'supabase', 'migrations'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'supabase', 'config.toml'), 'project_id = "starci-db-scratch"\n');
  for (const copy of copies) fs.copyFileSync(copy.from, path.join(dir, 'supabase', 'migrations', copy.name));
  if (session.target.kind === 'linked') fs.cpSync(path.join(session.ctx.cwd, 'supabase', '.temp'), path.join(dir, 'supabase', '.temp'), { recursive: true });
}

const repair = (session, status, versions, dir) => runCli(session, ['migration', 'repair', '--status', status, ...versions, ...targetArgs(session.target, dir)]);

function applyRepairs(session, plan, scratch) {
  const dir = path.join(scratch, 'archive');
  buildScratch(session, dir, session.model.archive.map((item) => ({ from: item.from, name: item.name })));
  repair(session, 'reverted', plan.repairs.map((pair) => pair.from), dir);
  repair(session, 'applied', plan.repairs.map((pair) => pair.to), dir);
}

function applyForward(session, plan, scratch) {
  const { model } = session;
  const dir = path.join(scratch, 'baseline');
  buildScratch(session, dir, model.push.map((file) => ({ from: path.join(model.root, model.decl.migrationsDir, file), name: file })));
  if (plan.reverts.length > 0) repair(session, 'reverted', plan.reverts, dir);
  if (plan.mark) repair(session, 'applied', [model.baseline], dir);
  const pending = pendingVersions(runCli(session, ['db', 'push', '--dry-run', ...targetArgs(session.target, dir)]).text);
  const stray = pending.filter((version) => !model.pushPending.includes(version));
  if (stray.length > 0) throw failure('DB_PUSH_STRAY', `the dry run lists versions outside the push list: ${stray.join(', ')}. Stopped before pushing.`);
  if (pending.length > 0) runCli(session, ['db', 'push', '--yes', ...targetArgs(session.target, dir)]);
  return pending;
}

function applyPlan(session, plan) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-db-'));
  try {
    if (plan.repairs.length > 0) applyRepairs(session, plan, scratch);
    const after = planMigration(session.model, listRemote(session));
    return applyForward(session, after, scratch);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * `starci app db migrate`. options: { execute, linked, urlEnv }. Dry run reads the remote history once and prints the plan; --execute (with
 * STARCI_DB_ARMED=1) applies it. Already baseline + forward: `nothing to do`, no mutating call, ok.
 */
async function migrateDatabase(ctx, decl, options = {}) {
  const model = buildModel(ctx.cwd, decl);
  const session = { ctx, model, target: resolveTarget(ctx, decl, options) };
  const remote = listRemote(session);
  const plan = planMigration(model, remote);
  if (plan.done) return { ok: true, lines: [`target         ${session.target.how}`, 'remote history already is the baseline plus the forward migrations (held-back ones may or may not be applied). Nothing to do.'], data: dataOf(model, plan, remote, { executed: false }) };
  const lines = planLines(model, session, remote, plan);
  const red = [
    ...plan.missingFiles.map((version) => `no archived migration file for the restamped version ${version}`),
    ...plan.unexpected.map((version) => `remote version ${version} is outside baseline + forward + held-back and no restamp or archive row explains it`),
  ];
  if (red.length > 0) return { ok: false, lines: [...lines, ...red.map((item) => `RED: ${item}`), 'nothing applied.'], data: dataOf(model, plan, remote, { red, executed: false }) };
  if (options.execute !== true) return { ok: true, lines: [...lines, `dry run: read-only (one migration list); the final history would be ${plan.final} version(s). Nothing applied.`], data: dataOf(model, plan, remote, { executed: false }) };
  requireArmed(ctx);
  const pushed = applyPlan(session, plan);
  const final = listRemote(session);
  const verdict = planMigration(model, final);
  if (!verdict.done) throw failure('DB_FINAL_MISMATCH', `the remote history is not baseline + forward migrations (${[...final].join(', ')})`);
  return { ok: true, lines: [...lines, `applied: ${pushed.length} forward migration(s) pushed; the remote history now holds ${final.size} version(s). Held back: ${model.held.join(', ') || 'nothing'}.`], data: dataOf(model, plan, remote, { executed: true, pushed, remoteCountAfter: final.size }) };
}

const SPEC = { boolean: ['--execute', '--json', '--linked'], value: ['--url-env'] };

/** Entry of the verb: `starci app db migrate [--execute] [--linked | --url-env NAME] [--json]`. `io` is the app IO of src/main.mjs. */
export function dbMigrateMain(argv, io = {}) {
  return runVerb({
    label: 'starci app db migrate', name: 'db migrate', code: 'DB_USAGE', io, argv, spec: SPEC,
    run: (ctx, flags) => migrateDatabase(ctx, loadDatabase(ctx.cwd), { execute: flags.execute === true, linked: flags.linked === true, urlEnv: flags['url-env'] }),
  });
}
