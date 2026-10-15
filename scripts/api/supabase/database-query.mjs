// database-query.mjs - database query for an app's local or linked Supabase database.
import { supabaseCall } from './lib.mjs';

/** The spawn result of supabase db query; arguments and runner options remain with the caller. */
export function databaseQuery(...args) { return supabaseCall(['db', 'query'], ...args); }
