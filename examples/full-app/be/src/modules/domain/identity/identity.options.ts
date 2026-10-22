import type { InjectionToken, Type } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"
import type { CredentialAuthenticator } from "./credential.contracts"

/** Options of the identity capability. */
export interface IdentityOptions {
    /** The token of the provider that checks bearer tokens in this app: the session service in the identity app, the identity api client elsewhere. */
    readonly verifier: InjectionToken
    /** The app-owned authenticator of alternate credentials; a credential door fails closed while it is absent. */
    readonly credentialAuthenticator?: Type<CredentialAuthenticator>
    /** The key each calling service presents to a service door, by service name; only the identity app holds them. */
    readonly serviceKeys?: Readonly<Record<string, Secret>>
}
