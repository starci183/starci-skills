/**
 * `supabase/types/database.types.ts` (slot `app.supabase.types`): the Database types the Supabase CLI generates from an app's
 * local stack, written by `npm run contract:emit` (`hfs emit-contracts`) beside the be contract snapshots and judged for drift
 * by DB_TYPES_DRIFT (L09, scripts/hfs/rules/database.mjs) - the rule compares the committed file with the text `emitTypes()`
 * produces, and `dbTypesEmitter` below is that callback.
 *
 * The text is `supabase gen types typescript --local` run at the app root against the running local stack, narrowed to the
 * schemas `supabase/config.toml` declares under [api]; the CLI reaches Docker, so nothing here runs inside a check that has
 * no stack. `run` is the command runner - `(file, args, {cwd})` answering the spawnSync result `{status, stdout, stderr}` -
 * the default spawns the `supabase` binary with an argument array, never a shell string and never printing env; a spec's fake
 * keeps Docker out of the suite. A run that cannot produce the text throws DbTypesError (HFS_EMIT_DB_TYPES_FAILED).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { parseYaml } from '../runtime/engine/yaml.mjs';

/** The repository-relative path of the generated types (the path of slot `app.supabase.types`). */
export const dbTypesPath = 'supabase/types/database.types.ts';

/** The slot that owns the generated types; enabled by a connection declaring provider supabase. */
export const DB_TYPES_SLOT = 'app.supabase.types';

/** The config file whose [api] schemas narrow the generation. */
const CONFIG_FILE = 'supabase/config.toml';
const SUPABASE_CLI = 'supabase';

/** A types emit that could not run: the code modules/kernel/failure-codes.yaml catalogues as HFS_EMIT_DB_TYPES_FAILED. */
export class DbTypesError extends Error {
  constructor(message, details = {}) {
    super(`HFS_EMIT_DB_TYPES_FAILED: ${message}`);
    this.name = 'DbTypesError';
    this.code = 'HFS_EMIT_DB_TYPES_FAILED';
    this.details = details;
  }
}

const spawn = (file, args, options = {}) => spawnSync(file, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...options });
const PINS_FILE = new URL('../runtime/knowledge/hfs/canon-pins.yaml', import.meta.url);

/**
 * The one spawn: an argument array, a hidden window, a bound buffer, never a shell. Specs inject a fake of the same shape. The
 * `supabase` binary is the one on PATH; a machine without it runs the CLI at the canon pin through npx (the pin of knowledge/hfs/canon-pins.yaml).
 */
const defaultRun = (file, args, options = {}) => {
  const first = spawn(file, args, options);
  if (file !== SUPABASE_CLI || first.error?.code !== 'ENOENT') return first;
  const version = parseYaml(fs.readFileSync(PINS_FILE, 'utf8'))?.pins?.[SUPABASE_CLI]?.version;
  if (!version) return first;
  return process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', 'npx', '--yes', `${SUPABASE_CLI}@${version}`, ...args], options)
    : spawn('npx', ['--yes', `${SUPABASE_CLI}@${version}`, ...args], options);
};

/** The first meaningful line of a failure output, for the error a human acts on. */
const firstLine = (text) => String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0];

/**
 * The schemas `supabase/config.toml` exposes under [api] (`[]` when the file or the list is absent - the CLI then reads its
 * own defaults). A config that does not parse is a refusal: L08 reads the same file and the emit must not guess.
 */
function apiSchemas(root) {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) return [];
  let toml;
  try { toml = parseToml(fs.readFileSync(file, 'utf8')); } catch (error) {
    throw new DbTypesError(`${CONFIG_FILE} is not readable valid TOML (${firstLine(error?.message ?? error) ?? 'unreadable'}); the types scope comes from its [api] schemas`, { file: CONFIG_FILE });
  }
  return (toml?.api?.schemas ?? []).filter((schema) => typeof schema === 'string');
}

/**
 * The freshly generated text of `dbTypesPath` for the app at `root`: `supabase gen types typescript --local` (the running
 * local stack), narrowed to the [api] schemas of supabase/config.toml. A failing CLI, a spawn error and an empty answer all
 * raise DbTypesError; the first stderr line names the cause.
 */
export function emitDbTypes({ root, run = defaultRun } = {}) {
  const schemas = apiSchemas(root);
  const args = ['gen', 'types', 'typescript', '--local', ...(schemas.length ? ['--schema', schemas.join(',')] : [])];
  const command = `${SUPABASE_CLI} ${args.join(' ')}`;
  let result;
  try {
    result = run(SUPABASE_CLI, args, { cwd: root });
  } catch (error) {
    throw new DbTypesError(`\`${command}\` could not run: ${firstLine(error?.message ?? error) ?? 'unknown failure'}; the local Supabase stack must be up (supabase start)`, { file: dbTypesPath });
  }
  const stdout = String(result?.stdout ?? '');
  const stderr = String(result?.stderr ?? '');
  if (result?.error || result?.status !== 0 || !stdout.trim()) {
    const cause = firstLine(stderr) ?? firstLine(result?.error?.message ?? result?.error) ?? 'no output';
    throw new DbTypesError(`\`${command}\` failed${result?.status !== undefined && result?.status !== null ? ` (exit ${result.status})` : ''}: ${cause}; the local Supabase stack must be up (supabase start)`, { file: dbTypesPath, stderr });
  }
  return stdout;
}

/**
 * The types of an app that has no stack yet (a fresh scaffold): start the app's own local stack (its project id and ports from
 * supabase/config.toml; every migration of supabase/migrations is applied on start), emit the types, and stop the stack again when
 * this call started it. The slow, Docker-reaching path `hfs scaffold --edition lite` takes; `emitDbTypes` alone is the fast one for a stack that is up.
 */
export function generateDbTypes({ root, run = defaultRun } = {}) {
  const started = run(SUPABASE_CLI, ['start', '-x', 'studio,mailpit,logflare,vector,edge-runtime,imgproxy,supavisor'], { cwd: root });
  const already = /already (?:running|started)/i.test(`${started?.stderr ?? ''}${started?.stdout ?? ''}`);
  if (started?.error || (started?.status !== 0 && !already)) {
    throw new DbTypesError(`\`${SUPABASE_CLI} start\` failed${started?.status != null ? ` (exit ${started.status})` : ''}: ${firstLine(started?.stderr) ?? firstLine(started?.error?.message ?? started?.error) ?? 'no output'}; Docker must be running`, { file: dbTypesPath });
  }
  try {
    return emitDbTypes({ root, run });
  } finally {
    if (!already) run(SUPABASE_CLI, ['stop', '--no-backup'], { cwd: root });
  }
}

/**
 * Writes `emitDbTypes` to `<root>/<dbTypesPath>`, creating `supabase/types/` when needed. Answers `{ path, changed }`:
 * `changed` is false when the committed text already equals the generated one, so a re-run is a no-op on disk.
 */
export function writeDbTypes({ root, run } = {}) {
  const text = emitDbTypes({ root, run });
  const target = path.join(root, dbTypesPath);
  const committed = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  const changed = committed !== text;
  if (changed) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return { path: dbTypesPath, changed };
}

/**
 * Whether the slot `app.supabase.types` is enabled for the app `resolver` views (a connection of the app declares
 * provider: supabase). Read through the slot view, never through a path check: a side-scope resolver holds no app slots
 * and answers false, exactly like an app without a supabase connection.
 */
export function appHasDbTypes(resolver) {
  const slot = typeof resolver?.slot === 'function' ? resolver.slot(DB_TYPES_SLOT) : null;
  return slot != null && typeof resolver?.slotEnabled === 'function' && resolver.slotEnabled(slot) === true;
}

/**
 * The `emitTypes` callback checkDatabase (L09 DB_TYPES_DRIFT) expects: `({repoRoot, declaration}) -> text`, `repoRoot`
 * being the app root under check; the bound `root` is the fallback for a caller that already knows it. The declared
 * `supabase` block plays no part: the schemas come from supabase/config.toml on disk.
 */
export const dbTypesEmitter = ({ root = null, run } = {}) => async ({ repoRoot } = {}) => emitDbTypes({ root: repoRoot ?? root, run });
