// migration-repair.mjs - migration history repair for an app's local or linked Supabase database.
import { supabaseCall } from './lib.mjs';

/** The spawn result of supabase migration repair; arguments and runner options remain with the caller. */
export function migrationRepair(...args) { return supabaseCall(['migration', 'repair'], ...args); }
