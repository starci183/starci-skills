// project-start.mjs - invoke one app's Supabase CLI start call.
import { supabaseSpawn } from './lib.mjs';

/** The one external call for `supabase start`. */
export const projectStart = (appRoot, { timeout = 300_000, ...options } = {}) =>
  supabaseSpawn(appRoot, ['start', '--workdir', appRoot], { ...options, timeout });
