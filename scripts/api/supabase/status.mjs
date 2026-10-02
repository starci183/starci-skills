// status.mjs - read one app's local Supabase status as JSON without exposing a shell surface.
import { runProgram } from '../process/run-program.mjs';
import { resolveSupabase } from './start.mjs';

/** The one external call for `supabase status`; returns the spawnSync result. */
export function supabaseStatus(appRoot, { env = process.env, supabase, timeout = 60_000, run = runProgram } = {}) {
  const binary = supabase ?? resolveSupabase(appRoot, { env });
  return run(binary, ['status', '-o', 'json', '--workdir', appRoot], { cwd: appRoot, env, timeout });
}
