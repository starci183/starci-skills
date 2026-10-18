// lib.mjs - resolve and spawn the app-local Supabase CLI for this API system, with no shell.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const candidateNames = (platform) => platform === 'win32'
  ? ['supabase.exe', 'supabase', 'supabase.cmd']
  : ['supabase'];

/** Resolve the app's installed npm launcher before executable discovery; npm command shims cannot run without a shell. */
function resolveSupabase(appRoot, { env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  const launcher = path.join(appRoot, 'node_modules', 'supabase', 'dist', 'supabase.js');
  if (exists(launcher)) return { file: process.execPath, args: [launcher] };
  const names = candidateNames(platform);
  const local = path.join(appRoot, 'node_modules', '.bin');
  for (const name of names) {
    const file = path.join(local, name);
    if (exists(file)) return { file, args: [] };
  }
  const delimiter = platform === 'win32' ? ';' : ':';
  for (const directory of String(env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const file = path.join(directory, name);
      if (exists(file)) return { file, args: [] };
    }
  }
  return { file: 'supabase', args: [] };
}

/** Run one shell-free Supabase call at the app root; an unusable command shim returns an ENOEXEC spawn failure. */
export const supabaseSpawn = (appRoot, args, {
  env = process.env,
  supabase,
  timeout = 60_000,
  run = spawnSync,
  platform = process.platform,
  exists = fs.existsSync,
} = {}) => {
  const command = supabase === undefined || supabase === null ? resolveSupabase(appRoot, { env, platform, exists }) : { file: supabase, args: [] };
  if (/\.(?:cmd|bat)$/iu.test(command.file)) return {
    status: null, stdout: '', stderr: '', signal: null,
    error: Object.assign(new Error('The Supabase command shim requires a shell; use an executable or the app-local npm launcher.'), { code: 'ENOEXEC' }),
  };
  return run(command.file, [...command.args, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env,
    timeout,
    windowsHide: true,
  });
};

/** Invoke one Supabase command prefix with caller arguments and runner options. */
export const supabaseCall = (prefix, appRoot, args = [], options = {}) =>
  supabaseSpawn(appRoot, [...prefix, ...args], options);
