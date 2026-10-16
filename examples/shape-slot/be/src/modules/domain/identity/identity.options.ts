import type { Type } from "@nestjs/common"
import type { CredentialAuthenticator } from "./credential.contracts"

/** The identity capability's options. */
export interface IdentityOptions {
    /** The app-owned authenticator of alternate credentials; a credential door fails closed while it is absent. */
    readonly credentialAuthenticator?: Type<CredentialAuthenticator>
}
