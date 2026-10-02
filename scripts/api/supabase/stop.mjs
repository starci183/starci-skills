// stop.mjs - invoke Supabase stop for exactly one configured project, never every local stack.
import { runProgram } from '../process/run-program.mjs';
import { resolveSupabase } from './start.mjs';

/** The one external call for `supabase stop`; returns the spawnSync result. */
export function supabaseStop(appRoot, projectId, {
  env = process.env, supabase, noBackup = false, timeout = 120_000, run = runProgram,
} = {}) {
  const binary = supabase ?? resolveSupabase(appRoot, { env });
  const args = ['stop', '--project-id', projectId];
  if (noBackup) args.push('--no-backup');
  args.push('--workdir', appRoot);
  return run(binary, args, { cwd: appRoot, env, timeout });
}
