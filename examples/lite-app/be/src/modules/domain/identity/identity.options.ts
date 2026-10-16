import type { Type } from "@nestjs/common"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import type { CredentialAuthenticator } from "./credential.contracts"

/** The verified identity sources used by the credential and default-deny guards. */
export interface IdentityOptions {
    /** Cryptographically verifies a Supabase access token before it can become a principal. */
    readonly verifyAccessToken: VerifySupabaseAccessToken
    /** The app-owned authenticator of alternate credentials; a credential door fails closed while it is absent. */
    readonly credentialAuthenticator?: Type<CredentialAuthenticator>
}
