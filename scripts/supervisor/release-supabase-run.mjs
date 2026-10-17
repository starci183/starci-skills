// release-supabase-run.mjs - `node release-supabase-run.mjs <example-dir> -- npm <args>`: one npm command of a lite (Supabase) example app run against that app's OWN
// disposable local Supabase CLI stack, the way its integration specs expect it ("connects to the already migrated local CLI stack"). The release cut's lite
// `test:integration` row runs through it (release-l4.mjs); the real tests decide (owner ruling no-runtime-specs), so the integration layer runs for real.
// Steps: `supabase start` (bounded by START_TIMEOUT_MS) for the project of the app's supabase/config.toml, `supabase db reset` (the local database only: no
// --linked, no remote project is ever touched), a fresh random password for the least-privilege `app_be` role set through the local superuser URL, then the
// command with the canon lite keys (PRIMARY_DB_URL as app_be, PRIMARY_DB_SCHEMA, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY of the LOCAL stack), and always
// `supabase stop` in a finally, on failure and on timeout too. No value is printed. Exit status: the command's (1 when the stack could not be prepared).
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { runNpm } from '../api/npm/run-npm.mjs';
import { runNpx } from '../api/npm/run-npx.mjs';
import { rowRunnerMain } from '../lib/row-runner-cli.mjs';
import { isMain } from '../lib/is-main.mjs';

const START_TIMEOUT_MS = 10 * 60_000;
const STEP_TIMEOUT_MS = 5 * 60_000;
const COMMAND_TIMEOUT_MS = 50 * 60_000;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

const say = (line) => process.stderr.write(`supabase-run: ${line}\n`);
const supabase = (dir, args, timeout) => runNpx(['--no-install', 'supabase', ...args], { cwd: dir, timeout, stdio: ['ignore', 'pipe', 'pipe'] });

/** The project id of the app's local stack: its supabase/config.toml `project_id` (each example app declares its own, so stacks never collide). */
function projectOf(dir) {
  const file = path.join(dir, 'supabase', 'config.toml');
  const id = fs.existsSync(file) ? /^project_id\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(file, 'utf8'))?.[1] : null;
  if (!id) throw new Error(`${file} declares no project_id`);
  return id;
}

/** The local stack's DB_URL, API_URL and SERVICE_ROLE_KEY from `supabase status -o env`; refuses anything that is not a loopback stack. */
function localStack(dir) {
  const r = supabase(dir, ['status', '-o', 'env'], STEP_TIMEOUT_MS);
  if (r.status !== 0) throw new Error(`supabase status exited ${r.status ?? r.signal}`);
  const values = Object.fromEntries(String(r.stdout).split(/\r?\n/).map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line)).filter(Boolean).map((m) => [m[1], m[2]]));
  const db = new URL(values.DB_URL ?? 'invalid:');
  if (!LOCAL_HOSTS.has(db.hostname) || !values.API_URL || !values.SERVICE_ROLE_KEY) throw new Error('supabase status did not describe a local stack');
  return { db, api: values.API_URL, serviceRole: values.SERVICE_ROLE_KEY };
}

/** Gives the app's `app_be` role a fresh password on the local stack (through the local superuser URL); returns its connection URL. */
async function appBeUrl(dir, db) {
  const { Client } = createRequire(path.join(dir, 'package.json'))('pg');
  const password = randomBytes(24).toString('hex');
  const client = new Client({ connectionString: db.href });
  await client.connect();
  try { await client.query(`alter role app_be with password ${client.escapeLiteral(password)}`); } finally { await client.end(); }
  const url = new URL(db.href);
  url.username = 'app_be';
  url.password = password;
  return url.href;
}

/** Runs `npm <args>` of the example at `appDir` against its own fresh local stack; resolves to the exit status. */
async function runWithLocalSupabase(appDir, args) {
  const dir = path.resolve(appDir);
  const project = projectOf(dir);
  try {
    say(`starting the local stack of ${project}`);
    const start = supabase(dir, ['start'], START_TIMEOUT_MS);
    if (start.status !== 0) { say(`supabase start failed (${start.status ?? start.signal ?? start.error?.code}): ${String(start.stderr ?? '').trim().split('\n').slice(-3).join(' | ')}`); return 1; }
    const reset = supabase(dir, ['db', 'reset'], STEP_TIMEOUT_MS);
    if (reset.status !== 0) { say(`supabase db reset failed (${reset.status ?? reset.signal})`); return 1; }
    const stack = localStack(dir);
    const env = { ...process.env, PRIMARY_DB_URL: await appBeUrl(dir, stack.db), PRIMARY_DB_SCHEMA: 'public', SUPABASE_URL: stack.api, SUPABASE_SERVICE_ROLE_KEY: stack.serviceRole };
    say(`running npm ${args.join(' ')} against ${project} (local ${stack.db.host})`);
    const run = runNpm(args, { cwd: dir, env, stdio: 'inherit', timeout: COMMAND_TIMEOUT_MS });
    if (run.error) say(`npm ${args.join(' ')} ended: ${run.error.code ?? run.error.message}`);
    return run.status ?? 1;
  } finally {
    const stop = supabase(dir, ['stop', '--no-backup'], STEP_TIMEOUT_MS);
    say(stop.status === 0 ? `stopped the local stack of ${project}` : `supabase stop exited ${stop.status ?? stop.signal}; stop it by hand: cd ${dir} && npx supabase stop --no-backup`);
  }
}

if (isMain(import.meta.url)) process.exitCode = await rowRunnerMain(process.argv.slice(2), { name: 'supabase-run', run: (dir, args) => runWithLocalSupabase(dir, args) });
