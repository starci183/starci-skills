// database-push.mjs - pending SQL migration push for an app's selected Supabase database.
import { supabaseCall } from './lib.mjs';

/** The spawn result of supabase db push; target, preview and runner options remain with the owning caller. */
export function databasePush(...args) { return supabaseCall(['db', 'push'], ...args); }
