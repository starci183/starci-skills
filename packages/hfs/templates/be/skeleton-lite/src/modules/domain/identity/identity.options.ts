import type { Type } from "@nestjs/common"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import type { CredentialAuthenticator } from "./credential.contracts"

/** The identity capability's credential and session verification options. */
export interface IdentityOptions {
    /** The app-owned authenticator of alternate credentials; a credential door fails closed while it is absent. */
    readonly credentialAuthenticator?: Type<CredentialAuthenticator>
    /** Cryptographically verifies a Supabase access token before it can become a principal. */
    readonly verifyAccessToken: VerifySupabaseAccessToken
}
