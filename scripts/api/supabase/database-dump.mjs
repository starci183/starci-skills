// database-dump.mjs - schema dump for an app's local or linked Supabase database.
import { supabaseCall } from './lib.mjs';

/** The spawn result of supabase db dump; arguments and runner options remain with the caller. */
export function databaseDump(...args) { return supabaseCall(['db', 'dump'], ...args); }
