import type { InjectionToken } from "@nestjs/common"

/** Options of the auth capability. */
export interface AuthOptions {
    /** The token of the provider that checks bearer tokens in this app: the session service in the identity app, the identity api client elsewhere. */
    readonly verifier: InjectionToken
}
