import type { HttpSecurityOptions } from "@modules/platform/http-security"
import type { ServerOptions } from "@modules/platform/config"

/** Everything the {{app}} app needs from its environment, parsed once by `main.ts` and handed to `AppModule.register`. */
export interface {{appPascal}}Options {
    /** The HTTP listener. */
    readonly server: ServerOptions
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
}
