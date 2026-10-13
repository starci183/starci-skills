// Single source of database-rule finding codes and owned Supabase paths.
export const DB_MIGRATION_SHAPE = 'DB_MIGRATION_SHAPE';
export const DB_RLS_REQUIRED = 'DB_RLS_REQUIRED';
export const DB_DYNAMIC_DDL = 'DB_DYNAMIC_DDL';
export const DB_POLICY_SHAPE = 'DB_POLICY_SHAPE';
export const DB_DEFINER_SAFE = 'DB_DEFINER_SAFE';
export const DB_STORAGE_POLICY = 'DB_STORAGE_POLICY';
export const DB_CONFIG_POLICY = 'DB_CONFIG_POLICY';
export const DB_TYPES_DRIFT = 'DB_TYPES_DRIFT';

export const MIGRATIONS_DIR = 'supabase/migrations';
/** The migrations retired at a baseline cutover (slot app.supabase.migrations.archive): never applied, never judged by L02-L08. */
export const MIGRATIONS_ARCHIVE_DIR = `${MIGRATIONS_DIR}/_archive`;
/** True for a migration the Supabase CLI applies: a path under supabase/migrations/ outside the archive. */
export const isActiveMigration = (file) => file.startsWith(`${MIGRATIONS_DIR}/`) && !file.startsWith(`${MIGRATIONS_ARCHIVE_DIR}/`);
export const CONFIG_FILE = 'supabase/config.toml';
export const TYPES_FILE = 'supabase/types/database.types.ts';
