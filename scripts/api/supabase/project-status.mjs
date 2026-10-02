// project-status.mjs - read one app's local Supabase status as JSON.
import { supabaseSpawn } from './lib.mjs';

/** The one external call for `supabase status`. */
export const projectStatus = (appRoot, options = {}) =>
  supabaseSpawn(appRoot, ['status', '-o', 'json', '--workdir', appRoot], options);
