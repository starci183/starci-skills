import type { EnvSource } from "@modules/platform/config"

/** This command app delegates migration configuration to the managed Supabase CLI. */
export interface CliEnv {}

/** Keeps the command app's environment boundary explicit while no command needs app configuration. */
export const readCliEnv = (_env: EnvSource): CliEnv => ({})
