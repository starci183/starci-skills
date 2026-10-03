// project-stop.mjs - stop exactly one configured Supabase project, never every local stack.
import { supabaseSpawn } from './lib.mjs';

/** The one external call for `supabase stop`. */
export const projectStop = (appRoot, projectId, { noBackup = false, timeout = 120_000, ...options } = {}) =>
  supabaseSpawn(appRoot, [
    'stop', '--project-id', projectId, ...(noBackup ? ['--no-backup'] : []), '--workdir', appRoot,
  ], { ...options, timeout });
