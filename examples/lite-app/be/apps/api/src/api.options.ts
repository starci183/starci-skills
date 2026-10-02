import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { ServerOptions } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import type { HttpSecurityOptions } from "@modules/platform/http-security"

/** Everything the API needs from its environment, parsed once by `main.ts` and handed to `AppModule.register`. */
export interface ApiOptions {
    /** The HTTP listener. */
    readonly server: ServerOptions
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
    /** The least-privilege PostgreSQL connection to the Supabase project. */
    readonly database: DatabaseConnectionOptions
    /** Supabase Auth, Storage and token-verification configuration. */
    readonly supabase: SupabaseOptions
}
