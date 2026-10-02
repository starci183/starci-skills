// start.mjs - resolve and invoke one app's Supabase CLI start call without a shell.
import fs from 'node:fs';
import path from 'node:path';
import { runProgram } from '../process/run-program.mjs';

const candidateNames = (platform) => platform === 'win32'
  ? ['supabase.exe', 'supabase', 'supabase.cmd']
  : ['supabase'];

/** Resolve the app-local Supabase CLI first, then PATH; leave a PATH lookup fallback for a useful spawn error. */
export function resolveSupabase(appRoot, { env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  const names = candidateNames(platform);
  const local = path.join(appRoot, 'node_modules', '.bin');
  for (const name of names) {
    const file = path.join(local, name);
    if (exists(file)) return file;
  }
  const delimiter = platform === 'win32' ? ';' : ':';
  for (const directory of String(env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const file = path.join(directory, name);
      if (exists(file)) return file;
    }
  }
  return 'supabase';
}

/** The one external call for `supabase start`; returns the spawnSync result. */
export function supabaseStart(appRoot, { env = process.env, supabase, timeout = 300_000, run = runProgram } = {}) {
  const binary = supabase ?? resolveSupabase(appRoot, { env });
  return run(binary, ['start', '--workdir', appRoot], { cwd: appRoot, env, timeout });
}
