// lib.mjs - resolve and spawn the app-local Supabase CLI for this API system, with no shell.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const candidateNames = (platform) => platform === 'win32'
  ? ['supabase.exe', 'supabase', 'supabase.cmd']
  : ['supabase'];

/** Resolve the app-local Supabase CLI first, then PATH, retaining a PATH lookup fallback for useful spawn errors. */
function resolveSupabase(appRoot, { env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
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

/** Run one Supabase call for an app root; options retain the injectable spawn seam used by focused specs. */
export const supabaseSpawn = (appRoot, args, {
  env = process.env,
  supabase,
  timeout = 60_000,
  run = spawnSync,
} = {}) => run(supabase ?? resolveSupabase(appRoot, { env }), args, {
  cwd: appRoot,
  encoding: 'utf8',
  env,
  timeout,
  windowsHide: true,
});
