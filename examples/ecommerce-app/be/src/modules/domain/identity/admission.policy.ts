import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

/** What a credential-marked door requires and what `CredentialGuard` established for it. */
export interface CredentialAdmission {
    /** The `@Credential` metadata of the door. */
    readonly required: CredentialMetadata
    /** The principal `CredentialGuard` set on the request, when the credential authenticated. */
    readonly principal: CredentialPrincipal | undefined
}

const admitCredential = ({
    required,
    principal,
}: CredentialAdmission): Outcome<CredentialPrincipal, IdentityErrorCode> =>
    principal?.kind === required.kind ? ok(principal) : refused(IdentityErrorCode.Unauthenticated)

/**
 * Admits credential-marked doors only with their authenticated credential principal, and admits doors with canonical
 * public reasons. Every other door requires session authentication in AuthGuard.
 */
export const admit = (
    metadata: PublicMetadata | undefined,
    credential?: CredentialAdmission,
): Outcome<PublicReason | CredentialPrincipal, IdentityErrorCode> => {
    if (credential !== undefined) return admitCredential(credential)
    switch (metadata?.reason) {
        case PublicReason.Health:
        case PublicReason.AuthHandshake:
        case PublicReason.SignedWebhook:
        case PublicReason.CatalogRead:
            return ok(metadata.reason)
        case undefined:
        default:
            return refused(IdentityErrorCode.Unauthenticated)
    }
}
